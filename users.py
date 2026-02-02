"""
users.py
--------
Purpose:
    Contains all user-related database operations for Team27 application.

Responsibilities:
    - Retrieve all users from the database
    - Insert new users (drivers, sponsors, admins)
    - Validate login credentials
    - Enforce password rules

Usage:
    from users import get_all_users
    users = get_all_users()
"""




from db import get_connection

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users;")
    users = cursor.fetchall()
    conn.close()
    return users

# Quick test
if __name__ == "__main__":
    all_users = get_all_users()
    for u in all_users:
        print(f"Username: {u[0]}, Role: {u[1]}")
