/**
 * Admin VIP Router — VIP Subscription & Revenue Management
 *
 * Procedures:
 *   adminVip.getStats          — Executive summary: total VIPs, plan distribution, MRR, failed payments
 *   adminVip.getSubscriptions  — Paginated list of VIP subscribers with Stripe status
 *   adminVip.sendRenewalReminder — Send renewal reminder email to a specific user
 *   adminVip.cancelSubscription — Force cancel a user's Stripe subscription
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";

// VIP plan pricing (HKD cents)
const MONTHLY_AMOUNT_CENTS = 3800; // HKD 38
const YEARLY_AMOUNT_CENTS = 29800; // HKD 298

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
}

export const adminVipRouter = router({
  /** Executive summary stats */
  getStats: adminProcedure.query(async () => {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema_new");
    const { eq, ne, and, isNotNull, lt } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // All VIP users ever (including expired) for total revenue calculation
    const allVipUsersEver = await db
      .select({
        id: users.id,
        vipPlan: users.vipPlan,
        vipExpiresAt: users.vipExpiresAt,
        stripeSubscriptionId: users.stripeSubscriptionId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        and(
          ne(users.vipPlan, "none"),
          isNotNull(users.vipExpiresAt),
          ne(users.role, "admin")
        )
      );
    const allVipUsers = allVipUsersEver;

    // Filter to currently active (not expired)
    const activeVips = allVipUsers.filter(u => u.vipExpiresAt && u.vipExpiresAt > now);
    const monthlyCount = activeVips.filter(u => u.vipPlan === "monthly").length;
    const yearlyCount = activeVips.filter(u => u.vipPlan === "yearly").length;
    const totalVips = activeVips.length;

    // MRR calculation: monthly users × 38 + yearly users × (298/12)
    const mrr = (monthlyCount * (MONTHLY_AMOUNT_CENTS / 100)) +
                (yearlyCount * (YEARLY_AMOUNT_CENTS / 100 / 12));

    // New VIPs this month
    const newThisMonth = allVipUsers.filter(u => u.createdAt >= firstOfMonth).length;

    // Last month active count (approximate: total - new this month)
    const lastMonthTotal = totalVips - newThisMonth;
    const growthPct = lastMonthTotal > 0
      ? Math.round(((totalVips - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;

    // Check Stripe for past_due subscriptions
    let failedPayments = 0;
    let expiringSoon = 0;
    try {
      const stripe = getStripe();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Count users with past_due or expiring within 7 days
      const usersWithSubs = activeVips.filter(u => u.stripeSubscriptionId);
      for (const u of usersWithSubs.slice(0, 50)) { // limit Stripe API calls
        try {
          const sub = await stripe.subscriptions.retrieve(u.stripeSubscriptionId!);
          if (sub.status === "past_due" || sub.status === "unpaid") {
            failedPayments++;
          }
        } catch {
          // ignore individual lookup errors
        }
      }

      // Expiring soon (vipExpiresAt within 7 days)
      expiringSoon = activeVips.filter(u =>
        u.vipExpiresAt && u.vipExpiresAt > now && u.vipExpiresAt <= sevenDaysFromNow
      ).length;
    } catch {
      // Stripe unavailable — use local data only
    }

    // Total cumulative revenue: sum all VIP users' plan amounts
    // Monthly users: HKD 38 each, Yearly users: HKD 298 each
    const totalMonthlyUsers = allVipUsersEver.filter(u => u.vipPlan === "monthly").length;
    const totalYearlyUsers = allVipUsersEver.filter(u => u.vipPlan === "yearly").length;
    const totalRevenue = (totalMonthlyUsers * (MONTHLY_AMOUNT_CENTS / 100)) +
                         (totalYearlyUsers * (YEARLY_AMOUNT_CENTS / 100));

    return {
      totalVips,
      monthlyCount,
      yearlyCount,
      monthlyPct: totalVips > 0 ? Math.round((monthlyCount / totalVips) * 100) : 0,
      yearlyPct: totalVips > 0 ? Math.round((yearlyCount / totalVips) * 100) : 0,
      mrr: Math.round(mrr * 100) / 100,
      failedPayments,
      expiringSoon,
      pendingAttention: failedPayments + expiringSoon,
      growthPct,
      newThisMonth,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalMonthlyUsers,
      totalYearlyUsers,
    };
  }),

  /** Paginated VIP subscription list */
  getSubscriptions: adminProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      planFilter: z.enum(["all", "monthly", "yearly"]).default("all"),
      statusFilter: z.enum(["all", "active", "expired", "past_due"]).default("all"),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const { users, sellerProfiles } = await import("../../drizzle/schema_new");
      const { ne, and, isNotNull, or, like, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const now = new Date();

      // Build where conditions
      const conditions: any[] = [
        ne(users.vipPlan, "none"),
        ne(users.role, "admin"),
      ];
      if (input.planFilter !== "all") {
        conditions.push(eq(users.vipPlan, input.planFilter));
      }
      if (input.search) {
        conditions.push(
          or(
            like(users.email, `%${input.search}%`),
            like(users.name, `%${input.search}%`)
          )
        );
      }

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          vipPlan: users.vipPlan,
          vipExpiresAt: users.vipExpiresAt,
          stripeSubscriptionId: users.stripeSubscriptionId,
          stripeCustomerId: users.stripeCustomerId,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(and(...conditions));

      // Get seller profiles for avatars/display names
      const userIds = allUsers.map(u => u.id);
      let profileMap: Record<number, { displayName: string; avatarUrl: string | null }> = {};
      if (userIds.length > 0) {
        const profiles = await db
          .select({
            userId: sellerProfiles.userId,
            displayName: sellerProfiles.displayName,
            avatarUrl: sellerProfiles.avatarUrl,
          })
          .from(sellerProfiles)
          .where(
            userIds.length === 1
              ? eq(sellerProfiles.userId, userIds[0])
              : or(...userIds.map(id => eq(sellerProfiles.userId, id)))
          );
        profiles.forEach(p => {
          profileMap[p.userId] = { displayName: p.displayName, avatarUrl: p.avatarUrl };
        });
      }

      // Enrich with status
      let enriched = allUsers.map(u => {
        const isExpired = !u.vipExpiresAt || u.vipExpiresAt <= now;
        const profile = profileMap[u.id];
        return {
          id: u.id,
          email: u.email,
          name: u.name || u.email.split("@")[0],
          displayName: profile?.displayName || u.name || u.email.split("@")[0],
          avatarUrl: profile?.avatarUrl || null,
          vipPlan: u.vipPlan as "monthly" | "yearly",
          vipExpiresAt: u.vipExpiresAt,
          stripeSubscriptionId: u.stripeSubscriptionId,
          stripeCustomerId: u.stripeCustomerId,
          subscribedAt: u.createdAt,
          status: isExpired ? "expired" : "active",
          amountHkd: u.vipPlan === "monthly"
            ? MONTHLY_AMOUNT_CENTS / 100
            : YEARLY_AMOUNT_CENTS / 100,
        };
      });

      // Apply status filter
      if (input.statusFilter !== "all") {
        enriched = enriched.filter(u => {
          if (input.statusFilter === "active") return u.status === "active";
          if (input.statusFilter === "expired") return u.status === "expired";
          return true;
        });
      }

      // Sort: active first, then by expiry date
      enriched.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        if (a.vipExpiresAt && b.vipExpiresAt) {
          return a.vipExpiresAt.getTime() - b.vipExpiresAt.getTime();
        }
        return 0;
      });

      const total = enriched.length;
      const offset = (input.page - 1) * input.pageSize;
      const page = enriched.slice(offset, offset + input.pageSize);

      return {
        items: page,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /** Send renewal reminder email */
  sendRenewalReminder: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      const { sendEmail } = await import("../emailService");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name, vipPlan: users.vipPlan, vipExpiresAt: users.vipExpiresAt })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用戶不存在" });
      if (!user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "用戶沒有 Email" });

      const planLabel = user.vipPlan === "monthly" ? "月費方案" : "年費方案";
      const expiryStr = user.vipExpiresAt
        ? user.vipExpiresAt.toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })
        : "即將到期";

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: #06038d; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #FFD700; margin: 0; font-size: 24px;">BOXIUM TCG</h1>
            <p style="color: #fff; margin: 8px 0 0; font-size: 14px;">VIP 會員續訂提醒</p>
          </div>
          <div style="background: #fff; padding: 32px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px;">親愛的 <strong>${user.name || user.email}</strong>，</p>
            <p style="color: #374151;">您的 BOXIUM VIP 會員（<strong>${planLabel}</strong>）將於 <strong style="color: #dc2626;">${expiryStr}</strong> 到期。</p>
            <p style="color: #374151;">為確保您繼續享有所有 VIP 專屬功能，請記得在到期前續訂。</p>
            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <h3 style="color: #06038d; margin: 0 0 12px;">VIP 專屬功能包括：</h3>
              <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>持倉走勢圖（完整時間範圍切換）</li>
                <li>長期價格走勢圖（3M / 6M / 1Y / ALL）</li>
                <li>智能入庫無限次</li>
                <li>CSV 匯出功能</li>
                <li>PSA 鑑定支援</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://boxium.asia/profile?tab=vip" style="background: #FFD700; color: #06038d; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">立即續訂 VIP</a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">如有任何問題，請聯絡我們的客服團隊。</p>
          </div>
        </div>
      `;

      const sent = await sendEmail({
        to: user.email,
        subject: `【BOXIUM TCG】您的 VIP 會員即將於 ${expiryStr} 到期`,
        html,
        emailType: "vip_renewal_reminder",
        toUserId: user.id,
        dedupeKey: `vip_renewal_${user.id}_${new Date().toISOString().slice(0, 10)}`,
      });

      return { success: sent };
    }),

  /** Force cancel a user's Stripe subscription */
  cancelSubscription: adminProcedure
    .input(z.object({
      userId: z.number(),
      immediately: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          stripeSubscriptionId: users.stripeSubscriptionId,
          vipPlan: users.vipPlan,
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用戶不存在" });
      if (!user.stripeSubscriptionId) {
        // No Stripe sub — just clear local VIP status
        await db.update(users)
          .set({ vipPlan: "none", vipExpiresAt: null, stripeSubscriptionId: null })
          .where(eq(users.id, input.userId));
        return { success: true, message: "已清除本地 VIP 狀態（無 Stripe 訂閱）" };
      }

      const stripe = getStripe();
      try {
        if (input.immediately) {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
          // Update local DB immediately
          await db.update(users)
            .set({ vipPlan: "none", vipExpiresAt: null, stripeSubscriptionId: null })
            .where(eq(users.id, input.userId));
        } else {
          // Cancel at period end
          await stripe.subscriptions.update(user.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        }
        return {
          success: true,
          message: input.immediately
            ? "已立即取消訂閱並清除 VIP 狀態"
            : "已設定訂閱於到期後不再續訂",
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Stripe 操作失敗: ${err.message}`,
        });
      }
    }),
});
