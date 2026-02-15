# Roadmap: INSOS PrA Map

## Overview

This roadmap delivers an interactive map of PrA training providers in Switzerland, with data from the INSOS member directory baked into a static site and rebuilt weekly via GitHub Actions. The critical path starts with the data pipeline and build-time data generation (Phase 1), then renders providers on an OpenStreetMap-based map with clustering (Phase 2), adds clickable provider detail popups (Phase 3), layers on sector/profession filtering (Phase 4), and finishes with responsive layout, German plain language polish, and shareable URLs (Phase 5).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Pipeline** - Reverse-engineer INSOS endpoint, build-time data generation, geocode, static JSON
- [ ] **Phase 2: Interactive Map** - Render OpenStreetMap with provider pin markers and clustering
- [ ] **Phase 3: Provider Details** - Pin popups with contact info and INSOS page link
- [ ] **Phase 4: Filtering** - Sector/profession hierarchical filtering with real-time map updates
- [ ] **Phase 5: Polish & Shareability** - Responsive layout, German plain language, shareable URLs

## Phase Details

### Phase 1: Data Pipeline
**Goal**: INSOS member data is fetched at build time, geocoded, and baked into a static JSON file that the frontend loads directly
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Architecture note**: Originally built with a live Express proxy; pivoted to static site with build-time data generation (see quick task 1).
**Success Criteria** (what was verified):
  1. Build-time script fetches INSOS member data and generates static providers.json
  2. Every provider record includes valid WGS84 latitude/longitude coordinates (geocoded via geo.admin.ch)
  3. Geocode cache persists in SQLite so rebuilds don't re-geocode known addresses
  4. Frontend loads static JSON and displays provider count
  5. Project scaffold (Vite + Leaflet + Tailwind) builds and serves locally
  6. GitHub Actions workflow rebuilds weekly on cron + manual trigger
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold (Vite + Express + Tailwind) and OData client with normalizer
- [x] 01-02-PLAN.md — Geocoding, provider endpoint, seed data, and frontend integration

### Phase 2: Interactive Map
**Goal**: Users see all PrA provider locations plotted on an interactive map of Switzerland
**Depends on**: Phase 1
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. User sees an OpenStreetMap-based map of Switzerland that can be zoomed and panned
  2. Every PrA provider from the INSOS data appears as a pin marker on the map
  3. Zooming out on dense areas (e.g., Zurich, Bern) shows numbered cluster markers instead of overlapping pins
  4. Clicking a cluster zooms in to reveal individual provider pins
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Provider Details
**Goal**: Users access provider contact information and INSOS profile directly from the map
**Depends on**: Phase 2
**Requirements**: PROV-01, PROV-02
**Success Criteria** (what must be TRUE):
  1. Clicking a provider pin opens a popup showing organization name, address, phone number, email, and website
  2. The popup includes a clickable link that opens the provider's INSOS member page
  3. Popup displays correctly without overflow or truncation on both desktop and mobile viewports
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Filtering
**Goal**: Users find PrA providers by selecting a training sector and drilling down to a specific profession
**Depends on**: Phase 3
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):
  1. User can select from approximately 10 PrA sector categories (e.g., Gastro, Bau, Logistik) and the map shows only providers in that sector
  2. After selecting a sector, user can drill down to a specific PrA profession and the map narrows further
  3. Map pins update immediately when filter selections change (no page reload, no visible delay)
  4. When filters match zero providers, user sees a clear German-language message explaining no results were found
  5. Clearing filters restores all providers on the map
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Polish & Shareability
**Goal**: The app is responsive across devices, uses German plain language throughout, and supports shareable URLs
**Depends on**: Phase 4
**Requirements**: FILT-05, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. On desktop, the layout shows a filter sidebar alongside the map; on mobile, filters collapse and the map fills the screen
  2. All interface text (labels, buttons, messages, filter options) is in German using Einfache Sprache (plain language)
  3. User can copy the current URL and share it; opening that URL restores the same filter selections and map position
  4. The app loads and is interactive within 3 seconds on a typical mobile connection
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Data Pipeline | 2/2 | ✓ Complete | 2026-02-15 |
| 2. Interactive Map | 0/2 | Not started | - |
| 3. Provider Details | 0/1 | Not started | - |
| 4. Filtering | 0/3 | Not started | - |
| 5. Polish & Shareability | 0/2 | Not started | - |
