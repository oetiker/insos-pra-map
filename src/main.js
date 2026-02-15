// INSOS PrA Map - Frontend entry point
import './style.css';
import { initMap, updateMarkers } from './map.js';
import { createFilterControl, filterProviders } from './filters.js';
import { readHash, writeHash } from './hash-state.js';

document.getElementById('commit-date').textContent =
  new Date(__COMMIT_DATE__).toLocaleDateString('de-CH');
document.getElementById('build-date').textContent =
  new Date(__BUILD_DATE__).toLocaleDateString('de-CH');

async function init() {
  try {
    const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
    const response = await fetch(dataUrl);
    const data = await response.json();

    console.log(`INSOS PrA Map: ${data.meta.count} providers loaded`);
    console.log(`Data generated at: ${data.meta.generatedAt}`);

    const { map, clusters } = initMap('map', data.providers);

    // Track current filter state for hash updates from map moves
    const hashState = readHash();
    let currentSector = hashState?.sector || '';
    let currentProfession = hashState?.profession || '';

    // Filter change handler: update markers, hash, and show/hide no-results overlay
    const onFilterChange = (sector, profession) => {
      const filtered = filterProviders(data.providers, sector, profession);
      const count = updateMarkers(clusters, filtered, sector, profession);

      // Update tracking vars and URL hash
      currentSector = sector;
      currentProfession = profession;
      writeHash(sector, profession, map);

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
    const { sectorSelect, profSelect } = filterControl;

    // Restore state from URL hash (if present)
    if (hashState) {
      // Restore filter selections
      if (hashState.sector) {
        sectorSelect.value = hashState.sector;
        sectorSelect.dispatchEvent(new Event('change'));  // triggers profession dropdown population
        if (hashState.profession) {
          profSelect.value = hashState.profession;
          profSelect.dispatchEvent(new Event('change'));  // triggers marker filtering
        }
      }
      // Restore map position (only if valid lat/lng/zoom)
      if (!isNaN(hashState.lat) && !isNaN(hashState.lng) && !isNaN(hashState.z)) {
        map.setView([hashState.lat, hashState.lng], hashState.z);
      }
    } else {
      // Write initial state so URL is immediately shareable
      map.once('moveend', () => {
        writeHash('', '', map);
      });
    }

    // Update hash on map pan/zoom
    map.on('moveend', () => {
      writeHash(currentSector, currentProfession, map);
    });
  } catch (err) {
    console.error('Failed to load providers:', err);
    const mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.textContent = 'Fehler beim Laden der Anbieter';
      mapEl.style.display = 'flex';
      mapEl.style.alignItems = 'center';
      mapEl.style.justifyContent = 'center';
      mapEl.style.padding = '2rem';
      mapEl.style.fontSize = '1.2rem';
      mapEl.style.color = '#666';
    }
  }
}

init();
