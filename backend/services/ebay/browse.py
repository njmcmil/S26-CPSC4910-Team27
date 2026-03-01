# services/ebay/browse.py
from .ebay_config import CLIENT_ID, CLIENT_SECRET, TOKEN_URL, BROWSE_SEARCH_URL, OAUTH_SCOPE
import requests, base64, time, uuid
from urllib.parse import quote
from shared.db import get_connection


# Cache token and expiry time
_token_cache = {
    "access_token": None,
    "expires_at": 0
}

def _log_api_error(operation: str, endpoint: str, error_message: str,
                   status_code: int | None = None, sponsor_id: int | None = None):
    """Task 15515: persist eBay API failure to APIErrorLog. Non-fatal."""
    try:
        request_id = str(uuid.uuid4())[:16]
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO APIErrorLog
                    (sponsor_id, operation, endpoint, error_message, status_code, request_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (sponsor_id, operation, endpoint, str(error_message)[:2000], status_code, request_id)
            )
            conn.commit()
        finally:
            cursor.close()
            conn.close()
    except Exception:
        pass  # never let logging crash the caller

def get_ebay_token():
    """Get eBay OAuth token, use cached if valid"""
    global _token_cache
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["access_token"]

    auth = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    response = requests.post(
        TOKEN_URL,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        data=f"grant_type=client_credentials&scope={OAUTH_SCOPE}"
    )
    data = response.json()
    access_token = data.get("access_token")
    expires_in = data.get("expires_in", 7200)  # default 2 hours

    _token_cache["access_token"] = access_token
    _token_cache["expires_at"] = time.time() + int(expires_in) - 60  # buffer 1 min
    return access_token

def search_products(query, limit=10, sponsor_id=None):
    """Search eBay products by keyword. Logs failures to APIErrorLog."""
    encoded_query = quote(query)
    url = f"{BROWSE_SEARCH_URL}?q={encoded_query}&limit={limit}"
    try:
        token = get_ebay_token()
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json().get("itemSummaries", [])
    except requests.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else None
        _log_api_error("ebay_search", url, str(e), status_code=status_code, sponsor_id=sponsor_id)
        print(f"Error searching eBay: {e}")
        return []
    except Exception as e:
        _log_api_error("ebay_search", url, str(e), sponsor_id=sponsor_id)
        print(f"Error searching eBay: {e}")
        return []


def get_product_details(item_id, sponsor_id=None):
    """Retrieve detailed info for a single eBay item. Logs failures to APIErrorLog."""
    url = f"https://api.ebay.com/buy/browse/v1/item/{item_id}"
    try:
        token = get_ebay_token()
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as e:
        status_code = e.response.status_code if e.response is not None else None
        _log_api_error("ebay_product_detail", url, str(e), status_code=status_code, sponsor_id=sponsor_id)
        print(f"Error getting eBay item details: {e}")
        return None
    except Exception as e:
        _log_api_error("ebay_product_detail", url, str(e), sponsor_id=sponsor_id)
        print(f"Error getting eBay item details: {e}")
        return None
