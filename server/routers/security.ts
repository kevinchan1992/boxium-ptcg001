/**
 * BOXIUM PTCG — Security Admin Router (v3)
 *
 * Provides tRPC procedures for the Admin Anti-Scraping Monitoring Panel.
 * All procedures are admin-only.
 *
 * v3 additions:
 *  - whitelistMyIp / removeFromWhitelist / getWhitelistedIps — admin IP whitelist
 *  - getRateLimitLog — paginated RATE_LIMITED events with top-IP grouping
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
  registerAdminIp,
  unregisterAdminIp,
  getAdminWhitelistIps,
  getClientIp,
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

  // ─── Admin IP Whitelist ──────────────────────────────────────────────────────

  /** Get all whitelisted admin IPs */
  getWhitelistedIps: adminProcedure.query(() => {
    return getAdminWhitelistIps();
  }),

  /** Register current admin's IP to bypass all rate limits */
  whitelistMyIp: adminProcedure.mutation(({ ctx }) => {
    const ip = getClientIp(ctx.req);
    registerAdminIp(ip);
    return { success: true, ip, message: `您的 IP ${ip} 已加入白名單，將豁免所有請求限流。` };
  }),

  /** Remove an IP from admin whitelist */
  removeFromWhitelist: adminProcedure
    .input(z.object({ ip: z.string().min(1).max(45) }))
    .mutation(({ input }) => {
      unregisterAdminIp(input.ip);
      return { success: true, message: `IP ${input.ip} 已從白名單移除。` };
    }),

  // ─── Rate Limit Monitoring ───────────────────────────────────────────────────

  /** Get Rate Limit events with IP grouping for monitoring */
  getRateLimitLog: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDbAsync();
        if (!db) return { events: [], total: 0, topIps: [] };
        const { securityEvents } = await import("../../drizzle/schema_new");
        const { desc, eq, count, sql } = await import("drizzle-orm");

        // Get paginated RATE_LIMITED events
        const events = await db.select().from(securityEvents)
          .where(eq(securityEvents.type, "RATE_LIMITED"))
          .orderBy(desc(securityEvents.createdAt))
          .limit(input.limit).offset(input.offset);

        const [{ total }] = await db.select({ total: count() }).from(securityEvents)
          .where(eq(securityEvents.type, "RATE_LIMITED"));

        // Get top IPs by rate limit hit count
        const topIps = await db.select({
          ip: securityEvents.ip,
          hitCount: count(),
          lastSeen: sql<Date>`MAX(${securityEvents.createdAt})`,
        })
          .from(securityEvents)
          .where(eq(securityEvents.type, "RATE_LIMITED"))
          .groupBy(securityEvents.ip)
          .orderBy(sql`COUNT(*) DESC`)
          .limit(20);

        return { events, total, topIps };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),
});
