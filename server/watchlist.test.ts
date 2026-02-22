import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, cards, watchlist } from "../drizzle/schema_new";
import { eq, and } from "drizzle-orm";
import { isCardInWatchlist, addToWatchlist } from "./profile";

describe("Watchlist Feature Tests", () => {
  let testUserId: number;
  let testCardId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 創建測試用戶
    const [user] = await db
      .insert(users)
      .values({
        email: "watchlist-test@example.com",
        name: "Watchlist Test User",
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
        cardId: "test-watchlist-card-001",
        name: "Test Card for Watchlist",
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

  describe("isCardInWatchlist", () => {
    it("應該返回 false 當卡牌不在收藏列表中", async () => {
      const result = await isCardInWatchlist(testUserId, testCardId);
      expect(result).toBe(false);
    });

    it("應該返回 true 當卡牌在收藏列表中", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 添加到收藏
      await db.insert(watchlist).values({
        userId: testUserId,
        cardId: testCardId,
      });

      const result = await isCardInWatchlist(testUserId, testCardId);
      expect(result).toBe(true);

      // 清理
      await db.delete(watchlist).where(
        and(eq(watchlist.userId, testUserId), eq(watchlist.cardId, testCardId))
      );
    });
  });

  describe("addToWatchlist", () => {
    it("應該成功添加卡牌到收藏", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));

      // 添加到收藏
      await addToWatchlist(testUserId, testCardId);

      // 驗證已添加
      const result = await isCardInWatchlist(testUserId, testCardId);
      expect(result).toBe(true);
    });

    it("應該拋出錯誤當卡牌已在收藏列表中", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));

      // 第一次添加
      await addToWatchlist(testUserId, testCardId);

      // 第二次添加應該拋出錯誤
      await expect(
        addToWatchlist(testUserId, testCardId)
      ).rejects.toThrow("Card already in watchlist");
    });

    it("應該能夠添加備註", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));

      // 添加到收藏並附帶備註
      const notes = "這是測試備註";
      await addToWatchlist(testUserId, testCardId, notes);

      // 驗證備註已保存
      const result = await db
        .select()
        .from(watchlist)
        .where(
          and(eq(watchlist.userId, testUserId), eq(watchlist.cardId, testCardId))
        )
        .limit(1);

      expect(result.length).toBe(1);
      expect(result[0].notes).toBe(notes);
    });
  });
});
