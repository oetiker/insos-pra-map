# Phase 3: Provider Details - Research

**Researched:** 2026-02-15
**Domain:** Leaflet popup content with provider contact data from PerformX OData API
**Confidence:** HIGH

## Summary

Phase 3 upgrades the minimal name-only marker popup (from Phase 2) to a full provider detail popup showing organization name, address, phone, email, website, and a link to the provider's INSOS member page. This phase has two distinct implementation areas: (1) enhancing the data pipeline to fetch contact information from the PerformX Kommunikationsmittel entity, and (2) building a rich HTML popup template for Leaflet markers.

The key discovery is that contact data (email, phone, website) is **available** from the OData API but requires fetching the `Kommunikationsmittel` entity separately -- it cannot be `$expand`ed on the Adresse query (returns HTTP 400). The Kommunikationsmittel entity uses `KommunikationstypValue` integers to distinguish types: 0=Email, 1=Phone, 2=Mobile, 3=Website, 10=Billing Email. Sampling 10 of our 365 PrA providers confirms that all 10 have email, phone, and website data. Fetching must be done per-provider or in batched `or` filters (the `in` operator is not supported), then joined to the provider data in the normalizer.

For the INSOS member page link (PROV-02), there is no provider-specific deep link available. The INSOS member directory is a React SPA widget (`performx.artiset.ch/public/Adresse/MitgliederWidgetInsos`) embedded in an iframe at `insos.ch/de/ueber-uns#unsere-mitglieder-268211`. It uses client-side routing without hash-based deep links. The best approach is to link to the general member directory page where the user can search for the provider by name.

**Primary recommendation:** Extend the build-data.js pipeline to fetch Kommunikationsmittel per-provider in batches, map the type values to email/phone/website fields, and update the normalizer. Then replace the `bindPopup` call in map.js with a function that generates rich HTML content, styled with inline CSS or a small CSS class, and including a link to the INSOS member directory.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Leaflet | 1.9.4 (already installed) | Popup rendering via `bindPopup()` | Already in use. Popup accepts HTML strings or DOM elements. No additional library needed. |

### Supporting

No additional libraries needed for Phase 3. Leaflet's built-in popup handles HTML content natively. Styling uses Tailwind (already installed) or inline styles within the popup HTML.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML string popup | Leaflet sidebar plugin | Over-engineered for contact card display. Sidebar is better for Phase 4/5 filter UI, not detail popups. |
| HTML string popup | Custom DOM element via `L.popup({ content: el })` | Slightly cleaner separation of concerns but adds complexity for a simple contact card. HTML string is the Leaflet convention for simple content. |
| Inline CSS in popup | External CSS with `.popup-*` classes | External CSS is cleaner. Since we use Tailwind, can use `@apply` in style.css or add utility classes directly in popup HTML. Tailwind classes in popup HTML are simplest. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── map.js              # MODIFY: update bindPopup to use rich HTML template
├── main.js             # No changes needed
├── style.css           # MODIFY: add popup styling rules
├── index.html          # No changes needed
└── public/
    └── data/
        └── providers.json  # UPDATED: now includes phone, email, website, insosUrl

server/
├── normalizer.js       # MODIFY: join Kommunikationsmittel data into provider records
├── odata-client.js     # MODIFY: add fetchKommunikationsmittel() function

scripts/
└── build-data.js       # MODIFY: call fetchKommunikationsmittel in pipeline
```

### Pattern 1: Fetching Kommunikationsmittel from OData

**What:** Fetch contact data (email, phone, website) from the PerformX Kommunikationsmittel entity and join it to provider records at build time.

**When to use:** In the build-data pipeline, after fetching providers but before writing the JSON output.

**Key constraint:** The `$expand=Kommunikationsmittel` on Adresse returns HTTP 400. Must query Kommunikationsmittel as a separate entity. The `in` filter operator is not supported; must use `or` chains.

**Verified approach:**
```javascript
// server/odata-client.js — new function
export async function fetchKommunikationsmittel(providerIds) {
  // Batch into groups of ~20 IDs per request (URL length limit)
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
    }

    // Politeness delay
    await new Promise(r => setTimeout(r, 200));
  }

  return allResults;
}
```

**Source:** Verified against PerformX OData API on 2026-02-15. `or` filter confirmed working. `in` operator returns 400.

### Pattern 2: Kommunikationsmittel Type Mapping

**What:** Map `KommunikationstypValue` integer to semantic contact field names.

**Verified type mapping (from API data sampling):**

| KommunikationstypValue | Meaning | Field Name | Example Value |
|------------------------|---------|------------|---------------|
| 0 | Email | `email` | `info@aba-amriswil.ch` |
| 1 | Phone (landline) | `phone` | `+41 71 414 13 13` |
| 2 | Mobile phone | (merge into `phone` if no type 1) | `+41 79 786 64 03` |
| 3 | Website | `website` | `https://www.aba-amriswil.ch` |
| 10 | Billing email | (ignore — not user-facing) | `rechnung@aba-amriswil.ch` |

**Normalizer join logic:**
```javascript
// server/normalizer.js — enhanced
function extractContactInfo(kommunikationsmittel, adresseId) {
  const records = kommunikationsmittel
    .filter(k => k.AdresseId === adresseId);

  const byType = {};
  for (const r of records) {
    // Keep first of each type (oldest/primary)
    if (!byType[r.KommunikationstypValue]) {
      byType[r.KommunikationstypValue] = r.Wert;
    }
  }

  return {
    email: byType[0] || null,             // Type 0: Email
    phone: byType[1] || byType[2] || null, // Type 1: Phone, fallback Type 2: Mobile
    website: byType[3] || null             // Type 3: Website
  };
}
```

**Source:** Direct API testing on 2026-02-15. Sampled 10/365 PrA providers: all 10 had type 0 (email), type 1 (phone), and type 3 (website).

### Pattern 3: Rich Popup HTML Template

**What:** Generate structured HTML for the Leaflet popup showing provider contact details.

**When to use:** Replace the current `marker.bindPopup('<strong>name</strong>')` with a function that builds the full contact card.

**Popup content requirements (from PROV-01, PROV-02):**
1. Organization name (bold heading)
2. Address (street + PLZ Ort)
3. Phone number (clickable `tel:` link)
4. Email (clickable `mailto:` link)
5. Website (clickable external link, opens new tab)
6. Link to INSOS member directory page

**Verified approach:**
```javascript
// src/map.js — popup builder function
function buildPopupContent(provider) {
  const lines = [];

  lines.push(`<strong class="popup-name">${esc(provider.name)}</strong>`);
  lines.push(`<span class="popup-address">${esc(provider.street)}<br>${esc(provider.plzOrt)}</span>`);

  if (provider.phone) {
    lines.push(`<a href="tel:${esc(provider.phone)}">${esc(provider.phone)}</a>`);
  }
  if (provider.email) {
    lines.push(`<a href="mailto:${esc(provider.email)}">${esc(provider.email)}</a>`);
  }
  if (provider.website) {
    const display = provider.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    lines.push(`<a href="${esc(provider.website)}" target="_blank" rel="noopener">${esc(display)}</a>`);
  }

  lines.push(`<a href="${esc(provider.insosUrl)}" target="_blank" rel="noopener" class="popup-insos-link">INSOS Mitgliederverzeichnis</a>`);

  return `<div class="popup-content">${lines.join('<br>')}</div>`;
}

// HTML escaping to prevent XSS from provider data
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

**Source:** Leaflet 1.9.4 `bindPopup` accepts HTML strings. Popup default `maxWidth: 300` and `minWidth: 50` handle most content widths. The popup auto-pans to stay visible (`autoPan: true` by default).

### Pattern 4: INSOS Member Directory Link

**What:** Construct the best available link to the provider's INSOS member page.

**Key finding:** There is no provider-specific deep link. The INSOS member widget at `performx.artiset.ch/public/Adresse/MitgliederWidgetInsos` is a React SPA with client-side routing only. No hash-based or query parameter-based deep linking to individual providers was found.

**Recommended approach:**
```javascript
// Link to the INSOS member directory page on insos.ch
// The anchor #unsere-mitglieder-268211 scrolls to the widget section
const INSOS_MEMBER_URL = 'https://www.insos.ch/de/ueber-uns#unsere-mitglieder-268211';

// In provider data:
// insosUrl: INSOS_MEMBER_URL (same for all providers)
```

**Alternative considered:** Link directly to `performx.artiset.ch/public/Adresse/MitgliederWidgetInsos` which loads the widget standalone. However, this lacks the INSOS site branding and context. Linking to the insos.ch page is more user-friendly.

**Source:** Verified 2026-02-15. Widget HTML is a single React shell (`<div id="root">`) with no server-side rendering. Tested URL patterns: `/public/Adresse/MitgliederWidgetMasterDetail/Id={guid}`, `/cui/o/Adresse/Id={guid}/MitgliederWidgetInsos`, `/cui/o/Adresse/Id={guid}/PublicDetail` -- all return the same SPA shell (1213 bytes) with no content differentiation.

### Anti-Patterns to Avoid

- **Fetching Kommunikationsmittel at request time:** All contact data must be fetched at build time and baked into providers.json. There is no runtime server.
- **Using `innerHTML` directly with unescaped provider data:** Provider names and addresses come from an external API. Always HTML-escape before inserting into popup content.
- **Trying `$expand=Kommunikationsmittel` on the Adresse query:** This returns HTTP 400. Must query as a separate entity.
- **Using the OData `in` operator:** The PerformX API does not support `$filter=AdresseId in (...)`. Use `or` chains instead.
- **Setting popup `maxWidth` too small:** The default 300px is appropriate for contact cards. Reducing it causes address and URL wrapping that hurts readability.
- **Omitting `target="_blank"` on external links:** Popup links to INSOS and provider websites must open in new tabs. Without `target="_blank"`, clicking a link navigates away from the map.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML escaping | Custom regex replacements | Simple entity replacement function (5 chars: `& < > " '`) | XSS prevention. Provider data is external input. Standard HTML entity escaping covers all cases. |
| Popup positioning | Custom overlay positioning | Leaflet `L.popup` with `autoPan: true` (default) | Handles map edge cases, scroll into view, viewport constraints |
| `tel:` and `mailto:` links | Custom click handlers | Standard `<a href="tel:">` / `<a href="mailto:">` | Mobile browsers natively handle these URI schemes. No JS needed. |
| Phone number formatting | Custom formatter | Display the raw value from the API as-is | Swiss phone numbers from the API are already formatted (e.g., "+41 71 414 13 13"). Reformatting risks breaking numbers. |

**Key insight:** The popup is pure HTML/CSS inside Leaflet's popup container. No framework, no templating library, no custom overlay needed. The complexity is in the data pipeline (fetching and joining Kommunikationsmittel), not the UI.

## Common Pitfalls

### Pitfall 1: Kommunikationsmittel Fetch Timeout for Bulk Queries

**What goes wrong:** Fetching all Kommunikationsmittel records at once (`$filter=AdresseId ne null`) times out (verified: curl exits with code 28 after 30 seconds).
**Why it happens:** The Kommunikationsmittel table contains records for all entities (not just PrA providers), and the PerformX API does not optimize for broad scans.
**How to avoid:** Batch queries by provider ID using `or` chains. Groups of ~20 IDs per request work reliably. With 365 providers, this is ~19 requests at 200ms intervals = ~4 seconds total.
**Warning signs:** curl timeout errors, empty response bodies, HTTP 504.

### Pitfall 2: Multiple Contact Records Per Type

**What goes wrong:** A provider has multiple email addresses (type 0) or multiple phone numbers (type 1), and the popup shows a confusing list of all of them.
**Why it happens:** Kommunikationsmittel allows multiple records per type per address (e.g., primary email + additional contacts).
**How to avoid:** Take the first record per type. In the PerformX data, the first/oldest record appears to be the primary one. For email, filter out billing email (type 10) -- only use type 0. For phone, prefer landline (type 1) over mobile (type 2).
**Warning signs:** Popup showing 3+ emails or phones for a single provider.

### Pitfall 3: Popup Content Overflow on Mobile

**What goes wrong:** Long organization names, URLs, or addresses overflow the popup container, causing horizontal scrolling or truncation.
**Why it happens:** Leaflet popup `maxWidth` defaults to 300px. Some provider names are long (e.g., "Aebli Ofenbau und Plattenbelage GmbH") and URLs can be 40+ characters.
**How to avoid:** Use CSS `word-wrap: break-word` and `overflow-wrap: break-word` on popup content. Set `maxWidth: 300` (default is fine). Use `maxHeight` with scrolling for very long content. Truncate displayed URLs (strip `https://` prefix and trailing `/`).
**Warning signs:** Popup extends beyond map viewport on mobile. Horizontal scrollbar appears.

### Pitfall 4: Missing Contact Data for Some Providers

**What goes wrong:** Some providers may lack one or more contact fields (phone, email, or website), and the popup shows empty lines or "null".
**Why it happens:** Not all providers have complete data in the PerformX system.
**How to avoid:** Conditionally render each contact field -- only include the `<a>` tag and line if the field is not null. Never display "null" or empty links.
**Warning signs:** Popup shows "null" text or blank clickable links.

### Pitfall 5: XSS via Provider Data

**What goes wrong:** A malicious or malformed provider name/address containing `<script>` or HTML tags could inject code into the popup.
**Why it happens:** Provider data comes from an external API. Using `innerHTML` or template literals without escaping is unsafe.
**How to avoid:** Always HTML-escape provider data before inserting into popup HTML. Escape the 5 critical characters: `& < > " '`.
**Warning signs:** Any `<` or `>` characters in provider names or addresses in the raw data.

## Code Examples

### Build Pipeline Enhancement

```javascript
// scripts/build-data.js — modified pipeline
import { fetchProviders, fetchPraLookup, fetchKommunikationsmittel } from '../server/odata-client.js';
import { normalizeProviders } from '../server/normalizer.js';
import { geocodeAll } from '../server/geocoder.js';

async function buildData() {
  const [rawProviders, praLookup] = await Promise.all([
    fetchProviders(),
    fetchPraLookup()
  ]);

  const normalized = normalizeProviders(rawProviders, praLookup);

  // NEW: Fetch contact data
  const providerIds = normalized.map(p => p.id);
  const kontakt = await fetchKommunikationsmittel(providerIds);

  // Join contact data into normalized providers
  for (const provider of normalized) {
    const records = kontakt.filter(k => k.AdresseId === provider.id);
    const byType = {};
    for (const r of records) {
      if (!byType[r.KommunikationstypValue]) {
        byType[r.KommunikationstypValue] = r.Wert;
      }
    }
    provider.email = byType[0] || null;
    provider.phone = byType[1] || byType[2] || null;
    provider.website = byType[3] || null;
  }

  const geocoded = await geocodeAll(normalized);
  // ... write output
}
```

### Popup HTML Template

```javascript
// src/map.js — popup builder
const INSOS_URL = 'https://www.insos.ch/de/ueber-uns#unsere-mitglieder-268211';

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPopupContent(provider) {
  let html = `<div class="provider-popup">`;
  html += `<strong>${esc(provider.name)}</strong>`;
  html += `<p class="provider-popup-address">${esc(provider.street)}<br>${esc(provider.plzOrt)}</p>`;

  if (provider.phone) {
    html += `<p><a href="tel:${esc(provider.phone)}">${esc(provider.phone)}</a></p>`;
  }
  if (provider.email) {
    html += `<p><a href="mailto:${esc(provider.email)}">${esc(provider.email)}</a></p>`;
  }
  if (provider.website) {
    const display = provider.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    html += `<p><a href="${esc(provider.website)}" target="_blank" rel="noopener">${esc(display)}</a></p>`;
  }

  html += `<p class="provider-popup-insos"><a href="${INSOS_URL}" target="_blank" rel="noopener">INSOS Mitgliederverzeichnis</a></p>`;
  html += `</div>`;
  return html;
}

// Usage in initMap:
const marker = L.marker([provider.lat, provider.lon]);
marker.bindPopup(buildPopupContent(provider));
clusters.addLayer(marker);
```

### Popup CSS Styling

```css
/* src/style.css — popup styling */
.provider-popup {
  font-size: 14px;
  line-height: 1.4;
}
.provider-popup strong {
  font-size: 15px;
  display: block;
  margin-bottom: 4px;
}
.provider-popup-address {
  color: #555;
  margin: 4px 0;
}
.provider-popup p {
  margin: 2px 0;
}
.provider-popup a {
  color: #0066cc;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
.provider-popup-insos {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #eee;
}
```

### Updated Provider Data Shape

```json
{
  "providers": [
    {
      "id": "356071fb-1390-4b39-a3db-4d64da2b9b6e",
      "name": "ABA Amriswil",
      "street": "Arbonerstrasse 17",
      "plzOrt": "8580 Amriswil",
      "fullAddress": "ABA Amriswil\nArbonerstrasse 17\n8580 Amriswil",
      "lat": 47.5449,
      "lon": 9.3020,
      "approximate": false,
      "praOfferings": [{ "id": "735f3424-...", "name": "PrA Industrie" }],
      "praCount": 8,
      "website": "https://www.aba-amriswil.ch",
      "phone": "+41 71 414 13 13",
      "email": "info@aba-amriswil.ch"
    }
  ]
}
```

Note: The `insosUrl` field is not stored per-provider since it is the same for all providers. The popup template uses a constant URL.

## OData Kommunikationsmittel API Details

**Verified 2026-02-15:** The Kommunikationsmittel entity is directly queryable.

### Successful Query Patterns

| Query | Result |
|-------|--------|
| `$filter=AdresseId eq {guid} and IstAktiv eq true` | Returns contact records for one provider |
| `$filter=(AdresseId eq {guid1} or AdresseId eq {guid2}) and IstAktiv eq true` | Returns contact records for multiple providers |
| `$select=AdresseId,KommunikationstypValue,Wert` | Returns only the fields we need |

### Failed Query Patterns

| Query | Error |
|-------|-------|
| `$expand=Kommunikationsmittel` on Adresse | HTTP 400 |
| `$filter=AdresseId in ({guid1},{guid2})` | HTTP 400 |
| `$filter=AdresseId ne null` (no pagination, large result set) | Timeout |

### KommunikationstypValue Reference

| Value | Meaning | Count in Sample (10 providers) | Use in App |
|-------|---------|-------------------------------|------------|
| 0 | Email | 10/10 providers | `email` field |
| 1 | Phone (landline) | 10/10 providers | `phone` field (primary) |
| 2 | Mobile | varies | `phone` fallback (if no type 1) |
| 3 | Website | 10/10 providers | `website` field |
| 10 | Billing email | 4/10 providers | Ignored (not user-facing) |

### Data Coverage Assessment

Sampled 10 of 365 PrA providers (first 10 alphabetically):
- 10/10 have email (type 0)
- 10/10 have phone (type 1)
- 10/10 have website (type 3)

**Confidence: MEDIUM** -- 10-provider sample may not represent all 365. Some smaller organizations may lack website or phone data. The popup must handle missing fields gracefully.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Contact fields hard-coded to null in normalizer | Fetch from Kommunikationsmittel entity | Phase 3 (this phase) | Enables popup display of phone, email, website |
| Minimal popup (name only) | Full contact card popup | Phase 3 (this phase) | Core user value: see provider details without leaving the map |
| No INSOS page link | Link to member directory | Phase 3 (this phase) | Users can navigate to full INSOS listing from popup |

**Deprecated/outdated:**
- Phase 1 research noted `$expand=Kommunikationsmittel` as failing. This remains true. The workaround (separate entity query) is confirmed working.
- Phase 1 research suggested `insosUrl` as a per-provider field. Since no provider-specific deep link exists, this is now a global constant.

## Open Questions

1. **Contact data coverage across all 365 providers**
   - What we know: 10/10 sampled providers have email, phone, and website.
   - What's unclear: Whether all 365 have the same coverage. Some small organizations may lack a website or use only mobile (type 2) without a landline (type 1).
   - Recommendation: Fetch all contact data at build time. Log providers with missing fields. Handle gracefully in popup (omit fields that are null). This will become clear once the pipeline runs.

2. **Batch size limit for `or` filter chains**
   - What we know: 2-ID `or` chain works. URL length is the practical limit.
   - What's unclear: Maximum number of GUIDs in a single `or` chain before hitting URL length limits or API errors.
   - Recommendation: Use batches of 20 IDs (20 GUIDs * 36 chars + operators = ~1000 chars, well within typical URL limits). Can adjust up if testing shows larger batches work.

3. **Future provider-specific deep linking**
   - What we know: The PerformX widget SPA has no deep link support today.
   - What's unclear: Whether PerformX will add deep linking in the future, or if there is an undocumented hash parameter.
   - Recommendation: Use the general INSOS member directory URL for now. If deep linking becomes available, it is a one-line change in the popup template. Store the pattern as a constant for easy update.

## Sources

### Primary (HIGH confidence)
- PerformX OData API `Kommunikationsmittel` entity -- verified working with `AdresseId` filter, `KommunikationstypValue` type mapping confirmed by data inspection (2026-02-15)
- Leaflet 1.9.4 Popup options -- verified from `node_modules/leaflet/dist/leaflet-src.js`: `maxWidth: 300`, `minWidth: 50`, `maxHeight: null`, `autoPan: true`
- Existing `src/map.js` -- current `bindPopup` call at line 60: `marker.bindPopup('<strong>${provider.name}</strong>')`
- Existing `server/normalizer.js` -- contact fields are currently hard-coded to null (lines 45-47)
- Existing `server/odata-client.js` -- `$select` does not include contact fields (line 25)
- Existing `src/public/data/providers.json` -- all 365 providers have `website: null, phone: null, email: null`

### Secondary (MEDIUM confidence)
- INSOS member widget inspection -- confirmed SPA with no deep linking (HTML is 1213-byte React shell, tested multiple URL patterns)
- KommunikationstypValue mapping -- inferred from data values (type 0 contains email addresses, type 1 phone numbers, type 3 URLs), not documented in API metadata
- Contact data coverage -- 10/365 providers sampled, may not represent full dataset

### Tertiary (LOW confidence)
- Batch query size limit of 20 -- conservative estimate based on URL length, not tested at scale
- `KommunikationstypValue` completeness -- only observed values 0, 1, 2, 3, 10; other values may exist

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries needed. Leaflet popup API is well-documented and already in use.
- Architecture: HIGH -- Data pipeline extension pattern is clear (separate entity fetch + join). Popup is pure HTML.
- Data source: HIGH -- Kommunikationsmittel entity is verified accessible and contains the needed contact data.
- Pitfalls: HIGH -- Key issues (batch timeout, missing data, XSS) are well-understood with clear mitigations.

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days -- OData API structure and Leaflet 1.x are stable)
