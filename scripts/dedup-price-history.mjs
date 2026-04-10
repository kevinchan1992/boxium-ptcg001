/**
 * Deduplication script for priceHistory table
 * 
 * Problem: Old scraper used global index as sourcePosition, causing the same
 * transaction to be stored with different sourcePositions across scrape runs.
 * 
 * Fix: For each (cardId, source, grade, soldAt, jpyPrice) group with multiple records,
 * keep only the record with the MINIMUM id (earliest inserted), delete the rest.
 * 
 * After cleanup, re-assign sourcePosition correctly using per-group relative position.
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('=== SNKRDUNK Price History Deduplication ===\n');
    
    // Step 1: Count duplicates before cleanup
    const [[before]] = await conn.execute(`
      SELECT COUNT(*) as dup_groups, SUM(cnt - 1) as extra_rows
      FROM (
        SELECT cardId, source, grade, soldAt, jpyPrice, COUNT(*) as cnt
        FROM priceHistory
        WHERE source = 'snkrdunk'
        GROUP BY cardId, source, grade, soldAt, jpyPrice
        HAVING cnt > 1
      ) t
    `);
    console.log(`Before cleanup: ${before.dup_groups} duplicate groups, ${before.extra_rows} extra rows to remove`);
    
    if (before.extra_rows === 0) {
      console.log('No duplicates found. Database is clean.');
      await conn.end();
      return;
    }
    
    // Step 2: Delete duplicates in batches
    // Keep the record with MIN(id) for each group, delete the rest
    console.log('\nDeleting duplicates (keeping earliest record per group)...');
    let totalDeleted = 0;
    let batchNum = 0;
    
    while (true) {
      // Find a batch of duplicate IDs to delete
      const [toDelete] = await conn.execute(`
        SELECT ph.id
        FROM priceHistory ph
        INNER JOIN (
          SELECT cardId, source, grade, soldAt, jpyPrice, MIN(id) as keep_id
          FROM priceHistory
          WHERE source = 'snkrdunk'
          GROUP BY cardId, source, grade, soldAt, jpyPrice
          HAVING COUNT(*) > 1
          LIMIT 1000
        ) keeper ON (
          ph.cardId = keeper.cardId
          AND ph.source = keeper.source
          AND (ph.grade = keeper.grade OR (ph.grade IS NULL AND keeper.grade IS NULL))
          AND ph.soldAt = keeper.soldAt
          AND ph.jpyPrice = keeper.jpyPrice
          AND ph.id != keeper.keep_id
        )
        LIMIT 5000
      `);
      
      if (toDelete.length === 0) break;
      
      const ids = toDelete.map(r => r.id);
      const [result] = await conn.execute(
        `DELETE FROM priceHistory WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      
      totalDeleted += result.affectedRows;
      batchNum++;
      
      if (batchNum % 10 === 0) {
        console.log(`  Batch ${batchNum}: deleted ${totalDeleted} rows so far...`);
      }
    }
    
    console.log(`\nDeleted ${totalDeleted} duplicate rows total.`);
    
    // Step 3: Re-assign sourcePosition correctly using per-group relative position
    // This ensures future deduplication works correctly
    console.log('\nRe-assigning sourcePosition for all SNKRDUNK records...');
    
    // Get all distinct (cardId, grade) combinations that need re-assignment
    const [cardGrades] = await conn.execute(`
      SELECT DISTINCT cardId, grade
      FROM priceHistory
      WHERE source = 'snkrdunk'
      ORDER BY cardId, grade
    `);
    
    console.log(`Processing ${cardGrades.length} card-grade combinations...`);
    let processed = 0;
    
    for (const { cardId, grade } of cardGrades) {
      // Get all records for this card+grade, ordered by soldAt + jpyPrice + id
      const gradeCondition = grade ? `grade = ?` : `grade IS NULL`;
      const params = grade ? [cardId, grade] : [cardId];
      
      const [records] = await conn.execute(
        `SELECT id, soldAt, jpyPrice
         FROM priceHistory
         WHERE source = 'snkrdunk' AND cardId = ? AND ${gradeCondition}
         ORDER BY soldAt, jpyPrice, id`,
        params
      );
      
      // Assign per-group positions
      const groupCounters = new Map();
      const updates = [];
      
      for (const record of records) {
        const soldAtStr = record.soldAt ? new Date(record.soldAt).toISOString().slice(0, 10) : 'unknown';
        const jpyPrice = record.jpyPrice ?? 0;
        const groupKey = `${soldAtStr}|${jpyPrice}`;
        const pos = groupCounters.get(groupKey) ?? 0;
        groupCounters.set(groupKey, pos + 1);
        updates.push({ id: record.id, pos });
      }
      
      // Batch update sourcePosition
      if (updates.length > 0) {
        // Use CASE WHEN for batch update
        const caseWhen = updates.map(u => `WHEN ${u.id} THEN ${u.pos}`).join(' ');
        const ids = updates.map(u => u.id).join(',');
        await conn.execute(
          `UPDATE priceHistory SET sourcePosition = CASE id ${caseWhen} END WHERE id IN (${ids})`
        );
      }
      
      processed++;
      if (processed % 500 === 0) {
        console.log(`  Processed ${processed}/${cardGrades.length} combinations...`);
      }
    }
    
    console.log(`Re-assigned sourcePosition for ${processed} card-grade combinations.`);
    
    // Step 4: Verify cleanup
    const [[after]] = await conn.execute(`
      SELECT COUNT(*) as dup_groups, IFNULL(SUM(cnt - 1), 0) as extra_rows
      FROM (
        SELECT cardId, source, grade, soldAt, jpyPrice, COUNT(*) as cnt
        FROM priceHistory
        WHERE source = 'snkrdunk'
        GROUP BY cardId, source, grade, soldAt, jpyPrice
        HAVING cnt > 1
      ) t
    `);
    
    const [[totalCount]] = await conn.execute(`SELECT COUNT(*) as total FROM priceHistory WHERE source = 'snkrdunk'`);
    
    console.log(`\n=== Cleanup Complete ===`);
    console.log(`Remaining duplicates: ${after.dup_groups} groups, ${after.extra_rows} extra rows`);
    console.log(`Total SNKRDUNK records: ${totalCount.total}`);
    
    if (after.extra_rows === 0) {
      console.log('✅ Database is now clean!');
    } else {
      console.log('⚠️  Some duplicates remain. Please investigate.');
    }
    
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
