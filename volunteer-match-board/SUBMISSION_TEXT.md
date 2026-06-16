Demo Video Link:
[PASTE VIDEO LINK HERE]

Source Code Branch:
main

Release Notes - Code Milestone 1

For Code Milestone 1, the Volunteer Match Board application includes the initial project setup and a working prototype foundation.

Currently Working:
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

Not Yet Completed:
- Full user authentication is not complete yet.
- PostgreSQL persistent database storage is not complete yet.
- Organization/admin account permissions are not complete yet.
- Full volunteer dashboard and signup history are not complete yet.
- Google Maps API integration is not complete yet.
- Automated tests will be expanded in later milestones.

Notes:
This milestone is mostly consistent with the project plan because Code Milestone 1 was planned as the initial project setup, basic page structure, database connection work, and possible login/register prototype. The one difference is that PostgreSQL is not fully connected in this version. Instead, the application uses in-memory seed data so the frontend and backend can be demonstrated locally without additional database setup. The persistent PostgreSQL integration is planned for a later milestone.
