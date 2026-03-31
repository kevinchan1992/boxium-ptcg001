/**
 * Quick test: generate a sample BOXIUM financial PDF with mock data
 * Run: cd /home/ubuntu/boxium-ptcg && npx tsx server/testPdfGen.ts
 */
import { writeFileSync } from "fs";
import { generateFinancialReportPdf } from "./services/financialPdfService";

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

async function main() {
  console.log("Generating BOXIUM financial PDF...");
  const buf = await generateFinancialReportPdf(mockReport, 1);
  const outPath = "/tmp/BOXIUM_財務報告_test.pdf";
  writeFileSync(outPath, buf);
  console.log(`✅ PDF generated: ${outPath} (${buf.length} bytes)`);
}

main().catch(console.error);
