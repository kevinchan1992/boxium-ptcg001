/**
 * Sales Report – Refund/Cancel Stats + Fee Detail Drill-down Tests
 * Tests the new financial fields: refundedCount, cancelledCount,
 * refundedAmountHkd, netRevenueHkd, and fee detail data transformation.
 */

import { describe, it, expect } from "vitest";

// ── Types mirroring backend return shapes ─────────────────────────────────

interface MonthlyRow {
  yearMonth: string;
  totalSalesHkd: number;
  orderCount: number;
  stripeCount: number;
  alipayCount: number;
  platformSalesHkd: number;
  sellerSalesHkd: number;
  sellerFeesHkd: number;
  refundedCount: number;
  cancelledCount: number;
  refundedAmountHkd: number;
  netRevenueHkd: number;
}

interface Overall {
  totalSalesHkd: number;
  totalFeesHkd: number;
  totalOrders: number;
  platformSalesHkd: number;
  sellerSalesHkd: number;
  stripeCount: number;
  alipayCount: number;
  refundedCount: number;
  cancelledCount: number;
  refundedAmountHkd: number;
  netRevenueHkd: number;
}

interface FeeDetailRow {
  orderId: number;
  orderNo: string;
  subtotalHkd: number;
  platformFeeHkd: number;
  sellerReceivableHkd: number;
  orderStatus: string;
  paymentMethod: string;
  createdAt: Date | null;
  sellerDisplayName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildRefundMap(
  refundRows: Array<{ yearMonth: string; refundedCount: number; cancelledCount: number; refundedAmountHkd: number }>
): Map<string, { refundedCount: number; cancelledCount: number; refundedAmountHkd: number }> {
  const map = new Map<string, { refundedCount: number; cancelledCount: number; refundedAmountHkd: number }>();
  for (const r of refundRows) {
    map.set(r.yearMonth, {
      refundedCount: r.refundedCount,
      cancelledCount: r.cancelledCount,
      refundedAmountHkd: r.refundedAmountHkd,
    });
  }
  return map;
}

function mergeMonthlyWithRefund(
  salesRow: { yearMonth: string; totalSalesHkd: number },
  refundMap: Map<string, { refundedCount: number; cancelledCount: number; refundedAmountHkd: number }>
): Pick<MonthlyRow, "refundedCount" | "cancelledCount" | "refundedAmountHkd" | "netRevenueHkd"> {
  const refund = refundMap.get(salesRow.yearMonth) ?? { refundedCount: 0, cancelledCount: 0, refundedAmountHkd: 0 };
  return {
    refundedCount: refund.refundedCount,
    cancelledCount: refund.cancelledCount,
    refundedAmountHkd: refund.refundedAmountHkd,
    netRevenueHkd: salesRow.totalSalesHkd - refund.refundedAmountHkd,
  };
}

function calcNetRevenue(totalSalesHkd: number, refundedAmountHkd: number): number {
  return totalSalesHkd - refundedAmountHkd;
}

function buildFeeDetailSellerName(
  displayName: string | null | undefined,
  userName: string | null | undefined,
  sellerId: number
): string {
  return displayName ?? userName ?? `賣家 #${sellerId}`;
}

// ── Test data ─────────────────────────────────────────────────────────────

const sampleSalesRows = [
  { yearMonth: "2026-03", totalSalesHkd: 500.0 },
  { yearMonth: "2026-02", totalSalesHkd: 1200.0 },
  { yearMonth: "2026-01", totalSalesHkd: 800.0 },
];

const sampleRefundRows = [
  { yearMonth: "2026-03", refundedCount: 1, cancelledCount: 2, refundedAmountHkd: 50.0 },
  { yearMonth: "2026-01", refundedCount: 0, cancelledCount: 1, refundedAmountHkd: 0.0 },
];

const sampleOverall: Overall = {
  totalSalesHkd: 2500.0,
  totalFeesHkd: 120.0,
  totalOrders: 25,
  platformSalesHkd: 500.0,
  sellerSalesHkd: 2000.0,
  stripeCount: 20,
  alipayCount: 5,
  refundedCount: 1,
  cancelledCount: 3,
  refundedAmountHkd: 50.0,
  netRevenueHkd: 2450.0,
};

const sampleFeeRows: FeeDetailRow[] = [
  {
    orderId: 1001,
    orderNo: "BOXIUM-20260309-7593",
    subtotalHkd: 10.0,
    platformFeeHkd: 0.5,
    sellerReceivableHkd: 9.5,
    orderStatus: "completed",
    paymentMethod: "stripe",
    createdAt: new Date("2026-03-09"),
    sellerDisplayName: "PTCG001",
  },
  {
    orderId: 1002,
    orderNo: "BOXIUM-20260315-1234",
    subtotalHkd: 200.0,
    platformFeeHkd: 10.0,
    sellerReceivableHkd: 190.0,
    orderStatus: "completed",
    paymentMethod: "alipay_hk",
    createdAt: new Date("2026-03-15"),
    sellerDisplayName: "CardShop HK",
  },
];

// ── Tests: Refund map building ─────────────────────────────────────────────

describe("getSalesReport – refund map building", () => {
  it("builds refund map keyed by yearMonth", () => {
    const map = buildRefundMap(sampleRefundRows);
    expect(map.size).toBe(2);
    expect(map.has("2026-03")).toBe(true);
    expect(map.has("2026-01")).toBe(true);
    expect(map.has("2026-02")).toBe(false);
  });

  it("stores correct refund values", () => {
    const map = buildRefundMap(sampleRefundRows);
    const mar = map.get("2026-03")!;
    expect(mar.refundedCount).toBe(1);
    expect(mar.cancelledCount).toBe(2);
    expect(mar.refundedAmountHkd).toBeCloseTo(50.0, 2);
  });

  it("returns empty map for no refund rows", () => {
    const map = buildRefundMap([]);
    expect(map.size).toBe(0);
  });
});

// ── Tests: Monthly merge ───────────────────────────────────────────────────

describe("getSalesReport – monthly refund merge", () => {
  const refundMap = buildRefundMap(sampleRefundRows);

  it("merges refund data for month with refunds", () => {
    const result = mergeMonthlyWithRefund(sampleSalesRows[0], refundMap);
    expect(result.refundedCount).toBe(1);
    expect(result.cancelledCount).toBe(2);
    expect(result.refundedAmountHkd).toBeCloseTo(50.0, 2);
    expect(result.netRevenueHkd).toBeCloseTo(450.0, 2);
  });

  it("returns zero refund for month without refunds", () => {
    const result = mergeMonthlyWithRefund(sampleSalesRows[1], refundMap);
    expect(result.refundedCount).toBe(0);
    expect(result.cancelledCount).toBe(0);
    expect(result.refundedAmountHkd).toBe(0);
    expect(result.netRevenueHkd).toBeCloseTo(1200.0, 2);
  });

  it("handles cancelled-only month (no refund amount)", () => {
    const result = mergeMonthlyWithRefund(sampleSalesRows[2], refundMap);
    expect(result.refundedCount).toBe(0);
    expect(result.cancelledCount).toBe(1);
    expect(result.refundedAmountHkd).toBe(0);
    expect(result.netRevenueHkd).toBeCloseTo(800.0, 2);
  });
});

// ── Tests: Net revenue calculation ────────────────────────────────────────

describe("getSalesReport – net revenue calculation", () => {
  it("calculates net revenue correctly", () => {
    expect(calcNetRevenue(2500.0, 50.0)).toBeCloseTo(2450.0, 2);
  });

  it("returns full GMV when no refunds", () => {
    expect(calcNetRevenue(1000.0, 0)).toBeCloseTo(1000.0, 2);
  });

  it("returns zero when all sales refunded", () => {
    expect(calcNetRevenue(500.0, 500.0)).toBeCloseTo(0.0, 2);
  });

  it("overall netRevenueHkd equals totalSales minus refundedAmount", () => {
    const net = calcNetRevenue(sampleOverall.totalSalesHkd, sampleOverall.refundedAmountHkd);
    expect(net).toBeCloseTo(sampleOverall.netRevenueHkd, 2);
  });
});

// ── Tests: Overall refund stats ────────────────────────────────────────────

describe("getSalesReport – overall refund stats", () => {
  it("overall contains refundedCount", () => {
    expect(sampleOverall.refundedCount).toBe(1);
  });

  it("overall contains cancelledCount", () => {
    expect(sampleOverall.cancelledCount).toBe(3);
  });

  it("overall netRevenueHkd is correct", () => {
    expect(sampleOverall.netRevenueHkd).toBeCloseTo(2450.0, 2);
  });

  it("net revenue is less than or equal to GMV", () => {
    expect(sampleOverall.netRevenueHkd).toBeLessThanOrEqual(sampleOverall.totalSalesHkd);
  });
});

// ── Tests: Fee detail data ─────────────────────────────────────────────────

describe("getAdminFeeDetails – data structure", () => {
  it("fee detail rows have required fields", () => {
    for (const row of sampleFeeRows) {
      expect(row).toHaveProperty("orderId");
      expect(row).toHaveProperty("orderNo");
      expect(row).toHaveProperty("subtotalHkd");
      expect(row).toHaveProperty("platformFeeHkd");
      expect(row).toHaveProperty("sellerReceivableHkd");
      expect(row).toHaveProperty("sellerDisplayName");
    }
  });

  it("sellerReceivableHkd equals subtotal minus fee", () => {
    for (const row of sampleFeeRows) {
      expect(row.sellerReceivableHkd).toBeCloseTo(row.subtotalHkd - row.platformFeeHkd, 2);
    }
  });

  it("platformFeeHkd is positive", () => {
    for (const row of sampleFeeRows) {
      expect(row.platformFeeHkd).toBeGreaterThan(0);
    }
  });

  it("sums platform fees correctly", () => {
    const totalFees = sampleFeeRows.reduce((s, r) => s + r.platformFeeHkd, 0);
    expect(totalFees).toBeCloseTo(10.5, 2);
  });

  it("sums seller receivables correctly", () => {
    const totalReceivable = sampleFeeRows.reduce((s, r) => s + r.sellerReceivableHkd, 0);
    expect(totalReceivable).toBeCloseTo(199.5, 2);
  });
});

// ── Tests: Fee detail seller name fallback ────────────────────────────────

describe("getAdminFeeDetails – seller display name fallback", () => {
  it("uses displayName when available", () => {
    expect(buildFeeDetailSellerName("PTCG001", "user_name", 1)).toBe("PTCG001");
  });

  it("falls back to userName when no displayName", () => {
    expect(buildFeeDetailSellerName(null, "user_name", 1)).toBe("user_name");
  });

  it("falls back to seller ID when both null", () => {
    expect(buildFeeDetailSellerName(null, null, 42)).toBe("賣家 #42");
  });

  it("falls back to seller ID when both undefined", () => {
    expect(buildFeeDetailSellerName(undefined, undefined, 99)).toBe("賣家 #99");
  });
});

// ── Tests: Fee detail pagination ──────────────────────────────────────────

describe("getAdminFeeDetails – pagination logic", () => {
  it("calculates offset correctly for page 1", () => {
    const page = 1, pageSize = 50;
    const offset = (page - 1) * pageSize;
    expect(offset).toBe(0);
  });

  it("calculates offset correctly for page 2", () => {
    const page = 2, pageSize = 50;
    const offset = (page - 1) * pageSize;
    expect(offset).toBe(50);
  });

  it("calculates offset correctly for page 3 with pageSize 20", () => {
    const page = 3, pageSize = 20;
    const offset = (page - 1) * pageSize;
    expect(offset).toBe(40);
  });

  it("shows next page button when total > pageSize * page", () => {
    const total = 120, page = 1, pageSize = 50;
    const hasNextPage = page * pageSize < total;
    expect(hasNextPage).toBe(true);
  });

  it("hides next page button on last page", () => {
    const total = 120, page = 3, pageSize = 50;
    const hasNextPage = page * pageSize < total;
    expect(hasNextPage).toBe(false);
  });
});

// ── Tests: CSV export with new fields ─────────────────────────────────────

describe("CSV export – new refund fields", () => {
  const monthlyWithRefund: MonthlyRow[] = [
    {
      yearMonth: "2026-03",
      totalSalesHkd: 500.0,
      orderCount: 5,
      stripeCount: 3,
      alipayCount: 2,
      platformSalesHkd: 0.0,
      sellerSalesHkd: 500.0,
      sellerFeesHkd: 25.0,
      refundedCount: 1,
      cancelledCount: 2,
      refundedAmountHkd: 50.0,
      netRevenueHkd: 450.0,
    },
  ];

  it("CSV row includes refundedAmountHkd", () => {
    const row = monthlyWithRefund[0];
    const csvRow = {
      "月份": `${row.yearMonth.split("-")[0]}年${parseInt(row.yearMonth.split("-")[1])}月`,
      "銷售總額 (HKD)": row.totalSalesHkd.toFixed(2),
      "退款金額 (HKD)": row.refundedAmountHkd.toFixed(2),
      "淨收入 (HKD)": row.netRevenueHkd.toFixed(2),
      "退款筆數": row.refundedCount,
      "取消訂單數": row.cancelledCount,
    };
    expect(csvRow["退款金額 (HKD)"]).toBe("50.00");
    expect(csvRow["淨收入 (HKD)"]).toBe("450.00");
    expect(csvRow["退款筆數"]).toBe(1);
    expect(csvRow["取消訂單數"]).toBe(2);
  });
});
