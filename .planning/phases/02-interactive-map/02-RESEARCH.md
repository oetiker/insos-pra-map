# Phase 2: Interactive Map - Research

**Researched:** 2026-02-15
**Domain:** Leaflet interactive map with marker clustering on a static site
**Confidence:** HIGH

## Summary

Phase 2 renders 365 PrA provider locations on an interactive OpenStreetMap-based map of Switzerland with marker clustering. The technical foundation is solid: Leaflet 1.9.4 is already installed, provider data with WGS84 coordinates is baked into a static JSON file at build time, and the Vite + Tailwind stack is configured and working. The main implementation work is: (1) initialize a full-viewport Leaflet map with SOSM tiles, (2) fix the well-known Vite + Leaflet marker icon issue, (3) install and configure leaflet.markercluster to handle dense areas like Zurich and Bern, and (4) load providers from the static JSON and add them as clustered markers.

The data is small (365 providers, ~120KB JSON) and already geocoded to WGS84 coordinates, so there is no performance concern with loading all markers at once. leaflet.markercluster 1.5.3 handles up to 50,000 markers and is verified compatible with Leaflet 1.9.4. The SOSM tile server (`tile.osm.ch`) is operational and serves both standard and Swiss-style tiles up to zoom level 19 without authentication.

The main technical gotcha is that leaflet.markercluster is not an ES module -- it must be imported as a side-effect (`import 'leaflet.markercluster'`) after importing Leaflet, as it attaches to the global `L` object. The Leaflet default marker icons also break under Vite's asset bundling and require explicit import of icon PNGs with path overrides.

**Primary recommendation:** Install leaflet.markercluster, create a `src/map.js` module that initializes Leaflet with SOSM tiles and marker clustering, and wire it into the existing `src/main.js` which already loads the provider data.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 (already installed) | Interactive map rendering | Most mature lightweight mapping library. 42KB gzipped. Massive plugin ecosystem. Already in devDependencies. |
| leaflet.markercluster | 1.5.3 (to install) | Marker clustering for dense areas | Official Leaflet clustering plugin. Handles 50K markers. Drop-in solution with animated transitions. Verified compatible with Leaflet 1.9.4. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| leaflet-gesture-handling | 1.x | Cooperative scroll (two-finger to pan) | Optional for Phase 2. Prevents mobile scroll trap. Can defer to Phase 5 (polish) if map is full-viewport. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| leaflet.markercluster | Supercluster (by Mapbox) | Lower-level algorithm-only library. No UI, no animations, requires manual rendering. Overkill when markercluster provides complete drop-in solution. |
| SOSM tiles | Standard OSM tiles (tile.openstreetmap.org) | Global fallback. SOSM is preferred because it is hosted by Swiss OSM Association, optimized for Switzerland, and has no restrictive usage policy. Standard OSM tiles have a fair-use tile usage policy. |
| Default Leaflet markers | Custom SVG/icon markers | Phase 2 uses default blue pins. Custom markers can be added in Phase 5 (polish) without any architectural change. |

**Installation:**
```bash
npm install leaflet.markercluster
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── index.html          # Single page shell (add map container div)
├── main.js             # App entry: loads data, initializes map
├── map.js              # NEW: Leaflet map init, marker management
├── style.css           # Tailwind + Leaflet CSS imports
└── public/
    └── data/
        └── providers.json  # Static provider data (365 records)
```

### Pattern 1: Leaflet + Vite Icon Fix

**What:** Fix the well-known issue where Leaflet's default marker icons break under Vite's asset bundling. Vite imports PNGs as objects with a `.src` property, but Leaflet expects string URLs.

**When to use:** Always, when using Leaflet with Vite. This is required, not optional.

**Verified approach:**
```javascript
// src/map.js
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.prototype.options.iconUrl = markerIcon;
L.Icon.Default.prototype.options.iconRetinaUrl = markerIcon2x;
L.Icon.Default.prototype.options.shadowUrl = markerShadow;
L.Icon.Default.imagePath = '';
```

**Source:** [Leaflet markers with Vite build](https://willschenk.com/labnotes/2024/leaflet_markers_with_vite_build/) (verified 2025), [Leaflet issue #9466](https://github.com/Leaflet/Leaflet/issues/9466)

### Pattern 2: MarkerCluster as Side-Effect Import

**What:** leaflet.markercluster is not an ES module. It attaches `L.MarkerClusterGroup` to the global Leaflet namespace. It must be imported after Leaflet as a side-effect.

**When to use:** Always, when importing markercluster with a bundler (Vite, Webpack, etc.)

**Verified approach:**
```javascript
// Import order matters
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Now L.markerClusterGroup is available
const clusters = L.markerClusterGroup({
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  chunkedLoading: true
});
```

**Source:** [GitHub issue #874](https://github.com/Leaflet/Leaflet.markercluster/issues/874) (verified workaround)

### Pattern 3: Switzerland Map Bounds

**What:** Initialize the map showing all of Switzerland, with bounds that match the provider data extent.

**When to use:** On map initialization.

**Data-derived bounds:**
The 365 providers span:
- Latitude: 45.8616 to 47.7135 (south to north)
- Longitude: 6.0753 to 9.8776 (west to east)
- Center: approximately 46.79, 7.98

**Recommended approach:**
```javascript
// Switzerland bounds with padding
const swissBounds = L.latLngBounds(
  [45.7, 5.9],   // SW corner (slight padding beyond data extent)
  [47.9, 10.6]   // NE corner
);

const map = L.map('map', {
  maxBounds: swissBounds.pad(0.1),  // Allow slight overshoot
  minZoom: 7,                        // Don't zoom out past Switzerland
  maxZoom: 18                        // Match SOSM tile availability
});

map.fitBounds(swissBounds);
```

### Pattern 4: Full Data Load with Clustered Markers

**What:** Load all 365 providers at once from the static JSON, create markers, and add them to the MarkerClusterGroup.

**When to use:** On page load after map initialization. The existing `main.js` already loads the data.

**Example:**
```javascript
// src/map.js
export function initMap(providers) {
  const map = L.map('map').fitBounds([
    [45.7, 5.9], [47.9, 10.6]
  ]);

  // SOSM tiles
  L.tileLayer('https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Clustered markers
  const clusters = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    chunkedLoading: true
  });

  for (const provider of providers) {
    const marker = L.marker([provider.lat, provider.lon]);
    marker.bindPopup(provider.name); // Minimal popup for Phase 2
    clusters.addLayer(marker);
  }

  map.addLayer(clusters);
  return { map, clusters };
}
```

```javascript
// src/main.js (modified)
import './style.css';
import { initMap } from './map.js';

async function init() {
  const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
  const response = await fetch(dataUrl);
  const data = await response.json();
  initMap(data.providers);
}

init();
```

### Anti-Patterns to Avoid

- **Creating markers without a ClusterGroup:** Never add 365 individual markers directly to the map. Always use `L.markerClusterGroup()`. Adding markers directly causes DOM bloat and visual overlap at low zoom levels.
- **Importing leaflet.markercluster before leaflet:** The side-effect import requires `L` to already exist on the window. Import leaflet first, then markercluster.
- **Using `L.map('map', { center: [...], zoom: N })` for Switzerland:** Use `fitBounds()` instead. Hard-coded zoom levels look wrong on different screen sizes. `fitBounds` adapts automatically.
- **Forgetting to import MarkerCluster CSS:** Without `MarkerCluster.css` and `MarkerCluster.Default.css`, cluster icons will be invisible or unstyled. These CSS files are separate from Leaflet's CSS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marker clustering | Custom clustering algorithm | `leaflet.markercluster` | Handles viewport culling, animated transitions, spiderfying, click-to-zoom -- hundreds of edge cases solved |
| Tile layer management | Custom tile loading | `L.tileLayer()` | Handles retina detection, zoom animation, tile caching, error fallback |
| Map viewport constraints | Manual zoom/pan limits | `maxBounds`, `minZoom`, `maxZoom` options | Built-in Leaflet options with proper edge handling and animation |
| Marker icon assets | Copy PNG files manually | Import from `leaflet/dist/images/` | Vite handles asset hashing and path resolution when imported as modules |
| Cluster styling | Custom cluster HTML/CSS | `MarkerCluster.Default.css` | Production-ready styles with small/medium/large cluster size tiers |

**Key insight:** For 365 markers on a Leaflet map with clustering, the entire implementation is configuration of existing libraries, not custom code. The only custom code is the glue that loads data and creates markers.

## Common Pitfalls

### Pitfall 1: Leaflet Marker Icons Broken in Vite Build

**What goes wrong:** Default blue pin markers display as broken images (small square) in both dev and production builds.
**Why it happens:** Leaflet detects its icon URLs by parsing `<link>` tags in the DOM to find `leaflet.css`, then constructs icon paths relative to that CSS file. Vite bundles CSS differently, breaking this detection mechanism.
**How to avoid:** Explicitly import marker icon PNGs and override `L.Icon.Default` options (see Pattern 1 above). This must be done before creating any markers.
**Warning signs:** Marker shows as a small gray square or is completely invisible. Console may show 404 errors for `marker-icon.png`.

### Pitfall 2: MarkerCluster CSS Not Loaded

**What goes wrong:** Cluster circles appear as unstyled rectangles or are invisible.
**Why it happens:** `leaflet.markercluster` ships its CSS separately from its JS. Importing only the JS module does not include the CSS.
**How to avoid:** Import both CSS files explicitly:
```javascript
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
```
**Warning signs:** Clusters appear as plain text numbers without circular background, or are invisible.

### Pitfall 3: SOSM Tile Server Unavailability

**What goes wrong:** Map shows gray squares (tiles fail to load) because the SOSM tile server is down or unreachable.
**Why it happens:** The SOSM tile server is run by a volunteer Swiss association. There is no SLA or uptime guarantee.
**How to avoid:** Configure a fallback tile URL. Leaflet's `L.tileLayer` has an `errorTileUrl` option. Alternatively, use the standard OSM tile server (`tile.openstreetmap.org`) as the primary or fallback.
**Warning signs:** Gray tiles, console errors with 503/504 from tile.osm.ch.

### Pitfall 4: Map Container Has Zero Height

**What goes wrong:** Map does not appear at all, or appears as a thin line.
**Why it happens:** Leaflet requires the map container `<div>` to have explicit dimensions (height). Without CSS giving it height, the div collapses to 0px.
**How to avoid:** Give the map container explicit height in CSS. For a full-viewport map: `#map { height: 100vh; width: 100%; }` and ensure `html, body { margin: 0; height: 100%; }`.
**Warning signs:** Map container exists in DOM but has zero height. `map.invalidateSize()` does not help if the container has no CSS height.

### Pitfall 5: Mobile Scroll Trap

**What goes wrong:** Users scrolling a page get "trapped" in the map -- their scroll/swipe gesture pans the map instead of scrolling the page.
**Why it happens:** Leaflet captures all touch and scroll events on the map container by default.
**How to avoid:** For Phase 2, if the map is the entire viewport, this is not an issue (there is nothing to scroll past). If the map is part of a longer page, use `leaflet-gesture-handling` plugin or disable `scrollWheelZoom` until the user clicks the map. This is more relevant for Phase 5 (layout polish).
**Warning signs:** Users on mobile cannot scroll past the map section.

## Code Examples

### Complete Map Initialization Module

```javascript
// src/map.js
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marker clustering
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet default marker icons (Vite asset bundling issue)
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.prototype.options.iconUrl = markerIcon;
L.Icon.Default.prototype.options.iconRetinaUrl = markerIcon2x;
L.Icon.Default.prototype.options.shadowUrl = markerShadow;
L.Icon.Default.imagePath = '';

// Switzerland bounds (covers all 365 provider locations with padding)
const SWISS_BOUNDS = L.latLngBounds(
  [45.7, 5.9],   // Southwest
  [47.9, 10.6]   // Northeast
);

/**
 * Initialize the Leaflet map with SOSM tiles and marker clustering.
 * @param {string} containerId - DOM element ID for the map container
 * @param {Array} providers - Array of provider objects with lat, lon, name
 * @returns {{ map: L.Map, clusters: L.MarkerClusterGroup }}
 */
export function initMap(containerId, providers) {
  const map = L.map(containerId, {
    maxBounds: SWISS_BOUNDS.pad(0.1),
    minZoom: 7,
    maxZoom: 18
  });

  map.fitBounds(SWISS_BOUNDS);

  // SOSM Swiss-style tiles (Swiss OpenStreetMap Association)
  L.tileLayer('https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Marker cluster group
  const clusters = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    chunkedLoading: true
  });

  // Create markers for all providers
  for (const provider of providers) {
    if (provider.lat && provider.lon) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(`<strong>${provider.name}</strong>`);
      clusters.addLayer(marker);
    }
  }

  map.addLayer(clusters);

  return { map, clusters };
}
```

### HTML Structure

```html
<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>INSOS PrA Map</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body class="m-0 h-screen">
    <div id="map" class="h-full w-full"></div>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

### CSS Setup

```css
/* src/style.css */
@import "tailwindcss";

/* Ensure map fills viewport */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}
```

Note: Leaflet CSS and MarkerCluster CSS are imported in `map.js` via JavaScript imports, not in `style.css`. Vite handles both approaches, but JS imports are conventional for library CSS in the Vite ecosystem.

## SOSM Tile Server Details

**Verified 2026-02-15:** Both tile URLs return HTTP 200 up to zoom level 19.

| Style | URL Pattern | Verified |
|-------|-------------|----------|
| Standard (Carto) | `https://tile.osm.ch/switzerland/{z}/{x}/{y}.png` | Yes (HTTP 200 at z=8, z=18) |
| Swiss Style | `https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png` | Yes (HTTP 200 at z=8, z=18, z=19) |

**Recommendation:** Use Swiss Style (`osm-swiss-style`). It provides a cleaner, more readable base map suited for a pin-overlay application. Standard Carto is also fine.

**Attribution required:** `"(c) OpenStreetMap contributors"`

**Fallback:** If SOSM is unavailable, the standard OSM tile server (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) works globally but has a [fair use tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Provider Data Shape (from Phase 1)

The static JSON at `src/public/data/providers.json` has this structure:

```json
{
  "providers": [
    {
      "id": "uuid",
      "name": "ABA Amriswil",
      "street": "Arbonerstrasse 17",
      "plzOrt": "8580 Amriswil",
      "fullAddress": "ABA Amriswil\nArbonerstrasse 17\n8580 Amriswil",
      "lat": 47.5449,
      "lon": 9.3020,
      "approximate": false,
      "praOfferings": [{ "id": "uuid", "name": "PrA Industrie" }],
      "praCount": 8,
      "website": null,
      "phone": null,
      "email": null
    }
  ],
  "meta": {
    "count": 365,
    "generatedAt": "2026-02-14T23:48:49.747Z"
  }
}
```

**Key facts for Phase 2:**
- 365 providers total, all with non-null lat/lon
- 363 have street-level coordinates, 2 have approximate (city-center) coordinates
- Latitude range: 45.86 to 47.71 / Longitude range: 6.08 to 9.88
- Data is loaded via `fetch(import.meta.env.BASE_URL + 'data/providers.json')`
- `main.js` already has the fetch + parse logic

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side proxy + live API | Static JSON baked at build time | Phase 1 quick task (2026-02-15) | Map loads from static file, no server needed. Simplifies Phase 2. |
| Express server | Pure static site (Vite) | Phase 1 quick task | No /api/providers endpoint. Data loaded via fetch from static file. |
| Leaflet 2.0 alpha | Leaflet 1.9.4 stable | Decision from STACK.md | 1.9.4 is production-stable, plugin ecosystem compatible. 2.0 is alpha. |

**Deprecated/outdated:**
- `leaflet.markercluster` has no ESM build. PR #984 is open but unmerged. Use side-effect import pattern.
- `L.Icon.Default` auto-detection of icon paths is broken with all modern bundlers (Vite, Webpack 5+). Manual icon path override is the standard fix.

## Open Questions

1. **SOSM tile server reliability**
   - What we know: Tiles load successfully as of 2026-02-15. Service is run by the Swiss OpenStreetMap Association (volunteer).
   - What's unclear: There is no published SLA or uptime guarantee.
   - Recommendation: Use SOSM as primary. Optionally add a fallback tile layer to standard OSM. Not critical for Phase 2 -- can address in Phase 5 if issues arise.

2. **Marker popup content depth for Phase 2**
   - What we know: Phase 3 is dedicated to "Provider Details" with full contact info. Phase 2 success criteria only require pins on the map.
   - What's unclear: Whether Phase 2 markers should show any popup at all, or just the provider name.
   - Recommendation: Show provider name only in a minimal popup (`bindPopup(provider.name)`). Full detail popups are Phase 3 scope. This keeps Phase 2 focused.

3. **`maxClusterRadius` tuning**
   - What we know: Default is 80px. Switzerland has dense provider clusters in Zurich, Bern, Basel, and Lausanne.
   - What's unclear: Optimal radius for 365 Swiss providers.
   - Recommendation: Start with 50px (tighter clusters, more geographic precision). Adjust after visual testing with real data. This is a single configuration value, trivial to change.

## Sources

### Primary (HIGH confidence)
- Leaflet 1.9.4 installed locally (`node_modules/leaflet/package.json`) -- version verified
- [Leaflet.markercluster GitHub](https://github.com/Leaflet/Leaflet.markercluster) -- v1.5.3, API documentation, CSS file locations
- [Leaflet.markercluster ESM issue #874](https://github.com/Leaflet/Leaflet.markercluster/issues/874) -- side-effect import pattern
- [Leaflet marker icons with Vite](https://willschenk.com/labnotes/2024/leaflet_markers_with_vite_build/) -- icon fix pattern verified
- [Leaflet issue #9466](https://github.com/Leaflet/Leaflet/issues/9466) -- default marker icon broken with bundlers
- SOSM tile server (`tile.osm.ch`) -- HTTP 200 verified for both `switzerland/` and `osm-swiss-style/` at zoom levels 8, 18, 19
- [SOSM tile service page](https://sosm.ch/projects/tile-service/) -- available tile styles and attribution
- Provider data analysis: 365 records, lat 45.86-47.71, lon 6.08-9.88, all non-null coordinates

### Secondary (MEDIUM confidence)
- [leaflet-vite example](https://github.com/simon04/leaflet-vite) -- reference Leaflet + Vite integration
- [leaflet-gesture-handling](https://github.com/elmarquis/Leaflet.GestureHandling) -- cooperative scroll plugin for mobile
- [Leaflet zoom levels guide](https://leafletjs.com/examples/zoom-levels/) -- zoom level documentation
- [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) -- fair use for standard OSM tiles

### Tertiary (LOW confidence)
- `leaflet.markercluster.esm` npm package -- unofficial ESM fork, 1 year stale, not recommended over side-effect import
- `@bepo65/leaflet.markercluster` -- community patched version, unclear maintenance status

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Leaflet 1.9.4 verified installed, markercluster 1.5.3 verified compatible, SOSM tiles verified working
- Architecture: HIGH -- pattern is straightforward (load JSON, create markers, add to cluster group), well-documented in official Leaflet and markercluster repos
- Pitfalls: HIGH -- Vite icon fix and ESM import issues are well-documented with verified workarounds, SOSM availability tested

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- Leaflet 1.x and markercluster 1.x are in maintenance mode, unlikely to change)
