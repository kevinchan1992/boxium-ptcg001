import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  cards: router({
    search: publicProcedure
      .input(z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const results = await db.searchCards(input.query, input.limit);
        return results;
      }),

    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardById(input.id);
        return card;
      }),

    getByCardId: publicProcedure
      .input(z.object({
        cardId: z.string(),
      }))
      .query(async ({ input }) => {
        const card = await db.getCardByCardId(input.cardId);
        return card;
      }),
  }),

  prices: router({
    getHistory: publicProcedure
      .input(z.object({
        cardId: z.number(),
        source: z.enum(["snkrdunk", "ebay", "other"]).optional(),
        grade: z.string().optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ input }) => {
        const history = await db.getPriceHistory(
          input.cardId,
          input.source,
          input.grade,
          input.limit
        );
        return history;
      }),
  }),

  auctions: router({
    getActive: publicProcedure
      .input(z.object({
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const auctions = await db.getActiveAuctions(input.limit);
        return auctions;
      }),

    getById: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .query(async ({ input }) => {
        const auction = await db.getAuctionById(input.id);
        return auction;
      }),

    getBids: publicProcedure
      .input(z.object({
        auctionId: z.number(),
      }))
      .query(async ({ input }) => {
        const bids = await db.getBidsByAuctionId(input.auctionId);
        return bids;
      }),
  }),

  offers: router({
    getActive: publicProcedure
      .input(z.object({
        cardId: z.number().optional(),
        type: z.enum(["buy", "sell"]).optional(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const offers = await db.getActiveOffers(
          input.cardId,
          input.type,
          input.limit
        );
        return offers;
      }),
  }),

  watchlist: router({
    getUserWatchlist: protectedProcedure
      .query(async ({ ctx }) => {
        const watchlist = await db.getUserWatchlist(ctx.user.id);
        return watchlist;
      }),
  }),
});

export type AppRouter = typeof appRouter;
