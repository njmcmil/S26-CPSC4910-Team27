"""
users.py
--------
Purpose:
    Contains all user-related database operations for Team27 application.

Responsibilities:
    - Retrieve all users from the database
    - Insert new users (drivers, sponsors, admins)
    - Validate login credentials
    - Enforce password rules

Usage:
    from users import get_all_users
    users = get_all_users()
"""




from db import get_connection

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users;")
    users = cursor.fetchall()
    conn.close()
    return users

def get_user_by_username(username: str) -> dict:
    """
    Get user by username with all fields.

    Args:
        username: Username to look up

    Returns:
        dict: User data (user_id, username, password_hash, role, email)
              None if user not found

    """
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
        user = cursor.fetchone()
        return user
    
    finally:
        cursor.close()
        conn.close()

def get_user_by_id(user_id: int) -> dict:
    """
    Get user by user_id.

    Args:
        user_id: User ID to look up

    Returns:
        dict: User data or None if not found
    """
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
        user = cursor.fetchone()
        return user

    finally:
        cursor.close()
        conn.close()

def update_password(user_id: int, new_password_hash: str) -> bool:
    """
    Update user's password hash.

    Args:
        user_id: ID of user whose password to update
        new_password_hash: New bcrypt hash

    Returns:
        bool: True if updated, False if user not found
    """
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

        rows_affected = cursor.rowcount
        conn.commit()

        return rows_affected > 0
    
    finally:
        cursor.close()
        conn.close()

# Quick test
if __name__ == "__main__":
    all_users = get_all_users()
    for u in all_users:
        print(f"Username: {u[0]}, Role: {u[1]}")
