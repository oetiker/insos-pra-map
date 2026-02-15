// INSOS PrA Map - Leaflet map with SOSM tiles and marker clustering
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Marker clustering (side-effect import -- attaches to global L)
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix Leaflet default marker icons for Vite asset bundling
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.prototype.options.iconUrl = markerIcon;
L.Icon.Default.prototype.options.iconRetinaUrl = markerIcon2x;
L.Icon.Default.prototype.options.shadowUrl = markerShadow;
L.Icon.Default.imagePath = '';

// INSOS member directory URL (no per-provider deep link available)
const INSOS_URL = 'https://www.insos.ch/de/ueber-uns#unsere-mitglieder-268211';

/**
 * HTML-escape a string to prevent XSS from external provider data.
 * Returns empty string for falsy input.
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build HTML content for a provider popup.
 * Conditionally renders phone, email, website only when present.
 */
export function buildPopupContent(provider) {
  let html = '<div class="provider-popup">';
  html += `<strong>${esc(provider.name)}</strong>`;
  html += `<p class="provider-popup-address">${esc(provider.street)}<br>${esc(provider.plzOrt)}</p>`;

  if (provider.phone) {
    html += `<p><a href="tel:${esc(provider.phone)}">${esc(provider.phone)}</a></p>`;
  }
  if (provider.email) {
    html += `<p><a href="mailto:${esc(provider.email)}">${esc(provider.email)}</a></p>`;
  }
  if (provider.website) {
    const display = provider.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    html += `<p><a href="${esc(provider.website)}" target="_blank" rel="noopener">${esc(display)}</a></p>`;
  }

  html += `<p class="provider-popup-insos"><a href="${INSOS_URL}" target="_blank" rel="noopener">INSOS Mitgliederverzeichnis</a></p>`;
  html += '</div>';
  return html;
}

/**
 * Replace all markers in the cluster group with markers for the given providers.
 * @param {L.MarkerClusterGroup} clusters
 * @param {Array} providers - filtered provider array
 * @returns {number} Number of markers added
 */
export function updateMarkers(clusters, providers) {
  clusters.clearLayers();

  const markers = [];
  for (const provider of providers) {
    if (provider.lat != null && provider.lon != null) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(buildPopupContent(provider));
      markers.push(marker);
    }
  }

  clusters.addLayers(markers);
  return markers.length;
}

// Switzerland bounds (covers all 365 provider locations with padding)
const SWISS_BOUNDS = L.latLngBounds(
  [45.7, 5.9],   // Southwest
  [47.9, 10.6]   // Northeast
);

/**
 * Initialize the Leaflet map with SOSM tiles and marker clustering.
 * @param {string} containerId - DOM element ID for the map container
 * @param {Array} providers - Array of provider objects with lat, lon, name
 * @returns {{ map: L.Map, clusters: L.MarkerClusterGroup }}
 */
export function initMap(containerId, providers) {
  const map = L.map(containerId, {
    maxBounds: SWISS_BOUNDS.pad(0.1),
    minZoom: 7,
    maxZoom: 18
  });

  map.fitBounds(SWISS_BOUNDS);

  // SOSM Swiss-style tiles (Swiss OpenStreetMap Association)
  L.tileLayer('https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Marker cluster group
  const clusters = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    chunkedLoading: true
  });

  // Create markers for all providers with valid coordinates
  let markerCount = 0;
  for (const provider of providers) {
    if (provider.lat != null && provider.lon != null) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(buildPopupContent(provider));
      clusters.addLayer(marker);
      markerCount++;
    }
  }

  map.addLayer(clusters);
  console.log(`Map initialized: ${markerCount} markers plotted`);

  return { map, clusters };
}
