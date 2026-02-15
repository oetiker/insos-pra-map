// INSOS PrA Map - Hierarchical sector/profession filtering
import L from 'leaflet';

// Sector-to-profession mapping: groups PrA profession name prefixes into sectors.
// Matching: strip "PrA " prefix from offering name, then startsWith any sector entry.
// This object defines grouping rules only -- the dropdown is populated from actual data.
const SECTOR_MAP = {
  'Gastronomie & Hotellerie': [
    'Küche', 'Restaurant', 'Bäckerei-Konditorei-Confiserie',
    'Metzgerei', 'Systemgastronomie', 'Hotellerie', 'Lebensmittel'
  ],
  'Hauswirtschaft & Reinigung': [
    'Hauswirtschaft', 'Reinigungstechnik'
  ],
  'Garten, Floristik & Landwirtschaft': [
    'Gärtnerei', 'Floristik', 'Landwirtschaft', 'Pferdepflege',
    'Tierpflege', 'Forstarbeiten', 'Milchwirtschaft'
  ],
  'Bau & Gebäudetechnik': [
    'Mauerhandwerk', 'Plattenlegen', 'Malerei', 'Gipserei',
    'Bodenlegen', 'Dachdeckarbeiten', 'Strassenbau', 'Abdichten',
    'Entwässerung', 'Gebäudetechnik', 'Lackierung', 'Fassadenbau',
    'Gerüstebau', 'Kältemontage', 'eneuerbare Energien'
  ],
  'Holz & Schreinerei': [
    'Schreinerei', 'Holzbearbeitung'
  ],
  'Metall, Mechanik & Industrie': [
    'Metallbau', 'Mechanik', 'Industrie', 'Kunststoffverarbeitung'
  ],
  'Logistik & Transport': [
    'Logistik', 'Strassentransport', 'Recycling'
  ],
  'Verkauf & Administration': [
    'Detailhandel', 'Büroarbeiten'
  ],
  'Fahrzeuge': [
    'Automobil', 'Zweirad', 'Carrosserie', 'Motorradmechanik'
  ],
  'Betriebsunterhalt & Elektro': [
    'Betriebsunterhalt', 'Elektroarbeiten'
  ],
  'Textil & Handwerk': [
    'Nähen', 'Handweben', 'Flechten', 'Dekorationsnäherei',
    'Textilveredlung', 'Kunsthandwerk', 'Keramik',
    'Coiffeursalon', 'Hundecoiffeursalon'
  ],
  'IT & Medien': [
    'Informatik', 'Mediamatik', 'Printmedien', 'Grafik',
    'Audio- und Videotechnik', 'Veranstaltungstechnik'
  ],
  'Gesundheit & Soziales': [
    'Mitarbeit Begleitung und Pflege Erwachsene',
    'Mitarbeit im Kinderbereich', 'Schulassistenz',
    'Dentalpraxis', 'Gemeindemitarbeit', 'Schauspielerei'
  ],
  'Uhren & Schmuck': [
    'Uhrenarbeiten', 'Grossuhrenmacher', 'Edelsteinfassungen',
    'Schuhreparaturen'
  ]
};

/**
 * Determine which sector a profession name belongs to.
 * @param {string} profName - Full profession name (e.g., "PrA Küche")
 * @returns {string|null} Sector name or null if unmapped
 */
function findSector(profName) {
  const stripped = profName.replace('PrA ', '');
  for (const [sector, prefixes] of Object.entries(SECTOR_MAP)) {
    if (prefixes.some(p => stripped.startsWith(p))) {
      return sector;
    }
  }
  return null;
}

/**
 * Build the list of sectors that have at least one matching provider.
 * Sectors without providers are excluded. Unmapped professions go to "Weitere Berufe".
 * @param {Array} allProviders
 * @returns {string[]} Sorted sector names present in the data
 */
export function getActiveSectors(allProviders) {
  const activeSectors = new Set();
  const unmapped = [];

  for (const provider of allProviders) {
    for (const offering of provider.praOfferings) {
      const sector = findSector(offering.name);
      if (sector) {
        activeSectors.add(sector);
      } else {
        unmapped.push(offering.name);
      }
    }
  }

  if (unmapped.length > 0) {
    console.warn('Unmapped PrA professions (will appear in "Weitere Berufe"):', [...new Set(unmapped)]);
    activeSectors.add('Weitere Berufe');
  }

  return [...activeSectors].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Filter providers by sector and optionally by specific profession.
 * @param {Array} allProviders
 * @param {string} selectedSector - Sector name or empty string for all
 * @param {string} selectedProfession - Full profession name or empty string for all in sector
 * @returns {Array} Filtered providers
 */
export function filterProviders(allProviders, selectedSector, selectedProfession) {
  if (!selectedSector) return allProviders;

  // Handle catch-all sector
  const isWeitere = selectedSector === 'Weitere Berufe';

  return allProviders.filter(provider =>
    provider.praOfferings.some(offering => {
      if (isWeitere) {
        const mapped = findSector(offering.name) !== null;
        if (mapped) return false;
        if (selectedProfession) return offering.name === selectedProfession;
        return true;
      }

      const prefixes = SECTOR_MAP[selectedSector];
      if (!prefixes) return false;

      const stripped = offering.name.replace('PrA ', '');
      const inSector = prefixes.some(p => stripped.startsWith(p));
      if (!inSector) return false;
      if (selectedProfession) return offering.name === selectedProfession;
      return true;
    })
  );
}

/**
 * Get sorted unique profession names within a sector from actual provider data.
 * @param {Array} allProviders
 * @param {string} sectorName
 * @returns {string[]} Sorted profession names (full, with "PrA " prefix)
 */
export function getProfessionsInSector(allProviders, sectorName) {
  const isWeitere = sectorName === 'Weitere Berufe';
  const professions = new Set();

  for (const provider of allProviders) {
    for (const offering of provider.praOfferings) {
      if (isWeitere) {
        if (findSector(offering.name) === null) {
          professions.add(offering.name);
        }
      } else {
        const prefixes = SECTOR_MAP[sectorName];
        if (!prefixes) continue;
        const stripped = offering.name.replace('PrA ', '');
        if (prefixes.some(p => stripped.startsWith(p))) {
          professions.add(offering.name);
        }
      }
    }
  }

  return [...professions].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Create a Leaflet custom control with sector and profession dropdowns.
 * @param {Array} allProviders - Full provider dataset
 * @param {Function} onFilterChange - Callback(sector, profession)
 * @returns {L.Control} Leaflet control instance
 */
export function createFilterControl(allProviders, onFilterChange) {
  const FilterControl = L.Control.extend({
    options: { position: 'topright' },

    onAdd() {
      const container = L.DomUtil.create('div', 'filter-control');
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      // Sector label and dropdown
      const sectorLabel = L.DomUtil.create('label', 'filter-label', container);
      sectorLabel.textContent = 'Bereich';

      const sectorSelect = L.DomUtil.create('select', 'filter-select', container);
      sectorSelect.innerHTML = '<option value="">Alle Bereiche</option>';

      const activeSectors = getActiveSectors(allProviders);
      for (const sector of activeSectors) {
        const opt = document.createElement('option');
        opt.value = sector;
        opt.textContent = sector;
        sectorSelect.appendChild(opt);
      }

      // Profession label and dropdown (hidden until sector selected)
      const profLabel = L.DomUtil.create('label', 'filter-label', container);
      profLabel.textContent = 'Beruf';
      profLabel.style.display = 'none';

      const profSelect = L.DomUtil.create('select', 'filter-select', container);
      profSelect.innerHTML = '<option value="">Alle Berufe</option>';
      profSelect.style.display = 'none';

      sectorSelect.addEventListener('change', () => {
        const sector = sectorSelect.value;
        if (sector) {
          const profs = getProfessionsInSector(allProviders, sector);
          profSelect.innerHTML = '<option value="">Alle Berufe</option>';
          for (const prof of profs) {
            const opt = document.createElement('option');
            opt.value = prof;
            opt.textContent = prof.replace('PrA ', '');
            profSelect.appendChild(opt);
          }
          profLabel.style.display = '';
          profSelect.style.display = '';
        } else {
          profLabel.style.display = 'none';
          profSelect.style.display = 'none';
          profSelect.value = '';
        }
        onFilterChange(sector, profSelect.value);
      });

      profSelect.addEventListener('change', () => {
        onFilterChange(sectorSelect.value, profSelect.value);
      });

      // Expose select references for external access (e.g., hash state restoration)
      this.sectorSelect = sectorSelect;
      this.profSelect = profSelect;

      return container;
    }
  });

  const control = new FilterControl();
  control.sectorSelect = null;
  control.profSelect = null;
  return control;
}
