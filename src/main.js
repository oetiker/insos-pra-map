// INSOS PrA Map - Frontend entry point
import './style.css';
import { initMap } from './map.js';

async function init() {
  try {
    const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
    const response = await fetch(dataUrl);
    const data = await response.json();

    console.log(`INSOS PrA Map: ${data.meta.count} providers loaded`);
    console.log(`Data generated at: ${data.meta.generatedAt}`);

    initMap('map', data.providers);
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
