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
