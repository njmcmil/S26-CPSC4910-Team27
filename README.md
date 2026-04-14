Good-Driver-Incentive Program:
https://good-driver-app-team27-emhfeqdndxgrdybe.eastus-01.azurewebsites.net/

How to run backend locally:
project root ->
cd backend
(install requirements)
uvicorn app:app --reload

python -m uvicorn app:app --reload


(ip)/docs


logout test:
curl -X POST "http://127.0.0.1:8000/logout" \
-H "Authorization: Bearer <PASTE_TOKEN_HERE>"
How to run frontend locally:
project root ->
cd frontend
npm run dev
