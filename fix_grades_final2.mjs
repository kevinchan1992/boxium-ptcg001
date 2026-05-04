#!/usr/bin/env node
/**
 * Final grade cleanup v2:
 * 1. Delete old-format records that have matching new-format records (duplicates)
 * 2. Update remaining old-format records to new format (one by one to handle conflicts)
 * 3. Compute hashes for all null-hash records
 * TiDB-compatible
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

const GRADE_PAIRS = [
  ['PSA10', 'PSA 10'],
  ['PSA9', 'PSA 9'],
  ['PSA8以下', 'PSA 8以下'],
  ['BGS10 GL', 'BGS 10 GL'],
  ['BGS10 BL', 'BGS 10 BL'],
  ['BGS9.5', 'BGS 9.5'],
  ['BGS9以下', 'BGS 9以下'],
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Run cleanup in multiple rounds until stable
  for (let round = 1; round <= 5; round++) {
    let anyWork = false;
    
    for (const [oldGrade, newGrade] of GRADE_PAIRS) {
      // Phase 1: Delete duplicates
      let deleted = 0;
      while (true) {
        const [ids] = await db.execute(`
          SELECT p1.id FROM priceHistory p1
          WHERE p1.source='snkrdunk' AND p1.grade='${oldGrade}'
          AND EXISTS (
            SELECT 1 FROM priceHistory p2
            WHERE p2.source='snkrdunk' AND p2.grade='${newGrade}'
            AND p2.cardId=p1.cardId AND DATE(p2.soldAt)=DATE(p1.soldAt) 
            AND p2.jpyPrice=p1.jpyPrice AND p2.sourcePosition=p1.sourcePosition
          )
          LIMIT 500
        `);
        if (ids.length === 0) break;
        const idList = ids.map(r => r.id).join(',');
        const [del] = await db.execute(`DELETE FROM priceHistory WHERE id IN (${idList})`);
        deleted += del.affectedRows;
        anyWork = true;
      }
      if (deleted > 0) console.log(`Round ${round}: ${oldGrade} deleted ${deleted} duplicates`);
      
      // Phase 2: Update remaining records one by one
      let updated = 0;
      let conflictDeleted = 0;
      while (true) {
        const [ids] = await db.execute(`SELECT id FROM priceHistory WHERE source='snkrdunk' AND grade='${oldGrade}' LIMIT 100`);
        if (ids.length === 0) break;
        
        for (const row of ids) {
          try {
            await db.execute(`UPDATE priceHistory SET grade='${newGrade}' WHERE id=${row.id}`);
            updated++;
            anyWork = true;
          } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              await db.execute(`DELETE FROM priceHistory WHERE id=${row.id}`);
              conflictDeleted++;
              anyWork = true;
            } else {
              throw err;
            }
          }
        }
      }
      if (updated > 0 || conflictDeleted > 0) {
        console.log(`Round ${round}: ${oldGrade} -> ${newGrade}: updated ${updated}, conflict-deleted ${conflictDeleted}`);
      }
    }
    
    if (!anyWork) {
      console.log(`Round ${round}: no work needed, stopping`);
      break;
    }
  }
  
  // Phase 3: Compute hashes for null-hash records
  console.log('\n=== Computing hashes for null-hash records ===');
  
  const [nullCount] = await db.execute(`
    SELECT COUNT(*) as cnt FROM priceHistory 
    WHERE source='snkrdunk' AND productType='single_card' AND recordHash IS NULL
  `);
  console.log(`Records with null hash: ${nullCount[0].cnt}`);
  
  let hashUpdated = 0;
  let hashConflicts = 0;
  
  while (true) {
    const [rows] = await db.execute(`
      SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition
      FROM priceHistory
      WHERE source = 'snkrdunk' AND productType = 'single_card' AND recordHash IS NULL
      LIMIT 2000
    `);
    
    if (rows.length === 0) break;
    
    for (const row of rows) {
      const correctHash = computeRecordHash({
        cardId: row.cardId,
        source: row.source,
        grade: row.grade,
        soldAt: row.soldAt,
        jpyPrice: row.jpyPrice,
        sourcePosition: row.sourcePosition,
      });
      
      try {
        await db.execute(
          `UPDATE priceHistory SET recordHash = ? WHERE id = ?`,
          [correctHash, row.id]
        );
        hashUpdated++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [row.id]);
          hashConflicts++;
        } else {
          throw err;
        }
      }
    }
    
    if ((hashUpdated + hashConflicts) % 10000 === 0) {
      console.log(`  Hash progress: ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);
    }
  }
  
  console.log(`Hash computation done: ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);
  
  // Final verification
  console.log('\n=== Final Verification ===');
  
  const [finalOld] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND (grade REGEXP '^PSA[0-9]' OR grade REGEXP '^BGS[0-9]')
    GROUP BY grade ORDER BY cnt DESC
  `);
  console.log('Remaining old-format grades:', JSON.stringify(finalOld));
  
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
  
  const [finalNullHash] = await db.execute(`
    SELECT COUNT(*) as cnt FROM priceHistory 
    WHERE source='snkrdunk' AND productType='single_card' AND recordHash IS NULL
  `);
  console.log('Remaining null-hash records:', finalNullHash[0].cnt);
  
  const [finalTotal] = await db.execute(`
    SELECT COUNT(*) as cnt FROM priceHistory WHERE source='snkrdunk' AND productType='single_card'
  `);
  console.log('Total records:', finalTotal[0].cnt);
  
  await db.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
