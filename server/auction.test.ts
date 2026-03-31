/**
 * Auction Feature Unit Tests
 * Tests for bid validation, anti-sniping, and auction state logic
 */
import { describe, it, expect } from "vitest";

// ---- Bid Validation Logic ----

function validateBid(
  bidAmount: number,
  currentHighBid: number,
  startingBid: number,
  bidIncrement: number
): { valid: boolean; error?: string } {
  const minBid = currentHighBid > 0
    ? currentHighBid + bidIncrement
    : startingBid;

  if (bidAmount < minBid) {
    return {
      valid: false,
      error: `出價不足，最低出價為 HKD ${minBid}`,
    };
  }
  return { valid: true };
}

// ---- Anti-sniping Logic ----

function applyAntiSniping(
  bidTime: Date,
  auctionEndAt: Date,
  antiSnipingMinutes: number
): Date {
  const msBeforeEnd = auctionEndAt.getTime() - bidTime.getTime();
  const antiSnipingMs = antiSnipingMinutes * 60 * 1000;

  if (msBeforeEnd < antiSnipingMs && msBeforeEnd > 0) {
    // Extend end time by antiSnipingMinutes from now
    return new Date(bidTime.getTime() + antiSnipingMs);
  }
  return auctionEndAt;
}

// ---- Auction Status Transition ----

type AuctionStatus =
  | "pending_review"
  | "scheduled"
  | "active"
  | "ending_soon"
  | "ended_sold"
  | "ended_no_bid"
  | "cancelled";

function computeAuctionStatus(
  now: Date,
  startAt: Date,
  endAt: Date,
  bidCount: number,
  endingSoonMinutes = 30
): AuctionStatus {
  if (now < startAt) return "scheduled";
  if (now >= endAt) {
    return bidCount > 0 ? "ended_sold" : "ended_no_bid";
  }
  const msToEnd = endAt.getTime() - now.getTime();
  if (msToEnd <= endingSoonMinutes * 60 * 1000) return "ending_soon";
  return "active";
}

// ---- Tests ----

describe("Bid Validation", () => {
  it("accepts bid equal to starting bid when no bids yet", () => {
    expect(validateBid(100, 0, 100, 10).valid).toBe(true);
  });

  it("accepts bid above minimum increment", () => {
    expect(validateBid(220, 200, 100, 10).valid).toBe(true);
  });

  it("rejects bid below starting bid", () => {
    const result = validateBid(50, 0, 100, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("100");
  });

  it("rejects bid below current high + increment", () => {
    const result = validateBid(205, 200, 100, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("210");
  });

  it("accepts bid exactly at minimum (currentHigh + increment)", () => {
    expect(validateBid(210, 200, 100, 10).valid).toBe(true);
  });

  it("rejects bid equal to current high (no increment)", () => {
    const result = validateBid(200, 200, 100, 10);
    expect(result.valid).toBe(false);
  });
});

describe("Anti-sniping Extension", () => {
  it("does not extend end time when bid is far from end", () => {
    const endAt = new Date("2026-04-01T12:00:00Z");
    const bidTime = new Date("2026-04-01T11:00:00Z"); // 60 min before end
    const newEnd = applyAntiSniping(bidTime, endAt, 5);
    expect(newEnd.getTime()).toBe(endAt.getTime());
  });

  it("extends end time when bid is within anti-sniping window", () => {
    const endAt = new Date("2026-04-01T12:00:00Z");
    const bidTime = new Date("2026-04-01T11:58:00Z"); // 2 min before end (within 5 min window)
    const newEnd = applyAntiSniping(bidTime, endAt, 5);
    const expectedEnd = new Date(bidTime.getTime() + 5 * 60 * 1000);
    expect(newEnd.getTime()).toBe(expectedEnd.getTime());
  });

  it("extends end time when bid is exactly at anti-sniping boundary", () => {
    const endAt = new Date("2026-04-01T12:00:00Z");
    const bidTime = new Date("2026-04-01T11:55:01Z"); // just inside 5 min window
    const newEnd = applyAntiSniping(bidTime, endAt, 5);
    expect(newEnd.getTime()).toBeGreaterThan(endAt.getTime());
  });

  it("does not extend when bid is after auction end", () => {
    const endAt = new Date("2026-04-01T12:00:00Z");
    const bidTime = new Date("2026-04-01T12:01:00Z"); // after end
    const newEnd = applyAntiSniping(bidTime, endAt, 5);
    expect(newEnd.getTime()).toBe(endAt.getTime());
  });
});

describe("Auction Status Computation", () => {
  const start = new Date("2026-04-01T10:00:00Z");
  const end = new Date("2026-04-01T12:00:00Z");

  it("returns scheduled when now < startAt", () => {
    const now = new Date("2026-04-01T09:00:00Z");
    expect(computeAuctionStatus(now, start, end, 0)).toBe("scheduled");
  });

  it("returns active when auction is running with time to spare", () => {
    const now = new Date("2026-04-01T11:00:00Z");
    expect(computeAuctionStatus(now, start, end, 0)).toBe("active");
  });

  it("returns ending_soon when within 30 min of end", () => {
    const now = new Date("2026-04-01T11:35:00Z"); // 25 min before end
    expect(computeAuctionStatus(now, start, end, 0)).toBe("ending_soon");
  });

  it("returns ended_sold when ended with bids", () => {
    const now = new Date("2026-04-01T13:00:00Z");
    expect(computeAuctionStatus(now, start, end, 5)).toBe("ended_sold");
  });

  it("returns ended_no_bid when ended without bids", () => {
    const now = new Date("2026-04-01T13:00:00Z");
    expect(computeAuctionStatus(now, start, end, 0)).toBe("ended_no_bid");
  });

  it("returns active exactly at start time", () => {
    expect(computeAuctionStatus(start, start, end, 0)).toBe("active");
  });
});
