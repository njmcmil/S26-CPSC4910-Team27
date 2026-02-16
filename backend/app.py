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


# Maint entry point

# --- Standard Library & Third Party ---
from datetime import datetime, timedelta
from mysql.connector import IntegrityError
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

# --- Schemas (Blueprint layer) ---
from schemas.user import (
    CreateUserRequest, 
    LoginRequest, 
    LoginResponse, 
    ForgotPasswordRequest, 
    ResetPasswordRequest, 
    ChangePasswordRequest
)

# --- Service & Business Logic Layer ---
from users.users import (
    create_user,
    validate_login,
    get_all_users,
    get_user_by_id,
    update_password,
    get_user_by_username
)
from auth.auth import get_current_user, create_access_token
from audit.login_audit import log_login_attempt
from users.password_reset import generate_reset_token
from users.email_service import send_password_reset_email

# --- Database & Config ---
from shared.db import get_connection

# --- Routers (Feature Modules) ---
from profiles.driver_profile import router as driver_profile_router
from profiles.sponsor_profile import router as sponsor_profile_router
from profiles.trusted_devices import router as trusted_devices_router
from profiles.points import router as points_router 
from users.admin_routes import router as admin_router

# --- App Initialization ---
INACTIVITY_LIMIT_MINUTES = 30 # set inactivity to 30 min
app = FastAPI(title="Team27 API", description="API for Team27 application", version="1.0")


# CORS middleware — add your frontend origins
origins = [
    "http://localhost:5173",      # Vite dev server
    "http://127.0.0.1:5173",
    "http://52.200.244.222:5173", # EC2 frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security Helpers ---
def check_inactivity(current_user: dict = Depends(get_current_user)):
    """Enforces session expiration based on last_activity."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT last_activity FROM Users WHERE user_id = %s", (current_user["user_id"],))
        row = cursor.fetchone()
        if row and row["last_activity"]:
            if datetime.utcnow() - row["last_activity"] > timedelta(minutes=INACTIVITY_LIMIT_MINUTES):
                raise HTTPException(status_code=401, detail="Session expired due to inactivity")
        
        cursor.execute("UPDATE Users SET last_activity = %s WHERE user_id = %s", 
                      (datetime.utcnow(), current_user["user_id"]))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

# --- Include Modular Routers ---
app.include_router(driver_profile_router)
app.include_router(sponsor_profile_router)
app.include_router(trusted_devices_router)
app.include_router(admin_router)
app.include_router(points_router, prefix="/api", tags=["points"])

# ==============================================================================
# PUBLIC ENDPOINTS (No Auth Required)
# ==============================================================================

# Root endpoint
@app.get("/")
def root():
    return {"message": "Good Driver Incentive Program API is running!"}

# About endpoint
@app.get("/about")
def get_about():
    """Public endpoint — returns project metadata for the About page."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT team_number, version_number, sprint_number,
                   release_date, product_name, product_description
            FROM About
            ORDER BY id DESC
            LIMIT 1
            """
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="About information not found")
        if row.get("release_date"):
            row["release_date"] = str(row["release_date"])
        return row
    finally:
        cursor.close()
        conn.close()



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


@app.post("/login", response_model=LoginResponse)
# calls validate_login to check password hash
# calls log_login_attempt
# if successful, generates a JWT token
def login_endpoint(request: LoginRequest, http_request: Request):
    user = validate_login(request.username, request.password)

    ip = http_request.client.host
    agent = http_request.headers.get("User-Agent")

    if not user:
        log_login_attempt(
            username=request.username,
            success=False,
            ip_address=ip,
            user_agent=agent
        )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    log_login_attempt(
        username=user["username"],
        user_id=user["user_id"],
        success=True,
        ip_address=ip,
        user_agent=agent
    )

    token = create_access_token({"user_id": user["user_id"]})
    
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "email": user["email"],
        "access_token": token
    }




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
    current_user: dict = Depends(get_current_user)
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

@app.post("/logout")
def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Expect header format: "Bearer <token>"
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = parts[1]
    blacklist_token(token)

    return {"message": "Successfully logged out"}


@app.get("/me/last-login", summary="Get Last Login Activity")
def get_last_login_activity(
    current_user: dict = Depends(get_current_user),
    _: None = Depends(check_inactivity)  #auto-logout check
):
    last_login = get_last_login(current_user["user_id"])
    if not last_login:
        return {"message": "No login history available"}
    return {
        "last_login_time": last_login["login_time"],
        "ip_address": last_login["ip_address"],
        "user_agent": last_login["user_agent"],
        "success": last_login["success"]
    }




@app.post("/token")
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 token endpoint for Swagger UI.

    Accepts form data: username & password
    Returns: access_token and token_type
    """
    user = validate_login(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # create JWT access token
    token = create_access_token({"user_id": user["user_id"]})

    # Log successful login
    # Optionally log IP & user-agent, if you pass request
    return {
        "access_token": token,
        "token_type": "bearer"
    }


# ==============================================================================
# PROTECTED ENDPOINTS
# ==============================================================================

@app.get("/users", tags=["Admin"], dependencies=[Depends(check_inactivity)])
def read_users(current_user: dict = Depends(get_current_user)):
    users = get_all_users()
    # u[0] is username, u[1] is role
    return [{"username": u[0], "role": u[1]} for u in users]