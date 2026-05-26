/**
 * Profile tRPC Router
 * User profile: watchlist, collection trades, personal data
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import * as db from "../db";

export const profileRouter = router({
    // Get user's watchlist
    getWatchlist: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlist } = await import("../profile");
        const watchlist = await getUserWatchlist(ctx.user.id);
        return watchlist;
      }),

    // Check if card is in watchlist
    isInWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const { isCardInWatchlist } = await import("../profile");
        const isInWatchlist = await isCardInWatchlist(ctx.user.id, input.cardId);
        return { isInWatchlist };
      }),

    // Add card to watchlist
    addToWatchlist: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addToWatchlist } = await import("../profile");
        await addToWatchlist(ctx.user.id, input.cardId, input.notes);
        return { success: true };
      }),

    // Update watchlist notes
    updateWatchlistNotes: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateWatchlistNotes } = await import("../profile");
        await updateWatchlistNotes(ctx.user.id, input.watchlistId, input.notes);
        return { success: true };
      }),

    // Remove from watchlist by watchlist ID
    removeFromWatchlist: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlist } = await import("../profile");
        await removeFromWatchlist(ctx.user.id, input.watchlistId);
        return { success: true };
      }),

    // Remove from watchlist by card ID
    removeFromWatchlistByCardId: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromWatchlistByCardId } = await import("../profile");
        await removeFromWatchlistByCardId(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Get view history
    getViewHistory: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const { getUserViewHistory } = await import("../profile");
        const history = await getUserViewHistory(ctx.user.id, input.limit);
        return history;
      }),

    // Add view history record
    addViewHistory: protectedProcedure
      .input(z.object({
        cardId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addViewHistory } = await import("../profile");
        await addViewHistory(ctx.user.id, input.cardId);
        return { success: true };
      }),

    // Clear view history
    clearViewHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { clearViewHistory } = await import("../profile");
        await clearViewHistory(ctx.user.id);
        return { success: true };
      }),

    // Get watchlist statistics
        getWatchlistStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserWatchlistStats } = await import("../profile");
        const stats = await getUserWatchlistStats(ctx.user.id);
        return stats;
      }),
    // ─── Collection procedures ────────────────────────────────────────────────
    getCollection: protectedProcedure
      .input(z.object({
        sortBy: z.enum(["marketValue", "gain", "purchasedAt", "createdAt"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        grader: z.string().optional(),
        series: z.string().optional(),
        priceMode: z.enum(["psa10", "grade"]).optional(),
        showTraded: z.boolean().optional(),
        page: z.number().min(1).optional().default(1),
        limit: z.number().min(1).max(100).optional().default(30),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getUserCollection } = await import("../collection");
        const allItems = await getUserCollection(ctx.user.id, input ?? {});
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 30;
        const offset = (page - 1) * limit;
        const paginatedItems = allItems.slice(offset, offset + limit);

        // Fetch traded-out collectionIds so the UI can show "已換出" badge
        let tradedOutIds: number[] = [];
        try {
          const { getDb } = await import("../db");
          const { cardTradeItems } = await import("../../drizzle/schema_new");
          const { eq, and, isNotNull } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const rows = await db
              .select({ collectionId: cardTradeItems.collectionId })
              .from(cardTradeItems)
              .innerJoin(
                (await import("../../drizzle/schema_new")).cardTrades,
                eq(cardTradeItems.tradeId, (await import("../../drizzle/schema_new")).cardTrades.id)
              )
              .where(
                and(
                  eq((await import("../../drizzle/schema_new")).cardTrades.userId, ctx.user.id),
                  eq(cardTradeItems.direction, "out"),
                  isNotNull(cardTradeItems.collectionId)
                )
              );
            tradedOutIds = rows.map((r) => r.collectionId!).filter(Boolean);
          }
        } catch (_) { /* non-critical */ }

        return {
          items: paginatedItems,
          total: allItems.length,
          page,
          limit,
          totalPages: Math.ceil(allItems.length / limit),
          tradedOutIds,
        };
      }),
    getCollectionStats: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserCollectionStats } = await import("../collection");
        return getUserCollectionStats(ctx.user.id);
      }),
    addToCollection: protectedProcedure
      .input(z.object({
        cardId: z.number(),
        grader: z.string(),
        grade: z.string().nullable().optional(),
        quantity: z.number().min(1).max(999).optional(),
        purchasePrice: z.number().nullable().optional(),
        purchasedAt: z.date().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addToCollection } = await import("../collection");
        return addToCollection(ctx.user.id, input);
      }),
    updateCollectionItem: protectedProcedure
      .input(z.object({
        itemId: z.number(),
        grader: z.string().optional(),
        grade: z.string().nullable().optional(),
        quantity: z.number().min(1).max(999).optional(),
        purchasePrice: z.number().nullable().optional(),
        purchasedAt: z.date().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateCollectionItem } = await import("../collection");
        const { itemId, ...data } = input;
        return updateCollectionItem(ctx.user.id, itemId, data);
      }),
    removeFromCollection: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { removeFromCollection } = await import("../collection");
        return removeFromCollection(ctx.user.id, input.itemId);
      }),
    exportCollectionPdf: protectedProcedure
      .input(z.object({
        publicOnly: z.boolean().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const { getUserCollection, getUserCollectionStats } = await import("../collection");
        const { generateCollectionPdf } = await import("../collectionPdf");
        let items = await getUserCollection(ctx.user.id, { priceMode: "psa10" });
        if (input?.publicOnly) {
          items = items.filter((i) => i.isPublic);
        }
        const stats = await getUserCollectionStats(ctx.user.id);
        const userName = ctx.user.name ?? ctx.user.email ?? "Collector";
        const pdfUrl = await generateCollectionPdf(userName, items, stats);
        return { url: pdfUrl };
      }),
    // ─── Trade (Card-for-Card) procedures ────────────────────────────────────
    createTrade: protectedProcedure
      .input(z.object({
        tradedAt: z.date(),
        tradePartner: z.string().max(128).nullable().optional(),
        cashAdjustment: z.number().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        items: z.array(z.object({
          direction: z.enum(["in", "out"]),
          cardId: z.number(),
          cardName: z.string(),
          grader: z.string(),
          grade: z.string().nullable().optional(),
          quantity: z.number().min(1).max(999).optional(),
          estimatedValue: z.number().nullable().optional(),
          collectionId: z.number().nullable().optional(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createCardTrade } = await import("../cardTrades");
        return createCardTrade(ctx.user.id, input);
      }),
    getTrades: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserTrades } = await import("../cardTrades");
        return getUserTrades(ctx.user.id);
      }),
    getTradeById: protectedProcedure
      .input(z.object({ tradeId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getTradeById } = await import("../cardTrades");
        return getTradeById(ctx.user.id, input.tradeId);
      }),
    deleteTrade: protectedProcedure
      .input(z.object({ tradeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteCardTrade } = await import("../cardTrades");
        return deleteCardTrade(ctx.user.id, input.tradeId);
      }),
    getTradesForCollectionItem: protectedProcedure
      .input(z.object({ collectionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getTradesForCollectionItem } = await import("../cardTrades");
        return getTradesForCollectionItem(ctx.user.id, input.collectionId);
      }),
});
