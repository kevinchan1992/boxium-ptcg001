/**
 * PSA Grading Service tRPC Router
 * Handles all PSA grading service operations: tiers, submissions, batches, payments
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb, getSystemSetting, setSystemSetting, isGradingMaintenanceMode, isGradingWhitelisted } from "../db";
import {
  gradingServiceTiers,
  gradingBatches,
  gradingSubmissions,
  gradingSubmissionItems,
  users,
  type GradingServiceTier,
  type GradingBatch,
  type GradingSubmission,
  type GradingSubmissionItem,
} from "../../drizzle/schema_new";
import { eq, and, desc, asc, or, inArray, count, isNotNull } from "drizzle-orm";
import Stripe from "stripe";
import QRCode from "qrcode";
import { createNotification } from "../db/notifications";
import { sendEmail } from "../emailService";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
}

/** Generate grading order number: BOXIUM-GRD-YYYYMMDD-XXXX */
function generateGradingOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BOXIUM-GRD-${date}-${rand}`;
}

/** Send grading notification (in-app + email) */
async function sendGradingNotification(params: {
  userId: number;
  userEmail: string;
  userName: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string;
  subject: string;
  html: string;
}) {
  // In-app notification
  try {
    await createNotification({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      linkUrl: params.linkUrl,
    });
  } catch (e) {
    console.error("[Grading] Failed to create notification:", e);
  }
  // Email
  try {
    await sendEmail({
      to: params.userEmail,
      subject: params.subject,
      html: params.html,
      emailType: "grading",
      toUserId: params.userId,
    });
  } catch (e) {
    console.error("[Grading] Failed to send email:", e);
  }
}

/** Build grading email HTML */
function buildGradingEmail(params: {
  userName: string;
  title: string;
  body: string;
  orderNo: string;
  linkUrl: string;
  ctaText?: string;
  extraHtml?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${params.title}</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #06038d; color: white; padding: 24px 32px;">
      <h1 style="margin: 0; font-size: 22px;">BOXIUM × PSA 代客鑑定</h1>
    </div>
    <div style="padding: 32px;">
      <p style="color: #333; font-size: 16px;">親愛的 ${params.userName}，</p>
      <p style="color: #333; font-size: 16px;">${params.body}</p>
      <div style="background: #f8f9fa; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #666; font-size: 14px;">申請單號</p>
        <p style="margin: 4px 0 0; color: #06038d; font-size: 18px; font-weight: bold;">${params.orderNo}</p>
      </div>
      ${params.extraHtml || ""}
      <a href="${params.linkUrl}" style="display: inline-block; background: #06038d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px; margin-top: 16px;">${params.ctaText || "查看申請詳情"}</a>
    </div>
    <div style="background: #f8f9fa; padding: 16px 32px; border-top: 1px solid #eee;">
      <p style="margin: 0; color: #999; font-size: 12px;">如有查詢，請聯絡 BOXIUM 客服。此電郵由系統自動發送，請勿直接回覆。</p>
    </div>
  </div>
</body>
</html>`;
}

export const gradingRouter = router({
  // ─── Public: Get active service tiers ────────────────────────────────────
  getServiceTiers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(gradingServiceTiers)
      .where(eq(gradingServiceTiers.isActive, true))
      .orderBy(asc(gradingServiceTiers.sortOrder));
  }),

  // ─── Public: Get next open batch ─────────────────────────────────────────
  getNextBatch: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [batch] = await db
      .select()
      .from(gradingBatches)
      .where(eq(gradingBatches.status, "open"))
      .orderBy(asc(gradingBatches.cutoffDate))
      .limit(1);
    return batch || null;
  }),

  // ─── Protected: Submit grading application ────────────────────────────────
  submitApplication: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            cardName: z.string().min(1),
            cardSet: z.string().optional(),
            cardNumber: z.string().optional(),
            cardLanguage: z.enum(["zh_tw", "ja", "en", "ko", "other"]).default("en"),
            cardImageUrl: z.string().optional(),
            tierId: z.number().int().positive(),
            condition: z.enum(["mint", "near_mint", "excellent"]).default("near_mint"),
            notes: z.string().optional(),
          })
        ).min(1),
        agreedToTerms: z.boolean().refine((v) => v === true, { message: "必須同意服務條款" }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Validate tiers and calculate fees
      const tierIdSet = new Set<number>(input.items.map((i) => i.tierId));
      const tierIds = Array.from(tierIdSet);
      const tiers = await db
        .select()
        .from(gradingServiceTiers)
        .where(and(inArray(gradingServiceTiers.id, tierIds), eq(gradingServiceTiers.isActive, true)));

      const tierMap = new Map<number, GradingServiceTier>(tiers.map((t: GradingServiceTier) => [t.id, t]));
      for (const item of input.items) {
        if (!tierMap.has(item.tierId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `服務層級 ${item.tierId} 不存在或已停用` });
        }
      }

      const totalFeeHkd = input.items.reduce((sum, item) => {
        const tier = tierMap.get(item.tierId)!;
        return sum + parseFloat(tier.feeHkd);
      }, 0);

      // Get next open batch for shipping deadline
      const [nextBatch] = await db
        .select()
        .from(gradingBatches)
        .where(eq(gradingBatches.status, "open"))
        .orderBy(asc(gradingBatches.cutoffDate))
        .limit(1);

      // Generate unique order number
      let orderNo = generateGradingOrderNo();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db
          .select({ id: gradingSubmissions.id })
          .from(gradingSubmissions)
          .where(eq(gradingSubmissions.orderNo, orderNo))
          .limit(1);
        if (existing.length === 0) break;
        orderNo = generateGradingOrderNo();
        attempts++;
      }

      // Create submission
      const [submissionResult] = await db.insert(gradingSubmissions).values({
        orderNo,
        userId: ctx.user.id,
        status: "pending_shipment",
        totalFeeHkd: totalFeeHkd.toFixed(2),
        batchId: nextBatch?.id || null,
        shippingDeadline: nextBatch?.cutoffDate || null,
      }).$returningId();

      const submissionId = submissionResult.id;

      // Create submission items
      await db.insert(gradingSubmissionItems).values(
        input.items.map((item) => ({
          submissionId,
          cardName: item.cardName,
          cardSet: item.cardSet || null,
          cardNumber: item.cardNumber || null,
          cardLanguage: item.cardLanguage,
          cardImageUrl: item.cardImageUrl || null,
          tierId: item.tierId,
          feeHkd: tierMap.get(item.tierId)!.feeHkd,
          condition: item.condition,
          notes: item.notes || null,
          itemStatus: "pending" as const,
        }))
      );

      // Get user info for notification
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);

      // Send notification
      const linkUrl = `/grading/orders/${submissionId}`;
      const printUrl = `/grading/orders/${submissionId}/print`;
      const baseUrl = "https://boxium.asia";

      await sendGradingNotification({
        userId: ctx.user.id,
        userEmail: user.email,
        userName: user.name || user.email,
        type: "grading_submitted",
        title: "PSA 鑑定申請已提交",
        body: `您的 PSA 鑑定申請 ${orderNo} 已成功提交，請盡快將卡牌寄至 BOXIUM 指定地址。`,
        linkUrl,
        subject: `【BOXIUM PSA 鑑定】申請已提交 - ${orderNo}`,
        html: buildGradingEmail({
          userName: user.name || user.email,
          title: "PSA 鑑定申請已提交",
          body: `您的 PSA 鑑定申請已成功提交，請打印申請單並連同卡牌一起寄至以下地址。`,
          orderNo,
          linkUrl: `${baseUrl}${linkUrl}`,
          ctaText: "查看申請詳情",
          extraHtml: `
<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px; font-weight: bold; color: #856404;">📦 送件地址</p>
  <p style="margin: 0; color: #333;">順豐站 852Z351</p>
  <p style="margin: 4px 0 0; color: #333;">香港新界離島區東涌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
  ${nextBatch ? `<p style="margin: 8px 0 0; color: #dc3545; font-weight: bold;">⏰ 寄件截止日期：${new Date(nextBatch.cutoffDate).toLocaleDateString("zh-HK")}</p>` : ""}
</div>
<p style="color: #dc3545; font-size: 14px;">⚠️ 請務必打印申請單連同卡牌一起寄出，否則無法處理您的申請。</p>
<a href="${baseUrl}${printUrl}" style="display: inline-block; background: #28a745; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-bottom: 8px;">🖨️ 打印申請單</a>`,
        }),
      });

      return { submissionId, orderNo };
    }),

  // ─── Protected: Get my submissions ───────────────────────────────────────
  getMySubmissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const submissions = await db
      .select()
      .from(gradingSubmissions)
      .where(eq(gradingSubmissions.userId, ctx.user.id))
      .orderBy(desc(gradingSubmissions.createdAt));

    // Get item counts
    const submissionIds = submissions.map((s: GradingSubmission) => s.id);
    if (submissionIds.length === 0) return [];

    const items = await db
      .select()
      .from(gradingSubmissionItems)
      .where(inArray(gradingSubmissionItems.submissionId, submissionIds));

    const itemCountMap = new Map<number, number>();
    for (const item of items as GradingSubmissionItem[]) {
      itemCountMap.set(item.submissionId, (itemCountMap.get(item.submissionId) || 0) + 1);
    }

    return submissions.map((s: GradingSubmission) => ({ ...s, itemCount: itemCountMap.get(s.id) || 0 }));
  }),

  // ─── Protected: Get submission detail ────────────────────────────────────
  getSubmissionDetail: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [submission] = await db
        .select()
        .from(gradingSubmissions)
        .where(
          and(
            eq(gradingSubmissions.id, input.id),
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });

      const items = await db
        .select()
        .from(gradingSubmissionItems)
        .where(eq(gradingSubmissionItems.submissionId, submission.id))
        .orderBy(asc(gradingSubmissionItems.id));

      // Get tier info for each item
      const tierIdSet2 = new Set<number>((items as GradingSubmissionItem[]).map((i) => i.tierId));
      const tierIds2 = Array.from(tierIdSet2);
      const tiers = await db
        .select()
        .from(gradingServiceTiers)
        .where(inArray(gradingServiceTiers.id, tierIds2));
      const tierMap = new Map<number, GradingServiceTier>(tiers.map((t: GradingServiceTier) => [t.id, t]));

      // Get batch info
      let batch: GradingBatch | null = null;
      if (submission.batchId) {
        const [b] = await db
          .select()
          .from(gradingBatches)
          .where(eq(gradingBatches.id, submission.batchId))
          .limit(1);
        batch = b || null;
      }

      // Get user info for printable slip
      const [userInfo] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, submission.userId))
        .limit(1);

      return {
        ...submission,
        user: userInfo || null,
        items: (items as GradingSubmissionItem[]).map((item) => ({ ...item, tier: tierMap.get(item.tierId) || null })),
        batch,
      };
    }),

  // ─── Protected: Create payment intent (after grading completed) ───────────
  createPaymentIntent: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        paymentMethod: z.enum(["stripe", "alipay_hk"]),
        origin: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [submission] = await db
        .select()
        .from(gradingSubmissions)
        .where(
          and(
            eq(gradingSubmissions.id, input.submissionId),
            eq(gradingSubmissions.userId, ctx.user.id),
            eq(gradingSubmissions.status, "graded")
          )
        )
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在或尚未完成鑑定" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const stripe = getStripe();
      const amountHkd = parseFloat(submission.totalFeeHkd);
      const amountCents = Math.round(amountHkd * 100);

      const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
        input.paymentMethod === "alipay_hk" ? ["alipay"] : ["card"];

      const session = await stripe.checkout.sessions.create({
        payment_method_types: paymentMethodTypes,
        line_items: [
          {
            price_data: {
              currency: "hkd",
              product_data: {
                name: `PSA 代客鑑定服務 - ${submission.orderNo}`,
                description: `申請單號：${submission.orderNo}`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: user.email,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          type: "grading_payment",
          submission_id: submission.id.toString(),
          order_no: submission.orderNo,
          user_id: ctx.user.id.toString(),
        },
        success_url: `${input.origin}/grading/orders/${submission.id}?payment=success`,
        cancel_url: `${input.origin}/grading/orders/${submission.id}?payment=cancelled`,
      });

      // Save payment intent ID
      await db
        .update(gradingSubmissions)
        .set({
          stripePaymentIntentId: session.id,
          paymentMethod: input.paymentMethod,
        })
        .where(eq(gradingSubmissions.id, submission.id));

      return { checkoutUrl: session.url };
    }),

  // ─── Admin: Get all tiers (including inactive) ────────────────────────────
  admin: router({
    getAllTiers: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db.select().from(gradingServiceTiers).orderBy(asc(gradingServiceTiers.sortOrder));
    }),

    upsertTier: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          name: z.string().min(1),
          feeHkd: z.number().positive(),
          maxDeclaredValueUsd: z.number().positive(),
          estimatedDaysMin: z.number().int().positive(),
          estimatedDaysMax: z.number().int().positive(),
          description: z.string().optional(),
          isActive: z.boolean().default(true),
          sortOrder: z.number().int().default(0),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const values = {
          ...data,
          feeHkd: data.feeHkd.toFixed(2),
          maxDeclaredValueUsd: data.maxDeclaredValueUsd.toFixed(2),
        };
        if (id) {
          await db.update(gradingServiceTiers).set(values).where(eq(gradingServiceTiers.id, id));
          return { id };
        } else {
          const [result] = await db.insert(gradingServiceTiers).values(values).$returningId();
          return { id: result.id };
        }
      }),

    deleteTier: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(gradingServiceTiers).where(eq(gradingServiceTiers.id, input.id));
        return { success: true };
      }),

    // Batch management
    getAllBatches: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const batches = await db.select().from(gradingBatches).orderBy(desc(gradingBatches.cutoffDate));
      // Count assigned submissions per batch
      const counts = await db
        .select({ batchId: gradingSubmissions.batchId, cnt: count(gradingSubmissions.id) })
        .from(gradingSubmissions)
        .where(isNotNull(gradingSubmissions.batchId))
        .groupBy(gradingSubmissions.batchId);
      const countMap = new Map<number, number>(counts.map((r) => [r.batchId!, Number(r.cnt)]));
      return batches.map((b) => ({ ...b, submissionCount: countMap.get(b.id) ?? 0 }));
    }),

    upsertBatch: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          batchName: z.string().min(1),
          cutoffDate: z.string(),
          shippedDate: z.string().optional(),
          expectedReturnDate: z.string().optional(),
          status: z.enum(["open", "closed", "shipped", "returned"]).default("open"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        const values = {
          ...data,
          cutoffDate: new Date(data.cutoffDate),
          shippedDate: data.shippedDate ? new Date(data.shippedDate) : null,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        };
        if (id) {
          await db.update(gradingBatches).set(values).where(eq(gradingBatches.id, id));
          return { id };
        } else {
          const [result] = await db.insert(gradingBatches).values(values).$returningId();
          return { id: result.id };
        }
      }),

    deleteBatch: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.delete(gradingBatches).where(eq(gradingBatches.id, input.id));
        return { success: true };
      }),

    // Submission management
    listSubmissions: adminProcedure
      .input(
        z.object({
          status: z.string().optional(),
          batchId: z.number().int().optional(),
          limit: z.number().int().default(50),
          offset: z.number().int().default(0),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const conditions = [];
        if (input.status) conditions.push(eq(gradingSubmissions.status, input.status as any));
        if (input.batchId) conditions.push(eq(gradingSubmissions.batchId, input.batchId));

        const submissions = await db
          .select({
            submission: gradingSubmissions,
            user: { id: users.id, name: users.name, email: users.email, phone: users.phone },
          })
          .from(gradingSubmissions)
          .leftJoin(users, eq(gradingSubmissions.userId, users.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(gradingSubmissions.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        // Get item counts
        const submissionIds = submissions.map((s: { submission: GradingSubmission; user: any }) => s.submission.id);
        if (submissionIds.length === 0) return { submissions: [], total: 0 };

        const items = await db
          .select()
          .from(gradingSubmissionItems)
          .where(inArray(gradingSubmissionItems.submissionId, submissionIds));

        const itemCountMap = new Map<number, number>();
        for (const item of items as GradingSubmissionItem[]) {
          itemCountMap.set(item.submissionId, (itemCountMap.get(item.submissionId) || 0) + 1);
        }

        return {
          submissions: submissions.map((s: { submission: GradingSubmission; user: any }) => ({
            ...s.submission,
            user: s.user,
            itemCount: itemCountMap.get(s.submission.id) || 0,
          })),
          total: submissions.length,
        };
      }),

    getSubmissionDetail: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [row] = await db
          .select({
            submission: gradingSubmissions,
            user: { id: users.id, name: users.name, email: users.email, phone: users.phone },
          })
          .from(gradingSubmissions)
          .leftJoin(users, eq(gradingSubmissions.userId, users.id))
          .where(eq(gradingSubmissions.id, input.id))
          .limit(1);

        if (!row) throw new TRPCError({ code: "NOT_FOUND" });

        const items = await db
          .select()
          .from(gradingSubmissionItems)
          .where(eq(gradingSubmissionItems.submissionId, input.id))
          .orderBy(asc(gradingSubmissionItems.id));

        const tierIdSet3 = new Set<number>((items as GradingSubmissionItem[]).map((i) => i.tierId));
        const tierIds3 = Array.from(tierIdSet3);
        const tiers = await db
          .select()
          .from(gradingServiceTiers)
          .where(inArray(gradingServiceTiers.id, tierIds3));
        const tierMap = new Map<number, GradingServiceTier>(tiers.map((t: GradingServiceTier) => [t.id, t]));

        let batch: GradingBatch | null = null;
        if (row.submission.batchId) {
          const [b] = await db
            .select()
            .from(gradingBatches)
            .where(eq(gradingBatches.id, row.submission.batchId))
            .limit(1);
          batch = b || null;
        }

        return {
          ...row.submission,
          user: row.user,
          items: (items as GradingSubmissionItem[]).map((item: GradingSubmissionItem) => ({ ...item, tier: tierMap.get(item.tierId) || null })),
          batch,
        };
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum([
            "pending_shipment",
            "received",
            "submitted_to_psa",
            "grading",
            "graded",
            "payment_overdue",
            "paid",
            "returned",
            "completed",
            "cancelled",
          ]),
          adminNotes: z.string().optional(),
          returnTrackingNo: z.string().optional(),
          batchId: z.number().int().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [submission] = await db
          .select()
          .from(gradingSubmissions)
          .where(eq(gradingSubmissions.id, input.id))
          .limit(1);

        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });

        const updateData: any = { status: input.status };
        if (input.adminNotes !== undefined) updateData.adminNotes = input.adminNotes;
        if (input.returnTrackingNo !== undefined) updateData.returnTrackingNo = input.returnTrackingNo;
        if (input.batchId !== undefined) updateData.batchId = input.batchId;

        await db.update(gradingSubmissions).set(updateData).where(eq(gradingSubmissions.id, input.id));

        // Get user for notification
        const [user] = await db.select().from(users).where(eq(users.id, submission.userId)).limit(1);
        if (!user) return { success: true };

        const linkUrl = `/grading/orders/${submission.id}`;
        const baseUrl = "https://boxium.asia";

        const statusMessages: Record<string, { title: string; body: string; ctaText: string }> = {
          received: {
            title: "BOXIUM 已確認收件",
            body: "BOXIUM 已確認收到您的卡牌，我們將為您代辦 PSA 申報及包裝，並於下次出團時送往美國 PSA 鑑定。",
            ctaText: "查看申請進度",
          },
          submitted_to_psa: {
            title: "卡牌已送往 PSA 鑑定",
            body: "您的卡牌已成功送往美國 PSA 進行鑑定，請耐心等待鑑定結果。",
            ctaText: "查看申請進度",
          },
          returned: {
            title: "鑑定卡牌已寄回",
            body: `您的鑑定卡牌已寄出${input.returnTrackingNo ? `，追蹤號碼：${input.returnTrackingNo}` : ""}，請注意查收。`,
            ctaText: "查看申請詳情",
          },
          completed: {
            title: "PSA 鑑定申請已完成",
            body: "您的 PSA 鑑定申請已全部完成，感謝使用 BOXIUM 代客鑑定服務！",
            ctaText: "查看申請詳情",
          },
          cancelled: {
            title: "PSA 鑑定申請已取消",
            body: "您的 PSA 鑑定申請已被取消。如有疑問，請聯絡 BOXIUM 客服。",
            ctaText: "查看申請詳情",
          },
        };

        const msg = statusMessages[input.status];
        if (msg) {
          await sendGradingNotification({
            userId: user.id,
            userEmail: user.email,
            userName: user.name || user.email,
            type: `grading_${input.status}`,
            title: msg.title,
            body: msg.body,
            linkUrl,
            subject: `【BOXIUM PSA 鑑定】${msg.title} - ${submission.orderNo}`,
            html: buildGradingEmail({
              userName: user.name || user.email,
              title: msg.title,
              body: msg.body,
              orderNo: submission.orderNo,
              linkUrl: `${baseUrl}${linkUrl}`,
              ctaText: msg.ctaText,
              extraHtml: input.returnTrackingNo
                ? `<div style="background: #f8f9fa; border-radius: 6px; padding: 12px; margin: 12px 0;"><p style="margin: 0; color: #666;">追蹤號碼：<strong>${input.returnTrackingNo}</strong></p></div>`
                : undefined,
            }),
          });
        }

        return { success: true };
      }),

    fillGradingResult: adminProcedure
      .input(
        z.object({
          submissionId: z.number().int().positive(),
          items: z.array(
            z.object({
              itemId: z.number().int().positive(),
              psaCertNumber: z.string().optional(),
              psaGrade: z.string().optional(),
            })
          ),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [submission] = await db
          .select()
          .from(gradingSubmissions)
          .where(eq(gradingSubmissions.id, input.submissionId))
          .limit(1);

        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });

        // Update each item
        for (const item of input.items) {
          await db
            .update(gradingSubmissionItems)
            .set({
              psaCertNumber: item.psaCertNumber || null,
              psaGrade: item.psaGrade || null,
              itemStatus: "graded",
            })
            .where(
              and(
                eq(gradingSubmissionItems.id, item.itemId),
                eq(gradingSubmissionItems.submissionId, input.submissionId)
              )
            );
        }

        // Set payment deadline (30 days from now)
        const paymentDeadline = new Date();
        paymentDeadline.setDate(paymentDeadline.getDate() + 30);

        const updateData: any = {
          status: "graded",
          gradedAt: new Date(),
          paymentDeadline,
        };
        if (input.adminNotes) updateData.adminNotes = input.adminNotes;

        await db.update(gradingSubmissions).set(updateData).where(eq(gradingSubmissions.id, input.submissionId));

        // Get user for notification
        const [user] = await db.select().from(users).where(eq(users.id, submission.userId)).limit(1);
        if (!user) return { success: true };

        const linkUrl = `/grading/orders/${submission.id}`;
        const baseUrl = "https://boxium.asia";

        // Build grading results summary
        const gradedItems = input.items.filter((i) => i.psaGrade);
        const resultsSummary = gradedItems.length > 0
          ? gradedItems.map((i) => `認證號碼 ${i.psaCertNumber || "N/A"}：PSA ${i.psaGrade}`).join("<br>")
          : "鑑定結果請查看申請詳情頁面";

        await sendGradingNotification({
          userId: user.id,
          userEmail: user.email,
          userName: user.name || user.email,
          type: "grading_graded",
          title: "PSA 鑑定完成！請完成付款",
          body: `您的 PSA 鑑定已完成！請於 30 天內（${paymentDeadline.toLocaleDateString("zh-HK")} 前）完成付款 HK$${submission.totalFeeHkd}，逾期未付款將由平台自行處理相關卡牌。`,
          linkUrl,
          subject: `【BOXIUM PSA 鑑定】鑑定完成，請完成付款 - ${submission.orderNo}`,
          html: buildGradingEmail({
            userName: user.name || user.email,
            title: "PSA 鑑定完成！請完成付款",
            body: `您的 PSA 鑑定已完成，請於 30 天內完成付款以取回您的卡牌。`,
            orderNo: submission.orderNo,
            linkUrl: `${baseUrl}${linkUrl}`,
            ctaText: "前往付款",
            extraHtml: `
<div style="background: #d4edda; border: 1px solid #28a745; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px; font-weight: bold; color: #155724;">🏆 鑑定結果</p>
  <p style="margin: 0; color: #333;">${resultsSummary}</p>
</div>
<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px; font-weight: bold; color: #856404;">💳 付款資訊</p>
  <p style="margin: 0; color: #333;">應付金額：<strong>HK$${submission.totalFeeHkd}</strong></p>
  <p style="margin: 4px 0 0; color: #dc3545; font-weight: bold;">⏰ 付款截止日期：${paymentDeadline.toLocaleDateString("zh-HK")}</p>
  <p style="margin: 8px 0 0; color: #666; font-size: 13px;">⚠️ 逾期未付款，平台保留對相關卡片自行處理之權利。</p>
</div>`,
          }),
        });

        return { success: true, paymentDeadline };
      }),

    // Overdue submissions
    listOverdueSubmissions: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return db
        .select({
          submission: gradingSubmissions,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(gradingSubmissions)
        .leftJoin(users, eq(gradingSubmissions.userId, users.id))
        .where(
          or(
            eq(gradingSubmissions.status, "payment_overdue"),
            eq(gradingSubmissions.status, "graded")
          )
        )
        .orderBy(asc(gradingSubmissions.paymentDeadline));
    }),
  }),

  // ─── Protected: Get QR Code for submission ───────────────────────────────
  getSubmissionQrCode: protectedProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify ownership
      const [submission] = await db
        .select({ id: gradingSubmissions.id, userId: gradingSubmissions.userId })
        .from(gradingSubmissions)
        .where(eq(gradingSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
      if (submission.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const baseUrl = "https://boxium.asia";
      const url = `${baseUrl}/grading/orders/${input.submissionId}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 120,
        margin: 1,
        color: { dark: "#06038d", light: "#ffffff" },
      });
      return { qrDataUrl, url };
    }),

  // ─── Public: Check grading access (maintenance mode guard) ───────────────
  getGradingAccess: publicProcedure.query(async ({ ctx }) => {
    const maintenanceMode = await isGradingMaintenanceMode();
    if (!maintenanceMode) return { allowed: true, maintenanceMode: false };
    if (!ctx.user) return { allowed: false, maintenanceMode: true };
    if (ctx.user.role === 'admin') return { allowed: true, maintenanceMode: true };
    const whitelisted = await isGradingWhitelisted(ctx.user.id);
    return { allowed: whitelisted, maintenanceMode: true };
  }),

  // ─── Admin: Set grading maintenance mode ─────────────────────────────────
  setGradingMaintenanceMode: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setSystemSetting('grading_maintenance_mode', input.enabled ? 'true' : 'false', '鑑定服務維護模式開關');
      return { success: true, enabled: input.enabled };
    }),

  // ─── Admin: Get grading maintenance mode status ───────────────────────────
  getGradingMaintenanceMode: adminProcedure.query(async () => {
    const enabled = await isGradingMaintenanceMode();
    return { enabled };
  }),
});
