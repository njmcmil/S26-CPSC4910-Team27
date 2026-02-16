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
# gives access to bcrypt hashing algorithm
# hashing != encryption
# Encryption -> reversable (u can decrypt)
# Hashing -> one-way (You cannot reverse it) ...best for passwords
from passlib.hash import bcrypt

"""
    Hash a password using bcrypt.

    Uses bcrypt with cost factor 12 for security.
    Each hash is unique due to automatic salt generation.

    Args:
        password: Plain text password to hash

    Returns:
        str: Bcrypt hash (includes salt)

    """

def hash_password(password: str) -> str:
    return bcrypt.hash(password)
"""
    Verify a password against its hash

    Args:
        plain_password: Plain text password to check
        hashed_password: Bcrypt hash from database

    Returns:
        bool: True if password matches, False otherwise

    """
# Does this plain password match the stored hash?
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.verify(plain_password, hashed_password)
    except Exception:
        # invalid hash format or other error
        return False

#########################################################################################

# JWT handling -
# Handles JSON Web Tokens
from jose import JWTError, jwt
#^
#jwt.encode() -> creates token
#jwt.decode() -> verifies + extracts payload
#JWTError -> raised when token is invalid

from datetime import datetime, timedelta

#^Used to set expiration...w/o exp -> tokens would last forever(bad)

import os
from dotenv import load_dotenv

#^ENV variables

# FastAPI security
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

# Internal modules
from auth.token_blacklist import is_token_blacklisted

#^Logout system

from shared.services import get_user_by_id

#Config -
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set in environment variables")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# OAuth2 scheme (used by FastAPI to extract Bearer token)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")


# Create access token 
def create_access_token(data: dict) -> str:
    #"key": value
    to_encode = data.copy()
    # if current time > exp -> token invalid
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    #"key": value
    to_encode.update({"exp": expire})

    # signs payload with SECRET_KEY
    # returns encoded JWT string
    # this is the signature so you cannot manually change roles in payload
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Verify token
def verify_token(token: str):
    # is it blacklisted? how logout works
    if is_token_blacklisted(token):
        return None

    try:
        #Verifies signature, Verifies expiration, returns payload dict.
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    # if: 
    # .Wrong key 
    # .Expired 
    # .Modified token.   then raises->
    except JWTError:
        return None
    
# FastAPI Dependency to get the currently authenticated user from a Bearer token.
# 401 error: "your key doesnt work"
# 403 error: "your key works, but you dont have clearence for this room"
def get_current_user(token: str = Depends(oauth2_scheme)):
    #sends to verify token for security
    # payload includes user_id, role, and exp
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


"""
    Return a FastAPI dependency that enforces the current user's role is one of
    the allowed roles. Usage:

        current_user = Depends(require_role("driver"))

    This centralizes role checks and prevents copy/paste mistakes across
    endpoints.
    """
# security check based on the roles you pass in
def require_role(*allowed_roles: str):
    #Inner function...checks the role if allowed
    def role_dependency(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return role_dependency
