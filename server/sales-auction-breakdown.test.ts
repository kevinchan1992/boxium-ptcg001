import { describe, it, expect } from "vitest";

/**
 * Test suite for Sales Report Auction Breakdown
 * Verifies that getSalesReport includes auction vs direct order breakdown fields
 */

describe("Sales Report Auction Breakdown", () => {
  it("getSalesReport should include auction breakdown fields in monthly data", async () => {
    // Import the function
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);

    // Verify monthly data structure includes auction fields
    if (report.monthly.length > 0) {
      const firstMonth = report.monthly[0];
      expect(firstMonth).toHaveProperty("auctionSalesHkd");
      expect(firstMonth).toHaveProperty("auctionCount");
      expect(firstMonth).toHaveProperty("auctionPlatformSalesHkd");
      expect(firstMonth).toHaveProperty("auctionSellerFeesHkd");
      expect(firstMonth).toHaveProperty("directSalesHkd");
      expect(firstMonth).toHaveProperty("directCount");

      // Verify types are numbers
      expect(typeof firstMonth.auctionSalesHkd).toBe("number");
      expect(typeof firstMonth.auctionCount).toBe("number");
      expect(typeof firstMonth.directSalesHkd).toBe("number");
      expect(typeof firstMonth.directCount).toBe("number");

      // Verify non-negative
      expect(firstMonth.auctionSalesHkd).toBeGreaterThanOrEqual(0);
      expect(firstMonth.auctionCount).toBeGreaterThanOrEqual(0);
      expect(firstMonth.directSalesHkd).toBeGreaterThanOrEqual(0);
      expect(firstMonth.directCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("getSalesReport should include auction breakdown fields in overall data", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);
    const overall = report.overall;

    // Verify overall data includes auction breakdown
    expect(overall).toHaveProperty("auctionSalesHkd");
    expect(overall).toHaveProperty("auctionCount");
    expect(overall).toHaveProperty("auctionPlatformSalesHkd");
    expect(overall).toHaveProperty("auctionSellerSalesHkd");
    expect(overall).toHaveProperty("auctionSellerFeesHkd");
    expect(overall).toHaveProperty("directSalesHkd");
    expect(overall).toHaveProperty("directCount");
    expect(overall).toHaveProperty("directPlatformSalesHkd");
    expect(overall).toHaveProperty("directSellerFeesHkd");

    // Verify types
    expect(typeof overall.auctionSalesHkd).toBe("number");
    expect(typeof overall.auctionCount).toBe("number");
    expect(typeof overall.directSalesHkd).toBe("number");
    expect(typeof overall.directCount).toBe("number");

    // Verify non-negative
    expect(overall.auctionSalesHkd).toBeGreaterThanOrEqual(0);
    expect(overall.directSalesHkd).toBeGreaterThanOrEqual(0);
  });

  it("auction + direct sales should equal total sales", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);
    const overall = report.overall;

    // Auction sales + Direct sales should approximately equal total sales
    const summedSales = overall.auctionSalesHkd + overall.directSalesHkd;
    expect(Math.abs(summedSales - overall.totalSalesHkd)).toBeLessThan(0.01);
  });

  it("auction + direct count should equal total orders", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);
    const overall = report.overall;

    // Auction count + Direct count should equal total orders
    expect(overall.auctionCount + overall.directCount).toBe(overall.totalOrders);
  });

  it("monthly auction + direct should sum correctly per month", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);

    for (const month of report.monthly) {
      // Sales breakdown should sum to total
      const summedSales = month.auctionSalesHkd + month.directSalesHkd;
      expect(Math.abs(summedSales - month.totalSalesHkd)).toBeLessThan(0.01);

      // Count breakdown should sum to total
      expect(month.auctionCount + month.directCount).toBe(month.orderCount);
    }
  });
});
