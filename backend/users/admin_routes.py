# users/admin_routes.py

# Admin Control Panel
# allows users with admin role to overlook everyone, and if necessary wipe an account from the system
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from shared.db import get_connection
from auth.auth import require_role
from schemas.admin import RedemptionReportResponse

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
