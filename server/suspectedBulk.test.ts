/**
 * Tests for isSuspectedBulk bulk purchase detection logic
 *
 * Problem: SNKRDUNK API doesn't indicate quantity.
 * A ¥65,000 transaction might be 8 cards bundled together,
 * which skews PSA10 reference prices.
 *
 * Solution: Flag transactions exceeding 4× the median price as isSuspectedBulk.
 */

import { describe, it, expect } from 'vitest';

// ─── Helper: compute median ───────────────────────────────────────────────────

function computeMedian(prices: number[]): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ─── Helper: flag suspected bulk records ─────────────────────────────────────

const BULK_MULTIPLIER = 4;

function flagSuspectedBulk(
  records: Array<{ jpyPrice: number; grade: string | null }>
): Array<{ jpyPrice: number; grade: string | null; isSuspectedBulk: boolean }> {
  // Group by grade
  const gradeGroups = new Map<string, number[]>();
  for (const rec of records) {
    const g = rec.grade || 'unknown';
    if (!gradeGroups.has(g)) gradeGroups.set(g, []);
    gradeGroups.get(g)!.push(rec.jpyPrice);
  }

  // Compute median per grade
  const medianByGrade = new Map<string, number>();
  for (const [grade, prices] of gradeGroups.entries()) {
    const median = computeMedian(prices);
    if (median !== null) medianByGrade.set(grade, median);
  }

  // Flag records
  return records.map(rec => {
    const grade = rec.grade || 'unknown';
    const median = medianByGrade.get(grade);
    const isSuspectedBulk = !!(median && median > 0 && rec.jpyPrice > BULK_MULTIPLIER * median);
    return { ...rec, isSuspectedBulk };
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeMedian', () => {
  it('returns null for empty array', () => {
    expect(computeMedian([])).toBeNull();
  });

  it('returns single value for single-element array', () => {
    expect(computeMedian([5000])).toBe(5000);
  });

  it('returns middle value for odd-length array', () => {
    expect(computeMedian([3000, 5000, 8000])).toBe(5000);
  });

  it('returns average of two middle values for even-length array', () => {
    expect(computeMedian([3000, 5000, 7000, 9000])).toBe(6000);
  });

  it('handles unsorted input correctly', () => {
    expect(computeMedian([9000, 3000, 5000])).toBe(5000);
  });
});

describe('flagSuspectedBulk', () => {
  it('flags records exceeding 4x median as suspected bulk', () => {
    // Typical PSA10 prices around ¥8,000; one outlier at ¥65,000 (8 cards bundled)
    const records = [
      { jpyPrice: 7500, grade: 'PSA10' },
      { jpyPrice: 8000, grade: 'PSA10' },
      { jpyPrice: 8200, grade: 'PSA10' },
      { jpyPrice: 8500, grade: 'PSA10' },
      { jpyPrice: 65000, grade: 'PSA10' }, // outlier: 8 cards bundled
    ];

    const flagged = flagSuspectedBulk(records);
    const bulkRecords = flagged.filter(r => r.isSuspectedBulk);
    const normalRecords = flagged.filter(r => !r.isSuspectedBulk);

    expect(bulkRecords).toHaveLength(1);
    expect(bulkRecords[0].jpyPrice).toBe(65000);
    expect(normalRecords).toHaveLength(4);
  });

  it('does not flag records within 4x median', () => {
    const records = [
      { jpyPrice: 7000, grade: 'PSA10' },
      { jpyPrice: 8000, grade: 'PSA10' },
      { jpyPrice: 9000, grade: 'PSA10' },
      { jpyPrice: 10000, grade: 'PSA10' }, // 10000 / median(8000) = 1.25x - not bulk
    ];

    const flagged = flagSuspectedBulk(records);
    expect(flagged.every(r => !r.isSuspectedBulk)).toBe(true);
  });

  it('handles records at exactly 4x median as NOT suspected (threshold is strictly greater)', () => {
    const records = [
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 20000, grade: 'PSA10' }, // exactly 4x median(5000) = 20000 - NOT bulk
    ];

    const flagged = flagSuspectedBulk(records);
    expect(flagged.find(r => r.jpyPrice === 20000)?.isSuspectedBulk).toBe(false);
  });

  it('flags records at more than 4x median', () => {
    const records = [
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 20001, grade: 'PSA10' }, // 20001 > 4 * 5000 = 20000 - IS bulk
    ];

    const flagged = flagSuspectedBulk(records);
    expect(flagged.find(r => r.jpyPrice === 20001)?.isSuspectedBulk).toBe(true);
  });

  it('processes different grades independently', () => {
    const records = [
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 5000, grade: 'PSA10' },
      { jpyPrice: 25000, grade: 'PSA10' }, // 5x median PSA10 = bulk
      { jpyPrice: 2000, grade: 'PSA9' },
      { jpyPrice: 2000, grade: 'PSA9' },
      { jpyPrice: 9000, grade: 'PSA9' }, // 4.5x median PSA9 = bulk
    ];

    const flagged = flagSuspectedBulk(records);
    const psa10Bulk = flagged.filter(r => r.grade === 'PSA10' && r.isSuspectedBulk);
    const psa9Bulk = flagged.filter(r => r.grade === 'PSA9' && r.isSuspectedBulk);

    expect(psa10Bulk).toHaveLength(1);
    expect(psa10Bulk[0].jpyPrice).toBe(25000);
    expect(psa9Bulk).toHaveLength(1);
    expect(psa9Bulk[0].jpyPrice).toBe(9000);
  });

  it('does not flag anything when all records have the same price', () => {
    const records = [
      { jpyPrice: 8000, grade: 'PSA10' },
      { jpyPrice: 8000, grade: 'PSA10' },
      { jpyPrice: 8000, grade: 'PSA10' },
    ];

    const flagged = flagSuspectedBulk(records);
    expect(flagged.every(r => !r.isSuspectedBulk)).toBe(true);
  });

  it('handles single record without flagging', () => {
    // Single record = median is itself, so 4x median = 4x price, record never exceeds itself
    const records = [{ jpyPrice: 50000, grade: 'PSA10' }];
    const flagged = flagSuspectedBulk(records);
    expect(flagged[0].isSuspectedBulk).toBe(false);
  });

  it('handles null grade records grouped together', () => {
    const records = [
      { jpyPrice: 3000, grade: null },
      { jpyPrice: 3000, grade: null },
      { jpyPrice: 15000, grade: null }, // 5x median = bulk
    ];

    const flagged = flagSuspectedBulk(records);
    expect(flagged.find(r => r.jpyPrice === 15000)?.isSuspectedBulk).toBe(true);
  });

  it('real-world scenario: PSA10 Charizard with bulk lot', () => {
    // Typical Charizard PSA10 prices ~¥8,000-¥12,000
    // A ¥65,000 transaction = likely 8 cards bundled
    const records = [
      { jpyPrice: 8000, grade: 'PSA10' },
      { jpyPrice: 8500, grade: 'PSA10' },
      { jpyPrice: 9000, grade: 'PSA10' },
      { jpyPrice: 9500, grade: 'PSA10' },
      { jpyPrice: 10000, grade: 'PSA10' },
      { jpyPrice: 10500, grade: 'PSA10' },
      { jpyPrice: 11000, grade: 'PSA10' },
      { jpyPrice: 65000, grade: 'PSA10' }, // 8 cards bundled at ¥8,125 each
    ];

    const flagged = flagSuspectedBulk(records);
    const median = computeMedian(records.map(r => r.jpyPrice));

    // Median should be around 9,750 (average of 9,000 and 10,500 for 8 items)
    expect(median).toBe(9750);

    // 65,000 > 4 * 9,750 = 39,000 → should be flagged
    const bulkRecord = flagged.find(r => r.jpyPrice === 65000);
    expect(bulkRecord?.isSuspectedBulk).toBe(true);

    // Normal records should not be flagged
    const normalRecords = flagged.filter(r => r.jpyPrice !== 65000);
    expect(normalRecords.every(r => !r.isSuspectedBulk)).toBe(true);
  });
});
