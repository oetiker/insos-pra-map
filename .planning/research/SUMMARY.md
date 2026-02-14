# Project Research Summary

**Project:** INSOS PrA Interactive Map
**Domain:** Third-party data integration, geographic visualization (Switzerland)
**Researched:** 2026-02-14
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is an interactive map-based provider directory for vocational training (PrA) placements in Switzerland, consuming data from the INSOS member directory. The research reveals a straightforward technical implementation (Leaflet + Vanilla JS + Vite on the client, Cloudflare Worker as CORS proxy) with one critical blocking dependency: reverse-engineering the INSOS Contao CMS data endpoint, as no official API exists. The recommended approach prioritizes data discovery and infrastructure setup first, followed by map implementation with mandatory marker clustering, and concludes with accessibility features (list view alternative) that are legally and ethically essential given the target user population (people with learning difficulties).

The primary risk is the fragility of depending on an undocumented third-party data source. INSOS can change their site structure at any time without notice, breaking the entire data pipeline. Mitigation strategies include: adapter pattern isolation, health check monitoring, cached fallback data, and proactive communication with INSOS to establish informal data access. Secondary risks include CORS blocking (requires proxy), map performance degradation (requires clustering from day one), and accessibility failures (requires parallel list view implementation, not post-hoc).

The project is well-suited for a phased approach: Phase 1 (data discovery and proxy setup), Phase 2 (map implementation with clustering), Phase 3 (filtering and UX polish), Phase 4 (accessibility and list view). Each phase builds on verified infrastructure from the previous phase, reducing risk of late-stage architectural rework.

## Key Findings

### Recommended Stack

The research strongly recommends a lightweight, framework-free stack optimized for this specific use case. Vite 7.x provides modern build tooling with instant HMR and minimal configuration. Leaflet 1.9.4 (not the alpha 2.0) offers the most mature, battle-tested mapping library with a massive plugin ecosystem, while remaining small (42KB). Vanilla JavaScript is explicitly recommended over React/Vue/Angular due to the small UI scope (under 20 components) where frameworks add 30-100KB for no proportional benefit. Tailwind CSS 4.x handles responsive layouts with zero runtime overhead. The Cloudflare Worker proxy (free tier: 100K requests/day) solves CORS and provides edge caching for the INSOS data source.

**Core technologies:**
- **Vite 7.x:** Modern build tool with instant HMR, native ESM dev server, optimized production builds
- **Leaflet 1.9.4:** Lightweight (42KB) mapping library with proven stability and 1.4M+ npm downloads/month
- **Vanilla JavaScript (ES2022+):** Zero framework overhead for ~20 UI components; Svelte 5 migration path if complexity grows
- **Tailwind CSS 4.x:** Utility-first CSS with zero-runtime, simplified v4 configuration
- **Cloudflare Worker:** CORS proxy + edge caching layer for INSOS data with generous free tier
- **leaflet.markercluster 1.5.3:** Essential for handling 1000+ pins performantly, even on mobile
- **OpenStreetMap tiles (SOSM):** Free Swiss-optimized tiles from sosm.ch, no API key required

**Critical version note:** Leaflet 2.0 is alpha-only and not production-ready. Vite 8 beta exists but use stable 7.x.

### Expected Features

Research shows this is a directory lookup tool, not a complex application. Users need to find providers near them by profession, view contact details, and share results. The core interaction pattern is: select sector (10 categories), drill down to specific profession (90 options), view filtered map pins, click for details. Mobile users dominate this demographic, requiring responsive design and touch-friendly interactions.

**Must have (table stakes):**
- Interactive map with zoom/pan and pin markers for provider locations
- Pin clustering for urban density (400+ providers will overlap without it)
- Pin popup/detail card showing org name, address, contact info, all PrA offerings, INSOS page link
- Sector filter with profession drill-down (two-step hierarchical filter)
- Responsive layout (desktop sidebar + map; mobile full-width with collapsible filters)
- German-language interface written in Einfache Sprache (plain language) for target users with learning difficulties
- Empty state handling when filters match zero results
- Fast initial load (under 3 seconds)

**Should have (competitive):**
- Shareable URL with filter state (deep linking) for vocational counselors sharing results
- Accessible list/table alternative view (screen-reader friendly, WCAG 2.1 AA target)
- PLZ/Ort location search with autocomplete
- Geolocation "In meiner Nahe" button to center map on user location
- Canton boundary overlay for spatial orientation
- Mobile bottom sheet for provider details (Google Maps pattern)

**Defer (v2+):**
- Multilingual support (FR/IT) — INSOS data is German-only, translations triple content work
- Other INSOS services (Wohnen, Arbeiten) — expand beyond PrA after validation
- Print/PDF export for offline reference

**Anti-features to avoid:**
- User accounts/saved searches (massive complexity, tiny benefit for one-time searches)
- Routing/directions integration (Google Maps already does this perfectly)
- Real-time availability data (INSOS does not provide this, stale data is worse than none)
- Full-text search (structured filters are more effective for this dataset)
- Admin CMS for provider editing (read-only consumer, out of scope)

### Architecture Approach

The architecture is a classic three-layer client-server pattern with edge caching. Client-side: static site (Vite build) with map view, filter panel, popup detail, and in-memory data cache. All 1000+ providers load once per session, filters operate client-side for instant response. Proxy layer: Cloudflare Worker adds CORS headers, caches responses (1-hour TTL), and optionally transforms HTML to JSON if INSOS endpoint serves HTML fragments. Data source: INSOS Contao CMS member directory, endpoint to be discovered via browser DevTools network monitoring.

**Major components:**
1. **Map View (Leaflet + markercluster)** — renders Switzerland base map, manages markers and clusters, handles zoom/pan interactions
2. **Filter Panel (Vanilla JS)** — two-level hierarchical dropdown (sector then profession), updates markers in real-time
3. **Data Layer (fetch + parse)** — fetches from proxy once, normalizes into app data model, caches in memory
4. **CORS Proxy (Cloudflare Worker)** — forwards to insos.ch, adds CORS headers, caches at edge (Cache API), optional HTML-to-JSON transform
5. **Popup Detail (Leaflet popup)** — shows full provider info on marker click, generated from in-memory data

**Critical architectural patterns:**
- **Data Discovery via DevTools:** The first step is reverse-engineering the INSOS endpoint by monitoring network traffic while interacting with their member directory. This is the blocking prerequisite.
- **Edge-Cached CORS Proxy:** Required because Contao CMS sites do not serve CORS headers. Direct browser-to-INSOS requests will fail. The proxy also protects upstream from excessive load.
- **Client-Side Marker Filtering:** All 1000 markers load once, stored in memory, filtered by adding/removing from MarkerClusterGroup. No server-side filtering needed — instant filter changes.
- **Adapter Pattern Isolation:** All INSOS-specific parsing lives in one module so site changes only require updating one file. Health checks verify upstream structure.

### Critical Pitfalls

Research identified five critical pitfalls that must be addressed in specific phases:

1. **Undocumented API Breaks Silently After INSOS Site Redesign** — The entire data pipeline fails when INSOS updates their Contao CMS or restructures their member directory. No official API contract means any change breaks your app. Prevention: adapter pattern isolation, health-check monitoring, cached fallback data, proactive INSOS communication. Address in Phase 1 (data layer).

2. **CORS Blocking Kills Client-Side Data Loading** — INSOS site does not set CORS headers. Direct browser requests fail. This is not optional — a proxy is a hard technical requirement. Prevention: Cloudflare Worker proxy from day one. Never use public CORS proxies (unreliable, security risk). Address in Phase 1 (infrastructure).

3. **Map Becomes Unusable with 1000+ Unmanaged Pins** — Rendering 1000 DOM elements freezes the UI, causes janky panning, crashes mobile browsers. Prevention: leaflet.markercluster from initial map implementation, never as an optimization later. Test with full dataset. Address in Phase 2 (map implementation).

4. **Inaccessible Map Excludes the Primary Target Users** — Interactive maps are fundamentally inaccessible to screen readers. Target users include people with learning difficulties who disproportionately rely on assistive technology. Prevention: build searchable list view as first-class alternative, not afterthought. Synchronize list and map filters. Full keyboard navigation. Test with screen readers. Address in Phase 3 (accessibility).

5. **Swiss Coordinate System Confusion Causes Misplaced Pins** — INSOS data may use Swiss LV95 (EPSG:2056) or LV03 coordinates instead of WGS84 that web maps expect. Pins appear in wrong locations. Prevention: identify coordinate format during data exploration, transform if needed (swiss-projection or proj4js), validate sample coordinates visually. Address in Phase 1 (data layer).

**Additional high-impact pitfalls:**
- Mobile scroll trap (map captures all touch gestures) — enable cooperative gesture handling
- No rate limiting on proxy — attackers use it as open relay, INSOS blocks your IP
- Filter UX uses jargon — target users with learning difficulties need plain German labels
- Data freshness vs performance trade-off — 1-hour cache TTL balances staleness and load time

## Implications for Roadmap

Based on combined research, the project has a clear critical path: data discovery blocks everything, then proxy setup enables client implementation, then map and filters can proceed in parallel, then accessibility features complete the MVP.

### Suggested Phase Structure (4 phases)

### Phase 1: Data Foundation & Infrastructure
**Rationale:** Research shows the INSOS data endpoint is undocumented and must be reverse-engineered before any implementation. The CORS proxy is a hard dependency (not optional) and should be built immediately after discovering the endpoint. This phase unblocks everything else.

**Delivers:**
- Documented INSOS data endpoint (URL, parameters, response format)
- Deployed Cloudflare Worker CORS proxy with caching
- Data normalization adapter module with health checks
- Coordinate system validation (WGS84 vs Swiss grid)
- Initial project scaffold (Vite + Leaflet + Tailwind)

**Addresses features:**
- Infrastructure prerequisite for all map/filter features
- Prevents Pitfall 1 (API breaks) via adapter pattern
- Prevents Pitfall 2 (CORS blocking) via proxy
- Prevents Pitfall 5 (coordinate confusion) via validation

**Key research flags:**
- **Needs hands-on research:** Data endpoint discovery requires real browser DevTools work (WebFetch cannot execute client-side JavaScript). Budget 4-8 hours for exploration.
- **Standard patterns:** Cloudflare Worker proxy follows documented examples (high confidence)
- **Unknown dependency:** If INSOS data lacks coordinates, geocoding ~1000 addresses is required (adds 1-2 days)

### Phase 2: Map Rendering & Clustering
**Rationale:** With data source established, the core map visualization can be built. Clustering must be included from the start (not added later) because testing shows 1000+ unmanaged markers cause severe performance issues. This phase delivers the primary user value.

**Delivers:**
- Interactive Leaflet map with OpenStreetMap (SOSM) tiles
- All provider markers plotted from fetched data
- Leaflet.markercluster integration (density-aware clustering)
- Pin popup with provider details (name, address, contact, PrA offerings)
- Responsive map layout (desktop sidebar, mobile full-width)
- Basic map state (zoom/pan position persistence)

**Addresses features:**
- Interactive map with pins (table stakes)
- Pin clustering for dense areas (table stakes)
- Pin popup/detail card (table stakes)
- Responsive layout foundation (table stakes)
- Fast load time via cached data (table stakes)

**Prevents:**
- Pitfall 3 (map performance) via clustering from day one
- Pitfall 6 (mobile scroll trap) via cooperative gesture handling

**Key research flags:**
- **Standard patterns:** Leaflet + markercluster is well-documented (high confidence)
- **No additional research needed:** Map rendering follows established patterns

### Phase 3: Filtering & UX Polish
**Rationale:** With the map working, layering on filters enables the core user workflow (find providers by profession and location). Research shows two-step hierarchical filtering (sector then profession) is the natural pattern. This phase makes the tool usable for the target workflow.

**Delivers:**
- Sector dropdown filter (10 categories)
- Profession drill-down filter (90 professions, shown after sector selection)
- Real-time marker filtering (client-side, instant response)
- PLZ/Ort location search with autocomplete
- Geolocation "In meiner Nahe" button
- Empty state handling (zero results messaging)
- Shareable URL with filter state (deep linking)
- German UI with Einfache Sprache (plain language for target users)

**Addresses features:**
- Filter by sector (table stakes)
- Drill-down to profession (table stakes)
- PLZ/Ort search (competitive advantage)
- Geolocation button (competitive advantage)
- Empty state handling (table stakes)
- Shareable URLs (table stakes for counselors)
- German/Einfache Sprache (table stakes for target audience)

**Prevents:**
- Pitfall 9 (filter jargon) via plain German labels and explanations
- Pitfall 10 (zero results confusion) via explicit messaging

**Key research flags:**
- **Standard patterns:** Hierarchical filtering, deep linking well-documented
- **May need research:** Swiss PLZ autocomplete dataset source (opendata.swiss) — verify format/integration

### Phase 4: Accessibility & List View
**Rationale:** Research strongly emphasizes that the target users (people with learning difficulties) disproportionately rely on assistive technology. An accessible list view is not a nice-to-have — it is legally prudent (Swiss DDA) and ethically essential. This phase must ship before launch, not as a v2 feature.

**Delivers:**
- Searchable/filterable list view (same data as map)
- Synchronized list/map filters (filtering one updates both)
- Full keyboard navigation with visible focus indicators
- WCAG 2.1 AA compliance (screen reader announcements, semantic HTML)
- Canton boundary overlay (optional visual aid)
- Mobile bottom sheet for provider details (Google Maps pattern)

**Addresses features:**
- Accessible list/table alternative view (competitive advantage, legal requirement)
- Canton overlay (competitive advantage)
- Mobile bottom sheet (competitive advantage)

**Prevents:**
- Pitfall 4 (inaccessible map excludes target users) via list view and keyboard navigation

**Key research flags:**
- **Needs validation research:** WCAG 2.1 AA specific requirements for filter widgets and result announcements — budget time for screen reader testing (VoiceOver, NVDA)
- **Standard patterns:** List/table views are well-understood, but synchronization with map requires careful state management

### Phase Ordering Rationale

**Why Phase 1 first:** Data discovery is the single blocking prerequisite. Nothing else can proceed without knowing the INSOS endpoint. The CORS proxy is mandatory infrastructure (not optional) and enables all client-side work.

**Why Phase 2 second:** The map is the core value proposition. Getting markers rendering with clustering establishes the foundation for all interaction features. Clustering must be built from the start — retrofitting causes rework.

**Why Phase 3 third:** Filters require a working map to visualize results. The two-step hierarchical pattern (sector then profession) depends on understanding the data shape established in Phase 1. Deep linking and location search are enhancements on top of basic filtering.

**Why Phase 4 fourth (but before launch):** Accessibility cannot be an afterthought for this user population. However, building the list view before the map works creates unnecessary complexity (what does the list sync to?). The list view shares filter logic with the map, so it depends on Phase 3 completion. This phase must ship in v1, not deferred to v2.

**Dependencies:**
- Phase 2 depends on Phase 1 (needs data source and proxy)
- Phase 3 depends on Phase 2 (needs working map to filter)
- Phase 4 depends on Phase 3 (needs filter logic to synchronize list view)

**Parallelization opportunities:**
- Map scaffold (static map, no data) can start during Phase 1 data discovery
- Canton boundary data prep can happen anytime (independent of provider data)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1:** Data endpoint discovery requires hands-on browser DevTools work. Cannot be automated or done via WebFetch. Budget exploration time.
- **Phase 3:** Swiss PLZ autocomplete integration needs verification of opendata.swiss dataset format and structure.
- **Phase 4:** WCAG 2.1 AA compliance testing with screen readers (VoiceOver, NVDA) may reveal additional requirements.

**Phases with standard patterns (skip research-phase):**
- **Phase 2:** Leaflet + markercluster is well-documented with extensive examples. High confidence.
- **Phase 3 (partial):** Hierarchical filtering and deep linking follow established patterns. Location search may need research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vite, Leaflet, Tailwind, Cloudflare Workers are mature, stable, well-documented technologies with verified version compatibility. |
| Features | HIGH | Table stakes features align with competitor analysis (berufsberatung.ch LENA, LehreBeO). User needs are clear from domain research. |
| Architecture | MEDIUM | Client-side filtering and CORS proxy patterns are proven. However, the INSOS data endpoint is unverified — actual response format (JSON vs HTML) determines whether proxy needs transformation logic. |
| Pitfalls | MEDIUM-HIGH | Identified pitfalls are well-researched and sourced from documented patterns. The INSOS API fragility risk is inherent to third-party integration and cannot be fully mitigated. |

**Overall confidence:** MEDIUM-HIGH

The stack, features, and general architecture are based on verified sources and established patterns. The medium confidence rating reflects one critical unknown: the INSOS data endpoint structure. Once discovered and documented in Phase 1, confidence rises to HIGH for subsequent phases.

### Gaps to Address

**Gap 1: INSOS Data Endpoint Discovery**
- **Status:** Unverified. Research confirms the member directory exists and loads dynamically, but the actual AJAX/XHR endpoint URL and response format are unknown.
- **Impact:** Blocks all implementation until resolved.
- **Resolution:** Phase 1 includes manual data discovery with browser DevTools. Budget 4-8 hours for exploration and documentation.

**Gap 2: Coordinate Format in INSOS Data**
- **Status:** Unknown whether INSOS provides WGS84 lat/lng, Swiss LV95 coordinates, or only addresses.
- **Impact:** Determines whether coordinate transformation or geocoding is needed.
- **Resolution:** Discovered during Phase 1 data exploration. If addresses only, geocoding adds 1-2 days to Phase 1.

**Gap 3: INSOS Site Change Notification**
- **Status:** No formal API means no SLA or change notification from INSOS.
- **Impact:** Site redesign breaks data pipeline without warning.
- **Resolution:** Adapter pattern + health checks mitigate. Consider contacting INSOS informally during Phase 1 to establish communication and potentially negotiate advance notice of changes.

**Gap 4: Swiss PLZ Autocomplete Integration**
- **Status:** opendata.swiss provides PLZ dataset, but exact format and integration pattern need verification.
- **Impact:** Affects Phase 3 PLZ/Ort search feature complexity.
- **Resolution:** Quick validation during Phase 3 planning. If format is complex, defer to Phase 5 (v1.1).

**Gap 5: WCAG 2.1 AA Compliance Details**
- **Status:** General requirements known, but specific announcements for filter widgets and result counts need verification.
- **Impact:** Phase 4 accessibility implementation may take longer if screen reader testing reveals issues.
- **Resolution:** Budget time for iterative testing with VoiceOver (macOS) and NVDA (Windows) during Phase 4.

## Sources

### Primary (HIGH confidence)
- [Leaflet official site](https://leafletjs.com/) — version 1.9.4 stable, 2.0.0-alpha announced
- [Vite releases](https://vite.dev/releases) — Vite 7.3.x stable, Vite 8 beta
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) — 100K requests/day free tier
- [Cloudflare CORS proxy docs](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) — official example
- [Leaflet.markercluster GitHub](https://github.com/Leaflet/Leaflet.markercluster) — v1.5.3, performance data
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) — v4.0 released early 2025
- [Swiss OSM tile service](https://sosm.ch/projects/tile-service/) — free Switzerland tiles
- [Contao CMS documentation](https://docs.contao.org/) — listing module behavior
- [INSOS website analysis](https://www.insos.ch/) — member directory structure, Contao CMS confirmed
- [Swiss boundaries GeoJSON](https://labs.karavia.ch/swiss-boundaries-geojson/) — canton boundaries

### Secondary (MEDIUM confidence)
- [NN/g map UX patterns](https://www.nngroup.com/articles/interactive-ux-maps/) — filter design best practices
- [Map UI Patterns](https://mapuipatterns.com/) — interaction design patterns catalog
- [Mapbox store locator best practices](https://www.mapbox.com/blog/best-practices-for-custom-store-locators) — clustering, filters, mobile UX
- [Map accessibility (Carnegie Museums)](http://web-accessibility.carnegiemuseums.org/content/maps/) — screen reader alternatives
- [Equal Entry accessible maps](https://equalentry.com/accessible-maps-on-the-web/) — WCAG compliance
- [Reverse engineering APIs guide](https://blog.apify.com/reverse-engineer-apis/) — DevTools discovery techniques
- [Competitor analysis: LehreBeO](https://lehrebeo.ch/lsp/map/lehrstellen) — Leaflet map with clustering example
- [Competitor analysis: berufsberatung.ch LENA](https://www.berufsberatung.ch/dyn/show/2930) — filter patterns
- [Swiss FADP data protection](https://www.cookieyes.com/blog/switzerland-fadp/) — legal requirements

### Tertiary (LOW confidence, needs validation)
- [Contao Content API bundle](https://github.com/DieSchittigs/contao-content-api-bundle) — third-party JSON API for Contao, may not be installed on insos.ch
- [geo.admin.ch Swiss geocoding](https://docs.geo.admin.ch/) — usage restrictions unclear
- [Geoapify library comparison](https://www.geoapify.com/map-libraries-comparison-leaflet-vs-maplibre-gl-vs-openlayers-trends-and-statistics/) — market share data

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
