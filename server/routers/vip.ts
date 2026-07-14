/**
 * VIP Router — handles VIP subscription management via Stripe
 *
 * Procedures:
 *   vip.getStatus        — get current user's VIP status
 *   vip.createCheckout   — create Stripe Checkout Session (monthly/yearly)
 *   vip.cancelSubscription — cancel Stripe subscription at period end
 *   vip.getAiScanUsage   — get current month AI scan usage
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";

// VIP plan pricing (HKD)
export const VIP_PLANS = {
  monthly: {
    priceId: process.env.STRIPE_VIP_MONTHLY_PRICE_ID ?? "",
    amount: 3800, // HKD cents
    label: "月費方案",
    period: "month",
  },
  yearly: {
    priceId: process.env.STRIPE_VIP_YEARLY_PRICE_ID ?? "",
    amount: 29800, // HKD cents
    label: "年費方案",
    period: "year",
  },
} as const;

export const FREE_AI_SCAN_LIMIT = 25; // per month for free users

function getStripe() {
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
}

/** Check if user is currently VIP (plan != 'none' AND not expired) */
export function isVipActive(user: { vipPlan: string; vipExpiresAt: Date | null }): boolean {
  if (user.vipPlan === "none") return false;
  if (!user.vipExpiresAt) return false;
  return user.vipExpiresAt > new Date();
}

export const vipRouter = router({
  /** Get current user's VIP status */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [user] = await db
      .select({
        vipPlan: users.vipPlan,
        vipExpiresAt: users.vipExpiresAt,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) throw new TRPCError({ code: "NOT_FOUND" });

    const active = isVipActive(user as any);
    return {
      isVip: active,
      plan: user.vipPlan,
      expiresAt: user.vipExpiresAt,
      hasSubscription: !!user.stripeSubscriptionId,
    };
  }),

  /** Create Stripe Checkout Session for VIP subscription */
  createCheckout: protectedProcedure
    .input(z.object({
      plan: z.enum(["monthly", "yearly"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const planConfig = VIP_PLANS[input.plan];
      if (!planConfig.priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Stripe Price ID for ${input.plan} plan is not configured. Please set STRIPE_VIP_${input.plan.toUpperCase()}_PRICE_ID.`,
        });
      }

      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const stripe = getStripe();

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name ?? undefined,
          metadata: { userId: String(ctx.user.id) },
        });
        customerId = customer.id;
        await db.update(users)
          .set({ stripeCustomerId: customerId })
          .where(eq(users.id, ctx.user.id));
      }

      // Create Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: planConfig.priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          userId: String(ctx.user.id),
          vipPlan: input.plan,
        },
        subscription_data: {
          metadata: {
            userId: String(ctx.user.id),
            vipPlan: input.plan,
          },
        },
      });

      return { sessionId: session.id, url: session.url };
    }),

  /** Cancel subscription at period end */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema_new");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [user] = await db
      .select({ stripeSubscriptionId: users.stripeSubscriptionId })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user?.stripeSubscriptionId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true, message: "訂閱將在到期日自動終止，期間仍可使用 VIP 功能。" };
  }),

  /** Create Stripe Customer Portal session for subscription management */
  createPortalSession: protectedProcedure
    .input(z.object({
      returnUrl: z.string().url().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("../db");
      const { users } = await import("../../drizzle/schema_new");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found. Please subscribe first." });
      }

      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: input?.returnUrl ?? "https://boxium.asia/profile?tab=vip",
      });

      return { url: session.url };
    }),

  /** Get current month AI scan usage */
  getAiScanUsage: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { aiScanUsage, users } = await import("../../drizzle/schema_new");
    const { eq, and } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { used: 0, limit: FREE_AI_SCAN_LIMIT, isVip: false };

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Get user VIP status
    const [user] = await db
      .select({ vipPlan: users.vipPlan, vipExpiresAt: users.vipExpiresAt })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const vipActive = user ? isVipActive(user as any) : false;

    // Get usage count
    const [usage] = await db
      .select({ count: aiScanUsage.count })
      .from(aiScanUsage)
      .where(and(eq(aiScanUsage.userId, ctx.user.id), eq(aiScanUsage.yearMonth, yearMonth)))
      .limit(1);

    return {
      used: usage?.count ?? 0,
      limit: vipActive ? null : FREE_AI_SCAN_LIMIT, // null = unlimited
      isVip: vipActive,
    };
  }),
});
