import { describe, it, expect } from 'vitest';
import {
  parseCardNumber,
  generateCardNumberPatterns,
  isCardNumberQuery,
  normalizeCardQuery,
  tokenizeSearchQuery,
  buildTokenPatterns,
} from './utils/cardNumberNormalize';

describe('parseCardNumber', () => {
  it('parses "SM-P 288" (canonical DB format)', () => {
    const result = parseCardNumber('SM-P 288');
    expect(result).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });

  it('parses "sm-p 288" (lowercase)', () => {
    const result = parseCardNumber('sm-p 288');
    expect(result).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });

  it('parses "288/SM-P" (number/setcode format)', () => {
    const result = parseCardNumber('288/SM-P');
    expect(result).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });

  it('parses "288 sm-p" (number space setcode)', () => {
    const result = parseCardNumber('288 sm-p');
    expect(result).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });

  it('parses "XY-P 151"', () => {
    const result = parseCardNumber('XY-P 151');
    expect(result).toEqual({ setCode: 'XY-P', number: '151', total: null });
  });

  it('parses "151/XY-P"', () => {
    const result = parseCardNumber('151/XY-P');
    expect(result).toEqual({ setCode: 'XY-P', number: '151', total: null });
  });

  it('parses "SV-P 003"', () => {
    const result = parseCardNumber('SV-P 003');
    expect(result).toEqual({ setCode: 'SV-P', number: '003', total: null });
  });

  it('parses "085/070" (number/total format)', () => {
    const result = parseCardNumber('085/070');
    expect(result).toEqual({ setCode: null, number: '085', total: '070' });
  });

  it('parses "288" (pure number)', () => {
    const result = parseCardNumber('288');
    expect(result).toEqual({ setCode: null, number: '288', total: null });
  });

  it('returns null for card names like "Pikachu"', () => {
    const result = parseCardNumber('Pikachu');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    const result = parseCardNumber('');
    expect(result).toBeNull();
  });
});

describe('normalizeCardQuery', () => {
  it('normalizes "288 sm-p" to "SM-P 288"', () => {
    expect(normalizeCardQuery('288 sm-p')).toBe('SM-P 288');
  });

  it('normalizes "288/SM-P" to "SM-P 288"', () => {
    expect(normalizeCardQuery('288/SM-P')).toBe('SM-P 288');
  });

  it('normalizes "Sm-p 288" to "SM-P 288"', () => {
    expect(normalizeCardQuery('Sm-p 288')).toBe('SM-P 288');
  });

  it('normalizes "151/XY-P" to "XY-P 151"', () => {
    expect(normalizeCardQuery('151/XY-P')).toBe('XY-P 151');
  });

  it('keeps "Pikachu" unchanged', () => {
    expect(normalizeCardQuery('Pikachu')).toBe('Pikachu');
  });
});

describe('generateCardNumberPatterns', () => {
  it('generates patterns for "288 sm-p"', () => {
    const patterns = generateCardNumberPatterns('288 sm-p');
    expect(patterns).toContain('%SM-P 288%');
    expect(patterns).toContain('%288/SM-P%');
    expect(patterns).toContain('%288 SM-P%');
  });

  it('generates patterns for "SM-P 288"', () => {
    const patterns = generateCardNumberPatterns('SM-P 288');
    expect(patterns).toContain('%SM-P 288%');
    expect(patterns).toContain('%288/SM-P%');
  });

  it('generates patterns for "151/XY-P"', () => {
    const patterns = generateCardNumberPatterns('151/XY-P');
    expect(patterns).toContain('%XY-P 151%');
    expect(patterns).toContain('%151/XY-P%');
  });

  it('returns empty array for plain name', () => {
    const patterns = generateCardNumberPatterns('Pikachu');
    expect(patterns).toHaveLength(0);
  });
});

describe('isCardNumberQuery', () => {
  it('detects "SM-P 288" as card number query', () => {
    expect(isCardNumberQuery('SM-P 288')).toBe(true);
  });

  it('detects "288 sm-p" as card number query', () => {
    expect(isCardNumberQuery('288 sm-p')).toBe(true);
  });

  it('detects "288/SM-P" as card number query', () => {
    expect(isCardNumberQuery('288/SM-P')).toBe(true);
  });

  it('detects "085/070" as card number query', () => {
    expect(isCardNumberQuery('085/070')).toBe(true);
  });

  it('does NOT detect "Pikachu" as card number query', () => {
    expect(isCardNumberQuery('Pikachu')).toBe(false);
  });

  it('does NOT detect "Gyarados Pretend" as card number query', () => {
    expect(isCardNumberQuery('Gyarados Pretend')).toBe(false);
  });
});

describe('tokenizeSearchQuery', () => {
  it('keeps "SM-P 288" as single token (it is a card number)', () => {
    expect(tokenizeSearchQuery('SM-P 288')).toEqual(['SM-P 288']);
  });

  it('keeps "SV10 125/098" as single token', () => {
    expect(tokenizeSearchQuery('SV10 125/098')).toEqual(['SV10 125/098']);
  });

  it('splits "pikachu sm-p" into two tokens', () => {
    expect(tokenizeSearchQuery('pikachu sm-p')).toEqual(['pikachu', 'sm-p']);
  });

  it('splits "pikachu 288" into two tokens', () => {
    expect(tokenizeSearchQuery('pikachu 288')).toEqual(['pikachu', '288']);
  });

  it('splits "pikachu sm-p 288" into three tokens', () => {
    expect(tokenizeSearchQuery('pikachu sm-p 288')).toEqual(['pikachu', 'sm-p', '288']);
  });

  it('returns single token for plain name "pikachu"', () => {
    expect(tokenizeSearchQuery('pikachu')).toEqual(['pikachu']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenizeSearchQuery('')).toEqual([]);
  });

  it('returns empty array for whitespace only', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });
});

describe('buildTokenPatterns', () => {
  it('builds name and cardNumber patterns for "pikachu"', () => {
    const { namePatterns, cardNumberPatterns } = buildTokenPatterns('pikachu');
    expect(namePatterns).toContain('%pikachu%');
    expect(cardNumberPatterns).toContain('%PIKACHU%');
  });

  it('builds cardNumber patterns for "sm-p" (set code)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('sm-p');
    expect(cardNumberPatterns).toContain('%SM-P%');
    // As a pure series code, should also include prefix patterns
    expect(cardNumberPatterns).toContain('SM-P %');
    expect(cardNumberPatterns).toContain('SM-P/%');
  });

  it('builds cardNumber patterns for "288" (pure number)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('288');
    expect(cardNumberPatterns).toContain('%288%');
  });

  it('builds multiple cardNumber patterns for "SM-P 288"', () => {
    const { cardNumberPatterns } = buildTokenPatterns('SM-P 288');
    expect(cardNumberPatterns).toContain('%SM-P 288%');
    expect(cardNumberPatterns).toContain('%288/SM-P%');
  });
});
