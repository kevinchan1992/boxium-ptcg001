/**
 * Profile API Response Structure Tests
 * 
 * These tests verify that all profile API functions return data structures
 * that match frontend expectations (Profile.tsx).
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getUserWatchlist,
  getUserViewHistory,
  addViewHistory,
  clearViewHistory,
  getUserWatchlistStats,
  isCardInWatchlist,
} from "./profile";
import * as db from "./db";

describe("Profile API - Response Structure Validation", () => {
  let testUserId: number;
  let testCardId: number;

  beforeAll(async () => {
    // Use existing user ID (assuming admin user with ID 1 exists)
    testUserId = 1;
    
    // Get a test card ID from the database
    const cards = await db.searchCards("pikachu", 1, 0);
    if (cards.cards.length > 0) {
      testCardId = cards.cards[0].id;
    } else {
      throw new Error("No cards found in database for testing");
    }

    // Ensure we have some test data
    await addViewHistory(testUserId, testCardId);
  });

  describe("getUserViewHistory - Response Structure", () => {
    it("should return array with correct top-level structure", async () => {
      const history = await getUserViewHistory(testUserId, 10);
      
      expect(history).toBeInstanceOf(Array);
      
      if (history.length > 0) {
        const item = history[0];
        
        // Check top-level properties
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("viewedAt");
        expect(item).toHaveProperty("card");
        
        // Verify types
        expect(typeof item.id).toBe("number");
        expect(item.viewedAt).toBeInstanceOf(Date);
        expect(typeof item.card).toBe("object");
      }
    });

    it("should have nested card object (NOT flat structure)", async () => {
      const history = await getUserViewHistory(testUserId, 10);
      
      if (history.length > 0) {
        const item = history[0];
        
        // Frontend expects item.card.id, NOT item.cardId
        expect(item).not.toHaveProperty("cardId");
        expect(item).not.toHaveProperty("cardName");
        expect(item).not.toHaveProperty("cardNumber");
        expect(item).not.toHaveProperty("series");
        expect(item).not.toHaveProperty("imageUrl");
        
        // Should have nested card object instead
        expect(item.card).toBeDefined();
        expect(item.card).toHaveProperty("id");
        expect(item.card).toHaveProperty("name");
        expect(item.card).toHaveProperty("cardNumber");
        expect(item.card).toHaveProperty("series");
        expect(item.card).toHaveProperty("imageUrl");
      }
    });

    it("should have correct card object property types", async () => {
      const history = await getUserViewHistory(testUserId, 10);
      
      if (history.length > 0) {
        const card = history[0].card;
        
        expect(typeof card.id).toBe("number");
        expect(typeof card.name).toBe("string");
        // cardNumber, series, imageUrl can be null or string
        expect(card.cardNumber === null || typeof card.cardNumber === "string").toBe(true);
        expect(card.series === null || typeof card.series === "string").toBe(true);
        expect(card.imageUrl === null || typeof card.imageUrl === "string").toBe(true);
      }
    });

    it("should match frontend Profile.tsx expectations", async () => {
      const history = await getUserViewHistory(testUserId, 1);
      
      if (history.length > 0) {
        const item = history[0];
        
        // Frontend code: item.card.id
        expect(() => item.card.id).not.toThrow();
        expect(typeof item.card.id).toBe("number");
        
        // Frontend code: item.card.name
        expect(() => item.card.name).not.toThrow();
        expect(typeof item.card.name).toBe("string");
        
        // Frontend code: item.card.series || "-"
        expect(() => item.card.series).not.toThrow();
        
        // Frontend code: new Date(item.viewedAt).toLocaleString()
        expect(() => new Date(item.viewedAt).toLocaleString()).not.toThrow();
      }
    });
  });

  describe("getUserWatchlist - Response Structure", () => {
    it("should return array with correct top-level structure", async () => {
      const watchlist = await getUserWatchlist(testUserId);
      
      expect(watchlist).toBeInstanceOf(Array);
      
      if (watchlist.length > 0) {
        const item = watchlist[0];
        
        // Check top-level properties
        expect(item).toHaveProperty("id");
        expect(item).toHaveProperty("notes");
        expect(item).toHaveProperty("createdAt");
        expect(item).toHaveProperty("card");
        expect(item).toHaveProperty("latestPrice");
        expect(item).toHaveProperty("currency");
      }
    });

    it("should have nested card object with extended properties", async () => {
      const watchlist = await getUserWatchlist(testUserId);
      
      if (watchlist.length > 0) {
        const card = watchlist[0].card;
        
        // Watchlist card should have more properties than view history card
        expect(card).toHaveProperty("id");
        expect(card).toHaveProperty("name");
        expect(card).toHaveProperty("cardNumber");
        expect(card).toHaveProperty("series");
        expect(card).toHaveProperty("setName");
        expect(card).toHaveProperty("rarity");
        expect(card).toHaveProperty("imageUrl");
      }
    });

    it("should match frontend Profile.tsx WatchlistSection expectations", async () => {
      const watchlist = await getUserWatchlist(testUserId);
      
      if (watchlist.length > 0) {
        const item = watchlist[0];
        
        // Frontend code: item.card.id
        expect(() => item.card.id).not.toThrow();
        
        // Frontend code: item.card.name
        expect(() => item.card.name).not.toThrow();
        
        // Frontend code: item.card.series || "-"
        expect(() => item.card.series).not.toThrow();
        
        // Frontend code: item.latestPrice ? ... : ...
        expect(() => item.latestPrice).not.toThrow();
        
        // Frontend code: item.currency
        expect(() => item.currency).not.toThrow();
        expect(typeof item.currency).toBe("string");
        
        // Frontend code: item.notes || "-"
        expect(() => item.notes).not.toThrow();
        
        // Frontend code: new Date(item.createdAt).toLocaleDateString()
        expect(() => new Date(item.createdAt).toLocaleDateString()).not.toThrow();
      }
    });
  });

  describe("getUserWatchlistStats - Response Structure", () => {
    it("should return object with correct structure", async () => {
      const stats = await getUserWatchlistStats(testUserId);
      
      expect(stats).toHaveProperty("totalCount");
      expect(stats).toHaveProperty("totalValue");
      expect(stats).toHaveProperty("currency");
      expect(stats).toHaveProperty("top5Cards");
      
      expect(typeof stats.totalCount).toBe("number");
      expect(typeof stats.totalValue).toBe("number");
      expect(typeof stats.currency).toBe("string");
      expect(Array.isArray(stats.top5Cards)).toBe(true);
    });

    it("should have top5Cards with same structure as watchlist items", async () => {
      const stats = await getUserWatchlistStats(testUserId);
      
      if (stats.top5Cards.length > 0) {
        const card = stats.top5Cards[0];
        
        // Should have same structure as getUserWatchlist items
        expect(card).toHaveProperty("id");
        expect(card).toHaveProperty("card");
        expect(card).toHaveProperty("latestPrice");
        expect(card).toHaveProperty("currency");
      }
    });
  });

  describe("Data Consistency Across APIs", () => {
    it("should use consistent card object structure in all APIs", async () => {
      const history = await getUserViewHistory(testUserId, 1);
      const watchlist = await getUserWatchlist(testUserId);
      
      // Both should have nested card objects
      if (history.length > 0) {
        expect(history[0]).toHaveProperty("card");
        expect(history[0].card).toHaveProperty("id");
        expect(history[0].card).toHaveProperty("name");
      }
      
      if (watchlist.length > 0) {
        expect(watchlist[0]).toHaveProperty("card");
        expect(watchlist[0].card).toHaveProperty("id");
        expect(watchlist[0].card).toHaveProperty("name");
      }
    });

    it("should never return flat card structure (anti-pattern)", async () => {
      const history = await getUserViewHistory(testUserId, 1);
      
      if (history.length > 0) {
        const item = history[0];
        
        // These flat properties should NOT exist
        expect(item).not.toHaveProperty("cardId");
        expect(item).not.toHaveProperty("cardName");
        
        // Should use nested structure instead
        expect(item.card).toBeDefined();
        expect(item.card.id).toBeDefined();
        expect(item.card.name).toBeDefined();
      }
    });
  });

  describe("Functional Tests", () => {
    it("should add and retrieve view history", async () => {
      // Clear existing history
      await clearViewHistory(testUserId);
      
      // Add a view history record
      await addViewHistory(testUserId, testCardId);
      
      // Retrieve and verify
      const history = await getUserViewHistory(testUserId, 10);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].card.id).toBe(testCardId);
    });

    it("should respect limit parameter", async () => {
      const limit = 5;
      const history = await getUserViewHistory(testUserId, limit);
      expect(history.length).toBeLessThanOrEqual(limit);
    });

    it("should check if card is in watchlist", async () => {
      const isInWatchlist = await isCardInWatchlist(testUserId, testCardId);
      expect(typeof isInWatchlist).toBe("boolean");
    });

    it("should handle empty results gracefully", async () => {
      const nonExistentUserId = 999999;
      
      const history = await getUserViewHistory(nonExistentUserId, 10);
      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBe(0);
      
      const watchlist = await getUserWatchlist(nonExistentUserId);
      expect(watchlist).toBeInstanceOf(Array);
      expect(watchlist.length).toBe(0);
      
      const stats = await getUserWatchlistStats(nonExistentUserId);
      expect(stats.totalCount).toBe(0);
      expect(stats.totalValue).toBe(0);
      expect(stats.top5Cards.length).toBe(0);
    });
  });
});
