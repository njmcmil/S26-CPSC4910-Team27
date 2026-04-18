from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from shared.db import get_connection
from users.email_service import send_order_success_email

scheduler = BackgroundScheduler()

def award_daily_points():
    """
    Award recurring daily points to active sponsor-driver relationships.

    The current schema stores sponsor settings by sponsor user ID, so we
    compute a simple recurring award using a 10-point base scaled by the
    sponsor's earn_rate.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Get all active sponsor-driver relationships and the sponsor reward defaults.
        cursor.execute("""
            SELECT
                sd.sponsor_driver_id,
                sd.driver_user_id,
                sd.sponsor_user_id,
                COALESCE(sp.earn_rate, 1.0) AS earn_rate
            FROM SponsorDrivers sd
            LEFT JOIN SponsorProfiles sp ON sd.sponsor_user_id = sp.user_id
        """)
        drivers = cursor.fetchall()

        for d in drivers:
            earn_rate = float(d.get("earn_rate") or 1.0)
            daily_points = max(int(round(10 * earn_rate)), 0)
            if daily_points <= 0:
                continue

            cursor.execute(
                """
                UPDATE SponsorDrivers
                SET total_points = total_points + %s
                WHERE sponsor_driver_id = %s
                """,
                (daily_points, d["sponsor_driver_id"])
            )

            cursor.execute("""
                INSERT INTO audit_log
                (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                VALUES ('point_change', %s, %s, %s, %s, %s, %s)
            """, (
                datetime.now(),
                d["sponsor_user_id"],
                d["driver_user_id"],
                daily_points,
                "Daily recurring points",
                0  # system user
            ))

        conn.commit()
    finally:
        cursor.close()
        conn.close()


def notify_successful_orders():
    """Promote eligible pending orders to shipped and notify the driver once."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                o.order_id,
                o.driver_user_id,
                o.item_title,
                o.points_cost,
                o.created_at,
                o.purchase_ip_address,
                o.purchase_device_name,
                o.purchase_browser_name,
                o.purchase_os_name,
                u.username,
                u.email,
                COALESCE(sp.order_success_delay_minutes, 60) AS order_success_delay_minutes
            FROM Orders o
            JOIN Users u ON u.user_id = o.driver_user_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = o.sponsor_user_id
            WHERE o.status = 'pending'
            """
        )
        orders = cursor.fetchall()
        now = datetime.utcnow()

        for order in orders:
            created_at = order["created_at"]
            delay_minutes = order["order_success_delay_minutes"] or 60
            if not created_at:
                continue
            if (now - created_at).total_seconds() < delay_minutes * 60:
                continue

            cursor.execute(
                "SELECT orders_email_enabled FROM NotificationPreferences WHERE user_id = %s",
                (order["driver_user_id"],)
            )
            pref_row = cursor.fetchone()
            orders_email_enabled = True if not pref_row else bool(pref_row["orders_email_enabled"])

            cursor.execute(
                "UPDATE Orders SET status = 'shipped', updated_at = %s WHERE order_id = %s",
                (now, order["order_id"])
            )

            if orders_email_enabled and order.get("email"):
                send_order_success_email(
                    to_email=order["email"],
                    username=order["username"],
                    item_title=order["item_title"],
                    points_cost=order["points_cost"],
                    placed_at=created_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
                    purchase_ip_address=order.get("purchase_ip_address") or "Unknown",
                    purchase_device_name=order.get("purchase_device_name") or "Unknown Device",
                    purchase_browser_name=order.get("purchase_browser_name") or "Unknown Browser",
                    purchase_os_name=order.get("purchase_os_name") or "Unknown OS",
                )

        conn.commit()
    finally:
        cursor.close()
        conn.close()

def check_low_stock_saved_products():
    """Story 5492: notify drivers when a saved product drops below 3 in stock."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Find saved products with stock < 3 that haven't been notified yet
        cursor.execute(
            """
            SELECT sp.id, sp.driver_user_id, sp.item_id, sc.stock_quantity, sc.title
            FROM SavedProducts sp
            JOIN SponsorCatalog sc
              ON sc.item_id = sp.item_id AND sc.sponsor_user_id = sp.sponsor_user_id
            WHERE sc.stock_quantity < 3 AND sp.notified_low_stock = FALSE
            """
        )
        low_stock_rows = cursor.fetchall()

        for row in low_stock_rows:
            qty = row["stock_quantity"]
            msg = (
                f"Low stock alert: '{row['title']}' has only {qty} left in stock. "
                "Order soon before it sells out!"
            )
            cursor.execute(
                "INSERT INTO Notifications (user_id, message) VALUES (%s, %s)",
                (row["driver_user_id"], msg)
            )
            cursor.execute(
                "UPDATE SavedProducts SET notified_low_stock = TRUE WHERE id = %s",
                (row["id"],)
            )

        # Reset flag for saved products whose stock has recovered to >= 3
        cursor.execute(
            """
            UPDATE SavedProducts sp
            JOIN SponsorCatalog sc
              ON sc.item_id = sp.item_id AND sc.sponsor_user_id = sp.sponsor_user_id
            SET sp.notified_low_stock = FALSE
            WHERE sc.stock_quantity >= 3 AND sp.notified_low_stock = TRUE
            """
        )

        conn.commit()
    finally:
        cursor.close()
        conn.close()

# Schedule daily at midnight
scheduler.add_job(award_daily_points, 'interval', days=1)
scheduler.add_job(notify_successful_orders, 'interval', minutes=1)
scheduler.add_job(check_low_stock_saved_products, 'interval', minutes=5)
