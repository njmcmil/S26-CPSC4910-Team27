from shared.db import get_connection


# =====================================================
# GET ACTIVE TIPS FOR A SPONSOR
# =====================================================
def get_active_tips_for_sponsor(sponsor_user_id: int):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT tip_id, tip_text, category, active, created_at, updated_at
            FROM tips
            WHERE sponsor_user_id = %s
            AND active = TRUE
            ORDER BY created_at DESC
        """, (sponsor_user_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


# =====================================================
# CREATE TIP
# =====================================================
def create_tip(sponsor_user_id: int, tip_text: str, category: str | None, active: bool):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            INSERT INTO tips (sponsor_user_id, tip_text, category, active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
        """, (sponsor_user_id, tip_text, category, active))

        conn.commit()
        tip_id = cursor.lastrowid

        cursor.execute("SELECT * FROM tips WHERE tip_id = %s", (tip_id,))
        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


# =====================================================
# MARK TIP AS VIEWED
# =====================================================
def mark_tip_viewed(driver_id: int, tip_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO tip_views (driver_id, tip_id, last_viewed)
            VALUES (%s, %s, NOW())
            ON DUPLICATE KEY UPDATE last_viewed = NOW()
        """, (driver_id, tip_id))

        conn.commit()

    finally:
        cursor.close()
        conn.close()