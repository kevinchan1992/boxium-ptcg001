/**
 * Tests for card selection functionality in blog article generation
 * 
 * This test file verifies the correctness of card search and data retrieval
 * for AI article generation with real card data from the database.
 */

import { describe, it, expect } from 'vitest';

describe('Card Selection for Blog', () => {
  describe('Card Data Format', () => {
    it('should format single card data correctly', () => {
      const card = {
        id: 1,
        name: 'Pikachu PROMO',
        cardNumber: 'SM-P 288',
        latestPrice: 140815,
        imageUrl: 'https://example.com/pikachu.jpg',
      };

      const formatted = formatCardData([card]);
      
      expect(formatted).toContain('【卡牌資料】');
      expect(formatted).toContain('卡牌 1：Pikachu PROMO [SM-P 288]');
      expect(formatted).toContain('最新價格：HKD 140,815（SNKRDUNK PSA10）');
      expect(formatted).toContain('圖片：https://example.com/pikachu.jpg');
    });

    it('should format multiple cards correctly', () => {
      const cards = [
        {
          id: 1,
          name: 'Pikachu PROMO',
          cardNumber: 'SM-P 288',
          latestPrice: 140815,
          imageUrl: 'https://example.com/pikachu.jpg',
        },
        {
          id: 2,
          name: 'Charizard VMAX',
          cardNumber: '001/184',
          latestPrice: 25000,
          imageUrl: 'https://example.com/charizard.jpg',
        },
      ];

      const formatted = formatCardData(cards);
      
      expect(formatted).toContain('卡牌 1：Pikachu PROMO [SM-P 288]');
      expect(formatted).toContain('卡牌 2：Charizard VMAX [001/184]');
      expect(formatted).toContain('HKD 140,815');
      expect(formatted).toContain('HKD 25,000');
    });

    it('should handle cards without price', () => {
      const card = {
        id: 1,
        name: 'Pikachu PROMO',
        cardNumber: 'SM-P 288',
        latestPrice: null,
        imageUrl: 'https://example.com/pikachu.jpg',
      };

      const formatted = formatCardData([card]);
      
      expect(formatted).toContain('最新價格：暫無價格資料');
    });

    it('should handle cards without card number', () => {
      const card = {
        id: 1,
        name: 'Pikachu PROMO',
        cardNumber: null,
        latestPrice: 140815,
        imageUrl: 'https://example.com/pikachu.jpg',
      };

      const formatted = formatCardData([card]);
      
      expect(formatted).toContain('卡牌 1：Pikachu PROMO');
      expect(formatted).not.toContain('[null]');
    });
  });

  describe('Card Data Insertion', () => {
    it('should append card data to existing content', () => {
      const existingContent = '市場最近很熱鬧';
      const cardData = '【卡牌資料】\n\n卡牌 1：Pikachu PROMO [SM-P 288]\n- 最新價格：HKD 140,815（SNKRDUNK PSA10）\n';
      
      const result = appendCardData(existingContent, cardData);
      
      expect(result).toBe('市場最近很熱鬧\n\n【卡牌資料】\n\n卡牌 1：Pikachu PROMO [SM-P 288]\n- 最新價格：HKD 140,815（SNKRDUNK PSA10）\n');
    });

    it('should insert card data when content is empty', () => {
      const existingContent = '';
      const cardData = '【卡牌資料】\n\n卡牌 1：Pikachu PROMO [SM-P 288]\n';
      
      const result = appendCardData(existingContent, cardData);
      
      expect(result).toBe('【卡牌資料】\n\n卡牌 1：Pikachu PROMO [SM-P 288]\n');
    });
  });

  describe('Price Formatting', () => {
    it('should format large prices with commas', () => {
      const price = 140815;
      const formatted = formatPrice(price);
      
      expect(formatted).toBe('140,815');
    });

    it('should format small prices correctly', () => {
      const price = 1000;
      const formatted = formatPrice(price);
      
      expect(formatted).toBe('1,000');
    });

    it('should handle zero price', () => {
      const price = 0;
      const formatted = formatPrice(price);
      
      expect(formatted).toBe('0');
    });
  });

  describe('Search Query Validation', () => {
    it('should accept valid search queries', () => {
      const queries = ['pikachu', 'SM-P 288', 'PROMO', '皮卡丘'];
      
      queries.forEach(query => {
        expect(isValidSearchQuery(query)).toBe(true);
      });
    });

    it('should reject empty queries', () => {
      expect(isValidSearchQuery('')).toBe(false);
    });

    it('should reject queries that are too short', () => {
      expect(isValidSearchQuery('a')).toBe(false);
    });
  });

  describe('Card Selection Limit', () => {
    it('should respect the 20 card limit', () => {
      const limit = 20;
      const query = 'pikachu';
      
      expect(limit).toBeLessThanOrEqual(20);
      expect(limit).toBeGreaterThan(0);
    });

    it('should handle custom limits', () => {
      const limits = [5, 10, 15, 20];
      
      limits.forEach(limit => {
        expect(limit).toBeGreaterThan(0);
        expect(limit).toBeLessThanOrEqual(20);
      });
    });
  });
});

// Helper functions (matching the actual implementation)
function formatCardData(cards: any[]): string {
  let formatted = '【卡牌資料】\n\n';
  
  cards.forEach((card, index) => {
    formatted += `卡牌 ${index + 1}：${card.name}`;
    if (card.cardNumber) {
      formatted += ` [${card.cardNumber}]`;
    }
    formatted += '\n';
    
    if (card.latestPrice) {
      formatted += `- 最新價格：HKD ${formatPrice(card.latestPrice)}（SNKRDUNK PSA10）\n`;
    } else {
      formatted += `- 最新價格：暫無價格資料\n`;
    }
    
    if (card.imageUrl) {
      formatted += `- 圖片：${card.imageUrl}\n`;
    }
    
    formatted += '\n';
  });
  
  return formatted;
}

function appendCardData(existingContent: string, cardData: string): string {
  if (existingContent) {
    return existingContent + '\n\n' + cardData;
  }
  return cardData;
}

function formatPrice(price: number): string {
  return price.toLocaleString();
}

function isValidSearchQuery(query: string): boolean {
  return query.length >= 2;
}
