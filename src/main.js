// INSOS PrA Map - Frontend entry point
import './style.css';

async function init() {
  try {
    const response = await fetch('/api/providers');
    const data = await response.json();

    console.log(`INSOS PrA Map: ${data.meta.count} providers loaded`);

    if (data.meta.stale) {
      console.warn('Warning: serving stale data');
    }

    if (data.meta.seedData) {
      console.log('Note: serving seed data (upstream unavailable)');
    }

    // Display minimal status in the app div
    const app = document.getElementById('app');
    if (app) {
      app.textContent = `INSOS PrA Map — ${data.meta.count} Anbieter geladen`;
    }
  } catch (err) {
    console.error('Failed to load providers:', err);
    const app = document.getElementById('app');
    if (app) {
      app.textContent = 'Fehler beim Laden der Anbieter';
    }
  }
}

init();
