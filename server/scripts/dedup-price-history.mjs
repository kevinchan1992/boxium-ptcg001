/**
 * Deduplication script for priceHistory table.
 * 
 * Problem: sourcePosition was previously assigned as global index (0-based position in full API response).
 * When new records were added at the top, old records shifted down, causing different sourcePositions
 * for the same transaction across scrape runs → bypassing the UNIQUE INDEX → duplicates.
 * 
 * Fix: For each (cardId, source, grade, soldAt, jpyPrice) group, keep only the record with
 * the LOWEST id (earliest inserted), and delete all others.
 * 
 * This is safe because:
 * 1. All records in a group represent the same real transaction
 * 2. The lowest id was inserted first (most authoritative)
 * 3. After cleanup, the next batch update will use per-group relative positions
 *    which are stable across runs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('Connected to database');
    
    // Step 1: Count total duplicates
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total_records,
             COUNT(*) - COUNT(DISTINCT CONCAT(cardId, '|', source, '|', COALESCE(grade,''), '|', COALESCE(soldAt,''), '|', COALESCE(jpyPrice,''))) as duplicate_count
      FROM priceHistory
      WHERE source = 'snkrdunk'
    `);
    console.log('Current state:', countResult[0]);
    
    // Step 2: Find all duplicate groups and keep only the min(id)
    // Strategy: For each (cardId, source, grade, soldAt, jpyPrice) group,
    // keep the record with the smallest id, delete the rest.
    const [duplicateGroups] = await connection.execute(`
      SELECT cardId, source, grade, soldAt, jpyPrice, 
             MIN(id) as keep_id, 
             COUNT(*) as count,
             GROUP_CONCAT(id ORDER BY id) as all_ids
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, soldAt, jpyPrice
      HAVING COUNT(*) > 1
      LIMIT 10000
    `);
    
    console.log(`Found ${duplicateGroups.length} duplicate groups`);
    
    if (duplicateGroups.length === 0) {
      console.log('No duplicates found, nothing to do');
      return;
    }
    
    // Step 3: Delete duplicates in batches
    let totalDeleted = 0;
    const batchSize = 100;
    
    for (let i = 0; i < duplicateGroups.length; i += batchSize) {
      const batch = duplicateGroups.slice(i, i + batchSize);
      
      // Collect all IDs to delete (all_ids except keep_id)
      const idsToDelete = [];
      for (const group of batch) {
        const allIds = group.all_ids.split(',').map(Number);
        const keepId = group.keep_id;
        const deleteIds = allIds.filter(id => id !== keepId);
        idsToDelete.push(...deleteIds);
      }
      
      if (idsToDelete.length > 0) {
        const placeholders = idsToDelete.map(() => '?').join(',');
        const [deleteResult] = await connection.execute(
          `DELETE FROM priceHistory WHERE id IN (${placeholders})`,
          idsToDelete
        );
        totalDeleted += deleteResult.affectedRows;
        console.log(`Batch ${Math.floor(i/batchSize) + 1}: deleted ${deleteResult.affectedRows} records`);
      }
    }
    
    console.log(`\nTotal deleted: ${totalDeleted} duplicate records`);
    
    // Step 4: Verify
    const [afterCount] = await connection.execute(`
      SELECT COUNT(*) as total_records,
             COUNT(*) - COUNT(DISTINCT CONCAT(cardId, '|', source, '|', COALESCE(grade,''), '|', COALESCE(soldAt,''), '|', COALESCE(jpyPrice,''))) as remaining_duplicates
      FROM priceHistory
      WHERE source = 'snkrdunk'
    `);
    console.log('After cleanup:', afterCount[0]);
    
    // Step 5: Fix sourcePosition for remaining records
    // After dedup, reassign sourcePosition as per-group relative position
    // so future scrapes can correctly identify duplicates
    console.log('\nFixing sourcePosition for remaining records...');
    
    const [allGroups] = await connection.execute(`
      SELECT cardId, source, grade, soldAt, jpyPrice, 
             GROUP_CONCAT(id ORDER BY id) as all_ids
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, soldAt, jpyPrice
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Groups with multiple records (legitimate duplicates): ${allGroups.length}`);
    
    let fixedCount = 0;
    for (const group of allGroups) {
      const ids = group.all_ids.split(',').map(Number);
      // Assign sourcePosition 0, 1, 2... to each record in order of id
      for (let pos = 0; pos < ids.length; pos++) {
        await connection.execute(
          'UPDATE priceHistory SET sourcePosition = ? WHERE id = ?',
          [pos, ids[pos]]
        );
      }
      fixedCount += ids.length;
    }
    
    console.log(`Fixed sourcePosition for ${fixedCount} records in ${allGroups.length} groups`);
    console.log('\nDeduplication complete!');
    
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
