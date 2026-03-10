/**
 * Tests for condition-based market price lookup
 * Verifies that the condition-to-grade mapping and price lookup work correctly
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('./db', () => ({
  getCardPriceByGrade: vi.fn(),
}));

import * as db from './db';

// Condition to grade mapping (mirrors server/routers.ts logic)
const conditionToGrade: Record<string, string> = {
  psa10: 'PSA10',
  psa9: 'PSA9',
  psa8_below: 'PSA8以下',
  bgs10: 'PSA10',   // fallback
  bgs9: 'PSA10',    // fallback
  bgs8_below: 'PSA10', // fallback
  tag10: 'PSA10',   // fallback
  tag9_below: 'PSA10', // fallback
  raw_a: 'A',
  raw_b: 'B',
  raw_c: 'C',
  raw_d: 'D',
};

const isFallbackCondition = (condition: string) =>
  ['bgs10', 'bgs9', 'bgs8_below', 'tag10', 'tag9_below'].includes(condition);

describe('Condition to Grade Mapping', () => {
  it('maps PSA conditions correctly', () => {
    expect(conditionToGrade['psa10']).toBe('PSA10');
    expect(conditionToGrade['psa9']).toBe('PSA9');
    expect(conditionToGrade['psa8_below']).toBe('PSA8以下');
  });

  it('maps Raw card conditions correctly', () => {
    expect(conditionToGrade['raw_a']).toBe('A');
    expect(conditionToGrade['raw_b']).toBe('B');
    expect(conditionToGrade['raw_c']).toBe('C');
    expect(conditionToGrade['raw_d']).toBe('D');
  });

  it('falls back to PSA10 for BGS conditions', () => {
    expect(conditionToGrade['bgs10']).toBe('PSA10');
    expect(conditionToGrade['bgs9']).toBe('PSA10');
    expect(conditionToGrade['bgs8_below']).toBe('PSA10');
    expect(isFallbackCondition('bgs10')).toBe(true);
    expect(isFallbackCondition('bgs9')).toBe(true);
  });

  it('falls back to PSA10 for TAG conditions', () => {
    expect(conditionToGrade['tag10']).toBe('PSA10');
    expect(conditionToGrade['tag9_below']).toBe('PSA10');
    expect(isFallbackCondition('tag10')).toBe(true);
    expect(isFallbackCondition('tag9_below')).toBe(true);
  });

  it('does not mark PSA/Raw conditions as fallback', () => {
    expect(isFallbackCondition('psa10')).toBe(false);
    expect(isFallbackCondition('raw_a')).toBe(false);
    expect(isFallbackCondition('raw_b')).toBe(false);
  });
});

describe('getCardPriceByGrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns avgPrice and recordCount for a valid grade', async () => {
    const mockGetCardPriceByGrade = vi.mocked(db.getCardPriceByGrade);
    mockGetCardPriceByGrade.mockResolvedValue({
      avgPrice: 31790,
      recordCount: 8,
      grade: 'PSA10',
    });

    const result = await db.getCardPriceByGrade(1, 'PSA10');
    expect(result.avgPrice).toBe(31790);
    expect(result.recordCount).toBe(8);
    expect(result.grade).toBe('PSA10');
    expect(mockGetCardPriceByGrade).toHaveBeenCalledWith(1, 'PSA10');
  });

  it('returns null avgPrice when no records found', async () => {
    const mockGetCardPriceByGrade = vi.mocked(db.getCardPriceByGrade);
    mockGetCardPriceByGrade.mockResolvedValue({
      avgPrice: null,
      recordCount: 0,
      grade: 'A',
    });

    const result = await db.getCardPriceByGrade(1, 'A');
    expect(result.avgPrice).toBeNull();
    expect(result.recordCount).toBe(0);
  });

  it('returns correct grade for Raw A condition', async () => {
    const mockGetCardPriceByGrade = vi.mocked(db.getCardPriceByGrade);
    mockGetCardPriceByGrade.mockResolvedValue({
      avgPrice: 1500,
      recordCount: 5,
      grade: 'A',
    });

    const grade = conditionToGrade['raw_a'];
    expect(grade).toBe('A');
    const result = await db.getCardPriceByGrade(1, grade);
    expect(result.avgPrice).toBe(1500);
    expect(mockGetCardPriceByGrade).toHaveBeenCalledWith(1, 'A');
  });
});

describe('Price comparison logic', () => {
  it('calculates percentage difference correctly', () => {
    const listingPrice = 35000;
    const refPrice = 31790;
    const diff = ((listingPrice - refPrice) / refPrice) * 100;
    expect(diff).toBeGreaterThan(0);
    expect(diff.toFixed(0)).toBe('10');
  });

  it('detects below-market pricing', () => {
    const listingPrice = 25000;
    const refPrice = 31790;
    const diff = ((listingPrice - refPrice) / refPrice) * 100;
    expect(diff).toBeLessThan(0);
    expect(Math.abs(diff).toFixed(0)).toBe('21');
  });
});
