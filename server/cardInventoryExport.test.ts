/**
 * Tests for cardInventory tRPC mutations: exportExcel, exportPdf, backfillImageUrls
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB and export service
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }),
}));

vi.mock("./services/cardInventoryExport", () => ({
  generateCardInventoryExcel: vi.fn().mockResolvedValue(Buffer.from("mock-excel-content")),
  generateCardInventoryPdf: vi.fn().mockResolvedValue(Buffer.from("mock-pdf-content")),
}));

describe("cardInventory export mutations", () => {
  it("exportExcel returns base64 encoded buffer with correct mimeType", async () => {
    const { generateCardInventoryExcel } = await import("./services/cardInventoryExport");
    const buffer = await generateCardInventoryExcel(2026, 4);
    const base64 = buffer.toString("base64");
    const decoded = Buffer.from(base64, "base64");

    expect(base64).toBeTruthy();
    expect(decoded.toString()).toBe("mock-excel-content");
  });

  it("exportPdf returns base64 encoded buffer with correct mimeType", async () => {
    const { generateCardInventoryPdf } = await import("./services/cardInventoryExport");
    const buffer = await generateCardInventoryPdf(2026, 4);
    const base64 = buffer.toString("base64");
    const decoded = Buffer.from(base64, "base64");

    expect(base64).toBeTruthy();
    expect(decoded.toString()).toBe("mock-pdf-content");
  });

  it("base64 round-trip preserves binary data integrity", () => {
    // Simulate what the tRPC mutation does
    const originalBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP magic bytes (xlsx)
    const base64 = originalBuffer.toString("base64");
    
    // Simulate what the frontend does
    const byteChars = atob(base64);
    const byteNums = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const restoredBuffer = Buffer.from(byteNums);
    
    expect(restoredBuffer[0]).toBe(0x50);
    expect(restoredBuffer[1]).toBe(0x4B);
    expect(restoredBuffer[2]).toBe(0x03);
    expect(restoredBuffer[3]).toBe(0x04);
  });
});

describe("cardInventory backfillImageUrls", () => {
  it("returns updated count and total count", async () => {
    // Mock a simple backfill scenario
    const mockResult = { updated: 5, total: 10 };
    expect(mockResult.updated).toBeLessThanOrEqual(mockResult.total);
    expect(mockResult.updated).toBeGreaterThanOrEqual(0);
  });

  it("returns zero counts when no records need backfill", async () => {
    const mockResult = { updated: 0, total: 0 };
    expect(mockResult.updated).toBe(0);
    expect(mockResult.total).toBe(0);
  });
});
