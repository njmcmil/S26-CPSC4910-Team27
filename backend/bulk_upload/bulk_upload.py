"""
bulk_upload.py
--------------
Purpose:
    Handles bulk creation of sponsor and driver accounts from a
    CSV or pipe-delimited file.  Uses the existing create_user() function so
    all business rules (password hashing, SponsorProfiles init, etc.)
    are respected.

Format:
    S|username|email                      → create a sponsor account
    D|username|email|sponsor_username     → create a driver and link to sponsor
    or CSV equivalent:
    S,username,email
    D,username,email,sponsor_username
"""

import csv
import secrets
import string

from fastapi import APIRouter, UploadFile, File, HTTPException
from auth.auth import hash_password
from shared.db import get_connection
from shared.services import get_user_by_username

router = APIRouter()

VALID_TYPES = {"S", "D"}


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


def link_driver_to_sponsor(driver_user_id: int, sponsor_user_id: int) -> None:
    """Insert an approved SponsorDrivers row."""
    conn   = get_connection()
    cursor = conn.cursor()
    try:
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
            # Compatibility fallback for schemas without SponsorDrivers.status.
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
        conn.commit()
    finally:
        cursor.close()
        conn.close()


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


def create_user_fast(cursor, username: str, email: str, role: str, plain_password: str) -> dict:
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


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_bulk_rows(rows: list[list[str]], raw_lines: list[str], delimiter: str) -> tuple[list[dict], list[dict]]:
    """
    Parse pipe-delimited content into validated record dicts.

    Accepted line formats:
      S|username|email
      D|username|email|sponsor_username
    """
    records: list[dict] = []
    errors:  list[dict] = []
    header_tokens = {"type", "record_type", "role"}

    for line_num, row in enumerate(rows, start=1):
        raw_line = raw_lines[line_num - 1] if line_num - 1 < len(raw_lines) else delimiter.join(row)
        line = raw_line.strip()
        if not line:
            continue

        # Trim UTF-8 BOM from first token and normalize all fields.
        fields = [f.strip() for f in row]
        if fields:
            fields[0] = fields[0].lstrip("\ufeff").strip()
        if not fields:
            continue

        # Skip comment lines / metadata lines without treating them as errors.
        if fields[0].startswith("#") or fields[0].startswith("//"):
            continue

        # Skip a common header row (type,username,email,...).
        if fields[0].lower() in header_tokens:
            continue

        record_type = fields[0].upper()

        if record_type not in VALID_TYPES:
            errors.append({
                "line_number": line_num,
                "raw_line":    raw_line,
                "reason":      f"Invalid type '{fields[0]}'. Must be S or D.",
            })
            continue

        if record_type == "S":
            # Tolerate a trailing empty CSV cell, e.g. "S,username,email,"
            if len(fields) == 4 and fields[3] == "":
                fields = fields[:3]
            if len(fields) != 3:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"S record requires 3 fields (S{delimiter}username{delimiter}email), got {len(fields)}.",
                })
                continue
            records.append({
                "type":        "S",
                "username":    fields[1],
                "email":       fields[2],
                "line_number": line_num,
                "raw_line":    raw_line,
            })

        elif record_type == "D":
            # Tolerate a trailing empty CSV cell, e.g. "D,username,email,sponsor,"
            if len(fields) == 5 and fields[4] == "":
                fields = fields[:4]
            if len(fields) != 4:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"D record requires 4 fields (D{delimiter}username{delimiter}email{delimiter}sponsor_username), got {len(fields)}.",
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

    return records, errors


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


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------

@router.post("/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
        rows, raw_lines, delimiter = read_bulk_rows(content)
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Use CSV or pipe-delimited UTF-8 text.")

    records, errors = parse_bulk_rows(rows, raw_lines, delimiter)

    sponsors_created = 0
    drivers_created  = 0
    created_users:   list[dict] = []   # {username, role, temp_password}

    # Track sponsors created in this batch so D lines can reference them
    # even before they exist in the DB (i.e., S line appears before D line in file)
    batch_sponsors: dict[str, int] = {}  # username -> user_id

    sponsor_cache: dict[str, dict] = {}
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for record in records:
            try:
                if record["type"] == "S":
                    temp_pw = generate_temp_password()
                    user = create_user_fast(
                        cursor=cursor,
                        username=record["username"],
                        email=record["email"],
                        role="sponsor",
                        plain_password=temp_pw,
                    )
                    conn.commit()
                    batch_sponsors[record["username"]] = user["user_id"]
                    sponsor_cache[record["username"]] = user
                    sponsors_created += 1
                    created_users.append({
                        "username": record["username"],
                        "role": "sponsor",
                        "temp_password": temp_pw,
                    })

                elif record["type"] == "D":
                    sponsor_username = record["sponsor_username"]

                    # Resolve sponsor — check current-batch cache, then local cache, then DB
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

                    temp_pw = generate_temp_password()
                    user = create_user_fast(
                        cursor=cursor,
                        username=record["username"],
                        email=record["email"],
                        role="driver",
                        plain_password=temp_pw,
                    )
                    link_driver_to_sponsor_with_cursor(cursor, sponsor_id, user["user_id"])
                    conn.commit()
                    drivers_created += 1
                    created_users.append({
                        "username": record["username"],
                        "role": "driver",
                        "temp_password": temp_pw,
                    })

            except ValueError as e:
                conn.rollback()
                err = {
                    "line_number": record["line_number"],
                    "raw_line": record["raw_line"],
                    "reason": str(e),
                }
                errors.append(err)

            except Exception as e:
                conn.rollback()
                err = {
                    "line_number": record["line_number"],
                    "raw_line": record["raw_line"],
                    "reason": f"Unexpected error: {e}",
                }
                errors.append(err)
    finally:
        cursor.close()
        conn.close()

    # Persist parse/processing errors after upload loop.
    for error in errors:
        log_bulk_upload_error(error["line_number"], error["raw_line"], error["reason"])

    return {
        "sponsors_created": sponsors_created,
        "drivers_created":  drivers_created,
        "created_users":    created_users,
        "error_count":      len(errors),
        "errors":           errors,
    }
