/**
 * GitHub Actions SNKRDUNK Discovery Script v2.0
 *
 * Automatically discovers NEW card URLs from SNKRDUNK for 7 TCG brands
 * and inserts them into the database (cards + dataSources tables).
 *
 * Brands covered:
 *   - Pokemon Card Game (gameId=1)
 *   - ONE PIECE (gameId=2)
 *   - YU-GI-OH (gameId=3)
 *   - Dragon Ball Super Card Game (gameId=60001)
 *   - UNION ARENA (gameId=60002)
 *   - Weiß Schwarz (gameId=60003)
 *   - Gundam Card Game (gameId=60004)
 *
 * Strategy v2.0 (FAST BATCH INSERT):
 *   1. Fetch search pages (sortKey=latest) for each brand
 *   2. Extract apparel IDs from HTML
 *   3. Skip IDs already in dataSources table
 *   4. Batch INSERT new IDs directly into cards + dataSources (no per-card HTML fetch)
 *      - cards: placeholder name = "SNKRDUNK Card {id}" (batch-update will fill details later)
 *      - dataSources: sourceUrl + sourceIdentifier only (lastFetchedAt = NULL → batch-update priority)
 *   5. batch-update workflow will auto-run after discovery to fill in card details
 *
 * Required env: DATABASE_URL
 * Optional env: MAX_NEW_PER_BRAND (default: unlimited), DELAY_MS (default: 400, for HTTP only)
 */

import mysql from 'mysql2/promise';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  MAX_NEW_PER_BRAND: parseInt(process.env.MAX_NEW_PER_BRAND || '99999', 10),
  DELAY_MS: parseInt(process.env.DELAY_MS || '400', 10), // Only used for search page HTTP requests
  REQUEST_TIMEOUT: 20000,
  MAX_PAGES_PER_BRAND: parseInt(process.env.MAX_PAGES_PER_BRAND || '99999', 10), // No limit — scan until empty page
  BATCH_SIZE: 500, // Number of cards to insert per batch SQL statement
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ─── TCG Brand Configuration ──────────────────────────────────────────────────
const TCG_BRANDS = [
  { brandSlug: 'pokemon',                    gameId: 1,     name: 'Pokemon Card Game' },
  { brandSlug: 'onepiece',                   gameId: 2,     name: 'ONE PIECE' },
  { brandSlug: 'yu-gi-oh',                   gameId: 3,     name: 'YU-GI-OH' },
  { brandSlug: 'dragon-ball-super-card-game', gameId: 60001, name: 'Dragon Ball Super Card Game' },
  { brandSlug: 'union-arena',                gameId: 60002, name: 'UNION ARENA' },
  { brandSlug: 'weis-schwarz',               gameId: 60003, name: 'Weiß Schwarz' },
  { brandSlug: 'gundam-card-game',           gameId: 60004, name: 'Gundam Card Game' },
];

// ─── Database Connection ──────────────────────────────────────────────────────
let pool;
async function getPool() {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
    const url = dbUrl.includes('timezone=')
      ? dbUrl
      : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}timezone=%2B08:00`;
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 5,
      charset: 'utf8mb4',
      connectTimeout: 30000,
    });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[DB] Connected to MySQL database');
  }
  return pool;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    if (res.status === 404) {
      throw new Error('HTTP 404 Not Found');
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} - unexpected response`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Extract apparel IDs from search page HTML
function extractApparelIds(html) {
  const matches = html.matchAll(/https:\/\/snkrdunk\.com\/apparels\/(\d+)/g);
  const ids = [];
  const seen = new Set();
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      ids.push(m[1]);
    }
  }
  return ids;
}

// ─── Database Operations ──────────────────────────────────────────────────────

// Get ALL existing SNKRDUNK IDs (for cross-brand dedup)
async function getAllExistingSnkrdunkIds() {
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT sourceIdentifier FROM dataSources WHERE source = "snkrdunk"'
  );
  return new Set(rows.map(r => r.sourceIdentifier));
}

/**
 * Batch insert new cards + dataSources without fetching individual card pages.
 * Cards are inserted with placeholder names; batch-update will fill in details later.
 * Uses INSERT IGNORE to handle any race conditions safely.
 *
 * @param {string[]} apparelIds - Array of new SNKRDUNK apparel IDs
 * @param {number} gameId - Game ID for this brand
 * @param {string} brandName - Brand name for logging
 * @returns {{ inserted: number, failed: number }}
 */
async function batchInsertNewCards(apparelIds, gameId, brandName) {
  if (apparelIds.length === 0) return { inserted: 0, failed: 0 };

  const pool = await getPool();
  let totalInserted = 0;
  let totalFailed = 0;

  // Process in chunks of BATCH_SIZE
  for (let i = 0; i < apparelIds.length; i += CONFIG.BATCH_SIZE) {
    const chunk = apparelIds.slice(i, i + CONFIG.BATCH_SIZE);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Step 1: Batch INSERT into cards table (placeholder names)
      // INSERT IGNORE skips duplicates silently
      const cardValues = chunk.map(id => [
        `snkrdunk-${id}`,  // cardId (unique key)
        id,                 // snkrdunkId
        gameId,             // gameId
        `SNKRDUNK Card ${id}`, // name (placeholder — batch-update will update this)
        null,               // nameJa
        null,               // imageUrl
        null,               // cardNumber
        null,               // setName
      ]);

      const cardPlaceholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      await conn.query(
        `INSERT IGNORE INTO cards (cardId, snkrdunkId, gameId, name, nameJa, imageUrl, cardNumber, setName)
         VALUES ${cardPlaceholders}`,
        cardValues.flat()
      );

      // Step 2: Get the card IDs we just inserted (or already existed)
      const cardIdStrs = chunk.map(id => `snkrdunk-${id}`);
      const placeholders = cardIdStrs.map(() => '?').join(', ');
      const [cardRows] = await conn.query(
        `SELECT id, cardId FROM cards WHERE cardId IN (${placeholders})`,
        cardIdStrs
      );

      // Build a map: cardIdStr → db id
      const cardIdMap = new Map(cardRows.map(r => [r.cardId, r.id]));

      // Step 3: Batch INSERT into dataSources table
      const dsValues = [];
      for (const apparelId of chunk) {
        const cardDbId = cardIdMap.get(`snkrdunk-${apparelId}`);
        if (!cardDbId) {
          totalFailed++;
          continue;
        }
        const sourceUrl = `https://snkrdunk.com/apparels/${apparelId}`;
        dsValues.push([cardDbId, gameId, sourceUrl, apparelId]);
      }

      if (dsValues.length > 0) {
        const dsPlaceholders = dsValues.map(() => '(?, ?, \'single_card\', \'snkrdunk\', ?, ?, 1)').join(', ');
        await conn.query(
          `INSERT IGNORE INTO dataSources (cardId, gameId, productType, source, sourceUrl, sourceIdentifier, isActive)
           VALUES ${dsPlaceholders}`,
          dsValues.flat()
        );
        totalInserted += dsValues.length;
      }

      await conn.commit();

      const chunkEnd = Math.min(i + CONFIG.BATCH_SIZE, apparelIds.length);
      console.log(`[Discovery] ${brandName}: batch inserted ${chunkEnd}/${apparelIds.length} (${totalFailed} failed)`);
    } catch (e) {
      await conn.rollback();
      console.error(`[Discovery] ${brandName}: batch insert error (chunk ${i}-${i + chunk.length}): ${e.message}`);
      totalFailed += chunk.length;
    } finally {
      conn.release();
    }
  }

  return { inserted: totalInserted, failed: totalFailed };
}

// ─── Main Discovery Logic ─────────────────────────────────────────────────────

async function discoverBrand(brand, allExistingIds) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Discovery] Brand: ${brand.name} (gameId=${brand.gameId})`);
  console.log(`${'='.repeat(60)}`);

  const newIds = [];
  let page = 1;
  let consecutiveAllExisting = 0;

  // Phase 1: Scan all pages to collect new apparel IDs (HTTP only, no DB writes)
  while (page <= CONFIG.MAX_PAGES_PER_BRAND) {
    const url = `https://snkrdunk.com/search/?brandIds=${brand.brandSlug}&searchCategoryIds=6%2F33&sortKey=latest&page=${page}`;

    let html;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      console.log(`[Discovery] Page ${page} fetch error: ${e.message}`);
      break;
    }

    const ids = extractApparelIds(html);
    if (ids.length === 0) {
      console.log(`[Discovery] Page ${page}: no items found, stopping`);
      break;
    }

    let newOnPage = 0;
    for (const id of ids) {
      if (!allExistingIds.has(id)) {
        newIds.push(id);
        newOnPage++;
      }
    }

    console.log(`[Discovery] Page ${page}: ${ids.length} items, ${newOnPage} new`);

    // Stop after 25 consecutive pages with no new items
    if (newOnPage === 0) {
      consecutiveAllExisting++;
      if (consecutiveAllExisting >= 25) {
        console.log(`[Discovery] 25 consecutive pages with no new items, stopping scan`);
        break;
      }
    } else {
      consecutiveAllExisting = 0;
    }

    page++;
    await delay(CONFIG.DELAY_MS); // Throttle HTTP requests only
  }

  console.log(`[Discovery] Found ${newIds.length} new apparel IDs for ${brand.name}`);

  // Phase 2: Batch insert all new IDs into DB (no per-card HTTP fetch)
  if (newIds.length === 0) {
    return { brand: brand.name, newIds: 0, inserted: 0, failed: 0 };
  }

  console.log(`[Discovery] ${brand.name}: batch inserting ${newIds.length} new cards (no per-card fetch)...`);
  const { inserted, failed } = await batchInsertNewCards(newIds, brand.gameId, brand.name);

  // Update global dedup set
  for (const id of newIds) allExistingIds.add(id);

  return { brand: brand.name, newIds: newIds.length, inserted, failed };
}

async function main() {
  console.log('='.repeat(60));
  console.log('[SNKRDUNK Discovery] Starting v2.0 (Batch Insert Mode)');
  console.log(`[Config] MAX_NEW_PER_BRAND=${CONFIG.MAX_NEW_PER_BRAND === 99999 ? 'unlimited' : CONFIG.MAX_NEW_PER_BRAND}, MAX_PAGES=${CONFIG.MAX_PAGES_PER_BRAND === 99999 ? 'unlimited (scan to last page)' : CONFIG.MAX_PAGES_PER_BRAND}, BATCH_SIZE=${CONFIG.BATCH_SIZE}`);
  console.log('[Note] v2.0: No per-card HTML fetch during discovery. batch-update will fill card details.');
  console.log('='.repeat(60));

  // Load all existing SNKRDUNK IDs once (for deduplication)
  console.log('[DB] Loading existing SNKRDUNK IDs...');
  const allExistingIds = await getAllExistingSnkrdunkIds();
  console.log(`[DB] Found ${allExistingIds.size} existing SNKRDUNK data sources`);

  const results = [];

  for (const brand of TCG_BRANDS) {
    try {
      const result = await discoverBrand(brand, allExistingIds);
      results.push(result);
    } catch (e) {
      console.error(`[Discovery] Fatal error for ${brand.name}: ${e.message}`);
      results.push({ brand: brand.name, newIds: 0, inserted: 0, failed: 0, error: e.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('[SNKRDUNK Discovery] Summary');
  console.log('='.repeat(60));
  let totalInserted = 0;
  for (const r of results) {
    const status = r.error ? `❌ ERROR: ${r.error}` : `✅ ${r.inserted} inserted, ${r.failed} failed`;
    console.log(`  ${r.brand}: ${r.newIds} new found → ${status}`);
    totalInserted += r.inserted || 0;
  }
  console.log(`\n[SNKRDUNK Discovery] Total inserted: ${totalInserted}`);
  console.log('[SNKRDUNK Discovery] Card details (name/image) will be filled by the subsequent batch-update run.');

  if (pool) await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('[SNKRDUNK Discovery] Fatal:', e);
  process.exit(1);
});
