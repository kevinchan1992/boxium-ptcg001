/**
 * Card Trades — DB helpers for card-for-card trade records
 * One trade = N cards given out + M cards received
 */
import { getDb } from "./db";
import { cardTrades, cardTradeItems, userCollections, cards } from "../drizzle/schema_new";
import { eq, and, desc, inArray } from "drizzle-orm";

export interface TradeItemInput {
  direction: "in" | "out";
  cardId: number;
  cardName: string;
  grader: string;
  grade?: string | null;
  quantity?: number;
  estimatedValue?: number | null;
  // For 'out' items: existing collection entry to mark as traded
  collectionId?: number | null;
}

export interface CreateTradeInput {
  tradedAt: Date;
  tradePartner?: string | null;
  cashAdjustment?: number | null; // positive = received cash, negative = paid cash
  notes?: string | null;
  items: TradeItemInput[];
}

/**
 * Create a new trade record.
 * - 'out' items: marks collection entries as traded (adds note)
 * - 'in' items: creates new collection entries with purchasePrice = estimated market value of 'out' cards
 */
export async function createCardTrade(userId: number, input: CreateTradeInput) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // 1. Calculate total estimated value of 'out' cards (used as cost basis for 'in' cards)
  const outItems = input.items.filter((i) => i.direction === "out");
  const inItems = input.items.filter((i) => i.direction === "in");
  const totalOutValue = outItems.reduce((sum, i) => sum + (i.estimatedValue ?? 0) * (i.quantity ?? 1), 0);
  const cashAdj = input.cashAdjustment ?? 0;
  // Net cost for 'in' cards = value of cards given + cash paid (or minus cash received)
  const netCostForIn = totalOutValue - cashAdj; // cashAdj positive = received cash → reduces cost

  // 2. Insert trade header
  const [tradeResult] = await db.insert(cardTrades).values({
    userId,
    tradedAt: input.tradedAt,
    tradePartner: input.tradePartner ?? null,
    cashAdjustment: cashAdj !== 0 ? String(cashAdj) : "0",
    notes: input.notes ?? null,
  });
  const tradeId = Number((tradeResult as any).insertId);

  // 3. Process each item
  const createdCollectionIds: number[] = [];

  for (const item of input.items) {
    let newCollectionId: number | null = null;

    if (item.direction === "in") {
      // Distribute net cost evenly across 'in' items (by quantity)
      const totalInQty = inItems.reduce((s, i) => s + (i.quantity ?? 1), 0);
      const thisCost = totalInQty > 0 ? (netCostForIn * (item.quantity ?? 1)) / totalInQty : 0;

      // Create collection entry for received card
      const tradeNote = `以卡換卡取得 (${input.tradedAt.toLocaleDateString("zh-HK")})${input.tradePartner ? ` — 對方：${input.tradePartner}` : ""}`;
      const [colResult] = await db.insert(userCollections).values({
        userId,
        cardId: item.cardId,
        grader: item.grader,
        grade: item.grade ?? null,
        quantity: item.quantity ?? 1,
        purchasePrice: thisCost > 0 ? String(Math.round(thisCost * 100) / 100) : null,
        purchasedAt: input.tradedAt,
        notes: tradeNote,
        isPublic: false,
      });
      newCollectionId = Number((colResult as any).insertId);
      createdCollectionIds.push(newCollectionId);
    } else if (item.direction === "out" && item.collectionId) {
      // Mark the traded-out collection entry with tradedAt timestamp
      await db.update(userCollections)
        .set({ tradedAt: input.tradedAt })
        .where(and(eq(userCollections.id, item.collectionId), eq(userCollections.userId, userId)));
    }

    // Insert trade item record
    await db.insert(cardTradeItems).values({
      tradeId,
      direction: item.direction,
      collectionId: item.collectionId ?? null,
      cardId: item.cardId,
      cardName: item.cardName,
      grader: item.grader,
      grade: item.grade ?? null,
      quantity: item.quantity ?? 1,
      estimatedValue: item.estimatedValue != null ? String(item.estimatedValue) : null,
      newCollectionId,
    });
  }

  return { tradeId, createdCollectionIds };
}

/**
 * Get all trade records for a user (with items + card image info)
 */
export async function getUserTrades(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const trades = await db
    .select()
    .from(cardTrades)
    .where(eq(cardTrades.userId, userId))
    .orderBy(desc(cardTrades.tradedAt));

  if (trades.length === 0) return [];

  const tradeIds = trades.map((t) => t.id);
  // Join with cards table to get imageUrl for each trade item
  const itemsWithCard = await db
    .select({
      id: cardTradeItems.id,
      tradeId: cardTradeItems.tradeId,
      direction: cardTradeItems.direction,
      collectionId: cardTradeItems.collectionId,
      cardId: cardTradeItems.cardId,
      cardName: cardTradeItems.cardName,
      grader: cardTradeItems.grader,
      grade: cardTradeItems.grade,
      quantity: cardTradeItems.quantity,
      estimatedValue: cardTradeItems.estimatedValue,
      newCollectionId: cardTradeItems.newCollectionId,
      createdAt: cardTradeItems.createdAt,
      cardImageUrl: cards.imageUrl,
      cardSeries: cards.series,
    })
    .from(cardTradeItems)
    .leftJoin(cards, eq(cardTradeItems.cardId, cards.id))
    .where(inArray(cardTradeItems.tradeId, tradeIds));

  return trades.map((trade) => ({
    ...trade,
    items: itemsWithCard.filter((i) => i.tradeId === trade.id),
  }));
}

/**
 * Get a single trade record by ID (must belong to user)
 */
export async function getTradeById(userId: number, tradeId: number) {
  const db = await getDb();
  if (!db) return null;

  const [trade] = await db
    .select()
    .from(cardTrades)
    .where(and(eq(cardTrades.id, tradeId), eq(cardTrades.userId, userId)));

  if (!trade) return null;

  const items = await db
    .select()
    .from(cardTradeItems)
    .where(eq(cardTradeItems.tradeId, tradeId));

  return { ...trade, items };
}

/**
 * Delete a trade record and its items (also removes auto-created collection entries)
 */
export async function deleteCardTrade(userId: number, tradeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Verify ownership
  const [trade] = await db
    .select()
    .from(cardTrades)
    .where(and(eq(cardTrades.id, tradeId), eq(cardTrades.userId, userId)));

  if (!trade) throw new Error("Trade not found");

  // Get 'in' items to remove their auto-created collection entries
  const items = await db
    .select()
    .from(cardTradeItems)
    .where(eq(cardTradeItems.tradeId, tradeId));

  const newColIds = items
    .filter((i) => i.direction === "in" && i.newCollectionId)
    .map((i) => i.newCollectionId!);

  if (newColIds.length > 0) {
    await db.delete(userCollections).where(
      and(
        inArray(userCollections.id, newColIds),
        eq(userCollections.userId, userId)
      )
    );
  }

  await db.delete(cardTradeItems).where(eq(cardTradeItems.tradeId, tradeId));
  await db.delete(cardTrades).where(eq(cardTrades.id, tradeId));

  return { success: true };
}

/**
 * Get trade records linked to a specific collection item
 */
export async function getTradesForCollectionItem(userId: number, collectionId: number) {
  const db = await getDb();
  if (!db) return [];

  // Find trade items that reference this collection (either as 'out' source or 'in' result)
  const tradeItemRows = await db
    .select()
    .from(cardTradeItems)
    .where(
      eq(cardTradeItems.newCollectionId, collectionId)
    );

  if (tradeItemRows.length === 0) return [];

  const tradeIds = Array.from(new Set(tradeItemRows.map((i) => i.tradeId))) as number[];
  if (tradeIds.length === 0) return [];
  const trades = await db
    .select()
    .from(cardTrades)
    .where(and(inArray(cardTrades.id, tradeIds), eq(cardTrades.userId, userId)));

  const allItems = await db
    .select()
    .from(cardTradeItems)
    .where(inArray(cardTradeItems.tradeId, tradeIds));

  return trades.map((trade) => ({
    ...trade,
    items: allItems.filter((i) => i.tradeId === trade.id),
  }));
}
