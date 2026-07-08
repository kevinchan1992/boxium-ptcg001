/**
 * TCGdex English PTCG Card Bulk Import Script
 *
 * Fetches all English Pokémon TCG cards from TCGdex API and imports them
 * into the cards table. Only extracts the fields we need:
 *   - cardId (prefixed: "tcgdex-{id}")
 *   - name (English name)
 *   - cardNumber (localId)
 *   - setName
 *   - series
 *   - rarity
 *   - imageUrl (TCGdex CDN URL with /high.webp suffix)
 *   - language = 'en'
 *   - gameId = 1 (PTCG)
 *
 * HP, abilities, weaknesses, artist etc. are intentionally NOT stored.
 *
 * Usage:
 *   DATABASE_URL=mysql://... node scripts/tcgdexImport.mjs
 *
 * Or via GitHub Actions (tcgdex-import.yml)
 */

import mysql from 'mysql2/promise';

const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en';
const BATCH_SIZE = 50;          // DB insert batch size
const REQUEST_DELAY_MS = 200;   // Delay between API requests (be polite)
const MAX_RETRIES = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url, retries = 0) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BoxiumTCG-Importer/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.json();
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const wait = 2000 * (retries + 1);
      console.warn(`[TCGdex] Retry ${retries + 1}/${MAX_RETRIES} for ${url} (${err.message}), waiting ${wait}ms`);
      await sleep(wait);
      return fetchJson(url, retries + 1);
    }
    console.error(`[TCGdex] Failed after ${MAX_RETRIES} retries: ${url} — ${err.message}`);
    return null;
  }
}

// ─── DB ───────────────────────────────────────────────────────────────────────

let pool;

async function getPool() {
  if (pool) return pool;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
  const url = dbUrl.includes('timezone=')
    ? dbUrl
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}timezone=%2B08:00`;
  pool = mysql.createPool({
    uri: url,
    connectionLimit: 3,
    charset: 'utf8mb4',
    connectTimeout: 30000,
  });
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[DB] Connected');
  return pool;
}

/**
 * Batch upsert cards. Uses INSERT IGNORE to skip duplicates (by cardId unique key).
 * On re-run, existing cards are left untouched (no overwrite of manually edited data).
 */
async function upsertCards(db, cards) {
  if (!cards.length) return 0;
  const placeholders = cards.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = cards.flatMap(c => [
    c.cardId,
    c.gameId,
    c.name,
    c.series,
    c.setName,
    c.cardNumber,
    c.rarity,
    c.language,
    c.imageUrl,
  ]);
  const sql = `
    INSERT IGNORE INTO cards
      (cardId, gameId, name, series, setName, cardNumber, rarity, language, imageUrl)
    VALUES ${placeholders}
  `;
  const [result] = await db.execute(sql, values);
  return result.affectedRows;
}

// ─── TCGdex Fetching ──────────────────────────────────────────────────────────

async function getAllSets() {
  console.log('[TCGdex] Fetching all sets...');
  const sets = await fetchJson(`${TCGDEX_BASE}/sets`);
  if (!sets || !Array.isArray(sets)) throw new Error('Failed to fetch sets list');
  console.log(`[TCGdex] Found ${sets.length} sets`);
  return sets;
}

async function getSetDetails(setId) {
  const data = await fetchJson(`${TCGDEX_BASE}/sets/${setId}`);
  return data;
}

/**
 * Build image URL from TCGdex image base.
 * TCGdex images are at: {imageBase}/high.webp or {imageBase}/low.webp
 */
function buildImageUrl(imageBase) {
  if (!imageBase) return null;
  return `${imageBase}/high.webp`;
}

/**
 * Map a TCGdex card + set info to our DB schema
 */
function mapCard(card, setName, seriesName) {
  return {
    cardId: `tcgdex-${card.id}`,
    gameId: 1,
    name: card.name || '',
    series: seriesName || null,
    setName: setName || null,
    cardNumber: String(card.localId || ''),
    rarity: card.rarity || null,
    language: 'en',
    imageUrl: buildImageUrl(card.image),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('TCGdex English PTCG Card Bulk Import');
  console.log('='.repeat(60));

  const db = await getPool();

  // Check existing en cards count
  const [existingRows] = await db.execute(
    "SELECT COUNT(*) as cnt FROM cards WHERE language = 'en' AND cardId LIKE 'tcgdex-%'"
  );
  const existingCount = existingRows[0]?.cnt || 0;
  console.log(`[DB] Existing TCGdex cards: ${existingCount}`);

  // Fetch all sets
  const sets = await getAllSets();

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalCards = 0;
  let setsDone = 0;

  for (const setInfo of sets) {
    const setId = setInfo.id;
    const setName = setInfo.name;

    await sleep(REQUEST_DELAY_MS);

    // Fetch full set details (includes cards array + series info)
    const setDetail = await getSetDetails(setId);
    if (!setDetail || !setDetail.cards || !Array.isArray(setDetail.cards)) {
      console.warn(`[TCGdex] ⚠️  Set ${setId} (${setName}): no cards or fetch failed, skipping`);
      setsDone++;
      continue;
    }

    const seriesName = setDetail.serie?.name || null;
    const cardCount = setDetail.cards.length;
    totalCards += cardCount;

    // Map cards to DB format
    const mappedCards = setDetail.cards.map(card => mapCard(card, setName, seriesName));

    // Batch insert
    let setInserted = 0;
    for (let i = 0; i < mappedCards.length; i += BATCH_SIZE) {
      const batch = mappedCards.slice(i, i + BATCH_SIZE);
      const inserted = await upsertCards(db, batch);
      setInserted += inserted;
    }

    const setSkipped = cardCount - setInserted;
    totalInserted += setInserted;
    totalSkipped += setSkipped;
    setsDone++;

    console.log(`[${setsDone}/${sets.length}] ${setName} (${setId}): ${cardCount} cards → inserted ${setInserted}, skipped ${setSkipped}`);
  }

  console.log('='.repeat(60));
  console.log(`✅ Import complete!`);
  console.log(`   Sets processed : ${setsDone}`);
  console.log(`   Total cards    : ${totalCards}`);
  console.log(`   Inserted       : ${totalInserted}`);
  console.log(`   Skipped (dup)  : ${totalSkipped}`);
  console.log('='.repeat(60));

  await pool.end();
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
