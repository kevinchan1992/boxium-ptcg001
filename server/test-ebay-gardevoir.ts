/**
 * Test eBay API for Gardevoir CHR card
 */

import * as db from './db';
import { fetchEbayListings } from './services/ebay';

async function testEbayForGardevoir() {
  try {
    console.log('=== Testing eBay API for Gardevoir CHR ===\n');
    
    // Step 1: Get card info from database
    const card = await db.getCardById(13809);
    
    if (!card) {
      console.error('❌ Card 13809 not found in database');
      return;
    }
    
    console.log('✅ Card found:');
    console.log(`   ID: ${card.id}`);
    console.log(`   Name: ${card.name}`);
    console.log(`   Card Number: ${card.cardNumber || 'N/A'}`);
    console.log('');
    
    // Step 2: Test eBay API call
    const searchQuery = `${card.name} ${card.cardNumber || ''} PSA10`.trim();
    console.log(`🔍 Searching eBay with query: "${searchQuery}"`);
    console.log('');
    
    const listings = await fetchEbayListings({ cardName: searchQuery });
    
    console.log(`✅ eBay API returned ${listings.length} listings`);
    
    if (listings.length > 0) {
      console.log('\n📦 Sample listings:');
      listings.slice(0, 3).forEach((listing, index) => {
        console.log(`\n   ${index + 1}. ${listing.title}`);
        console.log(`      Price: ${listing.currency} ${listing.price}`);
        console.log(`      URL: ${listing.productUrl}`);
      });
    } else {
      console.log('\n⚠️  No eBay listings found');
      console.log('   Possible reasons:');
      console.log('   1. Card name/number format not matching eBay listings');
      console.log('   2. No PSA 10 listings available on eBay');
      console.log('   3. eBay API search query needs optimization');
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testEbayForGardevoir();
