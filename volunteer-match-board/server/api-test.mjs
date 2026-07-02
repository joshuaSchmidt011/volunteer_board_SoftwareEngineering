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
  const result = await apiRequest(`Register ${role}: ${email}`, "POST", "/api/auth/register", {
    name,
    email,
    password,
    role,
    organizationName
  });

  return result;
}

function makeVolunteer(index) {
  return {
    name: `Load Test Volunteer ${index}`,
    email: `load-volunteer-${runId}-${index}@example.com`,
    password: "Password1!",
    role: "volunteer"
  };
}

function printRequestTable() {
  console.log("\nRequest timing details:");
  console.log("#  Status   Time(ms)  Method  Path                         Label");
  requestLog.forEach((entry, index) => {
    const row = [
      String(index + 1).padEnd(2),
      String(entry.status).padEnd(8),
      String(entry.ms).padEnd(8),
      entry.method.padEnd(6),
      entry.path.padEnd(28),
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
  const responseTimes = requestLog
    .filter((entry) => typeof entry.ms === "number")
    .map((entry) => entry.ms);
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
  console.log("Volunteer Match Board Milestone 2 API Test Run");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Started: ${new Date().toLocaleString()}`);

  let volunteerToken;
  let volunteerUser;
  let orgToken;
  let orgUser;
  let createdOpportunity;
  let capacityOpportunity;

  await check("Health endpoint returns Milestone 2 metadata", async () => {
    const { status, data } = await apiRequest("Health check", "GET", "/api/health");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(data?.milestone === "Code Milestone 2", "Health endpoint did not report Code Milestone 2.");
    healthData = data;
    return `Data source: ${data?.dataSource}; features listed: ${data?.implementedFeatures?.length || 0}`;
  });

  await check("Guests can browse opportunities", async () => {
    const { status, data } = await apiRequest("Guest browse opportunities", "GET", "/api/opportunities");
    assertCondition(status === 200, `Expected 200, got ${status}`);
    assertCondition(Array.isArray(data), "Expected opportunities response to be an array.");
    assertCondition(data.length >= 1, "Expected at least one opportunity in seed/demo data.");
    return `Guest saw ${data.length} opportunities.`;
  });

  await check("Guests cannot sign up without logging in", async () => {
    const { status, data } = await apiRequest("Guest blocked from signup", "POST", "/api/signups", { opportunityId: 1 });
    assertCondition(status === 401, `Expected 401, got ${status}: ${JSON.stringify(data)}`);
    return "Unauthenticated signup correctly returned 401.";
  });

  await check("Protected volunteer dashboard blocks guests", async () => {
    const { status } = await apiRequest("Guest blocked from volunteer dashboard", "GET", "/api/me/signups");
    assertCondition(status === 401, `Expected 401, got ${status}`);
    return "Unauthenticated dashboard access correctly returned 401.";
  });

  await check("Registration rejects invalid email format", async () => {
    const { status, data } = await registerUser({
      name: "Bad Email User",
      email: "not-an-email",
      password: "Password1!",
      role: "volunteer"
    });
    assertCondition(status === 400, `Expected 400, got ${status}: ${JSON.stringify(data)}`);
    return data?.message || "Invalid email rejected.";
  });

  await check("Registration rejects weak password", async () => {
    const { status, data } = await registerUser({
      name: "Weak Password User",
      email: `weak-${runId}@example.com`,
      password: "password",
      role: "volunteer"
    });
    assertCondition(status === 400, `Expected 400, got ${status}: ${JSON.stringify(data)}`);
    return data?.message || "Weak password rejected.";
  });

  await check("Organization registration requires organization name", async () => {
    const { status, data } = await registerUser({
      name: "Missing Org Name",
      email: `missing-org-${runId}@example.com`,
      password: "Password1!",
      role: "org",
      organizationName: ""
    });
    assertCondition(status === 400, `Expected 400, got ${status}: ${JSON.stringify(data)}`);
    return data?.message || "Missing organization name rejected.";
  });

  await check("Volunteer account can be created", async () => {
    const { status, data } = await registerUser({
      name: "Automated Test Volunteer",
      email: `auto-volunteer-${runId}@example.com`,
      password: "Password1!",
      role: "volunteer"
    });
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.token, "Expected auth token after registration.");
    assertCondition(data?.user?.role === "volunteer", "Expected volunteer role.");
    volunteerToken = data.token;
    volunteerUser = data.user;
    return `Created volunteer account ${data.user.email}.`;
  });

  await check("Wrong password is rejected", async () => {
    const { status, data } = await apiRequest("Wrong password login", "POST", "/api/auth/login", {
      email: volunteerUser.email,
      password: "WrongPassword1!"
    });
    assertCondition(status === 401, `Expected 401, got ${status}: ${JSON.stringify(data)}`);
    return "Incorrect password correctly returned 401.";
  });

  await check("Authenticated user can read their profile", async () => {
    const { status, data } = await apiRequest("Read current user", "GET", "/api/auth/me", undefined, volunteerToken);
    assertCondition(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.user?.email === volunteerUser.email, "Profile email did not match registered volunteer.");
    return `Authenticated as ${data.user.email}.`;
  });

  await check("Volunteer accounts cannot create opportunities", async () => {
    const { status, data } = await apiRequest("Volunteer blocked from creating opportunity", "POST", "/api/opportunities", {
      title: "Should Not Save",
      location: "Test City",
      date: "July 1, 2026",
      description: "This should be blocked.",
      spotsTotal: 3
    }, volunteerToken);
    assertCondition(status === 403, `Expected 403, got ${status}: ${JSON.stringify(data)}`);
    return "Volunteer creation attempt correctly returned 403.";
  });

  await check("Organization account can be created", async () => {
    const { status, data } = await registerUser({
      name: "Automated Test Org Admin",
      email: `auto-org-${runId}@example.com`,
      password: "Password1!",
      role: "org",
      organizationName: "Automated Test Organization"
    });
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.token, "Expected auth token after org registration.");
    assertCondition(data?.user?.role === "org", "Expected org role.");
    orgToken = data.token;
    orgUser = data.user;
    return `Created organization account ${data.user.email}.`;
  });

  await check("Organization accounts cannot sign up as volunteers", async () => {
    const { status, data } = await apiRequest("Org blocked from signup", "POST", "/api/signups", { opportunityId: 1 }, orgToken);
    assertCondition(status === 403, `Expected 403, got ${status}: ${JSON.stringify(data)}`);
    return "Org signup attempt correctly returned 403.";
  });

  await check("Organization dashboard rejects volunteer accounts", async () => {
    const { status } = await apiRequest("Volunteer blocked from org dashboard", "GET", "/api/org/opportunities", undefined, volunteerToken);
    assertCondition(status === 403, `Expected 403, got ${status}`);
    return "Volunteer access to org dashboard correctly returned 403.";
  });

  await check("Organization can create a valid opportunity", async () => {
    const { status, data } = await apiRequest("Org creates opportunity", "POST", "/api/opportunities", {
      title: `Automated Food Drive ${runId}`,
      location: "Omaha, NE",
      date: "July 15, 2026",
      time: "9:00 AM - 12:00 PM",
      description: "Created by the automated API test to verify organization-only posting.",
      requirements: ["Closed-toe shoes", "Bring water"],
      skills: ["Teamwork", "Sorting"],
      spotsTotal: 4
    }, orgToken);
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.id, "Expected created opportunity to include an id.");
    createdOpportunity = data;
    return `Created opportunity id ${data.id} with ${data.spotsTotal} total spots.`;
  });

  await check("Volunteer can sign up for an opportunity", async () => {
    const { status, data } = await apiRequest("Volunteer signs up", "POST", "/api/signups", {
      opportunityId: createdOpportunity.id
    }, volunteerToken);
    assertCondition(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(data?.opportunityId === createdOpportunity.id, "Signup opportunity id did not match.");
    return `Volunteer signed up for opportunity id ${createdOpportunity.id}.`;
  });

  await check("Duplicate volunteer signup is blocked", async () => {
    const { status, data } = await apiRequest("Duplicate signup blocked", "POST", "/api/signups", {
      opportunityId: createdOpportunity.id
    }, volunteerToken);
    assertCondition(status === 409, `Expected 409, got ${status}: ${JSON.stringify(data)}`);
    return "Duplicate signup correctly returned 409.";
  });

  await check("Volunteer dashboard shows the volunteer signup", async () => {
    const { status, data } = await apiRequest("Volunteer dashboard", "GET", "/api/me/signups", undefined, volunteerToken);
    assertCondition(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(Array.isArray(data), "Expected volunteer dashboard response to be an array.");
    assertCondition(data.some((signup) => signup.opportunityId === createdOpportunity.id), "Created opportunity signup was not found in volunteer dashboard.");
    return `Volunteer dashboard returned ${data.length} signup(s).`;
  });

  await check("Organization dashboard shows created event and signed-up volunteer", async () => {
    const { status, data } = await apiRequest("Organization dashboard", "GET", "/api/org/opportunities", undefined, orgToken);
    assertCondition(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assertCondition(Array.isArray(data), "Expected org dashboard response to be an array.");
    const dashboardOpportunity = data.find((opportunity) => opportunity.id === createdOpportunity.id);
    assertCondition(dashboardOpportunity, "Created opportunity was not found in org dashboard.");
    assertCondition(Array.isArray(dashboardOpportunity.signups), "Expected signups array on org dashboard opportunity.");
    assertCondition(dashboardOpportunity.signups.some((signup) => signup.volunteerEmail === volunteerUser.email), "Volunteer signup was not shown to the organization.");
    return `Org dashboard returned ${data.length} event(s); created event has ${dashboardOpportunity.signups.length} signup(s).`;
  });

  await check("Capacity test: five volunteers compete for two spots", async () => {
    const createResult = await apiRequest("Org creates capacity test opportunity", "POST", "/api/opportunities", {
      title: `Two Spot Capacity Test ${runId}`,
      location: "Omaha, NE",
      date: "July 20, 2026",
      time: "1:00 PM - 3:00 PM",
      description: "Created by the automated API test to simulate several users competing for limited capacity.",
      requirements: ["Testing only"],
      skills: ["Testing"],
      spotsTotal: 2
    }, orgToken);

    assertCondition(createResult.status === 201, `Expected 201 when creating capacity test opportunity, got ${createResult.status}.`);
    capacityOpportunity = createResult.data;

    const volunteerResults = [];
    for (let index = 1; index <= 5; index += 1) {
      const userSpec = makeVolunteer(index);
      const result = await registerUser(userSpec);
      assertCondition(result.status === 201, `Expected test volunteer ${index} registration to return 201, got ${result.status}.`);
      volunteerResults.push(result.data);
    }

    const signupResults = await Promise.all(volunteerResults.map((registeredUser, index) => apiRequest(
      `Capacity signup attempt ${index + 1}`,
      "POST",
      "/api/signups",
      { opportunityId: capacityOpportunity.id },
      registeredUser.token
    )));

    const accepted = signupResults.filter((result) => result.status === 201).length;
    const blocked = signupResults.filter((result) => result.status === 409).length;
    const otherStatuses = signupResults.filter((result) => ![201, 409].includes(result.status)).map((result) => result.status);

    const afterResult = await apiRequest("Read capacity test opportunity after concurrent signups", "GET", `/api/opportunities/${capacityOpportunity.id}`);
    assertCondition(afterResult.status === 200, `Expected 200 when reading capacity opportunity, got ${afterResult.status}.`);

    concurrencyStats = {
      attempted: signupResults.length,
      accepted,
      blocked,
      otherStatuses,
      finalSignups: afterResult.data?.signupsCount,
      finalSpotsOpen: afterResult.data?.spotsOpen,
      spotsTotal: afterResult.data?.spotsTotal
    };

    assertCondition(accepted === 2, `Expected exactly 2 accepted signups, got ${accepted}.`);
    assertCondition(blocked === 3, `Expected exactly 3 blocked signups, got ${blocked}.`);
    assertCondition(otherStatuses.length === 0, `Unexpected statuses in capacity test: ${otherStatuses.join(", ")}`);
    assertCondition(afterResult.data?.signupsCount === 2, `Expected final signup count to be 2, got ${afterResult.data?.signupsCount}.`);
    assertCondition(afterResult.data?.spotsOpen === 0, `Expected final open spots to be 0, got ${afterResult.data?.spotsOpen}.`);

    return `Attempted ${signupResults.length}; accepted ${accepted}; blocked ${blocked}; final spots open ${afterResult.data?.spotsOpen}.`;
  });

  console.log("\nCheck results:");
  checks.forEach((item, index) => {
    const icon = item.passed ? "PASS" : "FAIL";
    console.log(`${String(index + 1).padStart(2, "0")}. ${icon} | ${item.name} | ${item.detail} (${item.ms} ms)`);
  });

  printRequestTable();

  const summary = buildSummary();
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
    console.log(`Concurrent/capacity simulation: ${concurrencyStats.attempted} signup attempts for ${concurrencyStats.spotsTotal} spots -> ${concurrencyStats.accepted} accepted, ${concurrencyStats.blocked} blocked, final open spots ${concurrencyStats.finalSpotsOpen}.`);
  }

  console.log("\n=== Copy/Paste Test Summary ===");
  console.log(`Automated API testing was performed against the Volunteer Match Board Milestone 2 backend at ${BASE_URL}. The automated test suite executed ${summary.totalChecks} checks and made ${summary.requestsMade} API requests. Results: ${summary.passedChecks}/${summary.totalChecks} checks passed (${summary.passRate}%). The average API response time was ${summary.averageResponseTime} ms, with a fastest response of ${summary.fastest} ms and a slowest response of ${summary.slowest} ms. The test run verified guest browsing, authentication validation, password complexity validation, volunteer-only signups, organization-only event creation, duplicate signup blocking, volunteer dashboard data, organization dashboard data, and a capacity simulation where ${concurrencyStats?.attempted || 0} volunteers attempted to claim ${concurrencyStats?.spotsTotal || 0} available spots. In that simulation, ${concurrencyStats?.accepted || 0} signups were accepted and ${concurrencyStats?.blocked || 0} were blocked once the event was full.`);

  if (summary.failedChecks > 0) {
    console.log("\nSome checks failed. Review the FAIL lines above before submitting.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nTest runner crashed:");
  console.error(error);
  process.exit(1);
});
