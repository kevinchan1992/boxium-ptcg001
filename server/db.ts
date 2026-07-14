import { eq, desc, asc, and, gte, lte, or, like, sql, inArray, isNotNull, isNull, ne, gt, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { generateCardNumberPatterns, isCardNumberQuery, normalizeCardQuery, isPureSeriesCodeQuery, tokenizeSearchQuery, buildTokenPatterns, buildSeriesPrefixPatterns, scoreCardRelevance } from './utils/cardNumberNormalize';
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { users, cards, sealedProducts, priceHistory, watchlist, marketTrends, dataSources, InsertDataSource, firecrawlUsage, systemSettings, InsertSystemSetting, searchStats, InsertSearchStat, scheduleConfig, InsertScheduleConfig, priceUpdateSchedule, trendingCardsCache, InsertTrendingCardsCache, scheduleExecutionHistory, scheduledTasks, disputeMedia, InsertDisputeMedia, DisputeMedia, searchTokens, tcgMarketPrices } from "../drizzle/schema_new";
import { searchCardIdsByTokens, rebuildTokensForCards, type CardTokenData } from './utils/searchTokenBuilder';
import { ENV } from './_core/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any | null = null;
let _pool: any | null = null;
let _dbHealthy = true;
let _lastHealthCheck = 0;

// Reset DB instance so it will be recreated on next getDb() call
export function resetDb() {
  console.log('[Database] Resetting DB instance for reconnection...');
  _db = null;
  _pool = null;
  _dbHealthy = false;
}

// Periodic health check: ping DB every 4 minutes to detect stale connections early
setInterval(async () => {
  if (!_pool) return;
  try {
    await _pool.promise().query('SELECT 1');
    _dbHealthy = true;
    _lastHealthCheck = Date.now();
  } catch (err: any) {
    console.warn('[Database] Health check failed, resetting pool:', err?.code || err?.message);
    resetDb();
  }
}, 4 * 60 * 1000); // every 4 minutes

// In-memory cache for trending cards (refreshed daily, TTL 30 minutes for safety)
type TrendingCardResult = {
  id: number; name: string | null; nameJa: string | null; imageUrl: string | null;
  cardNumber: string | null; series: string | null; rank: number; gameId: number | null;
  priceChange7d: number; oldPrice: number; currentPrice: number; calculatedAt: Date | null;
  priceChange: number; priceChangeFormatted: string;
};
const _trendingCache = new Map<string, { data: TrendingCardResult[]; fetchedAt: number }>();
const TRENDING_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Invalidate the in-memory trending cache (called after calculateAndCacheTrendingCards) */
export function invalidateTrendingCache() {
  _trendingCache.clear();
}

// In-memory cache for search results (TTL 5 minutes, max 100 entries)
// Key: normalized query string only — stores ALL matching cards (no pagination).
// Pagination is done in-memory by slicing the cached array, so page 2+ never hits the DB.
type SearchCacheEntry = { allCards: any[]; total: number; fetchedAt: number };
const _searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SEARCH_CACHE_MAX = 30; // v10.0: reduced from 100 to save memory on Cloud Run (512MB limit)

function getSearchCacheKey(query: string): string {
  return query.toLowerCase().trim();
}

function getFromSearchCache(key: string): { allCards: any[]; total: number } | null {
  const entry = _searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SEARCH_CACHE_TTL_MS) {
    _searchCache.delete(key);
    return null;
  }
  return { allCards: entry.allCards, total: entry.total };
}

function setSearchCache(key: string, allCards: any[], total: number): void {
  if (_searchCache.size >= SEARCH_CACHE_MAX) {
    const oldestKey = _searchCache.keys().next().value;
    if (oldestKey) _searchCache.delete(oldestKey);
  }
  _searchCache.set(key, { allCards, total, fetchedAt: Date.now() });
}

/** Invalidate search cache (call after card data changes) */
export function invalidateSearchCache() {
  _searchCache.clear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Global in-memory price map: cardId → latest PSA 10 SNKRDUNK price (HKD)
// Loaded once on first search, refreshed every 10 minutes.
// This eliminates the need to query priceHistory during search (the slowest part).
// ═══════════════════════════════════════════════════════════════════════════════
let _globalPriceMap: Map<number, number> | null = null;
let _globalPriceMapFetchedAt = 0;
const GLOBAL_PRICE_MAP_TTL_MS = 20 * 60 * 1000; // 20 minutes (v11.1: extended from 10min; GROUP BY query ~1s, less frequent refresh reduces DB load)
let _globalPriceMapLoading: Promise<Map<number, number>> | null = null;

/**
 * Get the global price map (lazy-loaded, cached for 20 minutes).
 * Uses a single SQL query to get the latest PSA 10 price for ALL cards at once.
 * This is much faster than querying per-search because:
 * 1. It runs once and serves all searches from memory
 * 2. It uses a simple GROUP BY query that TiDB can optimize with indexes
 */
async function getGlobalPriceMap(): Promise<Map<number, number>> {
  // Return cached if fresh
  if (_globalPriceMap && (Date.now() - _globalPriceMapFetchedAt < GLOBAL_PRICE_MAP_TTL_MS)) {
    return _globalPriceMap;
  }
  // Prevent concurrent loads (thundering herd)
  if (_globalPriceMapLoading) {
    return _globalPriceMapLoading;
  }
  _globalPriceMapLoading = _loadGlobalPriceMap();
  try {
    const result = await _globalPriceMapLoading;
    return result;
  } finally {
    _globalPriceMapLoading = null;
  }
}

async function _loadGlobalPriceMap(): Promise<Map<number, number>> {
  const db = await getDb();
  if (!db) {
    _globalPriceMap = new Map();
    return _globalPriceMap;
  }
  try {
    console.log('[PriceMap] Loading global price map...');
    const startTime = Date.now();
    // v11.0 FIX: Use GROUP BY subquery to get the latest price per card.
    // Previous approach (LIMIT 10000 + ORDER BY soldAt DESC) only covered ~1413 of 6763 cards (21%).
    // Root cause: LIMIT 10000 only fetches the most recent 10k rows, which belong to a small
    // subset of popular cards. 79% of cards had no PSA 10 price shown in search results.
    //
    // New approach: JOIN with a GROUP BY subquery to get price at MAX(soldAt) per cardId.
    // This returns only ~6763 rows (one per card) and covers 100% of cards.
    // The ph_global_price_map_idx covering index (source, grade, isSuspectedBulk, soldAt, cardId, price)
    // makes this query efficient (~1.4s vs previous ~0.5s but correct vs 21% coverage).
    //
    // Wrap in 20s timeout to prevent cold-start DB hangs causing search errors.
    const queryPromise = db.execute(sql`
      SELECT ph.cardId, ph.price
      FROM priceHistory ph
      INNER JOIN (
        SELECT cardId, MAX(soldAt) AS latestSoldAt
        FROM priceHistory
        WHERE source = 'snkrdunk'
          AND grade = 'PSA 10'
          AND isSuspectedBulk = false
        GROUP BY cardId
      ) latest ON ph.cardId = latest.cardId
        AND ph.soldAt = latest.latestSoldAt
      WHERE ph.source = 'snkrdunk'
        AND ph.grade = 'PSA 10'
        AND ph.isSuspectedBulk = false
    `) as Promise<[Array<{ cardId: number; price: string | number }>, unknown]>;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('[PriceMap] DB query exceeded 20s timeout')), 20000)
    );
    const [rows] = await Promise.race([queryPromise, timeoutPromise]);
    const map = new Map<number, number>();
    for (const row of rows) {
      // Multiple rows may share the same (cardId, soldAt) if prices differ; take the first
      if (!map.has(row.cardId)) {
        map.set(row.cardId, Number(row.price));
      }
    }
    _globalPriceMap = map;
    _globalPriceMapFetchedAt = Date.now();
    console.log(`[PriceMap] Loaded ${map.size} card prices in ${Date.now() - startTime}ms (GROUP BY, 100% coverage)`);
    return map;
  } catch (error) {
    console.error('[PriceMap] Failed to load:', error);
    _globalPriceMap = _globalPriceMap || new Map();
    return _globalPriceMap;
  }
}

/** Invalidate the global price map (call after batch updates complete) */
export function invalidateGlobalPriceMap() {
  _globalPriceMap = null;
  _globalPriceMapFetchedAt = 0;
}

/** Pre-load the global price map on server startup (non-blocking) */
export async function preloadGlobalPriceMap() {
  try {
    await getGlobalPriceMap();
  } catch (err) {
    console.error('[PriceMap] Pre-load failed:', err);
  }
}

// In-memory cache for getPriceStatistics (TTL 5 minutes, keyed by cardId+source+grade)
type PriceStatsEntry = {
  data: { avgPrice: string; minPrice: string; maxPrice: string; count: number } | null;
  fetchedAt: number;
};
const _priceStatsCache = new Map<string, PriceStatsEntry>();
const PRICE_STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PRICE_STATS_CACHE_MAX = 500;

function getPriceStatsCacheKey(cardId: number, source?: string, grade?: string): string {
  return `${cardId}|${source ?? ''}|${grade ?? ''}`;
}

function getFromPriceStatsCache(key: string): PriceStatsEntry['data'] | undefined {
  const entry = _priceStatsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > PRICE_STATS_CACHE_TTL_MS) {
    _priceStatsCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setPriceStatsCache(key: string, data: PriceStatsEntry['data']): void {
  if (_priceStatsCache.size >= PRICE_STATS_CACHE_MAX) {
    const oldestKey = _priceStatsCache.keys().next().value;
    if (oldestKey) _priceStatsCache.delete(oldestKey);
  }
  _priceStatsCache.set(key, { data, fetchedAt: Date.now() });
}

/** Invalidate price statistics cache for a specific card (call after price data changes) */
export function invalidatePriceStatsCache(cardId?: number) {
  if (cardId === undefined) {
    _priceStatsCache.clear();
    return;
  }
  for (const key of Array.from(_priceStatsCache.keys())) {
    if (key.startsWith(`${cardId}|`)) _priceStatsCache.delete(key);
  }
}

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
      // Parse the DATABASE_URL and create a pool with explicit charset=utf8mb4
      // This is required for emoji support in MySQL/TiDB
      const dbUrl = process.env.DATABASE_URL;
      const pool = createPool({
        uri: dbUrl,
        charset: 'utf8mb4',
        timezone: HK_TIMEZONE,
        supportBigNumbers: true,
        bigNumberStrings: false,
        connectionLimit: 10, // Enough for batch update (max 3) + user queries
        waitForConnections: true,
        queueLimit: 50, // Limit queue to prevent unbounded waiting during cold starts
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 10000, // 10s connection timeout (default is 10s, explicit for clarity)
        // Note: mysql2 does not have acquireTimeout; we use Promise.race in withDbTimeout below
        // Ensure boolean JS values are cast to 1/0 for MySQL tinyint(1) columns
        typeCast: function(field: any, next: any) {
          if (field.type === 'TINY' && field.length === 1) {
            return field.string() === '1';
          }
          return next();
        },
      });

      // Listen for connection errors on the pool to auto-reset on disconnect
      pool.on('error', (err: any) => {
        console.warn('[Database] Pool error, will reconnect on next request:', err?.code || err?.message);
        resetDb();
      });

      _pool = pool;
      _db = drizzle(pool);
      _dbHealthy = true;
      _lastHealthCheck = Date.now();
      console.log(`[Database] Connected with timezone: ${HK_TIMEZONE} (Hong Kong), charset: utf8mb4`);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

// Card queries

/** Wrap a DB query with a timeout. Throws if the query takes longer than timeoutMs. */
async function withDbTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`[DB Timeout] ${label} exceeded ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

/**
 * Parse a grade filter keyword from the search query.
 * Returns { gradeFilter: string[], cleanQuery: string } where
 * gradeFilter is an array of DB grade values to match (OR logic),
 * and cleanQuery is the query with the grade token removed.
 */
export function parseGradeFilter(query: string): { gradeFilter: string[] | null; cleanQuery: string; gradeLabel: string | null } {
  const lower = query.toLowerCase().trim();
  // Map of input patterns → DB grade values (from priceHistory and listings)
  const gradeMap: Array<{ pattern: RegExp; grades: string[]; label: string }> = [
    { pattern: /\bpsa\s*10\b/, grades: ['PSA 10', 'PSA10'], label: 'PSA 10' },
    { pattern: /\bpsa\s*9(?!\.5|\d)\b/, grades: ['PSA 9', 'PSA9'], label: 'PSA 9' },
    { pattern: /\bpsa\s*8\b/, grades: ['PSA8以下', 'PSA 8以下'], label: 'PSA 8以下' },
    { pattern: /\bbgs\s*10\b/, grades: ['BGS10 GL', 'BGS10 BL', 'BGS 10 GL', 'BGS 10 BL'], label: 'BGS 10' },
    { pattern: /\bbgs\s*9\.5\b/, grades: ['BGS9.5', 'BGS 9.5'], label: 'BGS 9.5' },
    { pattern: /\bbgs\s*9(?!\.5|\d)\b/, grades: ['BGS9以下', 'BGS 9以下'], label: 'BGS 9以下' },
    { pattern: /\bars\s*10\+?\b/, grades: ['ARS10', 'ARS10+'], label: 'ARS 10' },
    { pattern: /\bars\s*9\b/, grades: ['ARS9'], label: 'ARS 9' },
    { pattern: /\bars\s*8\b/, grades: ['ARS8以下'], label: 'ARS 8以下' },
    { pattern: /\bgrade[:\s]*a\b|\b中古a\b/, grades: ['A'], label: '中古 A' },
    { pattern: /\bgrade[:\s]*b\b|\b中古b\b/, grades: ['B'], label: '中古 B' },
    { pattern: /\bgrade[:\s]*c\b|\b中古c\b/, grades: ['C'], label: '中古 C' },
    { pattern: /\bgrade[:\s]*d\b|\b中古d\b/, grades: ['D'], label: '中古 D' },
  ];
  for (const { pattern, grades, label } of gradeMap) {
    if (pattern.test(lower)) {
      // Remove the matched grade token from the query
      const cleanQuery = query.replace(new RegExp(pattern.source, 'i'), '').replace(/\s+/g, ' ').trim();
      return { gradeFilter: grades, cleanQuery, gradeLabel: label };
    }
  }
  return { gradeFilter: null, cleanQuery: query, gradeLabel: null };
}

/**
 * Search cards that have active listings of a specific grade in snkrdunkListingsCache.
 * If cleanQuery is non-empty, also filter by card name/number.
 * Returns cards sorted by lowest listing price of that grade (ascending).
 *
 * v2: Uses the snkrdunkGradeIndex table for O(1) SQL lookup instead of full-table JSON scan.
 * Falls back to legacy JSON scan if the index table is empty (e.g., before first cache sync).
 */
async function searchCardsByGrade(
  gradeFilter: string[],
  cleanQuery: string,
  limit: number,
  offset: number,
  db: any
): Promise<{ cards: any[]; total: number }> {
  const { snkrdunkGradeIndex, snkrdunkListingsCache } = await import('../drizzle/schema_new');

  // ── v2: Fast SQL path via snkrdunkGradeIndex ─────────────────────────────────
  // Query the normalized index table directly using indexed grade column.
  // This replaces the full-table JSON scan (~10k rows × JSON.parse) with a
  // targeted SQL query that returns only matching cardIds.
  const indexRows = await withDbTimeout<Array<{ cardId: number; minPrice: string }>>(
    db
      .select({
        cardId: snkrdunkGradeIndex.cardId,
        minPrice: snkrdunkGradeIndex.minPrice,
      })
      .from(snkrdunkGradeIndex)
      .where(inArray(snkrdunkGradeIndex.grade, gradeFilter))
      .orderBy(asc(snkrdunkGradeIndex.minPrice)) as unknown as Promise<Array<{ cardId: number; minPrice: string }>>,
    10000,
    `searchCardsByGrade-index(grade:${gradeFilter.join(',')})`
  );

  // If index is populated, use it directly
  if (indexRows.length > 0) {
    const gradeMinPriceMap = new Map<number, number>();
    for (const row of indexRows) {
      const price = Number(row.minPrice);
      const existing = gradeMinPriceMap.get(row.cardId);
      if (existing === undefined || price < existing) {
        gradeMinPriceMap.set(row.cardId, price);
      }
    }
    const matchingCardIds = Array.from(gradeMinPriceMap.keys());
    if (matchingCardIds.length === 0) return { cards: [], total: 0 };

    // If cleanQuery provided, filter by card name/number
    let filteredCardIds = matchingCardIds;
    if (cleanQuery.trim()) {
      const lowerQuery = cleanQuery.toLowerCase();
      const cardRows = await withDbTimeout<Array<{ id: number; name: string | null; nameJa: string | null; cardNumber: string | null }>>(
        db.select({ id: cards.id, name: cards.name, nameJa: cards.nameJa, cardNumber: cards.cardNumber })
          .from(cards)
          .where(inArray(cards.id, matchingCardIds)) as unknown as Promise<Array<{ id: number; name: string | null; nameJa: string | null; cardNumber: string | null }>>,
        10000,
        'searchCardsByGrade-nameFilter'
      );
      filteredCardIds = cardRows
        .filter((c: any) =>
          (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
          (c.nameJa && c.nameJa.toLowerCase().includes(lowerQuery)) ||
          (c.cardNumber && c.cardNumber.toLowerCase().includes(lowerQuery))
        )
        .map((c: any) => c.id);
    }

    if (filteredCardIds.length === 0) return { cards: [], total: 0 };

    // Fetch full card data for matching IDs
    const cardRows = await withDbTimeout<(typeof cards.$inferSelect)[]>(
      db.select().from(cards).where(inArray(cards.id, filteredCardIds)) as unknown as Promise<(typeof cards.$inferSelect)[]>,
      10000,
      'searchCardsByGrade-cardFetch'
    );

    // Sort by minPrice ascending
    const priceMap = gradeMinPriceMap;
    const sorted = cardRows.sort((a: any, b: any) => {
      const pa = priceMap.get(a.id) ?? Infinity;
      const pb = priceMap.get(b.id) ?? Infinity;
      return pa - pb;
    });

    const globalPriceMap = await getGlobalPriceMap();
    const cardsWithPrice = sorted.map((card: any) => ({
      ...card,
      latestPrice: globalPriceMap.get(card.id) ?? priceMap.get(card.id) ?? null,
    }));

    return {
      cards: cardsWithPrice.slice(offset, offset + limit),
      total: cardsWithPrice.length,
    };
  }

  // ── Legacy fallback: full-table JSON scan (used when index is empty) ─────────
  console.warn('[GradeIndex] Index table empty, falling back to JSON scan');
  // Fetch all cache rows with non-empty listings
  const allCacheRows = await withDbTimeout<Array<{ cardId: number; listings: string | null }>>(
    db
      .select({
        cardId: snkrdunkListingsCache.cardId,
        listings: snkrdunkListingsCache.listings,
      })
      .from(snkrdunkListingsCache)
      .where(
        and(
          ne(snkrdunkListingsCache.listings, '[]'),
          ne(snkrdunkListingsCache.listings, 'null'),
          ne(snkrdunkListingsCache.listings, '')
        )
      ) as unknown as Promise<Array<{ cardId: number; listings: string | null }>>,
    15000,
    `searchCardsByGrade-legacy(grade:${gradeFilter.join(',')})`
  );

  // Filter rows that have at least one listing matching the grade filter
  const matchingCardIds: number[] = [];
  const gradeMinPriceMap = new Map<number, number>(); // cardId → lowest price for this grade

  for (const row of allCacheRows) {
    try {
      const items: Array<{ price: number; currency: string; grade: string; status?: string }> =
        typeof row.listings === 'string' ? JSON.parse(row.listings) : (row.listings as any);
      const gradeItems = items.filter(
        (item) =>
          (!item.status || item.status === 'on-sale') &&
          gradeFilter.some(g => item.grade === g)
      );
      if (gradeItems.length > 0) {
        matchingCardIds.push(row.cardId);
        const minPrice = Math.min(...gradeItems.map(i => i.price));
        if (isFinite(minPrice) && minPrice > 0) {
          gradeMinPriceMap.set(row.cardId, Math.round(minPrice * 100) / 100);
        }
      }
    } catch {
      // skip malformed
    }
  }

  if (matchingCardIds.length === 0) return { cards: [], total: 0 };

  // If there's a clean query, further filter by card name/number
  let finalCardIds = matchingCardIds;
  if (cleanQuery.trim()) {
    const tokens = tokenizeSearchQuery(cleanQuery.trim());
    if (tokens.length > 0) {
      const tokenConditions = tokens.map(token => {
        const { namePatterns, cardNumberPatterns: cnPatterns } = buildTokenPatterns(token);
        const conditions = [
          ...namePatterns.map(p => like(cards.name, p)),
          ...namePatterns.map(p => like(cards.nameJa, p)),
          ...cnPatterns.map(p => like(cards.cardNumber, p)),
        ];
        return or(...conditions)!;
      });
      const whereCondition = and(
        inArray(cards.id, matchingCardIds),
        ...(tokenConditions.length === 1 ? [tokenConditions[0]] : tokenConditions)
      );
      const nameMatches = await db.select({ id: cards.id }).from(cards).where(whereCondition);
      finalCardIds = nameMatches.map((r: any) => r.id);
    }
  }

  if (finalCardIds.length === 0) return { cards: [], total: 0 };

  // Fetch full card data
  const matchingCards = await db
    .select()
    .from(cards)
    .where(inArray(cards.id, finalCardIds));

  // Sort by lowest grade listing price (ascending, cards with price first)
  const cardsWithPrice = matchingCards.map((card: any) => ({
    ...card,
    latestPrice: gradeMinPriceMap.get(card.id) || null,
  }));
  cardsWithPrice.sort((a: any, b: any) => {
    const pa = a.latestPrice || Infinity;
    const pb = b.latestPrice || Infinity;
    return pa - pb;
  });

  return {
    cards: cardsWithPrice.slice(offset, offset + limit),
    total: cardsWithPrice.length,
  };
}

export async function searchCards(query: string, limit: number = 20, offset: number = 0) {
  const trimmedQuery = query.trim();

  // ── In-memory cache check (keyed by query only, stores ALL results) ─────────
  // This means page 2+ is served from cache without any DB query.
  const cacheKey = getSearchCacheKey(trimmedQuery);
  const cached = getFromSearchCache(cacheKey);
  if (cached) {
    return { cards: cached.allCards.slice(offset, offset + limit), total: cached.total };
  }

  const db = await getDb();
  if (!db) return { cards: [], total: 0 };

  // ── Grade filter detection ────────────────────────────────────────────────
  // If the query contains a grade keyword (e.g. "bgs9.5", "psa10"), extract it
  // and filter results to cards that have listings of that grade in the cache.
  const { gradeFilter, cleanQuery } = parseGradeFilter(trimmedQuery);
  if (gradeFilter) {
    const gradeResult = await searchCardsByGrade(gradeFilter, cleanQuery, 999999, 0, db);
    setSearchCache(cacheKey, gradeResult.cards, gradeResult.total);
    return { cards: gradeResult.cards.slice(offset, offset + limit), total: gradeResult.total };
  }

  // ── Pure series code query (e.g. "SV10", "SM-P", "ST01", "SM", "ST") ───────
  // When the user types only a set code or partial prefix, do a prefix match
  // on cardNumber using format-aware patterns.
  if (isPureSeriesCodeQuery(trimmedQuery)) {
    const patterns = buildSeriesPrefixPatterns(trimmedQuery);
    if (patterns.length === 0) return { cards: [], total: 0 };

    const matchingCards = await withDbTimeout<typeof cards.$inferSelect[]>(
      db.select().from(cards).where(or(...patterns.map(p => like(cards.cardNumber, p)))),
      15000,
      `searchCards(seriesCode:${trimmedQuery})`
    );

    if (matchingCards.length === 0) return { cards: [], total: 0 };

    // Use global price map (pre-loaded in memory) instead of querying priceHistory per search
    const globalPriceMap = await getGlobalPriceMap();
    const sortedCards = matchingCards.sort((a, b) => (globalPriceMap.get(b.id) || 0) - (globalPriceMap.get(a.id) || 0));
    const allCardsWithPrice = sortedCards.map(card => ({ ...card, latestPrice: globalPriceMap.get(card.id) || null }));
    setSearchCache(cacheKey, allCardsWithPrice, allCardsWithPrice.length);
    return { cards: allCardsWithPrice.slice(offset, offset + limit), total: allCardsWithPrice.length };
  }

    // ── Multi-token fuzzy search (with token index acceleration) ─────────────────
  // Tokenize the query: "pikachu sm-p" → ["pikachu", "sm-p"]
  // Each token must match at least one of: name, nameJa, cardNumber
  // All tokens must match (AND logic across tokens, OR logic within each token)
  const tokens = tokenizeSearchQuery(trimmedQuery);
  if (tokens.length === 0) return { cards: [], total: 0 };

  // STRATEGY: Use searchTokens table as a pre-filter to narrow candidates.
  // Then apply LIKE patterns on the full table as a fallback to catch any
  // cards the token index might have missed (e.g. due to tokenization gaps).
  let matchingCards: typeof cards.$inferSelect[];
  
  const candidateIds = await searchCardIdsByTokens(db, tokens, 'single_card');
  console.log(`[Search] Token index returned ${candidateIds.size} candidates for query: "${trimmedQuery}"`);
  
  // Build LIKE conditions for fallback/supplement
  const tokenConditions = tokens.map(token => {
    const { namePatterns, cardNumberPatterns: cnPatterns } = buildTokenPatterns(token);
    const conditions = [
      ...namePatterns.map(p => like(cards.name, p)),
      ...namePatterns.map(p => like(cards.nameJa, p)),
      ...cnPatterns.map(p => like(cards.cardNumber, p)),
    ];
    return or(...conditions)!;
  });
  const whereCondition = tokenConditions.length === 1
    ? tokenConditions[0]
    : and(...tokenConditions);
  
  if (candidateIds.size > 0 && candidateIds.size < 5000) {
    // Token index found a manageable candidate set — fetch those cards first
    const candidateArray = Array.from(candidateIds);
    const BATCH_SIZE = 2000;
    const allCandidateCards: typeof cards.$inferSelect[] = [];
    for (let i = 0; i < candidateArray.length; i += BATCH_SIZE) {
      const batch = candidateArray.slice(i, i + BATCH_SIZE);
      const batchCards = await db.select().from(cards).where(inArray(cards.id, batch));
      allCandidateCards.push(...batchCards);
    }
    
    // Also run LIKE search to catch any cards the token index missed,
    // but exclude cards we already found (avoid duplicates)
    const likeResults = await withDbTimeout<typeof cards.$inferSelect[]>(
      db.select().from(cards).where(
        and(whereCondition, sql`${cards.id} NOT IN (${sql.raw(candidateArray.join(','))})`)
      ),
      15000,
      `searchCards(supplement:${trimmedQuery})`
    );
    
    if (likeResults.length > 0) {
      console.log(`[Search] LIKE supplement found ${likeResults.length} additional cards for: "${trimmedQuery}"`);
    }
    
    matchingCards = [...allCandidateCards, ...likeResults];
  } else {
    // Fallback: token index returned too many results or no results.
    // Use the original LIKE-based full scan as a safety net.
    matchingCards = await withDbTimeout<typeof cards.$inferSelect[]>(
      db.select().from(cards).where(whereCondition),
      15000,
      `searchCards(fuzzy:${trimmedQuery})`
    );
  }

  if (matchingCards.length === 0) return { cards: [], total: 0 };

  // Use global price map (pre-loaded in memory) instead of querying priceHistory per search
  // This eliminates the slowest part of the search query entirely
  const priceMap = await getGlobalPriceMap();

  // Score each card by relevance to the query, then sort by (relevance DESC, price DESC)
  const cardsWithScore = matchingCards.map(card => ({
    ...card,
    latestPrice: priceMap.get(card.id) || null,
    _relevanceScore: scoreCardRelevance(
      { name: card.name, nameJa: card.nameJa, cardNumber: card.cardNumber },
      trimmedQuery,
      tokens
    ),
  }));

  // Primary sort: price (descending) — cards with higher latestPrice appear first
  // No-price cards (null/0) go to the end, sorted by relevance among themselves
  cardsWithScore.sort((a, b) => {
    const priceA = a.latestPrice ? Number(a.latestPrice) : -1;
    const priceB = b.latestPrice ? Number(b.latestPrice) : -1;
    if (priceA !== priceB) return priceB - priceA;
    // Secondary sort: relevance score for same-price cards
    return b._relevanceScore - a._relevanceScore;
  });

  // Cache ALL results (not just this page), so subsequent pages are served from memory
  setSearchCache(cacheKey, cardsWithScore, cardsWithScore.length);
  return {
    cards: cardsWithScore.slice(offset, offset + limit),
    total: cardsWithScore.length,
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
/**
 * Compute the median JPY price for a card+grade over the past 30 days.
 * Used to detect bulk/lot transactions (isSuspectedBulk detection).
 */
export async function computeMedianJpyPrice(cardId: number, grade: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const records = await db
    .select({ jpyPrice: priceHistory.jpyPrice })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, grade),
        gte(priceHistory.soldAt, thirtyDaysAgo),
        eq(priceHistory.isSuspectedBulk, false)
      )
    )
    .orderBy(asc(priceHistory.jpyPrice));

  const prices = records
    .map(r => r.jpyPrice)
    .filter((p): p is number => p !== null && p > 0);

  if (prices.length === 0) return null;

  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];
}

export async function getCardPriceByGrade(cardId: number, grade: string): Promise<{ avgPrice: number | null; recordCount: number; grade: string }> {
  const CONN_ERR_CODES = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];

  async function runQuery(dbInst: ReturnType<typeof drizzle>) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const records = await dbInst
      .select({ price: priceHistory.price, soldAt: priceHistory.soldAt })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.cardId, cardId),
          eq(priceHistory.source, 'snkrdunk'),
          eq(priceHistory.grade, grade),
          gte(priceHistory.soldAt, sixMonthsAgo),
          eq(priceHistory.isSuspectedBulk, false)
        )
      )
      .orderBy(desc(priceHistory.soldAt))
      .limit(10);
    if (records.length === 0) {
      const allRecords = await dbInst
        .select({ price: priceHistory.price })
        .from(priceHistory)
        .where(
          and(
            eq(priceHistory.cardId, cardId),
            eq(priceHistory.source, 'snkrdunk'),
            eq(priceHistory.grade, grade),
            eq(priceHistory.isSuspectedBulk, false)
          )
        )
        .orderBy(desc(priceHistory.soldAt))
        .limit(10);
      if (allRecords.length === 0) return { avgPrice: null, recordCount: 0, grade };
      const sum2 = allRecords.reduce((acc: number, r: any) => acc + Number(r.price), 0);
      return { avgPrice: Math.round(sum2 / allRecords.length), recordCount: allRecords.length, grade };
    }
    const sum = records.reduce((acc: number, r: any) => acc + Number(r.price), 0);
    return { avgPrice: Math.round(sum / records.length), recordCount: records.length, grade };
  }

  let db = await getDb();
  if (!db) return { avgPrice: null, recordCount: 0, grade };
  try {
    return await runQuery(db);
  } catch (err: any) {
    // Extract error code from direct error or cause
    const errCode = err?.code || err?.cause?.code;
    const isConnErr = CONN_ERR_CODES.includes(errCode);
    if (isConnErr) {
      console.warn('[getCardPriceByGrade] DB connection lost, resetting and retrying...', errCode);
      resetDb();
      db = await getDb();
      if (!db) return { avgPrice: null, recordCount: 0, grade };
      try {
        return await runQuery(db);
      } catch (retryErr: any) {
        console.error('[getCardPriceByGrade] Retry failed:', retryErr?.message);
        return { avgPrice: null, recordCount: 0, grade };
      }
    }
    // Non-connection errors: log and return null price (don't crash the whole collection query)
    console.error('[getCardPriceByGrade] Query error (cardId=%d, grade=%s):', cardId, grade, err?.message);
    return { avgPrice: null, recordCount: 0, grade };
  }
}

/**
 * Batch fetch market prices for multiple (cardId, grade) pairs in a SINGLE SQL query.
 * This replaces the N+1 pattern of calling getCardPriceByGrade() in a Promise.all loop,
 * which exhausts the DB connection pool under concurrent user load.
 *
 * Returns a Map keyed by "cardId:grade" → avgPrice (null if no records).
 */
export async function batchGetCardPricesByGrades(
  requests: Array<{ cardId: number; grade: string }>
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (requests.length === 0) return result;

  // Initialise all keys to null so callers always get a value
  for (const { cardId, grade } of requests) {
    result.set(`${cardId}:${grade}`, null);
  }

  const db = await getDb();
  if (!db) return result;

  const CONN_ERR_CODES = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];

  async function runBatchQuery(dbInst: ReturnType<typeof drizzle>) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const cardIds = Array.from(new Set(requests.map(r => r.cardId)));

    // Fetch all recent price records for all requested cardIds in ONE query
    const rows = await dbInst
      .select({
        cardId: priceHistory.cardId,
        grade: priceHistory.grade,
        price: priceHistory.price,
        soldAt: priceHistory.soldAt,
      })
      .from(priceHistory)
      .where(
        and(
          inArray(priceHistory.cardId, cardIds),
          eq(priceHistory.source, 'snkrdunk'),
          eq(priceHistory.isSuspectedBulk, false)
        )
      )
      .orderBy(desc(priceHistory.soldAt));

    // Group rows by "cardId:grade"
    const grouped = new Map<string, { price: number; soldAt: Date | null }[]>();
    for (const row of rows) {
      if (!row.grade) continue;
      const key = `${row.cardId}:${row.grade}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ price: Number(row.price), soldAt: row.soldAt });
    }

    // For each requested (cardId, grade), compute avgPrice using the same logic as getCardPriceByGrade
    for (const { cardId, grade } of requests) {
      const key = `${cardId}:${grade}`;
      const all = grouped.get(key) ?? [];

      // Try recent 6 months first (up to 10 records)
      const recent = all
        .filter(r => r.soldAt && r.soldAt >= sixMonthsAgo)
        .slice(0, 10);

      const records = recent.length > 0 ? recent : all.slice(0, 10);

      if (records.length === 0) {
        result.set(key, null);
      } else {
        const sum = records.reduce((acc, r) => acc + r.price, 0);
        result.set(key, Math.round(sum / records.length));
      }
    }
  }

  try {
    await runBatchQuery(db);
  } catch (err: any) {
    const errCode = err?.code || err?.cause?.code;
    const isConnErr = CONN_ERR_CODES.includes(errCode);
    if (isConnErr) {
      console.warn('[batchGetCardPricesByGrades] DB connection lost, resetting and retrying...', errCode);
      resetDb();
      const db2 = await getDb();
      if (!db2) return result;
      try {
        await runBatchQuery(db2);
      } catch (retryErr: any) {
        console.error('[batchGetCardPricesByGrades] Retry failed:', retryErr?.message);
      }
    } else {
      console.error('[batchGetCardPricesByGrades] Query error:', err?.message);
    }
  }

  return result;
}

/**
 * Batch fetch the LATEST single transaction price for multiple (cardId, grade) pairs.
 * Unlike batchGetCardPricesByGrades which returns an average, this returns the most
 * recent single sale price — used for Vault real-time market value display.
 */
export async function batchGetLatestPricesByGrades(
  requests: Array<{ cardId: number; grade: string }>
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (requests.length === 0) return result;

  for (const { cardId, grade } of requests) {
    result.set(`${cardId}:${grade}`, null);
  }

  const db = await getDb();
  if (!db) return result;

  const CONN_ERR_CODES = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];

  async function runLatestQuery(dbInst: ReturnType<typeof drizzle>) {
    const cardIds = Array.from(new Set(requests.map(r => r.cardId)));

    // Fetch all price records for requested cardIds, ordered by soldAt DESC
    const rows = await dbInst
      .select({
        cardId: priceHistory.cardId,
        grade: priceHistory.grade,
        price: priceHistory.price,
        soldAt: priceHistory.soldAt,
      })
      .from(priceHistory)
      .where(
        and(
          inArray(priceHistory.cardId, cardIds),
          eq(priceHistory.source, 'snkrdunk'),
          eq(priceHistory.isSuspectedBulk, false)
        )
      )
      .orderBy(desc(priceHistory.soldAt));

    // For each (cardId, grade), take the first (most recent) record only
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.grade) continue;
      const key = `${row.cardId}:${row.grade}`;
      if (!seen.has(key) && result.has(key)) {
        result.set(key, Number(row.price));
        seen.add(key);
      }
    }
  }

  try {
    await runLatestQuery(db);
  } catch (err: any) {
    const errCode = err?.code || err?.cause?.code;
    const isConnErr = CONN_ERR_CODES.includes(errCode);
    if (isConnErr) {
      console.warn('[batchGetLatestPricesByGrades] DB connection lost, resetting and retrying...', errCode);
      resetDb();
      const db2 = await getDb();
      if (!db2) return result;
      try {
        await runLatestQuery(db2);
      } catch (retryErr: any) {
        console.error('[batchGetLatestPricesByGrades] Retry failed:', retryErr?.message);
      }
    } else {
      console.error('[batchGetLatestPricesByGrades] Query error:', err?.message);
    }
  }

  return result;
}

/**
 * For portfolio trend: given a list of (cardId, grade) pairs and a cutoff date,
 * return the latest single transaction price for each pair that occurred ON OR BEFORE
 * the cutoff date. Used to reconstruct historical portfolio value month by month.
 */
export async function batchGetLatestPricesBeforeDate(
  requests: Array<{ cardId: number; grade: string }>,
  before: Date
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (requests.length === 0) return result;

  for (const { cardId, grade } of requests) {
    result.set(`${cardId}:${grade}`, null);
  }

  const db = await getDb();
  if (!db) return result;

  const CONN_ERR_CODES = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];

  async function runQuery(dbInst: ReturnType<typeof drizzle>) {
    const cardIds = Array.from(new Set(requests.map(r => r.cardId)));

    const rows = await dbInst
      .select({
        cardId: priceHistory.cardId,
        grade: priceHistory.grade,
        price: priceHistory.price,
        soldAt: priceHistory.soldAt,
      })
      .from(priceHistory)
      .where(
        and(
          inArray(priceHistory.cardId, cardIds),
          eq(priceHistory.source, 'snkrdunk'),
          eq(priceHistory.isSuspectedBulk, false),
          lte(priceHistory.soldAt, before)
        )
      )
      .orderBy(desc(priceHistory.soldAt));

    // For each (cardId, grade), take the first (most recent before cutoff) record
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.grade) continue;
      const key = `${row.cardId}:${row.grade}`;
      if (!seen.has(key) && result.has(key)) {
        result.set(key, Number(row.price));
        seen.add(key);
      }
    }
  }

  try {
    await runQuery(db);
  } catch (err: any) {
    const errCode = err?.code || err?.cause?.code;
    const isConnErr = CONN_ERR_CODES.includes(errCode);
    if (isConnErr) {
      console.warn('[batchGetLatestPricesBeforeDate] DB connection lost, resetting and retrying...', errCode);
      resetDb();
      const db2 = await getDb();
      if (!db2) return result;
      try {
        await runQuery(db2);
      } catch (retryErr: any) {
        console.error('[batchGetLatestPricesBeforeDate] Retry failed:', retryErr?.message);
      }
    } else {
      console.error('[batchGetLatestPricesBeforeDate] Query error:', err?.message);
    }
  }

  return result;
}

export async function getAllCards() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(cards);
  return result;
}

// ─── Stats count cache (5 min TTL) ─────────────────────────────────────────────────
let _statsCacheCardCount: number | null = null;
let _statsCacheCardCountExpiry = 0;
let _statsCachePriceCount: number | null = null;
let _statsCachePriceCountExpiry = 0;
const STATS_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes (v11.2: extended from 5min; COUNT(*) on TiDB ~1.6s, card count rarely changes)

export async function getTotalCardCount() {
  const now = Date.now();
  if (_statsCacheCardCount !== null && now < _statsCacheCardCountExpiry) {
    return _statsCacheCardCount;
  }
  const db = await getDb();
  if (!db) return _statsCacheCardCount ?? 0;
  // Use APPROX_COUNT_DISTINCT(id) — ~248ms vs ~1649ms for COUNT(*) on TiDB
  // Accuracy within 0.1% is sufficient for display purposes
  const result = await db.execute(sql`SELECT APPROX_COUNT_DISTINCT(id) as c FROM cards`) as any;
  const rows = result[0] as Array<{ c: number }>;
  _statsCacheCardCount = rows[0]?.c || 0;
  _statsCacheCardCountExpiry = now + STATS_CACHE_TTL_MS;
  return _statsCacheCardCount;
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

export async function getPriceHistory(cardId: number, source?: string, grade?: string, limit: number = 50, days?: number, productType?: 'single_card' | 'sealed_product') {
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

  // 排除疑似批量成交的記錄（超過同評級中位數 4 倍）
  // 注意：sealed_product 不應用此過濾，因為卡盒本來就是多盒一起賣的
  if (productType !== 'sealed_product') {
    conditions.push(eq(priceHistory.isSuspectedBulk, false));
  }

  // Fetch more than needed so we can deduplicate in-memory
  const fetchLimit = limit * 3;
  const rows = await db
    .select()
    .from(priceHistory)
    .where(and(...conditions))
    .orderBy(desc(priceHistory.soldAt))
    .limit(fetchLimit);

  // Query-layer deduplication: remove rows that share the same recordHash
  // (catches any duplicates that slipped through the DB UNIQUE INDEX due to
  // legacy rows without recordHash, or race conditions during parallel inserts)
  const seenHashes = new Set<string>();
  const seenLegacyKeys = new Set<string>();
  const deduped = rows.filter(row => {
    // Primary dedup: by recordHash (preferred, stable)
    if (row.recordHash) {
      if (seenHashes.has(row.recordHash)) return false;
      seenHashes.add(row.recordHash);
      return true;
    }
    // Fallback dedup for legacy rows without recordHash:
    // use (cardId|source|grade|soldAtDate|jpyPrice|sourcePosition) as key
    const soldAtDate = row.soldAt ? row.soldAt.toISOString().slice(0, 10) : '__nodate__';
    const legacyKey = [
      row.cardId,
      row.source,
      row.grade ?? '__none__',
      soldAtDate,
      row.jpyPrice ?? 0,
      row.sourcePosition ?? 0,
    ].join('|');
    if (seenLegacyKeys.has(legacyKey)) return false;
    seenLegacyKeys.add(legacyKey);
    return true;
  });

  return deduped.slice(0, limit);
}

export async function getPriceStatistics(cardId: number, source?: string, grade?: string) {
  // Check in-memory cache first
  const cacheKey = getPriceStatsCacheKey(cardId, source, grade);
  const cached = getFromPriceStatsCache(cacheKey);
  if (cached !== undefined) return cached;

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
    .select({ price: priceHistory.price })
    .from(priceHistory)
    .where(and(...conditions));

  if (prices.length === 0) {
    setPriceStatsCache(cacheKey, null);
    return null;
  }

  const priceValues = prices.map(p => parseFloat(p.price));
  const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);

  const result = {
    avgPrice: avgPrice.toFixed(2),
    minPrice: minPrice.toFixed(2),
    maxPrice: maxPrice.toFixed(2),
    count: prices.length,
  };
  setPriceStatsCache(cacheKey, result);
  return result;
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

export async function getDataSources(options?: { page?: number; pageSize?: number; search?: string; status?: "all" | "success" | "pending" | "failed"; gameId?: number; productType?: "all" | "single_card" | "sealed_product" }) {
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
  if (options?.productType && options.productType !== "all") {
    conditions.push(eq(dataSources.productType, options.productType));
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
      // eBay last updated: most recent priceHistory record with source='ebay' for this card
      ebayLastUpdatedAt: sql<Date | null>`(
        SELECT MAX(ph.createdAt)
        FROM priceHistory ph
        WHERE ph.cardId = ${dataSources.cardId}
          AND ph.source = 'ebay'
      )`,
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

// In-memory cache for sealed product search results (TTL 5 minutes, max 50 entries)
type SealedSearchCacheEntry = { allProducts: any[]; total: number; fetchedAt: number };
const _sealedSearchCache = new Map<string, SealedSearchCacheEntry>();
const SEALED_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEALED_SEARCH_CACHE_MAX = 50;

function getFromSealedSearchCache(key: string): { allProducts: any[]; total: number } | null {
  const entry = _sealedSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SEALED_SEARCH_CACHE_TTL_MS) {
    _sealedSearchCache.delete(key);
    return null;
  }
  return { allProducts: entry.allProducts, total: entry.total };
}

function setFromSealedSearchCache(key: string, allProducts: any[], total: number): void {
  if (_sealedSearchCache.size >= SEALED_SEARCH_CACHE_MAX) {
    const oldestKey = _sealedSearchCache.keys().next().value;
    if (oldestKey) _sealedSearchCache.delete(oldestKey);
  }
  _sealedSearchCache.set(key, { allProducts, total, fetchedAt: Date.now() });
}

/**
 * Search sealed products by name
 */
export async function searchSealedProducts(query: string, limit: number = 20, offset: number = 0) {
  const sealedCacheKey = query.toLowerCase().trim();
  const sealedCached = getFromSealedSearchCache(sealedCacheKey);
  if (sealedCached) {
    return { products: sealedCached.allProducts.slice(offset, offset + limit), total: sealedCached.total };
  }

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

  // Get recent prices for each sealed product (up to 10 per product for weighted avg)
  // LIMIT to prevent scanning too many records (10 records per product is enough)
  const productIds = matchingProducts.map(p => p.id);
  const maxSealedResults = Math.min(productIds.length * 15, 3000);
  const recentPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      quantity: priceHistory.quantity,
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
    .orderBy(desc(priceHistory.soldAt))
    .limit(maxSealedResults);

  // Helper: parse quantity string to number (e.g. "5盒" → 5, "1" → 1)
  const parseQtyForSearch = (q: string | null | undefined): number => {
    if (!q) return 1;
    const n = parseInt(q.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n <= 0 ? 1 : n;
  };

  // Group by productId and compute time-weighted average unit price (14-day half-life, latest 10 records)
  // This matches the reference price calculation on the sealed product detail page.
  const priceMap = new Map<number, number>();
  const recordsByProduct = new Map<number, typeof recentPrices>();
  for (const row of recentPrices) {
    if (!recordsByProduct.has(row.cardId)) recordsByProduct.set(row.cardId, []);
    recordsByProduct.get(row.cardId)!.push(row);
  }
  const now = new Date();
  for (const [productId, records] of Array.from(recordsByProduct.entries())) {
    const top10 = records.slice(0, 10);
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of top10) {
      const unitPrice = Number(r.price) / parseQtyForSearch(r.quantity);
      if (isNaN(unitPrice) || unitPrice <= 0) continue;
      const daysAgo = r.soldAt
        ? (now.getTime() - new Date(r.soldAt).getTime()) / (1000 * 60 * 60 * 24)
        : 30;
      const w = Math.pow(2, -daysAgo / 14); // 14-day half-life
      weightedSum += unitPrice * w;
      totalWeight += w;
    }
    if (totalWeight > 0) {
      priceMap.set(productId, weightedSum / totalWeight);
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

  // Cache ALL results so page 2+ is served from memory without DB query
  setFromSealedSearchCache(sealedCacheKey, productsWithPrice, productsWithPrice.length);
  return {
    products: productsWithPrice.slice(offset, offset + limit),
    total: productsWithPrice.length,
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
  sourcePosition?: number; // Position in source API response (0-based) - allows multiple same-day same-price records
  grade?: string;
  quantity?: string; // For sealed products (e.g., "10盒", "1盒")
  productType?: "single_card" | "sealed_product"; // Product type
  soldAt?: Date;
  listingUrl?: string;
  recordHash?: string; // Pre-computed SHA-256 dedup key (optional, computed here if absent)
  // Relative-time dedup fields (for SNKRDUNK "N時間前" records)
  isRelativeTime?: boolean;    // true if this record came from "N時間前" API response
  estimatedSoldAt?: Date;      // Precise estimated timestamp (crawlTime - N hours)
}) {
  const db = await getDb();
  if (!db) return null;
  const { computeRecordHash } = await import('./utils/recordHash');
  const sourcePosition = data.sourcePosition ?? 0;
  // Compute stable recordHash for idempotent upsert
  const recordHash = data.recordHash ?? computeRecordHash({
    cardId: data.cardId,
    source: data.source,
    grade: data.grade,
    soldAt: data.soldAt,
    jpyPrice: data.jpyPrice,
    sourcePosition,
  });
  // Fast-path: check recordHash first (O(1) index lookup) before inserting
  if (data.source === 'snkrdunk') {
    const existing = await db
      .select({ id: priceHistory.id })
      .from(priceHistory)
      .where(eq(priceHistory.recordHash, recordHash))
      .limit(1);
    if (existing.length > 0) {
      // Already exists — skip insert to avoid duplicate
      return null;
    }
  }

  // Dynamic time-window dedup for relative-time records ("N時間前")
  // These records have an estimated soldAt that shifts each crawl, so we can't rely on
  // the stable hash alone. Instead, check if a record with the same price+grade+sourcePosition
  // already exists within ±1.5 hours of the estimated timestamp.
  if (data.source === 'snkrdunk' && data.isRelativeTime && data.estimatedSoldAt && data.jpyPrice != null) {
    const toleranceMs = 1.5 * 60 * 60 * 1000; // ±1.5 hours
    const windowStart = new Date(data.estimatedSoldAt.getTime() - toleranceMs);
    const windowEnd = new Date(data.estimatedSoldAt.getTime() + toleranceMs);
    const gradeVal = data.grade ?? null;
    const existingInWindow = await db
      .select({ id: priceHistory.id })
      .from(priceHistory)
      .where(
        and(
          eq(priceHistory.cardId, data.cardId),
          eq(priceHistory.source, data.source),
          eq(priceHistory.jpyPrice, data.jpyPrice),
          eq(priceHistory.sourcePosition, sourcePosition),
          gradeVal !== null ? eq(priceHistory.grade, gradeVal) : isNull(priceHistory.grade),
          gte(priceHistory.soldAt, windowStart),
          lte(priceHistory.soldAt, windowEnd)
        )
      )
      .limit(1);
    if (existingInWindow.length > 0) {
      // Same transaction already captured in a previous crawl — skip
      console.log(`[RelativeTimeDedup] Skipping duplicate: cardId=${data.cardId} jpyPrice=${data.jpyPrice} grade=${gradeVal} pos=${sourcePosition} est=${data.estimatedSoldAt.toISOString()}`);
      return null;
    }
  }
  const result = await db.insert(priceHistory).values({
    cardId: data.cardId,
    source: data.source,
    price: data.price,
    currency: data.currency,
    jpyPrice: data.jpyPrice ?? null,
    sourcePosition,
    grade: data.grade,
    quantity: data.quantity,
    productType: data.productType || "single_card", // Default to single_card
    soldAt: data.soldAt,
    listingUrl: data.listingUrl,
    recordHash,
  }).onDuplicateKeyUpdate({
    // Backfill recordHash on legacy rows that were inserted without it
    set: { id: sql`id`, recordHash: sql`VALUES(recordHash)` },
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

  // Two-pass outlier filter (same as getTopVolatileCards):
  //   Pass 1: Compute trimmed median (AVG of middle 50% prices) per card as robust reference
  //   Pass 2: Exclude prices outside [median * 0.3, median * 3.0] before computing daily avg
  // Hard cap: priceChange <= 500% to exclude data-quality outliers.
  const [rows] = await (db as any).execute(sql`
    SELECT
      c.id AS cardId,
      c.name AS cardName,
      c.cardNumber AS cardNumber,
      c.setName AS setName,
      c.imageUrl AS cardImage,
      first_day.avgPrice AS oldestPrice,
      last_day.avgPrice AS latestPrice,
      first_day.currency AS currency,
      ((last_day.avgPrice - first_day.avgPrice) / first_day.avgPrice * 100) AS priceChange
    FROM (
      SELECT ph2.cardId, MIN(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) AS firstDate,
        MAX(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) AS lastDate, ph2.currency
      FROM priceHistory ph2
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref ON ref.refCardId = ph2.cardId AND ref.refCurrency = ph2.currency
      WHERE ph2.source = 'snkrdunk' AND ph2.grade = 'PSA 10' AND ph2.isSuspectedBulk = 0
        AND COALESCE(ph2.soldAt, ph2.createdAt) >= ${cutoffDate}
        AND ph2.price >= ref.trimmedRef * 0.3
        AND ph2.price <= ref.trimmedRef * 3.0
      GROUP BY ph2.cardId, ph2.currency
      HAVING COUNT(DISTINCT DATE(COALESCE(ph2.soldAt, ph2.createdAt))) >= 2
        AND MIN(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) < MAX(DATE(COALESCE(ph2.soldAt, ph2.createdAt)))
    ) ph_range
    JOIN (
      SELECT ph3.cardId, DATE(COALESCE(ph3.soldAt, ph3.createdAt)) AS txDate, AVG(ph3.price) AS avgPrice, ph3.currency
      FROM priceHistory ph3
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked2
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref2 ON ref2.refCardId = ph3.cardId AND ref2.refCurrency = ph3.currency
      WHERE ph3.source = 'snkrdunk' AND ph3.grade = 'PSA 10' AND ph3.isSuspectedBulk = 0
        AND COALESCE(ph3.soldAt, ph3.createdAt) >= ${cutoffDate}
        AND ph3.price >= ref2.trimmedRef * 0.3
        AND ph3.price <= ref2.trimmedRef * 3.0
      GROUP BY ph3.cardId, ph3.currency, txDate
    ) first_day
      ON first_day.cardId = ph_range.cardId AND first_day.txDate = ph_range.firstDate
      AND first_day.currency = ph_range.currency
    JOIN (
      SELECT ph4.cardId, DATE(COALESCE(ph4.soldAt, ph4.createdAt)) AS txDate, AVG(ph4.price) AS avgPrice, ph4.currency
      FROM priceHistory ph4
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked3
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref3 ON ref3.refCardId = ph4.cardId AND ref3.refCurrency = ph4.currency
      WHERE ph4.source = 'snkrdunk' AND ph4.grade = 'PSA 10' AND ph4.isSuspectedBulk = 0
        AND COALESCE(ph4.soldAt, ph4.createdAt) >= ${cutoffDate}
        AND ph4.price >= ref3.trimmedRef * 0.3
        AND ph4.price <= ref3.trimmedRef * 3.0
      GROUP BY ph4.cardId, ph4.currency, txDate
    ) last_day
      ON last_day.cardId = ph_range.cardId AND last_day.txDate = ph_range.lastDate
      AND last_day.currency = ph_range.currency
    JOIN cards c ON c.id = ph_range.cardId
    WHERE first_day.avgPrice > 0
      AND last_day.avgPrice > first_day.avgPrice
      AND ((last_day.avgPrice - first_day.avgPrice) / first_day.avgPrice * 100) <= 500
    ORDER BY priceChange DESC
    LIMIT ${limit}
  `) as [any[], any];

  return (rows || []).map((row: any) => ({
    cardId: Number(row.cardId),
    cardName: String(row.cardName || ''),
    cardNumber: row.cardNumber ? String(row.cardNumber) : undefined,
    setName: row.setName ? String(row.setName) : undefined,
    cardImage: row.cardImage ? String(row.cardImage) : null,
    currency: String(row.currency || 'HKD'),
    oldestPrice: Number(row.oldestPrice),
    latestPrice: Number(row.latestPrice),
    priceChange: Number(row.priceChange),
  }));
}

/**
 * Get top searched cards in the past N days
 */

/**
 * Top Price Losers (biggest price drop)
 */
export async function getTopPriceLosers(days: number = 7, limit: number = 10) {
  const db = await getDb();
  if (!db) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // Same logic as gainers but filter for price drops, with trimmed median outlier filter
  const [rows] = await (db as any).execute(sql`
    SELECT
      c.id AS cardId,
      c.name AS cardName,
      c.cardNumber AS cardNumber,
      c.setName AS setName,
      c.imageUrl AS cardImage,
      first_day.avgPrice AS oldestPrice,
      last_day.avgPrice AS latestPrice,
      first_day.currency AS currency,
      ((last_day.avgPrice - first_day.avgPrice) / first_day.avgPrice * 100) AS priceChange
    FROM (
      SELECT ph2.cardId, MIN(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) AS firstDate,
        MAX(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) AS lastDate, ph2.currency
      FROM priceHistory ph2
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref ON ref.refCardId = ph2.cardId AND ref.refCurrency = ph2.currency
      WHERE ph2.source = 'snkrdunk' AND ph2.grade = 'PSA 10' AND ph2.isSuspectedBulk = 0
        AND COALESCE(ph2.soldAt, ph2.createdAt) >= ${cutoffDate}
        AND ph2.price >= ref.trimmedRef * 0.3
        AND ph2.price <= ref.trimmedRef * 3.0
      GROUP BY ph2.cardId, ph2.currency
      HAVING COUNT(DISTINCT DATE(COALESCE(ph2.soldAt, ph2.createdAt))) >= 2
        AND MIN(DATE(COALESCE(ph2.soldAt, ph2.createdAt))) < MAX(DATE(COALESCE(ph2.soldAt, ph2.createdAt)))
    ) ph_range
    JOIN (
      SELECT ph3.cardId, DATE(COALESCE(ph3.soldAt, ph3.createdAt)) AS txDate, AVG(ph3.price) AS avgPrice, ph3.currency
      FROM priceHistory ph3
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked2
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref2 ON ref2.refCardId = ph3.cardId AND ref2.refCurrency = ph3.currency
      WHERE ph3.source = 'snkrdunk' AND ph3.grade = 'PSA 10' AND ph3.isSuspectedBulk = 0
        AND COALESCE(ph3.soldAt, ph3.createdAt) >= ${cutoffDate}
        AND ph3.price >= ref2.trimmedRef * 0.3
        AND ph3.price <= ref2.trimmedRef * 3.0
      GROUP BY ph3.cardId, ph3.currency, txDate
    ) first_day
      ON first_day.cardId = ph_range.cardId AND first_day.txDate = ph_range.firstDate
      AND first_day.currency = ph_range.currency
    JOIN (
      SELECT ph4.cardId, DATE(COALESCE(ph4.soldAt, ph4.createdAt)) AS txDate, AVG(ph4.price) AS avgPrice, ph4.currency
      FROM priceHistory ph4
      JOIN (
        SELECT cardId AS refCardId, currency AS refCurrency, AVG(price) AS trimmedRef
        FROM (
          SELECT cardId, currency, price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk' AND grade = 'PSA 10' AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked3
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref3 ON ref3.refCardId = ph4.cardId AND ref3.refCurrency = ph4.currency
      WHERE ph4.source = 'snkrdunk' AND ph4.grade = 'PSA 10' AND ph4.isSuspectedBulk = 0
        AND COALESCE(ph4.soldAt, ph4.createdAt) >= ${cutoffDate}
        AND ph4.price >= ref3.trimmedRef * 0.3
        AND ph4.price <= ref3.trimmedRef * 3.0
      GROUP BY ph4.cardId, ph4.currency, txDate
    ) last_day
      ON last_day.cardId = ph_range.cardId AND last_day.txDate = ph_range.lastDate
      AND last_day.currency = ph_range.currency
    JOIN cards c ON c.id = ph_range.cardId
    WHERE first_day.avgPrice > 0
      AND last_day.avgPrice < first_day.avgPrice
    ORDER BY priceChange ASC
    LIMIT ${limit}
  `) as [any[], any];

  return (rows || []).map((row: any) => ({
    cardId: Number(row.cardId),
    cardName: String(row.cardName || ''),
    cardNumber: row.cardNumber ? String(row.cardNumber) : undefined,
    setName: row.setName ? String(row.setName) : undefined,
    cardImage: row.cardImage ? String(row.cardImage) : null,
    currency: String(row.currency || 'HKD'),
    oldestPrice: Number(row.oldestPrice),
    latestPrice: Number(row.latestPrice),
    priceChange: Number(row.priceChange),
  }));
}

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

  // Volatility = STDDEV(price) / AVG(price) * 100 (Coefficient of Variation)
  // Two-pass outlier filter:
  //   Pass 1: Compute trimmed median (AVG of middle 50% prices) as robust reference
  //   Pass 2: Exclude prices outside [median * 0.3, median * 3.0] before computing STDDEV
  // This prevents a single anomalous record (e.g. HKD 13,750 vs normal HKD 700-900)
  // from inflating the reference average and bypassing the filter.
  const [rows] = await (db as any).execute(sql`
    SELECT
      base.cardId,
      c.name AS cardName,
      c.imageUrl AS cardImage,
      base.avgPrice,
      base.currency,
      base.volatility,
      base.txCount
    FROM (
      SELECT
        ph.cardId,
        ph.currency,
        AVG(ph.price) AS avgPrice,
        (STDDEV(ph.price) / AVG(ph.price) * 100) AS volatility,
        COUNT(*) AS txCount
      FROM priceHistory ph
      JOIN (
        -- Compute trimmed reference: AVG of prices between 25th and 75th percentile
        -- Using MIN+MAX of the inner 50% as a robust central estimate
        SELECT
          cardId,
          currency,
          AVG(price) AS trimmedRef
        FROM (
          SELECT
            cardId,
            currency,
            price,
            PERCENT_RANK() OVER (PARTITION BY cardId, currency ORDER BY price) AS prank
          FROM priceHistory
          WHERE source = 'snkrdunk'
            AND grade = 'PSA 10'
            AND isSuspectedBulk = 0
            AND COALESCE(soldAt, createdAt) >= ${cutoffDate}
        ) ranked
        WHERE prank BETWEEN 0.25 AND 0.75
        GROUP BY cardId, currency
      ) ref ON ref.cardId = ph.cardId AND ref.currency = ph.currency
      WHERE ph.source = 'snkrdunk'
        AND ph.grade = 'PSA 10'
        AND ph.isSuspectedBulk = 0
        AND COALESCE(ph.soldAt, ph.createdAt) >= ${cutoffDate}
        -- Exclude prices outside 30%~300% of the trimmed median
        AND ph.price >= ref.trimmedRef * 0.3
        AND ph.price <= ref.trimmedRef * 3.0
      GROUP BY ph.cardId, ph.currency
      HAVING COUNT(*) >= 5
        AND AVG(ph.price) > 0
        AND (STDDEV(ph.price) / AVG(ph.price) * 100) <= 200
    ) base
    JOIN cards c ON c.id = base.cardId
    ORDER BY base.volatility DESC
    LIMIT ${limit}
  `) as [any[], any];

  return (rows || []).map((row: any) => ({
    cardId: Number(row.cardId),
    cardName: String(row.cardName || ''),
    cardImage: row.cardImage ? String(row.cardImage) : null,
    currency: String(row.currency || 'HKD'),
    minPrice: 0,
    maxPrice: 0,
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
  snkrdunkUpdateMode?: string;
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

  // Fetch PSA10 SNKRDUNK records for the last 14 days — include gameId for per-game ranking
  const cardsWithPrices = await db
    .select({
      cardId: priceHistory.cardId,
      price: priceHistory.price,
      soldAt: priceHistory.soldAt,
      gameId: cards.gameId,
    })
    .from(priceHistory)
    .innerJoin(cards, eq(priceHistory.cardId, cards.id))
    .where(
      and(
        eq(priceHistory.source, "snkrdunk"),
        eq(priceHistory.grade, 'PSA 10'),
        gte(priceHistory.soldAt, fourteenDaysAgo),
        sql`${priceHistory.soldAt} IS NOT NULL`,
        eq(priceHistory.isSuspectedBulk, false)
      )
    )
    .orderBy(priceHistory.cardId, priceHistory.soldAt);

  console.log(`[calculateAndCacheTrendingCards] Found ${cardsWithPrices.length} PSA10 records in last 14 days`);

  // Group by cardId, split into this-week and last-week buckets, also track gameId per card
  const thisWeekMap  = new Map<number, { price: number; date: Date }[]>();
  const lastWeekMap  = new Map<number, { price: number; date: Date }[]>();
  const cardGameMap  = new Map<number, number>(); // cardId -> gameId

  for (const record of cardsWithPrices) {
    const cardId = record.cardId;
    const price  = parseFloat(record.price as any);
    const date   = record.soldAt!;

    cardGameMap.set(cardId, record.gameId ?? 1);

    if (date >= sevenDaysAgo) {
      if (!thisWeekMap.has(cardId)) thisWeekMap.set(cardId, []);
      thisWeekMap.get(cardId)!.push({ price, date });
    } else {
      if (!lastWeekMap.has(cardId)) lastWeekMap.set(cardId, []);
      lastWeekMap.get(cardId)!.push({ price, date });
    }
  }

  const HALF_LIFE_DAYS = 7; // Shorter half-life for weekly comparison
  // Per-game minimum records: Yu-Gi-Oh (gameId=3) has fewer SNKRDUNK transactions, use lower threshold
  const MIN_RECORDS_DEFAULT = 3;
  const MIN_RECORDS_YUGIOH  = 1;

  const trendingCards: Array<{
    cardId: number;
    gameId: number;
    priceChange: number;
    oldPrice: number;     // last-week weighted avg
    currentPrice: number; // this-week weighted avg
  }> = [];

  for (const [cardId, thisWeekRecords] of Array.from(thisWeekMap.entries())) {
    const lastWeekRecords = lastWeekMap.get(cardId) ?? [];
    const cardGameId = cardGameMap.get(cardId) ?? 1;
    const MIN_RECORDS = cardGameId === 3 ? MIN_RECORDS_YUGIOH : MIN_RECORDS_DEFAULT;
    // This-week window must have enough records
    if (thisWeekRecords.length < MIN_RECORDS) {
      console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: Only ${thisWeekRecords.length} this-week record(s), skipping`);
      continue;
    }
    const thisWeekAvg = weightedAvgTrending(thisWeekRecords, now, HALF_LIFE_DAYS);
    if (thisWeekAvg === null) continue;
    // For Yu-Gi-Oh (gameId=3): allow cards with no last-week records (use this-week only)
    // For other games: both windows must have enough records
    if (cardGameId !== 3 && lastWeekRecords.length < MIN_RECORDS) {
      console.log(`[calculateAndCacheTrendingCards] Card ${cardId}: Only ${lastWeekRecords.length} last-week record(s), skipping`);
      continue;
    }
    const lastWeekAvg = lastWeekRecords.length >= MIN_RECORDS
      ? weightedAvgTrending(lastWeekRecords, now, HALF_LIFE_DAYS)
      : null;
    let priceChange: number;
    let oldPrice: number;
    if (lastWeekAvg !== null && lastWeekAvg > 0) {
      // Normal case: compare this week vs last week
      priceChange = ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
      oldPrice = lastWeekAvg;
    } else {
      // Yu-Gi-Oh fallback: no last-week data, treat as newly active card with small positive change
      priceChange = 5.0; // Nominal +5% to indicate recent activity
      oldPrice = thisWeekAvg;
    }
    console.log(
      `[calculateAndCacheTrendingCards] Card ${cardId} (gameId=${cardGameMap.get(cardId)}): ` +
      `lastWeek=${lastWeekAvg?.toFixed(2) ?? 'N/A'}, thisWeek=${thisWeekAvg.toFixed(2)}, ` +
      `change=${priceChange.toFixed(2)}% ` +
      `(${lastWeekRecords.length} last-week / ${thisWeekRecords.length} this-week records)`
    );
    if (priceChange > 0) {
      trendingCards.push({
        cardId,
        gameId: cardGameMap.get(cardId) ?? 1,
        priceChange,
        oldPrice,
        currentPrice: thisWeekAvg,
      });
    }
  }

  // Sort by price change (highest first), then take Top 5 PER GAME
  trendingCards.sort((a, b) => b.priceChange - a.priceChange);

  // Group by gameId and take top 5 each
  const byGame = new Map<number, typeof trendingCards>();
  for (const card of trendingCards) {
    if (!byGame.has(card.gameId)) byGame.set(card.gameId, []);
    const list = byGame.get(card.gameId)!;
    if (list.length < 5) list.push(card);
  }

  // Flatten: all per-game top-5 lists into one array to insert
  const allTop: typeof trendingCards = [];
  for (const [, list] of Array.from(byGame.entries())) {
    allTop.push(...list);
  }

  console.log(`[calculateAndCacheTrendingCards] Found ${trendingCards.length} eligible cards, storing ${allTop.length} (top 5 per game)`);
  for (const [gid, list] of Array.from(byGame.entries())) {
    if (list.length > 0) {
      console.log(`[calculateAndCacheTrendingCards] Game ${gid} top card: cardId=${list[0].cardId}, change=${list[0].priceChange.toFixed(2)}%`);
    }
  }

  // ── Calculate PSA10 reference price (latest-5 median) for each top card ──────
  // This matches the CardDetail page calculation for consistency.
  const allTopCardIds = allTop.map(c => c.cardId);

  // Fetch all PSA10 records for these cards (no date limit, ordered newest first)
  const refPriceRecords = await db
    .select({ cardId: priceHistory.cardId, price: priceHistory.price })
    .from(priceHistory)
    .where(
      and(
        inArray(priceHistory.cardId, allTopCardIds),
        eq(priceHistory.source, 'snkrdunk'),
        eq(priceHistory.grade, 'PSA 10'),
        eq(priceHistory.isSuspectedBulk, false),
        sql`${priceHistory.soldAt} IS NOT NULL`
      )
    )
    .orderBy(desc(priceHistory.soldAt));

  // Group by cardId (already newest-first)
  const refPricesByCard = new Map<number, number[]>();
  for (const rec of refPriceRecords) {
    const cid = rec.cardId;
    if (!refPricesByCard.has(cid)) refPricesByCard.set(cid, []);
    refPricesByCard.get(cid)!.push(parseFloat(rec.price as any));
  }

  // Helper: simple median
  const simpleMedianDb = (prices: number[]): number => {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  // Build a map: cardId -> PSA10 latest-5 median (reference price)
  const refPriceMap = new Map<number, number>();
  for (const cardId of allTopCardIds) {
    const allPrices = refPricesByCard.get(cardId) ?? [];
    if (allPrices.length === 0) {
      // Fallback to weighted avg if no price records found
      const card = allTop.find(c => c.cardId === cardId);
      if (card) refPriceMap.set(cardId, card.currentPrice);
      continue;
    }
    const usePrices = allPrices.slice(0, Math.min(5, allPrices.length));
    refPriceMap.set(cardId, simpleMedianDb(usePrices));
  }

  console.log(`[calculateAndCacheTrendingCards] Calculated PSA10 reference prices for ${refPriceMap.size} cards`);

  // Clear existing cache
  await db.delete(trendingCardsCache);

  // Insert new cache — rank is per-game (1-5 within each gameId)
  // currentPrice stores the PSA10 latest-5 median (reference price), matching CardDetail page
  // oldPrice stores the last-week weighted avg (used for priceChange calculation)
  const calculatedAt = new Date();
  for (const [, list] of Array.from(byGame.entries())) {
    for (let i = 0; i < list.length; i++) {
      const card = list[i];
      const referencePrice = refPriceMap.get(card.cardId) ?? card.currentPrice;
      await db.insert(trendingCardsCache).values({
        cardId: card.cardId,
        rank: i + 1,
        priceChange7d: card.priceChange.toFixed(2),
        oldPrice: card.oldPrice.toFixed(2),
        currentPrice: referencePrice.toFixed(2), // PSA10 latest-5 median
        calculatedAt,
      });
    }
  }

  console.log("[calculateAndCacheTrendingCards] Cache updated successfully (per-game top 5, currentPrice = PSA10 latest-5 median)");
  // Invalidate in-memory cache so next request fetches fresh data from DB
  invalidateTrendingCache();
}

/**
 * Get cached trending cards (TOP 5)
 */
export async function getCachedTrendingCards(gameId?: number) {
  const cacheKey = gameId !== undefined ? `game_${gameId}` : 'all';
  const now = Date.now();

  // Return in-memory cache if still fresh (TTL: 30 minutes)
  const memCached = _trendingCache.get(cacheKey);
  if (memCached && now - memCached.fetchedAt < TRENDING_CACHE_TTL_MS) {
    return memCached.data;
  }

  const db = await getDb();
  if (!db) {
    return memCached?.data ?? []; // Return stale cache on DB failure
  }

  const rows = await db
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
      gameId: cards.gameId,
    })
    .from(trendingCardsCache)
    .leftJoin(cards, eq(trendingCardsCache.cardId, cards.id))
    .where(gameId !== undefined ? eq(cards.gameId, gameId) : undefined)
    .orderBy(trendingCardsCache.rank);

  const result: TrendingCardResult[] = rows.map(item => ({
    id: item.cardId,
    name: item.name,
    nameJa: item.nameJa,
    imageUrl: item.imageUrl,
    cardNumber: item.cardNumber,
    series: item.series,
    rank: item.rank,
    gameId: item.gameId,
    priceChange7d: parseFloat(item.priceChange7d as any),
    oldPrice: parseFloat(item.oldPrice as any),
    currentPrice: parseFloat(item.currentPrice as any),
    calculatedAt: item.calculatedAt,
    // Format for display
    priceChange: parseFloat(item.priceChange7d as any),
    priceChangeFormatted: `+${parseFloat(item.priceChange7d as any).toFixed(1)}%`,
  }));

  // Store in memory cache
  _trendingCache.set(cacheKey, { data: result, fetchedAt: now });
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
        eq(priceHistory.grade, 'PSA 10')
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
        eq(priceHistory.grade, 'PSA 10')
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
        eq(priceHistory.grade, 'PSA 10'),
        eq(priceHistory.isSuspectedBulk, false)
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
        eq(priceHistory.grade, 'PSA 10')
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
      setName: cards.setName,
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
  const { snkrdunkListingsCache, snkrdunkGradeIndex } = await import("../drizzle/schema_new");
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
  // ── Sync snkrdunkGradeIndex (normalized grade index for fast search) ─────────
  // Parse listings and compute minPrice per grade, then upsert into the index table.
  // This allows searchCardsByGrade to use SQL instead of full-table JSON scan.
  try {
    const listings: Array<{ price: number; currency: string; grade: string; status?: string }> =
      typeof data.listings === 'string' ? JSON.parse(data.listings) : data.listings;
    // Delete existing grade index rows for this card
    await db.delete(snkrdunkGradeIndex).where(eq(snkrdunkGradeIndex.cardId, data.cardId));
    // Compute minPrice + count per grade (on-sale only)
    const gradeMap = new Map<string, { minPrice: number; count: number }>();
    for (const item of listings) {
      if (item.status && item.status !== 'on-sale') continue;
      if (!item.grade || typeof item.price !== 'number') continue;
      const existing = gradeMap.get(item.grade);
      if (!existing) {
        gradeMap.set(item.grade, { minPrice: item.price, count: 1 });
      } else {
        existing.count++;
        if (item.price < existing.minPrice) existing.minPrice = item.price;
      }
    }
    // Insert new grade index rows
    if (gradeMap.size > 0) {
      const rows = Array.from(gradeMap.entries()).map(([grade, { minPrice, count }]) => ({
        cardId: data.cardId,
        grade,
        minPrice: minPrice.toString(),
        listingCount: count,
      }));
      await db.insert(snkrdunkGradeIndex).values(rows);
    }
  } catch (err) {
    // Non-fatal: grade index sync failure should not break the main cache save
    console.warn(`[GradeIndex] Failed to sync grade index for cardId=${data.cardId}:`, err);
  }
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
  if (!db) return { total: 0, success: 0, pending: 0, failed: 0, singleCard: 0, sealedProduct: 0 };

  try {
    const result = await db
      .select({
        status: dataSources.lastFetchStatus,
        productType: dataSources.productType,
        count: sql<number>`count(*)`,
      })
      .from(dataSources)
      .groupBy(dataSources.lastFetchStatus, dataSources.productType);

    const stats = {
      total: 0,
      success: 0,
      pending: 0,
      failed: 0,
      singleCard: 0,
      sealedProduct: 0,
    };

    for (const row of result) {
      const count = Number(row.count);
      stats.total += count;
      
      if (row.status === "success") {
        stats.success += count;
      } else if (row.status === "pending") {
        stats.pending += count;
      } else if (row.status === "failed") {
        stats.failed += count;
      }

      if (row.productType === "single_card") {
        stats.singleCard += count;
      } else if (row.productType === "sealed_product") {
        stats.sealedProduct += count;
      }
    }

    return stats;
  } catch (error) {
    console.error("[Database] Failed to get data source stats:", error);
    return { total: 0, success: 0, pending: 0, failed: 0, singleCard: 0, sealedProduct: 0 };
  }
}

/**
 * Get all data source IDs that match the filter criteria
 */
export async function getAllFilteredDataSourceIds(options?: { search?: string; status?: "all" | "success" | "pending" | "failed"; gameId?: number; productType?: "all" | "single_card" | "sealed_product" }) {
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
  if (options?.productType && options.productType !== "all") {
    conditions.push(eq(dataSources.productType, options.productType));
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
  const now = Date.now();
  if (_statsCachePriceCount !== null && now < _statsCachePriceCountExpiry) {
    return _statsCachePriceCount;
  }
  const db = await getDb();
  if (!db) return _statsCachePriceCount ?? 0;
  try {
    // Use information_schema.TABLES for fast approximate count (~220ms vs ~767ms for COUNT(*))
    // TiDB keeps table row estimates up-to-date; accuracy is sufficient for display
    const result = await db.execute(sql`SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'priceHistory'`) as any;
    const rows = result[0] as Array<{ TABLE_ROWS: number }>;
    _statsCachePriceCount = rows[0]?.TABLE_ROWS || 0;
    _statsCachePriceCountExpiry = now + STATS_CACHE_TTL_MS;
    return _statsCachePriceCount;
  } catch (error) {
    console.error("[Database] Failed to get total price record count:", error);
    return _statsCachePriceCount ?? 0;
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
  cartOrders,
  InsertSellerProfile, InsertMarketplaceListing, InsertMarketplaceOrder,
  InsertMarketplaceOrderItem, InsertMarketplacePayout,
  InsertMarketplaceBanner, InsertWishlist, InsertMarketplaceReview,
  type InsertUserShippingAddress, type InsertOffer, type InsertListingReport,
  type InsertCartOrder, type CartOrder,
  type SellerProfile
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
      isSuspended: sellerProfiles.isSuspended,
      suspensionReason: sellerProfiles.suspensionReason,
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
  // Exclude auction listings — they are managed separately in the Auction page
  const conditions = [
    eq(marketplaceListings.status, 'active'),
    ne(marketplaceListings.listingMode, 'auction')
  ];
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
    remainingQuantity: marketplaceListings.remainingQuantity,
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
  // Exclude auction listings from series counts
  const seriesCountRows = await db.select({
    series: marketplaceListings.tcgSeries,
    count: sql<number>`count(*)`
  }).from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.status, 'active'),
      ne(marketplaceListings.listingMode, 'auction')
    ))
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
    remainingQuantity: r.remainingQuantity,
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
 * Check stock availability without locking (first-come-first-served).
 * Returns true if stock is available, false if insufficient stock.
 * Products are NOT locked until payment is confirmed (claimListingAsSold).
 * Only disputes trigger a 'reserved' lock (handled separately by admin).
 */
export async function reserveListingStock(listingId: number, quantity: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Just check availability — do NOT change status or deduct quantity here.
  // Stock is only deducted atomically when payment succeeds (claimListingAsSold).
  const rows = await db
    .select({ qty: marketplaceListings.quantity })
    .from(marketplaceListings)
    .where(
      and(
        eq(marketplaceListings.id, listingId),
        eq(marketplaceListings.status, 'active'),
        gte(marketplaceListings.quantity, quantity)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Atomically claim a listing as sold on payment success (first-pay-first-served).
 * Returns true if this caller was first to claim (stock decremented and status set to 'sold').
 * Returns false if another payment already claimed the stock (oversell protection).
 * Only accepts 'active' status (no 'reserved' for normal purchases).
 */
export async function claimListingAsSold(listingId: number, quantity: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(
    sql`UPDATE marketplaceListings
        SET quantity = quantity - ${quantity},
            remainingQuantity = remainingQuantity - ${quantity},
            status = 'sold',
            updatedAt = NOW()
        WHERE id = ${listingId}
          AND status = 'active'
          AND quantity >= ${quantity}`
  );
  const affectedRows = (result as any)?.[0]?.affectedRows ?? (result as any)?.affectedRows ?? 0;
  return affectedRows > 0;
}

/**
 * Restore listing stock after order cancellation / payment timeout.
 * Re-activates the listing if it was marked as sold.
 * Note: Since normal purchases don't lock stock, this is only needed when payment fails.
 */
export async function restoreListingStock(listingId: number, quantity: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.execute(
    sql`UPDATE marketplaceListings
        SET quantity = quantity + ${quantity},
            remainingQuantity = remainingQuantity + ${quantity},
            status = CASE WHEN status IN ('sold', 'reserved') THEN 'active' ELSE status END,
            updatedAt = NOW()
        WHERE id = ${listingId}`
  );
}

export async function getAdminListings(page = 1, pageSize = 20, status?: string, tcgSeries?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  // Exclude auction listings — they are managed separately in the Auction Admin tab
  const conditions: any[] = [ne(marketplaceListings.listingMode, 'auction')];
  if (status) conditions.push(eq(marketplaceListings.status, status as any));
  if (tcgSeries) conditions.push(eq(marketplaceListings.tcgSeries, tcgSeries as any));
  const rows = await db.select().from(marketplaceListings)
    .where(and(...conditions))
    .orderBy(desc(marketplaceListings.createdAt)).limit(pageSize).offset(offset);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings)
    .where(and(...conditions));
  return { listings: rows, total: Number(countRows[0]?.count ?? 0) };
}
export async function getSellerListings(sellerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Exclude auction listings — they are managed separately in the 我的拍賣 tab
  return db.select().from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.sellerId, sellerId),
      ne(marketplaceListings.listingMode, 'auction')
    ))
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
  const sellerUsersAlias = alias(users, 'seller_user');
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
    paidAt: marketplaceOrders.paidAt,
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
    alipayProofStatus: marketplaceOrders.alipayProofStatus,
    alipayProofSubmittedAt: marketplaceOrders.alipayProofSubmittedAt,
    paymentRejectionReason: marketplaceOrders.paymentRejectionReason,
    buyerPhone: marketplaceOrders.buyerPhone,
    batchRef: marketplaceOrders.batchRef,
    cartOrderId: marketplaceOrders.cartOrderId,
    shippingImageUrl: marketplaceOrders.shippingImageUrl,
    createdAt: marketplaceOrders.createdAt,
    updatedAt: marketplaceOrders.updatedAt,
    // Listing info for display
    listingTitle: marketplaceListings.title,
    listingImages: marketplaceListings.images,
    listingCondition: marketplaceListings.condition,
    // Seller contact info (for meetup orders)
    sellerUserPhone: sellerUsersAlias.phone,
    sellerDisplayName: sellerProfiles.displayName,
  })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
    .leftJoin(sellerUsersAlias, eq(sellerProfiles.userId, sellerUsersAlias.id))
    .where(eq(marketplaceOrders.buyerId, buyerId))
    .orderBy(desc(marketplaceOrders.createdAt));
  return rows;
}
export async function getAdminOrders(page = 1, pageSize = 20, status?: string, sellerType?: string, dateFrom?: string, dateTo?: string, payoutFilter?: string, listingId?: number, proofStatus?: string, shippingMethod?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const offset = (page - 1) * pageSize;
  // If no status filter, show all orders including pending_payment so admin can see all orders
  // Special status 'paid' = all paid order statuses (payment_received/processing/shipped/delivered/completed)
  const PAID_STATUSES = ['payment_received', 'processing', 'shipped', 'delivered', 'completed'] as const;
  const conditions: any[] = status
    ? status === 'paid'
      ? [inArray(marketplaceOrders.orderStatus, PAID_STATUSES)]
      : [eq(marketplaceOrders.orderStatus, status as any)]
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
    // Exclude already paid AND not_applicable (platform orders that don't need payout)
    conditions.push(sql`${marketplaceOrders.payoutStatus} NOT IN ('paid', 'not_applicable')`);
  }
  // Optional listingId filter
  if (listingId) {
    conditions.push(eq(marketplaceOrders.listingId, listingId));
  }
  // Optional proofStatus filter: 'pending_review' | 'approved' | 'rejected'
  if (proofStatus) {
    conditions.push(eq(marketplaceOrders.alipayProofStatus, proofStatus as any));
  }
  // Optional shippingMethod filter: 'sf_express' | 'hk_post'
  if (shippingMethod) {
    conditions.push(eq(marketplaceOrders.shippingMethod, shippingMethod as any));
  }
  // Exclude auction orders — auctions have their own order management in the Auction Admin tab
  // This join-based filter ensures only direct-purchase (non-auction) orders appear here
  conditions.push(sql`${marketplaceOrders.listingId} NOT IN (
    SELECT id FROM marketplaceListings WHERE listingMode = 'auction'
  )`);
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
    shippingImageUrl: marketplaceOrders.shippingImageUrl,
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
    paidAt: marketplaceOrders.paidAt,
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
    sellerName: sql<string>`COALESCE(${sellerProfiles.displayName}, ${sellerAlias.name}, '平台自有商品')`,
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
    alipayProofStatus: marketplaceOrders.alipayProofStatus,
    alipayProofSubmittedAt: marketplaceOrders.alipayProofSubmittedAt,
    paymentRejectionReason: marketplaceOrders.paymentRejectionReason,
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
    buyerPhone: marketplaceOrders.buyerPhone,
    shippingImageUrl: marketplaceOrders.shippingImageUrl,
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
     buyerPhone: marketplaceOrders.buyerPhone,
    shippingImageUrl: marketplaceOrders.shippingImageUrl,
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
  // pendingReviewListings: governance mode - no pending_review, always 0
  const pendingReview = { count: 0 };
  // pendingAuctionReview: high-value auctions flagged for monitoring (isHighValueReview)
  const [pendingAuctionReview] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceListings).where(and(eq(marketplaceListings.listingMode as any, 'auction'), eq(marketplaceListings.isHighValueReview as any, true), eq(marketplaceListings.status, 'active')));
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
  // Alipay proof review stats
  const [pendingProofCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.alipayProofStatus, 'pending_review'),
      sql`${marketplaceOrders.alipayProofSubmittedAt} IS NOT NULL`
    ));
  const todayStartMs = new Date(); todayStartMs.setHours(0, 0, 0, 0);
  const [todayRejectedProofCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.alipayProofStatus, 'rejected'),
      sql`${marketplaceOrders.alipayProofSubmittedAt} >= ${todayStartMs.getTime()}`
    ));
  const fortyEightHoursAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const [overdueProofCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.alipayProofStatus, 'pending_review'),
      sql`${marketplaceOrders.alipayProofSubmittedAt} IS NOT NULL`,
      sql`${marketplaceOrders.alipayProofSubmittedAt} < ${fortyEightHoursAgoMs}`
    ));
  return {
    activeListings: Number(listingCount?.count ?? 0),
    totalOrders: Number(orderCount?.count ?? 0),
    pendingPaymentCount: Number(pendingPaymentCount?.count ?? 0),
    pendingAlipayConfirmation: Number(pendingAlipay?.count ?? 0),
    activeSellerCount: Number(sellerCount?.count ?? 0),
    pendingReviewListings: Number(pendingReview?.count ?? 0),
    pendingAuctionReview: Number(pendingAuctionReview?.count ?? 0),
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
    pendingProofCount: Number(pendingProofCount?.count ?? 0),
    todayRejectedProofCount: Number(todayRejectedProofCount?.count ?? 0),
    overdueProofCount: Number(overdueProofCount?.count ?? 0),
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
  // drizzle mysql2 doesn't auto-convert boolean to 0/1 on INSERT; do it manually
  const insertData = { ...data, isActive: data.isActive ? 1 : 0 } as any;
  await db.insert(marketplaceBanners).values(insertData);
}

export async function updateBanner(id: number, data: Partial<InsertMarketplaceBanner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // drizzle mysql2 doesn't auto-convert boolean to 0/1 on UPDATE; do it manually
  const updateData: any = { ...data, updatedAt: new Date() };
  if (typeof updateData.isActive === 'boolean') {
    updateData.isActive = updateData.isActive ? 1 : 0;
  }
  await db.update(marketplaceBanners).set(updateData).where(eq(marketplaceBanners.id, id));
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
  // UX2: Mask buyer name for anonymous reviews
  const reviews = rows.map(r => ({
    ...r,
    buyerName: r.review.isAnonymous ? '匿名買家' : r.buyerName,
  }));
  return { reviews, total: Number(countRows[0]?.count ?? 0) };
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
  const refundCancelStatuses = ['refunded', 'cancelled'];

  // Import gradingSubmissions for PSA grading revenue
  const { gradingSubmissions } = await import("../drizzle/schema_new");
  // Include all statuses where payment has been confirmed (after pending_review/awaiting_payment)
  const gradingPaidStatuses = ['pending_shipment', 'received', 'submitted_to_psa', 'grading', 'graded', 'paid', 'returned', 'completed'];

  // Monthly breakdown: group by year-month (paid orders)
  const monthlyRows = await db.select({
    yearMonth: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    totalSales: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
    orderCount: sql<number>`count(*)`,
    stripeCount: sql<number>`SUM(CASE WHEN paymentMethod = 'stripe' THEN 1 ELSE 0 END)`,
    alipayCount: sql<number>`SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN 1 ELSE 0 END)`,
    platformSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerFees: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    // Auction breakdown
    auctionSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' THEN subtotalHkd ELSE 0 END), 0)`,
    auctionCount: sql<number>`SUM(CASE WHEN orderSource = 'auction' THEN 1 ELSE 0 END)`,
    auctionPlatformSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' AND sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    auctionSellerFees: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' AND sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    directSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource != 'auction' THEN subtotalHkd ELSE 0 END), 0)`,
    directCount: sql<number>`SUM(CASE WHEN orderSource != 'auction' THEN 1 ELSE 0 END)`,
  })
    .from(marketplaceOrders)
    .where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`)
    .limit(months);

  // Monthly refund/cancel stats
  const monthlyRefundRows = await db.select({
    yearMonth: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    refundedCount: sql<number>`SUM(CASE WHEN orderStatus = 'refunded' THEN 1 ELSE 0 END)`,
    cancelledCount: sql<number>`SUM(CASE WHEN orderStatus = 'cancelled' THEN 1 ELSE 0 END)`,
    refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN orderStatus = 'refunded' THEN subtotalHkd ELSE 0 END), 0)`,
  })
    .from(marketplaceOrders)
    .where(inArray(marketplaceOrders.orderStatus, refundCancelStatuses as any[]))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`);

  // Build refund map keyed by yearMonth
  const refundMap = new Map<string, { refundedCount: number; cancelledCount: number; refundedAmountHkd: number }>();
  for (const r of monthlyRefundRows) {
    if (r.yearMonth) {
      refundMap.set(r.yearMonth, {
        refundedCount: Number(r.refundedCount ?? 0),
        cancelledCount: Number(r.cancelledCount ?? 0),
        refundedAmountHkd: parseFloat(r.refundedAmount ?? '0'),
      });
    }
  }

  // Overall totals (paid)
  const [overall] = await db.select({
    totalSales: sql<string>`COALESCE(SUM(subtotalHkd), 0)`,
    totalFees: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    totalOrders: sql<number>`count(*)`,
    platformSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerSales: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN subtotalHkd ELSE 0 END), 0)`,
    sellerReceivable: sql<string>`COALESCE(SUM(CASE WHEN sellerType = 'seller' THEN sellerReceivableHkd ELSE 0 END), 0)`,
    stripeCount: sql<number>`SUM(CASE WHEN paymentMethod = 'stripe' THEN 1 ELSE 0 END)`,
    alipayCount: sql<number>`SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN 1 ELSE 0 END)`,
    stripeSales: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'stripe' THEN subtotalHkd ELSE 0 END), 0)`,
    alipaySales: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN subtotalHkd ELSE 0 END), 0)`,
    stripePlatformSales: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'stripe' AND sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    alipayPlatformSales: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'alipay_hk' AND sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    stripeSellerFees: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'stripe' AND sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    alipaySellerFees: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'alipay_hk' AND sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    // Auction breakdown
    auctionSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' THEN subtotalHkd ELSE 0 END), 0)`,
    auctionCount: sql<number>`SUM(CASE WHEN orderSource = 'auction' THEN 1 ELSE 0 END)`,
    auctionPlatformSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' AND sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    auctionSellerSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' AND sellerType = 'seller' THEN subtotalHkd ELSE 0 END), 0)`,
    auctionSellerFees: sql<string>`COALESCE(SUM(CASE WHEN orderSource = 'auction' AND sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
    directSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource != 'auction' THEN subtotalHkd ELSE 0 END), 0)`,
    directCount: sql<number>`SUM(CASE WHEN orderSource != 'auction' THEN 1 ELSE 0 END)`,
    directPlatformSales: sql<string>`COALESCE(SUM(CASE WHEN orderSource != 'auction' AND sellerType = 'platform' THEN subtotalHkd ELSE 0 END), 0)`,
    directSellerFees: sql<string>`COALESCE(SUM(CASE WHEN orderSource != 'auction' AND sellerType = 'seller' THEN platformFeeHkd ELSE 0 END), 0)`,
  }).from(marketplaceOrders).where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]));

  // Overall refund/cancel totals
  const [overallRefund] = await db.select({
    refundedCount: sql<number>`SUM(CASE WHEN orderStatus = 'refunded' THEN 1 ELSE 0 END)`,
    cancelledCount: sql<number>`SUM(CASE WHEN orderStatus = 'cancelled' THEN 1 ELSE 0 END)`,
    refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN orderStatus = 'refunded' THEN subtotalHkd ELSE 0 END), 0)`,
  }).from(marketplaceOrders).where(inArray(marketplaceOrders.orderStatus, refundCancelStatuses as any[]));

  // PSA Grading Revenue: monthly breakdown
  const gradingMonthlyRows = await db.select({
    yearMonth: sql<string>`DATE_FORMAT(createdAt, '%Y-%m')`,
    gradingRevenue: sql<string>`COALESCE(SUM(totalFeeHkd), 0)`,
    gradingCount: sql<number>`count(*)`,
    upgradeRevenue: sql<string>`COALESCE(SUM(CASE WHEN upgradePaidAt IS NOT NULL THEN upgradeDiffFeeHkd ELSE 0 END), 0)`,
    upgradeCount: sql<number>`SUM(CASE WHEN upgradePaidAt IS NOT NULL THEN 1 ELSE 0 END)`,
  })
    .from(gradingSubmissions)
    .where(inArray(gradingSubmissions.status, gradingPaidStatuses as any[]))
    .groupBy(sql`DATE_FORMAT(createdAt, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(createdAt, '%Y-%m') DESC`);

  // Build grading revenue map keyed by yearMonth
  const gradingMonthlyMap = new Map<string, { gradingRevenue: number; gradingCount: number; upgradeRevenue: number; upgradeCount: number }>();
  for (const r of gradingMonthlyRows) {
    if (r.yearMonth) {
      gradingMonthlyMap.set(r.yearMonth, {
        gradingRevenue: parseFloat(r.gradingRevenue ?? '0'),
        gradingCount: Number(r.gradingCount ?? 0),
        upgradeRevenue: parseFloat(r.upgradeRevenue ?? '0'),
        upgradeCount: Number(r.upgradeCount ?? 0),
      });
    }
  }

  // PSA Grading Revenue: overall totals
  const [gradingOverall] = await db.select({
    totalGradingRevenue: sql<string>`COALESCE(SUM(totalFeeHkd), 0)`,
    totalGradingCount: sql<number>`count(*)`,
    totalUpgradeRevenue: sql<string>`COALESCE(SUM(CASE WHEN upgradePaidAt IS NOT NULL THEN upgradeDiffFeeHkd ELSE 0 END), 0)`,
    totalUpgradeCount: sql<number>`SUM(CASE WHEN upgradePaidAt IS NOT NULL THEN 1 ELSE 0 END)`,
    stripeGradingRevenue: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'stripe' THEN totalFeeHkd ELSE 0 END), 0)`,
    stripeGradingCount: sql<number>`SUM(CASE WHEN paymentMethod = 'stripe' THEN 1 ELSE 0 END)`,
    alipayGradingRevenue: sql<string>`COALESCE(SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN totalFeeHkd ELSE 0 END), 0)`,
    alipayGradingCount: sql<number>`SUM(CASE WHEN paymentMethod = 'alipay_hk' THEN 1 ELSE 0 END)`,
  })
    .from(gradingSubmissions)
    .where(inArray(gradingSubmissions.status, gradingPaidStatuses as any[]));

  // PSA Batch Costs: sum of all batchCostHkd from gradingBatches
  const { gradingBatches: gradingBatchesTable } = await import("../drizzle/schema_new");
  const [batchCostStats] = await db.select({
    totalBatchCost: sql<string>`COALESCE(SUM(batchCostHkd), 0)`,
    batchCount: sql<number>`count(*)`,
  }).from(gradingBatchesTable);

  // Payout totals: how much has been paid out to sellers, how much is pending
  const [payoutStats] = await db.select({
    paidOutAmount: sql<string>`COALESCE(SUM(CASE WHEN payoutStatus = 'paid' THEN sellerReceivableHkd ELSE 0 END), 0)`,
    pendingPayoutAmount: sql<string>`COALESCE(SUM(CASE WHEN payoutStatus IN ('processing', 'pending') AND sellerType = 'seller' THEN sellerReceivableHkd ELSE 0 END), 0)`,
    pendingPayoutCount: sql<number>`SUM(CASE WHEN payoutStatus IN ('processing', 'pending') AND sellerType = 'seller' THEN 1 ELSE 0 END)`,
    paidOutCount: sql<number>`SUM(CASE WHEN payoutStatus = 'paid' THEN 1 ELSE 0 END)`,
  }).from(marketplaceOrders).where(inArray(marketplaceOrders.orderStatus, paidStatuses as any[]));

  const totalSalesHkd = parseFloat(overall?.totalSales ?? '0');
  const totalRefundedHkd = parseFloat(overallRefund?.refundedAmount ?? '0');
  const totalFeesHkd = parseFloat(overall?.totalFees ?? '0');
  const platformSalesHkd = parseFloat(overall?.platformSales ?? '0');
  const gradingRevenueHkd = parseFloat(gradingOverall?.totalGradingRevenue ?? '0');
  const gradingCount = Number(gradingOverall?.totalGradingCount ?? 0);
  const upgradeRevenueHkd = parseFloat(gradingOverall?.totalUpgradeRevenue ?? '0');
  const upgradeCount = Number(gradingOverall?.totalUpgradeCount ?? 0);
  const totalBatchCostHkd = parseFloat(batchCostStats?.totalBatchCost ?? '0');
  const gradingNetProfitHkd = gradingRevenueHkd - totalBatchCostHkd;
  // Platform income = platform direct sales + C2C fees + PSA grading revenue (upgrade diff already included in totalFeeHkd via grading)
  const platformIncomeHkd = platformSalesHkd + totalFeesHkd + gradingRevenueHkd;
  // Platform payout (outcome) = seller receivable paid out + refunds
  const paidOutHkd = parseFloat(payoutStats?.paidOutAmount ?? '0');
  const pendingPayoutHkd = parseFloat(payoutStats?.pendingPayoutAmount ?? '0');

  // Build a unified monthly set: union of marketplace months + grading months
  // This ensures grading-only months (no marketplace orders) still appear in the chart
  const allMonthKeys = new Set<string>();
  for (const r of monthlyRows) { if (r.yearMonth) allMonthKeys.add(r.yearMonth); }
  for (const k of Array.from(gradingMonthlyMap.keys())) { allMonthKeys.add(k); }
  // Build a map from marketplace rows for quick lookup
  const marketplaceMonthlyMap = new Map<string, typeof monthlyRows[0]>();
  for (const r of monthlyRows) { if (r.yearMonth) marketplaceMonthlyMap.set(r.yearMonth, r); }
  // Sort all months descending, limit to requested months
  const sortedMonthKeys = Array.from(allMonthKeys).sort((a, b) => b.localeCompare(a)).slice(0, months);

  return {
    monthly: sortedMonthKeys.map(ym => {
      const r = marketplaceMonthlyMap.get(ym);
      const refund = refundMap.get(ym) ?? { refundedCount: 0, cancelledCount: 0, refundedAmountHkd: 0 };
      const grading = gradingMonthlyMap.get(ym) ?? { gradingRevenue: 0, gradingCount: 0, upgradeRevenue: 0, upgradeCount: 0 };
      const salesHkd = parseFloat(r?.totalSales ?? '0');
      const feesHkd = parseFloat(r?.sellerFees ?? '0');
      const platSalesHkd = parseFloat(r?.platformSales ?? '0');
      return {
        yearMonth: ym,
        totalSalesHkd: salesHkd,
        orderCount: Number(r?.orderCount ?? 0),
        stripeCount: Number(r?.stripeCount ?? 0),
        alipayCount: Number(r?.alipayCount ?? 0),
        platformSalesHkd: platSalesHkd,
        sellerSalesHkd: parseFloat(r?.sellerSales ?? '0'),
        sellerFeesHkd: feesHkd,
        platformIncomeHkd: platSalesHkd + feesHkd + grading.gradingRevenue,
        gradingRevenueHkd: grading.gradingRevenue,
        gradingCount: grading.gradingCount,
        upgradeRevenueHkd: grading.upgradeRevenue,
        upgradeCount: grading.upgradeCount,
        refundedCount: refund.refundedCount,
        cancelledCount: refund.cancelledCount,
        refundedAmountHkd: refund.refundedAmountHkd,
        netRevenueHkd: salesHkd - refund.refundedAmountHkd,
        // Auction vs Direct breakdown
        auctionSalesHkd: parseFloat(r?.auctionSales ?? '0'),
        auctionCount: Number(r?.auctionCount ?? 0),
        auctionPlatformSalesHkd: parseFloat(r?.auctionPlatformSales ?? '0'),
        auctionSellerFeesHkd: parseFloat(r?.auctionSellerFees ?? '0'),
        directSalesHkd: parseFloat(r?.directSales ?? '0'),
        directCount: Number(r?.directCount ?? 0),
      };
    }),
    overall: {
      totalSalesHkd,
      totalFeesHkd,
      totalOrders: Number(overall?.totalOrders ?? 0),
      platformSalesHkd,
      sellerSalesHkd: parseFloat(overall?.sellerSales ?? '0'),
      sellerReceivableTotalHkd: parseFloat(overall?.sellerReceivable ?? '0'),
      stripeCount: Number(overall?.stripeCount ?? 0),
      alipayCount: Number(overall?.alipayCount ?? 0),
      stripeSalesHkd: parseFloat(overall?.stripeSales ?? '0'),
      alipaySalesHkd: parseFloat(overall?.alipaySales ?? '0'),
      stripePlatformSalesHkd: parseFloat(overall?.stripePlatformSales ?? '0'),
      alipayPlatformSalesHkd: parseFloat(overall?.alipayPlatformSales ?? '0'),
      stripeSellerFeesHkd: parseFloat(overall?.stripeSellerFees ?? '0'),
      alipaySellerFeesHkd: parseFloat(overall?.alipaySellerFees ?? '0'),
      refundedCount: Number(overallRefund?.refundedCount ?? 0),
      cancelledCount: Number(overallRefund?.cancelledCount ?? 0),
      refundedAmountHkd: totalRefundedHkd,
      netRevenueHkd: totalSalesHkd - totalRefundedHkd,
      // Platform income/outcome
      platformIncomeHkd,
      paidOutHkd,
      pendingPayoutHkd,
      pendingPayoutCount: Number(payoutStats?.pendingPayoutCount ?? 0),
      paidOutCount: Number(payoutStats?.paidOutCount ?? 0),
      // PSA Grading Revenue
      gradingRevenueHkd,
      gradingCount,
      // PSA Grading Revenue by payment method
      stripeGradingRevenueHkd: parseFloat(gradingOverall?.stripeGradingRevenue ?? '0'),
      stripeGradingCount: Number(gradingOverall?.stripeGradingCount ?? 0),
      alipayGradingRevenueHkd: parseFloat(gradingOverall?.alipayGradingRevenue ?? '0'),
      alipayGradingCount: Number(gradingOverall?.alipayGradingCount ?? 0),
      // Tier Upgrade Revenue (subset of grading revenue)
      upgradeRevenueHkd,
      upgradeCount,
      // PSA Batch Cost & Net Profit
      totalBatchCostHkd,
      gradingNetProfitHkd,
      // Net platform profit = income - refunds
      platformNetProfitHkd: platformIncomeHkd - totalRefundedHkd,
      // Auction vs Direct breakdown
      auctionSalesHkd: parseFloat(overall?.auctionSales ?? '0'),
      auctionCount: Number(overall?.auctionCount ?? 0),
      auctionPlatformSalesHkd: parseFloat(overall?.auctionPlatformSales ?? '0'),
      auctionSellerSalesHkd: parseFloat(overall?.auctionSellerSales ?? '0'),
      auctionSellerFeesHkd: parseFloat(overall?.auctionSellerFees ?? '0'),
      directSalesHkd: parseFloat(overall?.directSales ?? '0'),
      directCount: Number(overall?.directCount ?? 0),
      directPlatformSalesHkd: parseFloat(overall?.directPlatformSales ?? '0'),
      directSellerFeesHkd: parseFloat(overall?.directSellerFees ?? '0'),
    },
  };
}

// --- Admin Fee Details: C2C orders for a specific month ---
export async function getAdminFeeDetails(yearMonth: string, page = 1, pageSize = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const paidStatuses = ['payment_received', 'processing', 'shipped', 'delivered', 'completed'];

  const offset = (page - 1) * pageSize;

  const rows = await db.select({
    orderId: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    orderStatus: marketplaceOrders.orderStatus,
    paymentMethod: marketplaceOrders.paymentMethod,
    createdAt: marketplaceOrders.createdAt,
    sellerId: marketplaceOrders.sellerId,
    sellerDisplayName: sellerProfiles.displayName,
    sellerUserName: users.name,
  })
    .from(marketplaceOrders)
    .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
    .leftJoin(users, eq(sellerProfiles.userId, users.id))
    .where(
      and(
        eq(marketplaceOrders.sellerType, 'seller'),
        inArray(marketplaceOrders.orderStatus, paidStatuses as any[]),
        sql`DATE_FORMAT(${marketplaceOrders.createdAt}, '%Y-%m') = ${yearMonth}`
      )
    )
    .orderBy(desc(marketplaceOrders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db.select({ total: sql<number>`count(*)` })
    .from(marketplaceOrders)
    .where(
      and(
        eq(marketplaceOrders.sellerType, 'seller'),
        inArray(marketplaceOrders.orderStatus, paidStatuses as any[]),
        sql`DATE_FORMAT(${marketplaceOrders.createdAt}, '%Y-%m') = ${yearMonth}`
      )
    );

  return {
    rows: rows.map(r => ({
      orderId: r.orderId,
      orderNo: r.orderNo,
      subtotalHkd: parseFloat(String(r.subtotalHkd ?? '0')),
      platformFeeHkd: parseFloat(String(r.platformFeeHkd ?? '0')),
      sellerReceivableHkd: parseFloat(String(r.sellerReceivableHkd ?? '0')),
      orderStatus: r.orderStatus,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt,
      sellerDisplayName: r.sellerDisplayName ?? r.sellerUserName ?? `賣家 #${r.sellerId}`,
    })),
    total: Number(countRow?.total ?? 0),
  };
}

// --- Admin Monthly Transaction Detail (all orders for a given month) ---
export async function getAdminMonthlyTransactions(yearMonth: string, page = 1, pageSize = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const paidStatuses = ['payment_received', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'];
  const offset = (page - 1) * pageSize;

  const rows = await db.select({
    orderId: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    orderStatus: marketplaceOrders.orderStatus,
    paymentMethod: marketplaceOrders.paymentMethod,
    paymentStatus: marketplaceOrders.paymentStatus,
    payoutStatus: marketplaceOrders.payoutStatus,
    sellerType: marketplaceOrders.sellerType,
    quantity: marketplaceOrders.quantity,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    platformFeeHkd: marketplaceOrders.platformFeeHkd,
    sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
    paidAt: marketplaceOrders.paidAt,
    createdAt: marketplaceOrders.createdAt,
    // Buyer info
    buyerName: users.name,
    buyerEmail: users.email,
    // Listing info (from order items snapshot)
    listingTitle: marketplaceOrderItems.title,
    // Seller info
    sellerId: marketplaceOrders.sellerId,
    sellerDisplayName: sellerProfiles.displayName,
    sellerUserName: sql<string>`seller_users.name`,
  })
    .from(marketplaceOrders)
    .leftJoin(users, eq(marketplaceOrders.buyerId, users.id))
    .leftJoin(marketplaceOrderItems, eq(marketplaceOrderItems.orderId, marketplaceOrders.id))
    .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
    .leftJoin(sql`users as seller_users`, sql`seller_users.id = ${sellerProfiles.userId}`)
    .where(
      and(
        inArray(marketplaceOrders.orderStatus, paidStatuses as any[]),
        sql`DATE_FORMAT(${marketplaceOrders.createdAt}, '%Y-%m') = ${yearMonth}`
      )
    )
    .orderBy(desc(marketplaceOrders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db.select({ total: sql<number>`count(DISTINCT ${marketplaceOrders.id})` })
    .from(marketplaceOrders)
    .where(
      and(
        inArray(marketplaceOrders.orderStatus, paidStatuses as any[]),
        sql`DATE_FORMAT(${marketplaceOrders.createdAt}, '%Y-%m') = ${yearMonth}`
      )
    );

  return {
    rows: rows.map(r => ({
      orderId: r.orderId,
      orderNo: r.orderNo,
      orderStatus: r.orderStatus,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      payoutStatus: r.payoutStatus,
      sellerType: r.sellerType,
      quantity: r.quantity,
      // subtotalHkd: 0 for cancelled/refunded (GMV should not include these)
      subtotalHkd: (r.orderStatus === 'cancelled' || r.orderStatus === 'refunded')
        ? 0
        : parseFloat(String(r.subtotalHkd ?? '0')),
      platformFeeHkd: parseFloat(String(r.platformFeeHkd ?? '0')),
      // sellerReceivableHkd: 0 for cancelled/refunded (seller doesn't receive payment)
      sellerReceivableHkd: (r.orderStatus === 'cancelled' || r.orderStatus === 'refunded')
        ? 0
        : parseFloat(String(r.sellerReceivableHkd ?? '0')),
      // Platform income: 0 for cancelled/refunded orders (no money was collected)
      platformIncomeHkd: (r.orderStatus === 'cancelled' || r.orderStatus === 'refunded')
        ? 0
        : r.sellerType === 'platform'
          ? parseFloat(String(r.subtotalHkd ?? '0'))
          : parseFloat(String(r.platformFeeHkd ?? '0')),
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      buyerName: r.buyerName ?? '—',
      buyerEmail: r.buyerEmail ?? '—',
      listingTitle: r.listingTitle ?? '—',
      sellerName: r.sellerType === 'platform'
        ? '平台直售'
        : (r.sellerDisplayName ?? r.sellerUserName ?? `賣家 #${r.sellerId}`),
    })),
    total: Number(countRow?.total ?? 0),
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
  let sellerProfile: SellerProfile | null = null;
  let sellerUser: { id: number; name: string | null; email: string } | null = null;
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

// ============================================================
// P1: CART ORDERS (Master order grouping) DB HELPERS
// ============================================================

/**
 * Create a new cart order (master order for a batch checkout).
 * Returns the created CartOrder row.
 */
export async function createCartOrder(data: InsertCartOrder): Promise<CartOrder | null> {
  const db = await getDb();
  if (!db) return null;
  await db.insert(cartOrders).values(data);
  const rows = await db.select().from(cartOrders)
    .where(and(
      eq(cartOrders.buyerId, data.buyerId),
      eq(cartOrders.totalSubtotalHkd, data.totalSubtotalHkd)
    ))
    .orderBy(desc(cartOrders.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Get a cart order by its ID.
 */
export async function getCartOrderById(id: number): Promise<CartOrder | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(cartOrders).where(eq(cartOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Get a cart order by Stripe Checkout Session ID.
 */
export async function getCartOrderByStripeSession(sessionId: string): Promise<CartOrder | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(cartOrders)
    .where(eq(cartOrders.stripeCheckoutSessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update a cart order by ID.
 */
export async function updateCartOrder(id: number, data: Partial<InsertCartOrder>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(cartOrders).set({ ...data, updatedAt: new Date() }).where(eq(cartOrders.id, id));
}

/**
 * Get all cart orders for a buyer (with pagination).
 */
export async function getBuyerCartOrders(buyerId: number, limit = 20, offset = 0): Promise<CartOrder[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cartOrders)
    .where(eq(cartOrders.buyerId, buyerId))
    .orderBy(desc(cartOrders.createdAt))
    .limit(limit)
    .offset(offset);
}


// --- Admin Audit Logs ---
import { adminAuditLogs, InsertAdminAuditLog } from "../drizzle/schema_new";

export async function createAuditLog(data: InsertAdminAuditLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(adminAuditLogs).values(data);
  } catch (e) {
    console.error("[createAuditLog] Failed:", e);
  }
}

export async function getAuditLogs(opts: { page?: number; pageSize?: number; action?: string; targetType?: string; adminId?: number } = {}) {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const { page = 1, pageSize = 50, action, targetType, adminId } = opts;
  const conditions: any[] = [];
  if (action) conditions.push(eq(adminAuditLogs.action, action));
  if (targetType) conditions.push(eq(adminAuditLogs.targetType, targetType));
  if (adminId) conditions.push(eq(adminAuditLogs.adminId, adminId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(adminAuditLogs)
    .where(where)
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const countRows = await db.select({ count: sql<number>`count(*)` }).from(adminAuditLogs).where(where);
  return { logs: rows, total: Number(countRows[0]?.count ?? 0) };
}

// ─── Marketplace Maintenance Mode ─────────────────────────────────────────────
import { marketplaceWhitelist as mwTable } from "../drizzle/schema_new";

export async function isMarketplaceMaintenanceMode(): Promise<boolean> {
  const row = await getSystemSetting('marketplace_maintenance_mode');
  return row?.settingValue === 'true';
}

export async function isMarketplaceWhitelisted(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: mwTable.id }).from(mwTable).where(eq(mwTable.userId, userId)).limit(1);
  return !!row;
}

export async function getMarketplaceWhitelist() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: mwTable.id,
    userId: mwTable.userId,
    addedBy: mwTable.addedBy,
    note: mwTable.note,
    createdAt: mwTable.createdAt,
    userName: users.name,
    userEmail: users.email,
  }).from(mwTable).leftJoin(users, eq(mwTable.userId, users.id)).orderBy(desc(mwTable.createdAt));
}

export async function addMarketplaceWhitelist(userId: number, addedBy: number, note?: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  await db.insert(mwTable).values({ userId, addedBy, note }).onDuplicateKeyUpdate({ set: { note, addedBy } });
  const [row] = await db.select().from(mwTable).where(eq(mwTable.userId, userId)).limit(1);
  return row;
}

export async function removeMarketplaceWhitelist(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(mwTable).where(eq(mwTable.userId, userId));
}

// ============================================================
// Grading Maintenance Mode
// ============================================================
export async function isGradingMaintenanceMode(): Promise<boolean> {
  const row = await getSystemSetting('grading_maintenance_mode');
  return row?.settingValue === 'true';
}

export async function isGradingWhitelisted(userId: number): Promise<boolean> {
  // Reuse the same marketplaceWhitelist table — one whitelist for all modules
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select({ id: mwTable.id }).from(mwTable).where(eq(mwTable.userId, userId)).limit(1);
  return !!row;
}


// ============================================================
// P1 Fix #4: Order Messages — Internal messaging for order communication
// ============================================================
import { orderMessages, InsertOrderMessage } from "../drizzle/schema_new";

export async function createOrderMessage(data: InsertOrderMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderMessages).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getOrderMessages(orderId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(orderMessages)
    .where(eq(orderMessages.orderId, orderId))
    .orderBy(asc(orderMessages.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getOrderMessagesByOrderNo(orderNo: string, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(orderMessages)
    .where(eq(orderMessages.orderNo, orderNo))
    .orderBy(asc(orderMessages.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function markMessagesRead(orderId: number, role: 'buyer' | 'seller' | 'admin') {
  const db = await getDb();
  if (!db) return;
  const fieldMap = { buyer: 'readByBuyer', seller: 'readBySeller', admin: 'readByAdmin' } as const;
  const atFieldMap = { buyer: 'readAtBuyer', seller: 'readAtSeller', admin: 'readAtAdmin' } as const;
  const field = role === 'buyer' ? orderMessages.readByBuyer
    : role === 'seller' ? orderMessages.readBySeller
    : orderMessages.readByAdmin;
  const now = new Date();
  await db.update(orderMessages)
    .set({ [fieldMap[role]]: true, [atFieldMap[role]]: now })
    .where(and(eq(orderMessages.orderId, orderId), eq(field, false)));
}

export async function getUnreadMessageCount(orderId: number, role: 'buyer' | 'seller' | 'admin') {
  const db = await getDb();
  if (!db) return 0;
  const field = role === 'buyer' ? orderMessages.readByBuyer
    : role === 'seller' ? orderMessages.readBySeller
    : orderMessages.readByAdmin;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(orderMessages)
    .where(and(eq(orderMessages.orderId, orderId), eq(field, false)));
  return result[0]?.count ?? 0;
}

export async function getTotalUnreadMessageCount(userId: number, role: 'buyer' | 'seller' | 'admin') {
  const db = await getDb();
  if (!db) return 0;
  const field = role === 'buyer' ? orderMessages.readByBuyer
    : role === 'seller' ? orderMessages.readBySeller
    : orderMessages.readByAdmin;
  if (role === 'buyer') {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderMessages)
      .innerJoin(marketplaceOrders, eq(orderMessages.orderId, marketplaceOrders.id))
      .where(and(eq(marketplaceOrders.buyerId, userId), eq(field, false)));
    return Number(result[0]?.count ?? 0);
  } else if (role === 'seller') {
    const spRows = await db.select({ id: sellerProfiles.id })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.userId, userId))
      .limit(1);
    if (!spRows[0]) return 0;
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderMessages)
      .innerJoin(marketplaceOrders, eq(orderMessages.orderId, marketplaceOrders.id))
      .where(and(eq(marketplaceOrders.sellerId, spRows[0].id), eq(field, false)));
    return Number(result[0]?.count ?? 0);
  } else {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(orderMessages)
      .where(eq(field, false));
    return Number(result[0]?.count ?? 0);
  }
}

export async function getAdminAllMessages(options: {
  limit?: number;
  offset?: number;
  orderNo?: string;
  unreadOnly?: boolean;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const { limit = 50, offset = 0, orderNo, unreadOnly } = options;
  const conditions: ReturnType<typeof eq>[] = [];
  if (orderNo) conditions.push(eq(orderMessages.orderNo, orderNo));
  if (unreadOnly) conditions.push(eq(orderMessages.readByAdmin, false));
  const rows = await db.select({
    id: orderMessages.id,
    orderId: orderMessages.orderId,
    orderNo: orderMessages.orderNo,
    senderId: orderMessages.senderId,
    senderRole: orderMessages.senderRole,
    content: orderMessages.content,
    imageUrl: orderMessages.imageUrl,
    isSystemMessage: orderMessages.isSystemMessage,
    readByBuyer: orderMessages.readByBuyer,
    readBySeller: orderMessages.readBySeller,
    readByAdmin: orderMessages.readByAdmin,
    createdAt: orderMessages.createdAt,
  })
    .from(orderMessages)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orderMessages.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}

export async function getAdminMessageStats() {
  const db = await getDb();
  if (!db) return { total: 0, unread: 0, activeOrders: 0 };
  const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(orderMessages);
  const [unreadRow] = await db.select({ count: sql<number>`count(*)` })
    .from(orderMessages)
    .where(eq(orderMessages.readByAdmin, false));
  const [activeRow] = await db.select({ count: sql<number>`count(distinct ${orderMessages.orderNo})` })
    .from(orderMessages);
  return {
    total: Number(totalRow?.count ?? 0),
    unread: Number(unreadRow?.count ?? 0),
    activeOrders: Number(activeRow?.count ?? 0),
  };
}

/**
 * Get recent order threads with unread messages for the current user.
 * Used by TopNav bell dropdown to show message threads.
 */
export async function getRecentUnreadOrderThreads(userId: number, role: 'buyer' | 'seller' | 'admin'): Promise<Array<{
  orderNo: string;
  orderId: number;
  unreadCount: number;
  latestContent: string | null;
  latestAt: Date | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  const { orderMessages, marketplaceOrders } = await import('../drizzle/schema_new');
  const { eq, and, desc, sql } = await import('drizzle-orm');

  let unreadCol;
  if (role === 'buyer') {
    unreadCol = orderMessages.readByBuyer;
  } else if (role === 'seller') {
    unreadCol = orderMessages.readBySeller;
  } else {
    unreadCol = orderMessages.readByAdmin;
  }

  let orderCondition;
  if (role === 'buyer') {
    orderCondition = eq(marketplaceOrders.buyerId, userId);
  } else if (role === 'seller') {
    orderCondition = eq(marketplaceOrders.sellerId, userId);
  } else {
    orderCondition = undefined;
  }

  const whereClause = orderCondition
    ? and(eq(unreadCol, false), orderCondition)
    : eq(unreadCol, false);

  const rows = await db
    .select({
      orderNo: orderMessages.orderNo,
      orderId: orderMessages.orderId,
      unreadCount: sql<number>`count(*)`,
      latestAt: sql<Date | null>`max(${orderMessages.createdAt})`,
    })
    .from(orderMessages)
    .innerJoin(marketplaceOrders, eq(marketplaceOrders.id, orderMessages.orderId))
    .where(whereClause)
    .groupBy(orderMessages.orderNo, orderMessages.orderId)
    .orderBy(desc(sql`max(${orderMessages.createdAt})`))
    .limit(20);

  if (rows.length === 0) return [];

  // Fetch latest message content per order
  const orderNos = rows.map(r => r.orderNo);
  const latestMsgs = await db
    .select({ orderNo: orderMessages.orderNo, content: orderMessages.content })
    .from(orderMessages)
    .where(inArray(orderMessages.orderNo, orderNos))
    .orderBy(desc(orderMessages.createdAt));

  const latestContentMap = new Map<string, string | null>();
  for (const m of latestMsgs) {
    if (!latestContentMap.has(m.orderNo)) {
      latestContentMap.set(m.orderNo, m.content);
    }
  }

  return rows.map(r => ({
    orderNo: r.orderNo,
    orderId: r.orderId,
    unreadCount: Number(r.unreadCount),
    latestContent: latestContentMap.get(r.orderNo) ?? null,
    latestAt: r.latestAt,
  }));
}


// ─── Dispute Media helpers ────────────────────────────────────────────────────
export async function insertDisputeMedia(data: InsertDisputeMedia): Promise<DisputeMedia> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const [result] = await db.insert(disputeMedia).values(data);
  const id = (result as any).insertId as number;
  const [row] = await db.select().from(disputeMedia).where(eq(disputeMedia.id, id));
  return row;
}
export async function getDisputeMediaByOrderId(orderId: number): Promise<DisputeMedia[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(disputeMedia)
    .where(eq(disputeMedia.orderId, orderId))
    .orderBy(disputeMedia.createdAt);
}
export async function deleteDisputeMedia(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(disputeMedia).where(eq(disputeMedia.id, id));
}

// ─── Dispute Statistics ────────────────────────────────────────────────────
/**
 * Get comprehensive dispute statistics for the admin dashboard.
 * Includes this month's dispute count, average resolution days, and buyer/seller win rates.
 */
export async function getDisputeStats() {
  const db = await getDb();
  if (!db) return {
    thisMonthDisputeCount: 0,
    totalResolvedCount: 0,
    avgResolutionDays: 0,
    buyerWinCount: 0,
    sellerWinCount: 0,
    buyerWinRate: 0,
    sellerWinRate: 0,
    unresolvedOver3DaysCount: 0,
    unresolvedCount: 0,
  };

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeDaysAgoMs = now.getTime() - 3 * 24 * 60 * 60 * 1000;

  // This month's new disputes
  const [thisMonthDisputes] = await db.select({ count: sql<number>`count(*)` })
    .from(marketplaceOrders)
    .where(and(
      isNotNull(marketplaceOrders.disputeOpenedAt),
      sql`${marketplaceOrders.disputeOpenedAt} >= ${firstDayOfMonth}`
    ));

  // Total resolved disputes (has disputeResolvedAt)
  const resolvedOrders = await db.select({
    disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
    disputeResolvedAt: marketplaceOrders.disputeResolvedAt,
    disputeResolution: marketplaceOrders.disputeResolution,
  })
    .from(marketplaceOrders)
    .where(and(
      isNotNull(marketplaceOrders.disputeOpenedAt),
      isNotNull(marketplaceOrders.disputeResolvedAt)
    ))
    .limit(500);

  // Calculate average resolution days and win rates
  let totalResolutionMs = 0;
  let buyerWinCount = 0;
  let sellerWinCount = 0;
  for (const order of resolvedOrders) {
    if (order.disputeOpenedAt && order.disputeResolvedAt) {
      const openedMs = new Date(order.disputeOpenedAt).getTime();
      const resolvedMs = new Date(order.disputeResolvedAt).getTime();
      totalResolutionMs += resolvedMs - openedMs;
    }
    // Parse outcome from disputeResolution field: "[refund_buyer] ..." or "[release_seller] ..."
    const resolution = order.disputeResolution ?? '';
    if (resolution.includes('[refund_buyer]')) buyerWinCount++;
    else if (resolution.includes('[release_seller]')) sellerWinCount++;
  }

  const totalResolvedCount = resolvedOrders.length;
  const avgResolutionDays = totalResolvedCount > 0
    ? Math.round((totalResolutionMs / totalResolvedCount) / (1000 * 60 * 60 * 24) * 10) / 10
    : 0;
  const totalDecided = buyerWinCount + sellerWinCount;
  const buyerWinRate = totalDecided > 0 ? Math.round((buyerWinCount / totalDecided) * 100) : 0;
  const sellerWinRate = totalDecided > 0 ? 100 - buyerWinRate : 0;

  // Currently unresolved disputes
  const [unresolvedCount] = await db.select({ count: sql<number>`count(*)` })
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.orderStatus, 'disputed'));

  // Unresolved disputes over 3 days old
  const [unresolvedOver3Days] = await db.select({ count: sql<number>`count(*)` })
    .from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.orderStatus, 'disputed'),
      isNotNull(marketplaceOrders.disputeOpenedAt),
      sql`${marketplaceOrders.disputeOpenedAt} <= ${new Date(threeDaysAgoMs)}`
    ));

  return {
    thisMonthDisputeCount: Number(thisMonthDisputes?.count ?? 0),
    totalResolvedCount,
    avgResolutionDays,
    buyerWinCount,
    sellerWinCount,
    buyerWinRate,
    sellerWinRate,
    unresolvedOver3DaysCount: Number(unresolvedOver3Days?.count ?? 0),
    unresolvedCount: Number(unresolvedCount?.count ?? 0),
  };
}

// ============================================================
// AUCTION DB HELPERS
// ============================================================
import {
  auctionBids, auctionAgreements, auctionViolations,
  type AuctionBid, type InsertAuctionBid,
  type AuctionAgreement, type InsertAuctionAgreement,
  type AuctionViolation, type InsertAuctionViolation,
} from "../drizzle/schema_new";
// sellerProfiles already imported at line ~2997
// ne, gt, lt already imported at top of file

// ---- Auction Listings ----

export async function getAuctionListings(opts: {
  status?: string[];
  page?: number;
  pageSize?: number;
  cardId?: number;
  tcgSeries?: string;
  sortBy?: 'ending_soon' | 'newest' | 'price_asc' | 'price_desc';
}) {
  const { status = ['active', 'ending_soon', 'scheduled'], page = 1, pageSize = 20, cardId, tcgSeries, sortBy = 'ending_soon' } = opts;
  const offset = (page - 1) * pageSize;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const conditions: any[] = [
    eq(marketplaceListings.listingMode, 'auction'),
    inArray(marketplaceListings.auctionStatus, status as any[]),
  ];
  if (cardId) conditions.push(eq(marketplaceListings.cardId, cardId));
  if (tcgSeries && tcgSeries !== 'all') conditions.push(eq(marketplaceListings.tcgSeries, tcgSeries as any));
  // Build order clause based on sortBy
  let orderClause;
  switch (sortBy) {
    case 'newest': orderClause = desc(marketplaceListings.createdAt); break;
    case 'price_asc': orderClause = asc(marketplaceListings.priceHkd); break;
    case 'price_desc': orderClause = desc(marketplaceListings.priceHkd); break;
    case 'ending_soon':
    default: orderClause = asc(marketplaceListings.auctionEndAt); break;
  }
  const rows = await db.select().from(marketplaceListings)
    .where(and(...conditions))
    .orderBy(orderClause)
    .limit(pageSize)
    .offset(offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(marketplaceListings)
    .where(and(...conditions));
  return { listings: rows, total: Number(total), page, pageSize };
}
export async function getAuctionListingById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.select().from(marketplaceListings)
    .where(and(eq(marketplaceListings.id, id), eq(marketplaceListings.listingMode, 'auction')));
  if (!row) return null;
  // Enrich with seller info
  let sellerInfo: { displayName: string; avatarUrl: string | null; avgRating: string | null; ratingCount: number; totalSales: number; userId: number } | null = null;
  if (row.sellerId) {
    const [sp] = await db.select({
      displayName: sellerProfiles.displayName,
      avatarUrl: sellerProfiles.avatarUrl,
      avgRating: sellerProfiles.avgRating,
      ratingCount: sellerProfiles.ratingCount,
      totalSales: sellerProfiles.totalSales,
      userId: sellerProfiles.userId,
    }).from(sellerProfiles).where(eq(sellerProfiles.id, row.sellerId)).limit(1);
    if (sp) sellerInfo = sp;
  }
  return { ...row, sellerInfo };
}

export async function updateAuctionListing(id: number, data: Partial<typeof marketplaceListings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(marketplaceListings).set({ ...data, updatedAt: new Date() }).where(eq(marketplaceListings.id, id));
}

export async function getAuctionsEndingSoon(withinMinutes: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinMinutes * 60 * 1000);
  return db.select().from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.listingMode, 'auction'),
      eq(marketplaceListings.auctionStatus, 'active'),
      gt(marketplaceListings.auctionEndAt, now),
      lt(marketplaceListings.auctionEndAt, cutoff),
    ));
}

export async function getExpiredActiveAuctions() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  return db.select().from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.listingMode, 'auction'),
      inArray(marketplaceListings.auctionStatus, ['active', 'ending_soon']),
      lt(marketplaceListings.auctionEndAt, now),
    ));
}

export async function getScheduledAuctionsToStart() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  return db.select().from(marketplaceListings)
    .where(and(
      eq(marketplaceListings.listingMode, 'auction'),
      eq(marketplaceListings.auctionStatus, 'scheduled'),
      lt(marketplaceListings.auctionStartAt, now),
    ));
}

export async function getAdminAuctionListings(opts: {
  status?: string;
  page?: number;
  pageSize?: number;
  isHighValueReview?: boolean;
}) {
  const { status, page = 1, pageSize = 20, isHighValueReview } = opts;
  const offset = (page - 1) * pageSize;
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const conditions: any[] = [eq(marketplaceListings.listingMode, 'auction')];
  if (status) conditions.push(eq(marketplaceListings.auctionStatus, status as any));
  if (isHighValueReview === true) conditions.push(eq(marketplaceListings.isHighValueReview as any, true));

  const rows = await db.select().from(marketplaceListings)
    .where(and(...conditions))
    .orderBy(desc(marketplaceListings.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(marketplaceListings)
    .where(and(...conditions));

  return { listings: rows, total: Number(total), page, pageSize };
}

// ---- Auction Bids ----

export async function placeBid(data: InsertAuctionBid): Promise<AuctionBid> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(auctionBids).values(data);
  const insertId = (result as any).insertId;
  const [row] = await db.select().from(auctionBids).where(eq(auctionBids.id, insertId));
  return row;
}

export async function getBidsByListingId(listingId: number, limit = 50): Promise<(AuctionBid & { bidderName: string | null })[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.select({
    id: auctionBids.id,
    listingId: auctionBids.listingId,
    bidderId: auctionBids.bidderId,
    amount: auctionBids.amount,
    status: auctionBids.status,
    ipHash: auctionBids.ipHash,
    userAgent: auctionBids.userAgent,
    depositAmountHkd: auctionBids.depositAmountHkd,
    depositPaymentIntentId: auctionBids.depositPaymentIntentId,
    depositStatus: auctionBids.depositStatus,
    depositHeldAt: auctionBids.depositHeldAt,
    depositReleasedAt: auctionBids.depositReleasedAt,
    createdAt: auctionBids.createdAt,
    bidderName: users.name,
  })
    .from(auctionBids)
    .leftJoin(users, eq(auctionBids.bidderId, users.id))
    .where(eq(auctionBids.listingId, listingId))
    .orderBy(desc(auctionBids.createdAt))
    .limit(limit);
  return rows;
}

export async function getWinningBid(listingId: number): Promise<AuctionBid | null> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.select().from(auctionBids)
    .where(and(eq(auctionBids.listingId, listingId), eq(auctionBids.status, 'winning')))
    .orderBy(desc(auctionBids.amount))
    .limit(1);
  return row ?? null;
}

export async function markBidsAsOutbid(listingId: number, exceptBidId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(auctionBids)
    .set({ status: 'outbid' })
    .where(and(
      eq(auctionBids.listingId, listingId),
      ne(auctionBids.id, exceptBidId),
      eq(auctionBids.status, 'active'),
    ));
}

export async function updateBidStatus(bidId: number, status: AuctionBid['status']) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(auctionBids).set({ status }).where(eq(auctionBids.id, bidId));
}

export async function getBidsByBidderId(bidderId: number, limit = 50): Promise<AuctionBid[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(auctionBids)
    .where(eq(auctionBids.bidderId, bidderId))
    .orderBy(desc(auctionBids.createdAt))
    .limit(limit);
}

// ---- Auction Agreements ----

export async function hasAgreedToTerms(userId: number, role: 'buyer' | 'seller', version: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.select({ id: auctionAgreements.id })
    .from(auctionAgreements)
    .where(and(
      eq(auctionAgreements.userId, userId),
      eq(auctionAgreements.role, role),
      eq(auctionAgreements.termsVersion, version),
    ));
  return !!row;
}

export async function recordAgreement(data: InsertAuctionAgreement): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(auctionAgreements).values(data).onDuplicateKeyUpdate({ set: { agreedAt: new Date() } });
}

// ---- Auction Violations ----

export async function createViolation(data: InsertAuctionViolation): Promise<AuctionViolation> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(auctionViolations).values(data);
  const insertId = (result as any).insertId;
  const [row] = await db.select().from(auctionViolations).where(eq(auctionViolations.id, insertId));
  return row;
}

export async function getViolationsByUserId(userId: number): Promise<AuctionViolation[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.select().from(auctionViolations)
    .where(eq(auctionViolations.userId, userId))
    .orderBy(desc(auctionViolations.createdAt));
}

export async function isUserAuctionBanned(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  const [row] = await db.select({ id: auctionViolations.id })
    .from(auctionViolations)
    .where(and(
      eq(auctionViolations.userId, userId),
      or(
        eq(auctionViolations.penalty, 'permanent'),
        and(
          inArray(auctionViolations.penalty, ['ban_7d', 'ban_30d']),
          gt(auctionViolations.banExpiresAt, now),
        )
      )
    ))
    .limit(1);
  return !!row;
}


// ── Phase 2: Seller auctions list ─────────────────────────────────────────────
export async function getSellerAuctions(sellerId: number, opts: {
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ listings: any[]; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [
    eq(marketplaceListings.sellerId, sellerId),
    eq(marketplaceListings.listingMode as any, 'auction'),
  ];
  if (opts.status) {
    conditions.push(eq(marketplaceListings.auctionStatus as any, opts.status));
  }

  const [listings, countResult] = await Promise.all([
    db.select().from(marketplaceListings)
      .where(and(...conditions))
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(marketplaceListings)
      .where(and(...conditions)),
  ]);

  return { listings, total: Number(countResult[0]?.count ?? 0) };
}

// ── Phase 2: Admin auction stats ──────────────────────────────────────────────
export async function getAuctionAdminStats(): Promise<{
  totalAuctions: number;
  activeAuctions: number;
  endingSoonAuctions: number;
  endedSold: number;
  endedNoBid: number;
  pendingReview: number;
  scheduledAuctions: number;
  highValuePending: number;
  rejectedCount: number;
  totalBids: number;
  totalRevenue: number;
  todayNewAuctions: number;
  monthlyRevenue: number;
  monthlyCompletedAuctions: number;
  abandonRate: number;
  totalViolations: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statusCounts, totalBidsResult, todayResult, monthlyResult, violationsResult, highValueResult] = await Promise.all([
    db.select({
      auctionStatus: marketplaceListings.auctionStatus,
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${marketplaceListings.currentHighestBid} AS DECIMAL(10,2))), 0)`,
    })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.listingMode as any, 'auction'))
      .groupBy(marketplaceListings.auctionStatus),
    db.select({ count: sql<number>`COUNT(*)` }).from(auctionBids),
    // Today new auctions
    db.select({ count: sql<number>`COUNT(*)` })
      .from(marketplaceListings)
      .where(and(
        eq(marketplaceListings.listingMode as any, 'auction'),
        gt(marketplaceListings.createdAt, todayStart),
      )),
    // Monthly completed auctions + revenue (only count auctions with paid orders)
    db.select({
      count: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(CAST(${marketplaceOrders.unitPriceHkd} AS DECIMAL(10,2))), 0)`,
    })
      .from(marketplaceOrders)
      .where(and(
        eq(marketplaceOrders.orderSource as any, 'auction'),
        eq(marketplaceOrders.paymentStatus as any, 'paid'),
        gt(marketplaceOrders.updatedAt, monthStart),
      )),
    // Total violations
    db.select({ count: sql<number>`COUNT(*)` }).from(auctionViolations),
    // High value pending
    db.select({ count: sql<number>`COUNT(*)` })
      .from(marketplaceListings)
      .where(and(
        eq(marketplaceListings.listingMode as any, 'auction'),
        eq(marketplaceListings.isHighValueReview as any, true),
        eq(marketplaceListings.auctionStatus as any, 'pending_review'),
      )),
  ]);

  const counts: Record<string, number> = {};
  let totalRevenue = 0;
  for (const row of statusCounts) {
    if (row.auctionStatus) {
      counts[row.auctionStatus] = Number(row.count);
      if (row.auctionStatus === 'ended_sold') totalRevenue = Number(row.revenue);
    }
  }

  const totalCompleted = (counts['ended_sold'] ?? 0) + (counts['ended_no_bid'] ?? 0);
  const abandonRate = totalCompleted > 0
    ? (Number(violationsResult[0]?.count ?? 0) / totalCompleted) * 100
    : 0;

  return {
    totalAuctions: Object.values(counts).reduce((a, b) => a + b, 0),
    activeAuctions: counts['active'] ?? 0,
    endingSoonAuctions: counts['ending_soon'] ?? 0,
    endedSold: counts['ended_sold'] ?? 0,
    endedNoBid: counts['ended_no_bid'] ?? 0,
    pendingReview: counts['pending_review'] ?? 0,
    scheduledAuctions: counts['scheduled'] ?? 0,
    highValuePending: Number(highValueResult[0]?.count ?? 0),
    rejectedCount: counts['rejected'] ?? 0,
    totalBids: Number(totalBidsResult[0]?.count ?? 0),
    totalRevenue,
    todayNewAuctions: Number(todayResult[0]?.count ?? 0),
    monthlyRevenue: Number(monthlyResult[0]?.revenue ?? 0),
    monthlyCompletedAuctions: Number(monthlyResult[0]?.count ?? 0),
    abandonRate,
    totalViolations: Number(violationsResult[0]?.count ?? 0),
  };
}

// ── Phase 2: Get all distinct bidder IDs for a listing ────────────────────────
export async function getDistinctBidderIds(listingId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rows = await db.selectDistinct({ bidderId: auctionBids.bidderId })
    .from(auctionBids)
    .where(eq(auctionBids.listingId, listingId));
  return rows.map(r => r.bidderId);
}

// ── Phase 2: Count violations by user and type ────────────────────────────────
export async function countViolationsByUser(userId: number, type: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [row] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(auctionViolations)
    .where(and(
      eq(auctionViolations.userId, userId),
      eq(auctionViolations.type as any, type),
    ));
  return Number(row?.count ?? 0);
}

// ── Phase 2: Get auction orders past 24h payment deadline ────────────────────
export async function getOverdueAuctionOrders(): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const now = new Date();
  // Auction orders older than 24 hours that are still pending_payment
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    auctionListingId: (marketplaceOrders as any).auctionListingId,
    createdAt: marketplaceOrders.createdAt,
  })
    .from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.orderStatus, 'pending_payment'),
      eq((marketplaceOrders as any).orderSource, 'auction'),
      lt(marketplaceOrders.createdAt, cutoff24h),
    ));
}

// ─── Admin: Auction Violations ───────────────────────────────────────────────

export async function getAllAuctionViolations(opts: {
  page: number;
  pageSize: number;
  userId?: number;
}): Promise<{ violations: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { violations: [], total: 0 };
  const offset = (opts.page - 1) * opts.pageSize;
  const whereClause = opts.userId ? eq(auctionViolations.userId, opts.userId) : undefined;
  const [violations, countResult] = await Promise.all([
    db.select({
      id: auctionViolations.id,
      userId: auctionViolations.userId,
      type: auctionViolations.type,
      penalty: auctionViolations.penalty,
      listingId: auctionViolations.listingId,
      orderId: auctionViolations.orderId,
      adminNote: auctionViolations.adminNote,
      banExpiresAt: auctionViolations.banExpiresAt,
      createdAt: auctionViolations.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
      .from(auctionViolations)
      .leftJoin(users, eq(auctionViolations.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auctionViolations.createdAt))
      .limit(opts.pageSize)
      .offset(offset),
    db.select({ count: sql`count(*)` })
      .from(auctionViolations)
      .where(whereClause),
  ]);
  return { violations, total: Number(countResult[0]?.count ?? 0) };
}

export async function liftAuctionBan(violationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(auctionViolations).where(eq(auctionViolations.id, violationId));
}

// ── Get auction orders needing 12-hour payment reminder ──────────────────────
export async function getAuctionOrdersNeedingPaymentReminder(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  // Orders created between 12 and 24 hours ago (still pending_payment, reminder not yet sent)
  const cutoff12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    subtotalHkd: marketplaceOrders.subtotalHkd,
    auctionListingId: (marketplaceOrders as any).auctionListingId,
    createdAt: marketplaceOrders.createdAt,
    paymentReminderSentAt: (marketplaceOrders as any).paymentReminderSentAt,
  })
    .from(marketplaceOrders)
    .where(and(
      eq(marketplaceOrders.orderStatus, 'pending_payment'),
      eq((marketplaceOrders as any).orderSource, 'auction'),
      lt(marketplaceOrders.createdAt, cutoff12h),
      gt(marketplaceOrders.createdAt, cutoff24h),
      isNull((marketplaceOrders as any).paymentReminderSentAt),
    ));
}

// ── Mark payment reminder as sent ────────────────────────────────────────────
export async function markAuctionPaymentReminderSent(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(marketplaceOrders)
    .set({ paymentReminderSentAt: new Date() } as any)
    .where(eq(marketplaceOrders.id, orderId));
}

// ─── Admin: Auction Orders ────────────────────────────────────────────────────
export async function getAdminAuctionOrders(opts: {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}): Promise<{ orders: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const buyerAlias = alias(users, 'buyerAlias2');
  const sellerAlias = alias(users, 'sellerAlias2');
  const conditions: any[] = [
    sql`${marketplaceListings.listingMode} = 'auction'`,
  ];
  if (opts.status && opts.status !== 'all') {
    conditions.push(eq(marketplaceOrders.orderStatus, opts.status as any));
  }
  if (opts.search) {
    const like2 = `%${opts.search}%`;
    conditions.push(or(
      like(marketplaceOrders.orderNo, like2),
      like(buyerAlias.name, like2),
      like(buyerAlias.email, like2),
      like(marketplaceListings.title, like2),
    ));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countRows] = await Promise.all([
    db.select({
      id: marketplaceOrders.id,
      orderNo: marketplaceOrders.orderNo,
      buyerId: marketplaceOrders.buyerId,
      sellerId: marketplaceOrders.sellerId,
      subtotalHkd: marketplaceOrders.subtotalHkd,
      paymentStatus: marketplaceOrders.paymentStatus,
      orderStatus: marketplaceOrders.orderStatus,
      paidAt: marketplaceOrders.paidAt,
      createdAt: marketplaceOrders.createdAt,
      updatedAt: marketplaceOrders.updatedAt,
      paymentReminderSentAt: (marketplaceOrders as any).paymentReminderSentAt,
      auctionListingId: (marketplaceOrders as any).auctionListingId,
      auctionWinningBidId: (marketplaceOrders as any).auctionWinningBidId,
      // Listing info
      listingTitle: marketplaceListings.title,
      listingImages: marketplaceListings.images,
      listingId: marketplaceOrders.listingId,
      // Buyer info
      buyerName: buyerAlias.name,
      buyerEmail: buyerAlias.email,
      // Seller info
      sellerDisplayName: sellerProfiles.displayName,
      sellerUserId: sellerProfiles.userId,
      sellerUserName: sellerAlias.name,
      sellerUserEmail: sellerAlias.email,
    })
      .from(marketplaceOrders)
      .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
      .leftJoin(buyerAlias, eq(marketplaceOrders.buyerId, buyerAlias.id))
      .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
      .leftJoin(sellerAlias, eq(sellerProfiles.userId, sellerAlias.id))
      .where(whereClause)
      .orderBy(desc(marketplaceOrders.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql`count(*)` })
      .from(marketplaceOrders)
      .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
      .leftJoin(buyerAlias, eq(marketplaceOrders.buyerId, buyerAlias.id))
      .where(whereClause),
  ]);
  return { orders: rows, total: Number(countRows[0]?.count ?? 0) };
}

// ─── Message Center: All Order Threads ───────────────────────────────────────
export async function getMyOrderThreads(userId: number, role: 'buyer' | 'seller'): Promise<Array<{
  orderNo: string;
  orderId: number;
  listingTitle: string | null;
  listingImage: string | null;
  counterpartyName: string | null;
  unreadCount: number;
  latestContent: string | null;
  latestAt: Date | null;
  orderStatus: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  const { orderMessages, marketplaceOrders, marketplaceListings, users: usersTable, sellerProfiles } = await import('../drizzle/schema_new');
  const { eq, desc, sql, inArray } = await import('drizzle-orm');

  const unreadCol = role === 'buyer' ? orderMessages.readByBuyer : orderMessages.readBySeller;
  const orderCondition = role === 'buyer'
    ? eq(marketplaceOrders.buyerId, userId)
    : eq(marketplaceOrders.sellerId, userId);

  const rows = await db
    .select({
      orderNo: orderMessages.orderNo,
      orderId: orderMessages.orderId,
      unreadCount: sql<number>`sum(case when ${unreadCol} = false then 1 else 0 end)`,
      latestAt: sql<Date | null>`max(${orderMessages.createdAt})`,
    })
    .from(orderMessages)
    .innerJoin(marketplaceOrders, eq(marketplaceOrders.id, orderMessages.orderId))
    .where(orderCondition)
    .groupBy(orderMessages.orderNo, orderMessages.orderId)
    .orderBy(desc(sql`max(${orderMessages.createdAt})`))
    .limit(50);

  if (rows.length === 0) return [];
  const orderIds: number[] = rows.map(r => r.orderId as number);

   const orderDetails: Array<{
    id: number;
    orderStatus: string;
    listingTitle: string | null;
    listingImages: string | null;
    buyerId: number | null;
    sellerId: number | null;
  }> = await db
    .select({
      id: marketplaceOrders.id,
      orderStatus: marketplaceOrders.orderStatus,
      listingTitle: marketplaceListings.title,
      listingImages: marketplaceListings.images,
      buyerId: marketplaceOrders.buyerId,
      sellerId: marketplaceOrders.sellerId,
    })
    .from(marketplaceOrders)
    .leftJoin(marketplaceListings, eq(marketplaceOrders.listingId, marketplaceListings.id))
    .where(inArray(marketplaceOrders.id, orderIds));
  const orderDetailMap = new Map(orderDetails.map(o => [o.id, o]));

  const counterpartyIds = orderDetails
    .map(o => role === 'buyer' ? o.sellerId : o.buyerId)
    .filter((id): id is number => id !== null && id !== undefined);

  const counterpartyMap = new Map<number, string>();
  if (counterpartyIds.length > 0) {
    if (role === 'buyer') {
      const sellerRows = await db
        .select({ userId: sellerProfiles.userId, displayName: sellerProfiles.displayName })
        .from(sellerProfiles)
        .where(inArray(sellerProfiles.userId, counterpartyIds));
      for (const s of sellerRows) counterpartyMap.set(s.userId, s.displayName);
    } else {
      const buyerRows = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(inArray(usersTable.id, counterpartyIds));
      for (const b of buyerRows) counterpartyMap.set(b.id, b.name ?? '買家');
    }
  }

  const orderNos = rows.map(r => r.orderNo);
  const latestMsgs = await db
    .select({ orderNo: orderMessages.orderNo, content: orderMessages.content, imageUrl: orderMessages.imageUrl })
    .from(orderMessages)
    .where(inArray(orderMessages.orderNo, orderNos))
    .orderBy(desc(orderMessages.createdAt));

  const latestContentMap = new Map<string, { content: string | null; imageUrl: string | null }>();
  for (const m of latestMsgs) {
    if (!latestContentMap.has(m.orderNo)) {
      latestContentMap.set(m.orderNo, { content: m.content, imageUrl: m.imageUrl ?? null });
    }
  }

  return rows.map(r => {
    const detail = orderDetailMap.get(r.orderId);
    const counterpartyId = detail ? (role === 'buyer' ? detail.sellerId : detail.buyerId) : null;
    const latestMsg = latestContentMap.get(r.orderNo);
    let listingImage: string | null = null;
    if (detail?.listingImages) {
      try {
        const imgs = JSON.parse(detail.listingImages as string);
        listingImage = Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
      } catch { listingImage = null; }
    }
    return {
      orderNo: r.orderNo,
      orderId: r.orderId,
      listingTitle: detail?.listingTitle ?? null,
      listingImage,
      counterpartyName: counterpartyId ? (counterpartyMap.get(counterpartyId) ?? null) : null,
      unreadCount: Number(r.unreadCount),
      latestContent: latestMsg?.imageUrl ? '[圖片]' : (latestMsg?.content ?? null),
      latestAt: r.latestAt,
      orderStatus: detail?.orderStatus ?? 'unknown',
    };
  });
}

/**
 * Clear all eBay cache entries for a given cardId
 */
export async function clearEbayCacheByCardId(cardId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { ebayListingsCache } = await import("../drizzle/schema_new");
  const result = await db
    .delete(ebayListingsCache)
    .where(eq(ebayListingsCache.cardId, cardId));
  return result[0].affectedRows || 0;
}

/**
 * Get statistics for snkrdunkListingsCache (on-sale listings cache)
 */
export async function getSnkrdunkListingsCacheStats() {
  const db = await getDb();
  if (!db) return null;

  const { snkrdunkListingsCache } = await import("../drizzle/schema_new");
  const now = Date.now();
  const HOT_THRESHOLD = new Date(now - 60 * 60 * 1000);       // 1 hour ago
  const COLD_THRESHOLD = new Date(now - 6 * 60 * 60 * 1000);  // 6 hours ago

  // Total cached cards
  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(snkrdunkListingsCache);
  const totalCount = Number(totalRow?.count ?? 0);

  // Hot cache (updated within 1 hour)
  const [hotRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(snkrdunkListingsCache)
    .where(sql`${snkrdunkListingsCache.createdAt} >= ${HOT_THRESHOLD}`);
  const hotCount = Number(hotRow?.count ?? 0);

  // Cold cache (1-6 hours)
  const [coldRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(snkrdunkListingsCache)
    .where(
      and(
        sql`${snkrdunkListingsCache.createdAt} < ${HOT_THRESHOLD}`,
        sql`${snkrdunkListingsCache.createdAt} >= ${COLD_THRESHOLD}`
      )
    );
  const coldCount = Number(coldRow?.count ?? 0);

  // Expired (older than 6 hours)
  const expiredCount = Math.max(0, totalCount - hotCount - coldCount);

  // Latest batch update time (most recent createdAt)
  const [latestRow] = await db
    .select({ latestAt: sql<string>`MAX(${snkrdunkListingsCache.createdAt})` })
    .from(snkrdunkListingsCache);
  const lastBatchUpdate = latestRow?.latestAt ?? null;

  // Oldest entry
  const [oldestRow] = await db
    .select({ oldestAt: sql<string>`MIN(${snkrdunkListingsCache.createdAt})` })
    .from(snkrdunkListingsCache);
  const oldestEntry = oldestRow?.oldestAt ?? null;

  return {
    totalCount,
    hotCount,
    coldCount,
    expiredCount,
    lastBatchUpdate,
    oldestEntry,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH TOKEN INDEX MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Populate the searchTokens table with tokens for ALL cards and sealed products.
 * This is a one-time operation (or periodic rebuild) that should be run from admin.
 * Processes in batches to avoid memory issues with 55k+ cards.
 */
export async function populateAllSearchTokens(): Promise<{ cardsProcessed: number; tokensCreated: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log('[SearchTokens] Starting full population...');
  const startTime = Date.now();
  let totalTokens = 0;
  let totalCards = 0;
  
  // Clear existing tokens
  await db.delete(searchTokens);
  
  // Process cards in batches of 500
  const BATCH_SIZE = 500;
  let offset = 0;
  
  while (true) {
    const cardBatch = await db
      .select({
        id: cards.id,
        name: cards.name,
        nameJa: cards.nameJa,
        cardNumber: cards.cardNumber,
        series: cards.series,
        rarity: cards.rarity,
      })
      .from(cards)
      .limit(BATCH_SIZE)
      .offset(offset);
    
    if (cardBatch.length === 0) break;
    
    const tokenData: CardTokenData[] = cardBatch.map(c => ({
      id: c.id,
      name: c.name || '',
      nameJa: c.nameJa || null,
      cardNumber: c.cardNumber || null,
      series: c.series || null,
      rarity: c.rarity || null,
      productType: 'single_card' as const,
    }));
    
    const count = await rebuildTokensForCards(db, tokenData);
    totalTokens += count;
    totalCards += cardBatch.length;
    offset += BATCH_SIZE;
    
    if (totalCards % 5000 === 0) {
      console.log(`[SearchTokens] Processed ${totalCards} cards, ${totalTokens} tokens so far...`);
    }
  }
  
  // Process sealed products
  let sealedOffset = 0;
  while (true) {
    const sealedBatch = await db
      .select({
        id: sealedProducts.id,
        name: sealedProducts.name,
        nameJa: sealedProducts.nameJa,
        cardNumber: sealedProducts.styleCode,
        series: sealedProducts.series,
        rarity: sql<string>`NULL`,
      })
      .from(sealedProducts)
      .limit(BATCH_SIZE)
      .offset(sealedOffset);
    
    if (sealedBatch.length === 0) break;
    
    const tokenData: CardTokenData[] = sealedBatch.map(c => ({
      id: c.id,
      name: c.name || '',
      nameJa: c.nameJa || null,
      cardNumber: c.cardNumber || null,
      series: c.series || null,
      rarity: null,
      productType: 'sealed_product' as const,
    }));
    
    const count = await rebuildTokensForCards(db, tokenData);
    totalTokens += count;
    totalCards += sealedBatch.length;
    sealedOffset += BATCH_SIZE;
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[SearchTokens] Population complete: ${totalCards} items, ${totalTokens} tokens in ${elapsed}ms`);
  
  return { cardsProcessed: totalCards, tokensCreated: totalTokens };
}

/**
 * Update search tokens for a single card (call after card creation or update).
 */
export async function updateSearchTokensForCard(cardId: number, productType: 'single_card' | 'sealed_product' = 'single_card'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  let cardData: CardTokenData | null = null;
  
  if (productType === 'single_card') {
    const [card] = await db.select({
      id: cards.id,
      name: cards.name,
      nameJa: cards.nameJa,
      cardNumber: cards.cardNumber,
      series: cards.series,
      rarity: cards.rarity,
    }).from(cards).where(eq(cards.id, cardId)).limit(1);
    
    if (card) {
      cardData = {
        id: card.id,
        name: card.name || '',
        nameJa: card.nameJa || null,
        cardNumber: card.cardNumber || null,
        series: card.series || null,
        rarity: card.rarity || null,
        productType: 'single_card',
      };
    }
  } else {
    const [product] = await db.select({
      id: sealedProducts.id,
      name: sealedProducts.name,
      nameJa: sealedProducts.nameJa,
      cardNumber: sealedProducts.styleCode,
      series: sealedProducts.series,
    }).from(sealedProducts).where(eq(sealedProducts.id, cardId)).limit(1);
    
    if (product) {
      cardData = {
        id: product.id,
        name: product.name || '',
        nameJa: product.nameJa || null,
        cardNumber: product.cardNumber || null,
        series: product.series || null,
        rarity: null,
        productType: 'sealed_product',
      };
    }
  }
  
  if (cardData) {
    await rebuildTokensForCards(db, [cardData]);
  }
}

/**
 * Get the count of search tokens in the database (for admin monitoring).
 */
export async function getSearchTokenCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(searchTokens);
  return Number(row?.count ?? 0);
}

// ─── TCG Market Prices (English cards - TCGPlayer / Cardmarket) ───────────────

/**
 * Get TCGPlayer / Cardmarket market reference prices for an English card.
 * Returns the latest price record for the given cardId.
 */
export async function getTcgMarketPrice(cardId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select()
    .from(tcgMarketPrices)
    .where(eq(tcgMarketPrices.cardId, cardId))
    .orderBy(desc(tcgMarketPrices.updatedAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}
