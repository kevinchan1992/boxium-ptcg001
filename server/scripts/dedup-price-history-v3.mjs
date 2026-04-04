/**
 * Efficient deduplication script v3 for priceHistory table (TiDB compatible).
 * 
 * Strategy: Process in batches of cardIds.
 * For each batch of cards, find duplicate groups and delete non-min-id records.
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
    
    // Get all distinct cardIds that have duplicates
    console.log('Finding cards with duplicate records...');
    const [dupCards] = await connection.execute(`
      SELECT DISTINCT cardId
      FROM priceHistory
      WHERE source = 'snkrdunk'
      GROUP BY cardId, source, grade, soldAt, jpyPrice
      HAVING COUNT(*) > 1
    `);
    
    console.log(`Found ${dupCards.length} cards with duplicates`);
    
    let totalDeleted = 0;
    const BATCH_SIZE = 50; // Process 50 cards at a time
    
    for (let i = 0; i < dupCards.length; i += BATCH_SIZE) {
      const batch = dupCards.slice(i, i + BATCH_SIZE);
      const cardIds = batch.map(r => r.cardId);
      const placeholders = cardIds.map(() => '?').join(',');
      
      // For this batch of cards, delete all records where there's a lower-id record
      // with the same (cardId, source, grade, soldAt, jpyPrice)
      // TiDB doesn't support DELETE with JOIN LIMIT, so use subquery approach
      const [result] = await connection.execute(`
        DELETE FROM priceHistory
        WHERE source = 'snkrdunk'
          AND cardId IN (${placeholders})
          AND id NOT IN (
            SELECT min_id FROM (
              SELECT MIN(id) as min_id
              FROM priceHistory
              WHERE source = 'snkrdunk'
                AND cardId IN (${placeholders})
              GROUP BY cardId, source, grade, soldAt, jpyPrice
            ) t
          )
      `, [...cardIds, ...cardIds]);
      
      totalDeleted += result.affectedRows;
      
      if ((i / BATCH_SIZE) % 20 === 0 || i + BATCH_SIZE >= dupCards.length) {
        const progress = Math.min(i + BATCH_SIZE, dupCards.length);
        console.log(`Progress: ${progress}/${dupCards.length} cards processed, deleted ${totalDeleted} records so far`);
      }
      
      // Small pause to avoid overwhelming the DB
      await new Promise(resolve => setTimeout(resolve, 20));
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
