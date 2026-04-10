import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// Simulate the exact search logic from db.ts searchCards
// tokenizeSearchQuery("pikachu mario") -> ["pikachu", "mario"]
// Each token: name LIKE %pikachu% OR nameJa LIKE %pikachu%
// AND name LIKE %mario% OR nameJa LIKE %mario%

// Test 1: What does the search return for "pikachu mario"?
const [r1] = await conn.execute(`
  SELECT id, name, nameJa, cardNumber 
  FROM cards 
  WHERE (name LIKE '%pikachu%' OR nameJa LIKE '%pikachu%')
    AND (name LIKE '%mario%' OR nameJa LIKE '%mario%')
  LIMIT 20
`);
console.log('Search "pikachu mario" results:', r1.length, 'cards');
r1.forEach(r => console.log(`  "${r.name}"`));

// Test 2: What does the search return for "mario pikachu"?
const [r2] = await conn.execute(`
  SELECT id, name, nameJa, cardNumber 
  FROM cards 
  WHERE (name LIKE '%mario%' OR nameJa LIKE '%mario%')
    AND (name LIKE '%pikachu%' OR nameJa LIKE '%pikachu%')
  LIMIT 20
`);
console.log('\nSearch "mario pikachu" results:', r2.length, 'cards');
r2.forEach(r => console.log(`  "${r.name}"`));

// Test 3: Check if searchSealedProducts also works
const [r3] = await conn.execute(`
  SELECT id, name, nameJa 
  FROM sealed_products 
  WHERE (name LIKE '%pikachu%' OR nameJa LIKE '%pikachu%')
    AND (name LIKE '%mario%' OR nameJa LIKE '%mario%')
  LIMIT 10
`);
console.log('\nSealed products "pikachu mario" results:', r3.length);

// Test 4: Check the products.search combined result
// The search page shows "找到 3 張卡牌" - let's verify the total count
const [r4] = await conn.execute(`
  SELECT COUNT(*) as total 
  FROM cards 
  WHERE (name LIKE '%pikachu%' OR nameJa LIKE '%pikachu%')
    AND (name LIKE '%mario%' OR nameJa LIKE '%mario%')
`);
console.log('\nTotal count for pikachu AND mario:', r4[0].total);

// Test 5: Check if there's a "Pikachu ex Mirror" card that should appear in pikachu search
const [r5] = await conn.execute(`
  SELECT id, name, nameJa, cardNumber 
  FROM cards 
  WHERE name LIKE '%Pikachu ex%Mirror%' OR name LIKE '%Mirror%Pikachu ex%'
  LIMIT 5
`);
console.log('\nPikachu ex Mirror cards:');
r5.forEach(r => console.log(`  "${r.name}" (${r.cardNumber})`));

await conn.end();
