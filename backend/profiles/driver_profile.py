"""
driver_profile.py
-----------------
Purpose:
    Manage driver user profiles

Responsibilities:
    - Fetch driver profile
    - Update driver profile
"""

# Driver Profile Manager
# Fetches data from Users, Profiles, and DriverProfiles and presents them as one clean object

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from auth.auth import get_current_user, require_role
from shared.db import get_connection

from schemas.driver import DriverProfile, UpdateDriverProfileRequest, CreateDriverApplicationRequest

router = APIRouter(prefix="/me", tags=["driver-profile"])


# Endpoints

# Gather all the driver's info for their dashboard
@router.get("/profile", response_model=DriverProfile)
#only someone logged in as a driver can see this data
def get_driver_profile(current_user: dict = Depends(require_role("driver"))):
    """
    Fetch authenticated driver's profile.
    
    Returns personal, contact, and vehicle information.
    """
    user_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get base profile
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.email,
                   p.first_name, p.last_name, p.phone_number, p.address, p.city, p.state, p.zip_code,
                   p.profile_picture_url, p.bio, p.created_at, p.updated_at,
                   d.license_number, d.vehicle_make, d.vehicle_model, d.vehicle_year, d.vehicle_license_plate, d.points_balance
            FROM Users u
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            LEFT JOIN DriverProfiles d ON u.user_id = d.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return DriverProfile(
            user_id=row["user_id"],
            username=row["username"],
            email=row["email"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            phone_number=row.get("phone_number"),
            address=row.get("address"),
            city=row.get("city"),
            state=row.get("state"),
            zip_code=row.get("zip_code"),
            license_number=row.get("license_number"),
            vehicle_make=row.get("vehicle_make"),
            vehicle_model=row.get("vehicle_model"),
            vehicle_year=row.get("vehicle_year"),
            vehicle_license_plate=row.get("vehicle_license_plate"),
            points_balance=row.get("points_balance") or 0,
            profile_picture_url=row.get("profile_picture_url"),
            bio=row.get("bio"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        )
    finally:
        cursor.close()
        conn.close()

# Updates what the user sent
@router.put("/profile", response_model=DriverProfile)
def update_driver_profile(
    request: UpdateDriverProfileRequest,
    current_user: dict = Depends(require_role("driver"))
):
    """
    Update authenticated driver's profile.
    
    Updates personal and vehicle information.
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
        if request.address is not None:
            profile_updates.append("address = %s")
            profile_values.append(request.address)
        if request.city is not None:
            profile_updates.append("city = %s")
            profile_values.append(request.city)
        if request.state is not None:
            profile_updates.append("state = %s")
            profile_values.append(request.state)
        if request.zip_code is not None:
            profile_updates.append("zip_code = %s")
            profile_values.append(request.zip_code)
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
        
        # Ensure DriverProfiles record exists
        cursor.execute("SELECT driver_profile_id FROM DriverProfiles WHERE user_id = %s", (user_id,))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO DriverProfiles (user_id) VALUES (%s)",
                (user_id,)
            )
        
        # Update DriverProfiles table
        driver_updates = []
        driver_values = []
        
        if request.license_number is not None:
            driver_updates.append("license_number = %s")
            driver_values.append(request.license_number)
        if request.vehicle_make is not None:
            driver_updates.append("vehicle_make = %s")
            driver_values.append(request.vehicle_make)
        if request.vehicle_model is not None:
            driver_updates.append("vehicle_model = %s")
            driver_values.append(request.vehicle_model)
        if request.vehicle_year is not None:
            driver_updates.append("vehicle_year = %s")
            driver_values.append(request.vehicle_year)
        if request.vehicle_license_plate is not None:
            driver_updates.append("vehicle_license_plate = %s")
            driver_values.append(request.vehicle_license_plate)
        
        if driver_updates:
            driver_values.append(user_id)
            cursor.execute(
                f"UPDATE DriverProfiles SET {', '.join(driver_updates)} WHERE user_id = %s",
                driver_values
            )
        
        conn.commit()
        
        # Fetch and return updated profile
        cursor.execute(
            """
            SELECT u.user_id, u.username, u.email,
                   p.first_name, p.last_name, p.phone_number, p.address, p.city, p.state, p.zip_code,
                   p.profile_picture_url, p.bio, p.created_at, p.updated_at,
                   d.license_number, d.vehicle_make, d.vehicle_model, d.vehicle_year, d.vehicle_license_plate, d.points_balance
            FROM Users u
            LEFT JOIN Profiles p ON u.user_id = p.user_id
            LEFT JOIN DriverProfiles d ON u.user_id = d.user_id
            WHERE u.user_id = %s
            """,
            (user_id,)
        )
        
        row = cursor.fetchone()
        return DriverProfile(
            user_id=row["user_id"],
            username=row["username"],
            email=row["email"],
            first_name=row.get("first_name"),
            last_name=row.get("last_name"),
            phone_number=row.get("phone_number"),
            address=row.get("address"),
            city=row.get("city"),
            state=row.get("state"),
            zip_code=row.get("zip_code"),
            license_number=row.get("license_number"),
            vehicle_make=row.get("vehicle_make"),
            vehicle_model=row.get("vehicle_model"),
            vehicle_year=row.get("vehicle_year"),
            vehicle_license_plate=row.get("vehicle_license_plate"),
            points_balance=row.get("points_balance") or 0,
            profile_picture_url=row.get("profile_picture_url"),
            bio=row.get("bio"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at")
        )
    finally:
        cursor.close()
        conn.close()


@router.get("/applications")
def get_my_driver_applications(
    current_user: dict = Depends(require_role("driver"))
):
    """
    View driver's applications and their status.
    """
    user_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT application_id, status, rejection_reason, created_at, updated_at
            FROM DriverApplications
            WHERE driver_user_id = %s
            ORDER BY created_at DESC
            """,
            (user_id,)
        )
        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()

# Apply to sponsor endpoint: only driver roles can see this

@router.post("/applications")
def create_driver_application(
    request: CreateDriverApplicationRequest,
    current_user: dict = Depends(require_role("driver"))
):
    """
    Create a new driver application for a sponsor.

    Status defaults to 'pending'.
    """
    user_id = current_user["user_id"]
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # Check if there is already a pending application for this sponsor
        cursor.execute(
            """
            SELECT * FROM DriverApplications
            WHERE driver_user_id = %s AND sponsor_user_id = %s AND status = 'pending'
            """,
            (user_id, request.sponsor_user_id)
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=400,
                detail="You already have a pending application for this sponsor."
            )

        # Insert the new driver application
        cursor.execute(
            """
            INSERT INTO DriverApplications
                (driver_user_id, sponsor_user_id, status, license_number, vehicle_make, vehicle_model, vehicle_year, vehicle_license_plate, created_at, updated_at)
            VALUES (%s, %s, 'pending', %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                request.sponsor_user_id,
                request.license_number,
                request.vehicle_make,
                request.vehicle_model,
                request.vehicle_year,
                request.vehicle_license_plate,
                datetime.utcnow(),
                datetime.utcnow()
            )
        )
        conn.commit()
        application_id = cursor.lastrowid

        return {
            "message": "Driver application submitted successfully.",
            "application_id": application_id,
            "status": "pending"
        }

    finally:
        cursor.close()
        conn.close()
