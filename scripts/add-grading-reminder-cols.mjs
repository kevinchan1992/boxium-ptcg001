import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

const sqls = [
  `ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS paymentDueAt TIMESTAMP NULL`,
  `ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS day15ReminderSentAt TIMESTAMP NULL`,
  `ALTER TABLE gradingSubmissions ADD COLUMN IF NOT EXISTS day25ReminderSentAt TIMESTAMP NULL`,
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    console.log('OK:', sql.substring(0, 60));
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Already exists, skipping:', sql.substring(0, 60));
    } else {
      console.error('Error:', e.message, sql);
    }
  }
}

await conn.end();
console.log('Migration complete.');
