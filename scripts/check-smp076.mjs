import { createConnection } from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
const conn = await createConnection(dbUrl);

// Find the card
const [cards] = await conn.execute(`
  SELECT id, nameJa, snkrdunkId FROM cards 
  WHERE nameJa LIKE '%サトシのピカチュウ%' AND nameJa LIKE '%SM-P%076%'
  LIMIT 5
`);
console.log('Cards found:', JSON.stringify(cards, null, 2));

if (cards.length > 0) {
  const cardId = cards[0].id;
  
  // Get all PSA10 records for this card
  const [psa10] = await conn.execute(`
    SELECT id, grade, CAST(price AS DECIMAL(12,2)) as hkdPrice, jpyPrice, soldAt
    FROM priceHistory
    WHERE cardId = ? AND grade = 'PSA10'
    ORDER BY soldAt DESC
    LIMIT 20
  `, [cardId]);
  console.log('\nAll PSA10 records for this card:');
  console.log(JSON.stringify(psa10, null, 2));
  
  // Check if there's a HKD 1155 record
  const [anomalous] = await conn.execute(`
    SELECT id, grade, CAST(price AS DECIMAL(12,2)) as hkdPrice, jpyPrice, soldAt
    FROM priceHistory
    WHERE cardId = ? AND CAST(price AS DECIMAL) BETWEEN 1000 AND 1300
    ORDER BY soldAt DESC
  `, [cardId]);
  console.log('\nAnomalous records (HKD 1000-1300):');
  console.log(JSON.stringify(anomalous, null, 2));
}

// Also check the calculateReferencePrice logic
// Find PSA10 records where jpyPrice is between 15000-25000 (HKD 825-1375)
const [lowPsa10] = await conn.execute(`
  SELECT ph.cardId, ph.grade, CAST(ph.price AS DECIMAL(10,2)) as hkdPrice, ph.jpyPrice, 
         DATE(ph.soldAt) as soldDate, c.nameJa
  FROM priceHistory ph
  JOIN cards c ON ph.cardId = c.id
  WHERE ph.grade = 'PSA10'
    AND ph.jpyPrice BETWEEN 15000 AND 25000
  ORDER BY ph.soldAt DESC
  LIMIT 10
`);
console.log('\nPSA10 records with JPY 15000-25000:');
console.log(JSON.stringify(lowPsa10, null, 2));

await conn.end();
