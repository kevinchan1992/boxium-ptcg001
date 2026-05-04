#!/usr/bin/env node
/**
 * Fix duplicate priceHistory records - v3
 * TiDB-compatible: no DELETE...JOIN...LIMIT, use subqueries instead
 */

import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

const GRADE_PAIRS = [
  ['PSA10', 'PSA 10'],
  ['PSA9', 'PSA 9'],
  ['PSA8以下', 'PSA 8以下'],
  ['BGS10 GL', 'BGS 10 GL'],
  ['BGS10 BL', 'BGS 10 BL'],
  ['BGS10', 'BGS 10'],
  ['BGS9.5', 'BGS 9.5'],
  ['BGS9以下', 'BGS 9以下'],
  ['BGS9', 'BGS 9'],
];

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
  
  console.log('='.repeat(60));
  console.log('Fix Duplicate Grade Records v3 (TiDB-compatible)');
  console.log('='.repeat(60));

  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    if (oldGrade === newGrade) continue;
    
    // Count old-format records
    const [countOld] = await db.execute(
      `SELECT COUNT(*) as cnt FROM priceHistory WHERE grade = ? AND source = 'snkrdunk'`,
      [oldGrade]
    );
    const oldCount = countOld[0].cnt;
    if (oldCount === 0) {
      console.log(`\n'${oldGrade}': 0 records, skipping`);
      continue;
    }
    
    const [countNew] = await db.execute(
      `SELECT COUNT(*) as cnt FROM priceHistory WHERE grade = ? AND source = 'snkrdunk'`,
      [newGrade]
    );
    console.log(`\nProcessing: '${oldGrade}' (${oldCount}) → '${newGrade}' (${countNew[0].cnt})`);
    
    // Step 1: Find IDs of new-format records that conflict with old-format records
    // Use subquery approach (TiDB compatible)
    let deletedTotal = 0;
    let round = 0;
    while (true) {
      round++;
      // Find new-format record IDs that have a matching old-format record
      const [conflictIds] = await db.execute(`
        SELECT new_rec.id
        FROM priceHistory new_rec
        WHERE new_rec.grade = ?
          AND new_rec.source = 'snkrdunk'
          AND EXISTS (
            SELECT 1 FROM priceHistory old_rec
            WHERE old_rec.grade = ?
              AND old_rec.source = 'snkrdunk'
              AND old_rec.cardId = new_rec.cardId
              AND DATE(old_rec.soldAt) = DATE(new_rec.soldAt)
              AND old_rec.jpyPrice = new_rec.jpyPrice
              AND old_rec.sourcePosition = new_rec.sourcePosition
          )
        LIMIT 500
      `, [newGrade, oldGrade]);
      
      if (conflictIds.length === 0) break;
      
      const ids = conflictIds.map(r => r.id);
      await db.execute(
        `DELETE FROM priceHistory WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      deletedTotal += ids.length;
      console.log(`  Round ${round}: deleted ${ids.length} conflicts (total: ${deletedTotal})`);
    }
    console.log(`  Total deleted: ${deletedTotal}`);
    
    // Step 2: Update old-format grade to new-format in batches
    let updatedTotal = 0;
    let updateRound = 0;
    while (true) {
      updateRound++;
      // Get IDs to update (avoid LIMIT on UPDATE for TiDB compatibility)
      const [toUpdate] = await db.execute(`
        SELECT id FROM priceHistory
        WHERE grade = ? AND source = 'snkrdunk'
        LIMIT 5000
      `, [oldGrade]);
      
      if (toUpdate.length === 0) break;
      
      const ids = toUpdate.map(r => r.id);
      try {
        await db.execute(
          `UPDATE priceHistory SET grade = ? WHERE id IN (${ids.map(() => '?').join(',')})`,
          [newGrade, ...ids]
        );
        updatedTotal += ids.length;
        
        if (updateRound % 10 === 0) {
          console.log(`  Update progress: ${updatedTotal} records updated`);
        }
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // Find which specific IDs conflict and remove them
          console.log(`  Conflict in batch, resolving...`);
          for (const id of ids) {
            try {
              await db.execute(
                `UPDATE priceHistory SET grade = ? WHERE id = ?`,
                [newGrade, id]
              );
              updatedTotal++;
            } catch (innerErr) {
              if (innerErr.code === 'ER_DUP_ENTRY') {
                // This record conflicts - delete it
                await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [id]);
                console.log(`  Deleted conflicting record id=${id}`);
              } else {
                throw innerErr;
              }
            }
          }
        } else {
          throw err;
        }
      }
    }
    console.log(`  Total updated: ${updatedTotal} records`);
  }

  // Step 3: Recompute recordHash for all snkrdunk single_card records
  console.log('\n' + '='.repeat(60));
  console.log('Step 3: Recomputing recordHash...');
  
  let hashOffset = 0;
  const HASH_BATCH = 5000;
  let hashUpdated = 0;
  let hashConflicts = 0;
  
  while (true) {
    const [rows] = await db.execute(`
      SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition, recordHash
      FROM priceHistory
      WHERE source = 'snkrdunk' AND productType = 'single_card'
      ORDER BY id
      LIMIT ? OFFSET ?
    `, [HASH_BATCH, hashOffset]);
    
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
          await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [u.id]);
          hashConflicts++;
        } else {
          throw err;
        }
      }
    }
    
    hashOffset += rows.length;
    if (hashOffset % 100000 === 0) {
      console.log(`  Progress: ${hashOffset} records, ${hashUpdated} hashes updated, ${hashConflicts} conflicts`);
    }
    
    if (rows.length < HASH_BATCH) break;
  }
  
  console.log(`Hash recompute done: ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);

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
