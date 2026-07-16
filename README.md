# Volunteer Match Board - Code Milestone 3 Final Map Update

Volunteer Match Board is a React/Vite and Node/Express application that connects volunteers with organizations offering community-service events. The final Milestone 3 update adds complete street addresses, geocoded coordinates, and interactive event maps throughout the application.

The project supports PostgreSQL when `DATABASE_URL` is configured and an in-memory fallback for fast classroom demonstrations.

## Final Feature Summary

### Public Opportunity Board

- Guests can browse opportunities without an account.
- Users can search by title, organization, skill, city, or street address.
- Users can filter by category, location, and availability.
- Every matching event appears on an interactive map.
- Selecting a marker opens a popup with the event name, organization, date, time, address, open spots, a **View Event** action, and a signup action when appropriate.
- Each opportunity has a full details page with its own location map.

### Volunteer Features

- Volunteers can sign up for opportunities with available capacity.
- Duplicate and over-capacity signups are blocked.
- The volunteer dashboard separates upcoming signups from participation history.
- The dashboard map displays every event the volunteer has joined, including completed events.
- Map markers link back to the complete event details.

The seeded demo volunteer already has one confirmed signup and one completed event so the dashboard map and history can be demonstrated immediately.

### Organization Features

- Organization users can create, edit, and remove their own opportunities.
- Event forms now require a city/state and full street address.
- **Find Address on Map** converts the address to latitude and longitude before the event is saved.
- Manual latitude and longitude fields are available as an offline fallback.
- The organization dashboard map displays all events posted by that organization.
- Organizations can view volunteer names/emails and update participation status.
- Ownership checks prevent organizations from modifying another organization's events.

### Map Providers and Geocoding

The project works immediately without a Google key:

- **Default map:** OpenStreetMap/Leaflet fallback
- **Default address lookup:** low-volume OpenStreetMap Nominatim lookup
- **Optional map:** Google Maps JavaScript API when `VITE_GOOGLE_MAPS_API_KEY` is configured
- **Optional address lookup:** Google Geocoding API when `GOOGLE_MAPS_GEOCODING_API_KEY` is configured on the server

This design makes the classroom demo usable without account setup while still supporting an actual Google Map when a key is available.

## Project Structure

```text
Volunteer_Match_Board_Milestone_3_Map_Final/
├── client/
│   ├── src/App.jsx             # Pages, forms, dashboards, and workflows
│   ├── src/EventMap.jsx        # Google Maps / Leaflet map component and popups
│   ├── src/App.css             # Application, map, and responsive styling
│   ├── .env.example            # Optional Google Maps browser key
│   └── package.json
├── server/
│   ├── index.js                # Express API, geocoding, auth, and business rules
│   ├── db.js                   # PostgreSQL connection helper
│   ├── schema.sql              # Address/coordinate schema and seed data
│   ├── api-test.mjs            # Automated Milestone 3 API suite
│   ├── .env.example            # Database and optional Google geocoding settings
│   └── package.json
├── RELEASE_NOTES.md
├── TEST_SUMMARIES.md
├── TEST_RUN_OUTPUT.txt
├── MILESTONE_3_CHECKLIST.md
├── QUICK_START_WINDOWS.md
└── SUBMISSION_TEXT.md
```

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Volunteer | `demo.volunteer@example.com` | `Password1!` |
| Organization | `org.admin@example.com` | `Password1!` |
| Second organization | `parks.admin@example.com` | `Password1!` |

## Fast Demo Setup

### Backend

```powershell
cd server
npm install
npm start
```

The API runs at `http://localhost:5000`.

### Frontend

Open a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

No map key is required for the default interactive map.

## Optional Google Maps Setup

Inside the `client` folder:

```powershell
copy .env.example .env
```

Then place a browser-restricted Maps JavaScript API key in `client/.env`:

```text
VITE_GOOGLE_MAPS_API_KEY=your_browser_key_here
```

Restart `npm run dev` after changing the environment file.

To use Google for server-side address lookup as well, copy `server/.env.example` to `server/.env` and set:

```text
GOOGLE_MAPS_GEOCODING_API_KEY=your_server_geocoding_key_here
```

Without that server key, the project uses its built-in Nominatim lookup and still allows coordinates to be entered manually.

## PostgreSQL Setup

1. Create a database named `volunteer_match_board`.
2. Copy `server/.env.example` to `server/.env`.
3. Set `DATABASE_URL`.
4. Run the schema.

```powershell
cd server
copy .env.example .env
psql -U postgres -d volunteer_match_board -f schema.sql
npm start
```

`schema.sql` drops and recreates the demo tables, including the new `address`, `latitude`, and `longitude` columns.

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

- `POST /api/geocode`
- `POST /api/opportunities`
- `PUT /api/opportunities/:id`
- `DELETE /api/opportunities/:id`
- `GET /api/org/opportunities`
- `PATCH /api/org/signups/:id/status`

## Verification

Backend API suite:

```powershell
cd server
npm run test:api
```

Frontend checks:

```powershell
cd client
npm run lint
npm run build
```

Saved final result:

- **31/31 automated checks passed**
- **43 API requests completed**
- Frontend ESLint passed
- Frontend production build passed

The saved automated run used the in-memory fallback and did not make an external geocoding request. Address/coordinate persistence and map-ready API data were tested directly. A final browser walkthrough should verify the selected map provider and online address lookup on the submission computer.
