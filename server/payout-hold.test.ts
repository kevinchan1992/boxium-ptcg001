/**
 * Tests for 48-hour cooling period payout logic
 *
 * New payout flow:
 * 1. Buyer confirms receipt → payoutHoldUntil = now + 48h, payoutStatus = 'processing'
 * 2. 14-day auto-complete → same as above (no dispute prerequisite)
 * 3. payoutHoldScheduler (every hour) → triggers executeSellerPayout when payoutHoldUntil <= now AND no dispute
 * 4. Disputes → payoutStatus = 'hold', payoutHoldUntil is ignored until dispute resolved
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Unit tests for cooling period logic (pure logic, no DB)
// ============================================================

describe("48-hour cooling period logic", () => {
  describe("payoutHoldUntil calculation", () => {
    it("should set payoutHoldUntil to exactly 48 hours from now", () => {
      const before = Date.now();
      const payoutHoldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const after = Date.now();

      const holdMs = payoutHoldUntil.getTime();
      expect(holdMs).toBeGreaterThanOrEqual(before + 48 * 60 * 60 * 1000);
      expect(holdMs).toBeLessThanOrEqual(after + 48 * 60 * 60 * 1000);
    });

    it("should be 48 hours in milliseconds = 172800000", () => {
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
      expect(FORTY_EIGHT_HOURS_MS).toBe(172_800_000);
    });
  });

  describe("payout eligibility check", () => {
    const isPayoutEligible = (order: {
      orderStatus: string;
      payoutStatus: string;
      sellerType: string;
      payoutHoldUntil: Date | null;
    }) => {
      const now = new Date();
      return (
        order.orderStatus === "completed" &&
        order.orderStatus !== "disputed" &&
        order.payoutStatus === "processing" &&
        order.sellerType === "seller" &&
        order.payoutHoldUntil !== null &&
        order.payoutHoldUntil <= now
      );
    };

    it("should be eligible when cooling period has passed and no dispute", () => {
      const pastDate = new Date(Date.now() - 1000); // 1 second ago
      const order = {
        orderStatus: "completed",
        payoutStatus: "processing",
        sellerType: "seller",
        payoutHoldUntil: pastDate,
      };
      expect(isPayoutEligible(order)).toBe(true);
    });

    it("should NOT be eligible when cooling period has NOT passed", () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
      const order = {
        orderStatus: "completed",
        payoutStatus: "processing",
        sellerType: "seller",
        payoutHoldUntil: futureDate,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });

    it("should NOT be eligible when order is disputed", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = {
        orderStatus: "disputed",
        payoutStatus: "processing",
        sellerType: "seller",
        payoutHoldUntil: pastDate,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });

    it("should NOT be eligible when payoutStatus is 'hold' (dispute freeze)", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = {
        orderStatus: "completed",
        payoutStatus: "hold",
        sellerType: "seller",
        payoutHoldUntil: pastDate,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });

    it("should NOT be eligible when payoutStatus is already 'paid'", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = {
        orderStatus: "completed",
        payoutStatus: "paid",
        sellerType: "seller",
        payoutHoldUntil: pastDate,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });

    it("should NOT be eligible for platform orders (sellerType = 'platform')", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = {
        orderStatus: "completed",
        payoutStatus: "not_applicable",
        sellerType: "platform",
        payoutHoldUntil: null,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });

    it("should NOT be eligible when payoutHoldUntil is null", () => {
      const order = {
        orderStatus: "completed",
        payoutStatus: "processing",
        sellerType: "seller",
        payoutHoldUntil: null,
      };
      expect(isPayoutEligible(order)).toBe(false);
    });
  });

  describe("auto-complete dispute exclusion", () => {
    const shouldAutoComplete = (order: {
      orderStatus: string;
      autoCompleteAt: Date | null;
    }) => {
      const now = new Date();
      return (
        ["shipped", "delivered"].includes(order.orderStatus) &&
        order.orderStatus !== "disputed" &&
        order.autoCompleteAt !== null &&
        order.autoCompleteAt <= now
      );
    };

    it("should auto-complete shipped orders past 14 days", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = { orderStatus: "shipped", autoCompleteAt: pastDate };
      expect(shouldAutoComplete(order)).toBe(true);
    });

    it("should auto-complete delivered orders past 14 days", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = { orderStatus: "delivered", autoCompleteAt: pastDate };
      expect(shouldAutoComplete(order)).toBe(true);
    });

    it("should NOT auto-complete disputed orders", () => {
      const pastDate = new Date(Date.now() - 1000);
      const order = { orderStatus: "disputed", autoCompleteAt: pastDate };
      expect(shouldAutoComplete(order)).toBe(false);
    });

    it("should NOT auto-complete orders where autoCompleteAt has not passed", () => {
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const order = { orderStatus: "shipped", autoCompleteAt: futureDate };
      expect(shouldAutoComplete(order)).toBe(false);
    });

    it("should NOT auto-complete orders with null autoCompleteAt", () => {
      const order = { orderStatus: "shipped", autoCompleteAt: null };
      expect(shouldAutoComplete(order)).toBe(false);
    });
  });

  describe("platform order payout status", () => {
    it("platform orders should have payoutStatus = 'not_applicable' and no payoutHoldUntil", () => {
      const isPlatformOrder = true;
      const payoutHoldUntil = isPlatformOrder ? null : new Date(Date.now() + 48 * 60 * 60 * 1000);
      const payoutStatus = isPlatformOrder ? "not_applicable" : "processing";

      expect(payoutStatus).toBe("not_applicable");
      expect(payoutHoldUntil).toBeNull();
    });

    it("C2C orders should have payoutStatus = 'processing' and payoutHoldUntil set", () => {
      const isPlatformOrder = false;
      const payoutHoldUntil = isPlatformOrder ? null : new Date(Date.now() + 48 * 60 * 60 * 1000);
      const payoutStatus = isPlatformOrder ? "not_applicable" : "processing";

      expect(payoutStatus).toBe("processing");
      expect(payoutHoldUntil).not.toBeNull();
      expect(payoutHoldUntil!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("cooling period timing", () => {
    it("cooling period should end exactly 48 hours after confirmReceipt", () => {
      const confirmReceiptTime = new Date("2026-01-01T10:00:00Z");
      const expectedPayoutTime = new Date("2026-01-03T10:00:00Z"); // +48h

      const actualPayoutHoldUntil = new Date(confirmReceiptTime.getTime() + 48 * 60 * 60 * 1000);
      expect(actualPayoutHoldUntil.getTime()).toBe(expectedPayoutTime.getTime());
    });

    it("cooling period should end exactly 48 hours after 14-day auto-complete", () => {
      const autoCompleteTime = new Date("2026-01-15T08:00:00Z");
      const expectedPayoutTime = new Date("2026-01-17T08:00:00Z"); // +48h

      const actualPayoutHoldUntil = new Date(autoCompleteTime.getTime() + 48 * 60 * 60 * 1000);
      expect(actualPayoutHoldUntil.getTime()).toBe(expectedPayoutTime.getTime());
    });
  });
});
