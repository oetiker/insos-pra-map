---
phase: 01-data-pipeline
plan: 02
subsystem: api
tags: [geocoding, sqlite, geo.admin.ch, express, pipeline, seed-data]

# Dependency graph
requires:
  - phase: 01-01
    provides: OData client, normalizer, Express server scaffold
provides:
  - SQLite persistent geocode cache (address -> WGS84 coordinates)
  - geo.admin.ch geocoder with PLZ/Ort fallback
  - Complete data pipeline (OData -> normalize -> geocode -> JSON endpoint)
  - /api/providers endpoint returning 365 geocoded providers
  - Seed data snapshot for cold start fallback
  - Frontend displaying provider count in console and DOM
affects: [02-interactive-map, 03-search-filter]

# Tech tracking
tech-stack:
  added: [better-sqlite3 (geocode cache)]
  patterns: [persistent SQLite cache for geocodes, pipeline composition (fetch->normalize->geocode), seed data fallback, stale-on-error with in-memory result cache]

key-files:
  created: [server/geocode-cache.js, server/geocoder.js, server/providers.js, server/seed-data.json]
  modified: [server/index.js, src/main.js]

key-decisions:
  - "geo.admin.ch geocoder with fallback to general location search when zipcode origin fails"
  - "Seed data committed to repo (365 providers with coordinates) for instant cold starts"
  - "In-memory result cache separate from OData cache and geocode cache (three-layer caching)"

patterns-established:
  - "Geocode cache pattern: SQLite WAL mode, prepared statements, address as primary key"
  - "Pipeline pattern: getProviders() orchestrates fetch->normalize->geocode with graceful degradation"
  - "Fallback chain: live data -> stale cache -> seed data (never throws to caller)"

# Metrics
duration: 6min
completed: 2026-02-14
---

# Phase 1 Plan 02: Geocoding + Pipeline + Seed Data Summary

**geo.admin.ch geocoding with SQLite cache, full data pipeline serving 365 providers at /api/providers, and seed data fallback for offline operation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-14T23:15:14Z
- **Completed:** 2026-02-14T23:21:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SQLite geocode cache persists 365 address-to-coordinate mappings across server restarts (0 API calls on restart)
- geo.admin.ch geocoding with street-level precision for 363 providers and city-center fallback for 2 non-geocodable addresses (Postfach, Waldhof)
- Complete data pipeline: OData API -> normalize -> geocode -> /api/providers JSON endpoint
- Seed data snapshot (365 providers with full coordinates) enables instant operation when upstream is unreachable
- Frontend fetches and displays provider count in browser console and DOM

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement geocode cache and geocoder** - `ba32e3c` (feat)
2. **Task 2: Wire provider endpoint, generate seed data, and connect frontend** - `c7eca56` (feat)

## Files Created/Modified
- `server/geocode-cache.js` - SQLite persistent cache with WAL mode, prepared get/set statements
- `server/geocoder.js` - geo.admin.ch geocoding with cache-first strategy, PLZ/Ort fallback, 100ms rate limiting
- `server/providers.js` - Pipeline orchestrator: fetch -> normalize -> geocode with stale/seed fallback
- `server/seed-data.json` - 365-provider snapshot with full geocoded coordinates
- `server/index.js` - Added /api/providers route, updated health endpoint with provider count
- `src/main.js` - Fetches /api/providers, logs count, displays status in DOM

## Decisions Made
- geo.admin.ch fallback strategy: try `origins=zipcode` first, then general location search without origins filter -- ensures all PLZ codes resolve even when zipcode origin returns no results
- Three-layer caching: OData in-memory cache (24h TTL), SQLite geocode cache (persistent), in-memory result cache (24h TTL) -- each layer serves a different concern
- Seed data committed to repo with full coordinates -- cold start serves instantly without any API calls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed geocoder PLZ/Ort fallback for non-zipcode origins**
- **Found during:** Task 2 (pipeline testing)
- **Issue:** 2 providers ("Postfach, 6031 Ebikon" and "Waldhof (Steig), 8465 Wildensbuch") returned null coordinates because the `origins=zipcode` filter returned empty results for their PLZ codes on geo.admin.ch
- **Fix:** Added a second fallback attempt without the `origins` filter, which successfully finds the municipality center via `origin=gg25`
- **Files modified:** server/geocoder.js
- **Verification:** All 365 providers now have non-null lat/lon (363 street-level, 2 approximate)
- **Committed in:** c7eca56 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix to achieve 100% geocode coverage. No scope creep.

## Issues Encountered
None -- OData API, geo.admin.ch, and all dependencies worked as expected.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 data pipeline is fully operational end-to-end
- /api/providers endpoint ready for Phase 2 (interactive map rendering with Leaflet)
- All providers have WGS84 coordinates suitable for Leaflet markers
- praOfferings data ready for Phase 3 (search and filter by profession)

## Self-Check: PASSED

All 6 files verified on disk. Both task commits (ba32e3c, c7eca56) verified in git log.

---
*Phase: 01-data-pipeline*
*Completed: 2026-02-14*
