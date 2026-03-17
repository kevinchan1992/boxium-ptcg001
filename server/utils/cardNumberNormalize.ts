/**
 * Card Number Normalization Utility
 *
 * Handles all card number formats in the database:
 *
 *   TYPE A – Hyphen format (One Piece / ST decks):
 *     ST01-012, OP01-032, EB01-001
 *     Set code = letters + 2-digit number, then hyphen, then card number
 *
 *   TYPE B – Promo format:
 *     SM-P 288, XY-P 151, SV-P 003
 *     Set code = letters + hyphen + letter, then space + number
 *
 *   TYPE C – Set+Space format (modern Pokémon):
 *     SV10 125/098, SM12 085/070, S12a 034/100
 *     Set code = letters + digits + optional letters, then space + number/total
 *
 *   TYPE D – Pure number/total:
 *     085/070, 110/080
 *
 *   TYPE E – Pure number:
 *     288, 001
 */

export interface CardNumberParts {
  number: string;
  setCode: string | null;
  total: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERIES CODE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the "type" of a set code prefix so we know which separator to use
 * when building LIKE patterns.
 *
 * Returns:
 *   "hyphen"  – e.g. ST01, OP01, EB01  → cards stored as ST01-xxx
 *   "promo"   – e.g. SM-P, XY-P, SV-P  → cards stored as SM-P 288
 *   "space"   – e.g. SV10, SM12, S12a   → cards stored as SV10 125/098
 *   null      – not a set code
 */
function detectSetCodeType(code: string): "hyphen" | "promo" | "space" | null {
  const upper = code.trim().toUpperCase();
  if (!upper) return null;

  // Promo codes: letters + hyphen + letter(s), e.g. SM-P, XY-P, SV-P, BW-P, PCG-P
  if (/^[A-Z]{1,4}-[A-Z]{1,3}$/.test(upper)) return "promo";

  // Hyphen-format set codes: 2-4 letters + exactly 2 digits, e.g. ST01, OP01, EB01, ST13
  // These sets store cards as "ST01-012" (hyphen separator)
  if (/^[A-Z]{2,4}\d{2}$/.test(upper)) {
    // Distinguish from space-format: ST/OP/EB series use hyphens; SV/SM/XY/S use spaces
    const prefix = upper.match(/^([A-Z]+)/)?.[1] ?? "";
    // Known hyphen-format series prefixes
    if (/^(ST|OP|EB)$/.test(prefix)) return "hyphen";
    // SV, SM, XY, S, BW, DP, L, etc. use space format
    return "space";
  }

  // Space-format set codes: letters + digits + optional trailing letters
  // e.g. SV10, SV8a, SM12, S12a, SM8b, XY5, DP4
  if (/^[A-Z]{1,4}\d{1,3}[A-Z]{0,2}$/.test(upper)) return "space";

  // Short letter-only codes that are known series (e.g. "SM" as a prefix for SM series)
  // These are partial prefixes typed by the user
  if (/^[A-Z]{2,4}$/.test(upper)) {
    const knownHyphenPrefixes = ["ST", "OP", "EB"];
    if (knownHyphenPrefixes.includes(upper)) return "hyphen";
    return "space";
  }

  return null;
}

/**
 * Determine whether a query string looks like a pure series/set code query
 * (user typed only a set code, no card number yet).
 *
 * Examples:
 *   "SV10"   → true   (space-format series)
 *   "SM-P"   → true   (promo series)
 *   "ST01"   → true   (hyphen-format series)
 *   "SM"     → true   (partial SM prefix)
 *   "OP"     → true   (partial OP prefix)
 *   "ST"     → true   (partial ST prefix)
 *   "ST01-012"  → false (has card number)
 *   "SV10 125"  → false (has card number)
 *   "Pikachu"   → false (card name)
 *   "125/098"   → false (card number only)
 */
export function isPureSeriesCodeQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed) return false;
  // Must not contain spaces or slashes (those indicate a full card number)
  // Exception: promo codes like "SM-P" contain a hyphen but no space/slash
  if (/[\s/]/.test(trimmed)) return false;
  // Must be 2–8 characters
  if (trimmed.length < 2 || trimmed.length > 8) return false;
  // Must match a set code pattern
  return detectSetCodeType(trimmed) !== null;
}

/**
 * Build all LIKE patterns for a pure series code prefix search.
 * Handles all three storage formats (hyphen, promo, space).
 *
 * "ST01"  → ["ST01-%"]                       (hyphen format)
 * "ST"    → ["ST%-%"]                         (any ST series)
 * "SM-P"  → ["SM-P %"]                        (promo format)
 * "SM"    → ["SM-P %", "SM% %", "SM%-%"]      (all SM variants)
 * "SV10"  → ["SV10 %"]                        (space format)
 * "SV"    → ["SV% %"]                         (any SV series)
 */
export function buildSeriesPrefixPatterns(query: string): string[] {
  const upper = query.trim().toUpperCase();
  const type = detectSetCodeType(upper);
  const patterns = new Set<string>();

  if (!type) return [];

  if (type === "hyphen") {
    // e.g. ST01 → "ST01-%", ST → "ST%-%"
    patterns.add(`${upper}-%`);
    // If it's just the letter prefix (ST, OP, EB), also match all numbered variants
    if (/^[A-Z]+$/.test(upper)) {
      patterns.add(`${upper}%-%`);
    }
  } else if (type === "promo") {
    // e.g. SM-P → "SM-P %"
    patterns.add(`${upper} %`);
    patterns.add(`${upper}%`); // some entries may not have space
  } else if (type === "space") {
    // e.g. SV10 → "SV10 %", SM → "SM% %" + "SM-% %" (covers SM-P promo too)
    patterns.add(`${upper} %`);
    // If it's a short letter-only prefix, also match numbered variants
    if (/^[A-Z]+$/.test(upper)) {
      patterns.add(`${upper}% %`);
      // Also cover promo variants: SM → SM-P
      patterns.add(`${upper}-% %`);
      patterns.add(`${upper}-%`);
    }
  }

  return Array.from(patterns);
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD NUMBER PARSING
// ─────────────────────────────────────────────────────────────────────────────

export function parseCardNumber(raw: string): CardNumberParts | null {
  if (!raw || !raw.trim()) return null;

  let s = raw.trim().toUpperCase().replace(/^(PROMO|CARD|#)\s*/i, '');

  // TYPE A: Hyphen format – "ST01-012", "OP05-065"
  const hyphenFormat = s.match(/^([A-Z]{2,4}\d{2})-(\d{1,4})$/);
  if (hyphenFormat) {
    return { setCode: hyphenFormat[1], number: hyphenFormat[2], total: null };
  }

  // TYPE C: Set code + space + number/total – "SV10 125/098", "SM12 085/070"
  const setWithDigitsThenNumber = s.match(/^([A-Z]{1,4}(?:-[A-Z]{1,3})?\d{0,3}[A-Z]{0,2})\s+(\d{1,4})(?:\/(\d{1,4}))?$/);
  if (setWithDigitsThenNumber) {
    return {
      setCode: setWithDigitsThenNumber[1],
      number: setWithDigitsThenNumber[2],
      total: setWithDigitsThenNumber[3] ?? null,
    };
  }

  // TYPE B: Promo – "SM-P 288", "XY-P 151"
  const setThenNumber = s.match(/^([A-Z]{1,5}(?:-[A-Z]{1,3})?)\s*[/ ]?\s*(\d{1,4})(?:\/(\d{1,4}))?$/);
  if (setThenNumber) {
    return {
      setCode: setThenNumber[1],
      number: setThenNumber[2],
      total: setThenNumber[3] ?? null,
    };
  }

  // Reversed: "288/SM-P", "288 SM-P"
  const numberThenSet = s.match(/^(\d{1,4})\s*[/ ]\s*([A-Z]{1,5}(?:-[A-Z]{1,3})?)$/);
  if (numberThenSet) {
    return { number: numberThenSet[1], setCode: numberThenSet[2], total: null };
  }

  // TYPE D: number/total
  const numberSlashTotal = s.match(/^(\d{1,4})\/(\d{1,4})$/);
  if (numberSlashTotal) {
    return { number: numberSlashTotal[1], setCode: null, total: numberSlashTotal[2] };
  }

  // TYPE E: pure number
  const pureNumber = s.match(/^(\d{1,4})$/);
  if (pureNumber) {
    return { number: pureNumber[1], setCode: null, total: null };
  }

  // Embedded patterns
  const embeddedNumberThenSet = s.match(/(\d{1,4})\s*[/ ]\s*([A-Z]{1,5}(?:-[A-Z]{1,3})?)/);
  if (embeddedNumberThenSet) {
    return { number: embeddedNumberThenSet[1], setCode: embeddedNumberThenSet[2], total: null };
  }

  const embeddedSetThenNumber = s.match(/([A-Z]{1,5}(?:-[A-Z]{1,3})?)\s+(\d{1,4})/);
  if (embeddedSetThenNumber) {
    return { setCode: embeddedSetThenNumber[1], number: embeddedSetThenNumber[2], total: null };
  }

  return null;
}

export function generateCardNumberPatterns(query: string): string[] {
  const parts = parseCardNumber(query);
  if (!parts) return [];

  const { number, setCode, total } = parts;
  const patterns = new Set<string>();

  if (setCode && number) {
    const type = detectSetCodeType(setCode);
    if (type === "hyphen") {
      // ST01-012 format
      patterns.add(`%${setCode}-${number}%`);
      patterns.add(`%${setCode}%${number}%`);
    } else {
      // Space / promo format
      patterns.add(`%${setCode} ${number}%`);
      patterns.add(`%${setCode}${number}%`);
      patterns.add(`%${number}/${setCode}%`);
      patterns.add(`%${number} ${setCode}%`);
      patterns.add(`%${setCode}%${number}%`);
    }
  } else if (number && total) {
    patterns.add(`%${number}/${total}%`);
    patterns.add(`%${number}%${total}%`);
  } else if (number) {
    patterns.add(`%${number}%`);
  }

  return Array.from(patterns);
}

export function isCardNumberQuery(query: string): boolean {
  return parseCardNumber(query.trim()) !== null;
}

export function normalizeCardQuery(query: string): string {
  const parts = parseCardNumber(query);
  if (!parts) return query.trim();
  if (parts.setCode && parts.number) {
    const type = detectSetCodeType(parts.setCode);
    if (type === "hyphen") return `${parts.setCode}-${parts.number}`;
    return `${parts.setCode} ${parts.number}`;
  }
  if (parts.number && parts.total) return `${parts.number}/${parts.total}`;
  return parts.number;
}

/**
 * Determine whether a query looks like a "pure card number" (not a card name).
 */
function isPureCardNumberQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed) return false;
  const parsed = parseCardNumber(trimmed);
  if (!parsed) return false;
  const tokens = trimmed.split(/\s+/);
  for (const token of tokens) {
    if (/^\d{1,4}(?:\/\d{1,4})?$/.test(token)) continue;
    if (/^[A-Z]{1,4}(?:-[A-Z]{1,3})?\d{0,3}[A-Z]{0,2}$/.test(token) && token.length <= 8) continue;
    // Hyphen format token like "ST01-012" – entire token is a card number
    if (/^[A-Z]{2,4}\d{2}-\d{1,4}$/.test(token)) continue;
    return false;
  }
  return true;
}

/**
 * Split a search query into tokens for multi-keyword fuzzy search.
 *
 * Examples:
 *   "pikachu"          → ["pikachu"]
 *   "pikachu sm-p"     → ["pikachu", "sm-p"]
 *   "pikachu 288"      → ["pikachu", "288"]
 *   "SM-P 288"         → ["SM-P 288"]   (kept as one token – card number)
 *   "SV10 125/098"     → ["SV10 125/098"]
 *   "ST01-012"         → ["ST01-012"]   (kept as one token)
 */
export function tokenizeSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (isPureCardNumberQuery(trimmed)) {
    return [trimmed];
  }

  const tokens = trimmed.split(/\s+/).filter(t => t.length > 0);
  return tokens;
}

/**
 * Build a set of LIKE patterns for a single token.
 */
export function buildTokenPatterns(token: string): {
  namePatterns: string[];
  cardNumberPatterns: string[];
} {
  const upper = token.toUpperCase();
  const lower = token.toLowerCase();

  const cnPatterns = new Set<string>();

  // Raw LIKE on cardNumber (catches most cases)
  cnPatterns.add(`%${upper}%`);

  // If token is a pure series code, add prefix patterns
  if (isPureSeriesCodeQuery(token)) {
    for (const p of buildSeriesPrefixPatterns(token)) {
      cnPatterns.add(p);
    }
  }

  // If token parses as a card number fragment, add all format variants
  const parsed = parseCardNumber(token);
  if (parsed) {
    const { number, setCode, total } = parsed;
    if (setCode && number) {
      const type = detectSetCodeType(setCode);
      if (type === "hyphen") {
        cnPatterns.add(`%${setCode}-${number}%`);
        cnPatterns.add(`%${setCode}%${number}%`);
      } else {
        cnPatterns.add(`%${setCode} ${number}%`);
        cnPatterns.add(`%${setCode}${number}%`);
        cnPatterns.add(`%${number}/${setCode}%`);
        cnPatterns.add(`%${number} ${setCode}%`);
        cnPatterns.add(`%${setCode}%${number}%`);
      }
    } else if (number && total) {
      cnPatterns.add(`%${number}/${total}%`);
      cnPatterns.add(`%${number}%${total}%`);
    } else if (number) {
      cnPatterns.add(`%${number}%`);
    }
  }

  return {
    namePatterns: [`%${lower}%`],
    cardNumberPatterns: Array.from(cnPatterns),
  };
}
