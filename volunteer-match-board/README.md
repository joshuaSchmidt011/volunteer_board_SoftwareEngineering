# Volunteer Match Board - Code Milestone 2

Volunteer Match Board is a React, Node/Express, and PostgreSQL-ready prototype for connecting volunteers with local volunteer opportunities. Milestone 2 expands the project from a basic opportunity board into a role-based application with volunteer accounts, organization accounts, secure password handling, signups, and dashboards.

## Milestone 2 Feature Summary

### Public / Guest Flow

- Guests land on a generic public opportunity board.
- Guests can browse and search opportunities.
- Guests cannot sign up until they log in as volunteers.

### Account Flow

- Users can create either a `volunteer` account or an `organization` account.
- Email addresses are validated before account creation.
- Passwords must include:
  - at least 8 characters
  - one uppercase letter
  - one number
  - one special character
- Passwords are stored as salted hashes using Node's built-in `crypto.scryptSync`, not as plaintext.
- Logged-in sessions use temporary server-side tokens for the demo.

### Volunteer Flow

- Volunteers can sign up for available opportunities.
- Volunteers cannot sign up for the same opportunity twice.
- The main page shows a horizontal row of the volunteer's current signups.
- The volunteer dashboard shows all signed-up opportunities as detailed vertical cards.

### Organization Flow

- Organization accounts are separate from volunteer accounts.
- Organizations can create/post opportunities.
- Organizations cannot sign up for opportunities.
- The organization dashboard shows the events created by that organization.
- Each organization event card lists the volunteers who signed up.

### Backend / Database Flow

- The backend supports PostgreSQL through `DATABASE_URL`.
- If PostgreSQL is not configured, the app falls back to in-memory demo data so the project still runs for a class demo.
- The health endpoint reports whether the app is running with PostgreSQL or the in-memory fallback.

## Project Structure

```text
volunteer-match-board-milestone2/
├── client/              # React/Vite frontend
│   ├── src/App.jsx      # Main app, pages, account flow, dashboards
│   ├── src/App.css      # Updated Milestone 2 styling
│   └── package.json
├── server/              # Node/Express backend
│   ├── index.js         # API routes, auth, role checks, signup logic
│   ├── db.js            # PostgreSQL connection helper
│   ├── schema.sql       # Milestone 2 database schema and seed data
│   ├── .env.example     # Example PostgreSQL config
│   └── package.json
├── QUICK_START_WINDOWS.md
└── SUBMISSION_TEXT.md
```

## Demo Accounts

These accounts are seeded in both PostgreSQL mode and in-memory fallback mode.

| Role | Email | Password |
|---|---|---|
| Volunteer | `demo.volunteer@example.com` | `Password1!` |
| Organization | `org.admin@example.com` | `Password1!` |
| Organization | `parks.admin@example.com` | `Password1!` |

## API Endpoints

### Public

- `GET /api/health`
- `GET /api/opportunities`
- `GET /api/opportunities/:id`

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Volunteer-only

- `POST /api/signups`
- `GET /api/me/signups`

### Organization-only

- `POST /api/opportunities`
- `GET /api/org/opportunities`

### Demo / Backward-Compatible

- `GET /api/signups`

## Run Without PostgreSQL

This is the fastest demo path. The backend will use in-memory seed data.

### Start the backend

```bash
cd server
npm install
npm start
```

The backend runs at:

```text
http://localhost:5000
```

### Start the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

## Run With PostgreSQL

### 1. Create a database

Example database name:

```text
volunteer_match_board
```

### 2. Configure the server environment

Copy the example env file:

```bash
cd server
copy .env.example .env
```

Update `.env` with your local PostgreSQL username, password, host, port, and database name:

```text
DATABASE_URL=postgres://postgres:your_password@localhost:5432/volunteer_match_board
USE_POSTGRES=true
PORT=5000
```

### 3. Run the schema

From the `server` folder:

```bash
psql -U postgres -d volunteer_match_board -f schema.sql
```

This drops and recreates the Milestone 2 demo tables, then inserts demo users and opportunities.

### 4. Start backend and frontend

Backend:

```bash
cd server
npm install
npm start
```

Frontend:

```bash
cd client
npm install
npm run dev
```

## Notes for Class Demo

The application is not trying to be production authentication. It is a class-demo implementation that shows the correct direction: role-based accounts, email/password validation, salted password hashes, protected API routes, volunteer-only signups, and organization-only event creation.

The temporary login token is stored in browser local storage and also in server memory. Restarting the backend clears active sessions, so users may need to log in again after a restart.
