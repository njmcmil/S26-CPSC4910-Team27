# users.py
from shared.services import get_user_by_id, get_user_by_username, update_password
from auth.auth import hash_password, verify_password
from shared.db import get_connection
from shared.utils import validate_password


# -----------------------------
# User business logic
# -----------------------------

# If services is the waiter (fetching data)..users.py is the "chef". Takes raw ingredients
# (passwords, usernames), processes them (validatesm hashes) and decides if result is correct

# Account set up

def create_user(username: str, password: str, role: str, email: str) -> dict:
    """Create a new user after validating password and hashing it."""
    # checks if someone aleady has username
    if get_user_by_username(username):
        raise ValueError("Username already exists")
    
    # ensures the password is not too weak
    is_valid, error_message = validate_password(password)
    if not is_valid:
        raise ValueError(error_message)
    
    # Hashes complex password
    password_hash = hash_password(password)

    # performs INSERT
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
        # find ID of user just created
        user_id = cursor.lastrowid
       
        # For sponsors, ensure a SponsorProfiles row exists with default reward values
        if role == 'sponsor':
            cursor.execute("""
                INSERT INTO SponsorProfiles (user_id, dollar_per_point, earn_rate, total_points_allocated)
                VALUES (%s, 0.01, 1.00, 0)
                ON DUPLICATE KEY UPDATE user_id = user_id
            """, (user_id,))
            conn.commit()

        # return full new user profile
        return get_user_by_id(user_id)
    finally:
        cursor.close()
        conn.close()

# Credential Verifier
# Used specfically when a user submits the login form
def validate_login(username: str, password: str) -> dict | None:
    """Validate user login credentials."""
    # lookup user by name
    user = get_user_by_username(username)
    if not user:
        return None
    # if exists take plain password they typed and compare it to hashed in database using verify_password
    if verify_password(password, user['password_hash']):
        return user
    return None # password is wrong

# The Directory
def get_all_users():
    """Return username + role for all users."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users;")
    users = cursor.fetchall()
    conn.close()
    return users
