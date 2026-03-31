/**
 * Backfill isSuspectedBulk for existing priceHistory records.
 *
 * Algorithm:
 *   For each (cardId, grade) group in priceHistory (source=snkrdunk, single_card):
 *     1. Collect all JPY prices, sort ascending.
 *     2. Compute median.
 *     3. Flag records where jpyPrice > 4 × median as isSuspectedBulk = true.
 *     4. All others set to isSuspectedBulk = false.
 *
 * Run once after deployment:
 *   node server/backfillSuspectedBulk.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const BULK_MULTIPLIER = 4;

function computeMedian(sortedPrices) {
  if (sortedPrices.length === 0) return null;
  const mid = Math.floor(sortedPrices.length / 2);
  return sortedPrices.length % 2 === 0
    ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
    : sortedPrices[mid];
}

async function main() {
  console.log('[Backfill] Connecting to database...');
  const conn = await mysql.createConnection(DATABASE_URL);

  try {
    // Fetch all SNKRDUNK single_card records
    console.log('[Backfill] Fetching all SNKRDUNK single_card records...');
    const [rows] = await conn.query(
      `SELECT id, cardId, grade, jpyPrice
       FROM priceHistory
       WHERE source = 'snkrdunk' AND productType = 'single_card' AND jpyPrice IS NOT NULL
       ORDER BY cardId, grade, jpyPrice`
    );

    console.log(`[Backfill] Found ${rows.length} records to process`);

    // Group by (cardId, grade)
    const groups = new Map();
    for (const row of rows) {
      const key = `${row.cardId}::${row.grade || ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }

    console.log(`[Backfill] Found ${groups.size} unique (cardId, grade) groups`);

    let flaggedCount = 0;
    let clearedCount = 0;
    let batchUpdates = [];

    for (const [key, groupRows] of groups.entries()) {
      const prices = groupRows.map(r => r.jpyPrice).sort((a, b) => a - b);
      const median = computeMedian(prices);

      if (median === null || median <= 0) continue;

      const threshold = BULK_MULTIPLIER * median;

      for (const row of groupRows) {
        const isSuspectedBulk = row.jpyPrice > threshold ? 1 : 0;
        if (isSuspectedBulk) flaggedCount++;
        else clearedCount++;
        batchUpdates.push([isSuspectedBulk, row.id]);
      }

      // Flush every 1000 updates
      if (batchUpdates.length >= 1000) {
        await conn.query(
          `UPDATE priceHistory SET isSuspectedBulk = CASE id ${batchUpdates.map(() => 'WHEN ? THEN ?').join(' ')} END WHERE id IN (${batchUpdates.map(() => '?').join(',')})`,
          batchUpdates.flatMap(([flag, id]) => [id, flag]).concat(batchUpdates.map(([, id]) => id))
        );
        // Use individual updates for simplicity
        for (const [flag, id] of batchUpdates) {
          await conn.query('UPDATE priceHistory SET isSuspectedBulk = ? WHERE id = ?', [flag, id]);
        }
        console.log(`[Backfill] Flushed ${batchUpdates.length} updates (flagged: ${flaggedCount}, cleared: ${clearedCount})`);
        batchUpdates = [];
      }
    }

    // Flush remaining
    if (batchUpdates.length > 0) {
      for (const [flag, id] of batchUpdates) {
        await conn.query('UPDATE priceHistory SET isSuspectedBulk = ? WHERE id = ?', [flag, id]);
      }
      console.log(`[Backfill] Final flush: ${batchUpdates.length} updates`);
    }

    console.log(`[Backfill] ✅ Done! Flagged: ${flaggedCount}, Cleared: ${clearedCount}`);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
