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
      const printUrl = `/grading/orders/${submissionId}`;  // print button on detail page
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
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6ff;border:2px solid #dde0f5;border-radius:10px;margin:16px 0;overflow:hidden;">
  <tr><td style="background:#06038d;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#FFD700;">📦 送件地址</p>
  </td></tr>
  <tr><td style="padding:12px 16px;">
    <p style="margin:0;font-size:13px;font-weight:bold;color:#06038d;">順豐站 852Z351</p>
    <p style="margin:4px 0 0;font-size:13px;color:#333;">香港新界離島區東淌逸東街 8 號逸東邨逸東商場 2 樓 201 號舖</p>
    ${nextBatch ? `<p style="margin:8px 0 0;font-size:13px;font-weight:bold;color:#dc3545;">⏰ 寄件截止日期：${new Date(nextBatch.cutoffDate).toLocaleDateString("zh-HK")}</p>` : ""}
  </td></tr>
</table>
<p style="color:#dc3545;font-size:14px;margin:12px 0;">⚠️ 請務必打印申請單連同卡牌一起寄出，否則無法處理您的申請。</p>
<div style="text-align:center;margin:16px 0;">
  <a href="${baseUrl}${printUrl}" style="display:inline-block;background:#06038d;color:#FFD700;padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:bold;">🖨️ 打印申請單</a>
</div>`,
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
      if (submission.status !== "graded" && submission.status !== "payment_pending") {
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
        .where(isNotNull(gradingSubmissions.batchId))
        .orderBy(asc(gradingSubmissions.createdAt));
      // Get item counts per submission
      const submissionIds = allSubmissions.map((s) => s.submission.id);
      let itemCountMap = new Map<number, number>();
      if (submissionIds.length > 0) {
        const itemCounts = await db
          .select({ submissionId: gradingSubmissionItems.submissionId, cnt: count(gradingSubmissionItems.id) })
          .from(gradingSubmissionItems)
          .where(inArray(gradingSubmissionItems.submissionId, submissionIds))
          .groupBy(gradingSubmissionItems.submissionId);
        itemCountMap = new Map<number, number>(itemCounts.map((r) => [r.submissionId, Number(r.cnt)]));
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
      return batches.map((batch) => {
        const subs = submissionsByBatch.get(batch.id) ?? [];
        const totalCards = subs.reduce((sum: number, s: any) => sum + s.itemCount, 0);
        const paidCount = subs.filter((s: any) => s.status === "paid" || s.status === "completed").length;
        const unpaidCount = subs.filter((s: any) => s.status === "graded" || s.status === "payment_overdue").length;
        const pendingCount = subs.filter((s: any) => !(["paid", "completed", "graded", "payment_overdue", "cancelled"].includes(s.status))).length;
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
          alipayProofPending: z.boolean().optional(), // filter by alipayProofStatus = 'pending_review'
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
        if (input.alipayProofPending) conditions.push(eq(gradingSubmissions.alipayProofStatus, "pending_review"));

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
