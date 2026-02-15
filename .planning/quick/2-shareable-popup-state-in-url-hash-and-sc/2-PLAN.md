---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - src/hash-state.js
  - src/map.js
  - src/main.js
  - src/style.css
autonomous: true

must_haves:
  truths:
    - "Sharing a URL with a provider ID in the hash opens that provider's popup automatically"
    - "Popups with long profession lists shrink to fit on screen and scroll vertically"
    - "Opening a popup updates the URL hash with the provider ID"
    - "Closing a popup removes the provider ID from the URL hash"
  artifacts:
    - path: "src/hash-state.js"
      provides: "Provider ID (key: pid) read/write in URL hash"
    - path: "src/map.js"
      provides: "Markers store provider.id, popup maxHeight set, popupopen/popupclose events wired"
    - path: "src/main.js"
      provides: "On load, if hash has pid, find marker and open its popup"
    - path: "src/style.css"
      provides: "Popup content scrolls when overflowing"
  key_links:
    - from: "src/main.js"
      to: "src/hash-state.js"
      via: "readHash returns pid field"
      pattern: "hashState\\.pid"
    - from: "src/main.js"
      to: "src/map.js"
      via: "find marker by provider id and open popup"
      pattern: "openPopup"
---

<objective>
Add shareable popup state to URL hash and make popups fit on screen.

Purpose: When a user finds a provider and shares the URL, the recipient sees the same popup open. Providers with many offerings currently overflow the screen — popups need to scroll.
Output: Updated hash-state.js, map.js, main.js, style.css
</objective>

<execution_context>
@/Users/oetiker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/oetiker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/hash-state.js
@src/map.js
@src/main.js
@src/style.css
@src/filters.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add provider ID to URL hash and restore popup on load</name>
  <files>src/hash-state.js, src/map.js, src/main.js</files>
  <action>
1. **src/hash-state.js** — Add `pid` (provider ID) parameter:
   - `writeHash(sector, profession, map, pid)`: if `pid` is truthy, set `p.set('pid', pid)`. The `pid` parameter defaults to `''`.
   - `readHash()`: return `pid: p.get('pid') || ''` in the returned object.

2. **src/map.js** — Store provider ID on each marker and export a lookup:
   - In `updateMarkers()`: after creating each marker with `L.marker(...)`, store the provider's `id` on the marker object: `marker._providerId = provider.id`. Also store the provider object: `marker._provider = provider`.
   - In `initMap()`: same — store `marker._providerId = provider.id` on each initial marker.
   - Export a new function `findMarkerByProviderId(clusters, pid)` that iterates `clusters.getLayers()` and returns the first marker where `marker._providerId === pid` (or starts with `pid` if pid is shorter than 36 chars, to support short prefix matching). Return `null` if not found.

3. **src/main.js** — Wire popup open/close events to hash state:
   - Add a `currentPid` variable (initialized from `hashState?.pid || ''`).
   - Listen to `map.on('popupopen', (e) => { ... })`: get the marker from `e.popup._source`, read `marker._providerId`, set `currentPid = marker._providerId`, call `writeHash(currentSector, currentProfession, map, currentPid)`.
   - Listen to `map.on('popupclose', () => { ... })`: set `currentPid = ''`, call `writeHash(currentSector, currentProfession, map, currentPid)`.
   - Update the existing `map.on('moveend', ...)` call to pass `currentPid`: `writeHash(currentSector, currentProfession, map, currentPid)`.
   - Update the `onFilterChange` callback's `writeHash` call to pass `''` for pid (opening a new filter clears popup state since markers are rebuilt).
   - **Restore popup on load**: After the existing hash state restoration block (after filter + map position restoration), add: if `hashState.pid` is truthy, import and call `findMarkerByProviderId(clusters, hashState.pid)`. If a marker is found, call `clusters.zoomToShowLayer(marker, () => { marker.openPopup(); })` — this un-clusters if needed, then opens the popup. This must run after a short `setTimeout(..., 200)` to let the cluster layer settle after filter restoration.
   - Update the initial `writeHash('', '', map)` in the else branch to pass `''` as the fourth argument.
  </action>
  <verify>
    - `npm run build` succeeds without errors.
    - Manually test: open the app, click a marker, verify URL hash now contains `pid=...`. Copy URL, open in new tab, verify same popup opens.
    - Close popup, verify `pid` is removed from hash.
  </verify>
  <done>Opening a popup writes provider ID to URL hash; loading a URL with pid in hash opens that provider's popup automatically; closing popup removes pid from hash.</done>
</task>

<task type="auto">
  <name>Task 2: Make popups scrollable when content overflows viewport</name>
  <files>src/map.js, src/style.css</files>
  <action>
1. **src/map.js** — Set Leaflet popup `maxHeight` option:
   - In `updateMarkers()`, change `marker.bindPopup(...)` to include options: `marker.bindPopup(content, { maxHeight: 300 })`. Leaflet's built-in `maxHeight` option adds a scrollbar to the popup content wrapper when content exceeds this height.
   - In `initMap()`, same change for the initial marker creation: `marker.bindPopup(content, { maxHeight: 300 })`.

2. **src/style.css** — Ensure the scrollable popup content looks good:
   - Add styling for `.leaflet-popup-content` to have `overflow-y: auto` and smooth scrolling. Leaflet's maxHeight creates a wrapper, but we want to make sure the scroll behavior is smooth:
     ```css
     .leaflet-popup-content {
       overflow-y: auto;
       -webkit-overflow-scrolling: touch;
     }
     ```
   - This ensures touch devices get momentum scrolling inside popups.
  </action>
  <verify>
    - Find a provider with many offerings (no sector filter, look for providers with 5+ PrA offerings). Open its popup. Verify the popup does not extend beyond the viewport and scrolls internally.
    - On a short viewport (resize browser to ~500px height), confirm popups still fit and scroll.
  </verify>
  <done>Popups with long content are capped at 300px height and scroll vertically. Works on both desktop and touch devices.</done>
</task>

</tasks>

<verification>
- Build succeeds: `npm run build`
- URL hash includes `pid` when popup is open
- URL hash omits `pid` when no popup is open
- Sharing URL with `pid` opens correct popup on load
- Tall popups scroll instead of overflowing viewport
</verification>

<success_criteria>
1. A URL copied while a popup is open, when pasted into a new browser tab, opens the map with that same popup visible
2. Providers with many profession offerings show a scrollable popup that fits within the viewport
3. Existing hash state features (sector, profession, lat, lng, zoom) continue to work
</success_criteria>

<output>
After completion, create `.planning/quick/2-shareable-popup-state-in-url-hash-and-sc/2-SUMMARY.md`
</output>
