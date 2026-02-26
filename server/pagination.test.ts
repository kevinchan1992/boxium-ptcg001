import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Search Pagination Tests", () => {
  describe("searchCards with offset and limit", () => {
    it("should return correct structure with cards and total", async () => {
      const result = await db.searchCards("pikachu", 10, 0);
      
      expect(result).toHaveProperty("cards");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.cards)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should return first 50 cards when offset is 0", async () => {
      const result = await db.searchCards("pikachu", 50, 0);
      
      expect(result.cards.length).toBeLessThanOrEqual(50);
      expect(result.total).toBeGreaterThan(0);
    });

    it("should return next 50 cards when offset is 50", async () => {
      const firstBatch = await db.searchCards("pikachu", 50, 0);
      const secondBatch = await db.searchCards("pikachu", 50, 50);
      
      // If there are more than 50 cards total
      if (firstBatch.total > 50) {
        expect(secondBatch.cards.length).toBeGreaterThan(0);
        expect(secondBatch.total).toBe(firstBatch.total); // Total should be the same
        
        // First card of second batch should be different from first card of first batch
        if (secondBatch.cards.length > 0 && firstBatch.cards.length > 0) {
          expect(secondBatch.cards[0].id).not.toBe(firstBatch.cards[0].id);
        }
      }
    });

    it("should return empty cards array when offset exceeds total", async () => {
      const result = await db.searchCards("pikachu", 50, 10000);
      
      expect(result.cards.length).toBe(0);
      expect(result.total).toBeGreaterThan(0); // Total should still be accurate
    });

    it("should handle limit parameter correctly", async () => {
      const result = await db.searchCards("pikachu", 10, 0);
      
      expect(result.cards.length).toBeLessThanOrEqual(10);
    });

    it("should return consistent total across different offsets", async () => {
      const result1 = await db.searchCards("pikachu", 50, 0);
      const result2 = await db.searchCards("pikachu", 50, 50);
      const result3 = await db.searchCards("pikachu", 50, 100);
      
      expect(result1.total).toBe(result2.total);
      expect(result2.total).toBe(result3.total);
    });

    it("should include latestPrice in card results", async () => {
      const result = await db.searchCards("pikachu", 10, 0);
      
      if (result.cards.length > 0) {
        const card = result.cards[0];
        expect(card).toHaveProperty("latestPrice");
        // latestPrice can be null or a number
        expect(card.latestPrice === null || typeof card.latestPrice === "number").toBe(true);
      }
    });

    it("should sort by latestPrice DESC (highest price first)", async () => {
      const result = await db.searchCards("pikachu", 50, 0);
      
      if (result.cards.length > 1) {
        // Check that cards are sorted by latestPrice in descending order
        for (let i = 0; i < result.cards.length - 1; i++) {
          const currentPrice = result.cards[i].latestPrice || 0;
          const nextPrice = result.cards[i + 1].latestPrice || 0;
          expect(currentPrice).toBeGreaterThanOrEqual(nextPrice);
        }
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty search query", async () => {
      const result = await db.searchCards("", 10, 0);
      
      expect(result).toHaveProperty("cards");
      expect(result).toHaveProperty("total");
      // Empty query should return empty results
      expect(Array.isArray(result.cards)).toBe(true);
      expect(typeof result.total).toBe("number");
    }, 10000);

    it("should handle non-existent card name", async () => {
      const result = await db.searchCards("nonexistentcardxyz123", 10, 0);
      
      expect(result.cards.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it("should handle very large limit", async () => {
      const result = await db.searchCards("pikachu", 1000, 0);
      
      expect(result.cards.length).toBeLessThanOrEqual(1000);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe("Price sorting validation", () => {
    it("should use soldAt for latest price calculation", async () => {
      const result = await db.searchCards("pikachu", 10, 0);
      
      if (result.cards.length > 0) {
        const card = result.cards[0];
        
        // If card has a latestPrice, verify it's calculated from soldAt
        if (card.latestPrice !== null) {
          const priceHistory = await db.getPriceHistory(card.id, "snkrdunk", "PSA10", 1);
          
          if (priceHistory.length > 0) {
            // Latest price should match the most recent soldAt record
            expect(card.latestPrice).toBe(parseFloat(priceHistory[0].price));
          }
        }
      }
    });
  });
});
