import { useEffect, useMemo, useState } from "react";
import "./App.css";
import EventMap from "./EventMap";

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
  category: "",
  location: "",
  address: "",
  latitude: "",
  longitude: "",
  date: "",
  time: "",
  description: "",
  requirements: "",
  skills: "",
  spotsTotal: "5"
};

const emptyFilters = {
  category: "",
  location: "",
  availability: ""
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
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [mySignups, setMySignups] = useState([]);
  const [orgEvents, setOrgEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunityForm);
  const [editingOpportunityId, setEditingOpportunityId] = useState(null);
  const [locatingAddress, setLocatingAddress] = useState(false);

  const isVolunteer = user?.role === "volunteer";
  const isOrg = user?.role === "org";

  const signedOpportunityIds = useMemo(() => {
    return new Set(mySignups.map((signup) => signup.opportunityId));
  }, [mySignups]);

  const filterOptions = useMemo(() => {
    const categories = [...new Set(opportunities.map((item) => item.category).filter(Boolean))].sort();
    const locations = [...new Set(opportunities.map((item) => item.location).filter(Boolean))].sort();
    return { categories, locations };
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

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
      ]
        .join(" ")
        .toLowerCase();

      if (search && !searchableText.includes(search)) return false;
      if (filters.category && opportunity.category !== filters.category) return false;
      if (filters.location && opportunity.location !== filters.location) return false;
      if (filters.availability === "open" && Number(opportunity.spotsOpen) <= 0) return false;
      if (filters.availability === "full" && Number(opportunity.spotsOpen) > 0) return false;
      return true;
    });
  }, [opportunities, searchTerm, filters]);

  useEffect(() => {
    loadPublicData();
    // The initial public load runs only once when the app mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) {
      restoreSession(token);
    }
    // Session restoration only needs to run when the stored token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSelectedOpportunity((current) => {
        if (!current) return current;
        return opportunityData.find((item) => item.id === current.id) || null;
      });
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
      setMySignups([]);
      setOrgEvents([]);
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
    setSelectedOpportunity(null);
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
    setOpportunityForm((currentForm) => {
      const nextForm = { ...currentForm, [name]: value };

      if (name === "address" || name === "location") {
        nextForm.latitude = "";
        nextForm.longitude = "";
      }

      return nextForm;
    });
  }

  function startEditingOpportunity(event) {
    setEditingOpportunityId(event.id);
    setOpportunityForm({
      title: event.title,
      category: event.category || "",
      location: event.location,
      address: event.address || "",
      latitude: String(event.latitude ?? ""),
      longitude: String(event.longitude ?? ""),
      date: event.date,
      time: event.time,
      description: event.description,
      requirements: (event.requirements || []).join(", "),
      skills: (event.skills || []).join(", "),
      spotsTotal: String(event.spotsTotal)
    });
    setMessage(`Editing ${event.title}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditingOpportunity() {
    setEditingOpportunityId(null);
    setOpportunityForm(emptyOpportunityForm);
    setMessage("Edit cancelled.");
  }

  async function locateOpportunityAddress() {
    const addressQuery = [opportunityForm.address, opportunityForm.location].filter(Boolean).join(", ");

    if (!opportunityForm.address.trim() || !opportunityForm.location.trim()) {
      throw new Error("Enter both the street address and city/state before locating the event.");
    }

    setLocatingAddress(true);
    try {
      const geocoded = await request("/api/geocode", {
        method: "POST",
        body: JSON.stringify({ address: addressQuery })
      });

      setOpportunityForm((currentForm) => ({
        ...currentForm,
        latitude: String(geocoded.latitude),
        longitude: String(geocoded.longitude)
      }));
      setMessage(`Mapped address using ${geocoded.provider}.`);
      return geocoded;
    } finally {
      setLocatingAddress(false);
    }
  }

  async function handleLocateAddress() {
    setMessage("");
    try {
      await locateOpportunityAddress();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleSaveOpportunity(event) {
    event.preventDefault();
    setMessage("");

    const isEditing = Boolean(editingOpportunityId);
    const path = isEditing ? `/api/opportunities/${editingOpportunityId}` : "/api/opportunities";

    try {
      let latitude = Number(opportunityForm.latitude);
      let longitude = Number(opportunityForm.longitude);
      const hasCoordinates = opportunityForm.latitude !== ""
        && opportunityForm.longitude !== ""
        && Number.isFinite(latitude)
        && Number.isFinite(longitude)
        && latitude >= -90
        && latitude <= 90
        && longitude >= -180
        && longitude <= 180;

      if (!hasCoordinates) {
        const geocoded = await locateOpportunityAddress();
        latitude = geocoded.latitude;
        longitude = geocoded.longitude;
      }

      const opportunity = await request(path, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          ...opportunityForm,
          latitude,
          longitude,
          spotsTotal: Number(opportunityForm.spotsTotal)
        })
      });

      setOpportunityForm(emptyOpportunityForm);
      setEditingOpportunityId(null);
      setMessage(isEditing ? `Updated opportunity: ${opportunity.title}.` : `Created opportunity: ${opportunity.title}.`);
      await Promise.all([loadRoleData("org"), loadPublicData()]);
      setPage("org");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDeleteOpportunity(opportunity) {
    const confirmed = window.confirm(`Remove "${opportunity.title}"? This also removes its signup records.`);
    if (!confirmed) return;

    try {
      const data = await request(`/api/opportunities/${opportunity.id}`, { method: "DELETE" });
      if (editingOpportunityId === opportunity.id) {
        setEditingOpportunityId(null);
        setOpportunityForm(emptyOpportunityForm);
      }
      setMessage(data.message);
      await Promise.all([loadRoleData("org"), loadPublicData()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleUpdateSignupStatus(signupId, status) {
    try {
      const updatedSignup = await request(`/api/org/signups/${signupId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setMessage(`${updatedSignup.volunteerName}'s status is now ${updatedSignup.status}.`);
      await loadRoleData("org");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setSearchTerm("");
    setFilters(emptyFilters);
  }

  async function openDetails(opportunity) {
    try {
      const opportunityId = Number(opportunity?.opportunityId || opportunity?.id || opportunity?.mapId);
      const hasCompleteDetails = opportunity?.title && Array.isArray(opportunity?.requirements);
      const details = hasCompleteDetails
        ? opportunity
        : await request(`/api/opportunities/${opportunityId}`);

      setSelectedOpportunity(details);
      setPage("details");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
            <button className={page === "volunteer" ? "nav-link active" : "nav-link"} type="button" onClick={() => setPage("volunteer")}>My Dashboard</button>
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
            filters={filters}
            updateFilter={updateFilter}
            filterOptions={filterOptions}
            clearFilters={clearFilters}
            handleSignup={handleSignup}
            openDetails={openDetails}
            goToAuth={goToAuth}
            setPage={setPage}
          />
        )}

        {page === "details" && selectedOpportunity && (
          <OpportunityDetails
            opportunity={selectedOpportunity}
            user={user}
            isVolunteer={isVolunteer}
            isOrg={isOrg}
            signedUp={signedOpportunityIds.has(selectedOpportunity.id)}
            handleSignup={handleSignup}
            goToAuth={goToAuth}
            setPage={setPage}
          />
        )}

        {page === "volunteer" && (
          <VolunteerDashboard
            user={user}
            mySignups={mySignups}
            setPage={setPage}
            goToAuth={goToAuth}
            openDetails={openDetails}
          />
        )}

        {page === "org" && (
          <OrgDashboard
            user={user}
            orgEvents={orgEvents}
            opportunityForm={opportunityForm}
            editingOpportunityId={editingOpportunityId}
            updateOpportunityForm={updateOpportunityForm}
            handleSaveOpportunity={handleSaveOpportunity}
            handleLocateAddress={handleLocateAddress}
            locatingAddress={locatingAddress}
            startEditingOpportunity={startEditingOpportunity}
            cancelEditingOpportunity={cancelEditingOpportunity}
            handleDeleteOpportunity={handleDeleteOpportunity}
            handleUpdateSignupStatus={handleUpdateSignupStatus}
            openDetails={openDetails}
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
  filters,
  updateFilter,
  filterOptions,
  clearFilters,
  handleSignup,
  openDetails,
  goToAuth,
  setPage
}) {
  const confirmedSignups = mySignups.filter((signup) => signup.status === "confirmed");

  return (
    <>
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Code Milestone 3</p>
          <h1>Find local volunteer work that actually matches people.</h1>
          <p className="hero-copy">
            Browse detailed opportunities, filter the board, track volunteer history, and manage organization events from one role-based application.
          </p>
          <div className="hero-actions">
            {!user && <button className="button primary" type="button" onClick={() => goToAuth("register")}>Create Account</button>}
            {isVolunteer && <button className="button primary" type="button" onClick={() => setPage("volunteer")}>View My Dashboard</button>}
            {isOrg && <button className="button primary" type="button" onClick={() => setPage("org")}>Manage Org Events</button>}
            <a className="button secondary" href="#opportunity-board">Browse Board</a>
          </div>
        </div>

        <aside className="demo-card">
          <h2>Demo Status</h2>
          <p><strong>Milestone:</strong> {health?.milestone || "checking..."}</p>
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
            <button className="text-button" type="button" onClick={() => setPage("volunteer")}>Open dashboard and history</button>
          </div>

          {confirmedSignups.length === 0 ? (
            <div className="empty-state">You have no current signups. Pick an opportunity below to get started.</div>
          ) : (
            <div className="horizontal-row">
              {confirmedSignups.map((signup) => (
                <article className="mini-card" key={signup.id}>
                  <strong>{signup.opportunityTitle}</strong>
                  <span>{signup.organization}</span>
                  <span>{signup.date} · {signup.time}</span>
                  <StatusBadge status={signup.status} />
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
        </div>

        <div className="filter-panel">
          <label>
            Search
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, skill, organization..."
            />
          </label>
          <label>
            Category
            <select name="category" value={filters.category} onChange={updateFilter}>
              <option value="">All categories</option>
              {filterOptions.categories.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            Location
            <select name="location" value={filters.location} onChange={updateFilter}>
              <option value="">All locations</option>
              {filterOptions.locations.map((location) => <option value={location} key={location}>{location}</option>)}
            </select>
          </label>
          <label>
            Availability
            <select name="availability" value={filters.availability} onChange={updateFilter}>
              <option value="">Any availability</option>
              <option value="open">Open spots</option>
              <option value="full">Full events</option>
            </select>
          </label>
          <button className="button secondary filter-clear" type="button" onClick={clearFilters}>Clear Filters</button>
        </div>

        {!user && (
          <div className="guest-banner">
            You are browsing as a guest. You can view full opportunity details, but you need a volunteer account to sign up.
          </div>
        )}

        {isOrg && (
          <div className="guest-banner org">
            You are signed in as an organization. You can manage events from the org dashboard, but only volunteers can sign up.
          </div>
        )}

        {!loading && opportunities.length > 0 && (
          <EventMap
            events={opportunities}
            title="Map of Matching Opportunities"
            subtitle="The map updates with the filters above. Select a marker to view event details or sign up."
            user={user}
            signedOpportunityIds={signedOpportunityIds}
            onOpenDetails={openDetails}
            onSignup={handleSignup}
            onRequireLogin={() => goToAuth("login")}
            showSignupAction
          />
        )}

        {loading ? (
          <p>Loading opportunities...</p>
        ) : opportunities.length === 0 ? (
          <div className="empty-state">
            No opportunities matched the selected filters. <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
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
                openDetails={openDetails}
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

function OpportunityCard({ opportunity, user, isVolunteer, isOrg, signedUp, handleSignup, openDetails, goToAuth }) {
  const isFull = Number(opportunity.spotsOpen) <= 0;

  return (
    <article className="opportunity-card">
      <div className="card-topline">
        <span>{opportunity.organization}</span>
        <span>{opportunity.spotsOpen} / {opportunity.spotsTotal} spots</span>
      </div>
      <span className="category-badge">{opportunity.category}</span>
      <h3>{opportunity.title}</h3>
      <p className="description">{opportunity.description}</p>

      <div className="info-grid">
        <p><strong>Date:</strong> {opportunity.date}</p>
        <p><strong>Time:</strong> {opportunity.time}</p>
        <p><strong>Area:</strong> {opportunity.location}</p>
        <p className="full-width-info"><strong>Address:</strong> {opportunity.address}</p>
      </div>

      <div className="chip-row">
        {(opportunity.skills || []).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
      </div>

      <div className="card-actions card-actions-bottom">
        <button className="button secondary" type="button" onClick={() => openDetails(opportunity)}>View Details</button>
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

function OpportunityDetails({ opportunity, user, isVolunteer, isOrg, signedUp, handleSignup, goToAuth, setPage }) {
  const isFull = Number(opportunity.spotsOpen) <= 0;

  return (
    <section className="detail-page">
      <button className="text-button back-button" type="button" onClick={() => setPage("main")}>← Back to Opportunity Board</button>
      <article className="detail-card">
        <div className="detail-main">
          <p className="eyebrow">Opportunity Details</p>
          <span className="category-badge">{opportunity.category}</span>
          <h1>{opportunity.title}</h1>
          <p className="detail-organization">Posted by {opportunity.organization}</p>
          <p className="detail-description">{opportunity.description}</p>

          <h2>Requirements</h2>
          <ul className="detail-list">
            {(opportunity.requirements || []).map((requirement) => <li key={requirement}>{requirement}</li>)}
          </ul>

          <h2>Helpful Skills</h2>
          <div className="chip-row">
            {(opportunity.skills || []).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
          </div>
        </div>

        <aside className="detail-sidebar">
          <h2>Event Information</h2>
          <p><strong>Date:</strong> {opportunity.date}</p>
          <p><strong>Time:</strong> {opportunity.time}</p>
          <p><strong>Area:</strong> {opportunity.location}</p>
          <p><strong>Address:</strong> {opportunity.address}</p>
          <p><strong>Open spots:</strong> {opportunity.spotsOpen} of {opportunity.spotsTotal}</p>

          {!user && <button className="button primary full" type="button" onClick={() => goToAuth("login")}>Log in to Sign Up</button>}
          {isVolunteer && (
            <button className="button primary full" type="button" disabled={signedUp || isFull} onClick={() => handleSignup(opportunity.id)}>
              {signedUp ? "Already Signed Up" : isFull ? "Opportunity Full" : "Sign Up"}
            </button>
          )}
          {isOrg && <button className="button disabled full" type="button" disabled>Volunteer Accounts Only</button>}
        </aside>
      </article>

      <EventMap
        events={[opportunity]}
        title="Event Location"
        subtitle={opportunity.address}
        user={user}
        signedOpportunityIds={signedUp ? new Set([opportunity.id]) : new Set()}
        onSignup={handleSignup}
        onRequireLogin={() => goToAuth("login")}
        showSignupAction
        compact
      />
    </section>
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
          Volunteer accounts can sign up and track participation history. Organization accounts can create, edit, remove, and manage opportunities.
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
              <input name="name" value={authForm.name} onChange={updateAuthForm} placeholder="Joshua Schmidt" required />
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
                <input name="organizationName" value={authForm.organizationName} onChange={updateAuthForm} placeholder="Community Food Center" required />
              </label>
            )}
          </>
        )}

        <label>
          Email
          <input name="email" type="email" value={authForm.email} onChange={updateAuthForm} placeholder="name@example.com" required />
        </label>

        <label>
          Password
          <input name="password" type="password" value={authForm.password} onChange={updateAuthForm} placeholder="Password1!" required />
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

function VolunteerDashboard({ user, mySignups, setPage, goToAuth, openDetails }) {
  if (!user) {
    return <LockedPage title="Volunteer Dashboard" message="Log in as a volunteer to view your signed-up opportunities." goToAuth={goToAuth} />;
  }

  if (user.role !== "volunteer") {
    return <LockedPage title="Volunteer Dashboard" message="This page is only for volunteer accounts." goToAuth={goToAuth} hideButton />;
  }

  const currentSignups = mySignups.filter((signup) => signup.status === "confirmed");
  const history = mySignups.filter((signup) => signup.status !== "confirmed");

  return (
    <section className="dashboard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Volunteer Dashboard</p>
          <h1>{user.name}'s Volunteer Activity</h1>
          <p className="muted">Current commitments and participation history are separated below.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => setPage("main")}>Find More Events</button>
      </div>

      <EventMap
        events={mySignups}
        title="My Volunteer Event Locations"
        subtitle="Every confirmed or completed event on your dashboard appears here."
        user={user}
        onOpenDetails={openDetails}
      />

      <DashboardSignupSection
        title="Upcoming Signups"
        emptyMessage="No current signups. Return to the opportunity board to find one."
        signups={currentSignups}
      />

      <DashboardSignupSection
        title="Volunteer History"
        emptyMessage="No completed participation has been recorded yet. Organization admins can update attendance after an event."
        signups={history}
      />
    </section>
  );
}

function DashboardSignupSection({ title, emptyMessage, signups }) {
  return (
    <section className="dashboard-section">
      <h2>{title}</h2>
      {signups.length === 0 ? (
        <div className="empty-state large">{emptyMessage}</div>
      ) : (
        <div className="vertical-list">
          {signups.map((signup) => (
            <article className="wide-card" key={signup.id}>
              <div>
                <StatusBadge status={signup.status} />
                <h2>{signup.opportunityTitle}</h2>
                <p>{signup.description}</p>
                <span className="category-badge">{signup.category}</span>
              </div>
              <div className="side-details">
                <p><strong>Organization:</strong> {signup.organization}</p>
                <p><strong>Date:</strong> {signup.date}</p>
                <p><strong>Time:</strong> {signup.time}</p>
                <p><strong>Area:</strong> {signup.location}</p>
                <p><strong>Address:</strong> {signup.address}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OrgDashboard({
  user,
  orgEvents,
  opportunityForm,
  editingOpportunityId,
  updateOpportunityForm,
  handleSaveOpportunity,
  handleLocateAddress,
  locatingAddress,
  startEditingOpportunity,
  cancelEditingOpportunity,
  handleDeleteOpportunity,
  handleUpdateSignupStatus,
  openDetails,
  goToAuth
}) {
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
          <p className="eyebrow">Organization Dashboard</p>
          <h1>{user.organizationName}</h1>
          <p className="muted">Create, edit, remove, and manage volunteer participation for your events.</p>
        </div>
      </div>

      <EventMap
        events={orgEvents}
        title="My Organization's Event Locations"
        subtitle="All events posted by this organization are shown together. Select a marker to open the event."
        user={user}
        onOpenDetails={openDetails}
      />

      <div className="org-layout">
        <form className="create-card" onSubmit={handleSaveOpportunity}>
          <div className="form-title-row">
            <h2>{editingOpportunityId ? "Edit Opportunity" : "Create Opportunity"}</h2>
            {editingOpportunityId && <button className="text-button" type="button" onClick={cancelEditingOpportunity}>Cancel</button>}
          </div>
          <label>
            Title
            <input name="title" value={opportunityForm.title} onChange={updateOpportunityForm} placeholder="Opportunity title" required />
          </label>
          <label>
            Category
            <input name="category" value={opportunityForm.category} onChange={updateOpportunityForm} placeholder="Food Support, Environment, Technology..." required />
          </label>
          <label>
            City / State
            <input name="location" value={opportunityForm.location} onChange={updateOpportunityForm} placeholder="Omaha, NE" required />
          </label>
          <label>
            Street Address
            <input name="address" value={opportunityForm.address} onChange={updateOpportunityForm} placeholder="10525 J Street, Omaha, NE 68127" required />
          </label>
          <div className="address-tools">
            <button className="button secondary" type="button" onClick={handleLocateAddress} disabled={locatingAddress}>
              {locatingAddress ? "Finding Address..." : "Find Address on Map"}
            </button>
            {opportunityForm.latitude && opportunityForm.longitude && (
              <span className="coordinate-confirmation">Mapped: {Number(opportunityForm.latitude).toFixed(5)}, {Number(opportunityForm.longitude).toFixed(5)}</span>
            )}
          </div>
          <details className="advanced-location">
            <summary>Advanced: enter map coordinates manually</summary>
            <div className="form-row">
              <label>
                Latitude
                <input name="latitude" type="number" step="any" min="-90" max="90" value={opportunityForm.latitude} onChange={updateOpportunityForm} placeholder="41.2565" />
              </label>
              <label>
                Longitude
                <input name="longitude" type="number" step="any" min="-180" max="180" value={opportunityForm.longitude} onChange={updateOpportunityForm} placeholder="-95.9345" />
              </label>
            </div>
          </details>
          <div className="form-row">
            <label>
              Date
              <input name="date" value={opportunityForm.date} onChange={updateOpportunityForm} placeholder="July 30, 2026" required />
            </label>
            <label>
              Time
              <input name="time" value={opportunityForm.time} onChange={updateOpportunityForm} placeholder="10:00 AM - 1:00 PM" />
            </label>
          </div>
          <label>
            Description
            <textarea name="description" value={opportunityForm.description} onChange={updateOpportunityForm} placeholder="Short description" required />
          </label>
          <label>
            Requirements
            <input name="requirements" value={opportunityForm.requirements} onChange={updateOpportunityForm} placeholder="Requirements, comma-separated" />
          </label>
          <label>
            Skills
            <input name="skills" value={opportunityForm.skills} onChange={updateOpportunityForm} placeholder="Skills, comma-separated" />
          </label>
          <label>
            Volunteer Capacity
            <input name="spotsTotal" type="number" min="1" value={opportunityForm.spotsTotal} onChange={updateOpportunityForm} required />
          </label>
          <button className="button primary full" type="submit" disabled={locatingAddress}>
            {locatingAddress ? "Mapping Address..." : editingOpportunityId ? "Save Changes" : "Post Opportunity"}
          </button>
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
                  <span className="category-badge">{event.category}</span>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <p><strong>Area:</strong> {event.location}</p>
                  <p><strong>Address:</strong> {event.address}</p>
                  <p><strong>Capacity:</strong> {event.signupsCount} / {event.spotsTotal}</p>

                  <div className="management-actions">
                    <button className="button secondary" type="button" onClick={() => openDetails(event)}>View</button>
                    <button className="button secondary" type="button" onClick={() => startEditingOpportunity(event)}>Edit</button>
                    <button className="button danger" type="button" onClick={() => handleDeleteOpportunity(event)}>Remove</button>
                  </div>

                  <div className="volunteer-list">
                    <strong>Signed-up volunteers</strong>
                    {event.signups.length === 0 ? (
                      <span className="muted-small">No volunteers yet.</span>
                    ) : (
                      event.signups.map((signup) => (
                        <div className="volunteer-row" key={signup.id}>
                          <div>
                            <strong>{signup.volunteerName}</strong>
                            <span>{signup.volunteerEmail}</span>
                          </div>
                          <label className="status-control">
                            Participation
                            <select value={signup.status} onChange={(changeEvent) => handleUpdateSignupStatus(signup.id, changeEvent.target.value)}>
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="no-show">No-show</option>
                            </select>
                          </label>
                        </div>
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

function StatusBadge({ status }) {
  return <span className={`status-dot status-${status}`}>{status}</span>;
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
