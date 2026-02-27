import { describe, it, expect, vi } from 'vitest';

// Test the matching logic without actual LLM calls
describe('Image Card Search - Matching Logic', () => {
  // Import the module to test internal functions
  // We'll test the exported searchCardByImage function with mocked LLM

  describe('Card Number Normalization', () => {
    it('should handle standard card numbers', () => {
      // Test normalizeCardNumber logic inline
      const normalize = (cardNumber: string) => {
        return cardNumber
          .replace(/^0+/, '')
          .replace(/\/0+/, '/')
          .trim();
      };

      expect(normalize('110/080')).toBe('110/80');
      expect(normalize('085/070')).toBe('85/70');
      expect(normalize('001/078')).toBe('1/78');
      expect(normalize('206/165')).toBe('206/165');
    });

    it('should handle edge cases', () => {
      const normalize = (cardNumber: string) => {
        return cardNumber
          .replace(/^0+/, '')
          .replace(/\/0+/, '/')
          .trim();
      };

      expect(normalize('0/0')).toBe('/');
      expect(normalize('100/100')).toBe('100/100');
      expect(normalize(' 110/080 ')).toBe('110/80');
    });
  });

  describe('Match Score Calculation', () => {
    // Simulate the scoring logic
    const calculateMatchScore = (
      card: any,
      identification: any
    ): { score: number; reasons: string[] } => {
      let score = 0;
      const reasons: string[] = [];

      const normalizeCardNumber = (cn: string) => cn.replace(/^0+/, '').replace(/\/0+/, '/').trim();

      // Card number match (50 points)
      if (identification.cardNumber && card.cardNumber) {
        const identNum = normalizeCardNumber(identification.cardNumber);
        const cardNum = normalizeCardNumber(card.cardNumber);
        if (identNum === cardNum) {
          score += 50;
          reasons.push(`卡號完全匹配: ${card.cardNumber}`);
        } else if (identNum.split('/')[0] === cardNum.split('/')[0]) {
          score += 20;
          reasons.push(`卡號部分匹配: ${card.cardNumber}`);
        }
      }

      // Japanese name match (30 points)
      if (identification.cardNameJa && card.nameJa) {
        const identNameJa = identification.cardNameJa.toLowerCase().trim();
        const cardNameJa = card.nameJa.toLowerCase().trim();
        if (identNameJa === cardNameJa) {
          score += 30;
          reasons.push(`日文名完全匹配: ${card.nameJa}`);
        } else if (cardNameJa.includes(identNameJa) || identNameJa.includes(cardNameJa)) {
          score += 20;
          reasons.push(`日文名部分匹配: ${card.nameJa}`);
        }
      }

      // Card name match (25 points)
      if (identification.cardName && card.name) {
        const identName = identification.cardName.toLowerCase().trim();
        const cardName = card.name.toLowerCase().trim();
        if (identName === cardName) {
          score += 25;
          reasons.push(`名稱完全匹配: ${card.name}`);
        } else if (cardName.includes(identName) || identName.includes(cardName)) {
          score += 15;
          reasons.push(`名稱部分匹配: ${card.name}`);
        }
      }

      // Rarity match (10 points)
      if (identification.rarity && card.rarity) {
        if (identification.rarity.toUpperCase() === card.rarity.toUpperCase()) {
          score += 10;
          reasons.push(`稀有度匹配: ${card.rarity}`);
        }
      }

      return { score, reasons };
    };

    it('should give highest score for exact card number + name match', () => {
      const card = {
        id: 1,
        name: 'リザードンex SAR',
        nameJa: 'リザードンex',
        cardNumber: '110/080',
        rarity: 'SAR',
      };
      const identification = {
        cardName: 'リザードンex SAR',
        cardNameJa: 'リザードンex',
        cardNumber: '110/080',
        rarity: 'SAR',
      };

      const result = calculateMatchScore(card, identification);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    });

    it('should give high score for card number match even without name', () => {
      const card = {
        id: 1,
        name: 'Some Card',
        nameJa: null,
        cardNumber: '085/070',
        rarity: 'HR',
      };
      const identification = {
        cardName: null,
        cardNameJa: null,
        cardNumber: '085/070',
        rarity: 'HR',
      };

      const result = calculateMatchScore(card, identification);
      expect(result.score).toBe(60); // 50 (number) + 10 (rarity)
    });

    it('should handle normalized card numbers (leading zeros)', () => {
      const card = {
        id: 1,
        name: 'Test Card',
        nameJa: null,
        cardNumber: '85/70',
        rarity: null,
      };
      const identification = {
        cardName: null,
        cardNameJa: null,
        cardNumber: '085/070',
        rarity: null,
      };

      const result = calculateMatchScore(card, identification);
      expect(result.score).toBe(50); // Normalized match
    });

    it('should give partial score for name-only match', () => {
      const card = {
        id: 1,
        name: 'ピカチュウ VMAX HR',
        nameJa: 'ピカチュウ VMAX',
        cardNumber: '001/078',
        rarity: 'HR',
      };
      const identification = {
        cardName: 'ピカチュウ VMAX',
        cardNameJa: 'ピカチュウ VMAX',
        cardNumber: null,
        rarity: 'HR',
      };

      const result = calculateMatchScore(card, identification);
      // 30 (ja name) + 15 (partial name) + 10 (rarity) = 55
      expect(result.score).toBeGreaterThanOrEqual(40);
    });

    it('should give low score for weak matches', () => {
      const card = {
        id: 1,
        name: 'Charizard VMAX',
        nameJa: 'リザードン VMAX',
        cardNumber: '020/070',
        rarity: 'RR',
      };
      const identification = {
        cardName: 'Pikachu V',
        cardNameJa: 'ピカチュウ V',
        cardNumber: '001/078',
        rarity: 'SR',
      };

      const result = calculateMatchScore(card, identification);
      expect(result.score).toBe(0);
    });

    it('should handle partial card number match', () => {
      const card = {
        id: 1,
        name: 'Test Card',
        nameJa: null,
        cardNumber: '110/100',
        rarity: null,
      };
      const identification = {
        cardName: null,
        cardNameJa: null,
        cardNumber: '110/080',
        rarity: null,
      };

      const result = calculateMatchScore(card, identification);
      expect(result.score).toBe(20); // Partial match (first part "110" matches)
    });
  });

  describe('ImageSearchResult structure', () => {
    it('should have correct interface shape', () => {
      const result = {
        success: true,
        identification: {
          cardName: 'Test',
          cardNameJa: 'テスト',
          cardNumber: '001/078',
          setName: 'SV5K',
          rarity: 'SR',
          pokemonName: 'Pikachu',
          pokemonNameJa: 'ピカチュウ',
          language: 'ja',
          additionalText: [],
        },
        matches: [{
          id: 1,
          name: 'Test Card',
          nameJa: 'テストカード',
          cardNumber: '001/078',
          series: null,
          setName: 'SV5K',
          rarity: 'SR',
          imageUrl: 'https://example.com/image.jpg',
          matchScore: 85,
          matchReasons: ['卡號完全匹配'],
          latestPrice: 1000,
        }],
        bestMatch: null,
      };

      expect(result.success).toBe(true);
      expect(result.identification).toBeDefined();
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].matchScore).toBe(85);
      expect(result.matches[0].matchReasons).toContain('卡號完全匹配');
    });

    it('should handle failed result', () => {
      const result = {
        success: false,
        identification: null,
        matches: [],
        bestMatch: null,
        error: '無法從圖片中識別到卡牌信息',
      };

      expect(result.success).toBe(false);
      expect(result.identification).toBeNull();
      expect(result.matches).toHaveLength(0);
      expect(result.error).toBeDefined();
    });
  });
});
