/**
 * Tests for server/utils/priceValidator.ts
 * Covers: grade normalisation, minimum price thresholds, IQR outlier filtering,
 * and the top-level validateAndFilterPriceHistory function.
 */
import { describe, it, expect } from 'vitest';
import {
  normaliseGrade,
  isAboveMinimumPrice,
  filterOutliersByIQR,
  validateAndFilterPriceHistory,
} from './utils/priceValidator';

// ─── normaliseGrade ────────────────────────────────────────────────────────────

describe('normaliseGrade', () => {
  it('normalises "PSA 10" (with space) → "PSA10"', () => {
    expect(normaliseGrade('PSA 10')).toBe('PSA10');
  });

  it('normalises "PSA10" (no space) → "PSA10"', () => {
    expect(normaliseGrade('PSA10')).toBe('PSA10');
  });

  it('normalises "PSA 9" → "PSA9"', () => {
    expect(normaliseGrade('PSA 9')).toBe('PSA9');
  });

  it('normalises "PSA8以下" → "PSA8以下"', () => {
    expect(normaliseGrade('PSA8以下')).toBe('PSA8以下');
  });

  it('normalises "BGS 10" → "BGS10"', () => {
    expect(normaliseGrade('BGS 10')).toBe('BGS10');
  });

  it('normalises "A" → "A"', () => {
    expect(normaliseGrade('A')).toBe('A');
  });

  it('normalises "B" → "B"', () => {
    expect(normaliseGrade('B')).toBe('B');
  });

  it('returns undefined for null/undefined', () => {
    expect(normaliseGrade(null as any)).toBeUndefined();
    expect(normaliseGrade(undefined as any)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(normaliseGrade('')).toBeUndefined();
  });
});

// ─── isAboveMinimumPrice ───────────────────────────────────────────────────────

describe('isAboveMinimumPrice', () => {
  it('accepts PSA10 price above JPY 10000', () => {
    expect(isAboveMinimumPrice(15000, 'PSA10')).toBe(true);
  });

  it('rejects PSA10 price below JPY 10000', () => {
    expect(isAboveMinimumPrice(9999, 'PSA10')).toBe(false);
  });

  it('accepts PSA10 price of JPY 21000 (above minimum threshold)', () => {
    // JPY 21,000 passes the minimum threshold (≥10,000).
    // It is a statistical outlier for expensive cards like サトシのピカチュウ SM-P 076
    // (market range JPY 180,000–210,000), but the minimum-price check cannot
    // distinguish card-specific outliers — that is handled by filterOutliersByIQR.
    expect(isAboveMinimumPrice(21000, 'PSA10')).toBe(true);
  });

  it('accepts PSA10 price at exactly JPY 10000 (boundary)', () => {
    expect(isAboveMinimumPrice(10000, 'PSA10')).toBe(true);
  });

  it('accepts PSA9 price above JPY 3000', () => {
    expect(isAboveMinimumPrice(5000, 'PSA9')).toBe(true);
  });

  it('rejects PSA9 price below JPY 3000', () => {
    expect(isAboveMinimumPrice(2999, 'PSA9')).toBe(false);
  });

  it('accepts ungraded (B) price above JPY 500', () => {
    expect(isAboveMinimumPrice(1000, 'B')).toBe(true);
  });

  it('rejects ungraded price below JPY 500', () => {
    expect(isAboveMinimumPrice(499, 'B')).toBe(false);
  });

  it('accepts sealed_product with no minimum (any price > 0)', () => {
    expect(isAboveMinimumPrice(100, undefined, 'sealed_product')).toBe(true);
  });
});

// ─── filterOutliersByIQR ──────────────────────────────────────────────────────

describe('filterOutliersByIQR', () => {
  it('returns all entries when fewer than 5 (not enough for IQR)', () => {
    const entries = [
      { price: 10000, jpyPrice: 10000, soldAt: new Date() },
      { price: 11000, jpyPrice: 11000, soldAt: new Date() },
      { price: 12000, jpyPrice: 12000, soldAt: new Date() },
    ];
    expect(filterOutliersByIQR(entries, 'PSA10')).toHaveLength(3);
  });

  it('removes extreme low outliers (3× IQR rule)', () => {
    // Normal cluster: 100000-120000 JPY; extreme outlier: 1000 JPY
    const entries = [
      { price: 100000, jpyPrice: 100000, soldAt: new Date() },
      { price: 105000, jpyPrice: 105000, soldAt: new Date() },
      { price: 110000, jpyPrice: 110000, soldAt: new Date() },
      { price: 115000, jpyPrice: 115000, soldAt: new Date() },
      { price: 120000, jpyPrice: 120000, soldAt: new Date() },
      { price: 1000, jpyPrice: 1000, soldAt: new Date() }, // extreme outlier
    ];
    const result = filterOutliersByIQR(entries, 'PSA10');
    expect(result.some(e => e.jpyPrice === 1000)).toBe(false);
    expect(result).toHaveLength(5);
  });

  it('removes extreme high outliers (3× IQR rule)', () => {
    // Normal cluster: 10000-15000 JPY; extreme outlier: 500000 JPY
    const entries = [
      { price: 10000, jpyPrice: 10000, soldAt: new Date() },
      { price: 11000, jpyPrice: 11000, soldAt: new Date() },
      { price: 12000, jpyPrice: 12000, soldAt: new Date() },
      { price: 13000, jpyPrice: 13000, soldAt: new Date() },
      { price: 15000, jpyPrice: 15000, soldAt: new Date() },
      { price: 500000, jpyPrice: 500000, soldAt: new Date() }, // extreme outlier
    ];
    const result = filterOutliersByIQR(entries, 'PSA10');
    expect(result.some(e => e.jpyPrice === 500000)).toBe(false);
    expect(result).toHaveLength(5);
  });

  it('keeps all entries when no extreme outliers exist', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      price: 100000 + i * 1000,
      jpyPrice: 100000 + i * 1000,
      soldAt: new Date(),
    }));
    expect(filterOutliersByIQR(entries, 'PSA10')).toHaveLength(10);
  });

  /**
   * Real-world scenario: サトシのピカチュウ SM-P 076
   * Market range: JPY 180,000–210,000
   * Anomalous record: JPY 21,000 (passes minimum threshold but is a clear outlier)
   * Expected: IQR filter removes the JPY 21,000 record
   */
  it('removes JPY 21000 outlier from サトシのピカチュウ SM-P 076 price cluster', () => {
    const entries = [
      { price: 180000, jpyPrice: 180000, soldAt: new Date() },
      { price: 185000, jpyPrice: 185000, soldAt: new Date() },
      { price: 190000, jpyPrice: 190000, soldAt: new Date() },
      { price: 200000, jpyPrice: 200000, soldAt: new Date() },
      { price: 210000, jpyPrice: 210000, soldAt: new Date() },
      { price: 21000,  jpyPrice: 21000,  soldAt: new Date() }, // anomalous record (HKD 1155)
    ];
    const result = filterOutliersByIQR(entries, 'PSA10');
    // The JPY 21,000 record should be filtered out
    expect(result.some(e => e.jpyPrice === 21000)).toBe(false);
    // All normal records should be kept
    expect(result).toHaveLength(5);
    // Average of remaining records should be ~193,000 JPY (≈HKD 10,600)
    const avg = result.reduce((sum, e) => sum + (e.jpyPrice ?? e.price), 0) / result.length;
    expect(avg).toBeGreaterThan(180000);
    expect(avg).toBeLessThan(215000);
  });
});

// ─── validateAndFilterPriceHistory ────────────────────────────────────────────

describe('validateAndFilterPriceHistory', () => {
  it('filters out PSA10 records below JPY 10000 minimum', () => {
    const raw = [
      { price: 5000, grade: 'PSA 10', soldAt: new Date() }, // below PSA10 minimum
      { price: 210000, grade: 'PSA 10', soldAt: new Date() }, // normal
    ];
    const result = validateAndFilterPriceHistory(raw, 'single_card');
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(210000);
  });

  it('normalises grade "PSA 10" → "PSA10" in output', () => {
    const raw = [
      { price: 150000, grade: 'PSA 10', soldAt: new Date() },
    ];
    const result = validateAndFilterPriceHistory(raw, 'single_card');
    expect(result[0].normalisedGrade).toBe('PSA10');
  });

  it('keeps non-PSA10 records (B, PSA9) with appropriate minimums', () => {
    const raw = [
      { price: 5000, grade: 'B', soldAt: new Date() },   // above B minimum (500)
      { price: 400, grade: 'B', soldAt: new Date() },    // below B minimum
      { price: 35000, grade: 'PSA 9', soldAt: new Date() }, // above PSA9 minimum
    ];
    const result = validateAndFilterPriceHistory(raw, 'single_card');
    expect(result).toHaveLength(2);
    expect(result.some(r => r.price === 400)).toBe(false);
  });

  it('does not apply grade minimum for sealed_product', () => {
    const raw = [
      { price: 500, grade: null, soldAt: new Date() },
      { price: 50000, grade: null, soldAt: new Date() },
    ];
    const result = validateAndFilterPriceHistory(raw, 'sealed_product');
    expect(result).toHaveLength(2);
  });

  it('handles empty input gracefully', () => {
    expect(validateAndFilterPriceHistory([], 'single_card')).toEqual([]);
  });

  it('handles null/undefined grade gracefully', () => {
    const raw = [
      { price: 5000, grade: null, soldAt: new Date() },
      { price: 5000, grade: undefined, soldAt: new Date() },
    ];
    // null/undefined grade → no grade minimum applied (treated as unknown)
    const result = validateAndFilterPriceHistory(raw, 'single_card');
    expect(result).toHaveLength(2);
  });

  it('applies IQR filter to remove outliers within a grade group', () => {
    // 5 normal PSA10 records + 1 extreme outlier (very low price that passes min threshold)
    const raw = [
      { price: 180000, grade: 'PSA10', soldAt: new Date() },
      { price: 185000, grade: 'PSA10', soldAt: new Date() },
      { price: 190000, grade: 'PSA10', soldAt: new Date() },
      { price: 200000, grade: 'PSA10', soldAt: new Date() },
      { price: 210000, grade: 'PSA10', soldAt: new Date() },
      { price: 21000,  grade: 'PSA10', soldAt: new Date() }, // passes min (≥10000) but outlier
    ];
    const result = validateAndFilterPriceHistory(raw, 'single_card');
    // JPY 21000 should be filtered by IQR even though it passes the minimum threshold
    expect(result.some(r => r.price === 21000)).toBe(false);
    expect(result).toHaveLength(5);
  });
});
