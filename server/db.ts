import { eq, desc, asc, and, gte, lte, or, like, sql, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { generateCardNumberPatterns, isCardNumberQuery, normalizeCardQuery, isPureSeriesCodeQuery, tokenizeSearchQuery, buildTokenPatterns, buildSeriesPrefixPatterns } from './utils/cardNumberNormalize';
import { drizzle } from "drizzle-orm/mysql2";
import { users, cards, sealedProducts, priceHistory, watchlist, marketTrends, dataSources, InsertDataSource, firecrawlUsage, systemSettings, InsertSystemSetting, searchStats, InsertSearchStat, scheduleConfig, InsertScheduleConfig, priceUpdateSchedule, trendingCardsCache, InsertTrendingCardsCache, scheduleExecutionHistory, scheduledTasks } from "../drizzle/schema_new";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Hong Kong timezone offset for MySQL session.
 * Forces all TIMESTAMP/DATETIME operations to use UTC+8.
 */
const HK_TIMEZONE = '+08:00';

// Lazily create the drizzle instance so local tooling can run without a DB.
// Appends timezone parameter to DATABASE_URL to force Hong Kong timezone.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Append timezone parameter to the connection URL
      const dbUrl = process.env.DATABASE_URL;
      const separator = dbUrl.includes('?') ? '&' : '?';
      const dbUrlWithTz = `${dbUrl}${separator}timezone=${encodeURIComponent(HK_TIMEZONE)}`;
      
      _db = drizzle(dbUrlWithTz);
      console.log(`[Database] Connected with timezone: ${HK_TIMEZONE} (Hong Kong)`);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Card queries
export async function searchCards(query: string, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return { cards: [], total: 0 };

  const trimmedQuery = query.trim();

  // ── Pure series code query (e.g. "SV10", "SM-P", "ST01", "SM", "ST") ───────
  // When the user types only a set code or partial prefix, do a prefix match
  // on cardNumber using format-aware patterns.
  if (isPureSeriesCodeQuery(trimmedQuery)) {
    const patterns = buildSeriesPrefixPatterns(trimmedQuery);
    if (patterns.length === 0) return { cards: [], total: 0 };

    const matchingCards = await db
      .select()
      .from(cards)
      .where(or(...patterns.map(p => like(cards.cardNumber, p))));

    if (matchingCards.length === 0) return { cards: [], total: 0 };

    const cardIds = matchingCards.map(c => c.id);
    const latestPrices = await db
      .select({ cardId: priceHistory.cardId, price: priceHistory.price, soldAt: priceHistory.soldAt })
      .from(priceHistory)
      .where(and(inArray(priceHistory.cardId, cardIds), eq(priceHistory.source, 'snkrdunk'), eq(priceHistory.grade, 'PSA10')))
      .orderBy(desc(priceHistory.soldAt));

    const priceMap = new Map<number, number>();
    for (const price of latestPrices) {
      if (!priceMap.has(price.cardId)) priceMap.set(price.cardId, Number(price.price));
    }
    const sortedCards = matchingCards.sort((a, b) => (priceMap.get(b.id) || 0) - (priceMap.get(a.id) || 0));
    const cardsWithPrice = sortedCards.map(card => ({ ...card, latestPrice: priceMap.get(card.id) || null }));
    return { cards: cardsWithPrice.slice(offset, offset + limit), total: cardsWithPrice.length };
  }

  // ── Multi-token fuzzy search ───────────────────────────────────────────────
  // Tokenize the query: "pikachu sm-p" → ["pikachu", "sm-p"]
  // Each token must match at least one of: name, nameJa, cardNumber
  // All tokens must match (AND logic across tokens, OR logic within each token)
  const tokens = tokenizeSearchQuery(trimmedQuery);
  if (tokens.length === 0) return { cards: [], total: 0 };

  // Build per-token conditions
  const tokenConditions = tokens.map(token => {
    const { namePatterns, cardNumberPatterns: cnPatterns } = buildTokenPatterns(token);
    const conditions = [
      ...namePatterns.map(p => like(cards.name, p)),
      ...namePatterns.map(p => like(cards.nameJa, p)),
      ...cnPatterns.map(p => like(cards.cardNumber, p)),
    ];
    // Each token: card must match at least one field
    return or(...conditions)!;
  });

  // All tokens must match
  const whereCondition = tokenConditions.length === 1
    ? tokenConditions[0]
    : and(...tokenConditions);

  const matchingCards = await db
    .select()
    .from(cards)
    .where(whereCondition);

  if (matchingCards.length === 0) return { cards: [], total: 0 };

  // Get latest SNKRDUNK PSA 10 price for each card (by soldAt, not createdAt)
  const cardIds = matchingCards.map(c => c.id);
  const latestPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      soldAt: priceHistory.soldAt,
    })
    .from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, cardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Create price map (cardId -> latest price)
  const priceMap = new Map<number, number>();
  for (const price of latestPrices) {
    if (!priceMap.has(price.cardId)) {
      priceMap.set(price.cardId, Number(price.price));
    }
  }

  // Sort cards by price (highest first), cards without price go to the end
  const sortedCards = matchingCards.sort((a, b) => {
    const priceA = priceMap.get(a.id) || 0;
    const priceB = priceMap.get(b.id) || 0;
    return priceB - priceA;
  });

  // Add latestPrice to each card
  const cardsWithPrice = sortedCards.map(card => ({
    ...card,
    latestPrice: priceMap.get(card.id) || null,
  }));

  return {
    cards: cardsWithPrice.slice(offset, offset + limit),
    total: cardsWithPrice.length,
  };
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



/**
 * Get average price for a card by grade/condition
 * Returns average of latest 10 records within 6 months for the specified grade
 */
export async function getCardPriceByGrade(cardId: number, grade: string): Promise<{ avgPrice: number | null; recordCount: number; grade: string }> {
  const db = await getDb();
  if (!db) return { avgPrice: null, recordCount: 0, grade };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Get latest 10 records for this grade within 6 months
  const records = await db
    .select({ price: priceHistory.price, soldAt: priceHistory.soldAt })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, grade),
        gte(priceHistory.soldAt, sixMonthsAgo)
      )
    )
    .orderBy(desc(priceHistory.soldAt))
    .limit(10);

  if (records.length === 0) {
    // Try without time limit if no recent records
    const allRecords = await db
      .select({ price: priceHistory.price })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.cardId, cardId),
          eq(priceHistory.source, 'snkrdunk'),
          eq(priceHistory.grade, grade)
        )
      )
      .orderBy(desc(priceHistory.soldAt))
      .limit(10);

    if (allRecords.length === 0) return { avgPrice: null, recordCount: 0, grade };
    const sum = allRecords.reduce((acc, r) => acc + Number(r.price), 0);
    return { avgPrice: Math.round(sum / allRecords.length), recordCount: allRecords.length, grade };
  }

  const sum = records.reduce((acc, r) => acc + Number(r.price), 0);
  return { avgPrice: Math.round(sum / records.length), recordCount: records.length, grade };
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

export async function getDataSources(options?: { page?: number; pageSize?: number; search?: string; status?: "all" | "success" | "pending" | "failed"; gameId?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0, totalPages: 0 };

  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const rawSearch = options?.search?.trim() ?? "";
  const searchQuery = rawSearch.toLowerCase();
  const statusFilter = options?.status ?? "all";

  // ── Base conditions (status + gameId) ─────────────────────────────────
  const conditions: ReturnType<typeof eq>[] = [];
  if (statusFilter !== "all") {
    conditions.push(eq(dataSources.lastFetchStatus, statusFilter));
  }
  if (options?.gameId) {
    conditions.push(eq(dataSources.gameId, options.gameId));
  }

   // ── Smart search: multi-token fuzzy matching ───────────────────────────
  let searchCondition: ReturnType<typeof and> | ReturnType<typeof or> | undefined;
  if (rawSearch) {
    if (isPureSeriesCodeQuery(rawSearch)) {
      const patterns = buildSeriesPrefixPatterns(rawSearch);
      if (patterns.length > 0) {
        searchCondition = or(...patterns.map(p => like(cards.cardNumber, p)));
      }
    } else {
      // Multi-token: each token must match at least one of name/nameJa/cardNumber/sourceUrl
      const tokens = tokenizeSearchQuery(rawSearch);
      if (tokens.length > 0) {
        const tokenConditions = tokens.map(token => {
          const { namePatterns, cardNumberPatterns: cnPatterns } = buildTokenPatterns(token);
          const conds = [
            ...namePatterns.map(p => like(cards.name, p)),
            ...namePatterns.map(p => like(cards.nameJa, p)),
            ...cnPatterns.map(p => like(cards.cardNumber, p)),
            like(dataSources.sourceUrl, `%${token}%`),
          ];
          return or(...conds)!;
        });
        searchCondition = tokenConditions.length === 1
          ? tokenConditions[0]
          : and(...tokenConditions);
      }
    }
  }

  const allConditions = [
    ...conditions,
    ...(searchCondition ? [searchCondition] : []),
  ];
  const whereConditions = allConditions.length > 0 ? and(...allConditions) : undefined;

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
      productType: dataSources.productType,
      isActive: dataSources.isActive,
      lastFetchedAt: dataSources.lastFetchedAt,
      lastFetchStatus: dataSources.lastFetchStatus,
      fetchErrorMessage: dataSources.fetchErrorMessage,
      createdAt: dataSources.createdAt,
      gameId: dataSources.gameId,
      card: {
        id: cards.id,
        name: cards.name,
        nameJa: cards.nameJa,
        cardNumber: cards.cardNumber,
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
  
  // Check if URL already exists using indexed query (avoid full table scan)
  // First try by sourceIdentifier (most efficient), then by normalized URL
  let isDuplicate = false;
  if (data.sourceIdentifier) {
    const existing = await db
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(eq(dataSources.sourceIdentifier, data.sourceIdentifier))
      .limit(1);
    isDuplicate = existing.length > 0;
  }
  if (!isDuplicate) {
    const existing = await db
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(eq(dataSources.sourceUrl, normalizedUrl))
      .limit(1);
    isDuplicate = existing.length > 0;
  }

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

  // First get the data source to know the cardId and productType
  const dataSource = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, dataSourceId))
    .limit(1);

  if (dataSource.length === 0) return null;

  const ds = dataSource[0];

  // Delete the data source
  const result = await db
    .delete(dataSources)
    .where(eq(dataSources.id, dataSourceId));

  // Check if there are other data sources pointing to the same product
  const otherSources = await db
    .select()
    .from(dataSources)
    .where(and(
      eq(dataSources.cardId, ds.cardId),
      eq(dataSources.productType, ds.productType)
    ))
    .limit(1);

  // If no other data sources reference this product, clean up related data
  if (otherSources.length === 0) {
    // Delete price history for this product
    await db
      .delete(priceHistory)
      .where(and(
        eq(priceHistory.cardId, ds.cardId),
        eq(priceHistory.productType, ds.productType)
      ));

    // If it's a sealed product, delete from sealedProducts table
    if (ds.productType === 'sealed_product') {
      await db
        .delete(sealedProducts)
        .where(eq(sealedProducts.id, ds.cardId));
    }
    // If it's a single card, delete from cards table
    else if (ds.productType === 'single_card') {
      await db
        .delete(cards)
        .where(eq(cards.id, ds.cardId));
    }
  }

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

export async function createSealedProduct(data: Omit<typeof sealedProducts.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(sealedProducts).values(data);

  // Return the auto-incremented ID
  return Number(result[0].insertId);
}

export async function getSealedProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(sealedProducts).where(eq(sealedProducts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Unified product query - searches both cards and sealedProducts tables
 * First checks dataSources to determine productType, then queries the correct table
 * If no dataSource found, falls back to cards table first, then sealedProducts
 */
export async function getProductById(productId: number, productType?: 'single_card' | 'sealed_product') {
  // If productType is known, query directly
  if (productType === 'sealed_product') {
    const product = await getSealedProductById(productId);
    if (product) {
      return {
        ...product,
        productType: 'sealed_product' as const,
        // Normalize fields for unified display
        cardNumber: null,
        rarity: null,
        language: null,
        artist: null,
        description: null,
        types: null,
        hp: null,
        cardId: null,
        snkrdunkId: null,
      };
    }
    return undefined;
  }

  if (productType === 'single_card') {
    const card = await getCardById(productId);
    if (card) {
      return {
        ...card,
        productType: 'single_card' as const,
        boxType: null,
        itemCount: null,
      };
    }
    return undefined;
  }

  // productType unknown - try cards first, then sealedProducts
  const card = await getCardById(productId);
  if (card) {
    return {
      ...card,
      productType: 'single_card' as const,
      boxType: null,
      itemCount: null,
    };
  }

  const product = await getSealedProductById(productId);
  if (product) {
    return {
      ...product,
      productType: 'sealed_product' as const,
      cardNumber: null,
      rarity: null,
      language: null,
      artist: null,
      description: null,
      types: null,
      hp: null,
      cardId: null,
      snkrdunkId: null,
    };
  }

  return undefined;
}

/**
 * Get all sealed products
 */
export async function getAllSealedProducts() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(sealedProducts);
  return result;
}

/**
 * Search sealed products by name
 */
export async function searchSealedProducts(query: string, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return { products: [], total: 0 };

  const matchingProducts = await db
    .select()
    .from(sealedProducts)
    .where(
      or(
        like(sealedProducts.name, `%${query}%`),
        like(sealedProducts.nameJa, `%${query}%`),
        like(sealedProducts.styleCode, `%${query}%`)
      )
    );

  if (matchingProducts.length === 0) return { products: [], total: 0 };

  // Get latest price for each sealed product
  const productIds = matchingProducts.map(p => p.id);
  const latestPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      soldAt: priceHistory.soldAt,
    })
    .from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, productIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.productType, 'sealed_product')
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Create price map (productId -> latest price)
  const priceMap = new Map<number, number>();
  for (const price of latestPrices) {
    if (!priceMap.has(price.cardId)) {
      priceMap.set(price.cardId, Number(price.price));
    }
  }

  // Sort products by price (highest first)
  const sortedProducts = matchingProducts.sort((a, b) => {
    const priceA = priceMap.get(a.id) || 0;
    const priceB = priceMap.get(b.id) || 0;
    return priceB - priceA;
  });

  const productsWithPrice = sortedProducts.map(product => ({
    ...product,
    latestPrice: priceMap.get(product.id) || null,
    productType: 'sealed_product' as const,
  }));

  return {
    products: productsWithPrice.slice(offset, offset + limit),
    total: matchingProducts.length,
  };
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

export async function updateSealedProduct(
  productId: number,
  data: Partial<Omit<typeof sealedProducts.$inferInsert, "id" | "createdAt">>
) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .update(sealedProducts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(sealedProducts.id, productId));

  return result;
}

export async function addPriceHistory(data: {
  cardId: number;
  source: "snkrdunk" | "ebay" | "tcgplayer" | "other";
  price: string;
  currency: string;
  jpyPrice?: number; // Original JPY price (for SNKRDUNK) - used for stable deduplication
  grade?: string;
  quantity?: string; // For sealed products (e.g., "10盒", "1盒")
  productType?: "single_card" | "sealed_product"; // Product type
  soldAt?: Date;
  listingUrl?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  // Deduplication: rely entirely on the database UNIQUE INDEX (cardId, source, grade, soldAt, jpyPrice)
  // jpyPrice (original JPY) is used instead of HKD price to avoid false duplicates from exchange rate fluctuations
  // onDuplicateKeyUpdate is a no-op that silently ignores constraint violations
  // This is the most reliable approach as it avoids race conditions and timezone issues
  const result = await db.insert(priceHistory).values({
    cardId: data.cardId,
    source: data.source,
    price: data.price,
    currency: data.currency,
    jpyPrice: data.jpyPrice ?? null,
    grade: data.grade,
    quantity: data.quantity,
    productType: data.productType || "single_card", // Default to single_card
    soldAt: data.soldAt,
    listingUrl: data.listingUrl,
  }).onDuplicateKeyUpdate({
    set: { id: sql`id` }, // No-op: keep existing record unchanged
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
  snkrdunkUpdateTime2?: string | null;
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
 * Update last catch-up execution time for SNKRDUNK (used for cooldown — one catch-up per HKT day)
 */
export async function updateSnkrdunkLastCatchupAt() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const existing = await getPriceUpdateSchedule();
  if (!existing) {
    throw new Error("Price update schedule not found");
  }
  await db.update(priceUpdateSchedule)
    .set({ snkrdunkLastCatchupAt: new Date() } as any)
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
 * Helper: IQR 2.5× outlier filter for a list of prices.
 * Returns the filtered list, or the original if fewer than 4 records or filter
 * would remove more than half the data.
 */
function filterOutliersTrending(prices: number[]): number[] {
  if (prices.length < 4) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - 2.5 * iqr;
  const upper = q3 + 2.5 * iqr;
  const candidate = prices.filter(p => p >= lower && p <= upper);
  return candidate.length >= Math.ceil(prices.length * 0.5) ? candidate : prices;
}

/**
 * Helper: Time-decay weighted average with a given half-life (in days).
 * weight(record) = 2^(-daysAgo / halfLifeDays)
 * Returns null if the list is empty.
 *
 * NOTE: IQR filtering intentionally removed (v3).
 * The 7-day time window itself acts as the filter.
 * IQR was causing new market highs to be incorrectly removed as outliers
 * during rapid price surges, producing artificially low weighted averages.
 */
function weightedAvgTrending(
  records: { price: number; date: Date }[],
  now: Date,
  halfLifeDays: number
): number | null {
  if (records.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of records) {
    const daysAgo = (now.getTime() - r.date.getTime()) / (1000 * 60 * 60 * 24);
    const w = Math.pow(2, -daysAgo / halfLifeDays);
    weightedSum += r.price * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Calculate and cache trending cards (TOP 5 with highest price increase).
 *
 * NEW LOGIC (replaces 7-day min/max approach):
 *   thisWeekAvg  = time-decay weighted avg of PSA10 transactions in last 0-7 days  (half-life 7d)
 *   lastWeekAvg  = time-decay weighted avg of PSA10 transactions in last 7-14 days (half-life 7d)
 *   priceChange  = (thisWeekAvg - lastWeekAvg) / lastWeekAvg × 100%
 *
 * Requirements:
 *   - Both windows must have ≥ 3 transactions after IQR filtering
 *   - Only cards with positive price change are ranked
 *
 * This eliminates false +1000% spikes caused by a single low-price outlier in
 * the old min/max approach.
 *
 * This function should be called daily at 06:00 HKT.
 */
export async function calculateAndCacheTrendingCards(): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  console.log("[calculateAndCacheTrendingCards] Starting calculation (this-week vs last-week weighted avg)...");

  const now = new Date();
  const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  console.log(`[calculateAndCacheTrendingCards] This week: ${sevenDaysAgo.toISOString()} → ${now.toISOString()}`);
  console.log(`[calculateAndCacheTrendingCards] Last week: ${fourteenDaysAgo.toISOString()} → ${sevenDaysAgo.toISOString()}`);

  // Fetch PSA10 SNKRDUNK records for the last 14 days in one query
  const cardsWithPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      soldAt: priceHistory.soldAt,
    })
    .from(priceHistory)
    .innerJoin(cards, eq(priceHistory.cardId, cards.id))
    .where(
      and(
        eq(priceHistory.source, "snkrdunk"),
        eq(priceHistory.grade, "PSA10"),
        gte(priceHistory.soldAt, fourteenDaysAgo),
        sql`${priceHistory.soldAt} IS NOT NULL`
      )
    )
    .orderBy(priceHistory.cardId, priceHistory.soldAt);

  console.log(`[calculateAndCacheTrendingCards] Found ${cardsWithPrices.length} PSA10 records in last 14 days`);

  // Group by cardId, split into this-week and last-week buckets
  const thisWeekMap  = new Map<number, { price: number; date: Date }[]>();
  const lastWeekMap  = new Map<number, { price: number; date: Date }[]>();

  for (const record of cardsWithPrices) {
    const cardId = record.cardId;
    const price  = parseFloat(record.price as any);
    const date   = record.soldAt!;

    if (date >= sevenDaysAgo) {
      if (!thisWeekMap.has(cardId)) thisWeekMap.set(cardId, []);
      thisWeekMap.get(cardId)!.push({ price, date });
    } else {
      if (!lastWeekMap.has(cardId)) lastWeekMap.set(cardId, []);
      lastWeekMap.get(cardId)!.push({ price, date });
    }
  }

  const HALF_LIFE_DAYS = 7; // Shorter half-life for weekly comparison
  const MIN_RECORDS    = 3; // Minimum records per window to avoid noise

  const trendingCards: Array<{
    cardId: number;
    priceChange: number;
    oldPrice: number;     // last-week weighted avg
    currentPrice: number; // this-week weighted avg
  }> = [];

  for (const [cardId, thisWeekRecords] of Array.from(thisWeekMap.entries())) {
    const lastWeekRecords = lastWeekMap.get(cardId) ?? [];

    // Both windows must have enough records
    if (thisWeekRecords.length < MIN_RECORDS) {
      console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: Only ${thisWeekRecords.length} this-week record(s), skipping`);
      continue;
    }
    if (lastWeekRecords.length < MIN_RECORDS) {
      console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: Only ${lastWeekRecords.length} last-week record(s), skipping`);
      continue;
    }

    const thisWeekAvg = weightedAvgTrending(thisWeekRecords, now, HALF_LIFE_DAYS);
    const lastWeekAvg = weightedAvgTrending(lastWeekRecords, now, HALF_LIFE_DAYS);

    if (thisWeekAvg === null || lastWeekAvg === null || lastWeekAvg === 0) continue;

    const priceChange = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;

    console.log(
      `[calculateAndCacheTrendingCards] Card ${cardId}: ` +
      `lastWeek=${lastWeekAvg.toFixed(2)}, thisWeek=${thisWeekAvg.toFixed(2)}, ` +
      `change=${priceChange.toFixed(2)}% ` +
      `(${lastWeekRecords.length} last-week / ${thisWeekRecords.length} this-week records)`
    );

    if (priceChange > 0) {
      trendingCards.push({
        cardId,
        priceChange,
        oldPrice: lastWeekAvg,
        currentPrice: thisWeekAvg,
      });
    }
  }

  // Sort by price change (highest first) and take top 5
  trendingCards.sort((a, b) => b.priceChange - a.priceChange);
  const top5 = trendingCards.slice(0, 5);

  console.log(`[calculateAndCacheTrendingCards] Found ${trendingCards.length} eligible cards, storing top ${top5.length}`);
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
 * Get recently viewed/searched card IDs for priority batch update ordering.
 * Returns a Set of cardIds that were searched/viewed in the past N days,
 * ordered by recency (most recent first).
 */
export async function getRecentlyViewedCardIds(days: number = 7): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { userSearchLogs } = await import('../drizzle/schema_new');
  try {
    const results = await db
      .select({ cardId: userSearchLogs.cardId })
      .from(userSearchLogs)
      .where(gte(userSearchLogs.createdAt, cutoffDate))
      .groupBy(userSearchLogs.cardId)
      .orderBy(desc(sql`MAX(${userSearchLogs.createdAt})`));
    return new Set(results.map(r => r.cardId));
  } catch {
    return new Set();
  }
}

/**
 * Get top viewed/searched card IDs for hot card polling.
 * Returns an ordered array of cardIds (most viewed first) in the past N days.
 * Used by the hot card polling scheduler to update the most popular cards first.
 */
export async function getTopViewedCardIds(limit: number = 100, days: number = 7): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { userSearchLogs } = await import('../drizzle/schema_new');
  try {
    const results = await db
      .select({
        cardId: userSearchLogs.cardId,
        viewCount: sql<number>`COUNT(*)`.as('viewCount'),
      })
      .from(userSearchLogs)
      .where(gte(userSearchLogs.createdAt, cutoffDate))
      .groupBy(userSearchLogs.cardId)
      .orderBy(desc(sql`COUNT(*)`), desc(sql`MAX(${userSearchLogs.createdAt})`))
      .limit(limit);
    return results.map(r => r.cardId);
  } catch {
    return [];
  }
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
 * Uses average of latest 10 transactions for current price and average of earliest 10 for old price
 */
export async function getTrendingByPriceIncrease(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { limit = 10, days = 30 } = options; // Default to 30 days
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Get all SNKRDUNK PSA 10 price records within the time range
  const allPrices = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        gte(priceHistory.soldAt, cutoffDate),
        lte(priceHistory.soldAt, now),
        sql`${priceHistory.soldAt} IS NOT NULL`,
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(asc(priceHistory.soldAt));

  // Group prices by cardId
  const pricesByCard = new Map<number, Array<{ price: number; soldAt: Date }>>();
  for (const price of allPrices) {
    if (!pricesByCard.has(price.cardId)) {
      pricesByCard.set(price.cardId, []);
    }
    pricesByCard.get(price.cardId)!.push({
      price: Number(price.price),
      soldAt: new Date(price.soldAt!),
    });
  }

  // Calculate price changes for each card
  const priceChanges: Array<{
    cardId: number;
    oldPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }> = [];

  for (const [cardId, prices] of Array.from(pricesByCard.entries())) {
    // Need at least 5 transactions to calculate meaningful trend
    if (prices.length < 5) continue;

    // Sort by date (oldest first)
    prices.sort((a: { soldAt: Date }, b: { soldAt: Date }) => a.soldAt.getTime() - b.soldAt.getTime());

    // Calculate old price: average of earliest 10 transactions (or all if less than 10)
    const oldPriceCount = Math.min(10, Math.floor(prices.length / 2));
    const oldPrices = prices.slice(0, oldPriceCount);
    const oldPrice = oldPrices.reduce((sum: number, p: { price: number }) => sum + p.price, 0) / oldPrices.length;

    // Calculate current price: average of latest 10 transactions (or all remaining)
    const currentPriceCount = Math.min(10, Math.floor(prices.length / 2));
    const currentPrices = prices.slice(-currentPriceCount);
    const currentPrice = currentPrices.reduce((sum: number, p: { price: number }) => sum + p.price, 0) / currentPrices.length;

    // Calculate price change
    const priceChange = currentPrice - oldPrice;
    const priceChangePercent = (priceChange / oldPrice) * 100;

    // Filter out abnormal changes (> 500% or < -90%)
    if (priceChangePercent > 500 || priceChangePercent < -90) continue;

    // Only include cards with positive price change
    if (priceChangePercent > 0) {
      priceChanges.push({
        cardId,
        oldPrice,
        currentPrice,
        priceChange,
        priceChangePercent,
      });
    }
  }

  // Sort by price change percentage (highest first) and limit
  const sortedChanges = priceChanges
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
      if (!card) return null;
      return {
        ...card,
        oldPrice: change.oldPrice,
        currentPrice: change.currentPrice,
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
 * Uses average of latest 10 transactions for current price and average of earliest 10 for old price
 */
export async function getTrendingByPriceDecrease(options: {
  limit?: number;
  days?: number;
} = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { limit = 10, days = 30 } = options; // Default to 30 days
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Get all SNKRDUNK PSA 10 price records within the time range
  const allPrices = await db
    .select()
    .from(priceHistory)
    .where(
      and(
        gte(priceHistory.soldAt, cutoffDate),
        lte(priceHistory.soldAt, now),
        sql`${priceHistory.soldAt} IS NOT NULL`,
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA10')
      )
    )
    .orderBy(asc(priceHistory.soldAt));

  // Group prices by cardId
  const pricesByCard = new Map<number, Array<{ price: number; soldAt: Date }>>();
  for (const price of allPrices) {
    if (!pricesByCard.has(price.cardId)) {
      pricesByCard.set(price.cardId, []);
    }
    pricesByCard.get(price.cardId)!.push({
      price: Number(price.price),
      soldAt: new Date(price.soldAt!),
    });
  }

  // Calculate price changes for each card
  const priceChanges: Array<{
    cardId: number;
    oldPrice: number;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }> = [];

  for (const [cardId, prices] of Array.from(pricesByCard.entries())) {
    // Need at least 5 transactions to calculate meaningful trend
    if (prices.length < 5) continue;

    // Sort by date (oldest first)
    prices.sort((a: { soldAt: Date }, b: { soldAt: Date }) => a.soldAt.getTime() - b.soldAt.getTime());

    // Calculate old price: average of earliest 10 transactions (or all if less than 10)
    const oldPriceCount = Math.min(10, Math.floor(prices.length / 2));
    const oldPrices = prices.slice(0, oldPriceCount);
    const oldPrice = oldPrices.reduce((sum: number, p: { price: number }) => sum + p.price, 0) / oldPrices.length;

    // Calculate current price: average of latest 10 transactions (or all remaining)
    const currentPriceCount = Math.min(10, Math.floor(prices.length / 2));
    const currentPrices = prices.slice(-currentPriceCount);
    const currentPrice = currentPrices.reduce((sum: number, p: { price: number }) => sum + p.price, 0) / currentPrices.length;

    // Calculate price change
    const priceChange = currentPrice - oldPrice;
    const priceChangePercent = (priceChange / oldPrice) * 100;

    // Filter out abnormal changes (> 500% or < -90%)
    if (priceChangePercent > 500 || priceChangePercent < -90) continue;

    // Only include cards with negative price change
    if (priceChangePercent < 0) {
      priceChanges.push({
        cardId,
        oldPrice,
        currentPrice,
        priceChange,
        priceChangePercent,
      });
    }
  }

  // Sort by price change percentage (most negative first) and limit
  const sortedChanges = priceChanges
    .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
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
      if (!card) return null;
      return {
        ...card,
        oldPrice: change.oldPrice,
        currentPrice: change.currentPrice,
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
 * Get cards with SNKRDUNK ID (for batch processing)
 */
export async function getCardsWithSnkrdunkId(options: { limit: number; offset: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select()
    .from(cards)
    .where(isNotNull(cards.snkrdunkId))
    .limit(options.limit)
    .offset(options.offset);
  
  return results;
}

/**
 * Get detailed SNKRDUNK cache statistics with breakdown by cache status
 */
export async function getDetailedSnkrdunkCacheStats() {
  const db = await getDb();
  if (!db) return {
    total: 0,
    hotCache: 0,
    coldCache: 0,
    expiredCache: 0,
    noCache: 0,
    needUpdate: 0,
    estimatedTimeMinutes: 0
  };
  
  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  
  // Get total cards with SNKRDUNK ID
  const totalCards = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(cards)
    .where(isNotNull(cards.snkrdunkId));
  
  const total = Number(totalCards[0]?.count || 0);
  
  // Get all caches
  const allCaches = await db.select().from(snkrdunkListingsCache);
  
  const now = Date.now();
  const HOT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  const COLD_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
  
  let hotCache = 0;
  let coldCache = 0;
  let expiredCache = 0;
  
  for (const cache of allCaches) {
    const cacheAge = now - new Date(cache.createdAt).getTime();
    
    if (cacheAge < HOT_CACHE_DURATION) {
      hotCache++;
    } else if (cacheAge < COLD_CACHE_DURATION) {
      coldCache++;
    } else {
      expiredCache++;
    }
  }
  
  const noCache = total - allCaches.length;
  const needUpdate = expiredCache + noCache;
  
  // Estimate time: 50 cards per batch, 6 minutes per batch
  const estimatedTimeMinutes = Math.ceil(needUpdate / 50 * 6);
  
  return {
    total,
    hotCache,
    coldCache,
    expiredCache,
    noCache,
    needUpdate,
    estimatedTimeMinutes
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
export async function getAllFilteredDataSourceIds(options?: { search?: string; status?: "all" | "success" | "pending" | "failed"; gameId?: number }) {
  const db = await getDb();
  if (!db) return [];

  const rawSearch = options?.search?.trim() ?? "";
  const searchQuery = rawSearch.toLowerCase();
  const statusFilter = options?.status ?? "all";

  // ── Base conditions (status + gameId) ─────────────────────────────────
  const conditions: ReturnType<typeof eq>[] = [];
  if (statusFilter !== "all") {
    conditions.push(eq(dataSources.lastFetchStatus, statusFilter));
  }
  if (options?.gameId) {
    conditions.push(eq(dataSources.gameId, options.gameId));
  }

   // ── Smart search: multi-token fuzzy matching ───────────────────────────
  let searchCondition: ReturnType<typeof and> | ReturnType<typeof or> | undefined;
  if (rawSearch) {
    if (isPureSeriesCodeQuery(rawSearch)) {
      const patterns = buildSeriesPrefixPatterns(rawSearch);
      if (patterns.length > 0) {
        searchCondition = or(...patterns.map(p => like(cards.cardNumber, p)));
      }
    } else {
      const tokens = tokenizeSearchQuery(rawSearch);
      if (tokens.length > 0) {
        const tokenConditions = tokens.map(token => {
          const { namePatterns, cardNumberPatterns: cnPatterns } = buildTokenPatterns(token);
          const conds = [
            ...namePatterns.map(p => like(cards.name, p)),
            ...namePatterns.map(p => like(cards.nameJa, p)),
            ...cnPatterns.map(p => like(cards.cardNumber, p)),
            like(dataSources.sourceUrl, `%${token}%`),
          ];
          return or(...conds)!;
        });
        searchCondition = tokenConditions.length === 1
          ? tokenConditions[0]
          : and(...tokenConditions);
      }
    }
  }

  const allConditions = [
    ...conditions,
    ...(searchCondition ? [searchCondition] : []),
  ];
  const whereConditions = allConditions.length > 0 ? and(...allConditions) : undefined;

  try {
    const result = await db
      .select({ id: dataSources.id })
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

/**
 * ===========================
 * Scheduled Tasks Functions
 * ===========================
 */

/**
 * Create a new scheduled task
 */
export async function createScheduledTask(task: {
  taskType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  targetId?: number;
  totalItems?: number;
  processedItems?: number;
  successCount?: number;
  failureCount?: number;
  progress?: number;
  metadata?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    const result = await db.insert(scheduledTasks).values({
      taskType: task.taskType,
      status: task.status,
      targetId: task.targetId || null,
      totalItems: task.totalItems || null,
      processedItems: task.processedItems || 0,
      successCount: task.successCount || 0,
      failureCount: task.failureCount || 0,
      progress: task.progress || 0,
      metadata: task.metadata || null,
    });

    // MySQL returns insertId in result
    return (result as any).insertId || (result as any)[0]?.insertId || 0;
  } catch (error) {
    console.error("[Database] Failed to create scheduled task:", error);
    throw error;
  }
}

/**
 * Update a scheduled task
 */
export async function updateScheduledTask(
  taskId: number,
  updates: {
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
    processedItems?: number;
    successCount?: number;
    failureCount?: number;
    progress?: number;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    metadata?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db
      .update(scheduledTasks)
      .set(updates)
      .where(eq(scheduledTasks.id, taskId));
  } catch (error) {
    console.error("[Database] Failed to update scheduled task:", error);
    throw error;
  }
}

/**
 * Get a scheduled task by ID
 */
export async function getScheduledTask(taskId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, taskId))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get scheduled task:", error);
    return null;
  }
}

/**
 * Get the latest batch update task of a specific type
 */
export async function getLatestBatchUpdateTask(taskType: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(scheduledTasks)
      .where(eq(scheduledTasks.taskType, taskType))
      .orderBy(desc(scheduledTasks.createdAt))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get latest batch update task:", error);
    return null;
  }
}

/**
 * Get running batch update task of a specific type
 */
export async function getRunningBatchUpdateTask(taskType: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, taskType),
          or(
            eq(scheduledTasks.status, 'running'),
            eq(scheduledTasks.status, 'paused')
          )
        )
      )
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get running batch update task:", error);
    return null;
  }
}

// ============================================================
// MARKETPLACE DB HELPERS
// ============================================================
import {
  sellerProfiles, marketplaceListings, marketplaceOrders,
  marketplaceOrderItems, marketplacePayouts,
  marketplaceBanners, wishlists, marketplaceReviews, userShippingAddresses, offers, listingReports,
  InsertSellerProfile, InsertMarketplaceListing, InsertMarketplaceOrder,
  InsertMarketplaceOrderItem, InsertMarketplacePayout,
  InsertMarketplaceBanner, InsertWishlist, InsertMarketplaceReview,
  type InsertUserShippingAddress, type InsertOffer, type InsertListingReport
} from "../drizzle/schema_new";

// --- Seller Profiles ---
export async function getSellerProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}
export async function getSellerProfileById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createSellerProfile(data: InsertSellerProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(sellerProfiles).values(data);
  const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, data.userId)).limit(1);
  return rows[0];
}
export async function updateSellerProfile(id: number, data: Partial<InsertSellerProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sellerProfiles).set({ ...data, updatedAt: new Date() }).where(eq(sellerProfiles.id, id));
}
export async function getAllSellerProfiles(page = 1, pageSize = 20, search?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  // Join with users to get email and real name for search
  const usersAlias = alias(users, 'u');
  const baseQuery = db
    .select({
      id: sellerProfiles.id,
      userId: sellerProfiles.userId,
      displayName: sellerProfiles.displayName,
      bio: sellerProfiles.bio,
      avatarUrl: sellerProfiles.avatarUrl,
      stripeConnectId: sellerProfiles.stripeConnectId,
      stripeConnectStatus: sellerProfiles.stripeConnectStatus,
      stripeOnboardingUrl: sellerProfiles.stripeOnboardingUrl,
      totalSales: sellerProfiles.totalSales,
      avgRating: sellerProfiles.avgRating,
      ratingCount: sellerProfiles.ratingCount,
      isActive: sellerProfiles.isActive,
      rejectReason: sellerProfiles.rejectReason,
      createdAt: sellerProfiles.createdAt,
      updatedAt: sellerProfiles.updatedAt,
      // From users join
      email: usersAlias.email,
      realName: usersAlias.name,
    })
    .from(sellerProfiles)
    .leftJoin(usersAlias, eq(sellerProfiles.userId, usersAlias.id));
  
  const searchCondition = search
    ? sql`(${sellerProfiles.displayName} LIKE ${`%${search}%`} OR ${usersAlias.email} LIKE ${`%${search}%`} OR ${usersAlias.name} LIKE ${`%${search}%`})`
    : undefined;
  
  const rows = await baseQuery
    .where(searchCondition)
    .orderBy(desc(sellerProfiles.createdAt))
    .limit(pageSize)
    .offset(offset);
  
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(sellerProfiles)
    .leftJoin(usersAlias, eq(sellerProfiles.userId, usersAlias.id))
    .where(searchCondition);
  const countRows = await countQuery;
  return { sellers: rows, total: Number(countRows[0]?.count ?? 0) };
}

// --- Marketplace Listings ---
export async function getPublicListings(options: {
  page?: number; pageSize?: number; search?: string;
  condition?: string; conditions?: string[]; sellerType?: string; minPrice?: number; maxPrice?: number;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
  tcgSeries?: string;
  cardIds?: number[];
}) {
  const db = await getDb();
  const { page = 1, pageSize = 20, search, condition, conditions: conditionList, sellerType, minPrice, maxPrice, sortBy = 'newest', tcgSeries, cardIds } = options;
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  const conditions = [eq(marketplaceListings.status, 'active')];
  if (search) conditions.push(like(marketplaceListings.title, `%${search}%`));
  if (cardIds && cardIds.length > 0) conditions.push(inArray(marketplaceListings.cardId, cardIds));
  // Support multi-condition array (OR) or single condition
  if (conditionList && conditionList.length > 0) {
    conditions.push(inArray(marketplaceListings.condition, conditionList as any[]));
  } else if (condition) {
    conditions.push(eq(marketplaceListings.condition, condition as any));
  }
  if (sellerType) conditions.push(eq(marketplaceListings.sellerType, sellerType as any));
  if (tcgSeries) conditions.push(eq(marketplaceListings.tcgSeries, tcgSeries as any));
  if (minPrice != null) conditions.push(sql`${marketplaceListings.priceHkd} >= ${minPrice}`);
  if (maxPrice != null) conditions.push(sql`${marketplaceListings.priceHkd} <= ${maxPrice}`);
  const orderClause =
    sortBy === 'price_asc' ? asc(marketplaceListings.priceHkd) :
    sortBy === 'price_desc' ? desc(marketplaceListings.priceHkd) :
    desc(marketplaceListings.createdAt);
  const rows = await db.select({
    id: marketplaceListings.id,
    title: marketplaceListings.title,
    priceHkd: marketplaceListings.priceHkd,
    condition: marketplaceListings.condition,
    status: marketplaceListings.status,
    images: marketplaceListings.images,
    sellerType: marketplaceListings.sellerType,
    sellerId: marketplaceListings.sellerId,
    quantity: marketplaceListings.quantity,
    createdAt: marketplaceListings.createdAt,
    cardId: marketplaceListings.cardId,
    language: marketplaceListings.language,
    tcgSeries: marketplaceListings.tcgSeries,
    viewCount: marketplaceListings.viewCount,
    sellerDisplayName: sellerProfiles.displayName,
    sellerAvgRating: sellerProfiles.avgRating,
    sellerRatingCount: sellerProfiles.ratingCount,
  })
    .from(marketplaceListings)
    .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(and(...conditions));
  // Series counts (always based on active status only, no other filters)
  const seriesCountRows = await db.select({
    series: marketplaceListings.tcgSeries,
    count: sql<number>`count(*)`
  }).from(marketplaceListings)
    .where(eq(marketplaceListings.status, 'active'))
    .groupBy(marketplaceListings.tcgSeries);
  const seriesCounts: Record<string, number> = { all: 0 };
  for (const row of seriesCountRows) {
    const s = row.series ?? 'other';
    seriesCounts[s] = Number(row.count);
    seriesCounts.all = (seriesCounts.all ?? 0) + Number(row.count);
  }
  // Reshape to include sellerProfile sub-object
  const listings = rows.map(r => ({
    id: r.id,
    title: r.title,
    priceHkd: r.priceHkd,
    condition: r.condition,
    status: r.status,
    images: r.images,
    sellerType: r.sellerType,
    sellerId: r.sellerId,
    quantity: r.quantity,
    createdAt: r.createdAt,
    cardId: r.cardId,
    language: r.language,
    tcgSeries: r.tcgSeries,
    viewCount: r.viewCount,
    sellerProfile: r.sellerType === 'seller' ? {
      displayName: r.sellerDisplayName ?? '',
      avgRating: r.sellerAvgRating ?? '0',
      ratingCount: r.sellerRatingCount ?? 0,
    } : null,
  }));
  return { listings, total: Number(countRows[0]?.count ?? 0), seriesCounts };
}
export async function getListingById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createListing(data: InsertMarketplaceListing) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketplaceListings).values(data);
  const rows = await db.select().from(marketplaceListings)
    .where(and(eq(marketplaceListings.title, data.title), eq(marketplaceListings.sellerType, data.sellerType)))
    .orderBy(desc(marketplaceListings.createdAt)).limit(1);
  return rows[0];
}
export async function updateListing(id: number, data: Partial<InsertMarketplaceListing>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(marketplaceListings).set({ ...data, updatedAt: new Date() }).where(eq(marketplaceListings.id, id));
}

/**
 * Atomic stock reservation — prevents overselling via SQL-level WHERE guard.
 * Returns true if stock was successfully reserved, false if insufficient stock.
 * For quantity=1 listings, also marks status as 'sold'.
 */
export async function reserveListingStock(listingId: number, quantity: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Atomic UPDATE: only succeeds if listing is active AND has enough quantity
  const result = await db.execute(
    sql`UPDATE marketplaceListings
        SET quantity = quantity - ${quantity},
            remainingQuantity = remainingQuantity - ${quantity},
            status = CASE WHEN (quantity - ${quantity}) <= 0 THEN 'sold' ELSE status END,
            updatedAt = NOW()
        WHERE id = ${listingId}
          AND status = 'active'
          AND quantity >= ${quantity}`
  );
  // MySQL returns affectedRows; if 0, the WHERE guard failed (sold out or inactive)
  const affectedRows = (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0;
  return affectedRows > 0;
}

/**
 * Restore listing stock after order cancellation / payment timeout.
 * Re-activates the listing if it was marked as sold.
 */
export async function restoreListingStock(listingId: number, quantity: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(
    sql`UPDATE marketplaceListings
        SET quantity = quantity + ${quantity},
            remainingQuantity = remainingQuantity + ${quantity},
            status = 'active',
            updatedAt = NOW()
        WHERE id = ${listingId}`
  );
}

export async function getAdminListings(page = 1, pageSize = 20, status?: string, tcgSeries?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  const conditions: any[] = [];
  if (status) conditions.push(eq(marketplaceListings.status, status as any));
  if (tcgSeries) conditions.push(eq(marketplaceListings.tcgSeries, tcgSeries as any));
  const rows = await db.select().from(marketplaceListings)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(marketplaceListings.createdAt)).limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings)
    .where(conditions.length ? and(...conditions) : undefined);
  return { listings: rows, total: Number(countRows[0]?.count ?? 0) };
}
export async function getSellerListings(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(marketplaceListings)
    .where(eq(marketplaceListings.sellerId, sellerId))
    .orderBy(desc(marketplaceListings.createdAt));
}

// --- Marketplace Orders ---
export async function generateOrderNo(): Promise<string> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `BOXIUM-${date}-${rand}`;
}
export async function createMarketplaceOrder(data: InsertMarketplaceOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketplaceOrders).values(data);
  const rows = await db.select().from(marketplaceOrders).where(eq(marketplaceOrders.orderNo, data.orderNo)).limit(1);
  return rows[0];
}
export async function getMarketplaceOrderById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(marketplaceOrders).where(eq(marketplaceOrders.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function getMarketplaceOrderByNo(orderNo: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(marketplaceOrders).where(eq(marketplaceOrders.orderNo, orderNo)).limit(1);
  return rows[0] ?? null;
}
export async function updateMarketplaceOrder(id: number, data: Partial<InsertMarketplaceOrder>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(marketplaceOrders).set({ ...data, updatedAt: new Date() }).where(eq(marketplaceOrders.id, id));
}
export async function getBuyerOrders(buyerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    sellerType: marketplaceOrders.sellerType,
    listingId: marketplaceOrders.listingId,
    quantity: marketplaceOrders.quantity,
    unitPriceHkd: marketplaceOrders.unitPriceHkd,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    orderStatus: marketplaceOrders.orderStatus,
    shippingName: marketplaceOrders.shippingName,
    shippingPhone: marketplaceOrders.shippingPhone,
    shippingAddress: marketplaceOrders.shippingAddress,
    shippingMethod: marketplaceOrders.shippingMethod,
    trackingNumber: marketplaceOrders.trackingNumber,
    shippedAt: marketplaceOrders.shippedAt,
    autoCompleteAt: marketplaceOrders.autoCompleteAt,
    payoutStatus: marketplaceOrders.payoutStatus,
    stripePaymentIntentId: marketplaceOrders.stripePaymentIntentId,
    stripeTransferId: marketplaceOrders.stripeTransferId,
    disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
    disputeReason: marketplaceOrders.disputeReason,
    disputeEvidenceUrls: marketplaceOrders.disputeEvidenceUrls,
    disputeResolution: marketplaceOrders.disputeResolution,
    disputeResolvedAt: marketplaceOrders.disputeResolvedAt,
    buyerConfirmedAt: marketplaceOrders.buyerConfirmedAt,
    alipayProofImageUrl: marketplaceOrders.alipayProofImageUrl,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
    // Listing info for display
    listingTitle: marketplaceListings.title,
    listingImages: marketplaceListings.images,
    listingCondition: marketplaceListings.condition,
  })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(eq(marketplaceOrders.buyerId, buyerId))
    .orderBy(desc(marketplaceOrders.createdAt));
  return rows;
}
export async function getAdminOrders(page = 1, pageSize = 20, status?: string, sellerType?: string, dateFrom?: string, dateTo?: string, payoutFilter?: string, listingId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  // If no status filter, show all orders including pending_payment so admin can see all orders
  const conditions: any[] = status
    ? [eq(marketplaceOrders.orderStatus, status as any)]
    : [];
  // Optional sellerType filter
  if (sellerType) {
    conditions.push(eq(marketplaceOrders.sellerType, sellerType as any));
  }
  // Optional date range filter
  if (dateFrom) {
    conditions.push(sql`${marketplaceOrders.createdAt} >= ${new Date(dateFrom).getTime()}`);
  }
  if (dateTo) {
    // Add 1 day to include the full end date
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(sql`${marketplaceOrders.createdAt} < ${endDate.getTime()}`);
  }
  // Optional payout filter: 'pending_alipay' = alipay_hk orders with payoutStatus != 'paid'
  if (payoutFilter === 'pending_alipay') {
    conditions.push(eq(marketplaceOrders.paymentMethod, 'alipay_hk'));
    conditions.push(sql`${marketplaceOrders.payoutStatus} != 'paid'`);
  }
  // Optional listingId filter
  if (listingId) {
    conditions.push(eq(marketplaceOrders.listingId, listingId));
  }
  // Alias for buyer and seller user joins to avoid column name conflicts
  const { alias } = await import('drizzle-orm/mysql-core');
  const buyerAlias = alias(users, 'buyerAlias');
  const sellerAlias = alias(users, 'sellerAlias');

  const rows = await db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    sellerType: marketplaceOrders.sellerType,
    listingId: marketplaceOrders.listingId,
    unitPriceHkd: marketplaceOrders.unitPriceHkd,
    quantity: marketplaceOrders.quantity,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    orderStatus: marketplaceOrders.orderStatus,
    shippingName: marketplaceOrders.shippingName,
    shippingPhone: marketplaceOrders.shippingPhone,
    shippingAddress: marketplaceOrders.shippingAddress,
    shippingMethod: marketplaceOrders.shippingMethod,
    trackingNumber: marketplaceOrders.trackingNumber,
    shippedAt: marketplaceOrders.shippedAt,
    autoCompleteAt: marketplaceOrders.autoCompleteAt,
    payoutStatus: marketplaceOrders.payoutStatus,
    stripeSessionId: marketplaceOrders.stripeSessionId,
    stripePaymentIntentId: marketplaceOrders.stripePaymentIntentId,
    stripeTransferId: marketplaceOrders.stripeTransferId,
    stripeTransferError: marketplaceOrders.stripeTransferError,
    manualPayoutAt: marketplaceOrders.manualPayoutAt,
    manualPayoutNote: marketplaceOrders.manualPayoutNote,
    manualPayoutProofUrl: marketplaceOrders.manualPayoutProofUrl,
    disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
    disputeReason: marketplaceOrders.disputeReason,
    disputeResolvedAt: marketplaceOrders.disputeResolvedAt,
    disputeResolution: marketplaceOrders.disputeResolution,
    buyerConfirmedAt: marketplaceOrders.buyerConfirmedAt,
    platformFeeRate: marketplaceOrders.platformFeeRate,
    adminNote: marketplaceOrders.adminNote,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
    // From listing join
    listingTitle: marketplaceListings.title,
    listingImages: marketplaceListings.images,
    listingCondition: marketplaceListings.condition,
    // Buyer info
    buyerName: buyerAlias.name,
    buyerEmail: buyerAlias.email,
    buyerPhone: buyerAlias.phone,
    // Seller info (from sellerProfiles + sellerAlias users)
    sellerDisplayName: sellerProfiles.displayName,
    sellerUserId: sellerProfiles.userId,
    sellerUserName: sellerAlias.name,
    sellerUserEmail: sellerAlias.email,
    sellerUserPhone: sellerAlias.phone,
    sellerStripeConnectId: sellerProfiles.stripeConnectId,
    sellerStripeConnectStatus: sellerProfiles.stripeConnectStatus,
  })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .leftJoin(buyerAlias, eq(marketplaceOrders.buyerId, buyerAlias.id))
    .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
    .leftJoin(sellerAlias, eq(sellerProfiles.userId, sellerAlias.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(marketplaceOrders.createdAt)).limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return { orders: rows, total: Number(countRows[0]?.count ?? 0) };
}
export async function getAlipayPendingOrders(dateFilter?: 'all' | 'today' | 'week' | 'month') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  let fromDate: Date | null = null;
  if (dateFilter === 'today') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (dateFilter === 'week') {
    const day = now.getDay(); // 0=Sun
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  } else if (dateFilter === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const { gte, ne } = await import('drizzle-orm');
  const conditions: ReturnType<typeof eq>[] = [
    eq(marketplaceOrders.paymentMethod, 'alipay_hk'),
    eq(marketplaceOrders.paymentStatus, 'pending'),
    ne(marketplaceOrders.orderStatus, 'cancelled'),
  ];
  if (fromDate) {
    conditions.push(gte(marketplaceOrders.createdAt, fromDate) as any);
  }
  return db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    listingId: marketplaceOrders.listingId,
    listingTitle: marketplaceListings.title,
    sellerId: marketplaceOrders.sellerId,
    sellerType: marketplaceOrders.sellerType,
    unitPriceHkd: marketplaceOrders.unitPriceHkd,
    quantity: marketplaceOrders.quantity,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    orderStatus: marketplaceOrders.orderStatus,
    shippingName: marketplaceOrders.shippingName,
    shippingPhone: marketplaceOrders.shippingPhone,
    shippingAddress: marketplaceOrders.shippingAddress,
    alipayProofImageUrl: marketplaceOrders.alipayProofImageUrl,
    aiVerificationResult: marketplaceOrders.aiVerificationResult,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
  }).from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(and(...conditions))
    .orderBy(desc(marketplaceOrders.createdAt));
}

// --- Marketplace Order Items ---
export async function createOrderItems(items: InsertMarketplaceOrderItem[]) {
  const db = await getDb();
  if (items.length === 0) return;
  if (!db) throw new Error("Database not available");
  await db.insert(marketplaceOrderItems).values(items);
}
export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(marketplaceOrderItems).where(eq(marketplaceOrderItems.orderId, orderId));
}
export async function getSellerOrderItems(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Query marketplaceOrders joined with marketplaceListings for title
  const rows = await db.select({
    id: marketplaceOrders.id,
    orderId: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    listingId: marketplaceOrders.listingId,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    sellerType: marketplaceOrders.sellerType,
    priceHkd: marketplaceOrders.unitPriceHkd,
    quantity: marketplaceOrders.quantity,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    orderStatus: marketplaceOrders.orderStatus,
    shippingName: marketplaceOrders.shippingName,
    shippingPhone: marketplaceOrders.shippingPhone,
    shippingAddress: marketplaceOrders.shippingAddress,
    shippingMethod: marketplaceOrders.shippingMethod,
    trackingNumber: marketplaceOrders.trackingNumber,
    shippedAt: marketplaceOrders.shippedAt,
    autoCompleteAt: marketplaceOrders.autoCompleteAt,
    payoutStatus: marketplaceOrders.payoutStatus,
    disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
    disputeReason: marketplaceOrders.disputeReason,
    disputeEvidenceUrls: marketplaceOrders.disputeEvidenceUrls,
    disputeResolution: marketplaceOrders.disputeResolution,
    disputeResolvedAt: marketplaceOrders.disputeResolvedAt,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
    title: marketplaceListings.title,
    listingImages: marketplaceListings.images,
    listingCondition: marketplaceListings.condition,
  })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(and(
      eq(marketplaceOrders.sellerId, sellerId),
      eq(marketplaceOrders.sellerType, 'seller'),
      // Exclude pending_payment orders - buyer hasn't paid yet, not a real order for seller
      sql`${marketplaceOrders.orderStatus} != 'pending_payment'`
    ))
    .orderBy(desc(marketplaceOrders.createdAt));
  return rows;
}
export async function getPlatformOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    id: marketplaceOrders.id,
    orderId: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    listingId: marketplaceOrders.listingId,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    sellerType: marketplaceOrders.sellerType,
    priceHkd: marketplaceOrders.unitPriceHkd,
    quantity: marketplaceOrders.quantity,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    orderStatus: marketplaceOrders.orderStatus,
    shippingName: marketplaceOrders.shippingName,
    shippingPhone: marketplaceOrders.shippingPhone,
    shippingAddress: marketplaceOrders.shippingAddress,
    shippingMethod: marketplaceOrders.shippingMethod,
    trackingNumber: marketplaceOrders.trackingNumber,
    shippedAt: marketplaceOrders.shippedAt,
    autoCompleteAt: marketplaceOrders.autoCompleteAt,
    payoutStatus: marketplaceOrders.payoutStatus,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
    title: marketplaceListings.title,
    listingImages: marketplaceListings.images,
    listingCondition: marketplaceListings.condition,
  })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(and(
      eq(marketplaceOrders.sellerType, 'platform'),
      // Exclude pending_payment orders - buyer hasn't paid yet
      sql`${marketplaceOrders.orderStatus} != 'pending_payment'`
    ))
    .orderBy(desc(marketplaceOrders.createdAt));
  return rows;
}

export async function getPendingPayoutItems() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(marketplaceOrderItems)
    .where(and(eq(marketplaceOrderItems.sellerType, 'seller'), eq(marketplaceOrderItems.payoutStatus, 'pending')));
}

// --- Marketplace Payouts ---
export async function createPayout(data: InsertMarketplacePayout) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketplacePayouts).values(data);
}
export async function updatePayout(id: number, data: Partial<InsertMarketplacePayout>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(marketplacePayouts).set(data).where(eq(marketplacePayouts.id, id));
}
export async function getSellerPayouts(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Stripe payouts from marketplacePayouts table
  const stripePays = await db.select().from(marketplacePayouts).where(eq(marketplacePayouts.sellerId, sellerId)).orderBy(desc(marketplacePayouts.createdAt));
  // Alipay HK manual payouts from marketplaceOrders table
  const alipayPays = await db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    amountHkd: marketplaceOrders.sellerReceivableHkd,
    createdAt: marketplaceOrders.manualPayoutAt,
    status: sql<string>`'completed'`,
    paymentMethod: marketplaceOrders.paymentMethod,
    manualPayoutNote: marketplaceOrders.manualPayoutNote,
    manualPayoutProofUrl: marketplaceOrders.manualPayoutProofUrl,
  }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.sellerId, sellerId),
      eq(marketplaceOrders.paymentMethod, 'alipay_hk'),
      eq(marketplaceOrders.payoutStatus, 'paid'),
      isNotNull(marketplaceOrders.manualPayoutAt)
    ))
    .orderBy(desc(marketplaceOrders.manualPayoutAt));
  // Merge and sort by date
  const stripeFormatted = stripePays.map(p => ({ ...p, source: 'stripe' as const }));
  const alipayFormatted = alipayPays.map(p => ({ ...p, source: 'alipay_hk' as const }));
  const all = [...stripeFormatted, ...alipayFormatted].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db2 = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db2 - da;
  });
  return all;
}
export async function getMarketplaceStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [listingCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(eq(marketplaceListings.status, 'active'));
  const [orderCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders);
  const [pendingPaymentCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(eq(marketplaceOrders.orderStatus, 'pending_payment'));
  const [pendingAlipay] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.paymentMethod, 'alipay_hk'),
      eq(marketplaceOrders.paymentStatus, 'pending'),
      sql`${marketplaceOrders.orderStatus} != 'cancelled'`,
      sql`${marketplaceOrders.alipayProofImageUrl} IS NOT NULL`
    ));
  const [sellerCount] = await db.select({ count: sql<number>`count(*)` }).from(sellerProfiles).where(eq(sellerProfiles.isActive, true));
  const [pendingReview] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(eq(marketplaceListings.status, 'pending_review'));
  // Unresolved disputes count
  const [disputeCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders).where(eq(marketplaceOrders.orderStatus, 'disputed'));
  // Sales revenue stats - all paid orders (total sales includes platform orders; fees only for C2C seller orders)
  const paidStatuses = ['payment_received', 'processing', 'shipped', 'delivered', 'completed'];
  const [totalRevenue] = await db.select({
    totalSales: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
    completedCount: sql<number>`count(*)`,
  }).from(marketplaceOrders).where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]));
  // Platform fee income: only from C2C seller orders (sellerType = 'seller')
  const [totalFeeRevenue] = await db.select({
    totalFees: sql<string>`COALESCE(SUM(platformFeeHkd), 0)`,
  }).from(marketplaceOrders).where(
    and(
      inArray(marketplaceOrders.orderStatus, paidStatuses as any[]),
      eq(marketplaceOrders.sellerType, 'seller')
    )
  );
  // This month revenue
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [thisMonthRevenue] = await db.select({
    total: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
  }).from(marketplaceOrders)
    .where(and(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]), sql`createdAt >= ${firstDayOfMonth}`));
  const [lastMonthRevenue] = await db.select({
    total: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
  }).from(marketplaceOrders)
    .where(and(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]), sql`createdAt >= ${firstDayOfLastMonth}`, sql`createdAt < ${firstDayOfMonth}`));
  // Payment method breakdown
  const [stripeCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.paymentMethod, 'stripe'), inArray(marketplaceOrders.orderStatus, paidStatuses as any[])));
  const [alipayCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.paymentMethod, 'alipay_hk'), inArray(marketplaceOrders.orderStatus, paidStatuses as any[])));
  // This month auto-cancelled orders (pending_payment orders cancelled by timeout)
  const [thisMonthCancelledOrders] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.orderStatus, 'cancelled'),
      sql`createdAt >= ${firstDayOfMonth}`
    ));
  return {
    activeListings: Number(listingCount?.count ?? 0),
    totalOrders: Number(orderCount?.count ?? 0),
    pendingPaymentCount: Number(pendingPaymentCount?.count ?? 0),
    pendingAlipayConfirmation: Number(pendingAlipay?.count ?? 0),
    activeSellerCount: Number(sellerCount?.count ?? 0),
    pendingReviewListings: Number(pendingReview?.count ?? 0),
    unresolvedDisputeCount: Number(disputeCount?.count ?? 0),
    // Sales revenue
    totalSalesHkd: parseFloat(totalRevenue?.totalSales ?? '0'),
    totalFeesHkd: parseFloat(totalFeeRevenue?.totalFees ?? '0'), // C2C only
    completedOrderCount: Number(totalRevenue?.completedCount ?? 0),
    thisMonthSalesHkd: parseFloat(thisMonthRevenue?.total ?? '0'),
    lastMonthSalesHkd: parseFloat(lastMonthRevenue?.total ?? '0'),
    stripePaidCount: Number(stripeCount?.count ?? 0),
    alipayPaidCount: Number(alipayCount?.count ?? 0),
    thisMonthCancelledOrders: Number(thisMonthCancelledOrders?.count ?? 0),
  };
}

// --- Marketplace Banners ---
export async function getActiveBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketplaceBanners)
    .where(eq(marketplaceBanners.isActive, true))
    .orderBy(asc(marketplaceBanners.sortOrder), asc(marketplaceBanners.id));
}

export async function getAllBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketplaceBanners)
    .orderBy(asc(marketplaceBanners.sortOrder), asc(marketplaceBanners.id));
}

export async function createBanner(data: InsertMarketplaceBanner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketplaceBanners).values(data);
}

export async function updateBanner(id: number, data: Partial<InsertMarketplaceBanner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(marketplaceBanners).set({ ...data, updatedAt: new Date() }).where(eq(marketplaceBanners.id, id));
}

export async function deleteBanner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(marketplaceBanners).where(eq(marketplaceBanners.id, id));
}

// --- Wishlists ---
export async function getUserWishlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    wishlistId: wishlists.id,
    createdAt: wishlists.createdAt,
    listing: marketplaceListings,
  }).from(wishlists)
    .innerJoin(marketplaceListings, eq(wishlists.listingId, marketplaceListings.id))
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.createdAt));
  return rows;
}

export async function isInWishlist(userId: number, listingId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: wishlists.id }).from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)))
    .limit(1);
  return rows.length > 0;
}

export async function addToWishlistListing(userId: number, listingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: ignore if already exists
  const existing = await isInWishlist(userId, listingId);
  if (!existing) {
    await db.insert(wishlists).values({ userId, listingId });
  }
}

export async function removeFromWishlistListing(userId: number, listingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.listingId, listingId)));
}

export async function getWishlistListingIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ listingId: wishlists.listingId }).from(wishlists)
    .where(eq(wishlists.userId, userId));
  return rows.map(r => r.listingId);
}

// ============================================================
// DISPUTE & REVIEW DB HELPERS
// ============================================================

export async function getDisputedOrders(page = 1, pageSize = 20, search?: string, status: 'pending' | 'resolved' | 'all' = 'pending') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  const buyerAlias = alias(users, 'buyer');
  const buildWhere = () => {
    // Status filter: pending = currently disputed, resolved = has disputeResolvedAt, all = both
    let baseCondition: any;
    if (status === 'pending') {
      baseCondition = eq(marketplaceOrders.orderStatus, "disputed");
    } else if (status === 'resolved') {
      baseCondition = isNotNull(marketplaceOrders.disputeResolvedAt);
    } else {
      // 'all': either currently disputed OR has been resolved
      baseCondition = or(
        eq(marketplaceOrders.orderStatus, "disputed"),
        isNotNull(marketplaceOrders.disputeResolvedAt)
      );
    }
    if (!search || !search.trim()) return baseCondition;
    const q = `%${search.trim()}%`;
    return and(
      baseCondition,
      or(
        like(marketplaceOrders.orderNo, q),
        like(buyerAlias.name, q),
        like(buyerAlias.email, q)
      )
    );
  };
  const rows = await db.select({
    order: marketplaceOrders,
    buyerName: buyerAlias.name,
    buyerEmail: buyerAlias.email,
    listingImages: marketplaceListings.images,
    listingTitle: marketplaceListings.title,
  }).from(marketplaceOrders)
    .leftJoin(buyerAlias, eq(marketplaceOrders.buyerId, buyerAlias.id))
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(buildWhere())
    .orderBy(desc(marketplaceOrders.disputeOpenedAt))
    .limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .leftJoin(buyerAlias, eq(marketplaceOrders.buyerId, buyerAlias.id))
    .where(buildWhere());
  return { orders: rows.map(r => ({ ...r.order, buyerName: r.buyerName, buyerEmail: r.buyerEmail, listingImages: r.listingImages, listingTitle: r.listingTitle })), total: Number(countRows[0]?.count ?? 0) };
}

export async function getSellerProfileByStripeConnectId(stripeConnectId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sellerProfiles)
    .where(eq(sellerProfiles.stripeConnectId, stripeConnectId)).limit(1);
  return rows[0] ?? null;
}

export async function createReview(data: InsertMarketplaceReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(marketplaceReviews).values(data);
  const stats = await db.select({
    avg: sql<string>`AVG(rating)`,
    cnt: sql<number>`COUNT(*)`,
  }).from(marketplaceReviews).where(eq(marketplaceReviews.sellerId, data.sellerId));
  const avg = parseFloat(stats[0]?.avg ?? "0");
  const cnt = Number(stats[0]?.cnt ?? 0);
  await db.update(sellerProfiles).set({
    avgRating: avg.toFixed(2),
    ratingCount: cnt,
    updatedAt: new Date(),
  }).where(eq(sellerProfiles.id, data.sellerId));
}

export async function getSellerReviews(sellerId: number, page = 1, pageSize = 10) {
  const db = await getDb();
  if (!db) return { reviews: [], total: 0 };
  const offset = (page - 1) * pageSize;
  const rows = await db.select({
    review: marketplaceReviews,
    buyerName: users.name,
  }).from(marketplaceReviews)
    .leftJoin(users, eq(marketplaceReviews.buyerId, users.id))
    .where(eq(marketplaceReviews.sellerId, sellerId))
    .orderBy(desc(marketplaceReviews.createdAt))
    .limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceReviews)
    .where(eq(marketplaceReviews.sellerId, sellerId));
  return { reviews: rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function getReviewByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(marketplaceReviews)
    .where(eq(marketplaceReviews.orderId, orderId)).limit(1);
  return rows[0] ?? null;
}

// --- User Shipping Addresses ---
export async function getUserShippingAddresses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userShippingAddresses)
    .where(eq(userShippingAddresses.userId, userId))
    .orderBy(desc(userShippingAddresses.isDefault), asc(userShippingAddresses.createdAt));
}

export async function getUserDefaultShippingAddress(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(userShippingAddresses)
    .where(and(eq(userShippingAddresses.userId, userId), eq(userShippingAddresses.isDefault, true)))
    .limit(1);
  if (rows.length > 0) return rows[0];
  // Fall back to first address
  const all = await db.select().from(userShippingAddresses)
    .where(eq(userShippingAddresses.userId, userId))
    .orderBy(asc(userShippingAddresses.createdAt)).limit(1);
  return all[0] ?? null;
}

export async function createUserShippingAddress(data: InsertUserShippingAddress) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // If this is the first address, make it default
  const existing = await db.select({ id: userShippingAddresses.id })
    .from(userShippingAddresses).where(eq(userShippingAddresses.userId, data.userId)).limit(1);
  const shouldBeDefault = existing.length === 0 || data.isDefault;
  if (shouldBeDefault) {
    // Clear existing defaults
    await db.update(userShippingAddresses)
      .set({ isDefault: false })
      .where(eq(userShippingAddresses.userId, data.userId));
  }
  const [result] = await db.insert(userShippingAddresses).values({ ...data, isDefault: shouldBeDefault });
  return result;
}

export async function updateUserShippingAddress(id: number, userId: number, data: Partial<InsertUserShippingAddress>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.isDefault) {
    await db.update(userShippingAddresses)
      .set({ isDefault: false })
      .where(eq(userShippingAddresses.userId, userId));
  }
  await db.update(userShippingAddresses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(userShippingAddresses.id, id), eq(userShippingAddresses.userId, userId)));
}

export async function deleteUserShippingAddress(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(userShippingAddresses)
    .where(and(eq(userShippingAddresses.id, id), eq(userShippingAddresses.userId, userId)));
}

export async function setDefaultShippingAddress(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(userShippingAddresses)
    .set({ isDefault: false })
    .where(eq(userShippingAddresses.userId, userId));
  await db.update(userShippingAddresses)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(userShippingAddresses.id, id), eq(userShippingAddresses.userId, userId)));
}

// --- Offers ---
export async function createOffer(data: InsertOffer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(offers).values(data).$returningId();
  const [row] = await db.select().from(offers).where(eq(offers.id, result.id));
  return row;
}

export async function getOfferById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(offers).where(eq(offers.id, id));
  return row ?? null;
}

export async function getBuyerOffers(buyerId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: offers.id,
    listingId: offers.listingId,
    buyerId: offers.buyerId,
    sellerId: offers.sellerId,
    sellerProfileId: offers.sellerProfileId,
    offerPriceHkd: offers.offerPriceHkd,
    message: offers.message,
    status: offers.status,
    expiresAt: offers.expiresAt,
    respondedAt: offers.respondedAt,
    rejectionReason: offers.rejectionReason,
    orderId: offers.orderId,
    createdAt: offers.createdAt,
    updatedAt: offers.updatedAt,
    listingTitle: marketplaceListings.title,
    listingImages: marketplaceListings.images,
  })
    .from(offers)
    .leftJoin(marketplaceListings, eq(offers.listingId, marketplaceListings.id))
    .where(eq(offers.buyerId, buyerId))
    .orderBy(desc(offers.createdAt));
  return rows;
}

export async function getSellerOffers(sellerProfileId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: offers.id,
    listingId: offers.listingId,
    buyerId: offers.buyerId,
    sellerId: offers.sellerId,
    sellerProfileId: offers.sellerProfileId,
    offerPriceHkd: offers.offerPriceHkd,
    message: offers.message,
    status: offers.status,
    expiresAt: offers.expiresAt,
    respondedAt: offers.respondedAt,
    rejectionReason: offers.rejectionReason,
    orderId: offers.orderId,
    createdAt: offers.createdAt,
    updatedAt: offers.updatedAt,
    listingTitle: marketplaceListings.title,
    listingImages: marketplaceListings.images,
  })
    .from(offers)
    .leftJoin(marketplaceListings, eq(offers.listingId, marketplaceListings.id))
    .where(eq(offers.sellerProfileId, sellerProfileId))
    .orderBy(desc(offers.createdAt));
  return rows;
}

export async function getListingOffers(listingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(offers).where(eq(offers.listingId, listingId)).orderBy(desc(offers.createdAt));
}

export async function updateOffer(id: number, data: Partial<typeof offers.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(offers).set(data).where(eq(offers.id, id));
}

/**
 * Expire all other pending offers for a listing after one offer is accepted.
 * Returns the list of expired offer records (id + buyerId) so callers can notify buyers.
 */
export async function expireOtherPendingOffers(listingId: number, acceptedOfferId: number): Promise<{ id: number; buyerId: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const pendingOffers = await db
    .select({ id: offers.id, buyerId: offers.buyerId })
    .from(offers)
    .where(and(
      eq(offers.listingId, listingId),
      eq(offers.status, "pending"),
      sql`${offers.id} != ${acceptedOfferId}`
    ));
  if (pendingOffers.length === 0) return [];
  await db.update(offers)
    .set({ status: "expired" })
    .where(and(
      eq(offers.listingId, listingId),
      eq(offers.status, "pending"),
      sql`${offers.id} != ${acceptedOfferId}`
    ));
  return pendingOffers;
}

// --- Listing Reports ---
export async function createListingReport(data: InsertListingReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(listingReports).values(data).$returningId();
  const [row] = await db.select().from(listingReports).where(eq(listingReports.id, result.id));
  return row;
}

export async function getAdminListingReports(options: { page?: number; pageSize?: number; status?: string } = {}) {
  const db = await getDb();
  if (!db) return { reports: [], total: 0 };
  const { page = 1, pageSize = 20, status } = options;
  const offset = (page - 1) * pageSize;
  const conditions = status && status !== 'all' ? [eq(listingReports.status, status as any)] : [];
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(listingReports).where(conditions.length ? and(...conditions) : undefined);
  const reports = await db.select().from(listingReports).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(listingReports.createdAt)).limit(pageSize).offset(offset);
  return { reports, total: countResult?.count ?? 0 };
}

export async function updateListingReport(id: number, data: Partial<typeof listingReports.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(listingReports).set(data).where(eq(listingReports.id, id));
}

// --- Sales Report (Monthly Breakdown) ---
export async function getSalesReport(months: number = 12) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const paidStatuses = ['payment_received', 'processing', 'shipped', 'delivered', 'completed'];

  // Monthly breakdown: group by year-month
  const monthlyRows = await db.select({
    yearMonth: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    totalSales: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
    orderCount: sql<number>`count(*)`,
    stripeCount: sql<number>`SUM(CASE WHEN paymentMethod = 'stripe' THEN 1 ELSE 0 END)`,
    alipayCount: sql<number>`SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN 1 ELSE 0 END)`,
    platformSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerFees: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
  })
    .from(marketplaceOrders)
    .where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`)
    .limit(months);

  // Overall totals
  const [overall] = await db.select({
    totalSales: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
    totalFees: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    totalOrders: sql<number>`count(*)`,
    platformSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN subtotalHkd ELSE 0 END), 0)`,
    stripeCount: sql<number>`SUM(CASE WHEN paymentMethod = 'stripe' THEN 1 ELSE 0 END)`,
    alipayCount: sql<number>`SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN 1 ELSE 0 END)`,
  }).from(marketplaceOrders).where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]));

  return {
    monthly: monthlyRows.map(r => ({
      yearMonth: r.yearMonth,
      totalSalesHkd: parseFloat(r.totalSales ?? '0'),
      orderCount: Number(r.orderCount ?? 0),
      stripeCount: Number(r.stripeCount ?? 0),
      alipayCount: Number(r.alipayCount ?? 0),
      platformSalesHkd: parseFloat(r.platformSales ?? '0'),
      sellerSalesHkd: parseFloat(r.sellerSales ?? '0'),
      sellerFeesHkd: parseFloat(r.sellerFees ?? '0'),
    })),
    overall: {
      totalSalesHkd: parseFloat(overall?.totalSales ?? '0'),
      totalFeesHkd: parseFloat(overall?.totalFees ?? '0'),
      totalOrders: Number(overall?.totalOrders ?? 0),
      platformSalesHkd: parseFloat(overall?.platformSales ?? '0'),
      sellerSalesHkd: parseFloat(overall?.sellerSales ?? '0'),
      stripeCount: Number(overall?.stripeCount ?? 0),
      alipayCount: Number(overall?.alipayCount ?? 0),
    },
  };
}

// --- Admin Seller Detail with User Account Info ---
export async function getAdminSellerDetail(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get seller profile
  const spRows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, sellerId)).limit(1);
  const sellerProfile = spRows[0] ?? null;
  if (!sellerProfile) return null;
  // Get user account
  const userRows = await db.select({ id: users.id, email: users.email, name: users.name, phone: users.phone, loginMethod: users.loginMethod, role: users.role, emailVerified: users.emailVerified, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, sellerProfile.userId)).limit(1);
  const user = userRows[0] ?? null;
  // Get listing count
  const listingCountRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(eq(marketplaceListings.sellerId, sellerId));
  const listingCount = Number(listingCountRows[0]?.count ?? 0);
  // Get active listing count
  const activeListingCountRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(and(eq(marketplaceListings.sellerId, sellerId), eq(marketplaceListings.status, 'active')));
  const activeListingCount = Number(activeListingCountRows[0]?.count ?? 0);
  // Get order count
  const orderCountRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders).where(eq(marketplaceOrders.sellerId, sellerId));
  const orderCount = Number(orderCountRows[0]?.count ?? 0);
  // Get completed order count and total revenue
  const completedOrderRows = await db.select({ count: sql<number>`count(*)`, revenue: sql<number>`sum(sellerReceivableHkd)` }).from(marketplaceOrders).where(and(eq(marketplaceOrders.sellerId, sellerId), eq(marketplaceOrders.orderStatus, 'completed')));
  const completedOrderCount = Number(completedOrderRows[0]?.count ?? 0);
  const totalRevenue = Number(completedOrderRows[0]?.revenue ?? 0);
  return { sellerProfile, user, listingCount, activeListingCount, orderCount, completedOrderCount, totalRevenue };
}

// --- Admin Listing Detail with Seller Info ---
export async function getAdminListingDetail(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get listing
  const listingRows = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id)).limit(1);
  const listing = listingRows[0] ?? null;
  if (!listing) return null;
  // Get seller profile if C2C
  let sellerProfile = null;
  let sellerUser = null;
  if (listing.sellerType === "seller" && listing.sellerId) {
    const spRows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, listing.sellerId)).limit(1);
    sellerProfile = spRows[0] ?? null;
    if (sellerProfile) {
      const userRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, sellerProfile.userId)).limit(1);
      sellerUser = userRows[0] ?? null;
    }
  }
  // Get order count for this listing
  const orderCountRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders).where(eq(marketplaceOrders.listingId, id));
  const orderCount = Number(orderCountRows[0]?.count ?? 0);
  return { listing, sellerProfile, sellerUser, orderCount };
}

// Check if a listing has any active (pending_payment) orders - used for listing lock mechanism
export async function getActiveOrderByListingId(listingId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    orderStatus: marketplaceOrders.orderStatus,
    buyerId: marketplaceOrders.buyerId,
    paymentMethod: marketplaceOrders.paymentMethod,
    stripeSessionId: marketplaceOrders.stripeSessionId,
    stripePaymentIntentId: marketplaceOrders.stripePaymentIntentId,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    createdAt: marketplaceOrders.createdAt,
  }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.listingId, listingId),
      inArray(marketplaceOrders.orderStatus, ["pending_payment"])
    ))
    .orderBy(desc(marketplaceOrders.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
