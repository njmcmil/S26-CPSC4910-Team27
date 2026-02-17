# shared/tasks.py
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from shared.db import get_connection

scheduler = BackgroundScheduler()

def award_daily_points():
    """
    Award daily points to all drivers based on their sponsor's daily points setting.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Get all drivers with their sponsor's daily points setting
        cursor.execute("""
            SELECT sd.driver_id, sd.total_points, sd.sponsor_id, sp.daily_points_awarded
            FROM SponsorDrivers sd
            JOIN SponsorProfiles sp ON sd.sponsor_id = sp.sponsor_id
        """)
        drivers = cursor.fetchall()

        for d in drivers:
            daily_points = d['daily_points_awarded'] or 10  # fallback to 10 if not set
            if daily_points <= 0:
                continue  # skip if sponsor has 0 daily points

            # Update driver points
            cursor.execute(
                "UPDATE SponsorDrivers SET total_points = total_points + %s WHERE driver_id = %s",
                (daily_points, d['driver_id'])
            )

            # Log in audit
            cursor.execute("""
                INSERT INTO audit_log
                (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                VALUES ('point_change', %s, %s, %s, %s, %s, %s)
            """, (
                datetime.now(),
                d['sponsor_id'],
                d['driver_id'],
                daily_points,
                "Daily recurring points",
                0  # system user
            ))

        conn.commit()
    finally:
        cursor.close()
        conn.close()


# Schedule daily at midnight
scheduler.add_job(award_daily_points, 'interval', days=1)
