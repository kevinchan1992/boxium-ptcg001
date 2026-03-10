/**
 * Card Number Normalization Utility
 *
 * Handles various card number format variants so that searches like
 * "SM-P 288", "288/SM-P", "288 sm-p", "sm-p288", "PROMO 288/SM-P" all
 * resolve to the same card.
 *
 * Common formats in the database:
 *   SM-P 288   (set code + space + number)
 *   XY-P 151   (set code + space + number)
 *   SV-P 003   (set code + space + number)
 *   110/080    (number/total, no set code)
 *   S5I 085/070 (set code + space + number/total)
 *   SV10 125/098 (set code with digits + space + number/total)
 */

export interface CardNumberParts {
  /** Numeric part, e.g. "288", "085" */
  number: string;
  /** Set/series code, e.g. "SM-P", "XY-P", "S5I", "SV10" – upper-cased */
  setCode: string | null;
  /** Total (denominator) when format is "num/total", e.g. "070" */
  total: string | null;
}

/**
 * Determine whether a query string looks like a pure series/set code query.
 * Pure series codes: SV10, SV9, SV8a, S12a, SM8b, XY5, etc.
 * These are alphanumeric codes (letters + optional digits + optional letters)
 * that do NOT contain a slash or space followed by a card number.
 *
 * Examples:
 *   "SV10"  → true  (series code only)
 *   "SV9"   → true
 *   "SV8a"  → true
 *   "S12a"  → true
 *   "SM-P"  → true  (promo series)
 *   "SV10 125/098" → false (has card number)
 *   "Pikachu" → false (card name)
 *   "125/098" → false (card number only)
 */
export function isPureSeriesCodeQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  // Must be a pure alphanumeric set code (letters + digits + optional trailing letters)
  // Examples: SV10, SV9, SV8A, S12A, SM8B, XY5, DP4, L3, MC, PCG
  // Also allow hyphenated promo codes: SM-P, XY-P, SV-P, BW-P
  // Must NOT contain spaces or slashes (those indicate a full card number)
  if (/\s|\//.test(trimmed)) return false;
  // Must match the pattern of a set code: starts with letters, may have digits, may end with letters
  // At least 2 chars, no more than 8 chars
  if (trimmed.length < 2 || trimmed.length > 8) return false;
  // Pattern: letters (1-4) + optional hyphen + optional letters (1-2) + optional digits (1-3) + optional letters (1-2)
  return /^[A-Z]{1,4}(?:-[A-Z]{1,3})?(?:\d{1,3}[A-Z]{0,2})?$/.test(trimmed);
}

/**
 * Parse a raw card number string into its constituent parts.
 * Handles all known formats:
 *   "SM-P 288"   → { number:"288", setCode:"SM-P", total:null }
 *   "288/SM-P"   → { number:"288", setCode:"SM-P", total:null }
 *   "288 SM-P"   → { number:"288", setCode:"SM-P", total:null }
 *   "sm-p288"    → { number:"288", setCode:"SM-P", total:null }
 *   "085/070"    → { number:"085", setCode:null,   total:"070" }
 *   "S5I 085/070"→ { number:"085", setCode:"S5I",  total:"070" }
 *   "SV10 125/098"→{ number:"125", setCode:"SV10", total:"098" }
 *   "288"        → { number:"288", setCode:null,   total:null }
 */
export function parseCardNumber(raw: string): CardNumberParts | null {
  if (!raw || !raw.trim()) return null;

  // Strip common prefixes like "PROMO", "#", etc. before parsing
  let s = raw.trim().toUpperCase().replace(/^(PROMO|CARD|#)\s*/i, '');

  // Pattern: SET_CODE (with optional digits suffix like SV10, SV8a, S12a) + space + NUMBER/TOTAL
  // e.g. "SV10 125/098", "S12a 085/070", "SM8b 045/100"
  const setWithDigitsThenNumber = s.match(/^([A-Z]{1,4}(?:-[A-Z]{1,3})?\d{0,3}[A-Z]{0,2})\s+(\d{1,4})(?:\/(\d{1,4}))?$/);
  if (setWithDigitsThenNumber) {
    return {
      setCode: setWithDigitsThenNumber[1],
      number: setWithDigitsThenNumber[2],
      total: setWithDigitsThenNumber[3] ?? null,
    };
  }

  // Pattern: SET_CODE + optional separator + NUMBER (e.g. "SM-P 288", "SM-P288")
  // Set codes: letters, optional hyphen, optional letter (SM-P, XY-P, SV-P, PCG-P, BW-P, S5I, SC, etc.)
  const setThenNumber = s.match(/^([A-Z]{1,5}(?:-[A-Z]{1,3})?)\s*[/ ]?\s*(\d{1,4})(?:\/(\d{1,4}))?$/);
  if (setThenNumber) {
    return {
      setCode: setThenNumber[1],
      number: setThenNumber[2],
      total: setThenNumber[3] ?? null,
    };
  }

  // Pattern: NUMBER + separator + SET_CODE (e.g. "288/SM-P", "288 SM-P", "288 sm-p")
  const numberThenSet = s.match(/^(\d{1,4})\s*[/ ]\s*([A-Z]{1,5}(?:-[A-Z]{1,3})?)$/);
  if (numberThenSet) {
    return {
      number: numberThenSet[1],
      setCode: numberThenSet[2],
      total: null,
    };
  }

  // Pattern: NUMBER/TOTAL (e.g. "085/070", "110/080")
  const numberSlashTotal = s.match(/^(\d{1,4})\/(\d{1,4})$/);
  if (numberSlashTotal) {
    return {
      number: numberSlashTotal[1],
      setCode: null,
      total: numberSlashTotal[2],
    };
  }

  // Pattern: pure number (e.g. "288")
  const pureNumber = s.match(/^(\d{1,4})$/);
  if (pureNumber) {
    return {
      number: pureNumber[1],
      setCode: null,
      total: null,
    };
  }

  // Pattern: extract card number from compound string (e.g. "PROMO 288/SM-P", "SM-P PROMO 288")
  // Try to find NUMBER/SET_CODE or SET_CODE/NUMBER embedded in the string
  const embeddedNumberThenSet = s.match(/(\d{1,4})\s*[/ ]\s*([A-Z]{1,5}(?:-[A-Z]{1,3})?)/);
  if (embeddedNumberThenSet) {
    return {
      number: embeddedNumberThenSet[1],
      setCode: embeddedNumberThenSet[2],
      total: null,
    };
  }

  const embeddedSetThenNumber = s.match(/([A-Z]{1,5}(?:-[A-Z]{1,3})?)\s+(\d{1,4})/);
  if (embeddedSetThenNumber) {
    return {
      setCode: embeddedSetThenNumber[1],
      number: embeddedSetThenNumber[2],
      total: null,
    };
  }

  return null;
}

/**
 * Generate all plausible cardNumber LIKE patterns for a given query.
 *
 * For example, "288 sm-p" → ["%288%SM-P%", "%SM-P%288%", "%SM-P 288%", "%288/SM-P%"]
 * This lets us match any format stored in the database.
 */
export function generateCardNumberPatterns(query: string): string[] {
  const parts = parseCardNumber(query);
  if (!parts) return [];

  const { number, setCode, total } = parts;
  const patterns = new Set<string>();

  if (setCode && number) {
    // All common separator variants
    patterns.add(`%${setCode} ${number}%`);   // "SM-P 288"  (DB canonical)
    patterns.add(`%${setCode}${number}%`);     // "SM-PP288"
    patterns.add(`%${number}/${setCode}%`);    // "288/SM-P"
    patterns.add(`%${number} ${setCode}%`);    // "288 SM-P"
    patterns.add(`%${setCode}%${number}%`);    // fallback wildcard
  } else if (number && total) {
    patterns.add(`%${number}/${total}%`);
    patterns.add(`%${number}%${total}%`);
  } else if (number) {
    patterns.add(`%${number}%`);
  }

  return Array.from(patterns);
}

/**
 * Determine whether a query string looks like a card number query
 * (as opposed to a card name query).
 */
export function isCardNumberQuery(query: string): boolean {
  return parseCardNumber(query.trim()) !== null;
}

/**
 * Normalize a search query for consistent matching.
 * Returns the canonical form (SET_CODE + space + NUMBER) if parseable,
 * otherwise returns the original query trimmed.
 */
export function normalizeCardQuery(query: string): string {
  const parts = parseCardNumber(query);
  if (!parts) return query.trim();
  if (parts.setCode && parts.number) {
    return `${parts.setCode} ${parts.number}`;
  }
  if (parts.number && parts.total) {
    return `${parts.number}/${parts.total}`;
  }
  return parts.number;
}
