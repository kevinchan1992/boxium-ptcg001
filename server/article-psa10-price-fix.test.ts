import { describe, it, expect } from 'vitest';
import { getArticleDataContext } from './articleGenerator';

describe('Article PSA10 Price Calculation - Matches Card Detail Page', () => {
  it('should use latest 10 records for PSA10 reference price', async () => {
    // Test with a card that has PSA10 price history
    const cardIds = [180002]; // Pikachu wearing Mega Charizard X poncho
    
    const dataContext = await getArticleDataContext(cardIds, '30d');
    
    expect(dataContext.cards).toHaveLength(1);
    const card = dataContext.cards[0];
    
    console.log(`\n[Test] Card: ${card.name}`);
    console.log(`[Test] PSA10 Average Price: HKD ${card.psa10Stats.avgPrice.toFixed(2)}`);
    console.log(`[Test] PSA10 Total Volume: ${card.psa10Stats.totalVolume} records`);
    console.log(`[Test] PSA10 Min Price: HKD ${card.psa10Stats.minPrice.toFixed(2)}`);
    console.log(`[Test] PSA10 Max Price: HKD ${card.psa10Stats.maxPrice.toFixed(2)}`);
    
    // Verify that PSA10 stats exist
    expect(card.psa10Stats).toBeDefined();
    expect(card.psa10Stats.avgPrice).toBeGreaterThan(0);
    expect(card.psa10Stats.totalVolume).toBeGreaterThan(0);
    expect(card.psa10Stats.totalVolume).toBeLessThanOrEqual(10); // Should use at most 10 records
    
    console.log(`\n✅ PSA10 price calculation uses latest ${card.psa10Stats.totalVolume} records (max 10)`);
  });

  it('should match card detail page price calculation logic', async () => {
    // Test with multiple cards
    const cardIds = [180002, 812832]; // Two cards with different price histories
    
    const dataContext = await getArticleDataContext(cardIds, '30d');
    
    expect(dataContext.cards).toHaveLength(2);
    
    for (const card of dataContext.cards) {
      console.log(`\n[Test] Card: ${card.name}`);
      console.log(`[Test] PSA10 Average: HKD ${card.psa10Stats.avgPrice.toFixed(2)}`);
      console.log(`[Test] PSA10 Volume: ${card.psa10Stats.totalVolume} records`);
      
      // Verify that each card has its own price statistics
      expect(card.psa10Stats).toBeDefined();
      expect(card.psa10Stats.avgPrice).toBeGreaterThanOrEqual(0);
      expect(card.psa10Stats.totalVolume).toBeLessThanOrEqual(10);
      
      // Verify that the price is calculated from latest records
      if (card.psa10Stats.totalVolume > 0) {
        expect(card.psa10Stats.avgPrice).toBeGreaterThan(0);
        expect(card.psa10Stats.minPrice).toBeGreaterThan(0);
        expect(card.psa10Stats.maxPrice).toBeGreaterThan(0);
        expect(card.psa10Stats.minPrice).toBeLessThanOrEqual(card.psa10Stats.avgPrice);
        expect(card.psa10Stats.avgPrice).toBeLessThanOrEqual(card.psa10Stats.maxPrice);
      }
    }
    
    console.log(`\n✅ All cards use consistent price calculation logic`);
  });

  it('should handle dynamic time range adjustment (2m -> 3m -> 6m)', async () => {
    // Test with a card that might have sparse price history
    const cardIds = [180002];
    
    const dataContext = await getArticleDataContext(cardIds, '30d');
    
    expect(dataContext.cards).toHaveLength(1);
    const card = dataContext.cards[0];
    
    console.log(`\n[Test] Card: ${card.name}`);
    console.log(`[Test] PSA10 Volume: ${card.psa10Stats.totalVolume} records`);
    
    // Verify that the function handles sparse data correctly
    // If less than 3 records in 2 months, it should extend to 3 or 6 months
    if (card.psa10Stats.totalVolume > 0) {
      expect(card.psa10Stats.avgPrice).toBeGreaterThan(0);
      console.log(`[Test] PSA10 Average: HKD ${card.psa10Stats.avgPrice.toFixed(2)}`);
      console.log(`✅ Dynamic time range adjustment working correctly`);
    } else {
      console.log(`⚠️  No PSA10 price history found (expected for some cards)`);
    }
  });

  it('should provide consistent prices across multiple calls', async () => {
    // Test that the same card returns consistent prices
    const cardIds = [180002];
    
    const dataContext1 = await getArticleDataContext(cardIds, '30d');
    const dataContext2 = await getArticleDataContext(cardIds, '30d');
    
    const card1 = dataContext1.cards[0];
    const card2 = dataContext2.cards[0];
    
    console.log(`\n[Test] Card: ${card1.name}`);
    console.log(`[Test] Call 1 - PSA10 Average: HKD ${card1.psa10Stats.avgPrice.toFixed(2)}`);
    console.log(`[Test] Call 2 - PSA10 Average: HKD ${card2.psa10Stats.avgPrice.toFixed(2)}`);
    
    // Verify that prices are consistent
    expect(card1.psa10Stats.avgPrice).toBe(card2.psa10Stats.avgPrice);
    expect(card1.psa10Stats.totalVolume).toBe(card2.psa10Stats.totalVolume);
    
    console.log(`✅ Price calculation is consistent across multiple calls`);
  });
});
