import { describe, it, expect } from 'vitest';
import { getArticleDataContext } from './articleGenerator';

describe('AI Article Generation with Database Price Data', () => {
  it('should fetch PSA10 and Used Grade A price data from database', async () => {
    // Test with a known card ID (assuming card ID 1 exists)
    const cardIds = [1];
    const context = await getArticleDataContext(cardIds, '30d');

    // Verify structure
    expect(context).toHaveProperty('cards');
    expect(context).toHaveProperty('psa10Stats');
    expect(context).toHaveProperty('usedGradeAStats');
    expect(context).toHaveProperty('transactionStats');

    // Verify PSA10 stats structure
    expect(context.psa10Stats).toHaveProperty('avgPrice');
    expect(context.psa10Stats).toHaveProperty('minPrice');
    expect(context.psa10Stats).toHaveProperty('maxPrice');
    expect(context.psa10Stats).toHaveProperty('priceChange7d');
    expect(context.psa10Stats).toHaveProperty('priceChange30d');
    expect(context.psa10Stats).toHaveProperty('priceChange60d');
    expect(context.psa10Stats).toHaveProperty('totalVolume');
    expect(context.psa10Stats).toHaveProperty('avgDailyVolume');

    // Verify Used Grade A stats structure
    expect(context.usedGradeAStats).toHaveProperty('avgPrice');
    expect(context.usedGradeAStats).toHaveProperty('minPrice');
    expect(context.usedGradeAStats).toHaveProperty('maxPrice');
    expect(context.usedGradeAStats).toHaveProperty('priceChange7d');
    expect(context.usedGradeAStats).toHaveProperty('priceChange30d');
    expect(context.usedGradeAStats).toHaveProperty('priceChange60d');
    expect(context.usedGradeAStats).toHaveProperty('totalVolume');
    expect(context.usedGradeAStats).toHaveProperty('avgDailyVolume');

    // Verify transaction stats structure
    expect(context.transactionStats).toHaveProperty('peakPrice');
    expect(context.transactionStats).toHaveProperty('peakDate');
  });

  it('should return numeric values for all price statistics', async () => {
    const cardIds = [1];
    const context = await getArticleDataContext(cardIds, '30d');

    // PSA10 stats should be numbers
    expect(typeof context.psa10Stats.avgPrice).toBe('number');
    expect(typeof context.psa10Stats.minPrice).toBe('number');
    expect(typeof context.psa10Stats.maxPrice).toBe('number');
    expect(typeof context.psa10Stats.priceChange7d).toBe('number');
    expect(typeof context.psa10Stats.priceChange30d).toBe('number');
    expect(typeof context.psa10Stats.priceChange60d).toBe('number');
    expect(typeof context.psa10Stats.totalVolume).toBe('number');
    expect(typeof context.psa10Stats.avgDailyVolume).toBe('number');

    // Used Grade A stats should be numbers
    expect(typeof context.usedGradeAStats.avgPrice).toBe('number');
    expect(typeof context.usedGradeAStats.minPrice).toBe('number');
    expect(typeof context.usedGradeAStats.maxPrice).toBe('number');
    expect(typeof context.usedGradeAStats.priceChange7d).toBe('number');
    expect(typeof context.usedGradeAStats.priceChange30d).toBe('number');
    expect(typeof context.usedGradeAStats.priceChange60d).toBe('number');
    expect(typeof context.usedGradeAStats.totalVolume).toBe('number');
    expect(typeof context.usedGradeAStats.avgDailyVolume).toBe('number');

    // Transaction stats should be numbers or null
    expect(typeof context.transactionStats.peakPrice).toBe('number');
  });

  it('should handle different time ranges', async () => {
    const cardIds = [1];
    
    const context7d = await getArticleDataContext(cardIds, '7d');
    const context30d = await getArticleDataContext(cardIds, '30d');
    const context60d = await getArticleDataContext(cardIds, '60d');

    // All should return valid contexts
    expect(context7d).toBeDefined();
    expect(context30d).toBeDefined();
    expect(context60d).toBeDefined();

    // Longer time ranges may have more transaction volume
    // (This is not guaranteed, but we can at least check the structure)
    expect(context7d.psa10Stats.totalVolume).toBeGreaterThanOrEqual(0);
    expect(context30d.psa10Stats.totalVolume).toBeGreaterThanOrEqual(0);
    expect(context60d.psa10Stats.totalVolume).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple card IDs', async () => {
    const cardIds = [1, 2, 3];
    const context = await getArticleDataContext(cardIds, '30d');

    // Should return data for all cards (or at least try to)
    expect(context.cards.length).toBeGreaterThan(0);
    expect(context.cards.length).toBeLessThanOrEqual(cardIds.length);
  });

  it('should return zero values when no price data is available', async () => {
    // Use a card ID that likely has no price data
    const cardIds = [999999];
    const context = await getArticleDataContext(cardIds, '30d');

    // Should return zero values for stats
    expect(context.psa10Stats.avgPrice).toBe(0);
    expect(context.psa10Stats.minPrice).toBe(0);
    expect(context.psa10Stats.maxPrice).toBe(0);
    expect(context.psa10Stats.totalVolume).toBe(0);

    expect(context.usedGradeAStats.avgPrice).toBe(0);
    expect(context.usedGradeAStats.minPrice).toBe(0);
    expect(context.usedGradeAStats.maxPrice).toBe(0);
    expect(context.usedGradeAStats.totalVolume).toBe(0);
  });
});
