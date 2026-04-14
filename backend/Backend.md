# Backend

I didnt change any files or anything just organized the backend, put them in correct folders, and then fixed some routes. 

The folder structure is split by responsibility (`auth/`, `users/`, `profiles/`, `sponsors/`, `points/`, etc.) so it stays manageable

## File structure

```
backend/
├── admin/          — admin-specific logic (empty for now)
├── audit/          — login audit tracking
├── auth/           — login, tokens, token blacklist
├── points/         — point system (placeholder)
├── profiles/       — driver profile, sponsor profile, trusted devices
├── purchases/      — catalog purchases (placeholder)
├── reports/        — reporting (placeholder)
├── shared/         — db connection, utils, services, migrations
├── sponsors/       — sponsor-specific logic (placeholder)
├── users/          — account stuff like password resets and email
├── app.py          — main FastAPI app and route registration
└── requirements.txt
```


