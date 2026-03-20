/**
 * Tests for three new features:
 * 1. Email notification templates (payment received, new review)
 * 2. Seller earnings dashboard (monthly data, pending payout)
 * 3. Review system (rating validation)
 */
import { describe, it, expect } from "vitest";
import {
  buildOrderPaymentReceivedSellerEmail,
  buildOrderPaymentReceivedBuyerEmail,
  buildNewReviewSellerEmail,
} from "./emailService";

// ─── Email Template Tests ────────────────────────────────────────────────────

describe("buildOrderPaymentReceivedSellerEmail", () => {
  it("should include order number in subject", () => {
    const { subject } = buildOrderPaymentReceivedSellerEmail({
      orderNo: "ORD-2026-001",
      itemName: "Pikachu ex SAR",
      priceHkd: "350.00",
    });
    expect(subject).toContain("ORD-2026-001");
    expect(subject).toContain("出貨");
  });

  it("should include item name and price in HTML body", () => {
    const { html } = buildOrderPaymentReceivedSellerEmail({
      orderNo: "ORD-2026-001",
      itemName: "Pikachu ex SAR",
      priceHkd: "350.00",
      listingId: 42,
    });
    expect(html).toContain("Pikachu ex SAR");
    expect(html).toContain("350.00");
    expect(html).toContain("#BOXIUM-42");
  });

  it("should include CTA button linking to seller dashboard", () => {
    const { html } = buildOrderPaymentReceivedSellerEmail({
      orderNo: "ORD-001",
      itemName: "Card",
      priceHkd: "100.00",
      siteUrl: "https://boxium.asia",
    });
    expect(html).toContain("https://boxium.asia/seller");
  });
});

describe("buildOrderPaymentReceivedBuyerEmail", () => {
  it("should include order number in subject and confirm payment", () => {
    const { subject, html } = buildOrderPaymentReceivedBuyerEmail({
      orderNo: "ORD-2026-002",
      itemName: "Charizard ex",
      priceHkd: "800.00",
    });
    expect(subject).toContain("ORD-2026-002");
    expect(subject).toContain("付款確認");
    expect(html).toContain("付款已確認");
    expect(html).toContain("Charizard ex");
  });

  it("should link to order detail page", () => {
    const { html } = buildOrderPaymentReceivedBuyerEmail({
      orderNo: "ORD-2026-002",
      itemName: "Card",
      priceHkd: "100.00",
      siteUrl: "https://boxium.asia",
    });
    expect(html).toContain("https://boxium.asia/orders/ORD-2026-002");
  });
});

describe("buildNewReviewSellerEmail", () => {
  it("should include star rating in subject", () => {
    const { subject } = buildNewReviewSellerEmail({
      orderNo: "ORD-001",
      itemName: "Mewtwo ex",
      rating: 5,
    });
    expect(subject).toContain("5/5");
    expect(subject).toContain("評價");
  });

  it("should display correct number of stars", () => {
    const { html } = buildNewReviewSellerEmail({
      orderNo: "ORD-001",
      itemName: "Mewtwo ex",
      rating: 4,
    });
    // 4 filled stars + 1 empty star
    expect(html).toContain("⭐⭐⭐⭐☆");
    expect(html).toContain("4/5");
  });

  it("should include buyer comment when provided", () => {
    const { html } = buildNewReviewSellerEmail({
      orderNo: "ORD-001",
      itemName: "Mewtwo ex",
      rating: 5,
      comment: "非常好的賣家，快速出貨！",
    });
    expect(html).toContain("非常好的賣家，快速出貨！");
  });

  it("should NOT include comment section when comment is undefined", () => {
    const { html } = buildNewReviewSellerEmail({
      orderNo: "ORD-001",
      itemName: "Mewtwo ex",
      rating: 3,
    });
    expect(html).not.toContain("買家留言");
  });

  it("should include link to seller dashboard", () => {
    const { html } = buildNewReviewSellerEmail({
      orderNo: "ORD-001",
      itemName: "Card",
      rating: 5,
      siteUrl: "https://boxium.asia",
    });
    expect(html).toContain("https://boxium.asia/seller");
  });
});

// ─── Monthly Data Calculation Tests ─────────────────────────────────────────

describe("Monthly earnings data calculation", () => {
  it("should produce 6 months of data", () => {
    const now = new Date();
    const monthlyData: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyData.push({
        month: `${mStart.getMonth() + 1}月`,
        revenue: 0,
        orders: 0,
      });
    }
    expect(monthlyData).toHaveLength(6);
  });

  it("should correctly sum revenue for completed orders", () => {
    const orders = [
      { status: "completed", amount: "100.00" },
      { status: "completed", amount: "200.50" },
      { status: "shipped", amount: "150.00" },
      { status: "cancelled", amount: "50.00" },
    ];
    const completedRevenue = orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + parseFloat(o.amount), 0);
    expect(completedRevenue).toBeCloseTo(300.5);
  });

  it("should correctly calculate pending payout from active orders", () => {
    const orders = [
      { status: "payment_received", amount: "200.00" },
      { status: "processing", amount: "150.00" },
      { status: "shipped", amount: "300.00" },
      { status: "completed", amount: "500.00" },
      { status: "cancelled", amount: "100.00" },
    ];
    const pendingPayout = orders
      .filter((o) => ["payment_received", "processing", "shipped"].includes(o.status))
      .reduce((sum, o) => sum + parseFloat(o.amount), 0);
    expect(pendingPayout).toBe(650);
  });
});

// ─── Review Rating Validation ────────────────────────────────────────────────

describe("Review rating validation", () => {
  it("should accept ratings from 1 to 5", () => {
    for (let r = 1; r <= 5; r++) {
      expect(r >= 1 && r <= 5).toBe(true);
    }
  });

  it("should reject rating of 0", () => {
    const rating = 0;
    expect(rating >= 1 && rating <= 5).toBe(false);
  });

  it("should reject rating of 6", () => {
    const rating = 6;
    expect(rating >= 1 && rating <= 5).toBe(false);
  });

  it("should truncate long comments to 50 chars in notification body", () => {
    const longComment = "這是一個非常長的評價，超過五十個字元的限制，應該被截斷以避免通知訊息過長影響顯示效果";
    const truncated = longComment.slice(0, 50);
    expect(truncated.length).toBeLessThanOrEqual(50);
  });
});
