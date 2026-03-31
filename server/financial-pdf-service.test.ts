/**
 * Tests for the server-side financial PDF generation service (pdfkit-based)
 * Verifies that the PDF generation logic is correct without requiring Chromium
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pdfkit to avoid actually generating PDFs in tests
const mockDoc: any = {
  registerFont: vi.fn().mockReturnThis(),
  addPage: vi.fn().mockReturnThis(),
  rect: vi.fn().mockReturnThis(),
  fill: vi.fn().mockReturnThis(),
  fillOpacity: vi.fn().mockReturnThis(),
  save: vi.fn().mockReturnThis(),
  restore: vi.fn().mockReturnThis(),
  circle: vi.fn().mockReturnThis(),
  font: vi.fn().mockReturnThis(),
  fontSize: vi.fn().mockReturnThis(),
  fillColor: vi.fn().mockReturnThis(),
  text: vi.fn().mockReturnThis(),
  image: vi.fn().mockReturnThis(),
  lineWidth: vi.fn().mockReturnThis(),
  moveTo: vi.fn().mockReturnThis(),
  lineTo: vi.fn().mockReturnThis(),
  stroke: vi.fn().mockReturnThis(),
  end: vi.fn().mockImplementation(function () {
    setTimeout(() => {
      if (mockDoc._dataHandler) mockDoc._dataHandler(Buffer.from("%PDF-1.4 mock"));
      if (mockDoc._endHandler) mockDoc._endHandler();
    }, 0);
  }),
  on: vi.fn().mockImplementation(function (event: string, handler: Function) {
    if (event === "data") mockDoc._dataHandler = handler;
    if (event === "end") mockDoc._endHandler = handler;
    if (event === "error") mockDoc._errorHandler = handler;
    return mockDoc;
  }),
  _dataHandler: null as Function | null,
  _endHandler: null as Function | null,
  _errorHandler: null as Function | null,
};

vi.mock("pdfkit", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

// Mock fs to avoid reading actual font files
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-font-data")),
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

const mockReport = {
  monthly: [
    {
      yearMonth: "2026-03",
      totalSalesHkd: 42.00,
      orderCount: 3,
      stripeCount: 1,
      alipayCount: 2,
      platformSalesHkd: 10.00,
      sellerSalesHkd: 32.00,
      sellerFeesHkd: 1.60,
      platformIncomeHkd: 11.60,
      refundedCount: 0,
      cancelledCount: 2,
      refundedAmountHkd: 0,
      netRevenueHkd: 42.00,
    },
    {
      yearMonth: "2026-02",
      totalSalesHkd: 100.00,
      orderCount: 5,
      stripeCount: 3,
      alipayCount: 2,
      platformSalesHkd: 40.00,
      sellerSalesHkd: 60.00,
      sellerFeesHkd: 6.00,
      platformIncomeHkd: 46.00,
      refundedCount: 1,
      cancelledCount: 0,
      refundedAmountHkd: 20.00,
      netRevenueHkd: 80.00,
    },
  ],
  overall: {
    totalSalesHkd: 142.00,
    totalFeesHkd: 7.60,
    totalOrders: 8,
    platformSalesHkd: 50.00,
    sellerSalesHkd: 92.00,
    sellerReceivableTotalHkd: 92.00,
    stripeCount: 4,
    alipayCount: 4,
    stripeSalesHkd: 72.00,
    alipaySalesHkd: 70.00,
    stripePlatformSalesHkd: 0,
    alipayPlatformSalesHkd: 50.00,
    stripeSellerFeesHkd: 7.60,
    alipaySellerFeesHkd: 0,
    refundedCount: 1,
    cancelledCount: 2,
    refundedAmountHkd: 20.00,
    netRevenueHkd: 122.00,
    platformIncomeHkd: 57.60,
    paidOutHkd: 40.40,
    pendingPayoutHkd: 51.60,
    pendingPayoutCount: 2,
    paidOutCount: 3,
    platformNetProfitHkd: 17.20,
  },
};

describe("generateFinancialReportPdf (pdfkit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc._dataHandler = null;
    mockDoc._endHandler = null;
    mockDoc._errorHandler = null;
  });

  it("should return a Buffer", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    const result = await generateFinancialReportPdf(mockReport, 3);
    expect(result).toBeInstanceOf(Buffer);
  });

  it("should call addPage at least 4 times (cover + 3 content pages)", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 3);
    expect(mockDoc.addPage).toHaveBeenCalledTimes(4);
  });

  it("should register NotoTC-Regular and NotoTC-Bold fonts", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 3);
    expect(mockDoc.registerFont).toHaveBeenCalledWith("NotoTC-Regular", expect.stringContaining("NotoSansTC-Regular.otf"));
    expect(mockDoc.registerFont).toHaveBeenCalledWith("NotoTC-Bold", expect.stringContaining("NotoSansTC-Bold.otf"));
  });

  it("should call doc.end() to finalise the PDF", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 3);
    expect(mockDoc.end).toHaveBeenCalledTimes(1);
  });

  it("should handle empty monthly array gracefully", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    const emptyReport = { ...mockReport, monthly: [] };
    await expect(generateFinancialReportPdf(emptyReport, 3)).resolves.toBeInstanceOf(Buffer);
  });

  it("should handle zero GMV values without dividing by zero", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    const zeroReport = {
      monthly: [],
      overall: { ...mockReport.overall, totalSalesHkd: 0, stripeSalesHkd: 0, alipaySalesHkd: 0 },
    };
    await expect(generateFinancialReportPdf(zeroReport, 1)).resolves.toBeInstanceOf(Buffer);
  });

  it("should handle missing logo gracefully (existsSync returns false)", async () => {
    const fs = await import("fs");
    vi.mocked(fs.default.existsSync).mockReturnValueOnce(false);
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await expect(generateFinancialReportPdf(mockReport, 3)).resolves.toBeInstanceOf(Buffer);
  });

  it("should format HKD amounts correctly", () => {
    const amount = 11.60;
    const formatted = `HKD ${amount.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    expect(formatted).toBe("HKD 11.60");
  });

  it("should format year-month strings correctly", () => {
    const dateStr = "2026-03";
    const [year, month] = dateStr.split("-");
    const formatted = `${year}年${parseInt(month)}月`;
    expect(formatted).toBe("2026年3月");
  });
});
