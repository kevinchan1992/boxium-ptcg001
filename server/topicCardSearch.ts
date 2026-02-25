import { getDb } from "./db";
import { cards } from "../drizzle/schema_new";
import { or, like, sql } from "drizzle-orm";

/**
 * Extract keywords from topic string
 * Examples:
 * - "pikachu 卡牌2月升降報導" → ["pikachu"]
 * - "伊布 進化系列 價格分析" → ["伊布", "進化"]
 * - "Charizard VMAX market trend" → ["Charizard", "VMAX"]
 */
export function extractKeywordsFromTopic(topic: string): string[] {
  // Remove common words and punctuation
  const stopWords = [
    '卡牌', '報導', '分析', '市場', '趨勢', '價格', '升降', '漲跌',
    'card', 'report', 'analysis', 'market', 'trend', 'price',
    '月', '日', '年', 'month', 'day', 'year',
    '的', '和', '與', 'and', 'or', 'the', 'a', 'an',
  ];

  // Split by spaces and Chinese characters
  const words = topic
    .toLowerCase()
    .replace(/[，。！？、；：""''（）【】《》]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);

  // Filter out stop words and keep meaningful keywords
  const keywords = words.filter(word => {
    // Keep words with at least 2 characters
    if (word.length < 2) return false;
    // Remove stop words
    if (stopWords.includes(word)) return false;
    // Remove pure numbers
    if (/^\d+$/.test(word)) return false;
    return true;
  });

  return keywords;
}

/**
 * Search cards by name (supports fuzzy matching and multilingual)
 * Searches in: name (English), nameJa (Japanese), and series/setName
 */
export async function searchCardsByName(
  keyword: string,
  limit: number = 50
): Promise<Array<{
  id: number;
  name: string;
  nameJa: string | null;
  series: string | null;
  setName: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
}>> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Build fuzzy search pattern
  const searchPattern = `%${keyword}%`;

  // Search in name, nameJa, series, and setName
  const results = await db.select({
    id: cards.id,
    name: cards.name,
    nameJa: cards.nameJa,
    series: cards.series,
    setName: cards.setName,
    cardNumber: cards.cardNumber,
    rarity: cards.rarity,
    imageUrl: cards.imageUrl,
  })
    .from(cards)
    .where(
      or(
        like(cards.name, searchPattern),
        like(cards.nameJa, searchPattern),
        like(cards.series, searchPattern),
        like(cards.setName, searchPattern)
      )
    )
    .limit(limit);

  return results;
}

/**
 * Search cards by multiple keywords
 * Returns cards that match ANY of the keywords
 */
export async function searchCardsByKeywords(
  keywords: string[],
  limit: number = 50
): Promise<number[]> {
  if (keywords.length === 0) {
    return [];
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Search for each keyword and collect unique card IDs
  const cardIdSet = new Set<number>();

  for (const keyword of keywords) {
    const results = await searchCardsByName(keyword, limit);
    results.forEach(card => cardIdSet.add(card.id));
  }

  // Convert Set to Array
  return Array.from(cardIdSet).slice(0, limit);
}

/**
 * Extract card IDs from topic string
 * Main function that combines keyword extraction and card search
 */
export async function extractCardIdsFromTopic(
  topic: string,
  limit: number = 20
): Promise<number[]> {
  // 1. Extract keywords from topic
  const keywords = extractKeywordsFromTopic(topic);
  
  console.log('[TopicCardSearch] Extracted keywords:', keywords);

  if (keywords.length === 0) {
    console.log('[TopicCardSearch] No keywords found, returning empty array');
    return [];
  }

  // 2. Search cards by keywords
  const cardIds = await searchCardsByKeywords(keywords, limit);
  
  console.log('[TopicCardSearch] Found', cardIds.length, 'cards');

  return cardIds;
}
