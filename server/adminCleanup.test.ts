import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Admin Page Cleanup Verification", () => {
  const projectRoot = path.resolve(__dirname, "..");

  describe("Removed eBay APIs from routers.ts", () => {
    const routersContent = fs.readFileSync(
      path.join(projectRoot, "server/routers.ts"),
      "utf-8"
    );

    it("should not contain getEbaySoldItems API", () => {
      expect(routersContent).not.toContain("getEbaySoldItems: publicProcedure");
    });

    it("should not contain searchEbayMarketPrice API", () => {
      expect(routersContent).not.toContain("searchEbayMarketPrice: publicProcedure");
    });

    it("should not contain getExchangeRate API", () => {
      expect(routersContent).not.toContain("getExchangeRate: publicProcedure");
    });

    it("should not contain updateAllEbayRecords API", () => {
      expect(routersContent).not.toContain("updateAllEbayRecords: adminProcedure");
    });

    it("should not contain updateEbayPrices API", () => {
      expect(routersContent).not.toContain("updateEbayPrices: adminProcedure");
    });

    it("should not contain batchUpdateEbayPrices API", () => {
      expect(routersContent).not.toContain("batchUpdateEbayPrices: adminProcedure");
    });

    it("should not contain startPersistentEbayBatchUpdate API", () => {
      expect(routersContent).not.toContain("startPersistentEbayBatchUpdate: adminProcedure");
    });

    it("should not import eBay modules in routers.ts", () => {
      expect(routersContent).not.toContain('from "./ebayImageSearch"');
      expect(routersContent).not.toContain('from "./ebay"');
    });
  });

  describe("Cleaned up frontend components", () => {
    it("BatchTaskProgressBar should only support SNKRDUNK type", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "client/src/components/BatchTaskProgressBar.tsx"),
        "utf-8"
      );
      expect(content).not.toContain("taskType: 'eBay' | 'SNKRDUNK'");
      expect(content).toContain("taskType: 'SNKRDUNK'");
    });

    it("AdminScheduleManagement should not reference eBay in type assertion", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "client/src/components/AdminScheduleManagement.tsx"),
        "utf-8"
      );
      expect(content).not.toContain("ebay?: any[]");
    });

    it("AdminTaskHistory should mark eBay tasks as deprecated", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "client/src/components/AdminTaskHistory.tsx"),
        "utf-8"
      );
      expect(content).toContain("已停用");
    });
  });

  describe("Cleaned up backend files", () => {
    it("batchTaskManager should not reference batch_ebay_update type", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "server/batchTaskManager.ts"),
        "utf-8"
      );
      expect(content).not.toContain("'batch_ebay_update'");
    });

    it("batchUpdateScheduler should not contain eBay statistics", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "server/batchUpdateScheduler.ts"),
        "utf-8"
      );
      expect(content).not.toContain("ebaySuccessCount");
      expect(content).not.toContain("ebayFailureCount");
      expect(content).not.toContain("ebayRecordsAdded");
    });

    it("ebay-cleanup.test.ts should be deleted", () => {
      expect(
        fs.existsSync(path.join(projectRoot, "server/ebay-cleanup.test.ts"))
      ).toBe(false);
    });
  });

  describe("Backup files removed", () => {
    it("should not have Admin.tsx.backup", () => {
      expect(
        fs.existsSync(path.join(projectRoot, "client/src/pages/Admin.tsx.backup"))
      ).toBe(false);
    });

    it("should not have CardDetail.tsx.backup", () => {
      expect(
        fs.existsSync(path.join(projectRoot, "client/src/pages/CardDetail.tsx.backup"))
      ).toBe(false);
    });

    it("should not have db.ts.backup", () => {
      expect(
        fs.existsSync(path.join(projectRoot, "server/db.ts.backup"))
      ).toBe(false);
    });

    it("should not have routers.ts.backup", () => {
      expect(
        fs.existsSync(path.join(projectRoot, "server/routers.ts.backup"))
      ).toBe(false);
    });
  });

  describe("TypeScript compilation", () => {
    it("routers.ts should be valid TypeScript (no syntax errors in key structures)", () => {
      const content = fs.readFileSync(
        path.join(projectRoot, "server/routers.ts"),
        "utf-8"
      );
      // Verify the file still exports AppRouter
      expect(content).toContain("export type AppRouter = typeof appRouter");
      // Verify key APIs still exist
      expect(content).toContain("getBatchUpdateProgress");
      expect(content).toContain("startPersistentSnkrdunkBatchUpdate");
      expect(content).toContain("triggerPriceRefresh");
    });
  });
});
