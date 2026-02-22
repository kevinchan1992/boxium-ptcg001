import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, cards, watchlist } from "../drizzle/schema_new";
import { eq, and } from "drizzle-orm";
import { addToWatchlist, removeFromWatchlistByCardId, isCardInWatchlist } from "./profile";

describe("Remove Watchlist Feature Tests", () => {
  let testUserId: number;
  let testCardId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 創建測試用戶
    const [user] = await db
      .insert(users)
      .values({
        email: "remove-watchlist-test@example.com",
        name: "Remove Watchlist Test User",
        passwordHash: "test-hash",
        loginMethod: "password",
        role: "user",
        emailVerified: true,
      })
      .$returningId();
    testUserId = user.id;

    // 創建測試卡牌
    const [card] = await db
      .insert(cards)
      .values({
        cardId: "test-remove-watchlist-card-001",
        name: "Test Card for Remove Watchlist",
        cardNumber: "001",
        rarity: "Common",
        imageUrl: "https://example.com/test.jpg",
      })
      .$returningId();
    testCardId = card.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    
    // 清理測試數據
    if (testUserId) {
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testCardId) {
      await db.delete(cards).where(eq(cards.id, testCardId));
    }
  });

  describe("removeFromWatchlistByCardId", () => {
    it("應該成功移除收藏", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 先添加收藏
      await addToWatchlist(testUserId, testCardId);

      // 驗證已添加
      const isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isInWatchlist).toBe(true);

      // 移除收藏
      await removeFromWatchlistByCardId(testUserId, testCardId);

      // 驗證已移除
      const isStillInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isStillInWatchlist).toBe(false);
    });

    it("應該允許重複移除（不會報錯）", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 確保收藏列表為空
      await db.delete(watchlist).where(and(eq(watchlist.userId, testUserId), eq(watchlist.cardId, testCardId)));

      // 移除不存在的收藏（應該不報錯）
      await expect(removeFromWatchlistByCardId(testUserId, testCardId)).resolves.not.toThrow();
    });

    it("應該只移除指定用戶的收藏", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 創建第二個測試用戶
      const [user2] = await db
        .insert(users)
        .values({
          email: "remove-watchlist-test-2@example.com",
          name: "Remove Watchlist Test User 2",
          passwordHash: "test-hash",
          loginMethod: "password",
          role: "user",
          emailVerified: true,
        })
        .$returningId();
      const testUserId2 = user2.id;

      try {
        // 兩個用戶都添加收藏
        await addToWatchlist(testUserId, testCardId);
        await addToWatchlist(testUserId2, testCardId);

        // 移除第一個用戶的收藏
        await removeFromWatchlistByCardId(testUserId, testCardId);

        // 驗證第一個用戶的收藏已移除
        const isInWatchlist1 = await isCardInWatchlist(testUserId, testCardId);
        expect(isInWatchlist1).toBe(false);

        // 驗證第二個用戶的收藏仍存在
        const isInWatchlist2 = await isCardInWatchlist(testUserId2, testCardId);
        expect(isInWatchlist2).toBe(true);
      } finally {
        // 清理第二個用戶
        await db.delete(watchlist).where(eq(watchlist.userId, testUserId2));
        await db.delete(users).where(eq(users.id, testUserId2));
      }
    });
  });

  describe("Watchlist Toggle Workflow", () => {
    it("應該支持添加和移除的完整流程", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有收藏
      await db.delete(watchlist).where(and(eq(watchlist.userId, testUserId), eq(watchlist.cardId, testCardId)));

      // 1. 初始狀態：未收藏
      let isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isInWatchlist).toBe(false);

      // 2. 添加收藏
      await addToWatchlist(testUserId, testCardId);
      isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isInWatchlist).toBe(true);

      // 3. 移除收藏
      await removeFromWatchlistByCardId(testUserId, testCardId);
      isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isInWatchlist).toBe(false);

      // 4. 再次添加收藏
      await addToWatchlist(testUserId, testCardId);
      isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(isInWatchlist).toBe(true);
    });
  });
});
