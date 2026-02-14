// Persistent SQLite geocode cache
// Stores address-to-coordinate mappings to avoid redundant geo.admin.ch API calls

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const DB_PATH = join(DATA_DIR, 'geocode-cache.sqlite');

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

// Open database with WAL mode for performance
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS geocodes (
    address TEXT PRIMARY KEY,
    lat REAL,
    lon REAL,
    approximate INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Prepare statements (compiled once for performance)
const getStmt = db.prepare('SELECT lat, lon, approximate FROM geocodes WHERE address = ?');
const setStmt = db.prepare(`
  INSERT OR REPLACE INTO geocodes (address, lat, lon, approximate)
  VALUES (?, ?, ?, ?)
`);

/**
 * Get cached geocode result for an address.
 * @param {string} address - The address to look up
 * @returns {{ lat: number, lon: number, approximate: number } | null}
 */
export function getCachedGeocode(address) {
  const row = getStmt.get(address);
  return row || null;
}

/**
 * Cache a geocode result for an address.
 * @param {string} address - The address key
 * @param {number} lat - WGS84 latitude
 * @param {number} lon - WGS84 longitude
 * @param {boolean} approximate - true if city/PLZ center fallback
 */
export function setCachedGeocode(address, lat, lon, approximate) {
  setStmt.run(address, lat, lon, approximate ? 1 : 0);
}
