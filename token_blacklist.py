# token_blacklist.py

from db import get_connection

def blacklist_token(token: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO TokenBlacklist (token) VALUES (%s)",
            (token,)
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def is_token_blacklisted(token: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM TokenBlacklist WHERE token = %s",
            (token,)
        )
        result = cursor.fetchone()
        return result is not None
    finally:
        cursor.close()
        conn.close()
