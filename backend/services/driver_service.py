from shared.db import get_connection


# =====================================================
# GET DRIVER SPONSOR ID
# =====================================================
def get_driver_sponsor_id(driver_id: int):
    """
    Returns the sponsor_id associated with a driver.
    Assumes your DB has a relationship like:

        Drivers table → sponsor_id column
    """

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT sponsor_id
            FROM Drivers
            WHERE user_id = %s
        """, (driver_id,))

        row = cursor.fetchone()

        if not row:
            return None

        return row["sponsor_id"]

    finally:
        cursor.close()
        conn.close()