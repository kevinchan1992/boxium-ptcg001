/**
 * Batch deduplication script for priceHistory table
 * Processes one cardId at a time to avoid TiDB memory limits
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('[Dedup] Starting batch deduplication of priceHistory table...');
  
  // Get all cardIds that have duplicates
  const [cardIds] = await conn.execute(`
    SELECT DISTINCT cardId 
    FROM (
      SELECT cardId, source, grade, soldAt, COUNT(*) as cnt
      FROM priceHistory
      GROUP BY cardId, source, grade, soldAt
      HAVING cnt > 1
    ) sub
    ORDER BY cardId
  `);
  
  console.log(`[Dedup] Found ${cardIds.length} cards with duplicate records`);
  
  let totalDeleted = 0;
  let processed = 0;
  
  for (const row of cardIds) {
    const cardId = row.cardId;
    
    try {
      // For each cardId, delete duplicates keeping the lowest id
      // Use a subquery approach that TiDB can handle
      const [result] = await conn.execute(`
        DELETE FROM priceHistory
        WHERE id IN (
          SELECT id FROM (
            SELECT ph.id
            FROM priceHistory ph
            INNER JOIN (
              SELECT MIN(id) as min_id, cardId, source, grade, soldAt
              FROM priceHistory
              WHERE cardId = ?
              GROUP BY cardId, source, grade, soldAt
              HAVING COUNT(*) > 1
            ) keep_ids ON ph.cardId = keep_ids.cardId 
              AND ph.source = keep_ids.source 
              AND (ph.grade = keep_ids.grade OR (ph.grade IS NULL AND keep_ids.grade IS NULL))
              AND ph.soldAt = keep_ids.soldAt
              AND ph.id != keep_ids.min_id
            WHERE ph.cardId = ?
          ) to_delete
        )
      `, [cardId, cardId]);
      
      totalDeleted += result.affectedRows;
      processed++;
      
      if (processed % 100 === 0) {
        console.log(`[Dedup] Progress: ${processed}/${cardIds.length} cards, ${totalDeleted} records deleted`);
      }
    } catch (err) {
      console.error(`[Dedup] Error processing cardId ${cardId}:`, err.message);
    }
  }
  
  console.log(`[Dedup] Completed! Processed ${processed} cards, deleted ${totalDeleted} duplicate records`);
  
  // Now add the unique index
  console.log('[Dedup] Adding unique index...');
  try {
    await conn.execute(`
      ALTER TABLE priceHistory 
      ADD UNIQUE INDEX uniq_price_card_source_grade_soldAt (cardId, source, grade, soldAt)
    `);
    console.log('[Dedup] Unique index added successfully!');
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name')) {
      console.log('[Dedup] Index already exists, skipping...');
    } else {
      console.error('[Dedup] Failed to add unique index:', err.message);
    }
  }
  
} finally {
  await conn.end();
}
