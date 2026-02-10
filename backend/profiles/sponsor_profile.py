"""
sponsor_profile.py
------------------
Purpose:
    Manage sponsor user profiles

Responsibilities:
    - Fetch sponsor profile
    - Update sponsor profile
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from auth.auth import get_current_user, require_role
from shared.db import get_connection
from users.email_service import send_driver_application_rejection_email


from enum import Enum

router = APIRouter(prefix="/sponsor", tags=["sponsor-profile"])


#=============
# Models
#=============
class SponsorProfile(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str | None
    last_name: str | None
    phone_number: str | None
    company_name: str | None
    company_address: str | None
    company_city: str | None
    company_state: str | None
    company_zip: str | None
    industry: str | None
    contact_person_name: str | None
    contact_person_phone: str | None
    profile_picture_url: str | None
    bio: str | None
    total_points_allocated: int
    created_at: datetime | None
    updated_at: datetime | None





class CreateSponsorProfileRequest(BaseModel):
    username: str
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    company_name: str | None = None
    company_address: str | None = None
    company_city: str | None = None
    company_state: str | None = None
    company_zip: str | None = None
    industry: str | None = None
    contact_person_name: str | None = None
    contact_person_phone: str | None = None
    profile_picture_url: str | None = None
    bio: str | None = None

class UpdateSponsorProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    profile_picture_url: str | None = None
    bio: str | None = None
    company_name: str | None = None
    company_address: str | None = None
    company_city: str | None = None
    company_state: str | None = None
    company_zip: str | None = None
    industry: str | None = None
    contact_person_name: str | None = None
    contact_person_phone: str | None = None

class RejectionCategory(str, Enum):
    INCOMPLETE_DOCUMENTS = "Incomplete Documents"
    INVALID_LICENSE = "Invalid License"
    FAILED_BACKGROUND_CHECK = "Failed Background Check"
    VEHICLE_NOT_ELIGIBLE = "Vehicle Not Eligible"
    OTHER = "Other"


class RejectDriverApplicationRequest(BaseModel):
    rejection_category: RejectionCategory
    rejection_reason: str = Field(min_length=10, max_length=500)





#=============
# Endpoints
#=============
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
        # 1. Check if username or email already exists
        cursor.execute(
            "SELECT user_id FROM Users WHERE username = %s OR email = %s",
            (request.username, request.email)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Username or email already exists")

        # 2. Create Users record (password can be blank or random for setup)
        cursor.execute(
            """
            INSERT INTO Users (username, email, role)
            VALUES (%s, %s, 'sponsor')
            """,
            (request.username, request.email)
        )
        user_id = cursor.lastrowid

        # 3. Create Profiles record
        cursor.execute(
            """
            INSERT INTO Profiles (user_id, first_name, last_name, phone_number, profile_picture_url, bio)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                request.first_name,
                request.last_name,
                request.phone_number,
                request.profile_picture_url,
                request.bio
            )
        )

        # 4. Create SponsorProfiles record
        cursor.execute(
            """
            INSERT INTO SponsorProfiles
                (user_id, company_name, company_address, company_city, company_state, company_zip, 
                 industry, contact_person_name, contact_person_phone, total_points_allocated)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
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
                request.contact_person_phone
            )
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
            SELECT da.status, u.email, u.username
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

        cursor.execute(
            """
            UPDATE DriverApplications
            SET status = 'rejected',
                rejection_category = %s,
                rejection_reason = %s
            WHERE application_id = %s
            """,
            (
                request.rejection_category.value,
                request.rejection_reason,
                application_id
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
            (datetime.utcnow(), application_id)
        )

        cursor.execute(
            """
            INSERT INTO SponsorDrivers 
                (sponsor_user_id, driver_user_id, created_at)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE sponsor_user_id = sponsor_user_id
            """,
            (sponsor_id, app["driver_user_id"], datetime.utcnow())
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