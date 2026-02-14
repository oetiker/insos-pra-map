// Geocoder using geo.admin.ch (Swisstopo) with persistent cache and fallback
// Rate-limited to max 10 req/sec (100ms sleep between calls)

import { getCachedGeocode, setCachedGeocode } from './geocode-cache.js';

const GEO_API = process.env.GEO_API || 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geocode a single address via geo.admin.ch.
 * Uses cache-first strategy with fallback to PLZ/Ort center.
 *
 * @param {string} street - Street and number (e.g. "Arbonerstrasse 17")
 * @param {string} plzOrt - PLZ and city (e.g. "8580 Amriswil")
 * @returns {Promise<{ lat: number, lon: number, approximate: boolean } | null>}
 */
export async function geocodeAddress(street, plzOrt) {
  const address = `${street}, ${plzOrt}`;

  // Check cache first
  const cached = getCachedGeocode(address);
  if (cached) {
    return {
      lat: cached.lat,
      lon: cached.lon,
      approximate: Boolean(cached.approximate)
    };
  }

  // Try full street address geocoding
  try {
    const params = new URLSearchParams({
      searchText: `${street} ${plzOrt}`,
      type: 'locations',
      origins: 'address',
      sr: '4326',
      limit: '1'
    });

    const response = await fetch(`${GEO_API}?${params}`);
    if (response.ok) {
      const json = await response.json();
      if (json.results && json.results.length > 0) {
        const attrs = json.results[0].attrs;
        const lat = attrs.lat;
        const lon = attrs.lon;
        setCachedGeocode(address, lat, lon, false);
        return { lat, lon, approximate: false };
      }
    }
  } catch (err) {
    console.error(`Geocoding failed for "${address}": ${err.message}`);
  }

  // Fallback: PLZ/Ort only (city center)
  try {
    const fallbackParams = new URLSearchParams({
      searchText: plzOrt,
      type: 'locations',
      origins: 'zipcode',
      sr: '4326',
      limit: '1'
    });

    const fallbackResponse = await fetch(`${GEO_API}?${fallbackParams}`);
    if (fallbackResponse.ok) {
      const fallbackJson = await fallbackResponse.json();
      if (fallbackJson.results && fallbackJson.results.length > 0) {
        const attrs = fallbackJson.results[0].attrs;
        const lat = attrs.lat;
        const lon = attrs.lon;
        setCachedGeocode(address, lat, lon, true);
        return { lat, lon, approximate: true };
      }
    }
  } catch (err) {
    console.error(`Fallback geocoding failed for "${plzOrt}": ${err.message}`);
  }

  // Both failed — provider will have null coordinates
  console.warn(`Could not geocode: "${address}"`);
  return null;
}

/**
 * Geocode all providers that don't already have coordinates.
 * Sequential with 100ms sleep between API calls for rate limiting.
 *
 * @param {Array} providers - Array of normalized provider objects
 * @returns {Promise<Array>} Same array with lat/lon/approximate filled in
 */
export async function geocodeAll(providers) {
  let geocoded = 0;
  let cacheHits = 0;
  const total = providers.length;

  for (let i = 0; i < total; i++) {
    const provider = providers[i];

    // Skip providers that already have coordinates
    if (provider.lat != null && provider.lon != null) {
      continue;
    }

    const street = provider.street || '';
    const plzOrt = provider.plzOrt || '';

    if (!street && !plzOrt) {
      continue;
    }

    // Check if this address is already cached (to count cache hits)
    const address = `${street}, ${plzOrt}`;
    const wasCached = getCachedGeocode(address) !== null;

    const result = await geocodeAddress(street, plzOrt);

    if (result) {
      provider.lat = result.lat;
      provider.lon = result.lon;
      provider.approximate = result.approximate;
    }

    geocoded++;

    if (wasCached) {
      cacheHits++;
    } else {
      // Only sleep between actual API calls (not cache hits)
      await sleep(100);
    }

    // Log progress every 50 providers
    if (geocoded % 50 === 0) {
      console.log(`Geocoded ${geocoded}/${total} providers...`);
    }
  }

  console.log(
    `Geocoding complete: ${geocoded} processed, ${cacheHits} cache hits, ${geocoded - cacheHits} API calls`
  );

  return providers;
}
