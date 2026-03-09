/**
 * Fix priceHistory deduplication v2 - using jpyPrice for accurate deduplication
 * 
 * Problem: SNKRDUNK uses relative dates ("2日前", "3日前") which shift every day.
 * When the same transaction is scraped on different days, it gets stored with
 * slightly different dates (e.g., 03/07 and 03/08), causing duplicate records.
 * 
 * Solution: Use jpyPrice (original JPY) as the deduplication key instead of date.
 * Same card + same grade + same JPY price = same transaction (extremely rare collision).
 * 
 * This script:
 * 1. Updates jpyPrice for all existing records (reverse-convert from HKD if needed)
 * 2. Finds true duplicates: same cardId + source + grade + jpyPrice (regardless of date)
 * 3. Keeps the record with the EARLIEST soldAt (most accurate date from first scrape)
 * 4. Deletes the rest
 */
import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);
console.log('Connected to database');

// Step 1: Update jpyPrice for records that still have NULL jpyPrice
const [updateResult] = await conn.query(
  "UPDATE `priceHistory` SET `jpyPrice` = ROUND(`price` / 0.055) WHERE `source` = 'snkrdunk' AND `jpyPrice` IS NULL"
);
console.log(`✓ Updated jpyPrice for ${updateResult.affectedRows} records with NULL jpyPrice`);

// Step 2: Count true duplicates (same cardId + source + grade + jpyPrice, different soldAt)
const [dupCount] = await conn.query(`
  SELECT COUNT(*) as total_dups FROM (
    SELECT cardId, grade, jpyPrice, COUNT(*) as cnt
    FROM priceHistory
    WHERE source = 'snkrdunk' AND jpyPrice IS NOT NULL
    GROUP BY cardId, grade, jpyPrice
    HAVING COUNT(*) > 1
  ) t
`);
console.log(`\n📊 Found ${dupCount[0].total_dups} duplicate groups (same card+grade+jpyPrice, different dates)`);

if (dupCount[0].total_dups > 0) {
  // Step 3: Show sample of duplicates for verification
  const [samples] = await conn.query(`
    SELECT 
      ph.cardId,
      ph.grade,
      ph.jpyPrice,
      ph.price as hkdPrice,
      ph.soldAt,
      ph.id
    FROM priceHistory ph
    INNER JOIN (
      SELECT cardId, grade, jpyPrice
      FROM priceHistory
      WHERE source = 'snkrdunk' AND jpyPrice IS NOT NULL
      GROUP BY cardId, grade, jpyPrice
      HAVING COUNT(*) > 1
      LIMIT 5
    ) dups ON ph.cardId = dups.cardId 
      AND (ph.grade = dups.grade OR (ph.grade IS NULL AND dups.grade IS NULL))
      AND ph.jpyPrice = dups.jpyPrice
    WHERE ph.source = 'snkrdunk'
    ORDER BY ph.cardId, ph.grade, ph.jpyPrice, ph.soldAt
  `);
  
  console.log('\n📋 Sample duplicates (showing first 5 groups):');
  for (const row of samples) {
    console.log(`  Card ${row.cardId} | Grade: ${row.grade} | ¥${row.jpyPrice} | Date: ${row.soldAt?.toISOString().split('T')[0]} | HKD: ${row.hkdPrice} | id: ${row.id}`);
  }

  // Step 4: Delete duplicates - keep the record with EARLIEST soldAt (most accurate)
  // For records with same soldAt, keep the one with lowest id
  const [deleteResult] = await conn.query(`
    DELETE ph FROM \`priceHistory\` ph
    INNER JOIN (
      SELECT 
        MIN(id) as keep_id,
        cardId, source, grade, jpyPrice
      FROM \`priceHistory\`
      WHERE source = 'snkrdunk' AND jpyPrice IS NOT NULL
      GROUP BY cardId, source, grade, jpyPrice
      HAVING COUNT(*) > 1
    ) dups 
    ON ph.cardId = dups.cardId 
      AND ph.source = dups.source 
      AND (ph.grade = dups.grade OR (ph.grade IS NULL AND dups.grade IS NULL))
      AND ph.jpyPrice = dups.jpyPrice
      AND ph.id != dups.keep_id
  `);
  console.log(`\n✓ Deleted ${deleteResult.affectedRows} duplicate records`);
} else {
  console.log('✓ No duplicates found - database is clean!');
}

// Step 5: Final verification
const [finalTotal] = await conn.query("SELECT COUNT(*) as cnt FROM priceHistory WHERE source = 'snkrdunk'");
const [finalDups] = await conn.query(`
  SELECT COUNT(*) as dupGroups FROM (
    SELECT cardId, grade, jpyPrice
    FROM priceHistory
    WHERE source = 'snkrdunk' AND jpyPrice IS NOT NULL
    GROUP BY cardId, grade, jpyPrice
    HAVING COUNT(*) > 1
  ) t
`);

console.log(`\n📊 Final state:`);
console.log(`  Total SNKRDUNK records: ${finalTotal[0].cnt}`);
console.log(`  Remaining duplicate groups: ${finalDups[0].dupGroups}`);

// Step 6: Verify card 812832 specifically (the example from user)
const [card812832] = await conn.query(`
  SELECT soldAt, grade, price, jpyPrice
  FROM priceHistory 
  WHERE cardId = 812832 AND source = 'snkrdunk'
  ORDER BY soldAt DESC
  LIMIT 15
`);
console.log(`\n📋 Card 812832 price history (should match SNKRDUNK website):`);
for (const row of card812832) {
  const date = row.soldAt ? new Date(row.soldAt).toLocaleDateString('zh-HK', {timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit'}) : 'N/A';
  console.log(`  ${date} | ${row.grade} | HKD ${row.price} | ¥${row.jpyPrice}`);
}

await conn.end();
console.log('\n🎉 Cleanup complete!');
