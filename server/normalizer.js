// Normalizer: transforms raw OData provider data into clean app schema
// Joins PrA profession names from the PraktischeAusbildung lookup table
// Joins Kommunikationsmittel contact data (email, phone, website)

/**
 * Normalize raw OData providers into the app schema.
 *
 * @param {Array} rawProviders - Array from fetchProviders() (OData Adresse objects)
 * @param {Array} praLookup - Array from fetchPraLookup() (OData PraktischeAusbildung objects)
 * @returns {Array} Normalized provider objects
 */
export function normalizeProviders(rawProviders, praLookup) {
  // Build PrA profession lookup map: { Id -> Bezeichnung }
  const praMap = new Map();
  for (const pra of praLookup) {
    praMap.set(pra.Id, pra.Bezeichnung);
  }

  return rawProviders
    .filter((raw) => {
      // Filter out providers missing both street and PLZ/Ort (defensive)
      const hasStreet = raw.AktuelleStrasseUndNummer && raw.AktuelleStrasseUndNummer.trim();
      const hasPlzOrt = raw.AktuellerOrtUndPLZ && raw.AktuellerOrtUndPLZ.trim();
      return hasStreet || hasPlzOrt;
    })
    .map((raw) => {
      // Build praOfferings by joining with lookup map
      const praOfferings = (raw.AdressePraktischeAusbildungList || []).map(
        (entry) => ({
          id: entry.PraktischeAusbildungId,
          name: praMap.get(entry.PraktischeAusbildungId) || 'Unknown'
        })
      );

      return {
        id: raw.Id,
        name: raw.Firma,
        street: raw.AktuelleStrasseUndNummer,
        plzOrt: raw.AktuellerOrtUndPLZ,
        fullAddress: (raw.AktuelleAdresse || '').replace(/\r\n/g, '\n'),
        lat: null,
        lon: null,
        approximate: false,
        praOfferings,
        praCount: raw.AnzahlAdressePraktischeAusbildungList,
        website: null,
        phone: null,
        email: null
      };
    });
}

// Keywords in locationInfo that indicate non-work locations (no PrA relevance)
const EXCLUDE_KEYWORDS = [
  'wohnen', 'wohnheim', 'wohngruppe', 'tagesstätte',
  'rechnungseingang', 'sozialberatung'
];

/**
 * Extract the location info line from AktuelleAdresse.
 * The address format is: "Firma\n[LocationInfo\n]Strasse\nPLZ Ort"
 * If there are 4+ lines, line 2 is the location info (e.g. "Gärtnerei", "Produktion Olten").
 * @param {string} fullAddress
 * @param {string} firma - Firm name to skip
 * @param {string} street - Street to skip
 * @param {string} plzOrt - PLZ+Ort to skip
 * @returns {string|null} Location info or null
 */
function extractLocationInfo(fullAddress, firma, street, plzOrt) {
  if (!fullAddress) return null;
  const lines = fullAddress.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  // Remove known lines (firma, street, plzOrt) — what remains is location info
  const known = new Set([firma, street, plzOrt].filter(Boolean).map(s => s.trim()));
  const extra = lines.filter(l => !known.has(l));
  return extra.length > 0 ? extra.join(', ') : null;
}

/**
 * Add sibling locations for multi-site firms.
 * For firms that have PrA providers, find their other Typ-0 addresses
 * and create provider entries with inherited PrA offerings.
 *
 * @param {Array} providers - Normalized providers (with PrA)
 * @param {Array} allAddresses - Raw Typ-0 addresses from fetchAllAddresses()
 * @param {Array} praLookup - PrA lookup table
 * @returns {Array} Extended providers array (original + siblings)
 */
export function addSiblingLocations(providers, allAddresses, praLookup) {
  // Build set of existing provider IDs and their addresses for dedup
  const existingIds = new Set(providers.map(p => p.id));
  const existingAddresses = new Set(providers.map(p => `${p.name}|${p.street}|${p.plzOrt}`));

  // Build map: Firma -> aggregated praOfferings from all PrA providers of that firm
  const firmaPra = new Map();
  for (const p of providers) {
    const key = p.name;
    if (!firmaPra.has(key)) {
      firmaPra.set(key, []);
    }
    for (const o of p.praOfferings) {
      // Avoid duplicates
      if (!firmaPra.get(key).some(e => e.id === o.id)) {
        firmaPra.get(key).push(o);
      }
    }
  }

  // Find sibling addresses: same Firma, Typ-0, but no own PrA
  const siblings = [];
  for (const raw of allAddresses) {
    // Skip if this address already has PrA (already in providers)
    if (existingIds.has(raw.Id)) continue;
    // Skip if the firm doesn't have any PrA providers
    if (!firmaPra.has(raw.Firma)) continue;
    // Must have address data
    const hasStreet = raw.AktuelleStrasseUndNummer && raw.AktuelleStrasseUndNummer.trim();
    const hasPlzOrt = raw.AktuellerOrtUndPLZ && raw.AktuellerOrtUndPLZ.trim();
    if (!hasStreet && !hasPlzOrt) continue;
    // Skip duplicates at same address as an existing provider or sibling
    const addrKey = `${raw.Firma}|${raw.AktuelleStrasseUndNummer}|${raw.AktuellerOrtUndPLZ}`;
    if (existingAddresses.has(addrKey)) continue;
    existingAddresses.add(addrKey);

    const locationInfo = extractLocationInfo(
      raw.AktuelleAdresse, raw.Firma,
      raw.AktuelleStrasseUndNummer, raw.AktuellerOrtUndPLZ
    );

    // Filter out non-work locations
    if (locationInfo) {
      const lower = locationInfo.toLowerCase();
      if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) continue;
    }

    siblings.push({
      id: raw.Id,
      name: raw.Firma,
      street: raw.AktuelleStrasseUndNummer,
      plzOrt: raw.AktuellerOrtUndPLZ,
      fullAddress: (raw.AktuelleAdresse || '').replace(/\r\n/g, '\n'),
      lat: null,
      lon: null,
      approximate: false,
      praOfferings: firmaPra.get(raw.Firma),
      praCount: raw.AnzahlAdressePraktischeAusbildungList || 0,
      website: null,
      phone: null,
      email: null,
      inheritedPra: true,
      locationInfo
    });
  }

  console.log(`Added ${siblings.length} sibling locations from ${new Set(siblings.map(s => s.name)).size} firms`);
  return [...providers, ...siblings];
}

/**
 * Join Kommunikationsmittel contact data into normalized provider records.
 * Maps KommunikationstypValue to contact fields:
 *   0 = email, 1 = phone (landline, preferred), 2 = mobile (fallback),
 *   3 = website, 10 = billing email (ignored)
 *
 * @param {Array} providers - Normalized provider array (mutated in-place)
 * @param {Array} kommunikationsmittel - Array of { AdresseId, KommunikationstypValue, Wert }
 * @returns {Array} The same providers array with email, phone, website populated
 */
export function joinContactData(providers, kommunikationsmittel) {
  // Build a map: AdresseId -> array of records for fast lookup
  const byAdresse = new Map();
  for (const k of kommunikationsmittel) {
    if (!byAdresse.has(k.AdresseId)) {
      byAdresse.set(k.AdresseId, []);
    }
    byAdresse.get(k.AdresseId).push(k);
  }

  for (const provider of providers) {
    const records = byAdresse.get(provider.id) || [];
    const byType = {};
    for (const r of records) {
      // Keep first record per type (primary/oldest)
      if (byType[r.KommunikationstypValue] === undefined) {
        byType[r.KommunikationstypValue] = r.Wert;
      }
    }

    provider.email = byType[0] || null;              // Type 0: Email
    provider.phone = byType[1] || byType[2] || null;  // Type 1: Phone, fallback Type 2: Mobile
    provider.website = byType[3] || null;              // Type 3: Website
  }

  return providers;
}
