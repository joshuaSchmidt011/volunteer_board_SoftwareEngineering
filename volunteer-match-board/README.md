# Volunteer Match Board - Code Milestone 1

Volunteer Match Board is a prototype web application for connecting volunteers with local volunteer opportunities. The long-term goal of the project is to allow organizations to post opportunities, allow volunteers to browse and sign up for events, and eventually support location-based opportunity discovery through Google Maps.

This Code Milestone 1 version focuses on establishing the project foundation. It includes a React frontend, a Node.js/Express backend API, PostgreSQL database support, automatic table creation/seed data, a prototype volunteer signup flow, and a prototype organization/admin opportunity creation flow.

## Current Stack

* React.js frontend using Vite
* Node.js/Express backend
* PostgreSQL database
* `pg` package for PostgreSQL connection support
* Automatic table creation and seed data when the backend connects to PostgreSQL
* In-memory fallback only if the PostgreSQL connection attempt fails
* Planned future Google Maps API integration

## Project Structure

```text
volunteer-match-board-postgres-attempt-first/
├── client/              # React/Vite frontend
├── server/              # Node/Express backend
│   ├── index.js         # API routes
│   ├── db.js            # PostgreSQL connection and table setup
│   ├── schema.sql       # Optional SQL schema reference
│   ├── .env.example     # Example database environment config
│   └── package.json
├── README.md
├── QUICK_START_WINDOWS.md
├── SUBMISSION_TEXT.md
└── .gitignore
```

## Database Setup

This milestone uses PostgreSQL as the main backend data source.

For the local development setup used in this milestone, PostgreSQL was installed locally and connected through the backend server. The backend attempts to connect to PostgreSQL when it starts. If the connection works, the backend automatically creates/checks the required tables and inserts the sample opportunity data.

The expected local database is:

```text
Database name: volunteer_match_board
Username: postgres
Password: postgres
Port: 5432
```

The default local connection string used by the backend is:

```text
postgres://postgres:postgres@localhost:5432/volunteer_match_board
```

A `.env` file may also be created inside the `server/` folder using the format below:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/volunteer_match_board
ALLOW_IN_MEMORY_FALLBACK=true
PORT=5000
```

The real `.env` file should not be uploaded to GitHub because it may contain local database credentials. The included `.env.example` file shows the expected format.

## How to Run the Application

This project uses two terminal windows: one for the backend server and one for the frontend client.

### 1. Start the backend

Open a terminal in the project folder and run:

```bash
cd server
npm install
npm start
```

The backend runs at:

```text
http://localhost:5000
```

When PostgreSQL is connected correctly, the backend terminal should show:

```text
PostgreSQL connection is active. Tables were checked/created automatically.
```

The database status can also be checked at:

```text
http://localhost:5000/api/health
```

A successful PostgreSQL connection will show:

```json
"dataSource": "postgresql"
```

### 2. Start the frontend

Open a second terminal window and run:

```bash
cd client
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

Open that URL in a browser to use the application.

## Useful Backend Routes

```text
GET  http://localhost:5000/
GET  http://localhost:5000/api/health
GET  http://localhost:5000/api/opportunities
GET  http://localhost:5000/api/signups
POST http://localhost:5000/api/signups
POST http://localhost:5000/api/opportunities
POST http://localhost:5000/api/auth/login
```

The `/api/health` route reports whether the backend is connected to PostgreSQL or whether it fell back after a failed PostgreSQL connection attempt.

## Implemented Prototype Features

* React frontend displays the Volunteer Match Board interface.
* Express backend serves API data to the frontend.
* Backend attempts PostgreSQL first on startup.
* PostgreSQL connection is working locally.
* PostgreSQL tables are created/checked automatically when the backend starts.
* Sample opportunity data is inserted into the database.
* Frontend fetches volunteer opportunity data from the backend API.
* Volunteer login area shows where authentication will fit in the application.
* Volunteer signup flow creates signup records.
* Dashboard preview displays current signups.
* Organization/admin prototype allows a new opportunity to be created.
* Backend health endpoint reports the current milestone status and database mode.
* In-memory fallback exists only as a backup if PostgreSQL is unavailable.

## How to Use the Prototype

1. Start the backend server.
2. Start the frontend client.
3. Open the frontend in the browser.
4. Check the milestone status card to confirm the backend/database status.
5. Use the prototype login area.
6. Browse the available volunteer opportunities.
7. Sign up for an opportunity.
8. View the signup in the dashboard preview.
9. Use the organization/admin prototype form to create a new opportunity.
10. Refresh the page to confirm that backend data is still being loaded through the API.

## Planned Future Work

* Add full user registration and login authentication.
* Add organization/admin accounts and permissions.
* Add full volunteer dashboard and signup history.
* Add stronger form validation and error handling.
* Add Google Maps API support for location-based opportunity browsing.
* Add automated tests for API routes and frontend behavior.
* Improve deployment setup for a hosted frontend, hosted backend, and hosted PostgreSQL database.

## Release Notes - Code Milestone 1

For Code Milestone 1, the Volunteer Match Board application includes the initial project setup and a working prototype foundation with PostgreSQL backend support.

### Currently Working

* React/Vite frontend project is set up and runs locally.
* Node.js/Express backend project is set up and runs locally.
* PostgreSQL is installed locally and connected to the backend.
* The backend connects to PostgreSQL using the `pg` package.
* The backend automatically creates/checks the required PostgreSQL tables on startup.
* The backend inserts sample opportunity data into PostgreSQL.
* The frontend loads opportunity data from the backend API.
* The backend includes API routes for health status, opportunities, signups, opportunity creation, and prototype login.
* The application includes a landing page and basic page structure for the Volunteer Match Board.
* The application includes a prototype volunteer login area.
* The application includes a prototype opportunity board.
* The application includes a prototype volunteer signup flow.
* The application includes a dashboard preview showing current signups.
* The application includes a prototype organization/admin form for adding a sample opportunity.
* The application includes a placeholder area for the planned Google Maps integration.
* The backend includes an in-memory fallback only as a backup if PostgreSQL is unavailable.

### Not Yet Completed

* Full user authentication is not complete yet.
* Organization/admin account permissions are not complete yet.
* Full volunteer dashboard and signup history are not complete yet.
* Google Maps API integration is not complete yet.
* Automated tests will be expanded in later milestones.
* Production deployment is not complete yet.

### Notes

This milestone is consistent with the project plan because Code Milestone 1 was planned as the initial project setup, basic page structure, database connection work, and possible login/register prototype. The project now includes a working React frontend, a Node/Express backend, and a PostgreSQL-backed data layer. The backend attempts PostgreSQL first on startup and reports the database status through the `/api/health` endpoint. The current implementation is still a prototype, but it establishes the main structure needed for later milestones.
