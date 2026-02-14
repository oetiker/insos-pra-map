# Pitfalls Research

**Domain:** Third-party interactive map consuming INSOS PrA member data (Switzerland)
**Researched:** 2026-02-14
**Confidence:** MEDIUM — based on domain research, verified web search findings, and project-specific constraints

## Critical Pitfalls

### Pitfall 1: Undocumented API Breaks Silently After INSOS Site Redesign

**What goes wrong:**
The entire data pipeline breaks when INSOS updates their Contao CMS, restructures their member directory page, changes URL slugs, or modifies the JavaScript that loads member data. Because there is no official API contract, any change on their end — even a Contao version upgrade — can silently kill your data source. The current INSOS site appears to be migrating (old URLs like `www.insos.ch/Ueber-uns/INSOS-Dienstleister-finden/PdvHT/` coexist with new paths like `insos.ch/de/ueber-uns`), indicating active restructuring.

**Why it happens:**
Reverse-engineering a website's internal data-loading mechanism creates a coupling to implementation details that the upstream site owner has no obligation to preserve. Contao CMS sites often serve data through server-rendered HTML fragments or Contao-specific AJAX endpoints (`X-Contao-Ajax-Form` headers observed in their forms), not stable JSON APIs. When INSOS upgrades Contao or redesigns their member directory, the endpoint signatures, response formats, and HTML structures all change without notice.

**How to avoid:**
- Build a data-fetching layer with a strict adapter pattern: isolate all INSOS-specific parsing into a single module so a site change only requires updating one file
- Implement a health-check endpoint or scheduled probe that verifies the upstream data source returns expected structure (e.g., "does the response contain member names and addresses?")
- Cache the last-known-good dataset so the map keeps working during outages
- Proactively reach out to INSOS to ask about data access — even an informal "we won't block you" reduces risk. They may have a data export or internal endpoint they can share
- Document the exact request/response contract you depend on so debugging is fast when it breaks

**Warning signs:**
- The map starts showing zero results or incomplete data
- HTTP status codes change (200 to 403, 301 redirects to new paths)
- Response format changes (HTML where JSON was expected, different field names)
- INSOS website visually looks different (signals a redesign happened)

**Phase to address:**
Phase 1 (Data layer foundation) — the adapter pattern and health checks must be built from day one, not retrofitted.

---

### Pitfall 2: CORS Blocking Kills Client-Side Data Loading on Static Hosting

**What goes wrong:**
The INSOS site does not set `Access-Control-Allow-Origin` headers for cross-origin requests. A purely client-side app on static hosting (GitHub Pages, Netlify, Cloudflare Pages) cannot fetch data from `insos.ch` because the browser blocks the response. Developers discover this only when they deploy — it works on localhost with browser extensions disabled CORS checks or when testing with curl.

**Why it happens:**
Contao CMS does not expose CORS headers by default. The INSOS site has no reason to allow cross-origin requests since their member directory is designed for same-origin use. The browser's Same-Origin Policy is absolute — there is no client-side workaround.

**How to avoid:**
- Accept upfront that a server-side component is required. This is not optional — it is a hard technical constraint
- Use a lightweight serverless function (Cloudflare Worker, Netlify Function, Vercel Edge Function) as a proxy/caching layer. Cloudflare Workers are ideal: free tier covers this use case, low latency from Swiss edge nodes, and the worker can also cache and transform the INSOS response
- Do NOT rely on public CORS proxy services (cors-anywhere, corsproxy.io). These are rate-limited, unreliable, introduce a man-in-the-middle security risk, and frequently go offline. Using them in production is a liability
- Do NOT use browser extensions or development-only workarounds as your architecture assumes these exist

**Warning signs:**
- "No 'Access-Control-Allow-Origin' header" errors in browser console
- Data loads in development (server-side proxy active) but fails in production
- Intermittent failures if using a free CORS proxy that rate-limits

**Phase to address:**
Phase 1 (Infrastructure) — the proxy/caching layer is a prerequisite for everything else. Pick your serverless platform before writing frontend code.

---

### Pitfall 3: Map Becomes Unusable with 1000+ Unmanaged Pin Markers

**What goes wrong:**
Rendering 1000+ individual marker pins on a Leaflet/MapLibre map causes severe performance problems: initial render is slow (2-5 seconds of frozen UI), panning and zooming become janky, and on mobile devices the map may crash the browser tab. Additionally, a view of all of Switzerland with 1000 overlapping pins is visually useless — the user cannot distinguish individual locations.

**Why it happens:**
Each marker is a separate DOM element. 1000+ DOM elements with event listeners and popups overwhelm the browser's rendering pipeline. Developers test with 50 pins during development and only discover the problem with real data.

**How to avoid:**
- Use marker clustering from day one, not as an optimization later. Leaflet.markercluster handles 50,000 points without issues. For this project's ~1000 points, it is more than sufficient
- Apply clustering at all zoom levels, with a `spiderfyOnMaxZoom` option so users can access individual pins even when locations overlap
- Consider canvas rendering (`L.Canvas` renderer in Leaflet) instead of default SVG/DOM rendering for better performance
- Only render markers within the current viewport bounds — Leaflet.markercluster does this automatically
- Test with the full dataset from the start, not a subset

**Warning signs:**
- Frame drops when panning/zooming (check with browser DevTools Performance tab)
- Map load time exceeds 1 second on desktop or 2 seconds on 3G mobile
- Users report "the map is slow" or "it froze"

**Phase to address:**
Phase 2 (Map implementation) — clustering must be part of the initial map implementation, not added later. The map should never exist in a state without clustering.

---

### Pitfall 4: Inaccessible Map Excludes the Primary Target Users

**What goes wrong:**
Interactive maps are inherently inaccessible to screen reader users and people with motor disabilities who use keyboard navigation. For this project, the target users include people with learning difficulties — a population that disproportionately relies on assistive technology and benefits from simple, clear interfaces. Building only a visual map with no alternative means of accessing the data fails the core user group.

**Why it happens:**
Map libraries like Leaflet render to `<canvas>` or SVG with no semantic HTML structure. Screen readers cannot interpret pin locations, cluster information, or popup content. Developers treat the map as the primary interface and neglect text-based alternatives. Research confirms that interactive maps are fundamentally not screen-reader accessible — there is no ARIA pattern that makes a pan/zoom map work with a screen reader.

**How to avoid:**
- Build a searchable/filterable list view as a first-class alternative to the map, not an afterthought. The list view should show the same data (organization name, address, PrA offerings, contact info) and support the same filters (sector, profession, canton)
- Keep the list view and map view synchronized — filtering on one updates the other
- Ensure the list view is fully keyboard-navigable with proper focus management
- Use clear, simple German language (Leichte Sprache considerations) given the target audience
- Add `aria-label` to the map container explaining what it shows and directing users to the list view
- Make filter controls standard HTML `<select>` and `<button>` elements, not custom JavaScript widgets
- Test with VoiceOver (macOS/iOS) and NVDA (Windows) — do not assume accessibility, verify it

**Warning signs:**
- No list/table view exists alongside the map
- Filter controls are not reachable via Tab key
- Screen reader announces nothing meaningful on the map container
- Filter selections do not announce results count to screen readers

**Phase to address:**
Phase 2 (UI implementation) — the list view must be built in parallel with the map, not as a "nice-to-have" later phase. Accessibility is not a feature; it is a constraint for this user population.

---

### Pitfall 5: Swiss Coordinate System Confusion Causes Misplaced Pins

**What goes wrong:**
INSOS member addresses may be geocoded in Swiss LV95 (EPSG:2056) or the older LV03 (EPSG:21781) coordinate systems rather than WGS84 (EPSG:4326) that web maps expect. Pins appear in the wrong locations — sometimes in the ocean, sometimes shifted by hundreds of meters. The confusion is invisible until someone notices a pin in the wrong canton.

**Why it happens:**
Switzerland uses its own national coordinate systems (Swiss Oblique Mercator projection) rather than the global WGS84 standard used by web mapping libraries. Swiss government data, swisstopo services, and many Swiss applications output LV95 coordinates (e.g., `2'600'000 / 1'200'000`) that look nothing like WGS84 lat/lon (e.g., `46.95 / 7.45`). If the INSOS data contains Swiss grid coordinates and the code assumes WGS84, every pin will be wrong.

**How to avoid:**
- Determine the coordinate format of the INSOS data in the data exploration phase — are they lat/lon (WGS84) or Swiss grid (LV95/LV03)?
- If Swiss grid: use the `swiss-projection` npm package or proj4js with the EPSG:2056 definition to transform coordinates before passing them to the map library
- If addresses without coordinates: use a geocoding service (Nominatim, swisstopo API) to convert addresses to WGS84 lat/lon
- Validate a sample of 10-20 converted coordinates visually on the map to catch systematic errors early
- Be aware that LV95 coordinates have 7-digit easting (2'xxx'xxx) and LV03 have 6-digit easting (xxx'xxx) — mixing them up shifts points by ~2,000 km

**Warning signs:**
- Pin coordinates have values like 2600000/1200000 instead of 46.9/7.4
- Pins appear outside Switzerland or clustered in the wrong area
- A sample address in Bern does not appear near Bern on the map

**Phase to address:**
Phase 1 (Data layer) — coordinate system identification and transformation must happen during data source exploration, before any map rendering.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding INSOS URL patterns and HTML selectors | Faster initial implementation | Every INSOS site change requires code changes, no warning system | Never — use an adapter module with health checks from day one |
| Using a public CORS proxy | No server-side code needed | Unreliable, rate-limited, security risk, proxy can read all data | Never for production — acceptable only during initial data exploration |
| Skipping marker clustering | Simpler map setup | Unusable performance at full dataset, must retrofit later | Never — clustering is a few lines of code and prevents rework |
| Geocoding addresses on every page load | No cached coordinate storage needed | Slow page loads, geocoding API rate limits, cost at scale | Only in MVP if dataset is small (<50 addresses); cache results immediately after |
| Embedding map as the only UI | Single interface to build and maintain | Excludes screen reader users, fails accessibility requirements | Never for this project — target users require accessible alternatives |
| Fetching INSOS data on every page load (no caching) | Always shows freshest data | Slow page loads, hammers INSOS server, breaks when INSOS is down | Never — member data changes infrequently, cache for at least 1 hour |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| INSOS Contao site | Parsing rendered HTML instead of finding the XHR/AJAX data endpoint | Use browser DevTools Network tab to intercept the actual data requests the member directory makes, then replicate those requests in your proxy |
| INSOS Contao site | Assuming the data endpoint is stable across site updates | Build monitoring that alerts when the response structure changes; version your parser |
| Leaflet tile provider | Using OpenStreetMap tiles without attribution or exceeding usage policy | Use OpenStreetMap with proper attribution, or swisstopo tiles (free for non-commercial use) which provide Swiss-quality base maps |
| swisstopo map tiles | Assuming swisstopo tiles use standard EPSG:3857 (Web Mercator) | swisstopo tiles use EPSG:2056 (LV95) projection; if using swisstopo tiles, you need proj4leaflet. Standard OSM/Mapbox tiles in EPSG:3857 are simpler |
| Geocoding Swiss addresses | Using a global geocoder that does not understand Swiss address formats (Strasse/Weg, PLZ/Ort patterns) | Use the swisstopo geocoding API (`api3.geo.admin.ch`) or Nominatim with `countrycodes=ch` for better Swiss address matching |
| Cantonal boundary data | Using outdated or low-resolution boundary files | Use swissBOUNDARIES3D from opendata.swiss — updated annually, official source, available as GeoJSON/Shapefile |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full INSOS dataset on every page view | 2-5 second initial load, repeated on every visit | Cache data in the proxy layer (Cloudflare Worker KV, or server-side cache) with 1-24 hour TTL | Immediately — even with ~1000 records, unnecessary network latency degrades UX |
| Rendering all markers without clustering | Map freezes during pan/zoom, mobile browser crashes | Use Leaflet.markercluster or supercluster from the start | At ~200+ markers on mobile, ~500+ on desktop |
| Loading high-resolution cantonal boundary GeoJSON | 5-10 MB file download, long parse time | Use TopoJSON (10-50x smaller), simplify geometries with tools like mapshaper, or skip cantonal boundaries entirely if not needed for filtering | When boundary file exceeds 500KB |
| Parsing/transforming data on the client side | JavaScript main thread blocked during data processing, UI freezes | Do data transformation in the proxy/worker, deliver map-ready JSON to the client | At ~500+ records with complex transformations |
| No lazy loading of popup content | All popup HTML rendered upfront for 1000+ markers | Generate popup content on marker click, not on map load | At ~300+ markers with rich popup content |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing INSOS proxy endpoint without rate limiting | Attackers use your proxy as an open relay to hammer INSOS, INSOS blocks your IP, your service goes down | Add rate limiting to the proxy (Cloudflare Workers has built-in rate limiting); restrict the proxy to only forward requests to the specific INSOS endpoint |
| Passing raw user input to the INSOS data endpoint | Injection attacks if INSOS endpoint accepts query parameters | Validate and sanitize all filter parameters in the proxy before forwarding; use allowlists for known filter values |
| Storing/displaying personal data (phone, email) without considering FADP | Violation of Swiss Federal Act on Data Protection (nFADP, effective Sept 2023); risk of fines up to CHF 250,000 | Only display data that INSOS already makes publicly available on their own site; do not aggregate, enrich, or store personal data beyond what is needed for the map display; add a privacy notice |
| No Content Security Policy on the static site | XSS risks if any user-generated content or third-party scripts are injected | Set strict CSP headers: only allow scripts from your domain and map tile providers |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Full-page map with no way to scroll past it on mobile | Users get "trapped" in the map — swiping to scroll the page pans the map instead | Use `gestureHandling: 'cooperative'` (two-finger pan) or place the map in a contained div with explicit "Enter map" interaction; provide a "Skip map" link |
| Filter UI uses jargon ("PrA", "Sektor", "Branche") without explanation | Target users (people with learning difficulties, their parents) may not understand professional terminology | Use plain German labels, add brief explanations or tooltips, group by familiar categories ("Kochen und Service" instead of "Gastronomie") |
| No feedback when filters produce zero results | Users think the app is broken | Show explicit "Keine Ergebnisse" message with suggestion to broaden the search; keep map centered on Switzerland rather than showing a blank view |
| Popup content overflows on mobile screens | Popups with addresses, phone numbers, and offerings list are too tall/wide for small screens | Use a bottom sheet or side panel on mobile instead of popups; limit initial popup to name and primary info with "Mehr anzeigen" expansion |
| Map loads centered on Bern with all of Switzerland visible | Users in Geneva or St. Gallen must zoom/pan to their area every time | Offer a canton/region quick-select or use browser geolocation (with permission) to center the initial view; remember the user's last position in sessionStorage |

## "Looks Done But Isn't" Checklist

- [ ] **Data freshness:** Map shows data but it is served from a stale cache with no refresh mechanism — verify the cache TTL is set and a background refresh is running
- [ ] **Error handling:** Map renders but silently shows no pins when INSOS is unreachable — verify there is a fallback to cached data and a visible error message
- [ ] **Mobile scroll trap:** Map works on desktop but traps scroll on mobile — verify cooperative gesture handling is enabled and the map is not full-viewport
- [ ] **Keyboard navigation:** Filters work with mouse but Tab key skips them or focus is invisible — verify every interactive element is keyboard-reachable with visible focus ring
- [ ] **Screen reader alternative:** Map renders but screen reader announces nothing useful — verify the list view exists, is navigable, and announces result counts on filter change
- [ ] **Coordinate accuracy:** Pins appear on the map but are shifted from actual locations — verify 10+ sample addresses against known locations on Google Maps
- [ ] **Attribution:** Map tiles load but no attribution text is shown — verify OpenStreetMap/swisstopo attribution is visible per their usage terms
- [ ] **CORS in production:** Data loads on localhost but not on the deployed site — verify CORS proxy is deployed and the production app uses it
- [ ] **Clustering at all zoom levels:** Pins are clustered at country zoom but overlap at city zoom — verify clustering works at all zoom levels and spiderfy activates at max zoom
- [ ] **Empty states:** App loads with no filters selected, showing nothing — verify a sensible default view exists (all providers, or a prompt to select a sector)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| INSOS site redesign breaks data source | MEDIUM | Switch to cached last-known-good data immediately; reverse-engineer new endpoint; update adapter module; redeploy proxy |
| CORS proxy goes down | LOW | If using Cloudflare Workers: redeploy from source; if using a third-party proxy: migrate to self-hosted solution within hours |
| 1000+ pins cause performance issues | MEDIUM | Add Leaflet.markercluster (few hours of work if map already exists); may require refactoring how markers are created |
| Coordinate system mismatch discovered late | MEDIUM | Add proj4js transformation in the data pipeline; reprocess all coordinates; visual QA 10+ sample locations |
| Accessibility audit reveals map-only interface fails | HIGH | Building the list view after the fact requires significant rework — UI layout, filter synchronization, focus management, screen reader testing. This is why it must be built in parallel |
| Swiss data protection complaint about displaying member contact data | HIGH | Audit all displayed data against what INSOS publicly shows; remove any enriched/aggregated data; add privacy notice; consider legal consultation |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Undocumented API breaks | Phase 1: Data Layer | Adapter pattern exists; health-check probe runs; cached fallback works when upstream is down |
| CORS blocking | Phase 1: Infrastructure | Proxy deployed and serving data from the production domain; no direct client-to-INSOS requests |
| Map performance with 1000+ pins | Phase 2: Map Implementation | Full dataset loads in under 2 seconds; clustering active; mobile browser does not crash |
| Inaccessible map interface | Phase 2: UI Implementation | List view exists alongside map; keyboard navigation works end-to-end; screen reader announces results |
| Swiss coordinate confusion | Phase 1: Data Exploration | 10+ sample coordinates verified on map; transformation pipeline tested if needed |
| Mobile scroll trap | Phase 2: Map Implementation | Two-finger gesture handling enabled; page scrolls past map with one finger on mobile |
| Data freshness vs performance | Phase 1: Infrastructure | Cache TTL set; background refresh works; stale data served during upstream outage |
| Legal/FADP compliance | Phase 1: Planning | Only publicly-available INSOS data is displayed; privacy notice added; no personal data storage beyond cache |
| Filter UX for target users | Phase 2: UI Implementation | Labels tested with non-expert users; plain language used; zero-result states handled |

## Sources

- INSOS website analysis: https://www.insos.ch/de/ueber-uns, https://www.insos.ch/Ueber-uns/INSOS-Dienstleister-finden/PdvHT/
- INSOS PrA program: https://www.insos.ch/ausbildung-pra/pra-dienstleister-finden/
- Contao CMS API discussion: https://github.com/contao/core-bundle/issues/1564
- Leaflet marker clustering: https://github.com/Leaflet/Leaflet.markercluster
- Leaflet performance optimization: https://medium.com/@silvajohnny777/optimizing-leaflet-performance-with-a-large-number-of-markers-0dea18c2ec99
- Swiss coordinate system EPSG:2056: https://epsg.io/2056
- swiss-projection npm: https://www.npmjs.com/package/swiss-projection
- Leaflet Swiss tile layer: https://leaflet-tilelayer-swiss.karavia.ch/usage
- swissBOUNDARIES3D open data: https://opendata.swiss/en/dataset/swissboundaries3d-kantonsgrenzen
- Swiss maps TopoJSON: https://github.com/interactivethings/swiss-maps
- Map accessibility (Carnegie Museums): http://web-accessibility.carnegiemuseums.org/content/maps/
- Map accessibility (Equal Entry): https://equalentry.com/accessible-maps-on-the-web/
- Screen reader map accessibility study: https://link.springer.com/chapter/10.1007/978-3-030-78092-0_15
- Mobile map scroll handling (Google): https://mapsplatform.google.com/resources/blog/smart-scrolling-comes-to-mobile-web-maps/
- Swiss FADP data protection: https://www.cookieyes.com/blog/switzerland-fadp/
- FADP overview: https://usercentrics.com/knowledge-hub/switzerland-federal-data-protection-act-fadp/
- Third-party API dependency risks: https://thatapicompany.com/3rd-party-api-integration-pitfalls-and-best-practices/
- Reverse engineering undocumented APIs: https://blog.apify.com/reverse-engineer-apis/
- CORS proxy alternatives: https://nordicapis.com/10-free-to-use-cors-proxies/

---
*Pitfalls research for: INSOS PrA Interactive Map (third-party data consumer, Swiss geography, accessibility-critical)*
*Researched: 2026-02-14*
