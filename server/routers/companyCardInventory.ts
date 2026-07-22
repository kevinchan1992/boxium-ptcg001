import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { companyCardInventory, cards } from "../../drizzle/schema_new";
import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import https from "https";
import http from "http";
import sharp from "sharp";

// Upload a single image URL to S3 and return the S3 URL (fire-and-forget safe)
async function uploadImageToS3(recordId: number, imageUrl: string): Promise<string | null> {
  try {
    const rawBuf = await new Promise<Buffer | null>((resolve) => {
      const client = imageUrl.startsWith("https") ? https : http;
      const req = client.get(imageUrl, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    });
    if (!rawBuf) return null;
    const pngBuf = await sharp(rawBuf).png().toBuffer();
    const s3Key = `company-card-inventory-images/${recordId}.png`;
    const { url } = await storagePut(s3Key, pngBuf, "image/png");
    return url;
  } catch {
    return null;
  }
}

// Exchange rate fetcher (simple static fallback + optional live fetch)
async function getExchangeRate(from: "JPY" | "USD", to: "HKD"): Promise<number> {
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

export const companyCardInventoryRouter = router({
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
      searchField: z.enum(["all", "cardName", "cardSet", "buySource"]).default("all"),
      year: z.number().optional(),
      month: z.number().optional(), // 1-12
      dateFrom: z.string().optional(), // ISO date string YYYY-MM-DD
      dateTo: z.string().optional(),   // ISO date string YYYY-MM-DD
      minBuyPrice: z.number().optional(),
      maxBuyPrice: z.number().optional(),
      grade: z.string().optional(),
      channel: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.status !== "all") conditions.push(eq(companyCardInventory.status, input.status));
      if (input.itemType !== "all") conditions.push(eq(companyCardInventory.itemType, input.itemType));
      if (input.search) {
        let searchCond;
        if (input.searchField === "cardName") {
          searchCond = like(companyCardInventory.cardName, `%${input.search}%`);
        } else if (input.searchField === "cardSet") {
          searchCond = like(companyCardInventory.cardSet, `%${input.search}%`);
        } else if (input.searchField === "buySource") {
          searchCond = like(companyCardInventory.buySource, `%${input.search}%`);
        } else {
          searchCond = or(
            like(companyCardInventory.cardName, `%${input.search}%`),
            like(companyCardInventory.cardSet, `%${input.search}%`),
            like(companyCardInventory.buySource, `%${input.search}%`),
          );
        }
        if (searchCond) conditions.push(searchCond);
      }
      // Date range filter (dateFrom/dateTo takes priority over year/month)
      if (input.dateFrom || input.dateTo) {
        if (input.dateFrom) {
          conditions.push(gte(companyCardInventory.buyDate, new Date(input.dateFrom)));
        }
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setDate(toDate.getDate() + 1); // inclusive end
          conditions.push(lte(companyCardInventory.buyDate, toDate));
        }
      } else if (input.year && input.month) {
        const start = new Date(input.year, input.month - 1, 1);
        const end = new Date(input.year, input.month, 1);
        conditions.push(gte(companyCardInventory.buyDate, start));
        conditions.push(lte(companyCardInventory.buyDate, end));
      } else if (input.year) {
        const start = new Date(input.year, 0, 1);
        const end = new Date(input.year + 1, 0, 1);
        conditions.push(gte(companyCardInventory.buyDate, start));
        conditions.push(lte(companyCardInventory.buyDate, end));
      }
      // Price range filter (buyPriceHkd)
      if (input.minBuyPrice !== undefined) {
        conditions.push(gte(companyCardInventory.buyPriceHkd, String(input.minBuyPrice)));
      }
      if (input.maxBuyPrice !== undefined) {
        conditions.push(lte(companyCardInventory.buyPriceHkd, String(input.maxBuyPrice)));
      }
      // Grade filter
      if (input.grade) {
        conditions.push(eq(companyCardInventory.grade, input.grade));
      }
      // Channel filter
      if (input.channel) {
        conditions.push(like(companyCardInventory.sellChannel, `%${input.channel}%`));
      }

      const offset = (input.page - 1) * input.pageSize;
      const where = conditions.length > 0 ? and(...(conditions as [ReturnType<typeof eq>])) : undefined;

      const [rawItems, countResult] = await Promise.all([
        db.select().from(companyCardInventory)
          .where(where)
          .orderBy(desc(companyCardInventory.buyDate))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(companyCardInventory).where(where),
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

      const [result] = await db.insert(companyCardInventory).values({
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

      const newId = result.insertId;
      // Auto-cache image to S3 in background (fire-and-forget)
      if (input.imageUrl) {
        (async () => {
          const s3Url = await uploadImageToS3(newId, input.imageUrl!);
          if (s3Url) {
            const dbInner = await getDb();
            await dbInner.update(companyCardInventory).set({ s3ImageUrl: s3Url }).where(eq(companyCardInventory.id, newId)).catch(() => {});
          }
        })();
      }
      return { success: true, id: newId };
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

      const insertResult = await db.insert(companyCardInventory).values(values);
      const firstInsertId = insertResult[0]?.insertId;
      if (firstInsertId) {
        const itemsWithImages = input.items.map((item, i) => ({ id: firstInsertId + i, imageUrl: item.imageUrl })).filter(x => x.imageUrl);
        if (itemsWithImages.length > 0) {
          (async () => {
            const dbInner = await getDb();
            for (const item of itemsWithImages) {
              const s3Url = await uploadImageToS3(item.id, item.imageUrl!);
              if (s3Url) {
                await dbInner.update(companyCardInventory).set({ s3ImageUrl: s3Url }).where(eq(companyCardInventory.id, item.id)).catch(() => {});
              }
            }
          })();
        }
      }
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

      if (fields.buyPriceOriginal !== undefined || fields.buyPriceCurrency !== undefined) {
        const [existing] = await db.select().from(companyCardInventory).where(eq(companyCardInventory.id, id)).limit(1);
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

      await db.update(companyCardInventory).set(updateData as any).where(eq(companyCardInventory.id, id));
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
        await db.update(companyCardInventory).set(updateData as any).where(eq(companyCardInventory.id, item.id));
      }
      return { success: true, count: input.items.length };
    }),

  // Delete a record
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(companyCardInventory).where(eq(companyCardInventory.id, input.id));
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
        .from(companyCardInventory)
        .where(and(gte(companyCardInventory.buyDate, start), lte(companyCardInventory.buyDate, end)))
        .groupBy(sql`MONTH(buyDate)`)
        .orderBy(sql`MONTH(buyDate)`);

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

      const items = await db.select().from(companyCardInventory)
        .where(and(
          gte(companyCardInventory.buyDate, start),
          lte(companyCardInventory.buyDate, end),
        ))
        .orderBy(desc(companyCardInventory.buyDate));

      return items;
    }),

  // Upload all images to S3 for fast export
  cacheImagesToS3: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      const records = await db.select({
        id: companyCardInventory.id,
        imageUrl: companyCardInventory.imageUrl,
        s3ImageUrl: companyCardInventory.s3ImageUrl,
      }).from(companyCardInventory)
        .where(sql`${companyCardInventory.imageUrl} IS NOT NULL AND ${companyCardInventory.s3ImageUrl} IS NULL`);

      if (records.length === 0) return { cached: 0, total: 0, message: "所有圖片已快取" };

      let cached = 0;
      let failed = 0;

      for (const record of records) {
        if (!record.imageUrl) continue;
        try {
          const rawBuf = await new Promise<Buffer | null>((resolve) => {
            const client = record.imageUrl!.startsWith("https") ? https : http;
            const req = client.get(record.imageUrl!, { timeout: 8000 }, (res) => {
              if (res.statusCode !== 200) { resolve(null); return; }
              const chunks: Buffer[] = [];
              res.on("data", (c: Buffer) => chunks.push(c));
              res.on("end", () => resolve(Buffer.concat(chunks)));
              res.on("error", () => resolve(null));
            });
            req.on("error", () => resolve(null));
            req.on("timeout", () => { req.destroy(); resolve(null); });
          });
          if (!rawBuf) { failed++; continue; }
          const pngBuf = await sharp(rawBuf).png().toBuffer();
          const s3Key = `company-card-inventory-images/${record.id}.png`;
          const { url } = await storagePut(s3Key, pngBuf, "image/png");
          await db.update(companyCardInventory)
            .set({ s3ImageUrl: url })
            .where(eq(companyCardInventory.id, record.id));
          cached++;
        } catch {
          failed++;
        }
      }
      return { cached, failed, total: records.length, message: `已快取 ${cached}/${records.length} 張圖片` };
    }),

  // Backfill imageUrl for records missing images
  backfillImageUrls: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      const missingRecords = await db.select({
        id: companyCardInventory.id,
        cardName: companyCardInventory.cardName,
        cardNumber: companyCardInventory.cardNumber,
      }).from(companyCardInventory)
        .where(sql`${companyCardInventory.imageUrl} IS NULL AND ${companyCardInventory.linkedCardId} IS NULL`);

      if (missingRecords.length === 0) return { updated: 0, total: 0 };

      let updated = 0;
      for (const record of missingRecords) {
        const nameKeyword = record.cardName.split("[")[0].trim();
        const matchingCards = await db.select({
          id: cards.id,
          imageUrl: cards.imageUrl,
          name: cards.name,
          cardNumber: cards.cardNumber,
        }).from(cards)
          .where(like(cards.name, `%${nameKeyword.slice(0, 20)}%`))
          .limit(5);

        if (matchingCards.length === 0) continue;

        let bestMatch = matchingCards[0];
        if (record.cardNumber && matchingCards.length > 1) {
          const numMatch = matchingCards.find(c =>
            c.cardNumber && c.cardNumber.includes(record.cardNumber!.split("/")[0])
          );
          if (numMatch) bestMatch = numMatch;
        }

        if (bestMatch?.imageUrl) {
          await db.update(companyCardInventory)
            .set({ imageUrl: bestMatch.imageUrl, linkedCardId: bestMatch.id })
            .where(eq(companyCardInventory.id, record.id));
          updated++;
        }
      }

      return { updated, total: missingRecords.length };
    }),

  // Export Excel
  exportExcel: adminProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(), // 0 = full year, 1-12 = specific month
    }))
    .mutation(async ({ input }) => {
      const { generateCompanyCardInventoryExcel } = await import("../services/companyCardInventoryExport");
      const buffer = await generateCompanyCardInventoryExcel(input.year, input.month);
      return {
        base64: buffer.toString("base64"),
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

  // Export PDF
  exportPdf: adminProcedure
    .input(z.object({
      year: z.number(),
      month: z.number(), // 0 = full year, 1-12 = specific month
    }))
    .mutation(async ({ input }) => {
      const { generateCompanyCardInventoryPdf } = await import("../services/companyCardInventoryExport");
      const buffer = await generateCompanyCardInventoryPdf(input.year, input.month);
      return {
        base64: buffer.toString("base64"),
        mimeType: "application/pdf",
      };
    }),

  // AI 智能拆單：分析 Claim Form PDF，從卡牌庫中智能匹配買取記錄
  analyzeClaimForm: adminProcedure
    .input(z.object({
      pdfBase64: z.string(), // Base64-encoded PDF file
    }))
    .mutation(async ({ input }) => {
      const { analyzeClaimFormPdf } = await import("../services/claimFormParser");
      const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
      const result = await analyzeClaimFormPdf(pdfBuffer);
      return result;
    }),

  // Step 1: 只做 PDF 解析，提取交易行（不做 AI 匹配）
  extractClaimLines: adminProcedure
    .input(z.object({
      pdfBase64: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { extractClaimFormLines } = await import("../services/claimFormParser");
      const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
      const lines = await extractClaimFormLines(pdfBuffer);
      return { lines, totalLines: lines.length };
    }),

  // Step 2: 對單一行進行 AI 匹配（支援前端逐行呼叫）
  matchClaimLine: adminProcedure
    .input(z.object({
      lineIndex: z.number(),
      date: z.string(),
      boughtNoteNo: z.string(),
      seller: z.string(),
      description: z.string(),
      amount: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { matchProductsToClaimLines } = await import("../services/claimFormParser");
      const results = await matchProductsToClaimLines([{
        date: input.date,
        boughtNoteNo: input.boughtNoteNo,
        seller: input.seller,
        description: input.description,
        amount: input.amount,
      }]);
      const row = results[0];
      return {
        lineIndex: input.lineIndex,
        date: row.date,
        boughtNoteNo: row.boughtNoteNo,
        seller: row.seller,
        description: row.description,
        totalAmount: row.totalAmount,
        combinations: row.combinations,
        selectedCombination: row.selectedCombination,
        notes: row.notes,
      };
    }),

  // 批量匯入 AI 拆單結果為公司買取記錄
  importClaimFormRows: adminProcedure
    .input(z.array(z.object({
      date: z.string(),             // DD/MM/YYYY
      boughtNoteNo: z.string(),
      seller: z.string(),
      notes: z.string().optional(),
      // Each row can have multiple items (multi-item combination)
      items: z.array(z.object({
        cardId: z.number(),
        productType: z.enum(["single_card", "sealed_product"]),
        buyPrice: z.number(),        // price per unit
        quantity: z.number().min(1), // quantity
      })),
    })))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const { sealedProducts } = await import("../../drizzle/schema_new");
      let insertedCount = 0;

      for (const row of input) {
        // Parse DD/MM/YYYY to Date
        const [day, month, year] = row.date.split("/").map(Number);
        const buyDate = new Date(year, month - 1, day);
        const buySource = [row.seller, row.boughtNoteNo].filter(Boolean).join(" | ");

        for (const item of row.items) {
          // Expand quantity: insert one record per unit
          const qty = Math.max(1, Math.round(item.quantity));

          // Get card/product info
          let cardName = "";
          let cardImage = "";
          let series = "";
          let setName = "";

          if (item.productType === "single_card") {
            const [card] = await db.select({ name: cards.name, imageUrl: cards.imageUrl, series: cards.series, setName: cards.setName })
              .from(cards).where(eq(cards.id, item.cardId)).limit(1);
            cardName = card?.name ?? "";
            cardImage = card?.imageUrl ?? "";
            series = card?.series ?? "";
            setName = card?.setName ?? "";
          } else {
            const [sp] = await db.select({ name: sealedProducts.name, imageUrl: sealedProducts.imageUrl, series: sealedProducts.series, setName: sealedProducts.setName })
              .from(sealedProducts).where(eq(sealedProducts.id, item.cardId)).limit(1);
            cardName = sp?.name ?? "";
            cardImage = sp?.imageUrl ?? "";
            series = sp?.series ?? "";
            setName = sp?.setName ?? "";
          }

          // Insert qty records (one per unit)
          for (let q = 0; q < qty; q++) {
            await db.insert(companyCardInventory).values({
              itemType: item.productType === "sealed_product" ? "sealed" : "card",
              cardName,
              cardSet: setName || series || undefined,
              grade: "RAW",
              buyPriceCurrency: "HKD",
              buyPriceOriginal: String(item.buyPrice),
              buyPriceHkd: String(item.buyPrice),
              buyExchangeRate: "1.0000",
              buyDate,
              buySource,
              status: "holding",
              imageUrl: cardImage || undefined,
              linkedCardId: item.cardId || undefined,
              notes: row.notes || undefined,
            });
            insertedCount++;
          }
        }
      }

      return { inserted: insertedCount };
    }),
});
