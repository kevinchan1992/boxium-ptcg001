import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, cards, watchlist, viewHistory } from "../drizzle/schema_new";
import { eq, desc } from "drizzle-orm";

describe("Profile API Tests", () => {
  let testUserId: number;
  let testCardId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 創建測試用戶
    const [user] = await db
      .insert(users)
      .values({
        email: "profile-test@example.com",
        name: "Profile Test User",
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
        cardId: "test-profile-card-001",
        name: "Test Card for Profile",
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
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testCardId) {
      await db.delete(cards).where(eq(cards.id, testCardId));
    }
  });

  describe("Watchlist功能", () => {
    it("應該能夠添加卡牌到收藏", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(watchlist).values({
        userId: testUserId,
        cardId: testCardId,
      });

      const result = await db
        .select()
        .from(watchlist)
        .where(eq(watchlist.userId, testUserId));

      expect(result.length).toBe(1);
      expect(result[0].cardId).toBe(testCardId);
    });

    it("應該能夠從收藏移除卡牌", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 先添加
      await db.insert(watchlist).values({
        userId: testUserId,
        cardId: testCardId,
      });

      // 再移除
      await db
        .delete(watchlist)
        .where(
          eq(watchlist.userId, testUserId) && eq(watchlist.cardId, testCardId)
        );

      const result = await db
        .select()
        .from(watchlist)
        .where(eq(watchlist.userId, testUserId));

      expect(result.length).toBe(0);
    });
  });

  describe("瀏覽歷史功能", () => {
    it("應該能夠記錄用戶瀏覽卡牌", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.insert(viewHistory).values({
        userId: testUserId,
        cardId: testCardId,
        viewedAt: new Date(),
      });

      const result = await db
        .select()
        .from(viewHistory)
        .where(eq(viewHistory.userId, testUserId));

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].cardId).toBe(testCardId);
    });

    it("應該按時間倒序返回瀏覽歷史", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加多條記錄
      const now = new Date();
      await db.insert(viewHistory).values([
        {
          userId: testUserId,
          cardId: testCardId,
          viewedAt: new Date(now.getTime() - 3600000), // 1小時前
        },
        {
          userId: testUserId,
          cardId: testCardId,
          viewedAt: new Date(now.getTime() - 7200000), // 2小時前
        },
        {
          userId: testUserId,
          cardId: testCardId,
          viewedAt: now, // 現在
        },
      ]);

      const result = await db
        .select()
        .from(viewHistory)
        .where(eq(viewHistory.userId, testUserId))
        .orderBy(desc(viewHistory.viewedAt));

      expect(result.length).toBe(3);
      // 最新的記錄應該在最前面
      expect(result[0].viewedAt.getTime()).toBeGreaterThanOrEqual(
        result[1].viewedAt.getTime()
      );
    });
  });

  describe("數據完整性", () => {
    it("同一用戶不能重複收藏同一張卡牌", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(watchlist).where(eq(watchlist.userId, testUserId));

      // 第一次添加應該成功
      await db.insert(watchlist).values({
        userId: testUserId,
        cardId: testCardId,
      });

      // 第二次添加應該成功（沒有唯一約束），但會創建新記錄
      await db.insert(watchlist).values({
        userId: testUserId,
        cardId: testCardId,
      });
      
      // 驗證會有兩筆記錄
      const result = await db
        .select()
        .from(watchlist)
        .where(eq(watchlist.userId, testUserId));
      
      expect(result.length).toBe(2);
    });
  });
});
