from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from shared.db import get_connection
from auth.auth import get_current_user

from schemas.points import PointChangeRequest, SponsorSettings, PointChangeResponse

router = APIRouter()

# Add verify_admin function
def verify_admin(current_user: dict = Depends(get_current_user)):
    """Verify user is an admin"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ============= SPONSOR ENDPOINTS =============

@router.get("/sponsor/settings")
async def get_sponsor_settings(
    current_user: dict = Depends(get_current_user)
):
    """Get sponsor settings including negative points setting"""
    
    sponsor_id = current_user.get('sponsor_id')
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT allow_negative_points 
            FROM SponsorProfiles 
            WHERE sponsor_id = %s
        """, (sponsor_id,))
        
        settings = cursor.fetchone()
        if not settings:
            return {"allow_negative_points": False}
        
        return settings
        
    finally:
        cursor.close()
        conn.close()

# Post Endpoints

@router.post("/sponsor/settings")
async def update_sponsor_settings(
    settings: SponsorSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update sponsor settings"""
    
    sponsor_id = current_user.get('sponsor_id')
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE SponsorProfiles 
            SET allow_negative_points = %s
            WHERE sponsor_id = %s
        """, (settings.allow_negative_points, sponsor_id))
        
        conn.commit()
        return {"success": True, "settings": settings}
        
    finally:
        cursor.close()
        conn.close()


@router.post("/sponsor/points/add", response_model=PointChangeResponse)
async def add_driver_points(
    request: PointChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Sponsor adds points to a driver (reason required)"""
    # Note: Reason and positive point validation are now handled by the PointChangeRequest schema!
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Verify driver belongs to this sponsor
        cursor.execute("SELECT sponsor_id FROM SponsorDrivers WHERE driver_id = %s", (request.driver_id,))
        driver = cursor.fetchone()
        
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        sponsor_id = current_user.get('sponsor_id')
        if driver['sponsor_id'] != sponsor_id:
            raise HTTPException(status_code=403, detail="Driver does not belong to your organization")
        
        # Update driver points
        cursor.execute("""
            UPDATE SponsorDrivers 
            SET total_points = total_points + %s 
            WHERE driver_id = %s
        """, (request.points, request.driver_id))
        
        # Log the point change automatically
        cursor.execute("""
            INSERT INTO audit_log 
            (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES ('point_change', %s, %s, %s, %s, %s, %s)
        """, (datetime.now(), sponsor_id, request.driver_id, request.points, request.reason, current_user['user_id']))
        
        conn.commit()
        
        # Get updated point total
        cursor.execute("SELECT total_points FROM SponsorDrivers WHERE driver_id = %s", (request.driver_id,))
        new_total = cursor.fetchone()['total_points']
        
        return {
            "success": True, 
            "message": f"Added {request.points} points",
            "new_total": new_total
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@router.post("/sponsor/points/deduct", response_model=PointChangeResponse)
async def deduct_driver_points(
    request: PointChangeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Sponsor deducts points from a driver (reason required)"""
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        sponsor_id = current_user.get('sponsor_id')
        
        # Get sponsor settings and driver info
        cursor.execute("""
            SELECT s.allow_negative_points, d.total_points
            FROM SponsorProfiles s
            JOIN SponsorDrivers d ON d.sponsor_id = s.sponsor_id
            WHERE d.driver_id = %s AND s.sponsor_id = %s
        """, (request.driver_id, sponsor_id))
        
        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Driver not found or unauthorized")
        
        allow_negative = result['allow_negative_points']
        current_points = result['total_points']
        
        # Check if deduction would make points negative
        if not allow_negative and (current_points - request.points) < 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient points. Balance would be {current_points - request.points}."
            )
        
        # Update driver points (deduct)
        cursor.execute("""
            UPDATE SponsorDrivers 
            SET total_points = total_points - %s 
            WHERE driver_id = %s
        """, (request.points, request.driver_id))
        
        # Log the audit trail
        cursor.execute("""
            INSERT INTO audit_log 
            (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES ('point_change', %s, %s, %s, %s, %s, %s)
        """, (datetime.now(), sponsor_id, request.driver_id, -request.points, request.reason, current_user['user_id']))
        
        conn.commit()
        
        cursor.execute("SELECT total_points FROM SponsorDrivers WHERE driver_id = %s", (request.driver_id,))
        new_total = cursor.fetchone()['total_points']
        
        return {
            "success": True, 
            "message": f"Deducted {request.points} points",
            "new_total": new_total
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@router.get("/sponsor/drivers")
async def get_sponsor_drivers(
    current_user: dict = Depends(get_current_user)
):
    """Get all drivers for the current sponsor"""
    sponsor_id = current_user.get('sponsor_id')
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                sd.driver_id,
                dp.first_name,
                dp.last_name,
                sd.total_points
            FROM SponsorDrivers sd
            JOIN DriverProfiles dp ON sd.driver_id = dp.driver_id
            WHERE sd.sponsor_id = %s
            ORDER BY dp.last_name, dp.first_name
        """, (sponsor_id,))
        
        drivers = cursor.fetchall()
        return {"drivers": drivers}
    finally:
        cursor.close()
        conn.close()


@router.get("/sponsor/drivers/{driver_id}/points")
async def get_driver_points(
    driver_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get current point balance for a driver"""
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                sd.driver_id, 
                dp.first_name, 
                dp.last_name, 
                sd.total_points, 
                sd.sponsor_id
            FROM SponsorDrivers sd
            JOIN DriverProfiles dp ON sd.driver_id = dp.driver_id
            WHERE sd.driver_id = %s
        """, (driver_id,))
        
        driver = cursor.fetchone()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        
        sponsor_id = current_user.get('sponsor_id')
        if driver['sponsor_id'] != sponsor_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        return driver
        
    finally:
        cursor.close()
        conn.close()


# ============= DRIVER ENDPOINTS =============

@router.get("/driver/points/history")
async def get_driver_point_history(
    current_user: dict = Depends(get_current_user)
):
    """Get driver's complete point history"""
    
    driver_id = current_user.get('driver_id')
    if not driver_id:
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get current total
        cursor.execute("""
            SELECT total_points FROM SponsorDrivers WHERE driver_id = %s
        """, (driver_id,))
        current = cursor.fetchone()
        
        # Get all point changes
        cursor.execute("""
            SELECT 
                date,
                points_changed,
                reason,
                changed_by_user_id
            FROM audit_log
            WHERE category = 'point_change' 
            AND driver_id = %s
            ORDER BY date DESC
        """, (driver_id,))
        
        history = cursor.fetchall()
        
        return {
            "current_points": current['total_points'] if current else 0,
            "history": history
        }
        
    finally:
        cursor.close()
        conn.close()


@router.get("/driver/points/history-monthly")
async def get_driver_point_history_monthly(
    current_user: dict = Depends(get_current_user)
):
    """Get driver's point history grouped by month"""
    
    driver_id = current_user.get('driver_id')
    if not driver_id:
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                DATE_FORMAT(date, '%Y-%m') as month,
                DATE_FORMAT(date, '%M %Y') as month_name,
                SUM(CASE WHEN points_changed > 0 THEN points_changed ELSE 0 END) as points_earned,
                SUM(CASE WHEN points_changed < 0 THEN ABS(points_changed) ELSE 0 END) as points_deducted,
                SUM(points_changed) as net_change,
                COUNT(*) as transaction_count
            FROM audit_log
            WHERE category = 'point_change' 
            AND driver_id = %s
            GROUP BY DATE_FORMAT(date, '%Y-%m')
            ORDER BY month DESC
        """, (driver_id,))
        
        monthly_history = cursor.fetchall()
        
        return {"monthly_history": monthly_history}
        
    finally:
        cursor.close()
        conn.close()


@router.get("/driver/points/month/{year_month}")
async def get_driver_point_month_details(
    year_month: str,  # Format: YYYY-MM
    current_user: dict = Depends(get_current_user)
):
    """Get detailed transactions for a specific month"""
    
    driver_id = current_user.get('driver_id')
    if not driver_id:
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                date,
                points_changed,
                reason
            FROM audit_log
            WHERE category = 'point_change' 
            AND driver_id = %s
            AND DATE_FORMAT(date, '%Y-%m') = %s
            ORDER BY date DESC
        """, (driver_id, year_month))
        
        transactions = cursor.fetchall()
        
        return {"transactions": transactions}
        
    finally:
        cursor.close()
        conn.close()


# ============= ADMIN ENDPOINTS =============

@router.post("/admin/point-expiration/settings")
async def set_point_expiration_policy(
    request: ExpirationPolicyRequest,
    current_user: dict = Depends(verify_admin)
):
    """Admin sets automatic point expiration policy for a sponsor"""
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO point_expiration_settings 
            (sponsor_id, expiration_months, auto_expire_enabled, updated_by, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            expiration_months = %s,
            auto_expire_enabled = %s,
            updated_by = %s,
            updated_at = %s
        """, (
            request.sponsor_id, request.expiration_months, request.auto_expire, 
            current_user['user_id'], datetime.now(),
            request.expiration_months, request.auto_expire, 
            current_user['user_id'], datetime.now()
        ))
        
        conn.commit()
        return {
            "success": True, 
            "message": "Point expiration policy updated",
            "policy": {
                "sponsor_id": request.sponsor_id,
                "expiration_months": request.expiration_months,
                "auto_expire_enabled": request.auto_expire
            }
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@router.get("/admin/point-expiration/settings")
async def get_all_expiration_policies(
    current_user: dict = Depends(verify_admin)
):
    """Get all point expiration policies"""
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT 
                pes.*,
                sp.company_name
            FROM point_expiration_settings pes
            JOIN SponsorProfiles sp ON pes.sponsor_id = sp.sponsor_id
            ORDER BY sp.company_name
        """)
        
        policies = cursor.fetchall()
        return {"policies": policies}
        
    finally:
        cursor.close()
        conn.close()


@router.post("/admin/point-expiration/run")
async def run_point_expiration(
    current_user: dict = Depends(verify_admin)
):
    """Manually trigger point expiration process"""
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get all active expiration policies
        cursor.execute("""
            SELECT sponsor_id, expiration_months 
            FROM point_expiration_settings 
            WHERE auto_expire_enabled = TRUE
        """)
        policies = cursor.fetchall()
        
        expired_records = []
        
        for policy in policies:
            expiration_date = datetime.now() - timedelta(days=30 * policy['expiration_months'])
            
            # Find drivers with points to expire
            cursor.execute("""
                SELECT 
                    al.driver_id,
                    dp.first_name,
                    dp.last_name,
                    sd.total_points,
                    SUM(al.points_changed) as expired_points
                FROM audit_log al
                JOIN SponsorDrivers sd ON al.driver_id = sd.driver_id
                JOIN DriverProfiles dp ON sd.driver_id = dp.driver_id
                WHERE al.category = 'point_change'
                AND al.sponsor_id = %s
                AND al.date < %s
                AND al.points_changed > 0
                AND sd.total_points > 0
                GROUP BY al.driver_id, dp.first_name, dp.last_name, sd.total_points
                HAVING expired_points > 0
            """, (policy['sponsor_id'], expiration_date))
            
            drivers_to_expire = cursor.fetchall()
            
            for driver in drivers_to_expire:
                points_to_deduct = min(driver['expired_points'], driver['total_points'])
                
                if points_to_deduct > 0:
                    # Deduct expired points
                    cursor.execute("""
                        UPDATE SponsorDrivers 
                        SET total_points = GREATEST(0, total_points - %s)
                        WHERE driver_id = %s
                    """, (points_to_deduct, driver['driver_id']))
                    
                    # Log the expiration
                    cursor.execute("""
                        INSERT INTO audit_log 
                        (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
                        VALUES ('point_change', %s, %s, %s, %s, %s, %s)
                    """, (
                        datetime.now(), 
                        policy['sponsor_id'], 
                        driver['driver_id'],
                        -points_to_deduct,
                        f"Automatic expiration - points older than {policy['expiration_months']} months",
                        current_user['user_id']
                    ))
                    
                    expired_records.append({
                        "driver_id": driver['driver_id'],
                        "driver_name": f"{driver['first_name']} {driver['last_name']}",
                        "points_expired": points_to_deduct
                    })
        
        conn.commit()
        return {
            "success": True, 
            "expired_count": len(expired_records),
            "details": expired_records
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
