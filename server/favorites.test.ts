import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

/**
 * Favorites API 測試
 * 
 * 測試收藏功能的所有 API
 */

// 創建 mock context
function createMockContext(user?: any): TrpcContext {
  return {
    user: user || null,
    req: {} as any,
    res: {} as any,
  };
}

// 測試用戶
const mockUser = {
  id: 1,
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// 測試卡牌 ID
const testCardId = 1;

describe("Favorites API", () => {
  describe("favorites.add", () => {
    it("should require authentication", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.favorites.add({ cardId: testCardId })
      ).rejects.toThrow();
    });

    it("should add card to favorites when authenticated", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.favorites.add({ cardId: testCardId });
      
      expect(result.success).toBe(true);
    });

    it("should handle duplicate favorites gracefully", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // Add first time
      await caller.favorites.add({ cardId: testCardId });
      
      // Add second time (should not throw error)
      const result = await caller.favorites.add({ cardId: testCardId });
      expect(result.success).toBe(true);
    });
  });

  describe("favorites.remove", () => {
    it("should require authentication", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.favorites.remove({ cardId: testCardId })
      ).rejects.toThrow();
    });

    it("should remove card from favorites when authenticated", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // Add first
      await caller.favorites.add({ cardId: testCardId });
      
      // Then remove
      const result = await caller.favorites.remove({ cardId: testCardId });
      
      expect(result.success).toBe(true);
    });
  });

  describe("favorites.isFavorited", () => {
    it("should require authentication", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.favorites.isFavorited({ cardId: testCardId })
      ).rejects.toThrow();
    });

    it("should return false when card is not favorited", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // Remove if exists
      await caller.favorites.remove({ cardId: testCardId });
      
      const result = await caller.favorites.isFavorited({ cardId: testCardId });
      
      expect(result.isFavorited).toBe(false);
    });

    it("should return true when card is favorited", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // Add favorite
      await caller.favorites.add({ cardId: testCardId });
      
      const result = await caller.favorites.isFavorited({ cardId: testCardId });
      
      expect(result.isFavorited).toBe(true);
    });
  });

  describe("favorites.list", () => {
    it("should require authentication", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.favorites.list()
      ).rejects.toThrow();
    });

    it("should return user's favorites when authenticated", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // Add a favorite
      await caller.favorites.add({ cardId: testCardId });
      
      const result = await caller.favorites.list();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check structure
      const favorite = result[0];
      expect(favorite).toHaveProperty("id");
      expect(favorite).toHaveProperty("cardId");
      expect(favorite).toHaveProperty("createdAt");
      expect(favorite).toHaveProperty("card");
    });

    it("should return empty array when user has no favorites", async () => {
      const ctx = createMockContext({
        ...mockUser,
        id: 999999, // Non-existent user
      });
      const caller = appRouter.createCaller(ctx);

      const result = await caller.favorites.list();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("Favorites workflow", () => {
    it("should handle complete add-check-remove workflow", async () => {
      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // 1. Check initial state (should be false)
      const initialCheck = await caller.favorites.isFavorited({ cardId: testCardId });
      
      // 2. Add to favorites
      const addResult = await caller.favorites.add({ cardId: testCardId });
      expect(addResult.success).toBe(true);
      
      // 3. Check again (should be true)
      const afterAddCheck = await caller.favorites.isFavorited({ cardId: testCardId });
      expect(afterAddCheck.isFavorited).toBe(true);
      
      // 4. Verify in list
      const list = await caller.favorites.list();
      const found = list.some(f => f.cardId === testCardId);
      expect(found).toBe(true);
      
      // 5. Remove from favorites
      const removeResult = await caller.favorites.remove({ cardId: testCardId });
      expect(removeResult.success).toBe(true);
      
      // 6. Check final state (should be false)
      const finalCheck = await caller.favorites.isFavorited({ cardId: testCardId });
      expect(finalCheck.isFavorited).toBe(false);
    });
  });
});
