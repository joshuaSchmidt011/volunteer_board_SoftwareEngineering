const BASE_URL = process.env.VMB_TEST_BASE_URL || "http://localhost:5000";
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const requestLog = [];
const checks = [];
let healthData = null;
let concurrencyStats = null;

function msRound(value) {
  return Math.round(value * 100) / 100;
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiRequest(label, method, path, body = undefined, token = undefined) {
  const started = performance.now();
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token)
    }
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response;
  let text;
  let data;

  try {
    response = await fetch(`${BASE_URL}${path}`, options);
    text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  } catch (error) {
    const elapsed = msRound(performance.now() - started);
    requestLog.push({ label, method, path, status: "NETWORK_ERROR", ms: elapsed });
    throw new Error(`${label}: could not reach ${BASE_URL}. Is the backend running? ${error.message}`);
  }

  const elapsed = msRound(performance.now() - started);
  requestLog.push({ label, method, path, status: response.status, ms: elapsed });
  return { response, data, status: response.status, ms: elapsed };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function check(name, fn) {
  const started = performance.now();
  try {
    const detail = await fn();
    checks.push({ name, passed: true, ms: msRound(performance.now() - started), detail: detail || "Passed" });
  } catch (error) {
    checks.push({ name, passed: false, ms: msRound(performance.now() - started), detail: error.message });
  }
}

async function registerUser({ name, email, password = "Password1!", role = "volunteer", organizationName = "" }) {
  return apiRequest(`Register ${role}: ${email}`, "POST", "/api/auth/register", {
    name,
    email,
    password,
    role,
    organizationName
  });
}

function makeVolunteer(index) {
  return {
    name: `Capacity Volunteer ${index}`,
    email: `capacity-volunteer-${runId}-${index}@example.com`,
    password: "Password1!",
    role: "volunteer"
  };
}

function printRequestTable() {
  console.log("\nRequest timing details:");
  console.log("#  Status   Time(ms)  Method  Path                                      Label");
  requestLog.forEach((entry, index) => {
    const row = [
      String(index + 1).padEnd(2),
      String(entry.status).padEnd(8),
      String(entry.ms).padEnd(8),
      entry.method.padEnd(6),
      entry.path.padEnd(41),
      entry.label
    ];
    console.log(row.join("  "));
  });
}

function buildSummary() {
  const totalChecks = checks.length;
  const passedChecks = checks.filter((item) => item.passed).length;
  const failedChecks = totalChecks - passedChecks;
  const passRate = totalChecks ? msRound((passedChecks / totalChecks) * 100) : 0;
  const responseTimes = requestLog.filter((entry) => typeof entry.ms === "number").map((entry) => entry.ms);
  const averageResponseTime = responseTimes.length
    ? msRound(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
    : 0;
  const fastest = responseTimes.length ? Math.min(...responseTimes) : 0;
  const slowest = responseTimes.length ? Math.max(...responseTimes) : 0;
  const statusCounts = requestLog.reduce((counts, entry) => {
    counts[entry.status] = (counts[entry.status] || 0) + 1;
    return counts;
  }, {});

  return {
    totalChecks,
    passedChecks,
    failedChecks,
    passRate,
    requestsMade: requestLog.length,
    averageResponseTime,
    fastest,
    slowest,
    statusCounts
  };
}

async function main() {
  console.log("Volunteer Match Board Milestone 3 API Test Run");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Started: ${new Date().toLocaleString()}`);

  let volunteerToken;
  let volunteerUser;
  let orgToken;
  let orgUser;
  let nonOwnerOrgToken;
  let createdOpportunity;
  let createdSignup;
  let capacityOpportunity;

  await check("Health endpoint returns Milestone 3 metadata", async () => {
    const { status, data } = await apiRequest("Health check", "GET", "/api/health");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.milestone === "Code Milestone 3", "Health endpoint did not report Code Milestone 3.");
    healthData = data;
    return `Data source: ${data?.dataSource}; features listed: ${data?.implementedFeatures?.length || 0}`;
  });

  await check("Guests can browse opportunities", async () => {
    const { status, data } = await apiRequest("Guest browse opportunities", "GET", "/api/opportunities");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(Array.isArray(data) && data.length >= 1, "Expected seed opportunities.");
    return `Guest saw ${data.length} opportunities.`;
  });

  await check("Opportunity category filtering works", async () => {
    const { status, data } = await apiRequest("Filter by category", "GET", "/api/opportunities?category=Environment");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data.length >= 1, "Expected at least one Environment opportunity.");
    assertCondition(data.every((item) => item.category === "Environment"), "Category filter returned a mismatched result.");
    return `Returned ${data.length} Environment opportunity/opportunities.`;
  });

  await check("Opportunity details endpoint returns complete data", async () => {
    const { status, data } = await apiRequest("Read opportunity details", "GET", "/api/opportunities/1");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.title && data?.description && data?.category && Array.isArray(data?.requirements), "Details response was incomplete.");
    assertCondition(data?.address && Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude), "Details response did not include a mapped address.");
    return `Loaded details and map coordinates for ${data.title}.`;
  });

  await check("Guests cannot sign up without logging in", async () => {
    const { status } = await apiRequest("Guest blocked from signup", "POST", "/api/signups", { opportunityId: 1 });
    assertCondition(status === 401, `Expected 401, got ${status}`);
    return "Unauthenticated signup correctly returned 401.";
  });

  await check("Protected volunteer dashboard blocks guests", async () => {
    const { status } = await apiRequest("Guest blocked from volunteer dashboard", "GET", "/api/me/signups");
    assertCondition(status === 401, `Expected 401, got ${status}`);
    return "Unauthenticated dashboard access correctly returned 401.";
  });

  await check("Organization-only geocoding endpoint blocks guests", async () => {
    const { status } = await apiRequest("Guest blocked from geocoding", "POST", "/api/geocode", { address: "10525 J Street, Omaha, NE" });
    assertCondition(status === 401, `Expected 401, got ${status}`);
    return "Unauthenticated address geocoding correctly returned 401.";
  });

  await check("Registration rejects invalid email format", async () => {
    const { status } = await registerUser({ name: "Bad Email", email: "not-an-email" });
    assertCondition(status === 400, `Expected 400, got ${status}`);
    return "Invalid email was rejected.";
  });

  await check("Registration rejects weak passwords", async () => {
    const { status } = await registerUser({
      name: "Weak Password",
      email: `weak-${runId}@example.com`,
      password: "password"
    });
    assertCondition(status === 400, `Expected 400, got ${status}`);
    return "Weak password was rejected.";
  });

  await check("Organization registration requires an organization name", async () => {
    const { status } = await registerUser({
      name: "Missing Org",
      email: `missing-org-${runId}@example.com`,
      role: "org"
    });
    assertCondition(status === 400, `Expected 400, got ${status}`);
    return "Missing organization name was rejected.";
  });

  await check("Valid volunteer registration succeeds", async () => {
    const { status, data } = await registerUser({
      name: "Milestone Three Volunteer",
      email: `auto-volunteer-${runId}@example.com`
    });
    assertCondition(status === 201, `Expected 201, got ${status}`);
    assertCondition(data?.user?.role === "volunteer" && data?.token, "Volunteer response did not include user/token.");
    volunteerToken = data.token;
    volunteerUser = data.user;
    return `Created volunteer id ${volunteerUser.id}.`;
  });

  await check("Wrong password login is rejected", async () => {
    const { status } = await apiRequest("Wrong password login", "POST", "/api/auth/login", {
      email: volunteerUser.email,
      password: "WrongPassword1!"
    });
    assertCondition(status === 401, `Expected 401, got ${status}`);
    return "Wrong password correctly returned 401.";
  });

  await check("Authenticated volunteer can read their profile", async () => {
    const { status, data } = await apiRequest("Read current user", "GET", "/api/auth/me", undefined, volunteerToken);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.user?.id === volunteerUser.id, "Profile did not match registered volunteer.");
    return `Profile returned ${data.user.email}.`;
  });

  await check("Volunteer cannot create an organization opportunity", async () => {
    const { status } = await apiRequest("Volunteer blocked from create", "POST", "/api/opportunities", {
      title: "Blocked Event",
      category: "Testing",
      location: "Test City",
      address: "100 Test Street, Test City, NE 68000",
      latitude: 41.25,
      longitude: -96.0,
      date: "August 1, 2026",
      description: "Should not be created",
      spotsTotal: 2
    }, volunteerToken);
    assertCondition(status === 403, `Expected 403, got ${status}`);
    return "Volunteer create action correctly returned 403.";
  });

  await check("Valid organization registration succeeds", async () => {
    const { status, data } = await registerUser({
      name: "Milestone Three Admin",
      email: `auto-org-${runId}@example.com`,
      role: "org",
      organizationName: "Automated Test Organization"
    });
    assertCondition(status === 201, `Expected 201, got ${status}`);
    assertCondition(data?.user?.role === "org" && data?.token, "Organization response did not include user/token.");
    orgToken = data.token;
    orgUser = data.user;
    return `Created organization user id ${orgUser.id}.`;
  });

  await check("Organization cannot sign up as a volunteer", async () => {
    const { status } = await apiRequest("Org blocked from signup", "POST", "/api/signups", { opportunityId: 1 }, orgToken);
    assertCondition(status === 403, `Expected 403, got ${status}`);
    return "Organization signup correctly returned 403.";
  });

  await check("Volunteer cannot open organization dashboard", async () => {
    const { status } = await apiRequest("Volunteer blocked from org dashboard", "GET", "/api/org/opportunities", undefined, volunteerToken);
    assertCondition(status === 403, `Expected 403, got ${status}`);
    return "Volunteer org dashboard access correctly returned 403.";
  });

  await check("Organization creates a categorized opportunity", async () => {
    const { status, data } = await apiRequest("Org creates opportunity", "POST", "/api/opportunities", {
      title: "Milestone 3 Community Event",
      category: "Community Support",
      location: "Omaha, NE",
      address: "2222 North 24th Street, Omaha, NE 68110",
      latitude: 41.2806,
      longitude: -95.9479,
      date: "August 3, 2026",
      time: "9:00 AM - 12:00 PM",
      description: "An automated test opportunity for edit, signup, status, and removal workflows.",
      requirements: ["Bring water"],
      skills: ["Teamwork"],
      spotsTotal: 3
    }, orgToken);
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.category === "Community Support", "Created opportunity category was missing.");
    assertCondition(data?.address && Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude), "Created opportunity was missing map data.");
    createdOpportunity = data;
    return `Created opportunity id ${createdOpportunity.id}.`;
  });

  await check("New opportunity can be opened on its details endpoint", async () => {
    const { status, data } = await apiRequest("Read created opportunity", "GET", `/api/opportunities/${createdOpportunity.id}`);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.title === createdOpportunity.title && data?.spotsOpen === 3, "Created opportunity details were incorrect.");
    assertCondition(data?.address === createdOpportunity.address && data?.latitude === createdOpportunity.latitude, "Created opportunity map data was incorrect.");
    return `Details showed ${data.spotsOpen} open spots at ${data.address}.`;
  });

  await check("Volunteer signs up for the new opportunity", async () => {
    const { status, data } = await apiRequest("Volunteer signs up", "POST", "/api/signups", {
      opportunityId: createdOpportunity.id
    }, volunteerToken);
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.opportunityId === createdOpportunity.id, "Signup referenced wrong opportunity.");
    createdSignup = data;
    return `Created signup id ${createdSignup.id}.`;
  });

  await check("Duplicate volunteer signup is blocked", async () => {
    const { status } = await apiRequest("Duplicate signup blocked", "POST", "/api/signups", {
      opportunityId: createdOpportunity.id
    }, volunteerToken);
    assertCondition(status === 409, `Expected 409, got ${status}`);
    return "Duplicate signup correctly returned 409.";
  });

  await check("Organization dashboard shows event and volunteer", async () => {
    const { status, data } = await apiRequest("Organization dashboard", "GET", "/api/org/opportunities", undefined, orgToken);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    const event = data.find((item) => item.id === createdOpportunity.id);
    assertCondition(event && event.signups.length === 1, "Organization dashboard did not show the created signup.");
    assertCondition(event.signups[0].volunteerEmail === volunteerUser.email, "Dashboard showed the wrong volunteer.");
    return `Created event has ${event.signups.length} signup.`;
  });

  await check("Organization marks volunteer participation completed", async () => {
    const { status, data } = await apiRequest("Update participation status", "PATCH", `/api/org/signups/${createdSignup.id}/status`, {
      status: "completed"
    }, orgToken);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.status === "completed", "Signup status was not updated to completed.");
    return "Participation status changed to completed.";
  });

  await check("Volunteer dashboard includes completed history", async () => {
    const { status, data } = await apiRequest("Volunteer dashboard history", "GET", "/api/me/signups", undefined, volunteerToken);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    const signup = data.find((item) => item.id === createdSignup.id);
    assertCondition(signup?.status === "completed", "Volunteer history did not contain the completed signup.");
    assertCondition(signup?.address && Number.isFinite(signup?.latitude) && Number.isFinite(signup?.longitude), "Volunteer dashboard signup was missing map data.");
    return `Volunteer dashboard returned ${data.length} signup record(s) with mapped addresses.`;
  });

  await check("Organization edits its opportunity", async () => {
    const { status, data } = await apiRequest("Edit opportunity", "PUT", `/api/opportunities/${createdOpportunity.id}`, {
      title: "Milestone 3 Community Event - Updated",
      category: "Community Support",
      location: "Council Bluffs, IA",
      address: "1 Arena Way, Council Bluffs, IA 51501",
      latitude: 41.2373,
      longitude: -95.8906,
      date: "August 4, 2026",
      time: "10:00 AM - 1:00 PM",
      description: "Updated description for the Milestone 3 management workflow.",
      requirements: ["Bring water", "Wear comfortable shoes"],
      skills: ["Teamwork", "Communication"],
      spotsTotal: 4
    }, orgToken);
    assertCondition(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.title.endsWith("Updated") && data?.location === "Council Bluffs, IA", "Edit did not persist expected changes.");
    assertCondition(data?.address === "1 Arena Way, Council Bluffs, IA 51501" && data?.longitude === -95.8906, "Edit did not persist mapped address changes.");
    createdOpportunity = data;
    return `Updated opportunity ${data.id}; capacity is now ${data.spotsTotal}.`;
  });

  await check("Public details reflect organization edits", async () => {
    const { status, data } = await apiRequest("Verify public edit", "GET", `/api/opportunities/${createdOpportunity.id}`);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.title === createdOpportunity.title && data?.location === createdOpportunity.location, "Public data did not reflect edit.");
    assertCondition(data?.address === createdOpportunity.address && data?.longitude === createdOpportunity.longitude, "Public map data did not reflect edit.");
    return "Public opportunity details and map data reflect the edit.";
  });

  await check("Another organization cannot edit the event", async () => {
    const login = await apiRequest("Login non-owner organization", "POST", "/api/auth/login", {
      email: "parks.admin@example.com",
      password: "Password1!"
    });
    assertCondition(login.status === 200, `Expected seeded org login 200, got ${login.status}`);
    nonOwnerOrgToken = login.data.token;

    const { status } = await apiRequest("Non-owner edit blocked", "PUT", `/api/opportunities/${createdOpportunity.id}`, {
      title: "Unauthorized Edit",
      category: "Testing",
      location: "Nowhere",
      address: "1 Unauthorized Way, Nowhere, NE 68000",
      latitude: 40.0,
      longitude: -96.0,
      date: "August 5, 2026",
      description: "Should fail",
      spotsTotal: 4
    }, nonOwnerOrgToken);
    assertCondition(status === 404, `Expected 404, got ${status}`);
    return "Non-owner edit was blocked.";
  });

  await check("Organization removes its opportunity", async () => {
    const { status, data } = await apiRequest("Remove opportunity", "DELETE", `/api/opportunities/${createdOpportunity.id}`, undefined, orgToken);
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.id === createdOpportunity.id, "Delete response returned the wrong id.");
    return data.message;
  });

  await check("Removed opportunity is no longer public", async () => {
    const { status } = await apiRequest("Verify opportunity removal", "GET", `/api/opportunities/${createdOpportunity.id}`);
    assertCondition(status === 404, `Expected 404, got ${status}`);
    return "Removed opportunity correctly returns 404.";
  });

  await check("Capacity test: five volunteers compete for two spots", async () => {
    const createResult = await apiRequest("Create capacity opportunity", "POST", "/api/opportunities", {
      title: "Capacity Test Opportunity",
      category: "Capacity Test",
      location: "Test Lab",
      address: "500 Capacity Avenue, Omaha, NE 68102",
      latitude: 41.2565,
      longitude: -95.9345,
      date: "August 10, 2026",
      time: "12:00 PM",
      description: "Used to verify capacity enforcement with multiple volunteers.",
      requirements: ["Automated test"],
      skills: ["Testing"],
      spotsTotal: 2
    }, orgToken);
    assertCondition(createResult.status === 201, `Expected 201, got ${createResult.status}`);
    capacityOpportunity = createResult.data;

    const registrations = await Promise.all(
      [1, 2, 3, 4, 5].map((index) => registerUser(makeVolunteer(index)))
    );
    assertCondition(registrations.every((item) => item.status === 201), "One or more capacity volunteers failed to register.");

    const signupAttempts = await Promise.all(
      registrations.map((registration, index) => apiRequest(
        `Capacity signup attempt ${index + 1}`,
        "POST",
        "/api/signups",
        { opportunityId: capacityOpportunity.id },
        registration.data.token
      ))
    );

    const accepted = signupAttempts.filter((item) => item.status === 201).length;
    const blocked = signupAttempts.filter((item) => item.status === 409).length;
    const details = await apiRequest("Read capacity opportunity after signups", "GET", `/api/opportunities/${capacityOpportunity.id}`);

    assertCondition(accepted === 2, `Expected exactly 2 accepted signups, got ${accepted}`);
    assertCondition(blocked === 3, `Expected exactly 3 blocked signups, got ${blocked}`);
    assertCondition(details.data?.spotsOpen === 0, `Expected 0 open spots, got ${details.data?.spotsOpen}`);

    concurrencyStats = { attempted: 5, accepted, blocked, finalSpotsOpen: details.data.spotsOpen };
    return `Attempted 5; accepted ${accepted}; blocked ${blocked}; final spots open ${details.data.spotsOpen}.`;
  });

  await check("Availability filter finds the full capacity event", async () => {
    const { status, data } = await apiRequest("Filter full opportunities", "GET", "/api/opportunities?availability=full");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data.some((item) => item.id === capacityOpportunity.id), "Full availability filter did not include the capacity event.");
    assertCondition(data.every((item) => item.spotsOpen === 0), "Availability filter returned an event with open spots.");
    return `Full filter returned ${data.length} event(s).`;
  });

  const summary = buildSummary();

  console.log("\n=== Check Results ===");
  checks.forEach((item, index) => {
    console.log(`${index + 1}. ${item.passed ? "PASS" : "FAIL"} | ${item.name} | ${item.detail} (${item.ms} ms)`);
  });

  printRequestTable();

  console.log("\n=== Summary Statistics ===");
  console.log(`Checks passed: ${summary.passedChecks}/${summary.totalChecks} (${summary.passRate}%)`);
  console.log(`API requests made: ${summary.requestsMade}`);
  console.log(`Average response time: ${summary.averageResponseTime} ms`);
  console.log(`Fastest response: ${summary.fastest} ms`);
  console.log(`Slowest response: ${summary.slowest} ms`);
  console.log(`Status codes observed: ${JSON.stringify(summary.statusCounts)}`);
  console.log(`Data source: ${healthData?.dataSource || "unknown"}`);
  console.log(`Implemented features reported by /api/health: ${healthData?.implementedFeatures?.length || 0}`);
  if (concurrencyStats) {
    console.log(`Capacity simulation: ${concurrencyStats.attempted} attempts for 2 spots -> ${concurrencyStats.accepted} accepted, ${concurrencyStats.blocked} blocked, ${concurrencyStats.finalSpotsOpen} open.`);
  }

  console.log("\n=== Copy/Paste Test Summary ===");
  console.log(
    `Automated API testing was performed against the Volunteer Match Board Milestone 3 backend at ${BASE_URL}. ` +
    `The suite executed ${summary.totalChecks} checks and made ${summary.requestsMade} API requests. ` +
    `Results: ${summary.passedChecks}/${summary.totalChecks} checks passed (${summary.passRate}%). ` +
    `The run verified mapped event addresses, opportunity filtering and details, authentication and role restrictions, volunteer signup rules, ` +
    `organization create/edit/remove management, participation status updates, volunteer history maps, and capacity enforcement. ` +
    `The average API response time was ${summary.averageResponseTime} ms. ` +
    `The backend reported the data source as ${healthData?.dataSource || "unknown"}.`
  );

  if (summary.failedChecks > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nTest runner failed before completion:");
  console.error(error);
  process.exitCode = 1;
});
