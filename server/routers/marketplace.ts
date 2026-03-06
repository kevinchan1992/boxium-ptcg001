/**
 * Marketplace tRPC Router
 * Handles all marketplace operations: listings, orders, sellers, payouts
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import {
  getPublicListings, getListingById, createListing, updateListing,
  getAdminListings, getSellerListings,
  getSellerProfileByUserId, getSellerProfileById, createSellerProfile, updateSellerProfile, getAllSellerProfiles,
  createMarketplaceOrder, getMarketplaceOrderById, getMarketplaceOrderByNo, updateMarketplaceOrder, getBuyerOrders, getAdminOrders, getAlipayPendingOrders, generateOrderNo,
  createOrderItems, getOrderItems, getSellerOrderItems,
  getSellerPayouts, getMarketplaceStats, getSalesReport,
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
} from "../db";
import { storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { createNotification } from "../db/notifications";
import { marketplaceListings, offers, listingReports } from "../../drizzle/schema_new";
import { eq, and } from "drizzle-orm";

// Platform fee rate (5% for C2C listings)
const PLATFORM_FEE_RATE = 0.05;
// Alipay HK static payment link
const ALIPAY_HK_STATIC_LINK = "https://w.alipay.hk/s12/3RYKWzGXrQ";

export const marketplaceRouter = router({
  // ============================================================
  // PUBLIC - Listings
  // ============================================================
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
      let sellerProfile: { displayName: string; totalSales: number; ratingCount: number } | null = null;
      if (listing.sellerType === "seller" && listing.sellerId) {
        const sp = await getSellerProfileById(listing.sellerId);
        if (sp) sellerProfile = { displayName: sp.displayName, totalSales: sp.totalSales ?? 0, ratingCount: sp.ratingCount ?? 0 };
      }
      return { ...listing, sellerProfile };
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
        district: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "商品不存在" });
      if (listing.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "商品已下架或售出" });
      if ((listing.quantity ?? 0) < input.quantity) throw new TRPCError({ code: "BAD_REQUEST", message: "庫存不足" });

      const price = parseFloat(listing.priceHkd as string);
      const subtotal = price * input.quantity;
      const platformFee = listing.sellerType === "seller" ? subtotal * PLATFORM_FEE_RATE : 0;
      const total = subtotal + platformFee;

      // Stripe requires minimum HKD 4.00 for card payments
      if (input.paymentMethod === "stripe" && total < 4.00) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `此商品金額 HKD ${total.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00，請改用支付寶 HK 付款。`,
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
        platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
        platformFeeHkd: platformFee.toFixed(2),
        sellerReceivableHkd: (subtotal - platformFee).toFixed(2),
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
      const Stripe = (await import("stripe")).default;
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const origin = (ctx.req.headers.origin as string) || "https://boxiumptcg-mua4eq38.manus.space";
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
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
      if (order.paymentMethod !== "alipay_hk") throw new TRPCError({ code: "BAD_REQUEST" });

      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const key = `alipay-proofs/${order.orderNo}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { success: true, proofUrl: url };
    }),

  // ============================================================
  // BUYER - Confirm Receipt + Trigger Payout
  // ============================================================
  confirmReceipt: protectedProcedure
    .input(z.object({ orderId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.buyerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.orderStatus !== "shipped" && order.orderStatus !== "delivered") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "訂單尚未出貨，無法確認收貨" });
      }
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "completed",
        buyerConfirmedAt: new Date(),
        payoutStatus: "processing",
      });
      // Trigger Stripe Transfer payout if C2C order
      if (order.sellerType === "seller" && order.sellerId) {
        const sellerProfile = await getSellerProfileByUserId(order.sellerId);
        if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus === "active") {
          try {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
            const receivable = Math.round(parseFloat(order.sellerReceivableHkd as string) * 100);
            const transfer = await stripe.transfers.create({
              amount: receivable,
              currency: "hkd",
              destination: sellerProfile.stripeConnectId,
              metadata: { order_no: order.orderNo, order_id: order.id.toString() },
            });
            await updateMarketplaceOrder(input.orderId, {
              payoutStatus: "paid",
              stripeTransferId: transfer.id,
            });
            // Notify seller of payout
            await createNotification({
              userId: order.sellerId,
              type: "trade",
              title: "款項已轉帳 💰",
              content: `訂單 ${order.orderNo} 買家已確認收貨，HKD ${order.sellerReceivableHkd} 已轉帳至你的 Stripe 帳戶。`,
              priority: "high",
              relatedUrl: "/seller",
            }).catch(() => {});
          } catch (err: any) {
            console.error("[Payout] Stripe transfer failed:", err);
            await updateMarketplaceOrder(input.orderId, {
              payoutStatus: "failed",
              stripeTransferError: err.message,
            });
          }
        }
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
    }))
    .mutation(async ({ ctx, input }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) throw new TRPCError({ code: "FORBIDDEN", message: "請先申請成為賣家" });
      if (!seller.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "賣家帳號尚未獲批准" });

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
      const { id, ...updateData } = input;
      const updatePayload: Record<string, any> = { ...updateData };
      if (updatePayload.price) {
        updatePayload.priceHkd = parseFloat(updatePayload.price).toFixed(2);
        delete updatePayload.price;
      }
      await updateListing(id, updatePayload);
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

  getMySellerOrders: protectedProcedure
    .query(async ({ ctx }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerOrderItems(seller.id);
    }),

  getMyPayouts: protectedProcedure
    .query(async ({ ctx }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerPayouts(seller.id);
    }),

  // ============================================================
  // SELLER - Mark Order Shipped
  // ============================================================
  markOrderShipped: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      trackingNo: z.string().optional(),
      shippingMethod: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.sellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.orderStatus !== "processing") throw new TRPCError({ code: "BAD_REQUEST", message: "訂單狀態不允許此操作" });
      // Set autoCompleteAt = 14 days from now
      const autoCompleteAt = new Date();
      autoCompleteAt.setDate(autoCompleteAt.getDate() + 14);
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "shipped",
        shippedAt: new Date(),
        trackingNumber: input.trackingNo ?? null,
        shippingMethod: input.shippingMethod ?? null,
        autoCompleteAt,
      });
      // Notify buyer of shipment
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "你的訂單已出貨 📦",
        content: `訂單 ${order.orderNo} 已出貨${input.trackingNo ? `，物流追蹤號：${input.trackingNo}` : ""}。如 14 天內未確認收貨，系統將自動完成訂單。`,
        priority: "high",
        relatedUrl: "/orders",
      }).catch(err => console.warn("[Order] Failed to notify buyer of shipment:", err));
      return { success: true };
    }),

  // ============================================================
  // SELLER - Stripe Connect Onboarding
  // ============================================================
  startStripeConnectOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "賣家資料不存在" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      let connectId = profile.stripeConnectId;
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
      return { onboardingUrl: accountLink.url };
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

  adminGetListings: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getAdminListings(input.page, input.pageSize, input.status);
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
        viewCount: 0,
      });
      return listing;
    }),

  adminUpdateListing: adminProcedure
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["draft", "pending_review", "active", "sold", "removed"]).optional(),
      price: z.number().positive().optional(),
      quantity: z.number().int().min(0).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updatePayload: Record<string, any> = { ...data };
      if (updatePayload.price) {
        updatePayload.priceHkd = parseFloat(updatePayload.price).toFixed(2);
        delete updatePayload.price;
      }
      await updateListing(id, updatePayload);
      return { success: true };
    }),

  adminGetOrders: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return getAdminOrders(input.page, input.pageSize, input.status);
    }),

  adminGetAlipayPending: adminProcedure
    .query(async () => {
      return getAlipayPendingOrders();
    }),

  adminConfirmAlipayPayment: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      await updateMarketplaceOrder(input.orderId, {
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
        content: `訂單 ${order.orderNo} 的支付寶 HK 付款已由管理員確認，訂單現在進入處理中。${input.note ? `備註：${input.note}` : ""}`,
        priority: "high",
        relatedUrl: `/orders/${order.orderNo}`,
      }).catch(() => {});
      // Notify seller of new order
      if (order.sellerId) {
        await createNotification({
          userId: order.sellerId,
          type: "trade",
          title: "新訂單已付款 🎉",
          content: `訂單 ${order.orderNo} 買家已完成付款，請盡快安排出貨。`,
          priority: "high",
          relatedUrl: "/seller",
        }).catch(() => {});
      }
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
            content: `訂單 ${order.orderNo} 的支付寶 HK 付款已由管理員確認，訂單現在進入處理中。${input.note ? `備註：${input.note}` : ""}`,
            priority: "high",
            relatedUrl: `/orders/${order.orderNo}`,
          }).catch(() => {});
          // Notify seller of new order
          if (order.sellerId) {
            await createNotification({
              userId: order.sellerId,
              type: "trade",
              title: "新訂單已付款 🎉",
              content: `訂單 ${order.orderNo} 買家已完成支付寶 HK 付款，請盡快安排出貨。`,
              priority: "high",
              relatedUrl: "/seller",
            }).catch(() => {});
          }
          results.push({ orderId, success: true });
        } catch (err: any) {
          results.push({ orderId, success: false, error: err.message });
        }
      }
      const successCount = results.filter(r => r.success).length;
      return { results, successCount, failCount: results.length - successCount };
    }),

  adminUpdateOrderStatus: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      orderStatus: z.enum(["processing", "shipped", "delivered", "completed", "cancelled", "disputed"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const updates: Record<string, any> = { orderStatus: input.orderStatus };
      if (input.orderStatus === "shipped") updates.shippedAt = new Date();
      if (input.orderStatus === "delivered") {
        const autoComplete = new Date();
        autoComplete.setDate(autoComplete.getDate() + 14);
        updates.autoCompleteAt = autoComplete;
      }
      await updateMarketplaceOrder(input.orderId, updates);
      // Notify buyer of status change
      const statusMessages: Record<string, { title: string; content: string }> = {
        processing: { title: "訂單處理中 ⏳", content: `訂單 ${order.orderNo} 已進入處理中，賣家正在準備發貨。` },
        shipped: { title: "訂單已出貨 📦", content: `訂單 ${order.orderNo} 已出貨，請注意查收。` },
        delivered: { title: "訂單已送達 ✅", content: `訂單 ${order.orderNo} 已送達，如有問題請在 14 天內提出申請。` },
        completed: { title: "訂單已完成 🎉", content: `訂單 ${order.orderNo} 已完成，感謝您的支持！` },
        cancelled: { title: "訂單已取消 ❌", content: `訂單 ${order.orderNo} 已取消。${input.note ? `原因：${input.note}` : ""}` },
        disputed: { title: "訂單爭議中 ⚠️", content: `訂單 ${order.orderNo} 已進入爭議處理。我們將盡快處理，請耐心等候。` },
      };
      const msg = statusMessages[input.orderStatus];
      if (msg) {
        await createNotification({
          userId: order.buyerId,
          type: "trade",
          title: msg.title,
          content: msg.content,
          priority: input.orderStatus === "cancelled" || input.orderStatus === "disputed" ? "high" : "medium",
          relatedUrl: `/orders/${order.orderNo}`,
        }).catch(err => console.warn("[Admin] Failed to notify buyer of status change:", err));
      }
      return { success: true };
    }),

  adminGetSellers: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      return getAllSellerProfiles(input.page, input.pageSize);
    }),

  // ============================================================
  // ADMIN - Approve/Reject Seller with Notification
  // ============================================================
  adminApproveSeller: adminProcedure
    .input(z.object({
      sellerId: z.number().int(),
      approve: z.boolean(),
      rejectReason: z.string().max(500).optional(),
    }))
    .mutation(async ({ input }) => {
      const seller = await getSellerProfileById(input.sellerId);
      if (!seller) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });
      if (input.approve) {
        await updateSellerProfile(input.sellerId, { isActive: true, rejectReason: null });
        // Notify seller user of approval
        await createNotification({
          userId: seller.userId,
          type: "system",
          title: "賣家申請已批准 ✅",
          content: "恭喜！你的賣家申請已獲批准，現在可以開始上架商品了。請前往賣家後台設定 Stripe 收款帳戶。",
          priority: "high",
          relatedUrl: "/seller",
        }).catch(err => console.warn("[Seller] Failed to create approval notification:", err));
      } else {
        await updateSellerProfile(input.sellerId, { isActive: false, rejectReason: input.rejectReason ?? null });
        // Deactivate all seller's active listings
        const db = await getDb();
        if (db) {
          await db.update(marketplaceListings)
            .set({ status: "removed" })
            .where(and(eq(marketplaceListings.sellerId, input.sellerId), eq(marketplaceListings.status, "active")));
        }
        // Notify seller user of rejection
        await createNotification({
          userId: seller.userId,
          type: "system",
          title: "賣家申請未獲批准",
          content: input.rejectReason
            ? `你的賣家申請未獲批准。原因：${input.rejectReason}。如有疑問，請聯絡客服。`
            : "你的賣家申請未獲批准。如有疑問，請聯絡客服。",
          priority: "high",
          relatedUrl: "/seller",
        }).catch(err => console.warn("[Seller] Failed to create rejection notification:", err));
      }
      return { success: true };
    }),

  // ============================================================
  // BUYER - Create Orders (legacy Stripe + Alipay HK)
  // ============================================================
  createStripeOrder: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const price = parseFloat(listing.priceHkd as string);
      const amountHKD = Math.round(price * 100); // cents

      // Stripe requires minimum HKD 4.00 for card payments
      if (price < 4.00) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `此商品金額 HKD ${price.toFixed(2)} 低於 Stripe 最低付款金額 HKD 4.00，請改用支付寶 HK 付款。`,
        });
      }

      const orderNo = await generateOrderNo();
      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "hkd",
            product_data: { name: listing.title, description: listing.description ?? undefined },
            unit_amount: amountHKD,
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
        },
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
        subtotalHkd: listing.priceHkd as string,
        listingId: listing.id,
        unitPriceHkd: price.toFixed(2),
        quantity: 1,
        platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
        platformFeeHkd: (price * PLATFORM_FEE_RATE).toFixed(2),
        sellerReceivableHkd: (price * (1 - PLATFORM_FEE_RATE)).toFixed(2),
        stripePaymentIntentId: session.payment_intent as string ?? null,
        stripeSessionId: session.id,
        shippingName: input.shippingAddress?.name ?? null,
        shippingPhone: input.shippingAddress?.phone ?? null,
        shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
      });
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
      proofImageUrl: z.string().url(),
      shippingAddress: z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        address: z.string().min(1),
        district: z.string().optional(),
        region: z.string().default("香港"),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      const price = parseFloat(listing.priceHkd as string);
      const orderNo = await generateOrderNo();
      const newOrder = await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        sellerId: listing.sellerId ?? null,
        sellerType: listing.sellerType as any,
        paymentMethod: "alipay_hk",
        paymentStatus: "pending",
        orderStatus: "pending_payment",
        subtotalHkd: listing.priceHkd as string,
        listingId: listing.id,
        unitPriceHkd: price.toFixed(2),
        quantity: 1,
        platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
        platformFeeHkd: (price * PLATFORM_FEE_RATE).toFixed(2),
        sellerReceivableHkd: (price * (1 - PLATFORM_FEE_RATE)).toFixed(2),
        alipayMerchantTransId: null,
        alipayProofImageUrl: input.proofImageUrl,
        shippingName: input.shippingAddress?.name ?? null,
        shippingPhone: input.shippingAddress?.phone ?? null,
        shippingAddress: input.shippingAddress ? JSON.stringify(input.shippingAddress) : null,
      });
      // Notify admin of new Alipay order pending review
      await notifyOwner({
        title: "支付寶 HK 訂單待審核 💰",
        content: `訂單 ${orderNo} 買家已提交支付寶 HK 付款截圖，請前往管理後台審核。商品：${listing.title}，金額：HKD ${price.toFixed(2)}`,
      }).catch(() => {});
      return { orderNo };
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
      return { order, items, listing, review, isBuyer, isSeller };
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
  // BUYER - Dispute Handling
  // ============================================================
  openDispute: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      reason: z.string().min(10).max(1000),
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
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "disputed",
        disputeOpenedAt: new Date(),
        disputeReason: input.reason,
      });
      // Notify admin
      await notifyOwner({
        title: "新爭議申請 ⚠️",
        content: `訂單 ${order.orderNo} 買家申請爭議。原因：${input.reason}`,
      }).catch(() => {});
      // Notify seller
      if (order.sellerId) {
        await createNotification({
          userId: order.sellerId,
          type: "trade",
          title: "訂單爭議申請 ⚠️",
          content: `訂單 ${order.orderNo} 買家已申請爭議，請等待管理員處理。`,
          priority: "high",
          relatedUrl: "/seller",
        }).catch(() => {});
      }
      return { success: true };
    }),

  // ============================================================
  // ADMIN - Resolve Dispute
  // ============================================================
  adminResolveDispute: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      resolution: z.string().min(5).max(1000),
      outcome: z.enum(["refund_buyer", "release_seller", "partial"]),
    }))
    .mutation(async ({ input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.orderStatus !== "disputed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "此訂單不在爭議狀態" });
      }
      // Determine final order status based on outcome
      const finalStatus = input.outcome === "refund_buyer" ? "cancelled" : "completed";
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: finalStatus,
        disputeResolvedAt: new Date(),
        disputeResolution: `[${input.outcome}] ${input.resolution}`,
        payoutStatus: input.outcome === "release_seller" ? "processing" : "failed",
      });
      // If refunding buyer, trigger Stripe Refund
      if (input.outcome === "refund_buyer" && order.stripePaymentIntentId) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
          await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            metadata: { order_no: order.orderNo, dispute_resolved: "refund_buyer" },
          });
          console.log(`[Dispute] Stripe refund created for order ${order.orderNo}`);
        } catch (err: any) {
          console.error(`[Dispute] Stripe refund failed for order ${order.orderNo}:`, err.message);
        }
      }
      // If releasing to seller, trigger payout
      if (input.outcome === "release_seller" && order.sellerType === "seller" && order.sellerId) {
        const sellerProfile = await getSellerProfileByUserId(order.sellerId);
        if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus === "active") {
          try {
            const Stripe = (await import("stripe")).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
            const receivable = Math.round(parseFloat(order.sellerReceivableHkd as string) * 100);
            await stripe.transfers.create({
              amount: receivable,
              currency: "hkd",
              destination: sellerProfile.stripeConnectId,
              metadata: { order_no: order.orderNo, dispute_resolved: "true" },
            });
            await updateMarketplaceOrder(input.orderId, { payoutStatus: "paid" });
          } catch (err) {
            console.error("[Dispute] Transfer failed:", err);
          }
        }
      }
      // Notify buyer
      await createNotification({
        userId: order.buyerId,
        type: "trade",
        title: "爭議已處理 ✅",
        content: `訂單 ${order.orderNo} 的爭議已由管理員處理。結果：${input.resolution}`,
        priority: "high",
        relatedUrl: "/orders",
      }).catch(() => {});
      // Notify seller
      if (order.sellerId) {
        await createNotification({
          userId: order.sellerId,
          type: "trade",
          title: "爭議已處理 ✅",
          content: `訂單 ${order.orderNo} 的爭議已由管理員處理。`,
          priority: "high",
          relatedUrl: "/seller",
        }).catch(() => {});
      }
      return { success: true };
    }),

  adminGetDisputes: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      return getDisputedOrders(input.page, input.pageSize);
    }),

  // ============================================================
  // REVIEW SYSTEM
  // ============================================================
  submitReview: protectedProcedure
    .input(z.object({
      orderId: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
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
      });
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
      recipientName: z.string().min(1).max(100),
      phone: z.string().min(1).max(30),
      address: z.string().min(1).max(255),
      district: z.string().max(50).optional(),
      region: z.string().max(50).default("香港"),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await createUserShippingAddress({ ...input, userId: ctx.user.id });
      return { success: true };
    }),

  updateShippingAddress: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      label: z.string().max(50).optional(),
      recipientName: z.string().min(1).max(100).optional(),
      phone: z.string().min(1).max(30).optional(),
      address: z.string().min(1).max(255).optional(),
      district: z.string().max(50).optional(),
      region: z.string().max(50).optional(),
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
      if (!listing.allowOffers) throw new TRPCError({ code: "BAD_REQUEST", message: "此商品不接受出價" });
      const minOffer = listing.minOfferHkd ? parseFloat(listing.minOfferHkd as string) : 0;
      if (minOffer > 0 && input.offerPriceHkd < minOffer) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `出價不得低於 HKD ${minOffer}` });
      }
      if (!listing.sellerId) throw new TRPCError({ code: "BAD_REQUEST", message: "平台商品不支持出價" });
      const sellerProfile = await getSellerProfileById(listing.sellerId);
      if (!sellerProfile) throw new TRPCError({ code: "NOT_FOUND", message: "賣家不存在" });
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
      // Notify seller
      await createNotification({
        userId: sellerProfile.userId,
        type: "trade",
        title: "收到新出價 💰",
        content: `有買家對「${listing.title}」出價 HKD ${input.offerPriceHkd}，請在 48 小時內回應。`,
        priority: "high",
        relatedUrl: "/seller",
      }).catch(() => {});
      return offer;
    }),

  getMyOffers: protectedProcedure
    .query(async ({ ctx }) => {
      return getBuyerOffers(ctx.user.id);
    }),

  getSellerOffers: protectedProcedure
    .query(async ({ ctx }) => {
      const seller = await getSellerProfileByUserId(ctx.user.id);
      if (!seller) return [];
      return getSellerOffers(seller.id);
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
          content: `你對商品的出價 HKD ${offer.offerPriceHkd} 已被賣家拒絕。${input.rejectionReason ? `原因：${input.rejectionReason}` : ""}`,
          priority: "medium",
          relatedUrl: "/orders",
        }).catch(() => {});
        return { success: true, action: "rejected" };
      }

      // Accept: create order at offer price
      const listing = await getListingById(offer.listingId);
      if (!listing || listing.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "商品已下架" });
      const offerPrice = parseFloat(offer.offerPriceHkd as string);
      const platformFee = offerPrice * PLATFORM_FEE_RATE;
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
        platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
        platformFeeHkd: platformFee.toFixed(2),
        sellerReceivableHkd: (offerPrice - platformFee).toFixed(2),
        orderStatus: "pending_payment",
        autoCompleteAt: null as any,
      });
      await updateOffer(offer.id, { status: "accepted", respondedAt: new Date(), orderId: order.id });
      // Create Stripe checkout for buyer
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const origin = "https://boxiumptcg-mua4eq38.manus.space";
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price_data: { currency: "hkd", product_data: { name: listing.title }, unit_amount: Math.round((offerPrice + platformFee) * 100) }, quantity: 1 }],
        mode: "payment",
        customer_email: undefined,
        client_reference_id: offer.buyerId.toString(),
        metadata: { orderId: order.id.toString(), orderNo, buyerId: offer.buyerId.toString(), offerId: offer.id.toString() },
        success_url: `${origin}/orders?payment=success&orderNo=${orderNo}`,
        cancel_url: `${origin}/shop/${listing.id}`,
        allow_promotion_codes: true,
      });
      await updateMarketplaceOrder(order.id, { stripeSessionId: session.id });
      // Notify buyer
      await createNotification({
        userId: offer.buyerId,
        type: "trade",
        title: "出價被接受 ✅",
        content: `賣家接受了你的出價 HKD ${offer.offerPriceHkd}！請尽快完成付款。`,
        priority: "high",
        relatedUrl: `/orders`,
      }).catch(() => {});
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
      notifyOwner({
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
      }).from(ordersTable).where(eq(ordersTable.sellerId, seller.id));
      const completedOrders = allOrders.filter((o: any) => o.status === "completed");
      const pendingOrders = allOrders.filter((o: any) => ["pending_payment", "paid", "processing", "shipped"].includes(o.status));
      const totalRevenue = completedOrders.reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      const thisMonthOrders = allOrders.filter((o: any) => new Date(o.createdAt) >= startOfMonth);
      const thisMonthRevenue = thisMonthOrders
        .filter((o: any) => o.status === "completed")
        .reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      const lastMonthOrders = allOrders.filter((o: any) => {
        const d = new Date(o.createdAt);
        return d >= startOfLastMonth && d <= endOfLastMonth;
      });
      const lastMonthRevenue = lastMonthOrders
        .filter((o: any) => o.status === "completed")
        .reduce((sum: number, o: any) => sum + parseFloat(o.amount ?? "0"), 0);
      return {
        totalOrders: allOrders.length,
        completedOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        avgRating: seller.avgRating,
        ratingCount: seller.ratingCount,
      };
    }),
});
