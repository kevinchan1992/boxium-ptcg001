import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const conn = await mysql.createConnection(DATABASE_URL);

console.log('Starting batch fill of setName/series using SQL...');

// Update setName: extract set code from [SET_CODE ...]
// Pattern: name contains [XXX where XXX is alphanumeric set code followed by space
const [r1] = await conn.execute(`
  UPDATE cards 
  SET setName = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, '[', -1), ' ', 1))
  WHERE (setName IS NULL OR setName = '')
  AND name LIKE '%[%'
  AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, '[', -1), ' ', 1)) != ''
  AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, '[', -1), ' ', 1)) REGEXP '^[A-Za-z0-9\\-]+$'
`);
console.log(`setName updated: ${r1.affectedRows} rows`);

// Update series: extract text inside last parentheses (...)
// Pattern: name ends with (...) 
const [r2] = await conn.execute(`
  UPDATE cards 
  SET series = TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, '(', -1), ')', 1))
  WHERE (series IS NULL OR series = '')
  AND name LIKE '%(%)%'
  AND TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(name, '(', -1), ')', 1)) != ''
`);
console.log(`series updated: ${r2.affectedRows} rows`);

// Verify results
const [stats] = await conn.execute(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN setName IS NOT NULL AND setName != '' THEN 1 ELSE 0 END) as has_set_name,
    SUM(CASE WHEN series IS NOT NULL AND series != '' THEN 1 ELSE 0 END) as has_series
  FROM cards
`);
console.log('\nFinal stats:', stats[0]);

// Show top setName values
const [setNames] = await conn.execute(`
  SELECT setName, COUNT(*) as cnt FROM cards 
  WHERE setName IS NOT NULL AND setName != '' 
  GROUP BY setName ORDER BY cnt DESC LIMIT 15
`);
console.log('\nTop setName values:');
setNames.forEach(s => console.log(`  ${s.setName}: ${s.cnt} cards`));

// Show top series values
const [seriesVals] = await conn.execute(`
  SELECT series, COUNT(*) as cnt FROM cards 
  WHERE series IS NOT NULL AND series != '' 
  GROUP BY series ORDER BY cnt DESC LIMIT 10
`);
console.log('\nTop series values:');
seriesVals.forEach(s => console.log(`  ${s.series}: ${s.cnt} cards`));

await conn.end();
process.exit(0);
