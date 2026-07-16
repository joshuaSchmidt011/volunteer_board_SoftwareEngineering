import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
let googleMapsPromise = null;
const EMPTY_SIGNED_OPPORTUNITY_IDS = new Set();

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__volunteerMatchBoardGoogleMapsReady";
    const timeoutId = window.setTimeout(() => reject(new Error("Google Maps took too long to load.")), 12000);

    window[callbackName] = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=marker&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function normalizeMapEvent(event) {
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);

  return {
    ...event,
    mapId: Number(event.opportunityId || event.id),
    mapTitle: event.title || event.opportunityTitle || "Volunteer Opportunity",
    mapOrganization: event.organization || "Community Organization",
    mapAddress: event.address || event.location || "Address unavailable",
    mapLocation: event.location || "",
    mapLatitude: latitude,
    mapLongitude: longitude,
    mapSpotsOpen: Number(event.spotsOpen),
    mapSpotsTotal: Number(event.spotsTotal)
  };
}

function hasValidCoordinates(event) {
  return Number.isFinite(event.mapLatitude)
    && Number.isFinite(event.mapLongitude)
    && event.mapLatitude >= -90
    && event.mapLatitude <= 90
    && event.mapLongitude >= -180
    && event.mapLongitude <= 180;
}

function appendTextLine(container, label, value) {
  if (!value) return;
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(String(value)));
  container.appendChild(line);
}

function createActionButton(label, className, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-popup-button ${className}`;
  button.textContent = label;
  button.disabled = disabled;
  if (!disabled && onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createPopupContent(event, options) {
  const {
    user,
    signedOpportunityIds,
    onOpenDetails,
    onSignup,
    onRequireLogin,
    showSignupAction
  } = options;

  const wrapper = document.createElement("div");
  wrapper.className = "map-popup";

  const title = document.createElement("h3");
  title.textContent = event.mapTitle;
  wrapper.appendChild(title);

  const organization = document.createElement("p");
  organization.className = "map-popup-organization";
  organization.textContent = event.mapOrganization;
  wrapper.appendChild(organization);

  appendTextLine(wrapper, "Date", event.date);
  appendTextLine(wrapper, "Time", event.time);
  appendTextLine(wrapper, "Address", event.mapAddress);

  if (Number.isFinite(event.mapSpotsOpen) && Number.isFinite(event.mapSpotsTotal)) {
    appendTextLine(wrapper, "Open spots", `${event.mapSpotsOpen} of ${event.mapSpotsTotal}`);
  }

  const actionRow = document.createElement("div");
  actionRow.className = "map-popup-actions";

  if (onOpenDetails) {
    actionRow.appendChild(createActionButton("View Event", "secondary", () => onOpenDetails(event)));
  }

  if (showSignupAction) {
    const signedUp = signedOpportunityIds.has(event.mapId);
    const isFull = Number.isFinite(event.mapSpotsOpen) && event.mapSpotsOpen <= 0;

    if (!user) {
      actionRow.appendChild(createActionButton("Log in to Sign Up", "primary", onRequireLogin));
    } else if (user.role === "volunteer") {
      actionRow.appendChild(createActionButton(
        signedUp ? "Already Signed Up" : isFull ? "Full" : "Sign Up",
        "primary",
        () => onSignup?.(event.mapId),
        signedUp || isFull
      ));
    }
  }

  if (actionRow.childElementCount > 0) {
    wrapper.appendChild(actionRow);
  }

  return wrapper;
}

function buildLeafletMap(container, events, options) {
  const map = L.map(container, {
    scrollWheelZoom: false,
    zoomControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const bounds = L.latLngBounds([]);

  events.forEach((event, index) => {
    const position = [event.mapLatitude, event.mapLongitude];
    bounds.extend(position);

    const marker = L.marker(position, {
      title: event.mapTitle,
      icon: L.divIcon({
        className: "event-map-marker-shell",
        html: `<div class="event-map-marker"><span>${index + 1}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
        popupAnchor: [0, -38]
      })
    }).addTo(map);

    marker.bindPopup(createPopupContent(event, options), {
      maxWidth: 330,
      minWidth: 245
    });
  });

  if (events.length === 1) {
    map.setView([events[0].mapLatitude, events[0].mapLongitude], 14);
  } else {
    map.fitBounds(bounds.pad(0.18), { maxZoom: 14 });
  }

  window.setTimeout(() => map.invalidateSize(), 0);
  return () => map.remove();
}

async function buildGoogleMap(container, events, options) {
  await loadGoogleMaps(GOOGLE_MAPS_API_KEY);
  const { Map, InfoWindow, LatLngBounds } = await window.google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");

  const map = new Map(container, {
    center: { lat: events[0].mapLatitude, lng: events[0].mapLongitude },
    zoom: 11,
    mapId: "DEMO_MAP_ID",
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true
  });

  const infoWindow = new InfoWindow();
  const bounds = new LatLngBounds();
  const markers = [];

  events.forEach((event) => {
    const position = { lat: event.mapLatitude, lng: event.mapLongitude };
    bounds.extend(position);

    const marker = new AdvancedMarkerElement({
      map,
      position,
      title: `${event.mapTitle} — ${event.mapOrganization}`,
      gmpClickable: true
    });

    marker.addListener("click", () => {
      infoWindow.setContent(createPopupContent(event, options));
      infoWindow.open({ map, anchor: marker });
    });

    markers.push(marker);
  });

  if (events.length === 1) {
    map.setCenter({ lat: events[0].mapLatitude, lng: events[0].mapLongitude });
    map.setZoom(14);
  } else {
    map.fitBounds(bounds, 54);
  }

  return () => {
    infoWindow.close();
    markers.forEach((marker) => {
      marker.map = null;
    });
  };
}

function EventMap({
  events,
  title,
  subtitle,
  user = null,
  signedOpportunityIds = EMPTY_SIGNED_OPPORTUNITY_IDS,
  onOpenDetails,
  onSignup,
  onRequireLogin,
  showSignupAction = false,
  compact = false
}) {
  const containerRef = useRef(null);
  const [provider, setProvider] = useState(GOOGLE_MAPS_API_KEY ? "Google Maps" : "OpenStreetMap fallback");
  const [mapError, setMapError] = useState("");

  const mappableEvents = useMemo(() => {
    return (events || []).map(normalizeMapEvent).filter(hasValidCoordinates);
  }, [events]);

  useEffect(() => {
    const mapContainer = containerRef.current;

    if (!mapContainer || mappableEvents.length === 0) {
      return undefined;
    }

    let cleanup = () => {};
    let cancelled = false;

    const options = {
      user,
      signedOpportunityIds,
      onOpenDetails,
      onSignup,
      onRequireLogin,
      showSignupAction
    };

    async function initializeMap() {
      setMapError("");

      if (GOOGLE_MAPS_API_KEY) {
        try {
          const googleCleanup = await buildGoogleMap(mapContainer, mappableEvents, options);
          if (cancelled) {
            googleCleanup();
            return;
          }
          cleanup = googleCleanup;
          setProvider("Google Maps");
          return;
        } catch (error) {
          console.warn("Google Maps failed; using OpenStreetMap fallback.", error);
          setMapError("Google Maps could not load, so the built-in map fallback is being used.");
        }
      }

      if (!cancelled) {
        cleanup = buildLeafletMap(mapContainer, mappableEvents, options);
        setProvider("OpenStreetMap fallback");
      }
    }

    initializeMap();

    return () => {
      cancelled = true;
      cleanup();
      mapContainer.replaceChildren();
      mapContainer.removeAttribute("class");
      mapContainer.className = compact ? "event-map-canvas compact" : "event-map-canvas";
    };
  }, [compact, mappableEvents, onOpenDetails, onRequireLogin, onSignup, showSignupAction, signedOpportunityIds, user]);

  return (
    <section className={compact ? "event-map-card compact" : "event-map-card"}>
      <div className="event-map-heading">
        <div>
          <p className="eyebrow">Interactive Event Map</p>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <span className="map-provider-badge">{provider}</span>
      </div>

      {mapError && <p className="map-fallback-note">{mapError}</p>}

      {mappableEvents.length === 0 ? (
        <div className="empty-state large">No mapped event addresses are available for this view.</div>
      ) : (
        <div ref={containerRef} className={compact ? "event-map-canvas compact" : "event-map-canvas"} aria-label={title} />
      )}
    </section>
  );
}

export default EventMap;
