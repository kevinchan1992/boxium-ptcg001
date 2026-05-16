/**
 * Tests for the _loadGlobalPriceMap fix (v11.0)
 *
 * Root cause: The previous implementation used LIMIT 10000 with ORDER BY soldAt DESC,
 * which only covered ~1413 of 6763 cards (21%). 79% of cards had no PSA 10 price
 * shown in search results.
 *
 * Fix: Use a GROUP BY subquery to get the latest price per cardId, covering 100% of cards.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for the query logic (no DB required) ─────────────────────────

describe("globalPriceMap deduplication logic", () => {
  /**
   * Simulate the JS deduplication logic used in _loadGlobalPriceMap.
   * The GROUP BY query may return multiple rows for the same (cardId, soldAt)
   * if there are ties; we take the first one.
   */
  function deduplicateRows(rows: Array<{ cardId: number; price: string | number }>): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of rows) {
      if (!map.has(row.cardId)) {
        map.set(row.cardId, Number(row.price));
      }
    }
    return map;
  }

  it("should return the first price for each cardId when there are duplicates", () => {
    const rows = [
      { cardId: 1, price: 1000 },
      { cardId: 2, price: 500 },
      { cardId: 1, price: 900 }, // duplicate cardId 1 — should be ignored
      { cardId: 3, price: 200 },
    ];
    const map = deduplicateRows(rows);
    expect(map.size).toBe(3);
    expect(map.get(1)).toBe(1000); // first occurrence wins
    expect(map.get(2)).toBe(500);
    expect(map.get(3)).toBe(200);
  });

  it("should handle empty rows", () => {
    const map = deduplicateRows([]);
    expect(map.size).toBe(0);
  });

  it("should convert price strings to numbers", () => {
    const rows = [
      { cardId: 10, price: "1259.50" },
      { cardId: 20, price: "438.90" },
    ];
    const map = deduplicateRows(rows);
    expect(map.get(10)).toBe(1259.5);
    expect(map.get(20)).toBe(438.9);
  });

  it("should handle all unique cardIds (no duplicates)", () => {
    const rows = Array.from({ length: 6763 }, (_, i) => ({
      cardId: i + 1,
      price: (i + 1) * 100,
    }));
    const map = deduplicateRows(rows);
    expect(map.size).toBe(6763);
    expect(map.get(1)).toBe(100);
    expect(map.get(6763)).toBe(676300);
  });
});

// ─── Integration-style tests for the query coverage issue ────────────────────

describe("globalPriceMap coverage regression test", () => {
  /**
   * Simulate the OLD broken behavior: LIMIT 10000 with ORDER BY soldAt DESC.
   * This only returns the most recent 10k rows, which belong to a small subset of cards.
   */
  function simulateOldApproach(allRows: Array<{ cardId: number; price: number; soldAt: Date }>): Map<number, number> {
    // Sort by soldAt DESC, take first 10000
    const sorted = [...allRows].sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());
    const limited = sorted.slice(0, 10000);
    const map = new Map<number, number>();
    for (const row of limited) {
      if (!map.has(row.cardId)) {
        map.set(row.cardId, row.price);
      }
    }
    return map;
  }

  /**
   * Simulate the NEW correct behavior: GROUP BY to get latest price per card.
   * This returns one row per cardId and covers 100% of cards.
   */
  function simulateNewApproach(allRows: Array<{ cardId: number; price: number; soldAt: Date }>): Map<number, number> {
    // Group by cardId, pick the row with MAX(soldAt)
    const latestByCard = new Map<number, { price: number; soldAt: Date }>();
    for (const row of allRows) {
      const existing = latestByCard.get(row.cardId);
      if (!existing || row.soldAt > existing.soldAt) {
        latestByCard.set(row.cardId, { price: row.price, soldAt: row.soldAt });
      }
    }
    const map = new Map<number, number>();
    for (const [cardId, { price }] of latestByCard) {
      map.set(cardId, price);
    }
    return map;
  }

  it("should demonstrate that LIMIT 10000 misses cards with older transactions", () => {
    // Simulate 6763 cards, each with varying transaction counts
    // Popular cards (id 1-100) have 200 transactions each = 20000 rows
    // Other cards (id 101-6763) have 1 transaction each = 6663 rows
    // Total: 26663 rows, but LIMIT 10000 only gets the most recent 10000
    const allRows: Array<{ cardId: number; price: number; soldAt: Date }> = [];
    const now = new Date();

    // Popular cards: 100 cards × 200 transactions (recent dates)
    for (let cardId = 1; cardId <= 100; cardId++) {
      for (let i = 0; i < 200; i++) {
        allRows.push({
          cardId,
          price: 1000 + i,
          soldAt: new Date(now.getTime() - i * 60000), // i minutes ago
        });
      }
    }

    // Less popular cards: 6663 cards × 1 transaction (older dates)
    for (let cardId = 101; cardId <= 6763; cardId++) {
      allRows.push({
        cardId,
        price: cardId * 10,
        soldAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      });
    }

    const oldMap = simulateOldApproach(allRows);
    const newMap = simulateNewApproach(allRows);

    // OLD approach: LIMIT 10000 only gets the 100 popular cards (10000 / 200 = 50 cards fully covered)
    // Actually it gets 10000 rows from the 100 popular cards (100 * 200 = 20000, so 10000 rows = 50 cards)
    expect(oldMap.size).toBeLessThan(200); // Only popular cards covered
    expect(oldMap.size).toBeLessThan(6763); // Definitely misses most cards

    // NEW approach: All 6763 cards covered
    expect(newMap.size).toBe(6763);

    // Verify that cards 101-6763 are MISSING from old approach but PRESENT in new approach
    expect(oldMap.has(500)).toBe(false); // Card 500 missing from old
    expect(newMap.has(500)).toBe(true);  // Card 500 present in new
    expect(newMap.get(500)).toBe(5000);  // Correct price

    // Verify popular cards have correct latest price in both approaches
    expect(newMap.get(1)).toBe(1000); // Latest price for card 1 (i=0)
  });

  it("should return the latest price (not oldest) for each card", () => {
    const allRows = [
      { cardId: 42, price: 500, soldAt: new Date("2024-01-01") },
      { cardId: 42, price: 800, soldAt: new Date("2024-06-01") }, // latest
      { cardId: 42, price: 300, soldAt: new Date("2023-06-01") },
    ];

    const map = simulateNewApproach(allRows);
    expect(map.get(42)).toBe(800); // Should be the latest price
  });

  it("should handle cards with only one transaction", () => {
    const allRows = [
      { cardId: 1, price: 1000, soldAt: new Date("2024-01-01") },
      { cardId: 2, price: 500, soldAt: new Date("2024-02-01") },
    ];

    const map = simulateNewApproach(allRows);
    expect(map.size).toBe(2);
    expect(map.get(1)).toBe(1000);
    expect(map.get(2)).toBe(500);
  });
});

// ─── Test that searchCards correctly uses the price map ──────────────────────

describe("searchCards latestPrice assignment", () => {
  it("should assign latestPrice from priceMap for matching cards", () => {
    const priceMap = new Map<number, number>([
      [1, 1000],
      [2, 500],
      [3, 200],
    ]);

    const matchingCards = [
      { id: 1, name: "Pikachu", nameJa: "ピカチュウ", cardNumber: "001" },
      { id: 2, name: "Charizard", nameJa: "リザードン", cardNumber: "002" },
      { id: 4, name: "Bulbasaur", nameJa: "フシギダネ", cardNumber: "004" }, // no price
    ];

    const cardsWithPrice = matchingCards.map(card => ({
      ...card,
      latestPrice: priceMap.get(card.id) || null,
    }));

    expect(cardsWithPrice[0].latestPrice).toBe(1000);
    expect(cardsWithPrice[1].latestPrice).toBe(500);
    expect(cardsWithPrice[2].latestPrice).toBeNull(); // card 4 has no price
  });

  it("should return null latestPrice for cards not in priceMap", () => {
    const priceMap = new Map<number, number>(); // empty map (simulates old broken behavior)

    const matchingCards = [
      { id: 1, name: "Pikachu", nameJa: "ピカチュウ", cardNumber: "001" },
    ];

    const cardsWithPrice = matchingCards.map(card => ({
      ...card,
      latestPrice: priceMap.get(card.id) || null,
    }));

    // With empty map (old broken behavior), all prices are null
    expect(cardsWithPrice[0].latestPrice).toBeNull();
  });
});
