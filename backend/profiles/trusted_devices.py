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
# Logic behind "Recognize this device?"
# Uses Fingerprinting to remember a specific computer or phone so you don't have to keep nagging\
# a user for Multi-Factor Auth or security alerts

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from auth.auth import get_current_user, require_role
from shared.db import get_connection
import hashlib

from schemas.devices import TrustedDevice, CreateTrustedDeviceRequest

router = APIRouter(prefix="/me/trusted-devices", tags=["trusted-devices"])

# Helpers 

# The Fingerprint
# Takes user's IP address and User-Agent (browser type) mashes them together,
# and turns them into a long, unique hash
def create_device_fingerprint(ip_address: str, user_agent: str) -> str:
    """Create a fingerprint from IP + user-agent for device identification."""
    combined = f"{ip_address}:{user_agent}"
    return hashlib.sha256(combined.encode()).hexdigest()


# Saves the device to the database
def create_trusted_device(user_id: int, device_name: str, device_type: str, ip_address: str, user_agent: str) -> int:
    """
    Register a new trusted device for a user.
    Returns device_id on success.
    """
    device_fingerprint = create_device_fingerprint(ip_address, user_agent)
    expires_at = datetime.utcnow() + timedelta(days=30)  # Device trust expires in 30 days
    
    # saves metadata like device_name and device_type, so user can identify later
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

# Manual Remember device endpoint
@router.post("", response_model=int)
def register_device(
    request: CreateTrustedDeviceRequest, 
    current_user: dict = Depends(get_current_user)
):
    """API endpoint to manually register a new trusted device."""
    return create_trusted_device(
        user_id=current_user["user_id"],
        device_name=request.device_name,
        device_type=request.device_type,
        ip_address=request.ip_address,
        user_agent=request.user_agent
    )


 # takes the raw SQL dictionaries and turns them into TrustedDevice objects.
 # ensures data sent to frontend is clean and matches the "Model" defined at the top
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


# Ownership Check
# without this check, a hacker could send a delete request and delete your trusted device
# also gives users the power to sign out of all other devices 
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

