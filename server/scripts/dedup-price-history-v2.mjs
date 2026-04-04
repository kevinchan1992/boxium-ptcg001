/**
 * Efficient deduplication script v2 for priceHistory table.
 * Uses direct SQL DELETE to remove duplicates without LIMIT.
 * 
 * Strategy: Keep the record with MIN(id) for each (cardId, source, grade, soldAt, jpyPrice) group.
 * Delete all others.
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
    
    // Count before
    const [before] = await connection.execute(
      'SELECT COUNT(*) as total FROM priceHistory WHERE source = "snkrdunk"'
    );
    console.log(`Before: ${before[0].total} SNKRDUNK records`);
    
    // Use a single efficient DELETE statement:
    // Delete all records where there exists another record with the same
    // (cardId, source, grade, soldAt, jpyPrice) but a LOWER id.
    // This keeps exactly one record per group (the one with the lowest id).
    //
    // We process in batches to avoid lock timeouts on large tables.
    
    let totalDeleted = 0;
    let batchNum = 0;
    
    while (true) {
      batchNum++;
      
      // Delete up to 5000 duplicates at a time
      const [result] = await connection.execute(`
        DELETE ph1
        FROM priceHistory ph1
        INNER JOIN priceHistory ph2
          ON ph1.cardId = ph2.cardId
          AND ph1.source = ph2.source
          AND (ph1.grade = ph2.grade OR (ph1.grade IS NULL AND ph2.grade IS NULL))
          AND (ph1.soldAt = ph2.soldAt OR (ph1.soldAt IS NULL AND ph2.soldAt IS NULL))
          AND (ph1.jpyPrice = ph2.jpyPrice OR (ph1.jpyPrice IS NULL AND ph2.jpyPrice IS NULL))
          AND ph1.id > ph2.id
        WHERE ph1.source = 'snkrdunk'
        LIMIT 5000
      `);
      
      const deleted = result.affectedRows;
      totalDeleted += deleted;
      
      if (batchNum % 10 === 0 || deleted < 5000) {
        console.log(`Batch ${batchNum}: deleted ${deleted} records (total: ${totalDeleted})`);
      }
      
      if (deleted === 0) {
        console.log('No more duplicates found');
        break;
      }
      
      // Small pause to avoid overwhelming the DB
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Count after
    const [after] = await connection.execute(
      'SELECT COUNT(*) as total FROM priceHistory WHERE source = "snkrdunk"'
    );
    console.log(`\nAfter: ${after[0].total} SNKRDUNK records`);
    console.log(`Total deleted: ${totalDeleted} duplicate records`);
    
    // Verify no more duplicates
    const [dupCheck] = await connection.execute(`
      SELECT COUNT(*) as dup_groups
      FROM (
        SELECT cardId, source, grade, soldAt, jpyPrice
        FROM priceHistory WHERE source='snkrdunk'
        GROUP BY cardId, source, grade, soldAt, jpyPrice
        HAVING COUNT(*) > 1
      ) t
    `);
    console.log(`Remaining duplicate groups: ${dupCheck[0].dup_groups}`);
    
    if (dupCheck[0].dup_groups === 0) {
      console.log('✓ All duplicates removed successfully!');
    } else {
      console.log(`⚠ Still ${dupCheck[0].dup_groups} duplicate groups remaining`);
    }
    
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
