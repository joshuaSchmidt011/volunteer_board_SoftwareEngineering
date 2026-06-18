require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  allowFallback,
  query,
  initializeDatabase,
  getDatabaseState,
  isPostgresConnected
} = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let opportunities = [
  {
    id: 1,
    title: "Food Bank Helper",
    organization: "Heartland Food Pantry",
    location: "Omaha, NE",
    date: "Saturday, June 20",
    time: "9:00 AM - 12:00 PM",
    skills: ["Organization", "Customer Service"],
    spotsOpen: 8,
    description: "Help sort donated food and prepare pickup boxes for local families."
  },
  {
    id: 2,
    title: "Park Cleanup Crew",
    organization: "Green City Volunteers",
    location: "Lincoln, NE",
    date: "Sunday, June 21",
    time: "10:00 AM - 1:00 PM",
    skills: ["Outdoor Work", "Teamwork"],
    spotsOpen: 12,
    description: "Join a local cleanup event to remove litter and improve a community park."
  },
  {
    id: 3,
    title: "Animal Shelter Assistant",
    organization: "Safe Paws Shelter",
    location: "Bellevue, NE",
    date: "Wednesday, June 24",
    time: "5:30 PM - 7:30 PM",
    skills: ["Animal Care", "Patience"],
    spotsOpen: 5,
    description: "Support shelter staff by helping with basic cleaning, feeding, and animal socialization."
  },
  {
    id: 4,
    title: "Senior Center Tech Help",
    organization: "Community Connections",
    location: "Papillion, NE",
    date: "Friday, June 26",
    time: "3:00 PM - 5:00 PM",
    skills: ["Basic Computers", "Communication"],
    spotsOpen: 6,
    description: "Assist seniors with basic technology questions such as email, phones, and online forms."
  }
];

let signups = [];

function mapOpportunityRow(row) {
  return {
    id: row.id,
    title: row.title,
    organization: row.organization,
    location: row.location,
    date: row.event_date,
    time: row.event_time,
    skills: row.skills || ["General Help"],
    spotsOpen: row.spots_open,
    description: row.description
  };
}

function mapSignupRow(row) {
  return {
    id: row.id,
    volunteerName: row.volunteer_name,
    opportunityId: row.opportunity_id,
    opportunityTitle: row.opportunity_title,
    organization: row.organization,
    date: row.event_date,
    status: row.status
  };
}

function fallbackUnavailable(res) {
  return res.status(503).json({
    message: "PostgreSQL is not connected and fallback mode is disabled.",
    database: getDatabaseState()
  });
}

app.get("/", (req, res) => {
  res.send("Volunteer Match Board API is running. Try /api/health or /api/opportunities.");
});

app.get("/api/health", (req, res) => {
  const database = getDatabaseState();

  res.json({
    app: "Volunteer Match Board",
    milestone: "Code Milestone 1",
    status: "running",
    frontend: "React/Vite client",
    backend: "Node.js/Express API",
    dataSource: database.mode,
    database,
    implementedFeatures: [
      "React frontend loads and displays the project UI",
      "Express backend serves volunteer opportunity data",
      "Backend attempts PostgreSQL first on server startup",
      "PostgreSQL tables are created/checked automatically when the connection works",
      "In-memory fallback is used only after a PostgreSQL connection attempt fails",
      "Volunteer signup prototype stores signups",
      "Organization admin prototype can add a sample opportunity",
      "Backend health endpoint reports database attempt status"
    ]
  });
});

app.get("/api/opportunities", async (req, res) => {
  if (isPostgresConnected()) {
    try {
      const result = await query(
        `SELECT id, title, organization, location, event_date, event_time, description, skills, spots_open
         FROM opportunities
         ORDER BY id DESC`
      );
      return res.json(result.rows.map(mapOpportunityRow));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load opportunities from PostgreSQL.", error: error.message });
    }
  }

  if (!allowFallback) return fallbackUnavailable(res);
  res.json(opportunities);
});

app.post("/api/opportunities", async (req, res) => {
  const { title, organization, location, date, time, description } = req.body;

  if (!title || !organization || !location || !date || !description) {
    return res.status(400).json({ message: "Title, organization, location, date, and description are required." });
  }

  if (isPostgresConnected()) {
    try {
      const result = await query(
        `INSERT INTO opportunities
          (title, organization, location, event_date, event_time, description, skills, spots_open)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, title, organization, location, event_date, event_time, description, skills, spots_open`,
        [title, organization, location, date, time || "TBD", description, ["General Help"], 10]
      );

      return res.status(201).json(mapOpportunityRow(result.rows[0]));
    } catch (error) {
      return res.status(500).json({ message: "Unable to save opportunity to PostgreSQL.", error: error.message });
    }
  }

  if (!allowFallback) return fallbackUnavailable(res);

  const newOpportunity = {
    id: opportunities.length + 1,
    title,
    organization,
    location,
    date,
    time: time || "TBD",
    description,
    skills: ["General Help"],
    spotsOpen: 10
  };

  opportunities = [newOpportunity, ...opportunities];
  res.status(201).json(newOpportunity);
});

app.post("/api/signups", async (req, res) => {
  const { volunteerName, opportunityId } = req.body;
  const id = Number(opportunityId);

  if (!volunteerName || !id) {
    return res.status(400).json({ message: "A volunteer name and valid opportunity ID are required." });
  }

  if (isPostgresConnected()) {
    try {
      const opportunityResult = await query(
        `SELECT id, title, organization, event_date
         FROM opportunities
         WHERE id = $1`,
        [id]
      );

      if (opportunityResult.rows.length === 0) {
        return res.status(404).json({ message: "Opportunity not found." });
      }

      const signupResult = await query(
        `INSERT INTO signups (volunteer_name, opportunity_id)
         VALUES ($1, $2)
         RETURNING id, volunteer_name, opportunity_id, status`,
        [volunteerName, id]
      );

      const opportunity = opportunityResult.rows[0];
      const signup = signupResult.rows[0];

      return res.status(201).json({
        id: signup.id,
        volunteerName: signup.volunteer_name,
        opportunityId: signup.opportunity_id,
        opportunityTitle: opportunity.title,
        organization: opportunity.organization,
        date: opportunity.event_date,
        status: signup.status
      });
    } catch (error) {
      return res.status(500).json({ message: "Unable to save signup to PostgreSQL.", error: error.message });
    }
  }

  if (!allowFallback) return fallbackUnavailable(res);

  const opportunity = opportunities.find((item) => item.id === id);

  if (!opportunity) {
    return res.status(404).json({ message: "Opportunity not found." });
  }

  const signup = {
    id: signups.length + 1,
    volunteerName,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    organization: opportunity.organization,
    date: opportunity.date,
    status: "confirmed"
  };

  signups.push(signup);
  res.status(201).json(signup);
});

app.get("/api/signups", async (req, res) => {
  if (isPostgresConnected()) {
    try {
      const result = await query(
        `SELECT s.id, s.volunteer_name, s.opportunity_id, s.status,
                o.title AS opportunity_title, o.organization, o.event_date
         FROM signups s
         JOIN opportunities o ON s.opportunity_id = o.id
         ORDER BY s.id DESC`
      );

      return res.json(result.rows.map(mapSignupRow));
    } catch (error) {
      return res.status(500).json({ message: "Unable to load signups from PostgreSQL.", error: error.message });
    }
  }

  if (!allowFallback) return fallbackUnavailable(res);
  res.json(signups);
});

app.post("/api/auth/login", (req, res) => {
  const { email } = req.body;

  res.json({
    message: "Prototype login successful. Full authentication will be added in a later milestone.",
    user: {
      id: 1,
      name: "Demo Volunteer",
      email: email || "demo.volunteer@example.com",
      role: "volunteer"
    }
  });
});

async function startServer() {
  const database = await initializeDatabase();

  if (!database.connected && !allowFallback) {
    console.error(database.message);
    console.error("Fallback is disabled, so the server will not start.");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Volunteer Match Board API running at http://localhost:${PORT}`);
    console.log(database.message);
  });
}

startServer();
