# INSOS PrA Map

## What This Is

An interactive geographic map of Switzerland that helps people find PrA (Praktische Ausbildung) training placements offered by INSOS member organizations. Users browse by training sector, drill into specific PrA professions, and see provider locations on the map with contact details and service profiles.

## Core Value

A person looking for a PrA training spot can quickly find which INSOS members near them offer the profession they're interested in.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Interactive geographic map of Switzerland with zoom/pan and pin markers for member locations
- [ ] PrA filtering by sector categories (Gastro, Bau, Logistik, etc.) with drill-down to specific professions
- [ ] Pin popup showing organization name, address, phone, email, website
- [ ] Pin popup showing all PrA offerings for that member
- [ ] Pin popup with direct link to member's INSOS page
- [ ] Live data from INSOS website — reverse-engineer or proxy their member directory API
- [ ] Pin clustering for dense areas
- [ ] German-language interface

### Out of Scope

- Multilingual (FR/IT) — German only for v1, could add later
- Other INSOS services (Wohnen, Arbeiten, Tagesstruktur) — PrA focus only for now
- User accounts or saved searches — public read-only tool
- Mobile native app — responsive web is sufficient
- INSOS admin/editing features — read-only consumer of their data

## Context

INSOS (Branchenverband der Dienstleister für Menschen mit Behinderungen) is Switzerland's industry association for disability service providers with ~1,000+ member organizations. They offer PrA — a two-year vocational training program for school leavers with learning difficulties, with 400+ PrA providers and 90+ certified PrA professions across sectors.

Their current member directory lives at `insos.ch/de/ueber-uns#unsere-mitglieder-268211` and loads dynamically via client-side JavaScript on a Contao CMS site. The directory supports filtering by PrA offering and by region. The backend data source needs to be reverse-engineered — the goal is to pull data live rather than maintain a separate copy.

Target users are people seeking PrA training placements: school leavers with learning difficulties, their parents, and vocational counselors.

## Constraints

- **Data source**: Must work with INSOS's existing data — no control over their backend or data format
- **CORS**: If INSOS API doesn't allow cross-origin requests, a lightweight proxy will be needed
- **Data accuracy**: Dependent on INSOS keeping their directory current
- **No official API**: Data access is via reverse-engineering their frontend's data loading, which could break if they redesign

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Live data over local copy | User wants current data without manual maintenance | — Pending |
| Geographic map with pins (not SVG outline) | Better for finding specific locations, familiar UX | — Pending |
| Category-first filtering (sector → profession) | 90+ professions too many for flat list, sectors group naturally | — Pending |
| German only | Matches INSOS German content, simplifies v1 | — Pending |
| Third-party project | Not an official INSOS tool — independent project consuming their data | — Pending |

---
*Last updated: 2026-02-14 after initialization*
