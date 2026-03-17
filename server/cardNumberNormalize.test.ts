import { describe, it, expect } from 'vitest';
import {
  parseCardNumber,
  generateCardNumberPatterns,
  isCardNumberQuery,
  normalizeCardQuery,
  tokenizeSearchQuery,
  buildTokenPatterns,
  isPureSeriesCodeQuery,
  buildSeriesPrefixPatterns,
} from './utils/cardNumberNormalize';

// ─────────────────────────────────────────────────────────────────────────────
// parseCardNumber
// ─────────────────────────────────────────────────────────────────────────────
describe('parseCardNumber', () => {
  // TYPE A – Hyphen format (One Piece / ST decks)
  it('parses "ST01-012" (hyphen format)', () => {
    expect(parseCardNumber('ST01-012')).toEqual({ setCode: 'ST01', number: '012', total: null });
  });
  it('parses "OP01-032" (One Piece hyphen format)', () => {
    expect(parseCardNumber('OP01-032')).toEqual({ setCode: 'OP01', number: '032', total: null });
  });
  it('parses "st01-012" (lowercase hyphen)', () => {
    expect(parseCardNumber('st01-012')).toEqual({ setCode: 'ST01', number: '012', total: null });
  });

  // TYPE B – Promo format
  it('parses "SM-P 288" (canonical DB format)', () => {
    expect(parseCardNumber('SM-P 288')).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });
  it('parses "sm-p 288" (lowercase)', () => {
    expect(parseCardNumber('sm-p 288')).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });
  it('parses "288/SM-P" (number/setcode format)', () => {
    expect(parseCardNumber('288/SM-P')).toEqual({ setCode: 'SM-P', number: '288', total: null });
  });
  it('parses "XY-P 151"', () => {
    expect(parseCardNumber('XY-P 151')).toEqual({ setCode: 'XY-P', number: '151', total: null });
  });
  it('parses "SV-P 003"', () => {
    expect(parseCardNumber('SV-P 003')).toEqual({ setCode: 'SV-P', number: '003', total: null });
  });

  // TYPE C – Set+Space format
  it('parses "SV10 125/098"', () => {
    expect(parseCardNumber('SV10 125/098')).toEqual({ setCode: 'SV10', number: '125', total: '098' });
  });
  it('parses "SM12 085/070"', () => {
    expect(parseCardNumber('SM12 085/070')).toEqual({ setCode: 'SM12', number: '085', total: '070' });
  });

  // TYPE D – number/total
  it('parses "085/070"', () => {
    expect(parseCardNumber('085/070')).toEqual({ setCode: null, number: '085', total: '070' });
  });

  // TYPE E – pure number
  it('parses "288" (pure number)', () => {
    expect(parseCardNumber('288')).toEqual({ setCode: null, number: '288', total: null });
  });

  // Non-card-number inputs
  it('returns null for card names like "Pikachu"', () => {
    expect(parseCardNumber('Pikachu')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(parseCardNumber('')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isPureSeriesCodeQuery
// ─────────────────────────────────────────────────────────────────────────────
describe('isPureSeriesCodeQuery', () => {
  // Full set codes
  it('detects "SV10" as pure series code', () => expect(isPureSeriesCodeQuery('SV10')).toBe(true));
  it('detects "SM-P" as pure series code', () => expect(isPureSeriesCodeQuery('SM-P')).toBe(true));
  it('detects "ST01" as pure series code', () => expect(isPureSeriesCodeQuery('ST01')).toBe(true));
  it('detects "OP01" as pure series code', () => expect(isPureSeriesCodeQuery('OP01')).toBe(true));
  it('detects "SV8a" as pure series code', () => expect(isPureSeriesCodeQuery('SV8a')).toBe(true));
  it('detects "SM12" as pure series code', () => expect(isPureSeriesCodeQuery('SM12')).toBe(true));

  // Partial prefixes
  it('detects "SM" as pure series code (partial prefix)', () => expect(isPureSeriesCodeQuery('SM')).toBe(true));
  it('detects "ST" as pure series code (partial prefix)', () => expect(isPureSeriesCodeQuery('ST')).toBe(true));
  it('detects "SV" as pure series code (partial prefix)', () => expect(isPureSeriesCodeQuery('SV')).toBe(true));
  it('detects "OP" as pure series code (partial prefix)', () => expect(isPureSeriesCodeQuery('OP')).toBe(true));

  // NOT series codes
  it('rejects "ST01-012" (has hyphen+number)', () => expect(isPureSeriesCodeQuery('ST01-012')).toBe(false));
  it('rejects "SV10 125" (has space+number)', () => expect(isPureSeriesCodeQuery('SV10 125')).toBe(false));
  it('rejects "Pikachu" (card name)', () => expect(isPureSeriesCodeQuery('Pikachu')).toBe(false));
  it('rejects "125/098" (card number)', () => expect(isPureSeriesCodeQuery('125/098')).toBe(false));
  it('rejects "PIKACHU" (too long / not a set code)', () => expect(isPureSeriesCodeQuery('PIKACHU')).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSeriesPrefixPatterns
// ─────────────────────────────────────────────────────────────────────────────
describe('buildSeriesPrefixPatterns', () => {
  it('"ST01" → includes "ST01-%" (hyphen format)', () => {
    const patterns = buildSeriesPrefixPatterns('ST01');
    expect(patterns).toContain('ST01-%');
  });

  it('"ST" → includes "ST%-%" (any ST series)', () => {
    const patterns = buildSeriesPrefixPatterns('ST');
    expect(patterns.some(p => p.includes('ST') && p.includes('-'))).toBe(true);
  });

  it('"OP01" → includes "OP01-%" (hyphen format)', () => {
    const patterns = buildSeriesPrefixPatterns('OP01');
    expect(patterns).toContain('OP01-%');
  });

  it('"SM-P" → includes "SM-P %" (promo format)', () => {
    const patterns = buildSeriesPrefixPatterns('SM-P');
    expect(patterns).toContain('SM-P %');
  });

  it('"SV10" → includes "SV10 %" (space format)', () => {
    const patterns = buildSeriesPrefixPatterns('SV10');
    expect(patterns).toContain('SV10 %');
  });

  it('"SM" → includes patterns for SM series (space + promo)', () => {
    const patterns = buildSeriesPrefixPatterns('SM');
    // Should cover both SM12 (space format) and SM-P (promo format)
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.startsWith('SM'))).toBe(true);
  });

  it('"SV" → includes "SV% %" pattern', () => {
    const patterns = buildSeriesPrefixPatterns('SV');
    expect(patterns.some(p => p.includes('SV'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeCardQuery
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeCardQuery', () => {
  it('normalizes "ST01-012" correctly (hyphen format preserved)', () => {
    expect(normalizeCardQuery('ST01-012')).toBe('ST01-012');
  });
  it('normalizes "288 sm-p" to "SM-P 288"', () => {
    expect(normalizeCardQuery('288 sm-p')).toBe('SM-P 288');
  });
  it('normalizes "288/SM-P" to "SM-P 288"', () => {
    expect(normalizeCardQuery('288/SM-P')).toBe('SM-P 288');
  });
  it('normalizes "151/XY-P" to "XY-P 151"', () => {
    expect(normalizeCardQuery('151/XY-P')).toBe('XY-P 151');
  });
  it('keeps "Pikachu" unchanged', () => {
    expect(normalizeCardQuery('Pikachu')).toBe('Pikachu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCardNumberPatterns
// ─────────────────────────────────────────────────────────────────────────────
describe('generateCardNumberPatterns', () => {
  it('generates patterns for "ST01-012" (hyphen format)', () => {
    const patterns = generateCardNumberPatterns('ST01-012');
    expect(patterns).toContain('%ST01-012%');
  });

  it('generates patterns for "288 sm-p"', () => {
    const patterns = generateCardNumberPatterns('288 sm-p');
    expect(patterns).toContain('%SM-P 288%');
    expect(patterns).toContain('%288/SM-P%');
  });

  it('generates patterns for "SM-P 288"', () => {
    const patterns = generateCardNumberPatterns('SM-P 288');
    expect(patterns).toContain('%SM-P 288%');
    expect(patterns).toContain('%288/SM-P%');
  });

  it('returns empty array for plain name', () => {
    expect(generateCardNumberPatterns('Pikachu')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tokenizeSearchQuery
// ─────────────────────────────────────────────────────────────────────────────
describe('tokenizeSearchQuery', () => {
  it('keeps "SM-P 288" as single token', () => {
    expect(tokenizeSearchQuery('SM-P 288')).toEqual(['SM-P 288']);
  });
  it('keeps "SV10 125/098" as single token', () => {
    expect(tokenizeSearchQuery('SV10 125/098')).toEqual(['SV10 125/098']);
  });
  it('keeps "ST01-012" as single token (hyphen format)', () => {
    expect(tokenizeSearchQuery('ST01-012')).toEqual(['ST01-012']);
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

// ─────────────────────────────────────────────────────────────────────────────
// buildTokenPatterns
// ─────────────────────────────────────────────────────────────────────────────
describe('buildTokenPatterns', () => {
  it('builds name and cardNumber patterns for "pikachu"', () => {
    const { namePatterns, cardNumberPatterns } = buildTokenPatterns('pikachu');
    expect(namePatterns).toContain('%pikachu%');
    expect(cardNumberPatterns).toContain('%PIKACHU%');
  });

  it('builds prefix patterns for "sm-p" (promo series code)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('sm-p');
    expect(cardNumberPatterns).toContain('%SM-P%');
    expect(cardNumberPatterns).toContain('SM-P %');
  });

  it('builds prefix patterns for "ST01" (hyphen series code)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('ST01');
    expect(cardNumberPatterns).toContain('ST01-%');
  });

  it('builds prefix patterns for "SM" (partial SM prefix)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('SM');
    expect(cardNumberPatterns.length).toBeGreaterThan(1);
  });

  it('builds prefix patterns for "ST" (partial ST prefix)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('ST');
    expect(cardNumberPatterns.some(p => p.includes('ST'))).toBe(true);
  });

  it('builds cardNumber patterns for "288" (pure number)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('288');
    expect(cardNumberPatterns).toContain('%288%');
  });

  it('builds patterns for "ST01-012" (full hyphen card number)', () => {
    const { cardNumberPatterns } = buildTokenPatterns('ST01-012');
    expect(cardNumberPatterns).toContain('%ST01-012%');
  });

  it('builds multiple patterns for "SM-P 288"', () => {
    const { cardNumberPatterns } = buildTokenPatterns('SM-P 288');
    expect(cardNumberPatterns).toContain('%SM-P 288%');
    expect(cardNumberPatterns).toContain('%288/SM-P%');
  });
});
