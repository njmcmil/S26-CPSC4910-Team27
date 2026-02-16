# schemas/driver.py
from pydantic import BaseModel
from datetime import datetime

# Models
class DriverProfile(BaseModel):
    user_id: int
    username: str
    email: str
    first_name: str | None
    last_name: str | None
    phone_number: str | None
    address: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    license_number: str | None
    vehicle_make: str | None
    vehicle_model: str | None
    vehicle_year: int | None
    vehicle_license_plate: str | None
    points_balance: int
    profile_picture_url: str | None
    bio: str | None
    created_at: datetime | None
    updated_at: datetime | None

class UpdateDriverProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone_number: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    profile_picture_url: str | None = None
    bio: str | None = None
    license_number: str | None = None
    vehicle_make: str | None = None
    vehicle_model: str | None = None
    vehicle_year: int | None = None
    vehicle_license_plate: str | None = None


class CreateDriverApplicationRequest(BaseModel):
    sponsor_user_id: int
    license_number: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int
    vehicle_license_plate: str
