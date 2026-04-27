/**
 * PSA Grading Service tRPC Router
 * Handles all PSA grading service operations: tiers, submissions, batches, payments
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb, getSystemSetting, setSystemSetting, isGradingMaintenanceMode, isGradingWhitelisted, createAuditLog, getUserShippingAddresses } from "../db";
import {
  gradingServiceTiers,
  gradingBatches,
  gradingSubmissions,
  gradingSubmissionItems,
  gradingReviews,
  users,
  type GradingServiceTier,
  type GradingBatch,
  type GradingSubmission,
  type GradingSubmissionItem,
} from "../../drizzle/schema_new";
import { eq, and, desc, asc, or, inArray, notInArray, count, isNotNull, isNull, lt, sql, like, type SQL } from "drizzle-orm";
import Stripe from "stripe";
import QRCode from "qrcode";
import { createNotification } from "../db/notifications";
import { sendEmail, wrapHtmlTest } from "../emailService";

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

/** Build grading email HTML using BOXIUM brand template */
function buildGradingEmail(params: {
  userName: string;
  title: string;
  body: string;
  orderNo: string;
  linkUrl: string;
  ctaText?: string;
  extraHtml?: string;
}): string {
  const BRAND_BLUE = "#06038d";
  const BRAND_YELLOW = "#FFD700";
  const bodyHtml = `
    <h2 style="margin:0 0 8px;color:${BRAND_BLUE};font-size:20px;">${params.title}</h2>
    <p style="margin:0 0 16px;color:#555;font-size:15px;">親愛的 ${params.userName}，</p>
    <p style="margin:0 0 20px;color:#333;font-size:15px;">${params.body}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6ff;border:2px solid #dde0f5;border-radius:10px;margin:16px 0 20px;overflow:hidden;">
      <tr><td style="background:${BRAND_BLUE};padding:10px 16px;">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">申請單號</p>
        <p style="margin:2px 0 0;font-size:16px;font-weight:bold;color:#ffffff;font-family:monospace;">${params.orderNo}</p>
      </td></tr>
    </table>
    ${params.extraHtml || ""}
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${params.linkUrl}" style="display:inline-block;background:${BRAND_YELLOW};color:${BRAND_BLUE};font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;letter-spacing:0.5px;">${params.ctaText || "查看申請詳情"}</a>
    </div>
  `;
  return wrapHtmlTest(params.title, bodyHtml);
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
        returnAddress: z.object({
          recipientName: z.string().min(1),
          phone: z.string().min(1),
          // address can be empty when sfStationCode is provided (SF station pickup mode)
          address: z.string().default(""),
          district: z.string().optional(),
          region: z.string().default("香港"),
          sfStationCode: z.string().optional(),
          sfStationName: z.string().optional(),
        }).optional(),
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
        status: "awaiting_payment",
        totalFeeHkd: totalFeeHkd.toFixed(2),
        batchId: nextBatch?.id || null,
        shippingDeadline: nextBatch?.cutoffDate || null,
        returnAddress: input.returnAddress ? JSON.stringify(input.returnAddress) : null,
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
      const printUrl = `/grading/orders/${submissionId}`;  // print button on detail page
      const baseUrl = "https://boxium.asia";

      await sendGradingNotification({
        userId: ctx.user.id,
        userEmail: user.email,
        userName: user.name || user.email,
        type: "grading_submitted",
        title: "PSA 鑑定申請已提交",
        body: `您的 PSA 鑑定申請 ${orderNo} 已成功提交，請前往申請詳情頁面完成付款。`,
        linkUrl,
        subject: `》BOXIUM PSA 鑑定「申請已提交 - ${orderNo}`,
        html: buildGradingEmail({
          userName: user.name || user.email,
          title: "PSA 鑑定申請已提交",
          body: `您的 PSA 鑑定申請已成功提交，請點擊下方按鈕前往申請詳情頁面完成付款。付款確認後，請打印申請單並連同卡牌一起寄至 BOXIUM 指定地址。`,
          orderNo,
          linkUrl: `${baseUrl}${linkUrl}`,
          ctaText: "前往完成付款",
          extraHtml: `
<div style="background:#fff8e1;border:2px solid #ffd600;border-radius:10px;padding:14px 16px;margin:16px 0;">
  <p style="margin:0;font-size:14px;font-weight:bold;color:#e65100;">⚠️ 請先完成付款，申請才會進入處理流程</p>
  <p style="margin:6px 0 0;font-size:13px;color:#555;">付款確認後，系統將發送寄件地址及打印申請單的詳細資訊。</p>
</div>`,
        }),
      });

      return { submissionId, orderNo };
    }),

  // ─── Protected: Create submission checkout (pay first, then activate) ────
  createSubmissionCheckout: protectedProcedure
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
        paymentMethod: z.enum(["stripe", "alipay_hk"]),
        agreedToTerms: z.boolean().refine((v) => v === true, { message: "必須同意服務條款" }),
        origin: z.string(),
        returnAddress: z.object({
          recipientName: z.string().min(1),
          phone: z.string().min(1),
          // address can be empty when sfStationCode is provided (SF station pickup mode)
          address: z.string().default(""),
          district: z.string().optional(),
          region: z.string().default("香港"),
          sfStationCode: z.string().optional(),
          sfStationName: z.string().optional(),
        }).optional(),
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

      // Get next open batch
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

      // Create submission with awaiting_payment status
      const [submissionResult] = await db.insert(gradingSubmissions).values({
        orderNo,
        userId: ctx.user.id,
        status: "awaiting_payment",
        totalFeeHkd: totalFeeHkd.toFixed(2),
        batchId: nextBatch?.id || null,
        shippingDeadline: nextBatch?.cutoffDate || null,
        paymentMethod: input.paymentMethod,
        returnAddress: input.returnAddress ? JSON.stringify(input.returnAddress) : null,
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

      // Create Stripe checkout session
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const stripe = getStripe();
      const amountCents = Math.round(totalFeeHkd * 100);
      const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
        input.paymentMethod === "alipay_hk" ? ["alipay"] : ["card"];

      const session = await stripe.checkout.sessions.create({
        payment_method_types: paymentMethodTypes,
        line_items: [
          {
            price_data: {
              currency: "hkd",
              product_data: {
                name: `PSA 代客鑑定服務 - ${orderNo}`,
                description: `申請單號：${orderNo}，共 ${input.items.length} 張卡牌`,
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: user.email,
        client_reference_id: ctx.user.id.toString(),
        allow_promotion_codes: true,
        metadata: {
          type: "grading_submission_payment",
          submission_id: submissionId.toString(),
          order_no: orderNo,
          user_id: ctx.user.id.toString(),
        },
        success_url: `${input.origin}/grading/orders/${submissionId}?payment=success`,
        cancel_url: `${input.origin}/grading/submit?payment=cancelled&submission_id=${submissionId}`,
      });

      // Save stripe session ID
      await db
        .update(gradingSubmissions)
        .set({ stripePaymentIntentId: session.id })
        .where(eq(gradingSubmissions.id, submissionId));

      return { checkoutUrl: session.url, submissionId, orderNo };
    }),

  // ─── Protected: Get my submissions ───────────────────────────────────────
  getMySubmissions: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(10),
        search: z.string().optional(),
        status: z.string().optional(),
        statuses: z.array(z.string()).optional(), // multi-status filter
      }).optional()
    )
    .query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const page = input?.page ?? 1;
    const pageSize = input?.pageSize ?? 10;
    const search = input?.search?.trim() ?? "";
    const statusFilter = input?.status ?? "";
    const statusesFilter = input?.statuses ?? [];
    const offset = (page - 1) * pageSize;
    // Build conditions
    const conditions: any[] = [eq(gradingSubmissions.userId, ctx.user.id)];
    if (statusesFilter.length > 0) {
      // Multi-status filter (for tabs like 'action', 'in_progress', 'done')
      conditions.push(inArray(gradingSubmissions.status, statusesFilter as any[]));
    } else if (statusFilter) {
      conditions.push(eq(gradingSubmissions.status, statusFilter as any));
    }
    if (search) {
      // Search by orderNo OR by cardName in any of the submission's items
      const matchingSubmissionIds = await db
        .selectDistinct({ id: gradingSubmissionItems.submissionId })
        .from(gradingSubmissionItems)
        .where(
          and(
            like(gradingSubmissionItems.cardName, `%${search}%`),
            // Only look at items belonging to this user's submissions (performance guard)
            inArray(
              gradingSubmissionItems.submissionId,
              db
                .select({ id: gradingSubmissions.id })
                .from(gradingSubmissions)
                .where(eq(gradingSubmissions.userId, ctx.user.id))
            )
          )
        );
      const cardNameMatchIds = matchingSubmissionIds.map((r) => r.id);
      if (cardNameMatchIds.length > 0) {
        conditions.push(
          or(
            like(gradingSubmissions.orderNo, `%${search}%`),
            inArray(gradingSubmissions.id, cardNameMatchIds)
          ) as any
        );
      } else {
        conditions.push(like(gradingSubmissions.orderNo, `%${search}%`));
      }
    }
    const whereClause = and(...conditions);
    // Get total count
    const [{ total }] = await db
      .select({ total: count(gradingSubmissions.id) })
      .from(gradingSubmissions)
      .where(whereClause);
    // Get paginated submissions
    const submissions = await db
      .select()
      .from(gradingSubmissions)
      .where(whereClause)
      .orderBy(desc(gradingSubmissions.createdAt))
      .limit(pageSize)
      .offset(offset);
    // Get item counts
    const submissionIds = submissions.map((s: GradingSubmission) => s.id);
    if (submissionIds.length === 0) {
      return { submissions: [], total: Number(total), page, pageSize, totalPages: Math.ceil(Number(total) / pageSize) };
    }
    const items = await db
      .select()
      .from(gradingSubmissionItems)
      .where(inArray(gradingSubmissionItems.submissionId, submissionIds));
    const itemCountMap = new Map<number, number>();
    for (const item of items as GradingSubmissionItem[]) {
      itemCountMap.set(item.submissionId, (itemCountMap.get(item.submissionId) || 0) + 1);
    }
    return {
      submissions: submissions.map((s: GradingSubmission) => ({ ...s, itemCount: itemCountMap.get(s.id) || 0 })),
      total: Number(total),
      page,
      pageSize,
      totalPages: Math.ceil(Number(total) / pageSize),
    };
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

      // Fetch upgrade tier name if exists
      let upgradeNewTierName: string | null = null;
      if (submission.upgradeNewTierId) {
        const [upgradeTier] = await db
          .select({ name: gradingServiceTiers.name })
          .from(gradingServiceTiers)
          .where(eq(gradingServiceTiers.id, submission.upgradeNewTierId))
          .limit(1);
        upgradeNewTierName = upgradeTier?.name ?? null;
      }

      // Parse returnAddress JSON
      let parsedReturnAddress: Record<string, string> | null = null;
      if (submission.returnAddress) {
        try { parsedReturnAddress = JSON.parse(submission.returnAddress as string); } catch {}
      }

      return {
        ...submission,
        user: userInfo || null,
        items: (items as GradingSubmissionItem[]).map((item) => ({ ...item, tier: tierMap.get(item.tierId) || null })),
        batch,
        upgradeNewTierName,
        returnAddress: parsedReturnAddress,
      };
    }),

  // ─── Protected: Cancel awaiting_payment submission ────────────────────────
  cancelSubmission: protectedProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [submission] = await db
        .select()
        .from(gradingSubmissions)
        .where(
          and(
            eq(gradingSubmissions.id, input.submissionId),
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if (submission.status !== "awaiting_payment" && submission.status !== "pending_shipment") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有待付款或待寄件狀態的申請可以取消" });
      }

      await db
        .update(gradingSubmissions)
        .set({ status: "cancelled" })
        .where(eq(gradingSubmissions.id, submission.id));

      return { success: true };
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
            inArray(gradingSubmissions.status, ["awaiting_payment", "pending_shipment", "graded", "payment_overdue"])
          )
        )
        .limit(1);

      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在或狀態不允許付款" });
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

  // ─── Submit Alipay HK proof for grading payment ──────────────────────────
  submitGradingAlipayProof: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        proofImageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
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
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if (!["awaiting_payment", "pending_review", "pending_shipment", "graded", "payment_pending", "payment_overdue"].includes(submission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "申請狀態不允許提交付款截圖" });
      }

      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const fileKey = `grading-alipay-proof/${submission.orderNo}-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);

      await db
        .update(gradingSubmissions)
        .set({
          alipayProofImageUrl: url,
          alipayProofSubmittedAt: new Date(),
          alipayProofStatus: "pending_review",
          paymentMethod: "alipay_hk",
          // 提交截圖後主狀態改為 pending_review（等待管理員審核）
          status: "pending_review",
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));

      // Notify owner (in-app)
      await createNotification({
        userId: ctx.user.id,
        type: "system",
        title: "鑑定付款截圖待審核",
        body: `申請單 ${submission.orderNo} 已提交支付寶 HK 付款截圖，請前往 Admin 確認收款。`,
        linkUrl: `/admin`,
      }).catch(() => {});

      // Notify admin via Gmail
      const adminEmail = "BoxIum.asia@gmail.com";
      const totalFee = parseFloat(submission.totalFeeHkd || "0").toLocaleString();
      const submittedAt = new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" });
      const adminBodyHtml = `
        <h2 style="margin:0 0 8px;color:#06038d;font-size:20px;">📸 支付寶 HK 付款截圖待審核</h2>
        <p style="margin:0 0 16px;color:#555;font-size:14px;">有客人已提交支付寶 HK 付款截圖，請盡快登入 Admin 後台確認收款。</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6ff;border:2px solid #dde0f5;border-radius:10px;margin:16px 0;overflow:hidden;">
          <tr><td style="background:#06038d;padding:10px 16px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.7);">申請單號</p>
            <p style="margin:2px 0 0;font-size:14px;font-weight:bold;color:#ffffff;font-family:monospace;">${submission.orderNo}</p>
          </td></tr>
          <tr><td style="padding:10px 16px;border-top:1px solid #dde0f5;">
            <p style="margin:0;font-size:12px;color:#888;">客人名稱</p>
            <p style="margin:4px 0 0;font-size:14px;color:#1a1a2e;">${ctx.user.name || ctx.user.email}</p>
          </td></tr>
          <tr><td style="padding:10px 16px;border-top:1px solid #dde0f5;">
            <p style="margin:0;font-size:12px;color:#888;">應付金額</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:bold;color:#06038d;">HK$${totalFee}</p>
          </td></tr>
          <tr><td style="padding:10px 16px;border-top:1px solid #dde0f5;">
            <p style="margin:0;font-size:12px;color:#888;">提交時間</p>
            <p style="margin:4px 0 0;font-size:14px;color:#1a1a2e;">${submittedAt}</p>
          </td></tr>
          <tr><td style="padding:10px 16px;border-top:1px solid #dde0f5;">
            <p style="margin:0;font-size:12px;color:#888;">付款截圖</p>
            <a href="${url}" style="display:inline-block;margin-top:6px;">
              <img src="${url}" alt="付款截圖" style="max-width:300px;max-height:200px;border-radius:8px;border:1px solid #dde0f5;" />
            </a>
          </td></tr>
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://boxium.asia/admin" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">前往 Admin 確認收款</a>
        </div>
      `;
      const adminHtml = wrapHtmlTest(`📸 鑑定付款截圖待審核 — ${submission.orderNo}`, adminBodyHtml);
      await sendEmail({
        to: adminEmail,
        subject: `📸 [BOXIUM] 鑑定付款截圖待審核 — ${submission.orderNo}`,
        html: adminHtml,
        skipUnsubscribeCheck: true,
        dedupeKey: `grading-alipay-proof-${submission.id}-${Date.now()}`,
      }).catch((e) => console.error("[Grading] Failed to send admin Gmail notification:", e));

      // Auto-trigger AI verification in background (non-blocking)
      setImmediate(async () => {
        try {
          const { invokeLLM } = await import("../_core/llm");
          // Determine expected amount: use upgrade diff fee if this is an upgrade payment
          const isUpgradePayment = !!(submission as any).upgradeCheckoutSessionId && !(submission as any).upgradePaidAt;
          const expectedFee = isUpgradePayment
            ? parseFloat((submission as any).upgradeDiffFeeHkd || "0")
            : parseFloat(submission.totalFeeHkd || "0");
          const orderNo = submission.orderNo;
          const imageDataUrl = `data:${input.mimeType};base64,${input.proofImageBase64}`;

          const systemPrompt = `你是一個專業的支付寶 HK（AlipayHK）付款截圖核對助手。你的任務是分析用戶上傳的截圖，判斷是否為有效的支付寶 HK 付款成功記錄。\n\n【重要判斷標準】\n支付寶 HK 付款成功截圖的特徵：\n- 顯示「付款成功」、「Payment Successful」、「轉賬成功」等字樣\n- 有支付寶 HK 的 logo 或介面元素（藍色/白色介面，AlipayHK 字樣）\n- 顯示付款金額（HKD 金額）\n- 可能顯示收款方名稱（如「零度有限公司」或「Boxium」）\n- 可能顯示交易單號或備注\n\n【不符合的情況】\n- 截圖是其他網站或應用程式的頁面（如購物網站、訂單確認頁面、電郵等）\n- 截圖顯示付款失敗、處理中、或等待中的狀態\n- 截圖模糊不清或無法辨認\n\n請以 JSON 格式回覆，不要加入任何其他文字：\n{\n  "isValid": true/false,\n  "confidence": "high"/"medium"/"low",\n  "detectedAmount": "偵測到的金額（如 1680）或 null",\n  "detectedOrderNo": "偵測到的備注單號或 null",\n  "amountMatch": true/false/null,\n  "orderNoMatch": true/false/null,\n  "issues": ["問題列表，如果沒有則為空陣列"],\n  "summary": "簡短的中文核對結果說明（如截圖不是支付寶 HK 付款截圖，請說明截圖實際顯示的是什麼內容，例如：截圖顯示的是購物網站的訂單確認頁面）"\n}`;

          const userPrompt = `請核對這張支付寶 HK ${isUpgradePayment ? '升級差價補付' : '付款'}截圖：\n\n預期付款金額：HK$${expectedFee.toLocaleString()}\n預期備注單號：${orderNo}\n\n請判斷：\n1. 截圖是否為支付寶 HK（AlipayHK）的付款成功頁面？（注意：不是其他網站的頁面，如購物網站、訂單確認頁、電郵等）\n2. 如果是支付寶 HK 付款截圖，付款金額是否符合預期金額 HK$${expectedFee.toLocaleString()}？\n3. 備注是否包含單號 ${orderNo}？\n\n如果截圖不是支付寶 HK 的付款成功頁面，請在 summary 中說明截圖實際顯示的是什麼（例如：「截圖顯示的是購物網站的訂單確認頁面，並非支付寶 HK 付款截圖」），不要描述為「提交失敗頁面」。`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
              ]},
            ],
          });

          const rawContent = response.choices[0]?.message?.content;
          const content = typeof rawContent === "string" ? rawContent : "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            const aiResult: "pass" | "warning" | "fail" = Boolean(result.isValid) ? "pass" : (result.confidence === "medium" ? "warning" : "fail");
            const aiConfidence: "high" | "medium" | "low" = (result.confidence || "low") as "high" | "medium" | "low";
            const aiSummary = result.summary || "核對完成";
            const db2 = await getDb();
            if (db2) {
              await db2
                .update(gradingSubmissions)
                .set({
                  alipayProofAiResult: aiResult,
                  alipayProofAiConfidence: aiConfidence,
                  alipayProofAiSummary: aiSummary,
                  alipayProofAiCheckedAt: new Date(),
                } as any)
                .where(eq(gradingSubmissions.id, submission.id));
            }
          }
        } catch (e) {
          console.error("[Grading] Auto AI proof verification failed:", e);
        }
      });

      return { success: true, proofUrl: url };
    }),

  // ─── Admin: Confirm Alipay grading payment ───────────────────────────────
  adminConfirmGradingAlipayPayment: adminProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        notes: z.string().optional(),
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

      await db
        .update(gradingSubmissions)
        .set({
          alipayProofStatus: "approved",
          status: "completed",
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));

      // In-app notification
      await createNotification({
        userId: submission.userId,
        type: "system",
        title: "付款已確認 ✅",
        body: `申請單 ${submission.orderNo} 的支付寶 HK 付款已確認，訂單已完成。`,
        linkUrl: `/grading/orders/${submission.id}`,
      }).catch(() => {});

      // Email notification to customer
      try {
        const [user] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, submission.userId))
          .limit(1);

        if (user?.email) {
          const baseUrl = "https://boxium.asia";
          const orderUrl = `${baseUrl}/grading/orders/${submission.id}`;
          const BRAND_BLUE = "#06038d";
          const BRAND_YELLOW = "#FFD700";

          const extraHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:2px solid #86efac;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#16a34a;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">✅ 付款確認詳情</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;color:#333;">付款方式：支付寶 HK</p>
    <p style="margin:4px 0 0;font-size:13px;color:#333;">確認時間：${new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}</p>
    ${input.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">備註：${input.notes}</p>` : ""}
  </td></tr>
</table>
<p style="color:#555;font-size:14px;margin:12px 0;">您的申請現已進入正式處理流程，我們將盡快為您的卡牌進行鑑定。如有任何查詢，請聯絡 BOXIUM 客服。</p>
<div style="text-align:center;margin:16px 0;">
  <a href="${orderUrl}" style="display:inline-block;background:${BRAND_BLUE};color:${BRAND_YELLOW};padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:bold;">查看申請詳情</a>
</div>`;

          const html = buildGradingEmail({
            userName: user.name || user.email,
            title: "付款已確認，申請處理中 ✅",
            body: `您的支付寶 HK 付款已由 BOXIUM 確認收款，申請單 ${submission.orderNo} 現已進入正式鑑定處理流程。`,
            orderNo: submission.orderNo,
            linkUrl: orderUrl,
            ctaText: "查看申請詳情",
            extraHtml,
          });

          await sendEmail({
            to: user.email,
            subject: `【BOXIUM PSA 鑑定】付款已確認 ✅ — ${submission.orderNo}`,
            html,
            emailType: "grading",
            toUserId: submission.userId,
          });
        }
      } catch (e) {
        console.error("[Grading] Failed to send payment confirmation email:", e);
      }

      return { success: true };
    }),

  // ─── Admin: Confirm Alipay HK upgrade diff payment ─────────────────────────
  adminConfirmGradingAlipayUpgradePayment: adminProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        notes: z.string().optional(),
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
      if (!submission.upgradeCheckoutSessionId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此申請沒有待確認的升級差價" });
      }

      // Mark upgrade as paid and clear checkout session
      await db
        .update(gradingSubmissions)
        .set({
          upgradePaidAt: new Date(),
          upgradeCheckoutSessionId: null,
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));

      // In-app notification
      await createNotification({
        userId: submission.userId,
        type: "system",
        title: "升級差價付款已確認 ✅",
        body: `申請單 ${submission.orderNo} 的服務層級升級差價（支付寶 HK）已確認，升級已完成。`,
        linkUrl: `/grading/orders/${submission.id}`,
      }).catch(() => {});

      // Email notification
      try {
        const [user] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, submission.userId))
          .limit(1);

        if (user?.email) {
          const baseUrl = "https://boxium.asia";
          const orderUrl = `${baseUrl}/grading/orders/${submission.id}`;
          const BRAND_BLUE = "#06038d";
          const BRAND_YELLOW = "#FFD700";

          const extraHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:2px solid #86efac;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#16a34a;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">✅ 升級差價確認詳情</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;color:#333;">付款方式：支付寶 HK</p>
    <p style="margin:4px 0 0;font-size:13px;color:#333;">差價金額：HK$${submission.upgradeDiffFeeHkd}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#333;">確認時間：${new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}</p>
    ${input.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#555;">備註：${input.notes}</p>` : ""}
  </td></tr>
</table>
<p style="color:#555;font-size:14px;margin:12px 0;">您的服務層級升級差價已確認，升級已完成。如有任何查詢，請聯絡 BOXIUM 客服。</p>
<div style="text-align:center;margin:16px 0;">
  <a href="${orderUrl}" style="display:inline-block;background:${BRAND_BLUE};color:${BRAND_YELLOW};padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:bold;">查看申請詳情</a>
</div>`;

          const html = buildGradingEmail({
            userName: user.name || user.email,
            title: "服務層級升級差價已確認 ✅",
            body: `您的申請單 ${submission.orderNo} 的服務層級升級差價（支付寶 HK）已由 BOXIUM 確認收款，升級已完成。`,
            orderNo: submission.orderNo,
            linkUrl: orderUrl,
            ctaText: "查看申請詳情",
            extraHtml,
          });

          await sendEmail({
            to: user.email,
            subject: `【BOXIUM PSA 鑑定】升級差價已確認 ✅ — ${submission.orderNo}`,
            html,
            emailType: "grading",
            toUserId: submission.userId,
          });
        }
      } catch (e) {
        console.error("[Grading] Failed to send upgrade payment confirmation email:", e);
      }

      return { success: true };
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
      const countMap = new Map<number, number>(counts.map((r: { batchId: number | null; cnt: unknown }) => [r.batchId!, Number(r.cnt)]));
      return batches.map((b: typeof batches[number]) => ({ ...b, submissionCount: countMap.get(b.id) ?? 0 }));
    }),

    // ─── Batch stats: per-batch submission list with payment status ──────────
    listBatchesWithStats: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get all batches
      const batches = await db.select().from(gradingBatches).orderBy(desc(gradingBatches.cutoffDate));
      if (batches.length === 0) return [];
      // Get all submissions with user info
      const allSubmissions = await db
        .select({
          submission: gradingSubmissions,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(gradingSubmissions)
        .leftJoin(users, eq(gradingSubmissions.userId, users.id))
        .where(
          and(
            isNotNull(gradingSubmissions.batchId),
            notInArray(gradingSubmissions.status, ["awaiting_payment", "cancelled"])
          )
        )
        .orderBy(asc(gradingSubmissions.createdAt));
      // Get item counts per submission
      const submissionIds = allSubmissions.map((s: { submission: { id: number } }) => s.submission.id);
      let itemCountMap = new Map<number, number>();
      if (submissionIds.length > 0) {
        const itemCounts = await db
          .select({ submissionId: gradingSubmissionItems.submissionId, cnt: count(gradingSubmissionItems.id) })
          .from(gradingSubmissionItems)
          .where(inArray(gradingSubmissionItems.submissionId, submissionIds))
          .groupBy(gradingSubmissionItems.submissionId);
        itemCountMap = new Map<number, number>(itemCounts.map((r: { submissionId: number; cnt: unknown }) => [r.submissionId, Number(r.cnt)]));
      }
      // Group submissions by batchId
      const submissionsByBatch = new Map<number, any[]>();
      for (const row of allSubmissions) {
        const batchId = row.submission.batchId!;
        if (!submissionsByBatch.has(batchId)) submissionsByBatch.set(batchId, []);
        submissionsByBatch.get(batchId)!.push({
          ...row.submission,
          userName: row.user?.name ?? row.user?.email ?? "未知",
          userEmail: row.user?.email ?? "",
          itemCount: itemCountMap.get(row.submission.id) ?? 0,
        });
      }
      // Build result
      return batches.map((batch: typeof batches[number]) => {
        const subs = submissionsByBatch.get(batch.id) ?? [];
        const totalCards = subs.reduce((sum: number, s: { itemCount: number }) => sum + s.itemCount, 0);
        const paidCount = subs.filter((s: { status: string }) => s.status === "paid" || s.status === "completed").length;
        const unpaidCount = subs.filter((s: { status: string }) => s.status === "graded" || s.status === "payment_overdue").length;
        const pendingCount = subs.filter((s: { status: string }) => !["paid", "completed", "graded", "payment_overdue", "cancelled"].includes(s.status)).length;
        return {
          ...batch,
          submissions: subs,
          totalSubmissions: subs.length,
          totalCards,
          paidCount,
          unpaidCount,
          pendingCount,
        };
      });
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
          alipayProofPending: z.boolean().optional(),
          pendingUpgrade: z.boolean().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(1000).default(20),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const conditions: SQL[] = [];
        if (input.status) {
          conditions.push(eq(gradingSubmissions.status, input.status as any));
        } else {
          conditions.push(notInArray(gradingSubmissions.status, ["awaiting_payment", "cancelled"]));
        }
        if (input.batchId) conditions.push(eq(gradingSubmissions.batchId, input.batchId));
        if (input.alipayProofPending) conditions.push(eq(gradingSubmissions.alipayProofStatus, "pending_review"));
        if (input.pendingUpgrade) {
          conditions.push(isNotNull(gradingSubmissions.upgradeCheckoutSessionId));
          conditions.push(isNull(gradingSubmissions.upgradePaidAt));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count for pagination
        const [{ totalCount }] = await db
          .select({ totalCount: count(gradingSubmissions.id) })
          .from(gradingSubmissions)
          .where(whereClause);

        const offset = (input.page - 1) * input.pageSize;
        const submissions = await db
          .select({
            submission: gradingSubmissions,
            user: { id: users.id, name: users.name, email: users.email, phone: users.phone },
          })
          .from(gradingSubmissions)
          .leftJoin(users, eq(gradingSubmissions.userId, users.id))
          .where(whereClause)
          .orderBy(desc(gradingSubmissions.createdAt))
          .limit(input.pageSize)
          .offset(offset);

        const submissionIds = submissions.map((s: { submission: GradingSubmission; user: any }) => s.submission.id);
        if (submissionIds.length === 0) return { submissions: [], total: totalCount, page: input.page, pageSize: input.pageSize, totalPages: Math.ceil(totalCount / input.pageSize) };

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
          total: totalCount,
          page: input.page,
          pageSize: input.pageSize,
          totalPages: Math.ceil(totalCount / input.pageSize),
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

        // Fetch upgrade tier name if exists
        let upgradeNewTierName: string | null = null;
        if (row.submission.upgradeNewTierId) {
          const [upgradeTier] = await db
            .select({ name: gradingServiceTiers.name })
            .from(gradingServiceTiers)
            .where(eq(gradingServiceTiers.id, row.submission.upgradeNewTierId))
            .limit(1);
          upgradeNewTierName = upgradeTier?.name ?? null;
        }

        // Parse returnAddress JSON
        let parsedAdminReturnAddress: Record<string, string> | null = null;
        if (row.submission.returnAddress) {
          try { parsedAdminReturnAddress = JSON.parse(row.submission.returnAddress as string); } catch {}
        }

        return {
          ...row.submission,
          user: row.user,
          items: (items as GradingSubmissionItem[]).map((item: GradingSubmissionItem) => ({ ...item, tier: tierMap.get(item.tierId) || null })),
          batch,
          upgradeNewTierName,
          returnAddress: parsedAdminReturnAddress,
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
        // Append note to adminNotesHistory if a note is provided
        if (input.adminNotes) {
          const existingHistory: Array<{timestamp: string; note: string; statusAtTime: string}> = submission.adminNotesHistory
            ? JSON.parse(submission.adminNotesHistory)
            : [];
          const newEntry = {
            timestamp: new Date().toISOString(),
            note: input.adminNotes,
            statusAtTime: input.status,
          };
          updateData.adminNotesHistory = JSON.stringify([...existingHistory, newEntry]);
        }
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

        // Send review invitation email for completed status
        if (input.status === "completed" && user) {
          const reviewUrl = `${baseUrl}${linkUrl}`;
          await sendGradingNotification({
            userId: user.id,
            userEmail: user.email,
            userName: user.name || user.email,
            type: "grading_review_invitation",
            title: "邀請您為 BOXIUM PSA 鑑定服務評分",
            body: `您的申請 ${submission.orderNo} 已完成，歡迎花 30 秒為我們的服務評分！`,
            linkUrl,
            subject: `【BOXIUM PSA 鑑定】感謝您的使用，邀請您留下評價 - ${submission.orderNo}`,
            html: buildGradingEmail({
              userName: user.name || user.email,
              title: "感謝您使用 BOXIUM PSA 代客鑑定服務",
              body: `您的申請 <strong>${submission.orderNo}</strong> 已全部完成！<br><br>歡迎花 30 秒為我們的服務評分，您的寶貴意見將幫助我們持續改善服務品質。`,
              orderNo: submission.orderNo,
              linkUrl: reviewUrl,
              ctaText: "立即評價",
              extraHtml: `<div style="background: #fff8e1; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 12px; margin: 12px 0;"><p style="margin: 0; color: #92400e; font-size: 14px;">⭐ 點擊上方按鈕進入申請詳情頁，即可為本次服務評分</p></div>`,
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
            title: "PSA 鑑定完成！請完成付款 🏆",
            body: `您的 PSA 鑑定已完成！應付金額為 HK$${submission.totalFeeHkd}，請於 ${paymentDeadline.toLocaleDateString("zh-HK")} 前完成付款，逾期平台保留對卡片自行處理之權利。`,
            orderNo: submission.orderNo,
            linkUrl: `${baseUrl}${linkUrl}`,
            ctaText: "立即付款",
            extraHtml: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#15803d;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">🏆 鑑定結果摘要</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;color:#333;line-height:1.8;">${resultsSummary}</p>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#d97706;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">💳 付款資訊</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;width:40%;">應付金額</td>
        <td style="padding:4px 0;font-size:18px;font-weight:bold;color:#06038d;">HK$${submission.totalFeeHkd}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#555;">付款截止日期</td>
        <td style="padding:4px 0;font-size:14px;font-weight:bold;color:#dc2626;">${paymentDeadline.toLocaleDateString("zh-HK")}</td>
      </tr>
    </table>
    <p style="margin:10px 0 0;font-size:12px;color:#92400e;background:#fef3c7;border-radius:6px;padding:8px 12px;">⚠️ 請於截止日期前完成付款，逾期平台保留對相關卡片自行處理之權利。</p>
  </td></tr>
</table>
<div style="text-align:center;margin:20px 0;">
  <a href="${baseUrl}${linkUrl}" style="display:inline-block;background:#06038d;color:#FFD700;padding:14px 36px;border-radius:50px;text-decoration:none;font-size:16px;font-weight:bold;">立即前往付款</a>
</div>`,
          }),
        });

        return { success: true, paymentDeadline };
      }),

    // ─── Admin: Batch update all submissions in a batch to a specific status ─────
    batchUpdateStatus: adminProcedure
      .input(
        z.object({
          batchId: z.number().int().positive(),
          status: z.enum(["received", "submitted_to_psa", "grading"]),
          notifyUsers: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Only update submissions that are in a "lower" status (avoid downgrading)
        // Status order: pending_shipment < received < submitted_to_psa < grading < graded
        const statusOrder: Record<string, number> = {
          awaiting_payment: 0,
          pending_review: 1,
          pending_shipment: 2,
          received: 3,
          submitted_to_psa: 4,
          grading: 5,
          graded: 6,
          payment_overdue: 7,
          paid: 8,
          returned: 9,
          completed: 10,
          cancelled: 11,
        };
        const statusLabels: Record<string, string> = {
          received: "BOXIUM 已收件",
          submitted_to_psa: "已出團送鑑",
          grading: "鑑定中",
        };
        const targetOrder = statusOrder[input.status];

        // Get all submissions in this batch with user info
        const submissionsWithUsers = await db
          .select({
            submission: gradingSubmissions,
            user: { id: users.id, name: users.name, email: users.email },
          })
          .from(gradingSubmissions)
          .leftJoin(users, eq(gradingSubmissions.userId, users.id))
          .where(eq(gradingSubmissions.batchId, input.batchId));

        type SubmissionWithUser = typeof submissionsWithUsers[0];
        // Filter: only update those with a lower status order (don't downgrade)
        const toUpdate = submissionsWithUsers.filter(
          (row: SubmissionWithUser) => (statusOrder[row.submission.status] ?? 0) < targetOrder
        );

        if (toUpdate.length === 0) return { updated: 0, notified: 0 };

        // Bulk update status
        await db
          .update(gradingSubmissions)
          .set({ status: input.status })
          .where(
            and(
              eq(gradingSubmissions.batchId, input.batchId),
              inArray(
                gradingSubmissions.id,
                toUpdate.map((row: SubmissionWithUser) => row.submission.id)
              )
            )
          );

        // Append system note to adminNotesHistory for each updated submission
        const batchNoteTimestamp = new Date().toISOString();
        const statusLabel = statusLabels[input.status] ?? input.status;
        await Promise.all(
          toUpdate.map(async (row: SubmissionWithUser) => {
            const existingHistory: Array<{ timestamp: string; note: string; statusAtTime: string }> =
              row.submission.adminNotesHistory ? JSON.parse(row.submission.adminNotesHistory) : [];
            const newEntry = {
              timestamp: batchNoteTimestamp,
              note: `[系統] 批量更新至「${statusLabel}」`,
              statusAtTime: input.status,
            };
            const updatedHistory = JSON.stringify([...existingHistory, newEntry]);
            await db
              .update(gradingSubmissions)
              .set({ adminNotesHistory: updatedHistory })
              .where(eq(gradingSubmissions.id, row.submission.id));
          })
        );

        // Send notifications if requested
        let notified = 0;
        if (input.notifyUsers) {
          const statusLabel = statusLabels[input.status] ?? input.status;
          const notifyPromises = toUpdate.map(async (row: SubmissionWithUser) => {
            if (!row.user?.email) return;
            try {
              await sendGradingNotification({
                userId: row.submission.userId,
                userEmail: row.user.email,
                userName: row.user.name ?? row.user.email,
                type: "status_update",
                title: `鑑定進度更新：${statusLabel}`,
                body: `您的申請單 ${row.submission.orderNo} 狀態已更新為「${statusLabel}」。`,
                linkUrl: `/grading/orders/${row.submission.id}`,
                subject: `[BOXIUM] 鑑定進度更新 — ${row.submission.orderNo}`,
                html: buildGradingEmail({
                  userName: row.user.name ?? row.user.email,
                  orderNo: row.submission.orderNo,
                  title: `鑑定進度更新：${statusLabel}`,
                  body: `您的 PSA 代客鑑定申請狀態已更新為「${statusLabel}」，請登入 BOXIUM 查看最新進度。`,
                  linkUrl: `/grading/orders/${row.submission.id}`,
                  ctaText: "查看申請進度",
                }),
              });
              notified++;
            } catch (e) {
              console.error(`[batchUpdateStatus] Failed to notify user ${row.user.email}:`, e);
            }
          });
          await Promise.allSettled(notifyPromises);
        }

        return { updated: toUpdate.length, notified };
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

    // ─── Admin: Upgrade tier for a submission (calculate diff, create Stripe checkout, notify user) ───
    upgradeTier: adminProcedure
      .input(
        z.object({
          submissionId: z.number().int().positive(),
          // Per-card upgrade: each item can have a different newTierId
          items: z.array(z.object({
            itemId: z.number().int().positive(),
            newTierId: z.number().int().positive(),
          })).min(1),
          origin: z.string().default("https://boxium.asia"),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        // Get submission
        const [submission] = await db
          .select()
          .from(gradingSubmissions)
          .where(eq(gradingSubmissions.id, input.submissionId))
          .limit(1);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });

        // Get all items for this submission
        const allItems = await db
          .select()
          .from(gradingSubmissionItems)
          .where(eq(gradingSubmissionItems.submissionId, input.submissionId));
        if (allItems.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "申請沒有卡牌" });

        // Collect all unique tier IDs needed (new tiers + original tiers for display)
        const uniqueTierIds = Array.from(new Set(input.items.map((i) => i.newTierId)));
        const originalTierIds = Array.from(new Set(allItems.map((it: any) => it.tierId).filter(Boolean))) as number[];
        const allOriginalTiers = originalTierIds.length > 0 ? await db
          .select()
          .from(gradingServiceTiers)
          .where(inArray(gradingServiceTiers.id, originalTierIds)) : [];
        type OrigTierRow = typeof allOriginalTiers[0];
        const originalTierMap = new Map<number, OrigTierRow>(allOriginalTiers.map((t: OrigTierRow) => [t.id, t]));
        const allTiersForUpgrade = await db
          .select()
          .from(gradingServiceTiers)
          .where(and(inArray(gradingServiceTiers.id, uniqueTierIds), eq(gradingServiceTiers.isActive, true)));
        type TierRow = typeof allTiersForUpgrade[0];
        const tierMap = new Map<number, TierRow>(allTiersForUpgrade.map((t: TierRow) => [t.id, t]));

        // Validate all requested tiers exist
        for (const { newTierId } of input.items) {
          if (!tierMap.has(newTierId)) {
            throw new TRPCError({ code: "NOT_FOUND", message: `服務層級 ID ${newTierId} 不存在或已停用` });
          }
        }

        // Build per-item upgrade map: itemId -> { newTierId, newTier, currentItem }
        type ItemRow = typeof allItems[0];
        const itemMap = new Map<number, ItemRow>(allItems.map((it: ItemRow) => [it.id, it]));
        type UpgradeEntry = { itemId: number; newTierId: number; newTier: TierRow; currentItem: ItemRow; diffFee: number };
        const upgradeEntries: UpgradeEntry[] = [];

        for (const { itemId, newTierId } of input.items) {
          const currentItem = itemMap.get(itemId);
          if (!currentItem) throw new TRPCError({ code: "BAD_REQUEST", message: `卡牌 ID ${itemId} 不存在` });
          const newTier = tierMap.get(newTierId)!;
          const currentFee = parseFloat(currentItem.feeHkd as string);
          const newFee = parseFloat(newTier.feeHkd as string);
          const diff = newFee - currentFee;
          if (diff <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `卡牌 #${itemId} 的新層級 ${newTier.name}（HK$${newFee}）不高於原費用（HK$${currentFee}），無需補付差價` });
          }
          upgradeEntries.push({ itemId, newTierId, newTier, currentItem, diffFee: diff });
        }

        // Total diff fee = sum of per-item diffs
        const totalDiffFee = upgradeEntries.reduce((sum, e) => sum + e.diffFee, 0);
        const currentTotal = parseFloat(submission.totalFeeHkd);
        const newTotal = currentTotal + totalDiffFee;

        // Get user
        const [user] = await db.select().from(users).where(eq(users.id, submission.userId)).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用戶不存在" });

        // Build upgrade summary for description
        const tierSummary = upgradeEntries.map((e) => `${e.newTier.name} x1`).join(", ");
        // Store per-item upgrade info in metadata as JSON
        const upgradeItemsJson = JSON.stringify(upgradeEntries.map((e) => ({ itemId: e.itemId, newTierId: e.newTierId, diffFee: e.diffFee.toFixed(2) })));

        // Create Stripe checkout for the total diff amount
        const stripe = getStripe();
        const amountCents = Math.round(totalDiffFee * 100);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "hkd",
                product_data: {
                  name: `PSA 鑑定服務升級差價 - ${submission.orderNo}`,
                  description: `升級 ${upgradeEntries.length} 張卡牌（${tierSummary}），差價補付`,
                },
                unit_amount: amountCents,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: user.email,
          client_reference_id: user.id.toString(),
          allow_promotion_codes: false,
          metadata: {
            type: "grading_tier_upgrade_payment",
            submission_id: input.submissionId.toString(),
            order_no: submission.orderNo,
            user_id: user.id.toString(),
            diff_fee_hkd: totalDiffFee.toFixed(2),
            // Per-item upgrade details as JSON (itemId, newTierId, diffFee)
            upgrade_items: upgradeItemsJson,
          },
          success_url: `${input.origin}/grading/orders/${input.submissionId}?upgrade_payment=success`,
          cancel_url: `${input.origin}/grading/orders/${input.submissionId}`,
        });

        // Save upgrade info to submission AND immediately update totalFeeHkd
        // upgradeNewTierId: use the most expensive new tier as representative
        const maxTier = upgradeEntries.reduce((best, e) => parseFloat(e.newTier.feeHkd) > parseFloat(best.newTier.feeHkd) ? e : best, upgradeEntries[0]);
        await db
          .update(gradingSubmissions)
          .set({
            upgradeCheckoutSessionId: session.id,
            upgradeDiffFeeHkd: sql`${totalDiffFee.toFixed(2)}`,
            upgradeNewTierId: maxTier.newTierId,
            upgradeCheckoutAt: new Date(),
            upgradeItemIds: upgradeEntries.map((e) => e.itemId).join(","),
            totalFeeHkd: sql`${newTotal.toFixed(2)}`,
          })
          .where(eq(gradingSubmissions.id, input.submissionId));

        // Update each item to its new tier and fee
        await Promise.all(
          upgradeEntries.map((e) =>
            db
              .update(gradingSubmissionItems)
              .set({ tierId: e.newTierId, feeHkd: sql`${parseFloat(e.newTier.feeHkd).toFixed(2)}` })
              .where(eq(gradingSubmissionItems.id, e.itemId))
          )
        );

        // Notify user
        const linkUrl = `/grading/orders/${submission.id}`;
        const baseUrl = "https://boxium.asia";
        // Build upgrade detail rows for email
        const upgradeRows = upgradeEntries.map((e) => `<tr><td style="padding:4px 0;font-size:13px;color:#555;">${e.currentItem.cardName ?? `卡牌 #${e.itemId}`}</td><td style="padding:4px 0;font-size:13px;font-weight:bold;color:#0369a1;">${e.newTier.name}</td><td style="padding:4px 0;font-size:13px;color:#dc2626;">+HK$${e.diffFee.toFixed(2)}</td></tr>`).join("");
        await sendGradingNotification({
          userId: user.id,
          userEmail: user.email,
          userName: user.name || user.email,
          type: "grading_tier_upgrade",
          title: "PSA 鑑定服務層級升級通知",
          body: `您的申請 ${submission.orderNo} 中 ${upgradeEntries.length} 張卡牌服務層級已升級，需補付差價 HK$${totalDiffFee.toFixed(2)}，請點擊連結完成付款。`,
          linkUrl,
          subject: `【BOXIUM PSA 鑑定】服務層級升級，請補付差價 - ${submission.orderNo}`,
          html: buildGradingEmail({
            userName: user.name || user.email,
            title: "PSA 鑑定服務層級升級通知 🔼",
            body: `您的申請共 <strong>${upgradeEntries.length} 張卡牌</strong>服務層級已由管理員升級，需補付差價 <strong>HK$${totalDiffFee.toFixed(2)}</strong>，請點擊下方按鈕完成付款。`,
            orderNo: submission.orderNo,
            linkUrl: `${baseUrl}${linkUrl}`,
            ctaText: "立即補付差價",
            extraHtml: `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:2px solid #7dd3fc;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#0369a1;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">🔼 升級詳情</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="border-bottom:1px solid #e0f2fe;"><th style="text-align:left;padding:4px 0;font-size:12px;color:#0369a1;">卡牌</th><th style="text-align:left;padding:4px 0;font-size:12px;color:#0369a1;">新層級</th><th style="text-align:left;padding:4px 0;font-size:12px;color:#0369a1;">差價</th></tr>
      ${upgradeRows}
      <tr style="border-top:1px solid #e0f2fe;"><td colspan="2" style="padding:6px 0;font-size:14px;color:#555;font-weight:bold;">合計補付</td><td style="padding:6px 0;font-size:16px;font-weight:bold;color:#dc2626;">HK$${totalDiffFee.toFixed(2)}</td></tr>
    </table>
  </td></tr>
</table>`,
          }),
        });

        return {
          success: true,
          checkoutUrl: session.url,
          diffFeeHkd: totalDiffFee.toFixed(2),
          newTierName: maxTier.newTier.name,
          upgradeItems: upgradeEntries.map((e) => ({
            cardName: e.currentItem.cardName ?? `卡牌 #${e.itemId}`,
            oldTierName: originalTierMap.get(e.currentItem.tierId)?.name ?? '原層級',
            newTierName: e.newTier.name,
            diffFeeHkd: e.diffFee.toFixed(2),
          })),
        };
      }),

    // ─── Admin: Get upgrade checkout status ──────────────────────────────────
    getUpgradeCheckoutStatus: adminProcedure
      .input(z.object({ submissionId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [submission] = await db
          .select({
            upgradeCheckoutSessionId: gradingSubmissions.upgradeCheckoutSessionId,
            upgradeDiffFeeHkd: gradingSubmissions.upgradeDiffFeeHkd,
            upgradeNewTierId: gradingSubmissions.upgradeNewTierId,
            upgradePaidAt: gradingSubmissions.upgradePaidAt,
          })
          .from(gradingSubmissions)
          .where(eq(gradingSubmissions.id, input.submissionId))
          .limit(1);
        if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
        return submission;
      }),
  }),

  // ─── Protected: Reopen upgrade diff checkout (user-facing) ─────────────────
  reopenUpgradeCheckout: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
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
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if (!submission.upgradeCheckoutSessionId && !submission.upgradeNewTierId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此申請沒有待補付的升級差價" });
      }
      if (submission.upgradePaidAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "升級差價已補付完成" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const stripe = getStripe();

      const diffFee = parseFloat(submission.upgradeDiffFeeHkd ?? '0');
      if (diffFee <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "差價金額無效" });
      const amountCents = Math.round(diffFee * 100);

      // Get new tier name
      let newTierName = '升級層級';
      if (submission.upgradeNewTierId) {
        const [tier] = await db.select({ name: gradingServiceTiers.name }).from(gradingServiceTiers).where(eq(gradingServiceTiers.id, submission.upgradeNewTierId)).limit(1);
        if (tier) newTierName = tier.name;
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: {
              name: `PSA 鑑定服務升級差價 - ${submission.orderNo}`,
              description: `升級至 ${newTierName}，差價補付`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        customer_email: user.email,
        client_reference_id: user.id.toString(),
        allow_promotion_codes: false,
        metadata: {
          type: "grading_tier_upgrade_payment",
          submission_id: input.submissionId.toString(),
          order_no: submission.orderNo,
          user_id: user.id.toString(),
          new_tier_id: (submission.upgradeNewTierId ?? '').toString(),
          diff_fee_hkd: diffFee.toFixed(2),
        },
        success_url: `${input.origin}/grading/orders/${input.submissionId}?upgrade_payment=success`,
        cancel_url: `${input.origin}/grading/orders/${input.submissionId}`,
      });

      // Update checkout session ID only
      await db
        .update(gradingSubmissions)
        .set({
          upgradeCheckoutSessionId: session.id,
          upgradeCheckoutAt: new Date(),
        })
        .where(eq(gradingSubmissions.id, input.submissionId));

      return { checkoutUrl: session.url };
    }),

  // 250025002500 Protected: Get QR Code for submission 25002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500250025002500
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

  // ─── Admin: Get grading maintenance mode status ───────────────────────────────────────────
  getGradingMaintenanceMode: adminProcedure.query(async () => {
    const enabled = await isGradingMaintenanceMode();
    return { enabled };
  }),

  // ─── AI: Verify Alipay HK payment screenshot ───────────────────────────────────
  /**
   * AI 核對支付寶 HK 付款截圖
   * 分析截圖是否為有效的支付寶 HK 付款成功記錄，並比對金額和備注
   */
  verifyAlipayProofWithAI: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        proofImageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
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
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });

      const { invokeLLM } = await import("../_core/llm");

      const totalFee = parseFloat(submission.totalFeeHkd || "0");
      const orderNo = submission.orderNo;

      const imageDataUrl = `data:${input.mimeType};base64,${input.proofImageBase64}`;

      const systemPrompt = `你是一個專業的支付寶 HK 付款截圖核對助手。你的任務是分析用戶上傳的截圖，判斷是否為有效的支付寶 HK 付款成功記錄。

請以 JSON 格式回覆，不要加入任何其他文字：
{
  "isValid": true/false,
  "confidence": "high"/"medium"/"low",
  "detectedAmount": "偵測到的金額（如 1680）或 null",
  "detectedOrderNo": "偵測到的備注單號或 null",
  "amountMatch": true/false/null,
  "orderNoMatch": true/false/null,
  "issues": ["問題列表，如果沒有則為空陣列"],
  "summary": "簡短的中文核對結果說明"
}`;

      const userPrompt = `請核對這張支付寶 HK 付款截圖：

預期付款金額：HK$${totalFee.toLocaleString()}
預期備注單號：${orderNo}

請判斷：
1. 是否為支付寶 HK 付款成功截圖（顯示「付款成功」或「Payment Successful」等字樣）
2. 付款金額是否符合預期金額 HK$${totalFee.toLocaleString()}
3. 備注是否包含單號 ${orderNo}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
              ],
            },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "";

        // Parse JSON response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            isValid: false,
            confidence: "low" as const,
            detectedAmount: null,
            detectedOrderNo: null,
            amountMatch: null,
            orderNoMatch: null,
            issues: ["無法解析 AI 回履"],
            summary: "無法分析截圖，請確認上傳圖片正確",
          };
        }

        const result = JSON.parse(jsonMatch[0]);
        const aiResult: "pass" | "warning" | "fail" = Boolean(result.isValid) ? "pass" : (result.confidence === "medium" ? "warning" : "fail");
        const aiConfidence: "high" | "medium" | "low" = (result.confidence || "low") as "high" | "medium" | "low";
        const aiSummary = result.summary || "核對完成";

        // Persist AI result to DB
        await db
          .update(gradingSubmissions)
          .set({
            alipayProofAiResult: aiResult,
            alipayProofAiConfidence: aiConfidence,
            alipayProofAiSummary: aiSummary,
            alipayProofAiCheckedAt: new Date(),
          } as any)
          .where(eq(gradingSubmissions.id, submission.id));

        return {
          isValid: Boolean(result.isValid),
          confidence: aiConfidence,
          detectedAmount: result.detectedAmount ?? null,
          detectedOrderNo: result.detectedOrderNo ?? null,
          amountMatch: result.amountMatch ?? null,
          orderNoMatch: result.orderNoMatch ?? null,
          issues: Array.isArray(result.issues) ? result.issues : [],
          summary: aiSummary,
        };
      } catch (err: any) {
        console.error("[Grading] AI verify alipay proof error:", err);
        return {
          isValid: false,
          confidence: "low" as const,
          detectedAmount: null,
          detectedOrderNo: null,
          amountMatch: null,
          orderNoMatch: null,
          issues: ["AI 核對服務暫時不可用"],
          summary: "AI 核對服務暫時不可用，您仍可提交截圖由管理員手動核對",
        };
      }
    }),

  // ─── Admin: Delete grading submission ────────────────────────────────────
  adminDeleteSubmission: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [sub] = await db
        .select({ id: gradingSubmissions.id, orderNo: gradingSubmissions.orderNo })
        .from(gradingSubmissions)
        .where(eq(gradingSubmissions.id, input.id))
        .limit(1);
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "申請單不存在" });
      // Delete items first, then submission
      await db.delete(gradingSubmissionItems).where(eq(gradingSubmissionItems.submissionId, input.id));
      await db.delete(gradingSubmissions).where(eq(gradingSubmissions.id, input.id));
      await createAuditLog({
        adminId: ctx.user.id,
        action: "delete_grading_submission",
        targetType: "grading_submission",
        targetId: input.id,
        details: `管理員刪除鑑定申請 ${sub.orderNo}`,
      });
      return { success: true, orderNo: sub.orderNo };
    }),

  // ─── Admin: Bulk delete awaiting_payment submissions ─────────────────────
  adminBulkDeleteAwaitingPayment: adminProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Find all awaiting_payment submissions
      const subs = await db
        .select({ id: gradingSubmissions.id, orderNo: gradingSubmissions.orderNo })
        .from(gradingSubmissions)
        .where(eq(gradingSubmissions.status, "awaiting_payment" as any));
      if (subs.length === 0) return { deleted: 0 };
      const ids = subs.map((s: { id: number; orderNo: string }) => s.id);
      // Delete items first, then submissions
      await db.delete(gradingSubmissionItems).where(inArray(gradingSubmissionItems.submissionId, ids));
      await db.delete(gradingSubmissions).where(inArray(gradingSubmissions.id, ids));
      await createAuditLog({
        adminId: ctx.user.id,
        action: "bulk_delete_awaiting_payment_submissions",
        targetType: "grading_submission",
        targetId: 0,
        details: `管理員批量刪除 ${subs.length} 筆未付款申請：${subs.map((s: { id: number; orderNo: string }) => s.orderNo).join(", ")}`
      });
      return { deleted: subs.length };
    }),

  // ─── Admin: Seller Center maintenance mode ────────────────────────────────
  getSellerCenterAccess: publicProcedure.query(async ({ ctx }) => {
    const enabled = await getSystemSetting("seller_center_maintenance_mode");
    const maintenanceMode = enabled?.settingValue === "true";
    if (!maintenanceMode) return { allowed: true, maintenanceMode: false };
    if (!ctx.user) return { allowed: false, maintenanceMode: true };
    if (ctx.user.role === "admin") return { allowed: true, maintenanceMode: true };
    return { allowed: false, maintenanceMode: true };
  }),

  setSellerCenterMaintenanceMode: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setSystemSetting("seller_center_maintenance_mode", input.enabled ? "true" : "false", "賣家中心維護模式開關");
      await createAuditLog({
        adminId: ctx.user.id,
        action: input.enabled ? "seller_center_maintenance_on" : "seller_center_maintenance_off",
        targetType: "system",
        targetId: null,
        details: `賣家中心維護模式已${input.enabled ? "開啟" : "關閉"}`,
      });
      return { success: true, enabled: input.enabled };
    }),

  getSellerCenterMaintenanceMode: adminProcedure.query(async () => {
    const val = await getSystemSetting("seller_center_maintenance_mode");
    return { enabled: val?.settingValue === "true" };
  }),

  // ─── Protected: Submit SF Express tracking number ───────────────────────────────
  submitTrackingNumber: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        trackingNumber: z.string().min(1).max(100),
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
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if (submission.status !== "pending_shipment") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有待寄件狀態的申請可以提交追蹤號碼" });
      }
      await db
        .update(gradingSubmissions)
        .set({
          trackingNumber: input.trackingNumber.trim(),
          trackingSubmittedAt: new Date(),
          // Status remains "pending_shipment" — Admin must confirm receipt to move to "received"
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));
      // Notify admin
      await createNotification({
        userId: ctx.user.id,
        type: "system",
        title: "鑑定申請已寄出",
        body: `申請單 ${submission.orderNo} 已提交順豐追蹤號碼：${input.trackingNumber.trim()}，請確認收件。`,
        linkUrl: `/admin`,
      }).catch(() => {});
      return { success: true };
    }),

  // ─── Protected: Resubmit Alipay HK proof after rejection ─────────────────────
  resubmitGradingAlipayProof: protectedProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        proofImageBase64: z.string(),
        mimeType: z.string().default("image/jpeg"),
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
            eq(gradingSubmissions.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if ((submission as any).alipayProofStatus !== "rejected") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有被拒絕的截圖可以重新提交" });
      }
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const ext = input.mimeType.split("/")[1] || "jpg";
      const fileKey = `grading-alipay-proof/${submission.orderNo}-resubmit-${Date.now()}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await db
        .update(gradingSubmissions)
        .set({
          alipayProofImageUrl: url,
          alipayProofSubmittedAt: new Date(),
          alipayProofStatus: "pending_review",
          alipayProofRejectionReason: null,
          alipayProofAiResult: null,
          alipayProofAiConfidence: null,
          alipayProofAiSummary: null,
          alipayProofAiCheckedAt: null,
          status: "pending_review",
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));
      // Notify admin
      await createNotification({
        userId: ctx.user.id,
        type: "system",
        title: "鑑定付款截圖重新提交",
        body: `申請單 ${submission.orderNo} 已重新提交支付寳 HK 付款截圖，請前往 Admin 確認收款。`,
        linkUrl: `/admin`,
      }).catch(() => {});
      return { success: true, proofUrl: url };
    }),

  // ─── Admin: Reject Alipay HK proof ─────────────────────────────────────────
  adminRejectGradingAlipayProof: adminProcedure
    .input(
      z.object({
        submissionId: z.number().int().positive(),
        rejectionReason: z.string().min(1, "請填寫拒絕原因"),
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
      if (submission.alipayProofStatus !== "pending_review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "截圖狀態不允許拒絕" });
      }
      // Update proof status to rejected and revert submission status to awaiting_payment
      await db
        .update(gradingSubmissions)
        .set({
          alipayProofStatus: "rejected",
          alipayProofRejectionReason: input.rejectionReason,
          status: "awaiting_payment",
        } as any)
        .where(eq(gradingSubmissions.id, submission.id));
      // Notify user via in-app notification
      await createNotification({
        userId: submission.userId,
        type: "system",
        title: "支付寶 HK 截圖未通過審核 ❌",
        body: `申請單 ${submission.orderNo} 的支付寶 HK 付款截圖未通過審核，原因：${input.rejectionReason}。請重新上傳正確的付款截圖。`,
        linkUrl: `/grading/orders/${submission.id}`,
      }).catch(() => {});
      // Send email notification to user
      try {
        const [user] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, submission.userId))
          .limit(1);
        if (user?.email) {
          const baseUrl = "https://boxium.asia";
          const orderUrl = `${baseUrl}/grading/orders/${submission.id}`;
          const extraHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border:2px solid #fca5a5;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#dc2626;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">❌ 截圖審核未通過</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;color:#333;">拒絕原因：<strong style="color:#dc2626;">${input.rejectionReason}</strong></p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;">請重新上傳正確的支付寶 HK 付款截圖（須顯示付款成功、金額及收款方資訊）。</p>
  </td></tr>
</table>
<p style="color:#555;font-size:14px;margin:12px 0;">如有任何疑問，請聯絡 BOXIUM 客服。</p>
<div style="text-align:center;margin:16px 0;">
  <a href="${orderUrl}" style="display:inline-block;background:#06038d;color:#FFD700;padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:bold;">重新上傳截圖</a>
</div>`;
          const html = buildGradingEmail({
            userName: user.name || user.email,
            title: "支付寶 HK 截圖審核未通過 ❌",
            body: `您的申請單 ${submission.orderNo} 的支付寶 HK 付款截圖未通過審核，請重新上傳正確的付款截圖。`,
            orderNo: submission.orderNo,
            linkUrl: orderUrl,
            ctaText: "重新上傳截圖",
            extraHtml,
          });
          await sendEmail({
            to: user.email,
            subject: `【BOXIUM PSA 鑑定】付款截圖審核未通過 ❌ — ${submission.orderNo}`,
            html,
            emailType: "grading",
            toUserId: submission.userId,
          });
        }
      } catch (e) {
        console.error("[Grading] Failed to send rejection email:", e);
      }
      return { success: true };
    }),

  // ─── Admin: Approve Alipay HK proof (pending_review → approved + pending_shipment) ──
  adminApproveGradingAlipayProof: adminProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [submission] = await db
        .select()
        .from(gradingSubmissions)
        .where(eq(gradingSubmissions.id, input.submissionId))
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND" });
      // Admin can force-approve regardless of current alipayProofStatus
      await db
        .update(gradingSubmissions)
        .set({ alipayProofStatus: "approved", status: "pending_shipment" } as any)
        .where(eq(gradingSubmissions.id, submission.id));

      // In-app notification
      await createNotification({
        userId: submission.userId,
        type: "system",
        title: "付款截圖已通過審核 ✅",
        body: `申請單 ${submission.orderNo} 的支付寶 HK 付款截圖已通過審核，付款已確認！請準備寄件，將卡牌寄往 BOXIUM。`,
        linkUrl: `/grading/orders/${submission.id}`,
      }).catch(() => {});

      // Email notification
      try {
        const [user] = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, submission.userId))
          .limit(1);
        if (user?.email) {
          const baseUrl = "https://boxium.asia";
          const orderUrl = `${baseUrl}/grading/orders/${submission.id}`;
          const extraHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:2px solid #86efac;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#16a34a;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#ffffff;">✅ 付款截圖審核通過</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;color:#333;">付款方式：支付寶 HK</p>
    <p style="margin:4px 0 0;font-size:13px;color:#333;">確認時間：${new Date().toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })}</p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;">請盡快將您的卡牌寄往 BOXIUM，我們將為您代辦 PSA 申報及包裝。</p>
  </td></tr>
</table>
<div style="text-align:center;margin:16px 0;">
  <a href="${orderUrl}" style="display:inline-block;background:#06038d;color:#FFD700;padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:bold;">查看申請詳情</a>
</div>`;
          const html = buildGradingEmail({
            userName: user.name || user.email,
            title: "付款截圖已通過審核，請準備寄件 ✅",
            body: `您的申請單 ${submission.orderNo} 的支付寶 HK 付款截圖已通過審核，付款已確認！請準備將您的卡牌寄往 BOXIUM。`,
            orderNo: submission.orderNo,
            linkUrl: orderUrl,
            ctaText: "查看寄件指引",
            extraHtml,
          });
          await sendEmail({
            to: user.email,
            subject: `【BOXIUM PSA 鑑定】付款截圖已通過審核，請準備寄件 ✅ — ${submission.orderNo}`,
            html,
            emailType: "grading",
            toUserId: submission.userId,
          });
        }
      } catch (e) {
        console.error("[Grading] Failed to send approval email:", e);
      }
      return { success: true };
    }),

  // ─── Reviews ─────────────────────────────────────────────────────────────────

  /** Submit a review for a completed grading submission */
  submitReview: protectedProcedure
    .input(z.object({
      submissionId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
      isPublic: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      // Verify the submission belongs to the user and is completed
      const [submission] = await db
        .select({ id: gradingSubmissions.id, status: gradingSubmissions.status, userId: gradingSubmissions.userId })
        .from(gradingSubmissions)
        .where(and(eq(gradingSubmissions.id, input.submissionId), eq(gradingSubmissions.userId, ctx.user.id)))
        .limit(1);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "申請不存在" });
      if (submission.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "只有已完成的申請才能評價" });
      // Check if already reviewed
      const [existing] = await db
        .select({ id: gradingReviews.id })
        .from(gradingReviews)
        .where(eq(gradingReviews.submissionId, input.submissionId))
        .limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "您已評價過此申請" });
      // Insert review
      await db.insert(gradingReviews).values({
        submissionId: input.submissionId,
        userId: ctx.user.id,
        rating: input.rating,
        comment: input.comment || null,
        isPublic: input.isPublic,
      });
      return { success: true };
    }),

  /** Get public reviews for the grading service (for landing page) */
  getPublicReviews: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      const limit = input?.limit ?? 10;
      const rows = await db
        .select({
          id: gradingReviews.id,
          rating: gradingReviews.rating,
          comment: gradingReviews.comment,
          createdAt: gradingReviews.createdAt,
          userName: users.name,
        })
        .from(gradingReviews)
        .innerJoin(users, eq(gradingReviews.userId, users.id))
        .where(eq(gradingReviews.isPublic, true))
        .orderBy(desc(gradingReviews.createdAt))
        .limit(limit);
      return rows;
    }),

  /** Get the review for a specific submission (by the current user) */
  getMyReview: protectedProcedure
    .input(z.object({ submissionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const [review] = await db
        .select()
        .from(gradingReviews)
        .where(and(eq(gradingReviews.submissionId, input.submissionId), eq(gradingReviews.userId, ctx.user.id)))
        .limit(1);
      return review ?? null;
    }),

  /** Admin: get all reviews with stats */
  adminGetReviews: adminProcedure
    .query(async () => {
      const db = await getDb();
      const rows = await db
        .select({
          id: gradingReviews.id,
          submissionId: gradingReviews.submissionId,
          rating: gradingReviews.rating,
          comment: gradingReviews.comment,
          isPublic: gradingReviews.isPublic,
          createdAt: gradingReviews.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(gradingReviews)
        .innerJoin(users, eq(gradingReviews.userId, users.id))
        .orderBy(desc(gradingReviews.createdAt));
      const avgRating = rows.length > 0
        ? rows.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / rows.length
        : 0;
      return { reviews: rows, avgRating: Math.round(avgRating * 10) / 10, total: rows.length };
    }),
  /** Toggle review public/hidden visibility */
  toggleReviewVisibility: adminProcedure
    .input(z.object({ id: z.number().int().positive(), isPublic: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(gradingReviews)
        .set({ isPublic: input.isPublic })
        .where(eq(gradingReviews.id, input.id));
      return { success: true };
    }),
  /** Get monthly review stats for admin trend chart */
  adminGetReviewMonthlyStats: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const rows = await db
        .select({
          id: gradingReviews.id,
          rating: gradingReviews.rating,
          createdAt: gradingReviews.createdAt,
        })
        .from(gradingReviews)
        .orderBy(asc(gradingReviews.createdAt));
      // Group by month
      const monthMap = new Map<string, { total: number; count: number }>();
      for (const row of rows) {
        const d = new Date(row.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthMap.get(key) || { total: 0, count: 0 };
        monthMap.set(key, { total: existing.total + row.rating, count: existing.count + 1 });
      }
      return Array.from(monthMap.entries()).map(([month, { total, count }]) => ({
        month,
        avgRating: Math.round((total / count) * 10) / 10,
        count,
      }));
    }),

  /** Get current user's saved shipping addresses (for grading return address selection) */
  getMyShippingAddresses: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserShippingAddresses(ctx.user.id);
    }),
});