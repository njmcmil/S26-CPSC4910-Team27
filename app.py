"""
app.py
------
Purpose:
    Main entry point of the Team27 application.

Responsibilities:
    - Orchestrates application flow
    - Calls functions from users.py and other modules
    - Handles output or user interaction (e.g., prints results)
    - Exposes FastAPI endpoints for accessing users

Usage:
    Run as CLI:
        python app.py

    Run as API:
        uvicorn app:app --reload
"""

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from db import get_connection
from users import get_user_by_username, get_user_by_id, update_password, create_user, validate_login
from utils import validate_password
from auth import hash_password, verify_password
from password_reset import generate_reset_token, validate_reset_token, mark_token_used
from email_service import send_password_reset_email

app = FastAPI(title="Team27 API", description="API for Team27 application", version="1.0")

# Function to get all users from the DB
def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users

# Root endpoint
@app.get("/")
def root():
    return {"message": "Good Driver Incentive Program API is running!"}


# FastAPI endpoint to get all users
@app.get("/users")
def read_users():
    users = get_all_users()
    return [{"username": u[0], "role": u[1]} for u in users]

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str
    email: str

@app.post("/create-user")
def create_user_endpoint(request: CreateUserRequest):
    try:
        user = create_user(
            username=request.username,
            password=request.password,
            role=request.role,
            email=request.email
        )
        return {"message": "User created successfully!", "user": user}

    except ValueError as ve:
        # Password validation errors
        raise HTTPException(status_code=400, detail=str(ve))

    except IntegrityError as ie:
        # Duplicate username/email error
        if "Duplicate entry" in str(ie):
            raise HTTPException(status_code=400, detail=f"Username '{request.username}' already exists")
        else:
            raise HTTPException(status_code=400, detail="User with this email or username already exists")

    except Exception as e:
        # Unexpected errors
        raise HTTPException(status_code=500, detail="Error creating user")

# Request model
class LoginRequest(BaseModel):
    username: str
    password: str

# Response model
class LoginResponse(BaseModel):
    user_id: int
    username: str
    role: str
    email: str

@app.post("/login", response_model=LoginResponse)
def login_endpoint(request: LoginRequest):
    user = validate_login(request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "email": user["email"]
    }

# =====================
# Mock Authentication 
# =====================

def mock_get_current_user():
    """
    MOCK function - returns a fake authenticated user.

    In real implementation, this will:
    1. Extract JWT token from Authorization header
    2. Validate token
    3. Return user data from token

    For now, returns a mock user for testing change-password endpoint.
    """
    # simulate an authenticated sponsor user
    return {
        "user_id": 2,  # replace with actual user_id from database
        "username": "sponsor1",
        "role": "sponsor"
    }

# ===============================
# Request/Response Models
# ===============================
class ForgotPasswordRequest(BaseModel):
    """Request body for forgot password endpoint."""
    username: str


class ResetPasswordRequest(BaseModel):
    """Request body for reset password endpoint."""
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    """Request body for change password endpoint (authenticated users)."""
    current_password: str
    new_password: str


# =================================
# Password Reset/Change Endpoints
# =================================

@app.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest):
    """
    Initiate password reset process (forgot password).

    PUBLIC ENDPOINT - No authentication required.

    Flow:
    1. User provides username
    2. System looks up user
    3. If found, generates reset token and sends email
    4. Always returns same message (security: don't reveal if user exists)

    Args:
        request: Contains username

    Returns:
        Generic success message

    Security:
        - Doesn't reveal if username exists (prevents enumeration)
        - Token expires in 24 hours
        - One-time use token
    """
    # look up user by username
    user = get_user_by_username(request.username)

    # security: always return same message whether user exists or not
    if user and user.get('email'):
        # generate secure reset token
        token = generate_reset_token(user['user_id'])

        # send email with reset link (mock: prints to console)
        send_password_reset_email(
            to_email=user['email'],
            reset_token=token,
            username=user['username']
        )

        print(f"\nPassword reset initiated for user: {user['username']}")
        print(f"📧 Email would be sent to: {user['email']}")

    return {
        "message": "If an account exists with that username, a password reset email has been sent."
    }


@app.post("/reset-password")
def reset_password(request: ResetPasswordRequest):
    """
    Complete password reset using token from email.

    PUBLIC ENDPOINT - No authentication required (user forgot password).

    Flow:
    1. User clicks link in email with token
    2. User enters new password
    3. System validates token (exists, not expired, not used)
    4. System validates new password complexity
    5. System updates password and marks token as used

    Args:
        request: Contains token and new_password

    Returns:
        Success message

    Errors:
        400: Invalid/expired/used token
        400: Weak password
    """
    # validate token
    token_data = validate_reset_token(request.token)

    if not token_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or already used reset token"
        )

    user_id = token_data['user_id']

    # validate new password complexity
    is_valid, error_message = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    # hash the new password
    new_password_hash = hash_password(request.new_password)

    # update password in database
    success = update_password(user_id, new_password_hash)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password")

    # mark token as used (one-time use)
    mark_token_used(request.token)

    # get username for logging
    user = get_user_by_id(user_id)

    print(f"\nassword reset completed for user: {user['username']} (ID: {user_id})")

    return {
        "message": "Password has been reset successfully. You can now log in with your new password."
    }


@app.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(mock_get_current_user)
):
    """
    Change password for authenticated user.

    AUTHENTICATED ENDPOINT - Requires valid login.

    Flow:
    1. User must be logged in 
    2. User provides current password + new password
    3. System verifies current password is correct
    4. System validates new password complexity
    5. System ensures new password != current password
    6. System updates password

    Args:
        request: Contains current_password and new_password
        current_user: Injected by authentication dependency

    Returns:
        Success message

    Errors:
        400: Current password incorrect
        400: Weak new password
        400: New password same as current
        401: Not authenticated

    Note:
        Currently uses mock_get_current_user() for testing.
        Replace with real get_current_user() when auth is ready.
    """
    # get full user data from database
    user = get_user_by_id(current_user['user_id'])

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # verify current password
    if not verify_password(request.current_password, user['password_hash']):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    # validate new password complexity
    is_valid, error_message = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)

    # ensure new password is different from current
    if verify_password(request.new_password, user['password_hash']):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    # hash new password
    new_password_hash = hash_password(request.new_password)

    # update password
    success = update_password(user['user_id'], new_password_hash)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password")

    print(f"\nPassword changed for user: {user['username']} (ID: {user['user_id']})")

    return {"message": "Password changed successfully"}

# CLI behavior
if __name__ == "__main__":
    users = get_all_users()
    print("Users in the database:")
    for u in users:
        print(f"Username: {u[0]}, Role: {u[1]}")
