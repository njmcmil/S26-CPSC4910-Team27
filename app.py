"""
app.py
------
Purpose:
    Main entry point of the Team27 application.

Responsibilities:
    - Orchestrates application flow
    - Calls functions from users.py and other modules
    - Handles output or user interaction (e.g., prints results)
    - Exposes FastAPI endpoints for accessing users

Usage:
    Run as CLI:
        python app.py

    Run as API:
        uvicorn app:app --reload
"""

from fastapi import FastAPI
from db import get_connection

app = FastAPI(title="Team27 API", description="API for Team27 application", version="1.0")

# Function to get all users from the DB
def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM Users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return users

# Root endpoint
@app.get("/")
def root():
    return {"message": "Good Driver Incentive Program API is running!"}

# FastAPI endpoint to get all users
@app.get("/users")
def read_users():
    users = get_all_users()
    return [{"username": u[0], "role": u[1]} for u in users]

# CLI behavior
if __name__ == "__main__":
    users = get_all_users()
    print("Users in the database:")
    for u in users:
        print(f"Username: {u[0]}, Role: {u[1]}")
