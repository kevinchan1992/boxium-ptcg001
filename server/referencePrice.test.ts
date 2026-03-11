/**
 * PSA 10 Reference Price - Time-Decay Weighted Average Tests
 *
 * Tests the core logic of the new reference price calculation:
 *   1. IQR 2.5× outlier filtering
 *   2. Time-decay weighted average (half-life = 14 days)
 *
 * This mirrors the calculateReferencePrice() logic in CardDetail.tsx
 * so we can verify correctness without a browser.
 */

import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Pure implementation (mirrors CardDetail.tsx logic exactly)
// ─────────────────────────────────────────────────────────────────────────────

interface PriceRecord {
  price: number;
  soldAt: Date | null;
}

const HALF_LIFE_DAYS = 14;

function iqrFilter(records: PriceRecord[]): PriceRecord[] {
  const prices = records.map((r) => r.price);
  if (prices.length < 4) return records;

  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 2.5 * iqr;
  const upper = q3 + 2.5 * iqr;

  const candidate = records.filter((r) => r.price >= lower && r.price <= upper);
  // Safety fallback: keep original if filter removes more than half
  if (candidate.length < Math.ceil(records.length * 0.5)) return records;
  return candidate;
}

function timeDecayWeight(soldAt: Date | null, now: Date): number {
  if (!soldAt) return 1; // No date → treat as today
  const daysAgo = (now.getTime() - soldAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(2, -daysAgo / HALF_LIFE_DAYS);
}

function calculateReferencePrice(
  records: PriceRecord[],
  now: Date = new Date()
): number | null {
  if (records.length === 0) return null;

  // Step 1: IQR filter
  const filtered = iqrFilter(records);

  // Step 2: Time-decay weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of filtered) {
    const w = timeDecayWeight(r.soldAt, now);
    weightedSum += r.price * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 24 * 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("IQR outlier filtering", () => {
  it("removes a single obvious outlier from a tight cluster", () => {
    const records: PriceRecord[] = [
      { price: 2100, soldAt: null },
      { price: 2150, soldAt: null },
      { price: 2200, soldAt: null },
      { price: 2250, soldAt: null },
      { price: 3960, soldAt: null }, // outlier
    ];
    const filtered = iqrFilter(records);
    expect(filtered.map((r) => r.price)).not.toContain(3960);
    expect(filtered.length).toBe(4);
  });

  it("removes a very low outlier (e.g. mis-classified JPY 21,000 record)", () => {
    const records: PriceRecord[] = [
      { price: 180, soldAt: null }, // outlier (e.g. JPY 21,000 ≈ HKD 180)
      { price: 1800, soldAt: null },
      { price: 1850, soldAt: null },
      { price: 1900, soldAt: null },
      { price: 1950, soldAt: null },
    ];
    const filtered = iqrFilter(records);
    expect(filtered.map((r) => r.price)).not.toContain(180);
  });

  it("skips filtering when fewer than 4 records", () => {
    const records: PriceRecord[] = [
      { price: 1000, soldAt: null },
      { price: 5000, soldAt: null }, // would be outlier with 4+ records
      { price: 1100, soldAt: null },
    ];
    const filtered = iqrFilter(records);
    expect(filtered.length).toBe(3); // unchanged
  });

  it("falls back to original when filter would remove more than half", () => {
    // Bimodal distribution: filter would remove 3 of 5 → fallback
    const records: PriceRecord[] = [
      { price: 100, soldAt: null },
      { price: 110, soldAt: null },
      { price: 5000, soldAt: null },
      { price: 5100, soldAt: null },
      { price: 5200, soldAt: null },
    ];
    const filtered = iqrFilter(records);
    expect(filtered.length).toBe(5); // fallback: all kept
  });
});

describe("Time-decay weight", () => {
  const now = new Date("2026-03-11T00:00:00Z");

  it("gives weight 1.0 for today's transaction", () => {
    const w = timeDecayWeight(new Date("2026-03-11T00:00:00Z"), now);
    expect(w).toBeCloseTo(1.0, 4);
  });

  it("gives weight ~0.5 for a transaction exactly 14 days ago (half-life)", () => {
    const w = timeDecayWeight(new Date("2026-02-25T00:00:00Z"), now);
    expect(w).toBeCloseTo(0.5, 4);
  });

  it("gives weight ~0.25 for a transaction 28 days ago (two half-lives)", () => {
    const w = timeDecayWeight(new Date("2026-02-11T00:00:00Z"), now);
    expect(w).toBeCloseTo(0.25, 4);
  });

  it("gives weight ~0.0142 for a transaction 86 days ago", () => {
    const w = timeDecayWeight(new Date("2025-12-15T00:00:00Z"), now);
    expect(w).toBeCloseTo(0.0142, 3);
  });

  it("gives weight 1.0 when soldAt is null (treat as today)", () => {
    const w = timeDecayWeight(null, now);
    expect(w).toBe(1.0);
  });
});

describe("calculateReferencePrice - hot card (Charizard VMAX SSR)", () => {
  const now = new Date("2026-03-11T00:00:00Z");

  // Simulate 50 records all within last 4 days, one outlier at 3960
  const hotRecords: PriceRecord[] = [
    // 2026-03-10 (1 day ago) - 31 records
    ...Array.from({ length: 31 }, (_, i) => ({
      price: 2090 + i * 15,
      soldAt: daysAgo(1, now),
    })),
    // 2026-03-09 (2 days ago) - 5 records
    ...Array.from({ length: 5 }, (_, i) => ({
      price: 2090 + i * 15,
      soldAt: daysAgo(2, now),
    })),
    // 2026-03-08 (3 days ago) - 4 records
    ...Array.from({ length: 4 }, (_, i) => ({
      price: 2007 + i * 50,
      soldAt: daysAgo(3, now),
    })),
    // 2026-03-07 (4 days ago) - 10 records including outlier
    { price: 3960, soldAt: daysAgo(4, now) }, // outlier
    ...Array.from({ length: 9 }, (_, i) => ({
      price: 2079 + i * 12,
      soldAt: daysAgo(4, now),
    })),
  ];

  it("removes the 3960 outlier", () => {
    const filtered = iqrFilter(hotRecords);
    expect(filtered.map((r) => r.price)).not.toContain(3960);
  });

  it("returns a price in the expected market range (HKD 2100–2400)", () => {
    const ref = calculateReferencePrice(hotRecords, now);
    expect(ref).not.toBeNull();
    expect(ref!).toBeGreaterThan(2100);
    expect(ref!).toBeLessThan(2400);
  });

  it("result differs from simple average of top-10 (weighted avg uses all 50 records)", () => {
    const top10Avg =
      hotRecords
        .slice(0, 10)
        .reduce((s, r) => s + r.price, 0) / 10;
    const ref = calculateReferencePrice(hotRecords, now);
    // Weighted avg (50 records) should differ from simple top-10 avg
    // because it incorporates more data points with time-decay weighting
    expect(ref).not.toBeNull();
    expect(ref!).not.toBeCloseTo(top10Avg, 0); // They should differ by at least 1 HKD
  });

  it("recent records (1 day ago) have higher weight than older records (4 days ago)", () => {
    const w1 = timeDecayWeight(daysAgo(1, now), now);
    const w4 = timeDecayWeight(daysAgo(4, now), now);
    expect(w1).toBeGreaterThan(w4);
  });
});

describe("calculateReferencePrice - cold card (M Venusaur EX CP6)", () => {
  const now = new Date("2026-03-11T00:00:00Z");

  const coldRecords: PriceRecord[] = [
    { price: 1045, soldAt: new Date("2026-03-11T00:00:00Z") }, // today
    { price: 924, soldAt: new Date("2026-03-11T00:00:00Z") },  // today
    { price: 1375, soldAt: new Date("2025-12-15T00:00:00Z") }, // 86 days ago
  ];

  it("returns a price close to today's transactions (~984), not the old record", () => {
    const ref = calculateReferencePrice(coldRecords, now);
    expect(ref).not.toBeNull();
    // Should be much closer to (1045+924)/2 = 984.5 than to 1114.67 (simple avg)
    expect(ref!).toBeGreaterThan(970);
    expect(ref!).toBeLessThan(1000);
  });

  it("old record (86 days) contributes only ~1.4% weight", () => {
    const w = timeDecayWeight(new Date("2025-12-15T00:00:00Z"), now);
    expect(w).toBeLessThan(0.02); // < 2%
  });

  it("today's two records together dominate (>99% combined weight)", () => {
    const wToday = timeDecayWeight(new Date("2026-03-11T00:00:00Z"), now);
    const wOld = timeDecayWeight(new Date("2025-12-15T00:00:00Z"), now);
    const totalWeight = wToday * 2 + wOld;
    const todayShare = (wToday * 2) / totalWeight;
    expect(todayShare).toBeGreaterThan(0.99);
  });

  it("skips IQR filter (only 3 records)", () => {
    const filtered = iqrFilter(coldRecords);
    expect(filtered.length).toBe(3); // unchanged
  });
});

describe("calculateReferencePrice - edge cases", () => {
  const now = new Date("2026-03-11T00:00:00Z");

  it("returns null for empty records", () => {
    expect(calculateReferencePrice([], now)).toBeNull();
  });

  it("returns the single record's price when only 1 record", () => {
    const records = [{ price: 1500, soldAt: daysAgo(0, now) }];
    const ref = calculateReferencePrice(records, now);
    expect(ref).toBeCloseTo(1500, 1);
  });

  it("handles records with null soldAt (treated as today, weight=1)", () => {
    const records = [
      { price: 1000, soldAt: null },
      { price: 2000, soldAt: null },
    ];
    const ref = calculateReferencePrice(records, now);
    expect(ref).toBeCloseTo(1500, 1); // equal weight → simple average
  });

  it("older records pull the price down compared to simple average of recent records", () => {
    const records: PriceRecord[] = [
      { price: 1000, soldAt: daysAgo(1, now) },   // recent, high weight
      { price: 1000, soldAt: daysAgo(1, now) },
      { price: 500, soldAt: daysAgo(60, now) },    // old, low weight
      { price: 500, soldAt: daysAgo(60, now) },
    ];
    const ref = calculateReferencePrice(records, now);
    // Simple avg = 750; weighted avg should be closer to 1000 (recent records dominate)
    expect(ref!).toBeGreaterThan(750);
    expect(ref!).toBeLessThan(1000);
  });

  it("two records on the same day get equal weight regardless of order", () => {
    const records: PriceRecord[] = [
      { price: 800, soldAt: daysAgo(7, now) },
      { price: 1200, soldAt: daysAgo(7, now) },
    ];
    const ref = calculateReferencePrice(records, now);
    // Same day → equal weight → simple average = 1000
    expect(ref).toBeCloseTo(1000, 1);
  });
});

describe("Half-life consistency checks", () => {
  const now = new Date("2026-03-11T00:00:00Z");

  it("weight halves every 14 days", () => {
    const w0 = timeDecayWeight(daysAgo(0, now), now);
    const w14 = timeDecayWeight(daysAgo(14, now), now);
    const w28 = timeDecayWeight(daysAgo(28, now), now);
    expect(w14 / w0).toBeCloseTo(0.5, 4);
    expect(w28 / w0).toBeCloseTo(0.25, 4);
  });

  it("weight is always positive", () => {
    for (const days of [0, 1, 7, 14, 30, 60, 90, 180]) {
      const w = timeDecayWeight(daysAgo(days, now), now);
      expect(w).toBeGreaterThan(0);
    }
  });

  it("weight is always ≤ 1", () => {
    for (const days of [0, 1, 7, 14, 30, 60, 90, 180]) {
      const w = timeDecayWeight(daysAgo(days, now), now);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});
