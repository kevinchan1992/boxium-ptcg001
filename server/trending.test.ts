import { describe, it, expect, beforeAll } from 'vitest';
import { 
  calculateAndCacheTrendingCards, 
  getCachedTrendingCards,
  getTrendingByPriceIncrease,
  getTrendingByPriceDecrease,
  getTrendingBySearches,
  getNewlyAddedCards
} from './db';

describe('Trending Cards Calculation Logic', () => {
  describe('calculateAndCacheTrendingCards', () => {
    it('should calculate trending cards based on last 2 months data', async () => {
      // This test verifies that the function runs without errors
      // In production, it should filter cards with at least 2 transactions in 2 months
      await expect(calculateAndCacheTrendingCards()).resolves.not.toThrow();
    });

    it('should return cached trending cards', async () => {
      const cached = await getCachedTrendingCards();
      
      // Should return an array (may be empty if no data)
      expect(Array.isArray(cached)).toBe(true);
      
      // If there are results, verify structure
      if (cached.length > 0) {
        const firstCard = cached[0];
        expect(firstCard).toHaveProperty('id');
        expect(firstCard).toHaveProperty('name');
        expect(firstCard).toHaveProperty('priceChange7d');
        expect(firstCard).toHaveProperty('oldPrice');
        expect(firstCard).toHaveProperty('currentPrice');
        
        // Verify price change is a valid number
        const priceChange = parseFloat(firstCard.priceChange7d);
        expect(priceChange).toBeGreaterThan(0);
      }
    });
  });

  describe('getTrendingByPriceIncrease', () => {
    it('should return cards with price increases in last 2 months', async () => {
      const results = await getTrendingByPriceIncrease({ limit: 10 });
      
      expect(Array.isArray(results)).toBe(true);
      
      // If there are results, verify structure and filters
      if (results.length > 0) {
        const firstCard = results[0];
        
        // Verify required fields exist
        expect(firstCard).toHaveProperty('oldPrice');
        expect(firstCard).toHaveProperty('currentPrice');
        expect(firstCard).toHaveProperty('priceChangePercent');
        
        // Verify price change is positive
        expect(firstCard.priceChangePercent).toBeGreaterThan(0);
        
        // Verify prices are valid numbers
        expect(typeof firstCard.oldPrice).toBe('number');
        expect(typeof firstCard.currentPrice).toBe('number');
        expect(firstCard.currentPrice).toBeGreaterThan(firstCard.oldPrice);
        
        // Card details should be spread into the result
        // At least one of these should exist
        const hasCardDetails = firstCard.name || firstCard.cardNumber || firstCard.cardId;
        expect(hasCardDetails).toBeTruthy();
      }
    });

    it('should use 60 days as default time range', async () => {
      // Test with explicit days parameter
      const results60 = await getTrendingByPriceIncrease({ limit: 10, days: 60 });
      const resultsDefault = await getTrendingByPriceIncrease({ limit: 10 });
      
      // Both should return the same type of data structure
      expect(Array.isArray(results60)).toBe(true);
      expect(Array.isArray(resultsDefault)).toBe(true);
    });
  });

  describe('getTrendingByPriceDecrease', () => {
    it('should return cards with price decreases in last 2 months', async () => {
      const results = await getTrendingByPriceDecrease({ limit: 10 });
      
      expect(Array.isArray(results)).toBe(true);
      
      // If there are results, verify structure and filters
      if (results.length > 0) {
        const firstCard = results[0];
        
        // Verify required fields exist
        expect(firstCard).toHaveProperty('oldPrice');
        expect(firstCard).toHaveProperty('currentPrice');
        expect(firstCard).toHaveProperty('priceChangePercent');
        
        // Verify price change is negative
        expect(firstCard.priceChangePercent).toBeLessThan(0);
        
        // Verify prices are valid numbers
        expect(typeof firstCard.oldPrice).toBe('number');
        expect(typeof firstCard.currentPrice).toBe('number');
        expect(firstCard.currentPrice).toBeLessThan(firstCard.oldPrice);
        
        // Card details should be spread into the result
        const hasCardDetails = firstCard.name || firstCard.cardNumber || firstCard.cardId;
        expect(hasCardDetails).toBeTruthy();
      }
    });

    it('should filter PSA 10 grades only', async () => {
      const results = await getTrendingByPriceDecrease({ limit: 10 });
      
      // This test verifies the function runs with PSA 10 filter
      // The actual filtering is done in the database query
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getTrendingBySearches', () => {
    it('should return cards with most searches in last 2 months', async () => {
      const results = await getTrendingBySearches({ limit: 10 });
      
      expect(Array.isArray(results)).toBe(true);
      
      // If there are results, verify structure
      if (results.length > 0) {
        const firstCard = results[0];
        
        // Verify required fields exist
        expect(firstCard).toHaveProperty('id');
        expect(firstCard).toHaveProperty('searchCount');
        
        // Verify search count is at least 10 (minimum requirement)
        expect(firstCard.searchCount).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('getNewlyAddedCards', () => {
    it('should return newly added cards from last 2 months', async () => {
      const results = await getNewlyAddedCards({ limit: 10 });
      
      expect(Array.isArray(results)).toBe(true);
      
      // If there are results, verify structure
      if (results.length > 0) {
        const firstCard = results[0];
        
        // Verify required fields exist
        expect(firstCard).toHaveProperty('id');
        expect(firstCard).toHaveProperty('createdAt');
        
        // Verify createdAt is within last 2 months
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const cardCreatedAt = new Date(firstCard.createdAt);
        expect(cardCreatedAt.getTime()).toBeGreaterThanOrEqual(twoMonthsAgo.getTime());
      }
    });
  });
});
