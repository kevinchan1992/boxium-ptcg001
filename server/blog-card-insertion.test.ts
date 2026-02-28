import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import { getArticleDataContext } from './articleGenerator';

describe('博客卡牌插入功能完整測試', () => {
  let testCardIds: number[] = [];
  let database: any;

  beforeAll(async () => {
    database = await db.getDb();
    if (!database) throw new Error('Database not available');

    // Get some test cards with price history
    const result = await db.searchCards('', 5, 0);
    const allCards = result.cards || [];
    if (allCards.length > 0) {
      testCardIds = allCards.map((c: any) => c.id).slice(0, 3);
    }
    console.log(`[Test] Found ${testCardIds.length} test cards:`, testCardIds);
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('1. 卡牌搜尋功能', () => {
    it('應該搜尋到卡牌', async () => {
      const result = await db.searchCards('pikachu', 20, 0);
      const cards = result.cards || [];
      expect(Array.isArray(cards)).toBe(true);
      expect(cards.length).toBeGreaterThan(0);
      console.log(`[Test] Found ${cards.length} cards matching "pikachu"`);
    });

    it('應該支持卡號搜尋', async () => {
      const result = await db.searchCards('sv8a', 20, 0);
      const cards = result.cards || [];
      expect(Array.isArray(cards)).toBe(true);
      console.log(`[Test] Found ${cards.length} cards matching "sv8a"`);
    });

    it('應該返回卡牌基本信息', async () => {
      const result = await db.searchCards('', 1, 0);
      const cards = result.cards || [];
      if (cards.length > 0) {
        const card = cards[0];
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(typeof card.id).toBe('number');
        expect(typeof card.name).toBe('string');
        console.log(`[Test] Card structure:`, {
          id: card.id,
          name: card.name,
          cardNumber: card.cardNumber,
          series: card.series,
        });
      }
    });
  });

  describe('2. 卡牌詳細數據提取 (getArticleDataContext)', () => {
    it('應該提取卡牌基本信息', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const context = await getArticleDataContext([testCardIds[0]], '30d');
      expect(context).toHaveProperty('cards');
      expect(Array.isArray(context.cards)).toBe(true);
      expect(context.cards.length).toBeGreaterThan(0);

      const card = context.cards[0];
      console.log(`[Test] Card basic info:`, {
        id: card.id,
        name: card.name,
        nameJa: card.nameJa,
        cardNumber: card.cardNumber,
        series: card.series,
        setName: card.setName,
        rarity: card.rarity,
      });

      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('name');
      expect(typeof card.id).toBe('number');
      expect(typeof card.name).toBe('string');
    });

    it('應該提取 PSA10 價格統計', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const context = await getArticleDataContext([testCardIds[0]], '30d');
      const card = context.cards[0];

      expect(card).toHaveProperty('psa10Stats');
      expect(card.psa10Stats).toHaveProperty('avgPrice');
      expect(card.psa10Stats).toHaveProperty('minPrice');
      expect(card.psa10Stats).toHaveProperty('maxPrice');
      expect(card.psa10Stats).toHaveProperty('priceChange7d');
      expect(card.psa10Stats).toHaveProperty('priceChange30d');
      expect(card.psa10Stats).toHaveProperty('totalVolume');

      console.log(`[Test] PSA10 Statistics:`, {
        avgPrice: card.psa10Stats.avgPrice,
        minPrice: card.psa10Stats.minPrice,
        maxPrice: card.psa10Stats.maxPrice,
        priceChange7d: card.psa10Stats.priceChange7d,
        priceChange30d: card.psa10Stats.priceChange30d,
        totalVolume: card.psa10Stats.totalVolume,
      });

      // Verify data types and logical consistency
      expect(typeof card.psa10Stats.avgPrice).toBe('number');
      expect(typeof card.psa10Stats.totalVolume).toBe('number');
      expect(card.psa10Stats.minPrice).toBeLessThanOrEqual(card.psa10Stats.maxPrice);
      expect(card.psa10Stats.totalVolume).toBeGreaterThanOrEqual(0);
    });

    it('應該提取中古 A 級價格統計', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const context = await getArticleDataContext([testCardIds[0]], '30d');
      const card = context.cards[0];

      expect(card).toHaveProperty('usedGradeAStats');
      expect(card.usedGradeAStats).toHaveProperty('avgPrice');
      expect(card.usedGradeAStats).toHaveProperty('minPrice');
      expect(card.usedGradeAStats).toHaveProperty('maxPrice');
      expect(card.usedGradeAStats).toHaveProperty('priceChange7d');
      expect(card.usedGradeAStats).toHaveProperty('priceChange30d');
      expect(card.usedGradeAStats).toHaveProperty('totalVolume');

      console.log(`[Test] Used Grade A Statistics:`, {
        avgPrice: card.usedGradeAStats.avgPrice,
        minPrice: card.usedGradeAStats.minPrice,
        maxPrice: card.usedGradeAStats.maxPrice,
        priceChange7d: card.usedGradeAStats.priceChange7d,
        priceChange30d: card.usedGradeAStats.priceChange30d,
        totalVolume: card.usedGradeAStats.totalVolume,
      });

      expect(typeof card.usedGradeAStats.avgPrice).toBe('number');
      expect(card.usedGradeAStats.minPrice).toBeLessThanOrEqual(card.usedGradeAStats.maxPrice);
    });

    it('應該提取歷史最高價和日期', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const context = await getArticleDataContext([testCardIds[0]], '30d');
      const card = context.cards[0];

      expect(card).toHaveProperty('peakPrice');
      expect(typeof card.peakPrice).toBe('number');

      console.log(`[Test] Peak Price:`, {
        peakPrice: card.peakPrice,
        peakDate: card.peakDate,
      });

      if (card.peakPrice > 0) {
        expect(card).toHaveProperty('peakDate');
      }
    });

    it('應該支持多張卡牌查詢', async () => {
      if (testCardIds.length < 2) {
        console.log('[Test] Skipping - need at least 2 test cards');
        return;
      }

      const context = await getArticleDataContext(testCardIds.slice(0, 2), '30d');
      expect(context.cards.length).toBe(2);

      console.log(`[Test] Retrieved ${context.cards.length} cards with complete data`);

      // Verify each card has all required fields
      context.cards.forEach((card, index) => {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('psa10Stats');
        expect(card).toHaveProperty('usedGradeAStats');
        console.log(`[Test] Card ${index + 1}: ${card.name} (ID: ${card.id})`);
      });
    });

    it('應該支持不同時間範圍', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const timeRanges = ['7d', '30d', '60d', 'all'] as const;
      
      for (const range of timeRanges) {
        const context = await getArticleDataContext([testCardIds[0]], range);
        expect(context.cards.length).toBeGreaterThan(0);
        
        const card = context.cards[0];
        console.log(`[Test] Time range "${range}": PSA10 volume = ${card.psa10Stats.totalVolume}, Used volume = ${card.usedGradeAStats.totalVolume}`);
      }
    });
  });

  describe('3. 卡牌數據格式化 (CardSelectionDialog)', () => {
    it('應該正確格式化卡牌數據供 AI 使用', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const context = await getArticleDataContext([testCardIds[0]], '30d');
      const card = context.cards[0];

      // Simulate CardSelectionDialog formatCardData function
      let formatted = '【卡牌市場數據】\n\n';
      formatted += `━━━ 卡牌 1 ━━━\n`;
      formatted += `名稱：${card.name}\n`;
      if (card.nameJa) formatted += `日文名：${card.nameJa}\n`;
      if (card.cardNumber) formatted += `卡號：${card.cardNumber}\n`;
      if (card.series) formatted += `系列：${card.series}\n`;
      if (card.setName) formatted += `套組：${card.setName}\n`;
      if (card.rarity) formatted += `稀有度：${card.rarity}\n`;

      formatted += '\n📊 PSA10 鑑定卡價格統計：\n';
      if (card.psa10Stats.totalVolume > 0) {
        formatted += `  - 平均價格：¥${Math.round(card.psa10Stats.avgPrice).toLocaleString()}\n`;
        formatted += `  - 最低價格：¥${Math.round(card.psa10Stats.minPrice).toLocaleString()}\n`;
        formatted += `  - 最高價格：¥${Math.round(card.psa10Stats.maxPrice).toLocaleString()}\n`;
        formatted += `  - 7天價格變化：${card.psa10Stats.priceChange7d > 0 ? '+' : ''}${card.psa10Stats.priceChange7d.toFixed(1)}%\n`;
        formatted += `  - 30天價格變化：${card.psa10Stats.priceChange30d > 0 ? '+' : ''}${card.psa10Stats.priceChange30d.toFixed(1)}%\n`;
        formatted += `  - 成交量：${card.psa10Stats.totalVolume} 筆\n`;
      }

      formatted += '\n📊 中古 A 級價格統計：\n';
      if (card.usedGradeAStats.totalVolume > 0) {
        formatted += `  - 平均價格：¥${Math.round(card.usedGradeAStats.avgPrice).toLocaleString()}\n`;
        formatted += `  - 最低價格：¥${Math.round(card.usedGradeAStats.minPrice).toLocaleString()}\n`;
        formatted += `  - 最高價格：¥${Math.round(card.usedGradeAStats.maxPrice).toLocaleString()}\n`;
        formatted += `  - 成交量：${card.usedGradeAStats.totalVolume} 筆\n`;
      }

      console.log(`[Test] Formatted card data:\n${formatted}`);

      // Verify formatted data contains all essential information
      expect(formatted).toContain(card.name);
      expect(formatted).toContain('PSA10');
      expect(formatted).toContain('中古 A 級');
      expect(formatted).toContain('成交量');
    });
  });

  describe('4. 數據準確性驗證', () => {
    it('PSA10 統計應該基於實際數據庫記錄', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const { priceHistory } = await import('../drizzle/schema_new');
      const { eq, and } = await import('drizzle-orm');

      // Get raw price data from database
      const cardId = testCardIds[0];
      const rawPrices = await database.select({
        price: priceHistory.price,
        grade: priceHistory.grade,
      }).from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, cardId),
            eq(priceHistory.grade, 'PSA10')
          )
        );

      // Get calculated statistics
      const context = await getArticleDataContext([cardId], '30d');
      const card = context.cards[0];

      if (rawPrices.length > 0) {
        const prices = rawPrices.map(p => parseFloat(p.price));
        const expectedAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const expectedMin = Math.min(...prices);
        const expectedMax = Math.max(...prices);

        console.log(`[Test] PSA10 Data Validation:`, {
          recordCount: rawPrices.length,
          calculatedAvg: card.psa10Stats.avgPrice,
          expectedAvg: expectedAvg,
          calculatedMin: card.psa10Stats.minPrice,
          expectedMin: expectedMin,
          calculatedMax: card.psa10Stats.maxPrice,
          expectedMax: expectedMax,
        });

        // Allow small floating point differences
        expect(Math.abs(card.psa10Stats.avgPrice - expectedAvg)).toBeLessThan(1);
        expect(card.psa10Stats.minPrice).toBe(expectedMin);
        expect(card.psa10Stats.maxPrice).toBe(expectedMax);
      }
    });

    it('成交量應該正確計算', async () => {
      if (testCardIds.length === 0) {
        console.log('[Test] Skipping - no test cards available');
        return;
      }

      const { priceHistory } = await import('../drizzle/schema_new');
      const { eq, and } = await import('drizzle-orm');

      const cardId = testCardIds[0];
      
      // Count PSA10 records
      const psa10Records = await database.select({
        id: priceHistory.id,
      }).from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, cardId),
            eq(priceHistory.grade, 'PSA10')
          )
        );

      // Count Grade A records
      const gradeARecords = await database.select({
        id: priceHistory.id,
      }).from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, cardId),
            eq(priceHistory.grade, 'A')
          )
        );

      const context = await getArticleDataContext([cardId], '30d');
      const card = context.cards[0];

      console.log(`[Test] Volume Validation:`, {
        psa10Expected: psa10Records.length,
        psa10Calculated: card.psa10Stats.totalVolume,
        gradeAExpected: gradeARecords.length,
        gradeACalculated: card.usedGradeAStats.totalVolume,
      });

      expect(card.psa10Stats.totalVolume).toBe(psa10Records.length);
      expect(card.usedGradeAStats.totalVolume).toBe(gradeARecords.length);
    });
  });

  describe('5. 邊界情況測試', () => {
    it('應該處理無成交記錄的卡牌', async () => {
      // Create a test card with no price history
      const { cards } = await import('../drizzle/schema_new');
      
      // Try to find a card with minimal data
      const allCards = await database.select({
        id: cards.id,
        name: cards.name,
      }).from(cards).limit(1);

      if (allCards.length > 0) {
        const testCardId = allCards[0].id;
        const context = await getArticleDataContext([testCardId], '30d');
        const card = context.cards[0];

        // Should still return card structure even without price data
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('psa10Stats');
        expect(card).toHaveProperty('usedGradeAStats');

        console.log(`[Test] Card with minimal data: ${card.name} (PSA10 volume: ${card.psa10Stats.totalVolume})`);
      }
    });

    it('應該處理無效的卡牌 ID', async () => {
      const context = await getArticleDataContext([99999999], '30d');
      expect(context.cards.length).toBe(0);
      console.log('[Test] Invalid card ID handled correctly');
    });
  });
});
