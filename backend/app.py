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
from schemas.notifications import NotificationPreferences

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
from auth.auth import (
    get_current_user,
    get_current_user_allow_blocked,
    create_access_token,
    get_account_status_for_user,
    hash_password,
    verify_password,
    verify_token,
)
from schemas.admin import AccountAppealCreateRequest
from auth.token_blacklist import blacklist_token
from audit.login_audit import log_login_attempt, get_last_login
from users.password_reset import (
    generate_reset_token,
    validate_reset_token,
    mark_token_used,
)
from users.email_service import (
    send_password_reset_email,
    send_login_notification_email,
    send_failed_login_alert_email,
    send_order_placed_email,
    send_sponsor_order_placed_email,
    send_dropped_by_sponsor_email,
)
from shared.utils import validate_password

# --- Database & Config ---
from shared.db import get_connection

# --- Routers (Feature Modules) ---
from profiles.driver_profile import router as driver_profile_router
from profiles.sponsor_profile import router as sponsor_profile_router
from profiles.sponsor_impersonation import router as sponsor_impersonation_router
from profiles.trusted_devices import router as trusted_devices_router
from profiles.points import router as points_router 
from users.admin_routes import router as admin_router
from shared.scheduler import scheduler
from bulk_upload.bulk_upload import router as bulk_upload_router


from services.catalog.catalog_service import get_sponsor_catalog, add_to_catalog, remove_from_catalog

# --- App Initialization ---
INACTIVITY_LIMIT_MINUTES = 30 # set inactivity to 30 min
app = FastAPI(title="Team27 API", description="API for Team27 application", version="1.0")


# CORS middleware — add your frontend origins
origins = [
    "http://localhost:5173",      # Vite dev server
    "http://127.0.0.1:5173",
    "http://52.200.244.222:5173", # EC2 frontend
    "https://good-driver-app-team27-emhfeqdndxgrdybe.eastus-01.azurewebsites.net",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_request_ip(http_request: Request) -> str:
    """Prefer proxy-forwarded IPs when present; otherwise use the direct client IP."""
    forwarded_for = http_request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return http_request.client.host if http_request.client else "Unknown"


def ensure_account_appeals_table(cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS AccountAppeals (
            appeal_id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            user_role VARCHAR(32) NOT NULL,
            account_status VARCHAR(32) NOT NULL,
            target_admin_user_id INT NULL,
            message TEXT NOT NULL,
            appeal_status VARCHAR(32) NOT NULL DEFAULT 'open',
            admin_response TEXT NULL,
            reviewed_by_user_id INT NULL,
            reviewed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_appeal_user_id (user_id),
            INDEX idx_appeal_status (appeal_status)
        )
        """
    )


def ensure_account_status_schema() -> None:
    """
    Bring sponsor/driver account_status columns in line with the current app logic.
    This keeps older databases from rejecting the newer 'banned' state.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute(
            """
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'SponsorProfiles'
              AND COLUMN_NAME = 'account_status'
            """
        )
        sponsor_row = cursor.fetchone()
        sponsor_column_type = (sponsor_row or {}).get("COLUMN_TYPE", "")
        if not sponsor_row:
            cursor.execute(
                """
                ALTER TABLE SponsorProfiles
                ADD COLUMN account_status ENUM('active', 'inactive', 'banned')
                NOT NULL DEFAULT 'active'
                """
            )
        elif "banned" not in sponsor_column_type:
            cursor.execute(
                """
                ALTER TABLE SponsorProfiles
                MODIFY COLUMN account_status ENUM('active', 'inactive', 'banned')
                NOT NULL DEFAULT 'active'
                """
            )

        cursor.execute(
            """
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'DriverProfiles'
              AND COLUMN_NAME = 'account_status'
            """
        )
        driver_row = cursor.fetchone()
        driver_column_type = (driver_row or {}).get("COLUMN_TYPE", "")
        if not driver_row:
            cursor.execute(
                """
                ALTER TABLE DriverProfiles
                ADD COLUMN account_status ENUM('active', 'inactive', 'banned')
                NOT NULL DEFAULT 'active'
                """
            )
        elif "banned" not in driver_column_type:
            cursor.execute(
                """
                ALTER TABLE DriverProfiles
                MODIFY COLUMN account_status ENUM('active', 'inactive', 'banned')
                NOT NULL DEFAULT 'active'
                """
            )

        # Repair older records created before full status management existed.
        cursor.execute(
            """
            UPDATE SponsorProfiles
            SET account_status = 'active'
            WHERE account_status IS NULL OR account_status = ''
            """
        )
        cursor.execute(
            """
            UPDATE DriverProfiles
            SET account_status = 'active'
            WHERE account_status IS NULL OR account_status = ''
            """
        )

        conn.commit()
    finally:
        cursor.close()
        conn.close()


def repair_sponsor_driver_point_totals() -> None:
    """
    Rebuild SponsorDrivers.total_points from sponsor-scoped audit history.
    This repairs historical cross-sponsor contamination where one sponsor update
    incorrectly touched other sponsor rows for the same driver.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        cursor.execute(
            """
            UPDATE SponsorDrivers sd
            LEFT JOIN (
                SELECT
                    sponsor_id AS sponsor_user_id,
                    driver_id AS driver_user_id,
                    COALESCE(SUM(points_changed), 0) AS calculated_total
                FROM audit_log
                WHERE category = 'point_change'
                  AND sponsor_id IS NOT NULL
                  AND driver_id IS NOT NULL
                GROUP BY sponsor_id, driver_id
            ) totals
              ON totals.sponsor_user_id = sd.sponsor_user_id
             AND totals.driver_user_id = sd.driver_user_id
            SET sd.total_points = COALESCE(totals.calculated_total, 0)
            WHERE sd.total_points <> COALESCE(totals.calculated_total, 0)
            """
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def get_last_admin_status_actor(cursor, user_id: int, role: str) -> int | None:
    """
    Find the most recent admin that changed this account's status.
    """
    if role == "sponsor":
        cursor.execute(
            """
            SELECT changed_by_user_id
            FROM audit_log
            WHERE category = 'account_status_change'
              AND sponsor_id = %s
              AND changed_by_user_id IS NOT NULL
            ORDER BY date DESC
            LIMIT 1
            """,
            (user_id,),
        )
    else:
        cursor.execute(
            """
            SELECT changed_by_user_id
            FROM audit_log
            WHERE category = 'account_status_change'
              AND _id = %s
              AND changed_by_user_id IS NOT NULL
            ORDER BY date DESC
            LIMIT 1
            """,
            (user_id,),
        )
    row = cursor.fetchone()
    return (row or {}).get("changed_by_user_id")


def parse_login_device_details(user_agent: str | None) -> tuple[str, str, str]:
    agent = (user_agent or "").lower()

    if "iphone" in agent:
        device_name = "iPhone"
    elif "ipad" in agent:
        device_name = "iPad"
    elif "android" in agent:
        device_name = "Android Device"
    elif "macintosh" in agent or "mac os x" in agent:
        device_name = "Mac"
    elif "windows" in agent:
        device_name = "Windows PC"
    elif "linux" in agent:
        device_name = "Linux Device"
    else:
        device_name = "Unknown Device"

    if "edg/" in agent:
        browser_name = "Microsoft Edge"
    elif "chrome/" in agent and "edg/" not in agent:
        browser_name = "Google Chrome"
    elif "firefox/" in agent:
        browser_name = "Mozilla Firefox"
    elif "safari/" in agent and "chrome/" not in agent:
        browser_name = "Safari"
    else:
        browser_name = "Unknown Browser"

    if "iphone" in agent or "ipad" in agent or "ios" in agent:
        os_name = "iOS"
    elif "android" in agent:
        os_name = "Android"
    elif "windows" in agent:
        os_name = "Windows"
    elif "mac os x" in agent or "macintosh" in agent:
        os_name = "macOS"
    elif "linux" in agent:
        os_name = "Linux"
    else:
        os_name = "Unknown OS"

    return device_name, browser_name, os_name


def get_sponsor_user_for_audit(http_request: Request) -> dict | None:
    authorization = http_request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()
    payload = verify_token(token)
    if not payload:
        return None

    user_id = payload.get("user_id")
    if not user_id:
        return None

    user = get_user_by_id(user_id)
    if not user or user.get("role") != "sponsor":
        return None

    return user


def log_sponsor_user_action(sponsor_user_id: int, method: str, path: str) -> None:
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO audit_log
                (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES
                ('sponsor_user_action', %s, %s, NULL, 0, %s, %s)
            """,
            (datetime.utcnow(), sponsor_user_id, f"{method} {path}", sponsor_user_id)
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_driver_user_for_audit(http_request: Request) -> dict | None:
    authorization = http_request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1].strip()
    payload = verify_token(token)
    if not payload:
        return None

    user_id = payload.get("user_id")
    if not user_id:
        return None

    user = get_user_by_id(user_id)
    if not user or user.get("role") != "driver":
        return None

    return user


def log_driver_user_action(driver_user_id: int, method: str, path: str) -> None:
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO audit_log
                (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES
                ('driver_user_action', %s, NULL, %s, 0, %s, %s)
            """,
            (datetime.utcnow(), driver_user_id, f"{method} {path}", driver_user_id)
        )
        conn.commit()
    except Exception:
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


@app.middleware("http")
async def audit_user_actions(request: Request, call_next):
    sponsor_user = get_sponsor_user_for_audit(request)
    driver_user = get_driver_user_for_audit(request)
    response = await call_next(request)

    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return response

    if response.status_code >= 400:
        return response

    if sponsor_user and sponsor_user.get("role") == "sponsor":
        log_sponsor_user_action(sponsor_user["user_id"], request.method, request.url.path)

    if driver_user and driver_user.get("role") == "driver":
        log_driver_user_action(driver_user["user_id"], request.method, request.url.path)

    return response

# Run scheduler on startup
@app.on_event("startup")
def start_scheduler():
    ensure_account_status_schema()
    repair_sponsor_driver_point_totals()
    if not getattr(scheduler, "running", False):
        scheduler.start()


@app.on_event("shutdown")
def stop_scheduler():
    if getattr(scheduler, "running", False):
        scheduler.shutdown(wait=False)

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
app.include_router(sponsor_impersonation_router)
app.include_router(bulk_upload_router)

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

@app.get("/about/public")
def get_about_public():
    """Public endpoint — returns project metadata + sponsor stats."""
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

        cursor.execute(
            """
            SELECT u.username AS sponsor_name, COUNT(sd.driver_user_id) AS driver_count
            FROM Users u
            LEFT JOIN SponsorDrivers sd ON sd.sponsor_user_id = u.user_id
            WHERE u.role = 'sponsor'
            GROUP BY u.user_id, u.username
            ORDER BY u.username
            """
        )
        sponsors = cursor.fetchall()
        row["sponsors"] = [
            {"name": s["sponsor_name"], "driver_count": int(s["driver_count"])}
            for s in sponsors
        ]
        return row
    finally:
        cursor.close()
        conn.close()

@app.get("/api/driver/sponsors")
def get_driver_sponsors(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT sd.sponsor_user_id, sd.total_points,
                   COALESCE(sp.company_name, u.username) AS sponsor_name
            FROM SponsorDrivers sd
            JOIN (
                SELECT sponsor_user_id, MAX(sponsor_driver_id) AS latest_sponsor_driver_id
                FROM SponsorDrivers
                WHERE driver_user_id = %s
                GROUP BY sponsor_user_id
            ) latest
              ON latest.latest_sponsor_driver_id = sd.sponsor_driver_id
            JOIN Users u ON u.user_id = sd.sponsor_user_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = sd.sponsor_user_id
            WHERE sd.driver_user_id = %s
            ORDER BY sponsor_name ASC
            """,
            (current_user["user_id"], current_user["user_id"])
        )
        sponsors = cursor.fetchall()
        for s in sponsors:
            s["total_points"] = int(s["total_points"] or 0)
        return {"sponsors": sponsors}
    finally:
        cursor.close()
        conn.close()

@app.post("/sponsor/drivers/{driver_id}/drop")
def drop_driver(driver_id: int, body: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Sponsor access required")
    reason = body.get("reason", "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT sd.sponsor_driver_id, u.email, u.username FROM SponsorDrivers sd JOIN Users u ON u.user_id = sd.driver_user_id WHERE sd.driver_user_id = %s AND sd.sponsor_user_id = %s",
            (driver_id, sponsor_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Driver not found in your organization")
        cursor.execute(
            "DELETE FROM SponsorDrivers WHERE driver_user_id = %s AND sponsor_user_id = %s",
            (driver_id, sponsor_id)
        )
        cursor.execute(
            """INSERT INTO audit_log (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
               VALUES ('driver_dropped', %s, %s, %s, 0, %s, %s)""",
            (datetime.utcnow(), sponsor_id, driver_id, reason, sponsor_id)
        )
        conn.commit()
        cursor.execute(
            "SELECT COALESCE(sp.company_name, u.username) AS sponsor_name FROM Users u LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id WHERE u.user_id = %s",
            (sponsor_id,)
        )
        sponsor_row = cursor.fetchone()
        sponsor_name = sponsor_row["sponsor_name"] if sponsor_row else None
        if row.get("email"):
            try:
                send_dropped_by_sponsor_email(
                    to_email=row["email"],
                    username=row["username"],
                    sponsor_name=sponsor_name,
                    reason=reason,
                )
            except Exception:
                pass  # Email failure should not block the drop
        return {"success": True, "message": "Driver dropped successfully"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to drop driver")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/driver/notification-preferences")
def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get notification preferences for the logged-in driver."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT points_email_enabled, orders_email_enabled FROM NotificationPreferences WHERE user_id = %s",
            (current_user["user_id"],)
        )
        row = cursor.fetchone()
        if not row:
            return {"points_email_enabled": True, "orders_email_enabled": True}
        return row
    finally:
        cursor.close()
        conn.close()


@app.put("/api/driver/notification-preferences")
def update_notification_preferences(
    prefs: NotificationPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Save notification preferences for the logged-in driver."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO NotificationPreferences (user_id, points_email_enabled, orders_email_enabled)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                points_email_enabled = VALUES(points_email_enabled),
                orders_email_enabled = VALUES(orders_email_enabled)
            """,
            (current_user["user_id"], prefs.points_email_enabled, prefs.orders_email_enabled)
        )
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/driver/notifications")
def get_driver_notifications(current_user: dict = Depends(get_current_user)):
    """Story 5431/5448: Return in-app notifications for the logged-in driver."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT notification_id, message, is_read, created_at
            FROM Notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (current_user["user_id"],)
        )
        rows = cursor.fetchall()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = r["created_at"].isoformat()
        return {"notifications": rows}
    finally:
        cursor.close()
        conn.close()


@app.post("/api/driver/notifications/{notification_id}/dismiss")
def dismiss_driver_notification(notification_id: int, current_user: dict = Depends(get_current_user)):
    """Story 5448: Mark a driver notification as read (dismissed)."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT user_id FROM Notifications WHERE notification_id = %s",
            (notification_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")
        if row["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your notification")
        cursor.execute(
            "UPDATE Notifications SET is_read = TRUE WHERE notification_id = %s",
            (notification_id,)
        )
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
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

    ip = get_request_ip(http_request)
    agent = http_request.headers.get("User-Agent")
    device_name, browser_name, os_name = parse_login_device_details(agent)

    if not user:
        attempted_user = get_user_by_username(request.username)
        log_login_attempt(
            username=request.username,
            success=False,
            ip_address=ip,
            user_agent=agent
        )
        if attempted_user and attempted_user.get("role") == "driver" and attempted_user.get("email"):
            send_failed_login_alert_email(
                to_email=attempted_user["email"],
                username=attempted_user["username"],
                attempted_username=request.username,
                attempt_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
                ip_address=ip,
                device_name=device_name,
                browser_name=browser_name,
                os_name=os_name,
            )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    log_login_attempt(
        username=user["username"],
        user_id=user["user_id"],
        success=True,
        ip_address=ip,
        user_agent=agent
    )

    account_status = get_account_status_for_user(user["user_id"], user.get("role", ""))
    if user.get("role") in ("driver", "sponsor") and account_status != "active":
        raise HTTPException(
            status_code=403,
            detail=f"ACCOUNT_BLOCKED:{account_status}:{user.get('role')}",
        )

    token = create_access_token({"user_id": user["user_id"]})

    # Notification failures should not block a successful login.
    if user.get("role") == "driver" and user.get("email"):
        send_login_notification_email(
            to_email=user["email"],
            username=user["username"],
            login_time=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            ip_address=ip,
            device_name=device_name,
            browser_name=browser_name,
            os_name=os_name,
        )
    
    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "email": user["email"],
        "access_token": token
    }


@app.post("/account-appeals")
def submit_account_appeal(
    body: AccountAppealCreateRequest,
    current_user: dict = Depends(get_current_user_allow_blocked),
):
    """
    Allow blocked sponsor/driver users to submit a review request to admins.
    """
    role = current_user.get("role")
    account_status = (current_user.get("account_status") or "active").lower()

    if role not in ("driver", "sponsor"):
        raise HTTPException(status_code=403, detail="Only driver/sponsor users can submit appeals")
    if account_status == "active":
        raise HTTPException(status_code=409, detail="Your account is already active")

    message = (body.message or "").strip()
    if len(message) < 10:
        raise HTTPException(status_code=422, detail="Please provide at least 10 characters")
    if len(message) > 2000:
        raise HTTPException(status_code=422, detail="Message too long (max 2000 characters)")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_account_appeals_table(cursor)
        target_admin_user_id = get_last_admin_status_actor(cursor, current_user["user_id"], role)
        cursor.execute(
            """
            INSERT INTO AccountAppeals
                (user_id, user_role, account_status, target_admin_user_id, message, appeal_status)
            VALUES (%s, %s, %s, %s, %s, 'open')
            """,
            (
                current_user["user_id"],
                role,
                account_status,
                target_admin_user_id,
                message,
            ),
        )
        conn.commit()
        return {"message": "Appeal submitted. An admin will review your request."}
    finally:
        cursor.close()
        conn.close()




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
    Includes draft + published items for preview.
    """

    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    sponsor_id = current_user["user_id"]

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT *
            FROM SponsorCatalog
            WHERE sponsor_user_id = %s
            ORDER BY created_at DESC
            """,
            (sponsor_id,)
        )

        items = cursor.fetchall()

        return {
            "items": items
        }

    finally:
        cursor.close()
        conn.close()
    

@app.post("/api/sponsor/catalog")
def add_product_to_catalog(
    product: dict,
    current_user=Depends(get_current_user)
):

    print("RECEIVED PRODUCT:", product)

    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        add_to_catalog(current_user["user_id"], product)
    except Exception as e:
        print("DB ERROR:", str(e))
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
@app.put("/api/sponsor/catalog/publish")
def publish_catalog(current_user=Depends(get_current_user)):

    sponsor_id = current_user["user_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE SponsorCatalog
            SET is_published = TRUE,
                is_draft = FALSE,
                is_active = TRUE
            WHERE sponsor_user_id = %s
            AND is_draft = TRUE
            """,
            (sponsor_id,)
        )

        conn.commit()

        return {"message": "Catalog published"}
    finally:
        cursor.close()
        conn.close()
        
# ==============================================================================
# PROTECTED ENDPOINTS
# ==============================================================================

@app.get("/users", tags=["Admin"], dependencies=[Depends(check_inactivity)])
def read_users(current_user: dict = Depends(get_current_user)):
    users = get_all_users()
    # u[0] is username, u[1] is role
    return [{"username": u[0], "role": u[1]} for u in users]

# ==============================================================================
# SAVED PRODUCTS: DRIVER ENDPOINTS (Story 5492)
# ==============================================================================

@app.get("/api/driver/saved-products")
def get_saved_products(sponsor_user_id: int | None = None, current_user: dict = Depends(get_current_user)):
    """Return item_ids the driver has saved."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        if sponsor_user_id is not None:
            cursor.execute(
                "SELECT item_id FROM SavedProducts WHERE driver_user_id = %s AND sponsor_user_id = %s",
                (current_user["user_id"], sponsor_user_id)
            )
        else:
            cursor.execute(
                "SELECT item_id FROM SavedProducts WHERE driver_user_id = %s",
                (current_user["user_id"],)
            )
        rows = cursor.fetchall()
        return {"saved_item_ids": [r["item_id"] for r in rows]}
    finally:
        cursor.close()
        conn.close()


@app.post("/api/driver/saved-products")
def save_product(body: dict, current_user: dict = Depends(get_current_user)):
    """Save a catalog item for the driver."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    item_id = body.get("item_id")
    sponsor_id = body.get("sponsor_user_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    if not sponsor_id:
        raise HTTPException(status_code=400, detail="sponsor_user_id required")

    driver_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT sponsor_user_id
            FROM SponsorDrivers
            WHERE driver_user_id = %s AND sponsor_user_id = %s
            LIMIT 1
            """,
            (driver_id, sponsor_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sponsor relationship not found for driver")

        cursor.execute(
            """
            INSERT IGNORE INTO SavedProducts (driver_user_id, sponsor_user_id, item_id)
            VALUES (%s, %s, %s)
            """,
            (driver_id, sponsor_id, item_id)
        )
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    finally:
        cursor.close()
        conn.close()


@app.delete("/api/driver/saved-products/{item_id}")
def unsave_product(item_id: str, sponsor_user_id: int | None = None, current_user: dict = Depends(get_current_user)):
    """Remove a saved catalog item for the driver."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if sponsor_user_id is not None:
            cursor.execute(
                "DELETE FROM SavedProducts WHERE driver_user_id = %s AND sponsor_user_id = %s AND item_id = %s",
                (current_user["user_id"], sponsor_user_id, item_id)
            )
        else:
            cursor.execute(
                "DELETE FROM SavedProducts WHERE driver_user_id = %s AND item_id = %s",
                (current_user["user_id"], item_id)
            )
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

# ==============================================================================
# CATALOG: DRIVER ENDPOINTS (US-38, US-39)
# ==============================================================================

@app.get("/api/driver/catalog")
def get_driver_catalog(sponsor_user_id: int | None = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        if sponsor_user_id is not None:
            cursor.execute(
                """
                SELECT sponsor_driver_id, sponsor_user_id, total_points
                FROM SponsorDrivers
                WHERE driver_user_id = %s AND sponsor_user_id = %s
                ORDER BY sponsor_driver_id DESC
                LIMIT 1
                """,
                (driver_id, sponsor_user_id)
            )
        else:
            cursor.execute(
                """
                SELECT sponsor_user_id, total_points
                FROM SponsorDrivers
                WHERE driver_user_id = %s
                ORDER BY sponsor_driver_id DESC
                LIMIT 1
                """,
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
            AND is_published = TRUE
            AND is_active = TRUE
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
def get_driver_catalog_item(item_id: str, sponsor_user_id: int | None = None, current_user: dict = Depends(get_current_user)):
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
        if sponsor_user_id is not None:
            cursor.execute(
                """
                SELECT sponsor_user_id
                FROM SponsorDrivers
                WHERE driver_user_id = %s AND sponsor_user_id = %s
                ORDER BY sponsor_driver_id DESC
                LIMIT 1
                """,
                (driver_id, sponsor_user_id)
            )
        else:
            cursor.execute(
                """
                SELECT sponsor_user_id
                FROM SponsorDrivers
                WHERE driver_user_id = %s
                ORDER BY sponsor_driver_id DESC
                LIMIT 1
                """,
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
            WHERE item_id = %s AND sponsor_user_id = %s AND is_active = TRUE
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
def purchase_catalog_item(body: dict, http_request: Request, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    item_id = body.get("item_id")
    sponsor_user_id = body.get("sponsor_user_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    if not sponsor_user_id:
        raise HTTPException(status_code=400, detail="sponsor_user_id required")
    ip = get_request_ip(http_request)
    agent = http_request.headers.get("User-Agent")
    device_name, browser_name, os_name = parse_login_device_details(agent)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT sponsor_driver_id, sponsor_user_id, total_points
            FROM SponsorDrivers
            WHERE driver_user_id = %s AND sponsor_user_id = %s
            ORDER BY sponsor_driver_id DESC
            LIMIT 1
            """,
            (driver_id, sponsor_user_id)
        )
        driver_row = cursor.fetchone()
        if not driver_row:
            raise HTTPException(status_code=404, detail="No sponsor relationship found")
        sponsor_id = driver_row["sponsor_user_id"]
        current_points = driver_row["total_points"] or 0
        sponsor_driver_id = driver_row["sponsor_driver_id"]
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
            "UPDATE SponsorDrivers SET total_points = total_points - %s WHERE sponsor_driver_id = %s",
            (item["points_cost"], sponsor_driver_id)
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
            INSERT INTO Orders (
                driver_user_id, sponsor_user_id, item_id, item_title, points_cost, status, created_at, updated_at,
                purchase_ip_address, purchase_device_name, purchase_browser_name, purchase_os_name
            )
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s, %s, %s)
            """,
            (
                driver_id, sponsor_id, item_id, item["title"], item["points_cost"], now, now,
                ip, device_name, browser_name, os_name
            )
        )
        conn.commit()
        cursor.execute(
            "SELECT total_points FROM SponsorDrivers WHERE sponsor_driver_id = %s",
            (sponsor_driver_id,)
        )
        new_balance_row = cursor.fetchone()
        new_balance = new_balance_row["total_points"] if new_balance_row else 0
        cursor.execute("SELECT stock_quantity FROM SponsorCatalog WHERE item_id = %s AND sponsor_user_id = %s", (item_id, sponsor_id))
        new_stock = cursor.fetchone()["stock_quantity"]

        cursor.execute(
            "SELECT orders_email_enabled FROM NotificationPreferences WHERE user_id = %s",
            (driver_id,)
        )
        pref_row = cursor.fetchone()
        orders_email_enabled = True if not pref_row else bool(pref_row["orders_email_enabled"])

        if orders_email_enabled and current_user.get("email"):
            send_order_placed_email(
                to_email=current_user["email"],
                username=current_user["username"],
                order_items=[{"title": item["title"], "points_cost": item["points_cost"]}],
                total_points=item["points_cost"],
                placed_at=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
                ip_address=ip,
                device_name=device_name,
                browser_name=browser_name,
                os_name=os_name,
            )

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

@app.post("/api/sponsor/catalog/purchase")
def sponsor_purchase_for_driver(body: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Sponsor access required")

    sponsor_id = current_user["user_id"]
    item_id = body.get("item_id")
    driver_id = body.get("driver_user_id")

    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")
    if not driver_id:
        raise HTTPException(status_code=400, detail="driver_user_id required")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT sponsor_driver_id, total_points
            FROM SponsorDrivers
            WHERE driver_user_id = %s AND sponsor_user_id = %s
            ORDER BY sponsor_driver_id DESC
            LIMIT 1
            """,
            (driver_id, sponsor_id)
        )
        driver_row = cursor.fetchone()
        if not driver_row:
            raise HTTPException(status_code=404, detail="Driver not found in your organization")

        current_points = driver_row["total_points"] or 0
        sponsor_driver_id = driver_row["sponsor_driver_id"]

        cursor.execute(
            """
            SELECT item_id, title, points_cost, stock_quantity
            FROM SponsorCatalog
            WHERE item_id = %s AND sponsor_user_id = %s
              AND is_active = TRUE AND is_published = TRUE
            """,
            (item_id, sponsor_id)
        )
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Item not available for purchase")

        if current_points < item["points_cost"]:
            needed = item["points_cost"] - current_points
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient driver points. '{item['title']}' costs {item['points_cost']} pts; driver has {current_points} pts (needs {needed} more).",
            )

        if item["stock_quantity"] <= 0:
            raise HTTPException(status_code=400, detail="This item is out of stock.")

        cursor.execute(
            "UPDATE SponsorDrivers SET total_points = total_points - %s WHERE sponsor_driver_id = %s",
            (item["points_cost"], sponsor_driver_id)
        )
        cursor.execute(
            "UPDATE SponsorCatalog SET stock_quantity = stock_quantity - 1 WHERE item_id = %s AND sponsor_user_id = %s",
            (item_id, sponsor_id)
        )

        now = datetime.utcnow()
        cursor.execute(
            """
            INSERT INTO audit_log (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES ('point_change', %s, %s, %s, %s, %s, %s)
            """,
            (now, sponsor_id, driver_id, -item["points_cost"], f"Sponsor redeemed for driver: {item['title']}", sponsor_id)
        )
        cursor.execute(
            """
            INSERT INTO Orders (driver_user_id, sponsor_user_id, item_id, item_title, points_cost, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s)
            """,
            (driver_id, sponsor_id, item_id, item["title"], item["points_cost"], now, now)
        )

         # build notification before commit so it's part of the same transaction
        cursor.execute(
            """
            SELECT COALESCE(sp.company_name, u.username) AS sponsor_label
            FROM Users u
            LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id
            WHERE u.user_id = %s
            """,
            (sponsor_id,)
        )
        sponsor_row = cursor.fetchone()
        sponsor_label = sponsor_row["sponsor_label"] if sponsor_row else "Your sponsor"

        cursor.execute("SELECT username, email FROM Users WHERE user_id = %s", (driver_id,))
        driver_user = cursor.fetchone()

        notification_msg = (
            f"{sponsor_label} placed an order for '{item['title']}' "
            f"using {item['points_cost']} of your points."
        )
        cursor.execute(
            "INSERT INTO Notifications (user_id, message) VALUES (%s, %s)",
            (driver_id, notification_msg)
        )

        conn.commit()

        cursor.execute(
            "SELECT total_points FROM SponsorDrivers WHERE sponsor_driver_id = %s",
            (sponsor_driver_id,)
        )
        new_balance = cursor.fetchone()["total_points"]
        cursor.execute(
            "SELECT stock_quantity FROM SponsorCatalog WHERE item_id = %s AND sponsor_user_id = %s",
            (item_id, sponsor_id)
        )
        new_stock = cursor.fetchone()["stock_quantity"]

        # Send email if driver has orders notifications enabled
        cursor.execute(
            "SELECT orders_email_enabled FROM NotificationPreferences WHERE user_id = %s",
            (driver_id,)
        )
        pref_row = cursor.fetchone()
        orders_email_enabled = True if not pref_row else bool(pref_row["orders_email_enabled"])

        if orders_email_enabled and driver_user and driver_user.get("email"):
            send_sponsor_order_placed_email(
                to_email=driver_user["email"],
                username=driver_user["username"],
                item_title=item["title"],
                points_cost=item["points_cost"],
                placed_at=now.strftime("%Y-%m-%d %H:%M:%S UTC"),
                sponsor_name=sponsor_label,
            )

        return {
            "message": f"Purchased '{item['title']}' for driver #{driver_id}",
            "points_spent": item["points_cost"],
            "driver_new_points_balance": new_balance,
            "remaining_stock": new_stock,
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Failed to complete sponsor purchase")
    finally:
        cursor.close()
        conn.close()

@app.post("/api/driver/orders/{order_id}/report-issue")
def report_order_issue(
    order_id: int,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Driver reports an issue with an order."""
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver access required")
    driver_id = current_user["user_id"]
    issue_type = body.get("issue_type")
    description = body.get("description")
    if not issue_type or not description:
        raise HTTPException(status_code=400, detail="issue_type and description required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT order_id FROM Orders WHERE order_id = %s AND driver_user_id = %s",
            (order_id, driver_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Order not found")
        cursor.execute(
            """
            INSERT INTO OrderIssues (order_id, driver_user_id, issue_type, description)
            VALUES (%s, %s, %s, %s)
            """,
            (order_id, driver_id, issue_type, description)
        )
        conn.commit()
        return {"success": True, "message": "Issue reported successfully"}
    finally:
        cursor.close()
        conn.close()


@app.get("/api/admin/order-issues")
def get_order_issues(
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Admin views all reported order issues."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT oi.issue_id, oi.order_id, oi.issue_type, oi.description,
                   oi.status, oi.created_at, oi.resolved_at, oi.admin_notes,
                   u.username AS driver_username,
                   o.item_title, o.points_cost
            FROM OrderIssues oi
            JOIN Users u ON u.user_id = oi.driver_user_id
            JOIN Orders o ON o.order_id = oi.order_id
        """
        params = []
        if status:
            query += " WHERE oi.status = %s"
            params.append(status)
        query += " ORDER BY oi.created_at DESC"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["created_at"]:
                row["created_at"] = row["created_at"].isoformat()
            if row["resolved_at"]:
                row["resolved_at"] = row["resolved_at"].isoformat()
        return {"issues": rows}
    finally:
        cursor.close()
        conn.close()


@app.put("/api/admin/order-issues/{issue_id}")
def update_order_issue(
    issue_id: int,
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    """Admin updates an order issue status."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    status = body.get("status")
    admin_notes = body.get("admin_notes")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        resolved_at = "NOW()" if status == "resolved" else "NULL"
        cursor.execute(
            f"""
            UPDATE OrderIssues 
            SET status = %s, admin_notes = %s,
                resolved_at = {resolved_at}
            WHERE issue_id = %s
            """,
            (status, admin_notes, issue_id)
        )
        conn.commit()
        return {"success": True}
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

@app.put("/api/sponsor/catalog/{item_id}/disable")
def disable_catalog_item(
    item_id: str,
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    sponsor_id = current_user["user_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE SponsorCatalog
            SET is_active = FALSE
            WHERE item_id = %s AND sponsor_user_id = %s
            """,
            (item_id, sponsor_id)
        )

        conn.commit()

        return {"message": "Product disabled successfully"}
    finally:
        cursor.close()
        conn.close()

@app.put("/api/sponsor/catalog/{item_id}/enable")
def enable_catalog_item(
    item_id: str,
    current_user=Depends(get_current_user)
):
    if current_user["role"] != "sponsor":
        raise HTTPException(status_code=403, detail="Not authorized")

    sponsor_id = current_user["user_id"]

    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            UPDATE SponsorCatalog
            SET is_active = TRUE
            WHERE item_id = %s AND sponsor_user_id = %s
            """,
            (item_id, sponsor_id)
        )

        conn.commit()

        return {"message": "Product enabled successfully"}
    finally:
        cursor.close()
        conn.close()
