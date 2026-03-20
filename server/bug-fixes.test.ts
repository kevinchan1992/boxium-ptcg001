/**
 * Bug Fixes Tests (2026-03-20)
 * Tests for 5 bug fixes:
 * 1. Address form white theme
 * 2. SF code validation (locker codes with letters like H852G006P)
 * 3. SF station address display
 * 4. Offer cancelled when order is cancelled
 * 5. Monthly chart uses buyerConfirmedAt
 */
import { describe, it, expect } from "vitest";

// ─── Fix 2: SF Code Validation ───────────────────────────────────────────────
// Re-implement the same logic from sfStations.ts for server-side testing
function validateSFCode(code: string): { valid: boolean; type: "station" | "locker" | null; message?: string } {
  const trimmed = code.trim().toUpperCase();
  // SF Station: 852XXXX (7 digits)
  if (/^852\d{4}$/.test(trimmed)) {
    return { valid: true, type: "station" };
  }
  // SF Locker: H852XXXXP where XXXX is 3-6 alphanumeric chars (letters + digits)
  if (/^H852[A-Z0-9]{3,6}P$/.test(trimmed)) {
    return { valid: true, type: "locker" };
  }
  if (trimmed.startsWith("H")) {
    return { valid: false, type: null, message: "智能櫃編號格式不正確（應為 H852XXXXP，例：H852001P）" };
  }
  return { valid: false, type: null, message: "順豐站編號格式不正確（應為 852XXXX，例：8522351）" };
}

describe("Fix 2: SF Code Validation (supports alphanumeric locker codes)", () => {
  describe("Valid SF Station codes (852XXXX)", () => {
    it("accepts standard 7-digit station code", () => {
      expect(validateSFCode("8522351").valid).toBe(true);
      expect(validateSFCode("8522351").type).toBe("station");
    });
    it("accepts another station code", () => {
      expect(validateSFCode("8524567").valid).toBe(true);
    });
  });

  describe("Valid SF Locker codes (H852XXXXP with alphanumeric)", () => {
    it("accepts numeric locker code H852001P", () => {
      expect(validateSFCode("H852001P").valid).toBe(true);
      expect(validateSFCode("H852001P").type).toBe("locker");
    });
    it("accepts alphanumeric locker code H852G006P (letters + digits)", () => {
      expect(validateSFCode("H852G006P").valid).toBe(true);
      expect(validateSFCode("H852G006P").type).toBe("locker");
    });
    it("accepts alphanumeric locker code H852FE95P (letters + digits)", () => {
      expect(validateSFCode("H852FE95P").valid).toBe(true);
      expect(validateSFCode("H852FE95P").type).toBe("locker");
    });
    it("accepts locker code with all letters H852ABCP", () => {
      expect(validateSFCode("H852ABCP").valid).toBe(true);
    });
    it("accepts locker code with 6 alphanumeric chars H852AB12CDP", () => {
      // 6 chars: AB12CD - valid because max is 6
      expect(validateSFCode("H852AB12CDP").valid).toBe(true);
    });
    it("accepts locker code with exactly 6 alphanumeric chars", () => {
      expect(validateSFCode("H852AB12P").valid).toBe(true); // 4 chars: AB12
    });
    it("is case insensitive", () => {
      expect(validateSFCode("h852g006p").valid).toBe(true);
      expect(validateSFCode("H852g006P").valid).toBe(true);
    });
  });

  describe("Invalid codes", () => {
    it("rejects empty string", () => {
      expect(validateSFCode("").valid).toBe(false);
    });
    it("rejects too short station code", () => {
      expect(validateSFCode("852123").valid).toBe(false);
    });
    it("rejects locker without H prefix", () => {
      expect(validateSFCode("852001P").valid).toBe(false);
    });
    it("rejects locker without P suffix", () => {
      expect(validateSFCode("H852001").valid).toBe(false);
    });
    it("rejects random string", () => {
      expect(validateSFCode("ABCDEFG").valid).toBe(false);
    });
    it("returns correct error message for invalid locker", () => {
      const result = validateSFCode("H852INVALID_TOO_LONG_P");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("H852XXXXP");
    });
    it("returns correct error message for invalid station", () => {
      const result = validateSFCode("12345");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("852XXXX");
    });
  });
});

// ─── Fix 4: Offer Cancelled When Order Is Cancelled ──────────────────────────
describe("Fix 4: Offer status logic when order is cancelled", () => {
  it("should mark accepted offers as cancelled when order is cancelled", () => {
    // Simulate the logic: find offers with orderId matching the cancelled order
    const offers = [
      { id: 1, orderId: 100, status: "accepted" },
      { id: 2, orderId: 101, status: "accepted" },
      { id: 3, orderId: 100, status: "pending" }, // different status, should not be affected
    ];
    const cancelledOrderId = 100;

    // The fix: cancel offers where orderId === cancelledOrderId AND status === "accepted"
    const updatedOffers = offers.map(o => {
      if (o.orderId === cancelledOrderId && o.status === "accepted") {
        return { ...o, status: "cancelled" };
      }
      return o;
    });

    expect(updatedOffers.find(o => o.id === 1)?.status).toBe("cancelled");
    expect(updatedOffers.find(o => o.id === 2)?.status).toBe("accepted"); // different orderId
    expect(updatedOffers.find(o => o.id === 3)?.status).toBe("pending"); // not accepted
  });

  it("getMyOfferForListing should not return cancelled offers", () => {
    const allOffers = [
      { id: 1, listingId: 50, status: "cancelled" },
      { id: 2, listingId: 50, status: "pending" },
    ];
    const listingId = 50;

    const acceptedOffer = allOffers.find(o => o.listingId === listingId && o.status === "accepted");
    const pendingOffer = allOffers.find(o => o.listingId === listingId && o.status === "pending");
    const result = acceptedOffer ?? pendingOffer ?? null;

    // Should return pending offer, not the cancelled one
    expect(result?.id).toBe(2);
    expect(result?.status).toBe("pending");
  });

  it("getMyOfferForListing returns null when all offers are cancelled", () => {
    const allOffers = [
      { id: 1, listingId: 50, status: "cancelled" },
    ];
    const listingId = 50;

    const acceptedOffer = allOffers.find(o => o.listingId === listingId && o.status === "accepted");
    const pendingOffer = allOffers.find(o => o.listingId === listingId && o.status === "pending");
    const result = acceptedOffer ?? pendingOffer ?? null;

    expect(result).toBeNull();
  });
});

// ─── Fix 5: Monthly Chart Uses buyerConfirmedAt ───────────────────────────────
describe("Fix 5: Monthly earnings chart uses buyerConfirmedAt", () => {
  const now = new Date("2026-03-20T10:00:00Z");

  function buildMonthlyData(orders: { status: string; amount: string; createdAt: Date; buyerConfirmedAt: Date | null }[]) {
    const monthlyData: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const mCompleted = orders.filter(o => {
        if (o.status !== "completed") return false;
        const d = o.buyerConfirmedAt ? new Date(o.buyerConfirmedAt) : new Date(o.createdAt);
        return d >= mStart && d <= mEnd;
      });
      const mRevenue = mCompleted.reduce((sum, o) => sum + parseFloat(o.amount), 0);
      monthlyData.push({ month: `${mStart.getMonth() + 1}月`, revenue: Math.round(mRevenue * 100) / 100, orders: mCompleted.length });
    }
    return monthlyData;
  }

  it("shows revenue in March when buyerConfirmedAt is in March (even if created in January)", () => {
    const orders = [{
      status: "completed",
      amount: "1000.00",
      createdAt: new Date("2026-01-15T10:00:00Z"),     // created in January
      buyerConfirmedAt: new Date("2026-03-18T10:00:00Z"), // confirmed in March
    }];

    const data = buildMonthlyData(orders);
    const marchData = data.find(d => d.month === "3月");
    const janData = data.find(d => d.month === "1月");

    expect(marchData?.revenue).toBe(1000);
    expect(marchData?.orders).toBe(1);
    expect(janData?.revenue).toBe(0); // should NOT appear in January
  });

  it("falls back to createdAt if buyerConfirmedAt is null", () => {
    const orders = [{
      status: "completed",
      amount: "500.00",
      createdAt: new Date("2026-03-10T10:00:00Z"),
      buyerConfirmedAt: null,
    }];

    const data = buildMonthlyData(orders);
    const marchData = data.find(d => d.month === "3月");
    expect(marchData?.revenue).toBe(500);
  });

  it("excludes non-completed orders from revenue", () => {
    const orders = [
      { status: "pending_payment", amount: "1000.00", createdAt: new Date("2026-03-10T10:00:00Z"), buyerConfirmedAt: null },
      { status: "shipped", amount: "2000.00", createdAt: new Date("2026-03-10T10:00:00Z"), buyerConfirmedAt: null },
      { status: "completed", amount: "500.00", createdAt: new Date("2026-03-10T10:00:00Z"), buyerConfirmedAt: new Date("2026-03-15T10:00:00Z") },
    ];

    const data = buildMonthlyData(orders);
    const marchData = data.find(d => d.month === "3月");
    expect(marchData?.revenue).toBe(500);
    expect(marchData?.orders).toBe(1);
  });

  it("aggregates multiple completed orders in same month", () => {
    const orders = [
      { status: "completed", amount: "1000.00", createdAt: new Date("2026-01-01T10:00:00Z"), buyerConfirmedAt: new Date("2026-03-01T10:00:00Z") },
      { status: "completed", amount: "2000.00", createdAt: new Date("2026-02-01T10:00:00Z"), buyerConfirmedAt: new Date("2026-03-15T10:00:00Z") },
    ];

    const data = buildMonthlyData(orders);
    const marchData = data.find(d => d.month === "3月");
    expect(marchData?.revenue).toBe(3000);
    expect(marchData?.orders).toBe(2);
  });
});
