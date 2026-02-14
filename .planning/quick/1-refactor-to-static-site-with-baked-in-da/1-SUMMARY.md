---
phase: quick
plan: 1
subsystem: infra
tags: [vite, static-site, github-actions, github-pages, odata, geocoding]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: OData client, normalizer, geocoder modules in server/
provides:
  - Build-time data pipeline (scripts/build-data.js)
  - Static site build workflow (npm run build:all)
  - GitHub Actions weekly rebuild and deploy to GitHub Pages
  - Vite base URL config for /insos-map/ subpath
affects: [deployment, ci-cd, frontend]

# Tech tracking
tech-stack:
  added: [github-actions, github-pages]
  patterns: [static-site-generation, build-time-data-baking, public-dir-assets]

key-files:
  created:
    - scripts/build-data.js
    - .github/workflows/rebuild.yml
  modified:
    - src/main.js
    - vite.config.js
    - package.json
    - .gitignore

key-decisions:
  - "Use Vite public directory (src/public/data/) for static JSON so it copies to dist/ automatically"
  - "Set base: '/insos-map/' for GitHub Pages subpath deployment"
  - "Remove express/cors/morgan entirely (not just move to devDependencies)"

patterns-established:
  - "Build-time data baking: scripts/build-data.js writes to src/public/data/ for Vite to copy"
  - "Static JSON fetch: use import.meta.env.BASE_URL + relative path for deployment-agnostic URLs"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Quick Task 1: Refactor to Static Site with Baked-in Data Summary

**Static site with build-time OData pipeline, Vite public directory for baked-in JSON, and GitHub Actions weekly rebuild deploying to GitHub Pages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T23:46:21Z
- **Completed:** 2026-02-14T23:49:12Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Build-time data pipeline script that runs the full OData -> normalize -> geocode pipeline and writes static JSON
- Frontend loads providers from baked-in static JSON instead of /api/providers endpoint
- GitHub Actions workflow runs weekly (Monday 6am UTC) with manual trigger, deploying to GitHub Pages
- Express/cors/morgan removed from dependencies -- project is now a pure static site

## Task Commits

Each task was committed atomically:

1. **Task 1: Create build-time data pipeline script and restructure package.json** - `165a342` (feat)
2. **Task 2: Update frontend to load static JSON and remove API proxy** - `a35f3fc` (feat)
3. **Task 3: Create GitHub Actions workflow for weekly rebuild and deploy** - `9bd5874` (feat)

## Files Created/Modified
- `scripts/build-data.js` - Standalone build-time pipeline: OData fetch -> normalize -> geocode -> write JSON
- `.github/workflows/rebuild.yml` - Weekly cron + manual dispatch, builds data + Vite, deploys to GitHub Pages
- `src/main.js` - Loads static JSON via BASE_URL, shows data generation date
- `vite.config.js` - Removed server.proxy, added base: '/insos-map/'
- `package.json` - New build:data/build:all scripts, removed express/cors/morgan, removed server scripts
- `.gitignore` - Added src/public/data/ (generated JSON not committed)

## Decisions Made
- **Vite public directory approach:** Build script writes to `src/public/data/providers.json` which Vite automatically copies to `dist/data/` during build. This avoids needing special Vite config for non-imported assets.
- **BASE_URL for fetch:** Using `import.meta.env.BASE_URL + 'data/providers.json'` ensures the fetch works both locally and on GitHub Pages subpath (`/insos-map/`).
- **Remove express/cors/morgan entirely:** Since the server code is no longer used at runtime and nothing imports these packages, they were removed completely rather than moved to devDependencies.
- **Seed data fallback in build script:** If the live OData pipeline fails during build, the script falls back to `server/seed-data.json` so builds never fail completely.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

GitHub Pages must be enabled on the repository:
1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. The workflow will deploy on next manual trigger or weekly schedule

Environment variables `ODATA_BASE` and `GEO_API` are set directly in the workflow file (no secrets needed -- both are public APIs).

## Next Phase Readiness
- Static site deploys via GitHub Pages with automated weekly data refresh
- Server code remains in `server/` for reference but is no longer used at runtime
- Ready for Phase 2 (UI/frontend features) to build on the static site foundation

## Self-Check: PASSED

All files verified present. All commits verified in git log. Summary complete.

---
*Quick Task: 1-refactor-to-static-site-with-baked-in-da*
*Completed: 2026-02-15*
