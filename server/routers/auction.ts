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
  getSellerProfileById,
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
      tcgSeries: z.string().optional(),
      sortBy: z.enum(['ending_soon', 'newest', 'price_asc', 'price_desc']).optional(),
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
      if (!sellerProfile) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '請先完成賣家認證才能上架拍賣' });
      const sellerTotalSales = sellerProfile?.totalSales ?? 0;
      const isNewSeller = sellerTotalSales < NEW_SELLER_SALES_THRESHOLD;
      if (isNewSeller && input.startingBid > NEW_SELLER_MAX_BID_HKD) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `新賣家（完成成交少於 ${NEW_SELLER_SALES_THRESHOLD} 次）的拍賣起拍價上限為 HK$${NEW_SELLER_MAX_BID_HKD.toLocaleString()}。請先完成更多交易以提高額度限制。`,
        });
      }

      // Flag high-value listings for admin monitoring (governance mode: still auto-published)
      const isHighValueReview = input.startingBid > HIGH_VALUE_THRESHOLD_HKD;

      const startAt = input.auctionStartAt ?? new Date();
      const endAt = input.auctionEndAt;
      const now = new Date();

      // AUTO-PUBLISH: Determine auction status based on start time
      // If startAt is in the future, set to 'scheduled'; otherwise 'active'
      const auctionStatus = startAt > now ? 'scheduled' : 'active';
      const listingStatus = startAt > now ? 'active' : 'active'; // Always active for governance mode

      // Create the listing — auto-published, no admin pre-approval required
      // IMPORTANT: sellerId must be sellerProfile.id (not user.id) for consistency
      const listing = await createListing({
        sellerId: sellerProfile.id,
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
        status: listingStatus,
        listingMode: 'auction',
        auctionStatus: auctionStatus,
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

      // Governance: notify admin for high-value listings (monitoring, not blocking)
      if (isHighValueReview) {
        const { notifyAdmin } = await import('../emailService').catch(() => ({ notifyAdmin: null }));
        if (notifyAdmin) {
          await notifyAdmin({
            title: '高價拍賣風控通知',
            content: `賣家 #${ctx.user.id} 上架的拍賣起拍價為 HK$${input.startingBid.toLocaleString()}，超過 HK$${HIGH_VALUE_THRESHOLD_HKD.toLocaleString()} 門標，已自動發佈但需要風控監控。拍賣 ID: ${listing?.id}`,
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
      // Compare using sellerProfile.id (sellerId stores sellerProfile.id, not user.id)
      const bidderSellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (bidderSellerProfile && listing.sellerId === bidderSellerProfile.id) {
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
          linkUrl: `/auction/${input.listingId}`,
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
      // Compare using sellerProfile.id (sellerId stores sellerProfile.id, not user.id)
      const buyerSellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (buyerSellerProfile && listing.sellerId === buyerSellerProfile.id) {
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
          linkUrl: `/seller?tab=auctions`,
        });
      }

      return { success: true, orderNo };
    }),

  /** Seller cancels a scheduled auction (governance mode: no pending_review) */
  cancel: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "拍賣不存在" });
      if (listing.sellerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Governance mode: only scheduled auctions can be cancelled by seller
      const cancellableStatuses = ['scheduled'];
      if (!cancellableStatuses.includes(listing.auctionStatus ?? '')) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能取消已排程的拍賣（尚未開始）" });
      }

      await updateAuctionListing(input.listingId, {
        auctionStatus: 'cancelled',
        status: 'removed',
      });

      return { success: true };
    }),

  /** Get current user's bid history - grouped by listing (one card per auction) */
  myBids: protectedProcedure
    .query(async ({ ctx }) => {
      // Get all bids by this user
      const allBids = await getBidsByBidderId(ctx.user.id, 200);
      if (allBids.length === 0) return [];

      // Group by listingId, keep highest bid per listing
      const listingMap = new Map<number, typeof allBids[0]>();
      for (const bid of allBids) {
        const existing = listingMap.get(bid.listingId);
        if (!existing || parseFloat(bid.amount) > parseFloat(existing.amount)) {
          listingMap.set(bid.listingId, bid);
        }
      }

      // Fetch listing info for each unique listingId
      const listingIds = Array.from(listingMap.keys());
      const listings = await Promise.all(
        listingIds.map(id => getAuctionListingById(id))
      );
      const listingById = new Map(listings.filter(Boolean).map(l => [l!.id, l!]));

      // Build enriched result
      const results = listingIds.map(listingId => {
        const bid = listingMap.get(listingId)!;
        const listing = listingById.get(listingId);
        const isEnded = listing && ['ended_sold', 'ended_no_bid', 'cancelled', 'rejected'].includes(listing.auctionStatus ?? '');
        const isWinner = listing && listing.winnerId === ctx.user.id;
        const isHighestBidder = listing && listing.currentHighestBidderId === ctx.user.id;

        // Determine display status
        let displayStatus: 'winning' | 'outbid' | 'won' | 'lost' | 'active';
        if (isEnded) {
          displayStatus = isWinner ? 'won' : 'lost';
        } else if (isHighestBidder) {
          displayStatus = 'winning';
        } else {
          displayStatus = 'outbid';
        }

        // Parse images
        let imageUrls: string[] = [];
        try { imageUrls = listing?.images ? JSON.parse(listing.images) : []; } catch {}

        return {
          id: bid.id,
          listingId,
          amount: parseFloat(bid.amount),
          status: displayStatus,
          createdAt: bid.createdAt,
          listing: listing ? {
            id: listing.id,
            title: listing.title,
            tcgSeries: listing.tcgSeries,
            auctionStatus: listing.auctionStatus,
            auctionEndAt: listing.auctionEndAt,
            currentHighestBid: listing.currentHighestBid ? parseFloat(listing.currentHighestBid) : null,
            imageUrls,
            winnerId: listing.winnerId,
            auctionPaymentStatus: listing.auctionPaymentStatus,
          } : null,
        };
      });

      // Sort: winning first, then outbid, then won, then lost; within each group by createdAt desc
      const order: Record<string, number> = { winning: 0, outbid: 1, active: 2, won: 3, lost: 4 };
      return results.sort((a, b) => {
        const oa = order[a.status] ?? 5;
        const ob = order[b.status] ?? 5;
        if (oa !== ob) return oa - ob;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }),

  /** Get current user's auction violations */
  myViolations: protectedProcedure
    .query(async ({ ctx }) => {
      return getViolationsByUserId(ctx.user.id);
    }),

  /** Get current user's active ban status with full details (for bid page pre-check) */
  getMyBanStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const violations = await getViolationsByUserId(ctx.user.id);
      const now = new Date();
      // Find the most severe active ban
      const penaltyOrder: Record<string, number> = { permanent: 0, ban_30d: 1, ban_7d: 2, warning: 3 };
      const activeBan = violations
        .filter(v => {
          if (v.penalty === 'permanent') return true;
          if ((v.penalty === 'ban_7d' || v.penalty === 'ban_30d') && v.banExpiresAt) {
            return new Date(v.banExpiresAt) > now;
          }
          return false;
        })
        .sort((a, b) => (penaltyOrder[a.penalty] ?? 9) - (penaltyOrder[b.penalty] ?? 9))[0];

      const warningCount = violations.filter(v => v.penalty === 'warning').length;
      const noPaymentCount = violations.filter(v => v.type === 'no_payment').length;

      if (!activeBan) {
        return { isBanned: false, warningCount, noPaymentCount, activeBan: null };
      }
      return {
        isBanned: true,
        warningCount,
        noPaymentCount,
        activeBan: {
          penalty: activeBan.penalty as string,
          type: activeBan.type as string,
          banExpiresAt: activeBan.banExpiresAt,
          createdAt: activeBan.createdAt,
          adminNote: activeBan.adminNote,
        },
      };
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

  /** Seller: resubmit a delisted auction (governance mode: republish as scheduled/active) */
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
      // Governance mode: seller can only resubmit admin-delisted auctions (not cancelled ones)
      if (listing.auctionStatus !== 'rejected' && !listing.adminDelisted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能重新上架被平台下架的拍賣' });
      }

      const now = new Date();
      const startAt = listing.auctionStartAt ? new Date(listing.auctionStartAt) : now;
      const newAuctionStatus = startAt > now ? 'scheduled' : 'active';

      await updateAuctionListing(input.listingId, {
        auctionStatus: newAuctionStatus,
        status: 'active',
        rejectedReason: null,
        adminDelisted: false,
      } as any);

      return { success: true };
    }),

  // ---- Admin ----

  /** Admin: list all auctions with optional status filter */
  adminList: adminProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      isHighValueReview: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      return getAdminAuctionListings(input);
    }),

  /** Admin: restore a delisted auction (governance mode) */
  adminApprove: adminProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      const now = new Date();
      const startAt = listing.auctionStartAt ? new Date(listing.auctionStartAt) : now;
      const newStatus = startAt <= now ? 'active' : 'scheduled';

      await updateAuctionListing(input.listingId, {
        auctionStatus: newStatus,
        status: 'active',
        adminDelisted: false,
        rejectedReason: null,
      } as any);

      // Notify seller
      const sellerProfile = await getSellerProfileById(listing.sellerId!);
      if (sellerProfile?.userId) {
        await createNotification({
          userId: sellerProfile.userId,
          type: 'auction_approved',
          title: '拍賣已重新上架 ✅',
          body: `您的拍賣「${listing.title ?? `#${input.listingId}`}」已由管理員重新上架。`,
          relatedId: input.listingId,
          linkUrl: `/auction/${input.listingId}`,
        }).catch(() => {});
      }

      return { success: true, newStatus };
    }),

  /** Admin: delist an auction (governance mode — replaces reject) */
  adminReject: adminProcedure
    .input(z.object({
      listingId: z.number().int(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND" });

      // Governance: delist the auction (seller can appeal or resubmit)
      await updateAuctionListing(input.listingId, {
        auctionStatus: 'cancelled',
        status: 'removed',
        adminDelisted: true,
        rejectedReason: input.reason,
      } as any);

      // Notify seller
      const sellerProfile = await getSellerProfileById(listing.sellerId!);
      if (sellerProfile?.userId) {
        await createNotification({
          userId: sellerProfile.userId,
          type: 'auction_rejected',
          title: '拍賣已被強制下架 ❌',
          body: `您的拍賣「${listing.title ?? `#${input.listingId}`}」已被平台下架。原因：${input.reason}`,
          relatedId: input.listingId,
          linkUrl: '/seller?tab=auctions',
        }).catch(() => {});
      }

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
            linkUrl: `/auction/${input.listingId}`,
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
        linkUrl: `/profile?tab=notifications`,
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

  /** Seller: update content of a rejected auction before resubmitting */
  updateRejectedAuction: protectedProcedure
    .input(z.object({
      listingId: z.number().int(),
      title: z.string().optional(),
      description: z.string().optional(),
      condition: z.string().optional(),
      images: z.array(z.string()).optional(),
      startingBid: z.number().min(1).optional(),
      reservePrice: z.number().optional().nullable(),
      buyNowPrice: z.number().optional().nullable(),
      bidIncrement: z.number().min(1).optional(),
      auctionStartAt: z.date().optional().nullable(),
      auctionEndAt: z.date().optional(),
      antiSnipingMinutes: z.number().int().min(0).max(30).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listing = await getAuctionListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: 'NOT_FOUND' });

      // Verify ownership via sellerProfile
      const sellerProfile = await getSellerProfileByUserId(ctx.user.id);
      if (!sellerProfile || listing.sellerId !== sellerProfile.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '您沒有權限操作此拍賣' });
      }
      if (listing.auctionStatus !== 'rejected') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '只能編輯已被拒絕的拍賣' });
      }

      const updateData: Record<string, any> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.condition !== undefined) updateData.condition = input.condition;
      if (input.images !== undefined) updateData.images = JSON.stringify(input.images);
      if (input.startingBid !== undefined) {
        updateData.startingBid = input.startingBid.toString();
        updateData.priceHkd = input.startingBid.toString();
      }
      if (input.reservePrice !== undefined) updateData.reservePrice = input.reservePrice?.toString() ?? null;
      if (input.buyNowPrice !== undefined) updateData.buyNowPrice = input.buyNowPrice?.toString() ?? null;
      if (input.bidIncrement !== undefined) updateData.bidIncrement = input.bidIncrement.toString();
      if (input.auctionStartAt !== undefined) updateData.auctionStartAt = input.auctionStartAt;
      if (input.auctionEndAt !== undefined) updateData.auctionEndAt = input.auctionEndAt;
      if (input.antiSnipingMinutes !== undefined) updateData.antiSnipingMinutes = input.antiSnipingMinutes;

      await updateAuctionListing(input.listingId, updateData);

      return { success: true };
    }),

  /** Admin: Force-end an active/ending_soon auction immediately (for testing) */
  adminForceEnd: adminProcedure
    .input(z.object({ listingId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { forceEndAuction } = await import('../auctionProcessor');
      await forceEndAuction(input.listingId);
      return { success: true };
    }),

  /** Admin: List auction orders with filtering */
  adminGetAuctionOrders: adminProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      status: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getAdminAuctionOrders } = await import('../db');
      return getAdminAuctionOrders(input);
    }),
});
