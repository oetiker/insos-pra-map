// Build-time data pipeline: fetch OData -> normalize -> geocode -> write static JSON
// This script runs at build time (npm run build:data) to bake provider data into the static site.

import 'dotenv/config';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { fetchProviders, fetchPraLookup } from '../server/odata-client.js';
import { normalizeProviders } from '../server/normalizer.js';
import { geocodeAll } from '../server/geocoder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../src/public/data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'providers.json');
const SEED_FILE = join(__dirname, '../server/seed-data.json');

async function buildData() {
  console.log('Starting data pipeline...');

  try {
    // Fetch both data sources in parallel
    console.log('Fetching OData providers and PrA lookup...');
    const [rawProviders, praLookup] = await Promise.all([
      fetchProviders(),
      fetchPraLookup()
    ]);
    console.log(`Fetched ${rawProviders.length} providers and ${praLookup.length} PrA professions`);

    // Normalize
    console.log('Normalizing provider data...');
    const normalized = normalizeProviders(rawProviders, praLookup);
    console.log(`Normalized to ${normalized.length} providers`);

    // Geocode
    console.log('Geocoding providers...');
    const geocoded = await geocodeAll(normalized);

    // Write output
    const output = {
      providers: geocoded,
      meta: {
        count: geocoded.length,
        generatedAt: new Date().toISOString()
      }
    };

    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`Wrote ${geocoded.length} providers to ${OUTPUT_FILE}`);
    process.exit(0);
  } catch (err) {
    console.error(`Pipeline failed: ${err.message}`);
    console.warn('Falling back to seed data...');

    try {
      const seedRaw = readFileSync(SEED_FILE, 'utf-8');
      const seedData = JSON.parse(seedRaw);

      const output = {
        providers: seedData,
        meta: {
          count: seedData.length,
          generatedAt: new Date().toISOString()
        }
      };

      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
      console.warn(`Wrote ${seedData.length} providers from seed data to ${OUTPUT_FILE}`);
      process.exit(0);
    } catch (fallbackErr) {
      console.error(`Seed data fallback also failed: ${fallbackErr.message}`);
      process.exit(1);
    }
  }
}

buildData();
