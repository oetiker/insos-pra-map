// Normalizer: transforms raw OData provider data into clean app schema
// Joins PrA profession names from the PraktischeAusbildung lookup table

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
