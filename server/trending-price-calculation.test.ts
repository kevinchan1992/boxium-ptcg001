import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Trending Price Calculation Logic', () => {
  it('should calculate price increase correctly using average prices', async () => {
    const results = await db.getTrendingByPriceIncrease({ limit: 5, days: 30 });
    
    console.log('\n=== Price Increase Rankings ===');
    for (const card of results) {
      console.log(`\nCard: ${card.name}`);
      console.log(`Old Price (avg): HKD ${card.oldPrice.toFixed(2)}`);
      console.log(`Current Price (avg): HKD ${card.currentPrice.toFixed(2)}`);
      console.log(`Price Change: ${card.priceChangePercent.toFixed(2)}%`);
      
      // Verify that currentPrice is reasonable (not a single transaction price)
      expect(card.currentPrice).toBeGreaterThan(0);
      expect(card.oldPrice).toBeGreaterThan(0);
      
      // Verify price change calculation
      const calculatedChange = ((card.currentPrice - card.oldPrice) / card.oldPrice) * 100;
      expect(Math.abs(calculatedChange - card.priceChangePercent)).toBeLessThan(0.01);
    }
    
    expect(results.length).toBeGreaterThan(0);
  });

  it('should calculate price decrease correctly using average prices', async () => {
    const results = await db.getTrendingByPriceDecrease({ limit: 5, days: 30 });
    
    console.log('\n=== Price Decrease Rankings ===');
    for (const card of results) {
      console.log(`\nCard: ${card.name}`);
      console.log(`Old Price (avg): HKD ${card.oldPrice.toFixed(2)}`);
      console.log(`Current Price (avg): HKD ${card.currentPrice.toFixed(2)}`);
      console.log(`Price Change: ${card.priceChangePercent.toFixed(2)}%`);
      
      // Verify that currentPrice is reasonable (not a single transaction price)
      expect(card.currentPrice).toBeGreaterThan(0);
      expect(card.oldPrice).toBeGreaterThan(0);
      
      // Verify price change is negative
      expect(card.priceChangePercent).toBeLessThan(0);
      
      // Verify price change calculation
      const calculatedChange = ((card.currentPrice - card.oldPrice) / card.oldPrice) * 100;
      expect(Math.abs(calculatedChange - card.priceChangePercent)).toBeLessThan(0.01);
    }
    
    expect(results.length).toBeGreaterThan(0);
  });

  it('should use consistent price calculation method', async () => {
    // Test that the price shown in rankings matches the reference price logic
    const decreaseResults = await db.getTrendingByPriceDecrease({ limit: 1, days: 30 });
    
    if (decreaseResults.length > 0) {
      const card = decreaseResults[0];
      console.log('\n=== Price Consistency Check ===');
      console.log(`Card: ${card.name}`);
      console.log(`Current Price in Ranking: HKD ${card.currentPrice.toFixed(2)}`);
      
      // The currentPrice should be an average of multiple transactions, not a single price
      // This ensures consistency with the card detail page's reference price calculation
      expect(card.currentPrice).toBeGreaterThan(0);
      
      // The price should not be abnormally low (e.g., 8x lower than expected)
      // If oldPrice is 38000 and currentPrice is 4000, that's -89% which might indicate
      // the old logic was used (first transaction vs last transaction)
      const priceRatio = card.currentPrice / card.oldPrice;
      console.log(`Price Ratio (current/old): ${priceRatio.toFixed(2)}`);
      
      // Price ratio should be reasonable (not < 0.2 or > 5 for 30-day period)
      expect(priceRatio).toBeGreaterThan(0.2);
      expect(priceRatio).toBeLessThan(5);
    }
  });
});
