# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** A person looking for a PrA training spot can quickly find which INSOS members near them offer the profession they're interested in.
**Current focus:** Phase 1 complete — ready for Phase 2

## Current Position

Phase: 1 of 5 (Data Pipeline) -- COMPLETE
Plan: 2 of 2 in current phase
Status: Phase Complete
Last activity: 2026-02-15 -- Phase 1 verified and complete

Progress: [##........] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5min
- Total execution time: 0.15 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-pipeline | 2/2 | 9min | 5min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min), 01-02 (6min)
- Trend: Starting

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Self-hosted CORS proxy (not Cloudflare Workers)
- OpenStreetMap tiles via SOSM (not Google Maps or Mapbox)
- Vanilla JS + Vite + Leaflet + Tailwind stack
- Client-side filtering (all data loaded once, filtered in-memory)
- Express 5.x used (latest stable) -- SPA fallback adapted to middleware pattern
- Vite root set to src/ with build output to dist/
- OData client uses stale-on-error pattern for resilience
- geo.admin.ch geocoder with fallback to general location search when zipcode origin fails
- Seed data committed to repo (365 providers) for instant cold starts
- Three-layer caching: OData in-memory, SQLite geocode, in-memory result cache

### Pending Todos

None yet.

### Blockers/Concerns

- ~~INSOS data endpoint is undocumented and must be reverse-engineered~~ RESOLVED: OData API at performx.artiset.ch works without auth
- ~~Unknown whether INSOS data includes coordinates or only addresses~~ RESOLVED: No coordinates in data, geocoding needed (Plan 02) -- DONE: all 365 providers geocoded
- No API contract means INSOS site changes could break the data pipeline without warning

## Session Continuity

Last session: 2026-02-15
Stopped at: Phase 1 verified and complete — ready for Phase 2 planning
Resume file: None
