# Volunteer Match Board Milestone 3 - Final Map Test on Windows

## 1. Start the Backend

From the final project folder:

```powershell
cd server
npm install
npm start
```

Leave that terminal open. A successful start reports:

```text
Volunteer Match Board API running at http://localhost:5000
DATABASE_URL not configured. Using in-memory fallback data.
```

## 2. Start the Frontend

Open a second VS Code terminal:

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

The default interactive map does not need an API key.

## 3. Public Map Test

1. Scroll to **Map of Matching Opportunities**.
2. Confirm four markers appear.
3. Select a marker.
4. Confirm the popup shows the event, organization, date/time, address, and **View Event** / signup action.
5. Change a filter and confirm both the cards and map markers update.
6. Open **View Event** and confirm the details page has a single-event map.

## 4. Volunteer Dashboard Map Test

Log in with:

```text
demo.volunteer@example.com
Password1!
```

Open **My Dashboard**.

Confirm:

- The map displays the seeded confirmed and completed events.
- Selecting a marker shows event information and a **View Event** action.
- Upcoming Signups includes Food Bank Helper.
- Volunteer History includes Animal Shelter Assistant.
- Full street addresses appear in the dashboard cards.

## 5. Organization Map and Address Test

Log out and use:

```text
org.admin@example.com
Password1!
```

Open **Org Dashboard**.

Confirm:

- The organization map shows its existing events.
- The create/edit form includes **City / State**, **Street Address**, and **Find Address on Map**.
- Existing event cards display their full addresses.

Create a temporary test event using a real address. Example:

```text
Title: Final Map Test Event
Category: Community Support
City / State: Omaha, NE
Street Address: 455 N 10th Street, Omaha, NE 68102
Date: August 15, 2026
Time: 10:00 AM - 12:00 PM
Description: Temporary event used to verify the final map workflow.
Capacity: 5
```

Click **Find Address on Map**. A successful lookup displays mapped coordinates. Then click **Post Opportunity** and confirm the new marker appears on the organization and public maps.

If online address lookup is unavailable, expand **Advanced: enter map coordinates manually** and use:

```text
Latitude: 41.2649
Longitude: -95.9284
```

Edit the temporary event, confirm the address and marker update, then remove it.

## 6. Automated Tests

Keep the backend running and use another terminal:

```powershell
cd server
npm run test:api
```

Expected summary:

```text
Checks passed: 31/31 (100%)
API requests made: 43
```

## 7. Frontend Verification

```powershell
cd client
npm run lint
npm run build
```

Both commands should complete without an error.

## Optional Actual Google Map

The project automatically uses OpenStreetMap when no Google key is present. To switch the map renderer to Google Maps:

```powershell
cd client
copy .env.example .env
```

Add the key to `client/.env`:

```text
VITE_GOOGLE_MAPS_API_KEY=your_browser_key_here
```

Restart the frontend after saving the file.
