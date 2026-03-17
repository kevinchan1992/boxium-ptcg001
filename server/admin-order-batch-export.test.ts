/**
 * Tests for:
 * 1. Batch order export CSV logic (selectedOrderIds filtering)
 * 2. OrdersTab listing filter (listingId param in adminGetOrders)
 * 3. Listing detail dialog order count click-through logic
 */

import { describe, it, expect } from "vitest";

// ─── Helper: simulate exportToCSV row building ───────────────────────────────

function buildExportRows(orders: any[], selectedIds: Set<number>) {
  const selected = orders.filter((o) => selectedIds.has(o.id));
  return selected.map((o) => ({
    訂單號: o.orderNo,
    商品: o.listingTitle,
    狀態: o.orderStatus,
    付款方式: o.paymentMethod === "stripe" ? "Stripe" : "支付寶 HK",
    "金額 (HKD)": parseFloat(o.subtotalHkd || "0").toFixed(2),
    "手續費 (HKD)": parseFloat(o.platformFeeHkd || "0").toFixed(2),
    "賣家應收 (HKD)": parseFloat(o.sellerReceivableHkd || "0").toFixed(2),
    訂單日期: new Date(o.createdAt).toLocaleDateString("zh-HK"),
    追蹤號: o.trackingNumber ?? "",
    收件人: o.shippingName ?? "",
    收件電話: o.shippingPhone ?? "",
  }));
}

const mockOrders = [
  {
    id: 1,
    orderNo: "ORD-001",
    listingTitle: "Charizard EX",
    orderStatus: "completed",
    paymentMethod: "stripe",
    subtotalHkd: "500.00",
    platformFeeHkd: "25.00",
    sellerReceivableHkd: "475.00",
    createdAt: 1700000000000,
    trackingNumber: "SF123",
    shippingName: "Alice",
    shippingPhone: "91234567",
    listingId: 10,
  },
  {
    id: 2,
    orderNo: "ORD-002",
    listingTitle: "Pikachu VMAX",
    orderStatus: "shipped",
    paymentMethod: "alipay",
    subtotalHkd: "200.00",
    platformFeeHkd: "10.00",
    sellerReceivableHkd: "190.00",
    createdAt: 1700100000000,
    trackingNumber: null,
    shippingName: "Bob",
    shippingPhone: "98765432",
    listingId: 11,
  },
  {
    id: 3,
    orderNo: "ORD-003",
    listingTitle: "Mewtwo V",
    orderStatus: "processing",
    paymentMethod: "stripe",
    subtotalHkd: "350.00",
    platformFeeHkd: "17.50",
    sellerReceivableHkd: "332.50",
    createdAt: 1700200000000,
    trackingNumber: null,
    shippingName: "Carol",
    shippingPhone: "90001234",
    listingId: 10,
  },
];

// ─── 1. Batch export: selected orders only ───────────────────────────────────

describe("Batch order export CSV", () => {
  it("exports only selected orders", () => {
    const selectedIds = new Set([1, 3]);
    const rows = buildExportRows(mockOrders, selectedIds);
    expect(rows).toHaveLength(2);
    expect(rows[0].訂單號).toBe("ORD-001");
    expect(rows[1].訂單號).toBe("ORD-003");
  });

  it("returns empty array when no orders selected", () => {
    const rows = buildExportRows(mockOrders, new Set());
    expect(rows).toHaveLength(0);
  });

  it("exports all orders when all are selected", () => {
    const selectedIds = new Set([1, 2, 3]);
    const rows = buildExportRows(mockOrders, selectedIds);
    expect(rows).toHaveLength(3);
  });

  it("maps stripe payment method correctly", () => {
    const rows = buildExportRows(mockOrders, new Set([1]));
    expect(rows[0].付款方式).toBe("Stripe");
  });

  it("maps alipay payment method correctly", () => {
    const rows = buildExportRows(mockOrders, new Set([2]));
    expect(rows[0].付款方式).toBe("支付寶 HK");
  });

  it("formats amounts to 2 decimal places", () => {
    const rows = buildExportRows(mockOrders, new Set([1]));
    expect(rows[0]["金額 (HKD)"]).toBe("500.00");
    expect(rows[0]["手續費 (HKD)"]).toBe("25.00");
    expect(rows[0]["賣家應收 (HKD)"]).toBe("475.00");
  });

  it("handles null trackingNumber gracefully", () => {
    const rows = buildExportRows(mockOrders, new Set([2]));
    expect(rows[0].追蹤號).toBe("");
  });
});

// ─── 2. Listing filter for adminGetOrders ────────────────────────────────────

describe("Order listing filter", () => {
  function filterByListing(orders: any[], listingId?: number) {
    if (!listingId) return orders;
    return orders.filter((o) => o.listingId === listingId);
  }

  it("returns all orders when no listingId filter", () => {
    const result = filterByListing(mockOrders);
    expect(result).toHaveLength(3);
  });

  it("filters orders by listingId", () => {
    const result = filterByListing(mockOrders, 10);
    expect(result).toHaveLength(2);
    expect(result.every((o) => o.listingId === 10)).toBe(true);
  });

  it("returns empty array when no orders match listingId", () => {
    const result = filterByListing(mockOrders, 999);
    expect(result).toHaveLength(0);
  });

  it("returns single order for unique listingId", () => {
    const result = filterByListing(mockOrders, 11);
    expect(result).toHaveLength(1);
    expect(result[0].orderNo).toBe("ORD-002");
  });
});

// ─── 3. Order count card click-through logic ─────────────────────────────────

describe("Listing detail order count click-through", () => {
  function shouldShowClickThrough(orderCount: number, hasOnViewOrders: boolean) {
    return orderCount > 0 && hasOnViewOrders;
  }

  it("shows click-through when orderCount > 0 and callback provided", () => {
    expect(shouldShowClickThrough(3, true)).toBe(true);
  });

  it("does not show click-through when orderCount is 0", () => {
    expect(shouldShowClickThrough(0, true)).toBe(false);
  });

  it("does not show click-through when no callback provided", () => {
    expect(shouldShowClickThrough(5, false)).toBe(false);
  });

  it("does not show click-through when both conditions fail", () => {
    expect(shouldShowClickThrough(0, false)).toBe(false);
  });
});

// ─── 4. Select all / deselect all logic ──────────────────────────────────────

describe("Select all / deselect all orders", () => {
  function toggleSelectAll(
    currentIds: Set<number>,
    allOrders: any[]
  ): Set<number> {
    const isAllSelected =
      allOrders.length > 0 && allOrders.every((o) => currentIds.has(o.id));
    if (isAllSelected) {
      const next = new Set(currentIds);
      allOrders.forEach((o) => next.delete(o.id));
      return next;
    } else {
      const next = new Set(currentIds);
      allOrders.forEach((o) => next.add(o.id));
      return next;
    }
  }

  it("selects all when none selected", () => {
    const result = toggleSelectAll(new Set(), mockOrders);
    expect(result.size).toBe(3);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
  });

  it("deselects all when all selected", () => {
    const result = toggleSelectAll(new Set([1, 2, 3]), mockOrders);
    expect(result.size).toBe(0);
  });

  it("selects remaining when some are selected", () => {
    const result = toggleSelectAll(new Set([1]), mockOrders);
    expect(result.size).toBe(3);
  });

  it("preserves other selections outside current page", () => {
    // Simulate having order id=99 from another page already selected
    const result = toggleSelectAll(new Set([99]), mockOrders);
    expect(result.has(99)).toBe(true);
    expect(result.has(1)).toBe(true);
    expect(result.size).toBe(4);
  });
});
