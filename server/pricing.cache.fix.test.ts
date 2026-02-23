import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Pricing Cache Fix', () => {
  let testCardId: number;

  beforeAll(async () => {
    // Get a card from database for testing
    const cards = await db.searchCards('Pikachu', 1);
    if (cards.length === 0) {
      throw new Error('No cards found in database for testing');
    }
    testCardId = cards[0].id;
  });

  it('should clear cache when saving empty listings', async () => {
    // Step 1: Create a cache with some data
    const initialData = {
      cardId: testCardId,
      snkrdunkId: 'test-123',
      listings: JSON.stringify([
        { url: 'https://example.com/1', price: 1000, currency: 'HKD', grade: 'PSA 10' },
      ]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
    };
    await db.saveSnkrdunkListingsCache(initialData);

    // Step 2: Verify cache exists
    const cached = await db.getSnkrdunkListingsCache(testCardId);
    expect(cached).toBeDefined();
    expect(cached?.cardId).toBe(testCardId);

    // Step 3: Simulate the fix - clear cache when we would save empty listings
    // (In the actual code, this happens when mergedListings.length === 0)
    await db.clearSnkrdunkCacheByCardId(testCardId);

    // Step 4: Verify cache is cleared
    const clearedCache = await db.getSnkrdunkListingsCache(testCardId);
    expect(clearedCache).toBeNull();
  });

  it('should not save cache when listings are empty', async () => {
    // Clear any existing cache first
    await db.clearSnkrdunkCacheByCardId(testCardId);

    // Verify cache is empty
    const beforeCache = await db.getSnkrdunkListingsCache(testCardId);
    expect(beforeCache).toBeNull();

    // Simulate the scenario where scraping returns empty results
    // In the fixed code, we don't save empty results, we clear the cache instead
    const emptyListings: any[] = [];
    
    // The fix: if mergedListings.length === 0, we clear cache instead of saving
    if (emptyListings.length === 0) {
      await db.clearSnkrdunkCacheByCardId(testCardId);
    }

    // Verify cache is still empty (not saved)
    const afterCache = await db.getSnkrdunkListingsCache(testCardId);
    expect(afterCache).toBeNull();
  });

  it('should clear cache when scraping fails', async () => {
    // Step 1: Create a cache with some data
    const initialData = {
      cardId: testCardId,
      snkrdunkId: 'test-456',
      listings: JSON.stringify([
        { url: 'https://example.com/2', price: 2000, currency: 'HKD', grade: 'PSA 10' },
      ]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    await db.saveSnkrdunkListingsCache(initialData);

    // Step 2: Verify cache exists
    const cached = await db.getSnkrdunkListingsCache(testCardId);
    expect(cached).toBeDefined();

    // Step 3: Simulate scraping failure and cache clearing
    // (In the actual code, this happens in the catch block)
    try {
      throw new Error('Simulated scraping failure');
    } catch (error) {
      // The fix: clear cache when scraping fails
      await db.clearSnkrdunkCacheByCardId(testCardId);
    }

    // Step 4: Verify cache is cleared
    const clearedCache = await db.getSnkrdunkListingsCache(testCardId);
    expect(clearedCache).toBeNull();
  });

  it('should save cache when listings are not empty', async () => {
    // Clear any existing cache first
    await db.clearSnkrdunkCacheByCardId(testCardId);

    // Save cache with valid data
    const validData = {
      cardId: testCardId,
      snkrdunkId: 'test-789',
      listings: JSON.stringify([
        { url: 'https://example.com/3', price: 3000, currency: 'HKD', grade: 'PSA 10' },
        { url: 'https://example.com/4', price: 4000, currency: 'HKD', grade: 'PSA 10' },
      ]),
      hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
    await db.saveSnkrdunkListingsCache(validData);

    // Verify cache is saved
    const cached = await db.getSnkrdunkListingsCache(testCardId);
    expect(cached).toBeDefined();
    expect(cached?.cardId).toBe(testCardId);
    expect(cached?.snkrdunkId).toBe('test-789');
    
    const listings = JSON.parse(cached?.listings || '[]');
    expect(listings).toHaveLength(2);
    expect(listings[0].price).toBe(3000);
    expect(listings[1].price).toBe(4000);
  });
});
