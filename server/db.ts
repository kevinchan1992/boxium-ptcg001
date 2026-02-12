import { eq, desc, and, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, cards, priceHistory, auctions, bids, offers, reviews, watchlist } from "../drizzle/schema";
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
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

// Price history queries
export async function getPriceHistory(cardId: number, source?: string, grade?: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(priceHistory.cardId, cardId)];
  
  if (source) {
    conditions.push(eq(priceHistory.source, source as any));
  }
  
  if (grade) {
    conditions.push(eq(priceHistory.grade, grade));
  }

  const result = await db
    .select()
    .from(priceHistory)
    .where(and(...conditions))
    .orderBy(desc(priceHistory.soldAt))
    .limit(limit);

  return result;
}

// Auction queries
export async function getActiveAuctions(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(auctions)
    .where(eq(auctions.status, "active"))
    .orderBy(desc(auctions.createdAt))
    .limit(limit);

  return result;
}

export async function getAuctionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(auctions).where(eq(auctions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Bid queries
export async function getBidsByAuctionId(auctionId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.createdAt));

  return result;
}

// Offer queries
export async function getActiveOffers(cardId?: number, type?: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(offers.status, "active")];
  
  if (cardId) {
    conditions.push(eq(offers.cardId, cardId));
  }
  
  if (type) {
    conditions.push(eq(offers.type, type as any));
  }

  const result = await db
    .select()
    .from(offers)
    .where(and(...conditions))
    .orderBy(desc(offers.createdAt))
    .limit(limit);

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
