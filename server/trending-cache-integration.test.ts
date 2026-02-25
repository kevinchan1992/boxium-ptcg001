import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { calculateAndCacheTrendingRankings, getTrendingCacheStatus } from "./trendingCacheManager";

describe("Trending Cache Integration Test", () => {
  let publicCaller: any;
  let adminCaller: any;

  beforeAll(async () => {
    // Ensure database is available
    const db = await getDb();
    expect(db).toBeDefined();
    
    // Create public tRPC caller
    publicCaller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });
    
    // Create admin tRPC caller
    adminCaller = appRouter.createCaller({
      user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "test-admin" },
      req: {} as any,
      res: {} as any,
    });
  });

  it("should complete full cache workflow", async () => {
    console.log("\n=== Testing Full Cache Workflow ===\n");
    
    // Step 1: Check initial cache status
    console.log("Step 1: Checking initial cache status...");
    const initialStatus = await adminCaller.admin.getTrendingCacheStatus();
    console.log(`Initial cache entries: ${initialStatus.length}`);
    
    // Step 2: Manually refresh cache
    console.log("\nStep 2: Manually refreshing cache...");
    const refreshStartTime = Date.now();
    const refreshResult = await adminCaller.admin.refreshTrendingCache();
    const refreshDuration = Date.now() - refreshStartTime;
    
    expect(refreshResult.success).toBe(true);
    console.log(`Cache refresh completed in ${refreshResult.duration}ms (wall time: ${refreshDuration}ms)`);
    console.log(`- Price Increase: ${refreshResult.priceIncreaseCount} cards`);
    console.log(`- Price Decrease: ${refreshResult.priceDecreaseCount} cards`);
    console.log(`- Search Popularity: ${refreshResult.searchPopularityCount} cards`);
    
    // Step 3: Verify cache status after refresh
    console.log("\nStep 3: Verifying cache status after refresh...");
    const updatedStatus = await adminCaller.admin.getTrendingCacheStatus();
    expect(updatedStatus.length).toBeGreaterThanOrEqual(3); // Should have 3 cache entries
    
    for (const cache of updatedStatus) {
      console.log(`- ${cache.rankingType}: ${cache.itemCount} items, expires at ${cache.expiresAt.toISOString()}, expired: ${cache.isExpired}`);
      expect(cache.itemCount).toBeGreaterThan(0);
    }
    
    // Step 4: Test API endpoints with cache
    console.log("\nStep 4: Testing API endpoints with cache...");
    
    const priceIncreaseStartTime = Date.now();
    const priceIncreaseData = await publicCaller.trending.getByPriceIncrease({ days: 30, limit: 10 });
    const priceIncreaseDuration = Date.now() - priceIncreaseStartTime;
    console.log(`Price Increase API: ${priceIncreaseData.length} cards in ${priceIncreaseDuration}ms`);
    expect(priceIncreaseDuration).toBeLessThan(1000); // Should be fast with cache
    
    const priceDecreaseStartTime = Date.now();
    const priceDecreaseData = await publicCaller.trending.getByPriceDecrease({ days: 30, limit: 10 });
    const priceDecreaseDuration = Date.now() - priceDecreaseStartTime;
    console.log(`Price Decrease API: ${priceDecreaseData.length} cards in ${priceDecreaseDuration}ms`);
    expect(priceDecreaseDuration).toBeLessThan(1000);
    
    const searchPopularityStartTime = Date.now();
    const searchPopularityData = await publicCaller.trending.getBySearches({ days: 30, limit: 10 });
    const searchPopularityDuration = Date.now() - searchPopularityStartTime;
    console.log(`Search Popularity API: ${searchPopularityData.length} cards in ${searchPopularityDuration}ms`);
    expect(searchPopularityDuration).toBeLessThan(1000);
    
    // Step 5: Test non-cached query (7 days)
    console.log("\nStep 5: Testing non-cached query (7 days)...");
    const nonCachedStartTime = Date.now();
    const nonCachedData = await publicCaller.trending.getByPriceIncrease({ days: 7, limit: 10 });
    const nonCachedDuration = Date.now() - nonCachedStartTime;
    console.log(`Non-cached query: ${nonCachedData.length} cards in ${nonCachedDuration}ms`);
    // Non-cached query should be slower but still reasonable with indexes
    
    console.log("\n=== Cache Workflow Test Completed Successfully ===\n");
  }, 120000); // 2 minute timeout

  it("should demonstrate performance improvement with cache", async () => {
    console.log("\n=== Performance Comparison Test ===\n");
    
    // Ensure cache exists
    await calculateAndCacheTrendingRankings();
    
    // Test 1: Cached query (30 days)
    const cachedStartTime = Date.now();
    const cachedData = await publicCaller.trending.getByPriceIncrease({ days: 30, limit: 10 });
    const cachedDuration = Date.now() - cachedStartTime;
    
    // Test 2: Non-cached query (7 days)
    const nonCachedStartTime = Date.now();
    const nonCachedData = await publicCaller.trending.getByPriceIncrease({ days: 7, limit: 10 });
    const nonCachedDuration = Date.now() - nonCachedStartTime;
    
    console.log(`Cached query (30 days): ${cachedDuration}ms`);
    console.log(`Non-cached query (7 days): ${nonCachedDuration}ms`);
    
    // Cached query should be significantly faster
    expect(cachedDuration).toBeLessThan(nonCachedDuration);
    
    const speedup = (nonCachedDuration / cachedDuration).toFixed(2);
    console.log(`Performance improvement: ${speedup}x faster with cache`);
    
    console.log("\n=== Performance Test Completed ===\n");
  }, 60000);
});
