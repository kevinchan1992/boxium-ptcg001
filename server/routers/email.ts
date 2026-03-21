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

  // Admin: get 7-day daily email send chart data
  getChartData: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Build last 7 days date range (HKT-aware: use UTC offset +8)
      const days: { date: string; sent: number; failed: number; skipped: number }[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const label = dayStart.toLocaleDateString('zh-HK', {
          month: 'numeric',
          day: 'numeric',
          timeZone: 'Asia/Hong_Kong',
        });

        const [sentRes, failedRes, skippedRes] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(emailLogs)
            .where(and(eq(emailLogs.status, 'sent'), gte(emailLogs.sentAt, dayStart), lte(emailLogs.sentAt, dayEnd))),
          db.select({ count: sql<number>`count(*)` }).from(emailLogs)
            .where(and(eq(emailLogs.status, 'failed'), gte(emailLogs.sentAt, dayStart), lte(emailLogs.sentAt, dayEnd))),
          db.select({ count: sql<number>`count(*)` }).from(emailLogs)
            .where(and(eq(emailLogs.status, 'skipped'), gte(emailLogs.sentAt, dayStart), lte(emailLogs.sentAt, dayEnd))),
        ]);

        days.push({
          date: label,
          sent: Number(sentRes[0]?.count ?? 0),
          failed: Number(failedRes[0]?.count ?? 0),
          skipped: Number(skippedRes[0]?.count ?? 0),
        });
      }

      return { days };
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

  // Admin: send test email
  sendTestEmail: adminProcedure
    .input(z.object({
      to: z.string().email(),
      emailType: z.enum(["welcome", "offer_received", "offer_accepted", "offer_rejected", "order_confirmed", "order_shipped", "order_completed", "order_cancelled", "seller_approved", "seller_rejected", "payment_reminder"]),
    }))
    .mutation(async ({ input }) => {
      const {
        sendEmail,
        buildNewOfferEmail,
        buildSellerApprovedEmail,
        buildSellerRejectedEmail,
        buildWelcomeEmail,
      } = await import("../emailService");
      const { buildOrderConfirmedEmail, buildOrderShippedEmail, buildOrderCompletedBuyerEmail, buildOrderCancelledEmail } = await import("../emailService");

      const DEMO_ORDER_NO = "BOXIUM-TEST-001";
      const DEMO_ITEM = "Charizard ex SAR PSA 10";
      const DEMO_PRICE = "8000.00";
      const DEMO_LISTING_ID = 999;

      let subject = "";
      let html = "";

      switch (input.emailType) {
        case "welcome": {
          const r = buildWelcomeEmail({ userName: "測試用戶", siteUrl: "https://boxium.asia" });
          subject = r.subject; html = r.html; break;
        }
        case "offer_received": {
          const r = buildNewOfferEmail({ sellerName: "測試賣家", buyerName: "測試買家", cardName: DEMO_ITEM, offerAmountHkd: DEMO_PRICE, listingPriceHkd: "9000.00", expiresAt: "2026-04-01 08:00 (HKT)", sellerDashboardUrl: "https://boxium.asia/seller" });
          subject = r.subject; html = r.html; break;
        }
        case "offer_accepted": {
          subject = `✅ 出價已被接受 — ${DEMO_ITEM}`;
          html = (await import("../emailService")).wrapHtmlTest(
            subject,
            `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">出價已被接受 ✅</h2>
            <p>親愛的 <strong>測試買家</strong>，</p>
            <p>賣家已接受您對商品 <strong>${DEMO_ITEM}</strong> 的出價 <strong>HKD ${DEMO_PRICE}</strong>！</p>
            <p>請盡快完成付款以確保訂單。</p>
            <div style="text-align:center;margin:28px 0;"><a href="https://boxium.asia" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">前往商品頁付款</a></div>
            <p style="color:#e67e22;font-size:13px;">⚠️ 請在 24 小時內完成付款，逾期訂單將自動取消。</p>`
          );
          break;
        }
        case "offer_rejected": {
          subject = `❌ 出價未獲接受 — ${DEMO_ITEM}`;
          html = (await import("../emailService")).wrapHtmlTest(
            subject,
            `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">出價未獲接受 ❌</h2>
            <p>親愛的 <strong>測試買家</strong>，</p>
            <p>很遺憾，賣家未接受您對商品 <strong>${DEMO_ITEM}</strong> 的出價 <strong>HKD ${DEMO_PRICE}</strong>。</p>
            <p>您可以繼續瀏覽其他商品或調整出價再試。</p>
            <div style="text-align:center;margin:28px 0;"><a href="https://boxium.asia/marketplace" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">繼續瀏覽市集</a></div>`
          );
          break;
        }
        case "order_confirmed": {
          const r = buildOrderConfirmedEmail({ orderNo: DEMO_ORDER_NO, itemName: DEMO_ITEM, priceHkd: DEMO_PRICE, listingId: DEMO_LISTING_ID });
          subject = r.subject; html = r.html; break;
        }
        case "order_shipped": {
          const r = buildOrderShippedEmail({ orderNo: DEMO_ORDER_NO, itemName: DEMO_ITEM, priceHkd: DEMO_PRICE, trackingNo: "SF1234567890" });
          subject = r.subject; html = r.html; break;
        }
        case "order_completed": {
          const r = buildOrderCompletedBuyerEmail({ orderNo: DEMO_ORDER_NO, itemName: DEMO_ITEM, priceHkd: DEMO_PRICE });
          subject = r.subject; html = r.html; break;
        }
        case "order_cancelled": {
          const r = buildOrderCancelledEmail({ orderNo: DEMO_ORDER_NO, itemName: DEMO_ITEM, priceHkd: DEMO_PRICE, note: "測試取消原因" });
          subject = r.subject; html = r.html; break;
        }
        case "seller_approved": {
          const r = buildSellerApprovedEmail({ displayName: "測試賣家", siteUrl: "https://boxium.asia" });
          subject = r.subject; html = r.html; break;
        }
        case "seller_rejected": {
          const r = buildSellerRejectedEmail({ displayName: "測試賣家", rejectReason: "資料不完整，請重新提交申請。" });
          subject = r.subject; html = r.html; break;
        }
        case "payment_reminder": {
          subject = `⏰ 付款提醒 — ${DEMO_ITEM}`;
          html = (await import("../emailService")).wrapHtmlTest(
            subject,
            `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">付款提醒 ⏰</h2>
            <p>親愛的 <strong>測試買家</strong>，</p>
            <p>您對商品 <strong>${DEMO_ITEM}</strong> 的出價已被接受，但尚未完成付款。</p>
            <p>請盡快完成付款，否則訂單將在 <strong>24 小時</strong>後自動取消。</p>
            <div style="text-align:center;margin:28px 0;"><a href="https://boxium.asia" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">立即付款</a></div>`
          );
          break;
        }
        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown email type" });
      }

      await sendEmail({ to: input.to, subject, html, emailType: "system", skipUnsubscribeCheck: true });
      return { success: true, subject };
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
