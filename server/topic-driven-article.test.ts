import { describe, it, expect } from 'vitest';

describe('Topic-Driven Article Generation', () => {
  it('should extract keywords from topic', async () => {
    const { extractKeywordsFromTopic } = await import('./topicCardSearch');
    
    const topic1 = 'pikachu 卡牌2月升降報導';
    const keywords1 = extractKeywordsFromTopic(topic1);
    
    expect(keywords1).toContain('pikachu');
    expect(keywords1.length).toBeGreaterThan(0);
    
    console.log('✅ Topic 1:', topic1);
    console.log('✅ Keywords 1:', keywords1);
    
    const topic2 = '伊布 進化系列 價格分析';
    const keywords2 = extractKeywordsFromTopic(topic2);
    
    expect(keywords2).toContain('伊布');
    expect(keywords2.length).toBeGreaterThan(0);
    
    console.log('✅ Topic 2:', topic2);
    console.log('✅ Keywords 2:', keywords2);
  });

  it('should search cards by name (English)', async () => {
    const { searchCardsByName } = await import('./topicCardSearch');
    
    const results = await searchCardsByName('pikachu', 10);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    if (results.length > 0) {
      console.log('✅ Found', results.length, 'Pikachu cards');
      console.log('✅ First card:', results[0].name, results[0].nameJa);
    } else {
      console.log('⚠️ No Pikachu cards found in database');
    }
  });

  it('should search cards by name (Japanese)', async () => {
    const { searchCardsByName } = await import('./topicCardSearch');
    
    const results = await searchCardsByName('ピカチュウ', 10);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    
    if (results.length > 0) {
      console.log('✅ Found', results.length, 'ピカチュウ cards');
      console.log('✅ First card:', results[0].name, results[0].nameJa);
    } else {
      console.log('⚠️ No ピカチュウ cards found in database');
    }
  });

  it('should extract card IDs from topic', async () => {
    const { extractCardIdsFromTopic } = await import('./topicCardSearch');
    
    const topic = 'pikachu 卡牌2月升降報導';
    const cardIds = await extractCardIdsFromTopic(topic, 20);
    
    expect(cardIds).toBeDefined();
    expect(Array.isArray(cardIds)).toBe(true);
    
    if (cardIds.length > 0) {
      console.log('✅ Extracted', cardIds.length, 'card IDs from topic:', topic);
      console.log('✅ Card IDs:', cardIds.slice(0, 5), '...');
    } else {
      console.log('⚠️ No cards found for topic:', topic);
    }
  });

  it('should generate article with topic-driven card search', async () => {
    const { extractCardIdsFromTopic } = await import('./topicCardSearch');
    const { getArticleDataContext } = await import('./articleGenerator');
    
    const topic = 'pikachu 卡牌2月升降報導';
    const cardIds = await extractCardIdsFromTopic(topic, 10);
    
    if (cardIds.length > 0) {
      const dataContext = await getArticleDataContext(cardIds.slice(0, 5), '30d');
      
      expect(dataContext).toBeDefined();
      expect(dataContext.cards).toBeDefined();
      expect(dataContext.cards.length).toBeGreaterThan(0);
      
      console.log('✅ Article data context ready with', dataContext.cards.length, 'Pikachu cards');
      console.log('✅ Cards:', dataContext.cards.map(c => c.name).join(', '));
      console.log('✅ PSA10 Average Price:', dataContext.psa10Stats.avgPrice.toFixed(2), 'HKD');
      console.log('✅ PSA10 30d Change:', dataContext.psa10Stats.priceChange30d.toFixed(2), '%');
    } else {
      console.log('⚠️ No Pikachu cards found in database for testing');
    }
  });
});
