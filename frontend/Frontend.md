# Frontend
There was no frontend stuff so I built the basic things we need for the sprint. Styling is minimal on purpose

## What's here

- **Login page** with a "remember this device" option
- **Driver profile** read-only view
- **Sponsor profile** editable form with validation and save states
- **Account settings** for managing trusted devices
- **Role-based routing** role is inferred after login, no selection screen
- **Protected routes** and logout behavior
- Support for three roles: driver, sponsor, admin

## File structure

```
src/
├── app/            — top-level app setup and route definitions
├── auth/           — login context, protected routes, role guards
├── components/     — shared UI (buttons, form fields, alerts, spinner)
├── features/       — role-specific pages (driver, sponsor, admin)
├── pages/          — general pages (login, account settings, 404)
├── services/       — API calls to backend (some still have TODOs)
├── styles/         — global CSS
└── types/          — shared TypeScript types
```

## Good to know
- To run: `npm install && npm start`

### Test Accounts (for local/dev use)

These are basic test accounts you can use to quickly view the UI

Driver:
- username: test_driver
- password: TestPass123!

Sponsor:
- username: test_sponsor
- password: TestPass123!

Admin:
- username: test_admin
- password: TestPass123!

