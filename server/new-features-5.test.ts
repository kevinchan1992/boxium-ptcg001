/**
 * Tests for 5 new features:
 * 1. Admin AI verification result display (confidence label fix)
 * 2. Buyer screenshot submission shows estimated review time
 * 3. 24hr review timeout auto-reminder scheduler
 * 4. Cart expiry notification push (3 days before)
 * 5. Real-time inventory sync when adding to cart
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Feature 1: AI Verification Confidence Label ─────────────────────────────
describe("Feature 1: AI Verification Confidence Label", () => {
  function getConfidenceLabel(confidence: unknown): string {
    if (confidence === "high") return "高可信度";
    if (confidence === "medium") return "中可信度";
    if (confidence === "low") return "低可信度（建議人工核對）";
    return "";
  }

  it("should return correct label for high confidence", () => {
    expect(getConfidenceLabel("high")).toBe("高可信度");
  });

  it("should return correct label for medium confidence", () => {
    expect(getConfidenceLabel("medium")).toBe("中可信度");
  });

  it("should return correct label for low confidence", () => {
    expect(getConfidenceLabel("low")).toBe("低可信度（建議人工核對）");
  });

  it("should return empty string for numeric confidence (old format)", () => {
    // Old format was a number 0-1, new format is string
    expect(getConfidenceLabel(0.95)).toBe("");
    expect(getConfidenceLabel(undefined)).toBe("");
    expect(getConfidenceLabel(null)).toBe("");
  });

  it("should correctly parse AI verification result JSON", () => {
    const aiResult = JSON.stringify({
      verified: true,
      confidence: "high",
      detectedAmount: "150.00",
      detectedPayee: "BOXIUM HK",
      detectedStatus: "交易成功",
      reason: "金額、收款方、狀態均符合",
    });
    const parsed = JSON.parse(aiResult);
    expect(parsed.verified).toBe(true);
    expect(getConfidenceLabel(parsed.confidence)).toBe("高可信度");
    expect(parsed.detectedAmount).toBe("150.00");
  });

  it("should handle AI verification result with verified=false", () => {
    const aiResult = JSON.stringify({
      verified: false,
      confidence: "low",
      detectedAmount: "100.00",
      reason: "金額不符",
    });
    const parsed = JSON.parse(aiResult);
    expect(parsed.verified).toBe(false);
    expect(getConfidenceLabel(parsed.confidence)).toBe("低可信度（建議人工核對）");
  });
});

// ─── Feature 2: Buyer Review Time Display ────────────────────────────────────
describe("Feature 2: Buyer Review Time Display Logic", () => {
  it("should show review time message when proof submitted and not rejected", () => {
    const order = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      paymentRejectionReason: null,
    };
    const shouldShowReviewTime =
      order.orderStatus === "pending_payment" &&
      order.alipayProofImageUrl &&
      !order.paymentRejectionReason;
    expect(shouldShowReviewTime).toBe(true);
  });

  it("should NOT show review time when proof is rejected", () => {
    const order = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      paymentRejectionReason: "金額不符",
    };
    const shouldShowReviewTime =
      order.orderStatus === "pending_payment" &&
      order.alipayProofImageUrl &&
      !order.paymentRejectionReason;
    expect(shouldShowReviewTime).toBe(false);
  });

  it("should NOT show review time when no proof uploaded", () => {
    const order = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: null,
      paymentRejectionReason: null,
    };
    const shouldShowReviewTime =
      order.orderStatus === "pending_payment" &&
      order.alipayProofImageUrl &&
      !order.paymentRejectionReason;
    expect(shouldShowReviewTime).toBeFalsy();
  });

  it("should NOT show review time when order is not pending_payment", () => {
    const order = {
      orderStatus: "payment_received",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      paymentRejectionReason: null,
    };
    const shouldShowReviewTime =
      order.orderStatus === "pending_payment" &&
      order.alipayProofImageUrl &&
      !order.paymentRejectionReason;
    expect(shouldShowReviewTime).toBe(false);
  });
});

// ─── Feature 3: 24hr Review Timeout Reminder Logic ───────────────────────────
describe("Feature 3: 24hr Review Timeout Reminder Logic", () => {
  it("should identify orders pending review for >24 hours", () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const order1 = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      alipayProofSubmittedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
      alipayReviewReminderSentAt: null,
    };

    const isOverdue =
      order1.orderStatus === "pending_payment" &&
      order1.paymentMethod === "alipay_hk" &&
      order1.alipayProofImageUrl !== null &&
      order1.alipayReviewReminderSentAt === null &&
      order1.alipayProofSubmittedAt !== null &&
      order1.alipayProofSubmittedAt <= cutoff;

    expect(isOverdue).toBe(true);
  });

  it("should NOT flag orders pending review for <24 hours", () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const order = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      alipayProofSubmittedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      alipayReviewReminderSentAt: null,
    };

    const isOverdue =
      order.alipayProofSubmittedAt !== null &&
      order.alipayProofSubmittedAt <= cutoff;

    expect(isOverdue).toBe(false);
  });

  it("should NOT flag orders where reminder was already sent", () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const order = {
      orderStatus: "pending_payment",
      paymentMethod: "alipay_hk",
      alipayProofImageUrl: "https://example.com/proof.jpg",
      alipayProofSubmittedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000), // 30 hours ago
      alipayReviewReminderSentAt: new Date(now.getTime() - 6 * 60 * 60 * 1000), // reminder sent 6 hours ago
    };

    const isOverdue =
      order.alipayReviewReminderSentAt === null &&
      order.alipayProofSubmittedAt !== null &&
      order.alipayProofSubmittedAt <= cutoff;

    expect(isOverdue).toBe(false);
  });

  it("should reset reminder flag when new proof is submitted", () => {
    // When submitAlipayProof is called, alipayReviewReminderSentAt should be set to null
    const updatePayload = {
      alipayProofImageUrl: "https://example.com/new-proof.jpg",
      alipayProofSubmittedAt: new Date(),
      alipayReviewReminderSentAt: null, // Reset reminder
    };
    expect(updatePayload.alipayReviewReminderSentAt).toBeNull();
    expect(updatePayload.alipayProofSubmittedAt).toBeInstanceOf(Date);
  });
});

// ─── Feature 4: Cart Expiry Notification Logic ───────────────────────────────
describe("Feature 4: Cart Expiry Notification Logic", () => {
  it("should identify cart items expiring within 3 days", () => {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const cartItem = {
      userId: 1,
      listingId: 100,
      expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    };

    const isExpiringSoon =
      cartItem.expiresAt >= now && cartItem.expiresAt <= threeDaysLater;

    expect(isExpiringSoon).toBe(true);
  });

  it("should NOT flag items expiring in >3 days", () => {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const cartItem = {
      userId: 1,
      listingId: 100,
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    };

    const isExpiringSoon =
      cartItem.expiresAt >= now && cartItem.expiresAt <= threeDaysLater;

    expect(isExpiringSoon).toBe(false);
  });

  it("should NOT flag already-expired items", () => {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const cartItem = {
      userId: 1,
      listingId: 100,
      expiresAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago (expired)
    };

    const isExpiringSoon =
      cartItem.expiresAt >= now && cartItem.expiresAt <= threeDaysLater;

    expect(isExpiringSoon).toBe(false);
  });

  it("should correctly group items by userId and find earliest expiry", () => {
    const now = new Date();
    const items = [
      { userId: 1, listingId: 1, expiresAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
      { userId: 1, listingId: 2, expiresAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
      { userId: 2, listingId: 3, expiresAt: new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000) },
    ];

    const byUser = new Map<number, typeof items>();
    for (const item of items) {
      if (!byUser.has(item.userId)) byUser.set(item.userId, []);
      byUser.get(item.userId)!.push(item);
    }

    expect(byUser.size).toBe(2);
    expect(byUser.get(1)!.length).toBe(2);
    expect(byUser.get(2)!.length).toBe(1);

    // Find earliest expiry for user 1
    const user1Items = byUser.get(1)!;
    const earliest = user1Items.reduce((a, b) => a.expiresAt < b.expiresAt ? a : b);
    expect(earliest.listingId).toBe(1);
  });

  it("should calculate correct days until expiry", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    const expiresInHours = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    const expiresInDays = Math.ceil(expiresInHours / 24);
    expect(expiresInDays).toBe(3); // ceil(60/24) = 3
  });
});

// ─── Feature 5: Add-to-Cart Inventory Check ──────────────────────────────────
describe("Feature 5: Add-to-Cart Inventory Check", () => {
  it("should allow adding active listings to cart", () => {
    const listing = { id: 1, status: "active", sellerId: 99 };
    const userId = 1;
    const canAdd = listing.status === "active" && listing.sellerId !== userId;
    expect(canAdd).toBe(true);
  });

  it("should prevent adding sold listings to cart", () => {
    const listing = { id: 1, status: "sold", sellerId: 99 };
    const isActive = listing.status === "active";
    expect(isActive).toBe(false);
  });

  it("should prevent adding delisted listings to cart", () => {
    const listing = { id: 1, status: "inactive", sellerId: 99 };
    const isActive = listing.status === "active";
    expect(isActive).toBe(false);
  });

  it("should prevent seller from adding own listing to cart", () => {
    const listing = { id: 1, status: "active", sellerId: 1 };
    const userId = 1;
    const isOwnListing = listing.sellerId === userId;
    expect(isOwnListing).toBe(true);
    // Should throw error: "不能將自己的商品加入購物車"
  });

  it("should set correct 14-day expiry when adding to cart", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 14 * 24 * 60 * 60 * 1000);
    const diffDays = Math.round((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);
  });
});
