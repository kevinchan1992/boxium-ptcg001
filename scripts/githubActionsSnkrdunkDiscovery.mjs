/**
 * GitHub Actions SNKRDUNK Discovery Script v1.0
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
 * Strategy:
 *   1. Fetch search pages (sortKey=latest) for each brand
 *   2. Extract apparel IDs from HTML
 *   3. Skip IDs already in dataSources table
 *   4. For new IDs: fetch apparel page, extract card info
 *   5. Insert into cards + dataSources tables
 *
 * Required env: DATABASE_URL
 * Optional env: MAX_NEW_PER_BRAND (default: 200), DELAY_MS (default: 500)
 */

import mysql from 'mysql2/promise';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  MAX_NEW_PER_BRAND: parseInt(process.env.MAX_NEW_PER_BRAND || '200', 10),
  DELAY_MS: parseInt(process.env.DELAY_MS || '500', 10),
  REQUEST_TIMEOUT: 20000,
  MAX_PAGES_PER_BRAND: parseInt(process.env.MAX_PAGES_PER_BRAND || '50', 10),
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
      throw new Error('HTTP 404 Not Found - card may have been removed from SNKRDUNK');
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

// Extract card info from apparel page HTML
function extractCardInfo(html, apparelId) {
  // Extract Japanese name (og:title or h1)
  let nameJa = '';
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
  if (ogTitle) {
    nameJa = ogTitle[1].replace(/\s*-\s*SNKRDUNK.*$/, '').trim();
  }
  if (!nameJa) {
    const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1) nameJa = h1[1].trim();
  }

  // Extract English name (og:description or meta description)
  let name = nameJa; // fallback to Japanese name
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
  if (metaDesc) {
    // Try to extract English name from description
    const engMatch = metaDesc[1].match(/^([A-Za-z0-9\s\-\[\]\/\(\)\.,'&!?:]+)/);
    if (engMatch && engMatch[1].trim().length > 3) {
      name = engMatch[1].trim();
    }
  }

  // Extract image URL
  let imageUrl = null;
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImage) imageUrl = ogImage[1];

  // Extract card number from name (e.g., "[SM-P 288]" or "[M2a 223/193]")
  let cardNumber = null;
  const cardNumMatch = nameJa.match(/\[([^\]]+)\]/);
  if (cardNumMatch) cardNumber = cardNumMatch[1].trim();

  // Extract set name from breadcrumb or title
  let setName = null;
  const breadcrumb = html.match(/breadcrumb[^>]*>.*?<\/[^>]+>/s);
  if (breadcrumb) {
    const parts = breadcrumb[0].match(/>[^<>]+</g);
    if (parts && parts.length >= 3) {
      setName = parts[parts.length - 2].replace(/[><]/g, '').trim();
    }
  }

  return {
    name: name || `SNKRDUNK Card ${apparelId}`,
    nameJa: nameJa || null,
    imageUrl,
    cardNumber,
    setName,
  };
}

// ─── Database Operations ──────────────────────────────────────────────────────

// Get all existing SNKRDUNK IDs for a game
async function getExistingSnkrdunkIds(gameId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT sourceIdentifier FROM dataSources WHERE source = "snkrdunk" AND gameId = ?',
    [gameId]
  );
  return new Set(rows.map(r => r.sourceIdentifier));
}

// Get ALL existing SNKRDUNK IDs (for cross-brand dedup)
async function getAllExistingSnkrdunkIds() {
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT sourceIdentifier FROM dataSources WHERE source = "snkrdunk"'
  );
  return new Set(rows.map(r => r.sourceIdentifier));
}

// Insert new card + dataSource
async function insertNewCard(apparelId, gameId, cardInfo) {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const cardIdStr = `snkrdunk-${apparelId}`;
    const sourceUrl = `https://snkrdunk.com/apparels/${apparelId}`;

    // Check if card already exists (by cardId)
    const [existing] = await conn.query(
      'SELECT id FROM cards WHERE cardId = ? LIMIT 1',
      [cardIdStr]
    );

    let cardDbId;
    if (existing.length > 0) {
      cardDbId = existing[0].id;
      // Update card info if needed
      await conn.query(
        'UPDATE cards SET name=?, nameJa=?, imageUrl=COALESCE(?, imageUrl), cardNumber=COALESCE(?, cardNumber), snkrdunkId=?, updatedAt=NOW() WHERE id=?',
        [cardInfo.name, cardInfo.nameJa, cardInfo.imageUrl, cardInfo.cardNumber, apparelId, cardDbId]
      );
    } else {
      // Insert new card (ON DUPLICATE KEY to handle race conditions)
      const [result] = await conn.query(
        `INSERT INTO cards (cardId, snkrdunkId, gameId, name, nameJa, imageUrl, cardNumber, setName, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE snkrdunkId=VALUES(snkrdunkId), updatedAt=NOW()`,
        [cardIdStr, apparelId, gameId, cardInfo.name, cardInfo.nameJa, cardInfo.imageUrl, cardInfo.cardNumber, cardInfo.setName]
      );
      if (result.insertId > 0) {
        cardDbId = result.insertId;
      } else {
        const [existRow] = await conn.query('SELECT id FROM cards WHERE cardId = ? LIMIT 1', [cardIdStr]);
        cardDbId = existRow[0]?.id;
      }
    }

    // Insert dataSource
    await conn.query(
      `INSERT INTO dataSources (cardId, gameId, productType, source, sourceUrl, sourceIdentifier, isActive, createdAt, updatedAt)
       VALUES (?, ?, 'single_card', 'snkrdunk', ?, ?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE updatedAt=NOW()`,
      [cardDbId, gameId, sourceUrl, apparelId]
    );

    await conn.commit();
    return cardDbId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ─── Main Discovery Logic ─────────────────────────────────────────────────────

async function discoverBrand(brand, allExistingIds) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Discovery] Brand: ${brand.name} (gameId=${brand.gameId})`);
  console.log(`${'='.repeat(60)}`);

  const newIds = [];
  let page = 1;
  let consecutiveAllExisting = 0;

  // Scan pages until we hit MAX_PAGES or MAX_NEW_PER_BRAND
  while (page <= CONFIG.MAX_PAGES_PER_BRAND && newIds.length < CONFIG.MAX_NEW_PER_BRAND) {
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

    // If entire page has existing IDs, we've caught up
    if (newOnPage === 0) {
      consecutiveAllExisting++;
      if (consecutiveAllExisting >= 3) {
        console.log(`[Discovery] 3 consecutive pages with no new items, stopping scan`);
        break;
      }
    } else {
      consecutiveAllExisting = 0;
    }

    page++;
    await delay(CONFIG.DELAY_MS);
  }

  console.log(`[Discovery] Found ${newIds.length} new apparel IDs for ${brand.name}`);

  // Now fetch card info for each new ID and insert into DB
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < newIds.length; i++) {
    const apparelId = newIds[i];
    const url = `https://snkrdunk.com/apparels/${apparelId}`;

    try {
      const html = await fetchHtml(url);
      const cardInfo = extractCardInfo(html, apparelId);

      await insertNewCard(apparelId, brand.gameId, cardInfo);
      allExistingIds.add(apparelId); // Update global set to avoid cross-brand duplicates

      inserted++;
      if (inserted % 10 === 0 || inserted === newIds.length) {
        console.log(`[Discovery] ${brand.name}: ${inserted}/${newIds.length} inserted (${failed} failed)`);
      }
    } catch (e) {
      failed++;
      console.log(`[Discovery] Failed to insert ${apparelId}: ${e.message}`);
    }

    await delay(CONFIG.DELAY_MS);
  }

  return { brand: brand.name, newIds: newIds.length, inserted, failed };
}

async function main() {
  console.log('='.repeat(60));
  console.log('[SNKRDUNK Discovery] Starting v1.0');
  console.log(`[Config] MAX_NEW_PER_BRAND=${CONFIG.MAX_NEW_PER_BRAND}, MAX_PAGES=${CONFIG.MAX_PAGES_PER_BRAND}`);
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

  if (pool) await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('[SNKRDUNK Discovery] Fatal:', e);
  process.exit(1);
});
