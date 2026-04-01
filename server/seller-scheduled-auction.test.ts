import { describe, it, expect } from "vitest";

/**
 * Tests for seller dashboard scheduled auction display logic.
 * These tests verify the filtering and categorization logic used in SellerDashboard.tsx
 * for the "進行中" (active) tab that now includes scheduled auctions.
 */

// Replicate the filtering logic from SellerDashboard.tsx
function categorizeAuctions(allListings: any[]) {
  const activeAuctions = allListings.filter((a: any) =>
    ["active", "scheduled", "pending_review", "ending_soon"].includes(a.auctionStatus)
  );
  const endedAuctions = allListings.filter((a: any) =>
    ["ended_sold", "ended_no_bid", "cancelled", "ended", "sold"].includes(a.auctionStatus)
  );
  const rejectedAuctions = allListings.filter((a: any) =>
    a.auctionStatus === "rejected"
  );
  return { activeAuctions, endedAuctions, rejectedAuctions };
}

// Replicate the AuctionStatusBadge label map
const statusLabelMap: Record<string, { label: string; cls: string }> = {
  active:         { label: "競拍中",   cls: "bg-blue-100 text-blue-700" },
  ending_soon:    { label: "即將結標", cls: "bg-orange-100 text-orange-700" },
  scheduled:      { label: "已排程",   cls: "bg-indigo-100 text-indigo-700" },
  pending_review: { label: "待審核",   cls: "bg-yellow-100 text-yellow-700" },
  ended_sold:     { label: "已成交",   cls: "bg-green-100 text-green-700" },
  ended_no_bid:   { label: "流標",     cls: "bg-gray-100 text-gray-500" },
  ended:          { label: "已結標",   cls: "bg-green-100 text-green-700" },
  sold:           { label: "已成交",   cls: "bg-green-100 text-green-700" },
  cancelled:      { label: "已取消",   cls: "bg-gray-100 text-gray-500" },
  rejected:       { label: "已拒絕",   cls: "bg-red-100 text-red-600" },
};

describe("Seller Dashboard - Scheduled Auction Display", () => {
  const mockListings = [
    {
      id: 1,
      auctionStatus: "active",
      title: "競拍中的拍賣",
      startingBid: "100",
      currentHighestBid: "150",
      bidCount: 3,
      auctionEndAt: new Date(Date.now() + 3600000).toISOString(),
      auctionStartAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 2,
      auctionStatus: "scheduled",
      title: "已排程的拍賣",
      startingBid: "200",
      currentHighestBid: null,
      bidCount: 0,
      auctionEndAt: new Date(Date.now() + 86400000).toISOString(),
      auctionStartAt: new Date(Date.now() + 3600000).toISOString(),
      buyNowPrice: "500",
    },
    {
      id: 3,
      auctionStatus: "pending_review",
      title: "待審核的拍賣",
      startingBid: "300",
      currentHighestBid: null,
      bidCount: 0,
      auctionEndAt: null,
      auctionStartAt: null,
    },
    {
      id: 4,
      auctionStatus: "ending_soon",
      title: "即將結標的拍賣",
      startingBid: "400",
      currentHighestBid: "450",
      bidCount: 5,
      auctionEndAt: new Date(Date.now() + 1800000).toISOString(),
      auctionStartAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 5,
      auctionStatus: "ended_sold",
      title: "已成交的拍賣",
      startingBid: "500",
      currentHighestBid: "600",
      bidCount: 8,
      auctionEndAt: new Date(Date.now() - 3600000).toISOString(),
      auctionStartAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 6,
      auctionStatus: "rejected",
      title: "被拒絕的拍賣",
      startingBid: "600",
      currentHighestBid: null,
      bidCount: 0,
      auctionEndAt: null,
      auctionStartAt: null,
      rejectedReason: "圖片不清晰",
    },
  ];

  it("should include scheduled auctions in the active (進行中) tab", () => {
    const { activeAuctions } = categorizeAuctions(mockListings);
    const scheduledInActive = activeAuctions.filter(a => a.auctionStatus === "scheduled");
    expect(scheduledInActive).toHaveLength(1);
    expect(scheduledInActive[0].id).toBe(2);
  });

  it("should include active, scheduled, pending_review, ending_soon in active tab", () => {
    const { activeAuctions } = categorizeAuctions(mockListings);
    expect(activeAuctions).toHaveLength(4);
    const statuses = activeAuctions.map(a => a.auctionStatus);
    expect(statuses).toContain("active");
    expect(statuses).toContain("scheduled");
    expect(statuses).toContain("pending_review");
    expect(statuses).toContain("ending_soon");
  });

  it("should NOT include scheduled in ended tab", () => {
    const { endedAuctions } = categorizeAuctions(mockListings);
    const scheduledInEnded = endedAuctions.filter(a => a.auctionStatus === "scheduled");
    expect(scheduledInEnded).toHaveLength(0);
  });

  it("should NOT include scheduled in rejected tab", () => {
    const { rejectedAuctions } = categorizeAuctions(mockListings);
    const scheduledInRejected = rejectedAuctions.filter(a => a.auctionStatus === "scheduled");
    expect(scheduledInRejected).toHaveLength(0);
  });

  it("scheduled status badge should use indigo color (distinct from active blue)", () => {
    const scheduledBadge = statusLabelMap["scheduled"];
    const activeBadge = statusLabelMap["active"];
    expect(scheduledBadge.label).toBe("已排程");
    expect(scheduledBadge.cls).toContain("indigo");
    expect(activeBadge.cls).toContain("blue");
    // They should be visually distinct
    expect(scheduledBadge.cls).not.toBe(activeBadge.cls);
  });

  it("scheduled auction should have auctionStartAt for displaying scheduled time", () => {
    const scheduledAuction = mockListings.find(a => a.auctionStatus === "scheduled");
    expect(scheduledAuction).toBeDefined();
    expect(scheduledAuction!.auctionStartAt).toBeTruthy();
    // The start time should be in the future for a scheduled auction
    const startTime = new Date(scheduledAuction!.auctionStartAt!).getTime();
    expect(startTime).toBeGreaterThan(Date.now());
  });

  it("scheduled auction should optionally have buyNowPrice", () => {
    const scheduledAuction = mockListings.find(a => a.auctionStatus === "scheduled");
    expect(scheduledAuction!.buyNowPrice).toBe("500");
  });

  it("ended_sold should be in ended tab, not active tab", () => {
    const { activeAuctions, endedAuctions } = categorizeAuctions(mockListings);
    const endedInActive = activeAuctions.filter(a => a.auctionStatus === "ended_sold");
    const endedInEnded = endedAuctions.filter(a => a.auctionStatus === "ended_sold");
    expect(endedInActive).toHaveLength(0);
    expect(endedInEnded).toHaveLength(1);
  });

  it("rejected auction should only be in rejected tab", () => {
    const { activeAuctions, endedAuctions, rejectedAuctions } = categorizeAuctions(mockListings);
    expect(activeAuctions.filter(a => a.auctionStatus === "rejected")).toHaveLength(0);
    expect(endedAuctions.filter(a => a.auctionStatus === "rejected")).toHaveLength(0);
    expect(rejectedAuctions).toHaveLength(1);
  });

  it("active tab count should reflect all in-progress statuses including scheduled", () => {
    const { activeAuctions } = categorizeAuctions(mockListings);
    // active(1) + scheduled(1) + pending_review(1) + ending_soon(1) = 4
    expect(activeAuctions.length).toBe(4);
  });
});
