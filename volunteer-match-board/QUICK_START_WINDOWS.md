# Quick Start on Windows

## Backend

Open a terminal in the project folder:

```powershell
cd server
npm install
npm start
```

The backend runs at:

```text
http://localhost:5000
```

Check the health endpoint in your browser:

```text
http://localhost:5000/api/health
```

## Frontend

Open a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal. It is usually:

```text
http://localhost:5173
```

## Demo Login

Volunteer account:

```text
demo.volunteer@example.com
Password1!
```

Organization account:

```text
org.admin@example.com
Password1!
```

## PostgreSQL Optional Setup

The project runs without PostgreSQL by using in-memory fallback data.

To use PostgreSQL:

1. Create a database named `volunteer_match_board`.
2. Copy `server/.env.example` to `server/.env`.
3. Update `DATABASE_URL` in `.env`.
4. From the `server` folder, run:

```powershell
psql -U postgres -d volunteer_match_board -f schema.sql
```

Then restart the backend.
