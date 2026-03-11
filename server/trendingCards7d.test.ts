import { describe, it, expect } from "vitest";

/**
 * Trending Cards 7-Day Min/Max Price Change Calculation Tests
 *
 * Tests the new calculation logic for trending cards:
 * - Time window: last 7 days (based on soldAt)
 * - Price change = (maxPrice - minPrice) / minPrice × 100%
 * - oldPrice = 7-day minimum price
 * - currentPrice = 7-day maximum price
 * - Requires at least 2 transactions in the 7-day window
 * - Only cards with positive price change (max > min) are included
 */

// ── Helper: simulate the core calculation logic ──────────────────────────────
function calculateTrending7d(
  priceRecords: Array<{ cardId: number; price: number; soldAt: Date }>,
  now: Date
) {
  const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter to 7-day window
  const inWindow = priceRecords.filter(
    (r) => r.soldAt >= cutoffDate && r.soldAt <= now
  );

  // Group by cardId
  const cardPriceMap = new Map<number, number[]>();
  for (const record of inWindow) {
    if (!cardPriceMap.has(record.cardId)) cardPriceMap.set(record.cardId, []);
    cardPriceMap.get(record.cardId)!.push(record.price);
  }

  const results: Array<{
    cardId: number;
    priceChange: number;
    oldPrice: number;
    currentPrice: number;
  }> = [];

  for (const [cardId, prices] of Array.from(cardPriceMap.entries())) {
    if (prices.length < 2) continue;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;

    if (priceChange > 0) {
      results.push({ cardId, priceChange, oldPrice: minPrice, currentPrice: maxPrice });
    }
  }

  return results.sort((a, b) => b.priceChange - a.priceChange);
}

// ── Time window ──────────────────────────────────────────────────────────────
describe("7-day time window", () => {
  it("should use exactly 7 days as the cutoff window", () => {
    const now = new Date("2026-03-11T00:00:00.000Z");
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(cutoff.toISOString()).toBe("2026-03-04T00:00:00.000Z");
  });

  it("should include records from exactly 7 days ago (inclusive)", () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const record = { soldAt: new Date(cutoff.getTime()) }; // exactly at boundary
    expect(record.soldAt >= cutoff).toBe(true);
  });

  it("should exclude records older than 7 days", () => {
    const now = new Date("2026-03-11T12:00:00.000Z");
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oldRecord = { soldAt: new Date(cutoff.getTime() - 1) }; // 1ms before cutoff
    expect(oldRecord.soldAt >= cutoff).toBe(false);
  });
});

// ── Min/max price calculation ─────────────────────────────────────────────────
describe("7-day min/max price change calculation", () => {
  it("should calculate price change as (max - min) / min × 100%", () => {
    const minPrice = 100_000;
    const maxPrice = 150_000;
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;
    expect(priceChange).toBeCloseTo(50, 5);
  });

  it("should use minimum price as oldPrice", () => {
    const prices = [120_000, 100_000, 140_000, 110_000];
    const minPrice = Math.min(...prices);
    expect(minPrice).toBe(100_000);
  });

  it("should use maximum price as currentPrice", () => {
    const prices = [120_000, 100_000, 140_000, 110_000];
    const maxPrice = Math.max(...prices);
    expect(maxPrice).toBe(140_000);
  });

  it("should return 0% change when all prices are equal", () => {
    const prices = [100_000, 100_000, 100_000];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;
    expect(priceChange).toBe(0);
  });

  it("should correctly calculate large price swings", () => {
    // e.g. PSA10 card: min 21,000 JPY, max 200,000 JPY (anomaly scenario)
    const minPrice = 21_000;
    const maxPrice = 200_000;
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;
    expect(priceChange).toBeCloseTo(852.38, 1);
  });

  it("should correctly calculate small price swings", () => {
    // e.g. min 180,000, max 195,000
    const minPrice = 180_000;
    const maxPrice = 195_000;
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;
    expect(priceChange).toBeCloseTo(8.33, 1);
  });
});

// ── Minimum transaction requirement ──────────────────────────────────────────
describe("Minimum 2 transactions requirement", () => {
  const now = new Date("2026-03-11T12:00:00.000Z");

  it("should skip cards with only 1 transaction in 7 days", () => {
    const records = [
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(0);
  });

  it("should include cards with exactly 2 transactions in 7 days", () => {
    const records = [
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 150_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBe(1);
  });

  it("should include cards with many transactions in 7 days", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      cardId: 2,
      price: 100_000 + i * 5_000,
      soldAt: new Date(now.getTime() - i * 12 * 60 * 60 * 1000),
    }));
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(1);
    expect(result[0].cardId).toBe(2);
  });
});

// ── Positive change only ──────────────────────────────────────────────────────
describe("Only positive price change cards are included", () => {
  const now = new Date("2026-03-11T12:00:00.000Z");

  it("should exclude cards where max === min (no change)", () => {
    const records = [
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(0);
  });

  it("should include cards with any positive change", () => {
    const records = [
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 100_001, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(1);
    expect(result[0].priceChange).toBeGreaterThan(0);
  });
});

// ── Ranking (top 5 by price change) ──────────────────────────────────────────
describe("Ranking by price change (highest first)", () => {
  const now = new Date("2026-03-11T12:00:00.000Z");

  it("should rank cards by price change descending", () => {
    const records = [
      // Card 1: 50% change
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 150_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      // Card 2: 200% change
      { cardId: 2, price: 50_000, soldAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { cardId: 2, price: 150_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      // Card 3: 10% change
      { cardId: 3, price: 200_000, soldAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { cardId: 3, price: 220_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(3);
    expect(result[0].cardId).toBe(2); // 200%
    expect(result[1].cardId).toBe(1); // 50%
    expect(result[2].cardId).toBe(3); // 10%
  });

  it("should correctly identify oldPrice as min and currentPrice as max", () => {
    const now2 = new Date("2026-03-11T12:00:00.000Z");
    const records = [
      { cardId: 1, price: 130_000, soldAt: new Date(now2.getTime() - 4 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 90_000, soldAt: new Date(now2.getTime() - 3 * 24 * 60 * 60 * 1000) },  // min
      { cardId: 1, price: 160_000, soldAt: new Date(now2.getTime() - 2 * 24 * 60 * 60 * 1000) }, // max
      { cardId: 1, price: 140_000, soldAt: new Date(now2.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now2);
    expect(result[0].oldPrice).toBe(90_000);
    expect(result[0].currentPrice).toBe(160_000);
    expect(result[0].priceChange).toBeCloseTo(77.78, 1);
  });
});

// ── Records outside 7-day window are excluded ─────────────────────────────────
describe("Records outside 7-day window are excluded", () => {
  const now = new Date("2026-03-11T12:00:00.000Z");

  it("should exclude records older than 7 days from calculation", () => {
    const records = [
      // This record is 8 days old → outside window
      { cardId: 1, price: 50_000, soldAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) },
      // These 2 records are within 7 days
      { cardId: 1, price: 100_000, soldAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 120_000, soldAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    // Should use only the 2 in-window records: min=100k, max=120k → 20%
    expect(result[0].oldPrice).toBe(100_000);
    expect(result[0].currentPrice).toBe(120_000);
    expect(result[0].priceChange).toBeCloseTo(20, 1);
  });

  it("should skip card if only 1 record is within 7-day window", () => {
    const records = [
      // 2 records outside window
      { cardId: 1, price: 50_000, soldAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
      { cardId: 1, price: 80_000, soldAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) },
      // Only 1 record within window
      { cardId: 1, price: 120_000, soldAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    ];
    const result = calculateTrending7d(records, now);
    expect(result).toHaveLength(0); // not enough in-window records
  });
});

// ── Cache field mapping ───────────────────────────────────────────────────────
describe("Cache field mapping", () => {
  it("should store priceChange7d as the min/max percentage change", () => {
    const minPrice = 100_000;
    const maxPrice = 180_000;
    const priceChange = ((maxPrice - minPrice) / minPrice) * 100;
    const priceChange7d = priceChange.toFixed(2);
    expect(priceChange7d).toBe("80.00");
  });

  it("should store oldPrice as the 7-day minimum price", () => {
    const prices = [150_000, 100_000, 130_000];
    const oldPrice = Math.min(...prices).toFixed(2);
    expect(oldPrice).toBe("100000.00");
  });

  it("should store currentPrice as the 7-day maximum price", () => {
    const prices = [150_000, 100_000, 130_000];
    const currentPrice = Math.max(...prices).toFixed(2);
    expect(currentPrice).toBe("150000.00");
  });
});

// ── Comparison: old 30-day logic vs new 7-day logic ──────────────────────────
describe("Comparison: old vs new calculation logic", () => {
  it("new 7-day logic captures short-term volatility better than 30-day first/last", () => {
    const now = new Date("2026-03-11T12:00:00.000Z");

    // Scenario: card had a spike in the last 7 days but started low 30 days ago
    const pricesIn7Days = [100_000, 200_000, 180_000]; // 7-day: min=100k, max=200k → 100%

    // Old logic: first price 30 days ago = 150k, last price = 180k → 20%
    const oldLogicChange = ((180_000 - 150_000) / 150_000) * 100;

    // New logic: min=100k, max=200k → 100%
    const newLogicMin = Math.min(...pricesIn7Days);
    const newLogicMax = Math.max(...pricesIn7Days);
    const newLogicChange = ((newLogicMax - newLogicMin) / newLogicMin) * 100;

    expect(newLogicChange).toBeGreaterThan(oldLogicChange);
    expect(newLogicChange).toBeCloseTo(100, 1);
    expect(oldLogicChange).toBeCloseTo(20, 1);
  });
});
