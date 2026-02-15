# Phase 5: Polish & Shareability - Research

**Researched:** 2026-02-15
**Domain:** Responsive layout, i18n/plain language, URL state management, performance
**Confidence:** HIGH

## Summary

Phase 5 transforms the existing full-viewport Leaflet map with overlaid L.Control filter dropdowns into a polished, responsive application with three capabilities: (1) a desktop sidebar layout that collapses on mobile, (2) German Einfache Sprache throughout the interface, and (3) shareable URLs that preserve filter state and map position via URL hash fragments.

The current codebase is minimal (4 JS/CSS files, ~230 lines of app code) with a ~400KB static JSON data file, a 197KB JS bundle (60KB gzipped), and 22KB CSS (8KB gzipped). The app already uses German text for filter labels and the no-results message. The main architectural change is extracting the filter UI from a Leaflet L.Control into a standalone sidebar DOM element, then using Tailwind's responsive utilities to show it alongside the map on desktop and collapse it on mobile.

**Primary recommendation:** Use URL hash fragments (not query parameters) for state persistence, Tailwind responsive breakpoints for layout, and a simple toggle button for mobile filter visibility. No new dependencies are needed.

## Standard Stack

### Core (already installed -- no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 | Map rendering, state API | Already in use; `getCenter()`, `getZoom()`, `setView()` provide URL state hooks |
| Tailwind CSS | 4.1.18 | Responsive layout utilities | Already in use; `md:` breakpoint prefix handles desktop/mobile split |
| Vite | 7.3.1 | Build tooling | Already in use; production builds are fast and small |

### Supporting (no new packages needed)

| Capability | Implementation | Why No Library |
|------------|----------------|----------------|
| URL state | `window.location.hash` + `hashchange` event | 10-15 lines of vanilla JS; no library warranted |
| Responsive sidebar | Tailwind `hidden md:block` + JS toggle | Standard CSS pattern; no component library needed |
| German text | Static strings in source | Only ~8 user-facing strings; no i18n framework needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw hash manipulation | leaflet-hash plugin | Plugin only handles map position, not filter state; adds dependency for trivial feature |
| Raw hash manipulation | URLSearchParams (query params) | Query params work but: GitHub Pages serves 404 for unknown paths with query strings on direct navigation; hash fragments are purely client-side and work perfectly with static hosting |
| Vanilla JS sidebar toggle | leaflet-sidebar plugin | Last updated 2021 (v0.2.4); adds dependency for something achievable with 5 lines of JS + Tailwind classes |
| Static German strings | i18n library (i18next) | Only ~8 visible strings, all German; i18n framework is massive overkill |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Current Structure (unchanged files)
```
src/
├── index.html         # Page shell (needs layout restructure)
├── main.js            # App init, wiring (needs URL state + layout changes)
├── map.js             # Leaflet map + markers (unchanged)
├── filters.js         # Filter logic + L.Control (refactor: extract from L.Control)
├── style.css          # Styles (add responsive sidebar styles)
└── public/data/
    └── providers.json # Static data (unchanged, ~400KB)
```

### Pattern 1: Sidebar Layout with Responsive Collapse

**What:** Replace the Leaflet L.Control filter overlay with a sidebar `<div>` in the HTML. On desktop (md: breakpoint, 768px+), the sidebar sits beside the map. On mobile, it collapses behind a toggle button.

**When to use:** When UI controls need more space than a map overlay provides, and the app needs different layouts per viewport.

**Current state:**
```html
<!-- Current: map fills viewport, filters are a Leaflet control overlay -->
<body class="m-0 h-screen">
  <div id="map" class="h-full w-full"></div>
</body>
```

**Target state:**
```html
<!-- Target: sidebar + map side by side on desktop, collapsible on mobile -->
<body class="m-0 h-screen flex flex-col md:flex-row">
  <!-- Mobile toggle button: visible only on mobile -->
  <button id="filter-toggle" class="md:hidden fixed top-3 right-3 z-[1000] ...">
    Filter
  </button>

  <!-- Sidebar: hidden on mobile by default, always visible on desktop -->
  <aside id="sidebar" class="hidden md:flex flex-col w-full md:w-72 ...">
    <h1>PrA Ausbildungsplätze</h1>
    <select id="sector-select">...</select>
    <select id="profession-select">...</select>
  </aside>

  <!-- Map: fills remaining space -->
  <div id="map" class="flex-1 h-full"></div>
</body>
```

**Key Tailwind classes:**
- `hidden md:flex` -- hidden on mobile, flex on desktop (768px+)
- `md:w-72` -- fixed sidebar width on desktop
- `flex-1` -- map takes remaining width
- `fixed top-3 right-3 z-[1000]` -- mobile toggle floats above map
- `md:hidden` -- toggle button hidden on desktop

Source: [Tailwind CSS Responsive Design docs](https://tailwindcss.com/docs/responsive-design)

### Pattern 2: URL Hash State for Filter + Map Position

**What:** Encode the current filter selections and map view into the URL hash fragment. Read the hash on page load to restore state. Update the hash (without pushing history) when user changes filters or moves the map.

**When to use:** Sharing application state via URL on static sites where query parameters may cause 404s.

**Hash format:**
```
#sector=Gastronomie%20%26%20Hotellerie&profession=PrA%20Küche&lat=47.37&lng=8.54&z=12
```

**Key implementation details:**
```javascript
// Write state to hash (use replaceState to avoid polluting browser history)
function writeHash(sector, profession, map) {
  const params = new URLSearchParams();
  if (sector) params.set('sector', sector);
  if (profession) params.set('profession', profession);
  const center = map.getCenter();
  params.set('lat', center.lat.toFixed(4));
  params.set('lng', center.lng.toFixed(4));
  params.set('z', map.getZoom());
  history.replaceState(null, '', '#' + params.toString());
}

// Read state from hash on page load
function readHash() {
  const hash = window.location.hash.slice(1);  // remove '#'
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return {
    sector: params.get('sector') || '',
    profession: params.get('profession') || '',
    lat: parseFloat(params.get('lat')),
    lng: parseFloat(params.get('lng')),
    z: parseInt(params.get('z'), 10)
  };
}

// Listen for back/forward navigation
window.addEventListener('hashchange', () => {
  const state = readHash();
  if (state) applyState(state);
});
```

**Why hash fragments over query parameters:**
1. Hash fragments are never sent to the server -- they work purely client-side
2. GitHub Pages returns 404 for unknown paths but ignores hash fragments entirely
3. `URLSearchParams` API works on hash content just as well as query strings
4. No need for a 404.html redirect hack

**Why `replaceState` instead of `pushState`:**
- Map panning and filter changes are continuous actions, not discrete navigation steps
- `pushState` would flood the browser history with hundreds of entries from map drags
- `replaceState` updates the URL without adding history entries
- The user can still bookmark or copy the current URL at any moment

Source: [MDN History.replaceState()](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)

### Pattern 3: Debounced Map Move Listener

**What:** Attach a `moveend` event listener to the Leaflet map to update the URL hash when the user finishes panning/zooming.

**Why debounce via `moveend` (not `move`):**
- `move` fires on every animation frame during panning -- would cause hundreds of `replaceState` calls
- `moveend` fires once after the user stops moving -- exactly what we need

```javascript
map.on('moveend', () => {
  writeHash(currentSector, currentProfession, map);
});
```

Source: [Leaflet API Reference - Map Events](https://leafletjs.com/reference.html)

### Pattern 4: Filter UI Refactoring (L.Control to Sidebar DOM)

**What:** Currently, `createFilterControl()` in `filters.js` creates a Leaflet `L.Control.extend()` that builds `<select>` elements inside `onAdd()`. For the sidebar layout, the filter dropdowns need to live in a sidebar `<div>` outside the map container.

**Refactoring approach:**
1. Move the `<select>` elements into `index.html` as static markup (no need for dynamic DOM creation)
2. Populate options from data in `main.js` or a new init function in `filters.js`
3. Remove the `L.Control.extend()` wrapper entirely
4. Keep the filtering logic (`filterProviders`, `getActiveSectors`, `getProfessionsInSector`) unchanged

**Before (current):**
```javascript
// filters.js -- creates Leaflet control with embedded selects
export function createFilterControl(allProviders, onFilterChange) {
  const FilterControl = L.Control.extend({
    onAdd() { /* builds selects here */ }
  });
  return new FilterControl();
}
// main.js
createFilterControl(data.providers, onFilterChange).addTo(map);
```

**After (target):**
```javascript
// filters.js -- populates existing DOM selects, no Leaflet dependency
export function initFilters(allProviders, onFilterChange) {
  const sectorSelect = document.getElementById('sector-select');
  const profSelect = document.getElementById('profession-select');
  // populate options, wire event listeners...
}
// main.js
initFilters(data.providers, onFilterChange);
```

This also removes the `import L from 'leaflet'` dependency from `filters.js`, making it a pure DOM module.

### Anti-Patterns to Avoid

- **Storing state in query parameters on GitHub Pages:** Direct URL access with query params on GitHub Pages returns 404 unless a 404.html redirect hack is in place. Use hash fragments instead.
- **Using `pushState` for continuous changes:** Map panning and filter toggling are not discrete navigation events. Using `pushState` creates an unusable browser history. Use `replaceState`.
- **Keeping filter UI as L.Control for sidebar layout:** L.Control is designed to overlay on the map. Moving to a sidebar requires the DOM element to be outside the map container, making L.Control unnecessary overhead.
- **Using a CSS media query breakpoint for sidebar and a different one for JS toggle:** The JS toggle visibility must match the CSS breakpoint. Use `md` (768px) consistently in both CSS classes and any JS breakpoint checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parameter encoding | Custom string serializer | `URLSearchParams` API | Handles encoding of special characters (`&`, spaces, umlauts) correctly |
| Responsive breakpoints | Custom media query listeners | Tailwind `md:` prefix classes | Built-in, consistent, no JS needed for layout |
| Map state serialization | Custom lat/lng formatters | `map.getCenter()` + `map.getZoom()` + `map.setView()` | Leaflet's own API handles all edge cases |
| Mobile sidebar animation | Custom CSS transitions | Tailwind `transition-transform duration-300` | Built-in utility classes handle it cleanly |

**Key insight:** Every feature in this phase is achievable with existing APIs and Tailwind utilities. The temptation is to pull in plugins (leaflet-hash, leaflet-sidebar, i18n libraries), but the scope is small enough that vanilla solutions are simpler, more maintainable, and add zero bytes to the bundle.

## Common Pitfalls

### Pitfall 1: Hash Fragment Encoding of German Characters

**What goes wrong:** Sector names contain umlauts, ampersands, and spaces (e.g., "Gastronomie & Hotellerie", "Bau & Gebäudetechnik"). If these are placed in the hash without encoding, they break URL parsing.
**Why it happens:** Developers manually construct hash strings with concatenation instead of using URLSearchParams.
**How to avoid:** Always use `URLSearchParams` for both reading and writing hash content. It handles `encodeURIComponent` / `decodeURIComponent` automatically.
**Warning signs:** Filter state doesn't restore correctly for sectors with `&` in their names.

### Pitfall 2: Map `setView` Before Map Is Ready

**What goes wrong:** If you call `map.setView()` from hash state before the map has finished initializing, the view may not apply correctly or may conflict with `fitBounds(SWISS_BOUNDS)`.
**Why it happens:** `initMap()` currently calls `map.fitBounds(SWISS_BOUNDS)` unconditionally. If hash state contains a different view, both compete.
**How to avoid:** Check for hash state BEFORE calling `fitBounds`. If hash state exists, use `setView(lat, lng, zoom)` instead of `fitBounds`. If no hash state, keep the current `fitBounds` behavior.
**Warning signs:** Map briefly shows all of Switzerland before jumping to the hash-specified view.

### Pitfall 3: Circular Event Loops (Filter Change -> Hash Update -> Filter Change)

**What goes wrong:** Changing a filter updates the hash. The `hashchange` event fires, which reads the hash and applies filters, which updates the hash again, creating an infinite loop.
**Why it happens:** No guard against re-entrancy in the hash update flow.
**How to avoid:** Use a flag (`isUpdatingHash = true`) before programmatic hash changes, and skip `hashchange` handling when the flag is set. Or: only listen to `hashchange` for browser back/forward navigation, and handle programmatic state changes directly without going through the hash listener.
**Warning signs:** Browser becomes unresponsive, console shows rapid repeated calls.

### Pitfall 4: Mobile Sidebar Covering Map Interaction

**What goes wrong:** On mobile, the expanded sidebar covers the map entirely. Users cannot interact with the map while the sidebar is open. Or: the sidebar partially covers the map but touch events bleed through.
**Why it happens:** Z-index and pointer-event conflicts between sidebar and map.
**How to avoid:** On mobile, make the sidebar a full-width overlay (or slide-over panel) with a semi-transparent backdrop. Tapping the backdrop closes the sidebar. Ensure the map is not interactive while the sidebar is open.
**Warning signs:** Users cannot close the sidebar once opened, or map zooms unexpectedly behind the sidebar.

### Pitfall 5: Leaflet Map Not Resizing After Sidebar Visibility Change

**What goes wrong:** When the sidebar appears/disappears on desktop, the map container size changes. Leaflet doesn't automatically detect container size changes, so tiles may be missing or the map may display incorrectly.
**Why it happens:** Leaflet calculates its viewport on initialization. Container resize requires explicit `invalidateSize()` call.
**How to avoid:** Call `map.invalidateSize()` after any layout change that affects the map container's dimensions. Use a short `setTimeout` (50-100ms) to let the CSS transition complete before calling it.
**Warning signs:** Gray areas in the map, tiles not loading at edges, map center shifting after sidebar toggle.

### Pitfall 6: Performance -- Blocking Data Fetch Before Map Render

**What goes wrong:** The 400KB `providers.json` fetch blocks map rendering. The user sees a blank screen for 1-2 seconds on mobile.
**Why it happens:** The current `init()` function fetches data, initializes the map, and creates markers sequentially.
**How to avoid:** Initialize the map immediately (it renders tiles from a CDN). Fetch data in parallel. Add markers after data arrives. The map is interactive while data loads.
**Warning signs:** Blank white screen on mobile for >1 second.

## Code Examples

### Responsive Sidebar Layout (HTML + Tailwind)

```html
<!-- Source: Tailwind CSS v4 responsive design docs -->
<body class="m-0 h-screen flex flex-col md:flex-row">
  <!-- Mobile filter toggle -->
  <button id="filter-toggle"
    class="md:hidden fixed top-3 right-3 z-[1000] bg-white px-3 py-2
           rounded-lg shadow-md text-sm font-medium">
    Filter
  </button>

  <!-- Sidebar -->
  <aside id="sidebar"
    class="hidden md:flex flex-col w-full md:w-72 bg-white
           border-r border-gray-200 p-4 gap-4 overflow-y-auto
           fixed md:static inset-0 z-[999] md:z-auto">
    <h1 class="text-lg font-bold">PrA Ausbildungs-Plätze</h1>
    <p class="text-sm text-gray-600">
      Finden Sie Ausbildungs-Plätze in der Schweiz.
    </p>

    <label for="sector-select" class="text-sm font-medium">Bereich</label>
    <select id="sector-select" class="filter-select">
      <option value="">Alle Bereiche</option>
    </select>

    <label for="profession-select" class="text-sm font-medium">Beruf</label>
    <select id="profession-select" class="filter-select hidden">
      <option value="">Alle Berufe</option>
    </select>

    <!-- Mobile: close button inside sidebar -->
    <button id="sidebar-close" class="md:hidden mt-auto ...">
      Schliessen
    </button>
  </aside>

  <!-- Map -->
  <div id="map" class="flex-1 min-h-0"></div>
</body>
```

### URL Hash Read/Write Module

```javascript
// Source: MDN URLSearchParams + History.replaceState()

/**
 * Write current app state to URL hash without creating history entry.
 */
export function writeHash(sector, profession, map) {
  const p = new URLSearchParams();
  if (sector) p.set('s', sector);
  if (profession) p.set('p', profession);
  const c = map.getCenter();
  p.set('lat', c.lat.toFixed(4));
  p.set('lng', c.lng.toFixed(4));
  p.set('z', String(map.getZoom()));
  history.replaceState(null, '', '#' + p.toString());
}

/**
 * Read app state from URL hash. Returns null if no hash present.
 */
export function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  return {
    sector: p.get('s') || '',
    profession: p.get('p') || '',
    lat: p.has('lat') ? parseFloat(p.get('lat')) : NaN,
    lng: p.has('lng') ? parseFloat(p.get('lng')) : NaN,
    z: p.has('z') ? parseInt(p.get('z'), 10) : NaN
  };
}
```

### Leaflet Map State Restore

```javascript
// Source: Leaflet API Reference
const hashState = readHash();
if (hashState && !isNaN(hashState.lat) && !isNaN(hashState.z)) {
  map.setView([hashState.lat, hashState.lng], hashState.z);
} else {
  map.fitBounds(SWISS_BOUNDS);
}
```

### Mobile Sidebar Toggle

```javascript
// Source: Tailwind responsive patterns
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('filter-toggle');
const closeBtn = document.getElementById('sidebar-close');

function openSidebar() {
  sidebar.classList.remove('hidden');
  sidebar.classList.add('flex');
}
function closeSidebar() {
  sidebar.classList.add('hidden');
  sidebar.classList.remove('flex');
}

toggleBtn.addEventListener('click', openSidebar);
closeBtn.addEventListener('click', closeSidebar);
```

### Leaflet invalidateSize After Layout Change

```javascript
// Source: Leaflet API Reference
function onSidebarToggle() {
  // Wait for CSS transition to complete
  setTimeout(() => map.invalidateSize(), 100);
}
```

## German Interface Text Inventory (Einfache Sprache)

The app has a small, finite set of user-facing strings. All must follow Einfache Sprache guidelines:
- Short sentences (max 14 words)
- Common words, no jargon
- Active voice
- One idea per sentence

| Location | Current Text | Einfache Sprache Review |
|----------|-------------|------------------------|
| Page title | "INSOS PrA Map" | Consider: "PrA Ausbildungs-Plätze" (describes what user sees) |
| Sector default | "Alle Bereiche" | OK -- simple and clear |
| Profession default | "Alle Berufe" | OK -- simple and clear |
| No results | "Keine Anbieter für diese Auswahl gefunden." | OK -- clear, under 14 words |
| Error loading | "Fehler beim Laden der Anbieter" | Consider: "Die Daten konnten nicht geladen werden." (more natural) |
| Sidebar heading | (new) | "PrA Ausbildungs-Plätze" |
| Sidebar description | (new) | "Finden Sie Ausbildungs-Plätze in der Schweiz." |
| Filter toggle button | (new) | "Filter" (universally understood loan word) |
| Close button (mobile) | (new) | "Schliessen" |
| Sector label | (new) | "Bereich" |
| Profession label | (new) | "Beruf" |

**Note:** Sector names (e.g., "Gastronomie & Hotellerie") and profession names (e.g., "PrA Küche") are data-driven from INSOS and should NOT be rewritten -- they are official terminology.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Leaflet plugins for URL hash (leaflet-hash) | Vanilla `URLSearchParams` + `history.replaceState` | URLSearchParams widely supported since ~2017 | No dependency needed for hash state |
| CSS media queries in stylesheets | Tailwind responsive prefixes (`md:`, `lg:`) | Tailwind v1+ (2019) | All responsive logic in markup, no custom media queries |
| Tailwind v3 config file (JS) | Tailwind v4 CSS-first config (`@theme {}`) | January 2025 | Breakpoints customized in CSS, not JS config |
| JavaScript resize event listeners for responsive logic | CSS-only responsive with `hidden md:block` | Modern CSS (2020+) | Less JS, fewer bugs, better performance |

**Deprecated/outdated:**
- leaflet-hash (last commit 2014): Replaced by vanilla JS with modern APIs
- leaflet-sidebar v1 (last release 2021): Overkill for a 2-select sidebar; Tailwind handles it

## Open Questions

1. **Sidebar width on desktop**
   - What we know: 280px (w-72 = 18rem) is a common sidebar width for filter panels
   - What's unclear: Whether the sector dropdown text fits comfortably at this width (longest sector: "Garten, Floristik & Landwirtschaft" = 36 characters)
   - Recommendation: Use `w-72` (288px) as starting point; test with real data and adjust if needed

2. **Mobile sidebar style: slide-over vs dropdown**
   - What we know: Both patterns work. Slide-over (full-height panel from left/right) is more common for navigation. Dropdown/drawer (slides from top) is more common for filters.
   - What's unclear: Which feels more natural for a map + filter app
   - Recommendation: Use a full-screen overlay (`fixed inset-0`) since there are only 2 dropdowns and a close button. Simple, easy to implement, no ambiguity about partial-cover interactions.

3. **Hash key shortening**
   - What we know: Short keys (`s`, `p`, `lat`, `lng`, `z`) keep URLs compact. Full keys (`sector`, `profession`) are more readable.
   - What's unclear: Whether URL length matters (these URLs will be shared via messaging apps)
   - Recommendation: Use short keys to keep URLs manageable, especially for sector names like "Gastronomie%20%26%20Hotellerie"

## Performance Budget

The success criterion requires "interactive within 3 seconds on a typical mobile connection."

**Current bundle analysis (production build):**
| Asset | Raw Size | Gzipped |
|-------|----------|---------|
| JS bundle | 197 KB | 60 KB |
| CSS bundle | 22.5 KB | 8.3 KB |
| providers.json | 400 KB | ~50 KB (estimated gzip) |
| **Total** | **~620 KB** | **~118 KB** |

**3G mobile connection (~1.5 Mbps effective):**
- 118 KB gzipped = ~0.6 seconds download
- Plus DNS + TLS + server latency: ~0.5 seconds
- Plus JS parse/execute: ~0.3 seconds
- **Estimated total: ~1.4 seconds** -- well within 3-second budget

**Optimization opportunities (not required, but available if needed):**
- Render map tiles immediately before data fetch completes (parallelize)
- Compress providers.json keys at build time (shorter field names)
- Enable Vite's built-in CSS code splitting

**Conclusion:** The current bundle is already small enough. The 3-second criterion is achievable without additional optimization work, assuming GitHub Pages serves gzipped assets (it does by default).

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Responsive Design](https://tailwindcss.com/docs/responsive-design) -- breakpoint system, mobile-first approach, responsive utility classes
- [Leaflet API Reference](https://leafletjs.com/reference.html) -- `getCenter()`, `getZoom()`, `setView()`, `moveend` event, `invalidateSize()`
- [MDN History.replaceState()](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState) -- URL state management without history pollution
- [MDN URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) -- hash parameter encoding/decoding

### Secondary (MEDIUM confidence)
- [Einfache Sprache guidelines (netz-barrierefrei.de)](https://netz-barrierefrei.de/en/plain-language.html) -- B1 level language rules, max 14 words per sentence, active voice
- [GitHub Pages SPA routing discussion](https://github.com/orgs/community/discussions/64096) -- confirms hash fragments work, query params may 404
- [Vite build performance docs](https://vite.dev/guide/performance) -- build optimization options

### Tertiary (LOW confidence)
- [leaflet-hash plugin (GitHub)](https://github.com/mlevans/leaflet-hash) -- reviewed and rejected; last commit 2014, handles only map position not app state
- [leaflet-sidebar plugin (GitHub)](https://github.com/Turbo87/leaflet-sidebar) -- reviewed and rejected; last release 2021, overkill for 2 dropdowns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing tools verified against official docs
- Architecture: HIGH -- patterns are standard web development (responsive layout, URL hash state), verified with official Tailwind and Leaflet docs
- Pitfalls: HIGH -- based on known Leaflet behavior (invalidateSize, event loops) and GitHub Pages constraints (query param 404s)
- Performance: MEDIUM -- bundle size analysis is factual, but 3G timing estimates are approximations

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (stable domain, no rapidly-changing dependencies)
