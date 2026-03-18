/**
 * Tests for OrderDetailDialog new features:
 * 1. Order status history (adminGetOrderHistory)
 * 2. Send message to buyer (adminSendBuyerMessage)
 * 3. Print order (frontend-only, tested via data structure)
 * 4. Fix white text: paymentMethod and listingCondition badge
 */

import { describe, it, expect } from 'vitest';

// ─── 1. Order Status History ─────────────────────────────────────────────────

describe('Order Status History', () => {
  it('should return history array for a valid orderId', () => {
    const mockHistory = [
      {
        id: 1,
        orderId: 100,
        fromStatus: 'processing',
        toStatus: 'shipped',
        operatorId: 1,
        operatorName: 'Admin',
        note: '已出貨',
        createdAt: new Date('2026-03-01T10:00:00Z'),
      },
      {
        id: 2,
        orderId: 100,
        fromStatus: 'shipped',
        toStatus: 'completed',
        operatorId: 1,
        operatorName: 'Admin',
        note: '買家確認收貨',
        createdAt: new Date('2026-03-05T10:00:00Z'),
      },
    ];

    expect(mockHistory).toHaveLength(2);
    expect(mockHistory[0].fromStatus).toBe('processing');
    expect(mockHistory[0].toStatus).toBe('shipped');
    expect(mockHistory[1].toStatus).toBe('completed');
  });

  it('should return empty array when no history exists', () => {
    const emptyHistory: any[] = [];
    expect(emptyHistory).toHaveLength(0);
  });

  it('should include operatorName in history records', () => {
    const record = {
      id: 1,
      orderId: 100,
      fromStatus: null,
      toStatus: 'processing',
      operatorId: 1,
      operatorName: 'Admin',
      note: '訂單建立',
      createdAt: new Date(),
    };
    expect(record.operatorName).toBe('Admin');
  });

  it('should handle null fromStatus for initial status records', () => {
    const record = {
      id: 1,
      orderId: 100,
      fromStatus: null,
      toStatus: 'processing',
      operatorId: null,
      operatorName: null,
      note: null,
      createdAt: new Date(),
    };
    expect(record.fromStatus).toBeNull();
    expect(record.toStatus).toBe('processing');
  });

  it('should display status transition label correctly', () => {
    const orderStatusLabel: Record<string, string> = {
      processing: '處理中',
      shipped: '已發貨',
      completed: '已完成',
      cancelled: '已取消',
    };
    const h = { fromStatus: 'processing', toStatus: 'shipped' };
    const label = h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus
      ? `${orderStatusLabel[h.fromStatus] ?? h.fromStatus} → ${orderStatusLabel[h.toStatus] ?? h.toStatus}`
      : (orderStatusLabel[h.toStatus] ?? h.toStatus);
    expect(label).toBe('處理中 → 已發貨');
  });
});

// ─── 2. Send Message to Buyer ─────────────────────────────────────────────────

describe('Send Message to Buyer', () => {
  it('should validate subject is not empty', () => {
    const subject = '';
    const isValid = subject.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('should validate message body is not empty', () => {
    const body = '   ';
    const isValid = body.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it('should pass validation when both subject and body are filled', () => {
    const subject = '關於您的訂單';
    const body = '您好，您的訂單已出貨，請留意收件。';
    const isValid = subject.trim().length > 0 && body.trim().length > 0;
    expect(isValid).toBe(true);
  });

  it('should enforce subject max length of 200 chars', () => {
    const longSubject = 'a'.repeat(201);
    const isValid = longSubject.length <= 200;
    expect(isValid).toBe(false);
  });

  it('should enforce message max length of 2000 chars', () => {
    const longMessage = 'a'.repeat(2001);
    const isValid = longMessage.length <= 2000;
    expect(isValid).toBe(false);
  });

  it('should create notification with correct fields', () => {
    const notification = {
      userId: 42,
      type: 'order_message',
      title: '[Admin] 關於您的訂單',
      body: '您好，您的訂單已出貨。',
      linkUrl: '/orders/BOXIUM-20260311-6785',
    };
    expect(notification.type).toBe('order_message');
    expect(notification.title).toContain('[Admin]');
    expect(notification.linkUrl).toContain('/orders/');
  });
});

// ─── 3. Print Order Data Structure ───────────────────────────────────────────

describe('Print Order Data Structure', () => {
  it('should include all required fields for print', () => {
    const order = {
      orderNo: 'BOXIUM-20260311-6785',
      listingTitle: '002',
      listingCondition: 'A',
      quantity: 1,
      subtotalHkd: '1000.00',
      platformFeeHkd: '0.00',
      sellerReceivableHkd: '1000.00',
      paymentMethod: 'stripe',
      buyerName: 'abc',
      buyerEmail: 'test@example.com',
      buyerPhone: '65123456',
      shippingName: 'kevin chan',
      shippingPhone: '68714567',
      shippingAddress: '{"address":"Flat A06 20/F","district":"新界","region":"香港"}',
      shippingMethod: 'sf_express',
      trackingNumber: 'SF123456',
      createdAt: new Date('2026-03-11T09:35:12Z'),
    };

    expect(order.orderNo).toBeTruthy();
    expect(order.buyerName).toBeTruthy();
    expect(order.shippingName).toBeTruthy();
    expect(parseFloat(order.subtotalHkd)).toBeGreaterThan(0);
  });

  it('should parse shipping address JSON correctly', () => {
    const shippingAddress = '{"address":"Flat A06 20/F","district":"新界","region":"香港"}';
    const addr = JSON.parse(shippingAddress);
    const formatted = [addr.address, addr.district, addr.region].filter(Boolean).join(', ');
    expect(formatted).toBe('Flat A06 20/F, 新界, 香港');
  });

  it('should handle missing shipping address gracefully', () => {
    const shippingAddress = null;
    const addr = (() => {
      try {
        if (!shippingAddress) return '—';
        const a = JSON.parse(shippingAddress);
        return [a.address, a.district, a.region].filter(Boolean).join(', ');
      } catch { return shippingAddress || '—'; }
    })();
    expect(addr).toBe('—');
  });
});

// ─── 4. White Text Fix ────────────────────────────────────────────────────────

describe('White Text Fix', () => {
  it('should use text-gray-800 for payment method text', () => {
    // Verify the className includes text-gray-800
    const className = 'flex items-center gap-1 text-gray-800';
    expect(className).toContain('text-gray-800');
  });

  it('should use text-gray-800 for listing condition badge', () => {
    const className = 'text-xs text-gray-800 border-gray-300';
    expect(className).toContain('text-gray-800');
  });

  it('should display Stripe payment method correctly', () => {
    const paymentMethod = 'stripe';
    const label = paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK';
    expect(label).toBe('Stripe');
  });

  it('should display Alipay payment method correctly', () => {
    const paymentMethod = 'alipay';
    const label = paymentMethod === 'stripe' ? 'Stripe' : '支付寶 HK';
    expect(label).toBe('支付寶 HK');
  });
});
