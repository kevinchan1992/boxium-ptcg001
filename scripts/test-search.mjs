import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// Check Mario Pikachu cards with correct column names
const [mario] = await conn.execute(
  'SELECT id, name, nameJa, cardNumber FROM cards WHERE name LIKE "%Mario%" OR name LIKE "%mario%" LIMIT 10'
);
console.log('\nMario cards (by name):');
mario.forEach(r => console.log(`  id=${r.id} name="${r.name}" nameJa="${r.nameJa}" cardNumber="${r.cardNumber}"`));

// Check pikachu AND mario AND logic (what the current search does)
const [test1] = await conn.execute(
  'SELECT id, name, nameJa, cardNumber FROM cards WHERE (name LIKE "%pikachu%" OR nameJa LIKE "%pikachu%") AND (name LIKE "%mario%" OR nameJa LIKE "%mario%") LIMIT 10'
);
console.log('\npikachu AND mario (AND logic):');
test1.forEach(r => console.log(`  id=${r.id} name="${r.name}"`));

// Check mario AND pikachu (reversed order)
const [test2] = await conn.execute(
  'SELECT id, name, nameJa, cardNumber FROM cards WHERE (name LIKE "%mario%" OR nameJa LIKE "%mario%") AND (name LIKE "%pikachu%" OR nameJa LIKE "%pikachu%") LIMIT 10'
);
console.log('\nmario AND pikachu (reversed, AND logic):');
test2.forEach(r => console.log(`  id=${r.id} name="${r.name}"`));

// Check total pikachu cards
const [total] = await conn.execute(
  'SELECT COUNT(*) as cnt FROM cards WHERE name LIKE "%pikachu%" OR nameJa LIKE "%pikachu%"'
);
console.log('\nTotal pikachu cards:', total[0].cnt);

// Check total mario cards
const [totalMario] = await conn.execute(
  'SELECT COUNT(*) as cnt FROM cards WHERE name LIKE "%mario%" OR nameJa LIKE "%mario%"'
);
console.log('Total mario cards:', totalMario[0].cnt);

// Check if Mario Pikachu cards have "pikachu" in name
const [check] = await conn.execute(
  'SELECT id, name, nameJa, cardNumber FROM cards WHERE name LIKE "%Mario Pikachu%" LIMIT 5'
);
console.log('\nMario Pikachu exact cards:');
check.forEach(r => console.log(`  id=${r.id} name="${r.name}" nameJa="${r.nameJa}"`));

await conn.end();
