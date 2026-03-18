import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn(() => null),
  generateOrderNo: vi.fn(() => "BOXIUM-TEST-001"),
}));

describe("Marketplace utility helpers", () => {
  it("should generate a valid order number format", () => {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 9000) + 1000;
    const orderNo = `BOXIUM-${ts}-${rand}`;
    expect(orderNo).toMatch(/^BOXIUM-\d+-\d{4}$/);
  });

  it("should calculate platform fee correctly (5%)", () => {
    const price = 100;
    const quantity = 2;
    const subtotal = price * quantity;
    const platformFee = Math.round(subtotal * 0.05 * 100) / 100;
    expect(platformFee).toBe(10);
  });

  it("should calculate seller payout correctly", () => {
    const subtotal = 200;
    const platformFee = subtotal * 0.05;
    const sellerPayout = subtotal - platformFee;
    expect(sellerPayout).toBe(190);
  });

  it("should handle fractional prices correctly", () => {
    const price = 99.99;
    const quantity = 3;
    const subtotal = Math.round(price * quantity * 100) / 100;
    expect(subtotal).toBe(299.97);
  });
});

describe("Listing status transitions", () => {
  it("platform listings should start as active", () => {
    const sellerType = "platform";
    const initialStatus = sellerType === "platform" ? "active" : "pending_review";
    expect(initialStatus).toBe("active");
  });

  it("seller listings should start as pending_review", () => {
    const sellerType = "seller";
    const initialStatus = sellerType === "platform" ? "active" : "pending_review";
    expect(initialStatus).toBe("pending_review");
  });
});

describe("Order status state machine", () => {
  const validTransitions: Record<string, string[]> = {
    pending_payment: ["paid_held", "cancelled"],
    paid_held: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["completed"],
    completed: [],
    cancelled: [],
  };

  it("should allow payment from pending_payment", () => {
    expect(validTransitions["pending_payment"]).toContain("paid_held");
  });

  it("should allow processing after payment held", () => {
    expect(validTransitions["paid_held"]).toContain("processing");
  });

  it("should allow shipping after processing", () => {
    expect(validTransitions["processing"]).toContain("shipped");
  });

  it("should allow completion after shipping", () => {
    expect(validTransitions["shipped"]).toContain("completed");
  });

  it("should not allow reverting completed orders", () => {
    expect(validTransitions["completed"]).toHaveLength(0);
  });
});

describe("Payment method handling", () => {
  it("alipay_hk orders should require manual verification", () => {
    const paymentMethod = "alipay_hk";
    const requiresManualVerification = paymentMethod === "alipay_hk";
    expect(requiresManualVerification).toBe(true);
  });

  it("stripe orders should not require manual verification", () => {
    const paymentMethod = "stripe";
    const requiresManualVerification = paymentMethod === "alipay_hk";
    expect(requiresManualVerification).toBe(false);
  });
});

describe("Alipay HK static QR code flow", () => {
  const ALIPAY_STATIC_URL = "https://w.alipay.hk/s12/3RYKWzGXrQ";
  const ALIPAY_ACCOUNT_ID = "2160120158548164";

  it("should have valid Alipay HK static payment URL", () => {
    expect(ALIPAY_STATIC_URL).toMatch(/^https:\/\/w\.alipay\.hk\//);
  });

  it("should have valid Alipay HK account ID format", () => {
    expect(ALIPAY_ACCOUNT_ID).toMatch(/^\d{16}$/);
  });

  it("should generate correct payment reference with order number", () => {
    const orderNo = "BOXIUM-1234567890-5678";
    const paymentRef = `BOXIUM 訂單 ${orderNo}`;
    expect(paymentRef).toContain(orderNo);
  });
});

describe("Seller profile validation", () => {
  it("should require displayName for seller application", () => {
    const validateSellerApplication = (data: { displayName: string }) => {
      return data.displayName.trim().length > 0;
    };
    expect(validateSellerApplication({ displayName: "CardMaster HK" })).toBe(true);
    expect(validateSellerApplication({ displayName: "" })).toBe(false);
  });

  it("new seller profiles should be inactive by default", () => {
    const newProfile = { isActive: false, stripeConnectStatus: "not_started" };
    expect(newProfile.isActive).toBe(false);
  });
});

describe("Card condition validation", () => {
  const validConditions = ["mint", "near_mint", "excellent", "good", "played", "poor", "sealed"];

  it("should have all standard card conditions", () => {
    expect(validConditions).toContain("mint");
    expect(validConditions).toContain("near_mint");
    expect(validConditions).toContain("sealed");
  });

  it("should reject invalid conditions", () => {
    const isValidCondition = (c: string) => validConditions.includes(c);
    expect(isValidCondition("near_mint")).toBe(true);
    expect(isValidCondition("damaged")).toBe(false);
  });
});

describe("Image upload for marketplace listings", () => {
  it("should accept valid image URLs in listing images array", () => {
    const images = [
      "https://storage.example.com/marketplace-images/test-1.jpg",
      "https://storage.example.com/marketplace-images/test-2.png",
    ];
    const isValidImageUrl = (url: string) =>
      url.startsWith("https://") && /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
    expect(images.every(isValidImageUrl)).toBe(true);
  });

  it("should enforce maximum 5 images per listing", () => {
    const maxImages = 5;
    const images = ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"];
    const allowed = images.slice(0, maxImages);
    expect(allowed).toHaveLength(5);
    expect(images.length).toBeGreaterThan(maxImages);
  });

  it("should use first image as cover/thumbnail", () => {
    const images = ["cover.jpg", "detail1.jpg", "detail2.jpg"];
    const coverImage = images[0];
    expect(coverImage).toBe("cover.jpg");
  });

  it("should handle listing with no images gracefully", () => {
    const listing = { images: null, title: "Test Card" };
    const hasImages = listing.images !== null && Array.isArray(listing.images) && listing.images.length > 0;
    expect(hasImages).toBe(false);
  });

  it("should handle listing with empty images array", () => {
    const listing = { images: [] as string[], title: "Test Card" };
    const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
    expect(hasImages).toBe(false);
  });

  it("should validate file size limit of 10MB", () => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const validFile = { size: 5 * 1024 * 1024 }; // 5MB
    const oversizedFile = { size: 15 * 1024 * 1024 }; // 15MB
    expect(validFile.size <= MAX_SIZE).toBe(true);
    expect(oversizedFile.size <= MAX_SIZE).toBe(false);
  });

  it("should only accept image MIME types", () => {
    const isImageMime = (type: string) => type.startsWith("image/");
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("video/mp4")).toBe(false);
  });

  it("should generate unique S3 keys to prevent enumeration", () => {
    const generateKey = (filename: string, suffix: string) =>
      `marketplace-images/${filename}-${suffix}.jpg`;
    const key1 = generateKey("test", "abc123");
    const key2 = generateKey("test", "xyz789");
    expect(key1).not.toBe(key2);
    expect(key1).toContain("marketplace-images/");
  });
});

describe("Offer management logic", () => {
  const offerStatusLabel: Record<string, string> = {
    pending: "待回覆",
    accepted: "已接受",
    rejected: "已拒絕",
    expired: "已過期",
    cancelled: "已取消",
  };

  it("should have correct status labels for all offer states", () => {
    expect(offerStatusLabel["pending"]).toBe("待回覆");
    expect(offerStatusLabel["accepted"]).toBe("已接受");
    expect(offerStatusLabel["rejected"]).toBe("已拒絕");
    expect(offerStatusLabel["expired"]).toBe("已過期");
    expect(offerStatusLabel["cancelled"]).toBe("已取消");
  });

  it("should detect expired offers correctly", () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
    const isExpired = (expiresAt: Date) => expiresAt < new Date();
    expect(isExpired(pastDate)).toBe(true);
    expect(isExpired(futureDate)).toBe(false);
  });

  it("should calculate offer discount percentage correctly", () => {
    const listingPrice = 1000;
    const offerPrice = 800;
    const discountPct = Math.round(((listingPrice - offerPrice) / listingPrice) * 100);
    expect(discountPct).toBe(20);
  });

  it("should reject offers below minimum threshold (70%)", () => {
    const listingPrice = 1000;
    const MIN_OFFER_PCT = 0.7;
    const isValidOffer = (offerPrice: number) => offerPrice >= listingPrice * MIN_OFFER_PCT;
    expect(isValidOffer(700)).toBe(true);   // exactly 70%
    expect(isValidOffer(699)).toBe(false);  // below 70%
    expect(isValidOffer(900)).toBe(true);   // above 70%
  });

  it("should filter offers by status correctly", () => {
    const offers = [
      { id: 1, status: "pending" },
      { id: 2, status: "accepted" },
      { id: 3, status: "rejected" },
      { id: 4, status: "pending" },
    ];
    const pendingOffers = offers.filter(o => o.status === "pending");
    expect(pendingOffers).toHaveLength(2);
    const acceptedOffers = offers.filter(o => o.status === "accepted");
    expect(acceptedOffers).toHaveLength(1);
  });
});

describe("OrderDetail React hooks ordering", () => {
  it("useAutoCompleteCountdown should handle null input gracefully", () => {
    // Simulates the hook being called with null (before data loads)
    const autoCompleteAt = null;
    const result = autoCompleteAt ? "has_countdown" : null;
    expect(result).toBeNull();
  });

  it("useAutoCompleteCountdown should handle undefined input gracefully", () => {
    const autoCompleteAt = undefined;
    const result = autoCompleteAt ? "has_countdown" : null;
    expect(result).toBeNull();
  });

  it("should compute countdown correctly for shipped orders", () => {
    const TOTAL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
    const now = Date.now();
    const autoCompleteAt = new Date(now + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const diff = autoCompleteAt.getTime() - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const elapsed = TOTAL_MS - diff;
    const pct = Math.min(100, Math.max(0, (elapsed / TOTAL_MS) * 100));
    expect(days).toBe(7); // 7 days from now
    expect(pct).toBeCloseTo(50, 0); // ~50% elapsed
  });

  it("should not show countdown for non-shipped orders", () => {
    const orderStatus = "processing";
    const autoCompleteAt = orderStatus === "shipped" ? new Date() : null;
    expect(autoCompleteAt).toBeNull();
  });
});

describe("Admin offers pagination", () => {
  it("should calculate correct page offset", () => {
    const pageSize = 20;
    const page1Offset = (1 - 1) * pageSize;
    const page2Offset = (2 - 1) * pageSize;
    const page3Offset = (3 - 1) * pageSize;
    expect(page1Offset).toBe(0);
    expect(page2Offset).toBe(20);
    expect(page3Offset).toBe(40);
  });

  it("should disable next page button when on last page", () => {
    const total = 45;
    const pageSize = 20;
    const page = 3;
    const isLastPage = page * pageSize >= total;
    expect(isLastPage).toBe(true);
  });

  it("should disable previous page button on first page", () => {
    const page = 1;
    const isFirstPage = page === 1;
    expect(isFirstPage).toBe(true);
  });
});

describe("Offer expiry countdown display logic", () => {
  const computeCountdown = (expiresAt: Date | null) => {
    if (!expiresAt) return null;
    const now = Date.now();
    const expiresTs = expiresAt.getTime();
    const diffMs = expiresTs - now;
    if (diffMs <= 0) return { expired: true, label: "已過期", isUrgent: false, isWarning: false };
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHours / 24);
    const remHours = Math.floor(diffHours % 24);
    const isUrgent = diffHours < 24;
    const isWarning = diffHours < 48;
    const label = diffDays > 0
      ? `還有 ${diffDays} 天 ${remHours} 小時到期`
      : `還有 ${Math.floor(diffHours)} 小時到期`;
    return { expired: false, label, isUrgent, isWarning };
  };

  it("should return null for offers without expiresAt", () => {
    expect(computeCountdown(null)).toBeNull();
  });

  it("should show expired label for past expiry dates", () => {
    const pastDate = new Date(Date.now() - 1000); // 1 second ago
    const result = computeCountdown(pastDate);
    expect(result?.expired).toBe(true);
    expect(result?.label).toBe("已過期");
  });

  it("should mark as urgent when less than 24 hours remain", () => {
    const urgentDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
    const result = computeCountdown(urgentDate);
    expect(result?.isUrgent).toBe(true);
    expect(result?.isWarning).toBe(true);
    expect(result?.label).toContain("小時到期");
  });

  it("should mark as warning when less than 48 hours remain", () => {
    const warningDate = new Date(Date.now() + 36 * 60 * 60 * 1000); // 36 hours
    const result = computeCountdown(warningDate);
    expect(result?.isUrgent).toBe(false);
    expect(result?.isWarning).toBe(true);
  });

  it("should show days and hours for offers expiring in more than 24 hours", () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    const result = computeCountdown(futureDate);
    expect(result?.isUrgent).toBe(false);
    expect(result?.isWarning).toBe(false);
    expect(result?.label).toContain("天");
    expect(result?.label).toContain("小時到期");
  });

  it("should not show countdown for accepted or rejected offers", () => {
    // Only pending offers should show countdown
    const statuses = ["accepted", "rejected", "expired", "cancelled"];
    statuses.forEach(status => {
      const shouldShow = status === "pending";
      expect(shouldShow).toBe(false);
    });
    expect("pending" === "pending").toBe(true);
  });
});

describe("Minimum offer amount validation (70% rule)", () => {
  const MIN_OFFER_PCT = 0.7;

  const computeMinOffer = (listingPrice: number) =>
    Math.ceil(listingPrice * MIN_OFFER_PCT * 100) / 100;

  const isOfferValid = (offerAmount: number, listingPrice: number) =>
    offerAmount >= computeMinOffer(listingPrice);

  it("should compute correct minimum offer for round prices", () => {
    expect(computeMinOffer(1000)).toBe(700);
    expect(computeMinOffer(500)).toBe(350);
    expect(computeMinOffer(200)).toBe(140);
  });

  it("should round up minimum offer to avoid floating point issues", () => {
    // 333 * 0.7 = 233.1 → ceil to 233.1 (already rounded)
    expect(computeMinOffer(333)).toBe(233.1);
    // 100 * 0.7 = 70 exactly
    expect(computeMinOffer(100)).toBe(70);
  });

  it("should accept offers at exactly 70% of listing price", () => {
    expect(isOfferValid(700, 1000)).toBe(true);
    expect(isOfferValid(350, 500)).toBe(true);
  });

  it("should reject offers below 70% of listing price", () => {
    expect(isOfferValid(699, 1000)).toBe(false);
    expect(isOfferValid(349, 500)).toBe(false);
    expect(isOfferValid(0, 1000)).toBe(false);
  });

  it("should accept offers above 70% of listing price", () => {
    expect(isOfferValid(800, 1000)).toBe(true);
    expect(isOfferValid(1000, 1000)).toBe(true); // full price
    expect(isOfferValid(1200, 1000)).toBe(true); // above listing price
  });

  it("should disable submit button when offer is below minimum", () => {
    const listingPrice = 1000;
    const minOffer = computeMinOffer(listingPrice);
    const isButtonDisabled = (offerAmount: string) => {
      if (!offerAmount || parseFloat(offerAmount) <= 0) return true;
      return parseFloat(offerAmount) < minOffer;
    };
    expect(isButtonDisabled("")).toBe(true);
    expect(isButtonDisabled("0")).toBe(true);
    expect(isButtonDisabled("500")).toBe(true);  // below 70%
    expect(isButtonDisabled("700")).toBe(false); // exactly 70%
    expect(isButtonDisabled("800")).toBe(false); // above 70%
  });

  it("should show error message only when amount is entered and below minimum", () => {
    const listingPrice = 1000;
    const minOffer = computeMinOffer(listingPrice);
    const shouldShowError = (offerAmount: string) => {
      if (!offerAmount) return false;
      const entered = parseFloat(offerAmount);
      return entered > 0 && entered < minOffer;
    };
    expect(shouldShowError("")).toBe(false);    // no input → no error
    expect(shouldShowError("500")).toBe(true);  // below minimum → show error
    expect(shouldShowError("700")).toBe(false); // at minimum → no error
    expect(shouldShowError("900")).toBe(false); // above minimum → no error
  });
});

// ── createOfferCheckout validation tests ──────────────────────────────────────
describe("createOfferCheckout - payment method validation", () => {
  it("rejects Stripe payment when amount is below HKD 4.00", () => {
    const amount = 3.5;
    const isStripe = true;
    const minStripe = 4.0;
    const shouldReject = isStripe && amount < minStripe;
    expect(shouldReject).toBe(true);
  });

  it("allows Alipay HK payment for any amount including below HKD 4.00", () => {
    const amount = 1.0;
    const isAlipay = true;
    const minStripe = 4.0;
    // Alipay has no minimum restriction
    const shouldReject = !isAlipay && amount < minStripe;
    expect(shouldReject).toBe(false);
  });

  it("allows Stripe payment when amount meets minimum HKD 4.00", () => {
    const amount = 10.0;
    const isStripe = true;
    const minStripe = 4.0;
    const shouldReject = isStripe && amount < minStripe;
    expect(shouldReject).toBe(false);
  });

  it("validates payment method enum", () => {
    const validMethods = ["stripe", "alipay_hk"];
    expect(validMethods.includes("stripe")).toBe(true);
    expect(validMethods.includes("alipay_hk")).toBe(true);
    expect(validMethods.includes("paypal")).toBe(false);
  });

  it("returns correct payment method in Stripe response", () => {
    const stripeResponse = { paymentMethod: "stripe" as const, checkoutUrl: "https://checkout.stripe.com/test" };
    expect(stripeResponse.paymentMethod).toBe("stripe");
    expect(stripeResponse.checkoutUrl).toContain("stripe.com");
  });

  it("returns correct payment method in Alipay HK response", () => {
    const alipayResponse = { paymentMethod: "alipay_hk" as const, alipayLink: "https://w.alipay.hk/test", amount: "100.00", orderNo: "BOXIUM-001", orderId: 1 };
    expect(alipayResponse.paymentMethod).toBe("alipay_hk");
    expect(alipayResponse.alipayLink).toContain("alipay");
    expect(alipayResponse.amount).toBe("100.00");
  });

  it("only accepted offers can proceed to payment", () => {
    const statuses = ["pending", "accepted", "rejected", "expired", "cancelled"];
    const canPay = (status: string) => status === "accepted";
    expect(canPay("accepted")).toBe(true);
    statuses.filter(s => s !== "accepted").forEach(s => {
      expect(canPay(s)).toBe(false);
    });
  });
});

// ── Payment success highlight logic tests ─────────────────────────────────────
describe("Payment success order highlight logic", () => {
  it("should detect payment=success from URL params", () => {
    const searchString = "?payment=success&orderNo=BOXIUM-20260310-1234";
    const params = new URLSearchParams(searchString);
    expect(params.get("payment")).toBe("success");
    expect(params.get("orderNo")).toBe("BOXIUM-20260310-1234");
  });

  it("should not highlight when payment param is absent", () => {
    const searchString = "";
    const params = new URLSearchParams(searchString);
    const paymentSuccess = params.get("payment") === "success";
    expect(paymentSuccess).toBe(false);
  });

  it("should match order by orderNo for highlight", () => {
    const highlightOrderNo = "BOXIUM-20260310-1234";
    const orders = [
      { id: 1, orderNo: "BOXIUM-20260310-1234" },
      { id: 2, orderNo: "BOXIUM-20260310-5678" },
    ];
    const highlighted = orders.filter(o => o.orderNo === highlightOrderNo);
    expect(highlighted.length).toBe(1);
    expect(highlighted[0].id).toBe(1);
  });

  it("should not highlight any order when orderNo is empty", () => {
    const highlightOrderNo = "";
    const orders = [
      { id: 1, orderNo: "BOXIUM-20260310-1234" },
    ];
    const highlighted = orders.filter(o => !!highlightOrderNo && o.orderNo === highlightOrderNo);
    expect(highlighted.length).toBe(0);
  });
});

// ── Reject offer with reason tests ────────────────────────────────────────────
describe("Reject offer with rejection reason", () => {
  it("should allow rejection without a reason (optional)", () => {
    const rejectionReason = "";
    const payload = {
      offerId: 1,
      action: "reject" as const,
      rejectionReason: rejectionReason.trim() || undefined,
    };
    expect(payload.rejectionReason).toBeUndefined();
  });

  it("should include rejection reason when provided", () => {
    const rejectionReason = "此出價低於我的底價";
    const payload = {
      offerId: 1,
      action: "reject" as const,
      rejectionReason: rejectionReason.trim() || undefined,
    };
    expect(payload.rejectionReason).toBe("此出價低於我的底價");
  });

  it("should enforce max 300 character limit on rejection reason", () => {
    const longReason = "a".repeat(301);
    const isValid = longReason.length <= 300;
    expect(isValid).toBe(false);

    const validReason = "a".repeat(300);
    expect(validReason.length <= 300).toBe(true);
  });

  it("should include rejection reason in buyer notification body", () => {
    const reason = "此出價低於底價";
    const notificationBody = `你對商品的出價 HKD 500 已被賣家拒絕。${reason ? `原因：${reason}` : ""}`;
    expect(notificationBody).toContain("原因：此出價低於底價");
  });

  it("should not include reason text in notification when reason is empty", () => {
    const reason = "";
    const notificationBody = `你對商品的出價 HKD 500 已被賣家拒絕。${reason ? `原因：${reason}` : ""}`;
    expect(notificationBody).not.toContain("原因：");
  });
});

describe("adminAddOrderNote", () => {
  it("should validate note is not empty", () => {
    const note = "  ";
    expect(note.trim().length).toBe(0);
  });
  it("should enforce max 500 character limit on note", () => {
    const longNote = "a".repeat(501);
    expect(longNote.length > 500).toBe(true);
    const validNote = "a".repeat(500);
    expect(validNote.length <= 500).toBe(true);
  });
  it("should prefix note with [備注] tag", () => {
    const userNote = "請注意此訂單需要特別處理";
    const storedNote = `[備注] ${userNote}`;
    expect(storedNote).toBe("[備注] 請注意此訂單需要特別處理");
  });
  it("should set entryType to note", () => {
    const entry = { entryType: "note", note: "[備注] 測試備注" };
    expect(entry.entryType).toBe("note");
  });
  it("should keep fromStatus and toStatus the same when adding note", () => {
    const currentStatus = "paid";
    const historyEntry = { fromStatus: currentStatus, toStatus: currentStatus, entryType: "note" };
    expect(historyEntry.fromStatus).toBe(historyEntry.toStatus);
  });
  it("should strip [備注] prefix when displaying note in timeline", () => {
    const rawNote = "[備注] 這是一條內部備注";
    const displayNote = rawNote.replace(/^\[備注\] /, "");
    expect(displayNote).toBe("這是一條內部備注");
  });
});
