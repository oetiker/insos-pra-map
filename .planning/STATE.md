# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** A person looking for a PrA training spot can quickly find which INSOS members near them offer the profession they're interested in.
**Current focus:** Phase 1 complete — ready for Phase 2

## Current Position

Phase: 1 of 5 (Data Pipeline) -- COMPLETE
Plan: 2 of 2 in current phase
Status: Phase Complete
Last activity: 2026-02-15 -- Completed quick task 1: Refactor to static site with baked-in data and GitHub Actions weekly rebuild

Progress: [##........] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4min
- Total execution time: 0.20 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-pipeline | 2/2 | 9min | 5min |
| quick | 1/1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min), 01-02 (6min), quick-1 (3min)
- Trend: Consistent

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **Static site architecture** — no runtime server; data baked into frontend at build time, rebuilt weekly via GitHub Actions
- OpenStreetMap tiles via SOSM (not Google Maps or Mapbox)
- Vanilla JS + Vite + Leaflet + Tailwind stack
- Client-side filtering (all data loaded once from static JSON, filtered in-memory)
- Vite root set to src/ with build output to dist/, base: '/insos-map/' for GitHub Pages
- Build-time OData fetch from performx.artiset.ch with seed data fallback
- geo.admin.ch geocoder with SQLite cache (persists across rebuilds)
- GitHub Actions cron (weekly Monday 6am UTC) + manual trigger for rebuild and deploy

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Refactor to static site with baked-in data and GitHub Actions weekly rebuild | 2026-02-14 | 2742078 | [1-refactor-to-static-site-with-baked-in-da](./quick/1-refactor-to-static-site-with-baked-in-da/) |

### Blockers/Concerns

- ~~INSOS data endpoint is undocumented and must be reverse-engineered~~ RESOLVED: OData API at performx.artiset.ch works without auth
- ~~Unknown whether INSOS data includes coordinates or only addresses~~ RESOLVED: No coordinates in data, geocoding needed (Plan 02) -- DONE: all 365 providers geocoded
- No API contract means INSOS site changes could break the data pipeline without warning

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed quick-1: static site refactor with baked-in data
Resume file: None
