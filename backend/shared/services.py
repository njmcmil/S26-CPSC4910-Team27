# services.py
from shared.db import get_connection

# Data Access layer
# - Job is to be the 'waiter" between python logic and SQL database. Fetches and saves data

# Backbone to the security system. After user provides valid token, system uses this to grab
# their full identity

def get_user_by_id(user_id: int) -> dict:
    # takes an integer found inside JWT payload and ass database for all cols related to user
    conn = get_connection()
    # ensures when data comes back, you can assess it easily
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.password_hash, u.role, u.email, d.driver_id
            FROM Users u
            LEFT JOIN DriverProfiles d ON u.user_id = d.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()


# Login finder
# Looks through the Users table for a string match on the username
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


# Safe Updater
# Write operation to update password securily
# plain password stays in auth.py..never travels into database service unhased
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
