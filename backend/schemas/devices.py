# schemas/devices.py

from pydantic import BaseModel
from datetime import datetime

class TrustedDevice(BaseModel):
    device_id: int
    device_name: str
    device_type: str
    ip_address: str
    last_used: datetime 
    created_at: datetime
    is_active: bool

class CreateTrustedDeviceRequest(BaseModel):
    device_name: str
    device_type: str
    ip_address: str
    user_agent: str