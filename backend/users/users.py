# users.py
from shared.services import get_user_by_id, get_user_by_username, update_password
from auth.auth import hash_password, verify_password
from shared.db import get_connection

# -----------------------------
# User business logic
# -----------------------------

def create_user(username: str, password: str, role: str, email: str) -> dict:
    """Create a new user after validating password and hashing it."""
    from shared.utils import validate_password

    if get_user_by_username(username):
        raise ValueError("Username already exists")

    is_valid, error_message = validate_password(password)
    if not is_valid:
        raise ValueError(error_message)

    password_hash = hash_password(password)

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            INSERT INTO Users (username, password_hash, role, email)
            VALUES (%s, %s, %s, %s)
            """,
            (username, password_hash, role, email)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return get_user_by_id(user_id)
    finally:
        cursor.close()
        conn.close()


def validate_login(username: str, password: str) -> dict | None:
    """Validate user login credentials."""
    user = get_user_by_username(username)
    if not user:
        return None
    if verify_password(password, user['password_hash']):
        return user
    return None


def get_all_users():
    """Return username + role for all users."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users;")
    users = cursor.fetchall()
    conn.close()
    return users


def get_last_login(user_id: int):
    """Return last login entry for a user."""
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
