#!/usr/bin/env node
/**
 * Fix duplicate priceHistory records - v2
 * 
 * Strategy:
 * 1. For each old-format grade, delete ALL new-format duplicates first
 *    (match on cardId, source, DATE(soldAt), jpyPrice, sourcePosition)
 * 2. Then batch-update old-format grades to new-format
 * 3. Recompute recordHash for all updated records
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
  console.log('Fix Duplicate Grade Records v2');
  console.log('='.repeat(60));

  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    if (oldGrade === newGrade) continue;
    
    console.log(`\nProcessing: '${oldGrade}' → '${newGrade}'`);
    
    // Count old-format records
    const [countOld] = await db.execute(
      `SELECT COUNT(*) as cnt FROM priceHistory WHERE grade = ? AND source = 'snkrdunk'`,
      [oldGrade]
    );
    const oldCount = countOld[0].cnt;
    console.log(`  Old-format count: ${oldCount}`);
    if (oldCount === 0) continue;
    
    // Count new-format records (potential duplicates)
    const [countNew] = await db.execute(
      `SELECT COUNT(*) as cnt FROM priceHistory WHERE grade = ? AND source = 'snkrdunk'`,
      [newGrade]
    );
    console.log(`  New-format count: ${countNew[0].cnt}`);
    
    // Step 1: Delete new-format records that conflict with old-format records
    // We need to delete new-format records where a matching old-format record exists
    let deletedTotal = 0;
    let deleteRound = 0;
    while (true) {
      deleteRound++;
      const [delResult] = await db.execute(`
        DELETE new_rec FROM priceHistory new_rec
        INNER JOIN priceHistory old_rec ON (
          new_rec.cardId = old_rec.cardId
          AND new_rec.source = old_rec.source
          AND DATE(new_rec.soldAt) = DATE(old_rec.soldAt)
          AND new_rec.jpyPrice = old_rec.jpyPrice
          AND new_rec.sourcePosition = old_rec.sourcePosition
          AND new_rec.grade = ?
          AND old_rec.grade = ?
        )
        LIMIT 5000
      `, [newGrade, oldGrade]);
      
      deletedTotal += delResult.affectedRows;
      if (delResult.affectedRows === 0) break;
      console.log(`  Round ${deleteRound}: deleted ${delResult.affectedRows} new-format duplicates (total: ${deletedTotal})`);
    }
    console.log(`  Total deleted: ${deletedTotal}`);
    
    // Step 2: Update old-format grade to new-format
    let updatedTotal = 0;
    let updateRound = 0;
    while (true) {
      updateRound++;
      try {
        const [upResult] = await db.execute(`
          UPDATE priceHistory 
          SET grade = ?
          WHERE grade = ? AND source = 'snkrdunk'
          LIMIT 10000
        `, [newGrade, oldGrade]);
        
        updatedTotal += upResult.affectedRows;
        if (upResult.affectedRows === 0) break;
        
        if (updateRound % 5 === 0) {
          console.log(`  Update progress: ${updatedTotal} records updated`);
        }
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // There are still conflicts - need to find and delete them
          console.log(`  Conflict detected at round ${updateRound}, finding remaining conflicts...`);
          
          // Find the conflicting records and delete the new-format ones
          const [conflicts] = await db.execute(`
            SELECT new_rec.id as new_id
            FROM priceHistory new_rec
            INNER JOIN priceHistory old_rec ON (
              new_rec.cardId = old_rec.cardId
              AND new_rec.source = old_rec.source
              AND DATE(new_rec.soldAt) = DATE(old_rec.soldAt)
              AND new_rec.jpyPrice = old_rec.jpyPrice
              AND new_rec.sourcePosition = old_rec.sourcePosition
              AND new_rec.grade = ?
              AND old_rec.grade = ?
            )
            LIMIT 1000
          `, [newGrade, oldGrade]);
          
          if (conflicts.length === 0) {
            // Different type of conflict - old-format records conflicting with each other after update
            // Find records where updating would create a duplicate
            const [selfConflicts] = await db.execute(`
              SELECT MIN(id) as keep_id, COUNT(*) as cnt
              FROM priceHistory
              WHERE grade = ? AND source = 'snkrdunk'
              GROUP BY cardId, source, DATE(soldAt), jpyPrice, sourcePosition
              HAVING cnt > 1
              LIMIT 100
            `, [oldGrade]);
            
            console.log(`  Self-conflicts found: ${selfConflicts.length}`);
            for (const row of selfConflicts) {
              // Keep the lowest ID, delete the rest
              await db.execute(`
                DELETE FROM priceHistory
                WHERE grade = ? AND source = 'snkrdunk'
                AND id != ?
                AND (cardId, source, DATE(soldAt), jpyPrice, sourcePosition) = (
                  SELECT cardId, source, DATE(soldAt), jpyPrice, sourcePosition
                  FROM priceHistory WHERE id = ?
                )
              `, [oldGrade, row.keep_id, row.keep_id]);
            }
          } else {
            const ids = conflicts.map(r => r.new_id);
            await db.execute(
              `DELETE FROM priceHistory WHERE id IN (${ids.join(',')})`,
              []
            );
            console.log(`  Deleted ${ids.length} remaining conflicts`);
          }
          // Retry this batch
          continue;
        }
        throw err;
      }
    }
    console.log(`  Total updated: ${updatedTotal} records`);
  }

  // Step 3: Recompute recordHash for all normalized records
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
