# Requirements: INSOS PrA Map

**Defined:** 2026-02-14
**Core Value:** A person looking for a PrA training spot can quickly find which INSOS members near them offer the profession they're interested in.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Integration

- [ ] **DATA-01**: User can view member data sourced from the INSOS directory, refreshed weekly via automated rebuild
- [ ] **DATA-02**: App serves pre-built static data (no runtime server); a build-time script fetches from INSOS OData API
- [ ] **DATA-03**: Member addresses are geocoded to map coordinates if source data lacks lat/lng
- [ ] **DATA-04**: Data is regenerated weekly via GitHub Actions cron; no excessive requests to INSOS

### Map

- [ ] **MAP-01**: User can view an interactive OpenStreetMap-based map of Switzerland with zoom and pan
- [ ] **MAP-02**: User can see pin markers for each PrA provider location on the map
- [ ] **MAP-03**: Nearby pins are automatically clustered at zoom-out levels for readability

### Filtering

- [ ] **FILT-01**: User can filter providers by PrA sector (~10 categories)
- [ ] **FILT-02**: User can drill down from sector to specific PrA profession
- [ ] **FILT-03**: Map updates in real-time when filter selections change
- [ ] **FILT-04**: User sees clear feedback when filters match zero providers
- [ ] **FILT-05**: User can share a URL that preserves the current filter state and map position

### Provider Details

- [ ] **PROV-01**: User can click a pin to see organization name, address, phone, email, and website
- [ ] **PROV-02**: Pin popup includes a direct link to the member's INSOS page

### Layout & UX

- [ ] **UX-01**: Layout is responsive across desktop and mobile devices
- [ ] **UX-02**: Interface uses German plain language (Einfache Sprache) throughout

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Map Enhancements

- **MAP-04**: Canton boundary overlay for regional orientation
- **MAP-05**: "In meiner Nahe" geolocation button to center map on user location

### Provider Details

- **PROV-03**: Popup shows all PrA offerings for the provider (not just filtered ones)
- **PROV-04**: Link to Google Maps directions from provider location

### Accessibility

- **ACC-01**: Accessible list/table view as alternative to map (screen-reader-friendly)
- **ACC-02**: Keyboard-navigable filter controls

### UX Enhancements

- **UX-03**: PLZ/Ort location search with autocomplete
- **UX-04**: Mobile bottom sheet for provider details

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multilingual (FR/IT) | German only for v1, INSOS PrA content is German |
| User accounts / saved searches | Single-use tool, bookmarks + deep links suffice |
| Real-time availability data | INSOS doesn't provide open spot counts |
| Rating/review system | Ethically problematic for disability services |
| Admin CMS / data editing | Read-only consumer of INSOS data |
| Chat/messaging with providers | Providers have phone and email |
| Mobile native app | Responsive web is sufficient |
| Runtime server / proxy | Static site with build-time data pipeline, no server needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Done (weekly rebuild via GitHub Actions) |
| DATA-02 | Phase 1 | Done (build-time script, no runtime server) |
| DATA-03 | Phase 1 | Done (365 providers geocoded via geo.admin.ch) |
| DATA-04 | Phase 1 | Done (weekly cron, SQLite geocode cache) |
| MAP-01 | Phase 2 | Pending |
| MAP-02 | Phase 2 | Pending |
| MAP-03 | Phase 2 | Pending |
| FILT-01 | Phase 4 | Pending |
| FILT-02 | Phase 4 | Pending |
| FILT-03 | Phase 4 | Pending |
| FILT-04 | Phase 4 | Pending |
| FILT-05 | Phase 5 | Pending |
| PROV-01 | Phase 3 | Pending |
| PROV-02 | Phase 3 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
