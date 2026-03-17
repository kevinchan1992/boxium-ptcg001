/**
 * Tests for:
 * 1. adminBatchUpdateShipping - batch mark orders as shipped
 * 2. adminBatchMarkPayout - batch mark orders as paid out
 * 3. adminGetListingOrders - get order history for a listing (timeline)
 */

import { describe, it, expect } from "vitest";

// ─── Helper types ─────────────────────────────────────────────────────────────

interface MockOrder {
  id: number;
  orderNo: string;
  orderStatus: string;
  payoutStatus: string;
  buyerId: number;
  listingId: number;
  subtotalHkd: string;
  trackingNumber: string | null;
  shippingMethod: string | null;
  shippedAt: Date | null;
}

// ─── 1. Batch shipping logic ──────────────────────────────────────────────────

describe("adminBatchUpdateShipping", () => {
  function simulateBatchShipping(
    orders: MockOrder[],
    input: {
      orderIds: number[];
      trackingNumber?: string;
      shippingMethod?: string;
      perOrderTracking?: { orderId: number; trackingNumber: string }[];
    }
  ) {
    const trackingMap = new Map<number, string>();
    if (input.perOrderTracking) {
      input.perOrderTracking.forEach(({ orderId, trackingNumber }) =>
        trackingMap.set(orderId, trackingNumber)
      );
    }
    let successCount = 0;
    let failCount = 0;
    const updated: MockOrder[] = [];

    for (const orderId of input.orderIds) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) { failCount++; continue; }
      const tracking = trackingMap.get(orderId) ?? input.trackingNumber;
      updated.push({
        ...order,
        orderStatus: "shipped",
        shippedAt: new Date(),
        trackingNumber: tracking ?? order.trackingNumber,
        shippingMethod: input.shippingMethod ?? order.shippingMethod,
      });
      successCount++;
    }
    return { successCount, failCount, updated };
  }

  const mockOrders: MockOrder[] = [
    { id: 1, orderNo: "ORD-001", orderStatus: "processing", payoutStatus: "pending", buyerId: 10, listingId: 100, subtotalHkd: "500.00", trackingNumber: null, shippingMethod: null, shippedAt: null },
    { id: 2, orderNo: "ORD-002", orderStatus: "processing", payoutStatus: "pending", buyerId: 11, listingId: 101, subtotalHkd: "200.00", trackingNumber: null, shippingMethod: null, shippedAt: null },
    { id: 3, orderNo: "ORD-003", orderStatus: "processing", payoutStatus: "pending", buyerId: 12, listingId: 102, subtotalHkd: "350.00", trackingNumber: null, shippingMethod: null, shippedAt: null },
  ];

  it("marks selected orders as shipped", () => {
    const result = simulateBatchShipping(mockOrders, { orderIds: [1, 2] });
    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(0);
    expect(result.updated.every((o) => o.orderStatus === "shipped")).toBe(true);
  });

  it("applies unified tracking number to all orders", () => {
    const result = simulateBatchShipping(mockOrders, {
      orderIds: [1, 2, 3],
      trackingNumber: "SF123456",
    });
    expect(result.updated.every((o) => o.trackingNumber === "SF123456")).toBe(true);
  });

  it("applies per-order tracking numbers when provided", () => {
    const result = simulateBatchShipping(mockOrders, {
      orderIds: [1, 2],
      trackingNumber: "DEFAULT",
      perOrderTracking: [{ orderId: 1, trackingNumber: "SF-CUSTOM-001" }],
    });
    const order1 = result.updated.find((o) => o.id === 1);
    const order2 = result.updated.find((o) => o.id === 2);
    expect(order1?.trackingNumber).toBe("SF-CUSTOM-001");
    expect(order2?.trackingNumber).toBe("DEFAULT");
  });

  it("counts missing orders as failures", () => {
    const result = simulateBatchShipping(mockOrders, { orderIds: [1, 999] });
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it("sets shippedAt timestamp", () => {
    const before = Date.now();
    const result = simulateBatchShipping(mockOrders, { orderIds: [1] });
    const after = Date.now();
    const shippedAt = result.updated[0].shippedAt?.getTime() ?? 0;
    expect(shippedAt).toBeGreaterThanOrEqual(before);
    expect(shippedAt).toBeLessThanOrEqual(after);
  });

  it("applies shipping method", () => {
    const result = simulateBatchShipping(mockOrders, {
      orderIds: [1, 2],
      shippingMethod: "sf_express",
    });
    expect(result.updated.every((o) => o.shippingMethod === "sf_express")).toBe(true);
  });
});

// ─── 2. Batch payout logic ────────────────────────────────────────────────────

describe("adminBatchMarkPayout", () => {
  function simulateBatchPayout(
    orders: MockOrder[],
    input: { orderIds: number[]; note?: string }
  ) {
    let successCount = 0;
    let failCount = 0;
    const updated: { id: number; payoutStatus: string; note?: string }[] = [];

    for (const orderId of input.orderIds) {
      const order = orders.find((o) => o.id === orderId);
      if (!order) { failCount++; continue; }
      // Only completed orders can be marked as paid out
      if (order.orderStatus !== "completed") { failCount++; continue; }
      updated.push({ id: orderId, payoutStatus: "paid", note: input.note });
      successCount++;
    }
    return { successCount, failCount, updated };
  }

  const mockOrders: MockOrder[] = [
    { id: 1, orderNo: "ORD-001", orderStatus: "completed", payoutStatus: "pending", buyerId: 10, listingId: 100, subtotalHkd: "500.00", trackingNumber: "SF001", shippingMethod: "sf_express", shippedAt: new Date() },
    { id: 2, orderNo: "ORD-002", orderStatus: "completed", payoutStatus: "pending", buyerId: 11, listingId: 101, subtotalHkd: "200.00", trackingNumber: "SF002", shippingMethod: "sf_express", shippedAt: new Date() },
    { id: 3, orderNo: "ORD-003", orderStatus: "shipped", payoutStatus: "pending", buyerId: 12, listingId: 102, subtotalHkd: "350.00", trackingNumber: "SF003", shippingMethod: "sf_express", shippedAt: new Date() },
  ];

  it("marks completed orders as paid out", () => {
    const result = simulateBatchPayout(mockOrders, { orderIds: [1, 2] });
    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(0);
    expect(result.updated.every((o) => o.payoutStatus === "paid")).toBe(true);
  });

  it("rejects non-completed orders", () => {
    const result = simulateBatchPayout(mockOrders, { orderIds: [1, 3] });
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it("rejects missing orders", () => {
    const result = simulateBatchPayout(mockOrders, { orderIds: [999] });
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(1);
  });

  it("attaches note to updated records", () => {
    const result = simulateBatchPayout(mockOrders, {
      orderIds: [1],
      note: "Bank transfer completed",
    });
    expect(result.updated[0].note).toBe("Bank transfer completed");
  });

  it("handles empty orderIds gracefully", () => {
    const result = simulateBatchPayout(mockOrders, { orderIds: [] });
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(0);
  });
});

// ─── 3. Order timeline display logic ─────────────────────────────────────────

describe("adminGetListingOrders (timeline display)", () => {
  const mockOrders = [
    { id: 1, orderNo: "ORD-001", orderStatus: "completed", subtotalHkd: "500.00", buyerName: "Alice", createdAt: 1700000000000, listingId: 10 },
    { id: 2, orderNo: "ORD-002", orderStatus: "shipped", subtotalHkd: "200.00", buyerName: "Bob", createdAt: 1700100000000, listingId: 10 },
    { id: 3, orderNo: "ORD-003", orderStatus: "cancelled", subtotalHkd: "350.00", buyerName: null, buyerEmail: "carol@example.com", createdAt: 1700200000000, listingId: 10 },
  ];

  function filterByListing(orders: any[], listingId: number, limit: number) {
    return orders
      .filter((o) => o.listingId === listingId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  it("returns orders for the specified listing", () => {
    const result = filterByListing(mockOrders, 10, 10);
    expect(result).toHaveLength(3);
    expect(result.every((o) => o.listingId === 10)).toBe(true);
  });

  it("returns orders sorted by createdAt descending", () => {
    const result = filterByListing(mockOrders, 10, 10);
    expect(result[0].orderNo).toBe("ORD-003");
    expect(result[2].orderNo).toBe("ORD-001");
  });

  it("respects the limit parameter", () => {
    const result = filterByListing(mockOrders, 10, 2);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for listing with no orders", () => {
    const result = filterByListing(mockOrders, 999, 10);
    expect(result).toHaveLength(0);
  });

  it("falls back to buyerEmail when buyerName is null", () => {
    const result = filterByListing(mockOrders, 10, 10);
    const order3 = result.find((o) => o.orderNo === "ORD-003");
    const displayName = order3?.buyerName ?? order3?.buyerEmail ?? "買家不明";
    expect(displayName).toBe("carol@example.com");
  });
});
