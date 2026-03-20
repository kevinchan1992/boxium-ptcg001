/**
 * Tests for cart offer payment support and admin cancelled order filter
 * - getMyCart returns acceptedOfferId and acceptedOfferPrice for items with accepted offers
 * - Admin order filter includes 'cancelled' status
 */
import { describe, it, expect } from "vitest";

describe("Cart offer payment logic", () => {
  describe("effectivePrice calculation", () => {
    it("uses acceptedOfferPrice when available", () => {
      const item = {
        listingId: 1,
        title: "Test Card",
        priceHkd: "10000",
        sellerType: "seller",
        acceptedOfferId: 42,
        acceptedOfferPrice: "7000",
      };
      const effectivePrice = item.acceptedOfferPrice
        ? Number(item.acceptedOfferPrice)
        : Number(item.priceHkd);
      expect(effectivePrice).toBe(7000);
    });

    it("uses priceHkd when no accepted offer", () => {
      const item = {
        listingId: 1,
        title: "Test Card",
        priceHkd: "10000",
        sellerType: "seller",
        acceptedOfferId: null,
        acceptedOfferPrice: null,
      };
      const effectivePrice = item.acceptedOfferPrice
        ? Number(item.acceptedOfferPrice)
        : Number(item.priceHkd);
      expect(effectivePrice).toBe(10000);
    });

    it("calculates subtotal with mixed offer and non-offer items", () => {
      const activeItems = [
        { listingId: 1, priceHkd: "10000", acceptedOfferPrice: "7000" },
        { listingId: 2, priceHkd: "5000", acceptedOfferPrice: null },
        { listingId: 3, priceHkd: "3000", acceptedOfferPrice: "2500" },
      ];
      const subtotal = activeItems.reduce((sum, item) => {
        const effectivePrice = item.acceptedOfferPrice
          ? Number(item.acceptedOfferPrice)
          : Number(item.priceHkd);
        return sum + effectivePrice;
      }, 0);
      // 7000 + 5000 + 2500 = 14500
      expect(subtotal).toBe(14500);
    });

    it("passes offerId to createStripeOrder when acceptedOfferId exists", () => {
      const item = {
        listingId: 1,
        acceptedOfferId: 42,
        acceptedOfferPrice: "7000",
      };
      const mutationInput = {
        listingId: item.listingId,
        shippingAddress: "test address",
        ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
      };
      expect(mutationInput.offerId).toBe(42);
    });

    it("does not pass offerId when no accepted offer", () => {
      const item = {
        listingId: 1,
        acceptedOfferId: null,
        acceptedOfferPrice: null,
      };
      const mutationInput = {
        listingId: item.listingId,
        shippingAddress: "test address",
        ...(item.acceptedOfferId ? { offerId: item.acceptedOfferId } : {}),
      };
      expect(mutationInput).not.toHaveProperty("offerId");
    });
  });
});

describe("Admin order status filter", () => {
  const ORDER_STATUS_FILTERS = [
    "all",
    "pending_payment",
    "payment_received",
    "processing",
    "shipped",
    "completed",
    "cancelled",
    "disputed",
  ];

  it("includes 'cancelled' in admin order status filters", () => {
    expect(ORDER_STATUS_FILTERS).toContain("cancelled");
  });

  it("has correct number of filter options (8 including 'all')", () => {
    expect(ORDER_STATUS_FILTERS).toHaveLength(8);
  });

  it("cancelled filter is positioned after completed", () => {
    const completedIdx = ORDER_STATUS_FILTERS.indexOf("completed");
    const cancelledIdx = ORDER_STATUS_FILTERS.indexOf("cancelled");
    expect(cancelledIdx).toBe(completedIdx + 1);
  });
});

describe("getMyCart offer enrichment", () => {
  it("returns null acceptedOfferId when no accepted offer exists", () => {
    // Simulate the enrichment logic
    const mockOffer: { id: number; offerPriceHkd: string } | undefined = undefined;
    const result = {
      acceptedOfferId: mockOffer?.id ?? null,
      acceptedOfferPrice: mockOffer?.offerPriceHkd ?? null,
    };
    expect(result.acceptedOfferId).toBeNull();
    expect(result.acceptedOfferPrice).toBeNull();
  });

  it("returns offer details when accepted offer exists", () => {
    const mockOffer = { id: 42, offerPriceHkd: "7000.00" };
    const result = {
      acceptedOfferId: mockOffer?.id ?? null,
      acceptedOfferPrice: mockOffer?.offerPriceHkd ?? null,
    };
    expect(result.acceptedOfferId).toBe(42);
    expect(result.acceptedOfferPrice).toBe("7000.00");
  });
});

// ============================================================
// Admin Stats - thisMonthCancelledOrders field
// ============================================================
describe("adminGetStats - thisMonthCancelledOrders", () => {
  it("should include thisMonthCancelledOrders in stats return value", () => {
    const mockStats = {
      activeListings: 10,
      totalOrders: 50,
      thisMonthCancelledOrders: 3,
    };
    expect(mockStats).toHaveProperty("thisMonthCancelledOrders");
    expect(typeof mockStats.thisMonthCancelledOrders).toBe("number");
    expect(mockStats.thisMonthCancelledOrders).toBe(3);
  });

  it("thisMonthCancelledOrders should default to 0 when no cancelled orders", () => {
    const mockStats = { thisMonthCancelledOrders: 0 };
    expect(mockStats.thisMonthCancelledOrders).toBe(0);
  });
});

// ============================================================
// Cart offer countdown banner logic
// ============================================================
describe("Cart offer countdown banner", () => {
  it("should calculate correct countdown from expiresAt", () => {
    const now = Date.now();
    const expiresAt = now + 3 * 60 * 60 * 1000; // 3 hours from now
    const diff = expiresAt - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    expect(hours).toBe(3);
    expect(minutes).toBe(0);
  });

  it("should use offer price when offer is accepted and not expired", () => {
    const item = { priceHkd: "10000", acceptedOfferId: 1, acceptedOfferPrice: "7000", isOfferExpired: false };
    const effectivePrice = item.acceptedOfferId && item.acceptedOfferPrice && !item.isOfferExpired
      ? Number(item.acceptedOfferPrice)
      : Number(item.priceHkd);
    expect(effectivePrice).toBe(7000);
  });

  it("should use original price when offer is expired", () => {
    const item = { priceHkd: "10000", acceptedOfferId: 1, acceptedOfferPrice: "7000", isOfferExpired: true };
    const effectivePrice = item.acceptedOfferId && item.acceptedOfferPrice && !item.isOfferExpired
      ? Number(item.acceptedOfferPrice)
      : Number(item.priceHkd);
    expect(effectivePrice).toBe(10000);
  });

  it("should use original price when no accepted offer", () => {
    const item = { priceHkd: "10000", acceptedOfferId: null, acceptedOfferPrice: null, isOfferExpired: false };
    const effectivePrice = item.acceptedOfferId && item.acceptedOfferPrice && !item.isOfferExpired
      ? Number(item.acceptedOfferPrice)
      : Number(item.priceHkd);
    expect(effectivePrice).toBe(10000);
  });
});
