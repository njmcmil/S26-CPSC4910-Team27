from shared.db import get_connection

def log_login_attempt(
    username: str,
    success: bool,
    user_id: int = None,
    ip_address: str = None,
    user_agent: str = None
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO LoginAudit (user_id, username, success, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, username, success, ip_address, user_agent)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def get_last_login(user_id: int):
    """Fetch the most recent login attempt for a specific user."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT success, ip_address, user_agent, login_time
            FROM LoginAudit
            WHERE user_id = %s
            ORDER BY login_time DESC
            LIMIT 1
            """,
            (user_id,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()