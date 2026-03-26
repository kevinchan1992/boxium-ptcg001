/**
 * Marketplace tRPC Router
 * Handles all marketplace operations: listings, orders, sellers, payouts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getPublicListings, getListingById, createListing, updateListing,
  getAdminListings, getSellerListings, getAdminListingDetail,
  getSellerProfileByUserId, getSellerProfileById, createSellerProfile, updateSellerProfile, getAllSellerProfiles, getAdminSellerDetail,
  createMarketplaceOrder, getMarketplaceOrderById, getMarketplaceOrderByNo, updateMarketplaceOrder, getBuyerOrders, getAdminOrders, getAlipayPendingOrders, generateOrderNo,
  createOrderItems, getOrderItems, getSellerOrderItems, getPlatformOrders,
  getSellerPayouts, getMarketplaceStats, getSalesReport, getAdminFeeDetails,
  getActiveBanners, getAllBanners, createBanner, updateBanner, deleteBanner,
  getUserWishlist, isInWishlist, addToWishlistListing, removeFromWishlistListing, getWishlistListingIds,
  getDisputedOrders, getSellerProfileByStripeConnectId,
  createReview, getSellerReviews, getReviewByOrderId,
  getUserShippingAddresses, getUserDefaultShippingAddress,
  createUserShippingAddress, updateUserShippingAddress,
  deleteUserShippingAddress, setDefaultShippingAddress,
  getDb,
  createOffer, getOfferById, getBuyerOffers, getSellerOffers, getListingOffers, updateOffer,
  createListingReport, getAdminListingReports, updateListingReport,
  getActiveOrderByListingId,
  reserveListingStock,
  restoreListingStock,
  getSystemSetting,
  // P1: Cart Orders (Master order)
  createCartOrder, getCartOrderById, getCartOrderByStripeSession, updateCartOrder,
  // Phase 5: Audit logs
  createAuditLog, getAuditLogs,
  // Maintenance mode
  isMarketplaceMaintenanceMode,
  isMarketplaceWhitelisted,
  getMarketplaceWhitelist,
  addMarketplaceWhitelist,
  removeMarketplaceWhitelist,
  setSystemSetting,
} from "../db";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { createNotification } from "../db/notifications";
import { sendEmail, buildSellerApprovedEmail, buildSellerRejectedEmail, buildNewOfferEmail, notifyAdmin, buildSellerSuspendedEmail, buildSellerUnsuspendedEmail } from "../emailService";
import { marketplaceListings, offers, listingReports, marketplaceOrders, sellerProfiles, users, orderStatusHistory, marketplaceSearchLogs, cartItems, adminAuditLogs } from "../../drizzle/schema_new";
import { eq, and, isNotNull, isNull, or, desc, sql, inArray, like } from 'drizzle-orm';
import Stripe from 'stripe';

// Shared Stripe instance — avoids 14+ redundant dynamic imports
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
}

// Platform fee rate default (5% for C2C listings only) — overridden by systemSettings.platform_fee_rate
const DEFAULT_PLATFORM_FEE_RATE = 0.05;
// Alipay HK static payment link
const ALIPAY_HK_STATIC_LINK = "https://w.alipay.hk/s12/3RYKWzGXrQ";

/**
 * Get the current platform fee rate from systemSettings.
 * Falls back to DEFAULT_PLATFORM_FEE_RATE (0.05) if not configured.
 */
async function getPlatformFeeRate(): Promise<number> {
  try {
    const setting = await getSystemSetting('platform_fee_rate');
    if (setting) {
      const rate = parseFloat(setting.settingValue);
      if (!isNaN(rate) && rate >= 0 && rate <= 1) return rate;
    }
  } catch {
    // Non-fatal: fall back to default
  }
  return DEFAULT_PLATFORM_FEE_RATE;
}

/**
 * Calculate platform fee for an order.
 * Platform-owned listings (sellerType='platform') are exempt from platform fees.
 * Only C2C listings (sellerType='seller') are charged the platform fee.
 */
function calcPlatformFeeWithRate(sellerType: string | null | undefined, amount: number, rate: number): number {
  return sellerType === 'seller' ? amount * rate : 0;
}
function calcSellerReceivableWithRate(sellerType: string | null | undefined, amount: number, rate: number): number {
  return amount - calcPlatformFeeWithRate(sellerType, amount, rate);
}

export const marketplaceRouter = router({
  // ============================================================
  // PUBLIC - Listings
  // ============================================================
  // ============================================================
  // PUBLIC - Hot Search Keywords
  // ============================================================
  logSearch: publicProcedure
    .input(z.object({
      keyword: z.string().min(1).max(200),
      tcgSeries: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { ok: false };
      await db.insert(marketplaceSearchLogs).values({
        keyword: input.keyword.trim().toLowerCase(),
        tcgSeries: input.tcgSeries ?? null,
        userId: ctx.user?.id ?? null,
      });
      return { ok: true };
    }),

  getHotKeywords: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(20).default(8),
      days: z.number().int().min(1).max(90).default(7),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          keyword: marketplaceSearchLogs.keyword,
          tcgSeries: marketplaceSearchLogs.tcgSeries,
          count: sql<number>`COUNT(*) as count`,
        })
        .from(marketplaceSearchLogs)
        .where(sql`${marketplaceSearchLogs.createdAt} >= ${since}`)
        .groupBy(marketplaceSearchLogs.keyword, marketplaceSearchLogs.tcgSeries)
        .orderBy(desc(sql`COUNT(*)`)) 
        .limit(input.limit);
      return rows;
    }),

  getListings: publicProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      search: z.string().optional(),
      condition: z.string().optional(),
      conditions: z.array(z.string()).optional(),
      sellerType: z.enum(["platform", "seller"]).optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      sortBy: z.enum(["newest", "price_asc", "price_desc"]).optional(),
      tcgSeries: z.enum(["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).optional(),
      cardIds: z.array(z.number().int()).optional(),
    }))
    .query(async ({ input }) => {
      return getPublicListings(input);
    }),

  getListing: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const listing = await getListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      // Increment view count
      await updateListing(input.id, { viewCount: (listing.viewCount ?? 0) + 1 });
      // Fetch seller profile if C2C listing
      let sellerProfile: { id: number; displayName: string; totalSales: number; ratingCount: number; avgRating: string | null; avatarUrl: string | null } | null = null;
      if (listing.sellerType === "seller" && listing.sellerId) {
        const sp = await getSellerProfileById(listing.sellerId);
        if (sp) sellerProfile = {
          id: sp.id,
          displayName: sp.displayName,
          totalSales: sp.totalSales ?? 0,
          ratingCount: sp.ratingCount ?? 0,
          avgRating: sp.avgRating ?? null,
          avatarUrl: sp.avatarUrl ?? null,
        };
      }
      // Check if listing is locked (has a pending_payment order)
      const activeOrder = listing.status === "active" ? await getActiveOrderByListingId(input.id) : null;
      const isLocked = !!activeOrder;
      return { ...listing, sellerProfile, isLocked };
    }),

  // ============================================================
  // PROTECTED - Buyer Actions
  // ============================================================
  createOrder: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      quantity: z.number().int().min(1).default(1),
      paymentMethod: z.enum(["stripe", "alipay_hk"]),
      shippingAddress: z.object({
        name: z.string(),
        phone: z.string(),
        address: z.string(),
        district: z.string().optional(),
        region: z.string().optional(),
        sfStationCode: z.string().optional(),
        sfStationName: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      if (listing.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "商品已下架或售出" });
      // Atomic stock reservation — prevents overselling under concurrent requests
      const reserved = await reserveListingStock(listing.id, input.quantity ?? 1);
      if (!reserved) throw new TRPCError({ code: "BAD_REQUEST", message: "庫存不足，商品可能已被其他買家搶購" });

      const price = parseFloat(listing.priceHkd as string);
      const subtotal = price * input.quantity;
      // Platform fee is deducted from seller's payout (buyer pays listing price only)
      const feeRate = await getPlatformFeeRate();
      const platformFee = calcPlatformFeeWithRate(listing.sellerType, subtotal, feeRate);
      const total = subtotal; // Buyer pays listing price only, no extra fees

      // P0: Payment method restriction — C2C seller items cannot use Alipay HK
      if (input.paymentMethod === "alipay_hk" && listing.sellerType === "seller") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "此商品為個人賣家商品，僅支援 Stripe 信用卡付款。支付寶 HK 僅適用於本公司自營商品。",
        });
      }
      // Stripe requires minimum HKD 4.00 for card payments
      if (input.paymentMethod === "stripe" && total < 4.00) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `此商品金額 HKD ${total.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00。`,
        });
      }

      const orderNo = await generateOrderNo();

      const order = await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        listingId: listing.id,
        sellerId: listing.sellerId ?? null,
        sellerType: listing.sellerType as any,
        unitPriceHkd: price.toFixed(2),
        quantity: input.quantity ?? 1,
        subtotalHkd: subtotal.toFixed(2),
        platformFeeRate: feeRate.toFixed(4),
        platformFeeHkd: platformFee.toFixed(2),
        sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, subtotal, feeRate).toFixed(2),
        shippingName: input.shippingAddress.name,
        shippingPhone: input.shippingAddress.phone,
        shippingAddress: JSON.stringify(input.shippingAddress),
        orderStatus: "pending_payment",
        autoCompleteAt: null as any,
      });

      if (!order) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "建立訂單失敗" });

      await createOrderItems([{
        orderId: order.id,
        listingId: listing.id,
        sellerId: listing.sellerId ?? undefined,
        sellerType: listing.sellerType,
        title: listing.title,
        price: listing.priceHkd as string,
        quantity: input.quantity ?? 1,
        payoutStatus: "pending",
      }]);

      // For Alipay HK, return static payment link + order info
      if (input.paymentMethod === "alipay_hk") {
        return {
          order,
          paymentMethod: "alipay_hk",
          alipayLink: ALIPAY_HK_STATIC_LINK,
          amount: total.toFixed(2),
          orderNo,
        };
      }

      // For Stripe, create Checkout Session
      const stripe = getStripe();
      const origin = (ctx.req.headers.origin as string) || "https://boxiumptcg-mua4eq38.manus.space";
      // Build payment_intent_data - use Destination Charge for C2C listings with active Stripe Connect
      const paymentIntentData: any = {
        metadata: {
          orderId: order.id.toString(),
          orderNo,
          buyerId: ctx.user.id.toString(),
          listingId: listing.id.toString(),
        },
      };
      // NOTE: We use Separate Charges and Transfers (NOT Destination Charge)
      // Funds stay in platform account until buyer confirms receipt (or 14-day auto-complete)
      // Transfer to seller happens in confirmReceipt / auto-complete cron job
      // No transfer_data or application_fee_amount here — platform keeps full amount until order completes
      if (listing.sellerType === "seller" && listing.sellerId) {
        const sellerProfile = await getSellerProfileById(listing.sellerId);
        if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus === "active") {
          console.log(`[Checkout] Separate Charges mode for seller ${sellerProfile.stripeConnectId}. Funds held in platform until buyer confirms receipt. Buyer pays HKD ${total.toFixed(2)}, seller will receive HKD ${(subtotal - platformFee).toFixed(2)} after order completes.`);
        }
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: { name: listing.title },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          orderId: order.id.toString(),
          orderNo,
          buyerId: ctx.user.id.toString(),
          listingId: listing.id.toString(),
        },
        payment_intent_data: paymentIntentData,
        success_url: `${origin}/orders?payment=success&orderNo=${orderNo}`,
        cancel_url: `${origin}/shop/${listing.id}?payment=cancelled`,
        allow_promotion_codes: true,
      });

      await updateMarketplaceOrder(order.id, {
        stripeSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      });

      return {
        order,
        paymentMethod: "stripe",
        checkoutUrl: session.url,
        orderNo,
      };
    }),

  getMyOrders: protectedProcedure
    .query(async ({ ctx }) => {
      return getBuyerOrders(ctx.user.id);
    }),

  getOrderDetails: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const items = await getOrderItems(input.orderId);
      return { order, items };
    }),

  // Get or create Stripe checkout URL for a pending_payment order
  getOrderCheckoutUrl: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "無權限" });
      if (order.orderStatus !== "pending_payment") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單不需要付款" });
      // If existing Stripe session is still valid, retrieve it
      if (order.stripeSessionId) {
        try {
          const stripe = getStripe();
          const existingSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
          if (existingSession.status === "open" && existingSession.url) {
            return { checkoutUrl: existingSession.url };
          }
        } catch (e) {
          console.warn("[getOrderCheckoutUrl] Failed to retrieve existing session:", e);
        }
      }
      // Create a new Stripe checkout session
      const listing = await getListingById(order.listingId!);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      const stripe = getStripe();
      const origin = (ctx.req.headers.origin as string) || "https://boxiumptcg-mua4eq38.manus.space";
      const totalHkd = parseFloat(order.subtotalHkd as string);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: { name: listing.title },
            unit_amount: Math.round(totalHkd * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          orderId: order.id.toString(),
          orderNo: order.orderNo,
          buyerId: ctx.user.id.toString(),
          listingId: (order.listingId ?? "").toString(),
        },
        payment_intent_data: {
          metadata: {
            orderId: order.id.toString(),
            orderNo: order.orderNo,
            buyerId: ctx.user.id.toString(),
          },
        },
        success_url: `${origin}/orders?payment=success&orderNo=${order.orderNo}`,
        cancel_url: `${origin}/orders`,
        allow_promotion_codes: true,
      });
      await updateMarketplaceOrder(order.id, { stripeSessionId: session.id });
      return { checkoutUrl: session.url! };
    }),

  // Switch a pending_payment order to Alipay HK and return payment link
  switchOrderPaymentToAlipay: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "無權限" });
      if (order.orderStatus !== "pending_payment") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單不需要付款" });
      // P0: Payment method restriction — C2C seller items cannot use Alipay HK
      if (order.sellerType === "seller") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "此訂單包含個人賣家商品，僅支援 Stripe 信用卡付款，無法切換為支付寶 HK。",
        });
      }
      // Cancel existing Stripe Checkout Session to prevent late payment on abandoned session
      if (order.stripeSessionId) {
        try {
          const stripe = getStripe();
          await stripe.checkout.sessions.expire(order.stripeSessionId);
          console.log(`[SwitchToAlipay] Expired Stripe session ${order.stripeSessionId} for order ${order.orderNo}`);
        } catch (expireErr: any) {
          // Session may already be expired or completed — safe to ignore
          console.warn(`[SwitchToAlipay] Failed to expire Stripe session: ${expireErr.message}`);
        }
      }
      await updateMarketplaceOrder(order.id, { paymentMethod: "alipay_hk" });
      const totalHkd = parseFloat(order.subtotalHkd as string);
      return {
        paymentMethod: "alipay_hk" as const,
        alipayLink: ALIPAY_HK_STATIC_LINK,
        amount: totalHkd.toFixed(2),
        orderNo: order.orderNo,
        orderId: order.id,
      };
    }),

  // Create checkout for accepted offer - supports Stripe or Alipay HK
  createOfferCheckout: protectedProcedure
    .input(z.object({
      offerId: z.number().int(),
      paymentMethod: z.enum(["stripe", "alipay_hk"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get offer and validate
      const offerRows = await getBuyerOffers(ctx.user.id);
      const offer = offerRows.find((o: any) => o.id === input.offerId);
      if (!offer) throw new TRPCError({ code: "NOT_FOUND", message: "出價不存在" });
      if (offer.status !== "accepted") throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未被接受" });
      if (!offer.orderId) throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未建立訂單" });

      const order = await getMarketplaceOrderById(offer.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "無權限" });
      if (order.orderStatus !== "pending_payment") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單已付款或不需要付款" });

      const totalHkd = parseFloat(order.subtotalHkd as string);

      // P0: Payment method restriction — C2C seller items cannot use Alipay HK
      if (input.paymentMethod === "alipay_hk" && order.sellerType === "seller") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "此商品為個人賣家商品，僅支援 Stripe 信用卡付款。支付寶 HK 僅適用於本公司自營商品。",
        });
      }

      // Alipay HK: update order payment method and return static link
      if (input.paymentMethod === "alipay_hk") {
        await updateMarketplaceOrder(order.id, { paymentMethod: "alipay_hk" });
        return {
          paymentMethod: "alipay_hk" as const,
          alipayLink: ALIPAY_HK_STATIC_LINK,
          amount: totalHkd.toFixed(2),
          orderNo: order.orderNo,
          orderId: order.id,
        };
      }

      // Stripe: validate minimum amount
      if (totalHkd < 4.00) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `此出價金額 HKD ${totalHkd.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00，請改用支付寶 HK 付款。`,
        });
      }

      // Stripe: update order payment method
      await updateMarketplaceOrder(order.id, { paymentMethod: "stripe" });

      // Reuse existing valid session
      if (order.stripeSessionId) {
        try {
          const stripe = getStripe();
          const existingSession = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
          if (existingSession.status === "open" && existingSession.url) {
            return { paymentMethod: "stripe" as const, checkoutUrl: existingSession.url };
          }
        } catch (e) {
          console.warn("[createOfferCheckout] Failed to retrieve existing session:", e);
        }
      }

      // Create new Stripe Checkout Session
      const listing = await getListingById(order.listingId!);
      const listingTitle = listing?.title ?? offer.listingTitle ?? "出價商品";
      const stripe = getStripe();
      const origin = (ctx.req.headers.origin as string) || "https://boxiumptcg-mua4eq38.manus.space";
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: { name: listingTitle },
            unit_amount: Math.round(totalHkd * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          orderId: order.id.toString(),
          orderNo: order.orderNo,
          buyerId: ctx.user.id.toString(),
          listingId: (order.listingId ?? "").toString(),
          offerId: input.offerId.toString(),
        },
        payment_intent_data: {
          metadata: {
            orderId: order.id.toString(),
            orderNo: order.orderNo,
            buyerId: ctx.user.id.toString(),
          },
        },
        success_url: `${origin}/orders?payment=success&orderNo=${order.orderNo}`,
        cancel_url: `${origin}/orders`,
        allow_promotion_codes: true,
      });
      await updateMarketplaceOrder(order.id, { stripeSessionId: session.id });
      return { paymentMethod: "stripe" as const, checkoutUrl: session.url! };
    }),

  // Submit Alipay HK proof screenshot
  submitAlipayProof: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      proofImageBase64: z.string(), // base64 image
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.paymentMethod !== "alipay_hk") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單不是支付寶 HK 付款" });
      if (order.orderStatus === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單已取消，無法上傳付款截圖" });
      if (order.paymentStatus === "paid") throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單已付款確認，無需重複上傳" });

      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const key = `alipay-proofs/${order.orderNo}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      // Save proof URL to database so it can be displayed in order detail page
      await updateMarketplaceOrder(input.orderId, { alipayProofImageUrl: url, alipayProofSubmittedAt: new Date(), alipayReviewReminderSentAt: null });
      // Notify owner that a new Alipay HK payment proof has been submitted
      notifyAdmin({
        title: "📸 新支付寶 HK 付款截圖待核對",
        content: `訂單 ${order.orderNo} 的買家已上傳支付寶 HK 付款截圖，請前往管理後台核對收款。\n金額：HKD ${order.subtotalHkd}\n前往核對：/admin/marketplace`,
      }).catch(() => {});
      // Auto-trigger AI verification in background (non-blocking)
      const autoVerifyOrder = { ...order, alipayProofImageUrl: url };
      setImmediate(async () => {
        try {
          const expectedAmount = parseFloat(autoVerifyOrder.subtotalHkd || '0').toFixed(2);
          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: `You are a payment verification assistant. Analyze the payment screenshot and compare it with the expected payment details. Return a JSON object with the following fields:\n- verified: boolean\n- detectedAmount: string or null\n- detectedPayee: string or null\n- detectedStatus: string or null\n- confidence: "high" | "medium" | "low"\n- reason: string (Traditional Chinese)\nExpected payment amount: HKD ${expectedAmount}\nExpected payee: BOXIUM or Boxium Limited\nReturn ONLY the JSON object, no other text`,
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url' as const, image_url: { url, detail: 'high' as const } },
                  { type: 'text' as const, text: `Verify AlipayHK payment. Expected: HKD ${expectedAmount}. Order: ${autoVerifyOrder.orderNo}.` },
                ],
              },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'alipay_verification',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    verified: { type: 'boolean' },
                    detectedAmount: { type: ['string', 'null'] },
                    detectedPayee: { type: ['string', 'null'] },
                    detectedStatus: { type: ['string', 'null'] },
                    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                    reason: { type: 'string' },
                  },
                  required: ['verified', 'detectedAmount', 'detectedPayee', 'detectedStatus', 'confidence', 'reason'],
                  additionalProperties: false,
                },
              },
            },
          });
          const rawContent609 = response.choices?.[0]?.message?.content;
          const content = typeof rawContent609 === 'string' ? rawContent609 : JSON.stringify(rawContent609 ?? {});
          let result: any;
          try { result = JSON.parse(content || '{}'); } catch { result = { verified: false, detectedAmount: null, detectedPayee: null, detectedStatus: null, confidence: 'low', reason: 'AI 回應解析失敗' }; }
          const db2 = await getDb();
          if (db2) {
            await db2.update(marketplaceOrders)
              .set({ aiVerificationResult: JSON.stringify(result) })
              .where(eq(marketplaceOrders.id, input.orderId));
          }
          // Notify admin of auto-verification result
          notifyAdmin({
            title: result.verified ? '✅ AI 核對通過 — 支付寶截圖' : '⚠️ AI 核對未通過 — 支付寶截圖',
            content: `訂單 ${autoVerifyOrder.orderNo}\n金額：HKD ${expectedAmount}\nAI 核對：${result.reason}\n信心度：${result.confidence}`,
          }).catch(() => {});
          console.log(`[Auto AI Verify] Order ${autoVerifyOrder.orderNo}: verified=${result.verified}, confidence=${result.confidence}`);
        } catch (err: any) {
          console.error('[Auto AI Verify] Error:', err?.message);
        }
      });
      return { success: true, proofUrl: url, aiVerificationPending: true };
    }),
  // Submit Alipay HK proof for multiple orders at once (batch cart checkout flow)
  submitBatchAlipayProof: protectedProcedure
    .input(z.object({
      orderNos: z.array(z.string()).min(1),
      proofImageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const key = `alipay-proofs/batch-${input.orderNos[0]}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const results: Array<{ orderNo: string; success: boolean; error?: string }> = [];
      for (const orderNo of input.orderNos) {
        try {
          const order = await getMarketplaceOrderByNo(orderNo);
          if (!order) { results.push({ orderNo, success: false, error: "\u8a02\u55ae\u4e0d\u5b58\u5728" }); continue; }
          if (order.buyerId !== ctx.user.id) { results.push({ orderNo, success: false, error: "\u7121\u6b0a\u9650" }); continue; }
          if (order.paymentMethod !== "alipay_hk") { results.push({ orderNo, success: false, error: "\u975e\u652f\u4ed8\u5bf6\u8a02\u55ae" }); continue; }
          if (order.orderStatus === "cancelled") { results.push({ orderNo, success: false, error: "\u8a02\u55ae\u5df2\u53d6\u6d88" }); continue; }
          if (order.paymentStatus === "paid") { results.push({ orderNo, success: false, error: "\u5df2\u4ed8\u6b3e\u78ba\u8a8d" }); continue; }
          await updateMarketplaceOrder(order.id, { alipayProofImageUrl: url, alipayProofSubmittedAt: new Date(), alipayReviewReminderSentAt: null, alipayProofStatus: 'pending_review' });
          results.push({ orderNo, success: true });
        } catch (err: any) {
          results.push({ orderNo, success: false, error: err?.message ?? "\u672a\u77e5\u932f\u8aa4" });
        }
      }
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        notifyAdmin({
          title: `\uD83D\uDCF8 \u652f\u4ed8\u5bf6 HK \u6279\u91cf\u622a\u5716\u5f85\u6838\u5c0d\uff08${successCount} \u7b46\uff09`,
          content: `\u8cb7\u5bb6\u5df2\u4e0a\u50b3 ${successCount} \u500b\u8a02\u55ae\u7684\u652f\u4ed8\u5bf6 HK \u4ed8\u6b3e\u622a\u5716\uff0c\u8acb\u524d\u5f80\u7ba1\u7406\u5f8c\u53f0\u6838\u5c0d\u6536\u6b3e\u3002\n\u8a02\u55ae\uff1a${input.orderNos.join("\u3001")}`,
        }).catch(() => {});
      }
      return { success: successCount > 0, proofUrl: url, results, successCount };
    }),
  // ============================================================
  // BUYER - Resubmit Alipay Proof (after rejection)
  // =============================================================
  resubmitAlipayProof: protectedProcedure
    .input(z.object({
      orderNo: z.string(),
      proofImageBase64: z.string(),
      mimeType: z.string().default('image/jpeg'),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderByNo(input.orderNo);
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN' });
      if (order.paymentMethod !== 'alipay_hk') throw new TRPCError({ code: 'BAD_REQUEST', message: '非支付寶訂單' });
      if (order.alipayProofStatus !== 'rejected') throw new TRPCError({ code: 'BAD_REQUEST', message: '只有被拒絕的截圖才能重新提交' });
      const { storagePut } = await import('../storage');
      const buffer = Buffer.from(input.proofImageBase64, 'base64');
      const key = `alipay-proofs/resubmit-${input.orderNo}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateMarketplaceOrder(order.id, {
        alipayProofImageUrl: url,
        alipayProofSubmittedAt: new Date(),
        alipayProofStatus: 'pending_review',
        paymentRejectionReason: null,
      });
      notifyAdmin({
        title: '重新提交截圖待核對',
        content: `買家已重新上傳訂單 ${input.orderNo} 的支付寶 HK 付款截圖，請前往管理後台核對收款。`,
      }).catch(() => {});
      return { success: true, proofUrl: url };
    }),
  // ============================================================
  // BUYER - Confirm Receipt + Trigger Payout
  // =============================================================
  confirmReceipt: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.orderStatus === "disputed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "訂單正在爭議中，無法確認收貨。請等待爭議處理完畢。" });
      }
      if (order.orderStatus !== "shipped" && order.orderStatus !== "delivered") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "訂單尚未出貨，無法確認收貨" });
      }
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "completed",
        buyerConfirmedAt: new Date(),
        payoutStatus: "processing",
      });
      // P2: Handle payout for C2C orders via executeSellerPayout (centralized logic)
      let sellerUserIdForNotify: number | null = null;
      if (order.sellerType === "seller" && order.sellerId) {
        const sellerProfile = await getSellerProfileById(order.sellerId);
        sellerUserIdForNotify = sellerProfile?.userId ?? null;
        try {
          const { executeSellerPayout } = await import("../sellerPayout");
          const payoutResult = await executeSellerPayout(input.orderId);
          if (payoutResult.success) {
            console.log(`[Payout] P2 Transfer ${payoutResult.transferId} (HKD ${payoutResult.amountHkd}) for order ${order.orderNo}`);
          } else {
            console.error(`[Payout] P2 failed for order ${order.orderNo}: ${payoutResult.error}`);
          }
        } catch (payoutErr: any) {
          console.error("[Payout] executeSellerPayout threw:", payoutErr.message);
        }
      }
      // Send completed email to buyer
      try {
        const { sendOrderEmail, buildOrderCompletedBuyerEmail, buildOrderCompletedSellerEmail, getOrderEmailData } = await import("../emailService");
        const emailData = await getOrderEmailData(order);
        const { subject: buyerSubject, html: buyerHtml } = buildOrderCompletedBuyerEmail({
          orderNo: order.orderNo,
          itemName: emailData.itemName,
          priceHkd: emailData.priceHkd,
        });
        await sendOrderEmail({ userId: order.buyerId, subject: buyerSubject, html: buyerHtml, emailType: 'order', dedupeKey: `order_completed_buyer_${order.id}` });
        // Send completed email to seller (C2C only) - use sellerProfile.userId, NOT order.sellerId
        if (order.sellerType === "seller" && sellerUserIdForNotify) {
          const { subject: sellerSubject, html: sellerHtml } = buildOrderCompletedSellerEmail({
            orderNo: order.orderNo,
            itemName: emailData.itemName,
            priceHkd: emailData.priceHkd,
            receivableHkd: emailData.receivableHkd,
          });
          await sendOrderEmail({ userId: sellerUserIdForNotify, subject: sellerSubject, html: sellerHtml, emailType: 'order', dedupeKey: `order_completed_seller_${order.id}` });
        }
      } catch (emailErr: any) {
        console.warn("[Order] Completed email failed:", emailErr.message);
      }
      return { success: true };
    }),

  // ============================================================
  // PROTECTED - Seller Actions
  // ============================================================
  getMySellerProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return getSellerProfileByUserId(ctx.user.id);
    }),

  applyAsSeller: protectedProcedure
    .input(z.object({
      displayName: z.string().min(2).max(100),
      bio: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getSellerProfileByUserId(ctx.user.id);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "你已申請成為賣家" });
      const profile = await createSellerProfile({
        userId: ctx.user.id,
        displayName: input.displayName,
        bio: input.bio,
        isActive: true, // Auto-approved: any user can sell
        stripeConnectStatus: "pending",
        totalSales: 0,
      });
      return profile;
    }),

  getMyListings: protectedProcedure
    .query(async ({ ctx }) => {
      const isAdmin = ctx.user.role === 'admin';
      if (isAdmin) {
        // Admin: return all platform official listings (sellerType = 'platform')
        const db = await getDb();
        if (!db) return [];
        const { marketplaceListings: ml } = await import("../../drizzle/schema_new");
        const { eq: eqFn, desc: descFn } = await import("drizzle-orm");
        return db.select().from(ml)
          .where(eqFn(ml.sellerType, 'platform'))
          .orderBy(descFn(ml.createdAt));
      }
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerListings(seller.id);
    }),

  createListing: protectedProcedure
    .input(z.object({
      title: z.string().min(3).max(200),
      description: z.string().max(2000).optional(),
      condition: z.enum(["psa10", "psa9", "psa8_below", "bgs10", "bgs9", "bgs8_below", "tag10", "tag9_below", "raw_a", "raw_b", "raw_c", "raw_d"]),
      price: z.number().min(4.00, "商品定價不能低於 HKD 4.00"),
      quantity: z.number().int().min(1).default(1),
      cardId: z.number().int().optional(),
      images: z.array(z.string()).max(5).optional(),
      minOfferHkd: z.number().min(4.00).optional(),
      allowOffers: z.boolean().default(false),
      tcgSeries: z.enum(["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).default("pokemon"),
    }))
    .mutation(async ({ ctx, input }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) throw new TRPCError({ code: "FORBIDDEN", message: "請先申請成為賣家" });
      if (!seller.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "賣家帳號尚未獲批准" });
      // RC2: Seller suspension check
      if ((seller as any).isSuspended) {
        throw new TRPCError({ code: "FORBIDDEN", message: `您的賣家帳號已被凍結，無法上架商品。原因：${(seller as any).suspensionReason || '請聯繫客服'}` });
      }
      if (seller.stripeConnectStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "請先完成 Stripe Connect 收款帳戶設定，才能上架商品" });

      // RC3: Duplicate listing check — same card + same condition by same seller
      if (input.cardId) {
        const existingListings = await getPublicListings({ sellerType: 'seller', pageSize: 100, page: 1 });
        const duplicate = existingListings.listings.find(
          (l: any) => l.cardId === input.cardId && l.condition === input.condition && ['active', 'pending_review'].includes(l.status)
        );
        if (duplicate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `您已有同一卡片同品相的上架商品「${duplicate.title}」，請編輯現有商品而非重複上架` });
        }
      }

      const listing = await createListing({
        sellerType: "seller",
        sellerId: seller.id,
        title: input.title,
        description: input.description,
        condition: input.condition,
        priceHkd: input.price.toFixed(2) as any,
        quantity: input.quantity,
        cardId: input.cardId,
        images: input.images ? JSON.stringify(input.images) : null,
        status: "pending_review",
        viewCount: 0,
        allowOffers: input.allowOffers,
        minOfferHkd: input.minOfferHkd ? input.minOfferHkd.toFixed(2) as any : null,
        tcgSeries: input.tcgSeries,
      });
      return listing;
    }),

  updateMyListing: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      title: z.string().min(3).max(200).optional(),
      description: z.string().max(2000).optional(),
      price: z.number().min(4.00, "商品定價不能低於 HKD 4.00").optional(),
      quantity: z.number().int().min(1).optional(),
      status: z.enum(["draft", "active", "removed"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller || listing.sellerId !== seller.id) throw new TRPCError({ code: "FORBIDDEN" });
      // 若試圖將商品狀態改為 active，需要驗證 Stripe Connect 已完成
      if (input.status === "active" && seller.stripeConnectStatus !== "active") {
        throw new TRPCError({ code: "FORBIDDEN", message: "請先完成 Stripe Connect 收款帳戶設定，才能上架商品" });
      }
      // Admin 下架的商品，賣家無法自行重新上架
      if (input.status === "active" && (listing as any).adminDelisted) {
        throw new TRPCError({ code: "FORBIDDEN", message: "此商品已被管理員下架，如有疑問請聯絡平台客服" });
      }
      const { id, ...updateData } = input;
      const updatePayload: Record<string, any> = { ...updateData };
      const oldPriceHkd = parseFloat(listing.priceHkd as string);
      if (updatePayload.price) {
        updatePayload.priceHkd = parseFloat(updatePayload.price).toFixed(2);
        delete updatePayload.price;
      }
      await updateListing(id, updatePayload);
      // 降價通知：如果價格降低，通知所有將此商品加入 Wishlist 的用戶
      if (updatePayload.priceHkd) {
        const newPrice = parseFloat(updatePayload.priceHkd);
        if (newPrice < oldPriceHkd) {
          try {
            const db = await getDb();
            if (db) {
              const { wishlists: wishlistsTable } = await import("../../drizzle/schema_new");
              const { eq: eqFn } = await import("drizzle-orm");
              const wishlistUsers = await db.select({ userId: wishlistsTable.userId }).from(wishlistsTable).where(eqFn(wishlistsTable.listingId, id));
              for (const wu of wishlistUsers) {
                await createNotification({
                  userId: wu.userId,
                  type: "trade",
                  title: "心願商品降價了！",
                  body: `「${listing.title}」價格已從 HKD ${oldPriceHkd.toFixed(2)} 降至 HKD ${newPrice.toFixed(2)}，快去看看！`,
                  linkUrl: `/shop/${id}`,
                  isRead: false,
                });
              }
            }
          } catch (e) {
            console.error("[Wishlist Price Alert] Failed to send notifications:", e);
          }
        }
      }
      return { success: true };
    }),

  deleteMyListing: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) throw new TRPCError({ code: "FORBIDDEN" });
      const listing = await getListingById(input.id);
      if (!listing || listing.sellerId !== seller.id) throw new TRPCError({ code: "FORBIDDEN" });
      await updateListing(input.id, { status: "removed" });
      return { success: true };
    }),

  // Batch deactivate (remove) multiple listings at once
  batchDeactivateListings: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Verify all listings belong to this seller
      const { marketplaceListings } = await import("../../drizzle/schema_new");
      const { eq: eqFn, inArray: inArrayFn } = await import("drizzle-orm");
      const listings = await db.select({ id: marketplaceListings.id, sellerId: marketplaceListings.sellerId })
        .from(marketplaceListings)
        .where(inArrayFn(marketplaceListings.id, input.ids));
      const unauthorized = listings.filter(l => l.sellerId !== seller.id);
      if (unauthorized.length > 0) throw new TRPCError({ code: "FORBIDDEN", message: "部分商品不屬於你" });
      // Batch update status to removed
      await db.update(marketplaceListings)
        .set({ status: "removed" })
        .where(inArrayFn(marketplaceListings.id, input.ids));
      return { success: true, count: input.ids.length };
    }),

  // Batch reactivate (active) multiple listings at once
  batchReactivateListings: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { marketplaceListings } = await import("../../drizzle/schema_new");
      const { eq: eqFn, inArray: inArrayFn } = await import("drizzle-orm");
      const listings = await db.select({ id: marketplaceListings.id, sellerId: marketplaceListings.sellerId, adminDelisted: marketplaceListings.adminDelisted })
        .from(marketplaceListings)
        .where(inArrayFn(marketplaceListings.id, input.ids));
      const unauthorized = listings.filter(l => l.sellerId !== seller.id);
      if (unauthorized.length > 0) throw new TRPCError({ code: "FORBIDDEN", message: "部分商品不屬於你" });
      // 過濾掉 Admin 下架的商品，賣家無法重新上架
      const adminDelistedIds = listings.filter(l => l.adminDelisted).map(l => l.id);
      const allowedIds = input.ids.filter(id => !adminDelistedIds.includes(id));
      if (allowedIds.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "這些商品已被管理員下架，無法重新上架" });
      }
      await db.update(marketplaceListings)
        .set({ status: "active" })
        .where(inArrayFn(marketplaceListings.id, allowedIds));
      return { success: true, count: allowedIds.length, skipped: adminDelistedIds.length };
    }),

  getMySellerOrders: protectedProcedure
    .query(async ({ ctx }) => {
      // Admin users see all platform orders (sellerType='platform')
      if (ctx.user.role === 'admin') {
        return getPlatformOrders();
      }
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerOrderItems(seller.id);
    }),

  // ============================================================
  // SELLER - Get Earnings Summary (completed orders)
  // ============================================================
  getSellerEarnings: protectedProcedure
    .query(async ({ ctx }) => {
      let orders: any[];
      if (ctx.user.role === 'admin') {
        orders = await getPlatformOrders();
      } else {
        const seller = await getSellerProfileByUserId(ctx.user.id);
        if (!seller) return {
          orders: [],
          summary: { totalRevenue: 0, totalFees: 0, totalEarnings: 0, completedCount: 0, pendingCount: 0 }
        };
        orders = await getSellerOrderItems(seller.id);
      }
      const completedOrders = orders.filter((o: any) => o.orderStatus === 'completed');
      const pendingOrders = orders.filter((o: any) =>
        ['processing', 'payment_received', 'paid_held', 'shipped'].includes(o.orderStatus)
      );
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.subtotalHkd ?? '0'), 0);
      const totalFees = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.platformFeeHkd ?? '0'), 0);
      const totalEarnings = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.sellerReceivableHkd ?? '0'), 0);
      return {
        orders: completedOrders,
        summary: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalFees: parseFloat(totalFees.toFixed(2)),
          totalEarnings: parseFloat(totalEarnings.toFixed(2)),
          completedCount: completedOrders.length,
          pendingCount: pendingOrders.length,
        }
      };
    }),

  // ============================================================
  // SELLER - Mark Order Shipped
  // ============================================================
  markOrderShipped: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      trackingNo: z.string().min(1, "追蹤號碼為必填"),
      shippingMethod: z.string().min(1, "物流公司為必填"),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      // Admin can ship platform orders (sellerType='platform', sellerId=null)
      if (ctx.user.role === 'admin' && order.sellerType === 'platform') {
        // Admin is allowed — skip seller profile check
      } else {
        // order.sellerId is sellerProfile.id, not user.id — must look up sellerProfile first
        const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
        if (!sellerProfile || order.sellerId !== sellerProfile.id) throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (!["processing", "payment_received", "paid_held"].includes(order.orderStatus)) throw new TRPCError({ code: "BAD_REQUEST", message: "訂單狀態不允許此操作" });
      // Set autoCompleteAt = 14 days from now
      const autoCompleteAt = new Date();
      autoCompleteAt.setDate(autoCompleteAt.getDate() + 14);
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "shipped",
        shippedAt: new Date(),
        trackingNumber: input.trackingNo ?? null,
        shippingMethod: (input.shippingMethod ?? null) as "sf_express" | "hongkong_post" | "other" | "sf_cod" | "meetup" | null,
        autoCompleteAt,
      });
      // Notify buyer of shipment
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "你的訂單已出貨 📦",
        body: `訂單 ${order.orderNo} 已出貨${input.trackingNo ? `，物流追蹤號：${input.trackingNo}` : ""}。如 14 天內未確認收貨，系統將自動完成訂單。`,
        linkUrl: "/orders",
      }).catch(err => console.warn("[Order] Failed to notify buyer of shipment:", err));
      // Send shipped email to buyer
      try {
        const { sendOrderEmail, buildOrderShippedEmail, getOrderEmailData } = await import("../emailService");
        const emailData = await getOrderEmailData(order);
        const { subject, html } = buildOrderShippedEmail({
          orderNo: order.orderNo,
          itemName: emailData.itemName,
          priceHkd: emailData.priceHkd,
          trackingNo: input.trackingNo,
        });
        await sendOrderEmail({ userId: order.buyerId, subject, html, emailType: 'order', dedupeKey: `order_shipped_buyer_${order.id}` });
      } catch (emailErr: any) {
        console.warn("[Order] Shipped email failed:", emailErr.message);
      }
      return { success: true };
    }),

  // ============================================================
  // SELLER - Confirm Meetup (skip shipped, directly complete)
  // ============================================================
  confirmMeetupOrder: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND' });
      // Only the seller of this order can confirm meetup
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (!sellerProfile || order.sellerId !== sellerProfile.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '只有賣家可以確認面交' });
      }
      // Only meetup orders in payment_received / paid_held / processing can be confirmed
      if (!['payment_received', 'paid_held', 'processing'].includes(order.orderStatus)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '訂單狀態不允許此操作' });
      }
      if (order.shippingMethod !== 'meetup') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '此訂單不是面交訂單' });
      }
      // Complete the order directly (skip shipped)
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: 'completed',
        buyerConfirmedAt: new Date(),
        payoutStatus: 'processing',
      });
      // P2: Handle payout for C2C meetup orders via executeSellerPayout (centralized logic)
      if (order.sellerType === 'seller' && order.sellerId) {
        try {
          const { executeSellerPayout } = await import('../sellerPayout');
          const payoutResult = await executeSellerPayout(input.orderId);
          if (payoutResult.success) {
            console.log(`[Payout] P2 Meetup Transfer ${payoutResult.transferId} (HKD ${payoutResult.amountHkd}) for order ${order.orderNo}`);
          } else {
            console.error(`[Payout] P2 Meetup payout failed for order ${order.orderNo}: ${payoutResult.error}`);
          }
        } catch (payoutErr: any) {
          console.error('[Payout] executeSellerPayout (meetup) threw:', payoutErr.message);
        }
      }
      // Notify buyer that order is completed
      await createNotification({
        userId: order.buyerId,
        type: 'trade',
        title: '面交訂單已完成 🎉',
        body: `訂單 ${order.orderNo} 賣家已確認面交完成，感謝您的支持！`,
        linkUrl: '/orders',
      }).catch(() => {});
      // Send completed emails
      try {
        const { sendOrderEmail, buildOrderCompletedBuyerEmail, buildOrderCompletedSellerEmail, getOrderEmailData } = await import('../emailService');
        const emailData = await getOrderEmailData(order);
        const { subject: bs, html: bh } = buildOrderCompletedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
        await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `order_completed_buyer_${order.id}` });
        const { subject: ss, html: sh } = buildOrderCompletedSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, receivableHkd: emailData.receivableHkd });
        await sendOrderEmail({ userId: sellerProfile.userId, subject: ss, html: sh, emailType: 'order', dedupeKey: `order_completed_seller_${order.id}` });
      } catch (emailErr: any) {
        console.warn('[Order] Meetup completed email failed:', emailErr.message);
      }
      return { success: true };
    }),

  // ============================================================
  // SELLER - Stripe Connect Onboarding
  // ============================================================
  startStripeConnectOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "賣家資料不存在" });
      const stripe = getStripe();
      let connectId = profile.stripeConnectId;
      try {
        if (!connectId) {
          const account = await stripe.accounts.create({
            type: "express",
            country: "HK",
            email: ctx.user.email ?? undefined,
            capabilities: { transfers: { requested: true } },
          });
          connectId = account.id;
          await updateSellerProfile(profile.id, { stripeConnectId: connectId, stripeConnectStatus: "pending" });
        }
        const accountLink = await stripe.accountLinks.create({
          account: connectId,
          refresh_url: `${ctx.req.headers.origin}/seller?stripe=refresh`,
          return_url: `${ctx.req.headers.origin}/seller?stripe=success`,
          type: "account_onboarding",
        });
        return { onboardingUrl: accountLink.url, connectEnabled: true };
      } catch (err: any) {
        // Stripe Connect not enabled on this account - redirect to Stripe Connect signup
        if (err?.raw?.code === 'account_invalid' || err?.message?.includes('Connect') || err?.message?.includes('signed up for Connect')) {
          return {
            onboardingUrl: "https://dashboard.stripe.com/connect",
            connectEnabled: false,
            message: "請先在 Stripe Dashboard 開通 Connect 功能，然後再返回設定收款帳戶。",
          };
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message ?? "Stripe 連接失敗" });
      }
    }),

  // ============================================================
  // SELLER - Sync Stripe Connect Status
  // ============================================================
  syncStripeConnectStatus: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile || !profile.stripeConnectId) return { status: profile?.stripeConnectStatus ?? "pending" };
      const stripe = getStripe();
      try {
        const account = await stripe.accounts.retrieve(profile.stripeConnectId);
        // Correctly classify disabled_reason:
        // - "under_review", "requirements.pending_verification" = still under review → pending
        // - "rejected.*" = truly disabled
        const disabledReason = account.requirements?.disabled_reason ?? null;
        const trulyDisabled = disabledReason && (
          disabledReason.startsWith('rejected.') ||
          disabledReason === 'other'
        );
        const newStatus: "pending" | "active" | "restricted" | "disabled" =
          account.charges_enabled && account.payouts_enabled ? "active" :
          trulyDisabled ? "disabled" :
          (account.requirements?.pending_verification?.length ?? 0) > 0 ? "pending" :
          (account.requirements?.currently_due?.length ?? 0) > 0 ? "restricted" : "pending";
        console.log(`[StripeSync] account ${account.id}: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, disabled_reason=${disabledReason}, currently_due=${account.requirements?.currently_due?.length ?? 0}, pending_verification=${account.requirements?.pending_verification?.length ?? 0} → ${newStatus}`);
        if (newStatus !== profile.stripeConnectStatus) {
          await updateSellerProfile(profile.id, { stripeConnectStatus: newStatus });
          console.log(`[StripeSync] Seller ${profile.id} status: ${profile.stripeConnectStatus} -> ${newStatus}`);
        }
        return { status: newStatus };
      } catch (err: any) {
        console.error(`[StripeSync] Failed to sync seller ${profile.id}:`, err?.message);
        return { status: profile.stripeConnectStatus };
      }
    }),

  // ============================================================
  // SELLER - Stripe Express Dashboard Login Link
  // ============================================================
  getStripeExpressDashboardLink: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "賣家資料不存在" });
      if (!profile.stripeConnectId) throw new TRPCError({ code: "BAD_REQUEST", message: "尚未設定 Stripe 收款帳戶" });
      const stripe = getStripe();
      try {
        const loginLink = await stripe.accounts.createLoginLink(profile.stripeConnectId);
        return { url: loginLink.url };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message ?? "無法生成 Stripe Dashboard 連結" });
      }
    }),

  // ============================================================
  // ADMIN - Marketplace Management
  // ============================================================
  adminGetStats: adminProcedure
    .query(async () => {
      return getMarketplaceStats();
    }),

  adminGetSalesReport: adminProcedure
    .input(z.object({ months: z.number().int().min(1).max(36).default(12) }))
    .query(async ({ input }) => {
      return getSalesReport(input.months);
    }),

  adminGetFeeDetails: adminProcedure
    .input(z.object({
      yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return getAdminFeeDetails(input.yearMonth, input.page, input.pageSize);
    }),

  adminGetListings: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
      tcgSeries: z.enum(["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).optional(),
    }))
    .query(async ({ input }) => {
      return getAdminListings(input.page, input.pageSize, input.status, input.tcgSeries);
    }),

  adminGetListingDetail: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const detail = await getAdminListingDetail(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      return detail;
    }),

  adminCreatePlatformListing: adminProcedure
    .input(z.object({
      title: z.string().min(3).max(200),
      description: z.string().max(2000).optional(),
      condition: z.enum(["psa10", "psa9", "psa8_below", "bgs10", "bgs9", "bgs8_below", "tag10", "tag9_below", "raw_a", "raw_b", "raw_c", "raw_d"]),
      price: z.number().positive(),
      quantity: z.number().int().min(1).default(1),
      cardId: z.number().int().optional(),
      images: z.array(z.string()).max(5).optional(),
      status: z.enum(["draft", "active"]).default("active"),
      allowOffers: z.boolean().default(false),
      minOfferHkd: z.number().min(4).optional(),
      tcgSeries: z.enum(["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).default("pokemon"),
    }))
    .mutation(async ({ input }) => {
      const listing = await createListing({
        sellerType: "platform",
        title: input.title,
        description: input.description,
        condition: input.condition,
        priceHkd: input.price.toFixed(2) as any,
        quantity: input.quantity,
        cardId: input.cardId,
        images: input.images ? JSON.stringify(input.images) : null,
        status: input.status,
        allowOffers: input.allowOffers,
        minOfferHkd: input.minOfferHkd ? input.minOfferHkd.toFixed(2) as any : null,
        viewCount: 0,
        tcgSeries: input.tcgSeries,
      });
      return listing;
    }),

  adminUpdateListing: adminProcedure
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["draft", "pending_review", "active", "reserved", "sold", "removed"]).optional(),
      price: z.number().positive().optional(),
      quantity: z.number().int().min(0).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      rejectedReason: z.string().max(500).optional(),
      tcgSeries: z.enum(["pokemon", "onepiece", "yugioh", "dragonball", "mtg", "other"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, rejectedReason, ...data } = input;
      const updatePayload: Record<string, any> = { ...data };
      if (updatePayload.price) {
        updatePayload.priceHkd = parseFloat(updatePayload.price).toFixed(2);
        delete updatePayload.price;
      }
      if (rejectedReason) updatePayload.rejectedReason = rejectedReason;
      // Admin 下架時設 adminDelisted=true，防止賣家自行重新上架
      if (data.status === 'removed') {
        updatePayload.adminDelisted = true;
      } else if (data.status === 'active') {
        // Admin 手動重新上架時清除 adminDelisted 標記
        updatePayload.adminDelisted = false;
      }
      // Fetch listing before update to detect status change
      const prevListing = await getListingById(id);
      await updateListing(id, updatePayload);
      // Send notification when status changes to active (approved) or removed (rejected)
      if (prevListing && data.status && data.status !== prevListing.status) {
        if (prevListing.sellerType === "seller" && prevListing.sellerId) {
          const sellerProfile = await getSellerProfileById(prevListing.sellerId);
          if (sellerProfile?.userId) {
            if (data.status === "active") {
              await createNotification({
                userId: sellerProfile.userId,
                type: "trade",
                title: "商品審核通過 ✅",
                body: `您的商品「${prevListing.title}」已通過審核，現已上架！`,
                linkUrl: `/marketplace/${id}`,
              }).catch(() => {});
            } else if (data.status === "removed") {
              await createNotification({
                userId: sellerProfile.userId,
                type: "trade",
                title: "商品審核未通過 ❌",
                body: `您的商品「${prevListing.title}」審核未通過。${rejectedReason ? `原因：${rejectedReason}` : "請修改後重新提交。"}`,
                linkUrl: `/seller`,
              }).catch(() => {});
            }
          }
        }
      }
      return { success: true };
    }),

  adminGetOrders: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
      sellerType: z.enum(['all', 'platform', 'seller']).default('all'),
      dateFrom: z.string().optional(), // YYYY-MM-DD
      dateTo: z.string().optional(),   // YYYY-MM-DD
      payoutFilter: z.string().optional(), // 'pending_alipay' for unpaid alipay orders
      listingId: z.number().int().optional(), // filter by specific listing
      proofStatus: z.string().optional(), // 'pending_review' | 'approved' | 'rejected'
    }))
    .query(async ({ input }) => {
      return getAdminOrders(input.page, input.pageSize, input.status, input.sellerType === 'all' ? undefined : input.sellerType, input.dateFrom, input.dateTo, input.payoutFilter, input.listingId, input.proofStatus);
    }),

  // Fix historical platform order fees (set platformFeeHkd=0, sellerReceivableHkd=subtotalHkd for all platform orders)
  adminFixPlatformOrderFees: adminProcedure
    .mutation(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      const { sql: drizzleSql } = await import('drizzle-orm');
      const { marketplaceOrders } = await import('../../drizzle/schema_new');
      // Find all platform orders with incorrect fees
      const platformOrders = await db.select({
        id: marketplaceOrders.id,
        orderNo: marketplaceOrders.orderNo,
        subtotalHkd: marketplaceOrders.subtotalHkd,
        platformFeeHkd: marketplaceOrders.platformFeeHkd,
        sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
      }).from(marketplaceOrders)
        .where(and(
          eq(marketplaceOrders.sellerType, 'platform' as any),
          drizzleSql`${marketplaceOrders.platformFeeHkd} != '0.00'`
        ));
      if (platformOrders.length === 0) {
        return { fixed: 0, message: '所有平台訂單手續費已正確，無需修復' };
      }
      // Fix each order: set platformFeeHkd=0, sellerReceivableHkd=subtotalHkd
      let fixedCount = 0;
      for (const order of platformOrders) {
        await db.update(marketplaceOrders)
          .set({
            platformFeeHkd: '0.00',
            sellerReceivableHkd: order.subtotalHkd,
            platformFeeRate: '0.0000',
          })
          .where(eq(marketplaceOrders.id, order.id));
        fixedCount++;
      }
      console.log(`[AdminFix] Fixed ${fixedCount} platform orders with incorrect fees`);
      return { fixed: fixedCount, message: `已修復 ${fixedCount} 筆平台訂單的手續費記錄` };
    }),

  adminGetAlipayPending: adminProcedure
    .input(z.object({
      dateFilter: z.enum(['all', 'today', 'week', 'month']).optional().default('all'),
    }).optional())
    .query(async ({ input }) => {
      return getAlipayPendingOrders(input?.dateFilter ?? 'all');
    }),

  adminGetOffers: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { users, marketplaceListings: listings } = await import('../../drizzle/schema_new');
      const { desc, count: drizzleCount } = await import('drizzle-orm');
      const offset = (input.page - 1) * input.pageSize;
      const whereClause = input.status ? eq(offers.status, input.status as any) : undefined;
      const [totalResult, rows] = await Promise.all([
        db.select({ count: drizzleCount() }).from(offers).where(whereClause),
        db.select({
          id: offers.id,
          status: offers.status,
          offerPriceHkd: offers.offerPriceHkd,
          message: offers.message,
          expiresAt: offers.expiresAt,
          createdAt: offers.createdAt,
          listingId: offers.listingId,
          listingTitle: listings.title,
          listingPriceHkd: listings.priceHkd,
          listingImages: listings.images,
          buyerId: offers.buyerId,
          buyerName: users.name,
          buyerEmail: users.email,
        })
          .from(offers)
          .leftJoin(listings, eq(offers.listingId, listings.id))
          .leftJoin(users, eq(offers.buyerId, users.id))
          .where(whereClause)
          .orderBy(desc(offers.createdAt))
          .limit(input.pageSize)
          .offset(offset),
      ]);
      return { offers: rows, total: totalResult[0]?.count ?? 0 };
    }),

  adminConfirmAlipayPayment: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      await updateMarketplaceOrder(input.orderId, {
        paymentStatus: "paid",
        orderStatus: "payment_received",
        alipayProofStatus: "approved",
      });
      // Mark listing as sold
      if (order.listingId) {
        await updateListing(order.listingId, { status: "sold" });
      }
      // Notify buyer of payment confirmation
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "支付寶 HK 收款已確認 ✅",
        body: `訂單 ${order.orderNo} 的支付寶 HK 付款已由管理員確認，訂單現在進入處理中。${input.note ? `備註：${input.note}` : ""}`,
        linkUrl: `/orders/${order.orderNo}`,
      }).catch(() => {});
       // Notify seller of new order (use sellerProfile.userId, NOT order.sellerId)
      if (order.sellerId) {
        const sellerProf = await getSellerProfileById(order.sellerId);
        if (sellerProf?.userId) {
          await createNotification({
            userId: sellerProf.userId,
            type: "trade",
            title: "新訂單已付款 🎉",
            body: `訂單 ${order.orderNo} 買家已完成付款，請盡快安排出貨。`,
            linkUrl: "/seller",
          }).catch(() => {});
          // Email seller: new order paid (Alipay)
          try {
            const { sendOrderEmail, buildOrderPaymentReceivedSellerEmail, getOrderEmailData } = await import("../emailService");
            const emailData = await getOrderEmailData(order);
            const { subject: ss, html: sh } = buildOrderPaymentReceivedSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, listingId: order.listingId ?? undefined });
            await sendOrderEmail({ userId: sellerProf.userId, subject: ss, html: sh, emailType: 'order', dedupeKey: `order_paid_seller_${order.id}` });
          } catch (e: any) { console.warn("[adminConfirmAlipay] seller email failed:", e.message); }
        }
      }
      // Email buyer: payment confirmed (Alipay)
      try {
        const { sendOrderEmail, buildOrderPaymentReceivedBuyerEmail, getOrderEmailData } = await import("../emailService");
        const emailData = await getOrderEmailData(order);
        const { subject: bs, html: bh } = buildOrderPaymentReceivedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, listingId: order.listingId ?? undefined });
        await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `order_paid_buyer_${order.id}` });
      } catch (e: any) { console.warn("[adminConfirmAlipay] buyer email failed:", e.message); }
      // AT1: Audit log
      await createAuditLog({ adminId: ctx.user.id, action: 'confirm_alipay', targetType: 'order', targetId: input.orderId, details: JSON.stringify({ orderNo: order.orderNo, note: input.note }) });
      return { success: true };
    }),
  adminBatchConfirmAlipayPayment: adminProcedure
    .input(z.object({
      orderIds: z.array(z.number().int()).min(1).max(50),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const results: { orderId: number; success: boolean; error?: string }[] = [];
      for (const orderId of input.orderIds) {
        try {
          const order = await getMarketplaceOrderById(orderId);
          if (!order) { results.push({ orderId, success: false, error: "訂單不存在" }); continue; }
          await updateMarketplaceOrder(orderId, {
            paymentStatus: "paid",
            orderStatus: "payment_received",
          });
          // Mark listing as sold
          if (order.listingId) {
            await updateListing(order.listingId, { status: "sold" });
          }
          // Notify buyer of payment confirmation
          await createNotification({
            userId: order.buyerId,
            type: "trade",
            title: "支付寶 HK 收款已確認 ✅",
            body: `訂單 ${order.orderNo} 的支付寶 HK 付款已由管理員確認，訂單現在進入處理中。${input.note ? `備註：${input.note}` : ""}`,
            linkUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          // Notify seller of new order (use sellerProfile.userId, NOT order.sellerId)
          if (order.sellerId) {
            const batchSellerProf = await getSellerProfileById(order.sellerId);
            if (batchSellerProf?.userId) {
              await createNotification({
                userId: batchSellerProf.userId,
                type: "trade",
                title: "新訂單已付款 🎉",
                body: `訂單 ${order.orderNo} 買家已完成支付寶 HK 付款，請盡快安排出貨。`,
                linkUrl: "/seller",
              }).catch(() => {});
            }
          }
          results.push({ orderId, success: true });
        } catch (err: any) {
          results.push({ orderId, success: false, error: err.message });
        }
      }
      const successCount = results.filter(r => r.success).length;
      return { results, successCount, failCount: results.length - successCount };
    }),

  adminRejectAlipayPayment: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      reason: z.string().min(1, "請填寫拒絕原因"),
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      // Reset order back to pending_payment, clear proof, save rejection reason
      await updateMarketplaceOrder(input.orderId, {
        paymentStatus: "pending",
        orderStatus: "pending_payment",
        alipayProofImageUrl: null,
        aiVerificationResult: null,
        paymentRejectionReason: input.reason,
        alipayProofStatus: "rejected",
      });
      // Notify buyer of rejection with reason
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "支付寶 HK 付款截圖未通過審核 ❌",
        body: `訂單 ${order.orderNo} 的付款截圖未通過審核，請重新上傳正確截圖。原因：${input.reason}`,
        linkUrl: `/orders/${order.orderNo}`,
      }).catch(() => {});
      return { success: true };
    }),

  // Manual payout for alipay_hk orders (record offline bank transfer)
  adminManualPayout: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      note: z.string().optional(),
      proofUrl: z.string().url().optional(), // S3 URL of payment proof screenshot
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      // Allow alipay_hk orders for both platform and seller (admin records receipt)
      if (order.paymentMethod !== 'alipay_hk' && order.sellerType !== 'seller') {
        throw new TRPCError({ code: "BAD_REQUEST", message: "僅支付寶 HK 訂單或 C2C 訂單可手動標記放款" });
      }
      const updateData: Record<string, any> = {
        payoutStatus: "paid",
        manualPayoutAt: new Date(),
        manualPayoutNote: input.note ?? "管理員手動標記已放款",
      };
      if (input.proofUrl) updateData.manualPayoutProofUrl = input.proofUrl;
      await updateMarketplaceOrder(input.orderId, updateData);
      // Notify seller of payout (only for C2C seller orders)
      if (order.sellerId && order.sellerType === 'seller') {
        const sellerProf = await getSellerProfileById(order.sellerId);
        if (sellerProf?.userId) {
          await createNotification({
            userId: sellerProf.userId,
            type: "trade",
            title: "款項已放款 💰",
            body: `訂單 ${order.orderNo} 的款項 HKD ${parseFloat(order.sellerReceivableHkd as string).toFixed(2)} 已由管理員手動放款。${input.note ? `備註：${input.note}` : ""}請到賣家後台查看放款詳情。`,
            linkUrl: "/seller",
          }).catch(() => {});
        }
      }
      return { success: true, message: "已標記為手動放款" };
    }),

  // Batch manual payout for multiple alipay_hk orders
  adminBatchManualPayout: adminProcedure
    .input(z.object({
      orderIds: z.array(z.number().int()).min(1).max(50),
      note: z.string().optional(),
      proofUrl: z.string().url().optional(), // Shared proof screenshot for all orders in batch
    }))
    .mutation(async ({ input }) => {
      const results: { orderId: number; orderNo: string; success: boolean; error?: string }[] = [];
      for (const orderId of input.orderIds) {
        try {
          const order = await getMarketplaceOrderById(orderId);
          if (!order) { results.push({ orderId, orderNo: '', success: false, error: '訂單不存在' }); continue; }
          if (order.paymentMethod !== 'alipay_hk') { results.push({ orderId, orderNo: order.orderNo ?? '', success: false, error: '非支付寶 HK 訂單' }); continue; }
          if (order.payoutStatus === 'paid') { results.push({ orderId, orderNo: order.orderNo ?? '', success: false, error: '已放款' }); continue; }
          const batchUpdateData: Record<string, any> = {
            payoutStatus: "paid",
            manualPayoutAt: new Date(),
            manualPayoutNote: input.note ?? "管理員批量標記已放款",
          };
          if (input.proofUrl) batchUpdateData.manualPayoutProofUrl = input.proofUrl;
          await updateMarketplaceOrder(orderId, batchUpdateData);
          // Notify seller (C2C only)
          if (order.sellerId && order.sellerType === 'seller') {
            const sellerProf = await getSellerProfileById(order.sellerId);
            if (sellerProf?.userId) {
              await createNotification({
                userId: sellerProf.userId,
                type: "trade",
                title: "款項已放款 💰",
                body: `訂單 ${order.orderNo} 的款項 HKD ${parseFloat(order.sellerReceivableHkd as string).toFixed(2)} 已由管理員放款。${input.note ? `備註：${input.note}` : ""}`,
                linkUrl: "/seller",
              }).catch(() => {});
            }
          }
          results.push({ orderId, orderNo: order.orderNo ?? '', success: true });
        } catch (err: any) {
          results.push({ orderId, orderNo: '', success: false, error: err.message });
        }
      }
      const successCount = results.filter(r => r.success).length;
      return { results, successCount, totalCount: input.orderIds.length };
    }),

  // Query Stripe Transfer status for a specific order
  adminGetStripeTransferStatus: adminProcedure
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      // If already has a transfer ID, fetch it from Stripe
      if (order.stripeTransferId) {
        try {
          const stripe = getStripe();
          const transfer = await stripe.transfers.retrieve(order.stripeTransferId);
          return {
            status: "completed" as const,
            transferId: transfer.id,
            amount: transfer.amount / 100,
            currency: transfer.currency.toUpperCase(),
            created: new Date(transfer.created * 1000).toISOString(),
            destination: typeof transfer.destination === 'string' ? transfer.destination : (transfer.destination as any)?.id,
            reversals: transfer.reversals?.data?.length ?? 0,
            reversed: transfer.reversed,
          };
        } catch (err: any) {
          return { status: "fetch_error" as const, error: err.message, transferId: order.stripeTransferId };
        }
      }
      // No transfer yet - diagnose why
      const reasons: string[] = [];
      if (order.paymentMethod !== 'stripe') {
        return { status: "not_applicable" as const, reason: "非 Stripe 付款訂單" };
      }
      if (order.sellerType === 'platform') {
        return { status: "not_applicable" as const, reason: "平台自有商品，無需放款給賣家" };
      }
      if (order.orderStatus !== 'completed') {
        reasons.push(`訂單尚未完成（目前狀態：${order.orderStatus}）`);
      }
      if (order.payoutStatus === 'failed') {
        reasons.push(`放款失敗：${order.stripeTransferError ?? '未知原因'}`);
      }
      if (order.sellerId) {
        const sellerProf = await getSellerProfileById(order.sellerId);
        if (!sellerProf?.stripeConnectId) reasons.push("賣家尚未設定 Stripe Connect 帳戶");
        else if (sellerProf.stripeConnectStatus !== 'active') reasons.push(`賣家 Stripe Connect 狀態：${sellerProf.stripeConnectStatus ?? '未啟用'}`);
      } else {
        reasons.push("找不到賣家資料");
      }
      if (!order.stripePaymentIntentId) reasons.push("缺少 Stripe Payment Intent ID");
      return {
        status: "pending" as const,
        payoutStatus: order.payoutStatus,
        reasons: reasons.length > 0 ? reasons : ["等待訂單完成後自動放款"],
        stripeTransferError: order.stripeTransferError,
      };
    }),

  adminSetDisputePriority: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      priority: z.enum(["high", "medium", "low"]),
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const db = await getDb();
      await db!.update(marketplaceOrders)
        .set({ disputePriority: input.priority })
        .where(eq(marketplaceOrders.id, input.orderId));
      return { success: true };
    }),

  adminUpdateOrderStatus: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      orderStatus: z.enum(["processing", "shipped", "delivered", "completed", "cancelled", "disputed"]),
      note: z.string().optional(),
      trackingNumber: z.string().optional(),
      shippingMethod: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const updates: Record<string, any> = { orderStatus: input.orderStatus };
      if (input.orderStatus === "shipped") {
        updates.shippedAt = new Date();
        if (input.trackingNumber) updates.trackingNumber = input.trackingNumber;
        if (input.shippingMethod) updates.shippingMethod = input.shippingMethod;
      }
      if (input.orderStatus === "delivered") {
        const autoComplete = new Date();
        autoComplete.setDate(autoComplete.getDate() + 14);
        updates.autoCompleteAt = autoComplete;
      }
      // When cancelling, also update paymentStatus and clear any pending Alipay proof
      if (input.orderStatus === "cancelled") {
        updates.paymentStatus = "cancelled";
        updates.alipayProofImageUrl = null;
        updates.aiVerificationResult = null;
      }

      // ── For cancellation: find all pending_payment orders in the same batch ────────────
      // Admin cancelling one order in a batch should cancel all pending_payment siblings.
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      let batchOrderIds: number[] = [input.orderId];
      if (input.orderStatus === "cancelled" && order.batchRef) {
        const batchOrders = await db.select({ id: marketplaceOrders.id, orderNo: marketplaceOrders.orderNo })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.batchRef, order.batchRef),
              eq(marketplaceOrders.orderStatus, 'pending_payment')
            )
          );
        batchOrderIds = batchOrders.map(o => o.id);
        if (batchOrderIds.length > 1) {
          console.log(`[AdminCancel] batchRef=${order.batchRef}, cancelling ${batchOrderIds.length} orders: ${batchOrders.map(o => o.orderNo).join(', ')}`);
        }
      }

      // ── Apply updates (for non-cancel, only the target order; for cancel, all batch orders) ──
      if (input.orderStatus === "cancelled" && batchOrderIds.length > 1) {
        // Batch cancel: update all orders in the batch
        for (const batchOrderId of batchOrderIds) {
          const targetOrder = batchOrderId === input.orderId ? order : await getMarketplaceOrderById(batchOrderId);
          if (!targetOrder) continue;
          await updateMarketplaceOrder(batchOrderId, {
            orderStatus: "cancelled",
            paymentStatus: "cancelled",
            alipayProofImageUrl: null,
            aiVerificationResult: null,
          });
          if (targetOrder.listingId) {
            try {
              await restoreListingStock(targetOrder.listingId, targetOrder.quantity ?? 1);
              console.log(`[AdminCancel] Restored listing ${targetOrder.listingId} stock for order ${targetOrder.orderNo}`);
            } catch (relistErr: any) {
              console.warn(`[AdminCancel] Failed to restore listing stock for order ${targetOrder.orderNo}:`, relistErr.message);
            }
          }
          // Cancel associated accepted offers
          try {
            await db.update(offers)
              .set({ status: "cancelled", respondedAt: new Date() })
              .where(and(eq(offers.orderId, batchOrderId), eq(offers.status, "accepted")));
          } catch (offerErr: any) {
            console.warn(`[AdminCancel] Failed to cancel offer for order ${batchOrderId}:`, offerErr.message);
          }
        }
      } else {
        // Single order update (non-cancel or no batchRef)
        await updateMarketplaceOrder(input.orderId, updates);
        // When cancelling, restore listing stock
        if (input.orderStatus === "cancelled" && order.listingId) {
          try {
            await restoreListingStock(order.listingId, order.quantity ?? 1);
            console.log(`[AdminCancel] Restored listing ${order.listingId} stock for cancelled order ${order.orderNo}`);
          } catch (relistErr: any) {
            console.warn("[AdminCancel] Failed to restore listing stock:", relistErr.message);
          }
        }
      }

      const cancelledCount = input.orderStatus === "cancelled" ? batchOrderIds.length : 1;
      const batchCancelNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';

      // Notify buyer of status change
      const statusMessages: Record<string, { title: string; content: string }> = {
        processing: { title: "訂單處理中 ⏳", content: `訂單 ${order.orderNo} 已進入處理中，賣家正在準備發貨。` },
        shipped: { title: "訂單已出貨 📦", content: `訂單 ${order.orderNo} 已出貨${input.trackingNumber ? `，物流追蹤號：${input.trackingNumber}` : ""}${input.shippingMethod ? `（${input.shippingMethod}）` : ""}，請注意查收。` },
        delivered: { title: "訂單已送達 ✅", content: `訂單 ${order.orderNo} 已送達，如有問題請在 14 天內提出申請。` },
        completed: { title: "訂單已完成 🎉", content: `訂單 ${order.orderNo} 已完成，感謝您的支持！` },
        cancelled: { title: "訂單已取消 ❌", content: `訂單 ${order.orderNo} 已取消${batchCancelNote}。${input.note ? `原因：${input.note}` : ""}` },
        disputed: { title: "訂單爭議中 ⚠️", content: `訂單 ${order.orderNo} 已進入爭議處理。我們將盡快處理，請耐心等候。` },
      };
      const msg = statusMessages[input.orderStatus];
      if (msg) {
        await createNotification({
          userId: order.buyerId,
          type: "trade",
          title: msg.title,
          body: msg.content,
          linkUrl: `/orders/${order.orderNo}`,
        }).catch(err => console.warn("[Admin] Failed to notify buyer of status change:", err));
      }
      // P2: If admin manually completes a C2C order, trigger Stripe payout via executeSellerPayout
      if (input.orderStatus === "completed" && order.sellerType === "seller" && order.sellerId) {
        try {
          const { executeSellerPayout } = await import("../sellerPayout");
          const payoutResult = await executeSellerPayout(input.orderId);
          if (payoutResult.success) {
            console.log(`[Admin] P2 Payout transfer ${payoutResult.transferId} for order ${order.orderNo}, HKD ${payoutResult.amountHkd}`);
          } else {
            console.error(`[Admin] P2 Payout failed for order ${order.orderNo}: ${payoutResult.error} (retryable: ${payoutResult.retryable})`);
          }
        } catch (payoutErr: any) {
          console.error("[Admin] executeSellerPayout threw:", payoutErr.message);
        }
      }
      // Send email for key status changes
      // Only send email if status actually changed (idempotency: skip if already in target status)
      if (["shipped", "completed", "cancelled"].includes(input.orderStatus) && order.orderStatus !== input.orderStatus) {
        try {
          const { sendOrderEmail, buildOrderShippedEmail, buildOrderCompletedBuyerEmail, buildOrderCompletedSellerEmail, buildOrderCancelledEmail, getOrderEmailData } = await import("../emailService");
          if (input.orderStatus === "shipped") {
            const emailData = await getOrderEmailData(order);
            const { subject, html } = buildOrderShippedEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
            await sendOrderEmail({ userId: order.buyerId, subject, html, emailType: 'order', dedupeKey: `order_shipped_buyer_${order.id}` });
          } else if (input.orderStatus === "completed") {
            const emailData = await getOrderEmailData(order);
            const { subject: bs, html: bh } = buildOrderCompletedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
            await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `order_completed_buyer_${order.id}` });
            // Use sellerProfile.userId, NOT order.sellerId
            if (order.sellerType === "seller" && order.sellerId) {
              const adminEmailSellerProf = await getSellerProfileById(order.sellerId);
              if (adminEmailSellerProf?.userId) {
                const { subject: ss, html: sh } = buildOrderCompletedSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, receivableHkd: emailData.receivableHkd });
                await sendOrderEmail({ userId: adminEmailSellerProf.userId, subject: ss, html: sh, emailType: 'order', dedupeKey: `order_completed_seller_${order.id}` });
              }
            }
          } else if (input.orderStatus === "cancelled") {
            // ── Batch cancel: send one email per order (mirrors buyerCancelOrder behaviour) ────────────
            const adminBatchCount = batchOrderIds.length;
            // Pre-fetch all batch order email data for the cancelledItems list in the first email
            const adminAllBatchEmailData: Array<{ orderNo: string; itemName: string; priceHkd: string }> = [];
            if (adminBatchCount > 1) {
              for (const bId of batchOrderIds) {
                const bOrder = bId === input.orderId ? order : await getMarketplaceOrderById(bId);
                if (!bOrder) continue;
                try {
                  const bData = await getOrderEmailData(bOrder);
                  adminAllBatchEmailData.push({ orderNo: bOrder.orderNo, itemName: bData.itemName, priceHkd: bData.priceHkd });
                } catch { /* skip */ }
              }
            }
            for (let adminBatchIdx = 0; adminBatchIdx < batchOrderIds.length; adminBatchIdx++) {
              const batchOrderId = batchOrderIds[adminBatchIdx];
              const targetOrder = batchOrderId === input.orderId ? order : await getMarketplaceOrderById(batchOrderId);
              if (!targetOrder) continue;
              try {
                const emailData = await getOrderEmailData(targetOrder);
                const { subject, html } = buildOrderCancelledEmail({
                  orderNo: targetOrder.orderNo,
                  itemName: emailData.itemName,
                  priceHkd: emailData.priceHkd,
                  note: input.note,
                  batchCount: adminBatchCount,
                  batchIndex: adminBatchIdx,
                  // First email gets the full cancelled items list
                  cancelledItems: adminBatchIdx === 0 && adminAllBatchEmailData.length > 1 ? adminAllBatchEmailData : undefined,
                });
                await sendOrderEmail({
                  userId: targetOrder.buyerId,
                  subject,
                  html,
                  emailType: 'order',
                  dedupeKey: `order_cancelled_admin_${targetOrder.id}`,
                });
              } catch (singleEmailErr: any) {
                console.warn(`[Admin] Cancel email failed for order ${targetOrder.orderNo}:`, singleEmailErr.message);
              }
            }
          }
        } catch (emailErr: any) {
          console.warn("[Admin] Order status email failed:", emailErr.message);
        }
      }
      // Record status change in history
      try {
        const db2 = await getDb();
        if (db2) {
          await db2.insert(orderStatusHistory).values({
            orderId: input.orderId,
            fromStatus: order.orderStatus,
            toStatus: input.orderStatus,
            operatorName: 'Admin',
            note: input.note || null,
          });
        }
      } catch (histErr: any) {
        console.warn('[Admin] Failed to record status history:', histErr.message);
      }
      // AT1: Audit log
      await createAuditLog({ adminId: ctx.user.id, action: `update_order_status_${input.orderStatus}`, targetType: 'order', targetId: input.orderId, details: JSON.stringify({ orderNo: order.orderNo, newStatus: input.orderStatus, note: input.note }) });
      return { success: true };
    }),

  adminSaveOrderNote: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      adminNote: z.string().max(2000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(marketplaceOrders)
        .set({ adminNote: input.adminNote, updatedAt: new Date() })
        .where(eq(marketplaceOrders.id, input.orderId));
      return { success: true };
    }),

  adminGetSellers: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getAllSellerProfiles(input.page, input.pageSize, input.search);
    }),

  adminGetSellerDetail: adminProcedure
    .input(z.object({ sellerId: z.number().int() }))
    .query(async ({ input }) => {
      const detail = await getAdminSellerDetail(input.sellerId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });
      return detail;
    }),

  // ============================================================
  // ADMIN - Approve/Reject Seller with Notification
  // =============================================================
  adminApproveSeller: adminProcedure
    .input(z.object({
      sellerId: z.number().int(),
      approve: z.boolean(),
      rejectReason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const seller = await getSellerProfileById(input.sellerId);
      if (!seller) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });
      // Get seller's user info for email
      const { getUserById } = await import("../userManagement");
      const sellerUser = await getUserById(seller.userId);
      if (input.approve) {
        await updateSellerProfile(input.sellerId, { isActive: true, rejectReason: null });
        // In-app notification
        await createNotification({
          userId: seller.userId,
          type: "system",
          title: "賣家申請已批准 ✅",
          body: "恭喜！你的賣家申請已獲批准，現在可以開始上架商品了。請前往賣家後台設定 Stripe 收款帳戶。",
          linkUrl: "/seller",
        }).catch(err => console.warn("[Seller] Failed to create approval notification:", err));
        // Email notification
        if (sellerUser?.email) {
          const { subject, html } = buildSellerApprovedEmail({
            displayName: seller.displayName,
            siteUrl: "https://boxium.asia",
          });
          sendEmail({ to: sellerUser.email, subject, html, emailType: 'seller', toUserId: seller.userId })
            .catch(err => console.warn("[Seller] Failed to send approval email:", err));
        }
      } else {
        await updateSellerProfile(input.sellerId, { isActive: false, rejectReason: input.rejectReason ?? null });
        // Deactivate all seller's active listings
        const db = await getDb();
        if (db) {
          await db.update(marketplaceListings)
            .set({ status: "removed" })
            .where(and(eq(marketplaceListings.sellerId, input.sellerId), eq(marketplaceListings.status, "active")));
        }
        // In-app notification
        await createNotification({
          userId: seller.userId,
          type: "system",
          title: "賣家申請未獲批准",
          body: input.rejectReason
            ? `你的賣家申請未獲批准。原因：${input.rejectReason}。如有疑問，請聯絡客服。`
            : "你的賣家申請未獲批准。如有疑問，請聯絡客服。",
          linkUrl: "/seller",
        }).catch(err => console.warn("[Seller] Failed to create rejection notification:", err));
        // Email notification
        if (sellerUser?.email) {
          const { subject, html } = buildSellerRejectedEmail({
            displayName: seller.displayName,
            rejectReason: input.rejectReason,
            siteUrl: "https://boxium.asia",
          });
          sendEmail({ to: sellerUser.email, subject, html, emailType: 'seller', toUserId: seller.userId })
            .catch(err => console.warn("[Seller] Failed to send rejection email:", err));
        }
      }
      return { success: true };
    }),

  // ============================================================
  // BUYER - Create Orders (legacy Stripe + Alipay HK)
  // ============================================================
  createStripeOrder: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      offerId: z.number().int().optional(), // If provided, use offer price instead of listing price
      buyerPhone: z.string().optional().default(""), // Buyer's contact phone (for meetup orders)
      shippingMethod: z.string().optional(), // 'meetup' or 'sf_cod'
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().optional().default(""), // Optional: phone not required for meetup orders
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().optional(),
        sfStationCode: z.string().optional(),
        sfStationName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      // Check if listing is locked by another user's pending order
      const activeOrder = await getActiveOrderByListingId(input.listingId);
      if (activeOrder && activeOrder.buyerId !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此商品目前有其他買家正在進行付款，請稍後再試。" });
      }
      // Determine effective price: use offer price if offerId provided
      let effectivePrice = parseFloat(listing.priceHkd as string);
      let offerRecord: any = null;
      if (input.offerId) {
        offerRecord = await getOfferById(input.offerId);
        if (!offerRecord || offerRecord.buyerId !== ctx.user.id || offerRecord.listingId !== input.listingId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "出價不存在或不屬於您" });
        }
        if (offerRecord.status !== "accepted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未被接受" });
        }
        effectivePrice = parseFloat(offerRecord.offerPriceHkd as string);
      }
      const stripe = getStripe();
      const feeRateStripe = await getPlatformFeeRate();

      // Stripe requires minimum HKD 4.00 for card payments
      if (effectivePrice < 4.00) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `此商品金額 HKD ${effectivePrice.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00，請改用支付寶 HK 付款。`,
        });
      }

      // ── If buyer has an existing Alipay pending order, cancel it first (payment method switch) ──
      if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'alipay_hk') {
        await updateMarketplaceOrder(activeOrder.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date() });
        // Single-item Alipay orders don't call reserveListingStock, so no stock to restore here.
        console.log(`[createStripeOrder] Cancelled existing Alipay order ${activeOrder.orderNo} for payment method switch`);
      }

      // ── Idempotency: reuse existing pending_payment Stripe order for same buyer+listing ──
      // This prevents duplicate orders when user closes checkout and clicks pay again
      if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'stripe') {
        const existingOrderNo = activeOrder.orderNo;
        // Try to reuse existing Stripe session if still valid
        if (activeOrder.stripeSessionId) {
          try {
            const existingSession = await stripe.checkout.sessions.retrieve(activeOrder.stripeSessionId);
            if (existingSession.status === 'open') {
              console.log(`[createStripeOrder] Reusing existing Stripe session for order ${existingOrderNo}`);
              return { checkoutUrl: existingSession.url, orderNo: existingOrderNo };
            }
          } catch (e) {
            // Session expired or invalid, create a new one below
            console.log(`[createStripeOrder] Existing session invalid, creating new session for order ${existingOrderNo}`);
          }
        }
        // Session expired: create a new Stripe session and update the existing order
        const newSession = await stripe.checkout.sessions.create({
          payment_method_types: ["card", "alipay"],
          line_items: [{
            price_data: {
              currency: "hkd",
              product_data: { name: listing.title, description: listing.description ?? undefined },
              unit_amount: Math.round(effectivePrice * 100),
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${ctx.req.headers.origin}/marketplace?payment=success&order=${existingOrderNo}`,
          cancel_url: `${ctx.req.headers.origin}/marketplace/listing/${listing.id}?payment=cancelled`,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            listing_id: listing.id.toString(),
            order_no: existingOrderNo,
            ...(input.offerId ? { offer_id: input.offerId.toString() } : {}),
          },
          payment_intent_data: {
            metadata: {
              orderId: activeOrder.id.toString(),
              orderNo: existingOrderNo,
              buyerId: ctx.user.id.toString(),
              listingId: listing.id.toString(),
            },
          },
        });
        // Update existing order with new session
        await updateMarketplaceOrder(activeOrder.id, {
          stripeSessionId: newSession.id,
          stripePaymentIntentId: newSession.payment_intent as string ?? null,
          updatedAt: new Date(),
        });
        console.log(`[createStripeOrder] Updated order ${existingOrderNo} with new Stripe session`);
        return { checkoutUrl: newSession.url, orderNo: existingOrderNo };
      }

      const orderNo = await generateOrderNo();
      const paymentIntentData2: any = {
        metadata: {
          orderId: "pending",
          orderNo,
          buyerId: ctx.user.id.toString(),
          listingId: listing.id.toString(),
          ...(input.offerId ? { offerId: input.offerId.toString() } : {}),
        },
      };
      // NOTE: Separate Charges and Transfers mode - funds held in platform until buyer confirms receipt
      if (listing.sellerType === "seller" && listing.sellerId) {
        const sellerProfile2 = await getSellerProfileById(listing.sellerId);
        if (sellerProfile2?.stripeConnectId && sellerProfile2.stripeConnectStatus === "active") {
          console.log(`[Checkout2] Separate Charges mode for seller ${sellerProfile2.stripeConnectId}. Funds held until buyer confirms receipt.`);
        }
      }
      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: { name: listing.title, description: listing.description ?? undefined },
            unit_amount: Math.round(effectivePrice * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${ctx.req.headers.origin}/marketplace?payment=success&order=${orderNo}`,
        cancel_url: `${ctx.req.headers.origin}/marketplace/listing/${listing.id}?payment=cancelled`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          listing_id: listing.id.toString(),
          order_no: orderNo,
          ...(input.offerId ? { offer_id: input.offerId.toString() } : {}),
        },
        payment_intent_data: paymentIntentData2,
      });
      // Create pending order
      await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        sellerId: listing.sellerId ?? null,
        sellerType: listing.sellerType as any,
        paymentMethod: "stripe",
        paymentStatus: "pending",
        orderStatus: "pending_payment",
        subtotalHkd: effectivePrice.toFixed(2),
        listingId: listing.id,
        unitPriceHkd: effectivePrice.toFixed(2),
        quantity: 1,
        platformFeeRate: feeRateStripe.toFixed(4),
        platformFeeHkd: calcPlatformFeeWithRate(listing.sellerType, effectivePrice, feeRateStripe).toFixed(2),
        sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, effectivePrice, feeRateStripe).toFixed(2),
        stripePaymentIntentId: session.payment_intent as string ?? null,
        stripeSessionId: session.id,
        shippingName: input.shippingAddress?.name ?? null,
        shippingPhone: input.shippingAddress?.phone ?? null,
        shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
        shippingMethod: (input.shippingMethod ?? null) as "sf_express" | "hongkong_post" | "other" | "sf_cod" | "meetup" | null,
        buyerPhone: input.buyerPhone || null,
      });
      // Notify seller for meetup orders
      if (input.shippingMethod === 'meetup' && listing.sellerType === 'seller' && listing.sellerId) {
        const sellerProfileForNotify = await getSellerProfileById(listing.sellerId);
        if (sellerProfileForNotify?.userId) {
          const buyerPhoneDisplay = input.buyerPhone ? `買家電話：${input.buyerPhone}` : '買家未提供電話';
          await createNotification({
            userId: sellerProfileForNotify.userId,
            type: 'trade',
            title: '新面交訂單 🤝',
            body: `訂單 ${orderNo} 買家選擇面交付款，請將商品備好。${buyerPhoneDisplay}。請將訂單狀態更新為「確認已面交」完成訂單。`,
            linkUrl: '/seller',
          }).catch(() => {});
        }
      }
      return { checkoutUrl: session.url, orderNo };
    }),

  // AI verification of payment proof screenshot
  verifyPaymentProof: protectedProcedure
    .input(z.object({
      proofImageUrl: z.string().url(),
      expectedAmountHkd: z.number().positive(),
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a payment verification assistant for a Hong Kong e-commerce platform. Analyze the Alipay HK payment screenshot and verify three things:
1. Payee name must be exactly "零度有限公司"
2. Payment amount must match the expected amount (within 1% tolerance)
3. Payment status must show "成功" (success)
All three checks must pass for verified to be true. Respond with JSON only matching the exact schema provided.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url" as const,
                  image_url: { url: input.proofImageUrl, detail: "high" as const },
                },
                {
                  type: "text" as const,
                  text: `請分析這張支付寶 HK 付款截圖，驗證以下三項：
1. 收款方必須是「零度有限公司」
2. 付款金額必須是 HKD ${input.expectedAmountHkd.toFixed(2)}
3. 付款狀態必須顯示「成功」
三項全部符合才算驗證通過。`,
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "payment_verification",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  verified: { type: "boolean" },
                  payeeVerified: { type: "boolean" },
                  detectedPayee: { type: ["string", "null"] },
                  amountVerified: { type: "boolean" },
                  detectedAmount: { type: ["number", "null"] },
                  currency: { type: ["string", "null"] },
                  statusVerified: { type: "boolean" },
                  detectedStatus: { type: ["string", "null"] },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                  reason: { type: "string" },
                },
                required: ["verified", "payeeVerified", "detectedPayee", "amountVerified", "detectedAmount", "currency", "statusVerified", "detectedStatus", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        const result = typeof content === "string" ? JSON.parse(content) : content;
        return {
          verified: result.verified === true,
          payeeVerified: result.payeeVerified === true,
          detectedPayee: result.detectedPayee ?? null,
          amountVerified: result.amountVerified === true,
          detectedAmount: result.detectedAmount ?? null,
          currency: result.currency ?? null,
          statusVerified: result.statusVerified === true,
          detectedStatus: result.detectedStatus ?? null,
          confidence: result.confidence as "high" | "medium" | "low",
          reason: result.reason ?? "",
        };
      } catch (err) {
        console.error("[PaymentVerify] LLM error:", err);
        return {
          verified: false,
          payeeVerified: false,
          detectedPayee: null,
          amountVerified: false,
          detectedAmount: null,
          currency: null,
          statusVerified: false,
          detectedStatus: null,
          confidence: "low" as const,
          reason: "無法分析截圖，請確保截圖清晰可見付款資訊",
        };
      }
    }),

  createAlipayOrder: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      offerId: z.number().int().optional(), // If provided, use offer price instead of listing price
      proofImageUrl: z.string().optional().default(""), // Optional: empty string allowed for orders without proof
      buyerPhone: z.string().optional().default(""), // Buyer's contact phone (for meetup orders)
      shippingMethod: z.string().optional(), // 'meetup' or 'sf_cod'
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().optional().default(""), // Optional: phone not required for meetup orders
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().optional().default("香港"),
        sfStationCode: z.string().optional(),
        sfStationName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      // Check if listing is locked by another user's pending order
      const activeOrder = await getActiveOrderByListingId(input.listingId);
      if (activeOrder && activeOrder.buyerId !== ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此商品目前有其他買家正在進行付款，請稍後再試。" });
      }
      // Determine effective price: use offer price if offerId provided
      let effectivePrice = parseFloat(listing.priceHkd as string);
      if (input.offerId) {
        const offerRecord = await getOfferById(input.offerId);
        if (!offerRecord || offerRecord.buyerId !== ctx.user.id || offerRecord.listingId !== input.listingId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "出價不存在或不屬於您" });
        }
        if (offerRecord.status !== "accepted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未被接受" });
        }
        effectivePrice = parseFloat(offerRecord.offerPriceHkd as string);
      }
      // ── If buyer has an existing Stripe pending order, cancel it first (payment method switch) ──
      if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'stripe') {
        await updateMarketplaceOrder(activeOrder.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date() });
        // Single-item Stripe orders don't call reserveListingStock, so no stock to restore here.
        console.log(`[createAlipayOrder] Cancelled existing Stripe order ${activeOrder.orderNo} for payment method switch`);
      }

      // ── Idempotency: reuse existing pending_payment Alipay order for same buyer+listing ──
      // This prevents duplicate orders when user submits proof multiple times
      if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'alipay_hk') {
        const existingOrderNo = activeOrder.orderNo;
        // Update the existing order with new proof image and shipping address
        await updateMarketplaceOrder(activeOrder.id, {
          alipayProofImageUrl: input.proofImageUrl,
          shippingName: input.shippingAddress?.name ?? null,
          shippingPhone: input.shippingAddress?.phone ?? null,
          shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
          updatedAt: new Date(),
        });
        console.log(`[createAlipayOrder] Reusing existing Alipay order ${existingOrderNo} with updated proof`);
        await notifyAdmin({
          title: "支付寶 HK 訂單更新截圖 📸",
          content: `訂單 ${existingOrderNo} 買家重新提交支付寶 HK 付款截圖，請前往管理後台審核。商品：${listing.title}，金額：HKD ${effectivePrice.toFixed(2)}`,
        }).catch(() => {});
        return { orderNo: existingOrderNo };
      }

      const orderNo = await generateOrderNo();
      const feeRateAlipay = await getPlatformFeeRate();
      const newOrder = await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        sellerId: listing.sellerId ?? null,
        sellerType: listing.sellerType as any,
        paymentMethod: "alipay_hk",
        paymentStatus: "pending",
        orderStatus: "pending_payment",
        subtotalHkd: effectivePrice.toFixed(2),
        listingId: listing.id,
        unitPriceHkd: effectivePrice.toFixed(2),
        quantity: 1,
        platformFeeRate: feeRateAlipay.toFixed(4),
        platformFeeHkd: calcPlatformFeeWithRate(listing.sellerType, effectivePrice, feeRateAlipay).toFixed(2),
        sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, effectivePrice, feeRateAlipay).toFixed(2),
        alipayProofImageUrl: input.proofImageUrl,
        shippingName: input.shippingAddress?.name ?? null,
        shippingPhone: input.shippingAddress?.phone ?? null,
        shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
        shippingMethod: (input.shippingMethod ?? null) as "sf_express" | "hongkong_post" | "other" | "sf_cod" | "meetup" | null,
        buyerPhone: input.buyerPhone || null,
      });
      // Notify seller for meetup orders
      if (input.shippingMethod === 'meetup' && listing.sellerType === 'seller' && listing.sellerId) {
        const sellerProfileForNotifyAlipay = await getSellerProfileById(listing.sellerId);
        if (sellerProfileForNotifyAlipay?.userId) {
          const buyerPhoneDisplayAlipay = input.buyerPhone ? `買家電話：${input.buyerPhone}` : '買家未提供電話';
          await createNotification({
            userId: sellerProfileForNotifyAlipay.userId,
            type: 'trade',
            title: '新面交訂單 🤝',
            body: `訂單 ${orderNo} 買家選擇面交付款，請將商品備好。${buyerPhoneDisplayAlipay}。請將訂單狀態更新為「確認已面交」完成訂單。`,
            linkUrl: '/seller',
          }).catch(() => {});
        }
      }
      // Notify admin of new Alipay order pending review
      await notifyAdmin({
        title: "支付寶 HK 訂單待審核 💰",
        content: `訂單 ${orderNo} 買家已提交支付寶 HK 付款截圖，請前往管理後台審核。商品：${listing.title}，金額：HKD ${effectivePrice.toFixed(2)}`,
      }).catch(() => {});
      return { orderNo };
    }),

  // ============================================================
  // BUYER - Batch Stripe Checkout (multiple items in one payment)
  // ============================================================
  createBatchStripeOrder: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        listingId: z.number().int(),
        offerId: z.number().int().optional(),
      })).min(1),
      buyerPhone: z.string().optional().default(""),
      shippingMethod: z.string().optional(),
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().optional().default(""),
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().optional(),
        sfStationCode: z.string().optional(),
        sfStationName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const stripe = getStripe();
      const feeRate = await getPlatformFeeRate();

      // Step 1: Validate all listings and compute prices
      const orderItems: Array<{
        listing: any;
        effectivePrice: number;
        offerId?: number;
        offerRecord?: any;
      }> = [];

      for (const item of input.items) {
        const listing = await getListingById(item.listingId);
        if (!listing || listing.status !== "active" || listing.quantity < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing?.title ?? item.listingId}」不存在或已售出` });
        }
        // Check if locked by another user
        const activeOrder = await getActiveOrderByListingId(item.listingId);
        if (activeOrder && activeOrder.buyerId !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing.title}」目前有其他買家正在付款，請稍後再試。` });
        }
        // Cancel any existing pending orders for this listing by this buyer (payment method switch)
        if (activeOrder && activeOrder.buyerId === ctx.user.id) {
          await updateMarketplaceOrder(activeOrder.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date() });
          // Batch orders DO call reserveListingStock, so restore stock when cancelling old batch order.
          try {
            await restoreListingStock(item.listingId, 1);
            console.log(`[createBatchStripeOrder] Restored stock for listing ${item.listingId} after cancelling old order ${activeOrder.orderNo}`);
          } catch (restoreErr: any) {
            console.warn(`[createBatchStripeOrder] Failed to restore stock for listing ${item.listingId}:`, restoreErr.message);
          }
        }

        let effectivePrice = parseFloat(listing.priceHkd as string);
        let offerRecord: any = null;
        if (item.offerId) {
          offerRecord = await getOfferById(item.offerId);
          if (!offerRecord || offerRecord.buyerId !== ctx.user.id || offerRecord.listingId !== item.listingId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "出價不存在或不屬於您" });
          }
          if (offerRecord.status !== "accepted") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未被接受" });
          }
          effectivePrice = parseFloat(offerRecord.offerPriceHkd as string);
        }
        if (effectivePrice < 4.00) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `商品「${listing.title}」金額 HKD ${effectivePrice.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00，請改用支付寶 HK 付款。`,
          });
        }
        orderItems.push({ listing, effectivePrice, offerId: item.offerId, offerRecord });
      }

      // Step 2: Compute totals and determine payment restrictions (P1)
      const totalAmount = orderItems.reduce((sum, o) => sum + o.effectivePrice, 0);
      const totalPlatformFee = orderItems.reduce((sum, { listing, effectivePrice }) =>
        sum + calcPlatformFeeWithRate(listing.sellerType, effectivePrice, feeRate), 0);
      const totalSellerReceivable = totalAmount - totalPlatformFee;
      const hasSellerItems = orderItems.some(({ listing }) => listing.sellerType === "seller");

      // Step 3: Create cartOrders Master record (P1)
      const cartOrder = await createCartOrder({
        buyerId: ctx.user.id,
        totalSubtotalHkd: totalAmount.toFixed(2),
        totalPlatformFeeHkd: totalPlatformFee.toFixed(2),
        totalSellerReceivableHkd: totalSellerReceivable.toFixed(2),
        hasSellerItems,
        availablePaymentMethods: hasSellerItems ? "stripe" : "stripe,alipay_hk",
        paymentRestrictionReason: hasSellerItems
          ? "購物車包含個人賣家商品，僅支援 Stripe 信用卡付款"
          : null,
        paymentStatus: "pending",
      });

      // Step 3.5: Atomic stock reservation for ALL items (prevents overselling)
      const reservedListingIds: number[] = [];
      try {
        for (const { listing } of orderItems) {
          const reserved = await reserveListingStock(listing.id, 1);
          if (!reserved) {
            // Rollback already-reserved items
            for (const lid of reservedListingIds) {
              await restoreListingStock(lid, 1).catch(() => {});
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing.title}」庫存不足，可能已被其他買家搶購` });
          }
          reservedListingIds.push(listing.id);
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        // Rollback on unexpected error
        for (const lid of reservedListingIds) {
          await restoreListingStock(lid, 1).catch(() => {});
        }
        throw err;
      }

      // Step 4: Create all sub-orders in DB with pending_payment status
      const batchRef = orderItems.length > 1 ? `BATCH-${Date.now()}-${ctx.user.id}` : undefined;
      const createdOrders: Array<{ orderNo: string; orderId: number; listingId: number; effectivePrice: number }> = [];
      for (const { listing, effectivePrice, offerId } of orderItems) {
        const orderNo = await generateOrderNo();
        const newOrder = await createMarketplaceOrder({
          orderNo,
          buyerId: ctx.user.id,
          sellerId: listing.sellerId ?? null,
          sellerType: listing.sellerType as any,
          paymentMethod: "stripe",
          paymentStatus: "pending",
          orderStatus: "pending_payment",
          subtotalHkd: effectivePrice.toFixed(2),
          listingId: listing.id,
          unitPriceHkd: effectivePrice.toFixed(2),
          quantity: 1,
          platformFeeRate: feeRate.toFixed(4),
          platformFeeHkd: calcPlatformFeeWithRate(listing.sellerType, effectivePrice, feeRate).toFixed(2),
          sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, effectivePrice, feeRate).toFixed(2),
          stripePaymentIntentId: null,
          stripeSessionId: null,
          shippingName: input.shippingAddress?.name ?? null,
          shippingPhone: input.shippingAddress?.phone ?? null,
          shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
          shippingMethod: (input.shippingMethod ?? null) as any,
          buyerPhone: input.buyerPhone || null,
          batchRef: batchRef ?? null,
          cartOrderId: cartOrder?.id ?? null, // P1: Link to master cart order
        } as any);
        createdOrders.push({ orderNo, orderId: newOrder.id, listingId: listing.id, effectivePrice });
      }

      // Step 5: Create a single Stripe Checkout Session for all orders
      const batchOrderNos = createdOrders.map(o => o.orderNo).join(",");
      const firstOrderNo = createdOrders[0].orderNo;

      const lineItems = orderItems.map(({ listing, effectivePrice }) => ({
        price_data: {
          currency: "hkd",
          product_data: { name: listing.title, description: listing.description ?? undefined },
          unit_amount: Math.round(effectivePrice * 100),
        },
        quantity: 1,
      }));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${ctx.req.headers.origin}/cart?success=true&orders=${encodeURIComponent(batchOrderNos)}`,
        cancel_url: `${ctx.req.headers.origin}/cart?payment=cancelled`,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          batch_order_nos: batchOrderNos,
          order_no: firstOrderNo, // backward compat
          total_amount: totalAmount.toFixed(2),
          cart_order_id: cartOrder?.id?.toString() ?? "", // P1: Master order reference
        },
        payment_intent_data: {
          metadata: {
            batch_order_nos: batchOrderNos,
            buyerId: ctx.user.id.toString(),
            cart_order_id: cartOrder?.id?.toString() ?? "", // P1: for Transfer source_transaction lookup
          },
        },
      });

      // Step 6: Update cartOrder and all sub-orders with Stripe session ID
      if (cartOrder) {
        await updateCartOrder(cartOrder.id, {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string ?? null,
        });
      }
      for (const { orderId } of createdOrders) {
        await updateMarketplaceOrder(orderId, {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string ?? null,
          updatedAt: new Date(),
        });
      }

      console.log(`[createBatchStripeOrder] Created cartOrder#${cartOrder?.id}, ${createdOrders.length} sub-orders, session ${session.id}, total HKD ${totalAmount}`);
      return { checkoutUrl: session.url!, orderNos: createdOrders.map(o => o.orderNo), totalAmount, cartOrderId: cartOrder?.id };
    }),

  // ============================================================
  // BUYER - Batch Alipay Checkout (multiple items, create all orders)
  // ============================================================
  createBatchAlipayOrder: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        listingId: z.number().int(),
        offerId: z.number().int().optional(),
      })).min(1),
      proofImageUrl: z.string().optional().default(""),
      buyerPhone: z.string().optional().default(""),
      shippingMethod: z.string().optional(),
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().optional().default(""),
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().optional().default("香港"),
        sfStationCode: z.string().optional(),
        sfStationName: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const feeRate = await getPlatformFeeRate();

      // P0: Pre-flight check — validate all listings exist and check for seller items
      // We do a pre-check pass to validate payment method before creating any orders
      const preCheckListings: Array<{ listingId: number; sellerType: string }> = [];
      for (const item of input.items) {
        const listing = await getListingById(item.listingId);
        if (!listing || listing.status !== "active" || listing.quantity < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing?.title ?? item.listingId}」不存在或已售出` });
        }
        preCheckListings.push({ listingId: item.listingId, sellerType: listing.sellerType });
      }
      // P0: Reject Alipay HK if any item is from a C2C seller
      const hasSellerItems = preCheckListings.some(l => l.sellerType === "seller");
      if (hasSellerItems) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "購物車包含個人賣家商品，僅支援 Stripe 信用卡付款。支付寶 HK 僅適用於全部為本公司自營商品的訂單。",
        });
      }

      const createdOrders: Array<{ orderNo: string; listingTitle: string; effectivePrice: number }> = [];
      let totalAmount = 0;
      const batchRef = input.items.length > 1 ? `BATCH-${Date.now()}-${ctx.user.id}` : undefined;

      // Pre-process: validate, handle existing orders, and collect items needing new orders
      const itemsToCreate: Array<{ listing: any; effectivePrice: number; offerId?: number }> = [];
      for (const item of input.items) {
        const listing = await getListingById(item.listingId);
        if (!listing || listing.status !== "active" || listing.quantity < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing?.title ?? item.listingId}」不存在或已售出` });
        }
        const activeOrder = await getActiveOrderByListingId(item.listingId);
        if (activeOrder && activeOrder.buyerId !== ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing.title}」目前有其他買家正在付款，請稍後再試。` });
        }
        // Cancel any existing pending orders (payment method switch)
        if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'stripe') {
          await updateMarketplaceOrder(activeOrder.id, { orderStatus: 'cancelled', paymentStatus: 'cancelled', updatedAt: new Date() });
          // Batch Stripe orders DO call reserveListingStock, so restore stock when cancelling old batch Stripe order.
          try {
            await restoreListingStock(item.listingId, 1);
            console.log(`[createBatchAlipayOrder] Restored stock for listing ${item.listingId} after cancelling old Stripe order ${activeOrder.orderNo}`);
          } catch (restoreErr: any) {
            console.warn(`[createBatchAlipayOrder] Failed to restore stock for listing ${item.listingId}:`, restoreErr.message);
          }
        }
        // Reuse existing alipay pending order (no new stock reservation needed)
        if (activeOrder && activeOrder.buyerId === ctx.user.id && activeOrder.paymentMethod === 'alipay_hk') {
          await updateMarketplaceOrder(activeOrder.id, {
            alipayProofImageUrl: input.proofImageUrl,
            shippingName: input.shippingAddress?.name ?? null,
            shippingPhone: input.shippingAddress?.phone ?? null,
            shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
            updatedAt: new Date(),
          });
          const price = parseFloat(activeOrder.subtotalHkd as string);
          createdOrders.push({ orderNo: activeOrder.orderNo, listingTitle: listing.title, effectivePrice: price });
          totalAmount += price;
          continue;
        }

        let effectivePrice = parseFloat(listing.priceHkd as string);
        if (item.offerId) {
          const offerRecord = await getOfferById(item.offerId);
          if (!offerRecord || offerRecord.buyerId !== ctx.user.id || offerRecord.listingId !== item.listingId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "出價不存在或不屬於您" });
          }
          if (offerRecord.status !== "accepted") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "此出價尚未被接受" });
          }
          effectivePrice = parseFloat(offerRecord.offerPriceHkd as string);
        }
        itemsToCreate.push({ listing, effectivePrice, offerId: item.offerId });
      }

      // Atomic stock reservation for new items (prevents overselling)
      const reservedListingIds: number[] = [];
      try {
        for (const { listing } of itemsToCreate) {
          const reserved = await reserveListingStock(listing.id, 1);
          if (!reserved) {
            for (const lid of reservedListingIds) {
              await restoreListingStock(lid, 1).catch(() => {});
            }
            throw new TRPCError({ code: "BAD_REQUEST", message: `商品「${listing.title}」庫存不足，可能已被其他買家搶購` });
          }
          reservedListingIds.push(listing.id);
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        for (const lid of reservedListingIds) {
          await restoreListingStock(lid, 1).catch(() => {});
        }
        throw err;
      }

      // Create new orders for items that need them
      for (const { listing, effectivePrice } of itemsToCreate) {
        const orderNo = await generateOrderNo();
        await createMarketplaceOrder({
          orderNo,
          buyerId: ctx.user.id,
          sellerId: listing.sellerId ?? null,
          sellerType: listing.sellerType as any,
          paymentMethod: "alipay_hk",
          paymentStatus: "pending",
          orderStatus: "pending_payment",
          subtotalHkd: effectivePrice.toFixed(2),
          listingId: listing.id,
          unitPriceHkd: effectivePrice.toFixed(2),
          quantity: 1,
          platformFeeRate: feeRate.toFixed(4),
          platformFeeHkd: calcPlatformFeeWithRate(listing.sellerType, effectivePrice, feeRate).toFixed(2),
          sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, effectivePrice, feeRate).toFixed(2),
          alipayProofImageUrl: input.proofImageUrl,
          shippingName: input.shippingAddress?.name ?? null,
          shippingPhone: input.shippingAddress?.phone ?? null,
          shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
          shippingMethod: (input.shippingMethod ?? null) as any,
          buyerPhone: input.buyerPhone || null,
          batchRef: batchRef ?? null,
        } as any);
        createdOrders.push({ orderNo, listingTitle: listing.title, effectivePrice });
        totalAmount += effectivePrice;
      }

      // Notify admin
      const orderSummary = createdOrders.map(o => `${o.listingTitle} HKD ${o.effectivePrice.toFixed(2)}`).join("、");
      await notifyAdmin({
        title: `支付寶 HK 批量訂單待審核 💰（${createdOrders.length} 件）`,
        content: `買家已提交支付寶 HK 付款，共 ${createdOrders.length} 個訂單，合計 HKD ${totalAmount.toFixed(2)}。商品：${orderSummary}。請前往管理後台審核。`,
      }).catch(() => {});

      console.log(`[createBatchAlipayOrder] Created ${createdOrders.length} orders, total HKD ${totalAmount}`);
      return { orderNos: createdOrders.map(o => o.orderNo), totalAmount, firstOrderNo: createdOrders[0]?.orderNo };
    }),

  // Get single order by orderNo (for detail page)
  getOrderByNo: protectedProcedure
    .input(z.object({ orderNo: z.string() }))
    .query(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderByNo(input.orderNo);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      // Only buyer or seller can view
      const isBuyer = order.buyerId === ctx.user.id;
      const sellerProfile = order.sellerId ? await getSellerProfileById(order.sellerId) : null;
      const isSeller = !!(sellerProfile?.userId === ctx.user.id);
      if (!isBuyer && !isSeller) throw new TRPCError({ code: "FORBIDDEN" });
      const items = await getOrderItems(order.id);
      const listing = order.listingId ? await getListingById(order.listingId) : null;
      const review = await getReviewByOrderId(order.id);
      // For meetup orders that are completed, reveal contact phones
      let sellerPhone: string | null = null;
      let buyerContactPhone: string | null = null;
      const isMeetup = order.shippingMethod === 'meetup' || order.shippingAddress?.includes('面交');
      const isCompleted = order.orderStatus === 'completed';
      if (isMeetup && isCompleted) {
        // Get seller's phone
        if (sellerProfile?.userId) {
          const db = await getDb();
          if (db) {
            const sellerUserRows = await db.select({ phone: users.phone }).from(users).where(eq(users.id, sellerProfile.userId)).limit(1);
            sellerPhone = sellerUserRows[0]?.phone ?? null;
          }
        }
        // Buyer phone from order record
        buyerContactPhone = order.buyerPhone ?? null;
      }
      return { order, items, listing, review, isBuyer, isSeller, sellerPhone, buyerContactPhone, isMeetup, isCompleted };
    }),

  // ============================================================
  // SELLER - Create Listing (legacy)
  // ============================================================
  createSellerListing: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      condition: z.enum(["psa10", "psa9", "psa8_below", "bgs10", "bgs9", "bgs8_below", "tag10", "tag9_below", "raw_a", "raw_b", "raw_c", "raw_d"]),
      price: z.number().positive(),
      quantity: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile || !profile.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "你尚未成為賣家或帳號未激活" });
      }
      return { success: true };
    }),

  // ============================================================
  // PUBLIC - Banners
  // ============================================================
  getBanners: publicProcedure
    .query(async () => {
      return getActiveBanners();
    }),

  // ============================================================
  // ADMIN - Banner Management
  // ============================================================
  adminGetBanners: adminProcedure
    .query(async () => {
      return getAllBanners();
    }),

  adminCreateBanner: adminProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      subtitle: z.string().max(300).default(""),
      cta: z.string().max(100).default("立即選購"),
      ctaConditions: z.string().default("[]"),
      ctaSellerType: z.string().default("all"),
      gradient: z.string().max(200).default("from-[#06038d] via-[#1a0a9e] to-[#2d1bb5]"),
      accentColor: z.string().max(20).default("#FFD700"),
      badge: z.string().max(50).default(""),
      badgeClass: z.string().max(100).default("bg-yellow-400 text-[#06038d]"),
      emoji: z.string().max(10).default("🏆"),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      await createBanner(input);
      return { success: true };
    }),

  adminUpdateBanner: adminProcedure
    .input(z.object({
      id: z.number().int(),
      title: z.string().min(1).max(200).optional(),
      subtitle: z.string().max(300).optional(),
      cta: z.string().max(100).optional(),
      ctaConditions: z.string().optional(),
      ctaSellerType: z.string().optional(),
      gradient: z.string().max(200).optional(),
      accentColor: z.string().max(20).optional(),
      badge: z.string().max(50).optional(),
      badgeClass: z.string().max(100).optional(),
      emoji: z.string().max(10).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateBanner(id, data);
      return { success: true };
    }),

  adminDeleteBanner: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await deleteBanner(input.id);
      return { success: true };
    }),

  // ============================================================
  // PROTECTED - Wishlist
  // ============================================================
  getMyWishlist: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserWishlist(ctx.user.id);
    }),

  getWishlistIds: protectedProcedure
    .query(async ({ ctx }) => {
      return getWishlistListingIds(ctx.user.id);
    }),

  toggleWishlist: protectedProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const already = await isInWishlist(ctx.user.id, input.listingId);
      if (already) {
        await removeFromWishlistListing(ctx.user.id, input.listingId);
        return { wishlisted: false };
      } else {
        await addToWishlistListing(ctx.user.id, input.listingId);
        return { wishlisted: true };
      }
    }),

  // ============================================================
  // BUYER - Upload Dispute Evidence Images
  // ============================================================
  uploadDisputeEvidence: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      fileBase64: z.string(), // base64 encoded file (image or video)
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      // Determine file extension from MIME type (support images and videos)
      const mimeExtMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/quicktime": "mov",
        "video/x-msvideo": "avi",
      };
      const ext = mimeExtMap[input.mimeType] ?? "bin";
      const key = `dispute-evidence/${order.orderNo}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { success: true, url, mimeType: input.mimeType };
    }),

  // ============================================================
  // BUYER - Dispute Handling
  // ============================================================
  openDispute: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      reason: z.string().min(10).max(1000),
      evidenceUrls: z.array(z.string().url()).max(3).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const allowedStatuses = ["shipped", "delivered", "payment_received", "processing"];
      if (!allowedStatuses.includes(order.orderStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單狀態不允許申請爭議" });
      }
      if (order.orderStatus === "disputed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單已在爭議處理中" });
      }
      // Enforce 7-day dispute window: can only open dispute within 7 days of shipment
      if (order.shippedAt) {
        const DISPUTE_WINDOW_DAYS = 7;
        const shippedDate = new Date(order.shippedAt);
        const deadlineDate = new Date(shippedDate);
        deadlineDate.setDate(deadlineDate.getDate() + DISPUTE_WINDOW_DAYS);
        if (new Date() > deadlineDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `爭議申請期限已過（出貨後 ${DISPUTE_WINDOW_DAYS} 天內），如有問題請聯絡客服` });
        }
      }
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "disputed",
        payoutStatus: "hold",  // Lock payout during dispute — prevents auto-complete from transferring funds
        disputeOpenedAt: new Date(),
        disputeReason: input.reason,
        disputeEvidenceUrls: input.evidenceUrls ? JSON.stringify(input.evidenceUrls) : null,
      });
      // Notify admin
      await notifyAdmin({
        title: "新爭議申請 ⚠️",
        content: `訂單 ${order.orderNo} 買家申請爭議。原因：${input.reason}`,
      }).catch(() => {});
      // Notify seller (use sellerProfile.userId, NOT order.sellerId)
      let disputeSellerUserId: number | undefined;
      if (order.sellerId) {
        const disputeNotifySellerProf = await getSellerProfileById(order.sellerId);
        if (disputeNotifySellerProf?.userId) {
          disputeSellerUserId = disputeNotifySellerProf.userId;
          await createNotification({
            userId: disputeNotifySellerProf.userId,
            type: "trade",
            title: "訂單爭議申請 ⚠️",
            body: `訂單 ${order.orderNo} 買家已申請爭議，請等待管理員處理。`,
            linkUrl: "/seller",
          }).catch(() => {});
        }
      }
      // Send dispute opened emails to buyer and seller
      ;(async () => {
        try {
          const { sendOrderEmail, buildDisputeOpenedBuyerEmail, buildDisputeOpenedSellerEmail, getOrderEmailData } = await import("../emailService");
          const emailData = await getOrderEmailData(order);
          // Email buyer: dispute received confirmation
          const { subject: bs, html: bh } = buildDisputeOpenedBuyerEmail({
            orderNo: order.orderNo,
            itemName: emailData.itemName,
            priceHkd: emailData.priceHkd,
            reason: input.reason,
          });
          await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `dispute_opened_buyer_${order.id}` });
          // Email seller: dispute notification
          if (disputeSellerUserId) {
            const { subject: ss, html: sh } = buildDisputeOpenedSellerEmail({
              orderNo: order.orderNo,
              itemName: emailData.itemName,
              priceHkd: emailData.priceHkd,
              reason: input.reason,
            });
            await sendOrderEmail({ userId: disputeSellerUserId, subject: ss, html: sh, emailType: 'order', dedupeKey: `dispute_opened_seller_${order.id}` });
          }
        } catch (emailErr: any) {
          console.warn("[Dispute] Opened email failed:", emailErr.message);
        }
      })();
      return { success: true };
    }),

  // ============================================================
  // BUYER - Cancel Order (pending_payment only)
  // ============================================================
  buyerCancelOrder: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      reason: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "訂單不存在" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "只有買家可以取消訂單" });
      if (order.orderStatus !== "pending_payment") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有待付款的訂單可以取消" });
      }

      // ── Find all orders in the same batch (batchRef) ──────────────────────────
      // When a buyer checks out multiple items together, they share a batchRef.
      // Cancelling one order should cancel ALL pending_payment orders in the batch.
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      let batchOrderIds: number[] = [input.orderId];
      if (order.batchRef) {
        const batchOrders = await db.select({ id: marketplaceOrders.id, orderNo: marketplaceOrders.orderNo })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.batchRef, order.batchRef),
              eq(marketplaceOrders.buyerId, ctx.user.id),
              eq(marketplaceOrders.orderStatus, 'pending_payment')
            )
          );
        batchOrderIds = batchOrders.map(o => o.id);
        console.log(`[BuyerCancel] batchRef=${order.batchRef}, cancelling ${batchOrderIds.length} orders: ${batchOrders.map(o => o.orderNo).join(', ')}`);
      }

      // ── Cancel all orders in the batch ────────────────────────────────────────
      for (const orderId of batchOrderIds) {
        const targetOrder = orderId === input.orderId ? order : await getMarketplaceOrderById(orderId);
        if (!targetOrder) continue;

        await updateMarketplaceOrder(orderId, {
          orderStatus: "cancelled",
          paymentStatus: "cancelled",
          alipayProofImageUrl: null,
          aiVerificationResult: null,
        });

        // Cancel the associated accepted offer
        try {
          await db.update(offers)
            .set({ status: "cancelled", respondedAt: new Date() })
            .where(and(eq(offers.orderId, orderId), eq(offers.status, "accepted")));
        } catch (offerErr: any) {
          console.warn(`[BuyerCancel] Failed to cancel offer for order ${orderId}:`, offerErr.message);
        }

        // Restore listing stock (handles reserved → active and sold → active)
        if (targetOrder.listingId) {
          try {
            await restoreListingStock(targetOrder.listingId, targetOrder.quantity ?? 1);
            console.log(`[BuyerCancel] Restored stock for listing ${targetOrder.listingId} (order ${targetOrder.orderNo})`);
          } catch (stockErr: any) {
            console.warn(`[BuyerCancel] Failed to restore stock for listing ${targetOrder.listingId}:`, stockErr.message);
          }
        }
      }

      // ── Notify admin ──────────────────────────────────────────────────────────
      const cancelledCount = batchOrderIds.length;
      const batchNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';
      await notifyAdmin({
        title: "買家取消訂單",
        content: `訂單 ${order.orderNo} 已由買家取消${batchNote}。${input.reason ? `原因：${input.reason}` : ""}`,
      }).catch(() => {});

      // ── Send cancellation email for EACH order in the batch ────────────────────
      // Each order gets its own email so the buyer knows exactly which items were cancelled.
      // The FIRST email in a batch also includes a full list of all cancelled items.
      try {
        const { sendOrderEmail, buildOrderCancelledEmail, getOrderEmailData } = await import("../emailService");
        const batchCount = batchOrderIds.length;
        // Pre-fetch all batch order email data for the cancelledItems list in the first email
        const allBatchEmailData: Array<{ orderNo: string; itemName: string; priceHkd: string }> = [];
        if (batchCount > 1) {
          for (const bId of batchOrderIds) {
            const bOrder = bId === input.orderId ? order : await getMarketplaceOrderById(bId);
            if (!bOrder) continue;
            try {
              const bData = await getOrderEmailData(bOrder);
              allBatchEmailData.push({ orderNo: bOrder.orderNo, itemName: bData.itemName, priceHkd: bData.priceHkd });
            } catch { /* skip */ }
          }
        }
        for (let batchIndex = 0; batchIndex < batchOrderIds.length; batchIndex++) {
          const orderId = batchOrderIds[batchIndex];
          const targetOrder = orderId === input.orderId ? order : await getMarketplaceOrderById(orderId);
          if (!targetOrder) continue;
          try {
            const emailData = await getOrderEmailData(targetOrder);
            const { subject, html } = buildOrderCancelledEmail({
              orderNo: targetOrder.orderNo,
              itemName: emailData.itemName,
              priceHkd: emailData.priceHkd,
              note: input.reason ?? "買家主動取消",
              batchCount,
              batchIndex,
              // First email gets the full cancelled items list
              cancelledItems: batchIndex === 0 && allBatchEmailData.length > 1 ? allBatchEmailData : undefined,
            });
            await sendOrderEmail({
              userId: targetOrder.buyerId,
              subject,
              html,
              emailType: 'order',
              dedupeKey: `order_cancelled_buyer_${targetOrder.id}`,
            });
          } catch (singleEmailErr: any) {
            console.warn(`[BuyerCancel] Email failed for order ${targetOrder.orderNo}:`, singleEmailErr.message);
          }
        }
      } catch (emailErr: any) {
        console.warn("[BuyerCancel] Email batch failed:", emailErr.message);
      }

      return { success: true, cancelledCount };
    }),

  // ============================================================
  // ADMIN - Resolve Dispute
  // ============================================================
  adminResolveDispute: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      resolution: z.string().min(5).max(1000),
      outcome: z.enum(["refund_buyer", "release_seller", "partial"]),
      adminNote: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { orderId, resolution, outcome, adminNote } = input;
      const order = await getMarketplaceOrderById(orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.orderStatus !== "disputed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單不在爭議狀態" });
      }
      // Determine final order status based on outcome
      const finalStatus = outcome === "refund_buyer" ? "cancelled" : "completed";
      // Build resolution history entry
      const historyEntry = {
        timestamp: new Date().toISOString(),
        outcome,
        resolution,
        adminNote: adminNote ?? null,
      };
      const existingHistory: any[] = (() => {
        try { return order.disputeResolutionHistory ? JSON.parse(order.disputeResolutionHistory as string) : []; }
        catch { return []; }
      })();
      const newHistory = JSON.stringify([...existingHistory, historyEntry]);
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: finalStatus,
        disputeResolvedAt: new Date(),
        disputeResolution: `[${input.outcome}] ${input.resolution}`,
        disputeResolutionHistory: newHistory,
        payoutStatus: input.outcome === "release_seller" ? "processing" : "failed",
      });
      // If refunding buyer, trigger Stripe Refund and restore listing stock
      if (input.outcome === "refund_buyer") {
        // Restore listing stock (uses restoreListingStock which also sets status=active)
        if (order.listingId) {
          await restoreListingStock(order.listingId, 1);
          console.log(`[Dispute] Listing ${order.listingId} stock restored after refund`);
        }
        if (order.stripePaymentIntentId) {
          try {
            const stripe = getStripe();
            await stripe.refunds.create({
              payment_intent: order.stripePaymentIntentId,
              metadata: { order_no: order.orderNo, dispute_resolved: "refund_buyer" },
            });
            console.log(`[Dispute] Stripe refund created for order ${order.orderNo}`);
          } catch (err: any) {
            console.error(`[Dispute] Stripe refund failed for order ${order.orderNo}:`, err.message);
          }
        }
      }
      // If releasing to seller, trigger payout via centralized executeSellerPayout
      let disputeSellerUserId: number | null = null;
      if (order.sellerType === "seller" && order.sellerId) {
        const sellerProfile = await getSellerProfileById(order.sellerId);
        disputeSellerUserId = sellerProfile?.userId ?? null;
        if (input.outcome === "release_seller") {
          try {
            const { executeSellerPayout } = await import("../sellerPayout");
            const payoutResult = await executeSellerPayout(input.orderId);
            if (payoutResult.success) {
              console.log(`[Dispute] Payout transfer ${payoutResult.transferId} for order ${order.orderNo}`);
            } else {
              console.error(`[Dispute] Payout failed for order ${order.orderNo}: ${payoutResult.error}`);
            }
          } catch (err) {
            console.error("[Dispute] executeSellerPayout threw:", err);
          }
        }
      }
      // Notify buyer
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "爭議已處理 ✅",
        body: `訂單 ${order.orderNo} 的爭議已由管理員處理。結果：${input.resolution}`,
        linkUrl: "/orders",
      }).catch(() => {});
      // Notify seller (use sellerProfile.userId, NOT order.sellerId)
      if (disputeSellerUserId) {
        await createNotification({
          userId: disputeSellerUserId,
          type: "trade",
          title: "爭議已處理 ✅",
          body: `訂單 ${order.orderNo} 的爭議已由管理員處理。`,
          linkUrl: "/seller",
        }).catch(() => {});
      }
      // Send email based on dispute outcome
      try {
        const { sendOrderEmail, buildOrderRefundedEmail, buildOrderCompletedBuyerEmail, buildOrderCompletedSellerEmail, buildDisputeResolvedSellerEmail, getOrderEmailData } = await import("../emailService");
        const emailData = await getOrderEmailData(order);
        if (input.outcome === "refund_buyer") {
          // Refund email to buyer
          const { subject, html } = buildOrderRefundedEmail({
            orderNo: order.orderNo,
            itemName: emailData.itemName,
            priceHkd: emailData.priceHkd,
            note: input.resolution,
          });
          await sendOrderEmail({ userId: order.buyerId, subject, html, emailType: 'order', dedupeKey: `dispute_resolved_refund_${order.id}` });
          // Notify seller: dispute lost (refund to buyer)
          if (disputeSellerUserId) {
            const { subject: ss, html: sh } = buildDisputeResolvedSellerEmail({
              orderNo: order.orderNo,
              itemName: emailData.itemName,
              priceHkd: emailData.priceHkd,
              resolution: input.resolution,
              outcome: "refund_buyer",
            });
            await sendOrderEmail({ userId: disputeSellerUserId, subject: ss, html: sh, emailType: 'order', dedupeKey: `dispute_resolved_seller_refund_${order.id}` });
          }
        } else if (input.outcome === "release_seller") {
          // Completed email to buyer
          const { subject: bs, html: bh } = buildOrderCompletedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
          await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `order_completed_buyer_${order.id}` });
          // Notify seller: dispute won (order completed, payout processing)
          if (disputeSellerUserId) {
            const { subject: ss, html: sh } = buildDisputeResolvedSellerEmail({
              orderNo: order.orderNo,
              itemName: emailData.itemName,
              priceHkd: emailData.priceHkd,
              resolution: input.resolution,
              outcome: "release_seller",
              receivableHkd: emailData.receivableHkd,
            });
            await sendOrderEmail({ userId: disputeSellerUserId, subject: ss, html: sh, emailType: 'order', dedupeKey: `dispute_resolved_seller_release_${order.id}` });
          }
        } else if (input.outcome === "partial") {
          // Partial: notify both parties
          const { subject: bs, html: bh } = buildOrderRefundedEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, note: input.resolution });
          await sendOrderEmail({ userId: order.buyerId, subject: bs, html: bh, emailType: 'order', dedupeKey: `dispute_resolved_partial_buyer_${order.id}` });
          if (disputeSellerUserId) {
            const { subject: ss, html: sh } = buildDisputeResolvedSellerEmail({
              orderNo: order.orderNo,
              itemName: emailData.itemName,
              priceHkd: emailData.priceHkd,
              resolution: input.resolution,
              outcome: "partial",
            });
            await sendOrderEmail({ userId: disputeSellerUserId, subject: ss, html: sh, emailType: 'order', dedupeKey: `dispute_resolved_seller_partial_${order.id}` });
          }
        }
       } catch (emailErr: any) {
        console.warn("[Dispute] Resolve email failed:", emailErr.message);
      }
      // AT1: Audit log
      await createAuditLog({ adminId: ctx.user.id, action: `resolve_dispute_${input.outcome}`, targetType: 'order', targetId: input.orderId, details: JSON.stringify({ orderNo: order.orderNo, outcome: input.outcome, resolution: input.resolution }) });
      return { success: true };
    }),
  adminGetDisputes: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      search: z.string().optional(),
      status: z.enum(['pending', 'resolved', 'all']).default('pending'),
    }))
    .query(async ({ input }) => {
      return getDisputedOrders(input.page, input.pageSize, input.search, input.status);
    }),

  // Export payout records as CSV
  adminExportPayoutsCsv: adminProcedure
    .input(z.object({
      month: z.string().optional(), // 'YYYY-MM' format, defaults to current month
      paymentMethod: z.enum(['all', 'alipay_hk', 'stripe']).default('all'),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { alias } = await import('drizzle-orm/mysql-core');
      const sellerAlias = alias(users, 'sellerAlias');
      // Determine date range
      let fromDate: Date;
      let toDate: Date;
      if (input.month) {
        const [year, mon] = input.month.split('-').map(Number);
        fromDate = new Date(year, mon - 1, 1);
        toDate = new Date(year, mon, 1);
      } else {
        const now = new Date();
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
      const conditions: any[] = [
        eq(marketplaceOrders.payoutStatus, 'paid'),
        isNotNull(marketplaceOrders.manualPayoutAt),
        sql`${marketplaceOrders.manualPayoutAt} >= ${fromDate}`,
        sql`${marketplaceOrders.manualPayoutAt} < ${toDate}`,
      ];
      if (input.paymentMethod !== 'all') {
        conditions.push(eq(marketplaceOrders.paymentMethod, input.paymentMethod as any));
      }
      const rows = await db.select({
        orderNo: marketplaceOrders.orderNo,
        sellerDisplayName: sellerProfiles.displayName,
        sellerUserName: sellerAlias.name,
        sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
        paymentMethod: marketplaceOrders.paymentMethod,
        manualPayoutAt: marketplaceOrders.manualPayoutAt,
        manualPayoutNote: marketplaceOrders.manualPayoutNote,
        manualPayoutProofUrl: marketplaceOrders.manualPayoutProofUrl,
      }).from(marketplaceOrders)
        .leftJoin(sellerProfiles, eq(marketplaceOrders.sellerId, sellerProfiles.id))
        .leftJoin(sellerAlias, eq(sellerProfiles.userId, sellerAlias.id))
        .where(and(...conditions))
        .orderBy(desc(marketplaceOrders.manualPayoutAt));
      return rows.map(r => ({
        orderNo: r.orderNo ?? '',
        sellerName: r.sellerDisplayName ?? r.sellerUserName ?? '平台',
        amountHkd: parseFloat(r.sellerReceivableHkd as string ?? '0').toFixed(2),
        paymentMethod: r.paymentMethod === 'alipay_hk' ? '支付寶 HK' : 'Stripe',
        payoutDate: r.manualPayoutAt ? new Date(r.manualPayoutAt).toLocaleDateString('zh-HK') : '',
        note: r.manualPayoutNote ?? '',
        proofUrl: r.manualPayoutProofUrl ?? '',
      }));
    }),

  adminBatchUpdateListingStatus: adminProcedure
    .input(z.object({
      ids: z.array(z.number().int()).min(1).max(100),
      status: z.enum(["active", "removed", "pending_review"]),
      rejectedReason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { ids, status, rejectedReason } = input;
      // Fetch all listings to send notifications
      const listings = await db.select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        sellerType: marketplaceListings.sellerType,
        sellerId: marketplaceListings.sellerId,
        status: marketplaceListings.status,
      }).from(marketplaceListings)
        .where(sql`${marketplaceListings.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      // Batch update
      const updatePayload: Record<string, any> = { status };
      if (rejectedReason) updatePayload.rejectedReason = rejectedReason;
      await db.update(marketplaceListings)
        .set(updatePayload)
        .where(sql`${marketplaceListings.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      // Send notifications to affected sellers
      let notified = 0;
      for (const listing of listings) {
        if (listing.sellerType === 'seller' && listing.sellerId && listing.status !== status) {
          const sellerProfile = await getSellerProfileById(listing.sellerId);
          if (sellerProfile?.userId) {
            if (status === 'active') {
              await createNotification({
                userId: sellerProfile.userId,
                type: 'trade',
                title: '商品審核通過 ✅',
                body: `您的商品「${listing.title}」已通過審核，現已上架！`,
                linkUrl: `/marketplace/${listing.id}`,
              }).catch(() => {});
              notified++;
            } else if (status === 'removed') {
              await createNotification({
                userId: sellerProfile.userId,
                type: 'trade',
                title: '商品已下架 ❌',
                body: `您的商品「${listing.title}」已被下架。${rejectedReason ? `原因：${rejectedReason}` : ''}`,
                linkUrl: `/seller`,
              }).catch(() => {});
              notified++;
            }
          }
        }
      }
      return { success: true, updated: ids.length, notified };
    }),

  // ============================================================
  // REVIEW SYSTEM
  // ============================================================
  submitReview: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
      isAnonymous: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.orderStatus !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只有已完成的訂單才能評價" });
      }
      if (!order.sellerId) throw new TRPCError({ code: "BAD_REQUEST", message: "平台商品不支援評價" });
      // Check if already reviewed
      const existing = await getReviewByOrderId(input.orderId);
      if (existing) throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單已評價過" });
       await createReview({
        orderId: input.orderId,
        listingId: order.listingId!,
        buyerId: ctx.user.id,
        sellerId: order.sellerId,
        rating: input.rating,
        comment: input.comment ?? null,
        isAnonymous: input.isAnonymous ?? false,
      });
      // Notify seller of new review
      const reviewSellerProf = await getSellerProfileById(order.sellerId);
      if (reviewSellerProf?.userId) {
        await createNotification({
          userId: reviewSellerProf.userId,
          type: "trade",
          title: `您收到一則新評價 ${'⭐'.repeat(input.rating)}`,
          body: `買家對訂單 ${order.orderNo} 給了 ${input.rating} 星評價${input.comment ? `：${input.comment.slice(0, 50)}` : ''}`,
          linkUrl: "/seller",
        }).catch(() => {});
        try {
          const { sendOrderEmail, buildNewReviewSellerEmail, getOrderEmailData } = await import("../emailService");
          const emailData = await getOrderEmailData(order);
          const { subject, html } = buildNewReviewSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, rating: input.rating, comment: input.comment });
          await sendOrderEmail({ userId: reviewSellerProf.userId, subject, html, emailType: 'seller' });
        } catch (emailErr: any) { console.warn("[submitReview] seller email failed:", emailErr.message); }
      }
      return { success: true };
    }),
  getSellerReviews: publicProcedure
    .input(z.object({
      sellerId: z.number().int(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      return getSellerReviews(input.sellerId, input.page, input.pageSize);
    }),

  getOrderReview: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getReviewByOrderId(input.orderId);
    }),

  // ============================================================
  // PROTECTED - Shipping Addresses
  // ============================================================
  getMyShippingAddresses: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserShippingAddresses(ctx.user.id);
    }),

  getMyDefaultShippingAddress: protectedProcedure
    .query(async ({ ctx }) => {
      return getUserDefaultShippingAddress(ctx.user.id);
    }),

  addShippingAddress: protectedProcedure
    .input(z.object({
      label: z.string().max(50).default("預設地址"),
      addressType: z.enum(["normal", "sf_station"]).default("normal"),
      recipientName: z.string().min(1).max(100),
      phone: z.string().min(1).max(30),
      address: z.string().max(255).default(""),
      district: z.string().max(50).optional(),
      region: z.string().max(50).default("香港"),
      sfStationCode: z.string().max(20).optional(),
      sfStationName: z.string().max(100).optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate based on address type
      if (input.addressType === "normal" && !input.address.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "請填寫詳細地址" });
      }
      if (input.addressType === "sf_station" && !input.sfStationCode?.trim()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "請填寫順豐自提站編號" });
      }
      await createUserShippingAddress({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  updateShippingAddress: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      label: z.string().max(50).optional(),
      addressType: z.enum(["normal", "sf_station"]).optional(),
      recipientName: z.string().min(1).max(100).optional(),
      phone: z.string().min(1).max(30).optional(),
      address: z.string().max(255).optional(),
      district: z.string().max(50).optional(),
      region: z.string().max(50).optional(),
      sfStationCode: z.string().max(20).optional(),
      sfStationName: z.string().max(100).optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateUserShippingAddress(id, ctx.user.id, data);
      return { success: true };
    }),

  deleteShippingAddress: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await deleteUserShippingAddress(input.id, ctx.user.id);
      return { success: true };
    }),

  setDefaultShippingAddress: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await setDefaultShippingAddress(input.id, ctx.user.id);
      return { success: true };
    }),

  // ============================================================
  // OFFERS - Buyer makes price offers on listings
  // ============================================================
  makeOffer: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      offerPriceHkd: z.number().positive(),
      message: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      if (listing.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "商品已下架" });
      // Check if listing allows offers
      if (!listing.allowOffers) throw new TRPCError({ code: "BAD_REQUEST", message: "此商品不接受出價" });
      if (!listing.sellerId) throw new TRPCError({ code: "BAD_REQUEST", message: "平台商品不支持出價" });
      const minOffer = listing.minOfferHkd ? parseFloat(listing.minOfferHkd as string) : 0;
      if (minOffer > 0 && input.offerPriceHkd < minOffer) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `出價不得低於 HKD ${minOffer}` });
      }
      const sellerProfile = await getSellerProfileById(listing.sellerId);
      if (!sellerProfile) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });

      // UX1: Rate limit — max 3 offers per listing per buyer per 24 hours
      const recentOffers = await getListingOffers(input.listingId);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const myRecentOffers = recentOffers.filter(
        (o: any) => o.buyerId === ctx.user.id && new Date(o.createdAt) > twentyFourHoursAgo
      );
      if (myRecentOffers.length >= 3) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "同一商品 24 小時內最多出價 3 次，請稍後再試" });
      }

      // Expire in 48 hours
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const offer = await createOffer({
        listingId: input.listingId,
        buyerId: ctx.user.id,
        sellerId: sellerProfile.userId,
        sellerProfileId: sellerProfile.id,
        offerPriceHkd: input.offerPriceHkd.toFixed(2),
        message: input.message,
        status: "pending",
        expiresAt,
      });
      // Notify seller (in-app)
      await createNotification({
        userId: sellerProfile.userId,
        type: "offer",
        title: "收到新出價 💰",
        body: `有買家對「${listing.title}」出價 HKD ${input.offerPriceHkd}，請在 48 小時內回應。`,
        linkUrl: "/seller",
        relatedId: offer.id,
      }).catch(() => {});
      // Send email notification to seller (admin does not need to be notified for individual offers)
      ;(async () => {
        try {
          const { getDb: _getDb } = await import("../db");
          const db = await _getDb();
          if (!db) return;
          const { users: usersTable } = await import("../../drizzle/schema_new");
          const sellerUsers = await db.select().from(usersTable).where(eq(usersTable.id, sellerProfile.userId)).limit(1);
          const sellerUser = sellerUsers[0];
          if (!sellerUser?.email) return;
          const expiresAtStr = expiresAt.toLocaleString("zh-TW", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) + " (HKT)";
          const { subject, html } = buildNewOfferEmail({
            sellerName: sellerUser.name || "賣家",
            buyerName: ctx.user.name || "買家",
            cardName: listing.title,
            offerAmountHkd: input.offerPriceHkd.toFixed(2),
            listingPriceHkd: listing.priceHkd ? String(listing.priceHkd) : "—",
            expiresAt: expiresAtStr,
            sellerDashboardUrl: `${ctx.req.headers.origin || "https://boxium.asia"}/seller`,
          });
          await sendEmail({ to: sellerUser.email, subject, html, emailType: 'offer', toUserId: sellerProfile.userId, dedupeKey: `offer_new_seller_${offer.id}` });
        } catch (e) {
          console.error("[makeOffer] Email send failed:", e);
        }
      })();
      // UX1: Outbid notification — notify other pending bidders that a higher offer was placed
      const pendingOffers = recentOffers.filter(
        (o: any) => o.status === "pending" && o.buyerId !== ctx.user.id && parseFloat(o.offerPriceHkd) < input.offerPriceHkd
      );
      const notifiedBuyerIds = new Set<number>();
      for (const prevOffer of pendingOffers) {
        if (notifiedBuyerIds.has(prevOffer.buyerId)) continue;
        notifiedBuyerIds.add(prevOffer.buyerId);
        await createNotification({
          userId: prevOffer.buyerId,
          type: "offer",
          title: "你的出價已被超越 📈",
          body: `有人對「${listing.title}」出了更高價格 HKD ${input.offerPriceHkd}，你的出價 HKD ${prevOffer.offerPriceHkd} 可能不再具競爭力。`,
          linkUrl: `/shop/${listing.id}`,
          relatedId: offer.id,
        }).catch(() => {});
      }

      return offer;
    }),

  getMyOffers: protectedProcedure
    .query(async ({ ctx }) => {
      return getBuyerOffers(ctx.user.id);
    }),

  getMyOfferForListing: protectedProcedure
    .input(z.object({ listingId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      // Return the buyer's most recent pending or accepted offer for this listing
      const allOffers = await getBuyerOffers(ctx.user.id);
      // Priority: accepted (needs payment) > pending (awaiting seller response)
      const acceptedOffer = allOffers.find(
        (o) => o.listingId === input.listingId && o.status === "accepted"
      );
      if (acceptedOffer) return acceptedOffer;
      const pendingOffer = allOffers.find(
        (o) => o.listingId === input.listingId && o.status === "pending"
      );
      return pendingOffer ?? null;
    }),

  getSellerOffers: protectedProcedure
    .query(async ({ ctx }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerOffers(seller.id);
    }),

  cancelOffer: protectedProcedure
    .input(z.object({ offerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await getOfferById(input.offerId);
      if (!offer) throw new TRPCError({ code: "NOT_FOUND", message: "出價不存在" });
      if (offer.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "無權限取消此出價" });
      if (offer.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "只能取消待回覆的出價" });
      await updateOffer(offer.id, { status: "cancelled", respondedAt: new Date() });
      return { success: true };
    }),

  respondToOffer: protectedProcedure
    .input(z.object({
      offerId: z.number().int(),
      action: z.enum(["accept", "reject"]),
      rejectionReason: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const offer = await getOfferById(input.offerId);
      if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (!sellerProfile || offer.sellerProfileId !== sellerProfile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (offer.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "此出價已處理" });
      if (new Date() > offer.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "出價已過期" });

      if (input.action === "reject") {
        await updateOffer(offer.id, { status: "rejected", respondedAt: new Date(), rejectionReason: input.rejectionReason });
        await createNotification({
          userId: offer.buyerId,
          type: "trade",
          title: "出價被拒絕 ❌",
          body: `你對商品的出價 HKD ${offer.offerPriceHkd} 已被賣家拒絕。${input.rejectionReason ? `原因：${input.rejectionReason}` : ""}`,
          linkUrl: "/orders",
        }).catch(() => {});
        // Email buyer: offer rejected
        ;(async () => {
          try {
            const { sendEmail: _sendEmail } = await import("../emailService");
            const { getUserById: _getUser } = await import("../userManagement");
            const buyerUser = await _getUser(offer.buyerId);
            if (!buyerUser?.email) return;
            const listing = await getListingById(offer.listingId);
            const origin = (ctx.req.headers.origin as string) || "https://boxium.asia";
            const subject = `❌ 出價未獲接受 — ${listing?.title || "商品"}`;
            const { wrapHtml: _wrapHtml, ctaButton: _ctaButton } = await import("../emailService") as any;
            // Build simple rejection email inline
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#1a0dab;padding:24px 32px;text-align:center;"><img src="https://static.manus.space/webdev/boxiumptcg-mua4eq38/boxium-logo-white.png" alt="BOXIUM PTCG" height="40" style="display:block;margin:0 auto;"></td></tr><tr><td style="padding:32px;"><h2 style="margin:0 0 8px;color:#1a0dab;font-size:22px;">出價未獲接受 ❌</h2><p style="color:#555;font-size:15px;">親愛的 <strong>${buyerUser.name || "買家"}</strong>，<br/>很遺憾，您對商品 <strong>${listing?.title || ""}</strong> 的出價 <strong>HKD ${offer.offerPriceHkd}</strong> 未獲賣家接受。${input.rejectionReason ? `<br/><br/><strong>原因：</strong>${input.rejectionReason}` : ""}</p><p style="color:#555;font-size:14px;">您可以繼續瀏覽市集，尋找其他心儀商品。</p><div style="text-align:center;margin:24px 0;"><a href="${origin}/marketplace" style="background:#1a0dab;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">前往市集</a></div></td></tr><tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:12px;color:#999;">如有疑問，請聯絡 <a href="mailto:boxium.asia@gmail.com" style="color:#1a0dab;">boxium.asia@gmail.com</a></p></td></tr></table></td></tr></table></body></html>`;
            await _sendEmail({ to: buyerUser.email, subject, html, emailType: 'offer', toUserId: offer.buyerId, dedupeKey: `offer_rejected_buyer_${offer.id}` });
          } catch (e) {
            console.warn("[respondToOffer] Rejection email failed:", e);
          }
        })();
        return { success: true, action: "rejected" };
      }

      // Accept: create order at offer price
      const listing = await getListingById(offer.listingId);
      if (!listing || listing.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "商品已下架" });
      // Atomic stock reservation — prevents overselling under concurrent requests
      const reserved = await reserveListingStock(listing.id, 1);
      if (!reserved) throw new TRPCError({ code: "BAD_REQUEST", message: "庫存不足，商品可能已被其他買家搶購" });
      const offerPrice = parseFloat(offer.offerPriceHkd as string);
      // Platform fee is deducted from seller's payout (buyer pays offer price only)
      // Platform-owned listings are exempt from platform fees
      const feeRateOffer = await getPlatformFeeRate();
      const platformFee = calcPlatformFeeWithRate(listing.sellerType, offerPrice, feeRateOffer);
      const orderNo = await generateOrderNo();
      const order = await createMarketplaceOrder({
        orderNo,
        buyerId: offer.buyerId,
        paymentMethod: "stripe",
        paymentStatus: "pending",
        listingId: listing.id,
        sellerId: listing.sellerId ?? null,
        sellerType: listing.sellerType as any,
        unitPriceHkd: offerPrice.toFixed(2),
        quantity: 1,
        subtotalHkd: offerPrice.toFixed(2),
        platformFeeRate: feeRateOffer.toFixed(4),
        platformFeeHkd: platformFee.toFixed(2),
        sellerReceivableHkd: calcSellerReceivableWithRate(listing.sellerType, offerPrice, feeRateOffer).toFixed(2),
        orderStatus: "pending_payment",
        autoCompleteAt: null as any,
      });
      // Update offer expiresAt to payment deadline (from system settings)
      const offerPaymentHoursSetting = await getSystemSetting('offer_payment_timeout_hours');
      const offerPaymentHours = offerPaymentHoursSetting?.settingValue ? parseFloat(offerPaymentHoursSetting.settingValue) : 24;
      const offerPaymentDeadline = new Date(Date.now() + offerPaymentHours * 60 * 60 * 1000);
      await updateOffer(offer.id, { status: "accepted", respondedAt: new Date(), orderId: order.id, expiresAt: offerPaymentDeadline });
      // Create Stripe checkout for buyer
      const stripe = getStripe();
      const origin = (ctx.req.headers.origin as string) || "https://boxiumptcg-mua4eq38.manus.space";
      // Build payment_intent_data - use Destination Charge for C2C listings with active Stripe Connect
      const offerPaymentIntentData: any = {
        metadata: { orderId: order.id.toString(), orderNo, buyerId: offer.buyerId.toString(), offerId: offer.id.toString() },
      };
      // NOTE: Separate Charges and Transfers mode - funds held in platform until buyer confirms receipt
      if (listing.sellerType === "seller" && listing.sellerId) {
        const offerSellerProfile = await getSellerProfileById(listing.sellerId);
        if (offerSellerProfile?.stripeConnectId && offerSellerProfile.stripeConnectStatus === "active") {
          console.log(`[OfferCheckout] Separate Charges mode for seller ${offerSellerProfile.stripeConnectId}. Funds held until buyer confirms receipt.`);
        }
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "alipay"],
        line_items: [{ price_data: { currency: "hkd", product_data: { name: listing.title }, unit_amount: Math.round(offerPrice * 100) }, quantity: 1 }], // Buyer pays offer price only
        mode: "payment",
        customer_email: undefined,
        client_reference_id: offer.buyerId.toString(),
        metadata: { orderId: order.id.toString(), orderNo, buyerId: offer.buyerId.toString(), offerId: offer.id.toString() },
        payment_intent_data: offerPaymentIntentData,
        success_url: `${origin}/orders?payment=success&orderNo=${orderNo}`,
        cancel_url: `${origin}/shop/${listing.id}`,
        allow_promotion_codes: true,
      });
      await updateMarketplaceOrder(order.id, { stripeSessionId: session.id });
      // Notify buyer - link directly to listing page so they can use payment buttons
      await createNotification({
        userId: offer.buyerId,
        type: "trade",
        title: "出價被接受 ✅",
        body: `賣家接受了你的出價 HKD ${offer.offerPriceHkd}！請在 24 小時內完成付款，點擊前往商品頁。`,
        linkUrl: `/shop/${offer.listingId}`,
      }).catch(() => {});
      // Email buyer: offer accepted
      ;(async () => {
        try {
          const { sendEmail: _sendEmail } = await import("../emailService");
          const { getUserById: _getUser } = await import("../userManagement");
          const buyerUser = await _getUser(offer.buyerId);
          if (!buyerUser?.email) return;
          const reqOrigin = (ctx.req.headers.origin as string) || "https://boxium.asia";
          const subject = `✅ 出價已被接受 — ${listing.title}`;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#1a0dab;padding:24px 32px;text-align:center;"><img src="https://static.manus.space/webdev/boxiumptcg-mua4eq38/boxium-logo-white.png" alt="BOXIUM PTCG" height="40" style="display:block;margin:0 auto;"></td></tr><tr><td style="padding:32px;"><h2 style="margin:0 0 8px;color:#16a34a;font-size:22px;">出價已被接受 ✅</h2><p style="color:#555;font-size:15px;">親愛的 <strong>${buyerUser.name || "買家"}</strong>，<br/>賣家已接受您對商品 <strong>${listing.title}</strong> 的出價 <strong>HKD ${offer.offerPriceHkd}</strong>！<br/>請尽快完成付款以確保訂單。</p><div style="text-align:center;margin:24px 0;"><a href="${reqOrigin}/shop/${offer.listingId}" style="background:#16a34a;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">前往商品頁付款</a></div><p style="color:#ef4444;font-size:13px;text-align:center;">⚠️ 請在 24 小時內完成付款，逾期訂單將自動取消。</p></td></tr><tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:12px;color:#999;">如有疑問，請聯絡 <a href="mailto:boxium.asia@gmail.com" style="color:#1a0dab;">boxium.asia@gmail.com</a></p></td></tr></table></td></tr></table></body></html>`;
          await _sendEmail({ to: buyerUser.email, subject, html, emailType: 'offer', toUserId: offer.buyerId, dedupeKey: `offer_accepted_buyer_${offer.id}` });
        } catch (e) {
          console.warn("[respondToOffer] Acceptance email failed:", e);
        }
      })();
      // Expire all other pending offers for this listing and notify those buyers
      ;(async () => {
        try {
          const { expireOtherPendingOffers: _expireOthers } = await import("../db");
          const expiredOffers = await _expireOthers(offer.listingId, offer.id);
          if (expiredOffers.length > 0) {
            const { sendEmail: _sendEmail2 } = await import("../emailService");
            const { getUserById: _getUser2 } = await import("../userManagement");
            for (const expiredOffer of expiredOffers) {
              // In-app notification
              await createNotification({
                userId: expiredOffer.buyerId,
                type: "trade",
                title: "出價已失效 ⚠️",
                body: `商品「${listing.title}」已被其他買家以出價方式購得，您的出價已自動失效。`,
                linkUrl: `/marketplace`,
              }).catch(() => {});
              // Email notification
              try {
                const expiredBuyer = await _getUser2(expiredOffer.buyerId);
                if (!expiredBuyer?.email) continue;
                const reqOrigin2 = (ctx.req.headers.origin as string) || "https://boxium.asia";
                const subject2 = `⚠️ 出價已失效 — ${listing.title}`;
                const html2 = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0;"><table width="600" cellpadding="0" cellspacing="0" align="center" style="background:#fff;border-radius:8px;overflow:hidden;"><tr><td style="background:#1a0dab;padding:24px 32px;text-align:center;"><img src="https://static.manus.space/webdev/boxiumptcg-mua4eq38/boxium-logo-white.png" alt="BOXIUM PTCG" height="40" style="display:block;margin:0 auto;"></td></tr><tr><td style="padding:32px;"><h2 style="margin:0 0 8px;color:#d97706;font-size:22px;">出價已失效 ⚠️</h2><p style="color:#555;font-size:15px;">親愛的 <strong>${expiredBuyer.name || "買家"}</strong>，<br/>很遺憾，商品 <strong>${listing.title}</strong> 已被其他買家以出價方式購得，您的出價已自動失效。<br/>您可以繼續在市集尋找其他心儀的商品。</p><div style="text-align:center;margin:24px 0;"><a href="${reqOrigin2}/marketplace" style="background:#1a0dab;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">前往市集</a></div></td></tr><tr><td style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;"><p style="margin:0;font-size:12px;color:#999;">如有疑問，請聯絡 <a href="mailto:boxium.asia@gmail.com" style="color:#1a0dab;">boxium.asia@gmail.com</a></p></td></tr></table></td></tr></table></body></html>`;
                await _sendEmail2({ to: expiredBuyer.email, subject: subject2, html: html2, emailType: 'offer', toUserId: expiredOffer.buyerId, dedupeKey: `offer_expired_other_buyer_${expiredOffer.id}` });
              } catch (emailErr) {
                console.warn("[respondToOffer] Other buyer expiry email failed:", emailErr);
              }
            }
          }
        } catch (e) {
          console.warn("[respondToOffer] expireOtherPendingOffers failed:", e);
        }
      })();
      return { success: true, action: "accepted", checkoutUrl: session.url, orderNo };
    }),

  // ============================================================
  // LISTING REPORTS - Buyers can report suspicious listings
  // ============================================================
  reportListing: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.enum(["fake_item", "wrong_description", "prohibited_item", "scam", "other"]),
      details: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      const report = await createListingReport({
        listingId: input.listingId,
        reporterId: ctx.user.id,
        reason: input.reason,
        details: input.details,
        status: "pending",
      });
      notifyAdmin({
        title: "新商品舉報",
        content: `商品「${listing.title}」被舉報，原因：${input.reason}。請前往管理後台處理。`,
      }).catch(() => {});
      return { success: true, reportId: report.id };
    }),

  adminGetReports: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getAdminListingReports(input);
    }),

  adminReviewReport: adminProcedure
    .input(z.object({
      reportId: z.number().int(),
      status: z.enum(["reviewed", "dismissed", "actioned"]),
      adminNote: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      await updateListingReport(input.reportId, {
        status: input.status,
        adminNote: input.adminNote,
        reviewedAt: new Date(),
      });
      return { success: true };
    }),

  // ============================================================
  // SELLER PUBLIC PROFILE
  // ============================================================
  getSellerPublicProfile: publicProcedure
    .input(z.object({ sellerId: z.number().int() }))
    .query(async ({ input }) => {
      const seller = await getSellerProfileById(input.sellerId);
      if (!seller || !seller.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });
      const listings = await getSellerListings(seller.id);
      const activeListings = listings.filter((l: any) => l.status === "active");
      const reviews = await getSellerReviews(seller.id, 1, 10);
      return {
        seller: {
          id: seller.id,
          displayName: seller.displayName,
          bio: seller.bio,
          avatarUrl: seller.avatarUrl,
          totalSales: seller.totalSales,
          avgRating: seller.avgRating,
          ratingCount: seller.ratingCount,
          memberSince: seller.createdAt,
        },
        listings: activeListings,
        reviews: reviews.reviews,
        reviewTotal: reviews.total,
      };
    }),

  // ============================================================
  // SELLER SALES STATS
  // ============================================================
  getSellerSalesStats: protectedProcedure
    .query(async ({ ctx }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return null;
      const db = await getDb();
      if (!db) return null;
      const { gte, sql: sqlFn } = await import("drizzle-orm");
      const { marketplaceOrders: ordersTable } = await import("../../drizzle/schema_new");
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      const allOrders = await db.select({
        status: ordersTable.orderStatus,
        amount: ordersTable.sellerReceivableHkd,
        createdAt: ordersTable.createdAt,
        buyerConfirmedAt: ordersTable.buyerConfirmedAt,
      }).from(ordersTable).where(eq(ordersTable.sellerId, seller.id));
      const completedOrders = allOrders.filter((o: any) => o.status === "completed");
      const pendingOrders = allOrders.filter((o: any) => ["pending_payment", "paid", "processing", "shipped"].includes(o.status));
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      // Use buyerConfirmedAt for completed orders (when revenue was actually earned)
      const thisMonthRevenue = allOrders
        .filter((o: any) => o.status === "completed" && o.buyerConfirmedAt && new Date(o.buyerConfirmedAt) >= startOfMonth)
        .reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      const lastMonthRevenue = allOrders
        .filter((o: any) => {
          if (o.status !== "completed" || !o.buyerConfirmedAt) return false;
          const d = new Date(o.buyerConfirmedAt);
          return d >= startOfLastMonth && d <= endOfLastMonth;
        })
        .reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      // Build last 6 months data (use buyerConfirmedAt for completed orders)
      const monthlyData: { month: string; revenue: number; orders: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const mCompleted = allOrders.filter((o: any) => {
          if (o.status !== "completed") return false;
          // Use buyerConfirmedAt if available, fallback to createdAt
          const d = o.buyerConfirmedAt ? new Date(o.buyerConfirmedAt) : new Date(o.createdAt);
          return d >= mStart && d <= mEnd;
        });
        const mRevenue = mCompleted.reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
        const monthLabel = `${mStart.getMonth() + 1}月`;
        monthlyData.push({ month: monthLabel, revenue: Math.round(mRevenue * 100) / 100, orders: mCompleted.length });
      }
      // Pending payout = sum of sellerReceivableHkd for orders in payment_received/processing/shipped
      const pendingPayoutOrders = allOrders.filter((o: any) => ["payment_received", "processing", "shipped"].includes(o.status));
      const pendingPayoutAmount = pendingPayoutOrders.reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      return {
        totalOrders: allOrders.length,
        completedOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        monthlyData,
        pendingPayoutAmount: Math.round(pendingPayoutAmount * 100) / 100,
        avgRating: seller.avgRating,
        ratingCount: seller.ratingCount,
      };
    }),
  // ============================================================
  // ADMIN - Batch update shipping status
  // ============================================================
  adminBatchUpdateShipping: adminProcedure
    .input(z.object({
      orderIds: z.array(z.number().int()).min(1).max(100),
      trackingNumber: z.string().max(200).optional(),
      shippingMethod: z.string().max(100).optional(),
      // Per-order tracking numbers (overrides global trackingNumber if provided)
      perOrderTracking: z.array(z.object({
        orderId: z.number().int(),
        trackingNumber: z.string().max(200),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const now = new Date();
      let successCount = 0;
      let failCount = 0;
      const trackingMap = new Map<number, string>();
      if (input.perOrderTracking) {
        input.perOrderTracking.forEach(({ orderId, trackingNumber }) => trackingMap.set(orderId, trackingNumber));
      }
      for (const orderId of input.orderIds) {
        try {
          const order = await getMarketplaceOrderById(orderId);
          if (!order) { failCount++; continue; }
          const tracking = trackingMap.get(orderId) ?? input.trackingNumber;
          const updates: Record<string, any> = {
            orderStatus: 'shipped',
            shippedAt: now,
            updatedAt: now,
          };
          if (tracking) updates.trackingNumber = tracking;
          if (input.shippingMethod) updates.shippingMethod = input.shippingMethod;
          await updateMarketplaceOrder(orderId, updates);
          // Notify buyer
          await createNotification({
            userId: order.buyerId,
            type: 'trade',
            title: '訂單已出貨 📦',
            body: `訂單 ${order.orderNo} 已出貨${tracking ? `，物流追蹤號：${tracking}` : ''}，請注意查收。`,
            linkUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          successCount++;
        } catch (err) {
          console.error(`[AdminBatchShipping] Failed for order ${orderId}:`, err);
          failCount++;
        }
      }
      return { successCount, failCount };
    }),

  // ============================================================
  // ADMIN - Batch mark orders as paid out
  // ============================================================
  adminBatchMarkPayout: adminProcedure
    .input(z.object({
      orderIds: z.array(z.number().int()).min(1).max(100),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const now = new Date();
      let successCount = 0;
      let failCount = 0;
      for (const orderId of input.orderIds) {
        try {
          const order = await getMarketplaceOrderById(orderId);
          if (!order) { failCount++; continue; }
          // Only allow payout for completed orders
          if (order.orderStatus !== 'completed') { failCount++; continue; }
          const updates: Record<string, any> = {
            payoutStatus: 'paid',
            manualPayoutAt: now,
            updatedAt: now,
          };
          if (input.note) updates.manualPayoutNote = input.note;
          await updateMarketplaceOrder(orderId, updates);
          successCount++;
        } catch (err) {
          console.error(`[AdminBatchPayout] Failed for order ${orderId}:`, err);
          failCount++;
        }
      }
      return { successCount, failCount };
    }),

  // ============================================================
  // ADMIN - Get recent orders for a listing (for timeline)
  // ============================================================
  adminGetListingOrders: adminProcedure
    .input(z.object({
      listingId: z.number().int(),
      limit: z.number().int().min(1).max(20).default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const rows = await db
        .select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          orderStatus: marketplaceOrders.orderStatus,
          payoutStatus: marketplaceOrders.payoutStatus,
          subtotalHkd: marketplaceOrders.subtotalHkd,
          sellerReceivableHkd: marketplaceOrders.sellerReceivableHkd,
          createdAt: marketplaceOrders.createdAt,
          shippedAt: marketplaceOrders.shippedAt,
          buyerId: marketplaceOrders.buyerId,
          buyerName: users.name,
          buyerEmail: users.email,
        })
        .from(marketplaceOrders)
        .leftJoin(users, eq(marketplaceOrders.buyerId, users.id))
        .where(eq(marketplaceOrders.listingId, input.listingId))
        .orderBy(desc(marketplaceOrders.createdAt))
        .limit(input.limit);
      return rows;
    }),

  // ============================================================
  // ADMIN - Get count of orders pending payout (completed but not paid out)
  // ============================================================
  // ADMIN - Order Status History
  // ============================================================
  adminGetOrderHistory: adminProcedure
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const rows = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, input.orderId))
        .orderBy(desc(orderStatusHistory.createdAt));
      return rows;
    }),

  // ============================================================
  // ADMIN - Send Message to Buyer
  // ============================================================
  adminSendBuyerMessage: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      subject: z.string().min(1).max(200),
      message: z.string().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Get order with buyer info
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到訂單' });
      // Create in-app notification for buyer
      await createNotification({
        userId: order.buyerId,
        type: 'order_message',
        title: `[Admin] ${input.subject}`,
        body: input.message,
        linkUrl: `/orders/${order.orderNo}`,
      });
      // Log to status history
      const adminUser = ctx.user;
      await db.insert(orderStatusHistory).values({
        orderId: input.orderId,
        fromStatus: order.orderStatus,
        toStatus: order.orderStatus,
        operatorId: adminUser?.id ?? null,
        operatorName: adminUser?.name ?? 'Admin',
        note: `[發送訊息給買家] 主旨: ${input.subject}`,
      });
      return { success: true };
    }),

  // ============================================================
  adminAddOrderNote: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      note: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '訂單不存在' });
      const adminUser = ctx.user;
      await db.insert(orderStatusHistory).values({
        orderId: input.orderId,
        fromStatus: order.orderStatus,
        toStatus: order.orderStatus,
        operatorId: adminUser?.id ?? null,
        operatorName: adminUser?.name ?? 'Admin',
        note: `[備注] ${input.note}`,
        entryType: 'note',
      });
      return { success: true };
    }),
  // ============================================================
  // ADMIN - Batch Add Note to Multiple Orders
  // ============================================================
  adminBatchAddNote: adminProcedure
    .input(z.object({
      orderIds: z.array(z.number().int()).min(1).max(100),
      note: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const adminUser = ctx.user;
      const orders = await db
        .select({ id: marketplaceOrders.id, orderStatus: marketplaceOrders.orderStatus })
        .from(marketplaceOrders)
        .where(inArray(marketplaceOrders.id, input.orderIds));
      if (orders.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: '找不到訂單' });
      const entries = orders.map(order => ({
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus: order.orderStatus,
        operatorId: adminUser?.id ?? null,
        operatorName: adminUser?.name ?? 'Admin',
        note: `[備注] ${input.note}`,
        entryType: 'note' as const,
      }));
      await db.insert(orderStatusHistory).values(entries);
      return { success: true, count: orders.length };
    }),
  // ============================================================
  // ADMIN - Get Order Messages (sent to buyer)
  // ============================================================
  adminGetOrderMessages: adminProcedure
    .input(z.object({ orderId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const rows = await db
        .select()
        .from(orderStatusHistory)
        .where(
          and(
            eq(orderStatusHistory.orderId, input.orderId),
            like(orderStatusHistory.note, '[發送訊息給買家]%')
          )
        )
        .orderBy(desc(orderStatusHistory.createdAt));
      return rows.map(r => ({
        ...r,
        subject: r.note?.replace(/^\[發送訊息給買家\] 主旨: /, '') ?? '',
      }));
    }),
  // ============================================================
  // Cart APIs
  addToCart: protectedProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Check listing exists and is available
      const [listing] = await db.select().from(marketplaceListings)
        .where(and(eq(marketplaceListings.id, input.listingId), eq(marketplaceListings.status, 'active')));
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND', message: '商品不存在或已下架' });
      // Check stock availability
      if ((listing.quantity ?? 0) < 1) throw new TRPCError({ code: 'BAD_REQUEST', message: '此商品庫存不足，無法加入購物車' });
      // Cannot add own listing to cart
      if (listing.sellerId === ctx.user.id) throw new TRPCError({ code: 'BAD_REQUEST', message: '不能將自己的商品加入購物車' });
      // Upsert (ignore if already in cart) — expiresAt = 14 days from now
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await db.insert(cartItems).values({ userId: ctx.user.id, listingId: input.listingId, expiresAt }).onDuplicateKeyUpdate({ set: { addedAt: sql`NOW()`, expiresAt: sql`DATE_ADD(NOW(), INTERVAL 14 DAY)` } });
      return { success: true };
    }),

  removeFromCart: protectedProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(cartItems).where(and(eq(cartItems.userId, ctx.user.id), eq(cartItems.listingId, input.listingId)));
      return { success: true };
    }),

  clearCart: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.delete(cartItems).where(eq(cartItems.userId, ctx.user.id));
      return { success: true };
    }),

  clearUnavailableCartItems: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // Find all cart items where listing is not active
      const myCartItems = await db.select({ id: cartItems.id, listingId: cartItems.listingId })
        .from(cartItems).where(eq(cartItems.userId, ctx.user.id));
      if (myCartItems.length === 0) return { removed: 0 };
      const listingIds = myCartItems.map(c => c.listingId);
      const activeListings = await db.select({ id: marketplaceListings.id })
        .from(marketplaceListings)
        .where(and(inArray(marketplaceListings.id, listingIds), eq(marketplaceListings.status, 'active')));
      const activeIds = new Set(activeListings.map(l => l.id));
      const toRemove = myCartItems.filter(c => !activeIds.has(c.listingId)).map(c => c.id);
      if (toRemove.length === 0) return { removed: 0 };
      await db.delete(cartItems).where(and(eq(cartItems.userId, ctx.user.id), inArray(cartItems.id, toRemove)));
      return { removed: toRemove.length };
    }),

  getMyCart: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const { alias: aliasFunc } = await import('drizzle-orm/mysql-core');
      const sellerUserAlias = aliasFunc(users, 'cart_seller_user');
      const rows = await db
        .select({
          cartItemId: cartItems.id,
          listingId: marketplaceListings.id,
          title: marketplaceListings.title,
          priceHkd: marketplaceListings.priceHkd,
          condition: marketplaceListings.condition,
          images: marketplaceListings.images,
          status: marketplaceListings.status,
          sellerId: marketplaceListings.sellerId,
          sellerType: marketplaceListings.sellerType,
          addedAt: cartItems.addedAt,
          expiresAt: cartItems.expiresAt,
          sellerUserPhone: sellerUserAlias.phone,
          sellerDisplayName: sellerProfiles.displayName,
        })
        .from(cartItems)
        .innerJoin(marketplaceListings, eq(cartItems.listingId, marketplaceListings.id))
        .leftJoin(sellerProfiles, eq(marketplaceListings.sellerId, sellerProfiles.id))
        .leftJoin(sellerUserAlias, eq(sellerProfiles.userId, sellerUserAlias.id))
        .where(eq(cartItems.userId, ctx.user.id))
        .orderBy(desc(cartItems.addedAt));
      // For each cart item, check if buyer has an accepted offer
      const rowsWithOffers = await Promise.all(rows.map(async (row) => {
        const acceptedOffer = await db
          .select({ id: offers.id, offerPriceHkd: offers.offerPriceHkd, expiresAt: offers.expiresAt })
          .from(offers)
          .where(and(
            eq(offers.listingId, row.listingId),
            eq(offers.buyerId, ctx.user.id),
            eq(offers.status, 'accepted')
          ))
          .limit(1);
        const offerData = acceptedOffer[0];
        // Check if accepted offer is still valid (not expired)
        const isOfferValid = offerData && offerData.expiresAt && new Date() < new Date(offerData.expiresAt);
        // Check if buyer has a pending_payment order for this listing
        const pendingOrder = await db
          .select({ id: marketplaceOrders.id, orderNo: marketplaceOrders.orderNo })
          .from(marketplaceOrders)
          .where(and(
            eq(marketplaceOrders.listingId, row.listingId),
            eq(marketplaceOrders.buyerId, ctx.user.id),
            eq(marketplaceOrders.orderStatus, 'pending_payment')
          ))
          .limit(1);
        return {
          ...row,
          acceptedOfferId: isOfferValid ? (offerData?.id ?? null) : null,
          acceptedOfferPrice: isOfferValid ? (offerData?.offerPriceHkd ?? null) : null,
          acceptedOfferExpiresAt: offerData?.expiresAt ?? null,
          isOfferExpired: offerData && !isOfferValid ? true : false,
          hasPendingOrder: pendingOrder.length > 0,
          pendingOrderNo: pendingOrder[0]?.orderNo ?? null,
        };
      }));
      return rowsWithOffers;
    }),

  getCartCount: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { count: 0 };
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(cartItems).where(eq(cartItems.userId, ctx.user.id));
      return { count: Number(row?.count ?? 0) };
    }),

  isInCart: protectedProcedure
    .input(z.object({ listingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return false;
      const [row] = await db.select({ id: cartItems.id }).from(cartItems).where(
        and(eq(cartItems.userId, ctx.user.id), eq(cartItems.listingId, input.listingId))
      );
      return !!row;
    }),

  // ============================================================
  // RC2: Admin seller suspension management
  // ============================================================
  adminSuspendSeller: adminProcedure
    .input(z.object({
      sellerProfileId: z.number().int(),
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(sellerProfiles)
        .set({ isSuspended: true, suspensionReason: input.reason, updatedAt: new Date() } as any)
        .where(eq(sellerProfiles.id, input.sellerProfileId));
      // Deactivate all active listings for this seller
      await db.update(marketplaceListings)
        .set({ status: 'removed' as any, updatedAt: new Date() })
        .where(and(
          eq(marketplaceListings.sellerId, input.sellerProfileId),
          eq(marketplaceListings.status, 'active' as any)
        ));
       // Notify seller
      const seller = await db.select({ id: sellerProfiles.id, userId: sellerProfiles.userId, displayName: sellerProfiles.displayName }).from(sellerProfiles).where(eq(sellerProfiles.id, input.sellerProfileId)).limit(1);
      if (seller[0]?.userId) {
        await createNotification({
          userId: seller[0].userId,
          type: "system",
          title: "賣家帳號已被凍結 ⚠️",
          body: `您的賣家帳號已被管理員凍結，所有商品已下架。原因：${input.reason}`,
          linkUrl: "/seller",
        }).catch(() => {});
        // Send suspension email
        const userRow = await db.select({ email: users.email }).from(users).where(eq(users.id, seller[0].userId)).limit(1);
        if (userRow[0]?.email) {
          const { subject, html } = buildSellerSuspendedEmail({
            sellerName: seller[0].displayName ?? '賣家',
            reason: input.reason,
          });
          sendEmail({ to: userRow[0].email, subject, html }).catch(err => console.error('[Suspend Email]', err));
        }
      }
      // AT1: Audit log
      await createAuditLog({ adminId: ctx.user.id, action: 'suspend_seller', targetType: 'seller', targetId: input.sellerProfileId, details: JSON.stringify({ reason: input.reason }) });
      return { success: true };
    }),
  adminUnsuspendSeller: adminProcedure
    .input(z.object({ sellerProfileId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      await db.update(sellerProfiles)
        .set({ isSuspended: false, suspensionReason: null, updatedAt: new Date() } as any)
        .where(eq(sellerProfiles.id, input.sellerProfileId));
      const seller = await db.select({ id: sellerProfiles.id, userId: sellerProfiles.userId, displayName: sellerProfiles.displayName }).from(sellerProfiles).where(eq(sellerProfiles.id, input.sellerProfileId)).limit(1);
      if (seller[0]?.userId) {
        await createNotification({
          userId: seller[0].userId,
          type: "system",
          title: "賣家帳號已解凍 ✅",
          body: "您的賣家帳號已恢復正常，可以重新上架商品。",
          linkUrl: "/seller",
        }).catch(() => {});
        // Send unsuspension email
        const userRow = await db.select({ email: users.email }).from(users).where(eq(users.id, seller[0].userId)).limit(1);
        if (userRow[0]?.email) {
          const { subject, html } = buildSellerUnsuspendedEmail({
            sellerName: seller[0].displayName ?? '賣家',
            reason: '帳號已恢復正常使用',
          });
          sendEmail({ to: userRow[0].email, subject, html }).catch(err => console.error('[Unsuspend Email]', err));
        }
      }
      // AT1: Audit log
      await createAuditLog({ adminId: ctx.user.id, action: 'unsuspend_seller', targetType: 'seller', targetId: input.sellerProfileId });
      return { success: true };
    }),

  // ============================================================
  // AT1: Admin audit log viewer
  // ============================================================
  adminGetAuditLogs: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
      action: z.string().optional(),
      targetType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getAuditLogs(input);
    }),

  // ============================================================
  adminGetPendingPayoutCount: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(marketplaceOrders)
        .where(
          and(
            eq(marketplaceOrders.orderStatus, 'completed'),
            or(
              isNull(marketplaceOrders.payoutStatus),
              eq(marketplaceOrders.payoutStatus, 'pending')
            )
          )
        );
      return { count: Number(rows[0]?.count ?? 0) };
    }),

  // ============================================================
  // AI VERIFY ALIPAY SCREENSHOT
  // ============================================================
  adminAiVerifyAlipay: adminProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: '訂單不存在' });
      if (!order.alipayProofImageUrl) throw new TRPCError({ code: 'BAD_REQUEST', message: '訂單沒有支付寶付款截圖' });
      if (order.aiVerificationResult) {
        // Already verified, return existing result
        try {
          return JSON.parse(order.aiVerificationResult);
        } catch {
          // Re-verify if parse fails
        }
      }

      const expectedAmount = parseFloat(order.subtotalHkd || '0').toFixed(2);

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are a payment verification assistant. Analyze the payment screenshot and compare it with the expected payment details. Return a JSON object with the following fields:
- verified: boolean (true if the screenshot appears to be a valid payment matching the expected amount)
- detectedAmount: string or null (the payment amount detected in the screenshot, in HKD)
- detectedPayee: string or null (the payee/recipient name detected)
- detectedStatus: string or null (the payment status detected, e.g. "Completed", "Success")
- confidence: "high" | "medium" | "low" (your confidence level in the verification)
- reason: string (brief explanation of your verification decision in Traditional Chinese)

Expected payment amount: HKD ${expectedAmount}
Expected payee: BOXIUM or Boxium Limited

IMPORTANT:
- The screenshot should show a completed payment (not pending or failed)
- The amount should match or be very close to the expected amount
- Look for AlipayHK / 支付寶香港 payment interface elements
- If the image is unclear, blurry, or doesn't appear to be a payment screenshot, set verified to false with low confidence
- Return ONLY the JSON object, no other text`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: order.alipayProofImageUrl,
                    detail: 'high' as const,
                  },
                },
                {
                  type: 'text' as const,
                  text: `Please verify this AlipayHK payment screenshot. Expected amount: HKD ${expectedAmount}. Order number: ${order.orderNo}.`,
                },
              ],
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'alipay_verification',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  verified: { type: 'boolean', description: 'Whether the payment screenshot is valid and matches expected amount' },
                  detectedAmount: { type: ['string', 'null'], description: 'Detected payment amount in HKD' },
                  detectedPayee: { type: ['string', 'null'], description: 'Detected payee name' },
                  detectedStatus: { type: ['string', 'null'], description: 'Detected payment status' },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level' },
                  reason: { type: 'string', description: 'Explanation in Traditional Chinese' },
                },
                required: ['verified', 'detectedAmount', 'detectedPayee', 'detectedStatus', 'confidence', 'reason'],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent ?? {});
        let result: any;
        try {
          result = JSON.parse(content || '{}');
        } catch {
          result = { verified: false, detectedAmount: null, detectedPayee: null, detectedStatus: null, confidence: 'low', reason: 'AI 回應解析失敗' };
        }

        // Save result to order
        const db = await getDb();
        if (db) {
          await db.update(marketplaceOrders)
            .set({ aiVerificationResult: JSON.stringify(result) })
            .where(eq(marketplaceOrders.id, input.orderId));
        }

        // Create audit log
        await createAuditLog({
          adminId: ctx.user.id,
          action: 'ai_verify_alipay',
          targetType: 'order',
          targetId: input.orderId,
          details: JSON.stringify({
            verified: result.verified,
            detectedAmount: result.detectedAmount,
            confidence: result.confidence,
            expectedAmount,
          }),
        });

        return result;
      } catch (err: any) {
        console.error('[AI Verify Alipay] Error:', err?.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 核對失敗，請稍後重試' });
      }
    }),

  // ============================================================
  // AT2: Admin audit log CSV export
  // ============================================================
  adminExportAuditLogs: adminProcedure
    .input(z.object({
      action: z.string().optional(),
      targetType: z.string().optional(),
      startDate: z.string().optional(), // ISO date string
      endDate: z.string().optional(),   // ISO date string
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const conditions: any[] = [];
      if (input.action) conditions.push(eq(adminAuditLogs.action, input.action));
      if (input.targetType) conditions.push(eq(adminAuditLogs.targetType, input.targetType));
      if (input.startDate) conditions.push(sql`${adminAuditLogs.createdAt} >= ${new Date(input.startDate)}`);
      if (input.endDate) conditions.push(sql`${adminAuditLogs.createdAt} <= ${new Date(input.endDate)}`);
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      // Fetch up to 10000 rows for export
      const rows = await db.select().from(adminAuditLogs)
        .where(where)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(10000);
      // Build CSV
      const actionLabels: Record<string, string> = {
        confirm_alipay: '確認支付寶收款',
        update_order_status: '更新訂單狀態',
        resolve_dispute: '解決爭議',
        suspend_seller: '凍結賣家',
        unsuspend_seller: '解凍賣家',
        ai_verify_alipay: 'AI 核對支付寶',
      };
      const header = ['ID', '時間(HKT)', '管理員ID', '操作', '目標類型', '目標ID', '詳情'];
      const csvRows = rows.map(row => {
        const hktTime = new Date(row.createdAt).toLocaleString('zh-HK', {
          timeZone: 'Asia/Hong_Kong',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        const actionLabel = actionLabels[row.action] || row.action;
        const details = row.details ? row.details.replace(/"/g, '""') : '';
        return [
          row.id,
          `"${hktTime}"`,
          row.adminId,
          `"${actionLabel}"`,
          row.targetType,
          row.targetId ?? '',
          `"${details}"`,
        ].join(',');
      });
      const csv = [header.join(','), ...csvRows].join('\n');
      return { csv, total: rows.length };
    }),

  // ============================================================
  // MAINTENANCE MODE
  // ============================================================
  getMarketplaceAccess: publicProcedure.query(async ({ ctx }) => {
    const maintenanceMode = await isMarketplaceMaintenanceMode();
    if (!maintenanceMode) return { allowed: true, maintenanceMode: false };
    if (!ctx.user) return { allowed: false, maintenanceMode: true };
    if (ctx.user.role === 'admin') return { allowed: true, maintenanceMode: true };
    const whitelisted = await isMarketplaceWhitelisted(ctx.user.id);
    return { allowed: whitelisted, maintenanceMode: true };
  }),

  setMarketplaceMaintenanceMode: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setSystemSetting('marketplace_maintenance_mode', input.enabled ? 'true' : 'false', '\u5e02\u96c6\u7dad\u8b77\u6a21\u5f0f\u958b\u95dc');
      await createAuditLog({ adminId: ctx.user.id, action: input.enabled ? 'marketplace_maintenance_on' : 'marketplace_maintenance_off', targetType: 'system', targetId: null, details: `\u5e02\u96c6\u7dad\u8b77\u6a21\u5f0f\u5df2${input.enabled ? '\u958b\u555f' : '\u95dc\u9589'}` });
      return { success: true, enabled: input.enabled };
    }),

  getMarketplaceMaintenanceMode: adminProcedure.query(async () => {
    const enabled = await isMarketplaceMaintenanceMode();
    return { enabled };
  }),

  getMarketplaceWhitelist: adminProcedure.query(async () => {
    return await getMarketplaceWhitelist();
  }),

  addMarketplaceWhitelist: adminProcedure
    .input(z.object({ userId: z.number().int().positive(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await addMarketplaceWhitelist(input.userId, ctx.user.id, input.note);
      await createAuditLog({ adminId: ctx.user.id, action: 'marketplace_whitelist_add', targetType: 'user', targetId: input.userId, details: `\u5df2\u5c07\u7528\u6236 ${input.userId} \u52a0\u5165\u5e02\u96c6\u767d\u540d\u55ae` });
      return entry;
    }),

  removeMarketplaceWhitelist: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await removeMarketplaceWhitelist(input.userId);
      await createAuditLog({ adminId: ctx.user.id, action: 'marketplace_whitelist_remove', targetType: 'user', targetId: input.userId, details: `\u5df2\u5c07\u7528\u6236 ${input.userId} \u5f9e\u5e02\u96c6\u767d\u540d\u55ae\u79fb\u9664` });
      return { success: true };
    }),

  searchUserForWhitelist: adminProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB not available' });
      const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
        .from(users).where(eq(users.email, input.email)).limit(1);
      return user ?? null;
    }),
});
