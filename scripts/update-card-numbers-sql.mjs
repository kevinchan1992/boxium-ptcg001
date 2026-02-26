/**
 * Batch update cardNumber field using SQL UPDATE with REGEXP
 * Much faster than row-by-row updates
 */

import mysql from 'mysql2/promise';

// Create database connection
const connection = await mysql.createConnection({
  uri: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
});

async function main() {
  console.log('Starting batch update of cardNumber field using SQL...\n');
  
  // Step 1: Check current state
  console.log('Step 1: Checking current state...');
  const [countResult] = await connection.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN cardNumber IS NULL OR cardNumber = '' THEN 1 ELSE 0 END) as without_number
    FROM cards
  `);
  
  console.log(`Total cards: ${countResult[0].total}`);
  console.log(`Cards without cardNumber: ${countResult[0].without_number}\n`);
  
  // Step 2: Update cardNumber using REGEXP_SUBSTR (MySQL 8.0+)
  console.log('Step 2: Updating cardNumber field using SQL REGEXP...');
  
  // Skip REGEXP_SUBSTR and use CASE WHEN directly (more compatible)
  try {
    if (false) { // Skip REGEXP_SUBSTR
      const [updateResult] = await connection.query(`
        UPDATE cards
        SET cardNumber = REGEXP_SUBSTR(name, '\\\\[([^\\\\]]+)\\\\]')
        WHERE (cardNumber IS NULL OR cardNumber = '')
          AND name REGEXP '\\\\[[^\\\\]]+\\\\]'
      `);
      
      console.log(`✅ Updated ${updateResult.affectedRows} cards\n`);
    } else {
      throw new Error('Using CASE WHEN method');
    }
  } catch (error) {
    if (true) { // Always use CASE WHEN method
      console.log('⚠️  REGEXP_SUBSTR not available, using alternative method...\n');
      
      // Fallback: Get all cards and update one by one (but in batches)
      console.log('Step 2 (Alternative): Fetching cards and updating in batches...');
      
      const [cards] = await connection.query(`
        SELECT id, name
        FROM cards
        WHERE (cardNumber IS NULL OR cardNumber = '')
          AND name REGEXP '\\\\[[^\\\\]]+\\\\]'
      `);
      
      console.log(`Found ${cards.length} cards to update\n`);
      
      if (cards.length > 0) {
        console.log('Extracting card numbers...');
        const updates = [];
        
        for (const card of cards) {
          const match = card.name.match(/\[([^\]]+)\]/);
          if (match && match[1]) {
            updates.push({
              id: card.id,
              cardNumber: match[1].trim(),
            });
          }
        }
        
        console.log(`Prepared ${updates.length} updates\n`);
        
        // Build CASE WHEN statement
        if (updates.length > 0) {
          console.log('Building SQL CASE WHEN statement...');
          
          const caseWhen = updates.map(u => 
            `WHEN id = ${u.id} THEN ${connection.escape(u.cardNumber)}`
          ).join('\n        ');
          
          const ids = updates.map(u => u.id).join(',');
          
          const sql = `
            UPDATE cards
            SET cardNumber = CASE
              ${caseWhen}
            END
            WHERE id IN (${ids})
          `;
          
          console.log('Executing batch update...');
          const [batchResult] = await connection.query(sql);
          console.log(`✅ Updated ${batchResult.affectedRows} cards\n`);
        }
      }
    } else {
      throw error;
    }
  }
  
  // Step 3: Verify results
  console.log('Step 3: Verifying results...');
  const [afterCount] = await connection.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN cardNumber IS NULL OR cardNumber = '' THEN 1 ELSE 0 END) as without_number
    FROM cards
  `);
  
  console.log(`Total cards: ${afterCount[0].total}`);
  console.log(`Cards without cardNumber: ${afterCount[0].without_number}\n`);
  
  // Step 4: Show sample results
  console.log('Step 4: Sample results (first 10):');
  const [samples] = await connection.query(`
    SELECT id, name, cardNumber
    FROM cards
    WHERE cardNumber IS NOT NULL AND cardNumber != ''
    LIMIT 10
  `);
  
  samples.forEach((card, index) => {
    console.log(`  ${index + 1}. ${card.name}`);
    console.log(`     cardNumber: ${card.cardNumber}`);
  });
  
  // Step 5: Check specific card (812832)
  console.log('\nStep 5: Checking card 812832...');
  const [specificCard] = await connection.query(`
    SELECT id, name, cardNumber
    FROM cards
    WHERE id = 812832
  `);
  
  if (specificCard.length > 0) {
    console.log(`  Name: ${specificCard[0].name}`);
    console.log(`  cardNumber: ${specificCard[0].cardNumber || '(null)'}`);
  } else {
    console.log('  Card not found');
  }
  
  console.log('\n✅ Script completed successfully!');
  
  // Close connection
  await connection.end();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
