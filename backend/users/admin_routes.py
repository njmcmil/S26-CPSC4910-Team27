# users/admin_routes.py

# Admin Control Panel
# allows users with admin role to overlook everyone, and if necessary wipe an account from the system
from fastapi import APIRouter, Depends, HTTPException
from shared.db import get_connection
from auth.auth import require_role

router = APIRouter(prefix="/admin", tags=["admin"])

# Allows admin to see big picture
@router.get("/users")
def list_all_users(current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, username, role, email FROM Users")
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

@router.get("/users/{username}")
def get_user(username: str, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id, username, role, email FROM Users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    finally:
        cursor.close()
        conn.close()


# Admin- delete a user
@router.delete("/users/{username}")
def delete_user(username: str, current_user: dict = Depends(require_role("admin"))):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if user exists
        cursor.execute("SELECT user_id FROM Users WHERE username = %s", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["user_id"]

        # Delete child records first
        cursor.execute("DELETE FROM SponsorDrivers WHERE driver_user_id = %s OR sponsor_user_id = %s", (user_id, user_id))
        cursor.execute("DELETE FROM DriverApplications WHERE driver_user_id = %s OR sponsor_user_id = %s", (user_id, user_id))
        cursor.execute("DELETE FROM DriverProfiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM SponsorProfiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM Profiles WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM LoginAudit WHERE user_id = %s", (user_id,))

        # Finally delete the user
        cursor.execute("DELETE FROM Users WHERE user_id = %s", (user_id,))

        conn.commit()
        return {"message": f"User '{username}' deleted successfully."}
    finally:
        cursor.close()
        conn.close()
