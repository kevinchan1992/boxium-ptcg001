import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { calculateAndCacheTrendingRankings } from "./trendingCacheManager";

describe("Trending API with Cache", () => {
  let caller: any;

  beforeAll(async () => {
    // Ensure database is available
    const db = await getDb();
    expect(db).toBeDefined();
    
    // Pre-populate cache
    await calculateAndCacheTrendingRankings();
    
    // Create tRPC caller
    caller = appRouter.createCaller({
      user: null,
      req: {} as any,
      res: {} as any,
    });
  });

  it("should retrieve trending by searches from cache", async () => {
    const result = await caller.trending.getBySearches({ days: 30 });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
    
    // If there are results, verify structure
    if (result.length > 0) {
      const firstCard = result[0];
      expect(firstCard).toHaveProperty("id");
      expect(firstCard).toHaveProperty("name");
    }
  });

  it("should retrieve trending by price increase from cache", async () => {
    const result = await caller.trending.getByPriceIncrease({ days: 30 });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
    
    if (result.length > 0) {
      const firstCard = result[0];
      expect(firstCard).toHaveProperty("id");
      expect(firstCard).toHaveProperty("name");
      // Price change data structure varies by ranking type
    }
  });

  it("should retrieve trending by price decrease from cache", async () => {
    const result = await caller.trending.getByPriceDecrease({ days: 30 });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
    
    if (result.length > 0) {
      const firstCard = result[0];
      expect(firstCard).toHaveProperty("id");
      expect(firstCard).toHaveProperty("name");
      // Price change data structure varies by ranking type
    }
  });

  it("should respect limit parameter", async () => {
    const limit = 5;
    const result = await caller.trending.getByPriceIncrease({ days: 30, limit });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(limit);
  });

  it("should fall back to real-time calculation for non-30-day queries", async () => {
    // This should not use cache (7 days instead of 30)
    const result = await caller.trending.getByPriceIncrease({ days: 7 });
    
    expect(Array.isArray(result)).toBe(true);
    // No need to verify cache miss, just ensure it returns valid data
  });
});

describe("Admin Trending Cache Management", () => {
  let adminCaller: any;

  beforeAll(() => {
    // Create admin tRPC caller
    adminCaller = appRouter.createCaller({
      user: { id: 1, role: "admin", name: "Admin", email: "admin@test.com", openId: "test-admin" },
      req: {} as any,
      res: {} as any,
    });
  });

  it("should get trending cache status", async () => {
    const status = await adminCaller.admin.getTrendingCacheStatus();
    
    expect(Array.isArray(status)).toBe(true);
    
    if (status.length > 0) {
      const firstStatus = status[0];
      expect(firstStatus).toHaveProperty("rankingType");
      expect(firstStatus).toHaveProperty("timeRange");
      expect(firstStatus).toHaveProperty("calculatedAt");
      expect(firstStatus).toHaveProperty("expiresAt");
      expect(firstStatus).toHaveProperty("isExpired");
      expect(firstStatus).toHaveProperty("itemCount");
    }
  });

  it("should manually refresh trending cache", async () => {
    const result = await adminCaller.admin.refreshTrendingCache();
    
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("duration");
    expect(result.duration).toBeGreaterThan(0);
  }, 60000); // 60 second timeout
});
