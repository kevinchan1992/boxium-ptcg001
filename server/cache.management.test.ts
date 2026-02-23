import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Cache Management', () => {
  let testCardId: number;

  beforeAll(async () => {
    // Get a card from database for testing
    const cards = await db.searchCards('Pikachu', 1);
    if (cards.length === 0) {
      throw new Error('No cards found in database for testing');
    }
    testCardId = cards[0].id;
  });

  it('should get all cache list with pagination', async () => {
    const result = await db.getAllSnkrdunkCacheList(1, 20);
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page');
    expect(result).toHaveProperty('pageSize');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('should return cache list with card information', async () => {
    const result = await db.getAllSnkrdunkCacheList(1, 5);
    
    if (result.data.length > 0) {
      const cache = result.data[0];
      expect(cache).toHaveProperty('id');
      expect(cache).toHaveProperty('cardId');
      expect(cache).toHaveProperty('snkrdunkId');
      expect(cache).toHaveProperty('listings');
      expect(cache).toHaveProperty('hotExpiresAt');
      expect(cache).toHaveProperty('expiresAt');
      expect(cache).toHaveProperty('createdAt');
      expect(cache).toHaveProperty('cardName');
      expect(cache).toHaveProperty('cardNumber');
      expect(cache).toHaveProperty('cardImageUrl');
      expect(cache).toHaveProperty('itemCount');
      expect(typeof cache.itemCount).toBe('number');
    }
  });

  it('should save and retrieve SNKRDUNK cache', async () => {
    const testData = {
      cardId: testCardId,
      snkrdunkId: 'test-123',
      listings: JSON.stringify([
        { title: 'Test Item 1', price: 1000 },
        { title: 'Test Item 2', price: 2000 },
      ]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
    };

    // Save cache
    await db.saveSnkrdunkListingsCache(testData);

    // Retrieve cache
    const cached = await db.getSnkrdunkListingsCache(testCardId);
    expect(cached).toBeDefined();
    expect(cached?.cardId).toBe(testCardId);
    expect(cached?.snkrdunkId).toBe('test-123');
    
    const listings = JSON.parse(cached?.listings || '[]');
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('Test Item 1');
  });

  it('should clear cache by cardId', async () => {
    // Ensure cache exists
    const testData = {
      cardId: testCardId,
      snkrdunkId: 'test-456',
      listings: JSON.stringify([{ title: 'Test Item', price: 1000 }]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    await db.saveSnkrdunkListingsCache(testData);

    // Clear cache
    const deletedCount = await db.clearSnkrdunkCacheByCardId(testCardId);
    expect(deletedCount).toBeGreaterThanOrEqual(0);

    // Verify cache is cleared
    const cached = await db.getSnkrdunkListingsCache(testCardId);
    expect(cached).toBeNull();
  });

  it('should get cache statistics', async () => {
    // Add a test cache
    const testData = {
      cardId: testCardId,
      snkrdunkId: 'test-789',
      listings: JSON.stringify([{ title: 'Test Item', price: 1000 }]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    await db.saveSnkrdunkListingsCache(testData);

    const stats = await db.getSnkrdunkCacheStats();
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('totalCount');
    expect(stats).toHaveProperty('oldestCache');
    expect(stats).toHaveProperty('newestCache');
    expect(typeof stats.totalCount).toBe('number');
    expect(stats.totalCount).toBeGreaterThan(0);
  });

  it('should handle pagination correctly', async () => {
    const page1 = await db.getAllSnkrdunkCacheList(1, 5);
    const page2 = await db.getAllSnkrdunkCacheList(2, 5);

    expect(page1.page).toBe(1);
    expect(page2.page).toBe(2);
    expect(page1.pageSize).toBe(5);
    expect(page2.pageSize).toBe(5);

    // If there are more than 5 records, page 2 should have different data
    if (page1.total > 5) {
      expect(page1.data[0]?.id).not.toBe(page2.data[0]?.id);
    }
  });

  it('should count items correctly in cache listings', async () => {
    const testData = {
      cardId: testCardId,
      snkrdunkId: 'test-count',
      listings: JSON.stringify([
        { title: 'Item 1', price: 1000 },
        { title: 'Item 2', price: 2000 },
        { title: 'Item 3', price: 3000 },
      ]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    await db.saveSnkrdunkListingsCache(testData);

    const result = await db.getAllSnkrdunkCacheList(1, 20);
    const cache = result.data.find(c => c.cardId === testCardId);
    
    expect(cache).toBeDefined();
    expect(cache?.itemCount).toBe(3);
  });
});
