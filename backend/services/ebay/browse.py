# services/ebay/browse.py
from .ebay_config import CLIENT_ID, CLIENT_SECRET, TOKEN_URL, BROWSE_SEARCH_URL, OAUTH_SCOPE
import requests, base64, time
from urllib.parse import quote

# Cache token and expiry time
_token_cache = {
    "access_token": None,
    "expires_at": 0
}

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

def search_products(query, limit=10):
    """Search eBay products by keyword"""
    try:
        token = get_ebay_token()
        encoded_query = quote(query)
        url = f"{BROWSE_SEARCH_URL}?q={encoded_query}&limit={limit}"
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json().get("itemSummaries", [])
    except Exception as e:
        print(f"Error searching eBay: {e}")
        return []


def get_product_details(item_id):
    """Retrieve detailed info for a single eBay item"""
    try:
        token = get_ebay_token()
        url = f"https://api.ebay.com/buy/browse/v1/item/{item_id}"
        response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting eBay item details: {e}")
        return None