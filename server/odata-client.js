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
 * Fetch Kommunikationsmittel (contact data) for a list of provider IDs.
 * Batches requests in groups of 20 IDs using `or` chains to stay within URL limits.
 *
 * @param {string[]} providerIds - Array of provider ID GUIDs
 * @returns {Promise<Array>} Array of { AdresseId, KommunikationstypValue, Wert } records
 */
export async function fetchKommunikationsmittel(providerIds) {
  const BATCH_SIZE = 20;
  const allResults = [];

  for (let i = 0; i < providerIds.length; i += BATCH_SIZE) {
    const batch = providerIds.slice(i, i + BATCH_SIZE);
    const orFilter = batch
      .map(id => `AdresseId eq ${id}`)
      .join(' or ');

    const params = new URLSearchParams({
      '$filter': `(${orFilter}) and IstAktiv eq true`,
      '$select': 'AdresseId,KommunikationstypValue,Wert',
      '$format': 'json'
    });

    const url = `${ODATA_BASE}/Kommunikationsmittel?${params}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (response.ok) {
      const json = await response.json();
      allResults.push(...json.value);
    } else {
      console.warn(`Kommunikationsmittel batch ${Math.floor(i / BATCH_SIZE) + 1} returned ${response.status}`);
    }

    // Politeness delay between batch requests
    if (i + BATCH_SIZE < providerIds.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return allResults;
}

/**
 * Clear all cached data. Useful for testing.
 */
export function clearCache() {
  cache.providers = { data: null, timestamp: 0 };
  cache.praLookup = { data: null, timestamp: 0 };
}
