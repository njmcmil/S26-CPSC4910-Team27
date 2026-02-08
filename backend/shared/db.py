"""
db.py
------
Purpose:
    Handles all database connections for the Team27 application.
    
Responsibilities:
    - Connect to Team27_DB on shared AWS RDS
    - Provides a reusable get_connection() function for other modules
    - Read database credentials from .env file for security

Usage:
    from db import get_connection
    conn = get_connection()
"""



import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return mysql.connector.connect(
        host=os.environ['DB_HOST'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        database=os.environ['DB_NAME']
    )
