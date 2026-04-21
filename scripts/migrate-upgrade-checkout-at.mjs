import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (!connectionString) {
  console.error('No DATABASE_URL found');
  process.exit(1);
}

// Parse MySQL connection string
const url = new URL(connectionString);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: parseInt(url.port || '3306'),
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

try {
  // Check if column already exists
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'gradingSubmissions' 
     AND COLUMN_NAME = 'upgradeCheckoutAt'`
  );
  
  if (rows.length > 0) {
    console.log('Column upgradeCheckoutAt already exists, skipping.');
  } else {
    await connection.execute(
      `ALTER TABLE gradingSubmissions ADD COLUMN upgradeCheckoutAt TIMESTAMP NULL AFTER upgradeNewTierId`
    );
    console.log('Successfully added upgradeCheckoutAt column to gradingSubmissions');
  }
} finally {
  await connection.end();
}
