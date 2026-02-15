// INSOS PrA Map - Frontend entry point
import './style.css';
import { initMap, updateMarkers } from './map.js';
import { createFilterControl, filterProviders } from './filters.js';

async function init() {
  try {
    const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
    const response = await fetch(dataUrl);
    const data = await response.json();

    console.log(`INSOS PrA Map: ${data.meta.count} providers loaded`);
    console.log(`Data generated at: ${data.meta.generatedAt}`);

    const { map, clusters } = initMap('map', data.providers);

    // Filter change handler: update markers and show/hide no-results overlay
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

    createFilterControl(data.providers, onFilterChange).addTo(map);
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
