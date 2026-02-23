import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('SNKRDUNK ID Support', () => {
  it('should retrieve card by snkrdunkId', async () => {
    // First, get a card that has snkrdunkId
    const cards = await db.getAllCards();
    const cardWithSnkrdunkId = cards.find(c => c.snkrdunkId);
    
    expect(cardWithSnkrdunkId).toBeTruthy();
    
    if (cardWithSnkrdunkId) {
      console.log(`Testing with card: ${cardWithSnkrdunkId.name} (snkrdunkId: ${cardWithSnkrdunkId.snkrdunkId})`);
      
      // Test getCardBySnkrdunkId
      const retrievedCard = await db.getCardBySnkrdunkId(cardWithSnkrdunkId.snkrdunkId!);
      
      expect(retrievedCard).toBeTruthy();
      expect(retrievedCard?.id).toBe(cardWithSnkrdunkId.id);
      expect(retrievedCard?.name).toBe(cardWithSnkrdunkId.name);
      expect(retrievedCard?.snkrdunkId).toBe(cardWithSnkrdunkId.snkrdunkId);
      
      console.log(`✓ Successfully retrieved card by snkrdunkId: ${cardWithSnkrdunkId.snkrdunkId}`);
    }
  });

  it('should return undefined for non-existent snkrdunkId', async () => {
    const nonExistentId = '99999999';
    const card = await db.getCardBySnkrdunkId(nonExistentId);
    
    expect(card).toBeUndefined();
    console.log(`✓ Correctly returned undefined for non-existent snkrdunkId: ${nonExistentId}`);
  });

  it('should have snkrdunkId populated for cards with SNKRDUNK data source', async () => {
    // Get all cards with SNKRDUNK data source
    const allCards = await db.getAllCards();
    const cardsWithSnkrdunkId = allCards.filter(c => c.snkrdunkId);
    
    console.log(`Found ${cardsWithSnkrdunkId.length} cards with snkrdunkId populated`);
    
    expect(cardsWithSnkrdunkId.length).toBeGreaterThan(0);
    
    // Verify snkrdunkId format (should be numeric string, may include # for variants)
    cardsWithSnkrdunkId.forEach(card => {
      expect(card.snkrdunkId).toMatch(/^\d+(#\d+)?$/);
    });
    
    console.log(`✓ All snkrdunkId values are in correct format (numeric string)`);
  });
});
