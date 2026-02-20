/**
 * Fix Orphan Data Sources
 * This script finds data sources without corresponding card records and creates them
 */

import * as db from "./db";
import { scrapeSnkrdunkPage, extractSnkrdunkId, convertJpyToHkd } from "./snkrdunkScraper";

export async function fixOrphanDataSources() {
  console.log("🔍 Starting orphan data source fix...");
  
  // Get all data sources
  const allDataSourcesResult = await db.getDataSources();
  const allDataSources = allDataSourcesResult.data;
  console.log(`📊 Total data sources: ${allDataSources.length}`);
  
  // Find orphan data sources (those without cardId or with invalid cardId)
  const orphanDataSources = allDataSources.filter((ds: any) => !ds.cardId);
  console.log(`🚨 Found ${orphanDataSources.length} orphan data sources (no cardId)`);
  
  if (orphanDataSources.length === 0) {
    console.log("✅ No orphan data sources found!");
    return { success: true, fixed: 0, failed: 0 };
  }
  
  let fixedCount = 0;
  let failedCount = 0;
  const failedUrls: string[] = [];
  
  for (const dataSource of orphanDataSources) {
    try {
      console.log(`\n🔧 Processing: ${dataSource.sourceUrl}`);
      
      // Extract SNKRDUNK ID
      const snkrdunkId = extractSnkrdunkId(dataSource.sourceUrl);
      if (!snkrdunkId) {
        console.log(`❌ Invalid URL format: ${dataSource.sourceUrl}`);
        failedCount++;
        failedUrls.push(dataSource.sourceUrl);
        continue;
      }
      
      // Scrape card data
      console.log(`📥 Scraping card data...`);
      const cardData = await scrapeSnkrdunkPage(dataSource.sourceUrl);
      
      // Check if card already exists
      const existingCard = await db.getCardByCardId(`snkrdunk-${snkrdunkId}`);
      let cardId: number;
      
      if (existingCard) {
        console.log(`📝 Card already exists, updating...`);
        cardId = existingCard.id;
        await db.updateCard(cardId, {
          name: cardData.name,
          nameJa: cardData.nameJa,
          imageUrl: cardData.imageUrl || undefined,
        });
      } else {
        console.log(`✨ Creating new card...`);
        cardId = await db.createCard({
          cardId: `snkrdunk-${snkrdunkId}`,
          name: cardData.name,
          nameJa: cardData.nameJa,
          imageUrl: cardData.imageUrl || undefined,
        });
      }
      
      // Update data source with cardId
      console.log(`🔗 Linking data source to card...`);
      await db.updateDataSourceCardId(dataSource.id, cardId);
      
      // Save price history
      console.log(`💰 Saving ${cardData.priceHistory.length} price records...`);
      for (const priceEntry of cardData.priceHistory) {
        const priceHkd = convertJpyToHkd(priceEntry.price);
        await db.addPriceHistory({
          cardId,
          source: "snkrdunk",
          price: priceHkd.toString(),
          currency: "HKD",
          grade: priceEntry.grade,
          soldAt: priceEntry.soldAt,
          listingUrl: dataSource.sourceUrl,
        });
      }
      
      // Update status to success
      await db.updateDataSourceFetchStatus(dataSource.id, "success");
      
      console.log(`✅ Fixed: ${dataSource.sourceUrl}`);
      fixedCount++;
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.error(`❌ Failed to fix ${dataSource.sourceUrl}:`, error.message);
      await db.updateDataSourceFetchStatus(dataSource.id, "failed", error.message);
      failedCount++;
      failedUrls.push(dataSource.sourceUrl);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log(`📊 Fix Summary:`);
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log("=".repeat(60));
  
  if (failedUrls.length > 0) {
    console.log("\n❌ Failed URLs:");
    failedUrls.forEach(url => console.log(`   - ${url}`));
  }
  
  return {
    success: true,
    fixed: fixedCount,
    failed: failedCount,
    failedUrls,
  };
}

// Run if called directly
if (require.main === module) {
  fixOrphanDataSources()
    .then(result => {
      console.log("\n✅ Script completed!");
      process.exit(0);
    })
    .catch(error => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}
