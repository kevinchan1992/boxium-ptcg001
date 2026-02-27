/**
 * Cache Warmer Service
 * Pre-loads hot card data into cache to reduce user wait time
 */

import { getDb } from "../db";
import { dataSources } from "../../drizzle/schema_new";
import { desc, eq } from "drizzle-orm";

export interface CacheWarmingResult {
  totalCards: number;
  successCount: number;
  failureCount: number;
  duration: number;
  errors: string[];
}

/**
 * Warm cache by pre-loading hot card data
 * @param cardLimit - Number of hot cards to warm (default: 20)
 * @returns Warming result with statistics
 */
export async function warmCache(cardLimit: number = 20): Promise<CacheWarmingResult> {
  const startTime = Date.now();
  console.log(`[Cache Warmer] Starting cache warming for top ${cardLimit} cards...`);
  
  const result: CacheWarmingResult = {
    totalCards: 0,
    successCount: 0,
    failureCount: 0,
    duration: 0,
    errors: []
  };
  
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Get hot cards from data sources (most recently updated)
    const hotDataSources = await db
      .select({
        id: dataSources.id,
        cardId: dataSources.cardId,
        source: dataSources.source,
        sourceIdentifier: dataSources.sourceIdentifier,
        sourceUrl: dataSources.sourceUrl
      })
      .from(dataSources)
      .where(eq(dataSources.source, 'snkrdunk'))
      .orderBy(desc(dataSources.lastUpdatedAt))
      .limit(cardLimit);
    
    result.totalCards = hotDataSources.length;
    console.log(`[Cache Warmer] Found ${hotDataSources.length} data sources to warm`);
    
    // Import scraper to trigger cache population
    const { scrapeSnkrdunkListings } = await import("./snkrdunkScraperService");
    
    // Warm cache for each data source (sequential to avoid overwhelming the system)
    for (const dataSource of hotDataSources) {
      try {
        const snkrdunkId = dataSource.sourceIdentifier;
        if (!snkrdunkId) {
          console.log(`[Cache Warmer] Skipping data source ${dataSource.id} - no SNKRDUNK ID`);
          continue;
        }
        
        console.log(`[Cache Warmer] Warming cache for SNKRDUNK ID: ${snkrdunkId}`);
        
        // Scrape SNKRDUNK data (this will populate the cache)
        await scrapeSnkrdunkListings(snkrdunkId);
        
        result.successCount++;
        console.log(`[Cache Warmer] ✓ Successfully warmed cache for SNKRDUNK ID ${snkrdunkId}`);
      } catch (error: any) {
        result.failureCount++;
        const errorMsg = `Failed to warm cache for data source ${dataSource.id}: ${error.message}`;
        result.errors.push(errorMsg);
        console.error(`[Cache Warmer] ✗ ${errorMsg}`);
      }
      
      // Add a small delay between requests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    result.duration = Date.now() - startTime;
    console.log(`[Cache Warmer] Completed in ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`[Cache Warmer] Success: ${result.successCount}/${result.totalCards}, Failures: ${result.failureCount}`);
    
    return result;
  } catch (error: any) {
    result.duration = Date.now() - startTime;
    result.errors.push(`Cache warming failed: ${error.message}`);
    console.error(`[Cache Warmer] Fatal error:`, error);
    return result;
  }
}

/**
 * Schedule automatic cache warming on server startup
 */
export async function scheduleAutoWarming() {
  console.log(`[Cache Warmer] Scheduling automatic cache warming...`);
  
  // Wait 10 seconds after server start to allow system to stabilize
  setTimeout(async () => {
    try {
      console.log(`[Cache Warmer] Starting automatic cache warming...`);
      const result = await warmCache(20);
      console.log(`[Cache Warmer] Automatic warming completed:`, result);
    } catch (error) {
      console.error(`[Cache Warmer] Automatic warming failed:`, error);
    }
  }, 10000);
}
