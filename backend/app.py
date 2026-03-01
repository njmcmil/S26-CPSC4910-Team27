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
from services.ebay.browse import search_products, get_product_details

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
from shared.scheduler import scheduler

from services.catalog.catalog_service import get_sponsor_catalog, add_to_catalog, remove_from_catalog

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

# Run scheduler on startup
@app.on_event("startup")
def start_scheduler():
    scheduler.start()

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




@app.get("/api/ebay/search")
def ebay_search(q: str):
    """
    Search eBay products using Browse API.

    Query Parameters:
    - q: search term

    Returns:
    - List of product summaries
    """
    try:
        items = search_products(q)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"eBay search failed: {str(e)}")
    


@app.get("/api/ebay/product/{item_id}")
def ebay_product(item_id: str):
    """
    Retrieve full eBay product details by eBay itemId
    """
    try:
        product = get_product_details(item_id)
        return {"product": product}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"eBay product fetch failed: {str(e)}")

@app.get("/api/sponsor/catalog")
def sponsor_catalog(current_user: dict = Depends(get_current_user)):
    """
    Returns sponsor catalog items.
    """
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    return get_sponsor_catalog(current_user["user_id"])

@app.post("/api/sponsor/catalog")
def add_product_to_catalog(
    product: dict,
    current_user=Depends(get_current_user)
):

    print("🔥 RECEIVED PRODUCT:", product)

    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        add_to_catalog(current_user["user_id"], product)
    except Exception as e:
        print("❌ DB ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Product added to catalog"}

@app.delete("/api/sponsor/catalog/{item_id}")
def delete_product_from_catalog(
    item_id: str,
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        remove_from_catalog(current_user["user_id"], item_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Product removed from catalog"}
# ==============================================================================
# PROTECTED ENDPOINTS
# ==============================================================================

@app.get("/users", tags=["Admin"], dependencies=[Depends(check_inactivity)])
def read_users(current_user: dict = Depends(get_current_user)):
    users = get_all_users()
    # u[0] is username, u[1] is role
    return [{"username": u[0], "role": u[1]} for u in users]

# ==============================================================================
# CATALOG: DRIVER ENDPOINTS (US-38, US-39)
# ==============================================================================

@app.get("/api/driver/catalog")
def get_driver_catalog(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT sponsor_user_id, total_points FROM SponsorDrivers WHERE driver_user_id = %s",
            (driver_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No sponsor relationship found")
        cursor.execute(
            """
            SELECT item_id, title, price_value, price_currency,
                   image_url, rating, stock_quantity, points_cost
            FROM SponsorCatalog
            WHERE sponsor_user_id = %s
            ORDER BY title ASC
            """,
            (row["sponsor_user_id"],)
        )
        items = cursor.fetchall()
        return {"current_points": row["total_points"] or 0, "items": items}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/driver/catalog/{item_id}")
def get_driver_catalog_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """
    Task 15510: sponsor-scoped product detail for a driver.
    Returns SponsorCatalog row merged with eBay extended details.
    """
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT sponsor_user_id FROM SponsorDrivers WHERE driver_user_id = %s",
            (driver_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No sponsor relationship found")
        sponsor_id = row["sponsor_user_id"]
        cursor.execute(
            """
            SELECT item_id, title, price_value, price_currency,
                   image_url, rating, stock_quantity, points_cost
            FROM SponsorCatalog
            WHERE item_id = %s AND sponsor_user_id = %s
            """,
            (item_id, sponsor_id)
        )
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found in your sponsor's catalog")
    finally:
        cursor.close()
        conn.close()

    # Fetch extended eBay details (non-fatal if unavailable)
    try:
        ebay_detail = get_product_details(item_id) or {}
    except Exception:
        ebay_detail = {}

    return {
        "item_id": item["item_id"],
        "title": item["title"],
        "price_value": item["price_value"],
        "price_currency": item["price_currency"],
        "image_url": item["image_url"],
        "rating": item["rating"],
        "stock_quantity": item["stock_quantity"],
        "points_cost": item["points_cost"],
        "description": ebay_detail.get("shortDescription") or ebay_detail.get("description"),
        "condition": ebay_detail.get("condition"),
        "additional_images": [
            img.get("imageUrl") for img in ebay_detail.get("additionalImages", [])
            if img.get("imageUrl")
        ],
        "item_specifics": ebay_detail.get("localizedAspects", []),
    }

@app.post("/api/driver/catalog/purchase")
def purchase_catalog_item(body: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    item_id = body.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT sponsor_user_id, total_points FROM SponsorDrivers WHERE driver_user_id = %s",
            (driver_id,)
        )
        driver_row = cursor.fetchone()
        if not driver_row:
            raise HTTPException(status_code=404, detail="No sponsor relationship found")
        sponsor_id = driver_row["sponsor_user_id"]
        current_points = driver_row["total_points"] or 0
        cursor.execute(
            "SELECT item_id, title, points_cost, stock_quantity FROM SponsorCatalog WHERE item_id = %s AND sponsor_user_id = %s",
            (item_id, sponsor_id)
        )
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found in your sponsor's catalog")
        if current_points < item["points_cost"]:
            raise HTTPException(status_code=400, detail=f"Insufficient points. '{item['title']}' costs {item['points_cost']} pts but your balance is {current_points} pts. You need {item['points_cost'] - current_points} more.")
        if item["stock_quantity"] <= 0:
            raise HTTPException(status_code=400, detail="This item is out of stock.")
        cursor.execute(
            "UPDATE SponsorDrivers SET total_points = total_points - %s WHERE driver_user_id = %s",
            (item["points_cost"], driver_id)
        )
        cursor.execute(
            "UPDATE SponsorCatalog SET stock_quantity = stock_quantity - 1 WHERE item_id = %s AND sponsor_user_id = %s",
            (item_id, sponsor_id)
        )
        now = datetime.utcnow()
        cursor.execute(
            "INSERT INTO audit_log (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id) VALUES ('point_change', %s, %s, %s, %s, %s, %s)",
            (now, sponsor_id, driver_id, -item["points_cost"], f"Redeemed: {item['title']}", driver_id)
        )
        # create Order record for status tracking
        cursor.execute(
            """
            INSERT INTO Orders (driver_user_id, sponsor_user_id, item_id, item_title, points_cost, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s)
            """,
            (driver_id, sponsor_id, item_id, item["title"], item["points_cost"], now, now)
        )
        conn.commit()
        cursor.execute("SELECT total_points FROM SponsorDrivers WHERE driver_user_id = %s", (driver_id,))
        new_balance = cursor.fetchone()["total_points"]
        cursor.execute("SELECT stock_quantity FROM SponsorCatalog WHERE item_id = %s AND sponsor_user_id = %s", (item_id, sponsor_id))
        new_stock = cursor.fetchone()["stock_quantity"]
        return {"message": f"Successfully redeemed '{item['title']}'", "points_spent": item["points_cost"], "new_points_balance": new_balance, "remaining_stock": new_stock}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


# ==============================================================================
# ORDERS: DRIVER ENDPOINTS 
# ==============================================================================

@app.get("/api/driver/orders")
def get_driver_orders(current_user: dict = Depends(get_current_user)):
    """Task 15492: return driver's orders so they can see/cancel pending ones."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT order_id, item_id, item_title, points_cost, status,
                   created_at, updated_at
            FROM Orders
            WHERE driver_user_id = %s
            ORDER BY created_at DESC
            """,
            (current_user["user_id"],)
        )
        orders = cursor.fetchall()
        for o in orders:
            if o.get("created_at"):
                o["created_at"] = o["created_at"].isoformat()
            if o.get("updated_at"):
                o["updated_at"] = o["updated_at"].isoformat()
        return {"orders": orders}
    finally:
        cursor.close()
        conn.close()


@app.post("/api/driver/orders/{order_id}/cancel")
def cancel_driver_order(order_id: int, current_user: dict = Depends(get_current_user)):
    """
    Task 15507: cancel a pending order.
    - Only the owning driver may cancel.
    - Only 'pending' orders are cancellable.
    - Refunds points to SponsorDrivers and restores stock.
    - Logs refund to audit_log.
    """
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT order_id, driver_user_id, sponsor_user_id, item_id, item_title, points_cost, status FROM Orders WHERE order_id = %s",
            (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["driver_user_id"] != driver_id:
            raise HTTPException(status_code=403, detail="Not your order")
        if order["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Only pending orders can be cancelled (current status: {order['status']})")

        now = datetime.utcnow()
        sponsor_id = order["sponsor_user_id"]

        # Refund points
        cursor.execute(
            "UPDATE SponsorDrivers SET total_points = total_points + %s WHERE driver_user_id = %s AND sponsor_user_id = %s",
            (order["points_cost"], driver_id, sponsor_id)
        )
        # Restore stock
        cursor.execute(
            "UPDATE SponsorCatalog SET stock_quantity = stock_quantity + 1 WHERE item_id = %s AND sponsor_user_id = %s",
            (order["item_id"], sponsor_id)
        )
        # Update order status
        cursor.execute(
            "UPDATE Orders SET status = 'cancelled', updated_at = %s WHERE order_id = %s",
            (now, order_id)
        )
        # Audit log — point refund
        cursor.execute(
            "INSERT INTO audit_log (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id) VALUES ('point_change', %s, %s, %s, %s, %s, %s)",
            (now, sponsor_id, driver_id, order["points_cost"], f"Cancelled order #{order_id}: {order['item_title']}", driver_id)
        )
        conn.commit()

        cursor.execute("SELECT total_points FROM SponsorDrivers WHERE driver_user_id = %s AND sponsor_user_id = %s", (driver_id, sponsor_id))
        new_balance = cursor.fetchone()["total_points"]
        return {"message": f"Order #{order_id} cancelled. {order['points_cost']} pts refunded.", "new_points_balance": new_balance}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


# ==============================================================================
# ORDERS: SPONSOR ENDPOINT 
# ==============================================================================

@app.get("/api/sponsor/orders")
def get_sponsor_orders(
    driver_name: str = "",
    current_user: dict = Depends(get_current_user)
):
    """
    Task 15503: sponsor views all orders for their drivers.
    Optional ?driver_name= filter (matches username, first_name, or last_name).
    Only returns orders for drivers in this sponsor's org.
    """
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Sponsor access required")
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                o.order_id, o.item_id, o.item_title, o.points_cost, o.status,
                o.created_at, o.updated_at,
                u.username,
                COALESCE(p.first_name, '') AS first_name,
                COALESCE(p.last_name, '')  AS last_name
            FROM Orders o
            JOIN Users u   ON u.user_id = o.driver_user_id
            LEFT JOIN Profiles p ON p.user_id = o.driver_user_id
            WHERE o.sponsor_user_id = %s
            ORDER BY o.created_at DESC
            """,
            (sponsor_id,)
        )
        orders = cursor.fetchall()
        # Apply driver_name filter in Python (case-insensitive substring match)
        if driver_name.strip():
            q = driver_name.strip().lower()
            orders = [
                o for o in orders
                if q in o["username"].lower()
                or q in o["first_name"].lower()
                or q in o["last_name"].lower()
                or q in f"{o['first_name']} {o['last_name']}".lower()
            ]
        for o in orders:
            if o.get("created_at"):
                o["created_at"] = o["created_at"].isoformat()
            if o.get("updated_at"):
                o["updated_at"] = o["updated_at"].isoformat()
        return {"orders": orders}
    finally:
        cursor.close()
        conn.close()

# ==============================================================================
# ERROR LOG ENDPOINTS 
# ==============================================================================

@app.get("/api/sponsor/error-logs")
def get_sponsor_error_logs(
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Task 15515: sponsor views API error log entries scoped to their org
    or unscoped global eBay failures.
    """
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Sponsor access required")
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT error_id, occurred_at, operation, endpoint,
                   error_message, status_code, request_id
            FROM APIErrorLog
            WHERE sponsor_id = %s OR sponsor_id IS NULL
            ORDER BY occurred_at DESC
            LIMIT %s
            """,
            (sponsor_id, min(limit, 500))
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("occurred_at"):
                r["occurred_at"] = r["occurred_at"].isoformat()
        return {"errors": rows}
    finally:
        cursor.close()
        conn.close()


@app.get("/api/admin/error-logs")
def get_admin_error_logs(
    limit: int = 200,
    current_user: dict = Depends(get_current_user)
):
    """Task 15515: admin views all API error log entries across all sponsors."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT e.error_id, e.occurred_at, e.sponsor_id, e.operation,
                   e.endpoint, e.error_message, e.status_code, e.request_id,
                   sp.company_name
            FROM APIErrorLog e
            LEFT JOIN SponsorProfiles sp ON sp.user_id = e.sponsor_id
            ORDER BY e.occurred_at DESC
            LIMIT %s
            """,
            (min(limit, 1000),)
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("occurred_at"):
                r["occurred_at"] = r["occurred_at"].isoformat()
        return {"errors": rows}
    finally:
        cursor.close()
        conn.close()

