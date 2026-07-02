import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://localhost:5000";

const emptyAuthForm = {
  name: "",
  organizationName: "",
  email: "",
  password: "",
  role: "volunteer"
};

const emptyOpportunityForm = {
  title: "",
  location: "",
  date: "",
  time: "",
  description: "",
  requirements: "",
  skills: "",
  spotsTotal: "5"
};

const passwordRules = [
  { label: "8+ characters", test: (password) => password.length >= 8 },
  { label: "Uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { label: "Number", test: (password) => /[0-9]/.test(password) },
  { label: "Special character", test: (password) => /[^A-Za-z0-9]/.test(password) }
];

function App() {
  const [page, setPage] = useState("main");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("vmbToken") || "");
  const [opportunities, setOpportunities] = useState([]);
  const [mySignups, setMySignups] = useState([]);
  const [orgEvents, setOrgEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunityForm);

  const isVolunteer = user?.role === "volunteer";
  const isOrg = user?.role === "org";

  const signedOpportunityIds = useMemo(() => {
    return new Set(mySignups.map((signup) => signup.opportunityId));
  }, [mySignups]);

  const filteredOpportunities = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return opportunities;
    }

    return opportunities.filter((opportunity) => {
      const searchableText = [
        opportunity.title,
        opportunity.organization,
        opportunity.location,
        opportunity.date,
        opportunity.time,
        opportunity.description,
        ...(opportunity.skills || []),
        ...(opportunity.requirements || [])
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [opportunities, searchTerm]);

  useEffect(() => {
    loadPublicData();
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setMySignups([]);
      setOrgEvents([]);
      return;
    }

    restoreSession(token);
  }, [token]);

  async function request(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "The request failed.");
    }

    return data;
  }

  async function loadPublicData() {
    setLoading(true);

    try {
      const [opportunityData, healthData] = await Promise.all([
        request("/api/opportunities"),
        request("/api/health")
      ]);

      setOpportunities(opportunityData);
      setHealth(healthData);
    } catch (error) {
      console.error(error);
      setMessage("The frontend loaded, but the backend API could not be reached. Make sure the server is running on port 5000.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreSession(savedToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Session expired.");
      }

      setUser(data.user);
      await loadRoleData(data.user.role, savedToken);
    } catch (error) {
      console.warn(error.message);
      localStorage.removeItem("vmbToken");
      setToken("");
      setUser(null);
    }
  }

  async function loadRoleData(role = user?.role, overrideToken = token) {
    if (!role || !overrideToken) {
      return;
    }

    const headers = { Authorization: `Bearer ${overrideToken}` };

    try {
      if (role === "volunteer") {
        const response = await fetch(`${API_BASE_URL}/api/me/signups`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load volunteer signups.");
        setMySignups(data);
      }

      if (role === "org") {
        const response = await fetch(`${API_BASE_URL}/api/org/opportunities`, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load organization events.");
        setOrgEvents(data);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateAuthForm(event) {
    const { name, value } = event.target;
    setAuthForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setMessage("");

    const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = authMode === "login"
      ? { email: authForm.email, password: authForm.password }
      : authForm;

    try {
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify(body)
      });

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("vmbToken", data.token);
      setAuthForm(emptyAuthForm);
      setMessage(data.message);
      setPage("main");
      await loadRoleData(data.user.role, data.token);
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await request("/api/auth/logout", { method: "POST" });
      }
    } catch (error) {
      console.warn(error.message);
    }

    localStorage.removeItem("vmbToken");
    setToken("");
    setUser(null);
    setMySignups([]);
    setOrgEvents([]);
    setPage("main");
    setMessage("Logged out.");
  }

  async function handleSignup(opportunityId) {
    if (!user) {
      setAuthMode("login");
      setPage("auth");
      setMessage("Log in as a volunteer before signing up.");
      return;
    }

    if (!isVolunteer) {
      setMessage("Organization accounts can post opportunities, but they cannot sign up for them.");
      return;
    }

    try {
      const signup = await request("/api/signups", {
        method: "POST",
        body: JSON.stringify({ opportunityId })
      });

      setMySignups((currentSignups) => [signup, ...currentSignups]);
      setMessage(`You signed up for ${signup.opportunityTitle}.`);
      await loadPublicData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateOpportunityForm(event) {
    const { name, value } = event.target;
    setOpportunityForm((currentForm) => ({ ...currentForm, [name]: value }));
  }

  async function handleCreateOpportunity(event) {
    event.preventDefault();
    setMessage("");

    try {
      const opportunity = await request("/api/opportunities", {
        method: "POST",
        body: JSON.stringify({
          ...opportunityForm,
          spotsTotal: Number(opportunityForm.spotsTotal)
        })
      });

      setOpportunities((currentOpportunities) => [opportunity, ...currentOpportunities]);
      setOpportunityForm(emptyOpportunityForm);
      setMessage(`Created opportunity: ${opportunity.title}.`);
      await loadRoleData("org");
      setPage("org");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function goToAuth(mode = "login") {
    setAuthMode(mode);
    setPage("auth");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("main")}>Volunteer Match Board</button>
        <nav className="nav-actions" aria-label="Main navigation">
          <button className={page === "main" ? "nav-link active" : "nav-link"} type="button" onClick={() => setPage("main")}>Opportunities</button>
          {isVolunteer && (
            <button className={page === "volunteer" ? "nav-link active" : "nav-link"} type="button" onClick={() => setPage("volunteer")}>My Signups</button>
          )}
          {isOrg && (
            <button className={page === "org" ? "nav-link active" : "nav-link"} type="button" onClick={() => setPage("org")}>Org Dashboard</button>
          )}
          {user ? (
            <>
              <span className="user-pill">{user.role === "org" ? user.organizationName : user.name}</span>
              <button className="logout-button" type="button" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button className="login-button" type="button" onClick={() => goToAuth("login")}>Login / Create Account</button>
          )}
        </nav>
      </header>

      <main className="page-wrap">
        {message && <div className="notice">{message}</div>}

        {page === "auth" && (
          <AuthPage
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            updateAuthForm={updateAuthForm}
            handleAuthSubmit={handleAuthSubmit}
          />
        )}

        {page === "main" && (
          <MainPage
            user={user}
            isVolunteer={isVolunteer}
            isOrg={isOrg}
            loading={loading}
            health={health}
            opportunities={filteredOpportunities}
            allOpportunities={opportunities}
            mySignups={mySignups}
            signedOpportunityIds={signedOpportunityIds}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSignup={handleSignup}
            goToAuth={goToAuth}
            setPage={setPage}
          />
        )}

        {page === "volunteer" && (
          <VolunteerDashboard user={user} mySignups={mySignups} setPage={setPage} goToAuth={goToAuth} />
        )}

        {page === "org" && (
          <OrgDashboard
            user={user}
            orgEvents={orgEvents}
            opportunityForm={opportunityForm}
            updateOpportunityForm={updateOpportunityForm}
            handleCreateOpportunity={handleCreateOpportunity}
            goToAuth={goToAuth}
          />
        )}
      </main>
    </div>
  );
}

function MainPage({
  user,
  isVolunteer,
  isOrg,
  loading,
  health,
  opportunities,
  allOpportunities,
  mySignups,
  signedOpportunityIds,
  searchTerm,
  setSearchTerm,
  handleSignup,
  goToAuth,
  setPage
}) {
  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Code Milestone 2</p>
          <h1>Find local volunteer work that actually matches people.</h1>
          <p className="hero-copy">
            Guests can browse opportunities. Volunteers can create accounts and sign up. Organizations get a separate dashboard for posting events and viewing who joined.
          </p>
          <div className="hero-actions">
            {!user && <button className="button primary" type="button" onClick={() => goToAuth("register")}>Create Account</button>}
            {isVolunteer && <button className="button primary" type="button" onClick={() => setPage("volunteer")}>View My Signups</button>}
            {isOrg && <button className="button primary" type="button" onClick={() => setPage("org")}>Manage Org Events</button>}
            <a className="button secondary" href="#opportunity-board">Browse Board</a>
          </div>
        </div>

        <aside className="demo-card">
          <h2>Demo Status</h2>
          <p><strong>Backend:</strong> Express API</p>
          <p><strong>Data:</strong> {health?.dataSource || "checking..."}</p>
          <p><strong>Demo Volunteer:</strong> demo.volunteer@example.com</p>
          <p><strong>Demo Org:</strong> org.admin@example.com</p>
          <p className="muted-small">Password for demo accounts: Password1!</p>
        </aside>
      </section>

      {isVolunteer && (
        <section className="section">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Signed In Volunteer</p>
              <h2>My Upcoming Signups</h2>
            </div>
            <button className="text-button" type="button" onClick={() => setPage("volunteer")}>Open full volunteer page</button>
          </div>

          {mySignups.length === 0 ? (
            <div className="empty-state">You have not signed up for anything yet. Pick an opportunity below and send it.</div>
          ) : (
            <div className="horizontal-row">
              {mySignups.map((signup) => (
                <article className="mini-card" key={signup.id}>
                  <strong>{signup.opportunityTitle}</strong>
                  <span>{signup.organization}</span>
                  <span>{signup.date} · {signup.time}</span>
                  <span className="status-dot">{signup.status}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section id="opportunity-board" className="section board-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Public Opportunity Board</p>
            <h2>Available Opportunities</h2>
          </div>
          <div className="search-wrap">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, skill, location..."
            />
          </div>
        </div>

        {!user && (
          <div className="guest-banner">
            You are browsing as a guest. You can view opportunities, but you need a volunteer account to sign up.
          </div>
        )}

        {isOrg && (
          <div className="guest-banner org">
            You are signed in as an organization. You can post events from the org dashboard, but only volunteers can sign up.
          </div>
        )}

        {loading ? (
          <p>Loading opportunities...</p>
        ) : opportunities.length === 0 ? (
          <div className="empty-state">No opportunities matched your search. Try a different word.</div>
        ) : (
          <div className="opportunity-grid">
            {opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                user={user}
                isVolunteer={isVolunteer}
                isOrg={isOrg}
                signedUp={signedOpportunityIds.has(opportunity.id)}
                handleSignup={handleSignup}
                goToAuth={goToAuth}
              />
            ))}
          </div>
        )}

        <p className="muted-small board-count">
          Showing {opportunities.length} of {allOpportunities.length} opportunities.
        </p>
      </section>
    </>
  );
}

function OpportunityCard({ opportunity, user, isVolunteer, isOrg, signedUp, handleSignup, goToAuth }) {
  const isFull = Number(opportunity.spotsOpen) <= 0;

  return (
    <article className="opportunity-card">
      <div className="card-topline">
        <span>{opportunity.organization}</span>
        <span>{opportunity.spotsOpen} / {opportunity.spotsTotal} spots</span>
      </div>
      <h3>{opportunity.title}</h3>
      <p className="description">{opportunity.description}</p>

      <div className="info-grid">
        <p><strong>Date:</strong> {opportunity.date}</p>
        <p><strong>Time:</strong> {opportunity.time}</p>
        <p><strong>Location:</strong> {opportunity.location}</p>
      </div>

      <div className="chip-row">
        {(opportunity.skills || []).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
      </div>

      {opportunity.requirements?.length > 0 && (
        <details className="requirements">
          <summary>Requirements</summary>
          <ul>
            {opportunity.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
          </ul>
        </details>
      )}

      <div className="card-actions">
        {!user && (
          <button className="button primary" type="button" onClick={() => goToAuth("login")}>Log in to Sign Up</button>
        )}
        {isVolunteer && (
          <button
            className="button primary"
            type="button"
            disabled={signedUp || isFull}
            onClick={() => handleSignup(opportunity.id)}
          >
            {signedUp ? "Already Signed Up" : isFull ? "Full" : "Sign Up"}
          </button>
        )}
        {isOrg && <button className="button disabled" type="button" disabled>Volunteer Only</button>}
      </div>
    </article>
  );
}

function AuthPage({ authMode, setAuthMode, authForm, updateAuthForm, handleAuthSubmit }) {
  const isRegister = authMode === "register";

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <p className="eyebrow">Account Access</p>
        <h1>{isRegister ? "Create a role-based account." : "Welcome back."}</h1>
        <p>
          Volunteer accounts can sign up for events. Organization accounts can create opportunities and view the volunteers who signed up.
        </p>
      </div>

      <form className="auth-card" onSubmit={handleAuthSubmit}>
        <div className="tab-row">
          <button className={authMode === "login" ? "tab active" : "tab"} type="button" onClick={() => setAuthMode("login")}>Login</button>
          <button className={authMode === "register" ? "tab active" : "tab"} type="button" onClick={() => setAuthMode("register")}>Create Account</button>
        </div>

        {isRegister && (
          <>
            <label>
              Full Name
              <input name="name" value={authForm.name} onChange={updateAuthForm} placeholder="Joshua Schmidt" />
            </label>

            <label>
              Account Type
              <select name="role" value={authForm.role} onChange={updateAuthForm}>
                <option value="volunteer">Volunteer</option>
                <option value="org">Organization</option>
              </select>
            </label>

            {authForm.role === "org" && (
              <label>
                Organization Name
                <input name="organizationName" value={authForm.organizationName} onChange={updateAuthForm} placeholder="Community Food Center" />
              </label>
            )}
          </>
        )}

        <label>
          Email
          <input name="email" type="email" value={authForm.email} onChange={updateAuthForm} placeholder="name@example.com" />
        </label>

        <label>
          Password
          <input name="password" type="password" value={authForm.password} onChange={updateAuthForm} placeholder="Password1!" />
        </label>

        {isRegister && (
          <div className="password-rules">
            {passwordRules.map((rule) => (
              <span className={rule.test(authForm.password) ? "rule pass" : "rule"} key={rule.label}>{rule.label}</span>
            ))}
          </div>
        )}

        <button className="button primary full" type="submit">
          {isRegister ? "Create Account" : "Login"}
        </button>

        <p className="muted-small">
          Demo login: demo.volunteer@example.com or org.admin@example.com with Password1!
        </p>
      </form>
    </section>
  );
}

function VolunteerDashboard({ user, mySignups, setPage, goToAuth }) {
  if (!user) {
    return <LockedPage title="Volunteer Dashboard" message="Log in as a volunteer to view your signed-up opportunities." goToAuth={goToAuth} />;
  }

  if (user.role !== "volunteer") {
    return <LockedPage title="Volunteer Dashboard" message="This page is only for volunteer accounts." goToAuth={goToAuth} hideButton />;
  }

  return (
    <section className="dashboard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Volunteer User Page</p>
          <h1>{user.name}'s Signups</h1>
          <p className="muted">Detailed list of the opportunities this volunteer has joined.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => setPage("main")}>Find More Events</button>
      </div>

      {mySignups.length === 0 ? (
        <div className="empty-state large">No signed-up opportunities yet. Go back to the board and grab one.</div>
      ) : (
        <div className="vertical-list">
          {mySignups.map((signup) => (
            <article className="wide-card" key={signup.id}>
              <div>
                <p className="eyebrow">{signup.status}</p>
                <h2>{signup.opportunityTitle}</h2>
                <p>{signup.description}</p>
              </div>
              <div className="side-details">
                <p><strong>Organization:</strong> {signup.organization}</p>
                <p><strong>Date:</strong> {signup.date}</p>
                <p><strong>Time:</strong> {signup.time}</p>
                <p><strong>Location:</strong> {signup.location}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OrgDashboard({ user, orgEvents, opportunityForm, updateOpportunityForm, handleCreateOpportunity, goToAuth }) {
  if (!user) {
    return <LockedPage title="Organization Dashboard" message="Log in as an organization to create and manage opportunities." goToAuth={goToAuth} />;
  }

  if (user.role !== "org") {
    return <LockedPage title="Organization Dashboard" message="This page is only for organization accounts." goToAuth={goToAuth} hideButton />;
  }

  return (
    <section className="dashboard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Organization Page</p>
          <h1>{user.organizationName}</h1>
          <p className="muted">Create opportunities and see who has signed up for each event.</p>
        </div>
      </div>

      <div className="org-layout">
        <form className="create-card" onSubmit={handleCreateOpportunity}>
          <h2>Create Opportunity</h2>
          <input name="title" value={opportunityForm.title} onChange={updateOpportunityForm} placeholder="Opportunity title" />
          <input name="location" value={opportunityForm.location} onChange={updateOpportunityForm} placeholder="Location" />
          <div className="form-row">
            <input name="date" value={opportunityForm.date} onChange={updateOpportunityForm} placeholder="Date" />
            <input name="time" value={opportunityForm.time} onChange={updateOpportunityForm} placeholder="Time" />
          </div>
          <textarea name="description" value={opportunityForm.description} onChange={updateOpportunityForm} placeholder="Short description" />
          <input name="requirements" value={opportunityForm.requirements} onChange={updateOpportunityForm} placeholder="Requirements, comma-separated" />
          <input name="skills" value={opportunityForm.skills} onChange={updateOpportunityForm} placeholder="Skills, comma-separated" />
          <input name="spotsTotal" type="number" min="1" value={opportunityForm.spotsTotal} onChange={updateOpportunityForm} placeholder="Spots available" />
          <button className="button primary full" type="submit">Post Opportunity</button>
        </form>

        <div className="org-events">
          <h2>My Posted Events</h2>
          {orgEvents.length === 0 ? (
            <div className="empty-state">No posted opportunities yet. Create one with the form.</div>
          ) : (
            <div className="vertical-list small-gap">
              {orgEvents.map((event) => (
                <article className="org-event-card" key={event.id}>
                  <div className="card-topline">
                    <span>{event.date} · {event.time}</span>
                    <span>{event.signupsCount} signed up</span>
                  </div>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <p><strong>Location:</strong> {event.location}</p>

                  <div className="volunteer-list">
                    <strong>Signed-up volunteers</strong>
                    {event.signups.length === 0 ? (
                      <span className="muted-small">No volunteers yet.</span>
                    ) : (
                      event.signups.map((signup) => (
                        <span className="volunteer-pill" key={signup.id}>{signup.volunteerName} · {signup.volunteerEmail}</span>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LockedPage({ title, message, goToAuth, hideButton = false }) {
  return (
    <section className="locked-card">
      <p className="eyebrow">Access Required</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {!hideButton && <button className="button primary" type="button" onClick={() => goToAuth("login")}>Login</button>}
    </section>
  );
}

export default App;
