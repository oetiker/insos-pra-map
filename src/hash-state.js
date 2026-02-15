// INSOS PrA Map - URL hash state persistence for shareable URLs

/**
 * Write current app state to URL hash without creating a history entry.
 * Uses short keys (s, p, lat, lng, z, pid) to keep URLs compact.
 * @param {string} sector - Current sector filter value (empty string = all)
 * @param {string} profession - Current profession filter value (empty string = all)
 * @param {L.Map} map - Leaflet map instance
 * @param {string} [pid=''] - Provider ID for open popup (empty string = none)
 */
export function writeHash(sector, profession, map, pid = '') {
  const p = new URLSearchParams();
  if (sector) p.set('s', sector);
  if (profession) p.set('p', profession);
  const c = map.getCenter();
  p.set('lat', c.lat.toFixed(4));
  p.set('lng', c.lng.toFixed(4));
  p.set('z', String(map.getZoom()));
  if (pid) p.set('pid', pid);
  history.replaceState(null, '', '#' + p.toString());
}

/**
 * Read app state from URL hash. Returns null if no hash present.
 * @returns {{ sector: string, profession: string, lat: number, lng: number, z: number, pid: string } | null}
 */
export function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return null;
  const p = new URLSearchParams(raw);
  return {
    sector: p.get('s') || '',
    profession: p.get('p') || '',
    lat: p.has('lat') ? parseFloat(p.get('lat')) : NaN,
    lng: p.has('lng') ? parseFloat(p.get('lng')) : NaN,
    z: p.has('z') ? parseInt(p.get('z'), 10) : NaN,
    pid: p.get('pid') || ''
  };
}
