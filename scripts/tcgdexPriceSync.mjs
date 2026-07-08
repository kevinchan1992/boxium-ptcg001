/**
 * TCGdex Price Sync Script
 * 
 * Fetches TCGPlayer (USD) and Cardmarket (EUR) market reference prices
 * from TCGdex API and upserts them into the tcgMarketPrices table.
 * 
 * This is separate from priceHistory (which stores actual PSA 10 transaction records).
 * tcgMarketPrices stores CURRENT MARKET REFERENCE PRICES for ungraded English cards.
 * 
 * TCGdex pricing structure:
 *   card.pricing.tcgplayer.holofoil.{lowPrice, midPrice, highPrice, marketPrice}
 *   card.pricing.tcgplayer["reverse-holofoil"].{...}
 *   card.pricing.tcgplayer.normal.{...}
 *   card.pricing.cardmarket.{avg, low, trend, avg7, avg30}
 * 
 * Usage:
 *   node scripts/tcgdexPriceSync.mjs
 *   DRY_RUN=true node scripts/tcgdexPriceSync.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const DRY_RUN = process.env.DRY_RUN === 'true';
const DELAY_MS = 150; // delay between API calls to be polite
const BATCH_SIZE = 100; // DB upsert batch size

if (!DATABASE_URL) {
  console.error('[ERROR] DATABASE_URL environment variable is required');
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        console.log(`[WARN] Rate limited, waiting 10s...`);
        await sleep(10000);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (i === retries - 1) return null;
      await sleep(2000);
    }
  }
  return null;
}

/**
 * Extract the best available TCGPlayer price from pricing object.
 * Priority: holofoil > reverse-holofoil > normal > firstEditionHolofoil
 */
function extractTcgPrices(tcgplayer) {
  if (!tcgplayer) return { low: null, mid: null, high: null, market: null };
  const variant = tcgplayer.holofoil 
    || tcgplayer['reverse-holofoil'] 
    || tcgplayer.normal 
    || tcgplayer.firstEditionHolofoil
    || null;
  if (!variant) return { low: null, mid: null, high: null, market: null };
  return {
    low: variant.lowPrice ?? null,
    mid: variant.midPrice ?? null,
    high: variant.highPrice ?? null,
    market: variant.marketPrice ?? null,
  };
}

async function upsertBatch(pool, batch) {
  if (batch.length === 0) return;
  const conn = await pool.getConnection();
  try {
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = batch.flat();
    await conn.execute(
      `INSERT INTO tcgMarketPrices (cardId, tcgCardId, tcgLow, tcgMid, tcgHigh, tcgMarket, cmAvg, cmTrend, cmAvg7, cmAvg30)
       VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE
         tcgLow = VALUES(tcgLow),
         tcgMid = VALUES(tcgMid),
         tcgHigh = VALUES(tcgHigh),
         tcgMarket = VALUES(tcgMarket),
         cmAvg = VALUES(cmAvg),
         cmTrend = VALUES(cmTrend),
         cmAvg7 = VALUES(cmAvg7),
         cmAvg30 = VALUES(cmAvg30),
         updatedAt = NOW()`,
      values
    );
  } finally {
    conn.release();
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('[TCGdex Price Sync] Starting...');
  console.log(`[TCGdex Price Sync] Dry run: ${DRY_RUN}`);
  console.log('='.repeat(70));

  // Connect to DB using pool
  // Strip ssl={...} from URL (mysql2 doesn't support that format) and add ssl option separately
  let dbUrl = DATABASE_URL.replace(/[?&]ssl=\{[^}]*\}/g, '');
  dbUrl = dbUrl.includes('timezone') ? dbUrl
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}timezone=%2B08:00`;
  const pool = mysql.createPool({
    uri: dbUrl,
    ssl: { rejectUnauthorized: true },
    connectionLimit: 3,
    charset: 'utf8mb4',
    connectTimeout: 30000,
  });

  // Test connection
  const testConn = await pool.getConnection();
  await testConn.ping();
  testConn.release();
  console.log('[DB] Connected');

  // Get all English cards from DB that have a tcgdex- prefix cardId
  const readConn = await pool.getConnection();
  const [rows] = await readConn.execute(
    `SELECT id, cardId as tcgCardId FROM cards WHERE language = 'en' AND cardId LIKE 'tcgdex-%' LIMIT 100000`
  );
  readConn.release();
  console.log(`[DB] Found ${rows.length} English cards with tcgdex IDs`);

  if (rows.length === 0) {
    console.log('[WARN] No English cards found. Run tcgdexImport.mjs first.');
    await pool.end();
    return;
  }

  // Build a map: tcgCardId -> DB numeric id
  const cardMap = new Map();
  for (const row of rows) {
    cardMap.set(row.tcgCardId, row.id);
  }

  // Fetch all sets
  const sets = await fetchWithRetry('https://api.tcgdex.net/v2/en/sets');
  if (!sets) {
    console.error('[ERROR] Failed to fetch sets');
    await pool.end();
    process.exit(1);
  }
  console.log(`[API] Found ${sets.length} sets`);

  let totalProcessed = 0;
  let totalWithPrice = 0;
  let totalUpserted = 0;
  const batch = [];

  for (let si = 0; si < sets.length; si++) {
    const set = sets[si];
    const setData = await fetchWithRetry(`https://api.tcgdex.net/v2/en/sets/${set.id}`);
    if (!setData || !setData.cards) {
      await sleep(DELAY_MS);
      continue;
    }

    for (const cardRef of setData.cards) {
      const tcgCardId = `tcgdex-${set.id}-${cardRef.localId}`;
      const dbId = cardMap.get(tcgCardId);
      if (!dbId) continue; // card not in our DB

      // Fetch full card data for prices
      const cardData = await fetchWithRetry(`https://api.tcgdex.net/v2/en/cards/${set.id}-${cardRef.localId}`);
      totalProcessed++;

      if (!cardData) {
        await sleep(DELAY_MS);
        continue;
      }

      const pricing = cardData.pricing || {};

      // Extract TCGPlayer prices
      const tcg = extractTcgPrices(pricing.tcgplayer);

      // Extract Cardmarket prices
      const cm = pricing.cardmarket || {};
      const cmAvg = cm.avg ?? null;
      const cmTrend = cm.trend ?? null;
      const cmAvg7 = cm.avg7 ?? null;
      const cmAvg30 = cm.avg30 ?? null;

      // Only add to batch if at least one price exists
      const hasPrice = [tcg.low, tcg.mid, tcg.high, tcg.market, cmAvg, cmTrend, cmAvg7, cmAvg30]
        .some(p => p !== null);

      if (hasPrice) {
        totalWithPrice++;
        batch.push([dbId, tcgCardId, tcg.low, tcg.mid, tcg.high, tcg.market, cmAvg, cmTrend, cmAvg7, cmAvg30]);
      }

      // Flush batch
      if (batch.length >= BATCH_SIZE) {
        if (!DRY_RUN) {
          await upsertBatch(pool, batch);
          totalUpserted += batch.length;
        }
        batch.length = 0;
      }

      await sleep(DELAY_MS);
    }

    const pct = (((si + 1) / sets.length) * 100).toFixed(1);
    if ((si + 1) % 10 === 0 || si === sets.length - 1) {
      console.log(`[Progress] ${si + 1}/${sets.length} sets (${pct}%) | processed: ${totalProcessed} | with price: ${totalWithPrice} | upserted: ${totalUpserted}`);
    }
  }

  // Flush remaining batch
  if (batch.length > 0 && !DRY_RUN) {
    await upsertBatch(pool, batch);
    totalUpserted += batch.length;
  }

  await pool.end();

  console.log('='.repeat(70));
  console.log('[TCGdex Price Sync] Complete!');
  console.log(`  Cards processed:   ${totalProcessed}`);
  console.log(`  Cards with prices: ${totalWithPrice}`);
  console.log(`  Records upserted:  ${DRY_RUN ? '0 (dry run)' : totalUpserted}`);
  console.log('='.repeat(70));
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
