import { getDb } from "./db";
import { cards, priceHistory } from "../drizzle/schema_new";
import { eq, inArray, gte, desc, and, sql } from "drizzle-orm";

/**
 * Price statistics for a single card
 */
export interface CardPriceStats {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceChange7d: number;
  priceChange30d: number;
  priceChange60d: number;
  totalVolume: number;
  avgDailyVolume: number;
}

/**
 * Article data context for AI generation
 * NEW: Each card now has its own price statistics
 */
export interface ArticleDataContext {
  cards: Array<{
    id: number;
    name: string;
    nameJa: string | null;
    series: string | null;
    setName: string | null;
    cardNumber: string | null;
    rarity: string | null;
    imageUrl: string | null;
    // NEW: Individual price statistics for each card
    psa10Stats: CardPriceStats;
    usedGradeAStats: CardPriceStats;
    peakPrice: number;
    peakDate: Date | null;
  }>;
  // DEPRECATED: Global aggregated stats (kept for backward compatibility)
  psa10Stats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceChange7d: number;
    priceChange30d: number;
    priceChange60d: number;
    totalVolume: number;
    avgDailyVolume: number;
  };
  usedGradeAStats: {
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceChange7d: number;
    priceChange30d: number;
    priceChange60d: number;
    totalVolume: number;
    avgDailyVolume: number;
  };
  transactionStats: {
    peakPrice: number;
    peakDate: Date | null;
  };
}

/**
 * Calculate price statistics for a single card
 * v2: Fixed to respect timeRange parameter for both PSA10 and Grade A
 */
async function calculateCardPriceStats(
  db: any,
  cardId: number,
  grade: 'PSA10' | 'A',
  timeRange: '7d' | '30d' | '60d' | 'all'
): Promise<CardPriceStats> {
  // Map timeRange to days
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Query price history for this card within the specified time range
  const priceData = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, grade),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Calculate statistics
  const prices = priceData.map((p: { price: string }) => parseFloat(p.price));
  const avgPrice = prices.length > 0 ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const priceChange7d = calculatePriceChange(priceData, 7);
  const priceChange30d = calculatePriceChange(priceData, 30);
  const priceChange60d = calculatePriceChange(priceData, 60);
  const totalVolume = priceData.length;
  const avgDailyVolume = totalVolume / days;

  return {
    avgPrice,
    minPrice,
    maxPrice,
    priceChange7d,
    priceChange30d,
    priceChange60d,
    totalVolume,
    avgDailyVolume,
  };
}

/**
 * Get article data context from database
 * NEW: Calculates individual price statistics for each card
 */
export async function getArticleDataContext(
  cardIds: number[],
  timeRange: '7d' | '30d' | '60d' | 'all' = '30d'
): Promise<ArticleDataContext> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // 1. Query card basic info
  const cardData = await db.select({
    id: cards.id,
    name: cards.name,
    nameJa: cards.nameJa,
    series: cards.series,
    setName: cards.setName,
    cardNumber: cards.cardNumber,
    rarity: cards.rarity,
    imageUrl: cards.imageUrl,
  }).from(cards).where(inArray(cards.id, cardIds));

  // 2. Calculate individual price statistics for each card
  const cardsWithStats = await Promise.all(
    cardData.map(async (card) => {
      const psa10Stats = await calculateCardPriceStats(db, card.id, 'PSA10', timeRange);
      const usedGradeAStats = await calculateCardPriceStats(db, card.id, 'A', timeRange);
      
      // Calculate peak price for this card
      const peakPrice = Math.max(psa10Stats.maxPrice, usedGradeAStats.maxPrice);
      
      // Get peak date (most recent transaction)
      const peakDateQuery = await db.select({
        soldAt: priceHistory.soldAt,
      }).from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, card.id),
            eq(priceHistory.source, 'snkrdunk')
          )
        )
        .orderBy(desc(priceHistory.soldAt))
        .limit(1);
      
      const peakDate = peakDateQuery.length > 0 ? peakDateQuery[0].soldAt : null;

      return {
        ...card,
        psa10Stats,
        usedGradeAStats,
        peakPrice,
        peakDate,
      };
    })
  );

  // 3. Calculate global aggregated statistics (for backward compatibility)
  const daysMap = { '7d': 7, '30d': 30, '60d': 60, 'all': 365 * 10 };
  const days = daysMap[timeRange];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Query all PSA10 transactions
  const psa10Data = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Query all Grade A transactions
  const usedGradeAData = await db.select({
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  }).from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'A'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Calculate global PSA10 statistics
  const psa10Prices = psa10Data.map(p => parseFloat(p.price));
  const psa10AvgPrice = psa10Prices.length > 0 ? psa10Prices.reduce((a, b) => a + b, 0) / psa10Prices.length : 0;
  const psa10MinPrice = psa10Prices.length > 0 ? Math.min(...psa10Prices) : 0;
  const psa10MaxPrice = psa10Prices.length > 0 ? Math.max(...psa10Prices) : 0;
  const psa10Change7d = calculatePriceChange(psa10Data, 7);
  const psa10Change30d = calculatePriceChange(psa10Data, 30);
  const psa10Change60d = calculatePriceChange(psa10Data, 60);
  const psa10TotalVolume = psa10Data.length;
  const psa10AvgDailyVolume = psa10TotalVolume / days;

  // Calculate global Grade A statistics
  const usedGradeAPrices = usedGradeAData.map(p => parseFloat(p.price));
  const usedGradeAAvgPrice = usedGradeAPrices.length > 0 ? usedGradeAPrices.reduce((a, b) => a + b, 0) / usedGradeAPrices.length : 0;
  const usedGradeAMinPrice = usedGradeAPrices.length > 0 ? Math.min(...usedGradeAPrices) : 0;
  const usedGradeAMaxPrice = usedGradeAPrices.length > 0 ? Math.max(...usedGradeAPrices) : 0;
  const usedGradeAChange7d = calculatePriceChange(usedGradeAData, 7);
  const usedGradeAChange30d = calculatePriceChange(usedGradeAData, 30);
  const usedGradeAChange60d = calculatePriceChange(usedGradeAData, 60);
  const usedGradeATotalVolume = usedGradeAData.length;
  const usedGradeAAvgDailyVolume = usedGradeATotalVolume / days;

  // Calculate transaction statistics
  const allTransactions = [...psa10Data, ...usedGradeAData];
  const allPrices = allTransactions.map(p => parseFloat(p.price));
  const peakPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const peakDateQuery = allTransactions.sort((a, b) => {
    const dateA = a.soldAt instanceof Date ? a.soldAt.getTime() : (a.soldAt ? new Date(a.soldAt).getTime() : 0);
    const dateB = b.soldAt instanceof Date ? b.soldAt.getTime() : (b.soldAt ? new Date(b.soldAt).getTime() : 0);
    return dateB - dateA;
  })[0];
  const peakDate = peakDateQuery ? peakDateQuery.soldAt : null;

  return {
    cards: cardsWithStats,
    psa10Stats: {
      avgPrice: psa10AvgPrice,
      minPrice: psa10MinPrice,
      maxPrice: psa10MaxPrice,
      priceChange7d: psa10Change7d,
      priceChange30d: psa10Change30d,
      priceChange60d: psa10Change60d,
      totalVolume: psa10TotalVolume,
      avgDailyVolume: psa10AvgDailyVolume,
    },
    usedGradeAStats: {
      avgPrice: usedGradeAAvgPrice,
      minPrice: usedGradeAMinPrice,
      maxPrice: usedGradeAMaxPrice,
      priceChange7d: usedGradeAChange7d,
      priceChange30d: usedGradeAChange30d,
      priceChange60d: usedGradeAChange60d,
      totalVolume: usedGradeATotalVolume,
      avgDailyVolume: usedGradeAAvgDailyVolume,
    },
    transactionStats: {
      peakPrice,
      peakDate,
    },
  };
}

/**
 * Calculate price change percentage over N days
 */
function calculatePriceChange(priceData: any[], days: number): number {
  if (priceData.length < 2) return 0;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Find oldest and newest prices within the time range
  const recentPrices = priceData.filter(p => new Date(p.soldAt) >= cutoffDate);
  
  if (recentPrices.length < 2) {
    return 0;
  }

  const newestPrice = parseFloat(recentPrices[0].price);
  const oldestPrice = parseFloat(recentPrices[recentPrices.length - 1].price);

  if (oldestPrice === 0) return 0;
  return ((newestPrice - oldestPrice) / oldestPrice) * 100;
}

/**
 * Generate article using AI
 */
export async function generateArticle(input: any): Promise<any> {
  // This is a placeholder - implement based on your AI service
  return {
    title: "Generated Article",
    content: "Article content will be generated here",
    status: "draft",
  };
}
