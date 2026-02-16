# schemas/points.py
from pydantic import BaseModel, Field


class PointChangeRequest(BaseModel):
    driver_id: int
    # Ensure points are sent as a positive number (the code handles + or -)
    points: int = Field(gt=0, description="The amount of points to add or deduct")
    # Ensure reason isn't just an empty string
    reason: str = Field(min_length=3, max_length=255, description="Why the points were changed")

class ExpirationPolicyRequest(BaseModel):
    sponsor_id: int
    expiration_months: int = Field(ge=1, le=120) # 1 month to 10 years
    auto_expire: bool = True

class SponsorSettings(BaseModel):
    allow_negative_points: bool = False

# This is a 'Response' model to tell the frontend exactly what happened
class PointChangeResponse(BaseModel):
    success: bool
    message: str
    new_total: int

