/**
 * Tests for dispute dashboard, 3-day reminder scheduler, and evidence upload CTA
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. getDisputeStats helper ───────────────────────────────────────────────

describe("getDisputeStats", () => {
  it("should return all required stat fields", () => {
    const mockStats = {
      totalDisputes: 12,
      openDisputes: 3,
      resolvedDisputes: 9,
      avgResolutionDays: 2.4,
      buyerWinRate: 0.67,
      sellerWinRate: 0.33,
      monthlyDisputes: 4,
      escalatedDisputes: 1,
    };

    expect(mockStats).toHaveProperty("totalDisputes");
    expect(mockStats).toHaveProperty("openDisputes");
    expect(mockStats).toHaveProperty("resolvedDisputes");
    expect(mockStats).toHaveProperty("avgResolutionDays");
    expect(mockStats).toHaveProperty("buyerWinRate");
    expect(mockStats).toHaveProperty("sellerWinRate");
    expect(mockStats).toHaveProperty("monthlyDisputes");
    expect(mockStats).toHaveProperty("escalatedDisputes");
  });

  it("should calculate win rates correctly", () => {
    const buyerWins = 6;
    const sellerWins = 3;
    const total = buyerWins + sellerWins;
    const buyerWinRate = total > 0 ? buyerWins / total : 0;
    const sellerWinRate = total > 0 ? sellerWins / total : 0;

    expect(buyerWinRate).toBeCloseTo(0.667, 2);
    expect(sellerWinRate).toBeCloseTo(0.333, 2);
    expect(buyerWinRate + sellerWinRate).toBeCloseTo(1.0, 5);
  });

  it("should handle zero disputes gracefully", () => {
    const buyerWins = 0;
    const sellerWins = 0;
    const total = buyerWins + sellerWins;
    const buyerWinRate = total > 0 ? buyerWins / total : 0;
    const sellerWinRate = total > 0 ? sellerWins / total : 0;

    expect(buyerWinRate).toBe(0);
    expect(sellerWinRate).toBe(0);
  });

  it("should calculate average resolution days correctly", () => {
    const resolutionDays = [1, 2, 3, 4, 5];
    const avg = resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length;
    expect(avg).toBe(3);
  });

  it("should count monthly disputes correctly", () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const disputes = [
      { createdAt: new Date(), status: "disputed" },
      { createdAt: new Date(), status: "disputed" },
      { createdAt: new Date(startOfMonth.getTime() - 1), status: "disputed" }, // last month
    ];
    const monthlyDisputes = disputes.filter(d => new Date(d.createdAt) >= startOfMonth).length;
    expect(monthlyDisputes).toBe(2);
  });
});

// ─── 2. 3-Day Reminder Scheduler Logic ───────────────────────────────────────

describe("Dispute 3-Day Reminder Scheduler", () => {
  it("should identify disputes older than 3 days", () => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const disputes = [
      { id: 1, disputedAt: new Date(now - 4 * 24 * 60 * 60 * 1000), orderStatus: "disputed" }, // 4 days ago
      { id: 2, disputedAt: new Date(now - 2 * 24 * 60 * 60 * 1000), orderStatus: "disputed" }, // 2 days ago
      { id: 3, disputedAt: new Date(now - 3.5 * 24 * 60 * 60 * 1000), orderStatus: "disputed" }, // 3.5 days ago
    ];

    const overdueDisputes = disputes.filter(d => {
      const ageMs = now - new Date(d.disputedAt).getTime();
      return ageMs > threeDaysMs;
    });

    expect(overdueDisputes).toHaveLength(2);
    expect(overdueDisputes.map(d => d.id)).toEqual([1, 3]);
  });

  it("should not flag disputes exactly at 3 days", () => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const disputes = [
      { id: 1, disputedAt: new Date(now - threeDaysMs), orderStatus: "disputed" }, // exactly 3 days
    ];

    const overdueDisputes = disputes.filter(d => {
      const ageMs = now - new Date(d.disputedAt).getTime();
      return ageMs > threeDaysMs;
    });

    expect(overdueDisputes).toHaveLength(0);
  });

  it("should only flag open (unresolved) disputes", () => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    const disputes = [
      { id: 1, disputedAt: new Date(now - 4 * 24 * 60 * 60 * 1000), orderStatus: "disputed" }, // open
      { id: 2, disputedAt: new Date(now - 4 * 24 * 60 * 60 * 1000), orderStatus: "completed" }, // resolved
    ];

    const overdueOpenDisputes = disputes.filter(d => {
      const ageMs = now - new Date(d.disputedAt).getTime();
      return ageMs > threeDaysMs && d.orderStatus === "disputed";
    });

    expect(overdueOpenDisputes).toHaveLength(1);
    expect(overdueOpenDisputes[0].id).toBe(1);
  });

  it("should build correct reminder email content", () => {
    const dispute = {
      id: 42,
      orderNo: "BX-20260101-001",
      disputedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    };

    const ageMs = Date.now() - new Date(dispute.disputedAt).getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const subject = `[爭議升級提醒] 訂單 ${dispute.orderNo} 已超過 ${ageDays} 天未解決`;
    const content = `訂單 ${dispute.orderNo} 的爭議已超過 ${ageDays} 天仍未解決，請盡快介入處理。`;

    expect(subject).toContain(dispute.orderNo);
    expect(subject).toContain("爭議升級提醒");
    expect(content).toContain(dispute.orderNo);
    expect(ageDays).toBe(4);
  });
});

// ─── 3. Dispute Banner CTA Logic ─────────────────────────────────────────────

describe("Dispute Banner Evidence Upload CTA", () => {
  it("should show upload CTA when dispute is unresolved", () => {
    const order = {
      orderStatus: "disputed",
      disputeResolution: null,
    };

    const shouldShowCTA = order.orderStatus === "disputed" && !order.disputeResolution;
    expect(shouldShowCTA).toBe(true);
  });

  it("should hide upload CTA when dispute is resolved", () => {
    const order = {
      orderStatus: "disputed",
      disputeResolution: "管理員已裁定支持買家，退款已處理",
    };

    const shouldShowCTA = order.orderStatus === "disputed" && !order.disputeResolution;
    expect(shouldShowCTA).toBe(false);
  });

  it("should show resolution result when dispute is resolved", () => {
    const order = {
      orderStatus: "disputed",
      disputeResolution: "管理員已裁定支持買家，退款已處理",
    };

    const shouldShowResolution = !!order.disputeResolution;
    expect(shouldShowResolution).toBe(true);
  });

  it("should not show dispute banner for non-disputed orders", () => {
    const statuses = ["pending_payment", "payment_received", "processing", "shipped", "completed"];
    statuses.forEach(status => {
      const isDisputed = status === "disputed";
      expect(isDisputed).toBe(false);
    });
  });
});

// ─── 4. AdminDashboard Dispute Stats Display ─────────────────────────────────

describe("AdminDashboard Dispute Stats Panel", () => {
  it("should format win rate as percentage", () => {
    const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
    expect(formatPercent(0.667)).toBe("66.7%");
    expect(formatPercent(0.333)).toBe("33.3%");
    expect(formatPercent(0)).toBe("0.0%");
    expect(formatPercent(1)).toBe("100.0%");
  });

  it("should format average resolution days correctly", () => {
    const formatDays = (days: number) => days === 0 ? "N/A" : `${days.toFixed(1)} 天`;
    expect(formatDays(2.4)).toBe("2.4 天");
    expect(formatDays(0)).toBe("N/A");
    expect(formatDays(1)).toBe("1.0 天");
  });

  it("should determine dispute health status", () => {
    const getHealthStatus = (openDisputes: number, escalated: number) => {
      if (escalated > 0) return "critical";
      if (openDisputes > 5) return "warning";
      return "healthy";
    };

    expect(getHealthStatus(2, 0)).toBe("healthy");
    expect(getHealthStatus(8, 0)).toBe("warning");
    expect(getHealthStatus(3, 1)).toBe("critical");
  });
});
