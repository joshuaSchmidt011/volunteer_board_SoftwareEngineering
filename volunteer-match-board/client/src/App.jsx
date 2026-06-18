import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://localhost:5000";

const emptyAdminForm = {
  title: "",
  organization: "",
  location: "",
  date: "",
  time: "",
  description: ""
};

function App() {
  const [opportunities, setOpportunities] = useState([]);
  const [signups, setSignups] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [volunteerName, setVolunteerName] = useState("Demo Volunteer");
  const [email, setEmail] = useState("demo.volunteer@example.com");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [message, setMessage] = useState("");
  const [adminForm, setAdminForm] = useState(emptyAdminForm);

  const selectedOpportunity = useMemo(() => {
    return opportunities.find((item) => item.id === selectedOpportunityId) || opportunities[0];
  }, [opportunities, selectedOpportunityId]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [opportunityResponse, signupResponse, healthResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/opportunities`),
        fetch(`${API_BASE_URL}/api/signups`),
        fetch(`${API_BASE_URL}/api/health`)
      ]);

      const opportunityData = await opportunityResponse.json();
      const signupData = await signupResponse.json();
      const healthData = await healthResponse.json();

      setOpportunities(opportunityData);
      setSignups(signupData);
      setSelectedOpportunityId(opportunityData[0]?.id ?? null);
      setHealth(healthData);
    } catch (error) {
      console.error("Error loading application data:", error);
      setMessage("The frontend loaded, but the backend API could not be reached. Make sure the server is running on port 5000.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePrototypeLogin(event) {
    event.preventDefault();

    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    setVolunteerName(data.user.name);
    setMessage(data.message);
  }

  async function handleSignup(opportunityId) {
    const response = await fetch(`${API_BASE_URL}/api/signups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ volunteerName, opportunityId })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Unable to complete signup.");
      return;
    }

    setSignups((currentSignups) => [data, ...currentSignups]);
    setMessage(`${data.volunteerName} signed up for ${data.opportunityTitle}.`);
  }

  function updateAdminForm(event) {
    const { name, value } = event.target;
    setAdminForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleAddOpportunity(event) {
    event.preventDefault();

    const response = await fetch(`${API_BASE_URL}/api/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminForm)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || "Unable to create opportunity.");
      return;
    }

    setOpportunities((currentOpportunities) => [data, ...currentOpportunities]);
    setSelectedOpportunityId(data.id);
    setAdminForm(emptyAdminForm);
    setMessage(`New opportunity created: ${data.title}.`);
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="tag">Code Milestone 1</p>
          <h1>Volunteer Match Board</h1>
          <p className="hero-copy">
            A React, Node/Express, and PostgreSQL-ready prototype for helping volunteers browse local opportunities,
            sign up for events, and preview future organization/admin features.
          </p>
          <div className="hero-actions">
            <a href="#opportunities" className="button primary">View Opportunities</a>
            <a href="#admin" className="button secondary">Admin Prototype</a>
          </div>
        </div>
        <aside className="status-card">
          <h2>Milestone Status</h2>
          <p><strong>Frontend:</strong> React/Vite</p>
          <p><strong>Backend:</strong> Express API</p>
          <p><strong>Data Source:</strong> {health?.dataSource || "checking..."}</p>
          <p><strong>Database:</strong> {health?.database?.message || "waiting for backend health check"}</p>
        </aside>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="section grid two-columns">
        <div className="panel">
          <p className="tag">Prototype Account Flow</p>
          <h2>Volunteer Login Preview</h2>
          <p>
            This is a milestone prototype. It demonstrates where authentication will fit in the
            application without storing real user accounts yet.
          </p>
          <form onSubmit={handlePrototypeLogin} className="form-stack">
            <label>
              Demo Email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="demo.volunteer@example.com"
              />
            </label>
            <button className="button primary" type="submit">Run Prototype Login</button>
          </form>
        </div>

        <div className="panel">
          <p className="tag">System Health</p>
          <h2>Backend and Database Check</h2>
          {health ? (
            <>
              <p><strong>Mode:</strong> {health.dataSource}</p>
              <ul className="check-list">
                {health.implementedFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Health data is not loaded yet.</p>
          )}
        </div>
      </section>

      <section id="opportunities" className="section">
        <div className="section-heading">
          <div>
            <p className="tag">Volunteer View</p>
            <h2>Available Opportunities</h2>
          </div>
          <p>{opportunities.length} opportunities loaded from the backend API.</p>
        </div>

        {loading ? (
          <p>Loading opportunities...</p>
        ) : (
          <div className="cards">
            {opportunities.map((opportunity) => (
              <article
                className={`card ${selectedOpportunity?.id === opportunity.id ? "selected" : ""}`}
                key={opportunity.id}
              >
                <h3>{opportunity.title}</h3>
                <p className="muted">{opportunity.organization}</p>
                <p><strong>Location:</strong> {opportunity.location}</p>
                <p><strong>Date:</strong> {opportunity.date}</p>
                <p><strong>Time:</strong> {opportunity.time}</p>
                <p>{opportunity.description}</p>
                <p><strong>Skills:</strong> {opportunity.skills.join(", ")}</p>
                <div className="card-actions">
                  <button
                    className="button secondary"
                    onClick={() => setSelectedOpportunityId(opportunity.id)}
                    type="button"
                  >
                    View Details
                  </button>
                  <button
                    className="button primary"
                    onClick={() => handleSignup(opportunity.id)}
                    type="button"
                  >
                    Sign Up
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedOpportunity && (
        <section className="section grid two-columns">
          <div className="panel detail-panel">
            <p className="tag">Opportunity Detail</p>
            <h2>{selectedOpportunity.title}</h2>
            <p>{selectedOpportunity.description}</p>
            <p><strong>Organization:</strong> {selectedOpportunity.organization}</p>
            <p><strong>Location:</strong> {selectedOpportunity.location}</p>
            <p><strong>Open Spots:</strong> {selectedOpportunity.spotsOpen}</p>
            <label>
              Volunteer Name
              <input
                value={volunteerName}
                onChange={(event) => setVolunteerName(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              onClick={() => handleSignup(selectedOpportunity.id)}
              type="button"
            >
              Confirm Signup
            </button>
          </div>

          <div className="panel dashboard-panel">
            <p className="tag">Dashboard Preview</p>
            <h2>Current Signups</h2>
            {signups.length === 0 ? (
              <p>No signups yet. Use the Sign Up button to create a prototype signup.</p>
            ) : (
              <div className="signup-list">
                {signups.map((signup) => (
                  <article className="signup" key={signup.id}>
                    <strong>{signup.opportunityTitle}</strong>
                    <span>{signup.organization}</span>
                    <span>{signup.date}</span>
                    <span>Status: {signup.status}</span>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section id="admin" className="section panel">
        <p className="tag">Organization Admin Prototype</p>
        <h2>Create a Sample Opportunity</h2>
        <p>
          This form demonstrates the planned organization/admin workflow. If PostgreSQL is configured,
          entries are saved to the database. If not, they are saved in memory until the server restarts.
        </p>
        <form onSubmit={handleAddOpportunity} className="admin-form">
          <input name="title" value={adminForm.title} onChange={updateAdminForm} placeholder="Opportunity title" />
          <input name="organization" value={adminForm.organization} onChange={updateAdminForm} placeholder="Organization" />
          <input name="location" value={adminForm.location} onChange={updateAdminForm} placeholder="Location" />
          <input name="date" value={adminForm.date} onChange={updateAdminForm} placeholder="Date" />
          <input name="time" value={adminForm.time} onChange={updateAdminForm} placeholder="Time" />
          <textarea
            name="description"
            value={adminForm.description}
            onChange={updateAdminForm}
            placeholder="Short description"
          />
          <button className="button primary" type="submit">Add Opportunity</button>
        </form>
      </section>

      <section className="section map-placeholder">
        <h2>Google Maps Integration Coming Later</h2>
        <p>
          Future milestones will connect opportunity locations to Google Maps so volunteers can search
          for nearby service options. For Milestone 1, this is represented as a planned integration area.
        </p>
      </section>
    </main>
  );
}

export default App;
