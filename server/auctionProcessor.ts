/**
 * Auction Processor - Scheduled tasks for auction lifecycle management
 *
 * Tasks:
 * - processExpiredAuctions: runs every 30s, ends auctions past their end time
 * - processScheduledAuctions: runs every 60s, activates scheduled auctions
 * - notifyEndingSoon: runs every 5min, notifies bidders of auctions ending in 30min
 * - processPaymentReminders: runs every 30min, sends 12h payment reminders to unpaid winners
 */
import {
  getExpiredActiveAuctions,
  getScheduledAuctionsToStart,
  getAuctionsEndingSoon,
  getWinningBid,
  updateAuctionListing,
  getBidsByListingId,
  updateBidStatus,
  generateOrderNo,
  createMarketplaceOrder,
  createOrderItems,
  getDistinctBidderIds,
  getSellerProfileById,
  getAuctionOrdersNeedingPaymentReminder,
  markAuctionPaymentReminderSent,
  getAuctionListingById,
} from "./db";
import { createNotification } from "./db/notifications";
import {
  sendAuctionWonEmail,
  sendAuctionSoldEmail,
  sendAuctionPaymentReminderEmail,
} from "./emailService";

let endingSoonNotified = new Set<number>(); // listing IDs already notified this cycle

// ---- Format date in HKT for emails ----
function formatHKT(date: Date): string {
  return date.toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' (HKT)';
}

// ---- Process expired auctions (call every 30s) ----
export async function processExpiredAuctions(): Promise<void> {
  try {
    const expired = await getExpiredActiveAuctions();
    if (expired.length === 0) return;

    console.log(`[AuctionProcessor] Processing ${expired.length} expired auction(s)`);

    for (const listing of expired) {
      try {
        await finalizeAuction(listing);
      } catch (err) {
        console.error(`[AuctionProcessor] Error finalizing auction ${listing.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[AuctionProcessor] processExpiredAuctions error:", err);
  }
}

// ---- Process scheduled auctions (call every 60s) ----
export async function processScheduledAuctions(): Promise<void> {
  try {
    const toStart = await getScheduledAuctionsToStart();
    if (toStart.length === 0) return;

    console.log(`[AuctionProcessor] Activating ${toStart.length} scheduled auction(s)`);

    for (const listing of toStart) {
      try {
        await updateAuctionListing(listing.id, { auctionStatus: 'active' });
        console.log(`[AuctionProcessor] Auction ${listing.id} is now active`);

        // Notify seller
        if (listing.sellerId) {
          await createNotification({
            userId: listing.sellerId,
            type: 'auction_started',
            title: '您的拍賣已開始',
            body: `拍賣 #${listing.id} 已開始競投`,
            relatedId: listing.id,
            linkUrl: `/auction/${listing.id}`,
          });
        }
      } catch (err) {
        console.error(`[AuctionProcessor] Error activating auction ${listing.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[AuctionProcessor] processScheduledAuctions error:", err);
  }
}

// ---- Notify ending soon (call every 5min) ----
export async function notifyEndingSoon(): Promise<void> {
  try {
    // Notify at 1 hour before end (Phase 2 requirement)
    const endingSoon = await getAuctionsEndingSoon(60); // within 60 minutes
    for (const listing of endingSoon) {
      if (endingSoonNotified.has(listing.id)) continue;

      // Mark as ending_soon when within 15 minutes
      if (listing.auctionStatus === 'active') {
        const now = new Date();
        const endAt = listing.auctionEndAt ? new Date(listing.auctionEndAt) : null;
        if (endAt && (endAt.getTime() - now.getTime()) <= 15 * 60 * 1000) {
          await updateAuctionListing(listing.id, { auctionStatus: 'ending_soon' });
        }
      }

      // Notify ALL distinct bidders (not just the current highest)
      try {
        const bidderIds = await getDistinctBidderIds(listing.id);
        for (const bidderId of bidderIds) {
          const isLeading = bidderId === listing.currentHighestBidderId;
          await createNotification({
            userId: bidderId,
            type: 'auction_ending_soon',
            title: isLeading ? '您正在領先的拍賣即將結束' : '您參與的拍賣即將結束',
            body: isLeading
              ? `拍賣 #${listing.id} 將在 1 小時內結束，您目前是最高出價者`
              : `拍賣 #${listing.id} 將在 1 小時內結束，您目前已被超越`,
            relatedId: listing.id,
            linkUrl: `/auction/${listing.id}`,
          });
        }
      } catch (err) {
        console.error(`[AuctionProcessor] Failed to notify bidders for auction ${listing.id}:`, err);
      }

      // Notify seller
      if (listing.sellerId) {
        await createNotification({
          userId: listing.sellerId,
          type: 'auction_ending_soon',
          title: '您的拍賣即將結束',
          body: `拍賣 #${listing.id} 將在 1 小時內結束，當前最高出價：HK$${listing.currentHighestBid ?? listing.startingBid ?? '未有出價'}`,
          relatedId: listing.id,
          linkUrl: `/auction/${listing.id}`,
        });
      }

      endingSoonNotified.add(listing.id);
    }

    // Clean up old entries from the set (keep it from growing unbounded)
    if (endingSoonNotified.size > 1000) {
      endingSoonNotified = new Set();
    }
  } catch (err) {
    console.error("[AuctionProcessor] notifyEndingSoon error:", err);
  }
}

// ---- Process 12-hour payment reminders (call every 30min) ----
export async function processPaymentReminders(): Promise<void> {
  try {
    const orders = await getAuctionOrdersNeedingPaymentReminder();
    if (orders.length === 0) return;

    console.log(`[AuctionProcessor] Sending payment reminders for ${orders.length} order(s)`);

    for (const order of orders) {
      try {
        // Get listing title for email
        let cardName = `拍賣品 #${order.auctionListingId ?? order.id}`;
        if (order.auctionListingId) {
          try {
            const { getDb } = await import('./db');
            const { marketplaceListings } = await import('../drizzle/schema_new');
            const { eq } = await import('drizzle-orm');
            const db = await getDb();
            if (db) {
              const [listing] = await db.select({ title: marketplaceListings.title })
                .from(marketplaceListings)
                .where(eq(marketplaceListings.id, order.auctionListingId))
                .limit(1);
              if (listing?.title) cardName = listing.title;
            }
          } catch { /* ignore */ }
        }

        const paymentDeadline = order.createdAt
          ? formatHKT(new Date(new Date(order.createdAt).getTime() + 24 * 60 * 60 * 1000))
          : '結標後 24 小時';

        // Send reminder email to buyer
        await sendAuctionPaymentReminderEmail({
          userId: order.buyerId,
          cardName,
          winAmountHkd: parseFloat(order.subtotalHkd ?? '0').toFixed(0),
          orderNo: order.orderNo,
          paymentDeadline,
        });

        // Mark reminder as sent
        await markAuctionPaymentReminderSent(order.id);

        // Also send in-app notification
        await createNotification({
          userId: order.buyerId,
          type: 'auction_payment_reminder',
          title: '付款提醒：您的得標訂單尚未付款',
          body: `訂單 ${order.orderNo} 尚未付款，請在截止時間前完成付款，以免失去得標資格。`,
          relatedId: order.id,
          linkUrl: `/orders/${order.orderNo}`,
        });

        console.log(`[AuctionProcessor] Payment reminder sent for order ${order.orderNo}`);
      } catch (err) {
        console.error(`[AuctionProcessor] Failed to send payment reminder for order ${order.orderNo}:`, err);
      }
    }
  } catch (err) {
    console.error("[AuctionProcessor] processPaymentReminders error:", err);
  }
}

// ---- Finalize a single auction ----
async function finalizeAuction(listing: any): Promise<void> {
  const winningBid = await getWinningBid(listing.id);

  if (!winningBid || !listing.hasReserveMet) {
    // No bids or reserve not met → ended with no sale
    await updateAuctionListing(listing.id, {
      auctionStatus: 'ended_no_bid',
      status: 'active', // Keep listing active so seller can relist
    });

    console.log(`[AuctionProcessor] Auction ${listing.id} ended with no sale`);

    // Notify seller
    if (listing.sellerId) {
      await createNotification({
        userId: listing.sellerId,
        type: 'auction_ended_no_bid',
        title: '拍賣已結束（無成交）',
        body: winningBid
          ? `拍賣 #${listing.id} 已結束，最高出價未達底價`
          : `拍賣 #${listing.id} 已結束，無人出價`,
        relatedId: listing.id,
        linkUrl: `/seller?tab=auctions`,
      });
    }

    // Notify highest bidder if reserve not met
    if (winningBid && !listing.hasReserveMet) {
      await createNotification({
        userId: winningBid.bidderId,
        type: 'auction_ended_no_bid',
        title: '拍賣已結束（未達底價）',
        body: `您競投的拍賣 #${listing.id} 已結束，最高出價未達底價`,
        relatedId: listing.id,
        linkUrl: `/auction/${listing.id}`,
      });
      await updateBidStatus(winningBid.id, 'retracted');
    }

    return;
  }

    // Has winning bid and reserve met → create order
  await updateAuctionListing(listing.id, {
    auctionStatus: 'ended_sold',
    status: 'sold',
    winnerId: winningBid.bidderId,
    winningBidId: winningBid.id,
  });
  const winAmount = parseFloat(winningBid.amount as any);
  let orderNo: string;
  try {
    orderNo = await generateOrderNo();
  } catch (err) {
    console.error(`[AuctionProcessor] Failed to generate order number for auction ${listing.id}:`, err);
    throw err;
  }
  const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const paymentDeadlineStr = formatHKT(paymentDeadline);
  // Determine seller type and calculate platform fee
  // Platform-owned items (no sellerId) have 0% platform fee
  const itemSellerType = listing.sellerId ? 'seller' : 'platform';
  const PLATFORM_FEE_RATE = itemSellerType === 'platform' ? 0 : 0.05;
  const platformFee = parseFloat((winAmount * PLATFORM_FEE_RATE).toFixed(2));
  const sellerReceivable = parseFloat((winAmount - platformFee).toFixed(2));
  let order: any;
  try {
    order = await createMarketplaceOrder({
      orderNo,
      buyerId: winningBid.bidderId,
      sellerId: listing.sellerId ?? undefined,
      sellerType: itemSellerType,
      listingId: listing.id,
      unitPriceHkd: winAmount.toFixed(2),
      quantity: 1,
      subtotalHkd: winAmount.toFixed(2),
      platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
      platformFeeHkd: platformFee.toFixed(2),
      sellerReceivableHkd: sellerReceivable.toFixed(2),
      paymentMethod: itemSellerType === 'platform' ? null : 'stripe', // Platform auctions allow Alipay choice
      orderStatus: 'pending_payment',
      paymentStatus: 'pending',
      orderSource: 'auction',
      auctionListingId: listing.id,
      auctionWinningBidId: winningBid.id,
    } as any);
  } catch (err) {
    console.error(`[AuctionProcessor] CRITICAL: Failed to create order for auction ${listing.id} (${orderNo}). Auction marked as ended_sold but no order exists. Manual intervention required.`, err);
    throw err;
  }

  if (order) {
    await createOrderItems([{
      orderId: order.id,
      listingId: listing.id,
      sellerId: listing.sellerId ?? undefined,
      sellerType: itemSellerType,
      title: listing.title ?? `拍賣品 #${listing.id}`,
      price: winAmount.toFixed(2),
      quantity: 1,
    } as any]);

    console.log(`[AuctionProcessor] Auction ${listing.id} ended → Order ${orderNo} created`);

    // Notify winner (in-app)
    await createNotification({
      userId: winningBid.bidderId,
      type: 'auction_won',
      title: '恭喜！您贏得了拍賣',
      body: `您以 HK$${winAmount} 贏得拍賣 #${listing.id}，請在 24 小時內完成付款。訂單號：${orderNo}`,
      relatedId: order.id,
      linkUrl: `/orders/${orderNo}`,
    });

    // Notify seller (in-app)
    if (listing.sellerId) {
      await createNotification({
        userId: listing.sellerId,
        type: 'auction_sold',
        title: '拍賣成功售出',
        body: `您的拍賣 #${listing.id} 以 HK$${winAmount} 售出，訂單號：${orderNo}`,
        relatedId: order.id,
        linkUrl: `/seller?tab=auctions`,
      });
    }

    // Get buyer name for seller email
    let buyerName = '買家';
    try {
      const { getDb } = await import('./db');
      const { users } = await import('../drizzle/schema_new');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (db) {
        const [buyer] = await db.select({ name: users.name }).from(users).where(eq(users.id, winningBid.bidderId)).limit(1);
        if (buyer?.name) buyerName = buyer.name;
      }
    } catch { /* ignore */ }

    // Send email to winner
    sendAuctionWonEmail({
      userId: winningBid.bidderId,
      cardName: listing.title ?? `拍賣品 #${listing.id}`,
      winAmountHkd: winAmount.toFixed(0),
      orderNo,
      paymentDeadline: paymentDeadlineStr,
    }).catch(err => console.error('[AuctionProcessor] Failed to send auction won email:', err));

    // Send email to seller (get seller's userId from sellerProfile)
    if (listing.sellerId) {
      try {
        const sellerProfile = await getSellerProfileById(listing.sellerId);
        if (sellerProfile?.userId) {
          sendAuctionSoldEmail({
            userId: sellerProfile.userId,
            cardName: listing.title ?? `拍賣品 #${listing.id}`,
            winAmountHkd: winAmount.toFixed(0),
            orderNo,
            buyerName,
          }).catch(err => console.error('[AuctionProcessor] Failed to send auction sold email:', err));
        }
      } catch (err) {
        console.error('[AuctionProcessor] Failed to get seller profile for email:', err);
      }
    }
  }

  // Mark all other bids as retracted
  const allBids = await getBidsByListingId(listing.id, 100);
  for (const bid of allBids) {
    if (bid.id !== winningBid.id && (bid.status === 'active' || bid.status === 'outbid')) {
      await updateBidStatus(bid.id, 'retracted');
    }
  }
}

// ---- Admin: Force-end a single active/ending_soon auction immediately ----
export async function forceEndAuction(listingId: number): Promise<void> {
  const listing = await getAuctionListingById(listingId);
  if (!listing) throw new Error(`Auction ${listingId} not found`);
  if (!['active', 'ending_soon', 'scheduled'].includes(listing.auctionStatus ?? '')) {
    throw new Error(`Auction ${listingId} is not in an active state (current: ${listing.auctionStatus})`);
  }
  // If scheduled, just activate first then finalize
  if (listing.auctionStatus === 'scheduled') {
    await updateAuctionListing(listingId, { auctionStatus: 'active' });
    listing.auctionStatus = 'active';
  }
  await finalizeAuction(listing);
}
