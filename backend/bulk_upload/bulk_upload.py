"""
bulk_upload.py
--------------
Purpose:
    Handles bulk creation of organizations, sponsor, and driver accounts from a
    CSV or pipe-delimited file.

Format (Admin):
    O|org_name                            → create/register an organization
    S|username|email                      → create a sponsor account
    D|username|email|sponsor_username     → create a driver and link to sponsor

Format (Sponsor - driver only):
    D|username|email                      → create a driver linked to the uploading sponsor

Both endpoints support partial success: valid rows are processed even if other rows fail.
"""

import csv
import re
import secrets
import string

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from auth.auth import hash_password, require_role
from shared.db import get_connection
from shared.services import get_user_by_username

router = APIRouter()

# All globally recognised type tokens.
VALID_TYPES = {"S", "D", "O"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def generate_temp_password() -> str:
    """Return a random 12-char password that satisfies all validation rules."""
    lower   = secrets.choice(string.ascii_lowercase)
    upper   = secrets.choice(string.ascii_uppercase)
    digit   = secrets.choice(string.digits)
    special = secrets.choice('!@#$%^&*()')
    pool    = string.ascii_letters + string.digits + '!@#$%^&*()'
    rest    = [secrets.choice(pool) for _ in range(8)]
    chars   = list(lower + upper + digit + special) + rest
    secrets.SystemRandom().shuffle(chars)
    return ''.join(chars)


def link_driver_to_sponsor_with_cursor(cursor, sponsor_user_id: int, driver_user_id: int) -> None:
    """Insert SponsorDrivers row using an existing cursor/connection context."""
    try:
        cursor.execute(
            """
            INSERT INTO SponsorDrivers (sponsor_user_id, driver_user_id, status)
            VALUES (%s, %s, 'approved')
            ON DUPLICATE KEY UPDATE sponsor_user_id = sponsor_user_id
            """,
            (sponsor_user_id, driver_user_id),
        )
    except Exception as exc:
        if "Unknown column 'status'" not in str(exc):
            raise
        cursor.execute(
            """
            INSERT INTO SponsorDrivers (sponsor_user_id, driver_user_id)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE sponsor_user_id = sponsor_user_id
            """,
            (sponsor_user_id, driver_user_id),
        )


def create_user_fast(
    cursor,
    username: str,
    email: str,
    role: str,
    plain_password: str,
    first_name: str | None = None,
    last_name: str | None = None,
    company_name: str | None = None,
) -> dict:
    """
    Faster user creation for bulk upload using an existing DB cursor.
    Preserves required sponsor defaults while avoiding per-row new connections.
    """
    password_hash = hash_password(plain_password)
    cursor.execute(
        """
        INSERT INTO Users (username, password_hash, role, email)
        VALUES (%s, %s, %s, %s)
        """,
        (username, password_hash, role, email),
    )
    user_id = cursor.lastrowid

    if role == "sponsor":
        cursor.execute(
            """
            INSERT INTO SponsorProfiles (user_id, dollar_per_point, earn_rate, total_points_allocated)
            VALUES (%s, 0.01, 1.00, 0)
            ON DUPLICATE KEY UPDATE user_id = user_id
            """,
            (user_id,),
        )
        if company_name:
            cursor.execute(
                """
                UPDATE SponsorProfiles
                SET company_name = COALESCE(NULLIF(company_name, ''), %s)
                WHERE user_id = %s
                """,
                (company_name, user_id),
            )

    if role == "driver":
        cursor.execute(
            """
            INSERT INTO DriverProfiles (user_id, points_balance)
            VALUES (%s, 0)
            ON DUPLICATE KEY UPDATE user_id = user_id
            """,
            (user_id,),
        )

    if first_name or last_name:
        cursor.execute(
            """
            INSERT INTO Profiles (user_id, first_name, last_name)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                first_name = COALESCE(VALUES(first_name), first_name),
                last_name = COALESCE(VALUES(last_name), last_name)
            """,
            (user_id, first_name, last_name),
        )

    return {"user_id": user_id, "username": username, "role": role, "email": email}


def log_bulk_upload_error(line_number: int, raw_line: str, reason: str) -> None:
    """Persist skipped / failed rows for later review."""
    conn   = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO BulkUploadErrors (line_number, raw_line, reason) VALUES (%s, %s, %s)",
            (line_number, raw_line, reason),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def _append_warning(record: dict, reason: str) -> None:
    record.setdefault("warnings", []).append(reason)


def _create_or_update_points_with_reason(
    cursor,
    sponsor_user_id: int,
    driver_user_id: int,
    points_delta: int,
    points_reason: str,
    changed_by_user_id: int,
) -> None:
    cursor.execute(
        """
        UPDATE SponsorDrivers
        SET total_points = total_points + %s
        WHERE sponsor_user_id = %s AND driver_user_id = %s
        """,
        (points_delta, sponsor_user_id, driver_user_id),
    )
    cursor.execute(
        """
        INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
        VALUES (NOW(), 'point_change', %s, %s, %s, %s, %s)
        """,
        (sponsor_user_id, driver_user_id, points_delta, points_reason, changed_by_user_id),
    )


def _create_sponsor_user_linked_to_owner(
    cursor,
    sponsor_owner_user_id: int,
    username: str,
    email: str,
    plain_password: str,
    first_name: str | None = None,
    last_name: str | None = None,
) -> dict:
    password_hash = hash_password(plain_password)
    cursor.execute(
        """
        INSERT INTO Users (username, password_hash, role, email)
        VALUES (%s, %s, 'sponsor', %s)
        """,
        (username, password_hash, email),
    )
    user_id = cursor.lastrowid
    if first_name or last_name:
        cursor.execute(
            """
            INSERT INTO Profiles (user_id, first_name, last_name)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                first_name = COALESCE(VALUES(first_name), first_name),
                last_name = COALESCE(VALUES(last_name), last_name)
            """,
            (user_id, first_name, last_name),
        )
    cursor.execute(
        """
        INSERT INTO SponsorUserLinks (sponsor_user_id, sponsor_owner_user_id, created_by_user_id)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            sponsor_owner_user_id = VALUES(sponsor_owner_user_id),
            created_by_user_id = VALUES(created_by_user_id)
        """,
        (user_id, sponsor_owner_user_id, sponsor_owner_user_id),
    )
    return {"user_id": user_id, "username": username, "role": "sponsor", "email": email}


def _get_existing_user_by_email(cursor, email: str, role: str) -> dict | None:
    cursor.execute(
        """
        SELECT user_id, username, role, email
        FROM Users
        WHERE email = %s AND role = %s
        LIMIT 1
        """,
        (email, role),
    )
    return cursor.fetchone()


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def read_bulk_rows(content: str) -> tuple[list[list[str]], list[str], str]:
    """
    Read uploaded file and return parsed rows, original raw lines, and detected delimiter.
    Supports comma-separated CSV and pipe-delimited files.
    """
    sample = "\n".join(content.splitlines()[:20]).strip()
    delimiter = "|"
    if sample:
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",|")
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = "|" if "|" in sample else ","

    rows: list[list[str]] = []
    raw_lines: list[str] = []
    reader = csv.reader(content.splitlines(), delimiter=delimiter)
    for row in reader:
        raw = delimiter.join(row)
        raw_lines.append(raw)
        rows.append(row)

    return rows, raw_lines, delimiter


def _skip_header_or_comment(fields: list[str]) -> bool:
    """Return True if this row should be silently skipped (not counted as an error)."""
    header_tokens = {"type", "record_type", "role"}
    if not fields:
        return True
    first = fields[0]
    if first.startswith("#") or first.startswith("//"):
        return True
    if first.lower() in header_tokens:
        return True
    return False


def _valid_email(value: str) -> bool:
    return bool(value and EMAIL_RE.match(value))


def _slugify_name(value: str) -> str:
    lowered = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    return slug


def _derive_unique_username(first_name: str, last_name: str, email: str, role_hint: str) -> str:
    name_base = "_".join(
        part for part in (_slugify_name(first_name), _slugify_name(last_name)) if part
    )
    email_base = _slugify_name(email.split("@", 1)[0]) if "@" in email else ""
    base = name_base or email_base or f"{role_hint}_user"
    candidate = base
    suffix = 1
    while get_user_by_username(candidate):
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


def _parse_optional_points_and_reason(
    fields: list[str],
    points_index: int,
    reason_index: int,
) -> tuple[int | None, str | None, str | None]:
    if len(fields) <= points_index:
        return None, None, None
    points_raw = (fields[points_index] or "").strip()
    reason = (fields[reason_index] or "").strip() if len(fields) > reason_index else ""
    if not points_raw:
        if reason:
            return None, None, "Reason was provided but points delta was empty."
        return None, None, None
    try:
        points = int(points_raw)
    except ValueError:
        return None, None, f"Invalid points value '{points_raw}'. Must be an integer like 100 or -50."
    if not reason:
        return None, None, "A reason is required when points are included."
    return points, reason, None


def parse_bulk_rows(rows: list[list[str]], raw_lines: list[str], delimiter: str) -> tuple[list[dict], list[dict]]:
    """
    Parse pipe/comma-delimited content into validated record dicts for admin uploads.

    Accepted line formats:
      O|org_name
      S|username|email
      D|username|email|sponsor_username

    Legacy RC format (also accepted):
      S|org_name|first_name|last_name|email[|points_delta|reason]
      D|org_name|first_name|last_name|email[|points_delta|reason]
    """
    records: list[dict] = []
    errors:  list[dict] = []

    for line_num, row in enumerate(rows, start=1):
        raw_line = raw_lines[line_num - 1] if line_num - 1 < len(raw_lines) else delimiter.join(row)
        if not raw_line.strip():
            continue

        fields = [f.strip() for f in row]
        if fields:
            fields[0] = fields[0].lstrip("\ufeff").strip()

        if _skip_header_or_comment(fields):
            continue

        record_type = fields[0].upper()

        if record_type not in VALID_TYPES:
            errors.append({
                "line_number": line_num,
                "raw_line":    raw_line,
                "reason":      f"Invalid type '{fields[0]}'. Must be O, S, or D.",
            })
            continue

        if record_type == "O":
            # Tolerate trailing empty CSV cell: "O,org_name,"
            if len(fields) == 3 and fields[2] == "":
                fields = fields[:2]
            if len(fields) != 2:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"O record requires 2 fields (O{delimiter}org_name), got {len(fields)}.",
                })
                continue
            if not fields[1]:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      "O record: org_name must not be empty.",
                })
                continue
            records.append({
                "type":        "O",
                "org_name":    fields[1],
                "line_number": line_num,
                "raw_line":    raw_line,
            })

        elif record_type == "S":
            # Tolerate trailing empty CSV cell: "S,username,email,"
            if len(fields) == 4 and fields[3] == "":
                fields = fields[:3]
            if len(fields) == 3:
                if not fields[1]:
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": "S record: username must not be empty.",
                    })
                    continue
                if not _valid_email(fields[2]):
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": f"S record: invalid email '{fields[2]}'.",
                    })
                    continue
                records.append({
                    "type":        "S",
                    "username":    fields[1],
                    "email":       fields[2],
                    "line_number": line_num,
                    "raw_line":    raw_line,
                })
                continue

            # Legacy: S|org|first|last|email[|points|reason]
            if len(fields) not in (5, 7):
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"S record requires 3 fields (new format) or 5/7 fields (legacy format), got {len(fields)}.",
                })
                continue
            org_name = fields[1]
            first_name = fields[2]
            last_name = fields[3]
            email = fields[4]
            if not org_name:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": "Legacy S record requires an organization name for admin uploads.",
                })
                continue
            if not first_name or not last_name:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": "Legacy S record requires first and last name.",
                })
                continue
            if not _valid_email(email):
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy S record: invalid email '{email}'.",
                })
                continue
            points_delta, points_reason, points_error = _parse_optional_points_and_reason(fields, 5, 6)
            if points_error:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy S record: {points_error}",
                })
                continue
            records.append({
                "type":        "S",
                "legacy":      True,
                "org_name":    org_name,
                "first_name":  first_name,
                "last_name":   last_name,
                "email":       email,
                "points_delta": points_delta,
                "points_reason": points_reason,
                "line_number": line_num,
                "raw_line":    raw_line,
            })

        elif record_type == "D":
            # Tolerate trailing empty CSV cell: "D,username,email,sponsor,"
            if len(fields) == 5 and fields[4] == "":
                fields = fields[:4]
            if len(fields) == 4:
                if not fields[1]:
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": "D record: username must not be empty.",
                    })
                    continue
                if not _valid_email(fields[2]):
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": f"D record: invalid email '{fields[2]}'.",
                    })
                    continue
                if not fields[3]:
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": "D record: sponsor_username must not be empty.",
                    })
                    continue
                records.append({
                    "type":             "D",
                    "username":         fields[1],
                    "email":            fields[2],
                    "sponsor_username": fields[3],
                    "line_number":      line_num,
                    "raw_line":         raw_line,
                })
                continue

            # Legacy: D|org|first|last|email[|points|reason]
            if len(fields) not in (5, 7):
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"D record requires 4 fields (new format) or 5/7 fields (legacy format), got {len(fields)}.",
                })
                continue
            org_name = fields[1]
            first_name = fields[2]
            last_name = fields[3]
            email = fields[4]
            if not org_name:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": "Legacy D record requires an organization name for admin uploads.",
                })
                continue
            if not first_name or not last_name:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": "Legacy D record requires first and last name.",
                })
                continue
            if not _valid_email(email):
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy D record: invalid email '{email}'.",
                })
                continue
            points_delta, points_reason, points_error = _parse_optional_points_and_reason(fields, 5, 6)
            if points_error:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy D record: {points_error}",
                })
                continue
            records.append({
                "type":         "D",
                "legacy":       True,
                "org_name":     org_name,
                "first_name":   first_name,
                "last_name":    last_name,
                "email":        email,
                "points_delta": points_delta,
                "points_reason": points_reason,
                "line_number":      line_num,
                "raw_line":         raw_line,
            })

    return records, errors


def parse_sponsor_bulk_rows(rows: list[list[str]], raw_lines: list[str], delimiter: str) -> tuple[list[dict], list[dict]]:
    """
    Parse pipe/comma-delimited content for sponsor bulk uploads.
    D and S records are accepted; sponsor scope is always the authenticated sponsor's organization.
    Format:
      D|username|email
      D|org_name|first_name|last_name|email[|points_delta|reason]   (legacy)
      S|username|email
      S|org_name|first_name|last_name|email[|points_delta|reason]   (legacy)
    """
    records: list[dict] = []
    errors:  list[dict] = []

    for line_num, row in enumerate(rows, start=1):
        raw_line = raw_lines[line_num - 1] if line_num - 1 < len(raw_lines) else delimiter.join(row)
        if not raw_line.strip():
            continue

        fields = [f.strip() for f in row]
        if fields:
            fields[0] = fields[0].lstrip("\ufeff").strip()

        if _skip_header_or_comment(fields):
            continue

        record_type = fields[0].upper()

        if record_type not in VALID_TYPES:
            errors.append({
                "line_number": line_num,
                "raw_line":    raw_line,
                "reason":      f"Invalid type '{fields[0]}'. Sponsor bulk upload only accepts D and S records.",
            })
            continue

        if record_type == "O":
            errors.append({
                "line_number": line_num,
                "raw_line":    raw_line,
                "reason":      "Organization records are not allowed in sponsor bulk upload.",
            })
            continue

        if record_type in {"D", "S"}:
            if len(fields) == 5 and fields[4] == "":
                fields = fields[:4]

            if len(fields) in (3, 4):
                if not fields[1]:
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": f"{record_type} record: username must not be empty.",
                    })
                    continue
                if not _valid_email(fields[2]):
                    errors.append({
                        "line_number": line_num,
                        "raw_line": raw_line,
                        "reason": f"{record_type} record: invalid email '{fields[2]}'.",
                    })
                    continue
                records.append({
                    "type":        record_type,
                    "username":    fields[1],
                    "email":       fields[2],
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "warnings":    [],
                })
                continue

            if len(fields) not in (5, 7):
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"{record_type} record requires 3/4 fields (new format) or 5/7 fields (legacy format), got {len(fields)}.",
                })
                continue

            org_name = fields[1]
            first_name = fields[2]
            last_name = fields[3]
            email = fields[4]
            if not first_name or not last_name:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy {record_type} record requires first and last name.",
                })
                continue
            if not _valid_email(email):
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy {record_type} record: invalid email '{email}'.",
                })
                continue
            points_delta, points_reason, points_error = _parse_optional_points_and_reason(fields, 5, 6)
            if points_error:
                errors.append({
                    "line_number": line_num,
                    "raw_line": raw_line,
                    "reason": f"Legacy {record_type} record: {points_error}",
                })
                continue
            record = {
                "type":         record_type,
                "legacy":       True,
                "org_name":     org_name,
                "first_name":   first_name,
                "last_name":    last_name,
                "email":        email,
                "points_delta": points_delta,
                "points_reason": points_reason,
                "line_number":  line_num,
                "raw_line":     raw_line,
                "warnings":     [],
            }
            if org_name:
                _append_warning(record, "Organization name was ignored for sponsor bulk upload.")
            if record_type == "S" and points_delta is not None:
                _append_warning(record, "Points on sponsor-user rows were ignored.")
                record["points_delta"] = None
                record["points_reason"] = None
            records.append(record)

    return records, errors


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

@router.post("/bulk-upload")
async def bulk_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("admin")),
):
    """
    Admin bulk upload. Accepts O, S, and D records.
    Processes valid rows independently — partial success is supported.
    """
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
        rows, raw_lines, delimiter = read_bulk_rows(content)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Use CSV or pipe-delimited UTF-8 text.")

    records, errors = parse_bulk_rows(rows, raw_lines, delimiter)
    warnings: list[dict] = []

    orgs_created     = 0
    sponsors_created = 0
    drivers_created  = 0
    created_users:   list[dict] = []

    # Cache sponsors created in this batch so D lines can reference them
    # before the DB commit is visible to other connections.
    batch_sponsors: dict[str, int] = {}  # username -> user_id
    sponsor_cache:  dict[str, dict] = {}
    org_to_sponsor_user_id: dict[str, int] = {}

    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for record in records:
            try:
                if record["type"] == "O":
                    cursor.execute(
                        """
                        INSERT INTO BulkOrganizations (name)
                        VALUES (%s)
                        ON DUPLICATE KEY UPDATE name = name
                        """,
                        (record["org_name"],),
                    )
                    conn.commit()
                    orgs_created += 1

                elif record["type"] == "S":
                    is_legacy = bool(record.get("legacy"))
                    username = record.get("username")
                    if is_legacy:
                        username = _derive_unique_username(
                            first_name=record.get("first_name", ""),
                            last_name=record.get("last_name", ""),
                            email=record["email"],
                            role_hint="sponsor",
                        )

                    existing_sponsor = _get_existing_user_by_email(cursor, record["email"], "sponsor")
                    if existing_sponsor:
                        user = existing_sponsor
                        _append_warning(record, "Sponsor already existed, so the existing account was reused.")
                        temp_pw = "(existing account)"
                    else:
                        temp_pw = generate_temp_password()
                        user = create_user_fast(
                            cursor=cursor,
                            username=username,
                            email=record["email"],
                            role="sponsor",
                            plain_password=temp_pw,
                            first_name=record.get("first_name"),
                            last_name=record.get("last_name"),
                            company_name=record.get("org_name"),
                        )
                        sponsors_created += 1
                        created_users.append({
                            "username":      username,
                            "role":          "sponsor",
                            "temp_password": temp_pw,
                        })
                    conn.commit()
                    batch_sponsors[user["username"]] = user["user_id"]
                    sponsor_cache[user["username"]]  = user
                    org_name = (record.get("org_name") or "").strip()
                    if org_name:
                        org_to_sponsor_user_id[org_name] = user["user_id"]

                elif record["type"] == "D":
                    is_legacy = bool(record.get("legacy"))
                    sponsor_id: int | None = None

                    if is_legacy:
                        org_name = (record.get("org_name") or "").strip()
                        if org_name and org_name in org_to_sponsor_user_id:
                            sponsor_id = org_to_sponsor_user_id[org_name]
                        elif org_name:
                            cursor.execute(
                                """
                                SELECT sp.user_id
                                FROM SponsorProfiles sp
                                JOIN Users u ON u.user_id = sp.user_id
                                WHERE u.role = 'sponsor'
                                  AND sp.company_name = %s
                                ORDER BY sp.user_id
                                LIMIT 1
                                """,
                                (org_name,),
                            )
                            row = cursor.fetchone()
                            if row:
                                sponsor_id = int(row["user_id"])
                                org_to_sponsor_user_id[org_name] = sponsor_id
                        if sponsor_id is None:
                            raise ValueError(
                                "Legacy D record requires an org with an existing sponsor in this file or database."
                            )
                    else:
                        sponsor_username = record["sponsor_username"]
                        # Resolve sponsor: batch cache → local cache → DB
                        if sponsor_username in batch_sponsors:
                            sponsor_id = batch_sponsors[sponsor_username]
                        else:
                            sponsor = sponsor_cache.get(sponsor_username)
                            if not sponsor:
                                sponsor = get_user_by_username(sponsor_username)
                                if sponsor:
                                    sponsor_cache[sponsor_username] = sponsor
                            if not sponsor:
                                raise ValueError(f"Sponsor '{sponsor_username}' not found")
                            if sponsor["role"] != "sponsor":
                                raise ValueError(f"User '{sponsor_username}' is not a sponsor")
                            sponsor_id = sponsor["user_id"]

                    username = record.get("username")
                    if is_legacy:
                        username = _derive_unique_username(
                            first_name=record.get("first_name", ""),
                            last_name=record.get("last_name", ""),
                            email=record["email"],
                            role_hint="driver",
                        )

                    existing_driver = _get_existing_user_by_email(cursor, record["email"], "driver")
                    if existing_driver:
                        user = existing_driver
                        temp_pw = "(existing account)"
                        _append_warning(record, "Driver already existed, so the existing account was updated.")
                    else:
                        temp_pw = generate_temp_password()
                        user = create_user_fast(
                            cursor=cursor,
                            username=username,
                            email=record["email"],
                            role="driver",
                            plain_password=temp_pw,
                            first_name=record.get("first_name"),
                            last_name=record.get("last_name"),
                        )
                        drivers_created += 1
                        created_users.append({
                            "username":      username,
                            "role":          "driver",
                            "temp_password": temp_pw,
                        })
                    link_driver_to_sponsor_with_cursor(cursor, sponsor_id, user["user_id"])

                    points_delta = record.get("points_delta")
                    points_reason = record.get("points_reason")
                    if points_delta is not None and points_reason:
                        _create_or_update_points_with_reason(
                            cursor=cursor,
                            sponsor_user_id=sponsor_id,
                            driver_user_id=user["user_id"],
                            points_delta=int(points_delta),
                            points_reason=points_reason,
                            changed_by_user_id=current_user["user_id"],
                        )

                    conn.commit()

            except ValueError as exc:
                conn.rollback()
                errors.append({
                    "line_number": record["line_number"],
                    "raw_line":    record["raw_line"],
                    "reason":      str(exc),
                })

            except Exception as exc:
                conn.rollback()
                errors.append({
                    "line_number": record["line_number"],
                    "raw_line":    record["raw_line"],
                    "reason":      f"Unexpected error: {exc}",
                })

            for warning in record.get("warnings", []):
                warnings.append({
                    "line_number": record["line_number"],
                    "raw_line": record["raw_line"],
                    "reason": warning,
                })
    finally:
        cursor.close()
        conn.close()

    for error in errors:
        log_bulk_upload_error(error["line_number"], error["raw_line"], error["reason"])

    return {
        "orgs_created":     orgs_created,
        "sponsors_created": sponsors_created,
        "drivers_created":  drivers_created,
        "created_users":    created_users,
        "error_count":      len(errors),
        "errors":           errors,
        "warnings":         warnings,
    }


@router.post("/sponsor/bulk-upload")
async def sponsor_bulk_upload(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("sponsor")),
):
    """
    Sponsor bulk upload. Only D (driver) records are accepted.
    Drivers are automatically linked to the authenticated sponsor.
    Format: D|username|email  (no sponsor_username field required)
    Processes valid rows independently — partial success is supported.
    """
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
        rows, raw_lines, delimiter = read_bulk_rows(content)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Use pipe-delimited UTF-8 text.")

    records, errors = parse_sponsor_bulk_rows(rows, raw_lines, delimiter)
    warnings: list[dict] = []

    sponsor_user_id = current_user["user_id"]
    drivers_created = 0
    sponsors_created = 0
    created_users:  list[dict] = []

    conn   = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for record in records:
            try:
                if record["type"] == "S":
                    is_legacy = bool(record.get("legacy"))
                    username = record.get("username")
                    if is_legacy:
                        username = _derive_unique_username(
                            first_name=record.get("first_name", ""),
                            last_name=record.get("last_name", ""),
                            email=record["email"],
                            role_hint="sponsor",
                        )

                    existing_sponsor = _get_existing_user_by_email(cursor, record["email"], "sponsor")
                    if existing_sponsor:
                        _append_warning(record, "Sponsor user already existed, so no new account was created.")
                        created_users.append({
                            "username": existing_sponsor["username"],
                            "role": "sponsor",
                            "temp_password": "(existing account)",
                        })
                    else:
                        temp_pw = generate_temp_password()
                        user = _create_sponsor_user_linked_to_owner(
                            cursor=cursor,
                            sponsor_owner_user_id=sponsor_user_id,
                            username=username,
                            email=record["email"],
                            plain_password=temp_pw,
                            first_name=record.get("first_name"),
                            last_name=record.get("last_name"),
                        )
                        sponsors_created += 1
                        created_users.append({
                            "username": user["username"],
                            "role": "sponsor",
                            "temp_password": temp_pw,
                        })

                elif record["type"] == "D":
                    is_legacy = bool(record.get("legacy"))
                    username = record.get("username")
                    if is_legacy:
                        username = _derive_unique_username(
                            first_name=record.get("first_name", ""),
                            last_name=record.get("last_name", ""),
                            email=record["email"],
                            role_hint="driver",
                        )

                    existing_driver = _get_existing_user_by_email(cursor, record["email"], "driver")
                    if existing_driver:
                        user = existing_driver
                        _append_warning(record, "Driver already existed, so points/linking were updated on the existing account.")
                    else:
                        temp_pw = generate_temp_password()
                        user = create_user_fast(
                            cursor=cursor,
                            username=username,
                            email=record["email"],
                            role="driver",
                            plain_password=temp_pw,
                            first_name=record.get("first_name"),
                            last_name=record.get("last_name"),
                        )
                        drivers_created += 1
                        created_users.append({
                            "username": username,
                            "role": "driver",
                            "temp_password": temp_pw,
                        })

                    link_driver_to_sponsor_with_cursor(cursor, sponsor_user_id, user["user_id"])

                    points_delta = record.get("points_delta")
                    points_reason = record.get("points_reason")
                    if points_delta is not None and points_reason:
                        _create_or_update_points_with_reason(
                            cursor=cursor,
                            sponsor_user_id=sponsor_user_id,
                            driver_user_id=user["user_id"],
                            points_delta=int(points_delta),
                            points_reason=points_reason,
                            changed_by_user_id=current_user["user_id"],
                        )

                conn.commit()

            except ValueError as exc:
                conn.rollback()
                errors.append({
                    "line_number": record["line_number"],
                    "raw_line":    record["raw_line"],
                    "reason":      str(exc),
                })

            except Exception as exc:
                conn.rollback()
                errors.append({
                    "line_number": record["line_number"],
                    "raw_line":    record["raw_line"],
                    "reason":      f"Unexpected error: {exc}",
                })

            for warning in record.get("warnings", []):
                warnings.append({
                    "line_number": record["line_number"],
                    "raw_line": record["raw_line"],
                    "reason": warning,
                })
    finally:
        cursor.close()
        conn.close()

    for error in errors:
        log_bulk_upload_error(error["line_number"], error["raw_line"], error["reason"])

    return {
        "drivers_created": drivers_created,
        "sponsors_created": sponsors_created,
        "created_users":   created_users,
        "error_count":     len(errors),
        "errors":          errors,
        "warnings":        warnings,
    }
