# Feature Research

**Domain:** Interactive map-based provider directory for vocational training (PrA) placements in Switzerland
**Researched:** 2026-02-14
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive map with zoom/pan | Every map-based finder has this; users expect pinch-zoom on mobile, scroll-zoom on desktop | LOW | Use Leaflet or MapLibre GL; Swiss topo basemap from swisstopo adds local trust |
| Pin markers for provider locations | Core purpose of a map directory; without pins there is no map | LOW | Need geocoded addresses for all ~400 providers |
| Pin clustering for dense areas | 400+ providers will overlap in cities like Zurich, Bern, Basel; without clustering the map is unusable | LOW | Leaflet.markercluster or similar; color-coded density (green/yellow/orange) per LehreBeO pattern |
| Pin popup / detail card | Clicking a pin must show provider info; this is the core interaction that answers "who is near me?" | LOW | Organization name, address, phone, email, all PrA offerings, link to INSOS page |
| Filter by sector (Branche) | 90+ professions are too many for a flat list; sector grouping (Gastro, Bau, Logistik, etc.) is the natural entry point | MEDIUM | ~10 sector categories as primary filter; must update map pins in real time |
| Drill-down from sector to specific PrA professions | After picking a sector, users need to narrow to their specific profession | MEDIUM | Second-level filter appears after sector selection; hierarchical two-step pattern per NN/g best practices |
| Responsive layout (mobile + desktop) | Target users (school leavers, parents, counselors) will use phones; non-responsive = losing half the audience | MEDIUM | Desktop: sidebar + map split. Mobile: full-width map with bottom sheet for results/filters |
| German-language interface | INSOS PrA content is German; users are German-speaking Swiss | LOW | All labels, filters, empty states, tooltips in German |
| Map loads fast (<3s) | 70% of users leave if page is slow (Mapbox research); map apps are especially sensitive to load time | MEDIUM | Lazy-load tiles, minimize initial data payload, consider loading visible extent first |
| Empty state handling | When filters match zero providers, showing a blank map with no explanation causes user drop-off | LOW | "Keine Anbieter gefunden" message with suggestion to broaden filters or try a different sector |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Accessible list/table alternative view | Target users include people with disabilities; a screen-reader-friendly list view alongside the map is both ethically right and legally prudent under Swiss DDA (Behindertengleichstellungsgesetz). INSOS's current directory has no map at all -- adding one without an accessible fallback would be a regression. | MEDIUM | Synced with map filters: same filters produce a sortable data table. WCAG 2.1 AA compliance. |
| Shareable URL with filter state (deep linking) | Vocational counselors share specific results with families ("here are PrA Logistik providers near Bern"). Without deep links, every recipient starts from scratch. | LOW | Encode sector, profession, map center/zoom in URL query params. Low effort, high utility. |
| "In meiner Nahe" (near me) geolocation | Lets users instantly center the map on their location instead of manually navigating. Especially valuable for mobile users. | LOW | Browser Geolocation API; must trigger on user action (button press), never on page load per Chrome best practices. Fallback: manual PLZ/Ort entry. |
| PLZ / Ort search (location search) | Users think in terms of "where do I live" not map coordinates. Typing a PLZ or town name to jump the map is natural. | MEDIUM | Swiss PLZ dataset from opendata.swiss. Autocomplete dropdown. |
| Einfache Sprache (plain language) | Target audience includes people with learning difficulties. Using plain, clear German throughout -- short sentences, common words, no jargon -- directly serves the core user group. Not full "Leichte Sprache" (which requires certified translation) but thoughtful simplification. | LOW | Applies to all UI text: labels, tooltips, empty states, instructions. Design principle, not a feature toggle. |
| Canton/region visual context | Swiss users think in cantons. Showing canton boundaries on the map or offering a canton filter helps spatial orientation. | LOW | Canton boundary overlay from Swiss geodata (TopoJSON). Optional canton dropdown filter. |
| Mobile bottom sheet for provider details | On mobile, tapping a pin should slide up a bottom sheet (Google Maps pattern) showing provider info while keeping the map visible. Full-screen modal loses map context. | MEDIUM | Half-screen expandable sheet; swipe up for full details, swipe down to dismiss. |
| Show all PrA offerings per provider | When viewing a provider, show not just the filtered profession but ALL their PrA offerings. A user looking for "PrA Logistik" may discover the same provider also offers "PrA Hauswirtschaft" which interests a sibling or friend. | LOW | Already in the data; display as a list in the popup/detail card. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / saved searches | "Let users save their favorite providers" | Massive complexity increase (auth, storage, GDPR); tiny user base does this search once or twice in their life, not repeatedly. Out of scope per PROJECT.md. | Shareable deep links let users bookmark results in their browser. |
| Routing / directions to provider | "Show me how to get there" | Integrating routing adds map tile costs, complexity, and maintenance. Google/Apple Maps already do this perfectly. | Link to Google Maps directions from the provider detail card (pass lat/lng). |
| Multilingual (FR/IT/RM) | "Switzerland is multilingual" | PrA content on INSOS is German. Adding translations triples content work and is out of scope for v1 per PROJECT.md. | Design with i18n-ready architecture so it can be added later, but do not build it now. |
| Real-time availability / open spots | "Show which providers have open training spots right now" | INSOS data does not include availability. Would require INSOS to provide a new data feed. Showing stale "available" data is worse than showing nothing. | Show provider contact info prominently so users can call/email to ask about availability directly. |
| Comparison tool (compare providers side-by-side) | "Help me decide between providers" | Providers are not commodities with comparable specs. The meaningful comparison is geographic proximity and which professions they offer, which the map already shows. | Map + filter already enables comparison by proximity. Detail card shows what matters. |
| Full-text search across all fields | "Let me search for anything" | With only ~400 providers and ~10 sectors, full-text search adds complexity without value. Users do not know provider names in advance. The natural flow is sector -> profession -> location. | Structured filters (sector, profession, location) are more effective than free text for this dataset. |
| Admin CMS / data editing | "Let INSOS members update their own listings" | This is a read-only consumer of INSOS data. Building an admin interface is a separate product. Out of scope per PROJECT.md. | Pull data live from INSOS; they maintain their own directory. |
| Rating / review system | "Let users rate providers" | Ethically questionable for disability services. Tiny sample sizes make ratings meaningless. Legal and reputational risk. | Not applicable. Omit entirely. |
| Chat / messaging with providers | "Let users contact providers through the app" | Requires accounts, moderation, notification infrastructure. Providers have phones and email. | Show phone, email, and website link in provider detail card. |
| Push notifications / alerts | "Notify users when new providers are added" | Requires service workers, user opt-in infrastructure, ongoing maintenance. Users search once, not repeatedly. | Static tool. No notification infrastructure needed. |

## Feature Dependencies

```
[Interactive Map with Pins]
    |
    +--requires--> [Geocoded Provider Data]
    |                   |
    |                   +--requires--> [INSOS Data Source / API Reverse-Engineering]
    |
    +--requires--> [Pin Clustering] (for usability at zoom-out levels)
    |
    +--enables--> [Pin Popup / Detail Card]
    |                  |
    |                  +--enables--> [Link to INSOS Page]
    |                  +--enables--> [Show All PrA Offerings]
    |                  +--enables--> [Link to Google Maps Directions]
    |
    +--enables--> [Filter by Sector]
    |                  |
    |                  +--enables--> [Drill-down to Profession]
    |
    +--enables--> [Shareable URL / Deep Linking]
    |
    +--enables--> [Geolocation "In meiner Nahe"]
    |
    +--enables--> [PLZ/Ort Search]

[Accessible List View]
    +--requires--> [Same Data + Filter Logic as Map]
    +--independent-of--> [Map Rendering] (can be built as alternate view)

[Canton Boundary Overlay]
    +--independent-of--> [Provider Data] (purely visual layer)

[Responsive Layout]
    +--requires--> [Map Component]
    +--enables--> [Mobile Bottom Sheet]

[Einfache Sprache]
    +--independent-of--> [All Technical Features] (content/copy concern)
    +--applies-to--> [All UI Text]
```

### Dependency Notes

- **Map requires geocoded data:** The entire application depends on having lat/lng coordinates for each provider. If INSOS data lacks coordinates, geocoding addresses against Swiss address data (geo.admin.ch) is a prerequisite step.
- **Filters require structured data:** Sector and profession filtering depends on INSOS data having clean, consistent category tags. Data quality determines filter quality.
- **List view shares filter logic with map:** Building the filter/data layer cleanly (separate from map rendering) enables both the map view and the accessible list view without duplicating logic.
- **Deep linking requires stable filter state:** URL encoding depends on filters being implemented with deterministic state (sector ID + profession ID + map center/zoom).
- **Mobile bottom sheet requires responsive layout:** The bottom sheet pattern is a mobile-specific enhancement built on top of the responsive layout foundation.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept.

- [ ] **INSOS data integration** -- without data, nothing works. Reverse-engineer their API, geocode addresses.
- [ ] **Interactive map with provider pins** -- the core value proposition. Zoom, pan, click.
- [ ] **Pin clustering** -- unusable without it in urban areas.
- [ ] **Pin popup with provider details** -- name, address, contact info, PrA offerings, INSOS page link.
- [ ] **Sector filter with profession drill-down** -- the primary navigation pattern. Two-step hierarchical filter.
- [ ] **Responsive layout** -- desktop sidebar + mobile full-width with collapsible filter panel.
- [ ] **German-language UI** -- all text in German, written in Einfache Sprache.
- [ ] **Empty state handling** -- graceful "no results" with guidance to broaden filters.
- [ ] **Shareable URL with filter state** -- low effort, high value for counselors sharing results.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Accessible list/table view** -- add after core map works, but prioritize highly. Should be in v1.1 at latest.
- [ ] **PLZ/Ort location search** -- add autocomplete location search for faster navigation.
- [ ] **Geolocation "In meiner Nahe"** -- button to center map on user location.
- [ ] **Canton boundary overlay** -- visual orientation aid.
- [ ] **Mobile bottom sheet** -- enhance mobile UX with slide-up detail panel instead of popup overlay.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multilingual support (FR/IT)** -- if INSOS provides translated data and there is demand.
- [ ] **Other INSOS services (Wohnen, Arbeiten)** -- expand beyond PrA if the tool proves valuable.
- [ ] **Print / PDF export** -- for counselors who want to print results for offline reference.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Interactive map with pins | HIGH | LOW | P1 |
| INSOS data integration | HIGH | HIGH | P1 |
| Pin clustering | HIGH | LOW | P1 |
| Pin popup / detail card | HIGH | LOW | P1 |
| Sector filter | HIGH | MEDIUM | P1 |
| Profession drill-down | HIGH | MEDIUM | P1 |
| Responsive layout | HIGH | MEDIUM | P1 |
| German UI / Einfache Sprache | HIGH | LOW | P1 |
| Empty state handling | MEDIUM | LOW | P1 |
| Shareable URL / deep linking | HIGH | LOW | P1 |
| Show all PrA offerings per provider | MEDIUM | LOW | P1 |
| Accessible list view | HIGH | MEDIUM | P2 |
| PLZ/Ort search | MEDIUM | MEDIUM | P2 |
| Geolocation button | MEDIUM | LOW | P2 |
| Canton overlay | LOW | LOW | P2 |
| Mobile bottom sheet | MEDIUM | MEDIUM | P2 |
| Link to Google Maps directions | LOW | LOW | P3 |
| Print/PDF export | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | INSOS Current Directory | berufsberatung.ch (LENA) | LehreBeO | Yousty.ch | Our Approach |
|---------|------------------------|--------------------------|----------|-----------|--------------|
| Map view | No map; list/filter only | No map; text-based search with canton checkboxes | Leaflet map with clustering; Swiss topo tiles | No map; list-based | Interactive map as primary view with list fallback |
| Location search | Region filter dropdown | Canton checkboxes + town autocomplete with radius slider (0-50km) | Location field + map navigation | Canton dropdown | PLZ/Ort autocomplete + geolocation button |
| Profession filter | PrA-specific filter on member directory | Alphabetical list of 200+ professions | Profession search + field-of-work dropdown | Browse by profession A-Z | Two-step: sector (10) then profession (within sector) |
| Provider details | Basic: name, address, services | Apprenticeship details, company info | Pin click shows company + profession | Company profile page | Popup with full contact info + all PrA offerings + INSOS link |
| Clustering | N/A (no map) | N/A (no map) | Yes, color-coded density clusters | N/A (no map) | Yes, density-aware clustering |
| Mobile experience | Basic responsive | Responsive form | Map + limited mobile optimization | App + responsive web | Mobile-first: bottom sheet, touch-friendly pins, collapsible filters |
| Accessibility | Unknown | Government site, likely AA compliant | Unknown | Unknown | WCAG 2.1 AA target; list view alternative; Einfache Sprache |
| Deep linking | No | Limited (search params in URL) | No | No | Full filter state in URL |

## Sources

- [Map UI Patterns -- Catalog of map interaction design patterns](https://mapuipatterns.com/patterns/)
- [NN/g -- Building Interactive UX Maps](https://www.nngroup.com/articles/interactive-ux-maps/)
- [NN/g -- Helpful Filter Categories and Values](https://www.nngroup.com/articles/filter-categories-values/)
- [NN/g -- Bottom Sheets: Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [Mapbox -- 5 Best Practices for Building a Store Locator](https://www.mapbox.com/blog/best-practices-for-custom-store-locators)
- [BOIA -- Interactive Maps and Accessibility: 4 Tips](https://www.boia.org/blog/interactive-maps-and-accessibility-4-tips)
- [W3C WAI -- Accessible Maps](https://www.w3.org/WAI/RD/wiki/Accessible_Maps)
- [Equal Entry -- Accessible Maps on the Web](https://equalentry.com/accessible-maps-on-the-web/)
- [Carnegie Museums -- Maps Accessibility Guidelines](http://web-accessibility.carnegiemuseums.org/content/maps/)
- [INSOS -- PrA-Dienstleister finden](https://www.insos.ch/ausbildung-pra/pra-dienstleister-finden/)
- [berufsberatung.ch -- Lehrstelle suchen (LENA)](https://www.berufsberatung.ch/dyn/show/2930)
- [LehreBeO -- Apprenticeship Map](https://lehrebeo.ch/lsp/map/lehrstellen)
- [ADIS -- Leichte Sprache](https://www.adis.ch/de/grundlagen/e-accessibility/leichte-sprache-66.html)
- [opendata.swiss -- Swiss PLZ dataset](https://opendata.swiss/en/dataset/amtliches-ortschaftenverzeichnis-mit-postleitzahl-und-perimeter)
- [Chrome Developers -- Geolocation on page load](https://developer.chrome.com/docs/lighthouse/best-practices/geolocation-on-start)
- [Map UI Patterns -- Empty State](https://mapuipatterns.com/empty-state/)
- [Pencil & Paper -- Filter UX Design Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)

---
*Feature research for: INSOS PrA Map -- Interactive provider directory for vocational training placements in Switzerland*
*Researched: 2026-02-14*
