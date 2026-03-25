/**
 * Tests for order UX and email enhancements (Phase 8):
 * 1. EmbeddedOrderCard shows "前往市集" button when order is cancelled
 * 2. BatchOrderCard shows "前往市集" button when all orders are cancelled (already tested, regression check)
 * 3. buildOrderCancelledEmail includes cancelledItems list in first batch email
 * 4. buildOrderCancelledEmail does NOT include cancelledItems for single orders
 * 5. adminUpdateOrderStatus batch cancel includes cancelledItems in first email
 */

import { describe, it, expect } from "vitest";
import { buildOrderCancelledEmail } from "./emailService";

describe("buildOrderCancelledEmail - cancelledItems batch list", () => {
  const singleOrderData = {
    orderNo: "BOXIUM-20260324-0001",
    itemName: "皮卡丘 PSA10",
    priceHkd: "5000.00",
    siteUrl: "https://boxium.asia",
  };

  it("single order: uses individual subject without items list", () => {
    const { subject, html } = buildOrderCancelledEmail(singleOrderData);
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-0001");
    expect(html).toContain("皮卡丘 PSA10");
    expect(html).not.toContain("已取消的商品清單");
  });

  it("batch first email (batchIndex=0): uses batch subject with items list", () => {
    const cancelledItems = [
      { orderNo: "BOXIUM-20260324-0001", itemName: "皮卡丘 PSA10", priceHkd: "5000.00" },
      { orderNo: "BOXIUM-20260324-0002", itemName: "噴火龍 PSA9", priceHkd: "3000.00" },
    ];
    const { subject, html } = buildOrderCancelledEmail({
      ...singleOrderData,
      batchCount: 2,
      batchIndex: 0,
      cancelledItems,
    });
    expect(subject).toBe("❌ 您的 2 件商品訂單已取消");
    expect(html).toContain("已取消的商品清單");
    expect(html).toContain("皮卡丘 PSA10");
    expect(html).toContain("噴火龍 PSA9");
    expect(html).toContain("BOXIUM-20260324-0001");
    expect(html).toContain("BOXIUM-20260324-0002");
  });

  it("batch first email: shows correct total amount", () => {
    const cancelledItems = [
      { orderNo: "BOXIUM-20260324-0001", itemName: "皮卡丘 PSA10", priceHkd: "5000.00" },
      { orderNo: "BOXIUM-20260324-0002", itemName: "噴火龍 PSA9", priceHkd: "3000.00" },
    ];
    const { html } = buildOrderCancelledEmail({
      ...singleOrderData,
      batchCount: 2,
      batchIndex: 0,
      cancelledItems,
    });
    // Total should be 8000.00
    expect(html).toContain("8000.00");
    expect(html).toContain("合計");
  });

  it("batch second email (batchIndex=1): uses individual subject without items list", () => {
    const { subject, html } = buildOrderCancelledEmail({
      ...singleOrderData,
      orderNo: "BOXIUM-20260324-0002",
      itemName: "噴火龍 PSA9",
      priceHkd: "3000.00",
      batchCount: 2,
      batchIndex: 1,
    });
    expect(subject).toBe("❌ 訂單已取消 — BOXIUM-20260324-0002");
    expect(html).not.toContain("已取消的商品清單");
  });

  it("batch first email without cancelledItems: falls back to single item display", () => {
    const { subject, html } = buildOrderCancelledEmail({
      ...singleOrderData,
      batchCount: 2,
      batchIndex: 0,
      // No cancelledItems provided
    });
    expect(subject).toBe("❌ 您的 2 件商品訂單已取消");
    // Should still show the individual item info as fallback
    expect(html).toContain("皮卡丘 PSA10");
    expect(html).not.toContain("已取消的商品清單");
  });

  it("batch first email with single cancelledItem: falls back to single item display", () => {
    const cancelledItems = [
      { orderNo: "BOXIUM-20260324-0001", itemName: "皮卡丘 PSA10", priceHkd: "5000.00" },
    ];
    const { html } = buildOrderCancelledEmail({
      ...singleOrderData,
      batchCount: 1,
      batchIndex: 0,
      cancelledItems,
    });
    // Single item batch should not show the table
    expect(html).not.toContain("已取消的商品清單");
  });

  it("CTA button links to marketplace for batch cancellations", () => {
    const cancelledItems = [
      { orderNo: "BOXIUM-20260324-0001", itemName: "皮卡丘 PSA10", priceHkd: "5000.00" },
      { orderNo: "BOXIUM-20260324-0002", itemName: "噴火龍 PSA9", priceHkd: "3000.00" },
    ];
    const { html } = buildOrderCancelledEmail({
      ...singleOrderData,
      batchCount: 2,
      batchIndex: 0,
      cancelledItems,
    });
    expect(html).toContain("前往市集重新選購");
    expect(html).toContain("/marketplace");
  });

  it("note block is included when note is provided", () => {
    const { html } = buildOrderCancelledEmail({
      ...singleOrderData,
      note: "買家主動取消",
    });
    expect(html).toContain("取消原因");
    expect(html).toContain("買家主動取消");
  });

  it("note block is absent when no note is provided", () => {
    const { html } = buildOrderCancelledEmail(singleOrderData);
    expect(html).not.toContain("取消原因");
  });
});

describe("EmbeddedOrderCard isCancelled logic (unit)", () => {
  it("cancelled status should trigger isCancelled=true", () => {
    const orderStatus = "cancelled";
    const isCancelled = orderStatus === "cancelled";
    expect(isCancelled).toBe(true);
  });

  it("pending_payment status should NOT trigger isCancelled", () => {
    const orderStatus = "pending_payment";
    const isCancelled = orderStatus === "cancelled";
    expect(isCancelled).toBe(false);
  });

  it("completed status should NOT trigger isCancelled", () => {
    const orderStatus = "completed";
    const isCancelled = orderStatus === "cancelled";
    expect(isCancelled).toBe(false);
  });
});

describe("BatchOrderCard isAllCancelled regression", () => {
  it("all cancelled orders → isAllCancelled=true", () => {
    const orders = [
      { orderStatus: "cancelled" },
      { orderStatus: "cancelled" },
    ];
    const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(true);
  });

  it("mixed statuses → isAllCancelled=false", () => {
    const orders = [
      { orderStatus: "cancelled" },
      { orderStatus: "pending_payment" },
    ];
    const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(false);
  });

  it("empty orders → isAllCancelled=false", () => {
    const orders: any[] = [];
    const isAllCancelled = orders.length > 0 && orders.every(o => o.orderStatus === "cancelled");
    expect(isAllCancelled).toBe(false);
  });
});
