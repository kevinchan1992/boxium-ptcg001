import { getDb } from "./db";
import * as db from "./db";
import { trendingRankingsCache } from "../drizzle/schema_new";
import { eq, and } from "drizzle-orm";

/**
 * Trending Rankings Cache Manager
 * Manages cached trending rankings to reduce database query pressure
 */

export type RankingType = "price_increase" | "price_decrease" | "search_popularity";

/**
 * Calculate and cache all trending rankings
 * This function should be called daily at 07:00 HKT
 */
export async function calculateAndCacheTrendingRankings() {
  console.log("[TrendingCache] Starting trending rankings calculation...");
  
  const startTime = Date.now();
  const timeRange = 30; // 30 days
  const limit = 10; // Top 10 cards
  
  try {
    // Calculate all three types of rankings
    const priceIncreaseData = await db.getTrendingByPriceIncrease({ limit, days: timeRange });
    const priceDecreaseData = await db.getTrendingByPriceDecrease({ limit, days: timeRange });
    const searchPopularityData = await db.getTrendingBySearches({ limit, days: timeRange });
    
    // Save to cache
    await saveTrendingCache("price_increase", timeRange, priceIncreaseData);
    await saveTrendingCache("price_decrease", timeRange, priceDecreaseData);
    await saveTrendingCache("search_popularity", timeRange, searchPopularityData);
    
    const duration = Date.now() - startTime;
    console.log(`[TrendingCache] Trending rankings calculation completed in ${duration}ms`);
    
    return {
      success: true,
      duration,
      priceIncreaseCount: priceIncreaseData.length,
      priceDecreaseCount: priceDecreaseData.length,
      searchPopularityCount: searchPopularityData.length,
    };
  } catch (error) {
    console.error("[TrendingCache] Failed to calculate trending rankings:", error);
    throw error;
  }
}

/**
 * Save trending ranking data to cache
 */
async function saveTrendingCache(
  rankingType: RankingType,
  timeRange: number,
  data: any[]
) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Expires in 24 hours
  
  // Delete old cache for this ranking type and time range
  await database
    .delete(trendingRankingsCache)
    .where(
      and(
        eq(trendingRankingsCache.rankingType, rankingType),
        eq(trendingRankingsCache.timeRange, timeRange)
      )
    );
  
  // Insert new cache
  await database.insert(trendingRankingsCache).values({
    rankingType,
    timeRange,
    rankingData: JSON.stringify(data),
    calculatedAt: now,
    expiresAt,
  });
  
  console.log(`[TrendingCache] Saved ${rankingType} cache (${data.length} items)`);
}

/**
 * Get trending ranking data from cache
 * Returns null if cache is expired or not found
 */
export async function getTrendingFromCache(
  rankingType: RankingType,
  timeRange: number
): Promise<any[] | null> {
  const database = await getDb();
  if (!database) return null;
  
  try {
    const cacheRecords = await database
      .select()
      .from(trendingRankingsCache)
      .where(
        and(
          eq(trendingRankingsCache.rankingType, rankingType),
          eq(trendingRankingsCache.timeRange, timeRange)
        )
      )
      .limit(1);
    
    if (cacheRecords.length === 0) {
      console.log(`[TrendingCache] No cache found for ${rankingType}`);
      return null;
    }
    
    const cache = cacheRecords[0];
    
    // Check if cache is expired
    if (new Date() > cache.expiresAt) {
      console.log(`[TrendingCache] Cache expired for ${rankingType}`);
      return null;
    }
    
    // Parse and return cached data
    const data = JSON.parse(cache.rankingData);
    console.log(`[TrendingCache] Retrieved ${rankingType} from cache (${data.length} items)`);
    // Normalize numeric fields to ensure consistent number types (MySQL decimal returns strings)
    const normalized = data.map((item: any) => ({
      ...item,
      oldPrice: item.oldPrice != null ? parseFloat(item.oldPrice) : null,
      currentPrice: item.currentPrice != null ? parseFloat(item.currentPrice) : null,
      priceChange: item.priceChange != null ? parseFloat(item.priceChange) : null,
      priceChangePercent: item.priceChangePercent != null ? parseFloat(item.priceChangePercent) : null,
      priceChange7d: item.priceChange7d != null ? parseFloat(item.priceChange7d) : null,
    }));
    return normalized;
  } catch (error) {
    console.error(`[TrendingCache] Failed to get cache for ${rankingType}:`, error);
    return null;
  }
}

/**
 * Get cache status for all ranking types
 */
export async function getTrendingCacheStatus() {
  const database = await getDb();
  if (!database) return null;
  
  try {
    const allCaches = await database
      .select()
      .from(trendingRankingsCache)
      .orderBy(trendingRankingsCache.calculatedAt);
    
    return allCaches.map((cache: typeof allCaches[0]) => ({
      rankingType: cache.rankingType,
      timeRange: cache.timeRange,
      calculatedAt: cache.calculatedAt,
      expiresAt: cache.expiresAt,
      isExpired: new Date() > cache.expiresAt,
      itemCount: JSON.parse(cache.rankingData).length,
    }));
  } catch (error) {
    console.error("[TrendingCache] Failed to get cache status:", error);
    return null;
  }
}

/**
 * Manually refresh trending cache (for admin use)
 */
export async function manualRefreshTrendingCache() {
  console.log("[TrendingCache] Manual refresh triggered");
  return await calculateAndCacheTrendingRankings();
}
