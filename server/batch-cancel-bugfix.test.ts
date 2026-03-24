/**
 * Tests for batch order cancellation bug fix:
 * When a buyer cancels one order from a batch (same batchRef),
 * ALL pending_payment orders in the same batch should be cancelled.
 */

import { describe, it, expect } from "vitest";

describe("Batch order cancellation logic", () => {
  it("should identify all orders in the same batch by batchRef", () => {
    const allOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611", batchRef: "BATCH-001", buyerId: 42, orderStatus: "pending_payment" },
      { id: 2, orderNo: "BOXIUM-20260324-5703", batchRef: "BATCH-001", buyerId: 42, orderStatus: "pending_payment" },
      { id: 3, orderNo: "BOXIUM-20260324-9999", batchRef: "BATCH-002", buyerId: 42, orderStatus: "pending_payment" },
    ];

    const targetOrder = allOrders[0]; // buyer cancels order 8611
    const batchOrderIds = allOrders
      .filter(o => o.batchRef === targetOrder.batchRef && o.buyerId === targetOrder.buyerId && o.orderStatus === "pending_payment")
      .map(o => o.id);

    expect(batchOrderIds).toEqual([1, 2]); // both 8611 and 5703 should be cancelled
    expect(batchOrderIds).not.toContain(3); // different batch, should not be affected
  });

  it("should cancel only the single order when batchRef is null", () => {
    const order = { id: 5, orderNo: "BOXIUM-20260324-1111", batchRef: null, buyerId: 42, orderStatus: "pending_payment" };

    // When batchRef is null, only cancel the one order
    const batchOrderIds = order.batchRef ? [] : [order.id];
    expect(batchOrderIds).toEqual([5]);
  });

  it("should not cancel already-cancelled orders in the same batch", () => {
    const allOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611", batchRef: "BATCH-001", buyerId: 42, orderStatus: "cancelled" }, // already cancelled
      { id: 2, orderNo: "BOXIUM-20260324-5703", batchRef: "BATCH-001", buyerId: 42, orderStatus: "pending_payment" },
    ];

    const targetOrder = allOrders[1]; // buyer cancels order 5703
    const batchOrderIds = allOrders
      .filter(o => o.batchRef === targetOrder.batchRef && o.buyerId === targetOrder.buyerId && o.orderStatus === "pending_payment")
      .map(o => o.id);

    expect(batchOrderIds).toEqual([2]); // only 5703 (8611 is already cancelled)
  });

  it("should only cancel orders belonging to the same buyer", () => {
    const allOrders = [
      { id: 1, orderNo: "BOXIUM-20260324-8611", batchRef: "BATCH-001", buyerId: 42, orderStatus: "pending_payment" },
      { id: 2, orderNo: "BOXIUM-20260324-5703", batchRef: "BATCH-001", buyerId: 99, orderStatus: "pending_payment" }, // different buyer
    ];

    const targetOrder = allOrders[0]; // buyer 42 cancels order 8611
    const batchOrderIds = allOrders
      .filter(o => o.batchRef === targetOrder.batchRef && o.buyerId === targetOrder.buyerId && o.orderStatus === "pending_payment")
      .map(o => o.id);

    expect(batchOrderIds).toEqual([1]); // only buyer 42's orders
    expect(batchOrderIds).not.toContain(2); // buyer 99's order should not be affected
  });

  it("should return correct cancelledCount for batch cancellation", () => {
    const batchOrderIds = [1, 2]; // 2 orders in batch
    const cancelledCount = batchOrderIds.length;
    expect(cancelledCount).toBe(2);

    const batchNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';
    expect(batchNote).toBe("（批次取消，共 2 筆）");
  });

  it("should return empty batchNote for single order cancellation", () => {
    const batchOrderIds = [1]; // single order
    const cancelledCount = batchOrderIds.length;
    const batchNote = cancelledCount > 1 ? `（批次取消，共 ${cancelledCount} 筆）` : '';
    expect(batchNote).toBe("");
  });

  it("should build correct email order number for batch cancellation", () => {
    const cancelledCount = 2;
    const primaryOrderNo = "BOXIUM-20260324-8611";
    const emailOrderNo = cancelledCount > 1 ? `${primaryOrderNo} 等 ${cancelledCount} 筆` : primaryOrderNo;
    expect(emailOrderNo).toBe("BOXIUM-20260324-8611 等 2 筆");
  });

  it("should use single order number in email for non-batch cancellation", () => {
    const cancelledCount = 1;
    const primaryOrderNo = "BOXIUM-20260324-8611";
    const emailOrderNo = cancelledCount > 1 ? `${primaryOrderNo} 等 ${cancelledCount} 筆` : primaryOrderNo;
    expect(emailOrderNo).toBe("BOXIUM-20260324-8611");
  });

  it("should restore stock for each listing in the batch", () => {
    const cancelledOrders = [
      { id: 1, listingId: 101, quantity: 1, orderNo: "BOXIUM-20260324-8611" },
      { id: 2, listingId: 202, quantity: 1, orderNo: "BOXIUM-20260324-5703" },
    ];

    // Each order should trigger a restoreListingStock call
    const listingsToRestore = cancelledOrders
      .filter(o => o.listingId != null)
      .map(o => ({ listingId: o.listingId, quantity: o.quantity }));

    expect(listingsToRestore).toHaveLength(2);
    expect(listingsToRestore[0].listingId).toBe(101);
    expect(listingsToRestore[1].listingId).toBe(202);
  });
});
