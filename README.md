Project explanation:

URL: http://52.200.244.222:8000
Frontend URL: http://52.200.244.222:5173


export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
uvicorn backend.app:app --reload