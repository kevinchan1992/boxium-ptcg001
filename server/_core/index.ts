// ===== Force Hong Kong timezone for the entire Node.js process =====
// Must be set before any imports that use Date objects
process.env.TZ = 'Asia/Hong_Kong';

import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import http from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
// Manus OAuth removed
import { appRouter } from "../routers";
import googleOAuthRouter from "../googleOAuth";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
// import { startScheduler } from "../scheduler"; // Disabled: use priceUpdateScheduler instead
import { initPriceUpdateScheduler, startTrendingCardsScheduler, startAutoCompleteOrdersScheduler, startShippingReminderScheduler, startOfferExpiryReminderScheduler, startOfferExpiryCleanupScheduler, startPaymentTimeoutCancelScheduler, startPaymentReminderScheduler, startCartExpiryCleanupScheduler, startAlipayReviewReminderScheduler, startCartExpiryNotificationScheduler, startConfirmReceiptReminderScheduler, startMeetupAutoCancelScheduler, startListingStockRepairScheduler, startPayoutRetryScheduler, startPayoutHoldScheduler, startDisputeSlaEscalationScheduler, startDispute3DayReminderScheduler, startOrphanAuctionRepairScheduler, startGradingOverdueReminderScheduler, startGradingAwaitingPaymentCleanupScheduler, startGradingUpgradeOverdueReminderScheduler, startScraperPerformanceLogsCleanupScheduler } from "../priceUpdateScheduler";
import { startWeeklyBlogReportScheduler } from "../weeklyBlogScheduler";
import { generateSitemap } from "../sitemap";
import { Sentry } from "./sentry";
import {
  botDetection,
  manualBlockCheck,
  securityHeaders,
  trpcRateLimitRouter,
  authLimiter,
  uploadLimiter,
  validateImageMime,
  validatePaymentProofMime,
} from "../middleware/security";
import { getListingById, getCardById, getSealedProductById } from "../db";
import { composeOgImage, composeAndCacheOgImage, getDefaultOgImageUrl, composeAndCacheMarketplaceOgImage } from "../ogImageComposer";
import Stripe from "stripe";
function getStripe() { return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" }); }

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── Pre-warm DB connection pool + security caches (BLOCKING) ────────────────
  // getDb() is lazy-initialized: the first call creates the MySQL connection pool
  // and establishes a TiDB connection (cross-region, ~5s). We AWAIT this here
  // so the pool is fully ready before server.listen() is called. Without this,
  // the first user request triggers DB init and blocks for 5-7s.
  // We also pre-warm the security caches (blocked IPs, admin whitelist) so that
  // manualBlockCheck never needs to await DB on the hot path.
  try {
    const { getDb } = await import('../db');
    const db = await getDb();
    if (db) {
      await db.execute('SELECT 1');
      console.log('[DB] Connection pool pre-warmed successfully');
    }
    // Pre-warm security caches so manualBlockCheck never awaits DB on hot path
    const { loadBlockedIpCache, loadAdminWhitelistFromDb } = await import('../middleware/security');
    await Promise.all([
      loadBlockedIpCache().catch(() => {}),
      loadAdminWhitelistFromDb().catch(() => {}),
    ]);
    console.log('[DB] Security caches pre-warmed successfully');
  } catch (e: any) {
    console.warn('[DB] Pre-warm failed (non-fatal):', e.message);
  }

  // Trust the first reverse proxy (Manus CDN) so req.ip returns the real client IP
  // This is required for rate limiting and bot detection to work correctly
  // Without this, X-Forwarded-For can be spoofed by attackers
  app.set('trust proxy', 1);

  // ─── Security: global headers + bot detection + manual block ────────────────
  app.use(securityHeaders);
  app.use(manualBlockCheck);
  app.use(botDetection);

  // Configure CORS — allow production domain + dev origins
  const ALLOWED_ORIGINS: Array<string | RegExp> = [
    "https://boxiumptcg-mua4eq38.manus.space",
    "https://boxium.asia",
    "https://www.boxium.asia",
    /\.manus\.computer$/,
    /\.manus\.space$/,
    /localhost/,
    /127\.0\.0\.1/,
  ];
  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const allowed = ALLOWED_ORIGINS.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  }));
  
  // Add cookie parser middleware
  app.use(cookieParser());
  
  // ============================================================
  // Stripe Webhook - MUST be before express.json() for signature verification
  // ============================================================
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    let event: any;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      return res.json({ verified: true });
    }
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        const orderId = session.metadata?.orderId;
        const batchOrderNos = session.metadata?.batch_order_nos;
        console.log(`[Webhook] checkout.session.completed: orderNo=${orderNo}, orderId=${orderId}, batchOrderNos=${batchOrderNos}`);
        const { updateMarketplaceOrder, getMarketplaceOrderById, getMarketplaceOrderByNo } = await import("../db");
        const { createNotification } = await import("../db/notifications");

        // Handle batch orders (multiple items in one Stripe session)
        if (batchOrderNos && batchOrderNos.includes(",")) {
          const orderNoList = batchOrderNos.split(",").map((s: string) => s.trim()).filter(Boolean);
          console.log(`[Webhook] Processing batch orders: ${orderNoList.join(", ")}`);
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

          // P1/P2: Update cartOrders master record with stripeChargeId
          const cartOrderId = session.metadata?.cart_order_id;
          if (cartOrderId) {
            try {
              const { updateCartOrder } = await import("../db");
              // Retrieve the charge ID from the PaymentIntent (needed for Stripe Connect Transfers)
              let chargeId: string | null = null;
              if (paymentIntentId) {
                const stripeClient = getStripe();
                const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId);
                chargeId = typeof (pi as any).latest_charge === "string" ? (pi as any).latest_charge : null;
              }
              await updateCartOrder(parseInt(cartOrderId), {
                paymentStatus: "succeeded",
                stripePaymentIntentId: paymentIntentId ?? undefined,
                stripeChargeId: chargeId ?? undefined,
              });
              console.log(`[Webhook] cartOrder#${cartOrderId} updated: paymentStatus=succeeded, chargeId=${chargeId}`);
            } catch (cartErr: any) {
              console.warn(`[Webhook] Failed to update cartOrder#${cartOrderId}:`, cartErr.message);
            }
          }

          for (const batchOrderNo of orderNoList) {
            try {
              const batchOrder = await getMarketplaceOrderByNo(batchOrderNo);
              if (!batchOrder) { console.warn(`[Webhook] Batch order ${batchOrderNo} not found`); continue; }
              // F2: Idempotency guard — skip orders already processed (prevents duplicate processing on Webhook retries)
              if (batchOrder.paymentStatus === "paid" || ["payment_received", "processing", "shipped", "delivered", "completed"].includes(batchOrder.orderStatus)) {
                console.log(`[Webhook] Batch order ${batchOrderNo} already processed (status: ${batchOrder.orderStatus}), skipping`);
                continue;
              }
              if (batchOrder.orderStatus === "cancelled") {
                // Auto-refund for cancelled orders is complex in batch; log for manual review
                console.warn(`[Webhook] Batch order ${batchOrderNo} already cancelled but payment received — needs manual review`);
                const { notifyAdmin: _na } = await import("../emailService");
                await _na({ title: "批量訂單中有已取消訂單收到付款", content: `訂單 ${batchOrderNo} 已取消但批量付款已收取，請手動處理退款。Session: ${session.id}` }).catch(() => {});
                continue;
              }
              if (batchOrder.orderStatus === "pending_payment") {
                await updateMarketplaceOrder(batchOrder.id, {
                  paymentStatus: "paid",
                  paidAt: new Date(),
                  orderStatus: "payment_received",
                  stripePaymentIntentId: paymentIntentId ?? batchOrder.stripePaymentIntentId,
                });
                console.log(`[Webhook] Batch order ${batchOrderNo} marked as payment_received`);
                // If this is an auction order, also update auctionListings.auctionPaymentStatus
                if ((batchOrder as any).orderSource === 'auction' && (batchOrder as any).auctionListingId) {
                  try {
                    const { updateAuctionListing } = await import('../db');
                    await updateAuctionListing((batchOrder as any).auctionListingId, {
                      auctionPaymentStatus: 'paid',
                      auctionPaymentPaidAt: new Date(),
                      auctionOrderId: batchOrder.id,
                    } as any);
                    console.log(`[Webhook] Updated auctionListing#${(batchOrder as any).auctionListingId} auctionPaymentStatus=paid`);
                  } catch (auctionUpdateErr: any) {
                    console.warn(`[Webhook] Failed to update auctionListing for order ${batchOrderNo}:`, auctionUpdateErr.message);
                  }
                }
                // Clear cart item for this listing after successful payment
                try {
                  const { cartItems: _bCartItemsTable } = await import('../../drizzle/schema_new');
                  const { eq: _bceq, and: _bcand } = await import('drizzle-orm');
                  const { getDb: _bGetDb } = await import('../db');
                  const _bcdb = await _bGetDb();
                  if (_bcdb && batchOrder.listingId) {
                    await _bcdb.delete(_bCartItemsTable)
                      .where(_bcand(_bceq(_bCartItemsTable.userId, batchOrder.buyerId), _bceq(_bCartItemsTable.listingId, batchOrder.listingId)));
                    console.log(`[Webhook] Cleared cart item for buyer ${batchOrder.buyerId}, listing ${batchOrder.listingId}`);
                  }
                } catch (_bCartClearErr: any) {
                  console.warn('[Webhook] Failed to clear batch cart item after payment:', _bCartClearErr.message);
                }
                if (batchOrder.listingId) {
                  const { claimListingAsSold } = await import("../db");
                  const batchClaimed = await claimListingAsSold(batchOrder.listingId, batchOrder.quantity ?? 1);
                  if (!batchClaimed) {
                    // Oversell: cancel this batch order and auto-refund (partial refund from batch session is complex — notify admin)
                    console.warn(`[Webhook] Oversell in batch: listing ${batchOrder.listingId}, order ${batchOrderNo}`);
                    await updateMarketplaceOrder(batchOrder.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled' });
                    const { notifyAdmin: _bna } = await import('../emailService');
                    await _bna({ title: '❗ 批次訂單超賣需手動退款', content: `批次訂單 ${batchOrderNo} 商品已售罄，請在 Stripe Dashboard 手動退款對應金額。` }).catch(() => {});
                    await createNotification({ userId: batchOrder.buyerId, type: 'trade', title: '訂單已取消 — 商品已售罄 😔', body: `非常抱歉，訂單 ${batchOrderNo} 的商品已售罄，管理員將對您進行退款。`, linkUrl: `/orders/${batchOrderNo}` }).catch(() => {});
                    continue;
                  }
                }
                await createNotification({
                  userId: batchOrder.buyerId,
                  type: 'trade',
                  title: '付款成功 ✅',
                  body: `訂單 ${batchOrderNo} 的 Stripe 付款已確認，訂單現在進入處理中。`,
                  linkUrl: `/orders/${batchOrderNo}`,
                }).catch(() => {});
                if (batchOrder.sellerId) {
                  const { getSellerProfileById } = await import('../db');
                  const sp = await getSellerProfileById(batchOrder.sellerId);
                  if (sp?.userId) {
                    await createNotification({
                      userId: sp.userId,
                      type: 'trade',
                      title: '新訂單已付款 🎉',
                      body: `訂單 ${batchOrderNo} 買家已完成 Stripe 付款，請盡快安排出貨。`,
                      linkUrl: "/seller",
                    }).catch(() => {});
                  }
                }
              }
            } catch (batchErr: any) {
              console.error(`[Webhook] Error processing batch order ${batchOrderNo}:`, batchErr.message);
            }
          }
          return res.json({ received: true });
        }

        // Handle auction payment (winner pays after auction ends)
        const auctionListingId = session.metadata?.auction_listing_id;
        if (auctionListingId) {
          console.log(`[Webhook] Auction payment received for listing ${auctionListingId}`);
          try {
            const { updateAuctionListing, getAuctionListingById } = await import('../db');
            const auctionListing = await getAuctionListingById(parseInt(auctionListingId));
            if (auctionListing && auctionListing.auctionPaymentStatus === 'pending') {
              const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
              // Create the marketplace order for this auction
              const { generateOrderNo, createMarketplaceOrder, createOrderItems, getSellerProfileByUserId } = await import('../db');
              const winnerId = auctionListing.winnerId;
              if (winnerId) {
                const orderNo_ = await generateOrderNo();
                const winningBidAmount = parseFloat(auctionListing.currentHighestBid ?? '0');
                // Tiered fee rate: 5% for ≤5000, 4% for ≤10000, 3% for >10000
                const { getSystemSetting: getSetting_ } = await import('../db');
                let platformFeeRate: number;
                try {
                  const [t1max, t1rate, t2max, t2rate, t3rate] = await Promise.all([
                    getSetting_('fee_tier_1_max'), getSetting_('fee_tier_1_rate'),
                    getSetting_('fee_tier_2_max'), getSetting_('fee_tier_2_rate'),
                    getSetting_('fee_tier_3_rate'),
                  ]);
                  const tier1Max  = t1max  ? parseFloat(t1max.settingValue)  : 5000;
                  const tier1Rate = t1rate ? parseFloat(t1rate.settingValue) : 0.05;
                  const tier2Max  = t2max  ? parseFloat(t2max.settingValue)  : 10000;
                  const tier2Rate = t2rate ? parseFloat(t2rate.settingValue) : 0.04;
                  const tier3Rate = t3rate ? parseFloat(t3rate.settingValue) : 0.03;
                  platformFeeRate = winningBidAmount <= tier1Max ? tier1Rate : winningBidAmount <= tier2Max ? tier2Rate : tier3Rate;
                } catch {
                  platformFeeRate = winningBidAmount <= 5000 ? 0.05 : winningBidAmount <= 10000 ? 0.04 : 0.03;
                }
                const platformFee = winningBidAmount * platformFeeRate;
                const sellerReceivable = winningBidAmount - platformFee;
                const sellerProf = auctionListing.sellerId ? await getSellerProfileByUserId(auctionListing.sellerId) : null;
                const newOrder = await createMarketplaceOrder({
                  orderNo: orderNo_,
                  buyerId: winnerId,
                  sellerId: sellerProf?.id ?? null,
                  paymentMethod: 'stripe',
                  subtotalHkd: winningBidAmount.toString(),
                  platformFeeHkd: platformFee.toString(),
                  sellerReceivableHkd: sellerReceivable.toString(),
                  totalHkd: winningBidAmount.toString(),
                  orderStatus: 'payment_received',
                  paymentStatus: 'paid',
                  paidAt: new Date(),
                  stripePaymentIntentId: paymentIntentId,
                  stripeSessionId: session.id,
                  orderSource: 'auction',
                  auctionListingId: parseInt(auctionListingId),
                  auctionWinningBidId: auctionListing.winningBidId ?? null,
                } as any);
                if (newOrder?.id) {
                  await createOrderItems([{
                    orderId: newOrder.id,
                    listingId: auctionListing.id,
                    quantity: 1,
                    priceHkd: winningBidAmount.toString(),
                    title: auctionListing.title ?? `拍賣 #${auctionListingId}`,
                    images: auctionListing.images,
                    condition: auctionListing.condition,
                  }] as any);
                  await updateAuctionListing(parseInt(auctionListingId), {
                    auctionPaymentStatus: 'paid',
                    auctionPaymentPaidAt: new Date(),
                    auctionOrderId: newOrder.id,
                  } as any);
                  await createNotification({
                    userId: winnerId,
                    type: 'auction_won',
                    title: '拍賣付款成功 ✅',
                    body: `您已成功支付拍賣商品「${auctionListing.title ?? `拍賣 #${auctionListingId}`}」，訂單 ${orderNo_} 現已進入處理中。`,
                    linkUrl: `/orders/${orderNo_}`,
                  }).catch(() => {});
                  if (sellerProf?.userId) {
                    await createNotification({
                      userId: sellerProf.userId,
                      type: 'trade',
                      title: '拍賣訂單已付款 🎉',
                      body: `拍賣「${auctionListing.title ?? `拍賣 #${auctionListingId}`}」得標者已完成付款，訂單 ${orderNo_} 請盡快安排出貨。`,
                      linkUrl: '/seller',
                    }).catch(() => {});
                  }
                  console.log(`[Webhook] Auction order ${orderNo_} created for listing ${auctionListingId}`);
                }
              }
            }
          } catch (auctionPayErr: any) {
            console.error(`[Webhook] Auction payment processing error:`, auctionPayErr.message);
          }
          return res.json({ received: true });
        }

        // Handle grading submission payment (pay-first flow)
        const gradingMetaType = session.metadata?.type;
        if (gradingMetaType === "grading_submission_payment") {
          const submissionId = session.metadata?.submission_id;
          const gradingOrderNo = session.metadata?.order_no;
          console.log(`[Webhook] grading_submission_payment: submissionId=${submissionId}, orderNo=${gradingOrderNo}`);
          if (submissionId) {
            try {
              const { getDb: _gDb } = await import("../db");
              const { gradingSubmissions: _gSubs } = await import("../../drizzle/schema_new");
              const { eq: _geq } = await import("drizzle-orm");
              const _gdb = await _gDb();
              if (_gdb) {
                const [sub] = await _gdb.select().from(_gSubs).where(_geq(_gSubs.id, parseInt(submissionId))).limit(1);
                if (sub && sub.status === "awaiting_payment") {
                  await _gdb.update(_gSubs)
                    .set({
                      status: "pending_shipment",
                      paymentMethod: "stripe",
                      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
                      paidAt: new Date(),
                    } as any)
                    .where(_geq(_gSubs.id, parseInt(submissionId)));
                  console.log(`[Webhook] Grading submission #${submissionId} (${gradingOrderNo}) activated: awaiting_payment -> pending_shipment`);
                  // Notify user
                  const userId = parseInt(session.metadata?.user_id ?? "0");
                  if (userId) {
                    await createNotification({
                      userId,
                      type: "system",
                      title: "PSA 代客鑑定申請已確認 ✅",
                      body: `申請單 ${gradingOrderNo} 的費用已收到，申請已正式啟動。請按指示寄出卡牌。`,
                      linkUrl: `/grading/orders/${submissionId}`,
                    }).catch(() => {});
                  }
                } else {
                  console.log(`[Webhook] Grading submission #${submissionId} status=${sub?.status}, skipping activation`);
                }
              }
            } catch (gradingPayErr: any) {
              console.error(`[Webhook] Grading submission payment processing error:`, gradingPayErr.message);
            }
          }
          return res.json({ received: true });
        }

        // Handle grading tier upgrade payment
        if (gradingMetaType === "grading_tier_upgrade_payment") {
          const submissionId = session.metadata?.submission_id;
          const diffFeeHkd = session.metadata?.diff_fee_hkd;
          const gradingOrderNo = session.metadata?.order_no;
          // New format: upgrade_items JSON with per-item {itemId, newTierId, diffFee}
          const upgradeItemsJson = session.metadata?.upgrade_items;
          console.log(`[Webhook] grading_tier_upgrade_payment: submissionId=${submissionId}, diff=${diffFeeHkd}, hasUpgradeItems=${!!upgradeItemsJson}`);
          if (submissionId) {
            try {
              const { getDb: _gDb2 } = await import("../db");
              const { gradingSubmissions: _gSubs2, gradingSubmissionItems: _gItems2, gradingServiceTiers: _gTiers2 } = await import("../../drizzle/schema_new");
              const { eq: _geq2, inArray: _inArray2, sql: _sql2 } = await import("drizzle-orm");
              const _gdb2 = await _gDb2();
              if (_gdb2) {
                const [sub2] = await _gdb2.select().from(_gSubs2).where(_geq2(_gSubs2.id, parseInt(submissionId))).limit(1);
                if (sub2) {
                  let upgradedCount = 0;
                  let representativeTierName = "升級層級";

                  if (upgradeItemsJson) {
                    // New per-item format: [{itemId, newTierId, diffFee}]
                    type UpgradeItemMeta = { itemId: number; newTierId: number; diffFee: string };
                    const upgradeItems: UpgradeItemMeta[] = JSON.parse(upgradeItemsJson);
                    // Collect unique tier IDs
                    const uniqueTierIds2 = Array.from(new Set(upgradeItems.map((i) => i.newTierId)));
                    const tiers2 = await _gdb2.select().from(_gTiers2).where(_inArray2(_gTiers2.id, uniqueTierIds2));
                    const tierMap2 = new Map(tiers2.map((t: any) => [t.id, t]));
                    // Update each item to its specific new tier
                    await Promise.all(
                      upgradeItems.map(({ itemId, newTierId }: UpgradeItemMeta) => {
                        const tier2 = tierMap2.get(newTierId);
                        if (!tier2) return Promise.resolve();
                        return _gdb2.update(_gItems2)
                          .set({ tierId: newTierId, feeHkd: _sql2`${parseFloat((tier2 as any).feeHkd).toFixed(2)}` })
                          .where(_geq2(_gItems2.id, itemId));
                      })
                    );
                    upgradedCount = upgradeItems.length;
                    // Use the most expensive tier name as representative
                    const maxTier2 = upgradeItems.reduce((best: UpgradeItemMeta, cur: UpgradeItemMeta) => {
                      const bFee = parseFloat((tierMap2.get(best.newTierId) as any)?.feeHkd ?? "0");
                      const cFee = parseFloat((tierMap2.get(cur.newTierId) as any)?.feeHkd ?? "0");
                      return cFee > bFee ? cur : best;
                    }, upgradeItems[0]);
                    representativeTierName = (tierMap2.get(maxTier2.newTierId) as any)?.name ?? "升級層級";
                    console.log(`[Webhook] Per-item upgrade: ${upgradedCount} items for submission #${submissionId}`);
                  } else {
                    // Legacy fallback: single new_tier_id for all selected items (upgrade_item_ids)
                    const newTierId = session.metadata?.new_tier_id;
                    const upgradeItemIdsStr = session.metadata?.upgrade_item_ids ?? "";
                    const upgradeItemIds = upgradeItemIdsStr
                      ? upgradeItemIdsStr.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
                      : [];
                    if (newTierId) {
                      const [tier2] = await _gdb2.select().from(_gTiers2).where(_geq2(_gTiers2.id, parseInt(newTierId))).limit(1);
                      if (tier2) {
                        const targetIds = upgradeItemIds.length > 0 ? upgradeItemIds : (await _gdb2.select().from(_gItems2).where(_geq2(_gItems2.submissionId, parseInt(submissionId)))).map((i: any) => i.id);
                        if (targetIds.length > 0) {
                          await _gdb2.update(_gItems2)
                            .set({ tierId: parseInt(newTierId), feeHkd: _sql2`${parseFloat(tier2.feeHkd).toFixed(2)}` })
                            .where(_inArray2(_gItems2.id, targetIds));
                        }
                        upgradedCount = targetIds.length;
                        representativeTierName = tier2.name;
                        console.log(`[Webhook] Legacy upgrade: ${upgradedCount} items to ${tier2.name} for submission #${submissionId}`);
                      }
                    }
                  }

                  // Use diffFeeHkd from metadata as the authoritative amount paid
                  const diffPaid = parseFloat(diffFeeHkd ?? "0");
                  const currentTotal = parseFloat(sub2.totalFeeHkd ?? "0");
                  const newTotal = currentTotal + diffPaid;

                  await _gdb2.update(_gSubs2)
                    .set({
                      totalFeeHkd: _sql2`${newTotal.toFixed(2)}`,
                      upgradePaidAt: new Date(),
                      upgradeCheckoutSessionId: null,
                      // Clear alipayProofStatus so Admin proof review card is hidden after Stripe upgrade payment
                      alipayProofStatus: "approved",
                      // After upgrade payment, status stays 'graded' — Admin will update to 'returned' when shipped back
                      // No status change needed here
                    } as any)
                    .where(_geq2(_gSubs2.id, parseInt(submissionId)));
                  console.log(`[Webhook] Grading submission #${submissionId} upgrade complete, diff HK$${diffPaid.toFixed(2)}, new total HK$${newTotal.toFixed(2)}`);

                  // Notify user
                  const userId = parseInt(session.metadata?.user_id ?? "0");
                  if (userId) {
                    await createNotification({
                      userId,
                      type: "system",
                      title: "PSA 鑑定服務層級升級差價已收到 ✅",
                      body: `申請單 ${gradingOrderNo} 的升級差價 HK$${diffPaid.toFixed(2)} 已收到，已升級 ${upgradedCount} 張卡牌至 ${representativeTierName}。`,
                      linkUrl: `/grading/orders/${submissionId}`,
                    }).catch(() => {});
                  }
                }
              }
            } catch (upgradePayErr: any) {
              console.error(`[Webhook] Grading tier upgrade payment processing error:`, upgradePayErr.message);
            }
          }
          return res.json({ received: true });
        }
        // Handle grading post-payment (pay-after-grading flow)
        if (gradingMetaType === "grading_payment") {
          const submissionId = session.metadata?.submission_id;
          const gradingOrderNo = session.metadata?.order_no;
          console.log(`[Webhook] grading_payment: submissionId=${submissionId}, orderNo=${gradingOrderNo}`);
          if (submissionId) {
            try {
              const { getDb: _gDb3 } = await import("../db");
              const { gradingSubmissions: _gSubs3 } = await import("../../drizzle/schema_new");
              const { eq: _geq3 } = await import("drizzle-orm");
              const _gdb3 = await _gDb3();
              if (_gdb3) {
                const [sub3] = await _gdb3.select().from(_gSubs3).where(_geq3(_gSubs3.id, parseInt(submissionId))).limit(1);
                if (sub3 && (sub3.status === "graded" || sub3.status === "payment_overdue")) {
                  await _gdb3.update(_gSubs3)
                    .set({
                      status: "completed",
                      paymentMethod: "stripe",
                      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
                      paidAt: new Date(),
                    } as any)
                    .where(_geq3(_gSubs3.id, parseInt(submissionId)));
                  console.log(`[Webhook] Grading post-payment #${submissionId} (${gradingOrderNo}): graded -> completed`);
                  const userId = parseInt(session.metadata?.user_id ?? "0");
                  if (userId) {
                    await createNotification({
                      userId,
                      type: "system",
                      title: "PSA 鑑定費用已收到 ✅",
                      body: `申請單 ${gradingOrderNo} 的費用已收到，BOXIUM 將安排寄回您的卡牌。`,
                      linkUrl: `/grading/orders/${submissionId}`,
                    }).catch(() => {});
                  }
                } else {
                  console.log(`[Webhook] Grading post-payment #${submissionId} status=${sub3?.status}, skipping`);
                }
              }
            } catch (gradingPostPayErr: any) {
              console.error(`[Webhook] Grading post-payment processing error:`, gradingPostPayErr.message);
            }
          }
          return res.json({ received: true });
        }

        let order: any = null;
        if (orderId) {
          order = await getMarketplaceOrderById(parseInt(orderId));
        } else if (orderNo || batchOrderNos) {
          order = await getMarketplaceOrderByNo(orderNo ?? batchOrderNos);
        }
        // F2: Idempotency guard for single orders — skip if already processed
        if (order && order.paymentStatus === "paid" && ["payment_received", "processing", "shipped", "delivered", "completed"].includes(order.orderStatus)) {
          console.log(`[Webhook] Single order ${order.orderNo} already processed (status: ${order.orderStatus}), skipping`);
          return res.json({ received: true });
        }
        if (order && order.orderStatus === "cancelled") {
          // Order was already cancelled (e.g., by payment timeout) but Stripe payment arrived late
          // Auto-refund to prevent charging the buyer for a cancelled order
          console.log(`[Webhook] Order ${order.orderNo} already cancelled but payment received — initiating auto-refund`);
          const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : order.stripePaymentIntentId;
          if (paymentIntentId) {
            try {
              const stripeRefund = getStripe();
              await stripeRefund.refunds.create({ payment_intent: paymentIntentId, reason: "requested_by_customer" });
              await updateMarketplaceOrder(order.id, {
                paymentStatus: "refunded",
                orderStatus: "refunded",
                stripePaymentIntentId: paymentIntentId,
              });
              console.log(`[Webhook] Auto-refund completed for cancelled order ${order.orderNo}`);
              // Notify buyer
              await createNotification({
                userId: order.buyerId,
                type: 'trade',
                title: '付款已自動退款 💰',
                body: `訂單 ${order.orderNo} 已取消，但 Stripe 付款已成功。系統已自動為您處理全額退款。`,
                linkUrl: `/orders/${order.orderNo}`,
              }).catch(() => {});
              // Notify admin
              const { notifyAdmin: _notifyAdmin } = await import("../emailService");
              await _notifyAdmin({
                title: "自動退款通知 💰",
                content: `訂單 ${order.orderNo} 已取消但 Stripe 付款延遲到達，系統已自動退款。PaymentIntent: ${paymentIntentId}`,
              }).catch(() => {});
            } catch (refundErr: any) {
              console.error(`[Webhook] Auto-refund failed for order ${order.orderNo}:`, refundErr.message);
              // Notify admin of failed refund for manual intervention
              const { notifyAdmin: _notifyAdmin2 } = await import("../emailService");
              await _notifyAdmin2({
                title: "❗ 自動退款失敗，需人工處理",
                content: `訂單 ${order.orderNo} 已取消但付款已收取，自動退款失敗：${refundErr.message}。請在 Stripe Dashboard 手動退款。PaymentIntent: ${paymentIntentId}`,
              }).catch(() => {});
            }
          }
          return res.json({ received: true });
        }
        if (order && order.orderStatus === "pending_payment") {
          // P1/P2: Update cartOrders master record for single-item checkout
          const singleCartOrderId = session.metadata?.cart_order_id;
          if (singleCartOrderId) {
            try {
              const { updateCartOrder } = await import("../db");
              let chargeId: string | null = null;
              const singlePiId = typeof session.payment_intent === "string" ? session.payment_intent : null;
              if (singlePiId) {
                const stripeClient = getStripe();
                const pi = await stripeClient.paymentIntents.retrieve(singlePiId);
                chargeId = typeof (pi as any).latest_charge === "string" ? (pi as any).latest_charge : null;
              }
              await updateCartOrder(parseInt(singleCartOrderId), {
                paymentStatus: "succeeded",
                stripePaymentIntentId: singlePiId ?? undefined,
                stripeChargeId: chargeId ?? undefined,
              });
              console.log(`[Webhook] cartOrder#${singleCartOrderId} (single) updated: chargeId=${chargeId}`);
            } catch (cartSingleErr: any) {
              console.warn(`[Webhook] Failed to update single cartOrder#${singleCartOrderId}:`, cartSingleErr.message);
            }
          }
          // First-pay-first-served: atomically claim the listing stock before confirming order
          if (order.listingId) {
            const { claimListingAsSold, updateMarketplaceOrder: _updateOrder } = await import("../db");
            const claimed = await claimListingAsSold(order.listingId, order.quantity ?? 1);
            if (!claimed) {
              // Another buyer already paid — cancel this order and auto-refund
              console.warn(`[Webhook] Oversell detected for listing ${order.listingId}, order ${order.orderNo} — auto-refunding`);
              await _updateOrder(order.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled' });
              try {
                const stripeClient = getStripe();
                const piId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
                if (piId) await stripeClient.refunds.create({ payment_intent: piId, reason: 'duplicate' });
              } catch (refundErr: any) {
                console.error(`[Webhook] Auto-refund failed for oversold order ${order.orderNo}:`, refundErr.message);
                const { notifyAdmin: _na } = await import('../emailService');
                await _na({ title: '❗ 超賣自動退款失敗', content: `訂單 ${order.orderNo} 超賣但自動退款失敗，請手動處理。PaymentIntent: ${session.payment_intent}` }).catch(() => {});
              }
              await createNotification({
                userId: order.buyerId,
                type: 'trade',
                title: '訂單已取消 — 商品已售罄 😔',
                body: `非常抱歉，訂單 ${order.orderNo} 的商品已被其他買家搶先付款，您的付款將全額退回。`,
                linkUrl: `/orders/${order.orderNo}`,
              }).catch(() => {});
              return res.json({ received: true });
            }
          }
          await updateMarketplaceOrder(order.id, {
            paymentStatus: "paid",
            paidAt: new Date(),
            orderStatus: "payment_received",
            stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : order.stripePaymentIntentId,
          });
          console.log(`[Webhook] Order ${order.orderNo} marked as payment_received, listing ${order.listingId} claimed as sold`);
          // Clear cart items for this listing after successful payment
          try {
            const { cartItems: _cartItemsTable } = await import('../../drizzle/schema_new');
            const { eq: _ceq, and: _cand } = await import('drizzle-orm');
            const { getDb: _getDb } = await import('../db');
            const _cdb = await _getDb();
            if (_cdb && order.listingId) {
              await _cdb.delete(_cartItemsTable)
                .where(_cand(_ceq(_cartItemsTable.userId, order.buyerId), _ceq(_cartItemsTable.listingId, order.listingId)));
              console.log(`[Webhook] Cleared cart item for buyer ${order.buyerId}, listing ${order.listingId}`);
            }
          } catch (_cartClearErr: any) {
            console.warn('[Webhook] Failed to clear cart item after payment:', _cartClearErr.message);
          }
          // Notify buyer of payment confirmation
          await createNotification({
            userId: order.buyerId,
            type: 'trade',
            title: '付款成功 ✅',
            body: `訂單 ${order.orderNo} 的 Stripe 付款已確認，訂單現在進入處理中。`,

            linkUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          // Send order confirmed email to buyer
          try {
            const { sendOrderEmail, buildOrderConfirmedEmail, getOrderEmailData } = await import('../emailService');
            const emailData = await getOrderEmailData(order);
            const { subject, html } = buildOrderConfirmedEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, listingId: emailData.listingId, shippingMethod: order.shippingMethod ?? undefined });
            await sendOrderEmail({ userId: order.buyerId, subject, html, emailType: 'order', dedupeKey: `order_paid_buyer_${order.id}` });
          } catch (emailErr: any) {
            console.warn('[Webhook] Order confirmed email failed:', emailErr.message);
          }
          // Notify seller of new paid order (use sellerProfile.userId, NOT order.sellerId)
          if (order.sellerId) {
            const { getSellerProfileById } = await import('../db');
            const webhookSellerProf = await getSellerProfileById(order.sellerId);
            if (webhookSellerProf?.userId) {
              await createNotification({
                userId: webhookSellerProf.userId,
                type: 'trade',
                title: '新訂單已付款 🎉',
                body: `訂單 ${order.orderNo} 買家已完成 Stripe 付款，請盡快安排出貨。`,
                linkUrl: "/seller",
              }).catch(() => {});
              // Send email to seller: new order paid via Stripe
              try {
                const { sendOrderEmail, buildOrderPaymentReceivedSellerEmail, getOrderEmailData } = await import('../emailService');
                const sellerEmailData = await getOrderEmailData(order);
                const { subject: ss, html: sh } = buildOrderPaymentReceivedSellerEmail({ orderNo: order.orderNo, itemName: sellerEmailData.itemName, priceHkd: sellerEmailData.priceHkd, listingId: order.listingId ?? undefined });
                await sendOrderEmail({ userId: webhookSellerProf.userId, subject: ss, html: sh, emailType: 'order', dedupeKey: `order_paid_seller_${order.id}` });
              } catch (sellerEmailErr: any) { console.warn('[Webhook] Seller email failed:', sellerEmailErr.message); }
            }
          }
        }
      } else if (event.type === "checkout.session.expired") {
        // P0 Fix #2: Stripe checkout session expired — cancel orders AND restore stock
        // Previously only notified buyer; now also cancels pending_payment orders and restores listing stock.
        const session = event.data.object;
        const orderNo = session.metadata?.order_no;
        const batchOrderNos = session.metadata?.batch_order_nos;
        const buyerIdStr = session.metadata?.user_id ?? session.metadata?.buyer_id;
        console.log(`[Webhook] checkout.session.expired: orderNo=${orderNo}, batchOrderNos=${batchOrderNos}, buyerId=${buyerIdStr}`);

        const { updateMarketplaceOrder, getMarketplaceOrderByNo, restoreListingStock } = await import("../db");
        const { createNotification } = await import("../db/notifications");
        const { marketplaceOrderItems } = await import("../../drizzle/schema_new");
        const { offers: offersTable } = await import("../../drizzle/schema_new");
        const { eq, and } = await import("drizzle-orm");
        const { getDb } = await import("../db");

        // Collect all order numbers to cancel
        const orderNosToCancel: string[] = [];
        if (batchOrderNos && batchOrderNos.includes(',')) {
          orderNosToCancel.push(...batchOrderNos.split(',').map((s: string) => s.trim()).filter(Boolean));
        } else if (orderNo) {
          orderNosToCancel.push(orderNo);
        } else if (batchOrderNos) {
          orderNosToCancel.push(batchOrderNos);
        }

        let cancelledCount = 0;
        for (const cancelOrderNo of orderNosToCancel) {
          try {
            const order = await getMarketplaceOrderByNo(cancelOrderNo);
            if (!order) { console.warn(`[Webhook:expired] Order ${cancelOrderNo} not found`); continue; }
            // Only cancel if still pending_payment
            if (order.orderStatus !== 'pending_payment') {
              console.log(`[Webhook:expired] Order ${cancelOrderNo} status=${order.orderStatus}, skipping cancel`);
              continue;
            }
            // Cancel the order
            await updateMarketplaceOrder(order.id, {
              orderStatus: 'cancelled',
              paymentStatus: 'cancelled',
            });
            // Restore listing stock
            const db = await getDb();
            if (db) {
              const items = await db.select().from(marketplaceOrderItems).where(eq(marketplaceOrderItems.orderId, order.id));
              if (items.length > 0) {
                for (const item of items) {
                  await restoreListingStock(item.listingId, item.quantity ?? 1);
                }
              } else if (order.listingId) {
                await restoreListingStock(order.listingId, order.quantity ?? 1);
              }
              // Expire accepted offers linked to this order
              await db.update(offersTable)
                .set({ status: 'expired', updatedAt: new Date() })
                .where(and(eq(offersTable.orderId, order.id), eq(offersTable.status, 'accepted')))
                .catch(() => {});
            }
            cancelledCount++;
            console.log(`[Webhook:expired] Cancelled order ${cancelOrderNo} and restored stock`);
          } catch (cancelErr: any) {
            console.error(`[Webhook:expired] Failed to cancel order ${cancelOrderNo}:`, cancelErr.message);
          }
        }

        // Also update cartOrder if present
        const cartOrderId = session.metadata?.cart_order_id;
        if (cartOrderId) {
          try {
            const { updateCartOrder } = await import("../db");
            await updateCartOrder(parseInt(cartOrderId), { paymentStatus: 'failed' });
            console.log(`[Webhook:expired] cartOrder#${cartOrderId} marked as failed`);
          } catch (cartErr: any) {
            console.warn(`[Webhook:expired] Failed to update cartOrder#${cartOrderId}:`, cartErr.message);
          }
        }

        // Notify buyer
        if (buyerIdStr) {
          const buyerId = parseInt(buyerIdStr);
          let displayOrderNo = orderNo ?? '';
          if (orderNosToCancel.length > 0) displayOrderNo = orderNosToCancel[0];
          const batchNote = cancelledCount > 1 ? `（共 ${cancelledCount} 筆訂單）` : '';
          await createNotification({
            userId: buyerId,
            type: 'order',
            title: 'Stripe 結帳已過期，訂單已自動取消',
            body: `訂單 ${displayOrderNo ? `#${displayOrderNo} ` : ''}${batchNote}的 Stripe 結帳頁面已過期，訂單已自動取消，商品已重新上架。如需購買請重新下單。`,
            linkUrl: displayOrderNo ? `/orders?highlight=${displayOrderNo}` : '/orders',
            relatedId: null,
          }).catch(() => {});
          console.log(`[Webhook:expired] Notified buyer ${buyerId}, cancelled ${cancelledCount} orders`);
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log(`[Webhook] payment_intent.payment_failed: ${paymentIntent.id}`);
      } else if (event.type === "transfer.created" || event.type === "transfer.updated") {
        // Auto-sync payoutStatus when Stripe transfer is created/updated
        const transfer = event.data.object as any;
        const transferId = transfer.id as string;
        console.log(`[Webhook] ${event.type}: transferId=${transferId}, amount=${transfer.amount}, reversed=${transfer.reversed}`);
        try {
          const { getDb } = await import("../db");
          const { marketplaceOrders } = await import("../../drizzle/schema_new");
          const { eq } = await import("drizzle-orm");
          const db2 = await getDb();
          if (db2) {
            // Find order by stripeTransferId
            const [affectedOrder] = await db2.select().from(marketplaceOrders)
              .where(eq(marketplaceOrders.stripeTransferId, transferId))
              .limit(1);
            if (affectedOrder) {
              const newPayoutStatus = transfer.reversed ? 'failed' : 'paid';
              if (affectedOrder.payoutStatus !== newPayoutStatus) {
                await db2.update(marketplaceOrders)
                  .set({ payoutStatus: newPayoutStatus })
                  .where(eq(marketplaceOrders.id, affectedOrder.id));
                console.log(`[Webhook] Auto-synced payoutStatus for ${affectedOrder.orderNo}: ${affectedOrder.payoutStatus} -> ${newPayoutStatus}`);
                const { notifyOwner: _notifyOwner1 } = await import("./notification");
                if (newPayoutStatus === 'paid') {
                  _notifyOwner1({
                    title: `✅ Stripe 放款成功 — ${affectedOrder.orderNo}`,
                    content: `訂單 ${affectedOrder.orderNo} 的賣家放款已完成。\nTransfer ID: ${transferId}\n金額: HKD ${affectedOrder.sellerReceivableHkd ?? affectedOrder.subtotalHkd}`,
                  }).catch(() => {});
                } else {
                  _notifyOwner1({
                    title: `❌ Stripe 放款失敗 — ${affectedOrder.orderNo}`,
                    content: `訂單 ${affectedOrder.orderNo} 的 Stripe Transfer 已被撤回或失敗。\nTransfer ID: ${transferId}\n請前往放款管理手動處理。`,
                  }).catch(() => {});
                }
              }
            } else {
              console.log(`[Webhook] No order found for transferId=${transferId}, skipping payoutStatus sync`);
            }
          }
        } catch (syncErr: any) {
          console.error(`[Webhook] Error syncing payoutStatus for transfer ${transferId}:`, syncErr?.message);
        }
      } else if (event.type === "transfer.reversed") {
        // Transfer was reversed — mark payout as failed
        const reversal = event.data.object as any;
        const transferId = reversal.transfer as string;
        console.log(`[Webhook] transfer.reversed: transferId=${transferId}`);
        try {
          const { getDb } = await import("../db");
          const { marketplaceOrders } = await import("../../drizzle/schema_new");
          const { eq } = await import("drizzle-orm");
          const db2 = await getDb();
          if (db2) {
            const [affectedOrder] = await db2.select().from(marketplaceOrders)
              .where(eq(marketplaceOrders.stripeTransferId, transferId))
              .limit(1);
            if (affectedOrder && affectedOrder.payoutStatus !== 'failed') {
              await db2.update(marketplaceOrders)
                .set({ payoutStatus: 'failed' })
                .where(eq(marketplaceOrders.id, affectedOrder.id));
              console.log(`[Webhook] Marked payoutStatus=failed for ${affectedOrder.orderNo} due to transfer reversal`);
              const { notifyOwner: _notifyOwner2 } = await import("./notification");
              _notifyOwner2({
                title: `❌ Stripe 放款已撤回 — ${affectedOrder.orderNo}`,
                content: `訂單 ${affectedOrder.orderNo} 的 Stripe Transfer 已被撤回。\nTransfer ID: ${transferId}\n請前往放款管理重新處理。`,
              }).catch(() => {});
            }
          }
        } catch (syncErr: any) {
          console.error(`[Webhook] Error handling transfer.reversed for ${transferId}:`, syncErr?.message);
        }
      } else if (event.type === "account.updated") {
        // KYC / Stripe Connect onboarding status sync
        const account = event.data.object;
        const stripeConnectId = account.id;
        console.log(`[Webhook] account.updated: ${stripeConnectId}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`);
        const { getSellerProfileByStripeConnectId, updateSellerProfile } = await import("../db");
        const sellerProfile = await getSellerProfileByStripeConnectId(stripeConnectId);
        if (sellerProfile) {
          let newStatus: "pending" | "active" | "restricted" | "disabled";
          // Correctly classify disabled_reason:
          // - "under_review", "requirements.pending_verification" = still under review → pending
          // - "rejected.*" or "other" = truly disabled
          const disabledReason = account.requirements?.disabled_reason ?? null;
          const trulyDisabled = disabledReason && (
            disabledReason.startsWith('rejected.') ||
            disabledReason === 'other'
          );
          if (account.charges_enabled && account.payouts_enabled) {
            newStatus = "active";
          } else if (trulyDisabled) {
            newStatus = "disabled";
          } else if ((account.requirements?.pending_verification?.length ?? 0) > 0) {
            newStatus = "pending"; // under review by Stripe
          } else if ((account.requirements?.currently_due?.length ?? 0) > 0) {
            newStatus = "restricted";
          } else {
            newStatus = "pending";
          }
          const prevStatus = sellerProfile.stripeConnectStatus;
          await updateSellerProfile(sellerProfile.id, { stripeConnectStatus: newStatus });
          console.log(`[Webhook] Seller ${sellerProfile.id} stripeConnectStatus: ${prevStatus} -> ${newStatus}`);
          if (newStatus === "active" && prevStatus !== "active") {
            const { createNotification } = await import("../db/notifications");
            await createNotification({
              userId: sellerProfile.userId,
              type: "system",
              title: "Stripe 收款帳戶已啟用 ✅",
              body: "你的 Stripe Connect 帳戶已通過驗證並啟用，現在可以接收付款轉帳了。",

              linkUrl: "/seller",
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("[Webhook] Error processing event:", err);
    }
    res.json({ received: true });
  });

  // Configure body parser — 10MB for JSON (base64 image uploads for Alipay proof)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  // Manus OAuth removed
  
  // Google OAuth routes — apply auth rate limiter
  app.use("/api/auth", authLimiter, googleOAuthRouter);

  // Lightweight health check endpoint — used by KeepAlive Pinger in batch update tasks
  // to prevent Cloud Run idle shutdown during long-running background jobs.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Sitemap.xml route
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const sitemap = await generateSitemap();
      res.header("Content-Type", "application/xml");
      res.send(sitemap);
    } catch (error) {
      console.error("[Sitemap] Error generating sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });
  
  // Development environment scraper API (only available in development)
  if (process.env.NODE_ENV === "development") {
    const { verifyDevScraperAuth } = await import("../middleware/devScraperAuth");
    const { devScraperLimiter } = await import("../middleware/rateLimiter");
    const { scrapeSnkrdunkListings } = await import("../services/snkrdunkScraperService");

    // Health check endpoint
    app.get("/api/dev/health", (req, res) => {
      res.json({
        status: "healthy",
        playwrightReady: true,
        timestamp: new Date().toISOString()
      });
    });

    // Scrape endpoint
    app.post(
      "/api/dev/scrape",
      devScraperLimiter,
      verifyDevScraperAuth,
      async (req, res) => {
        const { snkrdunkId } = req.body;

        if (!snkrdunkId) {
          return res.status(400).json({
            success: false,
            error: "Missing snkrdunkId parameter"
          });
        }

        try {
          console.log(`[DevScraper] Scraping ${snkrdunkId}...`);
          const listings = await scrapeSnkrdunkListings(snkrdunkId);
          
          res.json({
            success: true,
            snkrdunkId,
            listings,
            scrapedAt: new Date().toISOString(),
            totalListings: listings.length
          });
        } catch (error: any) {
          console.error(`[DevScraper] Error scraping ${snkrdunkId}:`, error);
          res.status(500).json({
            success: false,
            error: error.message || "Scraping failed",
            snkrdunkId
          });
        }
      }
    );

    console.log("[DevScraper] Development scraper API enabled");

    // ── Dev mock login (DEVELOPMENT ONLY) ──────────────────────────────
    // Signs a JWT for a given user and sets the session cookie.
    // NEVER exposed in production (guarded by NODE_ENV === 'development').
    app.post("/api/dev/mock-login", async (req, res) => {
      try {
        const { getDb } = await import("../db");
        const { users } = await import("../../drizzle/schema_new");
        const { eq } = await import("drizzle-orm");
        const jwt = (await import("jsonwebtoken")).default;
        const { getSessionCookieOptions } = await import("./cookies");

        const db = await getDb();
        if (!db) return res.status(500).json({ error: "DB unavailable" });

        // Default to admin user (id=1); caller can pass { userId } to switch
        const targetId = Number(req.body?.userId) || 1;
        const userRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
        const user = userRows[0];
        if (!user) return res.status(404).json({ error: `User id=${targetId} not found` });

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "7d" } as any
        );

        res.cookie("session", token, getSessionCookieOptions(req));
        console.log(`[DevMockLogin] Logged in as ${user.email} (id=${user.id}, role=${user.role})`);
        return res.json({
          success: true,
          user: { id: user.id, email: user.email, name: user.name, role: user.role },
        });
      } catch (err: any) {
        console.error("[DevMockLogin] Error:", err);
        return res.status(500).json({ error: err.message });
      }
    });
    console.log("[DevMockLogin] Dev mock login enabled at POST /api/dev/mock-login");
  }

  // Blog image upload API
  const multer = (await import("multer")).default;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  
  app.post("/api/upload-blog-image", uploadLimiter, upload.single("file"), validateImageMime, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { processAndUploadMultiSizeImages } = await import("../imageProcessor");
      
      // Get file data from multer
      const fileBuffer = req.file.buffer;
      const originalFilename = req.file.originalname || 'image';
      
      // Process and upload multi-size images
      const urls = await processAndUploadMultiSizeImages(
        fileBuffer,
        'blog-images',
        originalFilename
      );
      
      // Return multi-size URLs (and also return medium URL as 'url' for backward compatibility)
      res.json({ url: urls.medium, urls });
    } catch (error) {
      console.error("[Blog] Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });
  // Marketplace listing image upload API (up to 5 images per listing, 10MB each)
  app.post("/api/upload-marketplace-image", uploadLimiter, upload.single("file"), validateImageMime, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const { processAndUploadMultiSizeImages } = await import("../imageProcessor");
      const fileBuffer = req.file.buffer;
      const originalFilename = req.file.originalname || "listing-image";
      const urls = await processAndUploadMultiSizeImages(
        fileBuffer,
        "marketplace-images",
        originalFilename
      );
      res.json({ url: urls.original ?? urls.medium, urls });
    } catch (error) {
      console.error("[Marketplace] Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Payment proof image upload API (for Alipay HK payment verification)
  app.post("/api/upload-payment-proof", uploadLimiter, upload.single("file"), validatePaymentProofMime, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileBuffer = req.file.buffer;
      const mimeType = req.file.mimetype || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      const key = `payment-proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { storagePut } = await import("../storage");
      const { url } = await storagePut(key, fileBuffer, mimeType);
      res.json({ url });
    } catch (error) {
      console.error("[PaymentProof] Error uploading proof:", error);
      res.status(500).json({ error: "Failed to upload payment proof" });
    }
  });

  // ─── OG Image Composer API: returns card image with BOXIUM logo watermark ────────
  app.get("/api/og-image/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId, 10);
      if (isNaN(cardId)) return res.redirect(getDefaultOgImageUrl());

      // Look up card image URL
      let cardImageUrl: string | null = null;
      const card = await getCardById(cardId);
      if (card) {
        cardImageUrl = card.imageUrl || null;
      } else {
        const sealed = await getSealedProductById(cardId);
        if (sealed) cardImageUrl = sealed.imageUrl || null;
      }

      if (!cardImageUrl) return res.redirect(getDefaultOgImageUrl());

      // Compose image with logo watermark
      const composed = await composeOgImage(cardImageUrl);
      if (!composed) return res.redirect(getDefaultOgImageUrl());

      // Cache for 1 hour (3600s)
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": composed.length.toString(),
      });
      res.status(200).end(composed);
    } catch (err) {
      console.error("[OG Image API] Error:", err);
      res.redirect(getDefaultOgImageUrl());
    }
  });

  // ─── OG Meta JSON API: for Cloudflare Workers edge-level OG injection ──────
  app.get("/api/og-meta/:cardId", async (req, res) => {
    try {
      const id = parseInt(req.params.cardId, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid card ID" });
      let name: string | null = null;
      let imageUrl: string | null = null;
      let description: string | null = null;
      const card = await getCardById(id);
      if (card) {
        name = card.name || null;
        imageUrl = card.imageUrl || null;
        description = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          name = sealed.name || null;
          imageUrl = sealed.imageUrl || null;
          description = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }
      if (!name) return res.status(404).json({ error: "Card not found" });
      // Get composed OG image with BOXIUM logo watermark (S3 cached)
      let ogImageUrl = getDefaultOgImageUrl();
      if (imageUrl) {
        const s3Url = await composeAndCacheOgImage(id, imageUrl);
        if (s3Url) ogImageUrl = s3Url;
      }
      res.set({
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      }).json({
        title: `${name} - BOXIUM PTCG`,
        description: description || `查看 ${name} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`,
        image: ogImageUrl,
        url: `https://boxium.asia/card/${id}`,
      });
    } catch (err) {
      console.error("[OG Meta API] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── Card Preview API: works in production (Express handles /api/* routes) ──
  // Share links point to /api/card-preview/:id which redirects to /card/:id
  // Crawlers (WhatsApp, Facebook, Telegram) see dynamic OG tags
  // Users get immediately redirected to the real card page
  app.get("/api/card-preview/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.redirect(`https://boxium.asia/`);

      let cardName: string | null = null;
      let cardImageUrl: string | null = null;
      let cardDesc: string | null = null;

      const card = await getCardById(id);
      if (card) {
        cardName = card.name || null;
        cardImageUrl = card.imageUrl || null;
        cardDesc = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          cardName = sealed.name || null;
          cardImageUrl = sealed.imageUrl || null;
          cardDesc = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }

      if (!cardName) return res.redirect(`https://boxium.asia/card/${id}`);

      // Get composed OG image with BOXIUM logo watermark (S3 cached)
      let ogImageUrl = getDefaultOgImageUrl();
      if (cardImageUrl) {
        const s3Url = await composeAndCacheOgImage(id, cardImageUrl);
        if (s3Url) ogImageUrl = s3Url;
      }

      const ogTitle = `${cardName} - BOXIUM PTCG`;
      const ogDescription = cardDesc || `查看 ${cardName} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`;
      const cardUrl = `https://boxium.asia/card/${id}`;
      const previewUrl = `https://boxium.asia/api/card-preview/${id}`;
      // Note: previewUrl is the canonical share URL; meta refresh + JS redirect send users to cardUrl

      // Return a minimal HTML page with OG tags + instant JS redirect
      // Crawlers read the OG tags; users are redirected to the real card page
      const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=${cardUrl}" />
  <title>${ogTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${previewUrl}" />
  <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="BOXIUM PTCG" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <link rel="canonical" href="${cardUrl}" />
</head>
<body>
  <script>window.location.replace("${cardUrl}");</script>
  <p>正在跳轉到卡牌頁面... <a href="${cardUrl}">點此前往</a></p>
</body>
</html>`;

      res.status(200).set({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      }).end(html);
    } catch (err) {
      console.error("[Card Preview API] Error:", err);
      res.redirect(`https://boxium.asia/card/${req.params.id}`);
    }
  });

  // ─── Share Preview: Marketplace listing (crawlers see OG tags, users get redirected) ──
  app.get("/api/marketplace-preview/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.redirect(`https://boxium.asia/marketplace`);

      const listing = await getListingById(id);
      if (!listing) return res.redirect(`https://boxium.asia/marketplace`);

      const price = parseFloat(listing.priceHkd as string);
      const rawImages = listing.images;
      let images: string[] | null = null;
      if (rawImages) {
        if (Array.isArray(rawImages)) images = rawImages as string[];
        else if (typeof rawImages === "string") {
          try { const p = JSON.parse(rawImages); images = Array.isArray(p) ? p : null; } catch {}
        }
      }
      // Use first listing image, or fall back to card image from associated card
      let imageUrl = images && images.length > 0 ? images[0] : null;
      if (!imageUrl && listing.cardId) {
        const card = await getCardById(listing.cardId);
        if (card?.imageUrl) imageUrl = card.imageUrl;
      }
      // Try to get/generate marketplace-specific OG image (card image + price badge + logo)
      let ogImage = imageUrl || getDefaultOgImageUrl();
      if (imageUrl) {
        const composedUrl = await composeAndCacheMarketplaceOgImage(
          id,
          imageUrl,
          listing.title as string,
          price,
          (listing.condition as string) || "mint"
        );
        if (composedUrl) ogImage = composedUrl;
      }

      const ogTitle = `${listing.title} - HKD ${price.toFixed(0)} | BOXIUM PTCG`;
      const ogDescription = listing.description
        ? `${(listing.description as string).slice(0, 120)}${(listing.description as string).length > 120 ? "..." : ""} | HKD ${price.toFixed(0)}`
        : `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(0)} | BOXIUM PTCG 卡牌商城`;
      const listingUrl = `https://boxium.asia/marketplace/${id}`;
      const previewUrl = `https://boxium.asia/api/marketplace-preview/${id}`;

      const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=${listingUrl}" />
  <title>${ogTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta property="og:type" content="product" />
  <meta property="og:url" content="${previewUrl}" />
  <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="BOXIUM PTCG" />
  <meta property="og:price:amount" content="${price.toFixed(2)}" />
  <meta property="og:price:currency" content="HKD" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
  <meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
  <meta name="twitter:image" content="${ogImage}" />
  <link rel="canonical" href="${listingUrl}" />
</head>
<body>
  <script>window.location.replace("${listingUrl}");</script>
  <p>正在跳轉到商品頁面... <a href="${listingUrl}">點此前往</a></p>
</body>
</html>`;

      res.status(200).set({
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      }).end(html);
    } catch (err) {
      console.error("[Marketplace Preview API] Error:", err);
      res.redirect(`https://boxium.asia/marketplace/${req.params.id}`);
    }
  });

  // ─── OG SSR: Card detail page for social crawlers ─────────────────────────
  app.get("/card/:id", async (req, res, next) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|semrushbot|ahrefsbot/.test(ua);
    if (!isCrawler) return next();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return next();
      // Try single card first, then sealed product
      let cardName: string | null = null;
      let cardImageUrl: string | null = null;
      let cardDesc: string | null = null;
      const card = await getCardById(id);
      if (card) {
        cardName = card.name || null;
        cardImageUrl = card.imageUrl || null;
        cardDesc = card.setName ? `${card.setName} | PSA 10 價格追蹤` : null;
      } else {
        const sealed = await getSealedProductById(id);
        if (sealed) {
          cardName = sealed.name || null;
          cardImageUrl = sealed.imageUrl || null;
          cardDesc = sealed.setName ? `${sealed.setName} | 卡盒價格追蹤` : null;
        }
      }
      if (!cardName) return next();
      // Use composed OG image with BOXIUM logo watermark, uploaded to S3 for stable URL
      // S3 URLs are permanent and accessible by all crawlers (WhatsApp, Facebook, etc.)
      let imageUrl = getDefaultOgImageUrl();
      if (cardImageUrl) {
        const s3Url = await composeAndCacheOgImage(id, cardImageUrl);
        if (s3Url) imageUrl = s3Url;
      }
      const ogTitle = `${cardName} - BOXIUM PTCG`;
      const ogDescription = cardDesc || `查看 ${cardName} 的最新 PSA 10 成交價格、價格趨勢與市場分析。`;
      const pageUrl = `https://boxium.asia/card/${id}`;
      let template: string;
      if (process.env.NODE_ENV === "development") {
        const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
        template = await fs.promises.readFile(clientTemplate, "utf-8");
      } else {
        const distTemplate = path.resolve(import.meta.dirname, "public", "index.html");
        template = await fs.promises.readFile(distTemplate, "utf-8");
      }
      const ogTags = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${pageUrl}" />`,
        `<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:image" content="${imageUrl}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:site_name" content="BOXIUM PTCG" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:image" content="${imageUrl}" />`,
        `<title>${ogTitle.replace(/<[^>]*>/g, '')}</title>`,
      ].join("\n    ");
      const injected = template
        .replace(/<title>[^<]*<\/title>/, '') // remove existing title
        .replace(/<meta\s+property="og:[^"]*"[^>]*\/>/g, '') // remove all og: meta tags
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/>/g, '') // remove all twitter: meta tags
        .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${ogTags}`);
      res.status(200).set({
        "Content-Type": "text/html",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Surrogate-Control": "no-store",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
      }).end(injected);
    } catch (err) {
      console.error("[OG SSR Card] Error:", err);
      next();
    }
  });

  // ─── OG SSR: Marketplace listing page for social crawlers ───────────────────
  app.get("/marketplace/:id", async (req, res, next) => {
    // Only intercept social media crawlers (bots that need SSR meta tags)
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isCrawler = /facebookexternalhit|facebot|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot|pinterest|vkshare|w3c_validator|embedly|quora|outbrain|semrushbot|ahrefsbot/.test(ua);
    if (!isCrawler) return next();

    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return next();

      const listing = await getListingById(id);
      if (!listing) return next();

      const price = parseFloat(listing.priceHkd as string);
      const rawImages = listing.images;
      let images: string[] | null = null;
      if (rawImages) {
        if (Array.isArray(rawImages)) images = rawImages as string[];
        else if (typeof rawImages === "string") {
          try { const p = JSON.parse(rawImages); images = Array.isArray(p) ? p : null; } catch {}
        }
      }
      const rawImageUrl = images && images.length > 0 ? images[0] : null;
      // Try to get/generate marketplace-specific OG image (card image + price badge + logo)
      let ogImageUrl = rawImageUrl || getDefaultOgImageUrl();
      if (rawImageUrl) {
        const composedUrl = await composeAndCacheMarketplaceOgImage(
          id,
          rawImageUrl,
          listing.title as string,
          price,
          (listing.condition as string) || "mint"
        );
        if (composedUrl) ogImageUrl = composedUrl;
      }
      const ogTitle = `${listing.title} - HKD ${price.toFixed(0)} | BOXIUM PTCG`;
      const ogDescription = listing.description
        ? `${(listing.description as string).slice(0, 120)}${(listing.description as string).length > 120 ? "..." : ""} | HKD ${price.toFixed(0)}`
        : `商品狀況：${listing.condition} | 價格：HKD ${price.toFixed(0)} | BOXIUM PTCG 卡牌商城`;
      const pageUrl = `https://boxium.asia/marketplace/${id}`;

      // Read the base HTML template
      let template: string;
      if (process.env.NODE_ENV === "development") {
        const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
        template = await fs.promises.readFile(clientTemplate, "utf-8");
      } else {
        const distTemplate = path.resolve(import.meta.dirname, "public", "index.html");
        template = await fs.promises.readFile(distTemplate, "utf-8");
      }

      // Inject dynamic OG meta tags
      const ogTags = [
        `<meta property="og:type" content="product" />`,
        `<meta property="og:url" content="${pageUrl}" />`,
        `<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:image" content="${ogImageUrl}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:site_name" content="BOXIUM PTCG" />`,
        `<meta property="og:price:amount" content="${price.toFixed(2)}" />`,
        `<meta property="og:price:currency" content="HKD" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:image" content="${ogImageUrl}" />`,
        `<title>${ogTitle.replace(/<[^>]*>/g, '')}</title>`,
      ].join("\n    ");

      // Replace the default OG tags in the template
      const injected = template
        .replace(/<title>[^<]*<\/title>/, '') // remove existing title
        .replace(/<meta\s+property="og:[^"]*"[^>]*\/>/g, '') // remove all og: meta tags
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/>/g, '') // remove all twitter: meta tags
        .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${ogTags}`);

      res.status(200).set({ "Content-Type": "text/html" }).end(injected);
    } catch (err) {
      console.error("[OG SSR] Error:", err);
      next();
    }
  });

  // Financial Report PDF Export
  app.get("/api/admin/financial-report-pdf", async (req, res) => {
    try {
      // Auth check: must be admin
      const { createContext } = await import("./context");
      const ctx = await createContext({ req, res } as any);
      if (!ctx.user || ctx.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const months = parseInt((req.query.months as string) || '12', 10);
      const { getSalesReport } = await import("../db");
      const { generateFinancialReportPdf } = await import("../services/financialPdfService");
      const report = await getSalesReport(Math.min(Math.max(months, 1), 36));
      const pdfBuffer = await generateFinancialReportPdf(report, months);
      const dateStr = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/pdf');
      const asciiFilename = `BOXIUM_Financial_Report_${dateStr}.pdf`;
      const utf8Filename = encodeURIComponent(`BOXIUM_財務報告_${dateStr}.pdf`);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
      res.send(pdfBuffer);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const errStack = err?.stack?.split('\n').slice(0, 5).join(' | ') || '';
      console.error('[PDF] Error generating financial report:', errMsg);
      console.error('[PDF] Stack:', errStack);
      res.status(500).json({ error: 'Failed to generate PDF', detail: errMsg });
    }
  });

  // ─── Card Inventory Export: PDF ────────────────────────────────────────────────
  app.get("/api/card-inventory/export/pdf", async (req, res) => {
    try {
      // Support both cookie auth and token auth
      const token = req.query.token as string | undefined;
      let authorized = false;
      let year = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);
      let month = parseInt((req.query.month as string) || '0', 10);
      if (token) {
        const { getDb } = await import("../db");
        const { exportJobs } = await import("../../drizzle/schema_new");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, token)).limit(1);
        if (job && job.type === 'pdf' && job.expiresAt && new Date(job.expiresAt) > new Date()) {
          authorized = true;
          year = job.year;
          month = job.month;
          await db.update(exportJobs).set({ status: 'processing' }).where(eq(exportJobs.id, token)).catch(() => {});
        }
      } else {
        const { createContext } = await import("./context");
        const ctx = await createContext({ req, res } as any);
        if (ctx.user && ctx.user.role === 'admin') authorized = true;
      }
      if (!authorized) return res.status(403).json({ error: 'Forbidden' });
      const { generateCardInventoryPdf } = await import("../services/cardInventoryExport");
      const pdfBuffer = await generateCardInventoryPdf(year, month);
      const label = month > 0 ? `${year}_${String(month).padStart(2,'0')}` : `${year}`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="BOXIUM_CardInventory_${label}.pdf"; filename*=UTF-8''${encodeURIComponent(`BOXIUM_卡牌買賣記錄_${label}.pdf`)}`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[CardInventory PDF] Error:', err?.message);
      res.status(500).json({ error: 'Failed to generate PDF', detail: err?.message });
    }
  });

  // ─── Card Inventory Export: Excel (token-based auth) ───────────────────────
  app.get("/api/card-inventory/export/excel", async (req, res) => {
    try {
      // Support both cookie auth and token auth
      const token = req.query.token as string | undefined;
      let authorized = false;
      let year = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);
      let month = parseInt((req.query.month as string) || '0', 10);
      if (token) {
        // Token-based auth: validate token from exportJobs table
        const { getDb } = await import("../db");
        const { exportJobs } = await import("../../drizzle/schema_new");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        const [job] = await db.select().from(exportJobs).where(eq(exportJobs.id, token)).limit(1);
        if (job && job.type === 'excel' && job.expiresAt && new Date(job.expiresAt) > new Date()) {
          authorized = true;
          year = job.year;
          month = job.month;
          // Mark token as used
          await db.update(exportJobs).set({ status: 'processing' }).where(eq(exportJobs.id, token)).catch(() => {});
        }
      } else {
        // Cookie-based auth fallback
        const { createContext } = await import("./context");
        const ctx = await createContext({ req, res } as any);
        if (ctx.user && ctx.user.role === 'admin') authorized = true;
      }
      if (!authorized) return res.status(403).json({ error: 'Forbidden' });
      const { generateCardInventoryExcel } = await import("../services/cardInventoryExport");
      const excelBuffer = await generateCardInventoryExcel(year, month);
      const label = month > 0 ? `${year}_${String(month).padStart(2,'0')}` : `${year}`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="BOXIUM_CardInventory_${label}.xlsx"; filename*=UTF-8''${encodeURIComponent(`BOXIUM_卡牌買賣記錄_${label}.xlsx`)}`);
      res.send(excelBuffer);
    } catch (err: any) {
      console.error('[CardInventory Excel] Error:', err?.message);
      res.status(500).json({ error: 'Failed to generate Excel', detail: err?.message });
    }
  });

  // ─── Scheduled Task Endpoint: GitHub Actions Batch Update Report ─────────────
  // Called by GitHub Actions after completing SNKRDUNK batch update
  // Auth: Bearer token via Authorization header (CRON_SECRET)
  // Writes a completed task record into scheduledTasks so it appears in Admin Task History
  app.post("/api/scheduled/github-batch-report", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!cronSecret || token !== cronSecret) {
        console.warn('[ScheduledTask] github-batch-report: invalid or missing CRON_SECRET token');
        return res.status(401).json({ error: 'Unauthorized: invalid cron token' });
      }

      const {
        totalItems = 0,
        successCount = 0,
        failureCount = 0,
        durationMs = 0,
        startedAt,
        status = 'completed',
        runId,
        runUrl,
      } = req.body || {};

      console.log(`[ScheduledTask] github-batch-report: total=${totalItems} success=${successCount} fail=${failureCount} duration=${durationMs}ms`);

      const { getDb } = await import('../db');
      const { scheduledTasks: scheduledTasksTable } = await import('../../drizzle/schema_new');
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: 'Database not available' });
      }

      const startTime = startedAt ? new Date(startedAt) : new Date(Date.now() - Number(durationMs));
      const endTime = new Date();
      const finalStatus = String(status) === 'failed' ? 'failed' : 'completed';

      await db.insert(scheduledTasksTable).values({
        taskType: 'batch_snkrdunk_update',
        status: finalStatus as 'completed' | 'failed',
        totalItems: Number(totalItems),
        processedItems: Number(totalItems),
        successCount: Number(successCount),
        failureCount: Number(failureCount),
        progress: 100,
        startedAt: startTime,
        completedAt: endTime,
        activeProcessingMs: Number(durationMs),
        metadata: JSON.stringify({
          source: 'github_actions',
          runId: runId || null,
          runUrl: runUrl || null,
          errors: [],
        }),
      });

      console.log(`[ScheduledTask] github-batch-report: task record inserted successfully (${finalStatus})`);
      return res.json({ success: true, insertedAt: endTime.toISOString() });
    } catch (err: any) {
      console.error('[ScheduledTask] github-batch-report failed:', err?.message);
      return res.status(500).json({ error: 'Failed to insert task record', detail: err?.message });
    }
  });

  // ─── Scheduled Task Endpoint: GitHub Actions Batch Update Progress (mid-run) ─────────────
  // Called by GitHub Actions periodically during SNKRDUNK batch update
  // Creates or updates a 'running' scheduledTask record so Admin can see live progress
  app.post("/api/scheduled/github-batch-progress", async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!cronSecret || token !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized: invalid cron token' });
      }
      const {
        runId,
        totalItems = 0,
        processedItems = 0,
        successCount = 0,
        failureCount = 0,
        startedAt,
        speedPerSec = 0,
        etaMinutes = 0,
      } = req.body || {};

      const { getDb } = await import('../db');
      const { scheduledTasks: scheduledTasksTable } = await import('../../drizzle/schema_new');
      const { eq, and } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return res.status(500).json({ error: 'Database not available' });

      const progress = Number(totalItems) > 0 ? Math.min(99, Math.round((Number(processedItems) / Number(totalItems)) * 100)) : 0;
      const startTime = startedAt ? new Date(startedAt) : new Date();
      const ghRunId = String(runId || '');

      // Find existing running task for this GitHub run
      const existing = await db.query.scheduledTasks.findFirst({
        where: and(
          eq(scheduledTasksTable.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasksTable.status, 'running')
        ),
        orderBy: (t: any, { desc }: any) => [desc(t.startedAt)],
      });

      if (existing) {
        await db.update(scheduledTasksTable)
          .set({
            totalItems: Number(totalItems),
            processedItems: Number(processedItems),
            successCount: Number(successCount),
            failureCount: Number(failureCount),
            progress,
            metadata: JSON.stringify({
              source: 'github_actions',
              runId: ghRunId,
              speedPerSec: Number(speedPerSec),
              etaMinutes: Number(etaMinutes),
              errors: [],
            }),
          })
          .where(eq(scheduledTasksTable.id, existing.id));
        console.log(`[ScheduledTask] github-batch-progress: updated task ${existing.id} (${processedItems}/${totalItems}, ${progress}%)`);
      } else {
        await db.insert(scheduledTasksTable).values({
          taskType: 'batch_snkrdunk_update',
          status: 'running',
          totalItems: Number(totalItems),
          processedItems: Number(processedItems),
          successCount: Number(successCount),
          failureCount: Number(failureCount),
          progress,
          startedAt: startTime,
          completedAt: null,
          activeProcessingMs: 0,
          metadata: JSON.stringify({
            source: 'github_actions',
            runId: ghRunId,
            speedPerSec: Number(speedPerSec),
            etaMinutes: Number(etaMinutes),
            errors: [],
          }),
        });
        console.log(`[ScheduledTask] github-batch-progress: created running task (${processedItems}/${totalItems}, ${progress}%)`);
      }
      return res.json({ success: true, progress });
    } catch (err: any) {
      console.error('[ScheduledTask] github-batch-progress failed:', err?.message);
      return res.status(500).json({ error: 'Failed to update progress', detail: err?.message });
    }
  });

  // tRPC API — apply path-based rate limiting
  app.use("/api/trpc", trpcRateLimitRouter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ error, type, path, input, ctx, req }) => {
        console.error(`[tRPC Error] ${type} at ${path}:`, error);
        
        // Send to Sentry
        if (process.env.SENTRY_DSN_BACKEND) {
          Sentry.captureException(error, {
            tags: {
              type: 'trpc_error',
              procedure_type: type,
            },
            contexts: {
              trpc: {
                path,
                input: JSON.stringify(input),
                user: ctx?.user?.email || 'anonymous',
              },
            },
          });
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ─── Manus Heartbeat KeepAlive endpoint ────────────────────────────────────
  // Called by Manus platform every 60s to keep Cloud Run instance warm.
  // This is the CORRECT way to prevent Cloud Run cold starts — external HTTP
  // pings from the platform, not in-process setInterval (which dies with the instance).
  app.post("/api/scheduled/keepalive", (req, res) => {
    res.json({ ok: true, ts: Date.now(), uptime: process.uptime() });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Recover stalled batch tasks from previous server instance, then auto-resume if eligible
    import('../batchTaskManager').then(({ recoverStalledTasks }) => {
      recoverStalledTasks(60).then(async result => { // 60 min: batch updates flush DB every 50 items, so 60 min is safe
        if (result.recoveredCount > 0) {
          console.log(`[Server] Recovered ${result.recoveredCount} stalled task(s) from previous instance`);
        }
        // Auto-resume: if a stalled task was just marked as failed, try to continue from where it left off
        try {
          const { autoResumeOnStartup } = await import('../persistentSnkrdunkBatchUpdate');
          await autoResumeOnStartup();
        } catch (resumeErr: any) {
          console.error('[Server] Auto-resume check failed:', resumeErr.message);
        }
      }).catch(err => {
        console.error('[Server] Failed to recover stalled tasks:', err);
      });
    }).catch(err => {
      console.error('[Server] Failed to import batchTaskManager:', err);
    });
    
    // Start the auto-update scheduler
    // startScheduler(); // Disabled: use priceUpdateScheduler instead
    // Start the price update scheduler
    initPriceUpdateScheduler().catch(err => {
      console.error('[Server] Failed to initialize price update scheduler:', err);
    });
    // Start the trending cards scheduler (daily at 06:00 HKT)
    startTrendingCardsScheduler();
    // Start the auto-complete orders scheduler (every hour)
    startAutoCompleteOrdersScheduler();
    // Start the shipping overdue reminder scheduler (every hour at :30)
    startShippingReminderScheduler();
    // Start the offer expiry reminder scheduler (every hour at :15)
    startOfferExpiryReminderScheduler();
    // Start the offer expiry cleanup scheduler (every hour at :45)
    startOfferExpiryCleanupScheduler();
    // Start the payment timeout cancel scheduler (every hour at :30)
    startPaymentTimeoutCancelScheduler();
    // Start the payment reminder scheduler (every hour at :45, reminds buyers 12h before auto-cancel)
    startPaymentReminderScheduler();
    // Start the hot card polling scheduler (every 30 minutes, updates top 100 most-viewed cards)
    // Start the cart expiry cleanup scheduler (daily at 03:00 HKT, removes 14-day-old cart items)
    startCartExpiryCleanupScheduler();
    // Start the Alipay review timeout reminder scheduler (every hour, notifies admin if proof pending >24hrs)
    startAlipayReviewReminderScheduler();
    // Start the cart expiry notification scheduler (daily at 10:00 HKT, notifies users 3 days before expiry)
    startCartExpiryNotificationScheduler();
    // Start the 7-day confirm receipt reminder scheduler (daily at 09:00 HKT)
    startConfirmReceiptReminderScheduler();
    // Start the meetup order auto-cancel scheduler (daily at 02:00 HKT, cancels unconfirmed meetup orders after 7 days)
    startMeetupAutoCancelScheduler();
    // Start the listing stock repair scheduler (daily at 04:00 HKT, fixes active listings with quantity=0)
    startListingStockRepairScheduler();
    // P2 Fix #8: Start the payout retry scheduler (every 2 hours, retries failed payouts)
    startPayoutRetryScheduler();
    // 48-hour cooling period payout scheduler (every hour, triggers payout after cooling period)
    startPayoutHoldScheduler();
    // P2 Fix #10: Start the dispute SLA escalation scheduler (every 4 hours)
    startDisputeSlaEscalationScheduler();
    // Start the dispute 3-day reminder scheduler (every 6 hours)
    startDispute3DayReminderScheduler();
    // Start the orphan auction order repair scheduler (every 2 hours)
    startOrphanAuctionRepairScheduler();
    // Start the PSA grading overdue payment reminder scheduler (daily at 10:00 HKT)
    startGradingOverdueReminderScheduler();
    // Start the PSA grading awaiting_payment cleanup scheduler (every hour at :10)
    startGradingAwaitingPaymentCleanupScheduler();
    // Start the PSA grading upgrade diff fee overdue reminder scheduler (daily at 11:00 HKT)
    startGradingUpgradeOverdueReminderScheduler();
    // Start the weekly blog report scheduler (every Monday at 08:00 HKT)
    startWeeklyBlogReportScheduler();
    // Start the scraperPerformanceLogs auto-cleanup scheduler (daily at 03:30 HKT, retains 10 days)
    startScraperPerformanceLogsCleanupScheduler();
    // NOTE: Cloud Run KeepAlive is handled by Manus Heartbeat (external HTTP cron).
    // The platform POSTs to /api/scheduled/keepalive every 60s from outside Cloud Run,
    // which is the ONLY reliable way to keep instances warm.
    // In-process setInterval does NOT survive Cloud Run instance termination.
    console.log('[KeepAlive] Using Manus Heartbeat external cron for Cloud Run warmup.');
    // Start the cache preloader service
    import('../services/cachePreloader').then(({ startCachePreloader }) => {
      startCachePreloader();
    }).catch(err => {
      console.error('[Server] Failed to start cache preloader:', err);
    });
    // Start auction lifecycle processors
    import('../auctionProcessor').then(({ processExpiredAuctions, processScheduledAuctions, notifyEndingSoon, processPaymentReminders }) => {
      // Process expired auctions every 30 seconds
      setInterval(() => processExpiredAuctions().catch(console.error), 30_000);
      // Activate scheduled auctions every 60 seconds
      setInterval(() => processScheduledAuctions().catch(console.error), 60_000);
      // Notify ending soon every 5 minutes
      setInterval(() => notifyEndingSoon().catch(console.error), 5 * 60_000);
      // Send 12-hour payment reminders every 30 minutes
      setInterval(() => processPaymentReminders().catch(console.error), 30 * 60_000);
      console.log('[Server] Auction processors started');
    }).catch(err => {
      console.error('[Server] Failed to start auction processors:', err);
    });
  });
}

startServer().catch(console.error);
