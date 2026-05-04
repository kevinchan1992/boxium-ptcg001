#!/usr/bin/env node
/**
 * Fix duplicate priceHistory records caused by inconsistent grade formats.
 * 
 * Problem: Old records use "PSA10", new records use "PSA 10" (with space).
 * Both pass the unique constraint because grade is part of it.
 * 
 * Strategy:
 * 1. Normalize ALL grade values to the standard format (with space)
 * 2. After normalization, find and delete duplicates (keep the oldest record)
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const GRADE_MAP = {
  'PSA10': 'PSA 10', 'PSA-10': 'PSA 10',
  'PSA9': 'PSA 9', 'PSA-9': 'PSA 9',
  'PSA8': 'PSA 8', 'PSA-8': 'PSA 8',
  'PSA8以下': 'PSA 8以下',
  'PSA7': 'PSA 7', 'PSA6': 'PSA 6', 'PSA5': 'PSA 5',
  'PSA4': 'PSA 4', 'PSA3': 'PSA 3', 'PSA2': 'PSA 2', 'PSA1': 'PSA 1',
  'BGS10': 'BGS 10', 'BGS10 GL': 'BGS 10 GL', 'BGS10 BL': 'BGS 10 BL',
  'BGS9.5': 'BGS 9.5', 'BGS9': 'BGS 9', 'BGS9以下': 'BGS 9以下',
  'CGC10': 'CGC 10', 'SGC10': 'SGC 10',
};

function normaliseGrade(raw) {
  if (!raw) return null;
  const t = raw.trim();
  return GRADE_MAP[t] || t;
}

function computeRecordHash({ cardId, source, grade, soldAt, jpyPrice, sourcePosition }) {
  // Use normalized grade for hash computation
  const ng = grade ? normaliseGrade(grade) || grade.trim().toUpperCase() : '__none__';
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
    ng,
    nd(soldAt),
    String(jpyPrice != null ? Math.round(jpyPrice) : 0),
    String(sourcePosition ?? 0),
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('='.repeat(60));
  console.log('Fix Duplicate Grade Records');
  console.log('='.repeat(60));

  // Step 1: Count old-format records
  const [oldStats] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND grade REGEXP '^(PSA|BGS|CGC|SGC)[0-9]'
    GROUP BY grade
    ORDER BY cnt DESC
  `);
  console.log('\nOld-format grades to normalize:', JSON.stringify(oldStats));

  // Step 2: Normalize grade values in batches
  // First, update grades to normalized format
  const gradeUpdates = [
    ['PSA10', 'PSA 10'],
    ['PSA9', 'PSA 9'],
    ['PSA8', 'PSA 8'],
    ['PSA8以下', 'PSA 8以下'],
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
    ['BGS9以下', 'BGS 9以下'],
    ['BGS9', 'BGS 9'],
    ['CGC10', 'CGC 10'],
    ['SGC10', 'SGC 10'],
  ];

  // Before normalizing, we need to handle duplicates FIRST
  // because after normalization, the unique constraint will prevent updates
  
  // Step 2a: Find all duplicate groups (same cardId/source/soldAt/jpyPrice/sourcePosition 
  // but different grade formats that normalize to the same value)
  console.log('\nStep 2: Finding duplicate groups...');
  
  let totalDeleted = 0;
  
  for (const [oldGrade, newGrade] of gradeUpdates) {
    // Find records where both old and new format exist for the same transaction
    const [dups] = await db.execute(`
      SELECT old.id as old_id, new.id as new_id
      FROM priceHistory old
      JOIN priceHistory new ON (
        old.cardId = new.cardId
        AND old.source = new.source
        AND DATE(old.soldAt) = DATE(new.soldAt)
        AND old.jpyPrice = new.jpyPrice
        AND old.sourcePosition = new.sourcePosition
        AND old.grade = ?
        AND new.grade = ?
      )
    `, [oldGrade, newGrade]);
    
    if (dups.length > 0) {
      console.log(`  ${oldGrade} vs ${newGrade}: ${dups.length} duplicate pairs found`);
      
      // Delete the NEW format records (keep old ones, will normalize them next)
      const newIds = dups.map(d => d.new_id);
      
      // Delete in batches of 1000
      for (let i = 0; i < newIds.length; i += 1000) {
        const batch = newIds.slice(i, i + 1000);
        const placeholders = batch.map(() => '?').join(',');
        const [result] = await db.execute(
          `DELETE FROM priceHistory WHERE id IN (${placeholders})`,
          batch
        );
        totalDeleted += result.affectedRows;
      }
      console.log(`    → Deleted ${newIds.length} duplicate new-format records`);
    }
  }
  
  console.log(`\nTotal deleted: ${totalDeleted} duplicate records`);

  // Step 3: Now normalize all remaining old-format grades
  console.log('\nStep 3: Normalizing grade formats...');
  let totalUpdated = 0;
  
  for (const [oldGrade, newGrade] of gradeUpdates) {
    if (oldGrade === newGrade) continue;
    
    // Update grade and recompute recordHash
    // We need to do this in batches to recompute recordHash
    const [rows] = await db.execute(`
      SELECT id, cardId, source, soldAt, jpyPrice, sourcePosition
      FROM priceHistory
      WHERE grade = ? AND source = 'snkrdunk'
      LIMIT 100000
    `, [oldGrade]);
    
    if (rows.length === 0) continue;
    console.log(`  Normalizing ${rows.length} records: ${oldGrade} → ${newGrade}`);
    
    // Update in batches
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      
      for (const row of batch) {
        const newHash = computeRecordHash({
          cardId: row.cardId,
          source: row.source,
          grade: newGrade,
          soldAt: row.soldAt,
          jpyPrice: row.jpyPrice,
          sourcePosition: row.sourcePosition,
        });
        
        try {
          await db.execute(
            `UPDATE priceHistory SET grade = ?, recordHash = ? WHERE id = ?`,
            [newGrade, newHash, row.id]
          );
          totalUpdated++;
        } catch (err) {
          // If update fails due to duplicate hash, delete this record
          if (err.code === 'ER_DUP_ENTRY') {
            await db.execute(`DELETE FROM priceHistory WHERE id = ?`, [row.id]);
            totalDeleted++;
            console.log(`    Deleted duplicate id=${row.id} (hash conflict)`);
          } else {
            console.error(`    Error updating id=${row.id}: ${err.message}`);
          }
        }
      }
      
      if (i % 5000 === 0 && i > 0) {
        console.log(`    Progress: ${i}/${rows.length}`);
      }
    }
    console.log(`    → Updated ${rows.length} records`);
    totalUpdated += rows.length;
  }
  
  console.log(`\nTotal updated: ${totalUpdated} records`);
  console.log(`Total deleted: ${totalDeleted} records`);
  
  // Step 4: Verify - check remaining old-format grades
  const [remaining] = await db.execute(`
    SELECT grade, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk'
    AND grade REGEXP '^(PSA|BGS|CGC|SGC)[0-9]'
    GROUP BY grade
  `);
  console.log('\nRemaining old-format grades:', JSON.stringify(remaining));
  
  // Step 5: Check for any remaining duplicates
  const [finalDups] = await db.execute(`
    SELECT COUNT(*) as dup_count FROM (
      SELECT cardId, source, grade, DATE(soldAt) as soldDate, jpyPrice, sourcePosition, COUNT(*) as cnt
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, DATE(soldAt), jpyPrice, sourcePosition
      HAVING cnt > 1
    ) t
  `);
  console.log('\nRemaining duplicate groups:', finalDups[0].dup_count);
  
  await db.end();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
