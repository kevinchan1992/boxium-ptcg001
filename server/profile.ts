import { getDb } from "./db";
import { watchlist, viewHistory, cards, priceHistory } from "../drizzle/schema_new";
import { eq, desc, and, sql } from "drizzle-orm";

/**
 * Watchlist operations
 */

// Get user's watchlist with card details and latest prices
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

// Check if card is in user's watchlist
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

// Add card to watchlist
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

// Update watchlist item notes
export async function updateWatchlistNotes(userId: number, watchlistId: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .update(watchlist)
    .set({ notes })
    .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)));

  return result;
}

// Remove from watchlist by watchlist ID
export async function removeFromWatchlist(userId: number, watchlistId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .delete(watchlist)
    .where(and(eq(watchlist.id, watchlistId), eq(watchlist.userId, userId)));

  return result;
}

// Remove from watchlist by card ID
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

// Add view history record
export async function addViewHistory(userId: number, cardId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(viewHistory).values({
    userId,
    cardId,
  });

  return result;
}

// Get user's view history (last 50 records)
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

  return result;
}

// Clear user's view history
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

// Get user's watchlist statistics
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
