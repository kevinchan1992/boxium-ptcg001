/**
 * wall.ts — 嘆息之牆 (Wall of Sighs) tRPC Router
 *
 * Procedures:
 *   wall.getWall          — public: list all wall entries (sorted by totalValue desc)
 *   wall.getStats         — public: total wall value + total sighs count
 *   wall.publish          — protected: publish/update user's vault to the wall
 *   wall.unpublish        — protected: remove user's entry from the wall
 *   wall.sigh             — protected: sigh on an entry (1 per user per entry, 24h cooldown)
 *   wall.getComments      — public: get comments for an entry
 *   wall.addComment       — protected: add a comment to an entry
 *   wall.deleteComment    — protected: delete own comment (or admin)
 *   wall.generatePoster   — protected: generate honour certificate poster for user's entry
 *   wall.getMyEntry       — protected: get current user's wall entry
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// Minimum vault value to publish (HKD cents = HKD 5,000)
const WALL_MIN_VALUE_CENTS = 500000;

export const wallRouter = router({
  // ─── Public: list wall entries ─────────────────────────────────
  getWall: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      sortBy: z.enum(["totalValue", "sighs", "createdAt"]).default("totalValue"),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { wallEntries } = await import("../../drizzle/schema_new");
      const { desc, eq } = await import("drizzle-orm");
      const db = await getDb();

      const sortCol = input.sortBy === "sighs"
        ? desc(wallEntries.sighs)
        : input.sortBy === "createdAt"
          ? desc(wallEntries.createdAt)
          : desc(wallEntries.totalValue);

      const entries = await db
        .select()
        .from(wallEntries)
        .where(eq(wallEntries.isPublic, true))
        .orderBy(sortCol)
        .limit(input.limit)
        .offset(input.offset);

      const total = await db
        .select({ count: wallEntries.id })
        .from(wallEntries)
        .where(eq(wallEntries.isPublic, true));

      return {
        entries: entries.map((e, idx) => ({
          ...e,
          rank: input.offset + idx + 1,
          totalValueHKD: e.totalValue / 100,
          topCardValueHKD: (e.topCardValue ?? 0) / 100,
        })),
        total: total.length,
      };
    }),

  // ─── Public: global stats ──────────────────────────────────────
  getStats: publicProcedure.query(async () => {
    const { getDb } = await import("../db");
    const { wallEntries } = await import("../../drizzle/schema_new");
    const { eq, sum, sql } = await import("drizzle-orm");
    const db = await getDb();

    const [stats] = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(${wallEntries.totalValue}), 0)`,
        totalSighs: sql<number>`COALESCE(SUM(${wallEntries.sighs}), 0)`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(wallEntries)
      .where(eq(wallEntries.isPublic, true));

    return {
      totalValueHKD: (stats?.totalValue ?? 0) / 100,
      totalSighs: stats?.totalSighs ?? 0,
      entryCount: stats?.entryCount ?? 0,
    };
  }),

  // ─── Protected: get my entry ───────────────────────────────────
  getMyEntry: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { wallEntries } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();

    const [entry] = await db
      .select()
      .from(wallEntries)
      .where(eq(wallEntries.userId, ctx.user.id))
      .limit(1);

    if (!entry) return null;
    return {
      ...entry,
      totalValueHKD: entry.totalValue / 100,
      topCardValueHKD: (entry.topCardValue ?? 0) / 100,
    };
  }),

  // ─── Protected: publish vault to wall ─────────────────────────
  publish: protectedProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { wallEntries, users } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const { getUserCollectionStats, getUserCollection } = await import("../collection");
    const db = await getDb();

    // Get user info
    const [user] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用戶不存在" });

    // Get vault stats using the same logic as Vault page
    const stats = await getUserCollectionStats(ctx.user.id);

    if (stats.totalItems === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "您的倉庫是空的，無法上牆" });
    }

    // Total value in cents (stats.totalMarketValue is in HKD)
    const totalValueCents = Math.round(stats.totalMarketValue * 100);
    const WALL_MIN_CENTS = WALL_MIN_VALUE_CENTS; // HKD 5000 = 500000 cents

    // Check minimum threshold
    if (totalValueCents < WALL_MIN_CENTS && user.role !== "admin") {
      const shortfall = (WALL_MIN_CENTS - totalValueCents) / 100;
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `您的資產距離上牆還差 HKD ${shortfall.toLocaleString("en-HK", { minimumFractionDigits: 2 })}`,
        cause: { shortfall, currentValueHKD: stats.totalMarketValue, minValueHKD: WALL_MIN_CENTS / 100 },
      });
    }

    // Find top card by market value
    const topCard = stats.top3ByValue[0] ?? null;
    const displayName = user.name ?? `用戶 #${user.id}`;

    // Upsert wall entry
    const existing = await db
      .select({ id: wallEntries.id })
      .from(wallEntries)
      .where(eq(wallEntries.userId, ctx.user.id))
      .limit(1);

    const top5 = stats.top5ByValue ?? stats.top3ByValue;
    const card2 = top5[1] ?? null;
    const card3 = top5[2] ?? null;
    const card4 = top5[3] ?? null;
    const card5 = top5[4] ?? null;

    const entryData = {
      displayName,
      totalValue: totalValueCents,
      topCardName: topCard?.card?.name ?? null,
      topCardImageUrl: topCard?.card?.imageUrl ?? null,
      topCardGrade: topCard?.grade ?? null,
      topCardGrader: topCard?.grader ?? null,
      topCardValue: topCard?.marketPrice ? Math.round(topCard.marketPrice * (topCard.quantity ?? 1) * 100) : 0,
      card2Name: card2?.card?.name ?? null,
      card2ImageUrl: card2?.card?.imageUrl ?? null,
      card2Grade: card2?.grade ?? null,
      card2Grader: card2?.grader ?? null,
      card3Name: card3?.card?.name ?? null,
      card3ImageUrl: card3?.card?.imageUrl ?? null,
      card3Grade: card3?.grade ?? null,
      card3Grader: card3?.grader ?? null,
      card4Name: card4?.card?.name ?? null,
      card4ImageUrl: card4?.card?.imageUrl ?? null,
      card4Grade: card4?.grade ?? null,
      card4Grader: card4?.grader ?? null,
      card5Name: card5?.card?.name ?? null,
      card5ImageUrl: card5?.card?.imageUrl ?? null,
      card5Grade: card5?.grade ?? null,
      card5Grader: card5?.grader ?? null,
      isPublic: true,
    };

    if (existing.length > 0) {
      await db
        .update(wallEntries)
        .set({ ...entryData, updatedAt: new Date() })
        .where(eq(wallEntries.userId, ctx.user.id));
    } else {
      await db.insert(wallEntries).values({ userId: ctx.user.id, ...entryData });
    }

    const [entry] = await db
      .select()
      .from(wallEntries)
      .where(eq(wallEntries.userId, ctx.user.id))
      .limit(1);

    return {
      success: true,
      entry: entry ? { ...entry, totalValueHKD: entry.totalValue / 100 } : null,
      isAboveThreshold: true,
    };
  }),

  // ─── Protected: unpublish ──────────────────────────────────────
  unpublish: protectedProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { wallEntries } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();

    await db
      .update(wallEntries)
      .set({ isPublic: false })
      .where(eq(wallEntries.userId, ctx.user.id));

    return { success: true };
  }),

  // ─── Protected: sigh (1 per user per entry per 24h) ───────────
  sigh: protectedProcedure
    .input(z.object({ entryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { wallSighLogs, wallEntries } = await import("../../drizzle/schema_new");
      const { eq, and, gte, sql } = await import("drizzle-orm");
      const db = await getDb();

      // Check cooldown: 1 sigh per user per entry per 24h
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: wallSighLogs.id })
        .from(wallSighLogs)
        .where(and(
          eq(wallSighLogs.entryId, input.entryId),
          eq(wallSighLogs.userId, ctx.user.id),
          gte(wallSighLogs.createdAt, since),
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "每 24 小時只能嘆息一次" });
      }

      // Insert sigh log (delete old if exists then insert)
      try {
        await db.delete(wallSighLogs).where(
          and(eq(wallSighLogs.entryId, input.entryId), eq(wallSighLogs.userId, ctx.user.id))
        );
      } catch { /* ignore */ }
      await db.insert(wallSighLogs).values({ entryId: input.entryId, userId: ctx.user.id });

      // Increment sighs counter
      await db
        .update(wallEntries)
        .set({ sighs: sql`${wallEntries.sighs} + 1` })
        .where(eq(wallEntries.id, input.entryId));

      const [entry] = await db
        .select({ sighs: wallEntries.sighs })
        .from(wallEntries)
        .where(eq(wallEntries.id, input.entryId))
        .limit(1);

      return { success: true, sighs: entry?.sighs ?? 0 };
    }),

  // ─── Public: get comments ──────────────────────────────────────
  getComments: publicProcedure
    .input(z.object({ entryId: z.number(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { wallComments } = await import("../../drizzle/schema_new");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();

      const comments = await db
        .select()
        .from(wallComments)
        .where(eq(wallComments.entryId, input.entryId))
        .orderBy(desc(wallComments.createdAt))
        .limit(input.limit);

      return comments;
    }),

  // ─── Protected: add comment ────────────────────────────────────
  addComment: protectedProcedure
    .input(z.object({
      entryId: z.number(),
      content: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { wallComments, users } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();

      const [user] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      const displayName = user?.name ?? `用戶 #${ctx.user.id}`;

      const [result] = await db.insert(wallComments).values({
        entryId: input.entryId,
        userId: ctx.user.id,
        displayName,
        content: input.content,
      });

      return { success: true, id: (result as any).insertId };
    }),

  // ─── Protected: delete comment ─────────────────────────────────
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { wallComments, users } = await import("../../drizzle/schema_new");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();

      const [comment] = await db
        .select({ userId: wallComments.userId })
        .from(wallComments)
        .where(eq(wallComments.id, input.commentId))
        .limit(1);

      if (!comment) throw new TRPCError({ code: "NOT_FOUND" });

      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (comment.userId !== ctx.user.id && user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.delete(wallComments).where(eq(wallComments.id, input.commentId));
      return { success: true };
    }),

  // ─── Protected: generate honour certificate poster ─────────────
  generatePoster: protectedProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { wallEntries } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();

    const [entry] = await db
      .select()
      .from(wallEntries)
      .where(eq(wallEntries.userId, ctx.user.id))
      .limit(1);

    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "請先上牆再生成海報" });

    // Generate poster
    const { generateWallPoster } = await import("../wallPosterGenerator");
    const pngBuffer = await generateWallPoster({
      displayName: entry.displayName,
      totalValueHKD: entry.totalValue / 100,
      sighs: entry.sighs,
      topCardName: entry.topCardName ?? undefined,
      topCardImageUrl: entry.topCardImageUrl ?? undefined,
      topCardGrade: entry.topCardGrade ?? undefined,
      topCardGrader: entry.topCardGrader ?? undefined,
      topCardValueHKD: (entry.topCardValue ?? 0) / 100,
      wallUrl: "https://boxium.asia/wall-of-sighs",
    });

    // Upload to S3
    const { storagePut } = await import("../storage");
    const key = `wall-posters/user-${ctx.user.id}-${Date.now()}.png`;
    const { url } = await storagePut(key, pngBuffer, "image/png");

    // Save poster URL
    await db
      .update(wallEntries)
      .set({ posterUrl: url })
      .where(eq(wallEntries.userId, ctx.user.id));

    return { success: true, posterUrl: url };
  }),
});
