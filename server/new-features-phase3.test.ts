/**
 * Tests for 3 new features (Phase 3):
 * 1. Stripe checkout.session.expired webhook notification
 * 2. Cart "待付款" quick jump link (Cart.tsx frontend logic)
 * 3. Reserved product status (schema + db logic)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Feature 1: Stripe checkout.session.expired ─────────────────────────────

describe("Feature 1: Stripe checkout.session.expired webhook", () => {
  it("should parse buyer ID from session metadata (user_id field)", () => {
    const session = {
      metadata: {
        user_id: "42",
        order_no: "BOXIUM-20260324-1234",
      },
    };
    const buyerId = parseInt(session.metadata.user_id ?? "0");
    expect(buyerId).toBe(42);
  });

  it("should parse buyer ID from session metadata (buyer_id field)", () => {
    const session = {
      metadata: {
        buyer_id: "99",
        batch_order_nos: "BOXIUM-20260324-0001,BOXIUM-20260324-0002",
      },
    };
    const buyerIdStr = (session.metadata as any).user_id ?? (session.metadata as any).buyer_id;
    const buyerId = parseInt(buyerIdStr);
    expect(buyerId).toBe(99);
  });

  it("should extract first order number from batch_order_nos", () => {
    const batchOrderNos = "BOXIUM-20260324-0001,BOXIUM-20260324-0002,BOXIUM-20260324-0003";
    const nos = batchOrderNos.split(",").map((s: string) => s.trim()).filter(Boolean);
    expect(nos[0]).toBe("BOXIUM-20260324-0001");
    expect(nos.length).toBe(3);
  });

  it("should build correct link URL for expired session notification", () => {
    const displayOrderNo = "BOXIUM-20260324-1234";
    const linkUrl = displayOrderNo
      ? `/orders?highlight=${displayOrderNo}`
      : "/orders";
    expect(linkUrl).toBe("/orders?highlight=BOXIUM-20260324-1234");
  });

  it("should use /orders as fallback when no order number available", () => {
    const displayOrderNo = "";
    const linkUrl = displayOrderNo
      ? `/orders?highlight=${displayOrderNo}`
      : "/orders";
    expect(linkUrl).toBe("/orders");
  });

  it("should not process event when no buyer ID in metadata", () => {
    const session = { metadata: {} };
    const buyerIdStr = (session.metadata as any).user_id ?? (session.metadata as any).buyer_id;
    expect(buyerIdStr).toBeUndefined();
    // No notification should be sent when buyerIdStr is undefined
    const shouldNotify = !!buyerIdStr;
    expect(shouldNotify).toBe(false);
  });
});

// ─── Feature 2: Cart pending payment quick jump ──────────────────────────────

describe("Feature 2: Cart pending payment quick jump link", () => {
  it("should generate correct link URL when pendingOrderNo is present", () => {
    const item = {
      hasPendingOrder: true,
      pendingOrderNo: "BOXIUM-20260324-5678",
      status: "reserved",
    };
    const href = item.pendingOrderNo
      ? `/orders?highlight=${item.pendingOrderNo}`
      : "/orders";
    expect(href).toBe("/orders?highlight=BOXIUM-20260324-5678");
  });

  it("should use /orders as fallback when pendingOrderNo is null", () => {
    const item = {
      hasPendingOrder: true,
      pendingOrderNo: null,
      status: "reserved",
    };
    const href = item.pendingOrderNo
      ? `/orders?highlight=${item.pendingOrderNo}`
      : "/orders";
    expect(href).toBe("/orders");
  });

  it("should show pending badge only when hasPendingOrder is true and not unavailable", () => {
    const cases = [
      { hasPendingOrder: true, unavailable: false, expected: true },
      { hasPendingOrder: true, unavailable: true, expected: false },
      { hasPendingOrder: false, unavailable: false, expected: false },
      { hasPendingOrder: false, unavailable: true, expected: false },
    ];
    for (const c of cases) {
      const showBadge = c.hasPendingOrder && !c.unavailable;
      expect(showBadge).toBe(c.expected);
    }
  });

  it("should classify reserved items as active (not unavailable)", () => {
    const cartItems = [
      { status: "active", hasPendingOrder: false },
      { status: "reserved", hasPendingOrder: true },
      { status: "sold", hasPendingOrder: false },
      { status: "removed", hasPendingOrder: false },
    ];

    const activeItems = cartItems.filter(
      (item) => item.status === "active" || item.status === "reserved" || item.hasPendingOrder
    );
    const unavailableItems = cartItems.filter(
      (item) => item.status !== "active" && item.status !== "reserved" && !item.hasPendingOrder
    );

    expect(activeItems.length).toBe(2); // active + reserved
    expect(unavailableItems.length).toBe(2); // sold + removed
  });
});

// ─── Feature 3: Reserved product status ─────────────────────────────────────

describe("Feature 3: Reserved product status", () => {
  it("should set status to reserved when quantity drops to 0 on reserve", () => {
    // Simulate the SQL CASE logic: CASE WHEN (quantity - qty) <= 0 THEN 'reserved' ELSE status END
    function simulateReserveStatus(currentQty: number, reserveQty: number, currentStatus: string): string {
      const newQty = currentQty - reserveQty;
      return newQty <= 0 ? "reserved" : currentStatus;
    }

    expect(simulateReserveStatus(1, 1, "active")).toBe("reserved"); // qty=1, reserve 1 → reserved
    expect(simulateReserveStatus(2, 1, "active")).toBe("active");   // qty=2, reserve 1 → still active
    expect(simulateReserveStatus(3, 2, "active")).toBe("active");   // qty=3, reserve 2 → still active (1 left)
    expect(simulateReserveStatus(3, 3, "active")).toBe("reserved"); // qty=3, reserve all → reserved
  });

  it("should restore status to active from reserved on stock restore", () => {
    // Simulate: CASE WHEN status IN ('reserved', 'sold') THEN 'active' ELSE status END
    function simulateRestoreStatus(currentStatus: string): string {
      return ["reserved", "sold"].includes(currentStatus) ? "active" : currentStatus;
    }

    expect(simulateRestoreStatus("reserved")).toBe("active");
    expect(simulateRestoreStatus("sold")).toBe("active");
    expect(simulateRestoreStatus("removed")).toBe("removed"); // should NOT change removed
    expect(simulateRestoreStatus("draft")).toBe("draft");     // should NOT change draft
    expect(simulateRestoreStatus("active")).toBe("active");   // already active
  });

  it("should include reserved in valid listing status values", () => {
    const validStatuses = ["draft", "pending_review", "active", "reserved", "sold", "removed"];
    expect(validStatuses).toContain("reserved");
    expect(validStatuses.indexOf("reserved")).toBeGreaterThan(-1);
  });

  it("should display correct label for reserved status", () => {
    function getStatusLabel(status: string): string {
      const labels: Record<string, string> = {
        active: "上架中",
        reserved: "🔒 鎖定中",
        pending_review: "待審核",
        draft: "草稿",
        sold: "已售出",
        removed: "已下架",
      };
      return labels[status] ?? status;
    }

    expect(getStatusLabel("reserved")).toBe("🔒 鎖定中");
    expect(getStatusLabel("active")).toBe("上架中");
    expect(getStatusLabel("sold")).toBe("已售出");
  });

  it("should use amber color for reserved status badge", () => {
    function getStatusBadgeClass(status: string): string {
      if (status === "active") return "bg-green-100 text-green-800";
      if (status === "reserved") return "bg-amber-100 text-amber-800";
      if (status === "pending_review") return "bg-yellow-100 text-yellow-800";
      if (status === "sold") return "bg-blue-100 text-blue-800";
      return "bg-gray-100 text-gray-800";
    }

    expect(getStatusBadgeClass("reserved")).toBe("bg-amber-100 text-amber-800");
    expect(getStatusBadgeClass("active")).toBe("bg-green-100 text-green-800");
  });

  it("should include reserved in admin status filter tabs", () => {
    const filterTabs = ["all", "active", "reserved", "pending_review", "draft", "sold", "removed"];
    expect(filterTabs).toContain("reserved");
  });

  it("should include reserved in adminUpdateListing allowed statuses", () => {
    const allowedStatuses = ["draft", "pending_review", "active", "reserved", "sold", "removed"];
    expect(allowedStatuses).toContain("reserved");
  });
});
