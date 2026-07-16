# Milestone 3 Final Map Checklist

## 1. Run the Project

Backend terminal:

```powershell
cd server
npm install
npm start
```

Frontend terminal:

```powershell
cd client
npm install
npm run dev
```

Confirm the public board and map load.

## 2. Complete the Map Walkthrough

Follow the manual checks in `TEST_SUMMARIES.md`.

Minimum items to prove in the video:

1. Public map shows all matching opportunities.
2. Marker popup shows event and organization information.
3. Marker popup opens event details or signup.
4. Filters update the visible markers.
5. Volunteer dashboard maps all joined events.
6. Organization dashboard maps all owned events.
7. Organization form accepts a full street address.
8. Find Address on Map supplies coordinates, or manual coordinates work.
9. A newly created event appears as a new marker.
10. Editing/removing the event updates the maps.

## 3. Demo Accounts

Volunteer:

```text
demo.volunteer@example.com
Password1!
```

Organization:

```text
org.admin@example.com
Password1!
```

## 4. Run Final Tests

```powershell
cd server
npm run test:api
```

Expected:

```text
Checks passed: 31/31 (100%)
API requests made: 43
```

Frontend:

```powershell
cd client
npm run lint
npm run build
```

## 5. Record the Demo

Recommended order:

1. Show the guest board and public map.
2. Open a marker popup and event details.
3. Apply filters and show marker changes.
4. Log in as the volunteer and show the dashboard map/history.
5. Log in as the organization and show its event map.
6. Create a temporary event with a street address.
7. Show the new marker and popup.
8. Edit the event and verify the map update.
9. Show volunteer/status management.
10. Remove the temporary event.
11. Show the 31/31 automated test result.

## 6. Put Final Code in Git

```powershell
git status
git add .
git commit -m "Complete Milestone 3 event mapping"
git branch --show-current
git push
```

Do not commit:

- `node_modules`
- `client/.env`
- `server/.env`
- private API keys or database passwords

## 7. Submission Sanity Check

- Demo video link opens.
- Repository and correct branch open.
- Test summary link opens.
- Release notes mention map/address support.
- Automated result is 31/31.
- The recorded browser shows the maps actually loading.
- Any Google API key is restricted and excluded from Git.
