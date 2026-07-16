/**
 * User Collection - server-side logic
 * Manages user's personal card collection (private asset ledger)
 *
 * Grade mapping for market price lookup:
 *   PSA 10 → 'PSA 10'
 *   PSA 9  → 'PSA 9'
 *   PSA 8  → 'PSA 8' (fallback to PSA 10 if no data)
 *   PSA 7 / PSA 6以下 → 'PSA 8以下' (fallback to PSA 10 if no data)
 *   BGS 10 Black Label / BGS 9.5 / BGS 9 / BGS 8.5以下 → fallback to PSA 10
 *   TAG 10 / TAG 9以下 → fallback to PSA 10
 *   RAW A/B/C/D → 'A'/'B'/'C'/'D'
 *   UNGRADED → fallback to PSA 10
 */

import { getDb, batchGetCardPricesByGrades, batchGetLatestPricesByGrades, resetDb } from "./db";
import { userCollections, cards } from "../drizzle/schema_new";
import { eq, and, desc, sql, isNull } from "drizzle-orm";

// ─── Per-user collection cache (TTL 2 min, max 200 users) ─────────────────────
// Caches the full getUserCollection result keyed by userId.
// Invalidated on any write: add / update / remove / trade.
type CollectionCacheEntry = { items: CollectionItem[]; fetchedAt: number };
const _collectionCache = new Map<number, CollectionCacheEntry>();
const COLLECTION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const COLLECTION_CACHE_MAX = 200;

function getCollectionCache(userId: number): CollectionItem[] | null {
  const entry = _collectionCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > COLLECTION_CACHE_TTL_MS) {
    _collectionCache.delete(userId);
    return null;
  }
  return entry.items;
}

function setCollectionCache(userId: number, items: CollectionItem[]): void {
  if (_collectionCache.size >= COLLECTION_CACHE_MAX) {
    const oldestKey = _collectionCache.keys().next().value;
    if (oldestKey !== undefined) _collectionCache.delete(oldestKey);
  }
  _collectionCache.set(userId, { items, fetchedAt: Date.now() });
}

/** Invalidate the per-user collection cache (call after any write mutation). */
export function invalidateCollectionCache(userId: number): void {
  _collectionCache.delete(userId);
}

// ─── Grade to priceHistory.grade mapping ───────────────────────────────────────
const GRADE_TO_PRICE_GRADE: Record<string, string> = {
  "PSA 10": "PSA 10",
  "PSA 9": "PSA 9",
  "PSA 8": "PSA 8",
  "PSA 7": "PSA 8以下",
  "PSA 6以下": "PSA 8以下",
  "BGS 10 Black Label": "PSA 10",
  "BGS 9.5": "PSA 10",
  "BGS 9": "PSA 10",
  "BGS 8.5以下": "PSA 10",
  "TAG 10": "PSA 10",
  "TAG 9以下": "PSA 10",
  "A": "A",
  "B": "B",
  "C": "C",
  "D": "D",
  "UNGRADED": "PSA 10",
};

export function getMarketGrade(grade: string | null | undefined): string {
  if (!grade) return "PSA 10";
  return GRADE_TO_PRICE_GRADE[grade] ?? "PSA 10";
}

export function isFallbackGrade(grade: string | null | undefined): boolean {
  if (!grade) return true;
  const mapped = GRADE_TO_PRICE_GRADE[grade];
  if (!mapped) return true;
  return mapped !== grade;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface CollectionItemRaw {
  id: number;
  userId: number;
  cardId: number;
  grader: string;
  grade: string | null;
  quantity: number;
  purchasePrice: string | null;
  purchasedAt: Date | null;
  notes: string | null;
  isPublic: boolean;
  tradedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Card info
  cardName: string | null;
  cardNameJa: string | null;
  cardNumber: string | null;
  series: string | null;
  setName: string | null;
  rarity: string | null;
  imageUrl: string | null;
}

export interface CollectionItem {
  id: number;
  grader: string;
  grade: string | null;
  quantity: number;
  tradedAt: Date | null;
  purchasePrice: number | null;
  purchasedAt: Date | null;
  notes: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  card: {
    id: number;
    name: string | null;
    nameJa: string | null;
    cardNumber: string | null;
    series: string | null;
    setName: string | null;
    rarity: string | null;
    imageUrl: string | null;
  };
  marketPrice: number | null;
  marketGrade: string;
  isFallbackPrice: boolean;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
}

export interface CollectionStats {
  totalItems: number;
  totalQuantity: number;
  totalCost: number;
  totalMarketValue: number;
  totalGain: number;
  totalGainPct: number;
  top3Gainers: CollectionItem[];
  top3ByValue: CollectionItem[];
  top5ByValue: CollectionItem[];
  currency: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function enrichItem(raw: CollectionItemRaw, marketPrice: number | null): CollectionItem {
  const purchasePrice = raw.purchasePrice != null ? parseFloat(raw.purchasePrice) : null;
  const mGrade = getMarketGrade(raw.grade);
  const isFallback = isFallbackGrade(raw.grade);

  let unrealizedGain: number | null = null;
  let unrealizedGainPct: number | null = null;

  if (purchasePrice != null && marketPrice != null) {
    unrealizedGain = (marketPrice - purchasePrice) * raw.quantity;
    unrealizedGainPct = purchasePrice > 0
      ? ((marketPrice - purchasePrice) / purchasePrice) * 100
      : null;
  }

  return {
    id: raw.id,
    grader: raw.grader,
    grade: raw.grade,
    quantity: raw.quantity,
    purchasePrice,
    purchasedAt: raw.purchasedAt,
    notes: raw.notes,
    isPublic: raw.isPublic,
    tradedAt: raw.tradedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    card: {
      id: raw.cardId,
      name: raw.cardName,
      nameJa: raw.cardNameJa,
      cardNumber: raw.cardNumber,
      series: raw.series,
      setName: raw.setName,
      rarity: raw.rarity,
      imageUrl: raw.imageUrl,
    },
    marketPrice,
    marketGrade: mGrade,
    isFallbackPrice: isFallback,
    unrealizedGain,
    unrealizedGainPct: unrealizedGainPct != null ? Math.round(unrealizedGainPct * 10) / 10 : null,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Get all collection items for a user with market prices
 */
export async function getUserCollection(
  userId: number,
  options?: {
    sortBy?: "marketValue" | "gain" | "purchasedAt" | "createdAt";
    sortOrder?: "asc" | "desc";
    grader?: string;
    series?: string;
    priceMode?: "psa10" | "grade"; // psa10 = always show PSA 10 price, grade = show grade-matched price
    showTraded?: boolean; // if true, return only traded-away items; if false/undefined, return active items
    skipCache?: boolean; // bypass cache (used by CSV export, PDF export, etc.)
  }
): Promise<CollectionItem[]> {
  // ── Cache hit (only for default active-items, grade-mode, no extra filters) ──
  // We cache the full sorted-by-createdAt list and apply in-memory sort/filter on top.
  // This avoids repeated DB + priceHistory queries on every page flip or stats reload.
  const isCacheable =
    !options?.showTraded &&
    !options?.skipCache &&
    (options?.priceMode ?? "psa10") === "grade" &&
    !options?.grader &&
    !options?.series;

  if (isCacheable) {
    const cached = getCollectionCache(userId);
    if (cached) {
      // Apply sort/filter on the cached list
      let items = [...cached];
      if (options?.grader) items = items.filter((i) => i.grader === options.grader);
      if (options?.series) items = items.filter((i) => i.card.series === options.series);
      const order = options?.sortOrder === "asc" ? 1 : -1;
      switch (options?.sortBy) {
        case "marketValue":
          items.sort((a, b) => order * ((a.marketPrice ?? 0) - (b.marketPrice ?? 0)));
          break;
        case "gain":
          items.sort((a, b) => order * ((a.unrealizedGainPct ?? -Infinity) - (b.unrealizedGainPct ?? -Infinity)));
          break;
        case "purchasedAt":
          items.sort((a, b) => order * ((a.purchasedAt?.getTime() ?? 0) - (b.purchasedAt?.getTime() ?? 0)));
          break;
        case "createdAt":
        default:
          items.sort((a, b) => order * (a.createdAt.getTime() - b.createdAt.getTime()));
          break;
      }
      return items;
    }
  }
  // Helper to run the main SELECT (used for retry after reconnect)
  async function fetchRows(dbInst: any) {
    return dbInst
      .select({
        id: userCollections.id,
        userId: userCollections.userId,
        cardId: userCollections.cardId,
        grader: userCollections.grader,
        grade: userCollections.grade,
        quantity: userCollections.quantity,
        purchasePrice: userCollections.purchasePrice,
        purchasedAt: userCollections.purchasedAt,
        notes: userCollections.notes,
        isPublic: userCollections.isPublic,
        tradedAt: userCollections.tradedAt,
        createdAt: userCollections.createdAt,
        updatedAt: userCollections.updatedAt,
        cardName: cards.name,
        cardNameJa: cards.nameJa,
        cardNumber: cards.cardNumber,
        series: cards.series,
        setName: cards.setName,
        rarity: cards.rarity,
        imageUrl: cards.imageUrl,
      })
      .from(userCollections)
      .leftJoin(cards, eq(userCollections.cardId, cards.id))
      .where(
        options?.showTraded
          ? and(eq(userCollections.userId, userId), sql`${userCollections.tradedAt} IS NOT NULL`)
          : and(eq(userCollections.userId, userId), isNull(userCollections.tradedAt))
      )
      .orderBy(desc(userCollections.createdAt));
  }

  let db = await getDb();
  if (!db) throw new Error('Database unavailable');

  let rows: any[];
  try {
    rows = await fetchRows(db);
  } catch (err: any) {
    const isConnErr = ['PROTOCOL_CONNECTION_LOST', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err?.code);
    if (isConnErr) {
      console.warn('[Collection] DB connection lost, resetting and retrying once...', err.code);
      resetDb();
      db = await getDb();
      if (!db) throw new Error('Database unavailable after reconnect');
      rows = await fetchRows(db);
    } else {
      throw err;
    }
  }

  // Batch fetch market prices (avoid N+1)
  const priceMode = options?.priceMode ?? "psa10";
  const uniqueCardGrades = new Map<string, { cardId: number; grade: string }>();
  for (const row of rows) {
    const lookupGrade = priceMode === "grade" ? getMarketGrade(row.grade) : "PSA 10";
    const key = `${row.cardId}:${lookupGrade}`;
    if (!uniqueCardGrades.has(key)) {
      uniqueCardGrades.set(key, { cardId: row.cardId, grade: lookupGrade });
    }
  }

  // Single batch SQL query — replaces N parallel getCardPriceByGrade() calls
  // This prevents DB connection pool exhaustion under concurrent user load
  const requests = Array.from(uniqueCardGrades.values());
  // Use latest single transaction price (not average) for real-time Vault market value
  const priceCache = await batchGetLatestPricesByGrades(requests);

  let items = rows.map((row) => {
    const lookupGrade = priceMode === "grade" ? getMarketGrade(row.grade) : "PSA 10";
    const key = `${row.cardId}:${lookupGrade}`;
    const marketPrice = priceCache.get(key) ?? null;
    return enrichItem(row as CollectionItemRaw, marketPrice);
  });

  // Apply filters
  if (options?.grader) {
    items = items.filter((i) => i.grader === options.grader);
  }
  if (options?.series) {
    items = items.filter((i) => i.card.series === options.series);
  }

  // Apply sort
  const order = options?.sortOrder === "asc" ? 1 : -1;
  switch (options?.sortBy) {
    case "marketValue":
      items.sort((a, b) => order * ((a.marketPrice ?? 0) - (b.marketPrice ?? 0)));
      break;
    case "gain":
      items.sort((a, b) => order * ((a.unrealizedGainPct ?? -Infinity) - (b.unrealizedGainPct ?? -Infinity)));
      break;
    case "purchasedAt":
      items.sort((a, b) => {
        const ta = a.purchasedAt?.getTime() ?? 0;
        const tb = b.purchasedAt?.getTime() ?? 0;
        return order * (ta - tb);
      });
      break;
    case "createdAt":
    default:
      items.sort((a, b) => order * (a.createdAt.getTime() - b.createdAt.getTime()));
      break;
  }

  // Store in cache if cacheable (always use grade mode for cache)
  if (isCacheable) {
    setCollectionCache(userId, items);
  }

  return items;
}

/**
 * Get collection statistics for a user
 */
export async function getUserCollectionStats(userId: number): Promise<CollectionStats> {
  // Reuse cached collection data if available (avoids double DB query on Vault load)
  const items = await getUserCollection(userId, { priceMode: "grade" });

  const totalItems = items.length;
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const totalCost = items.reduce((s, i) => {
    if (i.purchasePrice != null) return s + i.purchasePrice * i.quantity;
    return s;
  }, 0);
  const totalMarketValue = items.reduce((s, i) => {
    if (i.marketPrice != null) return s + i.marketPrice * i.quantity;
    return s;
  }, 0);
  const totalGain = totalMarketValue - totalCost;
  const totalGainPct = totalCost > 0 ? Math.round((totalGain / totalCost) * 1000) / 10 : 0;

  const top3Gainers = [...items]
    .filter((i) => i.unrealizedGainPct != null)
    .sort((a, b) => (b.unrealizedGainPct ?? 0) - (a.unrealizedGainPct ?? 0))
    .slice(0, 3);

  const top5ByValue = [...items]
    .filter((i) => i.marketPrice != null)
    .sort((a, b) => (b.marketPrice ?? 0) - (a.marketPrice ?? 0))
    .slice(0, 5);
  const top3ByValue = top5ByValue.slice(0, 3);

  return {
    totalItems,
    totalQuantity,
    totalCost: Math.round(totalCost * 100) / 100,
    totalMarketValue: Math.round(totalMarketValue * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
    totalGainPct,
    top3Gainers,
    top3ByValue,
    top5ByValue,
    currency: "HKD",
  };
}

/**
 * Add a card to user's collection
 */
export async function addToCollection(
  userId: number,
  data: {
    cardId: number;
    grader: string;
    grade?: string | null;
    quantity?: number;
    purchasePrice?: number | null;
    purchasedAt?: Date | null;
    notes?: string | null;
    isPublic?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db.insert(userCollections).values({
    userId,
    cardId: data.cardId,
    grader: data.grader,
    grade: data.grade ?? null,
    quantity: data.quantity ?? 1,
    purchasePrice: data.purchasePrice != null ? String(data.purchasePrice) : null,
    purchasedAt: data.purchasedAt ?? null,
    notes: data.notes ?? null,
    isPublic: data.isPublic ?? false,
  });

  invalidateCollectionCache(userId);
  return { success: true };
}

/**
 * Update a collection item (only owner can update)
 */
export async function updateCollectionItem(
  userId: number,
  itemId: number,
  data: {
    grader?: string;
    grade?: string | null;
    quantity?: number;
    purchasePrice?: number | null;
    purchasedAt?: Date | null;
    notes?: string | null;
    isPublic?: boolean;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Verify ownership
  const existing = await db
    .select({ id: userCollections.id })
    .from(userCollections)
    .where(and(eq(userCollections.id, itemId), eq(userCollections.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Collection item not found or access denied");
  }

  const updateData: Record<string, unknown> = {};
  if (data.grader !== undefined) updateData.grader = data.grader;
  if (data.grade !== undefined) updateData.grade = data.grade;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.purchasePrice !== undefined) {
    updateData.purchasePrice = data.purchasePrice != null ? String(data.purchasePrice) : null;
  }
  if (data.purchasedAt !== undefined) updateData.purchasedAt = data.purchasedAt;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

  await db
    .update(userCollections)
    .set(updateData)
    .where(and(eq(userCollections.id, itemId), eq(userCollections.userId, userId)));

  invalidateCollectionCache(userId);
  return { success: true };
}

/**
 * Remove a collection item (only owner can remove)
 */
export async function removeFromCollection(userId: number, itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await db
    .select({ id: userCollections.id })
    .from(userCollections)
    .where(and(eq(userCollections.id, itemId), eq(userCollections.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Collection item not found or access denied");
  }

  await db
    .delete(userCollections)
    .where(and(eq(userCollections.id, itemId), eq(userCollections.userId, userId)));

  invalidateCollectionCache(userId);
  return { success: true };
}
