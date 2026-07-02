# Volunteer Match Board - Code Milestone 2 Submission Text

For Code Milestone 2, our project expands the Volunteer Match Board from a basic opportunity listing prototype into a more complete role-based web application.

The application now opens to a public opportunity board where guests can browse and search available volunteer events without logging in. Guests are not allowed to sign up for opportunities until they create or log into a volunteer account.

We added a real account flow with separate volunteer and organization roles. The registration form checks for a valid email format and enforces password requirements, including minimum length, uppercase letter, number, and special character. The backend stores passwords as salted hashes using Node crypto instead of storing plaintext passwords.

Volunteer accounts can sign up for opportunities. The backend prevents duplicate signups and checks whether an event has open spots. Once a volunteer logs in, the main page shows a horizontal row of the events they already signed up for, and the volunteer dashboard provides a more detailed card-based list of all of their signed-up events.

Organization accounts have a separate dashboard. Organizations can create and post new opportunities, but they cannot sign up for volunteer events. The organization dashboard lists the opportunities created by that organization and shows the volunteers who have signed up for each event.

The backend uses Node.js and Express. PostgreSQL support is included through `DATABASE_URL`, with a Milestone 2 schema file that creates users, opportunities, and signups tables. If PostgreSQL is not configured, the project falls back to in-memory demo data so the app can still run during a class demo.

Major Milestone 2 additions:

- Public guest opportunity browsing
- Searchable opportunity board
- Volunteer and organization account roles
- Email validation
- Password complexity validation
- Salted password hashing
- Protected volunteer-only signup route
- Protected organization-only opportunity creation route
- Volunteer dashboard
- Organization dashboard
- Organization event signup lists
- PostgreSQL schema updated for users, role-based opportunities, and signups
- In-memory fallback preserved for easier testing

Demo accounts:

- Volunteer: `demo.volunteer@example.com` / `Password1!`
- Organization: `org.admin@example.com` / `Password1!`
