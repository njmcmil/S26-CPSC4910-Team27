# services.py
from shared.db import get_connection

# -----------------------------
# Raw user database functions
# -----------------------------

def get_user_by_id(user_id: int) -> dict:
    """Fetch user record by ID from DB."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT user_id, username, password_hash, role, email
            FROM Users
            WHERE user_id = %s
            """,
            (user_id,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def get_user_by_username(username: str) -> dict:
    """Fetch user record by username from DB."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT user_id, username, password_hash, role, email
            FROM Users
            WHERE username = %s
            """,
            (username,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


def update_password(user_id: int, new_password_hash: str) -> bool:
    """Update a user's password hash in DB."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE Users
            SET password_hash = %s
            WHERE user_id = %s
            """,
            (new_password_hash, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        cursor.close()
        conn.close()
