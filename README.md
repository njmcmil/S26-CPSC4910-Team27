# Good Driver Incentive Program

**Live Application:**  
https://good-driver-app-team27-emhfeqdndxgrdybe.eastus-01.azurewebsites.net/

---

## Overview

The Good Driver Incentive Program is a full-stack web application that tracks driver behavior and provides incentives for safe driving.  
The system includes a FastAPI backend and a React (Vite) frontend.

---

## Project Structure


/backend → FastAPI server
/frontend → React + Vite frontend


---

## How to Run Locally

### Backend Setup

From the project root:

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload

Backend will run at:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs
Frontend Setup

From the project root:

cd frontend
npm install
npm run dev

Frontend will run at:

http://localhost:5173

(or whatever is shown in the terminal)

Authentication Test (Logout Example)
curl -X POST "http://127.0.0.1:8000/logout" \
-H "Authorization: Bearer <PASTE_TOKEN_HERE>"
Notes / Troubleshooting
Ensure backend is running before starting frontend
Verify environment variables are set if required
If ports are in use, stop conflicting processes
If API requests fail, check http://127.0.0.1:8000/docs
Tech Stack

Frontend: React + Vite
Backend: FastAPI (Python)
Deployment: Azure Web App
