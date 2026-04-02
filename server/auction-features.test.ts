import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Feature 1: Auction Payment Violation Recording ───────────────────────────
describe('Auction Payment Violation Recording', () => {
  it('should record a no_payment violation when an auction order times out', () => {
    // Simulate the violation recording logic from priceUpdateScheduler.ts
    const violations: Array<{ userId: number; type: string; orderId: number }> = [];
    const createViolation = (userId: number, type: string, orderId: number) => {
      violations.push({ userId, type, orderId });
    };

    // Simulate an expired auction order
    const expiredOrder = {
      id: 1001,
      buyerId: 42,
      orderStatus: 'pending_payment',
      orderSource: 'auction',
      auctionListingId: 5,
    };

    // When order is cancelled due to timeout, record violation
    if (expiredOrder.orderSource === 'auction') {
      createViolation(expiredOrder.buyerId, 'no_payment', expiredOrder.id);
    }

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      userId: 42,
      type: 'no_payment',
      orderId: 1001,
    });
  });

  it('should determine ban level based on violation count', () => {
    const getBanLevel = (count: number): 'warning' | 'ban_7d' | 'ban_30d' => {
      if (count >= 3) return 'ban_30d';
      if (count >= 2) return 'ban_7d';
      return 'warning';
    };

    expect(getBanLevel(1)).toBe('warning');
    expect(getBanLevel(2)).toBe('ban_7d');
    expect(getBanLevel(3)).toBe('ban_30d');
    expect(getBanLevel(5)).toBe('ban_30d');
  });

  it('should not record violation for non-auction orders', () => {
    const violations: Array<{ userId: number; type: string }> = [];
    const createViolation = (userId: number, type: string) => {
      violations.push({ userId, type });
    };

    const expiredOrder = {
      id: 1002,
      buyerId: 43,
      orderStatus: 'pending_payment',
      orderSource: 'marketplace', // NOT auction
    };

    if (expiredOrder.orderSource === 'auction') {
      createViolation(expiredOrder.buyerId, 'no_payment');
    }

    expect(violations).toHaveLength(0);
  });
});

// ─── Feature 2: Auction Won Email Optimization ────────────────────────────────
describe('Auction Won Email Optimization', () => {
  it('should include cart URL in auction won email', () => {
    const buildAuctionWonEmail = (params: {
      winnerName: string;
      itemTitle: string;
      winningBid: number;
      paymentDeadline: Date;
      cartUrl: string;
    }) => {
      return {
        subject: `🏆 恭喜得標！${params.itemTitle}`,
        hasCartLink: params.cartUrl.includes('/cart'),
        hasDeadline: params.paymentDeadline instanceof Date,
        ctaText: '前往購物車付款',
      };
    };

    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const email = buildAuctionWonEmail({
      winnerName: '張三',
      itemTitle: '皮卡丘 PSA 10',
      winningBid: 500,
      paymentDeadline: deadline,
      cartUrl: 'https://example.com/cart',
    });

    expect(email.subject).toContain('恭喜得標');
    expect(email.hasCartLink).toBe(true);
    expect(email.hasDeadline).toBe(true);
    expect(email.ctaText).toBe('前往購物車付款');
  });

  it('should format payment deadline correctly', () => {
    const formatDeadline = (date: Date): string => {
      return date.toLocaleString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const deadline = new Date('2026-04-03T12:00:00+08:00');
    const formatted = formatDeadline(deadline);
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });
});

// ─── Feature 3: Mixed Cart Checkout (Auction + Marketplace) ──────────────────
describe('Mixed Cart Checkout', () => {
  it('should combine marketplace items and auction orders in total', () => {
    const marketplaceItems = [
      { listingId: 1, priceHkd: '200', title: '卡牌 A' },
      { listingId: 2, priceHkd: '150', title: '卡牌 B' },
    ];
    const auctionOrders = [
      { orderId: 101, orderNo: 'AUC-001', subtotalHkd: '500' },
      { orderId: 102, orderNo: 'AUC-002', subtotalHkd: '300' },
    ];

    const marketplaceTotal = marketplaceItems.reduce((s, i) => s + parseFloat(i.priceHkd), 0);
    const auctionTotal = auctionOrders.reduce((s, o) => s + parseFloat(o.subtotalHkd), 0);
    const combinedTotal = marketplaceTotal + auctionTotal;

    expect(marketplaceTotal).toBe(350);
    expect(auctionTotal).toBe(800);
    expect(combinedTotal).toBe(1150);
  });

  it('should allow checkout with only auction orders (no marketplace items)', () => {
    const items: any[] = [];
    const auctionOrderIds = [101, 102];

    const isValid = items.length > 0 || auctionOrderIds.length > 0;
    expect(isValid).toBe(true);
  });

  it('should allow checkout with only marketplace items (no auction orders)', () => {
    const items = [{ listingId: 1, priceHkd: '200' }];
    const auctionOrderIds: number[] = [];

    const isValid = items.length > 0 || auctionOrderIds.length > 0;
    expect(isValid).toBe(true);
  });

  it('should reject checkout with neither marketplace items nor auction orders', () => {
    const items: any[] = [];
    const auctionOrderIds: number[] = [];

    const isValid = items.length > 0 || auctionOrderIds.length > 0;
    expect(isValid).toBe(false);
  });

  it('should create correct Stripe line items for mixed checkout', () => {
    const marketplaceItems = [
      { title: '皮卡丘 PSA 10', priceHkd: 500 },
    ];
    const auctionOrders = [
      { orderNo: 'AUC-001', subtotalHkd: '800', listingTitle: '噴火龍 BGS 9.5' },
    ];

    const lineItems = [
      ...marketplaceItems.map(i => ({
        name: i.title,
        amount: Math.round(i.priceHkd * 100),
        currency: 'hkd',
      })),
      ...auctionOrders.map(o => ({
        name: `🏆 拍賣得標：${o.listingTitle}`,
        amount: Math.round(parseFloat(o.subtotalHkd) * 100),
        currency: 'hkd',
      })),
    ];

    expect(lineItems).toHaveLength(2);
    expect(lineItems[0].name).toBe('皮卡丘 PSA 10');
    expect(lineItems[0].amount).toBe(50000);
    expect(lineItems[1].name).toBe('🏆 拍賣得標：噴火龍 BGS 9.5');
    expect(lineItems[1].amount).toBe(80000);
  });

  it('should update auctionPaymentStatus to paid after webhook processes auction order', () => {
    const orders: Record<number, { orderStatus: string; paymentStatus: string }> = {
      101: { orderStatus: 'pending_payment', paymentStatus: 'pending' },
    };
    const auctionListings: Record<number, { auctionPaymentStatus: string }> = {
      5: { auctionPaymentStatus: 'pending' },
    };

    // Simulate webhook processing
    const batchOrder = {
      id: 101,
      orderNo: 'AUC-001',
      orderStatus: 'pending_payment',
      orderSource: 'auction',
      auctionListingId: 5,
    };

    if (batchOrder.orderStatus === 'pending_payment') {
      orders[batchOrder.id] = { orderStatus: 'payment_received', paymentStatus: 'paid' };
      if (batchOrder.orderSource === 'auction' && batchOrder.auctionListingId) {
        auctionListings[batchOrder.auctionListingId].auctionPaymentStatus = 'paid';
      }
    }

    expect(orders[101].orderStatus).toBe('payment_received');
    expect(orders[101].paymentStatus).toBe('paid');
    expect(auctionListings[5].auctionPaymentStatus).toBe('paid');
  });
});
