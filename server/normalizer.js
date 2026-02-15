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
