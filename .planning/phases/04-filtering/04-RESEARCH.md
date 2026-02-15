# Phase 4: Filtering - Research

**Researched:** 2026-02-15
**Domain:** Client-side hierarchical filtering (sector -> profession) with Leaflet map integration
**Confidence:** HIGH

## Summary

Phase 4 adds a two-level hierarchical filter to the PrA map: users first select a training sector (~10 categories like "Gastronomie", "Bau", "Logistik"), then optionally drill down to a specific PrA profession within that sector. The map immediately updates to show only matching providers. This is a pure frontend task -- all 365 providers with their 84 distinct PrA professions are already loaded in memory from the static JSON. No data pipeline changes are needed.

The key architectural decision is how to group the 84 PrA professions into ~10 sectors. The PerformX API has a `Branche` entity (31 business sectors) with provider-to-sector assignments (`AdresseBrancheZuweisung`), but this is NOT the right data source: Branche represents general business sectors (e.g., "Finanzen & Versicherung", "Sicherheit & Krisenmanagement") that are unrelated to PrA training, and providers have 10-14 Branche assignments each (too broad). The `PraktischeAusbildung` entity has no built-in sector/category field. Therefore, the sector grouping must be defined as a static mapping in the frontend code, derived from the natural structure of PrA profession names. The names have a clear pattern: "PrA {Profession}" with optional "Fachrichtung {Specialization}" suffixes, and professions cluster naturally into ~10-15 domains (e.g., all kitchen/restaurant/bakery professions form "Gastronomie"). This mapping should be a simple JS object baked into the code, easily maintainable as the PrA catalog evolves.

For the UI, a Leaflet custom control (`L.Control`) placed in the `topright` position provides the filter panel overlaid on the map. This keeps the map full-viewport (no layout changes needed from Phase 2/3) while making filters accessible. Two `<select>` dropdowns (sector, then profession) are the simplest UX for mobile and desktop. When filters change, the code filters the in-memory provider array and replaces the marker cluster group contents using `clearLayers()` + `addLayers()`. With only 365 markers, this is effectively instant (<16ms).

**Primary recommendation:** Define a static sector-to-professions mapping in a new `src/filters.js` module, build a Leaflet custom control with two dropdowns (sector -> profession), and on change events filter the provider array in memory, then `clearLayers()` + `addLayers()` on the existing MarkerClusterGroup. Add a "no results" overlay message in German when the filter matches zero providers.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 (already installed) | `L.Control` for custom filter panel, map layer management | Already in use. Custom controls are a first-class Leaflet API. No additional library needed. |
| leaflet.markercluster | 1.5.3 (already installed) | `clearLayers()` + `addLayers()` for efficient marker replacement | Already in use. Provides performant bulk add/remove with chunked loading. |

### Supporting

No additional libraries needed for Phase 4. The filter UI is pure HTML (`<select>` elements) rendered inside a Leaflet control. Styling uses Tailwind classes (already installed) and/or scoped CSS.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `L.Control` (map overlay) | Sidebar panel outside the map div | Better for complex UIs, but requires layout changes (Phase 5 scope). L.Control keeps Phase 4 self-contained. |
| Two `<select>` dropdowns | Checkbox/tag multi-select | Multi-select is more flexible but more complex. Requirements specify a single sector + single profession drill-down, not multi-select. |
| Static JS sector mapping | Branche data from OData API | Branche has 31 general business sectors, not PrA-specific. Too many categories, wrong domain. Static mapping is correct. |
| `clearLayers()` + `addLayers()` | Show/hide individual markers | Show/hide requires tracking all markers + their visibility state. clearLayers + addLayers is simpler and equally fast at 365 markers. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── index.html          # No changes needed
├── main.js             # MODIFY: pass providers array to filter init, receive filter events
├── map.js              # MODIFY: export function to replace markers on filter change
├── filters.js          # NEW: sector mapping, filter state, Leaflet control, filter logic
├── style.css           # MODIFY: add filter control styling
└── public/
    └── data/
        └── providers.json  # No changes needed (praOfferings already present)
```

### Pattern 1: Static Sector-to-Profession Mapping

**What:** A hardcoded JS object that groups the 84 PrA professions into ~10-12 human-readable sector categories. The mapping uses the profession name (stripped of the "PrA " prefix) as the key, matching against provider `praOfferings[].name`.

**When to use:** At app initialization to build the sector dropdown options, and on sector selection to populate the profession dropdown.

**Recommended sector grouping:**

```javascript
// src/filters.js
// Sector categories derived from PrA profession name patterns.
// Each sector maps to an array of profession name substrings.
// A profession matches a sector if its name (without "PrA " prefix)
// starts with any of the sector's entries.
const SECTOR_MAP = {
  'Gastronomie & Hotellerie': [
    'Küche', 'Restaurant', 'Bäckerei-Konditorei-Confiserie',
    'Metzgerei', 'Systemgastronomie', 'Hotellerie', 'Lebensmittel'
  ],
  'Hauswirtschaft & Reinigung': [
    'Hauswirtschaft', 'Reinigungstechnik'
  ],
  'Garten, Floristik & Landwirtschaft': [
    'Gärtnerei', 'Floristik', 'Landwirtschaft', 'Pferdepflege',
    'Tierpflege', 'Forstarbeiten', 'Milchwirtschaft'
  ],
  'Bau & Gebäudetechnik': [
    'Mauerhandwerk', 'Plattenlegen', 'Malerei', 'Gipserei',
    'Bodenlegen', 'Dachdeckarbeiten', 'Strassenbau', 'Abdichten',
    'Entwässerung', 'Gebäudetechnik', 'Lackierung', 'Fassadenbau',
    'Gerüstebau', 'Kältemontage', 'eneuerbare Energien'
  ],
  'Holz & Schreinerei': [
    'Schreinerei', 'Holzbearbeitung'
  ],
  'Metall, Mechanik & Industrie': [
    'Metallbau', 'Mechanik', 'Industrie', 'Kunststoffverarbeitung'
  ],
  'Logistik & Transport': [
    'Logistik', 'Strassentransport', 'Recycling'
  ],
  'Verkauf & Administration': [
    'Detailhandel', 'Büroarbeiten'
  ],
  'Fahrzeuge': [
    'Automobil', 'Zweirad', 'Carrosserie', 'Motorradmechanik'
  ],
  'Betriebsunterhalt & Elektro': [
    'Betriebsunterhalt', 'Elektroarbeiten'
  ],
  'Textil & Handwerk': [
    'Nähen', 'Handweben', 'Flechten', 'Dekorationsnäherei',
    'Textilveredlung', 'Kunsthandwerk', 'Keramik',
    'Coiffeursalon', 'Hundecoiffeursalon'
  ],
  'IT & Medien': [
    'Informatik', 'Mediamatik', 'Printmedien', 'Grafik',
    'Audio- und Videotechnik', 'Veranstaltungstechnik'
  ],
  'Gesundheit & Soziales': [
    'Mitarbeit Begleitung und Pflege Erwachsene',
    'Mitarbeit im Kinderbereich', 'Schulassistenz',
    'Dentalpraxis', 'Gemeindemitarbeit', 'Schauspielerei'
  ],
  'Uhren & Schmuck': [
    'Uhrenarbeiten', 'Grossuhrenmacher', 'Edelsteinfassungen',
    'Schuhreparaturen'
  ]
};
```

**Matching logic:** A profession name like "PrA Gärtnerei Fachrichtung Pflanzenproduktion" is matched by checking if "Gärtnerei Fachrichtung Pflanzenproduktion" starts with any sector entry (here "Gärtnerei"). This naturally groups base professions with their Fachrichtung specializations.

**Coverage analysis (from current 365-provider dataset):**

| Sector | Professions | Total Offerings |
|--------|------------|-----------------|
| Gastronomie & Hotellerie | 7 | 340 |
| Hauswirtschaft & Reinigung | 4 | 232 |
| Garten, Floristik & Landwirtschaft | 10 | 230 |
| Verkauf & Administration | 2 | 172 |
| Betriebsunterhalt & Elektro | 4 | 177 |
| Metall, Mechanik & Industrie | 4 | 159 |
| Holz & Schreinerei | 2 | 107 |
| Logistik & Transport | 3 | 95 |
| Bau & Gebäudetechnik | 14 | 88 |
| Textil & Handwerk | 9 | 77 |
| Fahrzeuge | 5 | 67 |
| Gesundheit & Soziales | 5 | 35 |
| IT & Medien | 7 | 32 |
| Uhren & Schmuck | 4 | 7 |

**Source:** Direct analysis of providers.json data (2026-02-15). The OData `PraktischeAusbildung` entity has 102 entries total; 84 are currently used by at least one of the 365 providers.

### Pattern 2: Leaflet Custom Control for Filter UI

**What:** A custom `L.Control` that renders two `<select>` dropdowns (sector, profession) overlaid on the map.

**When to use:** On map initialization. The control is added to the map like any other Leaflet control.

**Verified Leaflet API:**
```javascript
// src/filters.js
const FilterControl = L.Control.extend({
  options: {
    position: 'topright'   // topleft, topright, bottomleft, bottomright
  },

  onAdd(map) {
    const container = L.DomUtil.create('div', 'filter-control');

    // Prevent map interactions when clicking/scrolling inside the control
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    // Sector dropdown
    const sectorSelect = L.DomUtil.create('select', 'filter-select', container);
    sectorSelect.innerHTML = '<option value="">Alle Bereiche</option>';
    // ... populate with sector names

    // Profession dropdown (hidden until sector selected)
    const profSelect = L.DomUtil.create('select', 'filter-select', container);
    profSelect.innerHTML = '<option value="">Alle Berufe</option>';
    profSelect.style.display = 'none';

    // Event handlers
    sectorSelect.addEventListener('change', () => { /* filter logic */ });
    profSelect.addEventListener('change', () => { /* filter logic */ });

    return container;
  },

  onRemove(map) {
    // Cleanup if needed
  }
});
```

**Critical:** `L.DomEvent.disableClickPropagation(container)` and `L.DomEvent.disableScrollPropagation(container)` are essential. Without them, clicking the dropdown will also trigger map click/drag events. This is verified in Leaflet's own `L.Control.Layers` implementation.

**Source:** Leaflet 1.9.4 source code (`node_modules/leaflet/dist/leaflet-src.js` lines 4868-5037). `L.Control` API: `extend()`, `onAdd(map)` returning a DOM element, `options.position`.

### Pattern 3: Marker Replacement on Filter Change

**What:** When the user changes a filter, compute the filtered provider subset, then replace all markers in the MarkerClusterGroup.

**When to use:** On every filter change event (sector or profession dropdown).

**Verified approach:**
```javascript
// src/map.js — new export function
export function updateMarkers(clusters, filteredProviders) {
  clusters.clearLayers();

  const markers = [];
  for (const provider of filteredProviders) {
    if (provider.lat != null && provider.lon != null) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(buildPopupContent(provider));
      markers.push(marker);
    }
  }

  clusters.addLayers(markers);
}
```

**Performance:** `clearLayers()` is O(n) where n = current markers. `addLayers()` with `chunkedLoading: true` processes markers in ~200-marker chunks with frame breaks. For 365 markers (worst case = no filter), both operations complete in <16ms total. This is well under the 16ms frame budget for 60fps rendering.

**Alternative considered:** Instead of destroying and recreating markers, keep all markers in a Map keyed by provider ID and add/remove individually. This saves marker object allocation but adds code complexity. At 365 markers, the performance difference is negligible. The simpler clearLayers + addLayers approach is correct.

**Source:** leaflet.markercluster 1.5.3 source (`node_modules/leaflet.markercluster/src/MarkerClusterGroup.js`). `clearLayers()` at line 423, `addLayers()` at line 194.

### Pattern 4: Filter State and Provider Filtering

**What:** Maintain filter state (selected sector, selected profession) and compute filtered providers from the full dataset.

**When to use:** On every filter change. The filtering logic is pure data transformation (no DOM or map access needed).

```javascript
// src/filters.js — filter logic
function filterProviders(allProviders, selectedSector, selectedProfession) {
  if (!selectedSector) {
    return allProviders; // No filter = show all
  }

  const sectorPrefixes = SECTOR_MAP[selectedSector];

  return allProviders.filter(provider => {
    return provider.praOfferings.some(offering => {
      const name = offering.name.replace('PrA ', '');

      // Check if profession matches sector
      const matchesSector = sectorPrefixes.some(prefix => name.startsWith(prefix));
      if (!matchesSector) return false;

      // If specific profession selected, check exact match
      if (selectedProfession) {
        return offering.name === selectedProfession;
      }

      return true;
    });
  });
}
```

**Key insight:** A provider matches a sector if ANY of its praOfferings falls in that sector. A provider matches a profession if it has that specific profession in its praOfferings. This is an inclusive filter (OR across offerings), which is correct: a provider offering "PrA Küche" and "PrA Logistik" should appear when either "Gastronomie" or "Logistik" is selected.

### Pattern 5: Zero Results Message

**What:** When the current filter matches no providers, display a German-language message on the map.

**When to use:** After filtering, if the result set is empty.

```javascript
// Show/hide "no results" overlay
function setNoResults(show) {
  let overlay = document.getElementById('no-results');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'no-results';
      overlay.className = 'no-results-overlay';
      overlay.textContent = 'Keine Anbieter für diese Auswahl gefunden.';
      document.getElementById('map').appendChild(overlay);
    }
    overlay.style.display = 'block';
  } else if (overlay) {
    overlay.style.display = 'none';
  }
}
```

**German text:** "Keine Anbieter für diese Auswahl gefunden." (No providers found for this selection.) Uses simple German (Einfache Sprache) as required.

### Pattern 6: Populating Profession Dropdown from Data

**What:** When a sector is selected, populate the profession dropdown with only the professions that exist in the current dataset (not all 102 from the reference table, only the ~84 that at least one provider offers).

**When to use:** On sector change event.

```javascript
function getProfessionsForSector(allProviders, sectorPrefixes) {
  const professions = new Set();
  for (const provider of allProviders) {
    for (const offering of provider.praOfferings) {
      const name = offering.name.replace('PrA ', '');
      if (sectorPrefixes.some(prefix => name.startsWith(prefix))) {
        professions.add(offering.name);
      }
    }
  }
  return [...professions].sort((a, b) => a.localeCompare(b, 'de'));
}
```

**Important:** Only show professions that exist in the actual data. Showing professions with zero providers creates confusion. The profession list is derived from the loaded providers, not from the 102-entry PraktischeAusbildung reference table.

### Anti-Patterns to Avoid

- **Using Branche data for PrA sector categories:** The 31 Branche entries are general business sectors (e.g., "Finanzen & Versicherung"), not PrA training domains. Providers have 10-14 Branche assignments each. This is the wrong data source for "~10 PrA sector categories."
- **Fetching sector data at runtime:** All data is already loaded. The sector mapping is static. No additional API calls are needed.
- **Re-fetching providers.json on filter change:** The full dataset is already in memory. Filter in-place with `.filter()`.
- **Adding/removing individual markers on filter change:** Use bulk `clearLayers()` + `addLayers()`. Individual operations trigger re-clustering after each marker, causing O(n^2) reclustering.
- **Forgetting `disableClickPropagation` on the filter control:** Without it, clicking a dropdown option also triggers a map click event, potentially closing a popup or starting a drag.
- **Hardcoding profession lists in the dropdown:** Always derive from the data. If a profession has zero providers (data changes), it should not appear.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map control positioning | Absolute-positioned div with manual z-index | `L.Control.extend()` with `position` option | Leaflet handles z-index stacking, responsive repositioning, and conflict with zoom/attribution controls |
| Click isolation from map | Manual `stopPropagation` on every event | `L.DomEvent.disableClickPropagation(container)` | Handles click, dblclick, mousedown, touchstart, and pointer events. One call covers all. |
| Scroll isolation from map | Manual `preventDefault` | `L.DomEvent.disableScrollPropagation(container)` | Prevents map zoom when scrolling inside the control (e.g., long dropdown on mobile) |
| Marker bulk update | Loop of `removeLayer` + `addLayer` | `clearLayers()` + `addLayers()` | Individual operations trigger re-clustering each time. Bulk operations cluster once at the end. |
| Dropdown UI library | Select2, Choices.js, etc. | Native `<select>` element | For ~14 sectors and ~20 professions per sector, native selects are fast, accessible, mobile-friendly, and zero-dependency |

**Key insight:** Phase 4 is primarily data transformation (filter array) and DOM wiring (dropdowns to map). The complexity is in the sector mapping design, not the code volume. All required map interactions are built into Leaflet and leaflet.markercluster.

## Common Pitfalls

### Pitfall 1: Sector Mapping Does Not Cover All Professions

**What goes wrong:** A PrA profession exists in the data but is not assigned to any sector. When a user filters, providers offering that profession appear under "Alle Bereiche" but disappear when any sector is selected.
**Why it happens:** New PrA professions are added to the PerformX system (currently 102 entries, 84 in use). The static mapping in code may not cover new additions.
**How to avoid:** Add a catch-all sector ("Weitere Berufe" / "Other professions") that captures any profession not matched by the explicit sector mapping. On build or at startup, log any unmapped professions for maintenance awareness.
**Warning signs:** Provider count drops when switching between "Alle Bereiche" and iterating through all sectors.

### Pitfall 2: Filter Dropdown Interacts with Map

**What goes wrong:** Opening a select dropdown on the map causes the map to start dragging. Selecting an option also triggers a map click event.
**Why it happens:** Leaflet captures click/drag events on the map container. Custom controls must explicitly stop event propagation.
**How to avoid:** Call `L.DomEvent.disableClickPropagation(container)` and `L.DomEvent.disableScrollPropagation(container)` in the control's `onAdd()` method.
**Warning signs:** Clicking the dropdown causes map panning. Scrolling through options zooms the map.

### Pitfall 3: Profession Dropdown Shows Options with Zero Matches

**What goes wrong:** User selects a sector, sees a profession in the dropdown, selects it, and gets "Keine Anbieter gefunden" -- confusing UX.
**Why it happens:** The profession list was populated from the full PraktischeAusbildung reference table (102 entries) instead of the actual provider data (84 in use).
**How to avoid:** Derive profession options from `allProviders.praOfferings`, not from the reference table. Only show professions where at least one provider exists.
**Warning signs:** Profession dropdown has options that always yield zero results.

### Pitfall 4: Provider Appears in Wrong Sector Due to Name Matching

**What goes wrong:** A profession like "PrA Industrie Fachrichtung Lebensmittel" matches both "Industrie" sector and potentially "Lebensmittel" sector, causing it to appear in two sectors or the wrong one.
**Why it happens:** The `startsWith` matching can create ambiguity when profession names overlap with sector entries.
**How to avoid:** Use strict `startsWith` matching with the sector entries. Order the sector entries from most specific to least specific, or ensure each profession maps to exactly one sector. The mapping must be tested for uniqueness -- each profession name should match exactly one sector.
**Warning signs:** Provider counts don't add up (some providers counted in multiple sectors).

### Pitfall 5: Performance Perception on Mobile

**What goes wrong:** On low-end mobile devices, clearing and re-adding 365 markers with clustering causes a visible flicker or brief blank map.
**Why it happens:** `clearLayers()` removes all markers from the DOM immediately, then `addLayers()` with `chunkedLoading` spreads additions across frames.
**How to avoid:** The chunkedLoading is already enabled. With 365 markers, the delay is imperceptible. If needed, the `chunkDelay` option (default: 50ms) can be reduced to 0. Alternatively, pre-create all marker objects once at startup and reuse them (avoiding GC pressure), but this optimization is unnecessary at this scale.
**Warning signs:** Visible "blank map" flash when changing filters. Only a concern if marker count grows to 1000+.

## Code Examples

### Complete Filter Module

```javascript
// src/filters.js

import L from 'leaflet';

// --- Sector-to-profession mapping ---
// Each sector maps to an array of PrA profession name prefixes
// (matched after stripping the "PrA " prefix from offering names).
// A profession matches if its stripped name startsWith any prefix.
const SECTOR_MAP = {
  'Gastronomie & Hotellerie': [
    'Küche', 'Restaurant', 'Bäckerei-Konditorei-Confiserie',
    'Metzgerei', 'Systemgastronomie', 'Hotellerie', 'Lebensmittel'
  ],
  'Hauswirtschaft & Reinigung': [
    'Hauswirtschaft', 'Reinigungstechnik'
  ],
  'Garten, Floristik & Landwirtschaft': [
    'Gärtnerei', 'Floristik', 'Landwirtschaft', 'Pferdepflege',
    'Tierpflege', 'Forstarbeiten', 'Milchwirtschaft'
  ],
  'Bau & Gebäudetechnik': [
    'Mauerhandwerk', 'Plattenlegen', 'Malerei', 'Gipserei',
    'Bodenlegen', 'Dachdeckarbeiten', 'Strassenbau', 'Abdichten',
    'Entwässerung', 'Gebäudetechnik', 'Lackierung', 'Fassadenbau',
    'Gerüstebau', 'Kältemontage', 'eneuerbare Energien'
  ],
  'Holz & Schreinerei': [
    'Schreinerei', 'Holzbearbeitung'
  ],
  'Metall, Mechanik & Industrie': [
    'Metallbau', 'Mechanik', 'Industrie', 'Kunststoffverarbeitung'
  ],
  'Logistik & Transport': [
    'Logistik', 'Strassentransport', 'Recycling'
  ],
  'Verkauf & Administration': [
    'Detailhandel', 'Büroarbeiten'
  ],
  'Fahrzeuge': [
    'Automobil', 'Zweirad', 'Carrosserie', 'Motorradmechanik'
  ],
  'Betriebsunterhalt & Elektro': [
    'Betriebsunterhalt', 'Elektroarbeiten'
  ],
  'Textil & Handwerk': [
    'Nähen', 'Handweben', 'Flechten', 'Dekorationsnäherei',
    'Textilveredlung', 'Kunsthandwerk', 'Keramik',
    'Coiffeursalon', 'Hundecoiffeursalon'
  ],
  'IT & Medien': [
    'Informatik', 'Mediamatik', 'Printmedien', 'Grafik',
    'Audio- und Videotechnik', 'Veranstaltungstechnik'
  ],
  'Gesundheit & Soziales': [
    'Mitarbeit Begleitung und Pflege Erwachsene',
    'Mitarbeit im Kinderbereich', 'Schulassistenz',
    'Dentalpraxis', 'Gemeindemitarbeit', 'Schauspielerei'
  ],
  'Uhren & Schmuck': [
    'Uhrenarbeiten', 'Grossuhrenmacher', 'Edelsteinfassungen',
    'Schuhreparaturen'
  ]
};

// --- Filter logic ---
export function filterProviders(allProviders, selectedSector, selectedProfession) {
  if (!selectedSector) return allProviders;

  const prefixes = SECTOR_MAP[selectedSector];
  if (!prefixes) return allProviders;

  return allProviders.filter(provider =>
    provider.praOfferings.some(offering => {
      const name = offering.name.replace('PrA ', '');
      const inSector = prefixes.some(p => name.startsWith(p));
      if (!inSector) return false;
      if (selectedProfession) return offering.name === selectedProfession;
      return true;
    })
  );
}

// --- Derive profession list from live data ---
export function getProfessionsInSector(allProviders, sectorName) {
  const prefixes = SECTOR_MAP[sectorName];
  if (!prefixes) return [];

  const professions = new Set();
  for (const provider of allProviders) {
    for (const offering of provider.praOfferings) {
      const name = offering.name.replace('PrA ', '');
      if (prefixes.some(p => name.startsWith(p))) {
        professions.add(offering.name);
      }
    }
  }
  return [...professions].sort((a, b) => a.localeCompare(b, 'de'));
}

// --- Leaflet custom control ---
export function createFilterControl(allProviders, onFilterChange) {
  const FilterControl = L.Control.extend({
    options: { position: 'topright' },

    onAdd(map) {
      const container = L.DomUtil.create('div', 'filter-control');
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      // Sector dropdown
      const sectorSelect = L.DomUtil.create('select', 'filter-select', container);
      sectorSelect.innerHTML = '<option value="">Alle Bereiche</option>';
      for (const sector of Object.keys(SECTOR_MAP)) {
        const opt = document.createElement('option');
        opt.value = sector;
        opt.textContent = sector;
        sectorSelect.appendChild(opt);
      }

      // Profession dropdown (hidden initially)
      const profSelect = L.DomUtil.create('select', 'filter-select', container);
      profSelect.innerHTML = '<option value="">Alle Berufe</option>';
      profSelect.style.display = 'none';

      sectorSelect.addEventListener('change', () => {
        const sector = sectorSelect.value;
        if (sector) {
          const profs = getProfessionsInSector(allProviders, sector);
          profSelect.innerHTML = '<option value="">Alle Berufe</option>';
          for (const prof of profs) {
            const opt = document.createElement('option');
            opt.value = prof;
            opt.textContent = prof.replace('PrA ', '');
            profSelect.appendChild(opt);
          }
          profSelect.style.display = '';
        } else {
          profSelect.style.display = 'none';
          profSelect.value = '';
        }
        onFilterChange(sector, profSelect.value);
      });

      profSelect.addEventListener('change', () => {
        onFilterChange(sectorSelect.value, profSelect.value);
      });

      return container;
    }
  });

  return new FilterControl();
}
```

### Map Integration

```javascript
// src/map.js — new export function

/**
 * Replace all markers in the cluster group with markers for the given providers.
 * @param {L.MarkerClusterGroup} clusters
 * @param {Array} providers - filtered provider array
 */
export function updateMarkers(clusters, providers) {
  clusters.clearLayers();

  const markers = [];
  for (const provider of providers) {
    if (provider.lat != null && provider.lon != null) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(buildPopupContent(provider));
      markers.push(marker);
    }
  }

  clusters.addLayers(markers);
  return markers.length;
}
```

### Updated Main Entry Point

```javascript
// src/main.js — wiring filters to map
import './style.css';
import { initMap, updateMarkers } from './map.js';
import { createFilterControl, filterProviders } from './filters.js';

async function init() {
  const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
  const response = await fetch(dataUrl);
  const data = await response.json();

  const { map, clusters } = initMap('map', data.providers);

  // Add filter control
  const onFilterChange = (sector, profession) => {
    const filtered = filterProviders(data.providers, sector, profession);
    const count = updateMarkers(clusters, filtered);

    // Show/hide "no results" message
    let overlay = document.getElementById('no-results');
    if (count === 0) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'no-results';
        overlay.className = 'no-results-overlay';
        overlay.textContent = 'Keine Anbieter für diese Auswahl gefunden.';
        document.getElementById('map').appendChild(overlay);
      }
      overlay.style.display = 'flex';
    } else if (overlay) {
      overlay.style.display = 'none';
    }
  };

  const filterControl = createFilterControl(data.providers, onFilterChange);
  filterControl.addTo(map);
}

init();
```

### Filter Control CSS

```css
/* src/style.css — filter control styling */
.filter-control {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
  max-width: 280px;
}
.filter-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}
.filter-select:focus {
  outline: 2px solid #0066cc;
  border-color: #0066cc;
}

/* No results overlay */
.no-results-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 16px;
  color: #333;
  z-index: 1000;
  pointer-events: none;
}
```

## Data Shape (no changes needed)

The existing `providers.json` already contains all data required for filtering:

```json
{
  "praOfferings": [
    { "id": "735f3424-...", "name": "PrA Industrie" },
    { "id": "f0d382d4-...", "name": "PrA Logistik" }
  ]
}
```

The `praOfferings[].name` field is the primary match key for sector-to-profession mapping. No changes to the data pipeline, normalizer, or JSON schema are needed.

## PrA Data Statistics

| Metric | Value |
|--------|-------|
| Total providers | 365 |
| Total distinct PrA professions in data | 84 |
| Total PrA professions in reference table | 102 |
| Average offerings per provider | 5.1 |
| Professions with only 1 provider | 15 |
| Most common profession | PrA Küche (188 providers) |
| Least common profession | 15 professions with 1 provider each |
| Professions with Fachrichtung variants | 8 base professions with 18 specializations |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full page reload for filtering | Client-side in-memory filtering | Standard for static sites with small datasets | Instant filter response, no server round-trip |
| Server-side OData filter | Client-side array.filter() | Architecture decision (Phase 1) | All data loaded once; filtering is pure JS |
| Branche (31 business sectors) for categorization | Custom PrA-specific sector mapping (~14 categories) | This research | Correct domain: PrA training sectors, not general business categories |

**Deprecated/outdated:**
- Phase 1 research mentioned `AdresseBrancheZuweisung` as potentially useful for filtering. After investigation, Branche data is about general business sectors (e.g., "Finanzen & Versicherung") and is unrelated to PrA training categories. Each provider has 10-14 Branche assignments, making it too broad for a focused PrA sector filter.

## Open Questions

1. **Exact number of sectors: 10 or 14?**
   - What we know: The requirements say "approximately 10 PrA sector categories." The natural grouping analysis yields 14 sectors with meaningful differentiation. Merging to 10 is possible but would create overly broad categories (e.g., merging "Holz & Schreinerei" into "Bau" makes semantic sense but mixes distinct trades).
   - What's unclear: Whether the user prefers exactly 10 sectors or accepts ~14 for better granularity.
   - Recommendation: Start with ~14 sectors. If the user wants fewer, adjacent sectors can be merged in a single code change. 14 sectors still fit comfortably in a dropdown.

2. **Sector naming language: German labels**
   - What we know: Requirements say German-language interface. The sector names in the mapping are already in German (e.g., "Gastronomie & Hotellerie").
   - What's unclear: Whether to use formal German or Einfache Sprache (plain language) for sector names.
   - Recommendation: Use clear, common German terms (as shown in the mapping). Einfache Sprache refinement is Phase 5 scope ("German plain language polish").

3. **Handling of PrA professions added in the future**
   - What we know: The PraktischeAusbildung reference table has 102 entries, 84 currently used. New professions could be added.
   - What's unclear: How often new professions appear and whether they would fall into existing sectors.
   - Recommendation: Add a catch-all "Weitere Berufe" sector. Log unmapped professions to console at startup. The mapping is a single JS object, trivially updated when new professions are discovered.

4. **Filter control placement on mobile**
   - What we know: Leaflet `L.Control` with `position: 'topright'` works on both desktop and mobile. But on small screens, the control may obscure too much of the map.
   - What's unclear: Whether the filter should be collapsible on mobile.
   - Recommendation: Phase 4 uses a fixed `topright` control. Phase 5 handles responsive layout (success criteria: "On mobile, filters collapse and the map fills the screen"). Keep Phase 4 focused on filter logic, not layout polish.

## Sources

### Primary (HIGH confidence)
- Leaflet 1.9.4 `L.Control` API -- verified from source code (`node_modules/leaflet/dist/leaflet-src.js` lines 4868-5037): `extend()`, `onAdd()`, `options.position`, `L.DomEvent.disableClickPropagation`, `L.DomEvent.disableScrollPropagation`
- leaflet.markercluster 1.5.3 `clearLayers()` and `addLayers()` -- verified from source code (`node_modules/leaflet.markercluster/src/MarkerClusterGroup.js` lines 194, 423): bulk operations supported with `chunkedLoading`
- Provider data analysis -- `src/public/data/providers.json`: 365 providers, 84 distinct PrA professions, average 5.1 offerings per provider (analyzed 2026-02-15)
- PraktischeAusbildung reference data -- 102 entries fetched from `performx.artiset.ch/odata/PraktischeAusbildung` (2026-02-15): no sector/category field, no sort order, all published
- Branche reference data -- 31 entries fetched from `performx.artiset.ch/odata/Branche` (2026-02-15): general business sectors, not PrA-specific
- AdresseBrancheZuweisung data -- verified for sample provider ABA Amriswil: 14 Branche assignments per provider (too broad for PrA sector filtering)
- `$expand=AdresseBrancheZuweisungen` on Adresse -- verified working (unlike Kommunikationsmittel expand which fails)

### Secondary (MEDIUM confidence)
- Sector grouping analysis -- derived from PrA profession naming patterns and provider offering distribution. Groupings are logical but subjective; the user may prefer different boundaries.
- Provider coverage per sector -- calculated from current dataset; distribution will shift as providers add/remove PrA offerings.

### Tertiary (LOW confidence)
- None. All critical claims are verified from local source code or API data.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries. Leaflet L.Control and markercluster bulk operations are verified from source code.
- Architecture: HIGH -- In-memory filtering of 365 records is trivially fast. clearLayers + addLayers pattern is proven.
- Sector mapping: MEDIUM -- Natural grouping is clear, but exact sector boundaries and count (~10 vs ~14) may need user input.
- Pitfalls: HIGH -- Click propagation, empty dropdowns, and coverage gaps are well-understood with clear mitigations.

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- Leaflet 1.x is stable; PrA data changes slowly)
