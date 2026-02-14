// OData client for PerformX API at performx.artiset.ch
// Fetches PrA provider data and profession reference data with in-memory caching

const ODATA_BASE = process.env.ODATA_BASE || 'https://performx.artiset.ch/odata';
const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 86400000; // 24h default
const USER_AGENT = 'INSOS-PrA-Map/1.0 (+https://github.com/oetiker/insos-map)';

const cache = {
  providers: { data: null, timestamp: 0 },
  praLookup: { data: null, timestamp: 0 }
};

/**
 * Fetch PrA providers from OData API.
 * Returns array of raw provider objects with AdressePraktischeAusbildungList expanded.
 */
export async function fetchProviders() {
  const entry = cache.providers;
  if (entry.data && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }

  const params = new URLSearchParams({
    '$filter': 'AdressTypValue eq 0 and AnzahlAdressePraktischeAusbildungList gt 0',
    '$select': 'Id,Firma,AktuelleStrasseUndNummer,AktuellerOrtUndPLZ,AktuelleAdresse,AnzahlAdressePraktischeAusbildungList',
    '$expand': 'AdressePraktischeAusbildungList',
    '$format': 'json'
  });

  const url = `${ODATA_BASE}/Adresse?${params}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`OData API returned ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const data = json.value;
    cache.providers = { data, timestamp: Date.now() };
    return data;
  } catch (err) {
    // Stale-on-error: return cached data if available
    if (entry.data) {
      console.error(`OData fetch failed, serving stale data: ${err.message}`);
      return entry.data;
    }
    throw err;
  }
}

/**
 * Fetch PrA profession reference data from OData API.
 * Returns array of { Id, Bezeichnung } objects.
 */
export async function fetchPraLookup() {
  const entry = cache.praLookup;
  if (entry.data && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }

  const params = new URLSearchParams({
    '$select': 'Id,Bezeichnung',
    '$format': 'json'
  });

  const url = `${ODATA_BASE}/PraktischeAusbildung?${params}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`OData PrA lookup returned ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const data = json.value;
    cache.praLookup = { data, timestamp: Date.now() };
    return data;
  } catch (err) {
    // Stale-on-error: return cached data if available
    if (entry.data) {
      console.error(`OData PrA lookup failed, serving stale data: ${err.message}`);
      return entry.data;
    }
    throw err;
  }
}

/**
 * Clear all cached data. Useful for testing.
 */
export function clearCache() {
  cache.providers = { data: null, timestamp: 0 };
  cache.praLookup = { data: null, timestamp: 0 };
}
