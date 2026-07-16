require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { usePostgres, query, checkDatabaseConnection } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const sessions = new Map();
const ALLOWED_SIGNUP_STATUSES = new Set(["confirmed", "completed", "no-show"]);
const geocodeCache = new Map();
let lastNominatimRequestAt = 0;

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password = "") {
  const errors = [];

  if (password.length < 8) errors.push("Password must be at least 8 characters long.");
  if (!/[A-Z]/.test(password)) errors.push("Password must include at least one uppercase letter.");
  if (!/[0-9]/.test(password)) errors.push("Password must include at least one number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must include at least one special character.");

  return errors;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(hash, "hex");
  const testBuffer = Buffer.from(testHash, "hex");

  if (storedBuffer.length !== testBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, testBuffer);
}

function toPublicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationName: user.organization_name || user.organizationName || null
  };
}

function createSession(user) {
  const token = crypto.randomUUID();
  sessions.set(token, toPublicUser(user));
  return token;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return req.headers["x-auth-token"] || null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const user = sessions.get(token);

  if (!token || !user) {
    return res.status(401).json({ message: "You must be logged in to use this feature." });
  }

  req.user = user;
  req.token = token;
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: `Only ${role} accounts can use this feature.` });
    }

    next();
  };
}

function makeArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return fallback;
}

function readOpportunityInput(body = {}) {
  return {
    title: String(body.title || "").trim(),
    category: String(body.category || "General").trim() || "General",
    location: String(body.location || "").trim(),
    address: String(body.address || "").trim(),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    date: String(body.date || "").trim(),
    time: String(body.time || "TBD").trim() || "TBD",
    description: String(body.description || "").trim(),
    requirements: makeArray(body.requirements, ["No special requirements"]),
    skills: makeArray(body.skills, ["General Help"]),
    spotsTotal: Number(body.spotsTotal || body.spotsOpen || 10)
  };
}

function hasValidCoordinates(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function validateOpportunityInput(input) {
  if (!input.title || !input.category || !input.location || !input.address || !input.date || !input.description) {
    return "Title, category, location, street address, date, and description are required.";
  }

  if (!hasValidCoordinates(input.latitude, input.longitude)) {
    return "A valid mapped latitude and longitude are required. Use Find Address on Map or enter coordinates manually.";
  }

  if (!Number.isInteger(input.spotsTotal) || input.spotsTotal < 1) {
    return "Spots available must be a positive whole number.";
  }

  return null;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function geocodeAddress(address) {
  const normalizedAddress = String(address || "").trim();
  const cacheKey = normalizedAddress.toLowerCase();

  if (!normalizedAddress) {
    throw new Error("An address is required.");
  }

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const googleKey = String(process.env.GOOGLE_MAPS_GEOCODING_API_KEY || "").trim();

  if (googleKey) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", normalizedAddress);
    url.searchParams.set("key", googleKey);

    let response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error("Google address lookup could not be reached. Check your connection or enter coordinates manually.");
    }
    const data = await response.json();
    const result = data.results?.[0];

    if (!response.ok || data.status !== "OK" || !result) {
      throw new Error(data.error_message || `Google geocoding failed with status ${data.status || response.status}.`);
    }

    const geocoded = {
      formattedAddress: result.formatted_address,
      latitude: Number(result.geometry.location.lat),
      longitude: Number(result.geometry.location.lng),
      provider: "Google Geocoding"
    };

    geocodeCache.set(cacheKey, geocoded);
    return geocoded;
  }

  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1100) {
    await wait(1100 - elapsed);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", normalizedAddress);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  lastNominatimRequestAt = Date.now();
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": process.env.GEOCODER_USER_AGENT || "VolunteerMatchBoard-Milestone3/1.0 (educational demo)",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
  } catch {
    throw new Error("Online address lookup could not be reached. Check your connection or enter latitude and longitude manually.");
  }
  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : null;

  if (!response.ok || !result) {
    throw new Error("The address could not be found. Check the street, city, state, and ZIP code, or enter coordinates manually.");
  }

  const geocoded = {
    formattedAddress: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    provider: "OpenStreetMap Nominatim"
  };

  geocodeCache.set(cacheKey, geocoded);
  return geocoded;
}

function mapOpportunityRow(row) {
  const signupsCount = Number(row.signups_count ?? row.signupsCount ?? 0);
  const spotsTotal = Number(row.spots_total ?? row.spotsTotal ?? row.spots_open ?? 0);
  const spotsOpen = Number(row.spots_open ?? row.spotsOpen ?? Math.max(spotsTotal - signupsCount, 0));

  return {
    id: Number(row.id),
    title: row.title,
    category: row.category || "General",
    organizationId: Number(row.organization_id || row.organizationId || 0) || null,
    organization: row.organization_name || row.organization || "Community Organization",
    location: row.location,
    address: row.address || "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    date: row.event_date || row.date,
    time: row.event_time || row.time || "TBD",
    description: row.description,
    requirements: row.requirements || [],
    skills: row.skills || ["General Help"],
    spotsTotal,
    spotsOpen,
    signupsCount
  };
}

function mapSignupRow(row) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id || row.userId || 0) || null,
    volunteerName: row.volunteer_name || row.volunteerName,
    volunteerEmail: row.volunteer_email || row.volunteerEmail,
    opportunityId: Number(row.opportunity_id || row.opportunityId || 0) || null,
    opportunityTitle: row.opportunity_title || row.opportunityTitle,
    category: row.category || "General",
    organization: row.organization_name || row.organization,
    location: row.location,
    address: row.address || "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    date: row.event_date || row.date,
    time: row.event_time || row.time || "TBD",
    description: row.description,
    status: row.status || "confirmed"
  };
}

function applyOpportunityFilters(opportunities, filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  const category = String(filters.category || "").trim().toLowerCase();
  const location = String(filters.location || "").trim().toLowerCase();
  const organization = String(filters.organization || "").trim().toLowerCase();
  const date = String(filters.date || "").trim().toLowerCase();
  const availability = String(filters.availability || "").trim().toLowerCase();

  return opportunities.filter((opportunity) => {
    const searchableText = [
      opportunity.title,
      opportunity.category,
      opportunity.organization,
      opportunity.location,
      opportunity.address,
      opportunity.date,
      opportunity.time,
      opportunity.description,
      ...(opportunity.skills || []),
      ...(opportunity.requirements || [])
    ].join(" ").toLowerCase();

    if (search && !searchableText.includes(search)) return false;
    if (category && opportunity.category.toLowerCase() !== category) return false;
    if (location && !opportunity.location.toLowerCase().includes(location)) return false;
    if (organization && !opportunity.organization.toLowerCase().includes(organization)) return false;
    if (date && !String(opportunity.date).toLowerCase().includes(date)) return false;
    if (availability === "open" && opportunity.spotsOpen <= 0) return false;
    if (availability === "full" && opportunity.spotsOpen > 0) return false;

    return true;
  });
}

let memoryUsers = [
  {
    id: 1,
    name: "Demo Volunteer",
    email: "demo.volunteer@example.com",
    password_hash: hashPassword("Password1!"),
    role: "volunteer",
    organization_name: null
  },
  {
    id: 2,
    name: "Food Center Admin",
    email: "org.admin@example.com",
    password_hash: hashPassword("Password1!"),
    role: "org",
    organization_name: "Community Food Center"
  },
  {
    id: 3,
    name: "Parks Coordinator",
    email: "parks.admin@example.com",
    password_hash: hashPassword("Password1!"),
    role: "org",
    organization_name: "Green City Volunteers"
  }
];

let memoryOpportunities = [
  {
    id: 1,
    title: "Food Bank Helper",
    category: "Food Support",
    organizationId: 2,
    organization: "Community Food Center",
    location: "Omaha, NE",
    address: "10525 J Street, Omaha, NE 68127",
    latitude: 41.2148,
    longitude: -96.0787,
    date: "July 18, 2026",
    time: "10:00 AM - 2:00 PM",
    description: "Volunteers will help sort donated food, organize shelves, and prepare food boxes for families.",
    requirements: ["Must be able to stand for 2 hours", "Closed-toe shoes required", "No prior experience required"],
    skills: ["Organization", "Customer Service"],
    spotsTotal: 5
  },
  {
    id: 2,
    title: "Park Cleanup Crew",
    category: "Environment",
    organizationId: 3,
    organization: "Green City Volunteers",
    location: "Lincoln, NE",
    address: "3200 Veterans Memorial Drive, Lincoln, NE 68502",
    latitude: 40.7838,
    longitude: -96.6817,
    date: "July 21, 2026",
    time: "10:00 AM - 1:00 PM",
    description: "Join a local cleanup event to remove litter, clear walking paths, and improve a community park.",
    requirements: ["Outdoor clothing recommended", "Gloves provided"],
    skills: ["Outdoor Work", "Teamwork"],
    spotsTotal: 12
  },
  {
    id: 3,
    title: "Animal Shelter Assistant",
    category: "Animal Care",
    organizationId: 2,
    organization: "Community Food Center",
    location: "Bellevue, NE",
    address: "10410 South 25th Street, Bellevue, NE 68123",
    latitude: 41.1582,
    longitude: -95.9477,
    date: "July 24, 2026",
    time: "5:30 PM - 7:30 PM",
    description: "Support shelter staff by helping with basic cleaning, feeding, and animal socialization.",
    requirements: ["Comfortable around animals", "Wear clothes that can get dirty"],
    skills: ["Animal Care", "Patience"],
    spotsTotal: 5
  },
  {
    id: 4,
    title: "Senior Center Tech Help",
    category: "Technology",
    organizationId: 3,
    organization: "Green City Volunteers",
    location: "Papillion, NE",
    address: "1001 Limerick Road, Papillion, NE 68046",
    latitude: 41.1533,
    longitude: -96.0575,
    date: "July 26, 2026",
    time: "3:00 PM - 5:00 PM",
    description: "Assist seniors with basic technology questions such as email, phones, and online forms.",
    requirements: ["Basic computer confidence", "Patient communication style"],
    skills: ["Basic Computers", "Communication"],
    spotsTotal: 6
  }
];

let memorySignups = [
  { id: 1, userId: 1, opportunityId: 1, status: "confirmed" },
  { id: 2, userId: 1, opportunityId: 3, status: "completed" }
];
let nextMemoryUserId = 4;
let nextMemoryOpportunityId = 5;
let nextMemorySignupId = 3;

function getMemoryOpportunityWithCounts(opportunity) {
  const signupsCount = memorySignups.filter((signup) => signup.opportunityId === opportunity.id).length;
  return {
    ...opportunity,
    signupsCount,
    spotsOpen: Math.max(opportunity.spotsTotal - signupsCount, 0)
  };
}

function getMemorySignupDetails(signup) {
  const opportunity = memoryOpportunities.find((item) => item.id === signup.opportunityId);
  const user = memoryUsers.find((item) => item.id === signup.userId);

  return mapSignupRow({
    id: signup.id,
    userId: signup.userId,
    volunteerName: user?.name || "Volunteer",
    volunteerEmail: user?.email || "",
    opportunityId: signup.opportunityId,
    opportunityTitle: opportunity?.title || "Opportunity",
    category: opportunity?.category || "General",
    organization: opportunity?.organization || "Organization",
    location: opportunity?.location || "",
    address: opportunity?.address || "",
    latitude: opportunity?.latitude,
    longitude: opportunity?.longitude,
    date: opportunity?.date || "",
    time: opportunity?.time || "TBD",
    description: opportunity?.description || "",
    status: signup.status
  });
}

async function loadPostgresOpportunities(whereClause = "", values = []) {
  const result = await query(
    `SELECT o.id, o.title, o.category, o.organization_id, u.organization_name, o.location,
            o.address, o.latitude, o.longitude,
            o.event_date, o.event_time, o.description, o.requirements, o.skills,
            o.spots_total,
            COUNT(s.id)::int AS signups_count,
            GREATEST(o.spots_total - COUNT(s.id)::int, 0) AS spots_open
     FROM opportunities o
     JOIN users u ON o.organization_id = u.id
     LEFT JOIN signups s ON s.opportunity_id = o.id
     ${whereClause}
     GROUP BY o.id, u.organization_name
     ORDER BY o.id DESC`,
    values
  );

  return result.rows.map(mapOpportunityRow);
}

app.get("/", (req, res) => {
  res.send("Volunteer Match Board API is running. Try /api/health or /api/opportunities.");
});

app.get("/api/health", async (req, res) => {
  const database = await checkDatabaseConnection();

  res.json({
    app: "Volunteer Match Board",
    milestone: "Code Milestone 3",
    status: "running",
    frontend: "React/Vite client",
    backend: "Node.js/Express API",
    dataSource: database.mode,
    database,
    implementedFeatures: [
      "Guests can browse, search, filter, and map volunteer opportunities",
      "Map markers open event summaries with details and signup actions",
      "Opportunity cards open a complete details page",
      "Volunteer and organization accounts have separate roles",
      "Registration validates email format and password complexity",
      "Passwords are stored as salted hashes instead of plaintext",
      "Volunteers can sign up while duplicate and full signups are blocked",
      "Volunteer dashboard separates current signups from participation history and maps every signup",
      "Organizations can create geocoded addresses and map all of their events",
      "Organizations can create, edit, and remove their own opportunities",
      "Organizations can view volunteers and update participation status",
      "PostgreSQL support is available with an in-memory fallback for demonstrations"
    ],
    demoAccounts: [
      { email: "demo.volunteer@example.com", password: "Password1!", role: "volunteer" },
      { email: "org.admin@example.com", password: "Password1!", role: "org" }
    ]
  });
});

app.post("/api/auth/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const role = req.body.role === "org" ? "org" : "volunteer";
  const organizationName = String(req.body.organizationName || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Name is required." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  if (role === "org" && !organizationName) {
    return res.status(400).json({ message: "Organization accounts need an organization name." });
  }

  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    return res.status(400).json({ message: passwordErrors[0], errors: passwordErrors });
  }

  const passwordHash = hashPassword(password);

  if (usePostgres) {
    try {
      const existingUser = await query("SELECT id FROM users WHERE email = $1", [email]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: "An account with that email already exists." });
      }

      const result = await query(
        `INSERT INTO users (name, email, password_hash, role, organization_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, email, role, organization_name`,
        [name, email, passwordHash, role, role === "org" ? organizationName : null]
      );

      const user = toPublicUser(result.rows[0]);
      const token = createSession(user);
      return res.status(201).json({ message: "Account created successfully.", user, token });
    } catch (error) {
      return res.status(500).json({ message: "Unable to create account.", error: error.message });
    }
  }

  if (memoryUsers.some((user) => user.email === email)) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const user = {
    id: nextMemoryUserId++,
    name,
    email,
    password_hash: passwordHash,
    role,
    organization_name: role === "org" ? organizationName : null
  };

  memoryUsers.push(user);

  const publicUser = toPublicUser(user);
  const token = createSession(publicUser);
  return res.status(201).json({ message: "Account created successfully.", user: publicUser, token });
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ message: "A valid email and password are required." });
  }

  if (usePostgres) {
    try {
      const result = await query(
        `SELECT id, name, email, password_hash, role, organization_name
         FROM users
         WHERE email = $1`,
        [email]
      );

      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const publicUser = toPublicUser(user);
      const token = createSession(publicUser);
      return res.json({ message: "Login successful.", user: publicUser, token });
    } catch (error) {
      return res.status(500).json({ message: "Unable to log in.", error: error.message });
    }
  }

  const user = memoryUsers.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const publicUser = toPublicUser(user);
  const token = createSession(publicUser);
  return res.json({ message: "Login successful.", user: publicUser, token });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logged out." });
});

app.post("/api/geocode", requireAuth, requireRole("org"), async (req, res) => {
  const address = String(req.body.address || "").trim();

  if (!address) {
    return res.status(400).json({ message: "Enter a street address, city, state, and ZIP code to find it on the map." });
  }

  try {
    const result = await geocodeAddress(address);
    return res.json(result);
  } catch (error) {
    return res.status(422).json({ message: error.message });
  }
});

app.get("/api/opportunities", async (req, res) => {
  try {
    const opportunities = usePostgres
      ? await loadPostgresOpportunities()
      : memoryOpportunities.map(getMemoryOpportunityWithCounts).map(mapOpportunityRow);

    return res.json(applyOpportunityFilters(opportunities, req.query));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load opportunities.", error: error.message });
  }
});

app.get("/api/opportunities/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (usePostgres) {
    try {
      const opportunities = await loadPostgresOpportunities("WHERE o.id = $1", [id]);
      if (opportunities.length === 0) {
        return res.status(404).json({ message: "Opportunity not found." });
      }

      return res.json(opportunities[0]);
    } catch (error) {
      return res.status(500).json({ message: "Unable to load opportunity from PostgreSQL.", error: error.message });
    }
  }

  const opportunity = memoryOpportunities.find((item) => item.id === id);
  if (!opportunity) {
    return res.status(404).json({ message: "Opportunity not found." });
  }

  return res.json(mapOpportunityRow(getMemoryOpportunityWithCounts(opportunity)));
});

app.post("/api/opportunities", requireAuth, requireRole("org"), async (req, res) => {
  const input = readOpportunityInput(req.body);
  const validationError = validateOpportunityInput(input);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (usePostgres) {
    try {
      const result = await query(
        `INSERT INTO opportunities
          (title, category, organization_id, location, address, latitude, longitude, event_date, event_time, description, requirements, skills, spots_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id, title, category, organization_id, location, address, latitude, longitude, event_date, event_time, description, requirements, skills, spots_total`,
        [input.title, input.category, req.user.id, input.location, input.address, input.latitude, input.longitude, input.date, input.time, input.description, input.requirements, input.skills, input.spotsTotal]
      );

      const row = {
        ...result.rows[0],
        organization_name: req.user.organizationName,
        signups_count: 0,
        spots_open: input.spotsTotal
      };

      return res.status(201).json(mapOpportunityRow(row));
    } catch (error) {
      return res.status(500).json({ message: "Unable to save opportunity to PostgreSQL.", error: error.message });
    }
  }

  const opportunity = {
    id: nextMemoryOpportunityId++,
    title: input.title,
    category: input.category,
    organizationId: req.user.id,
    organization: req.user.organizationName,
    location: input.location,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    date: input.date,
    time: input.time,
    description: input.description,
    requirements: input.requirements,
    skills: input.skills,
    spotsTotal: input.spotsTotal
  };

  memoryOpportunities = [opportunity, ...memoryOpportunities];
  return res.status(201).json(mapOpportunityRow(getMemoryOpportunityWithCounts(opportunity)));
});

app.put("/api/opportunities/:id", requireAuth, requireRole("org"), async (req, res) => {
  const id = Number(req.params.id);
  const input = readOpportunityInput(req.body);
  const validationError = validateOpportunityInput(input);

  if (!id) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  if (usePostgres) {
    try {
      const signupCountResult = await query(
        `SELECT COUNT(s.id)::int AS signups_count
         FROM opportunities o
         LEFT JOIN signups s ON s.opportunity_id = o.id
         WHERE o.id = $1 AND o.organization_id = $2
         GROUP BY o.id`,
        [id, req.user.id]
      );

      if (signupCountResult.rows.length === 0) {
        return res.status(404).json({ message: "Opportunity not found or it does not belong to your organization." });
      }

      const signupCount = Number(signupCountResult.rows[0].signups_count);
      if (input.spotsTotal < signupCount) {
        return res.status(409).json({ message: `Spots cannot be lower than the ${signupCount} existing signup(s).` });
      }

      const result = await query(
        `UPDATE opportunities
         SET title = $1, category = $2, location = $3, address = $4, latitude = $5, longitude = $6,
             event_date = $7, event_time = $8, description = $9, requirements = $10, skills = $11, spots_total = $12
         WHERE id = $13 AND organization_id = $14
         RETURNING id, title, category, organization_id, location, address, latitude, longitude, event_date, event_time, description, requirements, skills, spots_total`,
        [input.title, input.category, input.location, input.address, input.latitude, input.longitude, input.date, input.time, input.description, input.requirements, input.skills, input.spotsTotal, id, req.user.id]
      );

      const row = {
        ...result.rows[0],
        organization_name: req.user.organizationName,
        signups_count: signupCount,
        spots_open: Math.max(input.spotsTotal - signupCount, 0)
      };

      return res.json(mapOpportunityRow(row));
    } catch (error) {
      return res.status(500).json({ message: "Unable to update opportunity.", error: error.message });
    }
  }

  const opportunityIndex = memoryOpportunities.findIndex((item) => item.id === id && item.organizationId === req.user.id);
  if (opportunityIndex === -1) {
    return res.status(404).json({ message: "Opportunity not found or it does not belong to your organization." });
  }

  const signupCount = memorySignups.filter((signup) => signup.opportunityId === id).length;
  if (input.spotsTotal < signupCount) {
    return res.status(409).json({ message: `Spots cannot be lower than the ${signupCount} existing signup(s).` });
  }

  const updatedOpportunity = {
    ...memoryOpportunities[opportunityIndex],
    ...input,
    spotsTotal: input.spotsTotal
  };

  memoryOpportunities[opportunityIndex] = updatedOpportunity;
  return res.json(mapOpportunityRow(getMemoryOpportunityWithCounts(updatedOpportunity)));
});

app.delete("/api/opportunities/:id", requireAuth, requireRole("org"), async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (usePostgres) {
    try {
      const result = await query(
        `DELETE FROM opportunities
         WHERE id = $1 AND organization_id = $2
         RETURNING id, title`,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Opportunity not found or it does not belong to your organization." });
      }

      return res.json({ message: `Removed opportunity: ${result.rows[0].title}.`, id });
    } catch (error) {
      return res.status(500).json({ message: "Unable to remove opportunity.", error: error.message });
    }
  }

  const opportunityIndex = memoryOpportunities.findIndex((item) => item.id === id && item.organizationId === req.user.id);
  if (opportunityIndex === -1) {
    return res.status(404).json({ message: "Opportunity not found or it does not belong to your organization." });
  }

  const [removedOpportunity] = memoryOpportunities.splice(opportunityIndex, 1);
  memorySignups = memorySignups.filter((signup) => signup.opportunityId !== id);
  return res.json({ message: `Removed opportunity: ${removedOpportunity.title}.`, id });
});

app.post("/api/signups", requireAuth, requireRole("volunteer"), async (req, res) => {
  const opportunityId = Number(req.body.opportunityId);

  if (!opportunityId) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (usePostgres) {
    try {
      const opportunityResult = await query(
        `SELECT o.id, o.title, o.category, u.organization_name, o.location, o.address, o.latitude, o.longitude, o.event_date, o.event_time,
                o.description, o.spots_total, COUNT(s.id)::int AS signups_count
         FROM opportunities o
         JOIN users u ON o.organization_id = u.id
         LEFT JOIN signups s ON s.opportunity_id = o.id
         WHERE o.id = $1
         GROUP BY o.id, u.organization_name`,
        [opportunityId]
      );

      if (opportunityResult.rows.length === 0) {
        return res.status(404).json({ message: "Opportunity not found." });
      }

      const opportunity = opportunityResult.rows[0];
      if (Number(opportunity.signups_count) >= Number(opportunity.spots_total)) {
        return res.status(409).json({ message: "This opportunity is already full." });
      }

      const signupResult = await query(
        `INSERT INTO signups (user_id, opportunity_id)
         VALUES ($1, $2)
         RETURNING id, user_id, opportunity_id, status`,
        [req.user.id, opportunityId]
      );

      const signup = signupResult.rows[0];
      return res.status(201).json(mapSignupRow({
        id: signup.id,
        user_id: signup.user_id,
        volunteer_name: req.user.name,
        volunteer_email: req.user.email,
        opportunity_id: signup.opportunity_id,
        opportunity_title: opportunity.title,
        category: opportunity.category,
        organization_name: opportunity.organization_name,
        location: opportunity.location,
        address: opportunity.address,
        latitude: opportunity.latitude,
        longitude: opportunity.longitude,
        event_date: opportunity.event_date,
        event_time: opportunity.event_time,
        description: opportunity.description,
        status: signup.status
      }));
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ message: "You are already signed up for this opportunity." });
      }

      return res.status(500).json({ message: "Unable to save signup to PostgreSQL.", error: error.message });
    }
  }

  const opportunity = memoryOpportunities.find((item) => item.id === opportunityId);
  if (!opportunity) {
    return res.status(404).json({ message: "Opportunity not found." });
  }

  const opportunityWithCounts = getMemoryOpportunityWithCounts(opportunity);
  if (opportunityWithCounts.spotsOpen <= 0) {
    return res.status(409).json({ message: "This opportunity is already full." });
  }

  const existingSignup = memorySignups.find((signup) => signup.userId === req.user.id && signup.opportunityId === opportunityId);
  if (existingSignup) {
    return res.status(409).json({ message: "You are already signed up for this opportunity." });
  }

  const signup = {
    id: nextMemorySignupId++,
    userId: req.user.id,
    opportunityId,
    status: "confirmed"
  };

  memorySignups.push(signup);
  return res.status(201).json(getMemorySignupDetails(signup));
});

app.get("/api/me/signups", requireAuth, requireRole("volunteer"), async (req, res) => {
  if (usePostgres) {
    try {
      const result = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email,
                o.title AS opportunity_title, o.category, org.organization_name, o.location,
                o.address, o.latitude, o.longitude, o.event_date, o.event_time, o.description
         FROM signups s
         JOIN users u ON s.user_id = u.id
         JOIN opportunities o ON s.opportunity_id = o.id
         JOIN users org ON o.organization_id = org.id
         WHERE s.user_id = $1
         ORDER BY s.id DESC`,
        [req.user.id]
      );

      return res.json(result.rows.map(mapSignupRow));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load volunteer signups.", error: error.message });
    }
  }

  const signups = memorySignups
    .filter((signup) => signup.userId === req.user.id)
    .map(getMemorySignupDetails)
    .reverse();

  return res.json(signups);
});

app.get("/api/org/opportunities", requireAuth, requireRole("org"), async (req, res) => {
  if (usePostgres) {
    try {
      const opportunities = await loadPostgresOpportunities("WHERE o.organization_id = $1", [req.user.id]);
      const opportunityIds = opportunities.map((item) => item.id);

      if (opportunityIds.length === 0) {
        return res.json([]);
      }

      const signupResult = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email
         FROM signups s
         JOIN users u ON s.user_id = u.id
         WHERE s.opportunity_id = ANY($1::int[])
         ORDER BY s.id DESC`,
        [opportunityIds]
      );

      const signupsByOpportunity = signupResult.rows.reduce((groups, signup) => {
        const opportunityId = signup.opportunity_id;
        groups[opportunityId] = groups[opportunityId] || [];
        groups[opportunityId].push(mapSignupRow(signup));
        return groups;
      }, {});

      return res.json(opportunities.map((opportunity) => ({
        ...opportunity,
        signups: signupsByOpportunity[opportunity.id] || []
      })));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load organization dashboard.", error: error.message });
    }
  }

  const opportunities = memoryOpportunities
    .filter((opportunity) => opportunity.organizationId === req.user.id)
    .map((opportunity) => {
      const mappedOpportunity = mapOpportunityRow(getMemoryOpportunityWithCounts(opportunity));
      const signups = memorySignups
        .filter((signup) => signup.opportunityId === opportunity.id)
        .map(getMemorySignupDetails)
        .reverse();

      return { ...mappedOpportunity, signups };
    });

  return res.json(opportunities);
});

app.patch("/api/org/signups/:id/status", requireAuth, requireRole("org"), async (req, res) => {
  const signupId = Number(req.params.id);
  const status = String(req.body.status || "").trim().toLowerCase();

  if (!signupId) {
    return res.status(400).json({ message: "A valid signup ID is required." });
  }

  if (!ALLOWED_SIGNUP_STATUSES.has(status)) {
    return res.status(400).json({ message: "Status must be confirmed, completed, or no-show." });
  }

  if (usePostgres) {
    try {
      const updateResult = await query(
        `UPDATE signups s
         SET status = $1
         FROM opportunities o
         WHERE s.id = $2
           AND s.opportunity_id = o.id
           AND o.organization_id = $3
         RETURNING s.id`,
        [status, signupId, req.user.id]
      );

      if (updateResult.rows.length === 0) {
        return res.status(404).json({ message: "Signup not found for one of your opportunities." });
      }

      const detailResult = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email,
                o.title AS opportunity_title, o.category, org.organization_name, o.location,
                o.address, o.latitude, o.longitude, o.event_date, o.event_time, o.description
         FROM signups s
         JOIN users u ON s.user_id = u.id
         JOIN opportunities o ON s.opportunity_id = o.id
         JOIN users org ON o.organization_id = org.id
         WHERE s.id = $1`,
        [signupId]
      );

      return res.json(mapSignupRow(detailResult.rows[0]));
    } catch (error) {
      return res.status(500).json({ message: "Unable to update participation status.", error: error.message });
    }
  }

  const signup = memorySignups.find((item) => item.id === signupId);
  const opportunity = signup && memoryOpportunities.find((item) => item.id === signup.opportunityId);

  if (!signup || !opportunity || opportunity.organizationId !== req.user.id) {
    return res.status(404).json({ message: "Signup not found for one of your opportunities." });
  }

  signup.status = status;
  return res.json(getMemorySignupDetails(signup));
});

// Backward-compatible endpoint for viewing all signups during demos.
app.get("/api/signups", async (req, res) => {
  if (usePostgres) {
    try {
      const result = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email,
                o.title AS opportunity_title, o.category, org.organization_name, o.location,
                o.address, o.latitude, o.longitude, o.event_date, o.event_time, o.description
         FROM signups s
         JOIN users u ON s.user_id = u.id
         JOIN opportunities o ON s.opportunity_id = o.id
         JOIN users org ON o.organization_id = org.id
         ORDER BY s.id DESC`
      );

      return res.json(result.rows.map(mapSignupRow));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load signups from PostgreSQL.", error: error.message });
    }
  }

  return res.json(memorySignups.map(getMemorySignupDetails).reverse());
});

app.listen(PORT, () => {
  console.log(`Volunteer Match Board API running at http://localhost:${PORT}`);
  if (usePostgres) {
    console.log("PostgreSQL mode enabled. Make sure server/schema.sql has been run for the Milestone 3 map update.");
  } else {
    console.log("DATABASE_URL not configured. Using in-memory fallback data.");
    console.log("Demo accounts: demo.volunteer@example.com / Password1! and org.admin@example.com / Password1!");
  }
});
