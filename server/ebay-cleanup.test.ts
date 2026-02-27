/**
 * eBay Cleanup Verification Tests
 * 
 * Verifies that eBay batch update features have been properly disabled
 * while pricing page eBay functionality remains intact.
 * 
 * Also verifies that old batch update modules have been cleaned up
 * and the system uses the unified persistent batch update architecture.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const serverDir = path.join(__dirname);
const projectRoot = path.join(__dirname, "..");

describe("eBay Cleanup - Deleted Files", () => {
  const deletedFiles = [
    "server/ebayService.ts",
    "server/persistentEbayBatchUpdate.ts",
    "server/batchUpdateProgress.ts",
    "server/ebay.test.ts",
    "server/test-ebay-gardevoir.ts",
    "server/test-ebay-image-search.ts",
  ];

  for (const file of deletedFiles) {
    it(`should have deleted ${file}`, () => {
      const filePath = path.join(projectRoot, file);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  }
});

describe("Old Batch Update Modules - Cleaned Up", () => {
  const deletedModules = [
    "server/batchUpdateSnkrdunkProgress.ts",  // Old in-memory progress tracking
    "server/batchUpdateExecutor.ts",           // Old non-persistent batch executor
  ];

  for (const file of deletedModules) {
    it(`should have deleted old module ${file}`, () => {
      const filePath = path.join(projectRoot, file);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  }

  it("routers.ts should not import from deleted modules", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "routers.ts"),
      "utf-8"
    );
    expect(content).not.toMatch(/from\s+["']\.\/batchUpdateSnkrdunkProgress["']/);
    expect(content).not.toMatch(/from\s+["']\.\/batchUpdateExecutor["']/);
    expect(content).not.toMatch(/from\s+["']\.\/batchUpdateProgress["']/);
  });

  it("persistentSnkrdunkBatchUpdate.ts should not import from old modules", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "persistentSnkrdunkBatchUpdate.ts"),
      "utf-8"
    );
    expect(content).not.toContain("batchUpdateSnkrdunkProgress");
    expect(content).not.toContain("batchUpdateExecutor");
  });

  it("persistentSnkrdunkBatchUpdate.ts should use batchTaskManager as sole progress source", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "persistentSnkrdunkBatchUpdate.ts"),
      "utf-8"
    );
    expect(content).toContain("batchTaskManager");
    expect(content).toContain("fetchPriceHistory");
  });
});

describe("eBay Cleanup - Preserved Files (Pricing Page)", () => {
  const preservedFiles = [
    "server/ebay.ts",
    "server/ebayImageSearch.ts",
    "server/services/ebay.ts",
    "server/routers/pricing.ts",
  ];

  for (const file of preservedFiles) {
    it(`should have preserved ${file}`, () => {
      const filePath = path.join(projectRoot, file);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});

describe("eBay Cleanup - batchUpdateScheduler.ts", () => {
  it("should not import executeEbayBatchUpdate", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "batchUpdateScheduler.ts"),
      "utf-8"
    );
    expect(content).not.toContain("executeEbayBatchUpdate");
  });

  it("should use persistent batch update", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "batchUpdateScheduler.ts"),
      "utf-8"
    );
    expect(content).toContain("executePersistentSnkrdunkBatchUpdate");
  });
});

describe("eBay Cleanup - routers.ts imports", () => {
  it("should not import from deleted eBay files", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "routers.ts"),
      "utf-8"
    );
    expect(content).not.toMatch(/^import.*from\s+["']\.\/ebayService["']/m);
    expect(content).not.toMatch(/^import.*from\s+["']\.\/persistentEbayBatchUpdate["']/m);
    expect(content).not.toMatch(/^import.*from\s+["']\.\/batchUpdateProgress["']/m);
  });

  it("should still import from preserved eBay files (for pricing)", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "routers.ts"),
      "utf-8"
    );
    expect(content).toContain('from "./ebay"');
  });
});

describe("eBay Cleanup - Frontend Admin UI", () => {
  it("AdminDashboard should not reference eBay health monitoring", () => {
    const content = fs.readFileSync(
      path.join(projectRoot, "client/src/components/AdminDashboard.tsx"),
      "utf-8"
    );
    expect(content).not.toContain("eBay 數據源");
    expect(content).not.toContain("eBay 搜尋統計");
  });

  it("AdminScraperPerformance should not have eBay source option", () => {
    const content = fs.readFileSync(
      path.join(projectRoot, "client/src/components/AdminScraperPerformance.tsx"),
      "utf-8"
    );
    expect(content).not.toContain('<SelectItem value="ebay">');
  });

  it("AdminScheduleManagement should not mention eBay in description", () => {
    const content = fs.readFileSync(
      path.join(projectRoot, "client/src/components/AdminScheduleManagement.tsx"),
      "utf-8"
    );
    expect(content).not.toContain("SNKRDUNK 和 eBay");
  });
});

describe("eBay Cleanup - Pricing Page Preserved", () => {
  it("PricingDetail should still reference eBay source", () => {
    const content = fs.readFileSync(
      path.join(projectRoot, "client/src/pages/PricingDetail.tsx"),
      "utf-8"
    );
    expect(content).toContain("ebay");
  });

  it("pricing router should still use eBay functions", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "routers/pricing.ts"),
      "utf-8"
    );
    expect(content).toContain("fetchEbayListings");
    expect(content).toContain("getEbayListingsCache");
    expect(content).toContain("saveEbayListingsCache");
  });

  it("routers.ts should still have searchEbayMarketPrice procedure", () => {
    const content = fs.readFileSync(
      path.join(serverDir, "routers.ts"),
      "utf-8"
    );
    expect(content).toContain("searchEbayMarketPrice");
    expect(content).toContain("searchEbayItems");
  });
});
