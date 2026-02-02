"""
auth.py
-------
Purpose:
    Authentication and password hashing utilities

Responsibilities:
    - Hash passwords securely using bcrypt
    - Verify passwords against stored hashes
    - Password security utilities

Usage:
    from auth import hash_password, verify_password

    # Hash a password
    hashed = hash_password("MyPassword123!")

    # Verify a password
    is_valid = verify_password("MyPassword123!", hashed)
"""

from passlib.hash import bcrypt

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Uses bcrypt with cost factor 12 for security.
    Each hash is unique due to automatic salt generation.

    Args:
        password: Plain text password to hash

    Returns:
        str: Bcrypt hash (includes salt)

    """
    return bcrypt.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash

    Args:
        plain_password: Plain text password to check
        hashed_password: Bcrypt hash from database

    Returns:
        bool: True if password matches, False otherwise

    """
    try:
        return bcrypt.verify(plain_password, hashed_password)
    except Exception:
        # invalid hash format or other error
        return False