"""
app.py
------
Purpose:
    Main entry point of the Team27 application.

Responsibilities:
    - Orchestrates application flow
    - Calls functions from users.py and other modules
    - Handles output or user interaction (e.g., prints results)

Usage:
    python app.py
"""


from users import get_all_users

if __name__ == "__main__":
    users = get_all_users()
    print("Users in the database:")
    for user in users:
        print(f"Username: {user[0]}, Role: {user[1]}")
