import { ENV } from "./_core/env";
import * as db from "./db";
import * as crypto from "crypto";
import { normalizeCardQuery } from "./utils/cardNumberNormalize";

// ─── Fast LLM call bypassing the global thinking/max_tokens defaults ──────────
const LLM_API_URL = () =>
  ENV.forgeApiUrl
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://api.manus.im/v1/chat/completions";

async function invokeFastLLM(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch(LLM_API_URL(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} – ${errorText}`);
  }
  return response.json();
}

// ─── In-memory LRU cache for image identification results (24h TTL) ──────────
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const imageCache = new Map<string, { result: any; ts: number }>();

function getImageHash(base64Image: string): string {
  // Hash only the first 8KB + last 1KB to avoid hashing multi-MB strings
  const sample = base64Image.slice(0, 8192) + base64Image.slice(-1024);
  return crypto.createHash("md5").update(sample).digest("hex");
}

function getCachedIdentification(hash: string): any | null {
  const entry = imageCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.ts > IMAGE_CACHE_TTL_MS) {
    imageCache.delete(hash);
    return null;
  }
  return entry.result;
}

function setCachedIdentification(hash: string, result: any): void {
  // Keep cache size bounded (max 200 entries)
  if (imageCache.size >= 200) {
    const oldest = Array.from(imageCache.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) imageCache.delete(oldest[0]);
  }
  imageCache.set(hash, { result, ts: Date.now() });
}

/**
 * Structured card identification result from LLM
 */
interface CardIdentification {
  cardName: string | null;
  cardNameJa: string | null;
  cardNumber: string | null;
  setName: string | null;
  rarity: string | null;
  pokemonName: string | null;
  pokemonNameJa: string | null;
  language: string;
  additionalText: string[];
}

/**
 * Matched card result with confidence score
 */
export interface MatchedCard {
  id: number;
  name: string;
  nameJa: string | null;
  cardNumber: string | null;
  series: string | null;
  setName: string | null;
  rarity: string | null;
  imageUrl: string | null;
  matchScore: number;
  matchReasons: string[];
  latestPrice: number | null;
}

/**
 * Search result from image analysis
 */
export interface ImageSearchResult {
  success: boolean;
  identification: CardIdentification | null;
  matches: MatchedCard[];
  bestMatch: MatchedCard | null;
  error?: string;
  cached?: boolean;
}

/**
 * Step 1: Use LLM with structured output to identify card details from image.
 * Uses a fast direct API call (no thinking budget, low max_tokens) + in-memory cache.
 */
async function identifyCardFromImage(base64Image: string): Promise<{ identification: CardIdentification; cached: boolean }> {
  // Check cache first
  const hash = getImageHash(base64Image);
  const cached = getCachedIdentification(hash);
  if (cached) {
    console.log("[Image Card Search] Cache HIT – returning cached identification");
    return { identification: cached as CardIdentification, cached: true };
  }

  // Direct API call: disable thinking, cap max_tokens at 512 for fast JSON output
  const response = await invokeFastLLM({
    model: "gemini-2.5-flash",
    max_tokens: 512,
    // thinking disabled (budget_tokens: 0) – card OCR needs no chain-of-thought
    thinking: { budget_tokens: 0 },
    messages: [
      {
        role: "system",
        content: "You are a TCG card OCR tool. Extract card info as JSON. Be concise and fast.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Read this TCG card image and return JSON with: cardName (printed name), cardNameJa (Japanese name or null), cardNumber (e.g. '110/080' or null), setName (set code/name or null), rarity (HR/SR/SAR/AR/R/etc or null), pokemonName (English or null), pokemonNameJa (Japanese or null), language ('ja'/'en'/'zh'/'ko'), additionalText (array of other text). Extract EXACT text as printed.",
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image,
              detail: "low",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "card_identification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            cardName: { type: ["string", "null"] },
            cardNameJa: { type: ["string", "null"] },
            cardNumber: { type: ["string", "null"] },
            setName: { type: ["string", "null"] },
            rarity: { type: ["string", "null"] },
            pokemonName: { type: ["string", "null"] },
            pokemonNameJa: { type: ["string", "null"] },
            language: { type: "string" },
            additionalText: { type: "array", items: { type: "string" } },
          },
          required: ["cardName", "cardNameJa", "cardNumber", "setName", "rarity", "pokemonName", "pokemonNameJa", "language", "additionalText"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  console.log("[Image Card Search] LLM identification result:", JSON.stringify(parsed, null, 2));

  // Store in cache
  setCachedIdentification(hash, parsed);

  return { identification: parsed as CardIdentification, cached: false };
}

/**
 * Step 2: Multi-dimensional matching against database
 * Uses card number, name, series, and rarity for weighted scoring
 */
async function findMatchingCards(identification: CardIdentification): Promise<MatchedCard[]> {
  // Build list of unique search queries to run in parallel
  const searchQueries: Array<{ query: string; label: string }> = [];

  if (identification.cardNumber) {
    const normalizedNumber = normalizeCardNumber(identification.cardNumber);
    searchQueries.push({ query: normalizedNumber, label: `card number: ${normalizedNumber}` });
  }
  if (identification.cardNameJa) {
    searchQueries.push({ query: identification.cardNameJa, label: `Japanese name: ${identification.cardNameJa}` });
  }
  if (identification.cardName) {
    searchQueries.push({ query: identification.cardName, label: `card name: ${identification.cardName}` });
  }
  if (identification.pokemonName && identification.pokemonName !== identification.cardName) {
    searchQueries.push({ query: identification.pokemonName, label: `Pokemon name: ${identification.pokemonName}` });
  }
  if (identification.pokemonNameJa && identification.pokemonNameJa !== identification.cardNameJa) {
    searchQueries.push({ query: identification.pokemonNameJa, label: `Pokemon Japanese name: ${identification.pokemonNameJa}` });
  }

  // Deduplicate queries (avoid running the same search twice)
  const uniqueQueries = searchQueries.filter(
    (q, idx, arr) => arr.findIndex(x => x.query === q.query) === idx
  );

  console.log(`[Image Card Search] Running ${uniqueQueries.length} search strategies in parallel`);

  // Execute all DB searches in parallel
  const results = await Promise.all(
    uniqueQueries.map(({ query, label }) =>
      db.searchCards(query, 20)
        .then(r => ({ cards: r.cards, label }))
        .catch(err => {
          console.warn(`[Image Card Search] Search failed for ${label}:`, err.message);
          return { cards: [], label };
        })
    )
  );

  // Merge results, deduplicating by card ID
  const allMatches: MatchedCard[] = [];
  const seenIds = new Set<number>();

  for (const { cards } of results) {
    for (const card of cards) {
      if (seenIds.has(card.id)) continue;
      seenIds.add(card.id);

      const { score, reasons } = calculateMatchScore(card, identification);
      allMatches.push({
        id: card.id,
        name: card.name,
        nameJa: card.nameJa || null,
        cardNumber: card.cardNumber || null,
        series: card.series || null,
        setName: card.setName || null,
        rarity: card.rarity || null,
        imageUrl: card.imageUrl || null,
        matchScore: score,
        matchReasons: reasons,
        latestPrice: card.latestPrice || null,
      });
    }
  }

  // Sort by match score (highest first)
  allMatches.sort((a, b) => b.matchScore - a.matchScore);

  // Return top 10 matches
  return allMatches.slice(0, 10);
}

/**
 * Normalize card number for comparison
 * Handles formats like "110/080", "110/80", "085/070", "SM-P 288", "288/SM-P", etc.
 */
function normalizeCardNumber(cardNumber: string): string {
  // First try smart normalization (handles set code variants)
  const smart = normalizeCardQuery(cardNumber);
  if (smart !== cardNumber.trim()) return smart;
  // Fallback: remove leading zeros
  return cardNumber
    .replace(/^0+/, '')
    .replace(/\/0+/, '/')
    .trim();
}

/**
 * Calculate match score based on multiple dimensions
 * Higher score = better match
 */
function calculateMatchScore(
  card: any,
  identification: CardIdentification
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Card number match (highest weight: 50 points)
  if (identification.cardNumber && card.cardNumber) {
    const identNum = normalizeCardNumber(identification.cardNumber);
    const cardNum = normalizeCardNumber(card.cardNumber);
    
    if (identNum === cardNum) {
      score += 50;
      reasons.push(`卡號完全匹配: ${card.cardNumber}`);
    } else if (identNum.split('/')[0] === cardNum.split('/')[0]) {
      // First part matches (e.g., "110" in "110/080")
      score += 20;
      reasons.push(`卡號部分匹配: ${card.cardNumber}`);
    }
  }

  // 2. Japanese name match (30 points)
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

  // 3. English/card name match (25 points)
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

  // 4. Pokemon name match (15 points)
  if (identification.pokemonName && card.name) {
    const pokemonName = identification.pokemonName.toLowerCase().trim();
    const cardName = card.name.toLowerCase().trim();
    
    if (cardName.includes(pokemonName)) {
      score += 15;
      reasons.push(`卡牌名稱匹配: ${identification.pokemonName}`);
    }
  }

  // 5. Pokemon Japanese name match (15 points)
  if (identification.pokemonNameJa && card.nameJa) {
    const pokemonNameJa = identification.pokemonNameJa.trim();
    const cardNameJa = card.nameJa.trim();
    
    if (cardNameJa.includes(pokemonNameJa)) {
      score += 15;
      reasons.push(`卡牌日文名匹配: ${identification.pokemonNameJa}`);
    }
  }

  // 6. Rarity match (10 points)
  if (identification.rarity && card.rarity) {
    const identRarity = identification.rarity.toUpperCase().trim();
    const cardRarity = card.rarity.toUpperCase().trim();
    
    if (identRarity === cardRarity) {
      score += 10;
      reasons.push(`稀有度匹配: ${card.rarity}`);
    }
  }

  // 7. Set/Series match (10 points)
  if (identification.setName) {
    const identSet = identification.setName.toLowerCase().trim();
    
    if (card.setName) {
      const cardSet = card.setName.toLowerCase().trim();
      if (cardSet.includes(identSet) || identSet.includes(cardSet)) {
        score += 10;
        reasons.push(`系列匹配: ${card.setName}`);
      }
    }
    
    if (card.series) {
      const cardSeries = card.series.toLowerCase().trim();
      if (cardSeries.includes(identSet) || identSet.includes(cardSeries)) {
        score += 8;
        reasons.push(`擴充包匹配: ${card.series}`);
      }
    }
  }

  return { score, reasons };
}

/**
 * Main function: Search for a card by image
 * Uses LLM for identification + multi-dimensional database matching
 */
export async function searchCardByImage(base64Image: string): Promise<ImageSearchResult> {
  try {
    console.log("[Image Card Search] Starting enhanced image recognition...");
    const startTime = Date.now();

    // Step 1: Identify card from image using LLM (with cache)
    const { identification, cached } = await identifyCardFromImage(base64Image);
    const llmTime = Date.now() - startTime;
    console.log(`[Image Card Search] LLM identification completed in ${llmTime}ms (cached: ${cached})`);

    // Validate that we got at least some useful information
    if (!identification.cardName && !identification.cardNameJa && !identification.cardNumber) {
      console.log("[Image Card Search] Could not identify any card information from image");
      return {
        success: false,
        identification,
        matches: [],
        bestMatch: null,
        error: "無法從圖片中識別到卡牌信息，請確保圖片清晰且包含完整的卡牌",
      };
    }

    // Step 2: Find matching cards in database
    const matches = await findMatchingCards(identification);
    const totalTime = Date.now() - startTime;
    console.log(`[Image Card Search] Found ${matches.length} matches in ${totalTime}ms`);

    if (matches.length === 0) {
      // No matches found - return identification info for user reference
      return {
        success: true,
        identification,
        matches: [],
        bestMatch: null,
        cached,
        error: `識別到卡牌「${identification.cardName || identification.cardNameJa}」，但在資料庫中找不到匹配的卡牌`,
      };
    }

    // Return best match (highest score)
    const bestMatch = matches[0];
    console.log(`[Image Card Search] Best match: ${bestMatch.name} (score: ${bestMatch.matchScore})`);

    return {
      success: true,
      identification,
      matches,
      bestMatch: bestMatch.matchScore >= 20 ? bestMatch : null,
      cached,
    };
  } catch (error) {
    console.error("[Image Card Search] Error:", error);
    return {
      success: false,
      identification: null,
      matches: [],
      bestMatch: null,
      error: error instanceof Error ? error.message : "圖片搜尋失敗",
    };
  }
}
