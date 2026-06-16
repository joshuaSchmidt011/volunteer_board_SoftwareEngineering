const express = require("express");
const cors = require("cors");

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
    description:
      "Help sort donated food and prepare pickup boxes for local families."
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
    description:
      "Join a local cleanup event to remove litter and improve a community park."
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
    description:
      "Support shelter staff by helping with basic cleaning, feeding, and animal socialization."
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
    description:
      "Assist seniors with basic technology questions such as email, phones, and online forms."
  }
];

const signups = [];

const projectStatus = {
  app: "Volunteer Match Board",
  milestone: "Code Milestone 1",
  status: "running",
  frontend: "React/Vite client",
  backend: "Node.js/Express API",
  database:
    "PostgreSQL is planned for a later persistent data version. This milestone uses in-memory seed data so the demo can run locally without database setup.",
  implementedFeatures: [
    "React frontend loads and displays the project UI",
    "Express backend serves volunteer opportunity data",
    "Frontend fetches opportunity data from backend API",
    "Volunteer signup prototype stores signups in memory",
    "Organization admin prototype can add a sample opportunity during the running session",
    "Backend health endpoint reports milestone status"
  ]
};

app.get("/", (req, res) => {
  res.send("Volunteer Match Board API is running. Try /api/health or /api/opportunities.");
});

app.get("/api/health", (req, res) => {
  res.json(projectStatus);
});

app.get("/api/opportunities", (req, res) => {
  res.json(opportunities);
});

app.get("/api/opportunities/:id", (req, res) => {
  const opportunity = opportunities.find((item) => item.id === Number(req.params.id));

  if (!opportunity) {
    return res.status(404).json({ message: "Opportunity not found" });
  }

  res.json(opportunity);
});

app.post("/api/opportunities", (req, res) => {
  const { title, organization, location, date, time, description } = req.body;

  if (!title || !organization || !location || !date || !time || !description) {
    return res.status(400).json({
      message:
        "Missing required fields. Title, organization, location, date, time, and description are required."
    });
  }

  const newOpportunity = {
    id: opportunities.length + 1,
    title,
    organization,
    location,
    date,
    time,
    description,
    skills: ["General Help"],
    spotsOpen: 10
  };

  opportunities = [newOpportunity, ...opportunities];
  res.status(201).json(newOpportunity);
});

app.post("/api/signups", (req, res) => {
  const { volunteerName, opportunityId } = req.body;
  const opportunity = opportunities.find((item) => item.id === Number(opportunityId));

  if (!volunteerName || !opportunity) {
    return res.status(400).json({
      message: "A volunteer name and valid opportunity ID are required."
    });
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

app.get("/api/signups", (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Volunteer Match Board API running at http://localhost:${PORT}`);
});
