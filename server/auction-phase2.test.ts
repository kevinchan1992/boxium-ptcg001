/**
 * Auction Phase 2 Tests
 * Tests for: anti-sniping extension, reserve price logic, violation/ban logic,
 * ending-soon notification timing, overdue auction order detection
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Anti-Sniping Logic ───────────────────────────────────────────────────────

function computeAntiSnipe(
  endAt: Date,
  now: Date,
  antiSnipingMinutes: number
): { extended: boolean; newEndAt: Date } {
  if (antiSnipingMinutes <= 0) return { extended: false, newEndAt: endAt };
  const msToEnd = endAt.getTime() - now.getTime();
  const snipingWindowMs = antiSnipingMinutes * 60 * 1000;
  if (msToEnd > 0 && msToEnd < snipingWindowMs) {
    return { extended: true, newEndAt: new Date(now.getTime() + snipingWindowMs) };
  }
  return { extended: false, newEndAt: endAt };
}

describe("Anti-Sniping Extension Logic", () => {
  it("should extend auction when bid placed within sniping window", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const endAt = new Date("2026-01-01T12:03:00Z"); // 3 min left
    const result = computeAntiSnipe(endAt, now, 5); // 5 min window
    expect(result.extended).toBe(true);
    expect(result.newEndAt.getTime()).toBe(now.getTime() + 5 * 60 * 1000);
  });

  it("should NOT extend auction when bid placed outside sniping window", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const endAt = new Date("2026-01-01T12:10:00Z"); // 10 min left
    const result = computeAntiSnipe(endAt, now, 5); // 5 min window
    expect(result.extended).toBe(false);
    expect(result.newEndAt).toBe(endAt);
  });

  it("should NOT extend when antiSnipingMinutes is 0", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const endAt = new Date("2026-01-01T12:01:00Z"); // 1 min left
    const result = computeAntiSnipe(endAt, now, 0);
    expect(result.extended).toBe(false);
  });

  it("should NOT extend when auction has already ended", () => {
    const now = new Date("2026-01-01T12:10:00Z");
    const endAt = new Date("2026-01-01T12:00:00Z"); // already ended
    const result = computeAntiSnipe(endAt, now, 5);
    expect(result.extended).toBe(false);
  });

  it("should extend by exactly antiSnipingMinutes from now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const endAt = new Date("2026-01-01T12:02:00Z"); // 2 min left
    const result = computeAntiSnipe(endAt, now, 10); // 10 min window
    expect(result.extended).toBe(true);
    const expectedEnd = new Date(now.getTime() + 10 * 60 * 1000);
    expect(result.newEndAt.getTime()).toBe(expectedEnd.getTime());
  });
});

// ─── Reserve Price Logic ──────────────────────────────────────────────────────

function checkReserveMet(
  bidAmount: number,
  reservePrice: string | null | undefined
): boolean {
  if (!reservePrice) return true; // no reserve = always met
  return bidAmount >= parseFloat(reservePrice);
}

describe("Reserve Price Logic", () => {
  it("should return true when no reserve price set", () => {
    expect(checkReserveMet(100, null)).toBe(true);
    expect(checkReserveMet(100, undefined)).toBe(true);
  });

  it("should return true when bid meets reserve price", () => {
    expect(checkReserveMet(500, "500")).toBe(true);
    expect(checkReserveMet(600, "500")).toBe(true);
  });

  it("should return false when bid is below reserve price", () => {
    expect(checkReserveMet(400, "500")).toBe(false);
    expect(checkReserveMet(1, "500")).toBe(false);
  });

  it("should handle decimal reserve prices", () => {
    expect(checkReserveMet(100, "99.99")).toBe(true);
    expect(checkReserveMet(99, "99.99")).toBe(false);
  });
});

// ─── Minimum Bid Calculation ──────────────────────────────────────────────────

function computeMinBid(
  startingBid: string,
  currentHighestBid: string | null | undefined,
  bidIncrement: string
): number {
  if (!currentHighestBid) return parseFloat(startingBid);
  return parseFloat(currentHighestBid) + parseFloat(bidIncrement);
}

describe("Minimum Bid Calculation", () => {
  it("should return startingBid when no bids yet", () => {
    expect(computeMinBid("100", null, "10")).toBe(100);
    expect(computeMinBid("100", undefined, "10")).toBe(100);
  });

  it("should return currentHighest + increment when bids exist", () => {
    expect(computeMinBid("100", "200", "10")).toBe(210);
    expect(computeMinBid("100", "350", "25")).toBe(375);
  });

  it("should handle zero increment", () => {
    expect(computeMinBid("100", "200", "0")).toBe(200);
  });
});

// ─── Buy-Now Trigger Check ────────────────────────────────────────────────────

function isBuyNowTriggered(bidAmount: number, buyNowPrice: string | null | undefined): boolean {
  if (!buyNowPrice) return false;
  return bidAmount >= parseFloat(buyNowPrice);
}

describe("Buy-Now Trigger Logic", () => {
  it("should not trigger when no buy-now price", () => {
    expect(isBuyNowTriggered(9999, null)).toBe(false);
    expect(isBuyNowTriggered(9999, undefined)).toBe(false);
  });

  it("should trigger when bid reaches buy-now price", () => {
    expect(isBuyNowTriggered(1000, "1000")).toBe(true);
    expect(isBuyNowTriggered(1500, "1000")).toBe(true);
  });

  it("should NOT trigger when bid is below buy-now price", () => {
    expect(isBuyNowTriggered(999, "1000")).toBe(false);
  });
});

// ─── Violation Ban Expiry ─────────────────────────────────────────────────────

function computeBanExpiry(penalty: string, now: Date): Date | null {
  const banDays: Record<string, number | null> = {
    warning: null,
    ban_7d: 7,
    ban_30d: 30,
    permanent: null,
  };
  const days = banDays[penalty];
  if (!days) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function isUserBanned(violations: Array<{ penalty: string; banExpiresAt: Date | null }>, now: Date): boolean {
  return violations.some(v => {
    if (v.penalty === "permanent") return true;
    if (["ban_7d", "ban_30d"].includes(v.penalty) && v.banExpiresAt && v.banExpiresAt > now) return true;
    return false;
  });
}

describe("Violation and Ban Logic", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("should compute 7-day ban expiry correctly", () => {
    const expiry = computeBanExpiry("ban_7d", now);
    expect(expiry).not.toBeNull();
    expect(expiry!.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  });

  it("should compute 30-day ban expiry correctly", () => {
    const expiry = computeBanExpiry("ban_30d", now);
    expect(expiry).not.toBeNull();
    expect(expiry!.getTime()).toBe(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("should return null expiry for warning and permanent", () => {
    expect(computeBanExpiry("warning", now)).toBeNull();
    expect(computeBanExpiry("permanent", now)).toBeNull();
  });

  it("should detect active 7-day ban", () => {
    const banExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const violations = [{ penalty: "ban_7d", banExpiresAt: banExpiry }];
    expect(isUserBanned(violations, now)).toBe(true);
  });

  it("should detect expired ban as not banned", () => {
    const banExpiry = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // expired yesterday
    const violations = [{ penalty: "ban_7d", banExpiresAt: banExpiry }];
    expect(isUserBanned(violations, now)).toBe(false);
  });

  it("should detect permanent ban", () => {
    const violations = [{ penalty: "permanent", banExpiresAt: null }];
    expect(isUserBanned(violations, now)).toBe(true);
  });

  it("should not ban for warning only", () => {
    const violations = [{ penalty: "warning", banExpiresAt: null }];
    expect(isUserBanned(violations, now)).toBe(false);
  });
});

// ─── Ending Soon Notification Timing ─────────────────────────────────────────

function shouldSendEndingSoonNotification(
  endAt: Date,
  now: Date,
  windowMinutes: number = 60
): boolean {
  const msToEnd = endAt.getTime() - now.getTime();
  const windowMs = windowMinutes * 60 * 1000;
  return msToEnd > 0 && msToEnd <= windowMs;
}

describe("Ending Soon Notification Timing", () => {
  it("should trigger notification within 1-hour window", () => {
    const now = new Date("2026-01-01T11:00:00Z");
    const endAt = new Date("2026-01-01T11:45:00Z"); // 45 min left
    expect(shouldSendEndingSoonNotification(endAt, now, 60)).toBe(true);
  });

  it("should NOT trigger notification outside 1-hour window", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const endAt = new Date("2026-01-01T12:00:00Z"); // 2 hours left
    expect(shouldSendEndingSoonNotification(endAt, now, 60)).toBe(false);
  });

  it("should NOT trigger notification for ended auctions", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const endAt = new Date("2026-01-01T11:00:00Z"); // already ended
    expect(shouldSendEndingSoonNotification(endAt, now, 60)).toBe(false);
  });

  it("should trigger exactly at 60-minute boundary", () => {
    const now = new Date("2026-01-01T11:00:00Z");
    const endAt = new Date("2026-01-01T12:00:00Z"); // exactly 60 min
    expect(shouldSendEndingSoonNotification(endAt, now, 60)).toBe(true);
  });
});

// ─── Overdue Payment Detection ────────────────────────────────────────────────

function isPaymentOverdue(orderCreatedAt: Date, now: Date, deadlineHours: number = 24): boolean {
  const cutoff = new Date(orderCreatedAt.getTime() + deadlineHours * 60 * 60 * 1000);
  return now > cutoff;
}

describe("Overdue Auction Payment Detection", () => {
  it("should detect overdue payment after 24 hours", () => {
    const createdAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-02T11:00:00Z"); // 25 hours later
    expect(isPaymentOverdue(createdAt, now, 24)).toBe(true);
  });

  it("should NOT flag payment as overdue within 24 hours", () => {
    const createdAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-01T20:00:00Z"); // 10 hours later
    expect(isPaymentOverdue(createdAt, now, 24)).toBe(false);
  });

  it("should detect exactly at deadline boundary", () => {
    const createdAt = new Date("2026-01-01T10:00:00Z");
    const now = new Date("2026-01-02T10:00:01Z"); // 1 second past deadline
    expect(isPaymentOverdue(createdAt, now, 24)).toBe(true);
  });
});
