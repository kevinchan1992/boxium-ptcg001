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
 *
 *   TYPE F – Compound card number (Yu-Gi-Oh / other):
 *     YGOPR-JP001, ROTD-JP001, DAMA-EN001
 *     Set code = letters, then hyphen, then region+number
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
  // NOTE: We limit to at most 2 digits to avoid matching card number suffixes like JP001 (3 digits)
  if (/^[A-Z]{1,4}\d{1,2}[A-Z]{0,2}$/.test(upper)) return "space";

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
  // Exclude compound card number suffixes like JP001, EN001 (2 letters + 3 digits)
  // These are card number parts, not set codes
  if (/^[A-Z]{2,3}\d{3,4}$/.test(trimmed)) return false;
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

  // Reversed: "288/SM-P", "288 SM-P", "074/SM-P"
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
 * A query is a pure card number if ALL space-separated tokens are either:
 * - A pure number: e.g. "012", "125/098"
 * - A valid set code (as determined by detectSetCodeType): e.g. "SV10", "SM-P", "ST01", "SM"
 * - A full hyphen-format card number: e.g. "ST01-012"
 * - A compound card number suffix: e.g. "JP001"
 * This prevents names like "Monkey", "Pikachu", "Luffy" from being treated as set codes.
 */
function isPureCardNumberQuery(query: string): boolean {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed) return false;
  const parsed = parseCardNumber(trimmed);
  if (!parsed) return false;
  const tokens = trimmed.split(/\s+/);
  for (const token of tokens) {
    // Pure number or number/total
    if (/^\d{1,4}(?:\/\d{1,4})?$/.test(token)) continue;
    // Full hyphen-format card number: ST01-012
    if (/^[A-Z]{2,4}\d{2}-\d{1,4}$/.test(token)) continue;
    // Compound card number suffix: JP001, EN001
    if (/^[A-Z]{2,3}\d{3,4}$/.test(token)) continue;
    // Valid set code (uses the same logic as detectSetCodeType)
    if (detectSetCodeType(token) !== null) continue;
    // None of the above → this token is a card name word, not a card number
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
 * Now handles:
 * - Case-insensitive matching (always uppercase for cardNumber)
 * - Reversed formats: "074/sm-p" → matches "SM-P 74"
 * - Compound card numbers: "JP001" → matches "-JP001" in card numbers like "YGOPR-JP001"
 * - Leading zeros: "074" matches "74" and vice versa
 * - Single-letter tokens: only match word boundaries in names, not card numbers
 */
export function buildTokenPatterns(token: string): {
  namePatterns: string[];
  cardNumberPatterns: string[];
  isSingleLetter?: boolean;
} {
  const upper = token.toUpperCase();
  const lower = token.toLowerCase();

  // Single-letter tokens (e.g. "D" in "Monkey D 012") should only match
  // word boundaries in names (e.g. " D " or " D."), not card numbers.
  // This prevents false positives like matching every card with "D" in the name.
  if (upper.length === 1 && /^[A-Z]$/.test(upper)) {
    return {
      namePatterns: [`% ${lower} %`, `% ${lower}.%`, `${lower} %`, `% ${lower}`],
      cardNumberPatterns: [],
      isSingleLetter: true,
    };
  }

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
        // Also handle reversed format: "074/sm-p" → "SM-P 74" (strip leading zeros)
        const numNoLeadingZeros = String(parseInt(number, 10));
        if (numNoLeadingZeros !== number) {
          cnPatterns.add(`%${setCode} ${numNoLeadingZeros}%`);
          cnPatterns.add(`%${setCode}${numNoLeadingZeros}%`);
          cnPatterns.add(`%${numNoLeadingZeros}/${setCode}%`);
          cnPatterns.add(`%${setCode}%${numNoLeadingZeros}%`);
        }
        // Handle zero-padded variants: "74" → also try "074"
        if (number.length < 3) {
          const padded = number.padStart(3, '0');
          cnPatterns.add(`%${setCode} ${padded}%`);
          cnPatterns.add(`%${setCode}${padded}%`);
        }
      }
    } else if (number && total) {
      cnPatterns.add(`%${number}/${total}%`);
      cnPatterns.add(`%${number}%${total}%`);
    } else if (number) {
      cnPatterns.add(`%${number}%`);
    }
  }

  // Handle compound card number suffix patterns: "JP001" → matches "-JP001" or " JP001"
  // This covers Yu-Gi-Oh style: YGOPR-JP001, ROTD-JP001
  if (/^[A-Z]{2,3}\d{3,4}$/.test(upper)) {
    cnPatterns.add(`%-${upper}%`);
    cnPatterns.add(`% ${upper}%`);
    // Also try without leading zeros in the number part
    const letterPart = upper.match(/^([A-Z]+)/)?.[1] ?? '';
    const numPart = upper.match(/(\d+)$/)?.[1] ?? '';
    if (letterPart && numPart) {
      const numNoZero = String(parseInt(numPart, 10));
      if (numNoZero !== numPart) {
        cnPatterns.add(`%-${letterPart}${numNoZero}%`);
        cnPatterns.add(`% ${letterPart}${numNoZero}%`);
      }
    }
  }

  return {
    namePatterns: [`%${lower}%`],
    cardNumberPatterns: Array.from(cnPatterns),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RELEVANCE SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a card's relevance to a search query.
 * Higher score = more relevant.
 *
 * Scoring tiers:
 *   100 – Exact card number match (case-insensitive)
 *    90 – Card number starts with query
 *    80 – Card number contains exact query (substring)
 *    70 – Exact name match (case-insensitive)
 *    60 – Name starts with query
 *    50 – All tokens match card number closely
 *    40 – All tokens match name closely
 *    20 – Partial match (some tokens match)
 *     0 – No meaningful match
 */
export function scoreCardRelevance(
  card: { name: string | null; nameJa?: string | null; cardNumber: string | null },
  query: string,
  tokens: string[]
): number {
  const queryUpper = query.trim().toUpperCase();
  const cardNumberUpper = (card.cardNumber ?? '').toUpperCase();
  const nameUpper = (card.name ?? '').toUpperCase();
  const nameJaUpper = (card.nameJa ?? '').toUpperCase();

  let score = 0;

  // Tier 1: Exact card number match
  if (cardNumberUpper === queryUpper) {
    score = Math.max(score, 100);
  }

  // Tier 2: Card number starts with query
  if (cardNumberUpper.startsWith(queryUpper)) {
    score = Math.max(score, 90);
  }

  // Tier 3: Card number contains exact query
  if (cardNumberUpper.includes(queryUpper)) {
    score = Math.max(score, 80);
  }

  // Tier 4: Exact name match
  if (nameUpper === queryUpper || nameJaUpper === queryUpper) {
    score = Math.max(score, 70);
  }

  // Tier 5: Name starts with query
  if (nameUpper.startsWith(queryUpper) || nameJaUpper.startsWith(queryUpper)) {
    score = Math.max(score, 60);
  }

  // Token-level scoring
  if (tokens.length > 1) {
    let cardNumberTokenMatches = 0;
    let nameTokenMatches = 0;
    let exactCardNumberTokenMatches = 0;

    for (const token of tokens) {
      const tokenUpper = token.toUpperCase();
      const tokenLower = token.toLowerCase();

      // Check card number match
      if (cardNumberUpper.includes(tokenUpper)) {
        cardNumberTokenMatches++;
        // Bonus for exact segment match (e.g. "ST01" in "ST01-012")
        if (cardNumberUpper.split(/[-\s/]/).some(seg => seg === tokenUpper)) {
          exactCardNumberTokenMatches++;
        }
      }

      // Check name match
      if (nameUpper.includes(tokenUpper) || nameJaUpper.includes(tokenUpper) ||
          (card.name && card.name.toLowerCase().includes(tokenLower))) {
        nameTokenMatches++;
      }
    }

    const totalTokens = tokens.length;

    // All tokens match card number
    if (cardNumberTokenMatches === totalTokens) {
      const exactBonus = exactCardNumberTokenMatches * 5;
      score = Math.max(score, 50 + exactBonus);
    }

    // All tokens match name
    if (nameTokenMatches === totalTokens) {
      score = Math.max(score, 40);
    }

    // Mixed: some tokens match card number, some match name
    if (cardNumberTokenMatches + nameTokenMatches >= totalTokens) {
      score = Math.max(score, 35);
    }

    // Partial match: more than half tokens match
    const totalMatches = Math.max(cardNumberTokenMatches, nameTokenMatches);
    if (totalMatches > 0 && totalMatches < totalTokens) {
      score = Math.max(score, 20 * (totalMatches / totalTokens));
    }
  } else if (tokens.length === 1) {
    // Single token scoring
    const tokenUpper = tokens[0].toUpperCase();
    const tokenLower = tokens[0].toLowerCase();

    if (cardNumberUpper.includes(tokenUpper)) {
      score = Math.max(score, 75);
      // Bonus if it's an exact segment
      if (cardNumberUpper.split(/[-\s/]/).some(seg => seg === tokenUpper)) {
        score = Math.max(score, 82);
      }
    }

    if (nameUpper.includes(tokenUpper) || (card.name && card.name.toLowerCase().includes(tokenLower))) {
      score = Math.max(score, 45);
    }
  }

  // Bonus: card number contains the numeric part of query (helps with "012" matching "ST01-012")
  // But penalize if the number appears in too many contexts (avoid false positives)
  const queryNumbers = queryUpper.match(/\d+/g) ?? [];
  const queryLetters = queryUpper.match(/[A-Z]+/g) ?? [];

  if (queryNumbers.length > 0 && queryLetters.length > 0) {
    // Mixed query (has both letters and numbers) - check if card number contains both parts
    const hasAllNumbers = queryNumbers.every(n => {
      const nNoZero = String(parseInt(n, 10));
      return cardNumberUpper.includes(n) || cardNumberUpper.includes(nNoZero);
    });
    const hasAllLetters = queryLetters.every(l => cardNumberUpper.includes(l));

    if (hasAllNumbers && hasAllLetters) {
      score = Math.max(score, 55);
    }
  }

  return score;
}
