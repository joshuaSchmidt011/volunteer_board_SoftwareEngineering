# Volunteer Match Board - Code Milestone 1

Volunteer Match Board is a prototype web application for connecting volunteers with local volunteer opportunities. The long-term project goal is to allow organizations to post opportunities, allow volunteers to browse and sign up for events, and eventually support location-based discovery through Google Maps.

This Code Milestone 1 version focuses on getting the project foundation running. It includes a React frontend, a Node.js/Express backend API, seed opportunity data, a prototype volunteer signup flow, and a prototype organization/admin opportunity creation flow.

## Current Stack

- React.js frontend using Vite
- Node.js/Express backend
- In-memory seed data for Milestone 1
- Planned future PostgreSQL integration
- Planned future Google Maps API integration

## Project Structure

```text
volunteer-match-tech-exercise/
├── client/       # React/Vite frontend
├── server/       # Node/Express backend
├── README.md     # Project overview, setup instructions, and release notes
└── .gitignore
```

## How to Run the Application

This project uses two terminal windows: one for the backend server and one for the frontend client.

### 1. Start the backend

```bash
cd server
npm install
npm start
```

The backend runs at:

```text
http://localhost:5000
```

Useful backend routes:

```text
GET  http://localhost:5000/
GET  http://localhost:5000/api/health
GET  http://localhost:5000/api/opportunities
GET  http://localhost:5000/api/signups
POST http://localhost:5000/api/signups
POST http://localhost:5000/api/opportunities
POST http://localhost:5000/api/auth/login
```

### 2. Start the frontend

Open a second terminal window:

```bash
cd client
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

## How to Use the Prototype

1. Start the backend server.
2. Start the frontend client.
3. Open the frontend URL in a browser.
4. Use the Volunteer Login Preview to run the prototype login.
5. View the list of volunteer opportunities loaded from the backend API.
6. Select an opportunity and use the signup button to create a prototype signup.
7. View the Current Signups dashboard preview.
8. Use the Organization Admin Prototype form to create a new sample opportunity.

## Implemented Prototype Features

- React frontend displays the Volunteer Match Board interface.
- Express backend serves API data to the frontend.
- Frontend fetches volunteer opportunity data from the backend.
- Volunteer login area shows where authentication will fit in the application.
- Volunteer signup flow creates in-memory signup records.
- Dashboard preview displays current signups.
- Organization/admin prototype allows a new opportunity to be created during the running session.
- Backend health endpoint reports the current milestone status.

## Planned Future Work

- Add persistent PostgreSQL database storage.
- Add real user registration and login authentication.
- Add organization/admin accounts and permissions.
- Add full volunteer dashboard and signup history.
- Add Google Maps API support for location-based opportunity browsing.
- Add automated tests for API routes and frontend behavior.
- Improve validation, error handling, and deployment setup.

## Release Notes - Code Milestone 1

For Code Milestone 1, the Volunteer Match Board application includes the initial project setup and a working prototype foundation.

### Currently Working

- React/Vite frontend project is set up and runs locally.
- Node.js/Express backend project is set up and runs locally.
- The frontend loads opportunity data from the backend API.
- The backend includes API routes for health status, opportunities, signups, and prototype login.
- The application includes a landing page and basic page structure for the Volunteer Match Board.
- The application includes a prototype volunteer login area.
- The application includes a prototype opportunity board.
- The application includes a prototype volunteer signup flow using in-memory data.
- The application includes a dashboard preview showing current signups.
- The application includes a prototype organization/admin form for adding a sample opportunity.
- The application includes a placeholder area for the planned Google Maps integration.

### Not Yet Completed

- Full user authentication is not complete yet.
- PostgreSQL persistent database storage is not complete yet.
- Organization/admin account permissions are not complete yet.
- Full volunteer dashboard and signup history are not complete yet.
- Google Maps API integration is not complete yet.
- Automated tests will be expanded in later milestones.

### Notes

This milestone is mostly consistent with the project plan because Code Milestone 1 was planned as the initial project setup, basic page structure, database connection work, and possible login/register prototype. The one difference is that PostgreSQL is not fully connected in this version. Instead, the application uses in-memory seed data so the frontend and backend can be demonstrated locally without additional database setup. The persistent PostgreSQL integration is planned for a later milestone.
