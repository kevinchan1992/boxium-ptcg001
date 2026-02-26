import { getDb } from "./db";
import { watchlist, viewHistory, cards, priceHistory } from "../drizzle/schema_new";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * Type Definitions
 * 
 * These types define the expected structure of data returned by profile API functions.
 * Frontend components (Profile.tsx) rely on these structures.
 */

/**
 * Card object structure used in watchlist and view history
 * @typedef {Object} CardInfo
 * @property {number} id - Card ID
 * @property {string} name - Card name
 * @property {string | null} cardNumber - Card number
 * @property {string | null} series - Series name
 * @property {string | null} setName - Set name (watchlist only)
 * @property {string | null} rarity - Rarity (watchlist only)
 * @property {string | null} imageUrl - Card image URL
 */

/**
 * Watchlist item structure
 * @typedef {Object} WatchlistItem
 * @property {number} id - Watchlist entry ID
 * @property {string | null} notes - User notes
 * @property {Date} createdAt - When added to watchlist
 * @property {CardInfo} card - Nested card object
 * @property {number | null} latestPrice - Latest price value
 * @property {string} currency - Price currency (default: 'HKD')
 */

/**
 * View history item structure
 * @typedef {Object} ViewHistoryItem
 * @property {number} id - View history entry ID
 * @property {Date} viewedAt - When card was viewed
 * @property {CardInfo} card - Nested card object (without setName and rarity)
 */

/**
 * Watchlist statistics structure
 * @typedef {Object} WatchlistStats
 * @property {number} totalCount - Total number of cards in watchlist
 * @property {number} totalValue - Total value of all cards
 * @property {string} currency - Currency code
 * @property {WatchlistItem[]} top5Cards - Top 5 most valuable cards
 */

/**
 * Watchlist operations
 */

/**
 * Get user's watchlist with card details and latest prices
 * @param {number} userId - User ID
 * @returns {Promise<WatchlistItem[]>} Array of watchlist items with nested card objects
 */
export async function getUserWatchlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: watchlist.id,
      cardId: watchlist.cardId,
      notes: watchlist.notes,
      createdAt: watchlist.createdAt,
      // Card details
      cardName: cards.name,
      cardNumber: cards.cardNumber,
      series: cards.series,
      setName: cards.setName,
      rarity: cards.rarity,
      imageUrl: cards.imageUrl,
      // Latest price (will be fetched separately)
    })
    .from(watchlist)
    .leftJoin(cards, eq(watchlist.cardId, cards.id))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt));

  // Fetch latest prices for each card and restructure data
  const watchlistWithPrices = await Promise.all(
    result.map(async (item) => {
      const latestPrice = await db
        .select({
          price: priceHistory.price,
          currency: priceHistory.currency,
          source: priceHistory.source,
          soldAt: priceHistory.soldAt,
        })
        .from(priceHistory)
        .where(eq(priceHistory.cardId, item.cardId!))
        .orderBy(desc(priceHistory.soldAt))
        .limit(1);

      // Restructure to match frontend expectations
      return {
        id: item.id,
        notes: item.notes,
        createdAt: item.createdAt,
        card: {
          id: item.cardId,
          name: item.cardName,
          cardNumber: item.cardNumber,
          series: item.series,
          setName: item.setName,
          rarity: item.rarity,
          imageUrl: item.imageUrl,
        },
        latestPrice: latestPrice[0]?.price || null,
        currency: latestPrice[0]?.currency || 'HKD',
      };
    })
  );

  return watchlistWithPrices;
}

/**
 * Check if card is in user's watchlist
 * @param {number} userId - User ID
 * @param {number} cardId - Card ID
 * @returns {Promise<boolean>} True if card is in watchlist
 */
export async function isCardInWatchlist(userId: number, cardId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.cardId, cardId)))
    .limit(1);

  return result.length > 0;
}

/**
 * Add card to watchlist
 * @param {number} userId - User ID
 * @param {number} cardId - Card ID
 * @param {string} [notes] - Optional user notes
 * @returns {Promise<any>} Database insert result
 * @throws {Error} If card is already in watchlist or database is unavailable
 */
export async function addToWatchlist(userId: number, cardId: number, notes?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if already in watchlist
  const existing = await db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.cardId, cardId)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Card already in watchlist");
  }

  const result = await db.insert(watchlist).values({
    userId,
    cardId,
    notes: notes || null,
    currency: "HKD",
  });

  return result;
}

/**
 * Update watchlist item notes
 * @param {number} userId - User ID
 * @param {number} watchlistId - Watchlist entry ID
 * @param {string} notes - New notes content
 * @returns {Promise<any>} Database update result
 * @throws {Error} If database is unavailable
 */
export async function updateWatchlistNotes(userId: number, watchlistId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .update(watchlist)
    .set({ notes })
    .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)));

  return result;
}

/**
 * Remove from watchlist by watchlist ID
 * @param {number} userId - User ID
 * @param {number} watchlistId - Watchlist entry ID
 * @returns {Promise<any>} Database delete result
 * @throws {Error} If database is unavailable
 */
export async function removeFromWatchlist(userId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)));

  return result;
}

/**
 * Remove from watchlist by card ID
 * @param {number} userId - User ID
 * @param {number} cardId - Card ID
 * @returns {Promise<any>} Database delete result
 * @throws {Error} If database is unavailable
 */
export async function removeFromWatchlistByCardId(userId: number, cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, userId), eq(watchlist.cardId, cardId)));

  return result;
}

/**
 * View history operations
 */

/**
 * Add view history record
 * @param {number} userId - User ID
 * @param {number} cardId - Card ID
 * @returns {Promise<any>} Database insert result
 * @throws {Error} If database is unavailable
 */
export async function addViewHistory(userId: number, cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(viewHistory).values({
    userId,
    cardId,
  });

  return result;
}

/**
 * Get user's view history with card details
 * @param {number} userId - User ID
 * @param {number} [limit=50] - Maximum number of records to return
 * @returns {Promise<ViewHistoryItem[]>} Array of view history items with nested card objects
 * 
 * **Important:** Returns array of objects with structure:
 * ```
 * {
 *   id: number,
 *   viewedAt: Date,
 *   card: {
 *     id: number,
 *     name: string,
 *     cardNumber: string | null,
 *     series: string | null,
 *     imageUrl: string | null
 *   }
 * }
 * ```
 * Frontend expects `item.card.id` and `item.card.name`, NOT `item.cardId` or `item.cardName`.
 */
export async function getUserViewHistory(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: viewHistory.id,
      cardId: viewHistory.cardId,
      viewedAt: viewHistory.viewedAt,
      // Card details
      cardName: cards.name,
      cardNumber: cards.cardNumber,
      series: cards.series,
      imageUrl: cards.imageUrl,
    })
    .from(viewHistory)
    .leftJoin(cards, eq(viewHistory.cardId, cards.id))
    .where(eq(viewHistory.userId, userId))
    .orderBy(desc(viewHistory.viewedAt))
    .limit(limit);

  // Restructure to match frontend expectations
  const historyWithCardDetails = result.map((item) => ({
    id: item.id,
    viewedAt: item.viewedAt,
    card: {
      id: item.cardId,
      name: item.cardName,
      cardNumber: item.cardNumber,
      series: item.series,
      imageUrl: item.imageUrl,
    },
  }));

  return historyWithCardDetails;
}

/**
 * Clear user's view history
 * @param {number} userId - User ID
 * @returns {Promise<any>} Database delete result
 * @throws {Error} If database is unavailable
 */
export async function clearViewHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(viewHistory)
    .where(eq(viewHistory.userId, userId));

  return result;
}

/**
 * User statistics
 */

/**
 * Get user's watchlist statistics
 * @param {number} userId - User ID
 * @returns {Promise<WatchlistStats>} Statistics object with total count, value, and top 5 cards
 */
export async function getUserWatchlistStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalCount: 0, totalValue: 0, currency: "HKD", top5Cards: [] };
  
  // Get total watchlist count
  const watchlistCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(watchlist)
    .where(eq(watchlist.userId, userId));

  // Get total value (sum of latest prices)
  const watchlistItems = await getUserWatchlist(userId);
  
  const totalValue = watchlistItems.reduce((sum: number, item: any) => {
    if (item.latestPrice && item.latestPrice.price) {
      return sum + parseFloat(item.latestPrice.price);
    }
    return sum;
  }, 0);

  // Get top 5 most valuable cards
  const top5Cards = watchlistItems
    .filter((item: any) => item.latestPrice && item.latestPrice.price)
    .sort((a: any, b: any) => {
      const priceA = parseFloat(a.latestPrice?.price || "0");
      const priceB = parseFloat(b.latestPrice?.price || "0");
      return priceB - priceA;
    })
    .slice(0, 5);

  return {
    totalCount: watchlistCount[0]?.count || 0,
    totalValue,
    currency: "HKD",
    top5Cards,
  };
}
