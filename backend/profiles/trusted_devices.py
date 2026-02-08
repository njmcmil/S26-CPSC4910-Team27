"""
trusted_devices.py
------------------
Purpose:
    Manage trusted devices for remember-me and device management

Responsibilities:
    - List user's trusted devices
    - Revoke/remove a trusted device
    - Create/register a trusted device (helper)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from auth.auth import get_current_user, require_role
from shared.db import get_connection
import hashlib

router = APIRouter(prefix="/me/trusted-devices", tags=["trusted-devices"])

# Models
class TrustedDevice(BaseModel):
    device_id: int
    device_name: str
    device_type: str
    ip_address: str
    last_used_at: datetime
    created_at: datetime
    is_active: bool

class CreateTrustedDeviceRequest(BaseModel):
    device_name: str
    device_type: str
    ip_address: str
    user_agent: str

# Helpers 
def create_device_fingerprint(ip_address: str, user_agent: str) -> str:
    """Create a fingerprint from IP + user-agent for device identification."""
    combined = f"{ip_address}:{user_agent}"
    return hashlib.sha256(combined.encode()).hexdigest()

def create_trusted_device(user_id: int, device_name: str, device_type: str, ip_address: str, user_agent: str) -> int:
    """
    Register a new trusted device for a user.
    Returns device_id on success.
    """
    device_fingerprint = create_device_fingerprint(ip_address, user_agent)
    expires_at = datetime.utcnow() + timedelta(days=30)  # Device trust expires in 30 days
    
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO TrustedDevices (user_id, device_name, device_type, device_fingerprint, ip_address, user_agent, is_active, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s)
            """,
            (user_id, device_name, device_type, device_fingerprint, ip_address, user_agent, expires_at)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        cursor.close()
        conn.close()

 # Endpoints
@router.get("", response_model=list[TrustedDevice])
def list_trusted_devices(current_user: dict = Depends(require_role("driver", "sponsor", "admin"))):
    """
    Get list of trusted devices for authenticated user.
    
    Returns all devices (active and inactive).
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT device_id, device_name, device_type, ip_address, last_used, created_at, is_active
            FROM TrustedDevices
            WHERE user_id = %s
            ORDER BY last_used DESC
            """,
            (current_user["user_id"],)
        )
        devices = cursor.fetchall()
        return [
            TrustedDevice(
                device_id=d["device_id"],
                device_name=d["device_name"],
                device_type=d["device_type"],
                ip_address=d["ip_address"],
                last_used=d["last_used"],
                created_at=d["created_at"],
                is_active=d["is_active"]
            )
            for d in devices
        ]
    finally:
        cursor.close()
        conn.close()

@router.delete("/{device_id}")
def revoke_device(device_id: int, current_user: dict = Depends(require_role("driver", "sponsor", "admin"))):
    """
    Revoke/remove a trusted device by ID.
    
    Only the device owner can revoke their own device.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # verify ownership
        cursor.execute(
            "SELECT user_id FROM TrustedDevices WHERE device_id = %s",
            (device_id,)
        )
        device = cursor.fetchone()
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        if device["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Cannot revoke another user's device")
        
        # delete the device
        cursor.execute(
            "DELETE FROM TrustedDevices WHERE device_id = %s",
            (device_id,)
        )
        conn.commit()
        
        return {"message": f"Device {device_id} revoked successfully"}
    finally:
        cursor.close()
        conn.close()

