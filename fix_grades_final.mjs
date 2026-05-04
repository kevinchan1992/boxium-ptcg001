#!/usr/bin/env node
/**
 * Final grade fix: 
 * 1. Delete PSA10/PSA9/etc records that have matching normalized (PSA 10/PSA 9/etc) records
 * 2. Update remaining old-format records to normalized format
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
  
  console.log('=== Phase 1: Delete old-format records that have matching new-format records ===');
  
  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    let totalDeleted = 0;
    
    // Count duplicates
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as cnt FROM priceHistory p1
      WHERE p1.source='snkrdunk' AND p1.grade='${oldGrade}'
      AND EXISTS (
        SELECT 1 FROM priceHistory p2
        WHERE p2.source='snkrdunk' AND p2.grade='${newGrade}'
        AND p2.cardId=p1.cardId AND DATE(p2.soldAt)=DATE(p1.soldAt) 
        AND p2.jpyPrice=p1.jpyPrice AND p2.sourcePosition=p1.sourcePosition
      )
    `);
    
    const dupCount = countResult[0].cnt;
    if (dupCount === 0) {
      console.log(`  ${oldGrade}: no duplicates to delete`);
      continue;
    }
    
    console.log(`  ${oldGrade}: ${dupCount} duplicates to delete...`);
    
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
      totalDeleted += del.affectedRows;
    }
    
    console.log(`  ${oldGrade}: deleted ${totalDeleted} duplicates ✅`);
  }
  
  console.log('\n=== Phase 2: Update remaining old-format records to new format ===');
  
  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as cnt FROM priceHistory 
      WHERE source='snkrdunk' AND grade='${oldGrade}'
    `);
    
    const remaining = countResult[0].cnt;
    if (remaining === 0) {
      console.log(`  ${oldGrade}: no remaining records`);
      continue;
    }
    
    console.log(`  ${oldGrade}: updating ${remaining} records to '${newGrade}'...`);
    
    while (true) {
      const [ids] = await db.execute(`
        SELECT id FROM priceHistory 
        WHERE source='snkrdunk' AND grade='${oldGrade}'
        LIMIT 500
      `);
      
      if (ids.length === 0) break;
      
      const idList = ids.map(r => r.id).join(',');
      await db.execute(`UPDATE priceHistory SET grade='${newGrade}' WHERE id IN (${idList})`);
    }
    
    console.log(`  ${oldGrade}: updated ✅`);
  }
  
  console.log('\n=== Phase 3: Compute hashes for null-hash records ===');
  
  const [nullCount] = await db.execute(`
    SELECT COUNT(*) as cnt FROM priceHistory 
    WHERE source='snkrdunk' AND productType='single_card' AND recordHash IS NULL
  `);
  console.log(`  Records with null hash: ${nullCount[0].cnt}`);
  
  let hashOffset = 0;
  const BATCH = 2000;
  let hashUpdated = 0;
  let hashConflicts = 0;
  const total = nullCount[0].cnt;
  
  while (hashOffset < total + 10000) { // extra buffer for new records
    const [rows] = await db.execute(`
      SELECT id, cardId, source, grade, soldAt, jpyPrice, sourcePosition, recordHash
      FROM priceHistory
      WHERE source = 'snkrdunk' AND productType = 'single_card' AND recordHash IS NULL
      LIMIT ${BATCH}
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
    
    hashOffset += rows.length;
    if (hashOffset % 10000 === 0 || rows.length < BATCH) {
      console.log(`  Progress: ${hashOffset} processed, ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);
    }
  }
  
  console.log(`\nHash computation done: ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);
  
  console.log('\n=== Final Verification ===');
  
  const [finalOld] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND (grade REGEXP '^PSA[0-9]' OR grade REGEXP '^BGS[0-9]')
    GROUP BY grade
    ORDER BY cnt DESC
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
  
  await db.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
