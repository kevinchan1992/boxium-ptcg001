import Database from 'better-sqlite3';

const db = new Database('./data.db');
const records = db.prepare('SELECT soldAt, createdAt, grade, price FROM priceHistory WHERE cardId = 270143 AND (grade = "PSA 10" OR grade = "PSA10") ORDER BY soldAt DESC LIMIT 10').all();

console.log('Found', records.length, 'records');
records.forEach((r, i) => {
  console.log(`Record ${i + 1}:`, {
    soldAt: r.soldAt,
    createdAt: r.createdAt,
    grade: r.grade,
    price: r.price
  });
  
  if (r.soldAt) {
    const soldDate = new Date(r.soldAt);
    console.log('  Sold date:', soldDate.toISOString());
    console.log('  Days ago:', Math.floor((Date.now() - soldDate.getTime()) / (1000 * 60 * 60 * 24)));
  }
});

db.close();
