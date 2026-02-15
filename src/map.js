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
      marker.bindPopup(`<strong>${provider.name}</strong>`);
      clusters.addLayer(marker);
      markerCount++;
    }
  }

  map.addLayer(clusters);
  console.log(`Map initialized: ${markerCount} markers plotted`);

  return { map, clusters };
}
