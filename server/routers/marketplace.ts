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
  createMarketplaceOrder, getMarketplaceOrderById, updateMarketplaceOrder, getBuyerOrders, getAdminOrders, getAlipayPendingOrders, generateOrderNo,
  createOrderItems, getOrderItems, getSellerOrderItems,
  getSellerPayouts, getMarketplaceStats,
} from "../db";
import { storagePut } from "../storage";

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
      const orderNo = await generateOrderNo();

      const order = await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        listingId: listing.id,
        unitPriceHkd: price.toFixed(2),
        quantity: input.quantity ?? 1,
        subtotalHkd: subtotal.toFixed(2),
        platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
        platformFeeHkd: platformFee.toFixed(2),
        sellerReceivableHkd: (subtotal - platformFee).toFixed(2),
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

      // For Stripe, create PaymentIntent
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Stripe = require("stripe");
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(total * 100), // cents
        currency: "hkd",
        metadata: {
          orderId: order.id.toString(),
          orderNo,
          buyerId: ctx.user.id.toString(),
        },
      });

      await updateMarketplaceOrder(order.id, { stripePaymentIntentId: paymentIntent.id });

      return {
        order,
        paymentMethod: "stripe",
        clientSecret: paymentIntent.client_secret,
        orderNo,
      };
    }),

  getMyOrders: protectedProcedure
    .query(async ({ ctx }) => {
      const orders = await getBuyerOrders(ctx.user.id);
      return orders;
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

      // Upload proof image to S3
      const buffer = Buffer.from(input.proofImageBase64, "base64");
      const key = `alipay-proofs/${order.orderNo}-${Date.now()}.jpg`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      // alipay proof stored externally
      return { success: true, proofUrl: url };
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
        isActive: false,
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
      condition: z.enum(["mint", "near_mint", "excellent", "good", "played", "poor", "sealed"]),
      price: z.number().positive(),
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
      price: z.number().positive().optional(),
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
      if ((updatePayload as any).priceHkd) (updatePayload as any).priceHkd = parseFloat((updatePayload as any).priceHkd).toFixed(2);
      await updateListing(id, updatePayload);
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
  // ADMIN - Marketplace Management
  // ============================================================
  adminGetStats: adminProcedure
    .query(async () => {
      return getMarketplaceStats();
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
      condition: z.enum(["mint", "near_mint", "excellent", "good", "played", "poor", "sealed"]),
      price: z.number().positive(),
      quantity: z.number().int().min(1).default(1),
      cardId: z.number().int().optional(),
      images: z.array(z.string()).max(5).optional(),
      status: z.enum(["draft", "active"]).default("active"),
    }))
    .mutation(async ({ input }) => {
      const listing = await createListing({
        sellerType: "platform",
        // sellerId intentionally omitted for platform listings (DB defaults to NULL)
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
      if ((updatePayload as any).priceHkd) (updatePayload as any).priceHkd = parseFloat((updatePayload as any).priceHkd).toFixed(2);
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
      return { success: true };
    }),

  adminUpdateOrderStatus: adminProcedure
    .input(z.object({
      orderId: z.number().int(),
      orderStatus: z.enum(["processing", "shipped", "delivered", "completed", "cancelled", "disputed"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updates: Record<string, any> = { orderStatus: input.orderStatus };
      // adminNote removed from schema
      if (input.orderStatus === "shipped") updates.shippedAt = new Date();
      if (input.orderStatus === "delivered") {
        // deliveredAt not in current schema
        // Auto-complete after 14 days
        const autoComplete = new Date();
        autoComplete.setDate(autoComplete.getDate() + 14);
        updates.autoCompleteAt = autoComplete;
      }
      // completedAt not in current schema
      await updateMarketplaceOrder(input.orderId, updates);
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
  // BUYER - Create Orders (Stripe + Alipay HK)
  // ============================================================
  createStripeOrder: protectedProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
      const price = parseFloat(listing.priceHkd as string);
      const amountHKD = Math.round(price * 100); // cents
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
      });
      return { checkoutUrl: session.url, orderNo };
    }),

  createAlipayOrder: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      proofImageUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing || listing.status !== "active" || listing.quantity < 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "商品不存在或已售出" });
      }
      const price = parseFloat(listing.priceHkd as string);
      const orderNo = await generateOrderNo();
      await createMarketplaceOrder({
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
      });
      return { orderNo };
    }),

  // ============================================================
  // SELLER - Create Listing
  // ============================================================
  createSellerListing: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      condition: z.enum(["mint", "near_mint", "excellent", "good", "played", "poor", "sealed"]),
      price: z.number().positive(),
      quantity: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await getSellerProfileByUserId(ctx.user.id);
      if (!profile || !profile.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "你尚未成為賣家或帳號未激活" });
      }
      // Duplicate block removed - use createListing procedure instead
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
  // SELLER - Mark Order Shipped
  // ============================================================
  markOrderShipped: protectedProcedure
    .input(z.object({ orderId: z.number().int(), trackingNo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const order = await getMarketplaceOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      if (order.sellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (order.orderStatus !== "processing") throw new TRPCError({ code: "BAD_REQUEST", message: "訂單狀態不允許此操作" });
      await updateMarketplaceOrder(input.orderId, {
        orderStatus: "shipped",
        shippedAt: new Date(),
        trackingNumber: input.trackingNo ?? null,
      });
      return { success: true };
    }),

  adminApproveSeller: adminProcedure
    .input(z.object({
      sellerId: z.number().int(),
      approve: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await updateSellerProfile(input.sellerId, { isActive: input.approve });
      return { success: true };
    }),
});
