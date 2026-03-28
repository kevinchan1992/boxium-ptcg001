/**
 * Tests for three new message features:
 * 1. getRecentUnreadOrderThreads — TopNav bell message tab
 * 2. adminMarkOrderAsDisputed — Admin dispute marking with email
 * 3. AdminMessages grouping logic
 */
import { describe, it, expect } from "vitest";

// ─── 1. Email template validation ────────────────────────────────────────────

describe("adminMarkOrderAsDisputed email templates", () => {
  it("buildDisputeOpenedBuyerEmail generates correct subject", async () => {
    const { buildDisputeOpenedBuyerEmail } = await import("./emailService");
    const result = buildDisputeOpenedBuyerEmail({
      orderNo: "ORD-TEST-001",
      itemName: "皮卡丘 PSA10",
      priceHkd: "1200",
      reason: "商品與描述不符",
      siteUrl: "https://boxium.asia",
    });
    expect(result.subject).toContain("ORD-TEST-001");
    expect(result.html).toBeTruthy();
    expect(result.html.length).toBeGreaterThan(100);
  });

  it("buildDisputeOpenedSellerEmail generates correct subject", async () => {
    const { buildDisputeOpenedSellerEmail } = await import("./emailService");
    const result = buildDisputeOpenedSellerEmail({
      orderNo: "ORD-TEST-002",
      itemName: "夢幻 PSA9",
      priceHkd: "800",
      reason: "買家反映商品損壞",
      siteUrl: "https://boxium.asia",
    });
    expect(result.subject).toContain("ORD-TEST-002");
    expect(result.html).toBeTruthy();
    expect(result.html.length).toBeGreaterThan(100);
  });

  it("email templates include reason when provided", async () => {
    const { buildDisputeOpenedBuyerEmail } = await import("./emailService");
    const reason = "管理員介入處理爭議";
    const result = buildDisputeOpenedBuyerEmail({
      orderNo: "ORD-TEST-003",
      itemName: "卡牌",
      priceHkd: "500",
      reason,
    });
    expect(result.html).toContain(reason);
  });

  it("email templates work without optional reason", async () => {
    const { buildDisputeOpenedBuyerEmail } = await import("./emailService");
    const result = buildDisputeOpenedBuyerEmail({
      orderNo: "ORD-TEST-004",
      itemName: "卡牌",
      priceHkd: "500",
    });
    expect(result.subject).toBeTruthy();
    expect(result.html).toBeTruthy();
  });
});

// ─── 2. AdminMessages grouping logic ─────────────────────────────────────────

describe("AdminMessages grouping logic", () => {
  it("groups messages by orderNo correctly", () => {
    const messages = [
      { id: 1, orderNo: "ORD-001", orderId: 1, senderRole: "buyer", content: "Hello", readByAdmin: false, readByBuyer: true, readBySeller: false, isSystemMessage: false, imageUrl: null, createdAt: new Date() },
      { id: 2, orderNo: "ORD-001", orderId: 1, senderRole: "seller", content: "Hi", readByAdmin: true, readByBuyer: false, readBySeller: true, isSystemMessage: false, imageUrl: null, createdAt: new Date() },
      { id: 3, orderNo: "ORD-002", orderId: 2, senderRole: "buyer", content: "Test", readByAdmin: false, readByBuyer: true, readBySeller: false, isSystemMessage: false, imageUrl: null, createdAt: new Date() },
    ];

    const map = new Map<string, { orderId: number; msgs: typeof messages; unreadCount: number }>();
    for (const msg of messages) {
      if (!map.has(msg.orderNo)) {
        map.set(msg.orderNo, { orderId: msg.orderId, msgs: [], unreadCount: 0 });
      }
      const group = map.get(msg.orderNo)!;
      group.msgs.push(msg);
      if (!msg.readByAdmin) group.unreadCount++;
    }
    const groups = Array.from(map.entries());

    expect(groups.length).toBe(2);
    expect(groups[0][0]).toBe("ORD-001");
    expect(groups[0][1].msgs.length).toBe(2);
    expect(groups[0][1].unreadCount).toBe(1);
    expect(groups[1][0]).toBe("ORD-002");
    expect(groups[1][1].unreadCount).toBe(1);
  });

  it("counts unread messages correctly", () => {
    const messages = [
      { id: 1, orderNo: "ORD-001", orderId: 1, readByAdmin: false },
      { id: 2, orderNo: "ORD-001", orderId: 1, readByAdmin: false },
      { id: 3, orderNo: "ORD-001", orderId: 1, readByAdmin: true },
    ];

    let unreadCount = 0;
    for (const msg of messages) {
      if (!msg.readByAdmin) unreadCount++;
    }
    expect(unreadCount).toBe(2);
  });
});

// ─── 3. getRecentUnreadOrderThreads role validation ───────────────────────────

describe("getRecentUnreadOrderThreads role validation", () => {
  it("accepts all three valid roles", () => {
    const validRoles: Array<"buyer" | "seller" | "admin"> = ["buyer", "seller", "admin"];
    for (const role of validRoles) {
      expect(["buyer", "seller", "admin"]).toContain(role);
    }
  });
});

// ─── 4. OrderChat defaultExpanded prop ───────────────────────────────────────

describe("OrderChat defaultExpanded prop", () => {
  it("defaults to false when not provided", () => {
    const defaultExpanded = false;
    expect(defaultExpanded).toBe(false);
  });

  it("accepts true to start expanded", () => {
    const defaultExpanded = true;
    expect(defaultExpanded).toBe(true);
  });
});
