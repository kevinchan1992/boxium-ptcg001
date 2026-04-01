/**
 * Auction tRPC Router
 * Handles all auction operations: create, bid, buy-now, cancel, admin review
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "../_core/trpc";
import {
  getAuctionListings, getAuctionListingById, updateAuctionListing,
  getAdminAuctionListings,
  placeBid, getBidsByListingId, getWinningBid, markBidsAsOutbid, updateBidStatus, getBidsByBidderId,
  hasAgreedToTerms, recordAgreement,
  getViolationsByUserId, isUserAuctionBanned, createViolation,
  createListing, updateListing, getListingById,
  generateOrderNo, createMarketplaceOrder, createOrderItems,
  getSellerAuctions, getAuctionAdminStats,
  getAllAuctionViolations, liftAuctionBan,
  getSellerProfileByUserId,
} from "../db";
import { createNotification } from "../db/notifications";
import Stripe from 'stripe';

// Shared Stripe instance for auction deposit/payment
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
}

// High-value auction thresholds
const HIGH_VALUE_THRESHOLD_HKD = 10000; // Listings above this need extra admin review
const NEW_SELLER_MAX_BID_HKD = 5000;    // New sellers (totalSales < 5) can't list above this
const NEW_SELLER_SALES_THRESHOLD = 5;   // Number of completed sales to be considered "established"

// Deposit rate: 10% of starting bid, min HKD 50, max HKD 500
function calcDepositAmount(startingBid: number): number {
  return Math.min(Math.max(Math.round(startingBid * 0.10), 50), 500);
}

// Current terms version — bump this when terms change
const AUCTION_TERMS_VERSION = "1.0";

// ---- Public ----

export const auctionRouter = router({
  /** List active/ending_soon/scheduled auctions */
  list: publicProcedure
    .input(z.object({
      status: z.array(z.string()).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      cardId: z.number().int().optional(),
    }))
    .query(async ({ input }) => {
      return getAuctionListings(input);
    }),

  /** Get a single auction listing with its bid history */
  getById: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const listing = await getAuctionListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "拍賣不存在" });
      const bids = await getBidsByListingId(input.id, 20);
      return { listing, bids };
    }),

  // ---- Protected (logged-in users) ----

  /** Check if user has agreed to auction terms */
  checkTermsAgreement: protectedProcedure
    .input(z.object({ role: z.enum(["buyer", "seller"]) }))
    .query(async ({ ctx, input }) => {
      const agreed = await hasAgreedToTerms(ctx.user.id, input.role, AUCTION_TERMS_VERSION);
      return { agreed, termsVersion: AUCTION_TERMS_VERSION };
    }),

  /** Record user agreement to auction terms */
  agreeToTerms: protectedProcedure
    .input(z.object({ role: z.enum(["buyer", "seller"]) }))
    .mutation(async ({ ctx, input }) => {
      await recordAgreement({
        userId: ctx.user.id,
        role: input.role,
        termsVersion: AUCTION_TERMS_VERSION,
      });
      return { success: true };
    }),

  /** Seller creates an auction listing */
  create: protectedProcedure
    .input(z.object({
      // Card info (flexible - cardId optional for manual listings)
      cardId: z.number().int().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      condition: z.string().optional(),
      quantity: z.number().int().min(1).default(1),
      images: z.array(z.string()).optional(),
      tcgSeries: z.string().optional(),
      // Auction settings
      startingBid: z.number().min(1),
      reservePrice: z.number().optional(),
      buyNowPrice: z.number().optional(),
      bidIncrement: z.number().min(1).default(10),
      auctionStartAt: z.date().optional(),
      auctionEndAt: z.date(),
      antiSnipingMinutes: z.number().int().min(0).max(30).default(5),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check seller terms agreement
      const agreed = await hasAgreedToTerms(ctx.user.id, 'seller', AUCTION_TERMS_VERSION);
      if (!agreed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "請先同意拍賣賣家條款" });

      // Check ban status
      const banned = await isUserAuctionBanned(ctx.user.id);
      if (banned) throw new TRPCError({ code: "FORBIDDEN", message: "您的帳戶已被禁止參與拍賣" });

      // High-value risk control: check seller's completed sales count
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      const sellerTotalSales = sellerProfile?.totalSales ?? 0;
      const isNewSeller = sellerTotalSales < NEW_SELLER_SALES_THRESHOLD;
      if (isNewSeller && input.startingBid > NEW_SELLER_MAX_BID_HKD) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `新賣家（完成成交少於 ${NEW_SELLER_SALES_THRESHOLD} 次）的拍賣起拍價上限為 HK$${NEW_SELLER_MAX_BID_HKD.toLocaleString()}。請先完成更多交易以提高額度限制。`,
        });
      }

      // Flag high-value listings for extra admin review
      const isHighValueReview = input.startingBid > HIGH_VALUE_THRESHOLD_HKD;

      const startAt = input.auctionStartAt ?? new Date();
      const endAt = input.auctionEndAt;

      // Create the listing in draft/pending_review state
      const listing = await createListing({
        sellerId: ctx.user.id,
        sellerType: 'seller',
        cardId: input.cardId ?? null,
        title: input.title,
        description: input.description,
        condition: (input.condition ?? 'raw_a') as any,
        quantity: input.quantity,
        remainingQuantity: input.quantity,
        images: input.images ? JSON.stringify(input.images) : null,
        tcgSeries: (input.tcgSeries ?? 'pokemon') as any,
        priceHkd: input.startingBid.toString(),
        status: 'pending_review',
        listingMode: 'auction',
        auctionStatus: 'pending_review',
        auctionStartAt: startAt,
        auctionEndAt: endAt,
        startingBid: input.startingBid.toString(),
        reservePrice: input.reservePrice?.toString(),
        buyNowPrice: input.buyNowPrice?.toString(),
        bidIncrement: input.bidIncrement.toString(),
        antiSnipingMinutes: input.antiSnipingMinutes,
        auctionTermsVersion: AUCTION_TERMS_VERSION,
        isHighValueReview: isHighValueReview,
      } as any);

      // Notify admin for high-value listings
      if (isHighValueReview) {
        const { notifyAdmin } = await import('../emailService').catch(() => ({ notifyAdmin: null }));
        if (notifyAdmin) {
          await notifyAdmin({
            title: '高價拍賣待額外審核',
            content: `賣家 #${ctx.user.id} 上架的拍賣起拍價為 HK$${input.startingBid.toLocaleString()}，超過 HK$${HIGH_VALUE_THRESHOLD_HKD.toLocaleString()} 門標，需要額外審核。拍賣 ID: ${listing?.id}`,
          }).catch(() => {});
        }
      }

      return { success: true, listingId: listing?.id, isHighValueReview };
    }),

  /** Buyer places a bid */
  placeBid: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      amount: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check buyer terms agreement
      const agreed = await hasAgreedToTerms(ctx.user.id, 'buyer', AUCTION_TERMS_VERSION);
      if (!agreed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "請先同意拍賣買家條款" });

      // Check ban status
      const banned = await isUserAuctionBanned(ctx.user.id);
      if (banned) throw new TRPCError({ code: "FORBIDDEN", message: "您的帳戶已被禁止參與拍賣" });

      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "拍賣不存在" });
      if (!['active', 'ending_soon'].includes(listing.auctionStatus ?? '')) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "拍賣未在進行中" });
      }
      if (listing.sellerId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能競投自己的拍賣" });
      }

      // Validate bid amount
      const currentHighest = parseFloat(listing.currentHighestBid ?? listing.startingBid ?? '0');
      const minBid = listing.currentHighestBid
        ? currentHighest + parseFloat(listing.bidIncrement ?? '5')
        : parseFloat(listing.startingBid ?? '1');

      if (input.amount < minBid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `出價必須至少 HK$${minBid.toFixed(0)}`,
        });
      }

      // Check if buy-now price would be triggered
      const buyNow = listing.buyNowPrice ? parseFloat(listing.buyNowPrice) : null;
      if (buyNow && input.amount >= buyNow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `出價已達即時購買價 HK$${buyNow}，請使用「立即購買」`,
        });
      }

      // Check anti-sniping: extend auction if bid placed in last N minutes
      const now = new Date();
      const endAt = listing.auctionEndAt ? new Date(listing.auctionEndAt) : null;
      let newEndAt = endAt;
      let extended = false;
      if (endAt && listing.antiSnipingMinutes > 0) {
        const msToEnd = endAt.getTime() - now.getTime();
        const snipingWindowMs = listing.antiSnipingMinutes * 60 * 1000;
        if (msToEnd > 0 && msToEnd < snipingWindowMs) {
          newEndAt = new Date(now.getTime() + snipingWindowMs);
          extended = true;
        }
      }

      // Place the bid
      const bid = await placeBid({
        listingId: input.listingId,
        bidderId: ctx.user.id,
        amount: input.amount.toString(),
        status: 'winning',
      });

      // Mark previous bids as outbid
      await markBidsAsOutbid(input.listingId, bid.id);

      // Update listing
      const updateData: any = {
        currentHighestBid: input.amount.toString(),
        currentHighestBidderId: ctx.user.id,
        bidCount: (listing.bidCount ?? 0) + 1,
        hasReserveMet: listing.reservePrice
          ? input.amount >= parseFloat(listing.reservePrice)
          : true,
      };
      if (extended && newEndAt) {
        updateData.auctionEndAt = newEndAt;
        updateData.antiSnipingExtensions = (listing.antiSnipingExtensions ?? 0) + 1;
        updateData.auctionStatus = 'ending_soon';
      }
      await updateAuctionListing(input.listingId, updateData);

      // Notify previous highest bidder if outbid (station notification + email)
      if (listing.currentHighestBidderId && listing.currentHighestBidderId !== ctx.user.id) {
        await createNotification({
          userId: listing.currentHighestBidderId,
          type: 'auction_outbid',
          title: '您已被超越出價',
          body: `您在拍賣 #${input.listingId} 的出價已被超越，最新最高出價為 HK$${input.amount}`,
          relatedId: input.listingId,
        });
        // Also send email notification (non-blocking)
        const cardName = listing.title ?? `拍賣 #${input.listingId}`;
        const prevBidAmount = listing.currentHighestBid ?? '0';
        const endAtStr = listing.auctionEndAt
          ? new Date(listing.auctionEndAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '未知';
        import('../emailService').then(({ sendAuctionOutbidEmail }) => {
          sendAuctionOutbidEmail({
            userId: listing.currentHighestBidderId!,
            cardName,
            yourBidHkd: parseFloat(prevBidAmount).toLocaleString('en-HK', { minimumFractionDigits: 0 }),
            newHighestBidHkd: input.amount.toLocaleString('en-HK', { minimumFractionDigits: 0 }),
            auctionEndAt: endAtStr,
            listingId: input.listingId,
          }).catch(e => console.error('[Auction] Failed to send outbid email:', e));
        }).catch(e => console.error('[Auction] Failed to import emailService:', e));
      }

      return {
        success: true,
        bidId: bid.id,
        amount: input.amount,
        extended,
        newEndAt: newEndAt?.toISOString(),
      };
    }),

  /** Buyer uses buy-now to immediately purchase */
  buyNow: protectedProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const agreed = await hasAgreedToTerms(ctx.user.id, 'buyer', AUCTION_TERMS_VERSION);
      if (!agreed) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "請先同意拍賣買家條款" });

      const banned = await isUserAuctionBanned(ctx.user.id);
      if (banned) throw new TRPCError({ code: "FORBIDDEN", message: "您的帳戶已被禁止參與拍賣" });

      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "拍賣不存在" });
      if (!['active', 'ending_soon'].includes(listing.auctionStatus ?? '')) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "拍賣未在進行中" });
      }
      if (!listing.buyNowPrice) throw new TRPCError({ code: "BAD_REQUEST", message: "此拍賣不支援即時購買" });
      if (listing.sellerId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能購買自己的拍賣" });
      }

      const buyNowAmount = parseFloat(listing.buyNowPrice);

      // Place a winning bid at buy-now price
      const bid = await placeBid({
        listingId: input.listingId,
        bidderId: ctx.user.id,
        amount: buyNowAmount.toString(),
        status: 'winning',
      });
      await markBidsAsOutbid(input.listingId, bid.id);

      // End the auction immediately
      await updateAuctionListing(input.listingId, {
        auctionStatus: 'ended_sold',
        currentHighestBid: buyNowAmount.toString(),
        currentHighestBidderId: ctx.user.id,
        winnerId: ctx.user.id,
        winningBidId: bid.id,
        hasReserveMet: true,
        bidCount: (listing.bidCount ?? 0) + 1,
        auctionEndAt: new Date(),
        status: 'sold',
      });

      // Create order
      const orderNo = await generateOrderNo();
      const order = await createMarketplaceOrder({
        orderNo,
        buyerId: ctx.user.id,
        sellerId: listing.sellerId!,
        totalHkd: buyNowAmount.toString(),
        orderStatus: 'pending_payment',
        paymentStatus: 'unpaid',
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        orderSource: 'auction',
        auctionListingId: input.listingId,
        auctionWinningBidId: bid.id,
      } as any);

      if (order) {
        await createOrderItems([{
          orderId: order.id,
          listingId: input.listingId,
          cardId: listing.cardId!,
          quantity: 1,
          unitPriceHkd: buyNowAmount.toString(),
          subtotalHkd: buyNowAmount.toString(),
        } as any]);

        // Notify seller
        await createNotification({
          userId: listing.sellerId!,
          type: 'auction_sold',
          title: '拍賣已售出（即時購買）',
          body: `您的拍賣 #${input.listingId} 已被即時購買，訂單號：${orderNo}`,
          relatedId: order.id,
        });
      }

      return { success: true, orderNo };
    }),

  /** Seller cancels a pending_review or scheduled auction */
  cancel: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "拍賣不存在" });
      if (listing.sellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const cancellableStatuses = ['pending_review', 'scheduled'];
      if (!cancellableStatuses.includes(listing.auctionStatus ?? '')) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能取消待審核或已排程的拍賣" });
      }

      await updateAuctionListing(input.listingId, {
        auctionStatus: 'cancelled',
        status: 'removed',
      });

      return { success: true };
    }),

  /** Get current user's bid history */
  myBids: protectedProcedure
    .query(async ({ ctx }) => {
      return getBidsByBidderId(ctx.user.id, 50);
    }),

  /** Get current user's auction violations */
  myViolations: protectedProcedure
    .query(async ({ ctx }) => {
      return getViolationsByUserId(ctx.user.id);
    }),

  /** Seller: get their own auction listings */
  sellerAuctions: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // marketplaceListings.sellerId stores sellerProfiles.id, not users.id
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (!sellerProfile) return { listings: [], total: 0 };
      return getSellerAuctions(sellerProfile.id, input);
    }),

  /** Seller: resubmit a rejected auction for review */
  resubmitAuction: protectedProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' });

      // Verify ownership via sellerProfile
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (!sellerProfile || listing.sellerId !== sellerProfile.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限操作此拍賣' });
      }
      if (listing.auctionStatus !== 'rejected') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能重新提交已被拒絕的拍賣' });
      }

      await updateAuctionListing(input.listingId, {
        auctionStatus: 'pending_review',
        status: 'pending_review',
        rejectedReason: null,
      });

      return { success: true };
    }),

  // ---- Admin ----

  /** Admin: list all auctions with optional status filter */
  adminList: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return getAdminAuctionListings(input);
    }),

  /** Admin: approve a pending_review auction */
  adminApprove: adminProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });
      if (listing.auctionStatus !== 'pending_review' && listing.auctionStatus !== 'rejected') {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能審核待審核或已拒絕的拍賣" });
      }

      const now = new Date();
      const startAt = listing.auctionStartAt ? new Date(listing.auctionStartAt) : now;
      const newStatus = startAt <= now ? 'active' : 'scheduled';

      await updateAuctionListing(input.listingId, {
        auctionStatus: newStatus,
        status: 'active',
      });

      // Notify seller
      await createNotification({
        userId: listing.sellerId!,
        type: 'auction_approved',
        title: '拍賣已通過審核',
        body: `您的拍賣 #${input.listingId} 已通過審核，${newStatus === 'active' ? '現已開始競投' : '將於排定時間開始'}`,
        relatedId: input.listingId,
      });

      return { success: true, newStatus };
    }),

  /** Admin: reject a pending_review auction */
  adminReject: adminProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      // Use 'rejected' status (distinct from 'cancelled') so seller can resubmit
      await updateAuctionListing(input.listingId, {
        auctionStatus: 'rejected',
        status: 'removed',
        rejectedReason: input.reason,
      });

      // Notify seller with link to their auction dashboard
      await createNotification({
        userId: listing.sellerId!,
        type: 'auction_rejected',
        title: '拍賣未通過審核',
        body: `您的拍賣「${listing.title ?? `#${input.listingId}`}」未通過審核。拒絕原因：${input.reason}。您可修改後重新提交。`,
        relatedId: input.listingId,
        linkUrl: '/seller?tab=auctions',
      });

      return { success: true };
    }),

  /** Admin: force cancel an active auction */
  adminCancel: adminProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      await updateAuctionListing(input.listingId, {
        auctionStatus: 'cancelled',
        status: 'removed',
        rejectedReason: input.reason,
      });

      // Refund all active bids (mark as retracted)
      const bids = await getBidsByListingId(input.listingId, 100);
      for (const bid of bids) {
        if (bid.status === 'active' || bid.status === 'winning') {
          await updateBidStatus(bid.id, 'retracted');
          await createNotification({
            userId: bid.bidderId,
            type: 'auction_cancelled',
            title: '拍賣已被取消',
            body: `您競投的拍賣 #${input.listingId} 已被管理員取消`,
            relatedId: input.listingId,
          });
        }
      }

      return { success: true };
    }),

  /** Admin: record a violation against a user */
  adminRecordViolation: adminProcedure
    .input(z.object({
      userId: z.number().int(),
      type: z.enum(["no_payment", "fake_bid", "seller_cancel"]),
      listingId: z.number().int().optional(),
      orderId: z.number().int().optional(),
      penalty: z.enum(["warning", "ban_7d", "ban_30d", "permanent"]),
      adminNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const banDays: Record<string, number | null> = {
        warning: null,
        ban_7d: 7,
        ban_30d: 30,
        permanent: null,
      };
      const days = banDays[input.penalty];
      const banExpiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : undefined;

      const violation = await createViolation({
        userId: input.userId,
        type: input.type,
        listingId: input.listingId,
        orderId: input.orderId,
        penalty: input.penalty,
        banExpiresAt,
        adminNote: input.adminNote,
      });

      await createNotification({
        userId: input.userId,
        type: 'auction_violation',
        title: '拍賣違規通知',
        body: `您的帳戶因拍賣違規（${input.type}）被記錄違規，處罰：${input.penalty}`,
        relatedId: violation.id,
      });

      return { success: true, violationId: violation.id };
    }),

  /** Admin: get auction statistics overview */
  adminGetStats: adminProcedure
    .query(async () => {
      return getAuctionAdminStats();
    }),

  /** Admin: list all violations with pagination */
  adminGetViolations: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(20),
      userId: z.number().int().optional(),
    }))
    .query(async ({ input }) => {
      return getAllAuctionViolations(input);
    }),

  /** Admin: lift a ban by deleting the violation record */
  adminLiftBan: adminProcedure
    .input(z.object({ violationId: z.number().int() }))
    .mutation(async ({ input }) => {
      await liftAuctionBan(input.violationId);
      return { success: true };
    }),

  /** Admin: approve high-value listing */
  adminApproveHighValue: adminProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' });
      await updateAuctionListing(input.listingId, { isHighValueReview: false } as any);
      // Notify seller
      const { getSellerProfileByUserId: getSP } = await import('../db');
      const sp = listing.sellerId ? await getSP(listing.sellerId) : null;
      if (sp?.userId) {
        await createNotification({
          userId: sp.userId,
          type: 'auction_won',
          title: '高價拍賣審核通過 ✅',
          body: `您的拍賣「${listing.title}」已通過高價額外審核，即將按排程開始。`,
          linkUrl: `/auction/${listing.id}`,
        }).catch(() => {});
      }
      return { success: true };
    }),

  /** Winner: create Stripe Checkout session to pay for won auction */
  createAuctionPayment: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' });
      if (listing.winnerId !== ctx.user.id) throw new TRPCError({ code: 'FORBIDDEN', message: '您不是此拍賣的得標者' });
      if (listing.auctionPaymentStatus === 'paid') throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣已完成付款' });
      const endedStatuses = ['ended_sold', 'ended_no_bid'] as const;
      if (!endedStatuses.includes(listing.auctionStatus as any)) throw new TRPCError({ code: 'BAD_REQUEST', message: '拍賣尚未結標' });

      const stripe = getStripe();
      const winningBid = parseFloat(listing.currentHighestBid ?? '0');
      if (winningBid <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: '無效的得標金額' });

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: ctx.user.email ?? undefined,
        line_items: [{
          price_data: {
            currency: 'hkd',
            product_data: {
              name: listing.title ?? `拍賣 #${listing.id}`,
              description: `得標拍賣，拍賣 ID: ${listing.id}`,
            },
            unit_amount: Math.round(winningBid * 100),
          },
          quantity: 1,
        }],
        metadata: {
          auction_listing_id: listing.id.toString(),
          user_id: ctx.user.id.toString(),
          customer_email: ctx.user.email ?? '',
          customer_name: ctx.user.name ?? '',
        },
        client_reference_id: ctx.user.id.toString(),
        success_url: `${input.origin}/auction/${listing.id}?payment=success`,
        cancel_url: `${input.origin}/auction/${listing.id}?payment=cancelled`,
        allow_promotion_codes: false,
      });

      // Save session ID to listing
      await updateAuctionListing(listing.id, {
        auctionPaymentSessionId: session.id,
      } as any);

      return { checkoutUrl: session.url };
    }),

  /** Submit review for completed auction (buyer reviews seller, seller reviews buyer) */
  submitAuctionReview: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(500).optional(),
      isAnonymous: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' });
      if (listing.auctionPaymentStatus !== 'paid') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '拍賣尚未完成付款，無法評價' });
      }

      const isBuyer = listing.winnerId === ctx.user.id;
      const isSeller = listing.sellerId === ctx.user.id;
      if (!isBuyer && !isSeller) throw new TRPCError({ code: 'FORBIDDEN' });

      const orderId = listing.auctionOrderId;
      if (!orderId) throw new TRPCError({ code: 'BAD_REQUEST', message: '找不到對應訂單' });

      // Check if already reviewed for this order+reviewer combination
      const { getReviewByOrderId, createReview, getSellerProfileByUserId: getSP2 } = await import('../db');
      const existingReview = await getReviewByOrderId(orderId);
      if (existingReview) throw new TRPCError({ code: 'BAD_REQUEST', message: '此拍賣已評價過' });

      const sellerProf = listing.sellerId ? await getSP2(listing.sellerId) : null;
      await createReview({
        orderId,
        listingId: listing.id,
        buyerId: listing.winnerId!,
        sellerId: sellerProf?.id ?? listing.sellerId!,
        rating: input.rating,
        comment: input.comment ?? null,
        isAnonymous: input.isAnonymous ?? false,
      });

      // Notify the other party
      const notifyUserId = isBuyer ? (sellerProf?.userId ?? null) : listing.winnerId;
      if (notifyUserId) {
        await createNotification({
          userId: notifyUserId,
          type: 'trade',
          title: `拍賣收到新評價 ${'⭐'.repeat(input.rating)}`,
          body: `${isBuyer ? '買家' : '賣家'}對拍賣「${listing.title}」給了 ${input.rating} 星評價${input.comment ? `：${input.comment.slice(0, 50)}` : ''}`,
          linkUrl: `/auction/${listing.id}`,
        }).catch(() => {});
      }

      return { success: true };
    }),
});
