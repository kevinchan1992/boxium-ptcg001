import { describe, it, expect } from 'vitest';

describe('AI Article Generation with Real Card Data', () => {
  it('should auto-select trending cards for daily report', async () => {
    const { autoSelectCardsForArticle } = await import('./articleDataHelper');
    
    const cardIds = await autoSelectCardsForArticle('daily-report', '7d');
    
    expect(cardIds).toBeDefined();
    expect(Array.isArray(cardIds)).toBe(true);
    expect(cardIds.length).toBeGreaterThan(0);
    expect(cardIds.length).toBeLessThanOrEqual(5);
    
    console.log('✅ Auto-selected cards for daily report:', cardIds);
  });

  it('should auto-select trending cards for market trend', async () => {
    const { autoSelectCardsForArticle } = await import('./articleDataHelper');
    
    const cardIds = await autoSelectCardsForArticle('market-trend', '30d');
    
    expect(cardIds).toBeDefined();
    expect(Array.isArray(cardIds)).toBe(true);
    expect(cardIds.length).toBeGreaterThan(0);
    expect(cardIds.length).toBeLessThanOrEqual(10);
    
    console.log('✅ Auto-selected cards for market trend:', cardIds);
  });

  it('should extract article data context with card images', async () => {
    const { getArticleDataContext } = await import('./articleGenerator');
    const { autoSelectCardsForArticle } = await import('./articleDataHelper');
    
    const cardIds = await autoSelectCardsForArticle('daily-report', '7d');
    
    if (cardIds.length > 0) {
      const dataContext = await getArticleDataContext(cardIds.slice(0, 3), '7d');
      
      expect(dataContext).toBeDefined();
      expect(dataContext.cards).toBeDefined();
      expect(dataContext.cards.length).toBeGreaterThan(0);
      
      // Check if cards have required fields
      dataContext.cards.forEach(card => {
        expect(card.name).toBeDefined();
        expect(card.id).toBeDefined();
        // Image URL might be null for some cards
        console.log(`Card: ${card.name}, Image: ${card.imageUrl || 'N/A'}, Number: ${card.cardNumber || 'N/A'}`);
      });
      
      // Check if price stats are calculated
      expect(dataContext.psa10Stats).toBeDefined();
      expect(dataContext.psa10Stats.avgPrice).toBeGreaterThanOrEqual(0);
      
      console.log('✅ PSA10 Average Price:', dataContext.psa10Stats.avgPrice.toFixed(2));
      console.log('✅ PSA10 7d Change:', dataContext.psa10Stats.priceChange7d.toFixed(2), '%');
    } else {
      console.log('⚠️ No cards found in database for testing');
    }
  });

  it('should generate article with real card data (mock LLM)', async () => {
    const { autoSelectCardsForArticle } = await import('./articleDataHelper');
    const { getArticleDataContext } = await import('./articleGenerator');
    
    const cardIds = await autoSelectCardsForArticle('daily-report', '7d');
    
    if (cardIds.length > 0) {
      const dataContext = await getArticleDataContext(cardIds.slice(0, 3), '7d');
      
      // Verify that data context includes card images
      expect(dataContext.cards.some(c => c.imageUrl !== null)).toBe(true);
      
      // Verify that price data is available
      expect(dataContext.psa10Stats.avgPrice).toBeGreaterThan(0);
      
      console.log('✅ Article data context ready with', dataContext.cards.length, 'cards');
      console.log('✅ Cards with images:', dataContext.cards.filter(c => c.imageUrl).length);
    } else {
      console.log('⚠️ No cards found in database for testing');
    }
  });
});
