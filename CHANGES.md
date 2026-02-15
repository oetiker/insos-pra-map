# Changelog

## 1.0.0 — 2026-02-15

Initial release.

### Features

- Interactive Leaflet map with Swiss OSM tiles and marker clustering
- ~365 PrA training providers across Switzerland
- Build-time data pipeline: OData fetch, normalization, geocoding with SQLite cache
- Seed data fallback when OData credentials are unavailable
- Rich provider popups with address, phone, email, and website
- Context-aware profession display in popups (grouped by sector, filtered, or hidden)
- Hierarchical filtering by Bereich (sector) and Beruf (profession)
- German labels and Einfache Sprache throughout the UI
- Shareable URLs via URL hash state (filter + map position)
- Red "PrA Berufsausbildungen" title bar and INSOS footer
- GitHub Actions workflow for weekly data rebuild and deploy
- Static site — no backend required at runtime
