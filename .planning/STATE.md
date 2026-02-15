# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** A person looking for a PrA training spot can quickly find which INSOS members near them offer the profession they're interested in.
**Current focus:** Phase 4 complete — hierarchical sector/profession filtering

## Current Position

Phase: 4 of 5 (Filtering) -- COMPLETE
Plan: 1 of 1 in current phase
Status: Phase Complete
Last activity: 2026-02-15 -- Completed 04-01: Hierarchical sector/profession filter

Progress: [########..] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3min
- Total execution time: 0.32 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-pipeline | 2/2 | 9min | 5min |
| 02-interactive-map | 1/1 | 2min | 2min |
| 03-provider-details | 1/1 | 2min | 2min |
| 04-filtering | 1/1 | 3min | 3min |
| quick | 1/1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: quick-1 (3min), 02-01 (2min), 03-01 (2min), 04-01 (3min)
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
- maxClusterRadius 50 for tighter clustering with 365 Swiss providers
- ~~Minimal popup (provider name only) in Phase 2 -- full details deferred to Phase 3~~ DONE: rich popup with contact card
- SOSM Swiss-style tiles as primary tile layer (fallback can be added in Phase 5)
- Kommunikationsmittel fetched in batches of 20 IDs via or-chain OData filter (no $expand, no in operator)
- INSOS member directory link is a global constant (no per-provider deep link exists in the React SPA widget)
- Phone prefers landline (type 1) over mobile (type 2); billing email (type 10) excluded
- 14 PrA sectors derived from profession name prefixes via startsWith matching (data-driven dropdown)
- Catch-all "Weitere Berufe" sector for future unmapped professions (currently none unmapped)

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
Stopped at: Completed 04-01-PLAN.md: Hierarchical sector/profession filter with 14 data-driven categories
Resume file: None
