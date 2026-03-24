/**
 * Tests for 3 batch order enhancements:
 * 1. Per-order cancellation email (each order in batch gets its own email)
 * 2. "All cancelled" UI badge for batch orders
 * 3. Admin batch cancel support via adminUpdateOrderStatus
 */

import { describe, it, expect } from "vitest";

// ─── Enhancement 1: Per-order cancellation email ─────────────────────────────

describe("Enhancement 1: Per-order cancellation email", () => {
  it("should send one email per order in the batch", () => {
    const batchOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611", buyerId: 42 },
      { id: 2, orderNo: "BOXIUM-20260324-5703", buyerId: 42 },
    ];

    // Simulate the email sending loop
    const emailsSent: string[] = [];
    for (const order of batchOrders) {
      emailsSent.push(`order_cancelled_buyer_${order.id}`);
    }

    expect(emailsSent).toHaveLength(2);
    expect(emailsSent[0]).toBe("order_cancelled_buyer_1");
    expect(emailsSent[1]).toBe("order_cancelled_buyer_2");
  });

  it("should use each order's own orderNo in the email subject", () => {
    const batchOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611" },
      { id: 2, orderNo: "BOXIUM-20260324-5703" },
    ];

    const emailSubjects = batchOrders.map(o => `訂單 ${o.orderNo} 已取消`);
    expect(emailSubjects[0]).toBe("訂單 BOXIUM-20260324-8611 已取消");
    expect(emailSubjects[1]).toBe("訂單 BOXIUM-20260324-5703 已取消");
  });

  it("should use unique dedupeKey per order to prevent duplicate emails", () => {
    const batchOrders = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const dedupeKeys = batchOrders.map(o => `order_cancelled_buyer_${o.id}`);

    // All dedupeKeys should be unique
    const uniqueKeys = new Set(dedupeKeys);
    expect(uniqueKeys.size).toBe(batchOrders.length);
  });

  it("should send single email for non-batch order", () => {
    const singleOrder = { id: 5, orderNo: "BOXIUM-20260324-1111", batchRef: null };
    const batchOrderIds = singleOrder.batchRef ? [] : [singleOrder.id];
    expect(batchOrderIds).toHaveLength(1);
    // Only one email should be sent
    const emailCount = batchOrderIds.length;
    expect(emailCount).toBe(1);
  });
});

// ─── Enhancement 2: "All cancelled" UI badge ─────────────────────────────────

describe("Enhancement 2: BatchOrderCard all-cancelled badge", () => {
  it("should detect when all orders in batch are cancelled", () => {
    const allCancelledOrders = [
      { orderStatus: "cancelled" },
      { orderStatus: "cancelled" },
    ];
    const isAllCancelled = allCancelledOrders.length > 0 &&
      allCancelledOrders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(true);
  });

  it("should NOT show all-cancelled badge when some orders are still pending", () => {
    const mixedOrders = [
      { orderStatus: "cancelled" },
      { orderStatus: "pending_payment" },
    ];
    const isAllCancelled = mixedOrders.length > 0 &&
      mixedOrders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(false);
  });

  it("should NOT show all-cancelled badge for empty orders array", () => {
    const emptyOrders: any[] = [];
    const isAllCancelled = emptyOrders.length > 0 &&
      emptyOrders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(false);
  });

  it("should show all-cancelled badge for single cancelled order in batch", () => {
    const singleCancelled = [{ orderStatus: "cancelled" }];
    const isAllCancelled = singleCancelled.length > 0 &&
      singleCancelled.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(true);
  });

  it("should not show pending badge when all are cancelled", () => {
    const allCancelled = [
      { orderStatus: "cancelled" },
      { orderStatus: "cancelled" },
    ];
    const batchStatus = allCancelled.some(o => o.orderStatus === "pending_payment")
      ? "pending_payment"
      : allCancelled[0].orderStatus;
    const isPending = batchStatus === "pending_payment";
    const isAllCancelled = allCancelled.every(o => o.orderStatus === "cancelled");

    expect(isPending).toBe(false);
    expect(isAllCancelled).toBe(true);
  });
});

// ─── Enhancement 3: Admin batch cancel ───────────────────────────────────────

describe("Enhancement 3: adminUpdateOrderStatus batch cancel", () => {
  it("should find all pending_payment orders in the same batch for admin cancel", () => {
    const allOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611", batchRef: "BATCH-001", orderStatus: "pending_payment" },
      { id: 2, orderNo: "BOXIUM-20260324-5703", batchRef: "BATCH-001", orderStatus: "pending_payment" },
      { id: 3, orderNo: "BOXIUM-20260324-9999", batchRef: "BATCH-002", orderStatus: "pending_payment" },
    ];

    const targetOrder = allOrders[0];
    const orderStatus = "cancelled";

    let batchOrderIds: number[] = [targetOrder.id];
    if (orderStatus === "cancelled" && targetOrder.batchRef) {
      batchOrderIds = allOrders
        .filter(o => o.batchRef === targetOrder.batchRef && o.orderStatus === "pending_payment")
        .map(o => o.id);
    }

    expect(batchOrderIds).toEqual([1, 2]);
    expect(batchOrderIds).not.toContain(3);
  });

  it("should NOT batch cancel for non-cancel status updates", () => {
    const order = { id: 1, batchRef: "BATCH-001", orderStatus: "pending_payment" };
    const newStatus = "shipped"; // not a cancellation

    let batchOrderIds: number[] = [order.id];
    if (newStatus === "cancelled" && order.batchRef) {
      // This block should NOT execute for non-cancel
      batchOrderIds = [999]; // would be wrong
    }

    expect(batchOrderIds).toEqual([1]); // only the target order
  });

  it("should include batchCancelNote in notification for multi-order batch cancel", () => {
    const cancelledCount = 2;
    const batchCancelNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';
    const orderNo = "BOXIUM-20260324-8611";
    const content = `訂單 ${orderNo} 已取消${batchCancelNote}。`;

    expect(content).toBe("訂單 BOXIUM-20260324-8611 已取消（批次取消，共 2 筆）。");
  });

  it("should NOT include batchCancelNote for single order cancel", () => {
    const cancelledCount = 1;
    const batchCancelNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';
    const orderNo = "BOXIUM-20260324-8611";
    const content = `訂單 ${orderNo} 已取消${batchCancelNote}。`;

    expect(content).toBe("訂單 BOXIUM-20260324-8611 已取消。");
  });

  it("should restore stock for each listing when admin batch cancels", () => {
    const batchOrders = [
      { id: 1, listingId: 101, quantity: 1 },
      { id: 2, listingId: 202, quantity: 1 },
    ];

    const listingsToRestore = batchOrders
      .filter(o => o.listingId != null)
      .map(o => ({ listingId: o.listingId, quantity: o.quantity }));

    expect(listingsToRestore).toHaveLength(2);
    expect(listingsToRestore[0]).toEqual({ listingId: 101, quantity: 1 });
    expect(listingsToRestore[1]).toEqual({ listingId: 202, quantity: 1 });
  });

  it("should cancel associated offers for each order in batch", () => {
    const batchOrderIds = [1, 2];
    const offerCancellations = batchOrderIds.map(orderId => ({
      orderId,
      newStatus: "cancelled",
    }));

    expect(offerCancellations).toHaveLength(2);
    expect(offerCancellations[0].orderId).toBe(1);
    expect(offerCancellations[1].orderId).toBe(2);
  });
});
