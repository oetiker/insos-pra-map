// INSOS PrA Map - Frontend entry point
import './style.css';

async function init() {
  try {
    const dataUrl = import.meta.env.BASE_URL + 'data/providers.json';
    const response = await fetch(dataUrl);
    const data = await response.json();

    console.log(`INSOS PrA Map: ${data.meta.count} providers loaded`);
    console.log(`Data generated at: ${data.meta.generatedAt}`);

    // Display minimal status in the app div
    const app = document.getElementById('app');
    if (app) {
      const generated = new Date(data.meta.generatedAt).toLocaleDateString('de-CH');
      app.textContent = `INSOS PrA Map — ${data.meta.count} Anbieter geladen (Stand: ${generated})`;
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
