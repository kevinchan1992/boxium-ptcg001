import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL env var not set');
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// Check anomalous PSA10 records (HKD 1000-2000 range)
const [rows] = await conn.execute(`
  SELECT ph.cardId, ph.grade, CAST(ph.price AS DECIMAL(10,2)) as hkdPrice, 
         ph.jpyPrice, DATE(ph.soldAt) as soldDate, c.nameJa
  FROM priceHistory ph
  JOIN cards c ON ph.cardId = c.id
  WHERE ph.grade = 'PSA10'
    AND CAST(ph.price AS DECIMAL) BETWEEN 900 AND 2000
  ORDER BY ph.soldAt DESC
  LIMIT 20
`);

console.log('\n=== Anomalous PSA10 records (HKD 900-2000) ===');
console.log(JSON.stringify(rows, null, 2));

// Check the total count of PSA10 records in this range
const [countRows] = await conn.execute(`
  SELECT COUNT(*) as cnt, MIN(CAST(price AS DECIMAL)) as minHkd, MAX(CAST(price AS DECIMAL)) as maxHkd
  FROM priceHistory
  WHERE grade = 'PSA10'
    AND CAST(price AS DECIMAL) BETWEEN 900 AND 2000
`);
console.log('\n=== Count of PSA10 records HKD 900-2000 ===');
console.log(JSON.stringify(countRows, null, 2));

// Check jpyPrice distribution for these records
const [jpyRows] = await conn.execute(`
  SELECT ph.jpyPrice, CAST(ph.price AS DECIMAL(10,2)) as hkdPrice, DATE(ph.soldAt) as soldDate
  FROM priceHistory ph
  WHERE ph.grade = 'PSA10'
    AND CAST(ph.price AS DECIMAL) BETWEEN 900 AND 2000
  ORDER BY ph.jpyPrice ASC
  LIMIT 10
`);
console.log('\n=== JPY prices of anomalous PSA10 records ===');
console.log(JSON.stringify(jpyRows, null, 2));

await conn.end();
