# Architecture Research

**Domain:** Interactive map application consuming third-party data (INSOS PrA provider directory)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (Static Site)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Map     │  │  Filter  │  │  Popup   │  │  Data Cache  │   │
│  │  View    │  │  Panel   │  │  Detail  │  │  (in-memory) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │             │               │           │
│       └──────────────┴─────────────┴───────────────┘           │
│                            │                                   │
│                    ┌───────┴────────┐                           │
│                    │   Data Layer   │                           │
│                    │  (fetch + parse)│                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼───────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────┐
│              PROXY (Cloudflare Worker)                          │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────────────┐  │
│  │ CORS       │  │ Cache      │  │ Optional Transform      │  │
│  │ Headers    │  │ (Cache API)│  │ (normalize data shape)  │  │
│  └─────┬──────┘  └─────┬──────┘  └────────────┬────────────┘  │
│        └───────────────┼───────────────────────┘               │
│                        │                                       │
└────────────────────────┼───────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              SOURCE (insos.ch — Contao CMS)                    │
│  ┌────────────────────────────────────────────────────┐        │
│  │  Member directory endpoint (to be discovered)      │        │
│  │  Likely: HTML listing page or undocumented JSON    │        │
│  └────────────────────────────────────────────────────┘        │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Map View** | Renders Switzerland map with tile layer, manages markers and clusters, handles zoom/pan | Leaflet + Leaflet.markercluster + OpenStreetMap/Swisstopo tiles |
| **Filter Panel** | Sector dropdown (10 categories), profession sub-filter (90 items), shows/hides markers | Vanilla JS DOM manipulation, two-level hierarchical filter |
| **Popup Detail** | Shows org name, address, phone, email, website, PrA offerings on marker click | Leaflet popup with HTML content |
| **Data Cache** | Stores fetched member data in memory, prevents redundant fetches during session | JavaScript variable/Map, sessionStorage fallback |
| **Data Layer** | Fetches member data from proxy, parses response, normalizes into app data model | fetch() API, JSON parsing or HTML parsing |
| **CORS Proxy** | Forwards requests to insos.ch, adds CORS headers, caches responses at edge | Cloudflare Worker with Cache API |
| **Source** | INSOS member directory — the upstream data source we have no control over | Contao CMS, endpoint TBD via reverse engineering |

## Recommended Project Structure

```
insos-map/
├── src/
│   ├── index.html          # Single page shell
│   ├── main.js             # App entry point, initialization
│   ├── map.js              # Map initialization, marker management
│   ├── data.js             # Data fetching, parsing, normalization
│   ├── filters.js          # Filter UI and logic
│   ├── categories.js       # Sector/profession category definitions
│   ├── popup.js            # Marker popup templates
│   └── style.css           # Application styles
├── proxy/
│   └── worker.js           # Cloudflare Worker CORS proxy + cache
├── public/
│   └── favicon.ico         # Static assets
├── scripts/
│   └── discover-api.md     # Notes from API reverse-engineering
├── package.json
└── vite.config.js          # Build config
```

### Structure Rationale

- **src/**: All client code in flat structure because the app is small (~7 modules). No framework, no component hierarchy needed. Each file is one concern.
- **proxy/**: Isolated from client code because it deploys separately (Cloudflare Worker). Single file is sufficient.
- **scripts/**: Tooling and documentation for the data discovery process. Not shipped to production.

## Architectural Patterns

### Pattern 1: Data Discovery via Browser DevTools

**What:** Reverse-engineer the INSOS member directory data source by monitoring network traffic in browser DevTools while interacting with their member listing page.

**When to use:** At project start, before any code is written. This is the critical-path prerequisite.

**Trade-offs:** The discovered endpoint may change if INSOS redesigns their site. No SLA or stability guarantee. Must be re-verified periodically.

**Approach:**
1. Open `insos.ch/de/ueber-uns#unsere-mitglieder-268211` in browser
2. Open DevTools > Network tab, filter by XHR/Fetch
3. Interact with member directory (scroll, filter by PrA, filter by region)
4. Identify requests that return member data (look for JSON responses or HTML fragments)
5. Test discovered endpoint with curl/Postman outside the browser
6. Document the endpoint URL, parameters, response format, and any required headers

**Confidence:** MEDIUM — Research confirms the member directory exists and loads dynamically. The PROJECT.md states it "loads dynamically via client-side JavaScript." Multiple pages reference the directory with filtering by PrA offering and region. But WebFetch could not extract the actual AJAX calls from the rendered page (likely because they execute after initial page load via JavaScript). The endpoint must be discovered hands-on with a real browser.

**What if the data is server-rendered HTML, not JSON?**
If the Contao listing module renders HTML (which is its default behavior per the Contao docs), the proxy or client will need to parse HTML instead of JSON. This is common — many CMS-based directories serve HTML fragments via AJAX pagination. The proxy can optionally transform HTML to JSON to keep the client simple.

### Pattern 2: Edge-Cached CORS Proxy

**What:** A Cloudflare Worker that proxies requests to the INSOS endpoint, adds CORS headers, and caches responses using Cloudflare's Cache API.

**When to use:** When the INSOS endpoint does not serve CORS headers (extremely likely — CMS sites almost never do for their own frontend endpoints).

**Trade-offs:**
- Pro: Free tier (100K requests/day), global edge caching, ~50 lines of code
- Pro: Can transform data shape (HTML to JSON) at the edge
- Pro: Protects upstream from excessive requests
- Con: Additional infrastructure to maintain (though minimal)
- Con: If INSOS changes their endpoint, the proxy needs updating

**Example:**
```javascript
// proxy/worker.js (simplified)
const UPSTREAM = 'https://www.insos.ch/path/to/member-endpoint';
const CACHE_TTL = 3600; // 1 hour — member data changes infrequently

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Check cache
    const cache = caches.default;
    const cacheKey = new Request(UPSTREAM, request);
    let response = await cache.match(cacheKey);

    if (!response) {
      // Fetch from upstream
      const upstream = await fetch(UPSTREAM, {
        headers: { 'User-Agent': 'INSOS-Map-Proxy/1.0' },
      });

      // Optionally transform here (HTML → JSON)
      const body = await upstream.text();

      response = new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
```

### Pattern 3: Client-Side Marker Filtering with MarkerClusterGroup

**What:** Load all ~1000 member markers once, store in memory, use Leaflet.markercluster for clustering, and filter by adding/removing markers from the cluster group based on selected sector/profession.

**When to use:** When dataset is small enough to load entirely (1000 members is well within this threshold — MarkerCluster handles 10K-50K markers).

**Trade-offs:**
- Pro: No server-side filtering needed — all filtering is instant in the browser
- Pro: Single data fetch per session, no network latency for filter changes
- Pro: Works offline after initial load
- Con: Initial payload size (~1000 records) — acceptable for this scale
- Con: All data exposed to client (no privacy concern here — it's a public directory)

**Example:**
```javascript
// Simplified filtering pattern
const allMarkers = []; // populated from fetched data
const clusterGroup = L.markerClusterGroup();

function applyFilter(sectorId, professionId) {
  clusterGroup.clearLayers();
  const filtered = allMarkers.filter(m => {
    if (sectorId && m.data.sector !== sectorId) return false;
    if (professionId && !m.data.professions.includes(professionId)) return false;
    return true;
  });
  clusterGroup.addLayers(filtered);
}
```

## Data Flow

### Primary Data Flow (Page Load)

```
[User opens page]
    │
    ▼
[main.js] ──initializes──▶ [map.js] creates Leaflet map
    │                           │
    ├──calls──▶ [data.js] ─────┤
    │              │            │
    │              ▼            │
    │     fetch(proxy URL)      │
    │              │            │
    │              ▼            │
    │     [CF Worker Proxy]     │
    │         │        │        │
    │    [cache hit?]  │        │
    │     yes│    no│  │        │
    │        │      ▼  │        │
    │        │  fetch(insos.ch) │
    │        │      │  │        │
    │        │      ▼  │        │
    │        │  [transform?]    │
    │        │      │  │        │
    │        │  [cache store]   │
    │        │      │  │        │
    │        ▼      ▼  │        │
    │     [JSON response]       │
    │              │            │
    │              ▼            │
    │     [data.js] parses,     │
    │     creates markers       │
    │              │            │
    │              ▼            │
    │     [map.js] adds markers │
    │     to clusterGroup       │
    │              │            │
    ├──calls──▶ [filters.js]    │
    │     builds filter UI      │
    │     from category data    │
    │                           │
    ▼                           ▼
[App ready — map with all markers visible]
```

### Filter Interaction Flow

```
[User selects sector dropdown]
    │
    ▼
[filters.js] ──reads selection──▶ updates profession dropdown options
    │
    ▼
[User selects profession (optional)]
    │
    ▼
[filters.js] ──calls──▶ [map.js].applyFilter(sector, profession)
    │
    ▼
[map.js] filters in-memory markers, updates clusterGroup
    │
    ▼
[Map re-renders with filtered markers + clusters]
```

### Key Data Flows

1. **Data fetch (cold):** Client → CF Worker (cache miss) → insos.ch → CF Worker (cache + transform) → Client. Latency: ~500ms-2s depending on INSOS response time.
2. **Data fetch (warm):** Client → CF Worker (cache hit) → Client. Latency: ~50-100ms from nearest CF edge.
3. **Filter change:** Entirely client-side, no network. In-memory array filter + Leaflet layer update. Latency: <50ms for 1000 markers.
4. **Marker click:** Entirely client-side. Popup content generated from in-memory data. Latency: instant.

### State Management

No framework state management needed. The app has three pieces of state:

| State | Storage | Mutated By |
|-------|---------|------------|
| Member data array | JS variable (in-memory) | data.js on initial fetch |
| Active filter selection | DOM (dropdown values) + JS variable | filters.js on user interaction |
| Map viewport (zoom, center) | Leaflet internal state | User pan/zoom |

This is simple enough for vanilla JS. No Redux, no stores, no reactive framework needed.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~1K members) | Load all data at once, filter client-side. No pagination needed. Single CF Worker. |
| 5K-10K members | Still fine with client-side approach. MarkerCluster handles up to 50K. Increase cache TTL if upstream is slow. |
| 10K+ members | Consider server-side filtering in the Worker, paginated responses, or a lightweight backend with a database. Unlikely for this domain. |

### Scaling Priorities

1. **First bottleneck: INSOS upstream response time.** If their endpoint is slow (>2s), user experience suffers on first load. Mitigation: aggressive caching in the Worker (1h+ TTL). Member data changes rarely — even daily cache refresh is fine.
2. **Second bottleneck: Initial payload size.** At 1K members with full details, expect ~200-500KB JSON. Mitigation: gzip (handled by CF Worker automatically), lazy-load detail data if needed.

## Anti-Patterns

### Anti-Pattern 1: Direct Browser-to-INSOS Requests

**What people do:** Try to fetch directly from insos.ch in browser JavaScript.
**Why it's wrong:** CORS will block it. CMS sites do not set `Access-Control-Allow-Origin` headers for their dynamic content endpoints. The browser will reject the response.
**Do this instead:** Route through a CORS proxy (Cloudflare Worker). The proxy makes server-to-server requests where CORS does not apply, then adds CORS headers to the response for the browser.

### Anti-Pattern 2: Scraping HTML in the Browser

**What people do:** Fetch the full HTML page from INSOS in the browser and parse it with DOMParser to extract member data.
**Why it's wrong:** Even if CORS were not an issue, parsing full HTML pages in the browser is fragile, slow, and bandwidth-wasteful. The HTML contains navigation, styling, scripts — the actual data is a small fraction.
**Do this instead:** Parse/transform at the proxy layer. The Worker fetches the upstream response, extracts only the member data, and serves clean JSON to the client. This keeps the client simple and the payload small.

### Anti-Pattern 3: Maintaining a Local Database Copy

**What people do:** Periodically scrape all member data into a local database and serve from there.
**Why it's wrong for this project:** Adds significant infrastructure (database, scraper cron job, hosting). Data staleness becomes a concern. The requirement is "live data from INSOS."
**Do this instead:** Proxy with caching. The CF Worker cache provides a 1-hour buffer that balances freshness with upstream protection. No database needed.

### Anti-Pattern 4: Using Swiss LV95 Coordinates for Leaflet

**What people do:** Try to use Swisstopo tiles with LV95 (EPSG:2056) projection because it's "the Swiss way."
**Why it's wrong:** LV95 adds complexity (custom CRS, coordinate conversion). Member addresses will likely need geocoding anyway, and Nominatim/OpenStreetMap returns WGS84.
**Do this instead:** Use standard WGS84 (EPSG:4326) with OpenStreetMap tiles. Simpler, standard Leaflet setup, no projection gymnastics. The map is for finding locations, not surveying land.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **insos.ch** | HTTP GET via CF Worker proxy | Endpoint TBD. May return HTML or JSON. Must reverse-engineer. Fragile — could break on redesign. |
| **OpenStreetMap tiles** | Direct from client via Leaflet tile URL | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`. Free, no API key. Respect usage policy. |
| **Nominatim geocoding** | One-time build step or proxy-side | Only needed if INSOS data has addresses but no coordinates. Rate limit: 1 req/sec. Use batch geocoding at build time, not runtime. |
| **Cloudflare Workers** | Deploy via Wrangler CLI | Free tier: 100K requests/day. More than enough. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client ↔ Proxy | HTTP GET, JSON response | Client knows only the proxy URL, never the upstream URL. Single endpoint. |
| Map ↔ Filters | JS function calls | filters.js calls map.js.applyFilter(). No events, no pub/sub — direct calls are fine at this scale. |
| Data ↔ Map | JS function calls | data.js returns normalized array, map.js creates markers from it. One-time flow at init. |

## Critical Unknowns (Must Resolve Before Building)

### Unknown 1: The Actual Data Endpoint

**Status:** NOT YET DISCOVERED
**Impact:** Blocks everything. Cannot build proxy or client data layer without knowing what we're proxying.
**Resolution:** Open insos.ch member directory in a real browser, use DevTools Network tab to capture XHR/Fetch requests while interacting with filters. Document URL, method, parameters, response format.
**Confidence in resolution:** HIGH — the directory exists, loads dynamically, and supports filtering. There is an endpoint; it just needs to be found with browser DevTools.

### Unknown 2: Response Format (JSON vs HTML)

**Status:** UNKNOWN until endpoint is discovered
**Impact:** Determines whether the proxy needs a transform step.
**If JSON:** Proxy is trivial pass-through + CORS headers.
**If HTML:** Proxy needs a parsing step (cheerio-like HTML parsing in the Worker) to extract structured data.
**Confidence in resolution:** HIGH — either format is handleable. HTML parsing adds ~50 lines to the Worker.

### Unknown 3: Coordinates in Source Data

**Status:** UNKNOWN until data is examined
**Impact:** Determines whether geocoding is needed.
**If coordinates present:** Direct mapping, no geocoding needed.
**If only addresses:** Need geocoding step. Best done as a batch process in the proxy (cache geocoded results), not on every client request.
**Confidence in resolution:** HIGH — Nominatim or geo.admin.ch can geocode Swiss addresses. Batch geocoding ~1000 addresses is a one-time operation.

## Build Order (Dependencies)

```
Phase 1: Data Discovery (prerequisite for everything)
    │
    ├──▶ Phase 2a: CORS Proxy (needs endpoint URL)
    │         │
    │         └──▶ Phase 3: Client Data Layer (needs proxy URL)
    │                   │
    │                   ├──▶ Phase 4a: Map Rendering (needs data)
    │                   │
    │                   └──▶ Phase 4b: Filter UI (needs category structure from data)
    │                              │
    │                              └──▶ Phase 5: Polish (needs working map + filters)
    │
    └──▶ Phase 2b: Map Scaffold (can start in parallel — static map, no data)
              │
              └──▶ merges into Phase 4a
```

**Key ordering insight:** Data discovery is the single blocking dependency. The proxy and map scaffold can proceed in parallel once the endpoint is known. Filter UI depends on understanding the data shape (what sectors and professions exist, how they're encoded).

## Sources

- [Contao CMS Listing Module documentation](https://docs.contao.org/5.x/manual/en/guides/module-listing/) — HIGH confidence
- [Cloudflare Workers CORS proxy example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) — HIGH confidence
- [Serverless caching proxy with CF Workers](https://www.conroyp.com/articles/serverless-api-caching-cloudflare-workers-json-cors-proxy) — MEDIUM confidence
- [Leaflet.TileLayer.Swiss plugin](https://leaflet-tilelayer-swiss.karavia.ch/) — HIGH confidence (evaluated but not recommended over standard OSM tiles)
- [Leaflet.markercluster plugin](https://github.com/Leaflet/Leaflet.markercluster) — HIGH confidence
- [Reverse engineering web APIs guide](https://blog.apify.com/reverse-engineer-apis/) — MEDIUM confidence
- [Nominatim geocoding](https://nominatim.org/) — HIGH confidence
- [geo.admin.ch Swiss geocoding](https://docs.geo.admin.ch/) — MEDIUM confidence (usage restrictions unclear)
- [Contao Content API bundle](https://github.com/DieSchittigs/contao-content-api-bundle) — LOW confidence (third-party, may not be installed on insos.ch)

---
*Architecture research for: Interactive map application consuming third-party INSOS member data*
*Researched: 2026-02-14*
