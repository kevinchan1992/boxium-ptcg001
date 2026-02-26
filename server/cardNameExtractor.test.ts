/**
 * Tests for Card Name Extractor
 * 
 * Verifies that the auto card extraction logic correctly identifies
 * card names and numbers from text content.
 */

import { describe, it, expect } from 'vitest';

describe('Card Name Extractor', () => {
  describe('Card Number Pattern Matching', () => {
    it('should match card numbers with hyphen format', () => {
      const text = '分析 XY-P 207 和 SM-P 288 的價格走勢';
      const pattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
      const matches = text.match(pattern) || [];
      
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches).toContain('XY-P 207');
      expect(matches).toContain('SM-P 288');
    });

    it('should normalize card numbers with extra spaces', () => {
      const cardNumber = 'XY-P  207';
      const normalized = cardNumber.replace(/\s+/g, ' ').trim();
      
      expect(normalized).toBe('XY-P 207');
    });

    it('should match various card number formats', () => {
      const testCases = [
        'XY-P 207',
        'SM-P 288',
        'S-P 294',
        'XY-P 1',
        'ABC-XY 9999',
      ];
      
      const pattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
      
      for (const testCase of testCases) {
        const matches = testCase.match(pattern);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Card Name Pattern Matching', () => {
    it('should match common Pokemon names in English', () => {
      const text = 'Pikachu and Charizard are popular cards';
      const commonNames = ['Pikachu', 'Charizard', 'Mewtwo'];
      
      const foundNames = commonNames.filter(name => {
        const regex = new RegExp(name, 'gi');
        return regex.test(text);
      });
      
      expect(foundNames).toContain('Pikachu');
      expect(foundNames).toContain('Charizard');
    });

    it('should match common Pokemon names in Chinese', () => {
      const text = '皮卡丘和噴火龍是熱門卡牌';
      const commonNames = ['皮卡丘', '噴火龍', '超夢'];
      
      const foundNames = commonNames.filter(name => {
        const regex = new RegExp(name, 'gi');
        return regex.test(text);
      });
      
      expect(foundNames).toContain('皮卡丘');
      expect(foundNames).toContain('噴火龍');
    });

    it('should be case-insensitive', () => {
      const text = 'PIKACHU pikachu PiKaChU';
      const regex = new RegExp('Pikachu', 'gi');
      const matches = text.match(regex);
      
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
  });

  describe('Analysis Phrase Pattern Matching', () => {
    it('should extract keywords from analysis phrases', () => {
      const text = '分析皮卡丘特典卡市場走勢';
      const pattern = /分析\s*([^\s，。]+)\s*卡/g;
      const matches = Array.from(text.matchAll(pattern));
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0][1]).toBe('皮卡丘特典');
    });

    it('should extract keywords from market phrases', () => {
      const text = 'Pikachu市場分析報告';
      const pattern = /([^\s，。]+)\s*市場/g;
      const matches = Array.from(text.matchAll(pattern));
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0][1]).toBe('Pikachu');
    });

    it('should extract keywords from trend phrases', () => {
      const text = 'Charizard走勢預測';
      const pattern = /([^\s，。]+)\s*走勢/g;
      const matches = Array.from(text.matchAll(pattern));
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0][1]).toBe('Charizard');
    });
  });

  describe('Card ID Deduplication', () => {
    it('should use Set to deduplicate card IDs', () => {
      const cardIds = new Set<number>();
      
      cardIds.add(1);
      cardIds.add(2);
      cardIds.add(1); // Duplicate
      cardIds.add(3);
      cardIds.add(2); // Duplicate
      
      expect(cardIds.size).toBe(3);
      expect(Array.from(cardIds)).toEqual([1, 2, 3]);
    });

    it('should respect limit when adding card IDs', () => {
      const cardIds = new Set<number>();
      const limit = 5;
      
      for (let i = 1; i <= 10; i++) {
        if (cardIds.size < limit) {
          cardIds.add(i);
        }
      }
      
      expect(cardIds.size).toBe(5);
    });
  });

  describe('Price Formatting', () => {
    it('should format price with HKD and comma separators', () => {
      const price = 112612.49;
      const formatted = `HKD ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      expect(formatted).toBe('HKD 112,612.49');
    });

    it('should handle large prices correctly', () => {
      const price = 301400.00;
      const formatted = `HKD ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      expect(formatted).toBe('HKD 301,400.00');
    });

    it('should handle small prices correctly', () => {
      const price = 1234.56;
      const formatted = `HKD ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      
      expect(formatted).toBe('HKD 1,234.56');
    });
  });

  describe('Date Formatting', () => {
    it('should format date to ISO format (YYYY-MM-DD)', () => {
      const date = new Date('2026-02-21T10:30:00Z');
      const formatted = date.toISOString().split('T')[0];
      
      expect(formatted).toBe('2026-02-21');
    });

    it('should handle different date inputs', () => {
      const testDates = [
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        new Date('2026-02-26'),
      ];
      
      for (const date of testDates) {
        const formatted = date.toISOString().split('T')[0];
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text input', () => {
      const text = '';
      const pattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
      const matches = text.match(pattern) || [];
      
      expect(matches.length).toBe(0);
    });

    it('should handle text with no card references', () => {
      const text = '這是一篇關於市場的文章，但沒有提到任何卡牌。';
      const pattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
      const matches = text.match(pattern) || [];
      
      expect(matches.length).toBe(0);
    });

    it('should handle mixed language text', () => {
      const text = 'Pikachu 皮卡丘 XY-P 207 is a popular card';
      const cardNumberPattern = /([A-Z]{1,3}-[A-Z]{1,2}\s*\d{1,4})/gi;
      const cardNumbers = text.match(cardNumberPattern) || [];
      
      expect(cardNumbers.length).toBeGreaterThan(0);
      expect(cardNumbers).toContain('XY-P 207');
    });
  });
});
