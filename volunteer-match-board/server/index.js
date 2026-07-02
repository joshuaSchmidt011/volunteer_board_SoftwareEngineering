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
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(testHash, "hex"));
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

function mapOpportunityRow(row) {
  const signupsCount = Number(row.signups_count ?? row.signupsCount ?? 0);
  const spotsTotal = Number(row.spots_total ?? row.spotsTotal ?? row.spots_open ?? 0);
  const spotsOpen = Number(row.spots_open ?? row.spotsOpen ?? Math.max(spotsTotal - signupsCount, 0));

  return {
    id: row.id,
    title: row.title,
    organizationId: row.organization_id || row.organizationId || null,
    organization: row.organization_name || row.organization || "Community Organization",
    location: row.location,
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
    id: row.id,
    userId: row.user_id || row.userId,
    volunteerName: row.volunteer_name || row.volunteerName,
    volunteerEmail: row.volunteer_email || row.volunteerEmail,
    opportunityId: row.opportunity_id || row.opportunityId,
    opportunityTitle: row.opportunity_title || row.opportunityTitle,
    organization: row.organization_name || row.organization,
    location: row.location,
    date: row.event_date || row.date,
    time: row.event_time || row.time || "TBD",
    description: row.description,
    status: row.status || "confirmed"
  };
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
    organizationId: 2,
    organization: "Community Food Center",
    location: "Omaha, NE",
    date: "June 15, 2026",
    time: "10:00 AM - 2:00 PM",
    description: "Volunteers will help sort donated food, organize shelves, and prepare food boxes for families.",
    requirements: ["Must be able to stand for 2 hours", "Closed-toe shoes required", "No prior experience required"],
    skills: ["Organization", "Customer Service"],
    spotsTotal: 5
  },
  {
    id: 2,
    title: "Park Cleanup Crew",
    organizationId: 3,
    organization: "Green City Volunteers",
    location: "Lincoln, NE",
    date: "June 21, 2026",
    time: "10:00 AM - 1:00 PM",
    description: "Join a local cleanup event to remove litter, clear walking paths, and improve a community park.",
    requirements: ["Outdoor clothing recommended", "Gloves provided"],
    skills: ["Outdoor Work", "Teamwork"],
    spotsTotal: 12
  },
  {
    id: 3,
    title: "Animal Shelter Assistant",
    organizationId: 2,
    organization: "Community Food Center",
    location: "Bellevue, NE",
    date: "June 24, 2026",
    time: "5:30 PM - 7:30 PM",
    description: "Support shelter staff by helping with basic cleaning, feeding, and animal socialization.",
    requirements: ["Comfortable around animals", "Wear clothes that can get dirty"],
    skills: ["Animal Care", "Patience"],
    spotsTotal: 5
  },
  {
    id: 4,
    title: "Senior Center Tech Help",
    organizationId: 3,
    organization: "Green City Volunteers",
    location: "Papillion, NE",
    date: "June 26, 2026",
    time: "3:00 PM - 5:00 PM",
    description: "Assist seniors with basic technology questions such as email, phones, and online forms.",
    requirements: ["Basic computer confidence", "Patient communication style"],
    skills: ["Basic Computers", "Communication"],
    spotsTotal: 6
  }
];

let memorySignups = [];
let nextMemoryUserId = 4;
let nextMemoryOpportunityId = 5;
let nextMemorySignupId = 1;

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
    organization: opportunity?.organization || "Organization",
    location: opportunity?.location || "",
    date: opportunity?.date || "",
    time: opportunity?.time || "TBD",
    description: opportunity?.description || "",
    status: signup.status
  });
}

app.get("/", (req, res) => {
  res.send("Volunteer Match Board API is running. Try /api/health or /api/opportunities.");
});

app.get("/api/health", async (req, res) => {
  const database = await checkDatabaseConnection();

  res.json({
    app: "Volunteer Match Board",
    milestone: "Code Milestone 2",
    status: "running",
    frontend: "React/Vite client",
    backend: "Node.js/Express API",
    dataSource: database.mode,
    database,
    implementedFeatures: [
      "Guest users can browse and search available volunteer opportunities",
      "Volunteer and organization accounts have separate roles",
      "Registration validates email format and password complexity",
      "Passwords are stored as salted hashes instead of plaintext",
      "Volunteers can sign up for opportunities after logging in",
      "Organizations can create opportunities but cannot sign up for them",
      "Volunteer dashboard lists the user's confirmed signups",
      "Organization dashboard lists created events and signed-up volunteers",
      "PostgreSQL support is available when DATABASE_URL is configured",
      "In-memory fallback keeps the demo running if PostgreSQL is not configured"
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
  res.status(201).json({ message: "Account created successfully.", user: publicUser, token });
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
  res.json({ message: "Login successful.", user: publicUser, token });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Logged out." });
});

app.get("/api/opportunities", async (req, res) => {
  if (usePostgres) {
    try {
      const result = await query(
        `SELECT o.id, o.title, o.organization_id, u.organization_name, o.location,
                o.event_date, o.event_time, o.description, o.requirements, o.skills,
                o.spots_total,
                COUNT(s.id)::int AS signups_count,
                GREATEST(o.spots_total - COUNT(s.id)::int, 0) AS spots_open
         FROM opportunities o
         JOIN users u ON o.organization_id = u.id
         LEFT JOIN signups s ON s.opportunity_id = o.id
         GROUP BY o.id, u.organization_name
         ORDER BY o.id DESC`
      );

      return res.json(result.rows.map(mapOpportunityRow));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load opportunities from PostgreSQL.", error: error.message });
    }
  }

  res.json(memoryOpportunities.map(getMemoryOpportunityWithCounts).map(mapOpportunityRow));
});

app.get("/api/opportunities/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (usePostgres) {
    try {
      const result = await query(
        `SELECT o.id, o.title, o.organization_id, u.organization_name, o.location,
                o.event_date, o.event_time, o.description, o.requirements, o.skills,
                o.spots_total,
                COUNT(s.id)::int AS signups_count,
                GREATEST(o.spots_total - COUNT(s.id)::int, 0) AS spots_open
         FROM opportunities o
         JOIN users u ON o.organization_id = u.id
         LEFT JOIN signups s ON s.opportunity_id = o.id
         WHERE o.id = $1
         GROUP BY o.id, u.organization_name`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Opportunity not found." });
      }

      return res.json(mapOpportunityRow(result.rows[0]));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load opportunity from PostgreSQL.", error: error.message });
    }
  }

  const opportunity = memoryOpportunities.find((item) => item.id === id);
  if (!opportunity) {
    return res.status(404).json({ message: "Opportunity not found." });
  }

  res.json(mapOpportunityRow(getMemoryOpportunityWithCounts(opportunity)));
});

app.post("/api/opportunities", requireAuth, requireRole("org"), async (req, res) => {
  const title = String(req.body.title || "").trim();
  const location = String(req.body.location || "").trim();
  const date = String(req.body.date || "").trim();
  const time = String(req.body.time || "TBD").trim() || "TBD";
  const description = String(req.body.description || "").trim();
  const requirements = makeArray(req.body.requirements, ["No special requirements"]);
  const skills = makeArray(req.body.skills, ["General Help"]);
  const spotsTotal = Number(req.body.spotsTotal || req.body.spotsOpen || 10);

  if (!title || !location || !date || !description) {
    return res.status(400).json({ message: "Title, location, date, and description are required." });
  }

  if (!Number.isInteger(spotsTotal) || spotsTotal < 1) {
    return res.status(400).json({ message: "Spots available must be a positive whole number." });
  }

  if (usePostgres) {
    try {
      const result = await query(
        `INSERT INTO opportunities
          (title, organization_id, location, event_date, event_time, description, requirements, skills, spots_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, title, organization_id, location, event_date, event_time, description, requirements, skills, spots_total`,
        [title, req.user.id, location, date, time, description, requirements, skills, spotsTotal]
      );

      const row = {
        ...result.rows[0],
        organization_name: req.user.organizationName,
        signups_count: 0,
        spots_open: spotsTotal
      };

      return res.status(201).json(mapOpportunityRow(row));
    } catch (error) {
      return res.status(500).json({ message: "Unable to save opportunity to PostgreSQL.", error: error.message });
    }
  }

  const opportunity = {
    id: nextMemoryOpportunityId++,
    title,
    organizationId: req.user.id,
    organization: req.user.organizationName,
    location,
    date,
    time,
    description,
    requirements,
    skills,
    spotsTotal
  };

  memoryOpportunities = [opportunity, ...memoryOpportunities];
  res.status(201).json(mapOpportunityRow(getMemoryOpportunityWithCounts(opportunity)));
});

app.post("/api/signups", requireAuth, requireRole("volunteer"), async (req, res) => {
  const opportunityId = Number(req.body.opportunityId);

  if (!opportunityId) {
    return res.status(400).json({ message: "A valid opportunity ID is required." });
  }

  if (usePostgres) {
    try {
      const opportunityResult = await query(
        `SELECT o.id, o.title, u.organization_name, o.location, o.event_date, o.event_time,
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
        organization_name: opportunity.organization_name,
        location: opportunity.location,
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
  res.status(201).json(getMemorySignupDetails(signup));
});

app.get("/api/me/signups", requireAuth, requireRole("volunteer"), async (req, res) => {
  if (usePostgres) {
    try {
      const result = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email,
                o.title AS opportunity_title, org.organization_name, o.location,
                o.event_date, o.event_time, o.description
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

  res.json(signups);
});

app.get("/api/org/opportunities", requireAuth, requireRole("org"), async (req, res) => {
  if (usePostgres) {
    try {
      const opportunityResult = await query(
        `SELECT o.id, o.title, o.organization_id, u.organization_name, o.location,
                o.event_date, o.event_time, o.description, o.requirements, o.skills,
                o.spots_total,
                COUNT(s.id)::int AS signups_count,
                GREATEST(o.spots_total - COUNT(s.id)::int, 0) AS spots_open
         FROM opportunities o
         JOIN users u ON o.organization_id = u.id
         LEFT JOIN signups s ON s.opportunity_id = o.id
         WHERE o.organization_id = $1
         GROUP BY o.id, u.organization_name
         ORDER BY o.id DESC`,
        [req.user.id]
      );

      const opportunities = opportunityResult.rows.map(mapOpportunityRow);
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

  res.json(opportunities);
});

// Backward-compatible endpoint for viewing all signups during demos.
app.get("/api/signups", async (req, res) => {
  if (usePostgres) {
    try {
      const result = await query(
        `SELECT s.id, s.user_id, s.opportunity_id, s.status,
                u.name AS volunteer_name, u.email AS volunteer_email,
                o.title AS opportunity_title, org.organization_name, o.location,
                o.event_date, o.event_time, o.description
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

  res.json(memorySignups.map(getMemorySignupDetails).reverse());
});

app.listen(PORT, () => {
  console.log(`Volunteer Match Board API running at http://localhost:${PORT}`);
  if (usePostgres) {
    console.log("PostgreSQL mode enabled. Make sure server/schema.sql has been run for Milestone 2.");
  } else {
    console.log("DATABASE_URL not configured. Using in-memory fallback data.");
    console.log("Demo accounts: demo.volunteer@example.com / Password1! and org.admin@example.com / Password1!");
  }
});
