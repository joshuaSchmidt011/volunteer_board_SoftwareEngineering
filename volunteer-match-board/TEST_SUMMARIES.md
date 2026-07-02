# Test Summaries

## 1. Automated Test Summaries

Automated API testing can be run from the `server` folder while the backend is running.

### How to Run

Terminal 1:

```powershell
cd server
npm start
```

Terminal 2:

```powershell
cd server
npm run test:api
```

The automated test runner checks the main backend features and prints a copy/paste-ready summary at the end.

### Automated Tests Covered

| Area Tested | What the Test Checks | Expected Result |
|---|---|---|
| Health endpoint | Backend reports Milestone 2 status and implemented features | HTTP 200 |
| Guest browsing | Guest users can view opportunities | HTTP 200 and opportunity list returned |
| Guest restrictions | Guest users cannot sign up or open protected dashboards | HTTP 401 |
| Email validation | Bad email format is rejected | HTTP 400 |
| Password validation | Weak passwords are rejected | HTTP 400 |
| Organization registration | Organization accounts require an organization name | HTTP 400 |
| Volunteer registration | Valid volunteer account can be created | HTTP 201 |
| Login security | Wrong password is rejected | HTTP 401 |
| Authenticated profile | Logged-in user can read their profile | HTTP 200 |
| Role protection | Volunteers cannot create opportunities | HTTP 403 |
| Role protection | Organizations cannot sign up for opportunities | HTTP 403 |
| Organization creation | Organization can create a valid opportunity | HTTP 201 |
| Volunteer signup | Volunteer can sign up for an opportunity | HTTP 201 |
| Duplicate signup handling | Same volunteer cannot sign up twice | HTTP 409 |
| Volunteer dashboard | Volunteer dashboard lists signed-up events | HTTP 200 |
| Organization dashboard | Org dashboard lists created events and signed-up volunteers | HTTP 200 |
| Capacity / multiple users | Five volunteers attempt to sign up for an event with two spots | Exactly 2 accepted, 3 blocked |

## 2. Manual Test Summaries

### Manual Test Case 1: Guest Opportunity Browsing

- **Description:** Tested whether a visitor can open the main opportunity board without logging in.
- **Test Input:** Opened the React app in the browser without signing in.
- **Expected Output:** Opportunities are visible, but signup actions are blocked until login.
- **Actual Output:** Opportunities were visible and signup was not available to guests.
- **Pass/Fail:** Pass

### Manual Test Case 2: Volunteer Login and Signup

- **Description:** Tested volunteer account behavior.
- **Test Input:** Logged in as `demo.volunteer@example.com` using `Password1!`, then signed up for an opportunity.
- **Expected Output:** Volunteer can sign up, the event appears in the signed-up row, and the volunteer dashboard lists the event.
- **Actual Output:** Volunteer signup succeeded and dashboard information updated correctly.
- **Pass/Fail:** Pass

### Manual Test Case 3: Duplicate Signup Blocking

- **Description:** Tested whether the same volunteer could sign up for the same event twice.
- **Test Input:** Attempted to sign up for the same opportunity a second time.
- **Expected Output:** The app blocks the duplicate signup.
- **Actual Output:** Duplicate signup was blocked.
- **Pass/Fail:** Pass

### Manual Test Case 4: Organization Login and Event Creation

- **Description:** Tested organization account behavior.
- **Test Input:** Logged in as `org.admin@example.com` using `Password1!`, then created a new opportunity.
- **Expected Output:** Organization can create events but cannot sign up for volunteer events.
- **Actual Output:** Organization event creation worked and volunteer signup actions were not allowed for the organization account.
- **Pass/Fail:** Pass

### Manual Test Case 5: Organization Dashboard

- **Description:** Tested whether organizations can see their own events and the volunteers signed up for those events.
- **Test Input:** Opened the organization dashboard after volunteer signup testing.
- **Expected Output:** Dashboard lists organization-created events and signup details.
- **Actual Output:** Organization dashboard displayed created events and volunteer signup information.
- **Pass/Fail:** Pass

### Manual Test Case 6: Account Creation Validation

- **Description:** Tested input validation for new accounts.
- **Test Input:** Tried to create accounts with a bad email and weak password, then with a valid email and password.
- **Expected Output:** Bad inputs are rejected; valid account is accepted.
- **Actual Output:** Bad inputs were rejected and valid account creation worked.
- **Pass/Fail:** Pass
