import { describe, it, expect, beforeAll } from "vitest";
import {
  calculateAndCacheTrendingRankings,
  getTrendingFromCache,
  getTrendingCacheStatus,
  manualRefreshTrendingCache,
  type RankingType,
} from "./trendingCacheManager";
import { getDb } from "./db";
import { trendingRankingsCache } from "../drizzle/schema_new";

describe("Trending Rankings Cache Manager", () => {
  beforeAll(async () => {
    // Ensure database is available
    const db = await getDb();
    expect(db).toBeDefined();
    
    // Clean up any existing cache data
    if (db) {
      await db.delete(trendingRankingsCache);
    }
  });

  it("should calculate and cache all trending rankings", async () => {
    const result = await calculateAndCacheTrendingRankings();
    
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.priceIncreaseCount).toBeGreaterThanOrEqual(0);
    expect(result.priceDecreaseCount).toBeGreaterThanOrEqual(0);
    expect(result.searchPopularityCount).toBeGreaterThanOrEqual(0);
  }, 60000); // 60 second timeout for calculation

  it("should retrieve cached trending data", async () => {
    // First, ensure cache exists
    await calculateAndCacheTrendingRankings();
    
    // Retrieve from cache
    const priceIncreaseData = await getTrendingFromCache("price_increase", 30);
    const priceDecreaseData = await getTrendingFromCache("price_decrease", 30);
    const searchPopularityData = await getTrendingFromCache("search_popularity", 30);
    
    expect(priceIncreaseData).not.toBeNull();
    expect(priceDecreaseData).not.toBeNull();
    expect(searchPopularityData).not.toBeNull();
    
    if (priceIncreaseData) {
      expect(Array.isArray(priceIncreaseData)).toBe(true);
    }
  }, 60000);

  it("should return null for expired cache", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // Insert an expired cache entry
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() - 25); // 25 hours ago
    
    await db.insert(trendingRankingsCache).values({
      rankingType: "price_increase",
      timeRange: 7, // Different time range to avoid conflict
      rankingData: JSON.stringify([{ test: "data" }]),
      calculatedAt: expiredDate,
      expiresAt: expiredDate,
    });
    
    // Try to retrieve expired cache
    const cachedData = await getTrendingFromCache("price_increase", 7);
    expect(cachedData).toBeNull();
  });

  it("should get cache status for all ranking types", async () => {
    // Ensure cache exists
    await calculateAndCacheTrendingRankings();
    
    const status = await getTrendingCacheStatus();
    expect(status).not.toBeNull();
    
    if (status) {
      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
      
      // Check structure of first status item
      const firstStatus = status[0];
      expect(firstStatus).toHaveProperty("rankingType");
      expect(firstStatus).toHaveProperty("timeRange");
      expect(firstStatus).toHaveProperty("calculatedAt");
      expect(firstStatus).toHaveProperty("expiresAt");
      expect(firstStatus).toHaveProperty("isExpired");
      expect(firstStatus).toHaveProperty("itemCount");
    }
  }, 60000);

  it("should manually refresh trending cache", async () => {
    const result = await manualRefreshTrendingCache();
    
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
  }, 60000);
});
