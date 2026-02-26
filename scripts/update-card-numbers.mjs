/**
 * Batch update cardNumber field for all cards
 * Extract card numbers from card names using regex
 * 
 * Example card names:
 * - "Pikachu Munch Exhibition: PROMO[SM-P 288](SM-P Promotional cards)" → "SM-P 288"
 * - "Gardevoir CHR[sbb 196/184](High Class Pack"VMAX Climax")" → "sbb 196/184"
 * - "Lillie[sm3+ 055/051](Shining Legends)" → "sm3+ 055/051"
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema_new.js';
import { eq } from 'drizzle-orm';

// Create database connection
const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
});

const db = drizzle(connection, { schema, mode: 'default' });

/**
 * Extract card number from card name using regex
 * Matches content within square brackets [...]
 */
function extractCardNumber(cardName) {
  if (!cardName) return null;
  
  // Match content within square brackets: [SM-P 288], [sbb 196/184], [sm3+ 055/051]
  const match = cardName.match(/\[([^\]]+)\]/);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return null;
}

async function main() {
  console.log('Starting batch update of cardNumber field...\n');
  
  // Step 1: Get all cards
  console.log('Step 1: Fetching all cards from database...');
  const cards = await db.select({
    id: schema.cards.id,
    name: schema.cards.name,
    cardNumber: schema.cards.cardNumber,
  }).from(schema.cards);
  
  console.log(`Found ${cards.length} cards in database\n`);
  
  // Step 2: Extract card numbers and prepare updates
  console.log('Step 2: Extracting card numbers from card names...');
  const updates = [];
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  for (const card of cards) {
    // Skip if cardNumber already exists
    if (card.cardNumber && card.cardNumber.trim() !== '') {
      skipCount++;
      continue;
    }
    
    // Extract card number from name
    const extractedNumber = extractCardNumber(card.name);
    
    if (extractedNumber) {
      updates.push({
        id: card.id,
        name: card.name,
        cardNumber: extractedNumber,
      });
      successCount++;
    } else {
      failCount++;
      console.log(`  ❌ Failed to extract card number from: "${card.name}"`);
    }
  }
  
  console.log(`\nExtraction complete:`);
  console.log(`  ✅ Success: ${successCount} cards`);
  console.log(`  ⏭️  Skipped (already has cardNumber): ${skipCount} cards`);
  console.log(`  ❌ Failed (no card number found): ${failCount} cards\n`);
  
  // Step 3: Show sample updates
  if (updates.length > 0) {
    console.log('Step 3: Sample updates (first 10):');
    updates.slice(0, 10).forEach((update, index) => {
      console.log(`  ${index + 1}. "${update.name}" → cardNumber: "${update.cardNumber}"`);
    });
    console.log('');
  }
  
  // Step 4: Batch update database
  if (updates.length > 0) {
    console.log(`Step 4: Updating ${updates.length} cards in database...`);
    
    const batchSize = 100;
    let updatedCount = 0;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Update each card in the batch
      for (const update of batch) {
        await db.update(schema.cards)
          .set({ cardNumber: update.cardNumber })
          .where(eq(schema.cards.id, update.id));
        
        updatedCount++;
      }
      
      console.log(`  Progress: ${updatedCount}/${updates.length} cards updated`);
    }
    
    console.log(`\n✅ Batch update complete! Updated ${updatedCount} cards\n`);
  } else {
    console.log('No updates needed.\n');
  }
  
  // Step 5: Verify results
  console.log('Step 5: Verifying results...');
  const verifyCards = await db.select({
    id: schema.cards.id,
    name: schema.cards.name,
    cardNumber: schema.cards.cardNumber,
  }).from(schema.cards).limit(5);
  
  console.log('Sample cards after update:');
  verifyCards.forEach((card, index) => {
    console.log(`  ${index + 1}. ${card.name}`);
    console.log(`     cardNumber: ${card.cardNumber || '(null)'}`);
  });
  
  console.log('\n✅ Script completed successfully!');
  
  // Close connection
  await connection.end();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
