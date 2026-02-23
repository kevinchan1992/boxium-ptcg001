/**
 * Test script to check card 210008 configuration
 */

import { db } from './server/db.js';
import { cards } from './drizzle/schema_new.js';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Checking card 210008 configuration...\n');

  const card = await db.select().from(cards).where(eq(cards.id, 210008)).limit(1);

  if (card.length === 0) {
    console.log('❌ Card 210008 not found in database!');
    process.exit(1);
  }

  const cardData = card[0];
  
  console.log('✅ Card found:');
  console.log(`  ID: ${cardData.id}`);
  console.log(`  Name: ${cardData.name}`);
  console.log(`  Card Number: ${cardData.cardNumber}`);
  console.log(`  SNKRDUNK ID: ${cardData.snkrdunkId || 'NOT SET'}`);
  console.log(`  SNKRDUNK URL: ${cardData.snkrdunkUrl || 'NOT SET'}`);
  console.log(`\n  Has SNKRDUNK ID: ${!!cardData.snkrdunkId ? '✅ YES' : '❌ NO'}`);

  if (!cardData.snkrdunkId) {
    console.log('\n⚠️  WARNING: This card does not have a SNKRDUNK ID configured!');
    console.log('   This is why the Pricing page cannot scrape SNKRDUNK data.');
    console.log('   You need to set the snkrdunk_id field in the database.');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
