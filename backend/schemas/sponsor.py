# schemas/sponsor.py
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from enum import Enum



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


class DriverApplication(BaseModel):
    application_id: int
    driver_user_id: int
    username: str
    email: str
    status: str
    created_at: datetime | None = None

