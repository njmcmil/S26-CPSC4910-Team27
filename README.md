Project explanation:

Testing: uvicorn app:app --reload 

(ip)/docs


logout test:
curl -X POST "http://127.0.0.1:8000/logout" \
-H "Authorization: Bearer <PASTE_TOKEN_HERE>"
