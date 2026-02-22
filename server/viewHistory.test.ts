import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, cards, viewHistory } from "../drizzle/schema_new";
import { eq, desc } from "drizzle-orm";
import { addViewHistory, getUserViewHistory } from "./profile";

describe("View History Feature Tests", () => {
  let testUserId: number;
  let testCardId1: number;
  let testCardId2: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    // 創建測試用戶
    const [user] = await db
      .insert(users)
      .values({
        email: "viewhistory-test@example.com",
        name: "View History Test User",
        passwordHash: "test-hash",
        loginMethod: "password",
        role: "user",
        emailVerified: true,
      })
      .$returningId();
    testUserId = user.id;

    // 創建測試卡牌 1
    const [card1] = await db
      .insert(cards)
      .values({
        cardId: "test-viewhistory-card-001",
        name: "Test Card 1 for View History",
        cardNumber: "001",
        rarity: "Common",
        imageUrl: "https://example.com/test1.jpg",
      })
      .$returningId();
    testCardId1 = card1.id;

    // 創建測試卡牌 2
    const [card2] = await db
      .insert(cards)
      .values({
        cardId: "test-viewhistory-card-002",
        name: "Test Card 2 for View History",
        cardNumber: "002",
        rarity: "Rare",
        imageUrl: "https://example.com/test2.jpg",
      })
      .$returningId();
    testCardId2 = card2.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    
    // 清理測試數據
    if (testUserId) {
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testCardId1) {
      await db.delete(cards).where(eq(cards.id, testCardId1));
    }
    if (testCardId2) {
      await db.delete(cards).where(eq(cards.id, testCardId2));
    }
  });

  describe("addViewHistory", () => {
    it("應該成功添加瀏覽記錄", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加瀏覽記錄
      await addViewHistory(testUserId, testCardId1);

      // 驗證已添加
      const result = await db
        .select()
        .from(viewHistory)
        .where(eq(viewHistory.userId, testUserId));

      expect(result.length).toBe(1);
      expect(result[0].cardId).toBe(testCardId1);
    });

    it("應該允許重複添加同一張卡牌的瀏覽記錄", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加相同卡牌的瀏覽記錄兩次
      await addViewHistory(testUserId, testCardId1);
      await addViewHistory(testUserId, testCardId1);

      // 驗證有兩筆記錄
      const result = await db
        .select()
        .from(viewHistory)
        .where(eq(viewHistory.userId, testUserId));

      expect(result.length).toBe(2);
      expect(result[0].cardId).toBe(testCardId1);
      expect(result[1].cardId).toBe(testCardId1);
    });

    it("應該記錄不同卡牌的瀏覽歷史", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加不同卡牌的瀏覽記錄
      await addViewHistory(testUserId, testCardId1);
      await addViewHistory(testUserId, testCardId2);

      // 驗證有兩筆記錄
      const result = await db
        .select()
        .from(viewHistory)
        .where(eq(viewHistory.userId, testUserId));

      expect(result.length).toBe(2);
      
      // 驗證包含兩張不同的卡牌
      const cardIds = result.map(r => r.cardId);
      expect(cardIds).toContain(testCardId1);
      expect(cardIds).toContain(testCardId2);
    });
  });

  describe("getUserViewHistory", () => {
    it("應該按時間倒序返回瀏覽歷史", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加多筆瀏覽記錄（間隔時間）
      await addViewHistory(testUserId, testCardId1);
      await new Promise(resolve => setTimeout(resolve, 100)); // 等待 100ms
      await addViewHistory(testUserId, testCardId2);

      // 獲取瀏覽歷史
      const result = await getUserViewHistory(testUserId, 10);

      expect(result.length).toBe(2);
      // 最新的記錄應該在最前面（testCardId2）
      expect(result[0].cardId).toBe(testCardId2);
      expect(result[1].cardId).toBe(testCardId1);
    });

    it("應該限制返回的記錄數量", async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // 清空現有記錄
      await db.delete(viewHistory).where(eq(viewHistory.userId, testUserId));

      // 添加 5 筆瀏覽記錄
      for (let i = 0; i < 5; i++) {
        await addViewHistory(testUserId, testCardId1);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 限制返回 3 筆
      const result = await getUserViewHistory(testUserId, 3);

      expect(result.length).toBe(3);
    });
  });
});
