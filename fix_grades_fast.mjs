#!/usr/bin/env node
/**
 * Fast fix for duplicate priceHistory records caused by inconsistent grade formats.
 * Uses pure SQL batch operations for maximum efficiency.
 * 
 * Strategy:
 * 1. Delete new-format duplicates (where old-format record already exists for same transaction)
 * 2. Batch-update grade and recompute recordHash using MySQL's SHA2() function
 */

import mysql from 'mysql2/promise';

const GRADE_PAIRS = [
  // [old_grade, new_grade]
  ['PSA10', 'PSA 10'],
  ['PSA9', 'PSA 9'],
  ['PSA8', 'PSA 8'],
  ['PSA8以下', 'PSA 8以下'],  // same, no change needed
  ['PSA7', 'PSA 7'],
  ['PSA6', 'PSA 6'],
  ['PSA5', 'PSA 5'],
  ['PSA4', 'PSA 4'],
  ['PSA3', 'PSA 3'],
  ['PSA2', 'PSA 2'],
  ['PSA1', 'PSA 1'],
  ['BGS10 GL', 'BGS 10 GL'],
  ['BGS10 BL', 'BGS 10 BL'],
  ['BGS10', 'BGS 10'],
  ['BGS9.5', 'BGS 9.5'],
  ['BGS9以下', 'BGS 9以下'],  // same, no change needed
  ['BGS9', 'BGS 9'],
  ['CGC10', 'CGC 10'],
  ['SGC10', 'SGC 10'],
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('='.repeat(60));
  console.log('Fast Fix: Duplicate Grade Records');
  console.log('='.repeat(60));

  // Step 1: Delete new-format duplicates where old-format already exists
  console.log('\nStep 1: Deleting new-format duplicates...');
  let totalDeleted = 0;
  
  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    if (oldGrade === newGrade) continue;
    
    // Delete new-format records that have a matching old-format record
    // (same cardId, source, soldAt date, jpyPrice, sourcePosition)
    const [result] = await db.execute(`
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
    `, [newGrade, oldGrade]);
    
    if (result.affectedRows > 0) {
      console.log(`  Deleted ${result.affectedRows} duplicate '${newGrade}' records (old '${oldGrade}' kept)`);
      totalDeleted += result.affectedRows;
    }
  }
  console.log(`Total deleted: ${totalDeleted} duplicate records`);

  // Step 2: Batch-update grade values using pure SQL
  // The recordHash needs to be recomputed. Since MySQL doesn't have a built-in SHA256
  // that matches our Node.js format exactly, we'll use a two-pass approach:
  // First update grade, then recompute hashes in Node.js batches of 5000
  
  console.log('\nStep 2: Updating grade formats...');
  let totalUpdated = 0;
  
  for (const [oldGrade, newGrade] of GRADE_PAIRS) {
    if (oldGrade === newGrade) continue;
    
    // Count records to update
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as cnt FROM priceHistory WHERE grade = ? AND source = 'snkrdunk'`,
      [oldGrade]
    );
    const count = countResult[0].cnt;
    if (count === 0) continue;
    
    console.log(`  Updating ${count} records: '${oldGrade}' → '${newGrade}'`);
    
    // Update grade in batches of 10000 using LIMIT
    let updated = 0;
    while (updated < count) {
      const [result] = await db.execute(`
        UPDATE priceHistory 
        SET grade = ?
        WHERE grade = ? AND source = 'snkrdunk'
        LIMIT 10000
      `, [newGrade, oldGrade]);
      
      updated += result.affectedRows;
      if (result.affectedRows === 0) break;
      
      if (updated % 50000 === 0) {
        console.log(`    Progress: ${updated}/${count}`);
      }
    }
    
    totalUpdated += updated;
    console.log(`    → Updated ${updated} records`);
  }
  
  console.log(`\nTotal grade updates: ${totalUpdated} records`);

  // Step 3: Recompute recordHash for all updated records
  // We need to do this in Node.js since MySQL's SHA2 format differs from Node's crypto
  console.log('\nStep 3: Recomputing recordHash for normalized grades...');
  
  const { createHash } = await import('crypto');
  
  function computeRecordHash({ cardId, source, grade, soldAt, jpyPrice, sourcePosition }) {
    const ng = grade ? grade.trim().toUpperCase().replace(/\s+/g, '') : '__none__';
    // Use normalized grade for hash - strip spaces for consistent hashing
    // Actually, let's use the EXACT same logic as the current script
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
  
  // Find all records with old-format hashes (those that need recomputation)
  // We can identify them: records where grade is now normalized but hash was computed with old grade
  // The safest approach: recompute ALL snkrdunk single_card hashes
  
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
    
    // Compute correct hashes
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
    
    // Apply hash updates
    for (const u of updates) {
      try {
        await db.execute(
          `UPDATE priceHistory SET recordHash = ? WHERE id = ?`,
          [u.hash, u.id]
        );
        hashUpdated++;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // Hash conflict = true duplicate, delete this record
          await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [u.id]);
          hashConflicts++;
        }
      }
    }
    
    hashOffset += rows.length;
    if (hashOffset % 50000 === 0) {
      console.log(`  Hash recompute progress: ${hashOffset} records processed, ${hashUpdated} updated, ${hashConflicts} conflicts deleted`);
    }
    
    if (rows.length < HASH_BATCH) break;
  }
  
  console.log(`\nHash recompute complete: ${hashUpdated} hashes updated, ${hashConflicts} conflicts deleted`);

  // Final verification
  const [remaining] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND grade REGEXP '^(PSA|BGS|CGC|SGC)[0-9]'
    GROUP BY grade
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
