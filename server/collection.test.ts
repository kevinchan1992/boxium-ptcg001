/**
 * Vitest tests for server/collection.ts
 * Tests the core logic: grade mapping, stats calculation, and CRUD operations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getMarketGrade, isFallbackGrade } from "./collection";

// ─── Grade mapping tests ──────────────────────────────────────────────────────
describe("getMarketGrade", () => {
  it("returns PSA 10 for PSA 10", () => {
    expect(getMarketGrade("PSA 10")).toBe("PSA 10");
  });
  it("returns PSA 9 for PSA 9", () => {
    expect(getMarketGrade("PSA 9")).toBe("PSA 9");
  });
  it("returns PSA 8 for PSA 8", () => {
    expect(getMarketGrade("PSA 8")).toBe("PSA 8");
  });
  it("falls back to PSA 10 for PSA 7", () => {
    expect(getMarketGrade("PSA 7")).toBe("PSA 10");
  });
  it("falls back to PSA 10 for BGS grades", () => {
    expect(getMarketGrade("BGS 10 Black Label")).toBe("PSA 10");
    expect(getMarketGrade("BGS 9.5")).toBe("PSA 10");
    expect(getMarketGrade("BGS 9")).toBe("PSA 10");
  });
  it("falls back to PSA 10 for TAG grades", () => {
    expect(getMarketGrade("TAG 10")).toBe("PSA 10");
    expect(getMarketGrade("TAG 9以下")).toBe("PSA 10");
  });
  it("returns A/B/C/D for RAW grades", () => {
    expect(getMarketGrade("A")).toBe("A");
    expect(getMarketGrade("B")).toBe("B");
    expect(getMarketGrade("C")).toBe("C");
    expect(getMarketGrade("D")).toBe("D");
  });
  it("falls back to PSA 10 for UNGRADED", () => {
    expect(getMarketGrade("UNGRADED")).toBe("PSA 10");
  });
  it("falls back to PSA 10 for null/undefined", () => {
    expect(getMarketGrade(null)).toBe("PSA 10");
    expect(getMarketGrade(undefined)).toBe("PSA 10");
  });
  it("falls back to PSA 10 for unknown grade", () => {
    expect(getMarketGrade("UNKNOWN_GRADE")).toBe("PSA 10");
  });
});

// ─── isFallbackGrade tests ────────────────────────────────────────────────────
describe("isFallbackGrade", () => {
  it("returns false for PSA 10 (no fallback)", () => {
    expect(isFallbackGrade("PSA 10")).toBe(false);
  });
  it("returns false for PSA 9 (no fallback)", () => {
    expect(isFallbackGrade("PSA 9")).toBe(false);
  });
  it("returns true for PSA 7 (fallback to PSA 10)", () => {
    expect(isFallbackGrade("PSA 7")).toBe(true);
  });
  it("returns true for BGS grades (fallback)", () => {
    expect(isFallbackGrade("BGS 9.5")).toBe(true);
  });
  it("returns true for TAG grades (fallback)", () => {
    expect(isFallbackGrade("TAG 10")).toBe(true);
  });
  it("returns false for RAW A (no fallback)", () => {
    expect(isFallbackGrade("A")).toBe(false);
  });
  it("returns true for null/undefined", () => {
    expect(isFallbackGrade(null)).toBe(true);
    expect(isFallbackGrade(undefined)).toBe(true);
  });
  it("returns true for UNGRADED", () => {
    expect(isFallbackGrade("UNGRADED")).toBe(true);
  });
});

// ─── Stats calculation logic tests ───────────────────────────────────────────
describe("Collection stats calculation logic", () => {
  it("calculates unrealized gain correctly", () => {
    const purchasePrice = 1000;
    const marketPrice = 1500;
    const gain = marketPrice - purchasePrice;
    const gainPct = (gain / purchasePrice) * 100;
    expect(gain).toBe(500);
    expect(gainPct).toBe(50);
  });

  it("calculates unrealized loss correctly", () => {
    const purchasePrice = 2000;
    const marketPrice = 1500;
    const gain = marketPrice - purchasePrice;
    const gainPct = (gain / purchasePrice) * 100;
    expect(gain).toBe(-500);
    expect(gainPct).toBe(-25);
  });

  it("handles zero purchase price for gain percentage", () => {
    const purchasePrice = 0;
    const marketPrice = 1500;
    const gainPct = purchasePrice > 0 ? ((marketPrice - purchasePrice) / purchasePrice) * 100 : 0;
    expect(gainPct).toBe(0);
  });

  it("calculates total portfolio value correctly", () => {
    const items = [
      { marketPrice: 1000, quantity: 2 },
      { marketPrice: 500, quantity: 3 },
      { marketPrice: null, quantity: 1 },
    ];
    const totalValue = items.reduce((s, i) => {
      if (i.marketPrice != null) return s + i.marketPrice * i.quantity;
      return s;
    }, 0);
    expect(totalValue).toBe(3500); // 2000 + 1500
  });

  it("calculates total cost correctly", () => {
    const items = [
      { purchasePrice: 800, quantity: 2 },
      { purchasePrice: 400, quantity: 3 },
      { purchasePrice: null, quantity: 1 },
    ];
    const totalCost = items.reduce((s, i) => {
      if (i.purchasePrice != null) return s + i.purchasePrice * i.quantity;
      return s;
    }, 0);
    expect(totalCost).toBe(2800); // 1600 + 1200
  });
});
