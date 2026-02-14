---
phase: 01-data-pipeline
plan: 01
subsystem: api
tags: [express, vite, tailwind, odata, fetch, cache]

# Dependency graph
requires:
  - phase: none
    provides: first plan - no dependencies
provides:
  - Vite + Express + Tailwind project scaffold
  - OData client fetching 365 PrA providers from performx.artiset.ch
  - PrA profession lookup (102 professions)
  - In-memory cache with 24h TTL and stale-on-error fallback
  - Data normalizer joining providers with profession names
  - Express health endpoint at /api/health
affects: [01-02, 02-interactive-map]

# Tech tracking
tech-stack:
  added: [express@5.2.1, better-sqlite3@12.6.2, cors@2.8.6, dotenv@17.3.1, morgan@1.10.1, vite@7.3.1, tailwindcss@4.1.18, leaflet@1.9.4]
  patterns: [ES modules throughout, in-memory cache with TTL, stale-on-error fallback, OData query via URLSearchParams]

key-files:
  created: [package.json, vite.config.js, .gitignore, src/index.html, src/main.js, src/style.css, server/index.js, server/odata-client.js, server/normalizer.js]
  modified: []

key-decisions:
  - "Express 5.x used (latest stable) instead of 4.x from research"
  - "Vite root set to src/ with build output to dist/ for clean separation"
  - "SPA fallback uses middleware pattern (Express 5 compatible) instead of app.get('*')"

patterns-established:
  - "OData client pattern: URLSearchParams for query building, stale-on-error, configurable TTL"
  - "Normalizer pattern: raw OData input + lookup table -> clean app schema with joined profession names"
  - "Server entry pattern: dotenv/config at top, morgan+cors middleware, API routes before static/SPA fallback"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 1 Plan 01: Project Scaffold + OData Client Summary

**Vite + Express scaffold with OData client fetching 365 PrA providers from PerformX API and normalizer joining 102 profession names**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T23:08:57Z
- **Completed:** 2026-02-14T23:12:26Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Project scaffold with Vite 7, Express 5, Tailwind CSS 4, and Leaflet ready for development
- OData client fetches 365 PrA providers from performx.artiset.ch with in-memory cache (24h TTL)
- PrA profession lookup fetches 102 professions for name resolution
- Normalizer transforms raw OData into clean app schema with praOfferings containing profession names
- Stale-on-error fallback ensures data availability when upstream is unreachable

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project with Vite + Express + Tailwind scaffold** - `8bc6ee2` (feat)
2. **Task 2: Implement OData client and data normalizer** - `3f597b9` (feat)

## Files Created/Modified
- `package.json` - Project config with ES modules, all dependencies, dev/build/start scripts
- `vite.config.js` - Vite config with Tailwind plugin, src/ root, /api proxy to Express
- `.gitignore` - Excludes node_modules, dist, data, .env
- `src/index.html` - Minimal Vite entry HTML with German lang attribute
- `src/main.js` - Frontend placeholder (console.log only for now)
- `src/style.css` - Tailwind CSS import
- `server/index.js` - Express server with health endpoint, static serving, SPA fallback
- `server/odata-client.js` - OData API client with in-memory cache and stale-on-error
- `server/normalizer.js` - Raw OData to app schema transformer with PrA profession name joining

## Decisions Made
- Used Express 5.x (latest stable installed by npm) instead of 4.x mentioned in research -- adapts SPA fallback to use middleware pattern instead of `app.get('*')` which behaves differently in Express 5
- Set Vite root to `src/` directory for clean separation of frontend source from server code
- `.env` file created but gitignored -- contains ODATA_BASE, GEO_API, CACHE_TTL, PORT

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Express 5 SPA fallback compatibility**
- **Found during:** Task 1 (Express server creation)
- **Issue:** Express 5.x was installed (latest). Plan assumed Express 4.x where `app.get('*', ...)` catches all non-matched routes. In Express 5, wildcard route matching changed.
- **Fix:** Used middleware function checking `req.method === 'GET'` and `!req.path.startsWith('/api')` instead of `app.get('*', ...)` for SPA fallback.
- **Files modified:** server/index.js
- **Verification:** Server starts and serves health endpoint correctly
- **Committed in:** 8bc6ee2 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary adaptation for Express 5 compatibility. No scope creep.

## Issues Encountered
None -- OData API returned expected data, all dependencies installed cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OData client and normalizer ready for Plan 02 to wire into geocoding and `/api/providers` endpoint
- Plan 02 will add: geocoder (geo.admin.ch), SQLite geocode cache, `/api/providers` route, seed data, frontend fetch

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (8bc6ee2, 3f597b9) verified in git log.

---
*Phase: 01-data-pipeline*
*Completed: 2026-02-14*
