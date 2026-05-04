import { getDb } from "./db";
import { cards, priceHistory } from "../drizzle/schema_new";
import { eq, desc, and, gte, sql, inArray } from "drizzle-orm";

/**
 * Get trending cards based on price volatility
 * Returns cards with highest price changes in the last 7/30 days
 */
export async function getTrendingCards(
  limit: number = 10,
  timeRange: '7d' | '30d' = '7d'
): Promise<number[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const daysMap = { '7d': 7, '30d': 30 };
  const days = daysMap[timeRange];
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Query PSA10 price history grouped by card
  const priceData = await db.select({
    cardId: priceHistory.cardId,
    avgPrice: sql<number>`AVG(CAST(${priceHistory.price} AS DECIMAL(10,2)))`,
    minPrice: sql<number>`MIN(CAST(${priceHistory.price} AS DECIMAL(10,2)))`,
    maxPrice: sql<number>`MAX(CAST(${priceHistory.price} AS DECIMAL(10,2)))`,
    count: sql<number>`COUNT(*)`,
  })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA 10'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .groupBy(priceHistory.cardId)
    .having(sql`COUNT(*) >= 3`); // At least 3 transactions

  // Calculate price volatility (max - min) / avg
  const cardVolatility = priceData.map(row => ({
    cardId: row.cardId,
    volatility: ((row.maxPrice - row.minPrice) / row.avgPrice) * 100,
    count: row.count,
  }));

  // Sort by volatility descending
  cardVolatility.sort((a, b) => b.volatility - a.volatility);

  // Return top N card IDs
  return cardVolatility.slice(0, limit).map(c => c.cardId);
}

/**
 * Get most traded cards based on transaction volume
 * Returns cards with highest transaction counts in the last 7/30 days
 */
export async function getMostTradedCards(
  limit: number = 10,
  timeRange: '7d' | '30d' = '7d'
): Promise<number[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const daysMap = { '7d': 7, '30d': 30 };
  const days = daysMap[timeRange];
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Query transaction counts grouped by card
  const tradeData = await db.select({
    cardId: priceHistory.cardId,
    count: sql<number>`COUNT(*)`,
  })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA 10'),
        gte(priceHistory.soldAt, startDate)
      )
    )
    .groupBy(priceHistory.cardId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  return tradeData.map(row => row.cardId);
}

/**
 * Get cards with highest price increase
 * Returns cards with highest percentage price increase in the last 7/30 days
 */
export async function getTopGainersCards(
  limit: number = 10,
  timeRange: '7d' | '30d' = '7d'
): Promise<number[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const daysMap = { '7d': 7, '30d': 30 };
  const days = daysMap[timeRange];
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const midDate = new Date(now.getTime() - (days / 2) * 24 * 60 * 60 * 1000);

  // Get all cards with transactions
  const allPrices = await db.select({
    cardId: priceHistory.cardId,
    price: priceHistory.price,
    soldAt: priceHistory.soldAt,
  })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA 10'),
        gte(priceHistory.soldAt, startDate)
      )
    );

  // Group by card and calculate price change
  const cardPriceChanges = new Map<number, { oldAvg: number; newAvg: number; change: number }>();

  for (const row of allPrices) {
    const cardId = row.cardId;
    const price = parseFloat(row.price);
    const soldAt = row.soldAt;

    if (!soldAt) continue;

    if (!cardPriceChanges.has(cardId)) {
      cardPriceChanges.set(cardId, { oldAvg: 0, newAvg: 0, change: 0 });
    }

    const data = cardPriceChanges.get(cardId)!;

    if (soldAt < midDate) {
      data.oldAvg = (data.oldAvg + price) / 2;
    } else {
      data.newAvg = (data.newAvg + price) / 2;
    }
  }

  // Calculate percentage change
  const cardChanges = Array.from(cardPriceChanges.entries())
    .filter(([_, data]) => data.oldAvg > 0 && data.newAvg > 0)
    .map(([cardId, data]) => ({
      cardId,
      change: ((data.newAvg - data.oldAvg) / data.oldAvg) * 100,
    }))
    .sort((a, b) => b.change - a.change)
    .slice(0, limit);

  return cardChanges.map(c => c.cardId);
}

/**
 * Auto-select cards for article generation
 * Combines trending, most traded, and top gainers
 */
export async function autoSelectCardsForArticle(
  articleType: 'daily-report' | 'card-analysis' | 'market-trend' | 'news',
  timeRange: '7d' | '30d' = '7d'
): Promise<number[]> {
  const limit = articleType === 'daily-report' ? 5 : 10;

  // Get different types of cards
  const [trending, mostTraded, topGainers] = await Promise.all([
    getTrendingCards(limit, timeRange),
    getMostTradedCards(limit, timeRange),
    getTopGainersCards(limit, timeRange),
  ]);

  // Combine and deduplicate
  const combinedIds = [...trending, ...mostTraded, ...topGainers];
  const allCardIds = Array.from(new Set(combinedIds));

  // Return top N unique cards
  return allCardIds.slice(0, limit);
}
