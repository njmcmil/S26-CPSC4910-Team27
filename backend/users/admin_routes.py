# users/admin_routes.py

# Admin Control Panel
# allows users with admin role to overlook everyone, and if necessary wipe an account from the system
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from shared.db import get_connection
from auth.auth import create_access_token, get_current_user, get_current_user_allow_blocked, require_role
from schemas.admin import (
    AccountAppealListResponse,
    AccountAppealResolveRequest,
    AccountStatusChangeRequest,
    AuditLogResponse,
    CommunicationLogResponse,
    DriverAdminRow,
    DriverSponsorRow,
    LoginAuditResponse,
    RedemptionReportResponse,
    OperationsSummaryResponse,
    SponsorAdminRow,
    SystemMetricsResponse,
)
from users.email_service import (
    send_admin_account_access_email,
    send_account_appeal_resolved_email,
    send_driver_account_banned_email,
    send_driver_account_deactivated_email,
    send_removed_by_admin_email,
    send_sponsor_account_deactivated_email,
    send_sponsor_account_banned_email,
)
from shared.services import get_user_by_id

router = APIRouter(prefix="/admin", tags=["admin"])


def build_auth_payload(user: dict, token: str, impersonation: dict | None = None) -> dict:
    payload = {
        "user_id": user["user_id"],
        "username": user["username"],
        "role": user["role"],
        "email": user.get("email"),
        "access_token": token,
    }
    if impersonation:
        payload["is_impersonating"] = True
        payload["impersonated_by_user_id"] = (
            impersonation.get("admin_user_id")
            or impersonation.get("sponsor_user_id")
            or impersonation.get("original_user_id")
        )
        payload["original_role"] = impersonation.get("original_role")
    return payload


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

@router.get("/metrics", response_model=SystemMetricsResponse)
def get_system_metrics(current_user: dict = Depends(require_role("admin"))):
    """Return a live snapshot of key system metrics for the admin dashboard."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # User counts by role
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_users,
                SUM(CASE WHEN role = 'driver'  THEN 1 ELSE 0 END) AS total_drivers,
                SUM(CASE WHEN role = 'sponsor' THEN 1 ELSE 0 END) AS total_sponsors,
                SUM(CASE WHEN role = 'admin'   THEN 1 ELSE 0 END) AS total_admins
            FROM Users
            """
        )
        user_row = cursor.fetchone()

        # All-time order totals
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'shipped'   THEN 1 ELSE 0 END) AS shipped_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders
            FROM Orders
            """
        )
        order_row = cursor.fetchone()

        # All-time points awarded (positive entries in audit_log)
        cursor.execute(
            "SELECT COALESCE(SUM(points_changed), 0) AS pts FROM audit_log WHERE points_changed > 0"
        )
        pts_awarded = int((cursor.fetchone() or {}).get("pts", 0))

        # All-time points redeemed via non-cancelled orders
        cursor.execute(
            "SELECT COALESCE(SUM(points_cost), 0) AS pts FROM Orders WHERE status != 'cancelled'"
        )
        pts_redeemed = int((cursor.fetchone() or {}).get("pts", 0))

        # Login activity in the last 24 hours
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_logins,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_logins
            FROM LoginAudit
            WHERE login_time >= NOW() - INTERVAL 24 HOUR
            """
        )
        login_row = cursor.fetchone()

        return {
            "fetched_at": datetime.utcnow().isoformat(),
            "total_users":   int(user_row.get("total_users")   or 0),
            "total_drivers": int(user_row.get("total_drivers") or 0),
            "total_sponsors":int(user_row.get("total_sponsors")or 0),
            "total_admins":  int(user_row.get("total_admins")  or 0),
            "total_orders":    int(order_row.get("total_orders")    or 0),
            "pending_orders":  int(order_row.get("pending_orders")  or 0),
            "shipped_orders":  int(order_row.get("shipped_orders")  or 0),
            "cancelled_orders":int(order_row.get("cancelled_orders")or 0),
            "total_points_awarded":  pts_awarded,
            "total_points_redeemed": pts_redeemed,
            "logins_last_24h":        int(login_row.get("total_logins")  or 0),
            "failed_logins_last_24h": int(login_row.get("failed_logins") or 0),
        }
    finally:
        cursor.close()
        conn.close()

# Allows admin to see big picture
@router.get("/users")
def list_all_users(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                u.user_id,
                u.username,
                u.role,
                u.email,
                CASE
                    WHEN u.role = 'sponsor' THEN COALESCE(NULLIF(sp.account_status, ''), 'active')
                    WHEN u.role = 'driver' THEN COALESCE(NULLIF(dp.account_status, ''), 'active')
                    ELSE 'active'
                END AS account_status
            FROM Users u
            LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id
            LEFT JOIN DriverProfiles dp ON dp.user_id = u.user_id
            ORDER BY u.username
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

@router.get("/users/{username}")
def get_user(username: str, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, username, role, email FROM Users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        cursor.close()
        conn.close()


@router.post("/impersonate/{target_user_id}")
def admin_impersonate_user(
    target_user_id: int,
    current_user: dict = Depends(require_role("admin")),
):
    """
    Allow an admin to assume a sponsor or driver session.
    """
    target = get_user_by_id(target_user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") not in ("sponsor", "driver"):
        raise HTTPException(status_code=400, detail="Admins can only impersonate sponsors or drivers")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        if target.get("role") == "sponsor":
            cursor.execute(
                """
                INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                VALUES (NOW(), 'admin_account_access', %s, NULL, NULL, %s, %s)
                """,
                (
                    target["user_id"],
                    "Admin accessed sponsor account using view-as",
                    current_user["user_id"],
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                VALUES (NOW(), 'admin_account_access', NULL, %s, NULL, %s, %s)
                """,
                (
                    target["user_id"],
                    "Admin accessed driver account using view-as",
                    current_user["user_id"],
                ),
            )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    if target.get("email"):
        send_admin_account_access_email(
            target["email"],
            target["username"],
            current_user["username"],
            target["role"],
        )

    impersonation = {
        "admin_user_id": current_user["user_id"],
        "original_user_id": current_user["user_id"],
        "original_role": current_user["role"],
        "target_user_id": target["user_id"],
        "target_role": target["role"],
    }
    token = create_access_token(
        {
            "user_id": target["user_id"],
            "role": target["role"],
            "impersonation": impersonation,
        }
    )
    return build_auth_payload(target, token, impersonation=impersonation)


@router.post("/stop-impersonation")
def admin_stop_impersonation(current_user: dict = Depends(get_current_user_allow_blocked)):
    """
    Return an impersonating session back to the original admin.
    """
    impersonation = current_user.get("impersonation") or {}
    admin_user_id = impersonation.get("admin_user_id") or impersonation.get("original_user_id")
    if not admin_user_id:
        raise HTTPException(status_code=400, detail="No admin impersonation session to stop")

    admin_user = get_user_by_id(int(admin_user_id))
    if not admin_user or admin_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Original admin account not found")

    token = create_access_token(
        {
            "user_id": admin_user["user_id"],
            "role": admin_user["role"],
        }
    )
    return build_auth_payload(admin_user, token)

def get_sponsors_for_driver(driver_id: int, cursor):
    """Return all sponsors linked to a given driver via SponsorDrivers."""
    try:
        cursor.execute(
            """
            SELECT 
                u.user_id AS id, 
                COALESCE(sp.company_name, u.username) AS name,
                sd.status,
                sd.total_points
            FROM SponsorDrivers sd
            JOIN Users u ON sd.sponsor_user_id = u.user_id
            LEFT JOIN SponsorProfiles sp ON u.user_id = sp.user_id
            WHERE sd.driver_user_id = %s
            ORDER BY name
            """,
            (driver_id,),
        )
    except Exception as exc:
        # Some environments do not have SponsorDrivers.status yet.
        if "Unknown column 'sd.status'" not in str(exc):
            raise
        cursor.execute(
            """
            SELECT 
                u.user_id AS id, 
                COALESCE(sp.company_name, u.username) AS name,
                NULL AS status,
                sd.total_points
            FROM SponsorDrivers sd
            JOIN Users u ON sd.sponsor_user_id = u.user_id
            LEFT JOIN SponsorProfiles sp ON u.user_id = sp.user_id
            WHERE sd.driver_user_id = %s
            ORDER BY name
            """,
            (driver_id,),
        )
    return cursor.fetchall()


@router.get("/drivers/{driver_id}/sponsors", response_model=list[DriverSponsorRow])
def list_driver_sponsors(driver_id: int, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Verify the driver exists
        cursor.execute("SELECT user_id FROM Users WHERE user_id = %s AND role = 'driver'", (driver_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Driver not found")
        rows = get_sponsors_for_driver(driver_id, cursor)
        for row in rows:
            row["total_points"] = int(row["total_points"] or 0)
        return rows
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/redemptions", response_model=RedemptionReportResponse)
def get_redemption_report(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                items.sponsor_id,
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                items.item_id,
                COALESCE(sc.title, order_stats.item_title) AS item_title,
                COALESCE(sc.stock_quantity, 0) AS current_stock,
                COALESCE(order_stats.total_redemptions, 0) AS total_redemptions,
                COALESCE(order_stats.pending_redemptions, 0) AS pending_redemptions,
                COALESCE(order_stats.shipped_redemptions, 0) AS shipped_redemptions,
                COALESCE(order_stats.cancelled_redemptions, 0) AS cancelled_redemptions,
                COALESCE(order_stats.total_points_redeemed, 0) AS total_points_redeemed,
                order_stats.last_redeemed_at
            FROM (
                SELECT sponsor_user_id AS sponsor_id, item_id
                FROM SponsorCatalog
                UNION
                SELECT sponsor_user_id AS sponsor_id, item_id
                FROM Orders
            ) items
            JOIN Users su
              ON su.user_id = items.sponsor_id
            LEFT JOIN SponsorProfiles sp
              ON sp.user_id = items.sponsor_id
            LEFT JOIN SponsorCatalog sc
              ON sc.sponsor_user_id = items.sponsor_id
             AND sc.item_id = items.item_id
            LEFT JOIN (
                SELECT
                    sponsor_user_id,
                    item_id,
                    MAX(item_title) AS item_title,
                    SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END) AS total_redemptions,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_redemptions,
                    SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped_redemptions,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_redemptions,
                    SUM(CASE WHEN status <> 'cancelled' THEN points_cost ELSE 0 END) AS total_points_redeemed,
                    MAX(created_at) AS last_redeemed_at
                FROM Orders
                GROUP BY sponsor_user_id, item_id
            ) order_stats
              ON order_stats.sponsor_user_id = items.sponsor_id
             AND order_stats.item_id = items.item_id
            ORDER BY sponsor_name, item_title
            """
        )
        rows = cursor.fetchall()
        for row in rows:
            if row["last_redeemed_at"]:
                row["last_redeemed_at"] = row["last_redeemed_at"].isoformat()
            for key in (
                "current_stock",
                "total_redemptions",
                "pending_redemptions",
                "shipped_redemptions",
                "cancelled_redemptions",
                "total_points_redeemed",
            ):
                row[key] = int(row[key] or 0)

        return {
            "generated_at": datetime.utcnow().isoformat(),
            "report_rows": rows,
        }
    finally:
        cursor.close()
        conn.close()

@router.get("/reports/summary", response_model=OperationsSummaryResponse)
def get_operations_summary(
    period: str = "weekly",
    date_from: str = "",
    date_to: str = "",
    current_user: dict = Depends(require_role("admin")),
):
    """
    Return key operational metrics for a given date range.
    period is informational only; the actual window is determined by date_from/date_to
    sent from the frontend.
    """
    if not date_from or not date_to:
        raise HTTPException(status_code=422, detail="date_from and date_to are required")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # orders metrics
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'shipped'   THEN 1 ELSE 0 END) AS shipped_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                SUM(CASE WHEN status != 'cancelled' THEN points_cost ELSE 0 END) AS points_redeemed,
                COUNT(DISTINCT driver_user_id)  AS active_drivers,
                COUNT(DISTINCT sponsor_user_id) AS active_sponsors
            FROM Orders
            WHERE created_at BETWEEN %s AND %s
            """,
            (date_from, date_to),
        )
        order_row = cursor.fetchone()

        # new driver registrations (using Profiles.created_at as registration proxy)
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM Profiles p
            JOIN Users u ON u.user_id = p.user_id
            WHERE u.role = 'driver' AND p.created_at BETWEEN %s AND %s
            """,
            (date_from, date_to),
        )
        new_drivers = int((cursor.fetchone() or {}).get("cnt", 0))

        # new sponsor registrations
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM Profiles p
            JOIN Users u ON u.user_id = p.user_id
            WHERE u.role = 'sponsor' AND p.created_at BETWEEN %s AND %s
            """,
            (date_from, date_to),
        )
        new_sponsors = int((cursor.fetchone() or {}).get("cnt", 0))

        # points awarded from audit log
        cursor.execute(
            """
            SELECT COALESCE(SUM(points_changed), 0) AS pts
            FROM audit_log
            WHERE points_changed > 0 AND date BETWEEN %s AND %s
            """,
            (date_from, date_to),
        )
        points_awarded = int((cursor.fetchone() or {}).get("pts", 0))

        # login metrics
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_logins,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_logins
            FROM LoginAudit
            WHERE login_time BETWEEN %s AND %s
            """,
            (date_from, date_to),
        )
        login_row = cursor.fetchone()

        return {
            "period": period,
            "date_from": date_from,
            "date_to": date_to,
            "generated_at": datetime.utcnow().isoformat(),
            "total_orders": int(order_row.get("total_orders") or 0),
            "pending_orders": int(order_row.get("pending_orders") or 0),
            "shipped_orders": int(order_row.get("shipped_orders") or 0),
            "cancelled_orders": int(order_row.get("cancelled_orders") or 0),
            "points_redeemed_via_orders": int(order_row.get("points_redeemed") or 0),
            "active_drivers": int(order_row.get("active_drivers") or 0),
            "active_sponsors": int(order_row.get("active_sponsors") or 0),
            "new_drivers": new_drivers,
            "new_sponsors": new_sponsors,
            "points_awarded": points_awarded,
            "total_logins": int(login_row.get("total_logins") or 0),
            "failed_logins": int(login_row.get("failed_logins") or 0),
        }
    finally:
        cursor.close()
        conn.close()

@router.get("/audit-logs", response_model=AuditLogResponse)
def get_audit_logs(
    category: str | None = None,
    limit: int = 100,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        capped_limit = min(max(limit, 1), 500)
        params: list[object] = []
        query = """
            SELECT
                al.date,
                al.category,
                al.sponsor_id,
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                al.driver_id,
                al.points_changed,
                al.reason,
                al.changed_by_user_id
            FROM audit_log al
            LEFT JOIN Users su ON su.user_id = al.sponsor_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = al.sponsor_id
        """

        if category:
            query += " WHERE al.category = %s"
            params.append(category)

        query += " ORDER BY al.date DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["date"]:
                row["date"] = row["date"].isoformat()
            if row["points_changed"] is not None:
                row["points_changed"] = int(row["points_changed"])

        return {"audit_logs": rows}
    finally:
        cursor.close()
        conn.close()


@router.get("/login-audit", response_model=LoginAuditResponse)
def get_login_audit(
    role: str | None = None,
    limit: int = 200,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        capped_limit = min(max(limit, 1), 1000)
        params: list[object] = []
        query = """
            SELECT
                la.user_id,
                la.username,
                u.role,
                la.success,
                la.ip_address,
                la.user_agent,
                la.login_time
            FROM LoginAudit la
            LEFT JOIN Users u ON u.user_id = la.user_id
        """

        if role in {"driver", "sponsor", "admin"}:
            query += " WHERE u.role = %s"
            params.append(role)

        query += " ORDER BY la.login_time DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            row["success"] = bool(row.get("success"))
            if row.get("login_time"):
                row["login_time"] = row["login_time"].isoformat()
        return {"login_audit": rows}
    finally:
        cursor.close()
        conn.close()

@router.get("/reports/sales-by-sponsor")
def get_sales_by_sponsor_report(
    sponsor_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    view: str = "summary",  # "summary" or "detailed"
    current_user: dict = Depends(require_role("admin")),
):
    """Admin: Sales by Sponsor report."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        params: list = []
        where = ["o.status != 'cancelled'"]
        if sponsor_id:
            where.append("o.sponsor_user_id = %s")
            params.append(sponsor_id)
        if start_date:
            where.append("o.created_at >= %s")
            params.append(start_date)
        if end_date:
            where.append("o.created_at <= %s")
            params.append(end_date + " 23:59:59")
        where_clause = "WHERE " + " AND ".join(where) if where else ""

        if view == "detailed":
            cursor.execute(f"""
                SELECT
                    o.order_id,
                    o.created_at,
                    COALESCE(sp.company_name, su.username) AS sponsor_name,
                    u.username AS driver_username,
                    o.item_title,
                    o.points_cost,
                    o.status
                FROM Orders o
                JOIN Users su ON su.user_id = o.sponsor_user_id
                LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
                JOIN Users u ON u.user_id = o.driver_user_id
                {where_clause}
                ORDER BY sponsor_name, o.created_at DESC
            """, tuple(params))
        else:
            cursor.execute(f"""
                SELECT
                    COALESCE(sp.company_name, su.username) AS sponsor_name,
                    COUNT(*) AS total_orders,
                    SUM(o.points_cost) AS total_points,
                    MIN(o.created_at) AS first_order,
                    MAX(o.created_at) AS last_order
                FROM Orders o
                JOIN Users su ON su.user_id = o.sponsor_user_id
                LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
                {where_clause}
                GROUP BY o.sponsor_user_id, sponsor_name
                ORDER BY total_points DESC
            """, tuple(params))

        rows = cursor.fetchall()
        for row in rows:
            for k in row:
                if hasattr(row[k], 'isoformat'):
                    row[k] = row[k].isoformat()
                elif row[k] is not None and k in ('total_points', 'points_cost', 'total_orders'):
                    row[k] = int(row[k])
        return {"rows": rows, "view": view}
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/sales-by-driver")
def get_sales_by_driver_report(
    sponsor_id: int | None = None,
    driver_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    view: str = "summary",
    current_user: dict = Depends(require_role("admin")),
):
    """Admin: Sales by Driver report."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        params: list = []
        where = ["o.status != 'cancelled'"]
        if sponsor_id:
            where.append("o.sponsor_user_id = %s")
            params.append(sponsor_id)
        if driver_id:
            where.append("o.driver_user_id = %s")
            params.append(driver_id)
        if start_date:
            where.append("o.created_at >= %s")
            params.append(start_date)
        if end_date:
            where.append("o.created_at <= %s")
            params.append(end_date + " 23:59:59")
        where_clause = "WHERE " + " AND ".join(where) if where else ""

        if view == "detailed":
            cursor.execute(f"""
                SELECT
                    o.order_id,
                    o.created_at,
                    u.username AS driver_username,
                    COALESCE(sp.company_name, su.username) AS sponsor_name,
                    o.item_title,
                    o.points_cost,
                    o.status
                FROM Orders o
                JOIN Users u ON u.user_id = o.driver_user_id
                JOIN Users su ON su.user_id = o.sponsor_user_id
                LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
                {where_clause}
                ORDER BY driver_username, o.created_at DESC
            """, tuple(params))
        else:
            cursor.execute(f"""
                SELECT
                    u.username AS driver_username,
                    COALESCE(sp.company_name, su.username) AS sponsor_name,
                    COUNT(*) AS total_orders,
                    SUM(o.points_cost) AS total_points
                FROM Orders o
                JOIN Users u ON u.user_id = o.driver_user_id
                JOIN Users su ON su.user_id = o.sponsor_user_id
                LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
                {where_clause}
                GROUP BY o.driver_user_id, driver_username, o.sponsor_user_id, sponsor_name
                ORDER BY driver_username
            """, tuple(params))

        rows = cursor.fetchall()
        for row in rows:
            for k in row:
                if hasattr(row[k], 'isoformat'):
                    row[k] = row[k].isoformat()
                elif row[k] is not None and k in ('total_points', 'points_cost', 'total_orders'):
                    row[k] = int(row[k])
        return {"rows": rows, "view": view}
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/invoice")
def get_invoice_report(
    sponsor_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin: Invoice report per sponsor."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        params: list = []
        where = ["o.status != 'cancelled'"]
        if sponsor_id:
            where.append("o.sponsor_user_id = %s")
            params.append(sponsor_id)
        if start_date:
            where.append("o.created_at >= %s")
            params.append(start_date)
        if end_date:
            where.append("o.created_at <= %s")
            params.append(end_date + " 23:59:59")
        where_clause = "WHERE " + " AND ".join(where) if where else ""

        cursor.execute(f"""
            SELECT
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                su.email AS sponsor_email,
                u.username AS driver_username,
                COUNT(*) AS order_count,
                SUM(o.points_cost) AS total_points,
                ROUND(SUM(o.points_cost) * COALESCE(spr.dollar_per_point, 0.01), 2) AS fee_generated
            FROM Orders o
            JOIN Users su ON su.user_id = o.sponsor_user_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
            LEFT JOIN SponsorProfiles spr ON spr.user_id = o.sponsor_user_id
            JOIN Users u ON u.user_id = o.driver_user_id
            {where_clause}
            GROUP BY o.sponsor_user_id, sponsor_name, sponsor_email, o.driver_user_id, driver_username, spr.dollar_per_point
            ORDER BY sponsor_name, driver_username
        """, tuple(params))

        rows = cursor.fetchall()

        # Group by sponsor for invoice format
        invoices: dict = {}
        for row in rows:
            sname = row["sponsor_name"]
            if sname not in invoices:
                invoices[sname] = {
                    "sponsor_name": sname,
                    "sponsor_email": row["sponsor_email"],
                    "drivers": [],
                    "total_fee": 0.0,
                    "total_points": 0,
                }
            invoices[sname]["drivers"].append({
                "driver_username": row["driver_username"],
                "order_count": int(row["order_count"]),
                "total_points": int(row["total_points"]),
                "fee_generated": float(row["fee_generated"] or 0),
            })
            invoices[sname]["total_fee"] += float(row["fee_generated"] or 0)
            invoices[sname]["total_points"] += int(row["total_points"])

        return {"invoices": list(invoices.values())}
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/audit-log")
def get_audit_log_report(
    sponsor_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    category: str | None = None,
    limit: int = 500,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin: Audit log report with filters."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        params: list = []
        where = []
        if sponsor_id:
            where.append("al.sponsor_id = %s")
            params.append(sponsor_id)
        if start_date:
            where.append("al.date >= %s")
            params.append(start_date)
        if end_date:
            where.append("al.date <= %s")
            params.append(end_date + " 23:59:59")
        if category:
            where.append("al.category = %s")
            params.append(category)
        where_clause = "WHERE " + " AND ".join(where) if where else ""

        cursor.execute(f"""
            SELECT
                al.date,
                al.category,
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                al.driver_id,
                du.username AS driver_username,
                al.points_changed,
                al.reason,
                al.changed_by_user_id
            FROM audit_log al
            LEFT JOIN Users su ON su.user_id = al.sponsor_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = al.sponsor_id
            LEFT JOIN Users du ON du.user_id = al.driver_id
            {where_clause}
            ORDER BY al.date DESC
            LIMIT %s
        """, tuple(params) + (min(limit, 1000),))

        rows = cursor.fetchall()
        for row in rows:
            if row["date"]:
                row["date"] = row["date"].isoformat()
            if row["points_changed"] is not None:
                row["points_changed"] = int(row["points_changed"])
        return {"rows": rows}
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/sponsors")
def get_all_sponsors_list(current_user: dict = Depends(require_role("admin"))):
    """Get list of all sponsors for report filter dropdowns."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT u.user_id, COALESCE(sp.company_name, u.username) AS name
            FROM Users u
            LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id
            WHERE u.role = 'sponsor'
            ORDER BY name
        """)
        return {"sponsors": cursor.fetchall()}
    finally:
        cursor.close()
        conn.close()


@router.get("/reports/drivers")
def get_all_drivers_list(
    sponsor_id: int | None = None,
    current_user: dict = Depends(require_role("admin"))
):
    """Get list of drivers for report filter dropdowns."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        if sponsor_id:
            cursor.execute("""
                SELECT u.user_id, u.username
                FROM Users u
                JOIN SponsorDrivers sd ON sd.driver_user_id = u.user_id
                WHERE sd.sponsor_user_id = %s
                ORDER BY u.username
            """, (sponsor_id,))
        else:
            cursor.execute("""
                SELECT user_id, username FROM Users
                WHERE role = 'driver' ORDER BY username
            """)
        return {"drivers": cursor.fetchall()}
    finally:
        cursor.close()
        conn.close()

@router.get("/login-attempts")
def get_login_attempts(
    limit: int = 100,
    username: str | None = None,
    success: bool | None = None,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin views all login attempts to identify suspicious activity."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        capped_limit = min(max(limit, 1), 500)
        params: list[object] = []
        query = """
            SELECT
                la.audit_id,
                la.username,
                la.user_id,
                la.success,
                la.ip_address,
                la.user_agent,
                la.login_time
            FROM LoginAudit la
            WHERE 1=1
        """
        if username:
            query += " AND la.username LIKE %s"
            params.append(f"%{username}%")
        if success is not None:
            query += " AND la.success = %s"
            params.append(success)

        query += " ORDER BY la.login_time DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["login_time"]:
                row["login_time"] = row["login_time"].isoformat()
            row["success"] = bool(row["success"])
        return {"login_attempts": rows}
    finally:
        cursor.close()
        conn.close()

@router.get("/communication-logs", response_model=CommunicationLogResponse)
def get_communication_logs(
    driver_id: int | None = None,
    sponsor_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    keyword: str | None = None,
    limit: int = 100,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        capped_limit = min(max(limit, 1), 500)
        params: list[object] = []
        query = """
            SELECT
                cl.log_id,
                cl.created_at,
                cl.driver_user_id,
                COALESCE(
                    CONCAT(dp.first_name, ' ', dp.last_name),
                    du.username
                ) AS driver_name,
                cl.sponsor_user_id,
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                cl.sent_by_role,
                cl.message
            FROM CommunicationLogs cl
            JOIN Users du ON du.user_id = cl.driver_user_id
            LEFT JOIN Profiles dp ON dp.user_id = cl.driver_user_id
            JOIN Users su ON su.user_id = cl.sponsor_user_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = cl.sponsor_user_id
            WHERE 1=1
        """

        if driver_id is not None:
            query += " AND cl.driver_user_id = %s"
            params.append(driver_id)
        if sponsor_id is not None:
            query += " AND cl.sponsor_user_id = %s"
            params.append(sponsor_id)
        if date_from:
            query += " AND cl.created_at >= %s"
            params.append(date_from)
        if date_to:
            query += " AND cl.created_at <= %s"
            params.append(date_to)
        if keyword:
            query += " AND cl.message LIKE %s"
            params.append(f"%{keyword}%")

        query += " ORDER BY cl.created_at DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["created_at"]:
                row["created_at"] = row["created_at"].isoformat()

        return {"communication_logs": rows}
    finally:
        cursor.close()
        conn.close()


@router.get("/account-appeals", response_model=AccountAppealListResponse)
def list_account_appeals(
    status: str | None = None,
    limit: int = 200,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_account_appeals_table(cursor)
        capped_limit = min(max(limit, 1), 1000)
        params: list[object] = []
        query = """
            SELECT
                aa.appeal_id,
                aa.created_at,
                aa.user_id,
                u.username,
                aa.user_role,
                aa.account_status,
                aa.target_admin_user_id,
                ta.username AS target_admin_username,
                aa.message,
                aa.appeal_status,
                aa.admin_response,
                aa.reviewed_by_user_id,
                ru.username AS reviewed_by_username,
                aa.reviewed_at
            FROM AccountAppeals aa
            LEFT JOIN Users u ON u.user_id = aa.user_id
            LEFT JOIN Users ta ON ta.user_id = aa.target_admin_user_id
            LEFT JOIN Users ru ON ru.user_id = aa.reviewed_by_user_id
            WHERE 1=1
        """
        if status:
            query += " AND aa.appeal_status = %s"
            params.append(status)

        query += " ORDER BY aa.created_at DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row.get("created_at"):
                row["created_at"] = row["created_at"].isoformat()
            if row.get("reviewed_at"):
                row["reviewed_at"] = row["reviewed_at"].isoformat()
        return {"appeals": rows}
    finally:
        cursor.close()
        conn.close()


@router.post("/account-appeals/{appeal_id}/resolve")
def resolve_account_appeal(
    appeal_id: int,
    body: AccountAppealResolveRequest,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        ensure_account_appeals_table(cursor)
        status_value = (body.status or "resolved").strip().lower()
        if status_value not in {"resolved", "dismissed"}:
            raise HTTPException(status_code=422, detail="status must be 'resolved' or 'dismissed'")

        cursor.execute(
            """
            SELECT appeal_id, user_id, user_role, account_status, appeal_status
            FROM AccountAppeals
            WHERE appeal_id = %s
            """,
            (appeal_id,),
        )
        appeal = cursor.fetchone()
        if not appeal:
            raise HTTPException(status_code=404, detail="Appeal not found")

        user_id = int(appeal["user_id"])
        user_role = (appeal.get("user_role") or "").lower()
        cursor.execute("SELECT username, email FROM Users WHERE user_id = %s", (user_id,))
        appealed_user = cursor.fetchone()

        # Resolving an appeal should restore access for the specific appealed account.
        if status_value == "resolved":
            if user_role == "sponsor":
                cursor.execute(
                    """
                    INSERT INTO SponsorProfiles (user_id, account_status)
                    VALUES (%s, 'active')
                    ON DUPLICATE KEY UPDATE account_status = 'active'
                    """,
                    (user_id,),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                    VALUES (NOW(), 'account_status_change', %s, NULL, NULL, %s, %s)
                    """,
                    (user_id, "Resolved account appeal by admin", current_user["user_id"]),
                )
            elif user_role == "driver":
                cursor.execute(
                    """
                    INSERT INTO DriverProfiles (user_id, account_status)
                    VALUES (%s, 'active')
                    ON DUPLICATE KEY UPDATE account_status = 'active'
                    """,
                    (user_id,),
                )
                cursor.execute(
                    """
                    INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                    VALUES (NOW(), 'account_status_change', NULL, %s, NULL, %s, %s)
                    """,
                    (user_id, "Resolved account appeal by admin", current_user["user_id"]),
                )
            else:
                raise HTTPException(status_code=422, detail="Appeal role must be sponsor or driver")

        cursor.execute(
            """
            UPDATE AccountAppeals
            SET appeal_status = %s,
                admin_response = %s,
                reviewed_by_user_id = %s,
                reviewed_at = NOW()
            WHERE appeal_id = %s
            """,
            (status_value, body.admin_response, current_user["user_id"], appeal_id),
        )
        conn.commit()
        if appealed_user and appealed_user.get("email"):
            send_account_appeal_resolved_email(
                appealed_user["email"],
                appealed_user["username"],
                status_value,
                body.admin_response,
            )
        if status_value == "resolved":
            return {"message": f"Appeal {appeal_id} resolved and {user_role} account reactivated"}
        return {"message": f"Appeal {appeal_id} marked as {status_value}"}
    finally:
        cursor.close()
        conn.close()

@router.get("/driver-logs")
def get_driver_logs(
    driver_id: int | None = None,
    limit: int = 100,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin views all driver point logs for troubleshooting."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        capped_limit = min(max(limit, 1), 500)
        params: list[object] = []
        query = """
            SELECT
                al.date,
                al.category,
                al.driver_id,
                u.username AS driver_username,
                al.sponsor_id,
                COALESCE(sp.company_name, su.username) AS sponsor_name,
                al.points_changed,
                al.reason,
                al.changed_by_user_id,
                al.expires_at
            FROM audit_log al
            LEFT JOIN Users u ON u.user_id = al.driver_id
            LEFT JOIN Users su ON su.user_id = al.sponsor_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = al.sponsor_id
            WHERE al.category = 'point_change'
        """
        if driver_id:
            query += " AND al.driver_id = %s"
            params.append(driver_id)

        query += " ORDER BY al.date DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["date"]:
                row["date"] = row["date"].isoformat()
            if row["expires_at"]:
                row["expires_at"] = row["expires_at"].isoformat()
            if row["points_changed"] is not None:
                row["points_changed"] = int(row["points_changed"])
        return {"driver_logs": rows}
    finally:
        cursor.close()
        conn.close()

# ── Sponsor account-status management ──────────────────────────────────────

VALID_SPONSOR_TRANSITIONS: dict[str, set[str]] = {
    "active":   {"inactive", "banned"},
    "inactive": {"active", "banned"},
    "banned":   {"active"},
}

@router.get("/sponsors", response_model=list[SponsorAdminRow])
def list_sponsors_admin(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                u.user_id,
                u.username,
                u.email,
                sp.company_name,
                COALESCE(NULLIF(sp.account_status, ''), 'active') AS account_status
            FROM Users u
            LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id
            WHERE u.role = 'sponsor'
            ORDER BY u.username
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@router.post("/sponsors/{user_id}/status")
def update_sponsor_status(
    user_id: int,
    body: AccountStatusChangeRequest,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT u.user_id, u.username, u.email, COALESCE(NULLIF(sp.account_status, ''), 'active') AS account_status, sp.company_name "
            "FROM Users u LEFT JOIN SponsorProfiles sp ON sp.user_id = u.user_id "
            "WHERE u.user_id = %s AND u.role = 'sponsor'",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sponsor not found")

        current_status = row["account_status"]
        new_status = body.new_status

        if new_status == current_status:
            raise HTTPException(status_code=409, detail=f"Sponsor is already {current_status}")

        allowed = VALID_SPONSOR_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Cannot transition sponsor from '{current_status}' to '{new_status}'",
            )

        cursor.execute(
            "INSERT INTO SponsorProfiles (user_id, account_status) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE account_status = VALUES(account_status)",
            (user_id, new_status),
        )
        cursor.execute(
            """
            INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES (NOW(), 'account_status_change', %s, NULL, NULL, %s, %s)
            """,
            (user_id, body.reason, current_user["user_id"]),
        )
        conn.commit()

        if new_status == "inactive":
            send_sponsor_account_deactivated_email(
                row["email"], row["username"], row["company_name"], body.reason
            )
        elif new_status == "banned":
            send_sponsor_account_banned_email(
                row["email"], row["username"], row["company_name"], body.reason
            )

        return {"message": f"Sponsor status updated to '{new_status}'", "new_status": new_status}
    finally:
        cursor.close()
        conn.close()


# ── Driver account-status management ────────────────────────────────────────

VALID_DRIVER_TRANSITIONS: dict[str, set[str]] = {
    "active":   {"inactive", "banned"},
    "inactive": {"active", "banned"},
    "banned":   {"active"},
}

@router.get("/drivers", response_model=list[DriverAdminRow])
def list_drivers_admin(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT
                u.user_id,
                u.username,
                u.email,
                p.first_name,
                p.last_name,
                COALESCE(NULLIF(dp.account_status, ''), 'active') AS account_status
            FROM Users u
            LEFT JOIN Profiles p ON p.user_id = u.user_id
            LEFT JOIN DriverProfiles dp ON dp.user_id = u.user_id
            WHERE u.role = 'driver'
            ORDER BY u.username
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


@router.post("/drivers/{user_id}/status")
def update_driver_status(
    user_id: int,
    body: AccountStatusChangeRequest,
    current_user: dict = Depends(require_role("admin")),
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT u.user_id, u.username, COALESCE(NULLIF(dp.account_status, ''), 'active') AS account_status "
            "FROM Users u LEFT JOIN DriverProfiles dp ON dp.user_id = u.user_id "
            "WHERE u.user_id = %s AND u.role = 'driver'",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Driver not found")

        current_status = row["account_status"]
        new_status = body.new_status

        if new_status == current_status:
            raise HTTPException(status_code=409, detail=f"Driver is already {current_status}")

        allowed = VALID_DRIVER_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Cannot transition driver from '{current_status}' to '{new_status}'",
            )

        cursor.execute(
            "INSERT INTO DriverProfiles (user_id, account_status) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE account_status = VALUES(account_status)",
            (user_id, new_status),
        )
        cursor.execute(
            """
            INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES (NOW(), 'account_status_change', NULL, %s, NULL, %s, %s)
            """,
            (user_id, body.reason, current_user["user_id"]),
        )
        conn.commit()

        if new_status == "inactive":
            cursor.execute("SELECT email, username FROM Users WHERE user_id = %s", (user_id,))
            driver_user = cursor.fetchone()
            if driver_user:
                send_driver_account_deactivated_email(
                    driver_user["email"],
                    driver_user["username"],
                    body.reason,
                    "an administrator",
                )
        elif new_status == "banned":
            cursor.execute("SELECT email, username FROM Users WHERE user_id = %s", (user_id,))
            driver_user = cursor.fetchone()
            if driver_user:
                send_driver_account_banned_email(
                    driver_user["email"],
                    driver_user["username"],
                    body.reason,
                    "an administrator",
                )

        return {"message": f"Driver status updated to '{new_status}'", "new_status": new_status}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        if "account_status" in str(exc) and ("incorrect" in str(exc).lower() or "truncated" in str(exc).lower()):
            raise HTTPException(
                status_code=500,
                detail="Driver account status schema does not support this value yet. Run the latest migrations.",
            )
        raise
    finally:
        cursor.close()
        conn.close()


# Admin- delete a user
@router.delete("/users/{username}")
def delete_user(username: str, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if user exists
        cursor.execute("SELECT user_id, role, email, username FROM Users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["user_id"]

        if user.get("email"):
            send_removed_by_admin_email(
                user["email"],
                user["username"],
                user.get("role", "user"),
            )

        # Delete child records first
        cursor.execute("DELETE FROM SponsorDrivers WHERE driver_user_id = %s OR sponsor_user_id = %s", (user_id, user_id))
        cursor.execute("DELETE FROM DriverApplications WHERE driver_user_id = %s OR sponsor_user_id = %s", (user_id, user_id))
        cursor.execute("DELETE FROM DriverProfiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM SponsorProfiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM Profiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM LoginAudit WHERE user_id = %s", (user_id,))

        # Finally delete the user
        cursor.execute("DELETE FROM Users WHERE user_id = %s", (user_id,))

        conn.commit()
        return {"message": f"User '{username}' deleted successfully."}
    finally:
        cursor.close()
        conn.close()
