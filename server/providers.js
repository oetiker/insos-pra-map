// Provider data pipeline: fetch -> normalize -> geocode -> serve
// With in-memory result cache, stale-on-error, and seed data fallback

import { fetchProviders, fetchPraLookup } from './odata-client.js';
import { normalizeProviders } from './normalizer.js';
import { geocodeAll } from './geocoder.js';
import seedData from './seed-data.json' with { type: 'json' };

const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 86400000; // 24h default

// In-memory cache of fully processed providers
let cachedResult = null;
let cachedTimestamp = 0;

/**
 * Get fully processed, geocoded providers.
 * Pipeline: OData fetch -> normalize -> geocode -> return
 * Falls back to stale cache or seed data on error.
 *
 * @returns {Promise<{ providers: Array, meta: Object }>}
 */
export async function getProviders() {
  // Return fresh cached result if available
  if (cachedResult && (Date.now() - cachedTimestamp < CACHE_TTL)) {
    return {
      providers: cachedResult,
      meta: {
        count: cachedResult.length,
        fetchedAt: new Date(cachedTimestamp).toISOString(),
        stale: false,
        seedData: false
      }
    };
  }

  try {
    // Live pipeline: fetch -> normalize -> geocode
    const [rawProviders, praLookup] = await Promise.all([
      fetchProviders(),
      fetchPraLookup()
    ]);

    const normalized = normalizeProviders(rawProviders, praLookup);
    const geocoded = await geocodeAll(normalized);

    // Cache the result
    cachedResult = geocoded;
    cachedTimestamp = Date.now();

    return {
      providers: geocoded,
      meta: {
        count: geocoded.length,
        fetchedAt: new Date(cachedTimestamp).toISOString(),
        stale: false,
        seedData: false
      }
    };
  } catch (err) {
    console.error(`Provider pipeline failed: ${err.message}`);

    // Serve stale cached data if available
    if (cachedResult) {
      console.warn('Serving stale cached data');
      return {
        providers: cachedResult,
        meta: {
          count: cachedResult.length,
          fetchedAt: new Date(cachedTimestamp).toISOString(),
          stale: true,
          seedData: false
        }
      };
    }

    // Cold start fallback: serve seed data
    console.warn('Serving seed data fallback');
    return {
      providers: seedData,
      meta: {
        count: seedData.length,
        fetchedAt: null,
        stale: false,
        seedData: true
      }
    };
  }
}
