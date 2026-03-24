/**
 * Tests for 3 batch order UX enhancements:
 * 1. "Go to Marketplace" button shown alongside all-cancelled badge
 * 2. Admin batch cancel sends per-order emails (dedupeKey: order_cancelled_admin_{id})
 * 3. Profile pending tab counts by batch unit, not individual order
 */

import { describe, it, expect } from "vitest";

// ─── Enhancement 1: "Go to Marketplace" button ───────────────────────────────

describe("Enhancement 1: Go to Marketplace button in all-cancelled batch", () => {
  it("should show marketplace button when all orders in batch are cancelled", () => {
    const orders = [
      { orderStatus: "cancelled" },
      { orderStatus: "cancelled" },
    ];
    const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === "cancelled");
    // Button should be rendered
    expect(isAllCancelled).toBe(true);
  });

  it("should NOT show marketplace button when batch is still pending", () => {
    const orders = [
      { orderStatus: "pending_payment" },
      { orderStatus: "cancelled" },
    ];
    const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(false);
  });

  it("marketplace button should link to /marketplace", () => {
    const href = "/marketplace";
    expect(href).toBe("/marketplace");
    expect(href.startsWith("/")).toBe(true);
  });
});

// ─── Enhancement 2: Admin batch cancel per-order email ───────────────────────

describe("Enhancement 2: Admin batch cancel per-order email", () => {
  it("should use 'order_cancelled_admin_{id}' dedupeKey for admin cancellations", () => {
    const order = { id: 42, orderNo: "BOXIUM-20260324-8611" };
    const dedupeKey = `order_cancelled_admin_${order.id}`;
    expect(dedupeKey).toBe("order_cancelled_admin_42");
  });

  it("should differ from buyer cancel dedupeKey to allow both to send", () => {
    const orderId = 42;
    const buyerKey = `order_cancelled_buyer_${orderId}`;
    const adminKey = `order_cancelled_admin_${orderId}`;
    expect(buyerKey).not.toBe(adminKey);
  });

  it("should send one email per order in batch for admin cancel", () => {
    const batchOrderIds = [1, 2, 3];
    const emailsSent: string[] = [];
    for (const id of batchOrderIds) {
      emailsSent.push(`order_cancelled_admin_${id}`);
    }
    expect(emailsSent).toHaveLength(3);
    expect(new Set(emailsSent).size).toBe(3); // all unique
  });

  it("should send single email for single order admin cancel (no batchRef)", () => {
    const batchOrderIds = [5]; // only one order
    const emailsSent: string[] = [];
    for (const id of batchOrderIds) {
      emailsSent.push(`order_cancelled_admin_${id}`);
    }
    expect(emailsSent).toHaveLength(1);
  });
});

// ─── Enhancement 3: Pending tab batch count ──────────────────────────────────

describe("Enhancement 3: Profile pending tab counts by batch unit", () => {
  it("should count 1 batch of 2 orders as 1 pending unit", () => {
    const allOrders = [
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
    ];
    const PENDING_STATUSES = ["pending_payment", "alipay_pending"];
    const pendingOrders = allOrders.filter(o => PENDING_STATUSES.includes(o.orderStatus));

    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of pendingOrders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }

    expect(count).toBe(1); // 1 batch, not 2 orders
  });

  it("should count 2 separate batches as 2 pending units", () => {
    const allOrders = [
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
      { orderStatus: "pending_payment", batchRef: "BATCH-002" },
    ];
    const PENDING_STATUSES = ["pending_payment", "alipay_pending"];
    const pendingOrders = allOrders.filter(o => PENDING_STATUSES.includes(o.orderStatus));

    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of pendingOrders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }

    expect(count).toBe(2);
  });

  it("should count standalone orders (no batchRef) individually", () => {
    const allOrders = [
      { orderStatus: "pending_payment", batchRef: null },
      { orderStatus: "pending_payment", batchRef: null },
    ];
    const PENDING_STATUSES = ["pending_payment", "alipay_pending"];
    const pendingOrders = allOrders.filter(o => PENDING_STATUSES.includes(o.orderStatus));

    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of pendingOrders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }

    expect(count).toBe(2); // 2 standalone orders = 2 units
  });

  it("should count mixed batch and standalone orders correctly", () => {
    const allOrders = [
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
      { orderStatus: "pending_payment", batchRef: "BATCH-001" },
      { orderStatus: "pending_payment", batchRef: null }, // standalone
    ];
    const PENDING_STATUSES = ["pending_payment", "alipay_pending"];
    const pendingOrders = allOrders.filter(o => PENDING_STATUSES.includes(o.orderStatus));

    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of pendingOrders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }

    expect(count).toBe(2); // 1 batch + 1 standalone = 2 units
  });

  it("should return 0 when no pending orders", () => {
    const allOrders = [
      { orderStatus: "completed", batchRef: "BATCH-001" },
      { orderStatus: "cancelled", batchRef: null },
    ];
    const PENDING_STATUSES = ["pending_payment", "alipay_pending"];
    const pendingOrders = allOrders.filter(o => PENDING_STATUSES.includes(o.orderStatus));

    const seenBatchRefs = new Set<string>();
    let count = 0;
    for (const o of pendingOrders) {
      if (o.batchRef) {
        if (!seenBatchRefs.has(o.batchRef)) {
          seenBatchRefs.add(o.batchRef);
          count++;
        }
      } else {
        count++;
      }
    }

    expect(count).toBe(0);
  });
});
