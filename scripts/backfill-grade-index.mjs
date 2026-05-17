/**
 * Backfill snkrdunkGradeIndex from existing snkrdunkListingsCache data.
 * Uses batch inserts for fast processing.
 * Usage: node scripts/backfill-grade-index.mjs
 */
import { createPool } from 'mysql2/promise';

const pool = createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 5,
});

async function main() {
  const conn = await pool.getConnection();
  try {
    // Clear existing index
    console.log('Clearing existing snkrdunkGradeIndex...');
    await conn.execute('DELETE FROM snkrdunkGradeIndex');

    // Fetch all cache rows with non-empty listings in batches
    console.log('Fetching snkrdunkListingsCache rows...');
    const BATCH_SIZE = 500;
    let offset = 0;
    let processed = 0;
    let skipped = 0;
    let totalIndexRows = 0;

    while (true) {
      const [cacheRows] = await conn.query(
        `SELECT cardId, listings FROM snkrdunkListingsCache 
         WHERE listings != '[]' AND listings != 'null' AND listings != '' AND listings IS NOT NULL
         LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      );

      if (cacheRows.length === 0) break;
      console.log(`Processing rows ${offset + 1} to ${offset + cacheRows.length}...`);

      // Build all index rows for this batch
      const indexRows = [];
      for (const row of cacheRows) {
        try {
          const listings = JSON.parse(row.listings);
          if (!Array.isArray(listings) || listings.length === 0) { skipped++; continue; }

          const gradeMap = new Map();
          for (const item of listings) {
            if (item.status && item.status !== 'on-sale') continue;
            if (!item.grade || typeof item.price !== 'number') continue;
            const existing = gradeMap.get(item.grade);
            if (!existing) {
              gradeMap.set(item.grade, { minPrice: item.price, count: 1 });
            } else {
              existing.count++;
              if (item.price < existing.minPrice) existing.minPrice = item.price;
            }
          }

          if (gradeMap.size === 0) { skipped++; continue; }

          for (const [grade, { minPrice, count }] of gradeMap.entries()) {
            indexRows.push([row.cardId, grade, minPrice.toFixed(2), count]);
          }
          processed++;
        } catch (err) {
          skipped++;
        }
      }

      // Batch insert all index rows for this batch
      if (indexRows.length > 0) {
        await conn.query(
          'INSERT INTO snkrdunkGradeIndex (cardId, grade, minPrice, listingCount) VALUES ?',
          [indexRows]
        );
        totalIndexRows += indexRows.length;
      }

      offset += cacheRows.length;
      if (cacheRows.length < BATCH_SIZE) break;
    }

    console.log(`\nBackfill complete:`);
    console.log(`  Processed: ${processed} cards`);
    console.log(`  Skipped:   ${skipped} cards`);
    console.log(`  Index rows created: ${totalIndexRows}`);

    // Verify
    const [countRows] = await conn.execute('SELECT COUNT(*) as cnt FROM snkrdunkGradeIndex');
    console.log(`  Total rows in snkrdunkGradeIndex: ${countRows[0].cnt}`);

    // Show sample grades
    const [gradeRows] = await conn.execute(
      'SELECT grade, COUNT(*) as cnt FROM snkrdunkGradeIndex GROUP BY grade ORDER BY cnt DESC LIMIT 10'
    );
    console.log('\nTop grades in index:');
    for (const r of gradeRows) {
      console.log(`  ${r.grade}: ${r.cnt} cards`);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
