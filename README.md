Good Driver Incentive Program

Live Application:
https://good-driver-app-team27-emhfeqdndxgrdybe.eastus-01.azurewebsites.net/

Overview

The Good Driver Incentive Program is a full-stack web application that tracks driver behavior and provides incentives for safe driving. The system includes a FastAPI backend and a React (Vite) frontend.

Project Structure
/backend   -> FastAPI server
/frontend  -> React + Vite frontend
How to Run Locally
1. Backend Setup

From the project root:

cd backend

Install dependencies:

pip install -r requirements.txt

Run the backend server:

uvicorn app:app --reload

Backend will run at:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs
2. Frontend Setup

From the project root:

cd frontend
npm install
npm run dev

Frontend will run at:

http://localhost:5173 (or as shown in terminal)
Authentication Test (Logout Example)

You can test logout using curl:

curl -X POST "http://127.0.0.1:8000/logout" \
-H "Authorization: Bearer <PASTE_TOKEN_HERE>"
Notes / Troubleshooting
Make sure backend is running before starting frontend
Ensure environment variables (if any) are configured correctly
If ports are in use, stop existing processes or change port
If API calls fail, confirm backend is running at /docs
Tech Stack
Frontend: React + Vite
Backend: FastAPI (Python)
Deployment: Azure Web App
