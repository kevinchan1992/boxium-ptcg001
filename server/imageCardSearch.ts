import { invokeLLM } from "./_core/llm";
import * as db from "./db";

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
}

/**
 * Step 1: Use LLM with structured output to identify card details from image
 */
async function identifyCardFromImage(base64Image: string): Promise<CardIdentification> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert Pokémon Trading Card Game (PTCG) card identifier. Your task is to analyze card images and extract ALL visible text and identifying information from the card.

CRITICAL INSTRUCTIONS:
1. Read ALL text on the card carefully - card name, card number, set info, HP, attacks, etc.
2. The card number is usually at the bottom of the card in format like "110/080", "085/070", "001/078", etc.
3. The set name/expansion pack info may appear near the card number or at the bottom.
4. Japanese cards (日本語) have names in katakana/hiragana/kanji. Read them exactly as shown.
5. The rarity symbol is usually at the bottom-right (e.g., ★, ◆, ●, HR, SR, SAR, AR, RR, R, U, C).
6. Pokemon name is the large text at the top of the card.
7. Look for any expansion pack symbols or codes (e.g., "SV5K", "S12a", "SV6", etc.)
8. If the card is in a PSA/BGS/CGC grading slab, read the label information too.
9. Extract the EXACT text as printed - do not translate or modify it.
10. For Japanese text, provide both the original Japanese and any romanized/English equivalent if visible.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this Pokémon card image carefully. Extract ALL identifying information visible on the card.

Focus on:
- The EXACT card name as printed (top of card)
- The card number (bottom, format like "XXX/YYY")
- The set/expansion name or code
- The rarity marking
- The Pokémon's name
- Any other identifying text

Return your analysis as structured JSON.`
          },
          {
            type: "image_url",
            image_url: {
              url: base64Image,
              detail: "high",
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
            cardName: {
              type: ["string", "null"],
              description: "The full card name as printed on the card (e.g., 'リザードンex', 'Charizard ex', 'ピカチュウ VMAX')"
            },
            cardNameJa: {
              type: ["string", "null"],
              description: "The Japanese name if the card is Japanese, or null if not Japanese"
            },
            cardNumber: {
              type: ["string", "null"],
              description: "The card number as printed (e.g., '110/080', '085/070', '206/165'). Include the full format with slash."
            },
            setName: {
              type: ["string", "null"],
              description: "The expansion pack or set name/code (e.g., 'SV5K', 'バイオレットex', 'Obsidian Flames', 'S12a')"
            },
            rarity: {
              type: ["string", "null"],
              description: "The rarity of the card (e.g., 'HR', 'SR', 'SAR', 'AR', 'RR', 'R', 'U', 'C', 'UR')"
            },
            pokemonName: {
              type: ["string", "null"],
              description: "The Pokémon's name in English (e.g., 'Charizard', 'Pikachu')"
            },
            pokemonNameJa: {
              type: ["string", "null"],
              description: "The Pokémon's name in Japanese if visible (e.g., 'リザードン', 'ピカチュウ')"
            },
            language: {
              type: "string",
              description: "The primary language of the card: 'ja' for Japanese, 'en' for English, 'zh' for Chinese, 'ko' for Korean"
            },
            additionalText: {
              type: "array",
              items: { type: "string" },
              description: "Any other identifying text visible on the card (attack names, set symbols, etc.)"
            }
          },
          required: ["cardName", "cardNameJa", "cardNumber", "setName", "rarity", "pokemonName", "pokemonNameJa", "language", "additionalText"],
          additionalProperties: false
        }
      }
    }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  console.log("[Image Card Search] LLM identification result:", JSON.stringify(parsed, null, 2));
  return parsed as CardIdentification;
}

/**
 * Step 2: Multi-dimensional matching against database
 * Uses card number, name, series, and rarity for weighted scoring
 */
async function findMatchingCards(identification: CardIdentification): Promise<MatchedCard[]> {
  const allMatches: MatchedCard[] = [];
  const seenIds = new Set<number>();

  // Strategy 1: Exact card number match (highest priority)
  if (identification.cardNumber) {
    const normalizedNumber = normalizeCardNumber(identification.cardNumber);
    console.log(`[Image Card Search] Searching by card number: ${normalizedNumber}`);
    
    const numberResults = await db.searchCards(normalizedNumber, 20);
    for (const card of numberResults.cards) {
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

  // Strategy 2: Search by Japanese name (for Japanese cards)
  if (identification.cardNameJa) {
    console.log(`[Image Card Search] Searching by Japanese name: ${identification.cardNameJa}`);
    const jaResults = await db.searchCards(identification.cardNameJa, 20);
    for (const card of jaResults.cards) {
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

  // Strategy 3: Search by card name
  if (identification.cardName) {
    console.log(`[Image Card Search] Searching by card name: ${identification.cardName}`);
    const nameResults = await db.searchCards(identification.cardName, 20);
    for (const card of nameResults.cards) {
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

  // Strategy 4: Search by Pokemon name (English)
  if (identification.pokemonName && identification.pokemonName !== identification.cardName) {
    console.log(`[Image Card Search] Searching by Pokemon name: ${identification.pokemonName}`);
    const pokemonResults = await db.searchCards(identification.pokemonName, 20);
    for (const card of pokemonResults.cards) {
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

  // Strategy 5: Search by Pokemon Japanese name
  if (identification.pokemonNameJa && identification.pokemonNameJa !== identification.cardNameJa) {
    console.log(`[Image Card Search] Searching by Pokemon Japanese name: ${identification.pokemonNameJa}`);
    const pokemonJaResults = await db.searchCards(identification.pokemonNameJa, 20);
    for (const card of pokemonJaResults.cards) {
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
 * Handles formats like "110/080", "110/80", "085/070", etc.
 */
function normalizeCardNumber(cardNumber: string): string {
  // Remove leading zeros and normalize
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
      reasons.push(`寶可夢名稱匹配: ${identification.pokemonName}`);
    }
  }

  // 5. Pokemon Japanese name match (15 points)
  if (identification.pokemonNameJa && card.nameJa) {
    const pokemonNameJa = identification.pokemonNameJa.trim();
    const cardNameJa = card.nameJa.trim();
    
    if (cardNameJa.includes(pokemonNameJa)) {
      score += 15;
      reasons.push(`寶可夢日文名匹配: ${identification.pokemonNameJa}`);
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

    // Step 1: Identify card from image using LLM
    const identification = await identifyCardFromImage(base64Image);
    const llmTime = Date.now() - startTime;
    console.log(`[Image Card Search] LLM identification completed in ${llmTime}ms`);

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
        error: `識別到卡牌「${identification.cardName || identification.cardNameJa}」${identification.cardNumber ? ` (${identification.cardNumber})` : ''}，但在資料庫中未找到匹配的卡牌`,
      };
    }

    const bestMatch = matches[0];
    console.log(`[Image Card Search] Best match: ${bestMatch.name} (score: ${bestMatch.matchScore}, reasons: ${bestMatch.matchReasons.join(', ')})`);

    return {
      success: true,
      identification,
      matches,
      bestMatch,
    };
  } catch (error: any) {
    console.error("[Image Card Search] Error:", error);
    return {
      success: false,
      identification: null,
      matches: [],
      bestMatch: null,
      error: error.message || "圖片分析過程中發生錯誤",
    };
  }
}
