# Volunteer Match Board - Milestone 3 Final Test Summaries

**Test date:** July 16, 2026  
**Tested release:** Version 3.1.0 / Code Milestone 3 Final Map Update  
**Automated backend data source:** In-memory fallback

## 1. Final Result Summary

| Verification | Result | Evidence |
|---|---:|---|
| Automated API checks | **31/31 passed (100%)** | `TEST_RUN_OUTPUT.txt` |
| API requests completed | **43** | `TEST_RUN_OUTPUT.txt` |
| Average API response time | **20.9 ms** | `TEST_RUN_OUTPUT.txt` |
| Capacity simulation | **2 accepted, 3 blocked for 2 available spots** | `TEST_RUN_OUTPUT.txt` |
| Frontend ESLint | **Passed** | `npm run lint` |
| Frontend production build | **Passed** | `npm run build` |

No automated check failed during the saved final run.

## 2. Automated Coverage

Run the backend first:

```powershell
cd server
npm start
```

Then run:

```powershell
cd server
npm run test:api
```

| Area | Tests Performed | Result |
|---|---|---:|
| Startup and health | Confirmed Milestone 3 metadata, data source, and feature list | Pass |
| Public browsing | Confirmed guests can load seeded opportunities | Pass |
| Filtering | Confirmed category and full-availability filters | Pass |
| Map-ready event details | Confirmed event details include street address, latitude, and longitude | Pass |
| Geocoding access control | Confirmed guests cannot use the organization-only address lookup | Pass |
| Registration validation | Rejected invalid email, weak password, and organization account without an organization name | Pass |
| Authentication | Created users, rejected a wrong password, and returned authenticated profiles | Pass |
| Role access | Blocked volunteers from organization actions and organizations from volunteer signup | Pass |
| Organization create | Created an event with category, address, and valid coordinates | Pass |
| Public details | Confirmed created event address/coordinates were returned correctly | Pass |
| Volunteer signup | Created an available signup | Pass |
| Duplicate prevention | Rejected a duplicate volunteer signup | Pass |
| Organization dashboard | Returned organization events and volunteer signup information | Pass |
| Participation tracking | Changed signup status to completed | Pass |
| Volunteer history map data | Confirmed completed dashboard records include address and coordinates | Pass |
| Organization edit | Updated event content, address, and coordinates | Pass |
| Public update | Confirmed the edited map data was reflected publicly | Pass |
| Ownership protection | Prevented another organization from editing the event | Pass |
| Organization remove | Removed an event and confirmed it returned 404 afterward | Pass |
| Capacity enforcement | Five volunteers attempted two spots; exactly two succeeded | Pass |

The full request-by-request output is in `TEST_RUN_OUTPUT.txt`.

## 3. Frontend Verification

```powershell
cd client
npm run lint
npm run build
```

Both commands passed. This confirms that the React source satisfies the configured lint rules and compiles into a production bundle, including the Leaflet map dependency and optional Google Maps loader.

## 4. Required Manual Browser Walkthrough

The automated suite verifies the API and map data but cannot prove that third-party map tiles and online address lookup display correctly on the submission computer. Complete these checks before recording.

| ID | Manual Check | Expected Result | Final Observation |
|---|---|---|---|
| M3-UI-01 | Open the landing board as a guest | Opportunity cards and the public event map load | Verify before recording |
| M3-UI-02 | Select a public map marker | Popup shows event, organization, schedule, address, and actions | Verify before recording |
| M3-UI-03 | Apply category/location/availability filters | Cards and visible map markers update together | Verify before recording |
| M3-UI-04 | Open View Event from a card or marker | Full details and single-event map appear | Verify before recording |
| M3-UI-05 | Log in as demo volunteer and open My Dashboard | Two seeded signup locations appear on the volunteer map | Verify before recording |
| M3-UI-06 | Select a volunteer-dashboard marker | Popup links back to the correct event details | Verify before recording |
| M3-UI-07 | Log in as the demo organization | Organization map shows only its owned events | Verify before recording |
| M3-UI-08 | Enter a new street address and click Find Address on Map | Coordinates are filled or a clear manual-coordinate fallback is offered | Verify before recording |
| M3-UI-09 | Create and edit the mapped event | New/updated marker and address appear in organization and public views | Verify before recording |
| M3-UI-10 | Remove the temporary event | Event card and marker disappear | Verify before recording |
| M3-UI-11 | Select a marker as a volunteer | Signup button works or correctly shows Already Signed Up / Full | Verify before recording |
| M3-UI-12 | Resize the browser | Maps, filters, forms, and cards remain usable | Verify before recording |

## 5. Environment Notes

- The saved automated run used the in-memory fallback because PostgreSQL was not configured.
- The automated suite deliberately supplied known coordinates rather than depending on an external geocoding service.
- The default map renderer is Leaflet/OpenStreetMap. An actual Google map is used when `VITE_GOOGLE_MAPS_API_KEY` is configured.
- Online address lookup uses a Google server key when configured or the Nominatim fallback otherwise.
- Manual latitude/longitude entry allows event creation when online address lookup is unavailable.
- Temporary sessions and in-memory records reset when the backend restarts.
