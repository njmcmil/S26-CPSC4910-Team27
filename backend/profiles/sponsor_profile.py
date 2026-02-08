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
from pydantic import BaseModel
from datetime import datetime
from auth.auth import get_current_user, require_role
from shared.db import get_connection

router = APIRouter(prefix="/sponsor", tags=["sponsor-profile"])

# Models
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

# Endpoints
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
