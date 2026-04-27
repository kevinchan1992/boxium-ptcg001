import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  // Check if column exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'gradingBatches' AND COLUMN_NAME = 'batchCostHkd'`
  );
  
  if (rows.length > 0) {
    console.log('✅ batchCostHkd column already exists!');
  } else {
    console.log('⚠️  batchCostHkd column NOT found. Adding it now...');
    await conn.execute(
      `ALTER TABLE \`gradingBatches\` ADD COLUMN \`batchCostHkd\` DECIMAL(10,2) DEFAULT '0.00'`
    );
    console.log('✅ batchCostHkd column added successfully!');
  }

  // Also show all columns
  const [cols] = await conn.execute(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_NAME = 'gradingBatches' ORDER BY ORDINAL_POSITION`
  );
  console.log('\ngradingBatches columns:');
  cols.forEach(c => console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}) default: ${c.COLUMN_DEFAULT}`));

} finally {
  await conn.end();
}
