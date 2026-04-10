/**
 * BOXIUM PTCG — Security Admin Router
 *
 * Provides tRPC procedures for the Admin Anti-Scraping Monitoring Panel.
 * All procedures are admin-only (adminProcedure).
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

/** Admin-only guard */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({ ctx });
});

export const securityRouter = router({
  /** Get security stats summary (event counts by type, last 1h/24h) */
  getStats: adminProcedure.query(() => {
    return getSecurityStats();
  }),

  /** Get recent security events log (newest first, max 200) */
  getLog: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(200) }))
    .query(({ input }) => {
      return getSecurityLog(input.limit);
    }),

  /** Get blocked IP summaries with event counts */
  getBlockedIps: adminProcedure.query(() => {
    return getBlockedIpSummaries();
  }),

  /** Get top blocked User-Agents */
  getTopUserAgents: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(({ input }) => {
      return getTopBlockedUserAgents(input.limit);
    }),

  /** Manually block an IP address */
  blockIp: adminProcedure
    .input(
      z.object({
        ip: z.string().min(1).max(45),
        reason: z.string().min(1).max(200),
      })
    )
    .mutation(({ input }) => {
      adminBlockIp(input.ip, input.reason);
      return { success: true, message: `IP ${input.ip} has been blocked.` };
    }),

  /** Unblock a previously blocked IP address */
  unblockIp: adminProcedure
    .input(z.object({ ip: z.string().min(1).max(45) }))
    .mutation(({ input }) => {
      adminUnblockIp(input.ip);
      return { success: true, message: `IP ${input.ip} has been unblocked.` };
    }),
});
