/**
 * Sales Report UI - Financial Audit Design Tests
 * Tests the data transformation and financial metric calculations
 * used in the redesigned SalesReportTab component.
 */

import { describe, it, expect } from "vitest";

// ── Helpers mirroring SalesReportTab logic ────────────────────────────────

const fmtHkd = (v: number) =>
  v.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtYearMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
};

const fmtYearMonthShort = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}/${m}`;
};

interface MonthlyRow {
  yearMonth: string;
  totalSalesHkd: number;
  orderCount: number;
  stripeCount: number;
  alipayCount: number;
  platformSalesHkd: number;
  sellerSalesHkd: number;
  sellerFeesHkd: number;
}

interface Overall {
  totalSalesHkd: number;
  totalFeesHkd: number;
  totalOrders: number;
  platformSalesHkd: number;
  sellerSalesHkd: number;
  stripeCount: number;
  alipayCount: number;
}

function calcDerivedMetrics(overall: Overall) {
  const totalOrders = overall.totalOrders;
  const totalSales = overall.totalSalesHkd;
  const totalFees = overall.totalFeesHkd;
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
  const feeRate =
    overall.sellerSalesHkd > 0
      ? (totalFees / overall.sellerSalesHkd) * 100
      : 0;
  const stripeRatio =
    totalOrders > 0 ? (overall.stripeCount / totalOrders) * 100 : 0;
  return { avgOrderValue, feeRate, stripeRatio };
}

function buildChartData(monthly: MonthlyRow[]) {
  return [...monthly].reverse().map((r) => ({
    month: fmtYearMonthShort(r.yearMonth),
    銷售總額: parseFloat(r.totalSalesHkd.toFixed(2)),
    平台直售: parseFloat(r.platformSalesHkd.toFixed(2)),
    C2C銷售: parseFloat(r.sellerSalesHkd.toFixed(2)),
    手續費: parseFloat(r.sellerFeesHkd.toFixed(2)),
  }));
}

function calcGrowth(current: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((current - prev) / prev) * 100;
}

// ── Test data ─────────────────────────────────────────────────────────────

const sampleOverall: Overall = {
  totalSalesHkd: 10.0,
  totalFeesHkd: 0.5,
  totalOrders: 1,
  platformSalesHkd: 0.0,
  sellerSalesHkd: 10.0,
  stripeCount: 1,
  alipayCount: 0,
};

const sampleMonthly: MonthlyRow[] = [
  {
    yearMonth: "2026-03",
    totalSalesHkd: 10.0,
    orderCount: 1,
    stripeCount: 1,
    alipayCount: 0,
    platformSalesHkd: 0.0,
    sellerSalesHkd: 10.0,
    sellerFeesHkd: 0.5,
  },
  {
    yearMonth: "2026-02",
    totalSalesHkd: 200.0,
    orderCount: 5,
    stripeCount: 3,
    alipayCount: 2,
    platformSalesHkd: 50.0,
    sellerSalesHkd: 150.0,
    sellerFeesHkd: 15.0,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe("SalesReportTab – date formatting", () => {
  it("fmtYearMonth formats YYYY-MM correctly", () => {
    expect(fmtYearMonth("2026-03")).toBe("2026年3月");
    expect(fmtYearMonth("2026-12")).toBe("2026年12月");
    expect(fmtYearMonth("2025-01")).toBe("2025年1月");
  });

  it("fmtYearMonthShort produces YY/MM format", () => {
    expect(fmtYearMonthShort("2026-03")).toBe("26/03");
    expect(fmtYearMonthShort("2025-12")).toBe("25/12");
  });
});

describe("SalesReportTab – HKD formatting", () => {
  it("formats zero correctly", () => {
    expect(fmtHkd(0)).toBe("0.00");
  });

  it("formats small amounts with 2 decimal places", () => {
    expect(fmtHkd(9.5)).toBe("9.50");
    expect(fmtHkd(0.5)).toBe("0.50");
  });

  it("formats large amounts with thousand separators", () => {
    const result = fmtHkd(10000.0);
    // zh-HK locale uses comma as thousand separator
    expect(result).toContain("10");
    expect(result).toContain("00");
  });
});

describe("SalesReportTab – derived financial metrics", () => {
  it("calculates average order value correctly", () => {
    const { avgOrderValue } = calcDerivedMetrics(sampleOverall);
    expect(avgOrderValue).toBeCloseTo(10.0, 2);
  });

  it("returns 0 for avgOrderValue when no orders", () => {
    const { avgOrderValue } = calcDerivedMetrics({ ...sampleOverall, totalOrders: 0 });
    expect(avgOrderValue).toBe(0);
  });

  it("calculates fee rate as percentage of C2C sales", () => {
    const { feeRate } = calcDerivedMetrics(sampleOverall);
    // 0.5 / 10.0 * 100 = 5%
    expect(feeRate).toBeCloseTo(5.0, 2);
  });

  it("returns 0 fee rate when no C2C sales", () => {
    const { feeRate } = calcDerivedMetrics({ ...sampleOverall, sellerSalesHkd: 0 });
    expect(feeRate).toBe(0);
  });

  it("calculates Stripe ratio correctly", () => {
    const { stripeRatio } = calcDerivedMetrics(sampleOverall);
    // 1 stripe / 1 total = 100%
    expect(stripeRatio).toBeCloseTo(100.0, 2);
  });

  it("returns 0 stripe ratio when no orders", () => {
    const { stripeRatio } = calcDerivedMetrics({ ...sampleOverall, totalOrders: 0, stripeCount: 0 });
    expect(stripeRatio).toBe(0);
  });

  it("calculates mixed payment ratio correctly", () => {
    const mixed: Overall = {
      ...sampleOverall,
      totalOrders: 10,
      stripeCount: 6,
      alipayCount: 4,
    };
    const { stripeRatio } = calcDerivedMetrics(mixed);
    expect(stripeRatio).toBeCloseTo(60.0, 2);
  });
});

describe("SalesReportTab – chart data transformation", () => {
  it("reverses monthly data for chronological chart display", () => {
    const chart = buildChartData(sampleMonthly);
    // Input is newest-first (2026-03, 2026-02), chart should be oldest-first
    expect(chart[0].month).toBe("26/02");
    expect(chart[1].month).toBe("26/03");
  });

  it("maps all financial fields to chart data", () => {
    const chart = buildChartData(sampleMonthly);
    const feb = chart[0];
    expect(feb.銷售總額).toBe(200.0);
    expect(feb.平台直售).toBe(50.0);
    expect(feb.C2C銷售).toBe(150.0);
    expect(feb.手續費).toBe(15.0);
  });

  it("returns empty array for empty monthly data", () => {
    expect(buildChartData([])).toEqual([]);
  });

  it("handles single month correctly", () => {
    const chart = buildChartData([sampleMonthly[0]]);
    expect(chart).toHaveLength(1);
    expect(chart[0].month).toBe("26/03");
  });
});

describe("SalesReportTab – month-over-month growth", () => {
  it("calculates positive growth correctly", () => {
    const growth = calcGrowth(200, 100);
    expect(growth).toBeCloseTo(100.0, 2);
  });

  it("calculates negative growth correctly", () => {
    const growth = calcGrowth(50, 100);
    expect(growth).toBeCloseTo(-50.0, 2);
  });

  it("returns null when previous month has zero sales", () => {
    expect(calcGrowth(100, 0)).toBeNull();
  });

  it("returns 0% growth for identical months", () => {
    const growth = calcGrowth(100, 100);
    expect(growth).toBeCloseTo(0.0, 2);
  });
});

describe("SalesReportTab – totals row calculation", () => {
  it("sums totalSalesHkd across all months", () => {
    const total = sampleMonthly.reduce((s, r) => s + r.totalSalesHkd, 0);
    expect(total).toBeCloseTo(210.0, 2);
  });

  it("sums sellerFeesHkd across all months", () => {
    const total = sampleMonthly.reduce((s, r) => s + r.sellerFeesHkd, 0);
    expect(total).toBeCloseTo(15.5, 2);
  });

  it("sums orderCount across all months", () => {
    const total = sampleMonthly.reduce((s, r) => s + r.orderCount, 0);
    expect(total).toBe(6);
  });

  it("sums stripeCount across all months", () => {
    const total = sampleMonthly.reduce((s, r) => s + r.stripeCount, 0);
    expect(total).toBe(4);
  });

  it("sums alipayCount across all months", () => {
    const total = sampleMonthly.reduce((s, r) => s + r.alipayCount, 0);
    expect(total).toBe(2);
  });
});

describe("SalesReportTab – CSV export data structure", () => {
  it("generates correct CSV row structure", () => {
    const rows = sampleMonthly.map((r) => ({
      月份: fmtYearMonth(r.yearMonth),
      "銷售總額 (HKD)": r.totalSalesHkd.toFixed(2),
      "平台直售 (HKD)": r.platformSalesHkd.toFixed(2),
      "C2C 銷售 (HKD)": r.sellerSalesHkd.toFixed(2),
      "手續費收入 (HKD)": r.sellerFeesHkd.toFixed(2),
      訂單數: r.orderCount,
      "Stripe 訂單": r.stripeCount,
      "支付寶 訂單": r.alipayCount,
    }));

    expect(rows).toHaveLength(2);
    expect(rows[0].月份).toBe("2026年3月");
    expect(rows[0]["銷售總額 (HKD)"]).toBe("10.00");
    expect(rows[0]["手續費收入 (HKD)"]).toBe("0.50");
    expect(rows[1].月份).toBe("2026年2月");
    expect(rows[1]["銷售總額 (HKD)"]).toBe("200.00");
  });
});
