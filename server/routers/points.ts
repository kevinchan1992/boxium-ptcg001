/**
 * Points Router — 點數系統 tRPC 程序
 * 包含：查詢餘額、交易紀錄、建立儲值 Checkout
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getUserPointBalance, getPointTransactions } from "../db/points";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// 儲值套餐 (HKD = 點數 1:1)
export const TOPUP_PACKAGES = [
  { amount: 50,    bonus: 0,    label: "HK$50 → 50 點" },
  { amount: 500,   bonus: 25,   label: "HK$500 → 525 點" },
  { amount: 1000,  bonus: 80,   label: "HK$1,000 → 1,080 點" },
  { amount: 2500,  bonus: 250,  label: "HK$2,500 → 2,750 點" },
  { amount: 5000,  bonus: 600,  label: "HK$5,000 → 5,600 點" },
  { amount: 10000, bonus: 1500, label: "HK$10,000 → 11,500 點" },
] as const;

export const pointsRouter = router({
  /** 取得目前點數餘額 */
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getUserPointBalance(ctx.user.id);
    return { balance };
  }),

  /** 取得點數交易紀錄 */
  getTransactions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20), offset: z.number().default(0) }))
    .query(async ({ ctx, input }) => {
      const rows = await getPointTransactions(ctx.user.id, input.limit, input.offset);
      return { rows };
    }),

  /** 取得儲值套餐列表 */
  getTopupPackages: publicProcedure.query(() => {
    return TOPUP_PACKAGES.map(p => ({ ...p, totalPoints: p.amount + p.bonus }));
  }),

  /** 建立 Stripe Checkout Session 進行點數儲值 */
  createTopupCheckout: protectedProcedure
    .input(z.object({
      amount: z.number().refine(v => TOPUP_PACKAGES.some(p => p.amount === v), {
        message: "無效的儲值金額",
      }),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pkg = TOPUP_PACKAGES.find(p => p.amount === input.amount)!;
      const totalPoints = pkg.amount + pkg.bonus;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: {
              name: `BOXIUM 點數 ${totalPoints} 點`,
              description: pkg.bonus > 0 ? `儲值 HK$${pkg.amount} 獲得 ${totalPoints} 點（含 ${pkg.bonus} 點贈送）` : `儲值 HK$${pkg.amount} 獲得 ${totalPoints} 點`,
            },
            unit_amount: pkg.amount * 100, // Stripe 以分為單位
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${input.origin}/points?topup=success`,
        cancel_url: `${input.origin}/points?topup=cancel`,
        metadata: {
          type: "point_topup",
          userId: ctx.user.id,
          amount: String(pkg.amount),
          totalPoints: String(totalPoints),
        },
      });

      return { url: session.url! };
    }),
});
