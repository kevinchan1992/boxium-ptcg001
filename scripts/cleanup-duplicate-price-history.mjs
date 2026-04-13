/**
 * cleanup-duplicate-price-history.mjs
 *
 * One-time migration script to:
 * 1. Identify duplicate priceHistory rows (same cardId+source+grade+soldAt+jpyPrice+sourcePosition)
 * 2. Keep the row with the lowest id (earliest insert), delete the rest
 * 3. Backfill recordHash for all SNKRDUNK rows that have NULL recordHash
 *
 * Run: node scripts/cleanup-duplicate-price-history.mjs
 */
import { createPool } from 'mysql2/promise';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = createPool({
  uri: process.env.DATABASE_URL,
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: false,
});

/**
 * Compute the same recordHash as server/utils/recordHash.ts
 */
function computeRecordHash({ cardId, source, grade, soldAt, jpyPrice, sourcePosition }) {
  const soldAtStr = soldAt
    ? (soldAt instanceof Date ? soldAt : new Date(soldAt)).toISOString().slice(0, 10)
    : '__nodate__';
  const normalizedGrade = (grade ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const key = [
    cardId,
    source,
    normalizedGrade || '__none__',
    soldAtStr,
    jpyPrice != null ? Math.round(jpyPrice) : '__noprice__',
    sourcePosition ?? 0,
  ].join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 64);
}

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('=== SNKRDUNK priceHistory Deduplication Migration ===\n');

    // Step 1: Find duplicate groups
    console.log('Step 1: Finding duplicate rows...');
    const [dupGroups] = await conn.query(`
      SELECT 
        cardId, source, grade, 
        DATE(soldAt) as soldDate,
        jpyPrice, sourcePosition,
        COUNT(*) as cnt,
        MIN(id) as keepId,
        GROUP_CONCAT(id ORDER BY id ASC) as allIds
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, DATE(soldAt), jpyPrice, sourcePosition
      HAVING COUNT(*) > 1
      LIMIT 10000
    `);

    console.log(`Found ${dupGroups.length} duplicate groups\n`);

    let totalDeleted = 0;
    if (dupGroups.length > 0) {
      console.log('Step 2: Deleting duplicate rows (keeping lowest id)...');
      for (const group of dupGroups) {
        const ids = group.allIds.split(',').map(Number);
        const keepId = group.keepId;
        const deleteIds = ids.filter(id => id !== keepId);
        
        if (deleteIds.length > 0) {
          await conn.query(
            `DELETE FROM priceHistory WHERE id IN (${deleteIds.join(',')}) AND source = 'snkrdunk'`
          );
          totalDeleted += deleteIds.length;
        }
      }
      console.log(`Deleted ${totalDeleted} duplicate rows\n`);
    }

    // Step 2: Backfill recordHash for SNKRDUNK rows with NULL recordHash
    console.log('Step 3: Backfilling recordHash for SNKRDUNK rows...');
    const [nullHashRows] = await conn.query(`
      SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition
      FROM priceHistory
      WHERE source = 'snkrdunk' AND recordHash IS NULL
      LIMIT 50000
    `);

    console.log(`Found ${nullHashRows.length} rows without recordHash`);

    let backfilled = 0;
    let hashConflicts = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < nullHashRows.length; i += BATCH_SIZE) {
      const batch = nullHashRows.slice(i, i + BATCH_SIZE);
      const updates = [];
      const seenHashes = new Set();

      for (const row of batch) {
        const hash = computeRecordHash({
          cardId: row.cardId,
          source: row.source,
          grade: row.grade,
          soldAt: row.soldAt,
          jpyPrice: row.jpyPrice,
          sourcePosition: row.sourcePosition,
        });

        if (seenHashes.has(hash)) {
          // Hash collision within batch — this row is a duplicate, delete it
          await conn.query(`DELETE FROM priceHistory WHERE id = ? AND source = 'snkrdunk'`, [row.id]);
          hashConflicts++;
          continue;
        }
        seenHashes.add(hash);
        updates.push([hash, row.id]);
      }

      if (updates.length > 0) {
        // Batch update using CASE WHEN
        const caseWhen = updates.map(([hash, id]) => `WHEN id = ${id} THEN '${hash}'`).join(' ');
        const ids = updates.map(([, id]) => id).join(',');
        try {
          await conn.query(`
            UPDATE priceHistory 
            SET recordHash = CASE ${caseWhen} END
            WHERE id IN (${ids}) AND recordHash IS NULL
          `);
          backfilled += updates.length;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            // Handle hash conflicts one by one
            for (const [hash, id] of updates) {
              try {
                await conn.query(
                  `UPDATE priceHistory SET recordHash = ? WHERE id = ? AND recordHash IS NULL`,
                  [hash, id]
                );
                backfilled++;
              } catch (e2) {
                if (e2.code === 'ER_DUP_ENTRY') {
                  // Duplicate hash — delete this row
                  await conn.query(`DELETE FROM priceHistory WHERE id = ?`, [id]);
                  hashConflicts++;
                } else {
                  console.error(`Failed to update id=${id}:`, e2.message);
                }
              }
            }
          } else {
            throw err;
          }
        }
      }

      if ((i / BATCH_SIZE) % 10 === 0) {
        console.log(`  Progress: ${Math.min(i + BATCH_SIZE, nullHashRows.length)}/${nullHashRows.length}`);
      }
    }

    console.log(`\nBackfilled ${backfilled} recordHash values`);
    console.log(`Removed ${hashConflicts} additional duplicate rows (hash collision)\n`);

    // Final stats
    const [stats] = await conn.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN recordHash IS NOT NULL THEN 1 ELSE 0 END) as withHash,
        SUM(CASE WHEN recordHash IS NULL THEN 1 ELSE 0 END) as withoutHash
      FROM priceHistory
      WHERE source = 'snkrdunk'
    `);

    console.log('=== Final Stats ===');
    console.log(`Total SNKRDUNK rows: ${stats[0].total}`);
    console.log(`With recordHash: ${stats[0].withHash}`);
    console.log(`Without recordHash: ${stats[0].withoutHash}`);
    console.log(`Total deleted (duplicates): ${totalDeleted + hashConflicts}`);
    console.log('\n✓ Migration complete!');

  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
