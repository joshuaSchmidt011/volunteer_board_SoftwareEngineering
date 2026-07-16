# Release Notes - Code Milestone 3 Final Map Update

**Project:** Volunteer Match Board  
**Team:** Team 9 - Joshua Schmidt and Jacob Linke  
**Release:** Version 3.1.0 / Code Milestone 3 Final  
**Date:** July 16, 2026

## Release Overview

The final Milestone 3 update adds complete event addresses and interactive mapping to the public board, volunteer dashboard, organization dashboard, and event details page. It also updates the API, PostgreSQL schema, seed data, forms, automated tests, and documentation to carry map coordinates through every workflow.

## New Map and Address Features

- Added `address`, `latitude`, and `longitude` to every opportunity.
- Added an interactive map of filtered events to the public opportunity board.
- Added marker popups showing event name, organization, date/time, address, open spots, and event/signup actions.
- Added a single-event map to the opportunity details page.
- Added a volunteer dashboard map containing all confirmed and historical signup locations.
- Added an organization dashboard map containing all events owned by the organization.
- Added a street-address field to the organization create/edit form.
- Added **Find Address on Map** geocoding before an event is created or updated.
- Added manual coordinate fields as a fallback when online geocoding is unavailable.
- Added optional Google Maps JavaScript API support through `VITE_GOOGLE_MAPS_API_KEY`.
- Added a keyless Leaflet/OpenStreetMap renderer so the project can be demonstrated immediately.
- Added optional Google server-side geocoding and a default low-volume Nominatim lookup.

## Existing Milestone 3 Features Retained

- Keyword, category, location, and availability filtering.
- Complete opportunity details.
- Volunteer signup, duplicate prevention, and capacity enforcement.
- Volunteer current signup and participation-history sections.
- Organization create, edit, remove, ownership enforcement, volunteer lists, and participation status controls.
- PostgreSQL support with an in-memory demonstration fallback.

## Testing Changes

- Expanded the backend suite to **31 checks and 43 API requests**.
- Added assertions that public event details include valid addresses and coordinates.
- Added mapped-address checks to organization creation/editing and volunteer dashboard data.
- Added protection testing for the organization-only geocoding endpoint.
- Final automated result: **31/31 checks passed (100%)**.
- Frontend ESLint passed.
- Frontend Vite production build passed.

## Known Limitations

- The saved automated suite verifies map-ready data but does not depend on a live third-party geocoding service.
- Online map tiles and address lookup require internet access.
- Google Maps requires the team to provide and restrict its own API key; otherwise, the app uses the built-in OpenStreetMap fallback.
- In-memory sessions and fallback data reset when the backend restarts.
- The saved automated run used the in-memory fallback rather than PostgreSQL.
- A visual browser walkthrough is still required on the computer used for the recorded demonstration.
