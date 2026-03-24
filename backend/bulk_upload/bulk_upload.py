"""
bulk_upload.py
--------------
Purpose:
    Handles bulk upload of Organizations, Drivers, and Sponsors
    from a pipe-delimited file.

Format:
    O|Organization Name
    D|Driver Name|Organization Name
    S|Sponsor Name|Driver Name
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from shared.db import get_connection

router = APIRouter()

VALID_TYPES = {"O", "D", "S"}


# ---------------------------------------------------------------------------
# Helper / DB functions
# ---------------------------------------------------------------------------

def create_organization(name: str) -> int:
    """Insert an organization and return its new ID."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO BulkOrganizations (name) VALUES (%s)",
            (name,)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        cursor.close()
        conn.close()


def get_organization_by_name(name: str) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM BulkOrganizations WHERE name = %s",
            (name,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def create_driver(name: str, organization_name: str) -> int:
    """Insert a driver associated with an existing organization."""
    org = get_organization_by_name(organization_name)
    if not org:
        raise ValueError(f"Organization '{organization_name}' not found")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO BulkDrivers (name, organization_id) VALUES (%s, %s)",
            (name, org["id"])
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        cursor.close()
        conn.close()


def get_driver_by_name(name: str) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM BulkDrivers WHERE name = %s",
            (name,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def create_sponsor(name: str, driver_name: str) -> int:
    """Insert a sponsor associated with an existing driver."""
    driver = get_driver_by_name(driver_name)
    if not driver:
        raise ValueError(f"Driver '{driver_name}' not found")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO BulkSponsors (name, driver_id) VALUES (%s, %s)",
            (name, driver["id"])
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_bulk_file(content: str) -> tuple[list[dict], list[str]]:
    """
    Parse pipe-delimited file content into a list of record dicts.
    Validates type fields and field counts. Returns valid records plus
    per-line errors for rows that should be skipped.
    """
    records = []
    errors = []
    for line_num, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        fields = [f.strip() for f in line.split("|")]
        record_type = fields[0].upper()

        if record_type not in VALID_TYPES:
            errors.append(
                f"Line {line_num}: invalid type '{fields[0]}'. Must be O, D, or S."
            )
            continue

        if record_type == "O":
            if len(fields) != 2:
                errors.append(
                    f"Line {line_num}: O record requires exactly 2 fields (O|Name), got {len(fields)}."
                )
                continue
            records.append({"type": "O", "name": fields[1]})

        elif record_type == "D":
            if len(fields) != 3:
                errors.append(
                    f"Line {line_num}: D record requires exactly 3 fields (D|Driver|Org), got {len(fields)}."
                )
                continue
            records.append({"type": "D", "name": fields[1], "organization": fields[2]})

        elif record_type == "S":
            if len(fields) != 3:
                errors.append(
                    f"Line {line_num}: S record requires exactly 3 fields (S|Sponsor|Driver), got {len(fields)}."
                )
                continue
            records.append({"type": "S", "name": fields[1], "driver": fields[2]})

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

    orgs_created = 0
    drivers_created = 0
    sponsors_created = 0

    for record in records:
        try:
            if record["type"] == "O":
                create_organization(record["name"])
                orgs_created += 1

            elif record["type"] == "D":
                create_driver(record["name"], record["organization"])
                drivers_created += 1

            elif record["type"] == "S":
                create_sponsor(record["name"], record["driver"])
                sponsors_created += 1

        except ValueError as e:
            errors.append(str(e))
        except Exception as e:
            errors.append(f"Unexpected error for record {record}: {e}")

    return {
        "organizations_created": orgs_created,
        "drivers_created": drivers_created,
        "sponsors_created": sponsors_created,
        "errors": errors,
    }
