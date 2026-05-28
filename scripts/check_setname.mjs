import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const conn = await mysql.createConnection(DATABASE_URL);
const db = drizzle(conn);

// Check how many cards have setName and series filled
const [result] = await db.execute(sql`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN setName IS NOT NULL AND setName != '' THEN 1 ELSE 0 END) as has_set_name,
    SUM(CASE WHEN series IS NOT NULL AND series != '' THEN 1 ELSE 0 END) as has_series
  FROM cards
`);
console.log('Cards stats:', result);

// Check some sample names to understand the pattern
const [samples] = await db.execute(sql`
  SELECT id, name, setName, series FROM cards WHERE setName IS NULL LIMIT 5
`);
console.log('\nSample cards without setName:');
samples.forEach(s => console.log(`  ${s.id}: ${s.name}`));

// Check cards that DO have setName
const [withSetName] = await db.execute(sql`
  SELECT id, name, setName, series FROM cards WHERE setName IS NOT NULL AND setName != '' LIMIT 5
`);
console.log('\nSample cards WITH setName:');
withSetName.forEach(s => console.log(`  ${s.id}: ${s.name} | setName: ${s.setName} | series: ${s.series}`));

await conn.end();
