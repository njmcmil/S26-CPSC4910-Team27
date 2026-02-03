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
from jose import JWTError, jwt
from datetime import datetime, timedelta
from token_blacklist import is_token_blacklisted

SECRET_KEY = "TFYSADGUH908746TTYGU4HRJFDT5367489TURHIGYUJDSHGFXCR567894JSVH672"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

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

# create access token 
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

#verify token
def verify_token(token: str):
    # is it blacklisted? 
    if is_token_blacklisted(token):
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
