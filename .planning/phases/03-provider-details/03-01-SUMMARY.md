---
phase: 03-provider-details
plan: 01
subsystem: data-pipeline, ui
tags: [odata, leaflet-popup, kontaktdaten, kommunikationsmittel, html-escape, xss-prevention]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: "OData client, normalizer, build-data pipeline, providers.json"
  - phase: 02-interactive-map
    provides: "Leaflet map with marker clustering and bindPopup"
provides:
  - "fetchKommunikationsmittel() batched OData contact data retrieval"
  - "joinContactData() normalizer for email/phone/website mapping"
  - "buildPopupContent() rich HTML popup with contact card and INSOS link"
  - "providers.json with email, phone, website fields populated"
affects: [04-filter-ui, 05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batched OData or-chain queries (20 IDs per request, 200ms politeness delay)"
    - "KommunikationstypValue mapping (0=email, 1=phone, 2=mobile, 3=website, 10=billing-ignore)"
    - "HTML-escape all external API data before DOM insertion (esc() function)"
    - "Conditional popup rendering (omit null contact fields)"

key-files:
  created: []
  modified:
    - "server/odata-client.js"
    - "server/normalizer.js"
    - "scripts/build-data.js"
    - "src/map.js"
    - "src/style.css"

key-decisions:
  - "Batch size 20 IDs per OData request (conservative URL length limit)"
  - "INSOS member directory link is a global constant URL (no per-provider deep link exists)"
  - "Phone field prefers landline (type 1) with mobile (type 2) fallback"
  - "Website display strips https:// prefix and trailing slash for readability"

patterns-established:
  - "esc() HTML escaping for all external data in popup HTML"
  - "Conditional contact field rendering (gracefully omit null fields)"
  - "Batched OData fetch with or-chain filter pattern"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 3 Plan 1: Provider Contact Details Summary

**Rich popup with phone/email/website from OData Kommunikationsmittel entity and INSOS member directory link**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T09:38:25Z
- **Completed:** 2026-02-15T09:40:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended build pipeline to fetch Kommunikationsmittel contact data from PerformX OData API in batched requests (19 batches of 20 IDs)
- providers.json now contains email (356/365), phone (362/365), and website (345/365) for provider records
- Rich popup on every map marker showing name, address, phone (tel: link), email (mailto: link), website (new tab), and INSOS Mitgliederverzeichnis link
- All provider data HTML-escaped to prevent XSS from external API content
- Missing contact fields gracefully omitted (no null text or empty links)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch Kommunikationsmittel contact data in build pipeline** - `40ee94d` (feat)
2. **Task 2: Build rich popup with contact details and INSOS link** - `de5d617` (feat)

## Files Created/Modified
- `server/odata-client.js` - Added fetchKommunikationsmittel() with batched or-chain OData queries
- `server/normalizer.js` - Added joinContactData() mapping KommunikationstypValue to email/phone/website
- `scripts/build-data.js` - Integrated contact fetch between normalize and geocode steps
- `src/map.js` - Added esc(), buildPopupContent(), INSOS_URL constant; updated bindPopup call
- `src/style.css` - Added .provider-popup styling with word-wrap for mobile

## Decisions Made
- Batch size of 20 IDs per OData request -- conservative choice staying well within URL length limits (19 requests total for 365 providers)
- INSOS member directory link uses a single constant URL (`https://www.insos.ch/de/ueber-uns#unsere-mitglieder-268211`) for all providers since no per-provider deep link exists in the React SPA widget
- Phone field prefers landline (KommunikationstypValue 1) over mobile (type 2) as fallback
- Website display strips `https://` prefix and trailing `/` for cleaner visual presentation
- Billing email (type 10) excluded from popup -- not user-facing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 365 providers have full contact data in providers.json (email/phone/website coverage: 97-99%)
- Popup infrastructure ready for Phase 4 filter UI integration
- The `buildPopupContent()` function can be extended in future phases if needed
- Production build verified successful

## Self-Check: PASSED

All files verified present. All commits verified in git log. All must_have artifact patterns confirmed.

---
*Phase: 03-provider-details*
*Completed: 2026-02-15*
