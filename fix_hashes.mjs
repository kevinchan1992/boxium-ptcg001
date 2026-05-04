#!/usr/bin/env node
/**
 * Recompute recordHash for all snkrdunk single_card records
 * TiDB-compatible: LIMIT/OFFSET values embedded directly in SQL string
 */

import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

function computeRecordHash({ cardId, source, grade, soldAt, jpyPrice, sourcePosition }) {
  const gradeForHash = grade || '__none__';
  const nd = (d) => {
    if (!d) return '__nodate__';
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parts = [
    String(cardId),
    (source || '').toLowerCase(),
    gradeForHash.trim().toUpperCase().replace(/\s+/g, ' '),
    nd(soldAt),
    String(jpyPrice != null ? Math.round(jpyPrice) : 0),
    String(sourcePosition ?? 0),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('Recomputing recordHash for all snkrdunk single_card records...');
  
  // Get total count
  const [countResult] = await db.execute(`
    SELECT COUNT(*) as cnt FROM priceHistory
    WHERE source = 'snkrdunk' AND productType = 'single_card'
  `);
  const total = countResult[0].cnt;
  console.log(`Total records: ${total}`);
  
  let hashOffset = 0;
  const HASH_BATCH = 5000;
  let hashUpdated = 0;
  let hashConflicts = 0;
  
  while (hashOffset < total) {
    // TiDB-compatible: embed LIMIT/OFFSET directly in SQL
    const [rows] = await db.execute(`
      SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition, recordHash
      FROM priceHistory
      WHERE source = 'snkrdunk' AND productType = 'single_card'
      ORDER BY id
      LIMIT ${HASH_BATCH} OFFSET ${hashOffset}
    `);
    
    if (rows.length === 0) break;
    
    const updates = [];
    for (const row of rows) {
      const correctHash = computeRecordHash({
        cardId: row.cardId,
        source: row.source,
        grade: row.grade,
        soldAt: row.soldAt,
        jpyPrice: row.jpyPrice,
        sourcePosition: row.sourcePosition,
      });
      
      if (correctHash !== row.recordHash) {
        updates.push({ id: row.id, hash: correctHash });
      }
    }
    
    for (const u of updates) {
      try {
        await db.execute(
          `UPDATE priceHistory SET recordHash = ? WHERE id = ?`,
          [u.hash, u.id]
        );
        hashUpdated++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // True duplicate - delete this record
          await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [u.id]);
          hashConflicts++;
        } else {
          throw err;
        }
      }
    }
    
    hashOffset += rows.length;
    if (hashOffset % 100000 === 0) {
      console.log(`  Progress: ${hashOffset}/${total} (${Math.round(hashOffset/total*100)}%), ${hashUpdated} hashes updated, ${hashConflicts} conflicts deleted`);
    }
    
    if (rows.length < HASH_BATCH) break;
  }
  
  console.log(`\nHash recompute done: ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);

  // Final verification
  const [remaining] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND (grade REGEXP '^PSA[0-9]' OR grade REGEXP '^BGS[0-9]')
    GROUP BY grade
    ORDER BY cnt DESC
  `);
  console.log('\nRemaining old-format grades:', JSON.stringify(remaining));
  
  const [finalDups] = await db.execute(`
    SELECT COUNT(*) as dup_count FROM (
      SELECT cardId, source, grade, DATE(soldAt) as soldDate, jpyPrice, sourcePosition, COUNT(*) as cnt
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, DATE(soldAt), jpyPrice, sourcePosition
      HAVING cnt > 1
    ) t
  `);
  console.log('Remaining duplicate groups:', finalDups[0].dup_count);
  
  await db.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
