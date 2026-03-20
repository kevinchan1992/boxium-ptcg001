/**
 * Email Router
 * - Admin: query email logs with filters
 * - Public: unsubscribe via token
 * - Protected: manage own unsubscribe preferences
 */
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, gte, lte, like, or, sql } from "drizzle-orm";
import { emailLogs, emailUnsubscribes } from "../../drizzle/schema_new";
import { getDb } from "../db";
import crypto from "crypto";

// ─── Admin: Email Logs ────────────────────────────────────────────────────────

export const emailRouter = router({
  // Admin: list email logs with filters
  listLogs: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      status: z.enum(["sent", "failed", "skipped", "all"]).default("all"),
      emailType: z.string().optional(),
      search: z.string().optional(), // search by email or subject
      dateFrom: z.string().optional(), // ISO date string
      dateTo: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const conditions: any[] = [];
      if (input.status !== "all") {
        conditions.push(eq(emailLogs.status, input.status as any));
      }
      if (input.emailType) {
        conditions.push(eq(emailLogs.emailType, input.emailType));
      }
      if (input.search) {
        conditions.push(
          or(
            like(emailLogs.toEmail, `%${input.search}%`),
            like(emailLogs.subject, `%${input.search}%`)
          )
        );
      }
      if (input.dateFrom) {
        conditions.push(gte(emailLogs.sentAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        // Include the entire end day
        const endDate = new Date(input.dateTo);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(emailLogs.sentAt, endDate));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (input.page - 1) * input.pageSize;

      const [rows, countResult] = await Promise.all([
        db.select().from(emailLogs)
          .where(where)
          .orderBy(desc(emailLogs.sentAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(where),
      ]);

      return {
        logs: rows,
        total: Number(countResult[0]?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Admin: get email stats summary
  getStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [total, sent, failed, skipped, last24h] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(emailLogs),
        db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(eq(emailLogs.status, "sent")),
        db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(eq(emailLogs.status, "failed")),
        db.select({ count: sql<number>`count(*)` }).from(emailLogs).where(eq(emailLogs.status, "skipped")),
        db.select({ count: sql<number>`count(*)` }).from(emailLogs)
          .where(gte(emailLogs.sentAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
      ]);

      return {
        total: Number(total[0]?.count ?? 0),
        sent: Number(sent[0]?.count ?? 0),
        failed: Number(failed[0]?.count ?? 0),
        skipped: Number(skipped[0]?.count ?? 0),
        last24h: Number(last24h[0]?.count ?? 0),
      };
    }),

  // ─── Unsubscribe ────────────────────────────────────────────────────────────

  // Public: unsubscribe via token (from email link)
  unsubscribeByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [record] = await db.select().from(emailUnsubscribes)
        .where(eq(emailUnsubscribes.token, input.token))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe token" });
      }

      // Mark as unsubscribed (clear resubscribedAt)
      await db.update(emailUnsubscribes)
        .set({ resubscribedAt: null, unsubscribedAt: new Date() })
        .where(eq(emailUnsubscribes.token, input.token));

      return { success: true, email: record.email, emailType: record.emailType };
    }),

  // Public: get unsubscribe info by token
  getUnsubscribeInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [record] = await db.select().from(emailUnsubscribes)
        .where(eq(emailUnsubscribes.token, input.token))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid unsubscribe token" });
      }

      return {
        email: record.email,
        emailType: record.emailType,
        isUnsubscribed: record.resubscribedAt === null,
        unsubscribedAt: record.unsubscribedAt,
      };
    }),

  // Protected: resubscribe via token
  resubscribeByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [record] = await db.select().from(emailUnsubscribes)
        .where(eq(emailUnsubscribes.token, input.token))
        .limit(1);

      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid token" });
      }

      await db.update(emailUnsubscribes)
        .set({ resubscribedAt: new Date() })
        .where(eq(emailUnsubscribes.token, input.token));

      return { success: true };
    }),

  // Protected: get current user's unsubscribe preferences
  getMyPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const prefs = await db.select().from(emailUnsubscribes)
        .where(
          and(
            eq(emailUnsubscribes.userId, ctx.user.id),
            sql`${emailUnsubscribes.resubscribedAt} IS NULL`
          )
        );

      return prefs.map(p => ({
        id: p.id,
        emailType: p.emailType ?? "all",
        token: p.token,
        unsubscribedAt: p.unsubscribedAt,
      }));
    }),

  // Protected: unsubscribe from a specific email type
  unsubscribeType: protectedProcedure
    .input(z.object({
      emailType: z.string(), // "all", "offer", "order", "review", "system", etc.
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check if already unsubscribed
      const [existing] = await db.select().from(emailUnsubscribes)
        .where(
          and(
            eq(emailUnsubscribes.userId, ctx.user.id),
            input.emailType === "all"
              ? sql`${emailUnsubscribes.emailType} IS NULL`
              : eq(emailUnsubscribes.emailType, input.emailType),
            sql`${emailUnsubscribes.resubscribedAt} IS NULL`
          )
        )
        .limit(1);

      if (existing) {
        return { success: true, token: existing.token, alreadyUnsubscribed: true };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const userEmail = ctx.user.email ?? "";

      await db.insert(emailUnsubscribes).values({
        userId: ctx.user.id,
        email: userEmail,
        emailType: input.emailType === "all" ? null : input.emailType,
        token,
        unsubscribedAt: new Date(),
      });

      return { success: true, token, alreadyUnsubscribed: false };
    }),

  // Protected: resubscribe from a specific email type
  resubscribeType: protectedProcedure
    .input(z.object({
      emailType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(emailUnsubscribes)
        .set({ resubscribedAt: new Date() })
        .where(
          and(
            eq(emailUnsubscribes.userId, ctx.user.id),
            input.emailType === "all"
              ? sql`${emailUnsubscribes.emailType} IS NULL`
              : eq(emailUnsubscribes.emailType, input.emailType),
            sql`${emailUnsubscribes.resubscribedAt} IS NULL`
          )
        );

      return { success: true };
    }),
});
