import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await mysql.createConnection(url);
try {
  const [batches] = await conn.execute('SELECT id, batchName, status, batchCostHkd FROM `gradingBatches` ORDER BY id DESC LIMIT 10');
  console.log('gradingBatches count:', batches.length);
  console.log('Batches:', JSON.stringify(batches, null, 2));

  // Check submissions
  const [subs] = await conn.execute('SELECT id, batchId, status, totalFeeHkd FROM `gradingSubmissions` WHERE batchId IS NOT NULL LIMIT 10');
  console.log('\nSubmissions with batchId:', subs.length);
  console.log(JSON.stringify(subs, null, 2));
} finally {
  await conn.end();
}
