# schemas/points.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

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

class SponsorRewardDefaults(BaseModel):
    """Default reward settings for a sponsor (#13984)"""
    dollar_per_point: float = Field(default=0.01, ge=0, description="Dollar value per point")
    earn_rate: float = Field(default=1.0, ge=0, description="Point earning multiplier")
    expiration_days: Optional[int] = Field(default=None, ge=1, description="Days until points expire; null = no expiration")
    max_points_per_day: Optional[int] = Field(default=None, ge=1, description="Daily point cap; null = unlimited")
    max_points_per_month: Optional[int] = Field(default=None, ge=1, description="Monthly point cap; null = unlimited")

class PointHistoryItem(BaseModel):
    """single entry in a drivers point history"""
    date: datetime
    points_changed: int
    reason: Optional[str] = None
    changed_by_user_id: Optional[int] = None
    expires_at: Optional[datetime] = None

class PointHistoryResponse(BaseModel):
    """response for a driver point history endpoint"""
    driver_id: int
    current_points: int
    history: List[PointHistoryItem]
    total_count: int

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
        from_attributes = True # allows returning database objects directly
    
class TipView(BaseModel):
    """Schema for when a driver views a tip"""
    view_id: int
    driver_id: int
    tip_id: int
    last_viewed: datetime
    
    class Config:
        from_attributes = True

class TipViewCreate(BaseModel):
    """Schema for creatging a record when a driver views a tip"""
    driver_id: int
    tip_id: int