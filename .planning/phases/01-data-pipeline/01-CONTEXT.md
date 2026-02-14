# Phase 1: Data Pipeline - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

INSOS member data flows reliably from their directory through a self-hosted proxy into the browser, with coordinates ready for mapping. This phase delivers the data pipeline only — no map rendering, no UI beyond a console log of provider count.

</domain>

<decisions>
## Implementation Decisions

### Proxy behavior
- Proxy is integrated into the main backend app (same server as the static site)
- In-memory cache with 24-hour TTL — refreshes on server restart
- Single JSON endpoint serves all provider data to the browser
- CORS headers set so the frontend can fetch from the proxy

### Geocoding approach
- Geocoding happens server-side at the proxy level — browser receives pre-geocoded data
- Use geo.admin.ch (Swisstopo) as the geocoding service — free, high quality for Swiss addresses
- Geocoding results cached persistently on disk (addresses don't move, avoids re-geocoding on restart)
- Fallback for failed geocodes: place pin at city or canton center with approximate location flag

### Data shape & storage
- Extract all available fields from INSOS data upfront (contact info, professions, etc.) even though Phase 1 only logs a count — avoids rework in future phases
- Normalize raw INSOS data into a clean, consistent schema — browser receives clean JSON
- Single endpoint returns all providers as a JSON array (fits client-side filtering decision from PROJECT.md)

### Resilience & staleness
- Ship with seed data: include a snapshot of provider data in the repo as fallback for cold start / first deploy
- Re-geocode only new or changed addresses (persistent geocode cache handles this)

### Claude's Discretion
- Degradation strategy when INSOS is unreachable (serve stale vs error)
- Monitoring approach (logs, health endpoint, or both)
- User-Agent header and rate-limiting politeness toward INSOS
- Exact normalized schema field names and structure
- Technology choice for persistent geocode cache (SQLite, JSON file, etc.)

</decisions>

<specifics>
## Specific Ideas

- geo.admin.ch specifically chosen over Nominatim for Swiss address quality
- In-memory data cache (simple, lost on restart) but persistent geocode cache (stable data, avoid redundant API calls) — two different caching strategies for two different concerns
- Seed data in repo ensures the app works immediately on first deploy without waiting for a successful INSOS fetch

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-pipeline*
*Context gathered: 2026-02-14*
