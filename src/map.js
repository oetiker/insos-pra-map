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

import { findSector } from './filters.js';

L.Icon.Default.prototype.options.iconUrl = markerIcon;
L.Icon.Default.prototype.options.iconRetinaUrl = markerIcon2x;
L.Icon.Default.prototype.options.shadowUrl = markerShadow;
L.Icon.Default.imagePath = '';

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
 * Shows professions context-aware based on current filter state.
 * @param {Object} provider
 * @param {string} sector - Current sector filter (empty = all)
 * @param {string} profession - Current profession filter (empty = all in sector)
 */
export function buildPopupContent(provider, sector, profession) {
  let html = '<div class="provider-popup">';
  html += `<strong>${esc(provider.name)}</strong>`;
  html += `<p class="provider-popup-address">${esc(provider.street)}<br>${esc(provider.plzOrt)}</p>`;

  // Profession section (context-aware)
  if (sector && profession) {
    // User filtered to a specific Beruf — skip profession list
  } else if (sector && !profession) {
    // User filtered to a sector — show matching professions in that sector
    const matching = provider.praOfferings
      .filter(o => findSector(o.name) === sector || (sector === 'Weitere Berufe' && findSector(o.name) === null))
      .map(o => o.name.replace('PrA ', ''));
    if (matching.length > 0) {
      html += `<p class="popup-berufe">${matching.map(m => esc(m)).join(', ')}</p>`;
    }
  } else if (!sector) {
    // No filter — group all offerings by sector
    const grouped = {};
    for (const o of provider.praOfferings) {
      const s = findSector(o.name) || 'Weitere Berufe';
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(o.name.replace('PrA ', ''));
    }
    const sortedSectors = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'de'));
    if (sortedSectors.length > 0) {
      let berufeHtml = '';
      for (const s of sortedSectors) {
        berufeHtml += `<div class="popup-sector-heading">${esc(s)}</div>`;
        berufeHtml += `<div>${grouped[s].map(p => esc(p)).join(', ')}</div>`;
      }
      html += `<div class="popup-berufe">${berufeHtml}</div>`;
    }
  }

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

  html += '</div>';
  return html;
}

/**
 * Replace all markers in the cluster group with markers for the given providers.
 * @param {L.MarkerClusterGroup} clusters
 * @param {Array} providers - filtered provider array
 * @param {string} sector - current sector filter
 * @param {string} profession - current profession filter
 * @returns {number} Number of markers added
 */
export function updateMarkers(clusters, providers, sector, profession) {
  clusters.clearLayers();

  const markers = [];
  for (const provider of providers) {
    if (provider.lat != null && provider.lon != null) {
      const marker = L.marker([provider.lat, provider.lon]);
      marker.bindPopup(buildPopupContent(provider, sector, profession));
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
      marker.bindPopup(buildPopupContent(provider, '', ''));
      clusters.addLayer(marker);
      markerCount++;
    }
  }

  map.addLayer(clusters);
  console.log(`Map initialized: ${markerCount} markers plotted`);

  return { map, clusters };
}
