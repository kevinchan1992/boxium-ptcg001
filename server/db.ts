import { eq, desc, asc, and, gte, lte, or, like, sql, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, cards, priceHistory, watchlist, marketTrends, dataSources, InsertDataSource, firecrawlUsage, systemSettings, InsertSystemSetting, searchStats, InsertSearchStat, scheduleConfig, InsertScheduleConfig, priceUpdateSchedule, trendingCardsCache, InsertTrendingCardsCache, scheduleExecutionHistory } from "../drizzle/schema_new";;
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Card queries
export async function searchCards(query: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(cards)
    .where(
      or(
        like(cards.name, `%${query}%`),
        like(cards.nameJa, `%${query}%`),
        like(cards.cardNumber, `%${query}%`)
      )
    )
    .limit(limit);

  return result;
}

export async function getCardById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCardByCardId(cardId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(cards).where(eq(cards.cardId, cardId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get card by SNKRDUNK ID
 */
export async function getCardBySnkrdunkId(snkrdunkId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(cards).where(eq(cards.snkrdunkId, snkrdunkId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}



export async function getAllCards() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(cards);
  return result;
}

export async function getTotalCardCount() {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.select({ count: sql<number>`count(*)` }).from(cards);
  return result[0]?.count || 0;
}

export async function getPopularCards(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  // For now, return latest cards. In future, can be based on view count or price trends
  const result = await db
    .select()
    .from(cards)
    .orderBy(desc(cards.createdAt))
    .limit(limit);

  return result;
}

// Price history queries
export async function getPriceHistoryByCardId(cardId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.cardId, cardId))
    .orderBy(desc(priceHistory.soldAt));
  
  return result;
}

export async function getPriceHistory(cardId: number, source?: string, grade?: string, limit: number = 50, days?: number) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(priceHistory.cardId, cardId)];
  
  if (source) {
    conditions.push(eq(priceHistory.source, source as any));
  }
  
  if (grade) {
    // Special handling for "中古" - should match A, B, C, D grades
    if (grade === "中古") {
      conditions.push(inArray(priceHistory.grade, ["A", "B", "C", "D"]));
    } else {
      conditions.push(eq(priceHistory.grade, grade));
    }
  }

  // 如果指定了 days 參數，篩選最近 N 天的記錄
  if (days && days > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    conditions.push(gte(priceHistory.soldAt, cutoffDate));
  }

  const result = await db
    .select()
    .from(priceHistory)
    .where(and(...conditions))
    .orderBy(desc(priceHistory.soldAt))
    .limit(limit);

  return result;
}

export async function getPriceStatistics(cardId: number, source?: string, grade?: string) {
  const db = await getDb();
  if (!db) return null;

  let conditions = [eq(priceHistory.cardId, cardId)];
  
  if (source) {
    conditions.push(eq(priceHistory.source, source as any));
  }
  
  if (grade) {
    conditions.push(eq(priceHistory.grade, grade));
  }

  const prices = await db
    .select()
    .from(priceHistory)
    .where(and(...conditions));

  if (prices.length === 0) return null;

  const priceValues = prices.map(p => parseFloat(p.price));
  const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  return {
    avgPrice: avgPrice.toFixed(2),
    minPrice: minPrice.toFixed(2),
    maxPrice: maxPrice.toFixed(2),
    count: prices.length,
  };
}

// Market trends queries
export async function getMarketTrends(cardId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(marketTrends.cardId, cardId)];
  
  if (startDate) {
    conditions.push(gte(marketTrends.date, startDate));
  }
  
  if (endDate) {
    conditions.push(lte(marketTrends.date, endDate));
  }

  const result = await db
    .select()
    .from(marketTrends)
    .where(and(...conditions))
    .orderBy(desc(marketTrends.date));

  return result;
}

// Watchlist queries
export async function getUserWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt));

  return result;
}

export async function addToWatchlist(userId: number, cardId: number, targetPrice?: string, notes?: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(watchlist).values({
    userId,
    cardId,
    targetPrice,
    notes,
  });

  return result;
}

export async function removeFromWatchlist(userId: number, cardId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.cardId, cardId)));

  return result;
}

// Data source management queries

/**
 * Check if a data source with the given URL already exists
 */
export async function checkDataSourceExists(url: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Normalize URL by removing query parameters and fragments
  const normalizedUrl = url.split('?')[0].split('#')[0];

  const result = await db
    .select({ id: dataSources.id })
    .from(dataSources)
    .where(eq(dataSources.sourceUrl, normalizedUrl))
    .limit(1);

  return result.length > 0;
}

export async function getDataSources(options?: { page?: number; pageSize?: number; search?: string; status?: "all" | "success" | "pending" | "failed" }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, totalPages: 0 };

  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const searchQuery = options?.search?.toLowerCase();
  const statusFilter = options?.status ?? "all";

  // Build WHERE conditions for search and status
  const conditions = [];
  if (searchQuery) {
    conditions.push(
      or(
        like(cards.name, `%${searchQuery}%`),
        like(dataSources.sourceUrl, `%${searchQuery}%`)
      )
    );
  }
  if (statusFilter !== "all") {
    conditions.push(eq(dataSources.lastFetchStatus, statusFilter));
  }
  const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count with search filter
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(dataSources)
    .leftJoin(cards, eq(dataSources.cardId, cards.id))
    .where(whereConditions);
  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  // Get paginated data with search filter
  const result = await db
    .select({
      id: dataSources.id,
      cardId: dataSources.cardId,
      source: dataSources.source,
      sourceUrl: dataSources.sourceUrl,
      isActive: dataSources.isActive,
      lastFetchedAt: dataSources.lastFetchedAt,
      lastFetchStatus: dataSources.lastFetchStatus,
      fetchErrorMessage: dataSources.fetchErrorMessage,
      createdAt: dataSources.createdAt,
      card: {
        id: cards.id,
        name: cards.name,
        imageUrl: cards.imageUrl,
      },
    })
    .from(dataSources)
    .leftJoin(cards, eq(dataSources.cardId, cards.id))
    .where(whereConditions)
    .orderBy(desc(dataSources.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { data: result, total, totalPages };
}

export async function addDataSource(data: Omit<InsertDataSource, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;

  // Normalize URL by removing query parameters and fragments
  const normalizedUrl = data.sourceUrl.split('?')[0].split('#')[0];
  
  // Check if URL already exists (normalized comparison)
  const allSources = await db.select().from(dataSources);
  const isDuplicate = allSources.some(source => {
    const existingNormalized = source.sourceUrl.split('?')[0].split('#')[0];
    return existingNormalized === normalizedUrl;
  });
  
  if (isDuplicate) {
    console.log(`[Database] Data source already exists: ${normalizedUrl}`);
    return null; // Return null if duplicate
  }

  const result = await db.insert(dataSources).values({
    ...data,
    lastFetchStatus: "pending",
  });

  return result;
}

export async function updateDataSourceFetchStatus(
  dataSourceId: number,
  status: string,
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .update(dataSources)
    .set({
      lastFetchedAt: new Date(),
      lastFetchStatus: status,
      fetchErrorMessage: errorMessage || null,
      updatedAt: new Date(),
    })
    .where(eq(dataSources.id, dataSourceId));

  return result;
}

export async function updateDataSourceCardId(
  dataSourceId: number,
  cardId: number
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .update(dataSources)
    .set({
      cardId,
      updatedAt: new Date(),
    })
    .where(eq(dataSources.id, dataSourceId));

  return result;
}

export async function getDataSourceById(dataSourceId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function deleteDataSource(dataSourceId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .delete(dataSources)
    .where(eq(dataSources.id, dataSourceId));

  return result;
}

export async function createCard(data: Omit<typeof cards.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(cards).values(data);

  // Get the newly created card
  const newCard = await db
    .select()
    .from(cards)
    .where(eq(cards.cardId, data.cardId))
    .limit(1);

  return newCard[0].id;
}

export async function updateCard(
  cardId: number,
  data: Partial<Omit<typeof cards.$inferInsert, "id" | "cardId" | "createdAt">>
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .update(cards)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId));

  return result;
}

export async function addPriceHistory(data: {
  cardId: number;
  source: "snkrdunk" | "ebay" | "tcgplayer" | "other";
  price: string;
  currency: string;
  grade?: string;
  soldAt?: Date;
  listingUrl?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(priceHistory).values({
    cardId: data.cardId,
    source: data.source,
    price: data.price,
    currency: data.currency,
    grade: data.grade,
    soldAt: data.soldAt,
    listingUrl: data.listingUrl,
  });

  return result;
}

/**
 * Add search statistics record
 */
export async function addSearchStat(data: InsertSearchStat) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(searchStats).values(data);

  return result;
}

/**
 * Log user search behavior (for trending cards by search popularity)
 */
export async function logUserSearch(data: {
  cardId: number;
  searchQuery?: string;
  source: 'search_page' | 'card_click' | 'trending_page' | 'home_page';
  userId?: number;
  sessionId?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const { userSearchLogs } = await import("../drizzle/schema_new");
  
  const result = await db.insert(userSearchLogs).values({
    cardId: data.cardId,
    searchQuery: data.searchQuery || null,
    source: data.source,
    userId: data.userId || null,
    sessionId: data.sessionId || null,
  });

  return result;
}

/**
 * Get search statistics summary
 */
export async function getSearchStats() {
  const db = await getDb();
  if (!db) return null;

  // 獲取總搜尋次數
  const totalSearches = await db.select({ count: sql<number>`count(*)` }).from(searchStats);
  
  // 獲取圖片搜尋成功次數
  const imageSearches = await db.select({ count: sql<number>`count(*)` })
    .from(searchStats)
    .where(eq(searchStats.searchMethod, 'image'));
  
  // 獲取文字搜尋次數
  const textSearches = await db.select({ count: sql<number>`count(*)` })
    .from(searchStats)
    .where(eq(searchStats.searchMethod, 'text'));
  
  // 獲取平均搜尋時間（圖片）
  const avgImageDuration = await db.select({ avg: sql<number>`avg(searchDuration)` })
    .from(searchStats)
    .where(eq(searchStats.searchMethod, 'image'));
  
  // 獲取平均搜尋時間（文字）
  const avgTextDuration = await db.select({ avg: sql<number>`avg(searchDuration)` })
    .from(searchStats)
    .where(eq(searchStats.searchMethod, 'text'));
  
  // 獲取成功的搜尋次數
  const successfulSearches = await db.select({ count: sql<number>`count(*)` })
    .from(searchStats)
    .where(eq(searchStats.success, true));

  return {
    totalSearches: Number(totalSearches[0]?.count || 0),
    imageSearches: Number(imageSearches[0]?.count || 0),
    textSearches: Number(textSearches[0]?.count || 0),
    avgImageDuration: Number(avgImageDuration[0]?.avg || 0),
    avgTextDuration: Number(avgTextDuration[0]?.avg || 0),
    successfulSearches: Number(successfulSearches[0]?.count || 0),
  };
}

export async function createPlaceholderCard(snkrdunkId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if card already exists
  const existing = await db
    .select()
    .from(cards)
    .where(eq(cards.cardId, `snkrdunk-${snkrdunkId}`))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create placeholder card
  const result = await db.insert(cards).values({
    cardId: `snkrdunk-${snkrdunkId}`,
    name: `SNKRDUNK Card ${snkrdunkId}`,
    nameJa: `待更新`,
    description: "Placeholder - will be updated from SNKRDUNK",
  });

  // Get the newly created card
  const newCard = await db
    .select()
    .from(cards)
    .where(eq(cards.cardId, `snkrdunk-${snkrdunkId}`))
    .limit(1);

  return newCard[0].id;
}




/**
 * Record Firecrawl API usage
 */
export async function recordFirecrawlUsage(data: {
  operation: string;
  url?: string;
  status: "success" | "failed" | "quota_exceeded";
  errorMessage?: string;
  creditsUsed?: number;
}) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(firecrawlUsage).values({
    operation: data.operation,
    url: data.url,
    status: data.status,
    errorMessage: data.errorMessage,
    creditsUsed: data.creditsUsed || 1,
  });

  return result;
}

/**
 * Get Firecrawl usage statistics for a time period
 */
export async function getFirecrawlUsageStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;

  let query = db.select().from(firecrawlUsage);

  if (startDate && endDate) {
    query = query.where(
      and(
        gte(firecrawlUsage.createdAt, startDate),
        lte(firecrawlUsage.createdAt, endDate)
      )
    ) as any;
  } else if (startDate) {
    query = query.where(gte(firecrawlUsage.createdAt, startDate)) as any;
  }

  const records = await query;

  // Calculate statistics
  const totalCalls = records.length;
  const successCalls = records.filter(r => r.status === "success").length;
  const failedCalls = records.filter(r => r.status === "failed").length;
  const quotaExceededCalls = records.filter(r => r.status === "quota_exceeded").length;
  const totalCreditsUsed = records.reduce((sum, r) => sum + (r.creditsUsed || 0), 0);

  return {
    totalCalls,
    successCalls,
    failedCalls,
    quotaExceededCalls,
    totalCreditsUsed,
    records,
  };
}

/**
 * Get system setting by key
 */
export async function getSystemSetting(key: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Set system setting
 */
export async function setSystemSetting(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) return null;

  // Check if setting exists
  const existing = await getSystemSetting(key);

  if (existing) {
    // Update existing setting
    await db
      .update(systemSettings)
      .set({ settingValue: value, description: description || existing.description })
      .where(eq(systemSettings.settingKey, key));
  } else {
    // Insert new setting
    await db.insert(systemSettings).values({
      settingKey: key,
      settingValue: value,
      description,
    });
  }

  return await getSystemSetting(key);
}

/**
 * Delete failed data sources in batch
 */
export async function deleteFailedDataSources() {
  const db = await getDb();
  if (!db) return { success: false, deletedCount: 0 };

  try {
    // Get count of failed data sources
    const failedSources = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.lastFetchStatus, "failed"));

    const deletedCount = failedSources.length;

    // Delete failed data sources
    await db
      .delete(dataSources)
      .where(eq(dataSources.lastFetchStatus, "failed"));

    return { success: true, deletedCount };
  } catch (error) {
    console.error("[Database] Failed to delete failed data sources:", error);
    return { success: false, deletedCount: 0, error };
  }
}

// Favorites and user management removed








/**
 * Get schedule config by schedule type
 */
export async function getScheduleConfig(scheduleType: string) {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db
    .select()
    .from(scheduleConfig)
    .where(eq(scheduleConfig.scheduleType, scheduleType))
    .limit(1);

  return result[0];
}

/**
 * Update schedule config enabled status
 */
export async function updateScheduleEnabled(scheduleType: string, enabled: boolean) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(scheduleConfig)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(scheduleConfig.scheduleType, scheduleType));
}

/**
 * Update schedule config execution times
 */
export async function updateScheduleExecutionTimes(
  scheduleType: string,
  lastExecutedAt: Date,
  nextExecutionAt: Date
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(scheduleConfig)
    .set({ lastExecutedAt, nextExecutionAt, updatedAt: new Date() })
    .where(eq(scheduleConfig.scheduleType, scheduleType));
}

/**
 * Schedule Execution History Functions
 */
export async function addScheduleExecutionHistory(history: any): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(scheduleExecutionHistory).values(history);
  return Number(result[0].insertId);
}

export async function updateScheduleExecutionHistory(id: number, updates: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(scheduleExecutionHistory).set(updates).where(eq(scheduleExecutionHistory.id, id));
}

export async function getScheduleExecutionHistory(scheduleType: string, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(scheduleExecutionHistory)
    .where(eq(scheduleExecutionHistory.scheduleType, scheduleType))
    .orderBy(desc(scheduleExecutionHistory.startedAt))
    .limit(limit);
}

/**
 * Top Price Gainers
 */
export async function getTopPriceGainers(days: number = 7, limit: number = 5) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Get cards with price history in the past N days (SNKRDUNK only)
  const result = await db
    .select({
      cardId: priceHistory.cardId,
      cardName: cards.name,
      cardImage: cards.imageUrl,
      oldestPrice: sql<number>`MIN(${priceHistory.price})`,
      latestPrice: sql<number>`MAX(${priceHistory.price})`,
      priceChange: sql<number>`((MAX(${priceHistory.price}) - MIN(${priceHistory.price})) / MIN(${priceHistory.price}) * 100)`,
      currency: priceHistory.currency,
    })
    .from(priceHistory)
    .innerJoin(cards, eq(priceHistory.cardId, cards.id))
    .where(
      and(
        gte(priceHistory.createdAt, cutoffDate),
        eq(priceHistory.source, 'snkrdunk') // Only use SNKRDUNK actual transaction data
      )
    )
    .groupBy(priceHistory.cardId, cards.name, cards.imageUrl, priceHistory.currency)
    .having(sql`COUNT(*) >= 2`) // At least 2 price records to calculate change
    .orderBy(desc(sql`((MAX(${priceHistory.price}) - MIN(${priceHistory.price})) / MIN(${priceHistory.price}) * 100)`))
    .limit(limit);

  // Ensure numeric fields are properly converted
  return result.map(row => ({
    ...row,
    oldestPrice: Number(row.oldestPrice),
    latestPrice: Number(row.latestPrice),
    priceChange: Number(row.priceChange),
  }));
}

/**
 * Get top searched cards in the past N days
 */

/**
 * Get top volatile cards (highest price volatility) in the past N days
 */
export async function getTopVolatileCards(days: number = 7, limit: number = 5) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await db
    .select({
      cardId: priceHistory.cardId,
      cardName: cards.name,
      cardImage: cards.imageUrl,
      minPrice: sql<number>`MIN(${priceHistory.price})`,
      maxPrice: sql<number>`MAX(${priceHistory.price})`,
      avgPrice: sql<number>`AVG(${priceHistory.price})`,
      volatility: sql<number>`((MAX(${priceHistory.price}) - MIN(${priceHistory.price})) / AVG(${priceHistory.price}) * 100)`,
      currency: priceHistory.currency,
    })
    .from(priceHistory)
    .innerJoin(cards, eq(priceHistory.cardId, cards.id))
    .where(
      and(
        gte(priceHistory.createdAt, cutoffDate),
        eq(priceHistory.source, 'snkrdunk') // Only use SNKRDUNK actual transaction data
      )
    )
    .groupBy(priceHistory.cardId, cards.name, cards.imageUrl, priceHistory.currency)
    .having(sql`COUNT(*) >= 3`) // At least 3 price records to calculate volatility
    .orderBy(desc(sql`((MAX(${priceHistory.price}) - MIN(${priceHistory.price})) / AVG(${priceHistory.price}) * 100)`))
    .limit(limit);

  // Ensure numeric fields are properly converted
  return result.map(row => ({
    ...row,
    minPrice: Number(row.minPrice),
    maxPrice: Number(row.maxPrice),
    avgPrice: Number(row.avgPrice),
    volatility: Number(row.volatility),
  }));
}

/**
 * Get market overview statistics
 */
export async function getMarketOverview() {
  const db = await getDb();
  if (!db) {
    return {
      totalCards: 0,
      totalPriceRecords: 0,
      totalSearches: 0,
      avgPriceChange7d: 0,
    };
  }

  // userSearchLogs already imported at top

  const [cardCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(cards);
  const [priceCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(priceHistory);
  // const [searchCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(userSearchLogs);
  const searchCount = { count: 0 }; // Placeholder since userSearchLogs table is removed

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  // Calculate average price change using a subquery
  const priceChanges = await db
    .select({
      priceChange: sql<number>`((MAX(${priceHistory.price}) - MIN(${priceHistory.price})) / MIN(${priceHistory.price}) * 100)`,
    })
    .from(priceHistory)
    .where(gte(priceHistory.createdAt, cutoffDate))
    .groupBy(priceHistory.cardId)
    .having(sql`COUNT(*) >= 2`);

  const avgChange = priceChanges.length > 0
    ? priceChanges.reduce((sum, item) => sum + (item.priceChange || 0), 0) / priceChanges.length
    : 0;

  return {
    totalCards: cardCount?.count || 0,
    totalPriceRecords: priceCount?.count || 0,
    totalSearches: searchCount?.count || 0,
    avgPriceChange7d: avgChange,
  };
}

/**
 * Log user search query
 */

/**
 * Blog Articles Functions
 */

/**
 * Create a new blog article
 */

/**
 * Get price update schedule configuration
 */
export async function getPriceUpdateSchedule() {
  const db = await getDb();
  if (!db) {
    return undefined;
  }

  const result = await db.select().from(priceUpdateSchedule).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update price update schedule configuration
 */
export async function updatePriceUpdateSchedule(data: {
  snkrdunkEnabled?: boolean;
  snkrdunkUpdateTime?: string;
  ebayEnabled?: boolean;
  ebayUpdateTime?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get the first record (we only have one schedule config)
  const existing = await getPriceUpdateSchedule();
  if (!existing) {
    throw new Error("Price update schedule not found");
  }

  await db.update(priceUpdateSchedule)
    .set(data)
    .where(eq(priceUpdateSchedule.id, existing.id));
}

/**
 * Update last execution time for SNKRDUNK
 */
export async function updateSnkrdunkLastExecutedAt() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await getPriceUpdateSchedule();
  if (!existing) {
    throw new Error("Price update schedule not found");
  }

  await db.update(priceUpdateSchedule)
    .set({ snkrdunkLastExecutedAt: new Date() })
    .where(eq(priceUpdateSchedule.id, existing.id));
}

/**
 * Update last execution time for eBay
 */
export async function updateEbayLastExecutedAt() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await getPriceUpdateSchedule();
  if (!existing) {
    throw new Error("Price update schedule not found");
  }

  await db.update(priceUpdateSchedule)
    .set({ ebayLastExecutedAt: new Date() })
    .where(eq(priceUpdateSchedule.id, existing.id));
}


// DEPRECATED: Functions using deleted table 'dataSourceHealth'
export async function getDataSourceHealth() {
  return [];
}

export async function updateDataSourceHealth(
  source: "snkrdunk" | "ebay",
  data: {
    success: boolean;
    responseTime?: number;
    errorMessage?: string;
  }
) {
  console.warn("[updateDataSourceHealth] Function disabled - table removed");
  return;
}

/**
 * Calculate and cache trending cards (TOP 5 with highest price increase based on last 1 month PSA 10 transactions)
 * This function should be called daily at 06:00 HKT
 */
export async function calculateAndCacheTrendingCards(): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  console.log("[calculateAndCacheTrendingCards] Starting calculation (based on last 1 month)...");

  // Calculate cutoff date (1 month ago = 30 days)
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  console.log(`[calculateAndCacheTrendingCards] Cutoff date: ${cutoffDate.toISOString()}`);

  // Get SNKRDUNK PSA 10 price history from last 1 month for cards that exist in cards table
  // Use INNER JOIN to ensure we only calculate for valid cards
  // IMPORTANT: Filter by soldAt (actual transaction date), not createdAt (data insertion date)
  const cardsWithPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      soldAt: priceHistory.soldAt,
      createdAt: priceHistory.createdAt,
      grade: priceHistory.grade,
    })
    .from(priceHistory)
    .innerJoin(cards, eq(priceHistory.cardId, cards.id))
    .where(
      and(
        eq(priceHistory.source, "snkrdunk"),
        eq(priceHistory.grade, "PSA10"),
        gte(priceHistory.soldAt, cutoffDate),
        sql`${priceHistory.soldAt} IS NOT NULL`
      )
    )
    .orderBy(priceHistory.cardId, priceHistory.soldAt);

  console.log(`[calculateAndCacheTrendingCards] Found ${cardsWithPrices.length} SNKRDUNK PSA 10 price records in last 1 month`);

  // Group by cardId
  const cardPriceMap = new Map<number, { price: number; date: Date }[]>();
  
  for (const record of cardsWithPrices) {
    const cardId = record.cardId;
    const price = parseFloat(record.price as any);
    // Use soldAt as the transaction date (already filtered for NOT NULL)
    const date = record.soldAt!;

    if (!cardPriceMap.has(cardId)) {
      cardPriceMap.set(cardId, []);
    }

    cardPriceMap.get(cardId)!.push({ price, date });
  }

  // Calculate price change for each card (requires at least 2 transactions in 1 month)
  const trendingCards: Array<{
    cardId: number;
    priceChange: number;
    oldPrice: number;
    currentPrice: number;
  }> = [];

  for (const [cardId, allPrices] of Array.from(cardPriceMap.entries())) {
    // Sort by date (oldest first)
    const prices = allPrices.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Skip cards with less than 2 transactions in 1 month
    if (prices.length < 2) {
      console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: Only ${prices.length} transaction(s) in 1 month, skipping`);
      continue;
    }
    
    // Current price = latest transaction
    const currentPrice = prices[prices.length - 1].price;
    
    // Old price = earliest transaction (1 month ago)
    const oldPrice = prices[0].price;
    
    // Calculate percentage change
    const priceChange = ((currentPrice - oldPrice) / oldPrice) * 100;
    
    console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: ${prices.length} transactions in 1 month, change=${priceChange.toFixed(2)}%`);

    // Only include cards with positive price change
    if (priceChange > 0) {
      trendingCards.push({
        cardId,
        priceChange,
        oldPrice,
        currentPrice,
      });
    }
  }

  // Sort by price change (highest first) and take top 5
  trendingCards.sort((a, b) => b.priceChange - a.priceChange);
  const top5 = trendingCards.slice(0, 5);

  console.log(`[calculateAndCacheTrendingCards] Found ${top5.length} trending cards`);
  if (top5.length > 0) {
    console.log(`[calculateAndCacheTrendingCards] Top card: cardId=${top5[0].cardId}, change=${top5[0].priceChange.toFixed(2)}%`);
  }

  // Clear existing cache
  await db.delete(trendingCardsCache);

  // Insert new cache
  const calculatedAt = new Date();
  for (let i = 0; i < top5.length; i++) {
    const card = top5[i];
    await db.insert(trendingCardsCache).values({
      cardId: card.cardId,
      rank: i + 1,
      priceChange7d: card.priceChange.toFixed(2),
      oldPrice: card.oldPrice.toFixed(2),
      currentPrice: card.currentPrice.toFixed(2),
      calculatedAt,
    });
  }

  console.log("[calculateAndCacheTrendingCards] Cache updated successfully");
}

/**
 * Get cached trending cards (TOP 5)
 */
export async function getCachedTrendingCards() {
  const db = await getDb();
  if (!db) {
    console.log('[getCachedTrendingCards] DB connection failed');
    return [];
  }

  console.log('[getCachedTrendingCards] Querying trendingCardsCache...');
  
  const cached = await db
    .select({
      cardId: trendingCardsCache.cardId,
      rank: trendingCardsCache.rank,
      priceChange7d: trendingCardsCache.priceChange7d,
      oldPrice: trendingCardsCache.oldPrice,
      currentPrice: trendingCardsCache.currentPrice,
      calculatedAt: trendingCardsCache.calculatedAt,
      // Join with cards table to get card details
      name: cards.name,
      nameJa: cards.nameJa,
      imageUrl: cards.imageUrl,
      cardNumber: cards.cardNumber,
      series: cards.series,
    })
    .from(trendingCardsCache)
    .leftJoin(cards, eq(trendingCardsCache.cardId, cards.id))
    .orderBy(trendingCardsCache.rank);

  console.log('[getCachedTrendingCards] Query result count:', cached.length);
  console.log('[getCachedTrendingCards] Raw cached data:', JSON.stringify(cached, null, 2));

  const result = cached.map(item => ({
    id: item.cardId,
    name: item.name,
    nameJa: item.nameJa,
    imageUrl: item.imageUrl,
    cardNumber: item.cardNumber,
    series: item.series,
    rank: item.rank,
    priceChange7d: parseFloat(item.priceChange7d as any),
    oldPrice: parseFloat(item.oldPrice as any),
    currentPrice: parseFloat(item.currentPrice as any),
    calculatedAt: item.calculatedAt,
    // Format for display
    priceChange: parseFloat(item.priceChange7d as any),
    priceChangeFormatted: `+${parseFloat(item.priceChange7d as any).toFixed(1)}%`,
  }));

  console.log('[getCachedTrendingCards] Mapped result count:', result.length);
  console.log('[getCachedTrendingCards] Final result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Get health metrics for data sources (SNKRDUNK and eBay)
 */
export async function getDataSourceHealthMetrics() {
  const db = await getDb();
  if (!db) {
    console.log('[getDataSourceHealthMetrics] DB connection failed');
    return [];
  }

  console.log('[getDataSourceHealthMetrics] Calculating health metrics...');

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  // Get SNKRDUNK metrics
  const snkrdunkSources = await db
    .select()
    .from(dataSources)
    .where(and(
      eq(dataSources.source, 'snkrdunk'),
      eq(dataSources.isActive, 1)
    ));

  const snkrdunkRecentPrices = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(and(
      eq(priceHistory.source, 'snkrdunk'),
      gte(priceHistory.createdAt, oneDayAgo)
    ));

  const snkrdunkTotalPrices = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(eq(priceHistory.source, 'snkrdunk'));

  // Get eBay metrics
  const ebaySources = await db
    .select()
    .from(dataSources)
    .where(and(
      eq(dataSources.source, 'ebay'),
      eq(dataSources.isActive, 1)
    ));

  const ebayRecentPrices = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(and(
      eq(priceHistory.source, 'ebay'),
      gte(priceHistory.createdAt, oneDayAgo)
    ));

  const ebayTotalPrices = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(eq(priceHistory.source, 'ebay'));

  // Calculate SNKRDUNK health status
  const snkrdunkLastUpdate = snkrdunkSources.reduce((latest, source) => {
    if (!source.lastUpdatedAt) return latest;
    if (!latest) return source.lastUpdatedAt;
    return source.lastUpdatedAt > latest ? source.lastUpdatedAt : latest;
  }, null as Date | null);

  let snkrdunkStatus: 'healthy' | 'degraded' | 'down' = 'down';
  if (snkrdunkLastUpdate) {
    if (snkrdunkLastUpdate >= oneDayAgo) {
      snkrdunkStatus = 'healthy';
    } else if (snkrdunkLastUpdate >= threeDaysAgo) {
      snkrdunkStatus = 'degraded';
    }
  }

  // Calculate eBay health status
  const ebayLastUpdate = ebaySources.reduce((latest, source) => {
    if (!source.lastUpdatedAt) return latest;
    if (!latest) return source.lastUpdatedAt;
    return source.lastUpdatedAt > latest ? source.lastUpdatedAt : latest;
  }, null as Date | null);

  let ebayStatus: 'healthy' | 'degraded' | 'down' = 'down';
  if (ebayLastUpdate) {
    if (ebayLastUpdate >= oneDayAgo) {
      ebayStatus = 'healthy';
    } else if (ebayLastUpdate >= threeDaysAgo) {
      ebayStatus = 'degraded';
    }
  }

  const metrics = [
    {
      source: 'snkrdunk',
      status: snkrdunkStatus,
      lastUpdatedAt: snkrdunkLastUpdate,
      activeSourcesCount: snkrdunkSources.length,
      recentRecordsCount: Number(snkrdunkRecentPrices[0]?.count || 0),
      totalRecordsCount: Number(snkrdunkTotalPrices[0]?.count || 0),
    },
    {
      source: 'ebay',
      status: ebayStatus,
      lastUpdatedAt: ebayLastUpdate,
      activeSourcesCount: ebaySources.length,
      recentRecordsCount: Number(ebayRecentPrices[0]?.count || 0),
      totalRecordsCount: Number(ebayTotalPrices[0]?.count || 0),
    },
  ];

  console.log('[getDataSourceHealthMetrics] Metrics:', JSON.stringify(metrics, null, 2));
  return metrics;
}

/**
 * Get trending cards by search popularity
 * Returns cards with the most searches in the specified time range
 */
export async function getTrendingBySearches(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { limit = 10, days = 60 } = options; // Default to 60 days (2 months)
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { userSearchLogs } = await import("../drizzle/schema_new");
  
  const results = await db
    .select({
      cardId: userSearchLogs.cardId,
      searchCount: sql<number>`COUNT(*)`.as('searchCount'),
    })
    .from(userSearchLogs)
    .where(
      gte(userSearchLogs.createdAt, cutoffDate)
    )
    .groupBy(userSearchLogs.cardId)
    .having(sql`COUNT(*) >= 3`) // Minimum 3 searches to qualify (lowered from 10)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  // Fetch card details for each trending card
  const cardIds = results.map(r => r.cardId);
  if (cardIds.length === 0) return [];

  const cardDetails = await db
    .select()
    .from(cards)
    .where(inArray(cards.id, cardIds));

  // Get latest SNKRDUNK PSA 10 price for each card
  const latestPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      currency: priceHistory.currency,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(desc(priceHistory.createdAt));

  // Group prices by cardId and get the latest one
  const priceMap = new Map<number, typeof latestPrices[0]>();
  for (const price of latestPrices) {
    if (!priceMap.has(price.cardId)) {
      priceMap.set(price.cardId, price);
    }
  }

  // Combine all data
  return results.map(result => {
    const card = cardDetails.find(c => c.id === result.cardId);
    const price = priceMap.get(result.cardId);
    return {
      ...card,
      searchCount: result.searchCount,
      currentPrice: price?.price ? Number(price.price) : null,
      currency: price?.currency || 'HKD',
      priceUpdatedAt: price?.createdAt || null,
    };
  });
}

/**
 * Get trending cards by price increase
 * Returns cards with the largest price increases in the specified time range
 */
export async function getTrendingByPriceIncrease(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { limit = 10, days = 60 } = options; // Default to 60 days (2 months)
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all SNKRDUNK PSA 10 price records within the time range
  // IMPORTANT: Filter by soldAt (actual transaction date), not createdAt (data insertion date)
  const recentPrices = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        gte(priceHistory.soldAt, cutoffDate),
        sql`${priceHistory.soldAt} IS NOT NULL`,
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(asc(priceHistory.soldAt));

  // Group by cardId to count transactions per card
  const transactionCounts = new Map<number, number>();
  for (const price of recentPrices) {
    transactionCounts.set(price.cardId, (transactionCounts.get(price.cardId) || 0) + 1);
  }

  // Group by cardId and calculate price change
  const priceChangeMap = new Map<number, {
    cardId: number;
    oldPrice: number;
    newPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }>();

  for (const price of recentPrices) {
    const existing = priceChangeMap.get(price.cardId);
    const currentPrice = Number(price.price);

    if (!existing) {
      priceChangeMap.set(price.cardId, {
        cardId: price.cardId,
        oldPrice: currentPrice,
        newPrice: currentPrice,
        priceChange: 0,
        priceChangePercent: 0,
      });
    } else {
      const change = currentPrice - existing.oldPrice;
      const changePercent = (change / existing.oldPrice) * 100;
      
      // Filter out abnormal price changes (> 500%)
      if (changePercent <= 500) {
        priceChangeMap.set(price.cardId, {
          ...existing,
          newPrice: currentPrice,
          priceChange: change,
          priceChangePercent: changePercent,
        });
      }
    }
  }

  // Sort by price change percentage and get top cards
  // Only include cards with at least 2 transactions in the time range
  const sortedChanges = Array.from(priceChangeMap.values())
    .filter(item => {
      const txCount = transactionCounts.get(item.cardId) || 0;
      return item.priceChangePercent > 0 && txCount >= 2;
    })
    .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    .slice(0, limit);

  if (sortedChanges.length === 0) return [];

  // Fetch card details
  const cardIds = sortedChanges.map(c => c.cardId);
  const cardDetails = await db
    .select()
    .from(cards)
    .where(inArray(cards.id, cardIds));

  // Combine all data
  return sortedChanges
    .map(change => {
      const card = cardDetails.find(c => c.id === change.cardId);
      if (!card) return null; // Skip if card details not found
      return {
        ...card,
        oldPrice: change.oldPrice,
        currentPrice: change.newPrice,
        priceChange: change.priceChange,
        priceChangePercent: change.priceChangePercent,
        currency: 'HKD',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Get trending cards by price decrease
 * Returns cards with the largest price decreases in the specified time range
 */
export async function getTrendingByPriceDecrease(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { limit = 10, days = 60 } = options; // Default to 60 days (2 months)
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Similar logic to price increase, but filter for negative changes
  // IMPORTANT: Filter by soldAt (actual transaction date), not createdAt (data insertion date)
  const recentPrices = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        gte(priceHistory.soldAt, cutoffDate),
        sql`${priceHistory.soldAt} IS NOT NULL`,
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(asc(priceHistory.soldAt));

  // Group by cardId to count transactions per card
  const transactionCounts = new Map<number, number>();
  for (const price of recentPrices) {
    transactionCounts.set(price.cardId, (transactionCounts.get(price.cardId) || 0) + 1);
  }

  const priceChangeMap = new Map<number, {
    cardId: number;
    oldPrice: number;
    newPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }>();

  for (const price of recentPrices) {
    const existing = priceChangeMap.get(price.cardId);
    const currentPrice = Number(price.price);

    if (!existing) {
      priceChangeMap.set(price.cardId, {
        cardId: price.cardId,
        oldPrice: currentPrice,
        newPrice: currentPrice,
        priceChange: 0,
        priceChangePercent: 0,
      });
    } else {
      const change = currentPrice - existing.oldPrice;
      const changePercent = (change / existing.oldPrice) * 100;
      
      // Filter out abnormal price changes (< -90%)
      if (changePercent >= -90) {
        priceChangeMap.set(price.cardId, {
          ...existing,
          newPrice: currentPrice,
          priceChange: change,
          priceChangePercent: changePercent,
        });
      }
    }
  }

  // Only include cards with at least 2 transactions in the time range
  const sortedChanges = Array.from(priceChangeMap.values())
    .filter(item => {
      const txCount = transactionCounts.get(item.cardId) || 0;
      return item.priceChangePercent < 0 && txCount >= 2;
    })
    .sort((a, b) => a.priceChangePercent - b.priceChangePercent) // Most negative first
    .slice(0, limit);

  if (sortedChanges.length === 0) return [];

  const cardIds = sortedChanges.map(c => c.cardId);
  const cardDetails = await db
    .select()
    .from(cards)
    .where(inArray(cards.id, cardIds));

  return sortedChanges
    .map(change => {
      const card = cardDetails.find(c => c.id === change.cardId);
      if (!card) return null; // Skip if card details not found
      return {
        ...card,
        oldPrice: change.oldPrice,
        currentPrice: change.newPrice,
        priceChange: change.priceChange,
        priceChangePercent: change.priceChangePercent,
        currency: 'HKD',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Get newly added cards
 * Returns cards that were recently added to the database
 */
export async function getNewlyAddedCards(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { limit = 10, days = 60 } = options; // Default to 60 days (2 months)
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const newCards = await db
    .select()
    .from(cards)
    .where(gte(cards.createdAt, cutoffDate))
    .orderBy(desc(cards.createdAt))
    .limit(limit);

  if (newCards.length === 0) return [];

  // Get latest SNKRDUNK PSA 10 price for each card
  const cardIds = newCards.map(c => c.id);
  const latestPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      currency: priceHistory.currency,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(desc(priceHistory.createdAt));

  const priceMap = new Map<number, typeof latestPrices[0]>();
  for (const price of latestPrices) {
    if (!priceMap.has(price.cardId)) {
      priceMap.set(price.cardId, price);
    }
  }

  return newCards.map(card => {
    const price = priceMap.get(card.id);
    return {
      ...card,
      currentPrice: price?.price ? Number(price.price) : null,
      currency: price?.currency || 'HKD',
      priceUpdatedAt: price?.createdAt || null,
    };
  });
}

/**
 * Get price history for a specific card (for trend charts)
 */
export async function getCardPriceHistory(cardId: number, days: number = 7) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const history = await db
    .select({
      price: priceHistory.price,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, 'snkrdunk'),
        gte(priceHistory.createdAt, cutoffDate)
      )
    )
    .orderBy(asc(priceHistory.createdAt));

  return history.map(h => ({
    price: Number(h.price),
    date: h.createdAt,
  }));
}

/**
 * Get all card IDs for sitemap generation
 */
export async function getAllCardIds() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      id: cards.id,
    })
    .from(cards)
    .orderBy(asc(cards.id));

  return result;
}

/**
 * Get data source by card ID and source type
 */
export async function getDataSourceByCardIdAndSource(cardId: number, source: 'snkrdunk' | 'ebay' | 'tcgplayer' | 'other') {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.cardId, cardId), eq(dataSources.source, source)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}


/**
 * Get SNKRDUNK listings cache by cardId
 */
export async function getSnkrdunkListingsCache(cardId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  const result = await db
    .select()
    .from(snkrdunkListingsCache)
    .where(eq(snkrdunkListingsCache.cardId, cardId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Save SNKRDUNK listings cache
 */
export async function saveSnkrdunkListingsCache(data: {
  cardId: number;
  snkrdunkId: string;
  listings: string;
  hotExpiresAt: Date;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  // Delete existing cache for this card
  await db
    .delete(snkrdunkListingsCache)
    .where(eq(snkrdunkListingsCache.cardId, data.cardId));
  
  // Insert new cache
  await db.insert(snkrdunkListingsCache).values({
    cardId: data.cardId,
    snkrdunkId: data.snkrdunkId,
    listings: data.listings,
    hotExpiresAt: data.hotExpiresAt,
    expiresAt: data.expiresAt,
  });
}

/**
 * Get SNKRDUNK cache statistics
 */
export async function getSnkrdunkCacheStats() {
  const db = await getDb();
  if (!db) return { totalCount: 0, oldestCache: null, newestCache: null };
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  const caches = await db.select().from(snkrdunkListingsCache);
  
  if (caches.length === 0) {
    return { totalCount: 0, oldestCache: null, newestCache: null };
  }
  
  const timestamps = caches.map(c => new Date(c.createdAt).getTime());
  const oldestCache = new Date(Math.min(...timestamps));
  const newestCache = new Date(Math.max(...timestamps));
  
  return {
    totalCount: caches.length,
    oldestCache,
    newestCache,
  };
}

/**
 * Clear SNKRDUNK cache by cardId
 */
export async function clearSnkrdunkCacheByCardId(cardId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  const result = await db
    .delete(snkrdunkListingsCache)
    .where(eq(snkrdunkListingsCache.cardId, cardId));
  
  return result[0].affectedRows || 0;
}

/**
 * Clear all SNKRDUNK cache
 */
export async function clearAllSnkrdunkCache(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  const result = await db.delete(snkrdunkListingsCache);
  
  return result[0].affectedRows || 0;
}

/**
 * Get all SNKRDUNK cache list with card information
 */
export async function getAllSnkrdunkCacheList(page: number = 1, pageSize: number = 20) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, page, pageSize };
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  // Get total count
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(snkrdunkListingsCache);
  const total = countResult[0]?.count || 0;
  
  // Get paginated data with card information
  const offset = (page - 1) * pageSize;
  const caches = await db
    .select({
      id: snkrdunkListingsCache.id,
      cardId: snkrdunkListingsCache.cardId,
      snkrdunkId: snkrdunkListingsCache.snkrdunkId,
      listings: snkrdunkListingsCache.listings,
      hotExpiresAt: snkrdunkListingsCache.hotExpiresAt,
      expiresAt: snkrdunkListingsCache.expiresAt,
      createdAt: snkrdunkListingsCache.createdAt,
      cardName: cards.name,
      cardNumber: cards.cardNumber,
      cardImageUrl: cards.imageUrl,
    })
    .from(snkrdunkListingsCache)
    .leftJoin(cards, eq(snkrdunkListingsCache.cardId, cards.id))
    .orderBy(desc(snkrdunkListingsCache.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  // Parse listings to count items
  const dataWithItemCount = caches.map(cache => {
    let itemCount = 0;
    try {
      const parsedListings = JSON.parse(cache.listings);
      itemCount = Array.isArray(parsedListings) ? parsedListings.length : 0;
    } catch (e) {
      itemCount = 0;
    }
    
    return {
      ...cache,
      itemCount,
    };
  });
  
  return {
    data: dataWithItemCount,
    total,
    page,
    pageSize,
  };
}


/**
 * Get SNKRDUNK caches that are expiring soon
 */
export async function getExpiringSnkrdunkCaches(thresholdTime: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  return await db
    .select()
    .from(snkrdunkListingsCache)
    .where(
      and(
        lte(snkrdunkListingsCache.expiresAt, thresholdTime),
        gte(snkrdunkListingsCache.expiresAt, new Date())
      )
    )
    .execute();
}

/**
 * Get eBay listings cache by cardId and searchQuery
 */
export async function getEbayListingsCache(cardId: number, searchQuery: string) {
  const db = await getDb();
  if (!db) return null;
  
  const { ebayListingsCache } = await import("../drizzle/schema_new");
  
  const result = await db
    .select()
    .from(ebayListingsCache)
    .where(
      and(
        eq(ebayListingsCache.cardId, cardId),
        eq(ebayListingsCache.searchQuery, searchQuery)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Save eBay listings cache
 */
export async function saveEbayListingsCache(data: {
  cardId: number;
  searchQuery: string;
  listings: string;
  hotExpiresAt: Date;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  
  const { ebayListingsCache } = await import("../drizzle/schema_new");
  
  // Delete existing cache for this card and query
  await db
    .delete(ebayListingsCache)
    .where(
      and(
        eq(ebayListingsCache.cardId, data.cardId),
        eq(ebayListingsCache.searchQuery, data.searchQuery)
      )
    );
  
  // Insert new cache
  await db.insert(ebayListingsCache).values({
    cardId: data.cardId,
    searchQuery: data.searchQuery,
    listings: data.listings,
    hotExpiresAt: data.hotExpiresAt,
    expiresAt: data.expiresAt,
  });
}

/**
 * Get random cards for placeholder rotation
 */
export async function getRandomCards(count: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Use SQL random function to get random cards
    const result = await db
      .select({
        id: cards.id,
        name: cards.name,
        nameJa: cards.nameJa,
        cardNumber: cards.cardNumber,
        rarity: cards.rarity,
        series: cards.series,
      })
      .from(cards)
      .orderBy(sql`RAND()`)
      .limit(count);
    
    return result;
  } catch (error) {
    console.error("[Database] Failed to get random cards:", error);
    return [];
  }
}

/**
 * Get data source statistics (count by status)
 */
export async function getDataSourceStats() {
  const db = await getDb();
  if (!db) return { total: 0, success: 0, pending: 0, failed: 0 };

  try {
    const result = await db
      .select({
        status: dataSources.lastFetchStatus,
        count: sql<number>`count(*)`,
      })
      .from(dataSources)
      .groupBy(dataSources.lastFetchStatus);

    const stats = {
      total: 0,
      success: 0,
      pending: 0,
      failed: 0,
    };

    for (const row of result) {
      const count = Number(row.count);
      stats.total += count;
      
      if (row.status === "success") {
        stats.success = count;
      } else if (row.status === "pending") {
        stats.pending = count;
      } else if (row.status === "failed") {
        stats.failed = count;
      }
    }

    return stats;
  } catch (error) {
    console.error("[Database] Failed to get data source stats:", error);
    return { total: 0, success: 0, pending: 0, failed: 0 };
  }
}

/**
 * Get all data source IDs that match the filter criteria
 */
export async function getAllFilteredDataSourceIds(options?: { search?: string; status?: "all" | "success" | "pending" | "failed" }) {
  const db = await getDb();
  if (!db) return [];

  const searchQuery = options?.search?.toLowerCase();
  const statusFilter = options?.status ?? "all";

  // Build WHERE conditions for search and status
  const conditions = [];
  if (searchQuery) {
    conditions.push(
      or(
        like(cards.name, `%${searchQuery}%`),
        like(dataSources.sourceUrl, `%${searchQuery}%`)
      )
    );
  }
  if (statusFilter !== "all") {
    conditions.push(eq(dataSources.lastFetchStatus, statusFilter));
  }
  const whereConditions = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const result = await db
      .select({
        id: dataSources.id,
      })
      .from(dataSources)
      .leftJoin(cards, eq(dataSources.cardId, cards.id))
      .where(whereConditions);

    return result.map(row => row.id);
  } catch (error) {
    console.error("[Database] Failed to get filtered data source IDs:", error);
    return [];
  }
}

/**
 * Get total data source count
 */
export async function getTotalDataSourceCount() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(dataSources);
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Failed to get total data source count:", error);
    return 0;
  }
}

/**
 * Get active data source count (success status)
 */
export async function getActiveDataSourceCount() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(dataSources)
      .where(eq(dataSources.lastFetchStatus, "success"));
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Failed to get active data source count:", error);
    return 0;
  }
}

/**
 * Get total price record count
 */
export async function getTotalPriceRecordCount() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(priceHistory);
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Failed to get total price record count:", error);
    return 0;
  }
}
