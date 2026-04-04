import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await createConnection(url);

try {
  // Check if columns already exist
  const [cols] = await conn.execute(
    "SHOW COLUMNS FROM users LIKE 'emailVerification%'"
  );
  
  console.log('Existing emailVerification columns:', cols.length);
  
  if (cols.length === 0) {
    console.log('Adding emailVerificationToken and emailVerificationExpiry columns...');
    
    await conn.execute(
      "ALTER TABLE users ADD COLUMN `emailVerificationToken` varchar(128) DEFAULT NULL"
    );
    console.log('✅ Added emailVerificationToken');
    
    await conn.execute(
      "ALTER TABLE users ADD COLUMN `emailVerificationExpiry` timestamp NULL DEFAULT NULL"
    );
    console.log('✅ Added emailVerificationExpiry');
  } else {
    console.log('Columns already exist:', cols.map(c => c.Field));
  }
  
  // Also check payoutHoldUntil
  const [payoutCols] = await conn.execute(
    "SHOW COLUMNS FROM marketplaceOrders LIKE 'payoutHoldUntil'"
  );
  
  if (payoutCols.length === 0) {
    console.log('Adding payoutHoldUntil column to marketplaceOrders...');
    await conn.execute(
      "ALTER TABLE marketplaceOrders ADD COLUMN `payoutHoldUntil` timestamp NULL DEFAULT NULL"
    );
    console.log('✅ Added payoutHoldUntil');
  } else {
    console.log('payoutHoldUntil already exists');
  }
  
  // Verify all columns
  const [finalCols] = await conn.execute(
    "SHOW COLUMNS FROM users WHERE Field IN ('emailVerified', 'emailVerificationToken', 'emailVerificationExpiry', 'passwordHash', 'phone', 'isBlocked')"
  );
  console.log('\nFinal users columns:', finalCols.map(c => `${c.Field} (${c.Type})`));
  
} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await conn.end();
}
