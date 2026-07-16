# Code Milestone 3 - Textbox Submission

1. **Demo video:** https://unomaha.yuja.com/V/Video?v=16589424&node=70701464&a=204060324

2. **Source-code repository branch:** https://github.com/joshuaSchmidt011/volunteer_board_SoftwareEngineering

3. **Release Notes:**

The final Code Milestone 3 release completes the Volunteer Match Board dashboards, volunteer history, organization management, filtering, event-address, and interactive-map functionality. Every opportunity now stores a city/state, complete street address, latitude, and longitude. The public board maps all filtered opportunities, and marker popups show the event name, organization, schedule, address, open spots, and links to view the event or sign up. The opportunity details page also includes a location map.

The volunteer dashboard maps every confirmed or completed event the volunteer joined. The organization dashboard maps all events owned by that organization. Organization users can create or edit an event by entering a street address and using Find Address on Map, with manual coordinates available as a fallback. Existing Milestone 3 role restrictions, opportunity ownership, duplicate prevention, capacity enforcement, participation statuses, volunteer history, edit/remove controls, and PostgreSQL support remain included.

The default build uses a keyless Leaflet/OpenStreetMap map so it can be demonstrated immediately. It can switch to Google Maps when a browser API key is configured. The final automated API suite executed 31 checks across 43 requests and passed 31/31 checks. Frontend ESLint and the Vite production build also passed. The saved automated run used the in-memory fallback; the final browser walkthrough should verify map tiles and address lookup on the submission computer.

4. **Test Summaries file:** https://uofnebraska-my.sharepoint.com/:t:/r/personal/37289030_nebraska_edu/Documents/CSCI4830-TeamFolder/DeliverablesFolder/Test_run%20output.txt?csf=1&web=1&e=gfre16

https://uofnebraska-my.sharepoint.com/:t:/r/personal/37289030_nebraska_edu/Documents/CSCI4830-TeamFolder/DeliverablesFolder/TEST_SUMMARIES_M3.md?csf=1&web=1&e=gTg7Jh


5. **AI-use explanation:**

ChatGPT was used as a development assistant for code comprehension, implementation support, debugging, and test generation. ChatGPT was allso used to build test/mock data to be place holder for real data down the line. The AI tool used was ChatGPT.


