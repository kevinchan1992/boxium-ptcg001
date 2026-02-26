import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Search Pagination Tests (Traditional Page Mode)", () => {
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

    it("should return next 50 cards when offset is 50 (page 2)", async () => {
      const page1 = await db.searchCards("pikachu", 50, 0);
      const page2 = await db.searchCards("pikachu", 50, 50);
      
      // If there are more than 50 cards total
      if (page1.total > 50) {
        expect(page2.cards.length).toBeGreaterThan(0);
        expect(page2.total).toBe(page1.total); // Total should be the same
        
        // First card of page 2 should be different from first card of page 1
        if (page2.cards.length > 0 && page1.cards.length > 0) {
          expect(page2.cards[0].id).not.toBe(page1.cards[0].id);
        }
      }
    });

    it("should support traditional pagination (page 1, 2, 3)", async () => {
      const limit = 50;
      
      // Page 1: offset = 0
      const page1 = await db.searchCards("pikachu", limit, 0);
      // Page 2: offset = 50
      const page2 = await db.searchCards("pikachu", limit, 50);
      // Page 3: offset = 100
      const page3 = await db.searchCards("pikachu", limit, 100);
      
      // All pages should have the same total
      expect(page1.total).toBe(page2.total);
      expect(page2.total).toBe(page3.total);
      
      // Calculate total pages
      const totalPages = Math.ceil(page1.total / limit);
      expect(totalPages).toBeGreaterThan(0);
      
      // Each page should have different cards (no duplicates)
      if (page1.cards.length > 0 && page2.cards.length > 0) {
        const page1Ids = page1.cards.map(c => c.id);
        const page2Ids = page2.cards.map(c => c.id);
        const overlap = page1Ids.filter(id => page2Ids.includes(id));
        expect(overlap.length).toBe(0); // No overlap between pages
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
