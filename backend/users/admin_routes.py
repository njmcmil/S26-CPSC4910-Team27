# users/admin_routes.py

# Admin Control Panel
# allows users with admin role to overlook everyone, and if necessary wipe an account from the system
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from shared.db import get_connection
from auth.auth import require_role
from schemas.admin import AuditLogResponse, LoginAuditResponse, RedemptionReportResponse

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
        SELECT u.user_id AS id, COALESCE(sp.company_name, u.username) AS name
        FROM SponsorDrivers sd
        JOIN Users u ON sd.sponsor_user_id = u.user_id
        LEFT JOIN SponsorProfiles sp ON u.user_id = sp.user_id
        WHERE sd.driver_user_id = %s
        """,
        (driver_id,),
    )
    return cursor.fetchall()


@router.get("/drivers/{driver_id}/sponsors")
def list_driver_sponsors(driver_id: int, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Verify the driver exists
        cursor.execute("SELECT user_id FROM Users WHERE user_id = %s AND role = 'driver'", (driver_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Driver not found")
        return get_sponsors_for_driver(driver_id, cursor)
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
