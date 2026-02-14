---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/build-data.js
  - src/main.js
  - vite.config.js
  - package.json
  - .gitignore
  - .github/workflows/rebuild.yml
autonomous: true
must_haves:
  truths:
    - "Running 'npm run build:data' fetches OData, normalizes, geocodes, and writes src/data/providers.json"
    - "Running 'npm run build' produces a fully self-contained static site in dist/ with no server dependency"
    - "The frontend loads provider data from the baked-in JSON, not from /api/providers"
    - "GitHub Actions workflow runs weekly and on manual trigger to rebuild and deploy to GitHub Pages"
  artifacts:
    - path: "scripts/build-data.js"
      provides: "Build-time data pipeline script"
      min_lines: 30
    - path: "src/data/providers.json"
      provides: "Static provider data baked into frontend"
    - path: ".github/workflows/rebuild.yml"
      provides: "Weekly cron + manual dispatch workflow"
      min_lines: 30
  key_links:
    - from: "scripts/build-data.js"
      to: "server/odata-client.js, server/normalizer.js, server/geocoder.js"
      via: "ES module imports"
      pattern: "import.*from.*server/"
    - from: "src/main.js"
      to: "src/data/providers.json"
      via: "fetch or dynamic import"
      pattern: "(fetch|import).*providers\\.json"
---

<objective>
Refactor insos-map from a live Express server to a fully static site with baked-in data.

Purpose: Eliminate runtime server dependency. All provider data (OData fetch + geocode pipeline) gets baked into a static JSON file at build time. A GitHub Actions workflow rebuilds weekly. The Express server code stays as build-time-only scripts.

Output: Static site deployable to GitHub Pages with automated weekly data refresh.
</objective>

<execution_context>
@/Users/oetiker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/oetiker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@server/providers.js
@server/odata-client.js
@server/normalizer.js
@server/geocoder.js
@server/geocode-cache.js
@server/index.js
@src/main.js
@vite.config.js
@package.json
@.gitignore
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create build-time data pipeline script and restructure package.json</name>
  <files>
    scripts/build-data.js
    package.json
    .gitignore
  </files>
  <action>
Create `scripts/build-data.js` -- a standalone Node script that runs the full data pipeline and writes the result to `src/data/providers.json` (so Vite bundles it). This script:

1. Imports `dotenv/config` for env vars
2. Imports `fetchProviders` and `fetchPraLookup` from `../server/odata-client.js`
3. Imports `normalizeProviders` from `../server/normalizer.js`
4. Imports `geocodeAll` from `../server/geocoder.js`
5. Runs the pipeline: fetch both data sources in parallel, normalize, geocode
6. Writes the result to `src/data/providers.json` as a JSON object `{ providers: [...], meta: { count, generatedAt } }`
7. Uses `mkdirSync` with `{ recursive: true }` to ensure `src/data/` exists
8. Logs progress and result count to stdout
9. Has a try/catch at the top level that exits with code 1 on failure (so CI catches it)
10. Falls back to `server/seed-data.json` if the live pipeline fails, logging a clear warning

The server/ directory modules (odata-client.js, normalizer.js, geocoder.js, geocode-cache.js) stay exactly where they are -- they are now build-time-only code. Do NOT move or rename them.

Update `package.json`:
- Add script `"build:data": "node scripts/build-data.js"`
- Add script `"build:all": "npm run build:data && npm run build"` (runs pipeline then Vite build)
- Keep `"build": "vite build"` unchanged
- Remove `"dev:server": "node server/index.js"`
- Remove `"start": "node server/index.js"`
- Update `"dev"` to just `"vite --open"` (no server needed in dev -- static JSON is already present)
- Move `express`, `cors`, `morgan` from dependencies to devDependencies (they are no longer runtime deps; actually they can just be removed entirely since nothing imports them anymore after this refactor). Remove them from dependencies. Keep `better-sqlite3` and `dotenv` in dependencies (used by build script).

Update `.gitignore`:
- Add `src/data/` so the generated JSON is not committed (it gets rebuilt by CI and also locally via build:data)
- Keep existing entries

Do NOT delete `server/index.js` -- leave it for reference. It is simply no longer used at runtime.
  </action>
  <verify>
Run `node scripts/build-data.js` and confirm:
- `src/data/providers.json` is created
- It contains a valid JSON object with `providers` array (365+ items) and `meta` object
- Script exits with code 0

Run `npm run build:all` and confirm dist/ is generated.
  </verify>
  <done>
`scripts/build-data.js` exists and successfully runs the full OData -> normalize -> geocode pipeline, writing output to `src/data/providers.json`. Package.json scripts are updated for static-site workflow. Express/cors/morgan removed from dependencies.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend to load static JSON and remove API proxy</name>
  <files>
    src/main.js
    vite.config.js
  </files>
  <action>
Update `src/main.js`:
- Instead of `fetch('/api/providers')`, load the static JSON. Use a dynamic import or fetch of the local file.
- Best approach: `const data = await fetch(new URL('./data/providers.json', import.meta.url).href).then(r => r.json())` -- this works with Vite's asset handling and will resolve correctly both in dev and production builds. Alternatively, use a simpler relative path: `fetch('./data/providers.json')` which Vite will serve from the src/ root in dev mode and from dist/ in prod.
- Actually the simplest and most reliable approach: since providers.json will be in `src/data/`, and Vite root is `src/`, use `fetch('/data/providers.json')`. But this won't work if deployed to a subpath. Better: use `fetch(import.meta.env.BASE_URL + 'data/providers.json')` so it respects Vite's base config.
- Wait -- even simpler. Place the JSON in `src/public/data/providers.json` instead of `src/data/`. Vite copies `public/` contents to the root of the dist output as-is. But that means the build script writes to `src/public/data/providers.json`.

**Decision: Use Vite's public directory approach.**
- Build script writes to `public/data/providers.json` (at repo root, since `publicDir` defaults to `public` relative to Vite root -- but root is `src/`, so actually publicDir is `src/public/` by default).

Actually, let's keep it simple and explicit:
- Build script writes to `src/data/providers.json`
- In `vite.config.js`, configure the file to be copied to dist: We don't need special config. Since Vite root is `src/`, and `src/data/providers.json` is inside the root, we can reference it with a fetch to `./data/providers.json` from index.html's perspective. BUT Vite only serves files in the root, and `src/data/` IS inside `src/` (the root), so `fetch('/data/providers.json')` will work in dev. For production, Vite won't automatically copy non-imported assets to dist though.

**Final approach -- use public directory:**
1. Update `scripts/build-data.js` (from Task 1) to write to `src/public/data/providers.json` instead of `src/data/providers.json`
2. Update `.gitignore` (from Task 1) to ignore `src/public/data/` instead of `src/data/`
3. In `src/main.js`, fetch from `import.meta.env.BASE_URL + 'data/providers.json'`

This way, Vite automatically copies `src/public/` contents into dist/ root during build, and serves them at `/` during dev. No extra config needed.

Update `src/main.js`:
- Replace `fetch('/api/providers')` with `fetch(import.meta.env.BASE_URL + 'data/providers.json')`
- The response JSON shape is `{ providers: [...], meta: { count, generatedAt } }` -- adapt the code to this (rename `data.meta.stale` / `data.meta.seedData` references since these fields won't exist in the static JSON; the meta object will have `count` and `generatedAt` instead)
- Keep the error handling and console logging, but update messages to reflect static data loading
- Update the status message to show generatedAt date so users know data freshness

Update `vite.config.js`:
- Remove the `server.proxy` block entirely (no more `/api` proxy needed)
- Add `base: '/insos-map/'` for GitHub Pages deployment (repo name is `insos-map`, so GH Pages serves from this subpath)
- Keep everything else (plugins, root, build) unchanged
  </action>
  <verify>
Run `npm run build:data` first to generate the JSON, then `npx vite build` and confirm:
- `dist/data/providers.json` exists in the build output (copied from public/)
- `dist/index.html` exists
- `dist/assets/` contains bundled JS/CSS
- No references to `/api/providers` remain in the built JS (grep dist/assets/*.js for "api/providers" should find nothing)

Run `npx vite preview` and open in browser -- the app should load and show provider count.
  </verify>
  <done>
Frontend loads provider data from static JSON file. Vite proxy removed. Base URL configured for GitHub Pages. The built dist/ is a fully self-contained static site with no server dependency.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create GitHub Actions workflow for weekly rebuild and deploy</name>
  <files>
    .github/workflows/rebuild.yml
  </files>
  <action>
Create `.github/workflows/rebuild.yml` with:

```yaml
name: Rebuild and Deploy

on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 06:00 UTC
  workflow_dispatch:  # Manual trigger

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Fetch and geocode provider data
        run: npm run build:data
        env:
          ODATA_BASE: https://performx.artiset.ch/odata
          GEO_API: https://api3.geo.admin.ch/rest/services/api/SearchServer

      - name: Build static site
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Key details:
- Uses GitHub Pages deployment via the official actions (upload-pages-artifact + deploy-pages)
- `npm ci` installs all deps including devDependencies (needed for Vite build) and regular deps (needed for build:data script -- better-sqlite3, dotenv)
- Env vars for OData and Geo API are passed explicitly (no .env file in CI)
- `concurrency` prevents overlapping deployments
- `workflow_dispatch` allows manual trigger from GitHub UI
- Node 22 matches the project's module system requirements (ESM, import attributes)
- The geocode cache SQLite file won't persist between CI runs, but that's fine -- geo.admin.ch is fast and the ~365 providers geocode in under a minute even without cache
  </action>
  <verify>
Verify the workflow file is valid YAML:
- `node -e "const yaml = require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/rebuild.yml','utf8'))"` or use a simpler check
- Confirm the file contains: `schedule`, `workflow_dispatch`, `npm run build:data`, `npm run build`, `actions/deploy-pages`
- Verify no syntax errors by reading the file back
  </verify>
  <done>
GitHub Actions workflow exists at `.github/workflows/rebuild.yml`. It runs on weekly cron (Monday 6am UTC) and supports manual trigger. It runs the full data pipeline, builds the Vite static site, and deploys to GitHub Pages.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete:
1. `npm run build:all` succeeds end-to-end (data fetch + Vite build)
2. `dist/` contains `index.html`, `data/providers.json`, and `assets/` with bundled JS/CSS
3. No references to `/api/providers` or Express in runtime code
4. `npx vite preview` serves the app and it loads providers from static JSON
5. `.github/workflows/rebuild.yml` exists and is valid YAML
6. `package.json` has no express/cors/morgan in dependencies
</verification>

<success_criteria>
The project is a fully static site. Running `npm run build:all` produces a self-contained `dist/` folder that can be served by any static file server (nginx, GitHub Pages, etc.) with no Node.js runtime needed. The GitHub Actions workflow automates weekly data refresh and deployment.
</success_criteria>

<output>
After completion, create `.planning/quick/1-refactor-to-static-site-with-baked-in-da/1-SUMMARY.md`
</output>
