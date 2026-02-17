# schemas/points.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List

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

class AccrualStatusUpdate(BaseModel):
    driver_id: int
    paused: bool

class BulkPointUpdateRequest(BaseModel):
    driver_ids: List[int]
    points: float
    reason: str


# Tip schemas

class TipBase(BaseModel):
    """Base schema for a tip, used for creating or updating tips"""
    tip_text: str = Field(min_length=3, max_length=500, description="The text of the tip")
    category: str | None = Field(default=None, max_length=50, description="Optional category like 'earning' or 'behaivor'")
    active: bool = True # Is the tip currently active?


class TipCreate(TipBase):
    """Schema for creating a tip"""
    pass

class Tip(TipBase):
    """Schema for returning a tip from the database"""
    tip_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True # allows returning database objects directly
    
class TipView(BaseModel):
    """Schema for when a driver views a tip"""
    view_id: int
    driver_id: int
    tip_id: int
    last_viewed: datetime
    
    class Config:
        orm_mode = True

class TipViewCreate(BaseModel):
    """Schema for creatging a record when a driver views a tip"""
    driver_id: int
    tip_id: int