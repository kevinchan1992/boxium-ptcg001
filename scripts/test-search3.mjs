import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const conn = await mysql.createConnection(process.env.DATABASE_URL || '');

// Get all pikachu cards (no price join for now)
const [allPikachu] = await conn.execute(`
  SELECT id, name, nameJa, cardNumber
  FROM cards
  WHERE name LIKE '%pikachu%' OR nameJa LIKE '%pikachu%'
  LIMIT 700
`);

console.log('Total pikachu cards:', allPikachu.length);

// Simulate relevance scoring for "pikachu" query
const queryUpper = 'PIKACHU';
const allWithScore = allPikachu.map(r => {
  const nameUpper = (r.name || '').toUpperCase();
  let score = 0;
  if (nameUpper === queryUpper) score = 70;
  else if (nameUpper.startsWith(queryUpper)) score = 60;
  else if (nameUpper.includes(queryUpper)) score = 40;
  return { ...r, score };
});

// Sort by score desc (no price since we don't have it)
allWithScore.sort((a, b) => b.score - a.score);

// Find Mario Pikachu positions
const marioCards = allWithScore.filter(r => r.name && r.name.includes('Mario'));
console.log('\nMario Pikachu cards found:', marioCards.length);
marioCards.forEach(r => {
  const pos = allWithScore.findIndex(c => c.id === r.id) + 1;
  console.log(`  Position ${pos}: "${r.name}" (score: ${r.score})`);
  console.log(`  -> Page ${Math.ceil(pos / 40)} of ${Math.ceil(allPikachu.length / 40)} (40 per page)`);
});

// Show score distribution
const scoreGroups = {};
allWithScore.forEach(r => {
  scoreGroups[r.score] = (scoreGroups[r.score] || 0) + 1;
});
console.log('\nScore distribution for "pikachu" search:');
Object.entries(scoreGroups).sort((a, b) => b[0] - a[0]).forEach(([score, count]) => {
  console.log(`  Score ${score}: ${count} cards`);
});

// Show first 5 cards with score 40 (contains but not starts with)
const score40 = allWithScore.filter(r => r.score === 40);
console.log('\nFirst 5 cards with score 40 (contains pikachu):');
score40.slice(0, 5).forEach((r, i) => console.log(`  ${i+1}. "${r.name}"`));

await conn.end();
