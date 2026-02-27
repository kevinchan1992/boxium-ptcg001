import { describe, it, expect } from 'vitest';
import { convertToHKD } from './utils/currency';

/**
 * PSA 10 Filter Logic Tests
 * 
 * Tests the eBay listing filter that ensures only PSA 10 graded cards pass through.
 * This filter was previously broken because 'psa 1' (string match) would incorrectly
 * match 'psa 10', causing ALL PSA 10 listings to be excluded.
 * 
 * Fix: Use regex with word boundaries (\bpsa\s*10\b) instead of simple string includes.
 */

// Replicate the exact filter logic from server/routers/pricing.ts
function filterPsa10Items(items: Array<{ title: string }>): Array<{ title: string }> {
  return items.filter((item) => {
    const title = item.title.toLowerCase();
    // Must contain "psa 10" or "psa10" (exact grade match)
    const hasPsa10 = /\bpsa\s*10\b/.test(title);
    if (!hasPsa10) return false;
    
    // Exclude non-PSA 10 grades using word boundary regex
    const excludeGradePatterns = [
      /\bpsa\s*9\b/, /\bpsa\s*8\b/, /\bpsa\s*7\b/,
      /\bpsa\s*6\b/, /\bpsa\s*5\b/, /\bpsa\s*4\b/,
      /\bpsa\s*3\b/, /\bpsa\s*2\b/, /\bpsa\s*1\b/,
    ];
    const hasOtherGrade = excludeGradePatterns.some(p => p.test(title));
    if (hasOtherGrade) return false;
    
    // Exclude non-card items
    const excludeItemPatterns = [
      'bgs', 'cgc', 'sgc', 'beckett',
      'raw', 'ungraded', 'not graded',
      'sleeve', 'sleeves', 'deck box', 'deckbox', 'playmat',
      'binder', 'case', 'holder', 'toploader', 'protector',
      'lot', 'bundle', 'collection',
    ];
    return !excludeItemPatterns.some(p => title.includes(p));
  });
}

describe('eBay PSA 10 Filter', () => {
  it('should pass PSA 10 listings with card numbers containing "1" (e.g., 151/XY-P)', () => {
    // This was the original bug: 'psa 1' pattern matched 'psa 10' in title
    const items = [
      { title: 'PSA 10 - Pretend Gyarados Pikachu 151/XY-P Special Box Japanese Promo - Pokemon' },
      { title: 'PSA 10 Pretend Gyarados Poncho Pikachu 151/XY-P Promo Pokemon' },
      { title: 'PSA 10 Gyarados Pretend Pikachu 151/XY-P Pokemon Card Japanese Promo 2015 XY-P' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(3);
  });

  it('should pass standard PSA 10 listings', () => {
    const items = [
      { title: 'PSA 10 Charizard ex 110/108' },
      { title: 'PSA10 Pikachu VMAX 123/456' },
      { title: 'Pokemon Card Charizard PSA 10 GEM MINT' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(3);
  });

  it('should exclude non-PSA 10 grades', () => {
    const items = [
      { title: 'PSA 9 Charizard ex 110/108' },
      { title: 'PSA 8 Pikachu VMAX' },
      { title: 'PSA 7 Mewtwo GX' },
      { title: 'PSA 1 damaged card' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(0);
  });

  it('should exclude listings without PSA grading', () => {
    const items = [
      { title: 'Charizard ex 110/108 Near Mint' },
      { title: 'BGS 10 Pikachu VMAX' },
      { title: 'CGC 10 Mewtwo GX' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(0);
  });

  it('should exclude non-card items even with PSA 10', () => {
    const items = [
      { title: 'Pokemon card lot PSA 10 Charizard included' },
      { title: 'PSA 10 Pikachu collection set' },
      { title: 'PSA 10 card bundle 5 cards' },
      { title: 'PSA 10 card sleeve protector' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(0);
  });

  it('should handle mixed valid and invalid listings', () => {
    const items = [
      { title: 'PSA 10 Charizard ex 110/108 GEM MINT' },           // PASS
      { title: 'PSA 9 Charizard ex 110/108' },                      // FAIL (PSA 9)
      { title: 'PSA 10 Pikachu 151/XY-P Promo' },                   // PASS
      { title: 'BGS 10 Charizard' },                                 // FAIL (BGS)
      { title: 'PSA 10 Pokemon card lot' },                          // FAIL (lot)
      { title: 'PSA 10 Mewtwo GX 150/147 Secret Rare' },            // PASS
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(3);
    expect(result[0].title).toContain('Charizard ex');
    expect(result[1].title).toContain('Pikachu 151');
    expect(result[2].title).toContain('Mewtwo GX');
  });

  it('should handle PSA10 without space', () => {
    const items = [
      { title: 'PSA10 Charizard VMAX 308/190' },
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(1);
  });

  it('should not confuse PSA 10 with card numbers like 100, 101, 1000', () => {
    // Card number 100 should not trigger PSA 10 match
    const items = [
      { title: 'Charizard 100/108 Near Mint' },  // No PSA at all
      { title: 'PSA 10 Pikachu 100/108' },        // Has PSA 10 - should pass
    ];
    const result = filterPsa10Items(items);
    expect(result.length).toBe(1);
    expect(result[0].title).toContain('PSA 10 Pikachu');
  });

  it('should handle titles with multiple PSA references (PSA 10 + PSA 9 crossgrade)', () => {
    // Some listings mention both grades
    const items = [
      { title: 'PSA 10 Charizard (previously PSA 9, resubmitted)' },
    ];
    const result = filterPsa10Items(items);
    // Should be excluded because it also mentions PSA 9
    expect(result.length).toBe(0);
  });
});

describe('Currency conversion to HKD', () => {
  it('should convert USD to HKD correctly', () => {
    const result = convertToHKD(100, 'USD');
    expect(result).toBe(780); // 100 * 7.8
  });

  it('should keep HKD as-is', () => {
    const result = convertToHKD(1000, 'HKD');
    expect(result).toBe(1000);
  });

  it('should convert SGD to HKD correctly', () => {
    const result = convertToHKD(100, 'SGD');
    expect(result).toBe(580); // 100 * 5.8
  });

  it('should convert JPY to HKD correctly', () => {
    const result = convertToHKD(10000, 'JPY');
    expect(result).toBe(520); // 10000 * 0.052
  });

  it('should handle unknown currency with 1:1 fallback', () => {
    const result = convertToHKD(100, 'EUR');
    expect(result).toBe(100); // Unknown currency defaults to 1:1
  });

  it('should handle case-insensitive currency codes', () => {
    const result = convertToHKD(100, 'usd');
    expect(result).toBe(780);
  });

  it('should correctly convert typical eBay PSA 10 card prices', () => {
    // A PSA 10 Charizard at $8000 USD
    const result = convertToHKD(8000, 'USD');
    expect(result).toBe(62400); // 8000 * 7.8
  });
});
