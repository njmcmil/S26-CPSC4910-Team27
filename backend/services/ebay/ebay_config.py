# services/ebay/ebay_config.py

from dotenv import load_dotenv
import os

# Load variables from your .env file
load_dotenv()  

# eBay API credentials
CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")

# eBay OAuth scope (application access)
OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope"

# Optional: API endpoints
TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token"
BROWSE_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"
BROWSE_ITEM_URL = "https://api.ebay.com/buy/browse/v1/item/{itemId}"