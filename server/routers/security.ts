/**
 * BOXIUM PTCG — Security Admin Router (v2)
 *
 * Provides tRPC procedures for the Admin Anti-Scraping Monitoring Panel.
 * All procedures are admin-only.
 *
 * Changes in v2:
 *  - blockIp / unblockIp now await DB persistence
 *  - getDbLog: query historical events from DB (beyond in-memory 500 limit)
 *  - getDbBlockedIps: query persistent blocked IP list from DB
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  getSecurityLog,
  getBlockedIpSummaries,
  getTopBlockedUserAgents,
  getSecurityStats,
  adminBlockIp,
  adminUnblockIp,
} from "../middleware/security";
import { getDb as getDbAsync } from "../db";

/** Admin-only guard */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (process.env.NODE_ENV === "development") return next({ ctx: { ...ctx, user: ctx.user ?? { id: 0, role: "admin" as const, email: "", name: "" } } });
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({ ctx });
});

export const securityRouter = router({
  /** Get security stats summary (event counts by type, last 1h/24h) */
  getStats: adminProcedure.query(() => {
    return getSecurityStats();
  }),

  /** Get recent security events from in-memory cache (newest first, max 500) */
  getLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
    .query(({ input }) => {
      return getSecurityLog(input.limit);
    }),

  /** Get historical security events from DB (for audit, beyond in-memory limit) */
  getDbLog: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        type: z.enum(["BOT_BLOCKED", "RATE_LIMITED", "UPLOAD_REJECTED", "MANUAL_BLOCK"]).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDbAsync();
        if (!db) return { events: [], total: 0 };
        const { securityEvents } = await import("../../drizzle/schema_new");
        const { desc, eq, count } = await import("drizzle-orm");
        if (input.type) {
          const rows = await db.select().from(securityEvents)
            .where(eq(securityEvents.type, input.type))
            .orderBy(desc(securityEvents.createdAt))
            .limit(input.limit).offset(input.offset);
          const [{ total }] = await db.select({ total: count() }).from(securityEvents).where(eq(securityEvents.type, input.type));
          return { events: rows, total };
        }
        const rows = await db.select().from(securityEvents)
          .orderBy(desc(securityEvents.createdAt))
          .limit(input.limit).offset(input.offset);
        const [{ total }] = await db.select({ total: count() }).from(securityEvents);
        return { events: rows, total };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /** Get blocked IP summaries from in-memory cache */
  getBlockedIps: adminProcedure.query(() => {
    return getBlockedIpSummaries();
  }),

  /** Get persistent blocked IPs from DB */
  getDbBlockedIps: adminProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(async ({ input }) => {
      try {
        const db = await getDbAsync();
        if (!db) return [];
        const { blockedIps } = await import("../../drizzle/schema_new");
        const { eq, desc } = await import("drizzle-orm");
        if (input.activeOnly) {
          return await db.select().from(blockedIps).where(eq(blockedIps.isActive, true)).orderBy(desc(blockedIps.blockedAt));
        }
        return await db.select().from(blockedIps).orderBy(desc(blockedIps.blockedAt));
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  /** Get top blocked User-Agents */
  getTopUserAgents: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(({ input }) => {
      return getTopBlockedUserAgents(input.limit);
    }),

  /** Manually block an IP address (persisted to DB) */
  blockIp: adminProcedure
    .input(
      z.object({
        ip: z.string().min(1).max(45),
        reason: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const blockedBy = (ctx as any).user?.email ?? "admin";
      await adminBlockIp(input.ip, input.reason, blockedBy);
      return { success: true, message: `IP ${input.ip} has been blocked and persisted to database.` };
    }),

  /** Unblock a previously blocked IP address (persisted to DB) */
  unblockIp: adminProcedure
    .input(z.object({ ip: z.string().min(1).max(45) }))
    .mutation(async ({ input }) => {
      await adminUnblockIp(input.ip);
      return { success: true, message: `IP ${input.ip} has been unblocked and updated in database.` };
    }),
});
