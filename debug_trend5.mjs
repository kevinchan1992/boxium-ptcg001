import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL || '');

// GRADE_TO_PRICE_GRADE mapping (copied from collection.ts)
const GRADE_TO_PRICE_GRADE = {
  "PSA 10": "PSA 10", "PSA 9": "PSA 9", "PSA 8": "PSA 8",
  "PSA 7": "PSA 8", "PSA 6以下": "PSA 8",
  "BGS 10 Black Label": "PSA 10", "BGS 9.5": "PSA 10", "BGS 9": "PSA 10",
  "BGS 8.5以下": "PSA 10", "TAG 10": "PSA 10", "TAG 9以下": "PSA 10",
  "A": "A", "B": "B", "C": "C", "D": "D", "UNGRADED": "PSA 10",
};
function getMarketGrade(grade) {
  if (!grade) return "PSA 10";
  return GRADE_TO_PRICE_GRADE[grade] ?? "PSA 10";
}

// Step 1: Get all user collection items (same as getUserCollection)
const [items] = await conn.execute(`
  SELECT uc.id, uc.cardId, uc.grader, uc.grade, uc.quantity, uc.purchasePrice, uc.purchasedAt,
    c.name as cardName
  FROM userCollections uc
  LEFT JOIN cards c ON c.id = uc.cardId
  WHERE uc.userId = 1 AND uc.tradedAt IS NULL
`);

console.log('Step 1 - Total items from getUserCollection:', items.length);

// Step 2: Build gradeRequests (same as getPortfolioTrend)
const gradeRequests = items
  .filter(i => i.cardId)
  .map(i => ({ cardId: i.cardId, grade: getMarketGrade(i.grade) }))
  .filter((r, idx, arr) => arr.findIndex(x => x.cardId === r.cardId && x.grade === r.grade) === idx);

console.log('Step 2 - gradeRequests count (unique cardId+grade pairs):', gradeRequests.length);

// Step 3: Simulate batchGetLatestPricesByGrades
const result = new Map();
for (const { cardId, grade } of gradeRequests) {
  result.set(`${cardId}:${grade}`, null);
}

const cardIds = [...new Set(gradeRequests.map(r => r.cardId))];
console.log('Step 3 - Unique cardIds to query:', cardIds.length);

if (cardIds.length > 0) {
  const placeholders = cardIds.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT cardId, grade, price, soldAt FROM priceHistory 
     WHERE cardId IN (${placeholders}) AND source = 'snkrdunk' AND isSuspectedBulk = 0
     ORDER BY soldAt DESC`,
    cardIds
  );
  console.log('Step 3 - Total priceHistory rows fetched:', rows.length);
  
  const seen = new Set();
  for (const row of rows) {
    if (!row.grade) continue;
    const key = `${row.cardId}:${row.grade}`;
    if (!seen.has(key) && result.has(key)) {
      result.set(key, Number(row.price));
      seen.add(key);
    }
  }
}

const foundCount = [...result.values()].filter(v => v != null).length;
const missingCount = [...result.values()].filter(v => v == null).length;
console.log(`Step 3 - Price lookup: found=${foundCount}, missing=${missingCount}`);

// Step 4: Calculate current month total (same as getPortfolioTrend isCurrentMonth)
const now = new Date();
const activeItems = items.filter(i => i.purchasedAt != null);
const totalMarketValue = activeItems.reduce((s, i) => {
  const lookupGrade = getMarketGrade(i.grade);
  const key = `${i.cardId}:${lookupGrade}`;
  const price = result.get(key) ?? Number(i.purchasePrice ?? 0);
  return s + price * i.quantity;
}, 0);

console.log(`\nStep 4 - Current month totalMarketValue: ${totalMarketValue.toFixed(2)}`);
console.log(`Expected: ~1,256,322`);

// Show missing items
if (missingCount > 0) {
  console.log('\nMissing price items:');
  for (const [key, val] of result.entries()) {
    if (val == null) console.log(`  key=${key}`);
  }
}

await conn.end();
