"""
password_reset.py
-----------------
Purpose:
    Manage password reset tokens

Responsibilities:
    - Generate secure random tokens
    - Store tokens in database with expiration
    - Validate tokens (check existence, expiry, usage)
    - Mark tokens as used (one-time use)

Usage:
    from password_reset import generate_reset_token, validate_reset_token

    # Generate token for user
    token = generate_reset_token(user_id=5)

    # Validate token
    token_data = validate_reset_token(token)
    if token_data:
        user_id = token_data['user_id']
"""

import secrets
from datetime import datetime, timedelta
from shared.db import get_connection

# token expires after 24 hours 
TOKEN_EXPIRY_HOURS = 24

def generate_reset_token(user_id: int) -> str:
    """
    Generate a secure password reset token.

    - Creates cryptographically secure random token (256 bits)
    - Stores in PasswordResetTokens table
    - Invalidates any existing unused tokens for this user
    - Token expires after 24 hours

    Args:
        user_id: ID of user requesting password reset

    Returns:
        str: Secure URL-safe token string

    Security:
        - Uses secrets.token_urlsafe() for cryptographic randomness
        - Old unused tokens are invalidated (prevents token accumulation)
        - Tokens expire automatically
    """
    # generate secure token 
    token = secrets.token_urlsafe(32)

    # calculate expiration time
    expires_at = datetime.now() + timedelta(hours=TOKEN_EXPIRY_HOURS)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # invalidate any existing unused tokens for this user
        # prevents token accumulation and potential abuse
        cursor.execute(
            "UPDATE PasswordResetTokens SET used = TRUE WHERE user_id = %s AND used = FALSE",
            (user_id,)
        )

        # insert new token
        cursor.execute(
            """
            INSERT INTO PasswordResetTokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user_id, token, expires_at)
        )

        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return token

def validate_reset_token(token: str) -> dict:
    """
    Validate a password reset token

    Checks:
    1. Token exists in database
    2. Token has not been used
    3. Token has not expired

    Args:
        token: Token string from email link

    Returns:
        dict: Token data with user_id if valid
              None if invalid, expired, or used
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # fetch token data
        cursor.execute(
            """
            SELECT token_id, user_id, expires_at, used
            FROM PasswordResetTokens
            WHERE token = %s
            """,
            (token,)
        )

        token_data = cursor.fetchone()

        # token doesn't exist
        if not token_data:
            return None

        # token already used
        if token_data['used']:
            return None

        # token expired
        if datetime.now() > token_data['expires_at']:
            return None

        # token is valid
        return token_data

    finally:
        cursor.close()
        conn.close()

def mark_token_used(token: str) -> bool:
    """
    Mark a token as used (one-time use security).

    Args:
        token: Token string that was just used

    Returns:
        bool: True if token was marked, False if token not found
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE PasswordResetTokens
            SET used = TRUE
            WHERE token = %s
            """,
            (token,)
        )

        rows_affected = cursor.rowcount
        conn.commit()

        return rows_affected > 0

    finally:
        cursor.close()
        conn.close()

def cleanup_expired_tokens():
    """
    Clean up expired tokens from database

    Can be run periodically to keep table size manageable.
    
    This isn't required it's just nice for like keeping it clean
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM PasswordResetTokens
            WHERE expires_at < NOW() OR used = TRUE
            """
        )

        deleted_count = cursor.rowcount
        conn.commit()

        return deleted_count
    
    finally:
        cursor.close()
        conn.close()