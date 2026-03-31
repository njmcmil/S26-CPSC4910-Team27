"""
bulk_upload.py
--------------
Purpose:
    Handles bulk creation of sponsor and driver accounts from a
    pipe-delimited file.  Uses the existing create_user() function so
    all business rules (password hashing, SponsorProfiles init, etc.)
    are respected.

Format:
    S|username|email                      → create a sponsor account
    D|username|email|sponsor_username     → create a driver and link to sponsor
"""

import secrets
import string

from fastapi import APIRouter, UploadFile, File, HTTPException
from shared.db import get_connection
from users.users import create_user
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
        cursor.execute(
            """
            INSERT INTO SponsorDrivers (sponsor_user_id, driver_user_id, status)
            VALUES (%s, %s, 'approved')
            ON DUPLICATE KEY UPDATE sponsor_user_id = sponsor_user_id
            """,
            (sponsor_user_id, driver_user_id),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


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

def parse_bulk_file(content: str) -> tuple[list[dict], list[dict]]:
    """
    Parse pipe-delimited content into validated record dicts.

    Accepted line formats:
      S|username|email
      D|username|email|sponsor_username
    """
    records: list[dict] = []
    errors:  list[dict] = []

    for line_num, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        fields      = [f.strip() for f in line.split("|")]
        record_type = fields[0].upper()

        if record_type not in VALID_TYPES:
            errors.append({
                "line_number": line_num,
                "raw_line":    raw_line,
                "reason":      f"Invalid type '{fields[0]}'. Must be S or D.",
            })
            continue

        if record_type == "S":
            if len(fields) != 3:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"S record requires 3 fields (S|username|email), got {len(fields)}.",
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
            if len(fields) != 4:
                errors.append({
                    "line_number": line_num,
                    "raw_line":    raw_line,
                    "reason":      f"D record requires 4 fields (D|username|email|sponsor_username), got {len(fields)}.",
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


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------

@router.post("/bulk-upload")
async def bulk_upload(file: UploadFile = File(...)):
    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")

    records, errors = parse_bulk_file(content)

    for error in errors:
        log_bulk_upload_error(error["line_number"], error["raw_line"], error["reason"])

    sponsors_created = 0
    drivers_created  = 0
    created_users:   list[dict] = []   # {username, role, temp_password}

    # Track sponsors created in this batch so D lines can reference them
    # even before they exist in the DB (i.e., S line appears before D line in file)
    batch_sponsors: dict[str, int] = {}  # username -> user_id

    for record in records:
        try:
            if record["type"] == "S":
                temp_pw = generate_temp_password()
                user    = create_user(
                    username=record["username"],
                    password=temp_pw,
                    role="sponsor",
                    email=record["email"],
                )
                batch_sponsors[record["username"]] = user["user_id"]
                sponsors_created += 1
                created_users.append({
                    "username":      record["username"],
                    "role":          "sponsor",
                    "temp_password": temp_pw,
                })

            elif record["type"] == "D":
                sponsor_username = record["sponsor_username"]

                # Resolve sponsor — check the current-batch cache first, then DB
                if sponsor_username in batch_sponsors:
                    sponsor_id = batch_sponsors[sponsor_username]
                else:
                    sponsor = get_user_by_username(sponsor_username)
                    if not sponsor:
                        raise ValueError(f"Sponsor '{sponsor_username}' not found")
                    if sponsor["role"] != "sponsor":
                        raise ValueError(f"User '{sponsor_username}' is not a sponsor")
                    sponsor_id = sponsor["user_id"]

                temp_pw = generate_temp_password()
                user    = create_user(
                    username=record["username"],
                    password=temp_pw,
                    role="driver",
                    email=record["email"],
                )
                link_driver_to_sponsor(user["user_id"], sponsor_id)
                drivers_created += 1
                created_users.append({
                    "username":      record["username"],
                    "role":          "driver",
                    "temp_password": temp_pw,
                })

        except ValueError as e:
            err = {
                "line_number": record["line_number"],
                "raw_line":    record["raw_line"],
                "reason":      str(e),
            }
            errors.append(err)
            log_bulk_upload_error(err["line_number"], err["raw_line"], err["reason"])

        except Exception as e:
            err = {
                "line_number": record["line_number"],
                "raw_line":    record["raw_line"],
                "reason":      f"Unexpected error: {e}",
            }
            errors.append(err)
            log_bulk_upload_error(err["line_number"], err["raw_line"], err["reason"])

    return {
        "sponsors_created": sponsors_created,
        "drivers_created":  drivers_created,
        "created_users":    created_users,
        "error_count":      len(errors),
        "errors":           errors,
    }
