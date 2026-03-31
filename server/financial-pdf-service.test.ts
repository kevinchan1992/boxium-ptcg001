/**
 * Tests for the server-side financial PDF generation service
 * Verifies that the PDF generation logic is correct without actually launching a browser
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the playwrightPool to avoid browser launch in tests
vi.mock("./services/playwrightPool", () => ({
  playwrightPool: {
    getBrowser: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        setContent: vi.fn().mockResolvedValue(undefined),
        waitForTimeout: vi.fn().mockResolvedValue(undefined),
        pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 mock pdf content")),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

// Mock fs to avoid reading actual files
vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-logo-data")),
  },
}));

describe("Financial PDF Service", () => {
  const mockReport = {
    monthly: [
      {
        yearMonth: "2026-03",
        totalSalesHkd: 50000,
        orderCount: 25,
        stripeCount: 20,
        alipayCount: 5,
        platformSalesHkd: 30000,
        sellerSalesHkd: 20000,
        sellerFeesHkd: 2000,
        platformIncomeHkd: 32000,
        refundedCount: 1,
        cancelledCount: 2,
        refundedAmountHkd: 500,
        netRevenueHkd: 49500,
      },
      {
        yearMonth: "2026-02",
        totalSalesHkd: 40000,
        orderCount: 20,
        stripeCount: 15,
        alipayCount: 5,
        platformSalesHkd: 25000,
        sellerSalesHkd: 15000,
        sellerFeesHkd: 1500,
        platformIncomeHkd: 26500,
        refundedCount: 0,
        cancelledCount: 1,
        refundedAmountHkd: 0,
        netRevenueHkd: 40000,
      },
    ],
    overall: {
      totalSalesHkd: 90000,
      totalFeesHkd: 3500,
      totalOrders: 45,
      platformSalesHkd: 55000,
      sellerSalesHkd: 35000,
      sellerReceivableTotalHkd: 33000,
      stripeCount: 35,
      alipayCount: 10,
      stripeSalesHkd: 70000,
      alipaySalesHkd: 20000,
      stripePlatformSalesHkd: 42000,
      alipayPlatformSalesHkd: 13000,
      stripeSellerFeesHkd: 2500,
      alipaySellerFeesHkd: 1000,
      refundedCount: 1,
      cancelledCount: 3,
      refundedAmountHkd: 500,
      netRevenueHkd: 89500,
      platformIncomeHkd: 58500,
      paidOutHkd: 30000,
      pendingPayoutHkd: 3000,
      pendingPayoutCount: 2,
      paidOutCount: 15,
      platformNetProfitHkd: 55500,
    },
  };

  it("should generate a PDF buffer", async () => {
    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    const result = await generateFinancialReportPdf(mockReport, 12);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it("should call page.setContent with HTML containing Chinese characters", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    expect(mockPage.setContent).toHaveBeenCalledTimes(1);
    const htmlContent = mockPage.setContent.mock.calls[0][0] as string;

    // Verify Chinese characters are present in the HTML
    expect(htmlContent).toContain("財務報告");
    expect(htmlContent).toContain("平台淨利潤");
    expect(htmlContent).toContain("損益表");
    expect(htmlContent).toContain("月度明細");
  });

  it("should include Noto Sans TC font for Chinese character support", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    const htmlContent = mockPage.setContent.mock.calls[0][0] as string;
    // Verify Google Fonts Noto Sans TC is included for Chinese support
    expect(htmlContent).toContain("Noto+Sans+TC");
    expect(htmlContent).toContain("Noto Sans TC");
  });

  it("should include BOXIUM branding in HTML", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    const htmlContent = mockPage.setContent.mock.calls[0][0] as string;
    // Verify BOXIUM branding
    expect(htmlContent).toContain("BOXIUM PTCG");
    // Verify logo is embedded as base64
    expect(htmlContent).toContain("data:image/png;base64,");
  });

  it("should format currency values correctly", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    const htmlContent = mockPage.setContent.mock.calls[0][0] as string;
    // Verify HKD currency format
    expect(htmlContent).toContain("HKD");
  });

  it("should include all monthly data rows", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    const htmlContent = mockPage.setContent.mock.calls[0][0] as string;
    // Both months should appear
    expect(htmlContent).toContain("2026年3月");
    expect(htmlContent).toContain("2026年2月");
  });

  it("should use A4 format for PDF generation", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: "A4", printBackground: true })
    );
  });

  it("should close the page after PDF generation", async () => {
    const { playwrightPool } = await import("./services/playwrightPool");
    const mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 test")),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (playwrightPool.getBrowser as any).mockResolvedValue({
      newPage: vi.fn().mockResolvedValue(mockPage),
    });

    const { generateFinancialReportPdf } = await import("./services/financialPdfService");
    await generateFinancialReportPdf(mockReport, 12);

    expect(mockPage.close).toHaveBeenCalledTimes(1);
  });
});
