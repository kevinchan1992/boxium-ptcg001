import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Sealed Product Data Source Logic', () => {
  let testSealedProductId: number;

  beforeAll(async () => {
    // Create a test sealed product
    testSealedProductId = await db.createSealedProduct({
      gameId: 1, // Pokémon TCG
      name: 'Test Booster Box',
      nameJa: 'テストブースターボックス',
      boxType: 'booster_box',
    });
  });

  it('should create a sealed product successfully', async () => {
    const sealedProduct = await db.getSealedProductById(testSealedProductId);
    
    expect(sealedProduct).toBeDefined();
    expect(sealedProduct?.name).toBe('Test Booster Box');
    expect(sealedProduct?.nameJa).toBe('テストブースターボックス');
    expect(sealedProduct?.gameId).toBe(1);
    expect(sealedProduct?.boxType).toBe('booster_box');
  });

  it('should add price history with quantity field for sealed products', async () => {
    // Add price history with quantity (for sealed products)
    await db.addPriceHistory({
      cardId: testSealedProductId, // This is actually a sealed product ID
      source: 'snkrdunk',
      price: '1000',
      currency: 'HKD',
      quantity: '10盒', // Quantity field for sealed products
      productType: 'sealed_product',
      soldAt: new Date(),
    });

    // Get price history
    const priceHistory = await db.getPriceHistory(testSealedProductId, 'snkrdunk', undefined, 1, 1);
    
    expect(priceHistory.length).toBeGreaterThan(0);
    expect(priceHistory[0].quantity).toBe('10盒');
    expect(priceHistory[0].productType).toBe('sealed_product');
  });

  it('should verify migrated sealed product (ID 1) exists', async () => {
    // Verify the migrated sealed product from card ID 1080001
    const sealedProduct = await db.getSealedProductById(1);
    
    expect(sealedProduct).toBeDefined();
    expect(sealedProduct?.name).toBe('Pokemon Card Game MEGA Expansion Pack "Inferno X" Box');
    expect(sealedProduct?.nameJa).toBe('ポケモンカードゲームMEGA 拡張パック「インフェルノX」ボックス');
    expect(sealedProduct?.gameId).toBe(1);
    expect(sealedProduct?.boxType).toBe('booster_box');
  });

  it('should verify migrated price history has correct productType', async () => {
    // Get price history for the migrated sealed product
    const priceHistory = await db.getPriceHistory(1, 'snkrdunk', undefined, 1, 10);
    
    expect(priceHistory.length).toBeGreaterThan(0);
    
    // All price history records should have productType = 'sealed_product'
    const allSealed = priceHistory.every(p => p.productType === 'sealed_product');
    expect(allSealed).toBe(true);
  });

  it('should verify old card ID 1080001 no longer exists in cards table', async () => {
    // This card should have been deleted from cards table
    const card = await db.getCardById(1080001);
    
    expect(card).toBeUndefined();
  });
});
