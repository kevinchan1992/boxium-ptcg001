import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { getUserWatchlist, addToWatchlist, removeFromWatchlist } from './profile';
import * as db from './db';

describe('Profile Page Fix - Watchlist Data Structure', () => {
  let testUserId: number;
  let testCardId: number;

  beforeAll(async () => {
    // Use a fixed test user ID (admin user)
    testUserId = 1; // Assuming admin user exists with ID 1

    // Get a card from database for testing
    const cards = await db.searchCards('Pikachu', 1);
    if (cards.length === 0) {
      throw new Error('No cards found in database for testing');
    }
    testCardId = cards[0].id;
  });

  // Clean up before each test
  beforeEach(async () => {
    try {
      await removeFromWatchlist(testUserId, testCardId);
    } catch (e) {
      // Ignore error if not in watchlist
    }
  });

  // Clean up after each test
  afterEach(async () => {
    try {
      await removeFromWatchlist(testUserId, testCardId);
    } catch (e) {
      // Ignore error if not in watchlist
    }
  });

  it('should return watchlist with correct nested structure', async () => {
    // Add a card to watchlist first
    await addToWatchlist(testUserId, testCardId, 'Test note');

    // Get watchlist
    const watchlist = await getUserWatchlist(testUserId);

    // Verify watchlist is an array
    expect(Array.isArray(watchlist)).toBe(true);

    if (watchlist.length > 0) {
      const item = watchlist[0];

      // Verify top-level properties exist
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('notes');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('card');
      expect(item).toHaveProperty('latestPrice');
      expect(item).toHaveProperty('currency');

      // Verify nested card object exists and has correct structure
      expect(item.card).toBeDefined();
      expect(item.card).toHaveProperty('id');
      expect(item.card).toHaveProperty('name');
      expect(item.card).toHaveProperty('cardNumber');
      expect(item.card).toHaveProperty('series');
      expect(item.card).toHaveProperty('setName');
      expect(item.card).toHaveProperty('rarity');
      expect(item.card).toHaveProperty('imageUrl');

      // Verify card.id is not undefined (this was the original error)
      expect(item.card.id).toBeDefined();
      expect(typeof item.card.id).toBe('number');

      // Verify card.name is not undefined
      expect(item.card.name).toBeDefined();
      expect(typeof item.card.name).toBe('string');
    }
  });

  it('should handle empty watchlist correctly', async () => {
    // Ensure watchlist is empty
    const watchlist = await getUserWatchlist(999999); // Non-existent user

    // Verify watchlist is an empty array
    expect(Array.isArray(watchlist)).toBe(true);
    expect(watchlist.length).toBe(0);
  });

  it('should include card details in watchlist items', async () => {
    // Add a card to watchlist
    await addToWatchlist(testUserId, testCardId, 'Test card details');

    // Get watchlist
    const watchlist = await getUserWatchlist(testUserId);

    // Find the test item
    const testItem = watchlist.find((item: any) => item.card.id === testCardId);

    // Verify item exists
    expect(testItem).toBeDefined();

    if (testItem) {
      // Verify card details are populated
      expect(testItem.card.id).toBe(testCardId);
      expect(testItem.card.name).toBeTruthy();
      expect(testItem.notes).toBe('Test card details');

      // Verify currency defaults to HKD if no price history
      expect(testItem.currency).toBe('HKD');
    }
  });

  it('should not throw error when accessing item.card.id', async () => {
    // Add a card to watchlist
    await addToWatchlist(testUserId, testCardId, 'Test access');

    // Get watchlist
    const watchlist = await getUserWatchlist(testUserId);

    // This should not throw "Cannot read properties of undefined (reading 'id')"
    expect(() => {
      watchlist.forEach((item: any) => {
        const cardId = item.card.id; // This was causing the error
        const cardName = item.card.name;
        expect(cardId).toBeDefined();
        expect(cardName).toBeDefined();
      });
    }).not.toThrow();
  });
});
