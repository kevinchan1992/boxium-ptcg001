/**
 * Normalize soldAt timestamps to UTC midnight and re-deduplicate
 * 
 * Problem: parseJapaneseDate used new Date(year, month, day) which creates
 * local-timezone timestamps with variable time components, causing the same
 * date to produce different timestamps on different scraping runs.
 * 
 * Fix: Truncate all soldAt values to UTC midnight (00:00:00.000)
 * Then remove duplicates that become identical after normalization.
 */
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log('[Normalize] Starting soldAt normalization...');
  
  // Step 1: Check current state
  const [totalRows] = await conn.execute('SELECT COUNT(*) as total FROM priceHistory');
  console.log(`[Normalize] Total records before: ${totalRows[0].total}`);
  
  // Step 2: Drop unique index temporarily to allow normalization
  console.log('[Normalize] Dropping unique index temporarily...');
  try {
    await conn.execute('DROP INDEX uniq_price_card_source_grade_soldAt ON priceHistory');
    console.log('[Normalize] Unique index dropped');
  } catch (err) {
    if (err.message?.includes('check that column/key exists')) {
      console.log('[Normalize] Index did not exist, continuing...');
    } else {
      throw err;
    }
  }
  
  // Step 3: Normalize all soldAt to UTC midnight in batches
  // DATE(CONVERT_TZ(soldAt, '+00:00', '+00:00')) gives UTC date
  // Then we set time to 00:00:00 UTC
  console.log('[Normalize] Normalizing soldAt to UTC midnight...');
  
  // Get all distinct cardIds to process in batches
  const [cardIds] = await conn.execute(`
    SELECT DISTINCT cardId FROM priceHistory ORDER BY cardId
  `);
  
  console.log(`[Normalize] Processing ${cardIds.length} cards...`);
  
  let updatedTotal = 0;
  let processed = 0;
  
  for (const row of cardIds) {
    const cardId = row.cardId;
    
    // Update soldAt to UTC midnight for this card
    const [result] = await conn.execute(`
      UPDATE priceHistory 
      SET soldAt = DATE_FORMAT(soldAt, '%Y-%m-%d 00:00:00')
      WHERE cardId = ? AND TIME(soldAt) != '00:00:00'
    `, [cardId]);
    
    updatedTotal += result.affectedRows;
    processed++;
    
    if (processed % 500 === 0) {
      console.log(`[Normalize] Progress: ${processed}/${cardIds.length} cards, ${updatedTotal} records updated`);
    }
  }
  
  console.log(`[Normalize] Normalization complete: ${updatedTotal} records updated`);
  
  // Step 4: Now deduplicate (same logic as before but now soldAt is consistent)
  console.log('[Normalize] Starting deduplication after normalization...');
  
  const [dupCardIds] = await conn.execute(`
    SELECT DISTINCT cardId 
    FROM (
      SELECT cardId, source, grade, soldAt, COUNT(*) as cnt
      FROM priceHistory
      GROUP BY cardId, source, grade, soldAt
      HAVING cnt > 1
    ) sub
    ORDER BY cardId
  `);
  
  console.log(`[Normalize] Found ${dupCardIds.length} cards with duplicates after normalization`);
  
  let totalDeleted = 0;
  let dedupProcessed = 0;
  
  for (const row of dupCardIds) {
    const cardId = row.cardId;
    
    try {
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
      dedupProcessed++;
      
      if (dedupProcessed % 200 === 0) {
        console.log(`[Normalize] Dedup progress: ${dedupProcessed}/${dupCardIds.length} cards, ${totalDeleted} records deleted`);
      }
    } catch (err) {
      console.error(`[Normalize] Error deduplicating cardId ${cardId}:`, err.message);
    }
  }
  
  console.log(`[Normalize] Dedup complete: ${totalDeleted} duplicate records deleted`);
  
  // Step 5: Re-add unique index
  console.log('[Normalize] Re-adding unique index...');
  try {
    await conn.execute(`
      ALTER TABLE priceHistory 
      ADD UNIQUE INDEX uniq_price_card_source_grade_soldAt (cardId, source, grade, soldAt)
    `);
    console.log('[Normalize] Unique index re-added successfully!');
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log('[Normalize] Index already exists');
    } else {
      console.error('[Normalize] Failed to add unique index:', err.message);
    }
  }
  
  // Final count
  const [finalRows] = await conn.execute('SELECT COUNT(*) as total FROM priceHistory');
  console.log(`[Normalize] Total records after: ${finalRows[0].total}`);
  
} finally {
  await conn.end();
}
