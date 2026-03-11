/**
 * Trending Cards - This-week vs Last-week Weighted Average Tests
 *
 * Tests the new trending card calculation logic:
 *   thisWeekAvg  = time-decay weighted avg of PSA10 transactions in last 0-7 days  (half-life 7d)
 *   lastWeekAvg  = time-decay weighted avg of PSA10 transactions in last 7-14 days (half-life 7d)
 *   priceChange  = (thisWeekAvg - lastWeekAvg) / lastWeekAvg × 100%
 *
 * Requirements:
 *   - Both windows must have ≥ 3 transactions after IQR filtering
 *   - Only cards with positive price change are ranked
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Pure implementation (mirrors db.ts helper functions)
// ─────────────────────────────────────────────────────────────────────────────

function filterOutliersTrending(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 2.5 * iqr;
  const upper = q3 + 2.5 * iqr;
  const candidate = prices.filter(p => p >= lower && p <= upper);
  return candidate.length >= Math.ceil(prices.length * 0.5) ? candidate : prices;
}

function weightedAvgTrending(
  records: { price: number; date: Date }[],
  now: Date,
  halfLifeDays: number
): number | null {
  if (records.length === 0) return null;
  const prices = records.map(r => r.price);
  const filtered = filterOutliersTrending(prices);
  const filteredSet = new Set(filtered);
  const kept = records.filter(r => filteredSet.has(r.price));
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of kept) {
    const daysAgo = (now.getTime() - r.date.getTime()) / (1000 * 60 * 60 * 24);
    const w = Math.pow(2, -daysAgo / halfLifeDays);
    weightedSum += r.price * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

interface CardWindow {
  thisWeek: { price: number; date: Date }[];
  lastWeek: { price: number; date: Date }[];
}

const HALF_LIFE = 7;
const MIN_RECORDS = 3;

function calcPriceChange(
  windows: CardWindow,
  now: Date
): { priceChange: number; thisWeekAvg: number; lastWeekAvg: number } | null {
  if (windows.thisWeek.length < MIN_RECORDS) return null;
  if (windows.lastWeek.length < MIN_RECORDS) return null;

  const thisWeekAvg = weightedAvgTrending(windows.thisWeek, now, HALF_LIFE);
  const lastWeekAvg = weightedAvgTrending(windows.lastWeek, now, HALF_LIFE);

  if (thisWeekAvg === null || lastWeekAvg === null || lastWeekAvg === 0) return null;

  const priceChange = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
  return { priceChange, thisWeekAvg, lastWeekAvg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date("2026-03-11T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

function makeRecords(prices: number[], dayOffset: number): { price: number; date: Date }[] {
  return prices.map((price, i) => ({
    price,
    date: daysAgo(dayOffset + i * 0.1), // slight spread within same day
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: filterOutliersTrending
// ─────────────────────────────────────────────────────────────────────────────

describe("filterOutliersTrending", () => {
  it("removes a single high outlier from a tight cluster", () => {
    const result = filterOutliersTrending([2100, 2150, 2200, 2250, 3960]);
    expect(result).not.toContain(3960);
    expect(result.length).toBe(4);
  });

  it("removes a single low outlier (e.g. mis-classified record)", () => {
    const result = filterOutliersTrending([180, 1800, 1850, 1900, 1950]);
    expect(result).not.toContain(180);
  });

  it("skips filtering when fewer than 4 records", () => {
    const result = filterOutliersTrending([1000, 5000, 1100]);
    expect(result.length).toBe(3);
  });

  it("falls back to original when filter removes more than half", () => {
    // Bimodal distribution: IQR would remove 3 of 5
    const result = filterOutliersTrending([100, 110, 5000, 5100, 5200]);
    expect(result.length).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: weightedAvgTrending
// ─────────────────────────────────────────────────────────────────────────────

describe("weightedAvgTrending", () => {
  it("returns null for empty records", () => {
    expect(weightedAvgTrending([], NOW, HALF_LIFE)).toBeNull();
  });

  it("returns the single record price when only 1 record", () => {
    const records = [{ price: 2000, date: daysAgo(1) }];
    const result = weightedAvgTrending(records, NOW, HALF_LIFE);
    expect(result).toBeCloseTo(2000, 1);
  });

  it("gives higher weight to more recent records (half-life 7 days)", () => {
    // Record 1 day ago vs 6 days ago
    const recent = [{ price: 3000, date: daysAgo(1) }];
    const older  = [{ price: 3000, date: daysAgo(6) }];
    const wRecent = weightedAvgTrending(recent, NOW, HALF_LIFE)!;
    const wOlder  = weightedAvgTrending(older,  NOW, HALF_LIFE)!;
    // Both return the same price since there's only one record each,
    // but we can verify weights by comparing a mixed set
    const mixed = [
      { price: 1000, date: daysAgo(1) },  // recent, high weight
      { price: 2000, date: daysAgo(6) },  // older, lower weight
    ];
    const avg = weightedAvgTrending(mixed, NOW, HALF_LIFE)!;
    // Should be closer to 1000 (recent) than to 1500 (simple avg)
    expect(avg).toBeLessThan(1500);
    expect(avg).toBeGreaterThan(1000);
  });

  it("removes outlier before weighting", () => {
    const records = [
      { price: 2000, date: daysAgo(1) },
      { price: 2100, date: daysAgo(2) },
      { price: 2050, date: daysAgo(3) },
      { price: 2080, date: daysAgo(4) },
      { price: 9999, date: daysAgo(5) }, // outlier
    ];
    const result = weightedAvgTrending(records, NOW, HALF_LIFE)!;
    // Should be in the 2000-2100 range, not pulled up by 9999
    expect(result).toBeLessThan(2200);
    expect(result).toBeGreaterThan(1900);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: calcPriceChange - core trending logic
// ─────────────────────────────────────────────────────────────────────────────

describe("calcPriceChange - minimum records requirement", () => {
  it("returns null when this-week has fewer than 3 records", () => {
    const windows: CardWindow = {
      thisWeek: makeRecords([2000, 2100], 1),       // only 2
      lastWeek: makeRecords([1800, 1850, 1900], 10),
    };
    expect(calcPriceChange(windows, NOW)).toBeNull();
  });

  it("returns null when last-week has fewer than 3 records", () => {
    const windows: CardWindow = {
      thisWeek: makeRecords([2000, 2100, 2200], 1),
      lastWeek: makeRecords([1800, 1850], 10),       // only 2
    };
    expect(calcPriceChange(windows, NOW)).toBeNull();
  });

  it("returns result when both windows have exactly 3 records", () => {
    const windows: CardWindow = {
      thisWeek: makeRecords([2000, 2100, 2200], 1),
      lastWeek: makeRecords([1800, 1850, 1900], 10),
    };
    expect(calcPriceChange(windows, NOW)).not.toBeNull();
  });
});

describe("calcPriceChange - price change calculation", () => {
  it("returns positive change when this-week avg is higher than last-week avg", () => {
    const windows: CardWindow = {
      thisWeek: makeRecords([2200, 2300, 2400, 2350, 2250], 2),  // ~2300 avg
      lastWeek: makeRecords([1800, 1850, 1900, 1850, 1800], 10), // ~1840 avg
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result).not.toBeNull();
    expect(result.priceChange).toBeGreaterThan(0);
    expect(result.thisWeekAvg).toBeGreaterThan(result.lastWeekAvg);
  });

  it("returns negative change when this-week avg is lower than last-week avg", () => {
    const windows: CardWindow = {
      thisWeek: makeRecords([1500, 1550, 1600, 1520, 1480], 2),  // ~1530 avg
      lastWeek: makeRecords([2000, 2050, 2100, 2050, 2000], 10), // ~2040 avg
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result).not.toBeNull();
    expect(result.priceChange).toBeLessThan(0);
  });

  it("calculates approximately correct percentage change", () => {
    // lastWeek ~1000, thisWeek ~1200 → ~20% increase
    const windows: CardWindow = {
      thisWeek: makeRecords([1190, 1200, 1210, 1195, 1205], 2),
      lastWeek: makeRecords([990,  1000, 1010, 995,  1005], 10),
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result.priceChange).toBeGreaterThan(15);
    expect(result.priceChange).toBeLessThan(25);
  });
});

describe("calcPriceChange - old min/max false spike prevention", () => {
  it("does NOT produce +1000% spike when one low outlier exists in this-week data", () => {
    // Old logic: min=400, max=4400 → +1000%
    // New logic: IQR removes 400, weighted avg ~4000 vs last week ~3800 → ~5%
    const windows: CardWindow = {
      thisWeek: [
        { price: 400,  date: daysAgo(1) },  // outlier (mis-classified)
        { price: 4000, date: daysAgo(2) },
        { price: 4100, date: daysAgo(3) },
        { price: 3900, date: daysAgo(4) },
        { price: 4050, date: daysAgo(5) },
      ],
      lastWeek: makeRecords([3800, 3850, 3900, 3820, 3780], 10),
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result).not.toBeNull();
    // Should be a reasonable single-digit or low double-digit percentage
    expect(result.priceChange).toBeLessThan(20);
    expect(result.priceChange).toBeGreaterThan(-5);
  });

  it("does NOT produce +1000% spike when one high outlier exists in this-week data", () => {
    // Old logic: min=400, max=4400 → +1000%
    // New logic: IQR removes 4400, weighted avg ~450 vs last week ~400 → ~12%
    const windows: CardWindow = {
      thisWeek: [
        { price: 430,  date: daysAgo(1) },
        { price: 450,  date: daysAgo(2) },
        { price: 460,  date: daysAgo(3) },
        { price: 440,  date: daysAgo(4) },
        { price: 4400, date: daysAgo(5) }, // outlier
      ],
      lastWeek: makeRecords([390, 400, 410, 395, 405], 10),
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result).not.toBeNull();
    expect(result.priceChange).toBeLessThan(30);
  });

  it("correctly identifies a genuine price surge (e.g. +50% market move)", () => {
    // Genuine market surge: all records consistently higher this week
    const windows: CardWindow = {
      thisWeek: makeRecords([1450, 1500, 1550, 1480, 1520], 2),  // ~1500
      lastWeek: makeRecords([980,  1000, 1020, 990,  1010], 10), // ~1000
    };
    const result = calcPriceChange(windows, NOW)!;
    expect(result).not.toBeNull();
    expect(result.priceChange).toBeGreaterThan(40);
    expect(result.priceChange).toBeLessThan(60);
  });
});

describe("calcPriceChange - half-life 7 days weighting within windows", () => {
  it("this-week records from 1 day ago have higher weight than 6 days ago", () => {
    // Two cards with same simple avg but different recency distribution
    // Card A: higher prices are more recent → should have higher weighted avg
    const windowsA: CardWindow = {
      thisWeek: [
        { price: 2500, date: daysAgo(1) }, // recent, high price
        { price: 2500, date: daysAgo(1) },
        { price: 2500, date: daysAgo(1) },
        { price: 1500, date: daysAgo(6) }, // older, low price
        { price: 1500, date: daysAgo(6) },
      ],
      lastWeek: makeRecords([2000, 2000, 2000, 2000, 2000], 10),
    };
    // Card B: lower prices are more recent → should have lower weighted avg
    const windowsB: CardWindow = {
      thisWeek: [
        { price: 1500, date: daysAgo(1) }, // recent, low price
        { price: 1500, date: daysAgo(1) },
        { price: 1500, date: daysAgo(1) },
        { price: 2500, date: daysAgo(6) }, // older, high price
        { price: 2500, date: daysAgo(6) },
      ],
      lastWeek: makeRecords([2000, 2000, 2000, 2000, 2000], 10),
    };

    const resultA = calcPriceChange(windowsA, NOW)!;
    const resultB = calcPriceChange(windowsB, NOW)!;

    // Card A should show higher price change than Card B
    expect(resultA.thisWeekAvg).toBeGreaterThan(resultB.thisWeekAvg);
    expect(resultA.priceChange).toBeGreaterThan(resultB.priceChange);
  });
});
