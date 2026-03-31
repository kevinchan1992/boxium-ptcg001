import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface MonthlyRow {
  yearMonth: string;
  totalSalesHkd: number;
  platformSalesHkd: number;
  sellerSalesHkd: number;
  sellerFeesHkd: number;
  orderCount: number;
  stripeCount: number;
  alipayCount: number;
  [key: string]: any;
}

interface OverallStats {
  totalOrders: number;
  totalSalesHkd: number;
  totalFeesHkd: number;
  platformSalesHkd: number;
  platformIncomeHkd: number;
  paidOutHkd: number;
  pendingPayoutHkd: number;
  refundedAmountHkd: number;
  platformNetProfitHkd: number;
  netRevenueHkd: number;
  stripeSalesHkd: number;
  alipaySalesHkd: number;
  stripePlatformSalesHkd: number;
  alipayPlatformSalesHkd: number;
  stripeSellerFeesHkd: number;
  alipaySellerFeesHkd: number;
  stripeCount: number;
  alipayCount: number;
  paidOutCount: number;
  pendingPayoutCount: number;
  refundedCount: number;
  cancelledCount: number;
  sellerSalesHkd: number;
  [key: string]: any;
}

const BRAND_DARK = [6, 3, 141] as [number, number, number];    // #06038D
const BRAND_YELLOW = [254, 221, 0] as [number, number, number]; // #FEDD00
const BRAND_LIGHT = [240, 242, 255] as [number, number, number];
const TEXT_DARK = [30, 30, 50] as [number, number, number];
const TEXT_MID = [90, 90, 110] as [number, number, number];
const TEXT_LIGHT = [150, 150, 165] as [number, number, number];
const SUCCESS = [16, 185, 129] as [number, number, number];
const WARNING = [245, 158, 11] as [number, number, number];
const DANGER = [239, 68, 68] as [number, number, number];
const STRIPE_COLOR = [99, 102, 241] as [number, number, number];
const ALIPAY_COLOR = [6, 182, 212] as [number, number, number];

function fmtHkd(v: number): string {
  return v.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m)}月`;
}

function pct(a: number, b: number): string {
  if (!b) return "—";
  return ((a / b) * 100).toFixed(1) + "%";
}

function setFont(doc: jsPDF, size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = TEXT_DARK) {
  doc.setFontSize(size);
  doc.setFont("helvetica", style);
  doc.setTextColor(...color);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fill: [number, number, number], radius = 3) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
}

function drawLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [220, 220, 230], width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y1, x2, y2);
}

function kpiCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, sub: string, bg: [number, number, number], valueColor: [number, number, number]) {
  drawRect(doc, x, y, w, h, bg, 4);
  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text(label, x + 5, y + 9);
  setFont(doc, 13, "bold", valueColor);
  doc.text(value, x + 5, y + 20);
  setFont(doc, 7, "normal", TEXT_LIGHT);
  doc.text(sub, x + 5, y + 27);
}

export async function exportFinancialReportPDF(
  overall: OverallStats,
  monthly: MonthlyRow[],
  months: number,
  logoBase64?: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const MARGIN = 14;
  const CONTENT_W = W - MARGIN * 2;
  const reportDate = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
  const generatedAt = new Date().toLocaleString("zh-HK");

  // ═══════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════

  // Full-bleed header band
  drawRect(doc, 0, 0, W, 72, BRAND_DARK, 0);

  // Yellow accent stripe
  doc.setFillColor(...BRAND_YELLOW);
  doc.rect(0, 68, W, 5, "F");

  // Logo area (yellow box)
  drawRect(doc, MARGIN, 14, 46, 18, BRAND_YELLOW, 3);
  setFont(doc, 16, "bold", BRAND_DARK);
  doc.text("BOXIUM", MARGIN + 5, 26.5);

  // Company info on right
  setFont(doc, 8, "normal", [200, 200, 230]);
  doc.text("BOXIUM PTCG", W - MARGIN, 18, { align: "right" });
  doc.text("www.boxium.asia", W - MARGIN, 24, { align: "right" });
  doc.text("香港卡片交易平台", W - MARGIN, 30, { align: "right" });

  // Report title
  setFont(doc, 22, "bold", [255, 255, 255]);
  doc.text("財務報告", MARGIN, 52);
  setFont(doc, 10, "normal", [180, 185, 230]);
  doc.text("Financial Report", MARGIN, 60);

  // Metadata strip
  let y = 85;
  drawRect(doc, MARGIN, y, CONTENT_W, 28, BRAND_LIGHT, 4);
  setFont(doc, 8, "normal", TEXT_MID);
  doc.text("報告日期", MARGIN + 6, y + 8);
  doc.text("報告期間", MARGIN + 6 + CONTENT_W / 3, y + 8);
  doc.text("生成時間", MARGIN + 6 + (CONTENT_W / 3) * 2, y + 8);
  setFont(doc, 9.5, "bold", TEXT_DARK);
  doc.text(reportDate, MARGIN + 6, y + 17);
  doc.text(`最近 ${months} 個月`, MARGIN + 6 + CONTENT_W / 3, y + 17);
  setFont(doc, 8, "normal", TEXT_DARK);
  doc.text(generatedAt, MARGIN + 6 + (CONTENT_W / 3) * 2, y + 17);

  // ── Section: Executive Summary ──
  y = 125;
  setFont(doc, 11, "bold", BRAND_DARK);
  doc.text("執行摘要  Executive Summary", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);

  y += 8;
  const kpiW = (CONTENT_W - 6) / 4;
  const kpiH = 32;

  kpiCard(doc, MARGIN, y, kpiW, kpiH, "平台淨利潤", `HKD ${fmtHkd(overall.platformNetProfitHkd)}`, `收入 - 退款`, BRAND_LIGHT, BRAND_DARK);
  kpiCard(doc, MARGIN + kpiW + 2, y, kpiW, kpiH, "總交易額 (GMV)", `HKD ${fmtHkd(overall.totalSalesHkd)}`, `${overall.totalOrders} 筆訂單`, [240, 248, 255], [30, 60, 200]);
  kpiCard(doc, MARGIN + (kpiW + 2) * 2, y, kpiW, kpiH, "平台收入合計", `HKD ${fmtHkd(overall.platformIncomeHkd)}`, `直售 + 手續費`, [240, 255, 248], SUCCESS);
  kpiCard(doc, MARGIN + (kpiW + 2) * 3, y, kpiW, kpiH, "待放款金額", `HKD ${fmtHkd(overall.pendingPayoutHkd)}`, `${overall.pendingPayoutCount} 筆待處理`, [255, 251, 235], WARNING);

  y += kpiH + 4;
  kpiCard(doc, MARGIN, y, kpiW, kpiH, "平台直售收入", `HKD ${fmtHkd(overall.platformSalesHkd)}`, `佔平台收入 ${pct(overall.platformSalesHkd, overall.platformIncomeHkd)}`, [245, 245, 255], STRIPE_COLOR);
  kpiCard(doc, MARGIN + kpiW + 2, y, kpiW, kpiH, "C2C 手續費收入", `HKD ${fmtHkd(overall.totalFeesHkd)}`, `佔平台收入 ${pct(overall.totalFeesHkd, overall.platformIncomeHkd)}`, [240, 255, 255], ALIPAY_COLOR);
  kpiCard(doc, MARGIN + (kpiW + 2) * 2, y, kpiW, kpiH, "已完成放款", `HKD ${fmtHkd(overall.paidOutHkd)}`, `${overall.paidOutCount} 筆已放款`, [240, 255, 245], SUCCESS);
  kpiCard(doc, MARGIN + (kpiW + 2) * 3, y, kpiW, kpiH, "退款金額", `HKD ${fmtHkd(overall.refundedAmountHkd)}`, `${overall.refundedCount} 筆退款`, [255, 242, 242], DANGER);

  // ── Section: P&L Table ──
  y += kpiH + 10;
  setFont(doc, 11, "bold", BRAND_DARK);
  doc.text("損益概覽  Profit & Loss", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);

  y += 6;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["項目", "金額 (HKD)", "佔比"]],
    body: [
      ["▶ 收入 (Income)", "", ""],
      ["　平台直售收入", fmtHkd(overall.platformSalesHkd), pct(overall.platformSalesHkd, overall.platformIncomeHkd)],
      ["　C2C 手續費收入", fmtHkd(overall.totalFeesHkd), pct(overall.totalFeesHkd, overall.platformIncomeHkd)],
      ["　平台收入合計", fmtHkd(overall.platformIncomeHkd), "100%"],
      ["▶ 支出 (Outcome)", "", ""],
      ["　退款支出", fmtHkd(overall.refundedAmountHkd), ""],
      ["　已放款給賣家", fmtHkd(overall.paidOutHkd), ""],
      ["　待放款（未結算）", fmtHkd(overall.pendingPayoutHkd), ""],
      ["▶ 淨利潤 (Net Profit)", fmtHkd(overall.platformNetProfitHkd), ""],
    ],
    styles: { fontSize: 8.5, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: BRAND_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 55, halign: "right" },
      2: { cellWidth: 35, halign: "right" },
    },
    willDrawCell: (data) => {
      const row = data.row.raw as string[];
      if (row[0]?.startsWith("▶")) {
        doc.setFillColor(...BRAND_LIGHT);
      }
      if (row[0]?.includes("淨利潤")) {
        doc.setFillColor(6, 3, 141);
        doc.setTextColor(255, 255, 255);
      }
    },
  });

  // Footer page 1
  const p1EndY = (doc as any).lastAutoTable.finalY + 8;
  drawLine(doc, MARGIN, 283, W - MARGIN, 283, [200, 200, 215], 0.3);
  setFont(doc, 7, "normal", TEXT_LIGHT);
  doc.text("BOXIUM PTCG · www.boxium.asia · 本報告由系統自動生成，僅供內部財務核對使用", MARGIN, 288);
  doc.text("第 1 頁 / 3 頁", W - MARGIN, 288, { align: "right" });

  // ═══════════════════════════════════════════════════════
  // PAGE 2 — PAYMENT METHOD BREAKDOWN
  // ═══════════════════════════════════════════════════════
  doc.addPage();

  // Page header band
  drawRect(doc, 0, 0, W, 18, BRAND_DARK, 0);
  doc.setFillColor(...BRAND_YELLOW);
  doc.rect(0, 16, W, 3, "F");
  setFont(doc, 9, "bold", [255, 255, 255]);
  doc.text("BOXIUM PTCG · 財務報告", MARGIN, 11);
  setFont(doc, 8, "normal", [180, 185, 230]);
  doc.text(reportDate, W - MARGIN, 11, { align: "right" });

  y = 28;
  setFont(doc, 13, "bold", BRAND_DARK);
  doc.text("付款方式分析  Payment Method Analysis", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);

  // Stripe block
  y += 10;
  drawRect(doc, MARGIN, y, CONTENT_W, 52, [245, 245, 255], 4);
  doc.setFillColor(...STRIPE_COLOR);
  doc.roundedRect(MARGIN, y, 4, 52, 2, 2, "F");
  setFont(doc, 10, "bold", STRIPE_COLOR);
  doc.text("Stripe 信用卡付款", MARGIN + 9, y + 10);
  setFont(doc, 8, "normal", TEXT_MID);
  doc.text(`共 ${overall.stripeCount} 筆訂單`, MARGIN + 9, y + 17);

  const sCol1 = MARGIN + 9;
  const sCol2 = MARGIN + 60;
  const sCol3 = MARGIN + 115;
  const sRow1 = y + 28;
  const sRow2 = y + 40;

  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text("Stripe 總交易額", sCol1, sRow1 - 6);
  doc.text("平台直售 (Stripe)", sCol2, sRow1 - 6);
  doc.text("C2C 手續費 (Stripe)", sCol3, sRow1 - 6);
  setFont(doc, 11, "bold", TEXT_DARK);
  doc.text(`HKD ${fmtHkd(overall.stripeSalesHkd)}`, sCol1, sRow1);
  doc.text(`HKD ${fmtHkd(overall.stripePlatformSalesHkd)}`, sCol2, sRow1);
  doc.text(`HKD ${fmtHkd(overall.stripeSellerFeesHkd)}`, sCol3, sRow1);

  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text("Stripe 平台收入合計", sCol1, sRow2 - 4);
  setFont(doc, 12, "bold", STRIPE_COLOR);
  doc.text(`HKD ${fmtHkd((overall.stripePlatformSalesHkd ?? 0) + (overall.stripeSellerFeesHkd ?? 0))}`, sCol1, sRow2 + 3);
  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text(`佔總平台收入 ${pct((overall.stripePlatformSalesHkd ?? 0) + (overall.stripeSellerFeesHkd ?? 0), overall.platformIncomeHkd)}`, sCol1, sRow2 + 9);

  // Alipay HK block
  y += 60;
  drawRect(doc, MARGIN, y, CONTENT_W, 52, [240, 255, 255], 4);
  doc.setFillColor(...ALIPAY_COLOR);
  doc.roundedRect(MARGIN, y, 4, 52, 2, 2, "F");
  setFont(doc, 10, "bold", ALIPAY_COLOR);
  doc.text("支付寶 HK 付款", MARGIN + 9, y + 10);
  setFont(doc, 8, "normal", TEXT_MID);
  doc.text(`共 ${overall.alipayCount} 筆訂單`, MARGIN + 9, y + 17);

  const aRow1 = y + 28;
  const aRow2 = y + 40;

  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text("支付寶 HK 總交易額", sCol1, aRow1 - 6);
  doc.text("平台直售 (支付寶)", sCol2, aRow1 - 6);
  doc.text("C2C 手續費 (支付寶)", sCol3, aRow1 - 6);
  setFont(doc, 11, "bold", TEXT_DARK);
  doc.text(`HKD ${fmtHkd(overall.alipaySalesHkd)}`, sCol1, aRow1);
  doc.text(`HKD ${fmtHkd(overall.alipayPlatformSalesHkd ?? 0)}`, sCol2, aRow1);
  doc.text(`HKD ${fmtHkd(overall.alipaySellerFeesHkd ?? 0)}`, sCol3, aRow1);

  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text("支付寶 HK 平台收入合計", sCol1, aRow2 - 4);
  setFont(doc, 12, "bold", ALIPAY_COLOR);
  doc.text(`HKD ${fmtHkd((overall.alipayPlatformSalesHkd ?? 0) + (overall.alipaySellerFeesHkd ?? 0))}`, sCol1, aRow2 + 3);
  setFont(doc, 7.5, "normal", TEXT_MID);
  doc.text(`佔總平台收入 ${pct((overall.alipayPlatformSalesHkd ?? 0) + (overall.alipaySellerFeesHkd ?? 0), overall.platformIncomeHkd)}`, sCol1, aRow2 + 9);

  // Payment comparison table
  y += 62;
  setFont(doc, 11, "bold", BRAND_DARK);
  doc.text("付款方式對比", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["付款方式", "訂單數", "交易總額 (HKD)", "平台直售 (HKD)", "手續費 (HKD)", "平台收入 (HKD)", "佔比"]],
    body: [
      [
        "Stripe",
        String(overall.stripeCount ?? 0),
        fmtHkd(overall.stripeSalesHkd ?? 0),
        fmtHkd(overall.stripePlatformSalesHkd ?? 0),
        fmtHkd(overall.stripeSellerFeesHkd ?? 0),
        fmtHkd((overall.stripePlatformSalesHkd ?? 0) + (overall.stripeSellerFeesHkd ?? 0)),
        pct((overall.stripePlatformSalesHkd ?? 0) + (overall.stripeSellerFeesHkd ?? 0), overall.platformIncomeHkd),
      ],
      [
        "支付寶 HK",
        String(overall.alipayCount ?? 0),
        fmtHkd(overall.alipaySalesHkd ?? 0),
        fmtHkd(overall.alipayPlatformSalesHkd ?? 0),
        fmtHkd(overall.alipaySellerFeesHkd ?? 0),
        fmtHkd((overall.alipayPlatformSalesHkd ?? 0) + (overall.alipaySellerFeesHkd ?? 0)),
        pct((overall.alipayPlatformSalesHkd ?? 0) + (overall.alipaySellerFeesHkd ?? 0), overall.platformIncomeHkd),
      ],
      [
        "合計",
        String(overall.totalOrders ?? 0),
        fmtHkd(overall.totalSalesHkd),
        fmtHkd(overall.platformSalesHkd),
        fmtHkd(overall.totalFeesHkd),
        fmtHkd(overall.platformIncomeHkd),
        "100%",
      ],
    ],
    styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: BRAND_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { textColor: TEXT_DARK },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "right" },
    },
    willDrawCell: (data) => {
      if (data.row.index === 2) {
        doc.setFillColor(...BRAND_LIGHT);
      }
      if (data.row.index === 0 && data.column.index === 0) {
        doc.setTextColor(...STRIPE_COLOR);
      }
      if (data.row.index === 1 && data.column.index === 0) {
        doc.setTextColor(...ALIPAY_COLOR);
      }
    },
  });

  // Payout section
  y = (doc as any).lastAutoTable.finalY + 10;
  setFont(doc, 11, "bold", BRAND_DARK);
  doc.text("放款狀況  Payout Status", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);
  y += 8;

  const pW = (CONTENT_W - 4) / 3;
  const pH = 28;
  kpiCard(doc, MARGIN, y, pW, pH, "待放款金額", `HKD ${fmtHkd(overall.pendingPayoutHkd)}`, `${overall.pendingPayoutCount} 筆 C2C 訂單待處理`, [255, 251, 235], WARNING);
  kpiCard(doc, MARGIN + pW + 2, y, pW, pH, "已放款金額", `HKD ${fmtHkd(overall.paidOutHkd)}`, `${overall.paidOutCount} 筆已完成放款`, [240, 255, 245], SUCCESS);
  kpiCard(doc, MARGIN + (pW + 2) * 2, y, pW, pH, "退款支出", `HKD ${fmtHkd(overall.refundedAmountHkd)}`, `${overall.refundedCount} 筆退款 · ${overall.cancelledCount} 筆取消`, [255, 242, 242], DANGER);

  // Footer page 2
  drawLine(doc, MARGIN, 283, W - MARGIN, 283, [200, 200, 215], 0.3);
  setFont(doc, 7, "normal", TEXT_LIGHT);
  doc.text("BOXIUM PTCG · www.boxium.asia · 本報告由系統自動生成，僅供內部財務核對使用", MARGIN, 288);
  doc.text("第 2 頁 / 3 頁", W - MARGIN, 288, { align: "right" });

  // ═══════════════════════════════════════════════════════
  // PAGE 3 — MONTHLY DETAIL TABLE
  // ═══════════════════════════════════════════════════════
  doc.addPage();

  // Page header band
  drawRect(doc, 0, 0, W, 18, BRAND_DARK, 0);
  doc.setFillColor(...BRAND_YELLOW);
  doc.rect(0, 16, W, 3, "F");
  setFont(doc, 9, "bold", [255, 255, 255]);
  doc.text("BOXIUM PTCG · 財務報告", MARGIN, 11);
  setFont(doc, 8, "normal", [180, 185, 230]);
  doc.text(reportDate, W - MARGIN, 11, { align: "right" });

  y = 28;
  setFont(doc, 13, "bold", BRAND_DARK);
  doc.text("月度明細  Monthly Breakdown", MARGIN, y);
  drawLine(doc, MARGIN, y + 2, W - MARGIN, y + 2, BRAND_DARK, 0.5);
  y += 8;

  const sortedMonthly = [...monthly].reverse();

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["月份", "訂單數", "交易總額", "平台直售", "C2C 銷售", "手續費", "平台收入", "退款", "淨收入"]],
    body: sortedMonthly.map((r, idx) => {
      const platIncome = (r as any).platformIncomeHkd ?? (r.platformSalesHkd + r.sellerFeesHkd);
      const refunded = (r as any).refundedAmountHkd ?? 0;
      const netRev = (r as any).netRevenueHkd ?? (r.totalSalesHkd - refunded);
      return [
        fmtYearMonth(r.yearMonth),
        String(r.orderCount),
        fmtHkd(r.totalSalesHkd),
        fmtHkd(r.platformSalesHkd),
        fmtHkd(r.sellerSalesHkd),
        fmtHkd(r.sellerFeesHkd),
        fmtHkd(platIncome),
        refunded > 0 ? `-${fmtHkd(refunded)}` : "—",
        fmtHkd(netRev),
      ];
    }),
    foot: [[
      "合計",
      String(overall.totalOrders),
      fmtHkd(overall.totalSalesHkd),
      fmtHkd(overall.platformSalesHkd),
      fmtHkd(overall.sellerSalesHkd ?? 0),
      fmtHkd(overall.totalFeesHkd),
      fmtHkd(overall.platformIncomeHkd),
      overall.refundedAmountHkd > 0 ? `-${fmtHkd(overall.refundedAmountHkd)}` : "—",
      fmtHkd(overall.netRevenueHkd),
    ]],
    styles: { fontSize: 7.5, cellPadding: 2.5, font: "helvetica" },
    headStyles: { fillColor: BRAND_DARK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    footStyles: { fillColor: BRAND_LIGHT, textColor: BRAND_DARK, fontStyle: "bold", fontSize: 7.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 22 },
      1: { halign: "center", cellWidth: 14 },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: "bold" },
      7: { halign: "right", textColor: DANGER },
      8: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [248, 249, 255] },
  });

  // Disclaimer
  y = (doc as any).lastAutoTable.finalY + 10;
  drawRect(doc, MARGIN, y, CONTENT_W, 22, [255, 250, 235], 3);
  setFont(doc, 7.5, "bold", WARNING);
  doc.text("⚠  免責聲明  Disclaimer", MARGIN + 5, y + 7);
  setFont(doc, 7, "normal", TEXT_MID);
  doc.text("本報告由 BOXIUM PTCG 系統自動生成，所有數據僅供內部財務核對參考。如有疑問，請以系統資料庫記錄為準。", MARGIN + 5, y + 13);
  doc.text("This report is auto-generated for internal use only. All figures are in Hong Kong Dollars (HKD).", MARGIN + 5, y + 19);

  // Footer page 3
  drawLine(doc, MARGIN, 283, W - MARGIN, 283, [200, 200, 215], 0.3);
  setFont(doc, 7, "normal", TEXT_LIGHT);
  doc.text("BOXIUM PTCG · www.boxium.asia · 本報告由系統自動生成，僅供內部財務核對使用", MARGIN, 288);
  doc.text("第 3 頁 / 3 頁", W - MARGIN, 288, { align: "right" });

  // Save
  const filename = `BOXIUM_財務報告_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
