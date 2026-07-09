/**
 * Products tRPC Router
 * Handles single cards and sealed products: lookup, search, price history, trend data
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";

export const productsRouter = router({
  getById: publicProcedure
    .input(z.object({
      id: z.number(),
      productType: z.enum(['single_card', 'sealed_product']).optional(),
    }))
    .query(async ({ input }) => {
      const product = await db.getProductById(input.id, input.productType);
      return product || null;
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string(),
      limit: z.number().optional().default(20),
      offset: z.number().optional().default(0),
      cardsOnly: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      // Search cards (always); search sealed products only if not cardsOnly
      // IMPORTANT: fetch ALL results from each source (limit=9999, offset=0) so we can
      // merge and sort across both sources before applying pagination.
      // Both functions use in-memory caches, so this is fast after the first call.
      let cardsResult: { cards: any[]; total: number };
      let sealedResult: { products: any[]; total: number } = { products: [], total: 0 };
      try {
        if (input.cardsOnly) {
          cardsResult = await db.searchCards(input.query, 9999, 0);
        } else {
          [cardsResult, sealedResult] = await Promise.all([
            db.searchCards(input.query, 9999, 0),
            db.searchSealedProducts(input.query, 9999, 0),
          ]);
        }
      } catch (err: any) {
        const isTimeout = err?.message?.includes('Timeout') || err?.message?.includes('timeout');
        console.error(`[products.search] search failed (${isTimeout ? 'TIMEOUT' : 'ERROR'}):`, err?.message || err);
        throw new TRPCError({
          code: isTimeout ? 'TIMEOUT' : 'INTERNAL_SERVER_ERROR',
          message: isTimeout
            ? 'Search is warming up, please retry in a few seconds.'
            : 'Search temporarily unavailable, please try again.',
        });
      }

      // Merge results with productType tag
      const cardItems = cardsResult.cards.map(c => ({
        id: c.id,
        name: c.name,
        nameJa: c.nameJa,
        imageUrl: c.imageUrl,
        latestPrice: c.latestPrice,
        productType: 'single_card' as const,
        cardNumber: c.cardNumber,
        rarity: c.rarity,
        series: c.series,
        boxType: null,
      }));

      const sealedItems = sealedResult.products.map(p => ({
        id: p.id,
        name: p.name,
        nameJa: p.nameJa,
        imageUrl: p.imageUrl,
        latestPrice: p.latestPrice,
        productType: 'sealed_product' as const,
        cardNumber: null,
        rarity: null,
        series: p.series,
        boxType: p.boxType,
      }));

      // Combine and sort by price (highest first); no-price items go to end
      const allItems = [...cardItems, ...sealedItems].sort((a, b) => {
        const priceA = a.latestPrice ? Number(a.latestPrice) : -1;
        const priceB = b.latestPrice ? Number(b.latestPrice) : -1;
        return priceB - priceA;
      });

      // Apply pagination on the merged+sorted result
      const start = input.offset;
      const end = input.offset + input.limit;
      return {
        items: allItems.slice(start, end),
        cards: cardItems.slice(start, end),
        total: cardsResult.total + sealedResult.total,
      };
    }),

  getPriceHistory: publicProcedure
    .input(z.object({
      productId: z.number(),
      productType: z.enum(['single_card', 'sealed_product']),
      source: z.enum(['snkrdunk', 'ebay', 'tcgplayer', 'other']).optional(),
      grade: z.string().optional(),
      limit: z.number().optional().default(50),
      days: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const history = await db.getPriceHistory(
        input.productId,
        input.source,
        input.grade,
        input.limit,
        input.days,
        input.productType  // Pass productType so sealed_product skips isSuspectedBulk filter
      );
      // Filter by productType
      return history.filter(h => h.productType === input.productType);
    }),

  getPriceTrendData: publicProcedure
    .input(z.object({
      productId: z.number(),
      productType: z.enum(['single_card', 'sealed_product']),
      days: z.number().optional().default(90),
    }))
    .query(async ({ input }) => {
      try {
        // Get product info
        const product = await db.getProductById(input.productId, input.productType);
        if (!product) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Product not found' });
        }

        // Get all price history for this product
        const allHistory = await db.getPriceHistoryByCardId(input.productId);
        // Filter by productType
        const productHistory = allHistory.filter(h => h.productType === input.productType);

        if (input.productType === 'sealed_product') {
          // For sealed products: group by date, show all prices (no grade filter)
          const recentHistory = input.days > 0
            ? (() => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - input.days);
                return productHistory.filter(record =>
                  new Date(record.soldAt || record.createdAt) >= cutoffDate
                );
              })()
            : productHistory;

          const groupedByDate = new Map<string, any[]>();
          for (const record of recentHistory) {
            if (record.source !== 'snkrdunk') continue;
            const date = new Date(record.soldAt || record.createdAt);
            const dateStr = date.toISOString().split('T')[0];
            if (!groupedByDate.has(dateStr)) groupedByDate.set(dateStr, []);
            groupedByDate.get(dateStr)!.push(record);
          }

          // Helper: parse quantity string to number (e.g. "5盒" → 5, "1" → 1)
          const parseQty = (q: string | null | undefined): number => {
            if (!q) return 1;
            const n = parseInt(q.replace(/[^0-9]/g, ''), 10);
            return isNaN(n) || n <= 0 ? 1 : n;
          };

          // Calculate unit price (per box) for each record
          const toUnitPrice = (r: any): number => {
            const total = parseFloat(r.price);
            const qty = parseQty(r.quantity);
            return total / qty;
          };

          const trendData = Array.from(groupedByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, records]) => {
              const unitPrices = records.map(toUnitPrice);
              return {
                date,
                snkrdunkPrice: unitPrices.length > 0
                  ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length
                  : undefined,
                snkrdunkCount: records.length,
              };
            });

          const allUnitPrices = recentHistory
            .filter(r => r.source === 'snkrdunk')
            .map(toUnitPrice);

          const sortedByDate = recentHistory
            .filter(r => r.source === 'snkrdunk')
            .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime());

          const stats = {
            snkrdunk: allUnitPrices.length > 0 ? {
              minPrice: Math.min(...allUnitPrices),
              maxPrice: Math.max(...allUnitPrices),
              avgPrice: allUnitPrices.reduce((a, b) => a + b, 0) / allUnitPrices.length,
              latestPrice: sortedByDate.length > 0 ? toUnitPrice(sortedByDate[0]) : 0,
            } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
          };

          return {
            cardId: product.id,
            cardName: product.name,
            productType: 'sealed_product' as const,
            trendData,
            stats,
          };
        } else {
          // For single cards: existing PSA 10 logic
          const recentHistory = input.days > 0
            ? (() => {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - input.days);
                return productHistory.filter(record =>
                  new Date(record.soldAt || record.createdAt) >= cutoffDate &&
                  (record.grade === 'PSA 10')
                );
              })()
            : productHistory.filter(record =>
                (record.grade === 'PSA 10')
              );

          const groupedByDate = new Map<string, any[]>();
          for (const record of recentHistory) {
            if (record.grade !== 'PSA 10') continue;
            if (record.source !== 'snkrdunk') continue;
            const date = new Date(record.soldAt || record.createdAt);
            const dateStr = date.toISOString().split('T')[0];
            if (!groupedByDate.has(dateStr)) groupedByDate.set(dateStr, []);
            groupedByDate.get(dateStr)!.push(record);
          }

          const trendData = Array.from(groupedByDate.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, records]) => {
              const prices = records.map(r => parseFloat(r.price));
              return {
                date,
                snkrdunkPrice: prices.length > 0
                  ? prices.reduce((a, b) => a + b, 0) / prices.length
                  : undefined,
                snkrdunkCount: prices.length,
              };
            });

          const allSnkrdunkPrices = recentHistory
            .filter(r => r.source === 'snkrdunk')
            .map(r => parseFloat(r.price));

          const stats = {
            snkrdunk: allSnkrdunkPrices.length > 0 ? {
              minPrice: Math.min(...allSnkrdunkPrices),
              maxPrice: Math.max(...allSnkrdunkPrices),
              avgPrice: allSnkrdunkPrices.reduce((a, b) => a + b, 0) / allSnkrdunkPrices.length,
              latestPrice: parseFloat(recentHistory
                .filter(r => r.source === 'snkrdunk')
                .sort((a: any, b: any) => new Date(b.soldAt || b.createdAt).getTime() - new Date(a.soldAt || a.createdAt).getTime())[0]?.price || '0'),
            } : { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
          };

          return {
            cardId: product.id,
            cardName: product.name,
            productType: 'single_card' as const,
            trendData,
            stats,
          };
        }
      } catch (error: any) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get price trend data: ${error.message}`,
        });
      }
    }),
});
