/**
 * backfill-record-hash.mjs
 *
 * Backfill recordHash for ALL SNKRDUNK priceHistory rows that have NULL recordHash.
 * Runs in batches of 1000, processes until all rows are filled.
 *
 * Run: node scripts/backfill-record-hash.mjs
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
  connectionLimit: 3,
});

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
  let totalBackfilled = 0;
  let totalDeleted = 0;
  let iteration = 0;

  try {
    console.log('=== Full recordHash Backfill ===');
    
    while (true) {
      iteration++;
      const [rows] = await conn.query(`
        SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition
        FROM priceHistory
        WHERE source = 'snkrdunk' AND recordHash IS NULL
        ORDER BY id ASC
        LIMIT 1000
      `);

      if (rows.length === 0) {
        console.log('\nAll rows processed!');
        break;
      }

      const updates = [];
      const seenHashes = new Set();

      for (const row of rows) {
        const hash = computeRecordHash({
          cardId: row.cardId,
          source: row.source,
          grade: row.grade,
          soldAt: row.soldAt,
          jpyPrice: row.jpyPrice,
          sourcePosition: row.sourcePosition,
        });

        if (seenHashes.has(hash)) {
          // Duplicate within batch — delete
          await conn.query(`DELETE FROM priceHistory WHERE id = ?`, [row.id]);
          totalDeleted++;
          continue;
        }
        seenHashes.add(hash);
        updates.push([hash, row.id]);
      }

      if (updates.length > 0) {
        const caseWhen = updates.map(([hash, id]) => `WHEN id = ${id} THEN '${hash}'`).join(' ');
        const ids = updates.map(([, id]) => id).join(',');
        try {
          await conn.query(`
            UPDATE priceHistory 
            SET recordHash = CASE ${caseWhen} END
            WHERE id IN (${ids}) AND recordHash IS NULL
          `);
          totalBackfilled += updates.length;
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            // Handle conflicts one by one
            for (const [hash, id] of updates) {
              try {
                await conn.query(
                  `UPDATE priceHistory SET recordHash = ? WHERE id = ? AND recordHash IS NULL`,
                  [hash, id]
                );
                totalBackfilled++;
              } catch (e2) {
                if (e2.code === 'ER_DUP_ENTRY') {
                  await conn.query(`DELETE FROM priceHistory WHERE id = ?`, [id]);
                  totalDeleted++;
                } else {
                  console.error(`Failed id=${id}:`, e2.message);
                }
              }
            }
          } else {
            throw err;
          }
        }
      }

      if (iteration % 20 === 0) {
        const [remaining] = await conn.query(
          `SELECT COUNT(*) as cnt FROM priceHistory WHERE source = 'snkrdunk' AND recordHash IS NULL`
        );
        console.log(`Iteration ${iteration}: backfilled=${totalBackfilled}, deleted=${totalDeleted}, remaining=${remaining[0].cnt}`);
      }
    }

    // Final stats
    const [stats] = await conn.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN recordHash IS NOT NULL THEN 1 ELSE 0 END) as withHash,
        SUM(CASE WHEN recordHash IS NULL THEN 1 ELSE 0 END) as withoutHash
      FROM priceHistory
      WHERE source = 'snkrdunk'
    `);

    console.log('\n=== Final Stats ===');
    console.log(`Total SNKRDUNK rows: ${stats[0].total}`);
    console.log(`With recordHash: ${stats[0].withHash}`);
    console.log(`Without recordHash: ${stats[0].withoutHash}`);
    console.log(`Total backfilled: ${totalBackfilled}`);
    console.log(`Total deleted (duplicates): ${totalDeleted}`);
    console.log('\n✓ Backfill complete!');

  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
