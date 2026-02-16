# token_blacklist.py
# Secure Logout system 
from shared.db import get_connection



#When a user clicks logout this function is called...
# takes the user's current token and saves it into a database table called TokenBlackList
# result: token is then marked as 'dead'
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

#Every time a user tries to access a protected route, verify_token function in auth.py calls this...
# runs sql query
# if it finds token in table, returns true (banned!)
# doesnt, returns false (clean)

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
