import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cardInventory, cards } from "../../drizzle/schema_new";
import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm";

// Exchange rate fetcher (simple static fallback + optional live fetch)
async function getExchangeRate(from: "JPY" | "USD", to: "HKD"): Promise<number> {
  // Static fallback rates (approximate)
  const fallback: Record<string, number> = {
    "JPY_HKD": 0.053,
    "USD_HKD": 7.78,
  };
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.rates?.[to] ?? fallback[`${from}_${to}`];
    }
  } catch {
    // Use fallback
  }
  return fallback[`${from}_${to}`] ?? 1;
}

function toHkd(amount: number, currency: "HKD" | "JPY" | "USD", rate: number): number {
  if (currency === "HKD") return amount;
  return Math.round(amount * rate * 100) / 100;
}

export const cardInventoryRouter = router({
  // Get exchange rates for frontend display
  getExchangeRates: adminProcedure.query(async () => {
    const jpyRate = await getExchangeRate("JPY", "HKD");
    const usdRate = await getExchangeRate("USD", "HKD");
    return { JPY: jpyRate, USD: usdRate, HKD: 1 };
  }),

  // List records with filters
  list: adminProcedure
    .input(z.object({
      status: z.enum(["all", "holding", "sold"]).default("all"),
      itemType: z.enum(["all", "card", "sealed"]).default("all"),
      search: z.string().optional(),
      year: z.number().optional(),
      month: z.number().optional(), // 1-12
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.status !== "all") conditions.push(eq(cardInventory.status, input.status));
      if (input.itemType !== "all") conditions.push(eq(cardInventory.itemType, input.itemType));
      if (input.search) {
        const searchCond = or(
          like(cardInventory.cardName, `%${input.search}%`),
          like(cardInventory.cardSet, `%${input.search}%`),
        );
        if (searchCond) conditions.push(searchCond);
      }
      if (input.year && input.month) {
        const start = new Date(input.year, input.month - 1, 1);
        const end = new Date(input.year, input.month, 1);
        conditions.push(gte(cardInventory.buyDate, start));
        conditions.push(lte(cardInventory.buyDate, end));
      } else if (input.year) {
        const start = new Date(input.year, 0, 1);
        const end = new Date(input.year + 1, 0, 1);
        conditions.push(gte(cardInventory.buyDate, start));
        conditions.push(lte(cardInventory.buyDate, end));
      }

      const offset = (input.page - 1) * input.pageSize;
      const where = conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>])) : undefined;

      const [rawItems, countResult] = await Promise.all([
        db.select().from(cardInventory)
          .where(where)
          .orderBy(desc(cardInventory.buyDate))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(cardInventory).where(where),
      ]);

      // Auto-fill imageUrl from linked cards table when missing
      const linkedIds = rawItems
        .filter(i => !i.imageUrl && i.linkedCardId)
        .map(i => i.linkedCardId as number);
      let cardImageMap: Record<number, string> = {};
      if (linkedIds.length > 0) {
        const cardImages = await db
          .select({ id: cards.id, imageUrl: cards.imageUrl })
          .from(cards)
          .where(sql`${cards.id} IN (${sql.join(linkedIds.map(id => sql`${id}`), sql`, `)})`);
        cardImageMap = Object.fromEntries(cardImages.map(c => [c.id, c.imageUrl ?? ""]));
      }
      const items = rawItems.map(item => ({
        ...item,
        imageUrl: item.imageUrl || (item.linkedCardId ? (cardImageMap[item.linkedCardId] ?? null) : null),
      }));

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Create a new buy record
  create: adminProcedure
    .input(z.object({
      itemType: z.enum(["card", "sealed"]).default("card"),
      cardName: z.string().min(1).max(512),
      cardSet: z.string().max(256).optional(),
      cardNumber: z.string().max(64).optional(),
      grade: z.string().max(32).optional(),
      buyPriceCurrency: z.enum(["HKD", "JPY", "USD"]).default("HKD"),
      buyPriceOriginal: z.number().positive(),
      buyDate: z.string(), // ISO date string
      buySource: z.string().max(256).optional(),
      notes: z.string().optional(),
      imageUrl: z.string().optional(),
      linkedCardId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      let buyExchangeRate = 1;
      let buyPriceHkd = input.buyPriceOriginal;
      if (input.buyPriceCurrency !== "HKD") {
        buyExchangeRate = await getExchangeRate(input.buyPriceCurrency, "HKD");
        buyPriceHkd = toHkd(input.buyPriceOriginal, input.buyPriceCurrency, buyExchangeRate);
      }

      const [result] = await db.insert(cardInventory).values({
        itemType: input.itemType,
        cardName: input.cardName,
        cardSet: input.cardSet ?? null,
        cardNumber: input.cardNumber ?? null,
        grade: input.grade ?? null,
        buyPriceCurrency: input.buyPriceCurrency,
        buyPriceOriginal: String(input.buyPriceOriginal),
        buyPriceHkd: String(buyPriceHkd),
        buyExchangeRate: String(buyExchangeRate),
        buyDate: new Date(input.buyDate),
        buySource: input.buySource ?? null,
        status: "holding",
        notes: input.notes ?? null,
        imageUrl: input.imageUrl ?? null,
        linkedCardId: input.linkedCardId ?? null,
      });

      return { success: true, id: result.insertId };
    }),

  // Batch create buy records
  batchCreate: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        itemType: z.enum(["card", "sealed"]).default("card"),
        cardName: z.string().min(1).max(512),
        cardSet: z.string().max(256).optional(),
        cardNumber: z.string().max(64).optional(),
        grade: z.string().max(32).optional(),
        buyPriceCurrency: z.enum(["HKD", "JPY", "USD"]).default("HKD"),
        buyPriceOriginal: z.number().positive(),
        buyDate: z.string(),
        buySource: z.string().max(256).optional(),
        notes: z.string().optional(),
        imageUrl: z.string().optional(),
        linkedCardId: z.number().optional(),
      })).min(1).max(50),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      // Fetch exchange rates once
      const jpyRate = await getExchangeRate("JPY", "HKD");
      const usdRate = await getExchangeRate("USD", "HKD");
      const rateMap: Record<string, number> = { HKD: 1, JPY: jpyRate, USD: usdRate };

      const values = input.items.map((item) => {
        const rate = rateMap[item.buyPriceCurrency] ?? 1;
        const buyPriceHkd = toHkd(item.buyPriceOriginal, item.buyPriceCurrency as "HKD" | "JPY" | "USD", rate);
        return {
          itemType: item.itemType,
          cardName: item.cardName,
          cardSet: item.cardSet ?? null,
          cardNumber: item.cardNumber ?? null,
          grade: item.grade ?? null,
          buyPriceCurrency: item.buyPriceCurrency,
          buyPriceOriginal: String(item.buyPriceOriginal),
          buyPriceHkd: String(buyPriceHkd),
          buyExchangeRate: String(rate),
          buyDate: new Date(item.buyDate),
          buySource: item.buySource ?? null,
          status: "holding" as const,
          notes: item.notes ?? null,
          imageUrl: item.imageUrl ?? null,
          linkedCardId: item.linkedCardId ?? null,
        };
      });

      await db.insert(cardInventory).values(values);
      return { success: true, count: values.length };
    }),

  // Update a record (edit buy details or mark as sold)
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      itemType: z.enum(["card", "sealed"]).optional(),
      cardName: z.string().min(1).max(512).optional(),
      cardSet: z.string().max(256).optional().nullable(),
      cardNumber: z.string().max(64).optional().nullable(),
      grade: z.string().max(32).optional().nullable(),
      buyPriceCurrency: z.enum(["HKD", "JPY", "USD"]).optional(),
      buyPriceOriginal: z.number().positive().optional(),
      buyDate: z.string().optional(),
      buySource: z.string().max(256).optional().nullable(),
      // Sell details
      status: z.enum(["holding", "sold"]).optional(),
      sellPriceCurrency: z.enum(["HKD", "JPY", "USD"]).optional(),
      sellPriceOriginal: z.number().positive().optional(),
      sellDate: z.string().optional(),
      sellChannel: z.string().max(256).optional().nullable(),
      notes: z.string().optional().nullable(),
      imageUrl: z.string().optional().nullable(),
      linkedCardId: z.number().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = {};

      if (fields.itemType !== undefined) updateData.itemType = fields.itemType;
      if (fields.cardName !== undefined) updateData.cardName = fields.cardName;
      if (fields.cardSet !== undefined) updateData.cardSet = fields.cardSet;
      if (fields.cardNumber !== undefined) updateData.cardNumber = fields.cardNumber;
      if (fields.grade !== undefined) updateData.grade = fields.grade;
      if (fields.buySource !== undefined) updateData.buySource = fields.buySource;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.sellChannel !== undefined) updateData.sellChannel = fields.sellChannel;
      if (fields.imageUrl !== undefined) updateData.imageUrl = fields.imageUrl;
      if (fields.linkedCardId !== undefined) updateData.linkedCardId = fields.linkedCardId;

      // Recalculate buy price if currency or amount changed
      if (fields.buyPriceOriginal !== undefined || fields.buyPriceCurrency !== undefined) {
        // Fetch current record to get existing values
        const [existing] = await db.select().from(cardInventory).where(eq(cardInventory.id, id)).limit(1);
        const currency = fields.buyPriceCurrency ?? existing?.buyPriceCurrency ?? "HKD";
        const amount = fields.buyPriceOriginal ?? Number(existing?.buyPriceOriginal ?? 0);
        let rate = 1;
        if (currency !== "HKD") {
          rate = await getExchangeRate(currency as "JPY" | "USD", "HKD");
        }
        updateData.buyPriceCurrency = currency;
        updateData.buyPriceOriginal = String(amount);
        updateData.buyPriceHkd = String(toHkd(amount, currency as "HKD" | "JPY" | "USD", rate));
        updateData.buyExchangeRate = String(rate);
      }
      if (fields.buyDate !== undefined) updateData.buyDate = new Date(fields.buyDate);

      // Handle sell details
      if (fields.status === "sold" && fields.sellPriceOriginal !== undefined) {
        const sellCurrency = fields.sellPriceCurrency ?? "HKD";
        let sellRate = 1;
        if (sellCurrency !== "HKD") {
          sellRate = await getExchangeRate(sellCurrency as "JPY" | "USD", "HKD");
        }
        updateData.status = "sold";
        updateData.sellPriceCurrency = sellCurrency;
        updateData.sellPriceOriginal = String(fields.sellPriceOriginal);
        updateData.sellPriceHkd = String(toHkd(fields.sellPriceOriginal, sellCurrency as "HKD" | "JPY" | "USD", sellRate));
        updateData.sellExchangeRate = String(sellRate);
        updateData.sellDate = fields.sellDate ? new Date(fields.sellDate) : new Date();
      } else if (fields.status !== undefined) {
        updateData.status = fields.status;
      }

      await db.update(cardInventory).set(updateData as any).where(eq(cardInventory.id, id));
      return { success: true };
    }),

  // Batch sell records
  batchSell: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        id: z.number(),
        sellPriceCurrency: z.enum(["HKD", "JPY", "USD"]).default("HKD"),
        sellPriceOriginal: z.number().positive(),
        notes: z.string().optional().nullable(),
      })).min(1).max(50),
      sellDate: z.string(),
      sellChannel: z.string().max(256).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const jpyRate = await getExchangeRate("JPY", "HKD");
      const usdRate = await getExchangeRate("USD", "HKD");
      const rateMap: Record<string, number> = { HKD: 1, JPY: jpyRate, USD: usdRate };

      for (const item of input.items) {
        const rate = rateMap[item.sellPriceCurrency] ?? 1;
        const sellHkd = toHkd(item.sellPriceOriginal, item.sellPriceCurrency as "HKD" | "JPY" | "USD", rate);
        const updateData: Record<string, unknown> = {
          status: "sold",
          sellPriceCurrency: item.sellPriceCurrency,
          sellPriceOriginal: String(item.sellPriceOriginal),
          sellPriceHkd: String(sellHkd),
          sellExchangeRate: String(rate),
          sellDate: new Date(input.sellDate),
          sellChannel: input.sellChannel ?? null,
        };
        if (item.notes !== undefined) updateData.notes = item.notes;
        await db.update(cardInventory).set(updateData as any).where(eq(cardInventory.id, item.id));
      }
      return { success: true, count: input.items.length };
    }),

  // Delete a record
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(cardInventory).where(eq(cardInventory.id, input.id));
      return { success: true };
    }),

  // Monthly summary statistics
  monthlySummary: adminProcedure
    .input(z.object({
      year: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const start = new Date(input.year, 0, 1);
      const end = new Date(input.year + 1, 0, 1);

      const rows = await db.select({
        month: sql<number>`MONTH(buyDate)`,
        totalBuyHkd: sql<number>`SUM(buyPriceHkd)`,
        totalSellHkd: sql<number>`SUM(CASE WHEN status = 'sold' THEN sellPriceHkd ELSE 0 END)`,
        buyCount: sql<number>`COUNT(*)`,
        soldCount: sql<number>`SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END)`,
        holdingCount: sql<number>`SUM(CASE WHEN status = 'holding' THEN 1 ELSE 0 END)`,
      })
        .from(cardInventory)
        .where(and(gte(cardInventory.buyDate, start), lte(cardInventory.buyDate, end)))
        .groupBy(sql`MONTH(buyDate)`)
        .orderBy(sql`MONTH(buyDate)`);

      // Fill in all 12 months
      const monthMap: Record<number, typeof rows[0]> = {};
      for (const row of rows) monthMap[Number(row.month)] = row;

      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const row = monthMap[m];
        const totalBuyHkd = Number(row?.totalBuyHkd ?? 0);
        const totalSellHkd = Number(row?.totalSellHkd ?? 0);
        return {
          month: m,
          totalBuyHkd,
          totalSellHkd,
          grossProfitHkd: totalSellHkd - totalBuyHkd,
          buyCount: Number(row?.buyCount ?? 0),
          soldCount: Number(row?.soldCount ?? 0),
          holdingCount: Number(row?.holdingCount ?? 0),
        };
      });

      const yearTotal = {
        totalBuyHkd: months.reduce((s, m) => s + m.totalBuyHkd, 0),
        totalSellHkd: months.reduce((s, m) => s + m.totalSellHkd, 0),
        grossProfitHkd: months.reduce((s, m) => s + m.grossProfitHkd, 0),
        buyCount: months.reduce((s, m) => s + m.buyCount, 0),
        soldCount: months.reduce((s, m) => s + m.soldCount, 0),
        holdingCount: months.reduce((s, m) => s + m.holdingCount, 0),
      };

      return { months, yearTotal };
    }),

  // Get records for a specific month (for export)
  getMonthRecords: adminProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(), // 1-12
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const start = new Date(input.year, input.month - 1, 1);
      const end = new Date(input.year, input.month, 1);

      const items = await db.select().from(cardInventory)
        .where(and(
          gte(cardInventory.buyDate, start),
          lte(cardInventory.buyDate, end),
        ))
        .orderBy(desc(cardInventory.buyDate));

      return items;
    }),
});
