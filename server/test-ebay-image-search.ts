/**
 * Test eBay Image Search for Pricing Page
 */

import * as db from './db';
import { searchEbayByImage } from './ebayImageSearch';
import { downloadAndEncodeImage, getBestImageUrl } from './imageUtils';
import { convertUsdToHkd } from './ebay';

async function testEbayImageSearch() {
  try {
    console.log('=== Testing eBay Image Search for Pricing Page ===\n');
    
    // Step 1: Get a card with image from database
    const card = await db.getCardById(1); // Use a known card ID
    
    if (!card) {
      console.error('❌ Card not found in database');
      return;
    }
    console.log('✅ Testing with card:');
    console.log(`   ID: ${card.id}`);
    console.log(`   Name: ${card.name}`);
    console.log(`   Image URL: ${card.imageUrl || 'N/A'}`);
    console.log('');
    
    // Step 2: Get best image URL
    const imageUrl = getBestImageUrl(card);
    if (!imageUrl) {
      console.error('❌ No image URL available for this card');
      return;
    }
    
    console.log(`🖼️  Using image URL: ${imageUrl}`);
    console.log('');
    
    // Step 3: Download and encode image
    console.log('📥 Downloading and encoding image...');
    const base64Image = await downloadAndEncodeImage(imageUrl);
    console.log(`✅ Image encoded (${base64Image.length} characters)`);
    console.log('');
    
    // Step 4: Search eBay by image
    console.log('🔍 Searching eBay by image...');
    const searchResponse = await searchEbayByImage(
      base64Image,
      '183454', // Pokemon TCG category
      10 // Limit
    );
    
    console.log(`✅ eBay returned ${searchResponse.total || 0} total results`);
    console.log(`   Found ${searchResponse.itemSummaries?.length || 0} item summaries`);
    console.log('');
    
    if (searchResponse.itemSummaries && searchResponse.itemSummaries.length > 0) {
      console.log('📦 Sample listings:');
      
      for (let i = 0; i < Math.min(3, searchResponse.itemSummaries.length); i++) {
        const item = searchResponse.itemSummaries[i];
        const usdPrice = parseFloat(item.price.value);
        const hkdPrice = await convertUsdToHkd(usdPrice);
        
        console.log(`\n   ${i + 1}. ${item.title}`);
        console.log(`      Item ID: ${item.itemId}`);
        console.log(`      Price: ${item.price.currency} ${usdPrice} → HKD ${hkdPrice.toFixed(2)}`);
        console.log(`      URL: ${item.itemWebUrl}`);
        console.log(`      Image: ${item.image?.imageUrl || 'N/A'}`);
      }
      
      console.log('\n✅ eBay image search is working correctly!');
    } else {
      console.log('⚠️  No eBay listings found');
      console.log('   This might be normal if:');
      console.log('   1. The card image is not recognized by eBay');
      console.log('   2. No similar items are currently listed on eBay');
      console.log('   3. The Pokemon TCG category filter is too restrictive');
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testEbayImageSearch();
