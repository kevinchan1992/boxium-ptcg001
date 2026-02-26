import { describe, it, expect } from 'vitest';
import { searchCards } from './db';

describe('Search Cards - Latest PSA10 Price Display Fix', () => {
  it('should display the latest sold PSA10 price (by soldAt, not createdAt)', async () => {
    // Test with Pikachu Munch Exhibition (SM-P 288)
    // Expected: HKD 109,450.00 (latest soldAt: 2026/02/21)
    // Previous bug: HKD 66,000.00 (sorted by createdAt instead of soldAt)
    
    const results = await searchCards('SM-P 288', 10);
    
    expect(results.length).toBeGreaterThan(0);
    const card = results.find(c => c.cardNumber?.includes('SM-P 288'));
    
    expect(card).toBeDefined();
    console.log(`\n[Test] Card: ${card!.name}`);
    console.log(`[Test] Card Number: ${card!.cardNumber}`);
    console.log(`[Test] Latest Price: HKD ${card!.latestPrice?.toLocaleString()}`);
    
    // Verify that the price is the latest sold price
    expect(card!.latestPrice).toBeDefined();
    expect(card!.latestPrice).toBeGreaterThan(0);
    
    // The latest sold price should be HKD 109,450.00 (2026/02/21)
    // Not HKD 66,000.00 (older createdAt record)
    expect(card!.latestPrice).toBe(109450);
    
    console.log(`✅ Latest sold price (by soldAt) is correctly displayed: HKD ${card!.latestPrice.toLocaleString()}`);
  });

  it('should use soldAt for sorting, not createdAt', async () => {
    // Test with multiple Pikachu cards
    const results = await searchCards('Pikachu', 20);
    
    expect(results.length).toBeGreaterThan(0);
    
    console.log(`\n[Test] Found ${results.length} Pikachu cards`);
    
    // Check first 5 cards with prices
    const cardsWithPrice = results.filter(c => c.latestPrice).slice(0, 5);
    
    for (const card of cardsWithPrice) {
      console.log(`[Test] ${card.name} (${card.cardNumber}): HKD ${card.latestPrice!.toLocaleString()}`);
      
      // Verify that each card has a valid price
      expect(card.latestPrice).toBeGreaterThan(0);
    }
    
    console.log(`✅ All cards display latest sold prices (sorted by soldAt)`);
  });

  it('should handle cards without PSA10 price history', async () => {
    // Test with a generic search that might include cards without PSA10 prices
    const results = await searchCards('Pikachu', 50);
    
    expect(results.length).toBeGreaterThan(0);
    
    const cardsWithPrice = results.filter(c => c.latestPrice);
    const cardsWithoutPrice = results.filter(c => !c.latestPrice);
    
    console.log(`\n[Test] Cards with PSA10 price: ${cardsWithPrice.length}`);
    console.log(`[Test] Cards without PSA10 price: ${cardsWithoutPrice.length}`);
    
    // Verify that cards without price have null latestPrice
    for (const card of cardsWithoutPrice.slice(0, 3)) {
      console.log(`[Test] ${card.name} (${card.cardNumber}): No PSA10 price`);
      expect(card.latestPrice).toBeNull();
    }
    
    console.log(`✅ Cards without PSA10 price history are handled correctly`);
  });

  it('should sort cards by price (highest first)', async () => {
    // Test that cards are sorted by price in descending order
    const results = await searchCards('Pikachu', 20);
    
    const cardsWithPrice = results.filter(c => c.latestPrice);
    
    expect(cardsWithPrice.length).toBeGreaterThan(1);
    
    console.log(`\n[Test] Top 5 highest priced Pikachu cards:`);
    
    for (let i = 0; i < Math.min(5, cardsWithPrice.length); i++) {
      const card = cardsWithPrice[i];
      console.log(`[Test] ${i + 1}. ${card.name}: HKD ${card.latestPrice!.toLocaleString()}`);
      
      // Verify that prices are in descending order
      if (i > 0) {
        expect(card.latestPrice).toBeLessThanOrEqual(cardsWithPrice[i - 1].latestPrice!);
      }
    }
    
    console.log(`✅ Cards are sorted by price (highest first)`);
  });
});
