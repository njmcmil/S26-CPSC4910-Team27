"""
sponsor_profile.py
------------------
Purpose:
    Manage sponsor user profiles

Responsibilities:
    - Fetch sponsor profile
    - Update sponsor profile
"""

# Sponsor Profile Manager
# Handles data for Sponsors...pulls data from Users, Profiles, and SponsorProfiles

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from datetime import datetime
from auth.auth import get_current_user, hash_password, require_role
from shared.db import get_connection
from shared.utils import validate_password
from users.email_service import (
    send_driver_account_banned_email,
    send_driver_account_deactivated_email,
    send_driver_application_rejection_email,
    send_driver_application_approval_email,
    send_dropped_by_sponsor_email,
    send_sponsor_account_created_email,
)
from typing import List
import secrets
import string
from pydantic import BaseModel

from schemas.sponsor import SponsorProfile, CreateSponsorProfileRequest, UpdateSponsorProfileRequest, DriverApplication, RejectDriverApplicationRequest, SponsorDriver, DriverStatusChange, SponsorUserActionLog


router = APIRouter(prefix="/sponsor", tags=["sponsor-profile"])

VALID_DRIVER_ACCOUNT_TRANSITIONS: dict[str, set[str]] = {
    "active": {"inactive", "banned"},
    "inactive": {"active", "banned"},
    "banned": {"active"},
}


class DriverAccountStatusChangeRequest(BaseModel):
    new_status: str
    reason: str | None = None


class CreateSponsorUserRequest(BaseModel):
    username: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    password: str


def ensure_sponsor_user_links_table(cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS SponsorUserLinks (
            sponsor_user_id INT PRIMARY KEY,
            sponsor_owner_user_id INT NOT NULL,
            created_by_user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sponsor_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (sponsor_owner_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
            FOREIGN KEY (created_by_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
            INDEX idx_owner_user (sponsor_owner_user_id)
        )
        """
    )


#=============
# Endpoints
#=============

# allows a logged-in sponsor to see their profile data
@router.get("/profile", response_model=SponsorProfile)
def get_sponsor_profile(current_user: dict = Depends(require_role("sponsor"))):
    """
    Fetch authenticated sponsor's profile.
    
    Returns personal, company, and contact information.
    """
    user_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get sponsor profile
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.email,
                   p.first_name, p.last_name, p.phone_number,
                   p.profile_picture_url, p.bio, p.created_at, p.updated_at,
                   s.company_name, s.company_address, s.company_city, s.company_state, s.company_zip,
                   s.industry, s.contact_person_name, s.contact_person_phone, s.total_points_allocated
            FROM Users u
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            LEFT JOIN SponsorProfiles s ON u.user_id = s.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return SponsorProfile(
            user_id=row["user_id"],
            username=row["username"],
            email=row["email"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            phone_number=row.get("phone_number"),
            company_name=row.get("company_name"),
            company_address=row.get("company_address"),
            company_city=row.get("company_city"),
            company_state=row.get("company_state"),
            company_zip=row.get("company_zip"),
            industry=row.get("industry"),
            contact_person_name=row.get("contact_person_name"),
            contact_person_phone=row.get("contact_person_phone"),
            profile_picture_url=row.get("profile_picture_url"),
            bio=row.get("bio"),
            total_points_allocated=row.get("total_points_allocated") or 0,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        )
    finally:
        cursor.close()
        conn.close()



# Admin-only tool. Sponsors created by an admin
@router.post("/admin/create", response_model=SponsorProfile)
def create_sponsor_profile(
    request: CreateSponsorProfileRequest,
    current_user: dict = Depends(require_role("admin"))
):
    """
    Admin creates a new sponsor profile.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Create a valid login credential for the sponsor account.
        temp_password = "".join(
            [
                secrets.choice(string.ascii_lowercase),
                secrets.choice(string.ascii_uppercase),
                secrets.choice(string.digits),
                secrets.choice("!@#$%^&*()"),
            ]
            + [secrets.choice(string.ascii_letters + string.digits + "!@#$%^&*()") for _ in range(8)]
        )
        password_hash = hash_password(temp_password)
        cursor.execute(
            """
            INSERT INTO Users (username, password_hash, role, email)
            VALUES (%s, %s, 'sponsor', %s)
            """,
            (request.username, password_hash, str(request.email)),
        )
        user_id = cursor.lastrowid

        # Create profile details for the newly created sponsor user.
        cursor.execute(
            """
            INSERT INTO Profiles (user_id, first_name, last_name, phone_number, profile_picture_url, bio)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                phone_number = VALUES(phone_number),
                profile_picture_url = VALUES(profile_picture_url),
                bio = VALUES(bio)
            """,
            (
                user_id,
                request.first_name,
                request.last_name,
                request.phone_number,
                request.profile_picture_url,
                request.bio,
            ),
        )

        # Ensure sponsor profile fields are updated with admin-provided data.
        cursor.execute(
            """
            INSERT INTO SponsorProfiles
                (user_id, company_name, company_address, company_city, company_state, company_zip,
                 industry, contact_person_name, contact_person_phone, total_points_allocated,
                 dollar_per_point, earn_rate, expiration_days, max_points_per_day, max_points_per_month)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0,
                    0.01, 1.00, NULL, NULL, NULL)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                company_address = VALUES(company_address),
                company_city = VALUES(company_city),
                company_state = VALUES(company_state),
                company_zip = VALUES(company_zip),
                industry = VALUES(industry),
                contact_person_name = VALUES(contact_person_name),
                contact_person_phone = VALUES(contact_person_phone)
            """,
            (
                user_id,
                request.company_name,
                request.company_address,
                request.company_city,
                request.company_state,
                request.company_zip,
                request.industry,
                request.contact_person_name,
                request.contact_person_phone,
            ),
        )

        conn.commit()

        # 5. Fetch and return newly created profile
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.email,
                   p.first_name, p.last_name, p.phone_number, p.profile_picture_url, p.bio,
                   s.company_name, s.company_address, s.company_city, s.company_state, s.company_zip,
                   s.industry, s.contact_person_name, s.contact_person_phone, s.total_points_allocated,
                   p.created_at, p.updated_at
            FROM Users u
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            LEFT JOIN SponsorProfiles s ON u.user_id = s.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )

        row = cursor.fetchone()
        if row and row.get("email"):
            send_sponsor_account_created_email(
                row["email"],
                row["username"],
                temp_password,
            )
        return SponsorProfile(
            user_id=row["user_id"],
            username=row["username"],
            email=row["email"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            phone_number=row.get("phone_number"),
            company_name=row.get("company_name"),
            company_address=row.get("company_address"),
            company_city=row.get("company_city"),
            company_state=row.get("company_state"),
            company_zip=row.get("company_zip"),
            industry=row.get("industry"),
            contact_person_name=row.get("contact_person_name"),
            contact_person_phone=row.get("contact_person_phone"),
            profile_picture_url=row.get("profile_picture_url"),
            bio=row.get("bio"),
            total_points_allocated=row.get("total_points_allocated") or 0,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        )

    except Exception as exc:
        conn.rollback()
        if "Duplicate entry" in str(exc):
            raise HTTPException(status_code=400, detail="Username or email already exists")
        raise
    finally:
        cursor.close()
        conn.close()



# Allows the sponsor to update their own company details
@router.put("/profile", response_model=SponsorProfile)
def update_sponsor_profile(
    request: UpdateSponsorProfileRequest,
    current_user: dict = Depends(require_role("sponsor"))
):
    """
    Update authenticated sponsor's profile.
    
    Updates personal and company information.
    """
    user_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Ensure Profiles record exists
        cursor.execute("SELECT profile_id FROM Profiles WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO Profiles (user_id) VALUES (%s)",
                (user_id,)
            )
            conn.commit()
        
        # Update Profiles table
        profile_updates = []
        profile_values = []
        
        if request.first_name is not None:
            profile_updates.append("first_name = %s")
            profile_values.append(request.first_name)
        if request.last_name is not None:
            profile_updates.append("last_name = %s")
            profile_values.append(request.last_name)
        if request.phone_number is not None:
            profile_updates.append("phone_number = %s")
            profile_values.append(request.phone_number)
        if request.profile_picture_url is not None:
            profile_updates.append("profile_picture_url = %s")
            profile_values.append(request.profile_picture_url)
        if request.bio is not None:
            profile_updates.append("bio = %s")
            profile_values.append(request.bio)
        
        if profile_updates:
            profile_values.append(user_id)
            cursor.execute(
                f"UPDATE Profiles SET {', '.join(profile_updates)} WHERE user_id = %s",
                profile_values
            )
        
        # Ensure SponsorProfiles record exists
        cursor.execute("SELECT sponsor_profile_id FROM SponsorProfiles WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO SponsorProfiles (user_id) VALUES (%s)",
                (user_id,)
            )
        
        # Update SponsorProfiles table
        sponsor_updates = []
        sponsor_values = []
        
        if request.company_name is not None:
            sponsor_updates.append("company_name = %s")
            sponsor_values.append(request.company_name)
        if request.company_address is not None:
            sponsor_updates.append("company_address = %s")
            sponsor_values.append(request.company_address)
        if request.company_city is not None:
            sponsor_updates.append("company_city = %s")
            sponsor_values.append(request.company_city)
        if request.company_state is not None:
            sponsor_updates.append("company_state = %s")
            sponsor_values.append(request.company_state)
        if request.company_zip is not None:
            sponsor_updates.append("company_zip = %s")
            sponsor_values.append(request.company_zip)
        if request.industry is not None:
            sponsor_updates.append("industry = %s")
            sponsor_values.append(request.industry)
        if request.contact_person_name is not None:
            sponsor_updates.append("contact_person_name = %s")
            sponsor_values.append(request.contact_person_name)
        if request.contact_person_phone is not None:
            sponsor_updates.append("contact_person_phone = %s")
            sponsor_values.append(request.contact_person_phone)
        
        if sponsor_updates:
            sponsor_values.append(user_id)
            cursor.execute(
                f"UPDATE SponsorProfiles SET {', '.join(sponsor_updates)} WHERE user_id = %s",
                sponsor_values
            )
        
        conn.commit()
        
        # Fetch and return updated profile
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.email,
                   p.first_name, p.last_name, p.phone_number,
                   p.profile_picture_url, p.bio, p.created_at, p.updated_at,
                   s.company_name, s.company_address, s.company_city, s.company_state, s.company_zip,
                   s.industry, s.contact_person_name, s.contact_person_phone, s.total_points_allocated
            FROM Users u
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            LEFT JOIN SponsorProfiles s ON u.user_id = s.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        
        row = cursor.fetchone()
        return SponsorProfile(
            user_id=row["user_id"],
            username=row["username"],
            email=row["email"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            phone_number=row.get("phone_number"),
            company_name=row.get("company_name"),
            company_address=row.get("company_address"),
            company_city=row.get("company_city"),
            company_state=row.get("company_state"),
            company_zip=row.get("company_zip"),
            industry=row.get("industry"),
            contact_person_name=row.get("contact_person_name"),
            contact_person_phone=row.get("contact_person_phone"),
            profile_picture_url=row.get("profile_picture_url"),
            bio=row.get("bio"),
            total_points_allocated=row.get("total_points_allocated") or 0,
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        )
    finally:
        cursor.close()
        conn.close()




@router.get("/applications", response_model=List[DriverApplication])
def get_pending_applications(current_user: dict = Depends(require_role("sponsor"))):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT da.application_id, da.driver_user_id, u.username, u.email, da.status, da.created_at
            FROM DriverApplications da
            JOIN Users u ON da.driver_user_id = u.user_id
            WHERE da.sponsor_user_id = %s AND da.status = 'pending'
            """,
            (sponsor_id,)
        )
        rows = cursor.fetchall()
        return [
            DriverApplication(
                application_id=row["application_id"],
                driver_user_id=row["driver_user_id"],
                username=row["username"],
                email=row["email"],
                status=row["status"],
                created_at=row.get("created_at")
            )
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()


@router.post("/applications/{application_id}/reject")
def reject_driver_application(
    application_id: int,
    request: RejectDriverApplicationRequest,
    current_user: dict = Depends(require_role("sponsor"))
):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT da.status, da.driver_user_id, u.email, u.username
            FROM DriverApplications da
            JOIN Users u ON da.driver_user_id = u.user_id
            WHERE da.application_id = %s
              AND da.sponsor_user_id = %s
            """,
            (application_id, sponsor_id)
        )

        app = cursor.fetchone()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        if app["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending applications can be rejected")

        changed_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            """
            UPDATE DriverApplications
            SET status = 'rejected',
                rejection_category = %s,
                rejection_reason = %s,
                updated_at = %s
            WHERE application_id = %s
            """,
            (
                request.rejection_category.value,
                request.rejection_reason,
                changed_at,
                application_id
            )
        )

        cursor.execute(
            """
            INSERT INTO audit_log
            (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES ('driver_status_change', %s, %s, %s, %s, %s, %s)
            """,
            (
                changed_at,
                sponsor_id,
                app["driver_user_id"],
                0,
                f"rejected: {request.rejection_category.value} - {request.rejection_reason}",
                current_user["user_id"],
            )
        )

        conn.commit()

        send_driver_application_rejection_email(
            to_email=app["email"],
            username=app["username"],
            rejection_category=request.rejection_category.value,
            rejection_reason=request.rejection_reason
        )


        return {
            "message": "Driver application rejected",
            "application_id": application_id,
            "rejection_reason": request.rejection_reason
        }

    finally:
        cursor.close()
        conn.close()


@router.post("/applications/{application_id}/approve")
def approve_driver_application(
    application_id: int,
    current_user: dict = Depends(require_role("sponsor"))
):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT 
                da.status,
                da.driver_user_id,
                u.email,
                u.username,
                sp.company_name
            FROM DriverApplications da
            JOIN Users u 
              ON da.driver_user_id = u.user_id
            LEFT JOIN SponsorProfiles sp
              ON da.sponsor_user_id = sp.user_id
            WHERE da.application_id = %s
              AND da.sponsor_user_id = %s
            """,
            (application_id, sponsor_id)
        )

        app = cursor.fetchone()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

        if app["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending applications can be approved")


        cursor.execute(
            """
            UPDATE DriverApplications
            SET status = 'approved',
                updated_at = %s
            WHERE application_id = %s
            """,
            (datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'), application_id)
        )


        changed_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            """
            INSERT INTO SponsorDrivers 
                (sponsor_user_id, driver_user_id, created_at)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE sponsor_user_id = sponsor_user_id
            """,
            (sponsor_id, app["driver_user_id"], changed_at)
        )

        cursor.execute(
            """
            INSERT INTO audit_log
            (category, date, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES ('driver_status_change', %s, %s, %s, %s, %s, %s)
            """,
            (
                changed_at,
                sponsor_id,
                app["driver_user_id"],
                0,
                "approved",
                current_user["user_id"],
            )
        )

        conn.commit()

        send_driver_application_approval_email(
            to_email=app["email"],
            username=app["username"],
            sponsor_name=app.get("company_name")
        )

        return {
            "message": "Driver application approved",
            "application_id": application_id,
            "driver_user_id": app["driver_user_id"]
        }

    finally:
        cursor.close()
        conn.close()


@router.get("/applications/status-changes", response_model=List[DriverStatusChange])
def get_driver_status_changes(current_user: dict = Depends(require_role("sponsor"))):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                al.date,
                al.driver_id AS driver_user_id,
                u.username,
                CASE
                    WHEN al.reason LIKE 'approved%%' THEN 'approved'
                    WHEN al.reason LIKE 'rejected:%%' THEN 'rejected'
                    ELSE 'updated'
                END AS status,
                al.reason
            FROM audit_log al
            JOIN Users u ON u.user_id = al.driver_id
            WHERE al.category = 'driver_status_change'
              AND al.sponsor_id = %s
            ORDER BY al.date DESC
            LIMIT 25
            """,
            (sponsor_id,),
        )
        rows = cursor.fetchall()
        return [
            DriverStatusChange(
                date=row["date"],
                driver_user_id=row["driver_user_id"],
                username=row["username"],
                status=row["status"],
                reason=row["reason"],
            )
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()


@router.get("/audit-logs", response_model=List[SponsorUserActionLog])
def get_sponsor_user_action_logs(current_user: dict = Depends(require_role("sponsor"))):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT
                al.date,
                al.changed_by_user_id,
                u.username AS changed_by_username,
                al.reason
            FROM audit_log al
            LEFT JOIN Users u ON u.user_id = al.changed_by_user_id
            WHERE al.category = 'sponsor_user_action'
              AND al.sponsor_id = %s
            ORDER BY al.date DESC
            """,
            (sponsor_id,),
        )
        rows = cursor.fetchall()
        return [
            SponsorUserActionLog(
                date=row["date"],
                changed_by_user_id=row.get("changed_by_user_id"),
                changed_by_username=row.get("changed_by_username"),
                reason=row.get("reason"),
            )
            for row in rows
        ]
    finally:
        cursor.close()
        conn.close()



@router.get("/drivers", response_model=List[SponsorDriver])
def get_sponsor_drivers(current_user: dict = Depends(require_role("sponsor"))):
    """
    Returns all drivers associated with this sponsor.
    Includes basic profile info and current points balance.

    NOTE: points_balance is sourced from SponsorDrivers.total_points
    (the single source of truth for points). The field keeps the name
    "points_balance" for backwards compatibility with the frontend schema.
    """
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT sd.sponsor_driver_id,
                   u.user_id AS driver_user_id,
                   u.username,
                   u.email,
                   sd.total_points,
                   COALESCE(dp.account_status, 'active') AS account_status,
                   p.first_name,
                   p.last_name,
                   p.phone_number,
                   p.city,
                   p.state
            FROM SponsorDrivers sd
            JOIN Users u ON sd.driver_user_id = u.user_id
            LEFT JOIN DriverProfiles dp ON dp.user_id = u.user_id
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            WHERE sd.sponsor_user_id = %s
            """,
            (sponsor_id,)
        )

        rows = cursor.fetchall()

        return [
            SponsorDriver(
                sponsor_driver_id=row["sponsor_driver_id"],
                driver_user_id=row["driver_user_id"],
                username=row["username"],
                email=row["email"],
                points_balance=row.get("total_points") or 0,
                account_status=row.get("account_status") or "active",
                first_name=row.get("first_name"),
                last_name=row.get("last_name"),
                phone_number=row.get("phone_number"),
                city=row.get("city"),
                state=row.get("state"),
            )
            for row in rows
        ]

    finally:
        cursor.close()
        conn.close()


@router.post("/drivers/{driver_user_id}/status")
def update_driver_status_for_sponsor(
    driver_user_id: int,
    body: DriverAccountStatusChangeRequest,
    current_user: dict = Depends(require_role("sponsor")),
):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT u.user_id, u.username, COALESCE(dp.account_status, 'active') AS account_status
            FROM SponsorDrivers sd
            JOIN Users u ON u.user_id = sd.driver_user_id
            LEFT JOIN DriverProfiles dp ON dp.user_id = u.user_id
            WHERE sd.sponsor_user_id = %s
              AND sd.driver_user_id = %s
              AND u.role = 'driver'
            LIMIT 1
            """,
            (sponsor_id, driver_user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Driver is not associated with your sponsor account")

        current_status = (row.get("account_status") or "active").lower()
        new_status = (body.new_status or "").lower()

        if new_status == current_status:
            raise HTTPException(status_code=409, detail=f"Driver is already {current_status}")

        allowed = VALID_DRIVER_ACCOUNT_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise HTTPException(
                status_code=422,
                detail=f"Cannot transition driver from '{current_status}' to '{new_status}'",
            )

        reason = (body.reason or "").strip()
        audit_reason = reason or f"Sponsor changed driver account status to {new_status}"

        cursor.execute(
            """
            INSERT INTO DriverProfiles (user_id, account_status)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE account_status = VALUES(account_status)
            """,
            (driver_user_id, new_status),
        )
        cursor.execute(
            """
            INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES (NOW(), 'account_status_change', %s, %s, NULL, %s, %s)
            """,
            (sponsor_id, driver_user_id, audit_reason, sponsor_id),
        )
        conn.commit()

        cursor.execute("SELECT email, username FROM Users WHERE user_id = %s", (driver_user_id,))
        driver_user = cursor.fetchone()
        if driver_user:
            if new_status == "inactive":
                send_driver_account_deactivated_email(
                    driver_user["email"],
                    driver_user["username"],
                    reason or None,
                    "your sponsor",
                )
            elif new_status == "banned":
                send_driver_account_banned_email(
                    driver_user["email"],
                    driver_user["username"],
                    reason or None,
                    "your sponsor",
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


@router.get("/users")
def list_sponsor_users(current_user: dict = Depends(require_role("sponsor"))):
    sponsor_owner_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        ensure_sponsor_user_links_table(cursor)
        cursor.execute(
            """
            SELECT
                u.user_id,
                u.username,
                u.email,
                p.first_name,
                p.last_name,
                CASE WHEN u.user_id = %s THEN TRUE ELSE FALSE END AS is_owner
            FROM Users u
            LEFT JOIN Profiles p ON p.user_id = u.user_id
            LEFT JOIN SponsorUserLinks sul ON sul.sponsor_user_id = u.user_id
            WHERE u.role = 'sponsor'
              AND (u.user_id = %s OR sul.sponsor_owner_user_id = %s)
            ORDER BY is_owner DESC, u.username ASC
            """,
            (sponsor_owner_id, sponsor_owner_id, sponsor_owner_id),
        )
        return {"users": cursor.fetchall()}
    finally:
        cursor.close()
        conn.close()


@router.post("/users")
def create_sponsor_user(
    body: CreateSponsorUserRequest,
    current_user: dict = Depends(require_role("sponsor")),
):
    sponsor_owner_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True, buffered=True)
    try:
        ensure_sponsor_user_links_table(cursor)
        username = (body.username or "").strip()
        email = (body.email or "").strip().lower()
        if not username or not email:
            raise HTTPException(status_code=422, detail="Username and email are required")

        plain_password = (body.password or "").strip()
        if not plain_password:
            raise HTTPException(status_code=422, detail="Password is required")
        is_valid_password, password_error = validate_password(plain_password)
        if not is_valid_password:
            raise HTTPException(status_code=422, detail=password_error)

        cursor.execute(
            "SELECT user_id FROM Users WHERE username = %s OR email = %s LIMIT 1",
            (username, email),
        )
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username or email already exists")

        password_hash = hash_password(plain_password)
        cursor.execute(
            """
            INSERT INTO Users (username, password_hash, role, email)
            VALUES (%s, %s, 'sponsor', %s)
            """,
            (username, password_hash, email),
        )
        new_user_id = cursor.lastrowid

        cursor.execute(
            """
            INSERT INTO Profiles (user_id, first_name, last_name)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                first_name = VALUES(first_name),
                last_name = VALUES(last_name)
            """,
            (new_user_id, body.first_name, body.last_name),
        )

        cursor.execute(
            """
            INSERT INTO SponsorUserLinks (sponsor_user_id, sponsor_owner_user_id, created_by_user_id)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                sponsor_owner_user_id = VALUES(sponsor_owner_user_id),
                created_by_user_id = VALUES(created_by_user_id)
            """,
            (new_user_id, sponsor_owner_id, sponsor_owner_id),
        )
        cursor.execute(
            """
            INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES (NOW(), 'sponsor_user_action', %s, NULL, NULL, %s, %s)
            """,
            (sponsor_owner_id, f"Created sponsor user '{username}'", sponsor_owner_id),
        )
        conn.commit()

        send_sponsor_account_created_email(email, username, plain_password)
        return {"message": "Sponsor user created", "username": username, "email": email}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@router.delete("/drivers/{driver_user_id}")
def remove_driver_from_sponsor(
    driver_user_id: int,
    current_user: dict = Depends(require_role("sponsor")),
):
    sponsor_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT
                sd.sponsor_driver_id,
                u.user_id,
                u.username,
                u.email,
                COALESCE(sp.company_name, p.first_name, u.username) AS sponsor_name
            FROM SponsorDrivers sd
            JOIN Users u ON u.user_id = sd.driver_user_id
            LEFT JOIN SponsorProfiles sp ON sp.user_id = sd.sponsor_user_id
            LEFT JOIN Profiles p ON p.user_id = sd.sponsor_user_id
            WHERE sd.sponsor_user_id = %s
              AND sd.driver_user_id = %s
              AND u.role = 'driver'
            LIMIT 1
            """,
            (sponsor_id, driver_user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Driver is not associated with your sponsor account")

        cursor.execute(
            """
            DELETE FROM SponsorDrivers
            WHERE sponsor_user_id = %s
              AND driver_user_id = %s
            LIMIT 1
            """,
            (sponsor_id, driver_user_id),
        )
        cursor.execute(
            """
            INSERT INTO audit_log (date, category, sponsor_id, driver_id, points_changed, reason, changed_by_user_id)
            VALUES (NOW(), 'sponsor_user_action', %s, %s, NULL, %s, %s)
            """,
            (sponsor_id, driver_user_id, "Sponsor removed driver from sponsor program", sponsor_id),
        )
        conn.commit()

        if row.get("email"):
            send_dropped_by_sponsor_email(
                row["email"],
                row["username"],
                row.get("sponsor_name"),
            )

        return {"message": "Driver removed from sponsor program"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()



@router.post("/upload-drivers")
async def upload_drivers(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role("sponsor"))
):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        contents = await file.read()
        lines = contents.decode("utf-8").splitlines()

        created = []

        for line in lines:
            # Expect: username|email|first_name|last_name
            parts = line.strip().split("|")

            if len(parts) != 4:
                continue  # skip bad rows

            username, email, first_name, last_name = parts

            cursor.execute(
                "SELECT user_id FROM Users WHERE username = %s OR email = %s",
                (username, email)
            )

            if cursor.fetchone():
                continue  # skip duplicates

            # Insert user
            cursor.execute("""
                INSERT INTO Users (username, email, role)
                VALUES (%s, %s, 'driver')
            """, (username, email))

            user_id = cursor.lastrowid

            # Insert profile
            cursor.execute("""
                INSERT INTO Profiles (user_id, first_name, last_name)
                VALUES (%s, %s, %s)
            """, (user_id, first_name, last_name))

            # Link to sponsor
            cursor.execute("""
                INSERT INTO SponsorDrivers (sponsor_user_id, driver_user_id, status)
                VALUES (%s, %s, 'approved')
            """, (current_user["user_id"], user_id))

            created.append(username)

        conn.commit()

        return {"created": created}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
