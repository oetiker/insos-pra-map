# Phase 1: Data Pipeline - Research

**Researched:** 2026-02-14
**Domain:** Data pipeline — OData API proxy, server-side geocoding, caching
**Confidence:** HIGH

## Summary

The INSOS member data is served by a **PerformX/Quino platform** (ASP.NET) at `performx.artiset.ch`, exposing a full **OData v4 REST API** without authentication. This is a major finding that eliminates the biggest project risk — there is no need to reverse-engineer an undocumented endpoint or scrape HTML. The OData endpoint returns clean JSON with 365 PrA providers, their addresses, PrA profession associations, and sector/branch data. The proxy server must fetch from this OData endpoint, geocode Swiss addresses via the `geo.admin.ch` Search API (free, no auth, returns WGS84 coordinates), cache both the data and geocoding results, and serve a single normalized JSON endpoint to the browser.

The backend architecture is straightforward: an Express.js server that serves the Vite-built static frontend and exposes an `/api/providers` endpoint. In-memory caching (24h TTL) stores the normalized provider data. Persistent disk-based geocode caching (SQLite via `better-sqlite3`) avoids redundant geocoding API calls across server restarts. Seed data shipped in the repo provides immediate functionality on cold start.

**Primary recommendation:** Build an Express.js server with a single `/api/providers` endpoint that fetches from the PerformX OData API, geocodes addresses via geo.admin.ch, caches results in memory (data) and on disk (geocodes), and serves the Vite static build.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Proxy behavior
- Proxy is integrated into the main backend app (same server as the static site)
- In-memory cache with 24-hour TTL — refreshes on server restart
- Single JSON endpoint serves all provider data to the browser
- CORS headers set so the frontend can fetch from the proxy

#### Geocoding approach
- Geocoding happens server-side at the proxy level — browser receives pre-geocoded data
- Use geo.admin.ch (Swisstopo) as the geocoding service — free, high quality for Swiss addresses
- Geocoding results cached persistently on disk (addresses don't move, avoids re-geocoding on restart)
- Fallback for failed geocodes: place pin at city or canton center with approximate location flag

#### Data shape & storage
- Extract all available fields from INSOS data upfront (contact info, professions, etc.) even though Phase 1 only logs a count — avoids rework in future phases
- Normalize raw INSOS data into a clean, consistent schema — browser receives clean JSON
- Single endpoint returns all providers as a JSON array (fits client-side filtering decision from PROJECT.md)

#### Resilience & staleness
- Ship with seed data: include a snapshot of provider data in the repo as fallback for cold start / first deploy
- Re-geocode only new or changed addresses (persistent geocode cache handles this)

### Claude's Discretion
- Degradation strategy when INSOS is unreachable (serve stale vs error)
- Monitoring approach (logs, health endpoint, or both)
- User-Agent header and rate-limiting politeness toward INSOS
- Exact normalized schema field names and structure
- Technology choice for persistent geocode cache (SQLite, JSON file, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.x (4.21+) | HTTP server, static file serving, API routing | Most mature Node.js web framework. Serves Vite build as static files + API endpoint on same server. No framework overhead for this simple use case. |
| better-sqlite3 | 12.x | Persistent geocode cache | Fastest, simplest SQLite library for Node.js. Synchronous API (perfect for cache lookups). Zero-config, single file on disk. Production-proven. |
| node-fetch or native fetch | built-in | HTTP client for OData API and geo.admin.ch | Node.js 18+ has native `fetch()`. No additional library needed for HTTP requests to upstream APIs. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | 2.x | CORS middleware for Express | Sets Access-Control-Allow-Origin headers on the API endpoint so the Vite dev server (different port) can fetch. |
| dotenv | 16.x | Environment configuration | Load PORT, cache TTL, upstream URLs from `.env` file. Keeps config out of code. |
| morgan | 1.x | HTTP request logging | Lightweight request logger for monitoring API hits and errors. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | JSON file on disk | Simpler but no concurrent safety, slower for lookups with 1000+ entries, no atomic writes. JSON file is acceptable for <100 entries but SQLite scales better and handles crashes gracefully. |
| better-sqlite3 | Node.js built-in `node:sqlite` | Experimental (stability 1.1 as of Node 22+). API is stabilizing but not production-recommended yet. `better-sqlite3` is battle-tested. |
| Express 4.x | Fastify | Faster but adds complexity for a server with 2 routes. Express is simpler, more familiar, has more middleware. |
| Express 4.x | Plain Node.js `http` module | No routing, no middleware, no static file serving built-in. Reinventing the wheel. |

**Installation:**
```bash
npm install express better-sqlite3 cors dotenv morgan
```

## Architecture Patterns

### Recommended Project Structure
```
insos-map/
├── server/
│   ├── index.js              # Express app entry point
│   ├── providers.js           # /api/providers route handler
│   ├── odata-client.js        # Fetch from PerformX OData API
│   ├── geocoder.js            # geo.admin.ch geocoding with cache
│   ├── geocode-cache.js       # SQLite persistent cache layer
│   ├── normalizer.js          # Transform OData response to app schema
│   └── seed-data.json         # Fallback provider data snapshot
├── src/
│   ├── index.html             # Vite entry point
│   ├── main.js                # Frontend entry (Phase 1: console.log count)
│   └── style.css              # Styles (Phase 1: minimal)
├── data/
│   └── geocode-cache.sqlite   # Persistent geocode cache (gitignored)
├── package.json
├── vite.config.js
└── .env                       # PORT, CACHE_TTL, etc.
```

### Pattern 1: OData Client with In-Memory Cache

**What:** Fetch all PrA provider data from the PerformX OData API, cache in a JavaScript variable with TTL-based expiry.

**When to use:** On every `/api/providers` request — serve from cache if fresh, else fetch upstream.

**Key insight:** The OData API at `performx.artiset.ch` is unauthenticated and returns clean JSON. It supports `$select`, `$filter`, `$expand`, `$count`, and `$top` OData query parameters.

**Example:**
```javascript
// server/odata-client.js
const ODATA_BASE = 'https://performx.artiset.ch/odata';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let cache = { data: null, timestamp: 0 };

export async function fetchProviders() {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  // Fetch companies with PrA offerings, expand PrA relations
  const url = `${ODATA_BASE}/Adresse?` + new URLSearchParams({
    '$filter': 'AdressTypValue eq 0 and AnzahlAdressePraktischeAusbildungList gt 0',
    '$select': 'Id,Firma,AktuelleStrasseUndNummer,AktuellerOrtUndPLZ,AktuelleAdresse',
    '$expand': 'AdressePraktischeAusbildungList',
    '$format': 'json'
  });

  const response = await fetch(url, {
    headers: { 'User-Agent': 'INSOS-PrA-Map/1.0 (+https://github.com/oetiker/insos-map)' }
  });

  if (!response.ok) throw new Error(`OData API returned ${response.status}`);

  const json = await response.json();
  cache = { data: json.value, timestamp: Date.now() };
  return json.value;
}
```

### Pattern 2: Persistent Geocode Cache with SQLite

**What:** Store geocoded address-to-coordinate mappings in a SQLite database file. Survives server restarts.

**When to use:** Before geocoding an address, check if it already exists in the cache. Addresses rarely change, so cached results are effectively permanent.

**Example:**
```javascript
// server/geocode-cache.js
import Database from 'better-sqlite3';

const db = new Database('./data/geocode-cache.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS geocodes (
    address TEXT PRIMARY KEY,
    lat REAL,
    lon REAL,
    approximate INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const getStmt = db.prepare('SELECT lat, lon, approximate FROM geocodes WHERE address = ?');
const setStmt = db.prepare('INSERT OR REPLACE INTO geocodes (address, lat, lon, approximate) VALUES (?, ?, ?, ?)');

export function getCachedGeocode(address) {
  return getStmt.get(address) || null;
}

export function setCachedGeocode(address, lat, lon, approximate = false) {
  setStmt.run(address, lat, lon, approximate ? 1 : 0);
}
```

### Pattern 3: geo.admin.ch Geocoding with Rate Limiting

**What:** Geocode Swiss addresses using the free Swisstopo Search API, with built-in rate limiting and fallback.

**When to use:** For addresses not found in the persistent cache. Happens primarily on first run or when new providers appear.

**Verified API endpoint:** `https://api3.geo.admin.ch/rest/services/api/SearchServer`

**Example:**
```javascript
// server/geocoder.js
import { getCachedGeocode, setCachedGeocode } from './geocode-cache.js';

const GEO_API = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

// Rate limit: process sequentially with delay
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function geocodeAddress(street, plzOrt) {
  const address = `${street}, ${plzOrt}`;

  // Check cache first
  const cached = getCachedGeocode(address);
  if (cached) return cached;

  // Call geo.admin.ch
  const url = `${GEO_API}?` + new URLSearchParams({
    searchText: `${street} ${plzOrt}`,
    type: 'locations',
    origins: 'address',
    sr: '4326',
    limit: '1'
  });

  const res = await fetch(url);
  const data = await res.json();

  if (data.results && data.results.length > 0) {
    const { lat, lon } = data.results[0].attrs;
    setCachedGeocode(address, lat, lon, false);
    return { lat, lon, approximate: false };
  }

  // Fallback: try PLZ/Ort only (city center)
  const fallbackUrl = `${GEO_API}?` + new URLSearchParams({
    searchText: plzOrt,
    type: 'locations',
    origins: 'zipcode',
    sr: '4326',
    limit: '1'
  });

  const fallbackRes = await fetch(fallbackUrl);
  const fallbackData = await fallbackRes.json();

  if (fallbackData.results && fallbackData.results.length > 0) {
    const { lat, lon } = fallbackData.results[0].attrs;
    setCachedGeocode(address, lat, lon, true); // approximate
    return { lat, lon, approximate: true };
  }

  return null; // geocoding failed entirely
}

export async function geocodeAll(providers) {
  for (const provider of providers) {
    if (!provider.lat || !provider.lon) {
      const result = await geocodeAddress(provider.street, provider.plzOrt);
      if (result) {
        provider.lat = result.lat;
        provider.lon = result.lon;
        provider.approximate = result.approximate;
      }
      await sleep(100); // Politeness: 10 req/sec max
    }
  }
  return providers;
}
```

### Pattern 4: Express Server with Static + API

**What:** Single Express server serves Vite build output as static files AND the `/api/providers` JSON endpoint.

**Example:**
```javascript
// server/index.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getProviders } from './providers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('combined'));
app.use(cors());

// API route — defined BEFORE static files
app.get('/api/providers', async (req, res) => {
  try {
    const providers = await getProviders();
    res.json(providers);
  } catch (err) {
    console.error('Provider fetch error:', err);
    res.status(503).json({ error: 'Data temporarily unavailable' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Vite build output
app.use(express.static(join(__dirname, '../dist')));

// SPA fallback — all other routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

### Anti-Patterns to Avoid

- **Fetching from OData on every browser request:** Use the in-memory cache. OData responses should be fetched at most once every 24 hours.
- **Geocoding at request time:** Geocode on server startup (or background refresh), not inline with user requests. Geocoding 365 addresses takes ~40 seconds at 10 req/sec.
- **Storing geocode cache in a JSON file without locking:** Concurrent writes can corrupt the file. Use SQLite which handles this.
- **Exposing the PerformX OData URL to the browser:** Keep upstream URLs server-side only. The browser knows only `/api/providers`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent key-value cache | Custom JSON file read/write with locking | `better-sqlite3` | Atomic writes, crash recovery, concurrent access safety, fast lookups |
| HTTP server + static files + routing | Raw `http.createServer()` | Express.js | Middleware, routing, static file serving, error handling — all solved |
| Swiss address geocoding | Manual coordinate lookups or Nominatim | geo.admin.ch Search API | Free, no auth, highest quality for Swiss addresses, official government data |
| OData query building | String concatenation | `URLSearchParams` | Proper encoding of special characters in filter expressions |
| Rate limiting outbound requests | Manual timers | Sequential loop with `sleep()` | Simple and sufficient for batch geocoding of ~365 addresses |

**Key insight:** The PerformX platform already serves structured OData. There is no HTML scraping, no data transformation gymnastics, and no authentication dance. The proxy is primarily a caching + geocoding + CORS layer.

## Common Pitfalls

### Pitfall 1: OData API Not Being Stable Long-Term
**What goes wrong:** The PerformX platform at `performx.artiset.ch` could change its OData schema, restrict public access, or migrate to a different platform. The API is unauthenticated and undocumented — there is no contract guaranteeing stability.
**Why it happens:** This is a third-party platform (ARTISET federation's CRM) not designed for external consumers.
**How to avoid:**
- Isolate all OData-specific logic in `odata-client.js` (adapter pattern)
- Ship seed data so the app works even if the API goes down
- Implement health checks that validate response structure
- Log when response format changes
**Warning signs:** HTTP 401/403 responses, changed field names, empty result sets, new authentication requirements.

### Pitfall 2: Geocoding Rate Limiting Causes Startup Delay
**What goes wrong:** On first startup without a geocode cache, geocoding 365 addresses at the geo.admin.ch API takes ~40 seconds. If the server blocks on this, the first request hangs.
**Why it happens:** No persistent cache exists on first deploy.
**How to avoid:**
- Ship seed data with pre-geocoded coordinates (already in the seed JSON)
- Run geocoding as a background process after server starts
- Serve stale/seed data immediately, update in background
- Use the persistent SQLite cache so restarts do not re-geocode
**Warning signs:** Server startup takes >5 seconds, first request times out.

### Pitfall 3: OData $expand Failing for Certain Relations
**What goes wrong:** Not all OData `$expand` queries work on the PerformX API. Expanding `Kommunikationsmittel` (communication/contact info) returns HTTP 400 errors.
**Why it happens:** The public OData exposure may restrict certain relations or nested expansions for security/performance reasons.
**How to avoid:**
- Test each `$expand` combination before relying on it
- Use multiple queries if needed (one for addresses, one for PrA mappings)
- Fetch PrA reference data separately from `odata/PraktischeAusbildung`
- Work around missing expansions by joining data in the normalizer
**Warning signs:** HTTP 400 errors with "An error occurred" messages.

### Pitfall 4: Vite Dev Server Proxy vs Production Server Confusion
**What goes wrong:** During development, Vite dev server runs on port 5173 and the Express API on port 3000. CORS blocks cross-port requests unless handled. In production, both are on the same port.
**Why it happens:** Different architectures for dev vs prod.
**How to avoid:**
- In dev: configure `vite.config.js` with `server.proxy` to forward `/api` to Express
- In prod: Express serves both static files and API on same port
- Use the `cors` middleware on Express for dev flexibility
**Warning signs:** "CORS policy" errors in browser console during development.

### Pitfall 5: PrA Profession Data Requires a Separate Lookup
**What goes wrong:** The `AdressePraktischeAusbildungList` relation on an address only contains `PraktischeAusbildungId` (a GUID), not the profession name. You need to join with the `PraktischeAusbildung` reference table.
**Why it happens:** OData returns foreign keys, not joined names, when nested `$expand` fails.
**How to avoid:**
- Fetch `odata/PraktischeAusbildung?$select=Id,Bezeichnung` once (100 records)
- Build a lookup map: `{ id -> name }`
- Join in the normalizer when building the provider response
**Warning signs:** Provider records show GUIDs instead of profession names.

## Code Examples

### Verified OData API Queries

Source: Direct API testing against `performx.artiset.ch` (verified 2026-02-14)

**Count PrA providers:**
```
GET https://performx.artiset.ch/odata/Adresse?$count=true&$top=0&$filter=AdressTypValue eq 0 and AnzahlAdressePraktischeAusbildungList gt 0
→ @odata.count: 365
```

**Fetch providers with addresses and PrA relations:**
```
GET https://performx.artiset.ch/odata/Adresse?$filter=AdressTypValue eq 0 and AnzahlAdressePraktischeAusbildungList gt 0&$select=Id,Firma,AktuelleStrasseUndNummer,AktuellerOrtUndPLZ,AktuelleAdresse,AnzahlAdressePraktischeAusbildungList&$expand=AdressePraktischeAusbildungList&$format=json
```

**Response shape (per provider):**
```json
{
  "Id": "356071fb-1390-4b39-a3db-4d64da2b9b6e",
  "Firma": "ABA Amriswil",
  "AktuelleAdresse": "ABA Amriswil\r\nArbonerstrasse 17\r\n8580 Amriswil",
  "AktuelleStrasseUndNummer": "Arbonerstrasse 17",
  "AktuellerOrtUndPLZ": "8580 Amriswil",
  "AnzahlAdressePraktischeAusbildungList": 8,
  "AdressePraktischeAusbildungList": [
    {
      "Id": "422c5acc-...",
      "PraktischeAusbildungId": "735f3424-...",
      "AdresseId": "356071fb-..."
    }
  ]
}
```

**Fetch PrA profession reference data (100 entries):**
```
GET https://performx.artiset.ch/odata/PraktischeAusbildung?$select=Id,Bezeichnung&$format=json
```

**Response shape:**
```json
{ "Id": "f0d382d4-...", "Bezeichnung": "PrA Logistik" }
```

**Fetch Branche (sector) reference data (31 entries):**
```
GET https://performx.artiset.ch/odata/Branche?$select=Id,Bezeichnung&$format=json
```

### Verified geo.admin.ch Geocoding

Source: Direct API testing (verified 2026-02-14)

**Geocode a Swiss address to WGS84:**
```
GET https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=Arbonerstrasse+17+8580+Amriswil&type=locations&origins=address&sr=4326&limit=1
```

**Response:**
```json
{
  "results": [{
    "attrs": {
      "lat": 47.54490661621094,
      "lon": 9.30195426940918,
      "label": "Arbonerstrasse 17 <b>8580 Amriswil</b>",
      "origin": "address",
      "rank": 7
    },
    "weight": 100
  }]
}
```

**Key parameters:**
- `sr=4326` — return WGS84 coordinates (not Swiss LV95)
- `origins=address` — search building addresses specifically
- `origins=zipcode` — fallback to PLZ/Ort center for failed geocodes
- `weight=100` — exact match indicator
- `limit=1` — return only best match

### Recommended Normalized Schema

```javascript
// Output of /api/providers endpoint
[
  {
    "id": "356071fb-1390-4b39-a3db-4d64da2b9b6e",
    "name": "ABA Amriswil",
    "street": "Arbonerstrasse 17",
    "plzOrt": "8580 Amriswil",
    "fullAddress": "ABA Amriswil\nArbonerstrasse 17\n8580 Amriswil",
    "lat": 47.5449,
    "lon": 9.3020,
    "approximate": false,
    "praOfferings": [
      { "id": "735f3424-...", "name": "PrA Industrie" },
      { "id": "f0d382d4-...", "name": "PrA Logistik" }
    ],
    "praCount": 8,
    "insosUrl": "https://performx.artiset.ch/public/Adresse/MitgliederWidgetInsos"
  }
]
```

**Schema notes:**
- `name` — `Firma` field from OData
- `street` — `AktuelleStrasseUndNummer`
- `plzOrt` — `AktuellerOrtUndPLZ` (format: "PLZ Ort", e.g., "8580 Amriswil")
- `fullAddress` — `AktuelleAdresse` with `\r\n` normalized to `\n`
- `lat`/`lon` — WGS84 from geo.admin.ch geocoding
- `approximate` — true if geocoded to city center (street-level geocoding failed)
- `praOfferings` — joined from `AdressePraktischeAusbildungList` + `PraktischeAusbildung` lookup
- `insosUrl` — link back to the INSOS member widget (generic for now, provider-specific deep link TBD)

### Vite Dev Server Proxy Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloudflare Worker as CORS proxy | Express server integrated with static site | User decision (CONTEXT.md) | Simpler deployment, single process, no Cloudflare account needed |
| HTML scraping from Contao CMS | OData v4 API from PerformX platform | Discovered 2026-02-14 | Eliminates all scraping complexity — clean JSON data available directly |
| Nominatim for geocoding | geo.admin.ch (Swisstopo) Search API | User decision (CONTEXT.md) | Higher quality for Swiss addresses, official government data source |
| JSON file for geocode cache | SQLite via better-sqlite3 | Recommendation | Crash-safe, concurrent access, faster lookups at scale |

**Key discovery:** The INSOS member directory is NOT served by Contao CMS. It is an iframe embedding from `performx.artiset.ch/public/Adresse/MitgliederWidgetInsos`, which is a PerformX/Quino platform (ASP.NET with OData). This platform has a publicly accessible OData v4 endpoint at `performx.artiset.ch/odata/` that returns structured JSON without authentication.

## Discretion Recommendations

### Degradation Strategy (when INSOS/PerformX is unreachable)
**Recommendation:** Serve stale data with a staleness indicator.
- On API failure, serve the last successfully fetched data from memory
- If no in-memory data (fresh server start + API down), serve seed data from disk
- Add a `dataAge` field to the response: `{ providers: [...], fetchedAt: "ISO date", stale: true/false }`
- Never return an error to the browser if any data is available (even old)
- Log upstream failures for monitoring

### Monitoring Approach
**Recommendation:** Structured console logs + health endpoint.
- `/api/health` returns: `{ status, providerCount, dataAge, cacheHitRate, lastFetchError }`
- Use `morgan` for request logging
- Log upstream fetch failures with error details
- No external monitoring service needed for v1 — health endpoint is sufficient for manual checks and future integration

### User-Agent and Rate Limiting
**Recommendation:** Polite bot identification + conservative rate limits.
- User-Agent: `INSOS-PrA-Map/1.0 (+https://github.com/oetiker/insos-map)`
- OData: max 1 request per 24 hours (cache TTL)
- geo.admin.ch: max 10 requests/sec (100ms delay between calls)
- On startup geocoding, process sequentially to avoid burst

### Persistent Geocode Cache Technology
**Recommendation:** SQLite via `better-sqlite3`.
- Single file: `data/geocode-cache.sqlite`
- WAL mode for concurrent read performance
- ~365 rows * ~100 bytes = <50KB database
- Schema: `(address TEXT PRIMARY KEY, lat REAL, lon REAL, approximate INTEGER, created_at TEXT)`
- Survives server restarts, crash-safe
- `.gitignore` the cache file (it is regenerated from geo.admin.ch)

## Open Questions

1. **Contact information access (phone, email, website)**
   - What we know: The OData metadata shows `Kommunikationsmittel` (communication means) as a relation on `Adresse`, with fields `KommunikationstypValue` (integer type) and `Wert` (value). The widget detail layout references `AktuelleWebsite` as a relation.
   - What's unclear: Direct `$expand=Kommunikationsmittel` returns HTTP 400. The public API may restrict this relation. Need to find alternative: possibly `AktuelleWebsite` or individual Kommunikationsmittel queries.
   - Recommendation: Try fetching Kommunikationsmittel via separate OData query: `odata/Kommunikationsmittel?$filter=AdresseId eq {guid}`. If that fails too, extract what is available from the `AktuelleAdresse` formatted text field. This is a Phase 1 implementation detail — the normalized schema should include `website`, `phone`, `email` fields even if initially null, to be populated when access is figured out.

2. **Provider-specific INSOS page deep link**
   - What we know: The widget uses a master-detail pattern where clicking a provider shows inline details via `MitgliederWidgetMasterDetail` layout.
   - What's unclear: There may not be a stable, direct URL to a specific provider's page on the INSOS site.
   - Recommendation: For now, link to the general member directory: `https://insos.ch/de/ueber-uns#unsere-mitglieder-268211`. Investigate provider-specific deep links during implementation.

3. **Branche (sector) association per provider**
   - What we know: The OData endpoint has `Branche` reference data (31 sectors) and `AdresseBrancheZuweisung` (sector assignments per address). The widget layout includes a "Produkte / Dienstleistungen" quick filter using `AdresseBrancheZuweisungen`.
   - What's unclear: Whether `$expand=AdresseBrancheZuweisungen` works on the Adresse query or if it requires separate fetching.
   - Recommendation: Test during implementation. If expansion fails, fetch sector assignments separately. This data is important for Phase 4 (filtering) but should be captured in Phase 1's schema.

## Sources

### Primary (HIGH confidence)
- PerformX OData API at `performx.artiset.ch/odata/` — verified working, unauthenticated, returns structured JSON (tested 2026-02-14)
- PerformX public metadata at `performx.artiset.ch/api/v1/public/metadata` — full data model with classes, properties, layouts (tested 2026-02-14)
- geo.admin.ch Search API at `api3.geo.admin.ch/rest/services/api/SearchServer` — verified geocoding with WGS84 output (tested 2026-02-14)
- [geo.admin.ch Search API documentation](https://sys-docs.int.bgdi.ch/access-data/search.html) — endpoint parameters, origins, spatial reference options
- [Express.js static file serving](https://expressjs.com/en/starter/static-files.html) — `express.static()` documentation
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) — v12.x, synchronous API, production-ready

### Secondary (MEDIUM confidence)
- [Vite backend integration guide](https://vite.dev/guide/backend-integration) — dev server proxy configuration
- [vite-express library](https://github.com/szymmis/vite-express) — Express + Vite integration pattern (reference only — manual setup preferred for simplicity)
- [Node.js built-in SQLite](https://nodejs.org/api/sqlite.html) — experimental, stability 1.1, not production-recommended yet
- INSOS member directory iframe: `performx.artiset.ch/public/Adresse/MitgliederWidgetInsos` — discovered via HTML inspection of `insos.ch/de/ueber-uns`

### Tertiary (LOW confidence)
- OData API long-term stability — no documentation or SLA from ARTISET/PerformX, could change without notice
- geo.admin.ch rate limits — no explicit documentation found, 10 req/sec assumed as conservative limit
- Contact info (phone/email) access — `Kommunikationsmittel` expand fails, alternative access method needs testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Express, better-sqlite3, native fetch are all well-documented, stable technologies
- Architecture: HIGH — OData data source is verified, geocoding API tested, caching patterns are standard
- Pitfalls: HIGH — tested API limitations (e.g., expand failures), identified startup delay risk, documented workarounds
- Data source: MEDIUM — OData API works today but has no stability guarantee; adapter pattern mitigates

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days — recheck OData API availability)
