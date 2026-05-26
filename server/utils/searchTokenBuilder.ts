/**
 * Search Token Builder
 * 
 * Builds and manages the searchTokens table which acts as an application-level
 * search index for fast card/product lookup. Since TiDB Serverless doesn't support
 * FULLTEXT indexes, we tokenize card names into searchable fragments that can
 * leverage B-tree prefix indexes (LIKE 'token%').
 * 
 * Token generation strategy:
 * - English names: split by spaces, generate each word as a token
 * - Japanese names: split into 2-char and 3-char n-grams for substring matching
 * - Card numbers: store the full card number and common fragments
 * - Series: store the series name as tokens
 * - Rarity: store the rarity code
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import { searchTokens } from "../../drizzle/schema_new";

// Tokenize an English name into searchable tokens
function tokenizeEnglishName(name: string): string[] {
  if (!name) return [];
  const lower = name.toLowerCase().trim();
  const tokens = new Set<string>();
  
  // Split by spaces and common separators (including quotes, slashes, etc.)
  const words = lower.split(/[\s\-_&+,.'"()\[\]{}!?:;\/\\|~`@#$%^*=<>]+/).filter(w => w.length > 0);
  
  for (const word of words) {
    if (word.length >= 2) {
      tokens.add(word);
    }
  }
  
  // Also add the full name (lowercased, no extra spaces) for exact-match scoring
  const normalized = lower.replace(/\s+/g, ' ');
  if (normalized.length <= 128) {
    tokens.add(normalized);
  }
  
  return Array.from(tokens);
}

// Tokenize a Japanese name into n-grams for substring matching
function tokenizeJapaneseName(name: string): string[] {
  if (!name) return [];
  const tokens = new Set<string>();
  
  // Generate 2-char and 3-char n-grams
  for (let i = 0; i < name.length - 1; i++) {
    const bigram = name.substring(i, i + 2);
    tokens.add(bigram);
    if (i < name.length - 2) {
      const trigram = name.substring(i, i + 3);
      tokens.add(trigram);
    }
  }
  
  // Also split by common Japanese separators and add individual words
  const words = name.split(/[\s・\-_()（）【】「」『』]+/).filter(w => w.length >= 2);
  for (const word of words) {
    if (word.length <= 128) {
      tokens.add(word);
    }
  }
  
  return Array.from(tokens);
}

// Tokenize a card number into searchable fragments
function tokenizeCardNumber(cardNumber: string): string[] {
  if (!cardNumber) return [];
  const tokens = new Set<string>();
  const upper = cardNumber.toUpperCase().trim();
  
  // Add the full card number
  tokens.add(upper.toLowerCase());
  
  // Split by common separators (/, -, space)
  const parts = upper.split(/[\/\-\s]+/).filter(p => p.length > 0);
  for (const part of parts) {
    tokens.add(part.toLowerCase());
  }
  
  // For numbers with leading zeros, also add without leading zeros
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const noZeros = String(parseInt(part, 10));
      if (noZeros !== part) {
        tokens.add(noZeros);
      }
    }
  }
  
  return Array.from(tokens);
}

// Tokenize series name
function tokenizeSeries(series: string): string[] {
  if (!series) return [];
  const tokens = new Set<string>();
  const lower = series.toLowerCase().trim();
  
  // Add full series name
  if (lower.length <= 128) {
    tokens.add(lower);
  }
  
  // Split by spaces and add individual words
  const words = lower.split(/[\s\-_&+,.'()[\]{}]+/).filter(w => w.length >= 2);
  for (const word of words) {
    tokens.add(word);
  }
  
  return Array.from(tokens);
}

export interface CardTokenData {
  id: number;
  name: string;
  nameJa: string | null;
  cardNumber: string | null;
  series: string | null;
  rarity: string | null;
  productType: "single_card" | "sealed_product";
}

/**
 * Generate all tokens for a single card/product
 */
export function generateTokensForCard(card: CardTokenData): Array<{
  cardId: number;
  productType: "single_card" | "sealed_product";
  token: string;
  tokenType: "name_en" | "name_ja" | "card_number" | "series" | "rarity";
}> {
  const tokens: Array<{
    cardId: number;
    productType: "single_card" | "sealed_product";
    token: string;
    tokenType: "name_en" | "name_ja" | "card_number" | "series" | "rarity";
  }> = [];
  
  // English name tokens
  for (const t of tokenizeEnglishName(card.name)) {
    tokens.push({ cardId: card.id, productType: card.productType, token: t, tokenType: "name_en" });
  }
  
  // Japanese name tokens
  if (card.nameJa) {
    for (const t of tokenizeJapaneseName(card.nameJa)) {
      tokens.push({ cardId: card.id, productType: card.productType, token: t, tokenType: "name_ja" });
    }
  }
  
  // Card number tokens
  if (card.cardNumber) {
    for (const t of tokenizeCardNumber(card.cardNumber)) {
      tokens.push({ cardId: card.id, productType: card.productType, token: t, tokenType: "card_number" });
    }
  }
  
  // Series tokens
  if (card.series) {
    for (const t of tokenizeSeries(card.series)) {
      tokens.push({ cardId: card.id, productType: card.productType, token: t, tokenType: "series" });
    }
  }
  
  // Rarity token
  if (card.rarity) {
    tokens.push({ cardId: card.id, productType: card.productType, token: card.rarity.toLowerCase(), tokenType: "rarity" });
  }
  
  return tokens;
}

/**
 * Rebuild tokens for a batch of cards (used during initial population and incremental updates)
 */
export async function rebuildTokensForCards(db: any, cardData: CardTokenData[]): Promise<number> {
  if (cardData.length === 0) return 0;
  
  const cardIds = cardData.map(c => c.id);
  
  // Delete existing tokens for these cards
  await db.delete(searchTokens).where(inArray(searchTokens.cardId, cardIds));
  
  // Generate all tokens
  const allTokens: Array<{
    cardId: number;
    productType: "single_card" | "sealed_product";
    token: string;
    tokenType: "name_en" | "name_ja" | "card_number" | "series" | "rarity";
  }> = [];
  
  for (const card of cardData) {
    const cardTokens = generateTokensForCard(card);
    allTokens.push(...cardTokens);
  }
  
  if (allTokens.length === 0) return 0;
  
  // Insert in batches of 1000 to avoid query size limits
  const BATCH_SIZE = 1000;
  for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
    const batch = allTokens.slice(i, i + BATCH_SIZE);
    await db.insert(searchTokens).values(batch);
  }
  
  return allTokens.length;
}

/**
 * Search for card IDs using the token index.
 * Returns a Set of cardIds that match ALL query tokens (AND logic).
 * Uses prefix matching (LIKE 'token%') which leverages the B-tree index.
 */
export async function searchCardIdsByTokens(
  db: any,
  queryTokens: string[],
  productType?: "single_card" | "sealed_product"
): Promise<Set<number>> {
  if (queryTokens.length === 0) return new Set();
  
  // For each query token, find matching cardIds using prefix matching
  const tokenSets: Set<number>[] = [];
  
  for (const token of queryTokens) {
    const lower = token.toLowerCase();
    
    // Use prefix matching for tokens >= 3 chars, exact for shorter ones
    let condition;
    if (lower.length >= 3) {
      if (productType) {
        condition = and(
          sql`${searchTokens.token} LIKE ${lower + '%'}`,
          eq(searchTokens.productType, productType)
        );
      } else {
        condition = sql`${searchTokens.token} LIKE ${lower + '%'}`;
      }
    } else {
      // For very short tokens (1-2 chars), use exact match to avoid too many results
      if (productType) {
        condition = and(
          eq(searchTokens.token, lower),
          eq(searchTokens.productType, productType)
        );
      } else {
        condition = eq(searchTokens.token, lower);
      }
    }
    
    const results = await db
      .selectDistinct({ cardId: searchTokens.cardId })
      .from(searchTokens)
      .where(condition);
    
    const cardIdSet = new Set<number>(results.map((r: any) => r.cardId));
    tokenSets.push(cardIdSet);
  }
  
  if (tokenSets.length === 0) return new Set();
  
  // Intersect all sets (AND logic: card must match ALL tokens)
  let result = tokenSets[0];
  for (let i = 1; i < tokenSets.length; i++) {
    const next = tokenSets[i];
    result = new Set(Array.from(result).filter(id => next.has(id)));
    // Early exit if intersection is empty
    if (result.size === 0) break;
  }
  
  return result;
}
