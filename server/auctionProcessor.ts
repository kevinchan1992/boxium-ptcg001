/**
 * Auction Processor - Scheduled tasks for auction lifecycle management
 *
 * Tasks:
 * - processExpiredAuctions: runs every 30s, ends auctions past their end time
 * - processScheduledAuctions: runs every 60s, activates scheduled auctions
 * - notifyEndingSoon: runs every 5min, notifies bidders of auctions ending in 30min
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
} from "./db";
import { createNotification } from "./db/notifications";

let endingSoonNotified = new Set<number>(); // listing IDs already notified this cycle

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
    const endingSoon = await getAuctionsEndingSoon(30); // within 30 minutes
    for (const listing of endingSoon) {
      if (endingSoonNotified.has(listing.id)) continue;

      // Mark as ending_soon
      if (listing.auctionStatus === 'active') {
        await updateAuctionListing(listing.id, { auctionStatus: 'ending_soon' });
      }

      // Notify current highest bidder
      if (listing.currentHighestBidderId) {
        await createNotification({
          userId: listing.currentHighestBidderId,
          type: 'auction_ending_soon',
          title: '您正在領先的拍賣即將結束',
          body: `拍賣 #${listing.id} 將在 30 分鐘內結束，您目前是最高出價者`,
          relatedId: listing.id,
        });
      }

      // Notify seller
      if (listing.sellerId) {
        await createNotification({
          userId: listing.sellerId,
          type: 'auction_ending_soon',
          title: '您的拍賣即將結束',
          body: `拍賣 #${listing.id} 將在 30 分鐘內結束`,
          relatedId: listing.id,
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
  const orderNo = await generateOrderNo();
  const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const order = await createMarketplaceOrder({
    orderNo,
    buyerId: winningBid.bidderId,
    sellerId: listing.sellerId,
    totalHkd: winAmount.toString(),
    orderStatus: 'pending_payment',
    paymentStatus: 'unpaid',
    paymentDeadline,
    orderSource: 'auction',
    auctionListingId: listing.id,
    auctionWinningBidId: winningBid.id,
  } as any);

  if (order) {
    await createOrderItems([{
      orderId: order.id,
      listingId: listing.id,
      cardId: listing.cardId,
      quantity: 1,
      unitPriceHkd: winAmount.toString(),
      subtotalHkd: winAmount.toString(),
    } as any]);

    console.log(`[AuctionProcessor] Auction ${listing.id} ended → Order ${orderNo} created`);

    // Notify winner
    await createNotification({
      userId: winningBid.bidderId,
      type: 'auction_won',
      title: '恭喜！您贏得了拍賣',
      body: `您以 HK$${winAmount} 贏得拍賣 #${listing.id}，請在 24 小時內完成付款。訂單號：${orderNo}`,
      relatedId: order.id,
    });

    // Notify seller
    if (listing.sellerId) {
      await createNotification({
        userId: listing.sellerId,
        type: 'auction_sold',
        title: '拍賣成功售出',
        body: `您的拍賣 #${listing.id} 以 HK$${winAmount} 售出，訂單號：${orderNo}`,
        relatedId: order.id,
      });
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
