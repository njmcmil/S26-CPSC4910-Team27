# users/admin_routes.py

# Admin Control Panel
# allows users with admin role to overlook everyone, and if necessary wipe an account from the system
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from shared.db import get_connection
from auth.auth import require_role
from schemas.admin import AuditLogResponse, CommunicationLogResponse, DriverSponsorRow, LoginAuditResponse, RedemptionReportResponse

router = APIRouter(prefix="/admin", tags=["admin"])

# Allows admin to see big picture
@router.get("/users")
def list_all_users(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, username, role, email FROM Users")
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

def get_sponsors_for_driver(driver_id: int, cursor):
    """Return all sponsors linked to a given driver via SponsorDrivers."""
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
        if role:
            query += " WHERE u.role = %s"
            params.append(role)

        query += " ORDER BY la.login_time DESC LIMIT %s"
        params.append(capped_limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        for row in rows:
            if row["login_time"]:
                row["login_time"] = row["login_time"].isoformat()
            row["success"] = bool(row["success"])

        return {"login_audit": rows}
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

# Admin- delete a user
@router.delete("/users/{username}")
def delete_user(username: str, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if user exists
        cursor.execute("SELECT user_id FROM Users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["user_id"]

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
