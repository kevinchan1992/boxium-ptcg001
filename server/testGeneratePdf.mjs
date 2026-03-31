/**
 * Quick test script — generates a sample financial PDF with mock data
 * and saves it to /tmp/test-financial-report.pdf
 *
 * Run: node server/testGeneratePdf.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { register } from "node:module";

// Use tsx to handle TypeScript
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const mockReport = {
  monthly: [
    {
      yearMonth: "2026-03",
      totalSalesHkd: 42.00,
      orderCount: 3,
      stripeCount: 2,
      alipayCount: 1,
      platformSalesHkd: 10.00,
      sellerSalesHkd: 32.00,
      sellerFeesHkd: 1.60,
      platformIncomeHkd: 11.60,
      refundedCount: 0,
      cancelledCount: 5,
      refundedAmountHkd: 0.00,
      netRevenueHkd: 42.00,
    },
  ],
  overall: {
    totalSalesHkd: 42.00,
    totalFeesHkd: 1.60,
    totalOrders: 3,
    platformSalesHkd: 10.00,
    sellerSalesHkd: 32.00,
    sellerReceivableTotalHkd: 40.40,
    stripeCount: 2,
    alipayCount: 1,
    stripeSalesHkd: 32.00,
    alipaySalesHkd: 10.00,
    stripePlatformSalesHkd: 0.00,
    alipayPlatformSalesHkd: 10.00,
    stripeSellerFeesHkd: 1.60,
    alipaySellerFeesHkd: 0.00,
    refundedCount: 0,
    cancelledCount: 5,
    refundedAmountHkd: 0.00,
    netRevenueHkd: 42.00,
    platformIncomeHkd: 11.60,
    paidOutHkd: 40.40,
    pendingPayoutHkd: 0.00,
    pendingPayoutCount: 0,
    paidOutCount: 3,
    platformNetProfitHkd: 11.60,
  },
};

// Use tsx to run the TypeScript service
const result = execSync(
  `node --loader tsx/esm server/services/financialPdfService.ts`,
  {
    cwd: projectRoot,
    env: { ...process.env, NODE_PATH: join(projectRoot, "node_modules") },
    timeout: 30000,
  }
);

console.log("Done:", result.toString());
