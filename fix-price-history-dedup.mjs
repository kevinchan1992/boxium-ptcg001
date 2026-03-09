/**
 * Fix priceHistory deduplication:
 * 1. Drop old UNIQUE INDEX (based on HKD price - affected by exchange rate)
 * 2. Delete duplicate records (keep oldest per cardId+source+grade+soldAt+jpyPrice)
 * 3. Create new UNIQUE INDEX using jpyPrice (stable JPY price)
 */
import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Step 3: Drop old UNIQUE INDEX
try {
  await conn.query('DROP INDEX `uniq_price_card_source_grade_soldAt_price` ON `priceHistory`');
  console.log('✓ Dropped old UNIQUE INDEX (based on HKD price)');
} catch(e) {
  if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
    console.log('ℹ Old index already dropped or does not exist');
  } else {
    throw e;
  }
}

// Step 4: Delete duplicate records
// Keep the record with the smallest id for each (cardId, source, grade, soldAt, jpyPrice) group
// This removes records that were created by exchange rate fluctuations
const deleteSQL = `
  DELETE ph FROM \`priceHistory\` ph
  INNER JOIN (
    SELECT MIN(id) as keep_id, cardId, source, grade, soldAt, jpyPrice
    FROM \`priceHistory\`
    WHERE source = 'snkrdunk'
    GROUP BY cardId, source, grade, soldAt, jpyPrice
    HAVING COUNT(*) > 1
  ) dups 
  ON ph.cardId = dups.cardId 
    AND ph.source = dups.source 
    AND (ph.grade = dups.grade OR (ph.grade IS NULL AND dups.grade IS NULL))
    AND ph.soldAt = dups.soldAt 
    AND (ph.jpyPrice = dups.jpyPrice OR (ph.jpyPrice IS NULL AND dups.jpyPrice IS NULL))
    AND ph.id != dups.keep_id
`;

const [r2] = await conn.query(deleteSQL);
console.log('✓ Deleted', r2.affectedRows, 'duplicate records');

// Step 5: Create new UNIQUE INDEX using jpyPrice
try {
  await conn.query(
    'CREATE UNIQUE INDEX `uniq_price_card_source_grade_soldAt_jpyPrice` ON `priceHistory` (`cardId`, `source`, `grade`, `soldAt`, `jpyPrice`)'
  );
  console.log('✓ Created new UNIQUE INDEX on jpyPrice');
} catch(e) {
  if (e.code === 'ER_DUP_KEYNAME') {
    console.log('ℹ New index already exists');
  } else {
    throw e;
  }
}

// Verify final state
const [total] = await conn.query("SELECT COUNT(*) as cnt FROM priceHistory WHERE source = 'snkrdunk'");
console.log('✓ Total SNKRDUNK records after cleanup:', total[0].cnt);

// Verify no more duplicates
const [dupeCheck] = await conn.query(`
  SELECT COUNT(*) as dupGroups FROM (
    SELECT cardId, grade, soldAt, jpyPrice
    FROM priceHistory
    WHERE source = 'snkrdunk'
    GROUP BY cardId, grade, soldAt, jpyPrice
    HAVING COUNT(*) > 1
  ) t
`);
console.log('✓ Remaining duplicate groups:', dupeCheck[0].dupGroups);

await conn.end();
console.log('\n🎉 Database cleanup complete!');
