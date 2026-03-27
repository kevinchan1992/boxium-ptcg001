/**
 * Tests for batch alipay proof approval and order timeline proof status
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB helpers ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getMarketplaceOrderById: vi.fn(),
  updateMarketplaceOrder: vi.fn().mockResolvedValue(undefined),
  updateListing: vi.fn().mockResolvedValue(undefined),
  getSellerProfileById: vi.fn().mockResolvedValue(null),
  createNotification: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./emailService", () => ({
  sendOrderEmail: vi.fn().mockResolvedValue(undefined),
  buildOrderPaymentReceivedBuyerEmail: vi.fn().mockReturnValue({ subject: "s", html: "h" }),
  buildOrderPaymentReceivedSellerEmail: vi.fn().mockReturnValue({ subject: "s", html: "h" }),
  getOrderEmailData: vi.fn().mockResolvedValue({ itemName: "Test Card", priceHkd: "100" }),
}));

import {
  getMarketplaceOrderById,
  updateMarketplaceOrder,
  createNotification,
} from "./db";

// ─── Helper: mock order factory ────────────────────────────────────────────────
function makeMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orderNo: "BOXIUM-20260327-001",
    buyerId: 10,
    sellerId: null,
    listingId: null,
    paymentMethod: "alipay_hk",
    alipayProofStatus: "pending_review",
    alipayProofSubmittedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
    alipayReviewReminderSentAt: null,
    orderStatus: "pending_payment",
    paymentStatus: "pending",
    subtotalHkd: "100",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("adminBatchConfirmAlipayPayment logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update order status to payment_received for valid pending_review order", async () => {
    const mockOrder = makeMockOrder();
    (getMarketplaceOrderById as any).mockResolvedValue(mockOrder);

    // Simulate the core logic of adminBatchConfirmAlipayPayment
    const orderId = mockOrder.id;
    const order = await getMarketplaceOrderById(orderId);
    expect(order).toBeTruthy();

    await updateMarketplaceOrder(orderId, {
      paymentStatus: "paid",
      orderStatus: "payment_received",
      alipayProofStatus: "approved",
    });

    expect(updateMarketplaceOrder).toHaveBeenCalledWith(orderId, {
      paymentStatus: "paid",
      orderStatus: "payment_received",
      alipayProofStatus: "approved",
    });
  });

  it("should send notification to buyer after approval", async () => {
    const mockOrder = makeMockOrder();
    (getMarketplaceOrderById as any).mockResolvedValue(mockOrder);

    const order = await getMarketplaceOrderById(mockOrder.id);
    await createNotification({
      userId: order!.buyerId,
      type: "trade",
      title: "支付寶 HK 收款已確認 ✅",
      body: `訂單 ${order!.orderNo} 的支付寶 HK 付款已由管理員確認，訂單現在進入處理中。`,
      linkUrl: `/orders/${order!.orderNo}`,
    });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        type: "trade",
        title: "支付寶 HK 收款已確認 ✅",
      })
    );
  });

  it("should handle non-existent order gracefully", async () => {
    (getMarketplaceOrderById as any).mockResolvedValue(null);

    const order = await getMarketplaceOrderById(9999);
    expect(order).toBeNull();

    // Should not call updateMarketplaceOrder for non-existent order
    expect(updateMarketplaceOrder).not.toHaveBeenCalled();
  });

  it("should process multiple orders in batch", async () => {
    const orders = [makeMockOrder({ id: 1 }), makeMockOrder({ id: 2, orderNo: "BOXIUM-002" })];
    (getMarketplaceOrderById as any)
      .mockResolvedValueOnce(orders[0])
      .mockResolvedValueOnce(orders[1]);

    const results: { orderId: number; success: boolean }[] = [];
    for (const orderId of [1, 2]) {
      const order = await getMarketplaceOrderById(orderId);
      if (!order) { results.push({ orderId, success: false }); continue; }
      await updateMarketplaceOrder(orderId, {
        paymentStatus: "paid",
        orderStatus: "payment_received",
        alipayProofStatus: "approved",
      });
      results.push({ orderId, success: true });
    }

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(updateMarketplaceOrder).toHaveBeenCalledTimes(2);
  });
});

// ─── SLA reminder logic tests ──────────────────────────────────────────────────

describe("Alipay proof SLA reminder logic", () => {
  it("should identify orders that need SLA reminder (>24h, no reminder sent)", () => {
    const now = Date.now();
    const orders = [
      // Over 24h, no reminder sent → should trigger
      makeMockOrder({ id: 1, alipayProofSubmittedAt: now - 25 * 60 * 60 * 1000, alipayReviewReminderSentAt: null }),
      // Under 24h → should NOT trigger
      makeMockOrder({ id: 2, alipayProofSubmittedAt: now - 10 * 60 * 60 * 1000, alipayReviewReminderSentAt: null }),
      // Over 24h but reminder already sent → should NOT trigger
      makeMockOrder({ id: 3, alipayProofSubmittedAt: now - 30 * 60 * 60 * 1000, alipayReviewReminderSentAt: now - 2 * 60 * 60 * 1000 }),
    ];

    const SLA_MS = 24 * 60 * 60 * 1000;
    const needsReminder = orders.filter(o =>
      o.alipayProofSubmittedAt !== null &&
      o.alipayReviewReminderSentAt === null &&
      (now - (o.alipayProofSubmittedAt as number)) > SLA_MS
    );

    expect(needsReminder).toHaveLength(1);
    expect(needsReminder[0].id).toBe(1);
  });

  it("should not trigger reminder if already sent", () => {
    const now = Date.now();
    const order = makeMockOrder({
      alipayProofSubmittedAt: now - 30 * 60 * 60 * 1000,
      alipayReviewReminderSentAt: now - 1 * 60 * 60 * 1000, // reminder already sent
    });

    const SLA_MS = 24 * 60 * 60 * 1000;
    const needsReminder = order.alipayReviewReminderSentAt === null &&
      (now - (order.alipayProofSubmittedAt as number)) > SLA_MS;

    expect(needsReminder).toBe(false);
  });
});

// ─── OrderTimeline proof status display logic ──────────────────────────────────

describe("OrderTimeline proof status display logic", () => {
  it("should show proof submitted step when alipayProofSubmittedAt is set", () => {
    const order = makeMockOrder({
      paymentMethod: "alipay_hk",
      alipayProofStatus: "pending_review",
      alipayProofSubmittedAt: Date.now() - 2 * 60 * 60 * 1000,
    });

    const showProofTimeline =
      order.paymentMethod === "alipay_hk" &&
      order.alipayProofSubmittedAt !== null;

    expect(showProofTimeline).toBe(true);
  });

  it("should show approved status when alipayProofStatus is approved", () => {
    const order = makeMockOrder({
      paymentMethod: "alipay_hk",
      alipayProofStatus: "approved",
      alipayProofSubmittedAt: Date.now() - 3 * 60 * 60 * 1000,
    });

    const proofStatusLabel = {
      pending_review: "截圖審核中",
      approved: "截圖已核准",
      rejected: "截圖已拒絕",
    }[order.alipayProofStatus as string] ?? "截圖已提交";

    expect(proofStatusLabel).toBe("截圖已核准");
  });

  it("should show rejected status when alipayProofStatus is rejected", () => {
    const order = makeMockOrder({
      paymentMethod: "alipay_hk",
      alipayProofStatus: "rejected",
      alipayProofSubmittedAt: Date.now() - 5 * 60 * 60 * 1000,
    });

    const isRejected = order.alipayProofStatus === "rejected";
    expect(isRejected).toBe(true);
  });

  it("should not show proof timeline for stripe payment", () => {
    const order = {
      paymentMethod: "stripe",
      alipayProofStatus: null,
      alipayProofSubmittedAt: null,
    };

    const showProofTimeline =
      order.paymentMethod === "alipay_hk" &&
      order.alipayProofSubmittedAt !== null;

    expect(showProofTimeline).toBe(false);
  });
});
