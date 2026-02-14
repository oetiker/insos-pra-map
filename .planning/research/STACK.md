# Stack Research

**Domain:** Interactive geographic map web application (Switzerland, member directory)
**Researched:** 2026-02-14
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vite | 7.x (stable: 7.3) | Build tool & dev server | Industry-standard build tool in 2025/2026. Instant HMR, native ESM dev server, optimized production builds via Rollup. Vanilla JS template gives zero framework overhead. Vite 8 beta (Rolldown-powered) exists but is too new for production. |
| Leaflet | 1.9.4 | Interactive map rendering | Most mature, lightweight (42KB) open-source mapping library. 1.4M+ npm downloads/month. Massive plugin ecosystem. Perfect for 2D pin-on-map use cases where 3D/vector tiles are unnecessary. Stable, battle-tested. v2.0 is alpha-only -- not production-ready. |
| Vanilla JavaScript (ES2022+) | -- | Application logic | No framework needed for this scope. ~20 UI components max (map, sidebar, filter panel, detail popup). A framework adds complexity without benefit. Vite handles module bundling, HMR, and tree-shaking. If reactive UI becomes complex later, Svelte 5 can be incrementally adopted since Vite supports it natively. |
| Tailwind CSS | 4.x (stable: 4.1) | Styling | Utility-first CSS with zero-runtime overhead. v4 has simplified configuration (CSS-based, no tailwind.config.js). Perfect for responsive layouts with German-language UI. PostCSS plugin integrates cleanly with Vite. |

### Map & Geo Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| leaflet.markercluster | 1.5.3 | Pin clustering for dense areas | Official Leaflet clustering plugin. Handles 10K-50K markers performantly. Animated cluster transitions. Last npm publish was 2022 but remains the standard -- 344 dependents, no breaking changes needed since Leaflet 1.9.x API is stable. |
| Leaflet CSS + default icon assets | (bundled with leaflet) | Map tile rendering, markers | Standard Leaflet assets. Note: Vite requires explicit icon path configuration due to asset bundling -- known issue with workaround. |

### Data & Networking

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Native `fetch()` API | -- | HTTP requests to CORS proxy | No axios/library needed. Modern `fetch` with `async/await` covers all use cases. Supported in all target browsers. |
| Cloudflare Worker (custom) | -- | CORS proxy for insos.ch data | Lightweight ~50-line Worker script. Free tier: 100K requests/day (account-wide). Adds CORS headers to responses from insos.ch Contao CMS. Caches responses to reduce origin load. No server to maintain. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | 3.x | HTML sanitization | When rendering any HTML content from the INSOS source to prevent XSS. Always sanitize third-party HTML before `innerHTML`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite dev server | Local development | `npm run dev` -- instant startup, HMR for JS/CSS |
| ESLint + Prettier | Code quality | Standard JS linting. Flat config (eslint.config.js) for ESLint 9.x. |
| Wrangler | Cloudflare Worker dev/deploy | `npx wrangler dev` for local CORS proxy testing, `npx wrangler deploy` for production. |

## Map Tile Provider

| Provider | URL Pattern | Cost | Why |
|----------|-------------|------|-----|
| OpenStreetMap (SOSM) | `https://tile.osm.ch/switzerland/{z}/{x}/{y}.png` | Free | Swiss OpenStreetMap Association tile server. Optimized for Switzerland. No API key needed. Attribution required: "OpenStreetMap contributors". |
| **Fallback:** OSM standard | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Free (fair use) | Global fallback if SOSM is unavailable. Rate-limited for heavy use. |

**Do NOT use:** Google Maps, Mapbox, or MapTiler for this project. All require API keys, have usage-based pricing, and add vendor lock-in unnecessary for a pin-on-map application showing ~1000 Swiss locations.

## Switzerland Geo Data

| Resource | Format | Source | Use |
|----------|--------|--------|-----|
| Swiss canton boundaries | GeoJSON | [labs.karavia.ch/swiss-boundaries-geojson](https://labs.karavia.ch/swiss-boundaries-geojson/) or [opendata.swiss](https://opendata.swiss) | Optional: canton boundary overlay for regional context. Sourced from swisstopo swissBOUNDARIES3D (public domain). |

## Installation

```bash
# Initialize project
npm create vite@latest insos-map -- --template vanilla

# Core mapping
npm install leaflet leaflet.markercluster

# Styling
npm install tailwindcss @tailwindcss/vite

# Security
npm install dompurify

# Dev dependencies
npm install -D eslint prettier eslint-config-prettier

# CORS proxy tooling (separate project/directory)
npm install -D wrangler
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Leaflet 1.9.4 | MapLibre GL JS | If you need vector tiles, 3D terrain, or dynamic map styling. Overkill for pin-on-map with ~1000 static locations. Steeper learning curve, larger bundle (200KB+), requires vector tile server. |
| Leaflet 1.9.4 | Leaflet 2.0.0-alpha | When it reaches stable release. Currently alpha (Aug 2025). Offers native ESM, drops IE support, modern Pointer Events. Not production-ready yet. |
| Vanilla JS | Svelte 5 | If the filter UI grows beyond ~10 interactive components with complex state. Svelte compiles away to vanilla JS anyway (~3KB runtime). Easy to migrate since Vite supports `--template svelte` natively. |
| Vanilla JS | React / Vue | Never for this project. Both add 30-100KB runtime for a UI that is fundamentally a map + sidebar + filter panel. Massive overkill. |
| Tailwind CSS 4 | Plain CSS | If the team prefers hand-written CSS. Tailwind is not strictly necessary but significantly speeds up responsive layout work and ensures visual consistency. |
| Cloudflare Worker | Vercel Edge Functions / Netlify Functions | If already deploying on those platforms. Cloudflare Workers have the most generous free tier (100K req/day vs 125K/month on Vercel). |
| leaflet.markercluster | Supercluster | If building custom cluster UI or using MapLibre. Supercluster is lower-level (algorithm only, no UI). leaflet.markercluster provides complete drop-in clustering with animations. |
| Native fetch | Axios | Never. fetch() covers all needs. Axios adds 14KB for features not needed here (interceptors, request cancellation). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Google Maps API | Requires API key, pay-per-use pricing, proprietary, vendor lock-in. $7/1000 loads after free tier. | Leaflet + OpenStreetMap tiles (free, open source) |
| Mapbox GL JS v2+ | Proprietary license since v2.0 (Dec 2020). Requires Mapbox access token. Free tier exists but ties you to their ecosystem. | Leaflet (or MapLibre GL JS if vector tiles needed) |
| React / Vue / Angular | 30-100KB+ runtime overhead for a UI with <20 components. No server-side rendering needed. Adds build complexity and framework churn risk without proportional benefit. | Vanilla JS with Vite (or Svelte 5 if complexity grows) |
| jQuery | Legacy library. All its useful features (DOM selection, AJAX, animation) are native browser APIs now. Adds 87KB for zero benefit. | Native DOM APIs, fetch(), CSS transitions |
| Webpack | Slower than Vite by 10-100x in dev mode. More complex configuration. Vite is the 2025 industry standard. | Vite 7.x |
| OpenLayers | Full-featured but heavy (~400KB). Designed for GIS professionals. API is complex for simple pin-on-map. | Leaflet (10x simpler API for this use case) |
| Leaflet 2.0.0-alpha | Alpha release (Aug 2025). Plugin ecosystem (especially markercluster) not yet verified compatible. Risk of breaking changes before stable. | Leaflet 1.9.4 (stable, all plugins compatible) |
| Server-side rendering (Next.js, Nuxt, SvelteKit) | This is a client-side map app consuming external data. SSR adds infrastructure complexity for zero SEO benefit (map content is not indexable). | Static build via Vite, deploy to CDN |

## Stack Patterns by Variant

**If INSOS provides a proper JSON API:**
- Fetch directly from CORS proxy, parse JSON, plot on map
- Simplest path, lowest maintenance

**If data must be scraped from HTML pages:**
- CORS proxy also parses HTML server-side (in Worker)
- Worker extracts structured data, returns clean JSON to client
- Adds complexity but keeps client code simple
- Consider caching parsed results in Cloudflare KV (free tier: 100K reads/day)

**If dataset is static / rarely changes:**
- Scrape once, commit as static JSON in repo
- No CORS proxy needed at all
- Rebuild/redeploy when data changes (manual or scheduled)
- Simplest architecture, but stale data risk

**If filter UI grows complex (10+ interactive widgets):**
- Migrate to Svelte 5 incrementally
- Vite supports `--template svelte` natively
- Svelte compiles to vanilla JS, so bundle stays small
- Component model helps manage state for many filters

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| leaflet@1.9.4 | leaflet.markercluster@1.5.3 | Verified compatible. markercluster 1.5.x targets Leaflet 1.x API. |
| leaflet@1.9.4 | Vite 7.x | Works but requires manual icon path fix. Known Vite asset-handling issue with Leaflet's default marker icons. Standard workaround: import icons explicitly and set `L.Icon.Default.prototype.options`. |
| tailwindcss@4.x | Vite 7.x | Native Vite plugin (`@tailwindcss/vite`). No PostCSS config needed in v4. |
| wrangler@latest | Cloudflare Workers | CLI for local dev and deployment of CORS proxy Worker. |
| Node.js | 20.19+ or 22.12+ | Required by Vite 7. Node 18 is EOL (April 2025). |

## Data Source Architecture Note

The INSOS website (insos.ch) runs on **Contao CMS**. Key observations from research:

1. **No public REST API** -- Contao does not expose member data via API by default. The Contao Manager API is for CMS administration, not content delivery.
2. **Third-party Content API bundle exists** (`contao-content-api-bundle`) but would need to be installed server-side on insos.ch -- not possible since this is a third-party project.
3. **The member directory** contains ~1000 providers, filterable by PrA offering and region. It links from the "Uber uns" (About Us) section.
4. **Data extraction strategy** will need to be determined during implementation: HTML scraping via CORS proxy, or potentially a static data export if INSOS cooperates.
5. **The old member directory URL** (`insos.ch/verband/mitglieds-institutionen/`) redirects to curaviva.ch, suggesting a site restructuring. The current directory lives under the new Contao-powered site at `insos.ch/de/ueber-uns`.

This is the **highest-risk area** of the stack -- data access strategy must be validated early in implementation.

## Sources

- [Leaflet official site](https://leafletjs.com/) -- version 1.9.4 stable, 2.0.0-alpha announced May 2025 (HIGH confidence)
- [Leaflet 2.0 Alpha announcement](https://leafletjs.com/2025/05/18/leaflet-2.0.0-alpha.html) -- ESM support, modern APIs (HIGH confidence)
- [Vite releases](https://vite.dev/releases) -- Vite 7.3.x stable, Vite 8 beta Dec 2025 (HIGH confidence)
- [Leaflet.markercluster GitHub](https://github.com/Leaflet/Leaflet.markercluster) -- v1.5.3, handles 10K-50K markers (HIGH confidence)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) -- 100K requests/day free tier (HIGH confidence)
- [Cloudflare CORS proxy docs](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) -- official example (HIGH confidence)
- [Swiss OSM tile service](https://sosm.ch/projects/tile-service/) -- free Switzerland tiles (MEDIUM confidence -- service availability not SLA-backed)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) -- v4.0 released early 2025, v4.1 current (HIGH confidence)
- [Contao CMS on insos.ch](https://insos.ch/de/) -- confirmed via schema.contao.org structured data (HIGH confidence)
- [Contao Content API bundle](https://github.com/DieSchittigs/contao-content-api-bundle) -- third-party JSON API for Contao, but requires server-side installation (MEDIUM confidence)
- [Swiss boundaries GeoJSON](https://labs.karavia.ch/swiss-boundaries-geojson/) -- canton boundaries from swisstopo (HIGH confidence)
- [Geoapify map library comparison](https://www.geoapify.com/map-libraries-comparison-leaflet-vs-maplibre-gl-vs-openlayers-trends-and-statistics/) -- Leaflet 1.4M downloads/month, market leader (MEDIUM confidence)
- [Supercluster](https://github.com/mapbox/supercluster) -- low-level clustering algorithm, used by MapLibre internally (HIGH confidence)
- [Jawg MapLibre vs Leaflet comparison](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/) -- feature comparison (MEDIUM confidence)

---
*Stack research for: INSOS interactive map (Switzerland PrA provider directory)*
*Researched: 2026-02-14*
