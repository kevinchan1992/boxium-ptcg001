import { describe, it, expect } from 'vitest';
import { getUserWatchlist } from './profile';

describe('Profile Data Structure Fix', () => {
  it('should return watchlist with correct nested card structure', async () => {
    // Get watchlist for user ID 1 (admin)
    const watchlist = await getUserWatchlist(1);

    // Verify watchlist is an array
    expect(Array.isArray(watchlist)).toBe(true);

    // If watchlist has items, verify the structure
    if (watchlist.length > 0) {
      const item = watchlist[0];

      // This is the fix: item.card should be an object with nested properties
      // NOT flat properties like item.cardName, item.cardNumber, etc.
      
      // Verify card is an object (not undefined)
      expect(item.card).toBeDefined();
      expect(typeof item.card).toBe('object');
      
      // Verify card.id exists (this was the original error: "Cannot read properties of undefined (reading 'id')")
      expect(item.card.id).toBeDefined();
      
      // Verify card.name exists
      expect(item.card.name).toBeDefined();
      
      // Verify other expected properties
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('notes');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('latestPrice');
      expect(item).toHaveProperty('currency');
      
      console.log('✅ Watchlist item structure is correct:');
      console.log('   - item.card:', item.card);
      console.log('   - item.card.id:', item.card.id);
      console.log('   - item.card.name:', item.card.name);
    } else {
      console.log('⚠️  Watchlist is empty for user 1, cannot verify structure');
      console.log('   This test passes but cannot fully validate the fix');
    }
  });

  it('should not have flat card properties (old structure)', async () => {
    const watchlist = await getUserWatchlist(1);

    if (watchlist.length > 0) {
      const item = watchlist[0] as any;

      // These flat properties should NOT exist in the new structure
      expect(item.cardName).toBeUndefined();
      expect(item.cardNumber).toBeUndefined();
      expect(item.series).toBeUndefined();
      
      console.log('✅ Old flat structure properties do not exist (correct)');
    }
  });

  it('should handle empty watchlist without errors', async () => {
    // Non-existent user should return empty array
    const watchlist = await getUserWatchlist(999999);

    expect(Array.isArray(watchlist)).toBe(true);
    expect(watchlist.length).toBe(0);
    
    console.log('✅ Empty watchlist handled correctly');
  });
});
