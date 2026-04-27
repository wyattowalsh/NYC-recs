(() => {
  "use strict";

  const AREA_ORDER = [
    "Queens",
    "Central Manhattan",
    "Downtown Manhattan",
    "Brooklyn",
    "Uptown",
    "Waterfront / islands"
  ];

  const TYPE_ORDER = ["food", "drinks", "music", "activity", "outdoors"];

  const TYPE_META = {
    food: { label: "Food", short: "F" },
    drinks: { label: "Drinks", short: "D" },
    music: { label: "Music", short: "M" },
    activity: { label: "Activity", short: "A" },
    outdoors: { label: "Outside", short: "O" }
  };

  const TRAITS = [
    { id: "hiddenish", label: "Hidden-ish" },
    { id: "lowkey", label: "Low-key" },
    { id: "group", label: "Group" },
    { id: "views", label: "Views" },
    { id: "calendar", label: "Calendar" },
    { id: "rainy", label: "Rain-safe" },
    { id: "polished", label: "Polished" }
  ];

  const MOBILE_QUERY = "(max-width: 760px)";
  const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const DEFAULT_CENTER = [40.735, -73.972];

  const state = {
    areas: new Set(),
    types: new Set(),
    traits: new Set(),
    query: "",
    focusedId: null,
    distances: new Map(),
    fitTimer: 0,
    restoringUrl: false,
    booted: false
  };

  let recs = [];
  let recById = new Map();
  let map = null;
  let markerLayer = null;
  const markerObjects = new Map();
  const els = {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  async function boot() {
    cacheElements();

    try {
      recs = prepareRecs(await loadRecs());
      recById = new Map(recs.map((rec) => [rec.id, rec]));

      renderFilterChips();
      restoreStateFromUrl();

      try {
        await waitForLeaflet();
        initMap();
      } catch (mapError) {
        console.warn(mapError);
        showMapFallback("Map unavailable. Use the Maps links on each card.");
      }

      attachEvents();
      state.booted = true;
      render({ updateUrl: false });

      if (state.focusedId && recById.has(state.focusedId)) {
        defer(() => focusRec(state.focusedId, { scrollCard: false, scrollMap: false, updateUrl: false }), 220);
      } else {
        defer(() => { hardInvalidateMap(); fitVisiblePins({ animate: false }); }, 120);
      }

      defer(() => {
        hardInvalidateMap();
        state.focusedId ? focusSelected({ animate: false }) : fitVisiblePins({ animate: false });
      }, 650);
    } catch (error) {
      showFatalError(error);
    }
  }

  function waitForLeaflet(timeoutMs = 7000) {
    if (window.L) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const started = Date.now();
      const timer = window.setInterval(() => {
        if (window.L) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          reject(new Error("Leaflet failed to load."));
        }
      }, 50);
    });
  }

  async function loadRecs() {
    if (Array.isArray(window.__RECS__)) return window.__RECS__;

    const response = await fetch("./data/recs.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load rec data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Rec data is empty or malformed.");
    }
    return data;
  }

  function prepareRecs(rawRecs) {
    const seen = new Set();

    return rawRecs.map((rec) => {
      if (!rec.id || seen.has(rec.id)) {
        throw new Error(`Duplicate or missing rec id: ${rec.id || "<missing>"}`);
      }
      seen.add(rec.id);

      const normalized = {
        ...rec,
        lat: Number(rec.lat),
        lon: Number(rec.lon),
        tags: Array.isArray(rec.tags) ? rec.tags : [],
        siteLinks: Array.isArray(rec.siteLinks) ? rec.siteLinks : []
      };

      if (!Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lon)) {
        throw new Error(`Bad coordinates for ${normalized.name || normalized.id}`);
      }

      normalized.searchText = norm([
        normalized.name,
        normalized.area,
        normalized.where,
        normalized.vibe,
        normalized.type,
        normalized.typeLabel,
        normalized.blurb,
        normalized.fit,
        ...normalized.tags
      ].join(" "));

      return normalized;
    });
  }

  function cacheElements() {
    Object.assign(els, {
      sections: byId("sections"),
      empty: byId("emptyState"),
      visibleCount: byId("visibleCount"),
      search: byId("searchInput"),
      mapPanel: byId("mapPanel"),
      mapEl: byId("map"),
      focusDock: byId("focusDock"),
      focusName: byId("focusName"),
      focusMeta: byId("focusMeta"),
      focusActions: byId("focusActions"),
      toast: byId("toast"),
      areaFilters: byId("areaFilters"),
      typeFilters: byId("typeFilters"),
      traitFilters: byId("traitFilters"),
      shareView: byId("shareView")
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function showFatalError(error) {
    console.error(error);
    if (els.sections) els.sections.innerHTML = "";
    if (els.empty) {
      els.empty.textContent = "Couldn’t load the recs. Refresh and try again.";
      els.empty.style.display = "block";
    }
  }

  function showMapFallback(message) {
    if (!els.mapEl) return;
    els.mapEl.innerHTML = `<div class="map-fallback">${escapeHtml(message)}</div>`;
  }

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function defer(fn, ms = 0) {
    return window.setTimeout(fn, ms);
  }

  function isMobile() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia(REDUCE_MOTION_QUERY).matches;
  }

  function labelForType(type) {
    return TYPE_META[type]?.label || type;
  }

  function shortForType(type) {
    return TYPE_META[type]?.short || String(type || "?").slice(0, 1).toUpperCase();
  }

  function areaLabel(area) {
    return String(area)
      .replace("Central Manhattan", "Central")
      .replace("Downtown Manhattan", "Downtown")
      .replace("Waterfront / islands", "Waterfront");
  }

  function tagSet(rec) {
    return new Set((rec.tags || []).map(norm));
  }

  function traitMatches(trait, rec) {
    const tags = tagSet(rec);
    const hay = rec.searchText;

    switch (trait) {
      case "hiddenish":
        return tags.has("hidden-ish") || tags.has("hidden") || tags.has("low-key") || tags.has("quirky") || hay.includes("speakeasy");
      case "lowkey":
        return tags.has("low-key") || tags.has("easy") || tags.has("local") || tags.has("casual") || tags.has("cafe");
      case "group":
        return tags.has("group") || tags.has("group-friendly") || hay.includes("group");
      case "views":
        return tags.has("views") || tags.has("rooftop") || tags.has("outside") || rec.type === "outdoors";
      case "calendar":
        return tags.has("calendar") || tags.has("concert") || tags.has("dancing") || rec.type === "music";
      case "rainy":
        return tags.has("rainy") || tags.has("indoors") || tags.has("books") || tags.has("museum") || tags.has("activity") || rec.type === "activity";
      case "polished":
        return tags.has("polished") || tags.has("date-y") || tags.has("wine") || tags.has("intimate") || hay.includes("speakeasy") || hay.includes("cocktail");
      default:
        return true;
    }
  }

  function recMatches(rec) {
    if (state.query && !rec.searchText.includes(state.query)) return false;
    if (state.areas.size && !state.areas.has(rec.area)) return false;
    if (state.types.size && !state.types.has(rec.type)) return false;

    if (state.traits.size) {
      for (const trait of state.traits) {
        if (traitMatches(trait, rec)) return true;
      }
      return false;
    }

    return true;
  }

  function visibleRecs() {
    return recs.filter(recMatches);
  }

  function baseCount(predicate) {
    return recs.filter(predicate).length;
  }

  function makeChip(group, value, label, count, withDot = false) {
    const dot = withDot ? '<span class="dot" aria-hidden="true"></span>' : "";
    return `
      <button class="chip" type="button" data-group="${escapeHtml(group)}" data-value="${escapeHtml(value)}" aria-pressed="false">
        ${dot}<span>${escapeHtml(label)}</span><span class="count">${count}</span>
      </button>`;
  }

  function renderFilterChips() {
    els.areaFilters.innerHTML = AREA_ORDER
      .filter((area) => baseCount((rec) => rec.area === area) > 0)
      .map((area) => makeChip("areas", area, areaLabel(area), baseCount((rec) => rec.area === area)))
      .join("");

    els.typeFilters.innerHTML = TYPE_ORDER
      .filter((type) => baseCount((rec) => rec.type === type) > 0)
      .map((type) => makeChip("types", type, labelForType(type), baseCount((rec) => rec.type === type), true))
      .join("");

    els.traitFilters.innerHTML = TRAITS
      .map((trait) => makeChip("traits", trait.id, trait.label, baseCount((rec) => traitMatches(trait.id, rec))))
      .join("");
  }

  function syncChipState() {
    document.querySelectorAll(".chip[data-group]").forEach((chip) => {
      const set = state[chip.dataset.group];
      const active = Boolean(set?.has(chip.dataset.value));
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function restoreStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.restoringUrl = true;

    state.query = norm(params.get("q") || "");
    els.search.value = params.get("q") || "";

    for (const value of splitParam(params.get("area"))) {
      if (AREA_ORDER.includes(value)) state.areas.add(value);
    }

    for (const value of splitParam(params.get("type"))) {
      if (TYPE_ORDER.includes(value)) state.types.add(value);
    }

    const traitIds = new Set(TRAITS.map((trait) => trait.id));
    for (const value of splitParam(params.get("vibe"))) {
      if (traitIds.has(value)) state.traits.add(value);
    }

    const pick = params.get("pick");
    if (pick && recs.some((rec) => rec.id === pick)) state.focusedId = pick;

    state.restoringUrl = false;
  }

  function splitParam(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function updateUrlState() {
    if (!state.booted || state.restoringUrl) return;

    const params = new URLSearchParams();
    if (state.query) params.set("q", els.search.value.trim());
    if (state.areas.size) params.set("area", [...state.areas].join(","));
    if (state.types.size) params.set("type", [...state.types].join(","));
    if (state.traits.size) params.set("vibe", [...state.traits].join(","));
    if (state.focusedId) params.set("pick", state.focusedId);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function currentShareUrl() {
    updateUrlState();
    return window.location.href;
  }

  function siteButtons(rec, className = "link-btn") {
    return (rec.siteLinks || [])
      .map((link) => `<a class="${className}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label || "Site")}</a>`)
      .join("");
  }

  function mapsButton(rec, className = "link-btn") {
    return rec.gmaps
      ? `<a class="${className}" href="${escapeHtml(rec.gmaps)}" target="_blank" rel="noopener noreferrer">Maps</a>`
      : "";
  }

  function distanceLabel(rec) {
    if (!state.distances.has(rec.id)) return "";
    return `${state.distances.get(rec.id).toFixed(1)} mi away`;
  }

  function makeCard(rec) {
    const tags = (rec.tags || [])
      .slice(0, 5)
      .map((tag) => `<span class="tag">${escapeHtml(tag.replaceAll("-", " "))}</span>`)
      .join("");
    const dist = distanceLabel(rec);
    const focused = state.focusedId === rec.id ? " focused" : "";

    return `
      <article class="card${focused}" id="pick-${escapeHtml(rec.id)}" data-id="${escapeHtml(rec.id)}" data-type="${escapeHtml(rec.type)}" tabindex="0">
        <div class="card-top">
          <div class="card-title">
            <h3 class="name">${escapeHtml(rec.name)}</h3>
            <div class="where">${escapeHtml(rec.where)} · ${escapeHtml(rec.vibe)}</div>
          </div>
          <span class="type-pill"><span class="type-letter">${escapeHtml(shortForType(rec.type))}</span>${escapeHtml(labelForType(rec.type))}</span>
        </div>
        <p class="blurb">${escapeHtml(rec.blurb)}</p>
        <div class="fit"><b>Good for</b><span>${escapeHtml(rec.fit)}</span></div>
        <div class="taglist">${tags}</div>
        <div class="distance ${dist ? "visible" : ""}">${escapeHtml(dist)}</div>
        <div class="card-actions">
          <button class="link-btn primary" type="button" data-locate="${escapeHtml(rec.id)}">Map</button>
          ${mapsButton(rec)}
          ${siteButtons(rec)}
          <button class="link-btn" type="button" data-copy="${escapeHtml(rec.id)}">Copy</button>
        </div>
      </article>`;
  }

  function renderSections(currentRecs) {
    els.sections.innerHTML = "";
    els.empty.style.display = currentRecs.length ? "none" : "block";

    const byArea = new Map(AREA_ORDER.map((area) => [area, []]));
    for (const rec of currentRecs) {
      if (!byArea.has(rec.area)) byArea.set(rec.area, []);
      byArea.get(rec.area).push(rec);
    }

    for (const [area, areaRecs] of byArea.entries()) {
      if (!areaRecs.length) continue;

      const section = document.createElement("section");
      section.className = "section";
      section.innerHTML = `
        <div class="section-head">
          <h2>${escapeHtml(area)}</h2>
          <div class="section-count">${areaRecs.length}</div>
        </div>
        <div class="cards">${areaRecs.map(makeCard).join("")}</div>`;
      els.sections.appendChild(section);
    }
  }

  function initMap() {
    map = L.map("map", {
      center: DEFAULT_CENTER,
      zoom: 12,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      tap: true
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    setupMapResizeObserver();

    map.whenReady(() => {
      hardInvalidateMap();
      window.setTimeout(() => {
        state.focusedId ? focusSelected({ animate: false }) : fitVisiblePins({ animate: false });
      }, 120);
    });

    map.on("popupopen", (event) => {
      const popupEl = event.popup.getElement();
      const cardLink = popupEl?.querySelector("[data-popup-card]");
      if (!cardLink) return;

      cardLink.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        focusRec(cardLink.getAttribute("data-popup-card"), {
          scrollCard: true,
          zoomMap: false,
          scrollMap: false
        });
      });
    });
  }

  function setupMapResizeObserver() {
    if (!window.ResizeObserver || !els.mapEl) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((item) => item.target === els.mapEl) || entries[0];
      if (!entry?.contentRect?.width || !entry?.contentRect?.height) return;

      window.clearTimeout(state.fitTimer);
      state.fitTimer = window.setTimeout(() => {
        hardInvalidateMap();
        if (state.focusedId) {
          focusSelected({ animate: false });
        } else {
          fitVisiblePins({ animate: false });
        }
      }, 90);
    });

    observer.observe(els.mapEl);
    if (els.mapPanel) observer.observe(els.mapPanel);
  }

  function markerHtml(rec, selected, dimmed) {
    const classes = ["marker", rec.type];
    if (selected) classes.push("selected");
    if (dimmed) classes.push("dimmed");
    return `<div class="${classes.join(" ")}">${escapeHtml(shortForType(rec.type))}</div>`;
  }

  function makeIcon(rec, selected, dimmed) {
    return L.divIcon({
      className: "",
      html: markerHtml(rec, selected, dimmed),
      iconSize: selected ? [40, 40] : [32, 32],
      iconAnchor: selected ? [20, 38] : [16, 31],
      popupAnchor: [0, selected ? -36 : -29]
    });
  }

  function popupHtml(rec) {
    const primarySite = rec.siteLinks?.[0];
    return `
      <div class="popup">
        <div class="popup-title">${escapeHtml(rec.name)}</div>
        <div class="popup-meta">${escapeHtml(rec.where)} · ${escapeHtml(labelForType(rec.type))}</div>
        <div class="popup-actions">
          ${rec.gmaps ? `<a href="${escapeHtml(rec.gmaps)}" target="_blank" rel="noopener noreferrer">Maps</a>` : ""}
          ${primarySite ? `<a href="${escapeHtml(primarySite.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(primarySite.label || "Site")}</a>` : ""}
          <a href="#pick-${escapeHtml(rec.id)}" data-popup-card="${escapeHtml(rec.id)}">Card</a>
        </div>
      </div>`;
  }

  function renderMarkers(currentRecs) {
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    markerObjects.clear();

    const focusedVisible = state.focusedId && currentRecs.some((rec) => rec.id === state.focusedId);

    for (const rec of currentRecs) {
      const selected = state.focusedId === rec.id;
      const dimmed = Boolean(focusedVisible && !selected);

      const marker = L.marker([rec.lat, rec.lon], {
        icon: makeIcon(rec, selected, dimmed),
        title: rec.name,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : 0
      });

      marker.bindPopup(popupHtml(rec), {
        closeButton: true,
        autoPan: true,
        maxWidth: isMobile() ? 238 : 280,
        className: "rec-popup"
      });

      marker.on("click", () => {
        focusRec(rec.id, {
          scrollCard: true,
          zoomMap: false,
          scrollMap: false
        });
      });

      marker.addTo(markerLayer);
      markerObjects.set(rec.id, marker);
    }

    if (state.focusedId && markerObjects.has(state.focusedId)) {
      defer(() => markerObjects.get(state.focusedId)?.openPopup(), 80);
    }
  }

  function hardInvalidateMap() {
    if (!map) return;
    map.invalidateSize({ pan: false, debounceMoveend: true });
    requestAnimationFrame(() => map?.invalidateSize({ pan: false, debounceMoveend: true }));
    window.setTimeout(() => map?.invalidateSize({ pan: false, debounceMoveend: true }), 80);
    window.setTimeout(() => map?.invalidateSize({ pan: false, debounceMoveend: true }), 220);
  }

  function currentLatLngs() {
    return visibleRecs().map((rec) => [rec.lat, rec.lon]);
  }

  function animateFlag(animate) {
    return animate !== false && !prefersReducedMotion();
  }

  function fitLatLngs(latLngs, { maxZoom = 14, animate = true } = {}) {
    if (!map || !latLngs.length) return;

    hardInvalidateMap();

    if (latLngs.length === 1) {
      const zoom = isMobile() ? Math.min(maxZoom, 16) : Math.min(maxZoom, 15);
      map.flyTo(latLngs[0], zoom, { animate: animateFlag(animate), duration: animateFlag(animate) ? 0.42 : 0 });
      return;
    }

    const bounds = L.latLngBounds(latLngs);
    const padding = isMobile() ? [26, 26] : [42, 42];
    map.fitBounds(bounds.pad(isMobile() ? 0.20 : 0.16), {
      paddingTopLeft: padding,
      paddingBottomRight: padding,
      maxZoom,
      animate: animateFlag(animate)
    });
  }

  function fitVisiblePins(options = {}) {
    fitLatLngs(currentLatLngs(), { maxZoom: 14, ...options });
  }

  function focusSelected(options = {}) {
    const rec = state.focusedId ? recById.get(state.focusedId) : null;
    if (rec) fitLatLngs([[rec.lat, rec.lon]], { maxZoom: 16, ...options });
  }

  function focusRec(id, options = {}) {
    const {
      scrollCard = false,
      zoomMap = true,
      scrollMap = isMobile(),
      updateUrl = true
    } = options;

    const rec = recById.get(id);
    if (!rec) return;

    state.focusedId = id;
    render({ updateUrl });

    defer(() => {
      if (scrollMap && els.mapPanel) {
        els.mapPanel.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      }

      hardInvalidateMap();

      if (zoomMap) {
        fitLatLngs([[rec.lat, rec.lon]], { maxZoom: 16, animate: true });
      }

      if (scrollCard) {
        byId(`pick-${id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      }

      defer(() => markerObjects.get(id)?.openPopup(), zoomMap ? 360 : 80);
    }, 35);
  }

  function renderFocusDock() {
    const rec = state.focusedId ? recById.get(state.focusedId) : null;

    if (!rec) {
      els.focusDock.classList.remove("visible");
      els.focusName.textContent = "";
      els.focusMeta.textContent = "";
      els.focusActions.innerHTML = "";
      return;
    }

    els.focusDock.classList.add("visible");
    els.focusName.textContent = rec.name;
    els.focusMeta.textContent = `${rec.where} · ${labelForType(rec.type)}`;
    els.focusActions.innerHTML = `
      ${mapsButton(rec)}
      ${siteButtons(rec)}
      <button class="link-btn" type="button" data-copy="${escapeHtml(rec.id)}">Copy</button>`;
  }

  function render({ updateUrl = true } = {}) {
    const currentRecs = visibleRecs();

    if (state.focusedId && !currentRecs.some((rec) => rec.id === state.focusedId)) {
      state.focusedId = null;
    }

    els.visibleCount.textContent = String(currentRecs.length);
    syncChipState();
    renderSections(currentRecs);
    renderMarkers(currentRecs);
    renderFocusDock();
    if (isMobile()) defer(() => hardInvalidateMap(), 35);
    if (updateUrl) updateUrlState();
  }

  function scheduleFit(delay = 90) {
    window.clearTimeout(state.fitTimer);
    state.fitTimer = window.setTimeout(() => fitVisiblePins(), delay);
  }

  function clearFilters() {
    state.areas.clear();
    state.types.clear();
    state.traits.clear();
    state.query = "";
    state.focusedId = null;
    els.search.value = "";
    render();
    scheduleFit(70);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(els.toast.hideTimer);
    els.toast.hideTimer = window.setTimeout(() => els.toast.classList.remove("show"), 1400);
  }

  function copyTextForRec(rec) {
    const links = [
      rec.gmaps ? `Maps: ${rec.gmaps}` : "",
      ...(rec.siteLinks || []).map((link) => `${link.label || "Site"}: ${link.url}`)
    ].filter(Boolean).join(" | ");

    return `• ${rec.name} — ${rec.where} — ${rec.vibe}
  ${rec.blurb}${rec.fit ? `\n  Good for: ${rec.fit}` : ""}${links ? `\n  ${links}` : ""}`;
  }

  async function writeClipboard(text, message) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showToast(message);
    } catch {
      showToast("Copy blocked");
    }
  }

  function copyVisible() {
    const currentRecs = visibleRecs();
    writeClipboard(
      `Wyatt’s NYC Recs\n${currentRecs.map(copyTextForRec).join("\n")}`,
      `Copied ${currentRecs.length} shown`
    );
  }

  function copyRec(id) {
    const rec = recById.get(id);
    if (rec) writeClipboard(copyTextForRec(rec), "Copied pick");
  }

  async function shareCurrentView() {
    const url = currentShareUrl();
    const title = "Wyatt’s NYC Recs";
    const text = "NYC food, drinks, music, activities, and low-key picks.";

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    await writeClipboard(url, "Link copied");
  }

  function haversineMiles(aLat, aLon, bLat, bLon) {
    const R = 3958.8;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function showDistances() {
    if (!navigator.geolocation) {
      showToast("Location unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.distances.clear();

        for (const rec of recs) {
          state.distances.set(
            rec.id,
            haversineMiles(position.coords.latitude, position.coords.longitude, rec.lat, rec.lon)
          );
        }

        render();
        showToast("Distances added");
      },
      () => showToast("Location blocked"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function handleFilterClick(target) {
    const chip = target.closest(".chip[data-group]");
    if (!chip) return false;

    const set = state[chip.dataset.group];
    if (!set) return true;

    const value = chip.dataset.value;
    if (set.has(value)) set.delete(value);
    else set.add(value);

    state.focusedId = null;
    render();
    scheduleFit();
    return true;
  }

  function attachEvents() {
    document.querySelector(".filter-grid").addEventListener("click", (event) => {
      handleFilterClick(event.target);
    });

    els.search.addEventListener("input", (event) => {
      state.query = norm(event.target.value.trim());
      state.focusedId = null;
      render();
      scheduleFit(140);
    });

    document.body.addEventListener("click", (event) => {
      const locate = event.target.closest("[data-locate]");
      if (locate) {
        event.preventDefault();
        focusRec(locate.getAttribute("data-locate"), {
          zoomMap: true,
          scrollMap: isMobile(),
          scrollCard: false
        });
        return;
      }

      const copy = event.target.closest("[data-copy]");
      if (copy) {
        event.preventDefault();
        copyRec(copy.getAttribute("data-copy"));
        return;
      }

      const card = event.target.closest(".card[data-id]");
      if (card && !event.target.closest("a, button")) {
        focusRec(card.dataset.id, {
          zoomMap: true,
          scrollMap: isMobile(),
          scrollCard: false
        });
      }
    });

    document.body.addEventListener("keydown", (event) => {
      const card = event.target.closest(".card[data-id]");
      if (!card) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusRec(card.dataset.id, {
          zoomMap: true,
          scrollMap: isMobile(),
          scrollCard: false
        });
      }
    });

    byId("clearFilters").addEventListener("click", clearFilters);
    byId("copyVisible").addEventListener("click", copyVisible);
    byId("shareView").addEventListener("click", shareCurrentView);
    byId("distanceBtn").addEventListener("click", showDistances);
    byId("fitPinsTop").addEventListener("click", () => fitVisiblePins());
    byId("fitPinsMap").addEventListener("click", () => fitVisiblePins());
    byId("clearFocus").addEventListener("click", () => {
      state.focusedId = null;
      render();
      fitVisiblePins();
    });

    window.addEventListener("resize", () => {
      window.clearTimeout(state.fitTimer);
      state.fitTimer = window.setTimeout(() => {
        hardInvalidateMap();
        state.focusedId ? focusSelected({ animate: false }) : fitVisiblePins({ animate: false });
      }, 180);
    });

    window.addEventListener("orientationchange", () => {
      defer(() => {
        hardInvalidateMap();
        state.focusedId ? focusSelected({ animate: false }) : fitVisiblePins({ animate: false });
      }, 420);
    });
  }
})();
