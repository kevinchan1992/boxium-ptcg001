import { describe, it, expect } from "vitest";
/**
 * Test suite for PSA Grading Upgrade Revenue in Sales Report
 * Verifies that getSalesReport includes upgradeRevenueHkd and upgradeCount fields
 */
describe("Sales Report - PSA Grading Upgrade Revenue", () => {
  it("getSalesReport overall should include upgradeRevenueHkd and upgradeCount fields", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);
    const overall = report.overall;

    // Verify fields exist
    expect(overall).toHaveProperty("upgradeRevenueHkd");
    expect(overall).toHaveProperty("upgradeCount");

    // Verify types
    expect(typeof overall.upgradeRevenueHkd).toBe("number");
    expect(typeof overall.upgradeCount).toBe("number");

    // Verify non-negative
    expect(overall.upgradeRevenueHkd).toBeGreaterThanOrEqual(0);
    expect(overall.upgradeCount).toBeGreaterThanOrEqual(0);

    // Upgrade revenue should be a subset of grading revenue
    expect(overall.upgradeRevenueHkd).toBeLessThanOrEqual(overall.gradingRevenueHkd);
  });

  it("getSalesReport monthly data should include upgradeRevenueHkd and upgradeCount fields", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);

    if (report.monthly.length > 0) {
      const firstMonth = report.monthly[0] as any;

      // Verify fields exist
      expect(firstMonth).toHaveProperty("upgradeRevenueHkd");
      expect(firstMonth).toHaveProperty("upgradeCount");

      // Verify types
      expect(typeof firstMonth.upgradeRevenueHkd).toBe("number");
      expect(typeof firstMonth.upgradeCount).toBe("number");

      // Verify non-negative
      expect(firstMonth.upgradeRevenueHkd).toBeGreaterThanOrEqual(0);
      expect(firstMonth.upgradeCount).toBeGreaterThanOrEqual(0);

      // Upgrade revenue should be a subset of grading revenue
      expect(firstMonth.upgradeRevenueHkd).toBeLessThanOrEqual(firstMonth.gradingRevenueHkd);
    }
  });

  it("getSalesReport overall should include gradingRevenueHkd and gradingCount fields", async () => {
    const { getSalesReport } = await import("./db");
    const report = await getSalesReport(12);
    const overall = report.overall;

    // Verify PSA grading fields exist
    expect(overall).toHaveProperty("gradingRevenueHkd");
    expect(overall).toHaveProperty("gradingCount");

    // Verify types
    expect(typeof overall.gradingRevenueHkd).toBe("number");
    expect(typeof overall.gradingCount).toBe("number");

    // Verify non-negative
    expect(overall.gradingRevenueHkd).toBeGreaterThanOrEqual(0);
    expect(overall.gradingCount).toBeGreaterThanOrEqual(0);
  });
});
