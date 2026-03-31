import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Font paths - bundled with the server
const FONT_DIR = path.join(process.cwd(), "server/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSansTC-Regular.otf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSansTC-Bold.otf");

// BOXIUM brand colours
const C = {
  navy: "#1a1a2e",
  navyMid: "#16213e",
  navyLight: "#0f3460",
  gold: "#FEDD00",
  white: "#ffffff",
  offWhite: "#f8f9fc",
  border: "#e5e7eb",
  textMuted: "#888888",
  textLight: "#aaaaaa",
  green: "#059669",
  red: "#dc2626",
  blue: "#2563eb",
  purple: "#7c3aed",
};

function fmt(amount: number): string {
  return `HKD ${amount.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string): string {
  const [year, month] = dateStr.split("-");
  return `${year}年${parseInt(month)}月`;
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

interface SalesReport {
  monthly: Array<{
    yearMonth: string;
    totalSalesHkd: number;
    orderCount: number;
    stripeCount: number;
    alipayCount: number;
    platformSalesHkd: number;
    sellerSalesHkd: number;
    sellerFeesHkd: number;
    platformIncomeHkd: number;
    refundedCount: number;
    cancelledCount: number;
    refundedAmountHkd: number;
    netRevenueHkd: number;
  }>;
  overall: {
    totalSalesHkd: number;
    totalFeesHkd: number;
    totalOrders: number;
    platformSalesHkd: number;
    sellerSalesHkd: number;
    sellerReceivableTotalHkd: number;
    stripeCount: number;
    alipayCount: number;
    stripeSalesHkd: number;
    alipaySalesHkd: number;
    stripePlatformSalesHkd: number;
    alipayPlatformSalesHkd: number;
    stripeSellerFeesHkd: number;
    alipaySellerFeesHkd: number;
    refundedCount: number;
    cancelledCount: number;
    refundedAmountHkd: number;
    netRevenueHkd: number;
    platformIncomeHkd: number;
    paidOutHkd: number;
    pendingPayoutHkd: number;
    pendingPayoutCount: number;
    paidOutCount: number;
    platformNetProfitHkd: number;
  };
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string) {
  const [r, g, b] = hexToRgb(color);
  doc.save().rect(x, y, w, h).fill([r, g, b] as any).restore();
}

function hLine(doc: PDFKit.PDFDocument, x1: number, x2: number, y: number, color: string, lineWidth = 0.5) {
  const [r, g, b] = hexToRgb(color);
  doc.save().lineWidth(lineWidth).moveTo(x1, y).lineTo(x2, y).stroke([r, g, b] as any).restore();
}

function pdfText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  opts: PDFKit.Mixins.TextOptions & { color?: string; bold?: boolean; size?: number } = {}
) {
  const { color = C.navy, bold = false, size = 10, ...rest } = opts;
  const [r, g, b] = hexToRgb(color);
  doc.save()
    .font(bold ? "NotoTC-Bold" : "NotoTC-Regular")
    .fontSize(size)
    .fillColor([r, g, b] as any)
    .text(str, x, y, rest)
    .restore();
}

function drawPageHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  logoData: Buffer | null,
  generatedAt: string
) {
  const W = 595;
  fillRect(doc, 0, 0, W, 72, C.navy);
  fillRect(doc, 0, 69, W, 3, C.gold);
  if (logoData) {
    try { doc.image(logoData, 30, 11, { height: 48, fit: [120, 48] }); } catch { /* skip */ }
  }
  pdfText(doc, title, 165, 16, { bold: true, size: 16, color: C.white });
  pdfText(doc, subtitle, 165, 37, { size: 9, color: C.textLight });
  pdfText(doc, generatedAt, W - 160, 20, { size: 8, color: C.textLight, width: 130, align: "right" });
  pdfText(doc, "BOXIUM PTCG · 財務審核用途", W - 160, 34, { size: 7, color: C.textLight, width: 130, align: "right" });
}

function drawSectionTitle(doc: PDFKit.PDFDocument, label: string, y: number): number {
  fillRect(doc, 30, y, 4, 16, C.gold);
  pdfText(doc, label, 40, y + 1, { bold: true, size: 11, color: C.navy });
  hLine(doc, 30, 565, y + 20, C.border, 0.5);
  return y + 28;
}

function drawKpiCard(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  bgColor: string, valueColor: string
) {
  fillRect(doc, x, y, w, h, bgColor);
  // border
  const [r, g, b] = hexToRgb(C.border);
  doc.save().lineWidth(0.5).rect(x, y, w, h).stroke([r, g, b] as any).restore();
  pdfText(doc, label, x + 10, y + 10, { size: 8, color: C.textMuted, width: w - 20 });
  pdfText(doc, value, x + 10, y + 24, { bold: true, size: 12, color: valueColor, width: w - 20 });
  if (sub) pdfText(doc, sub, x + 10, y + 42, { size: 8, color: C.textMuted, width: w - 20 });
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: Array<{ label: string; x: number; w: number; align?: string }>,
  y: number
): number {
  fillRect(doc, 30, y, 535, 18, C.navy);
  for (const col of cols) {
    pdfText(doc, col.label, col.x, y + 4, {
      bold: true, size: 8, color: C.gold,
      width: col.w, align: (col.align as any) || "left",
    });
  }
  return y + 18;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: Array<{ val: string; x: number; w: number; align?: string; color?: string }>,
  y: number,
  isEven: boolean
): number {
  if (isEven) fillRect(doc, 30, y, 535, 16, "#f8f9fc");
  for (const cell of cells) {
    pdfText(doc, cell.val, cell.x, y + 3, {
      size: 8, color: cell.color || C.navy,
      width: cell.w, align: (cell.align as any) || "left",
    });
  }
  hLine(doc, 30, 565, y + 16, C.border, 0.3);
  return y + 16;
}

function drawPlRow(
  doc: PDFKit.PDFDocument,
  label: string, value: string, y: number,
  opts: { indent?: boolean; bold?: boolean; bg?: string; valueColor?: string } = {}
): number {
  const { indent = false, bold = false, bg, valueColor = C.navy } = opts;
  if (bg) fillRect(doc, 30, y, 535, 18, bg);
  pdfText(doc, label, indent ? 55 : 35, y + 4, { bold, size: 9, color: indent ? C.textMuted : C.navy, width: 350 });
  pdfText(doc, value, 390, y + 4, { bold, size: 9, color: valueColor, width: 165, align: "right" });
  hLine(doc, 30, 565, y + 18, C.border, 0.3);
  return y + 18;
}

export async function generateFinancialReportPdf(report: SalesReport, months: number): Promise<Buffer> {
  const { overall, monthly } = report;

  // Load logo
  let logoData: Buffer | null = null;
  try {
    const logoPath = path.join(process.cwd(), "client/public/boxium-logo.png");
    if (fs.existsSync(logoPath)) logoData = fs.readFileSync(logoPath);
  } catch { /* skip */ }

  const generatedAt = new Date().toLocaleDateString("zh-HK", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Hong_Kong",
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("NotoTC-Regular", FONT_REGULAR);
    doc.registerFont("NotoTC-Bold", FONT_BOLD);

    const W = 595;

    // ── PAGE 1: COVER ────────────────────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, W, 842, C.navy);

    // Decorative circles
    doc.save().circle(W - 80, 80, 120).fillOpacity(0.08)
      .fill([hexToRgb(C.gold)[0], hexToRgb(C.gold)[1], hexToRgb(C.gold)[2]] as any).restore();
    doc.save().circle(60, 780, 90).fillOpacity(0.06)
      .fill([hexToRgb(C.gold)[0], hexToRgb(C.gold)[1], hexToRgb(C.gold)[2]] as any).restore();

    if (logoData) {
      try { doc.image(logoData, (W - 220) / 2, 200, { width: 220 }); } catch { /* skip */ }
    }

    pdfText(doc, "BOXIUM PTCG", W / 2 - 150, 340, { bold: true, size: 32, color: C.gold, width: 300, align: "center" });
    pdfText(doc, "財務報告", W / 2 - 150, 380, { bold: true, size: 24, color: C.white, width: 300, align: "center" });
    fillRect(doc, (W - 80) / 2, 418, 80, 2, C.gold);

    const reportPeriod = monthly.length > 0
      ? `${fmtDate(monthly[monthly.length - 1].yearMonth)} — ${fmtDate(monthly[0].yearMonth)}`
      : `最近 ${months} 個月`;

    pdfText(doc, "報告期間", W / 2 - 150, 440, { size: 9, color: C.textLight, width: 300, align: "center" });
    pdfText(doc, reportPeriod, W / 2 - 150, 456, { bold: true, size: 13, color: C.white, width: 300, align: "center" });
    pdfText(doc, "生成日期", W / 2 - 150, 490, { size: 9, color: C.textLight, width: 300, align: "center" });
    pdfText(doc, generatedAt, W / 2 - 150, 506, { bold: true, size: 13, color: C.white, width: 300, align: "center" });
    pdfText(doc, "BOXIUM PTCG · 財務審核用途 · 機密文件", 30, 800, { size: 8, color: C.textLight, width: W - 60, align: "center" });

    // ── PAGE 2: P&L SUMMARY ──────────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc, "損益表", `報告期間：${months} 個月`, logoData, generatedAt);

    let y = 90;

    // KPI cards
    const cardW = 120, cardH = 60, cardGap = 13;
    const kpis = [
      { label: "GMV 總交易額", value: fmt(overall.totalSalesHkd), sub: `${overall.totalOrders} 筆訂單`, bg: "#1e3a5f", vc: C.white },
      { label: "平台收入", value: fmt(overall.platformIncomeHkd), sub: "直售 + 手續費", bg: "#065f46", vc: C.white },
      { label: "退款金額", value: fmt(overall.refundedAmountHkd), sub: `${overall.refundedCount} 筆退款`, bg: "#7f1d1d", vc: C.white },
      { label: "平台淨利潤", value: fmt(overall.platformNetProfitHkd), sub: "收入 - 已放款", bg: C.navy, vc: C.gold },
    ];
    for (let i = 0; i < kpis.length; i++) {
      const k = kpis[i];
      drawKpiCard(doc, 30 + i * (cardW + cardGap), y, cardW, cardH, k.label, k.value, k.sub, k.bg, k.vc);
    }
    y += cardH + 20;

    y = drawSectionTitle(doc, "損益明細", y);
    fillRect(doc, 30, y, 535, 18, C.navy);
    pdfText(doc, "收入", 35, y + 4, { bold: true, size: 9, color: C.gold });
    y += 18;
    y = drawPlRow(doc, "平台直售收入", fmt(overall.platformSalesHkd), y, { indent: true });
    y = drawPlRow(doc, "C2C 手續費收入", fmt(overall.totalFeesHkd), y, { indent: true });
    y = drawPlRow(doc, "總收入", fmt(overall.platformIncomeHkd), y, { bold: true, bg: "#f0fdf4", valueColor: C.green });

    y += 8;
    fillRect(doc, 30, y, 535, 18, C.navy);
    pdfText(doc, "支出 / 扣除", 35, y + 4, { bold: true, size: 9, color: C.gold });
    y += 18;
    y = drawPlRow(doc, "已放款給賣家", fmt(overall.paidOutHkd), y, { indent: true });
    y = drawPlRow(doc, "退款金額", fmt(overall.refundedAmountHkd), y, { indent: true, valueColor: C.red });
    y = drawPlRow(doc, "總支出", fmt(overall.paidOutHkd + overall.refundedAmountHkd), y, { bold: true, bg: "#fef2f2", valueColor: C.red });

    y += 8;
    y = drawPlRow(doc, "平台淨利潤", fmt(overall.platformNetProfitHkd), y, { bold: true, bg: "#f0fdf4", valueColor: C.green });

    y += 20;
    y = drawSectionTitle(doc, "待放款摘要", y);
    y = drawPlRow(doc, "待放款給賣家", fmt(overall.pendingPayoutHkd), y, { indent: true });
    y = drawPlRow(doc, "待放款筆數", `${overall.pendingPayoutCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "已放款筆數", `${overall.paidOutCount} 筆`, y, { indent: true });

    // ── PAGE 3: PAYMENT METHOD ANALYSIS ─────────────────────────────
    doc.addPage();
    drawPageHeader(doc, "收款分析", "付款方式分佈", logoData, generatedAt);
    y = 90;

    y = drawSectionTitle(doc, "付款方式分析", y);

    const halfW = 250;
    // Stripe card
    fillRect(doc, 30, y, halfW, 80, "#0f172a");
    doc.save().lineWidth(1).rect(30, y, halfW, 80).stroke([99, 102, 241] as any).restore();
    pdfText(doc, "Stripe", 45, y + 12, { bold: true, size: 14, color: "#818cf8" });
    pdfText(doc, fmt(overall.stripeSalesHkd), 45, y + 32, { bold: true, size: 14, color: C.white });
    pdfText(doc, `${overall.stripeCount} 筆訂單`, 45, y + 54, { size: 9, color: C.textMuted });
    const stripePercent = overall.totalSalesHkd > 0 ? ((overall.stripeSalesHkd / overall.totalSalesHkd) * 100).toFixed(1) : "0.0";
    pdfText(doc, `${stripePercent}%`, 200, y + 32, { bold: true, size: 20, color: "#818cf8", width: 70, align: "right" });

    // Alipay card
    fillRect(doc, 315, y, halfW, 80, "#0f172a");
    doc.save().lineWidth(1).rect(315, y, halfW, 80).stroke([34, 211, 238] as any).restore();
    pdfText(doc, "支付寶 HK", 330, y + 12, { bold: true, size: 14, color: "#22d3ee" });
    pdfText(doc, fmt(overall.alipaySalesHkd), 330, y + 32, { bold: true, size: 14, color: C.white });
    pdfText(doc, `${overall.alipayCount} 筆訂單`, 330, y + 54, { size: 9, color: C.textMuted });
    const alipayPercent = overall.totalSalesHkd > 0 ? ((overall.alipaySalesHkd / overall.totalSalesHkd) * 100).toFixed(1) : "0.0";
    pdfText(doc, `${alipayPercent}%`, 485, y + 32, { bold: true, size: 20, color: "#22d3ee", width: 70, align: "right" });
    y += 100;

    y = drawSectionTitle(doc, "付款方式明細", y);
    const pmCols = [
      { label: "付款方式", x: 35, w: 100 },
      { label: "訂單數", x: 140, w: 60, align: "right" },
      { label: "GMV", x: 205, w: 120, align: "right" },
      { label: "平台直售", x: 330, w: 110, align: "right" },
      { label: "手續費", x: 445, w: 100, align: "right" },
    ];
    y = drawTableHeader(doc, pmCols, y);
    y = drawTableRow(doc, [
      { val: "Stripe", x: 35, w: 100 },
      { val: `${overall.stripeCount}`, x: 140, w: 60, align: "right" },
      { val: fmt(overall.stripeSalesHkd), x: 205, w: 120, align: "right", color: C.blue },
      { val: fmt(overall.stripePlatformSalesHkd), x: 330, w: 110, align: "right" },
      { val: fmt(overall.stripeSellerFeesHkd), x: 445, w: 100, align: "right", color: "#d97706" },
    ], y, false);
    y = drawTableRow(doc, [
      { val: "支付寶 HK", x: 35, w: 100 },
      { val: `${overall.alipayCount}`, x: 140, w: 60, align: "right" },
      { val: fmt(overall.alipaySalesHkd), x: 205, w: 120, align: "right", color: C.blue },
      { val: fmt(overall.alipayPlatformSalesHkd), x: 330, w: 110, align: "right" },
      { val: fmt(overall.alipaySellerFeesHkd), x: 445, w: 100, align: "right", color: "#d97706" },
    ], y, true);
    // Total row
    fillRect(doc, 30, y, 535, 18, C.navy);
    pdfText(doc, "合計", 35, y + 4, { bold: true, size: 9, color: C.gold });
    pdfText(doc, `${overall.totalOrders}`, 140, y + 4, { bold: true, size: 9, color: C.gold, width: 60, align: "right" });
    pdfText(doc, fmt(overall.totalSalesHkd), 205, y + 4, { bold: true, size: 9, color: C.gold, width: 120, align: "right" });
    pdfText(doc, fmt(overall.platformSalesHkd), 330, y + 4, { bold: true, size: 9, color: C.gold, width: 110, align: "right" });
    pdfText(doc, fmt(overall.totalFeesHkd ?? 0), 445, y + 4, { bold: true, size: 9, color: C.gold, width: 100, align: "right" });
    y += 30;

    y = drawSectionTitle(doc, "取消 / 退款統計", y);
    y = drawPlRow(doc, "取消訂單數", `${overall.cancelledCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "退款訂單數", `${overall.refundedCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "退款總金額", fmt(overall.refundedAmountHkd), y, { indent: true, valueColor: C.red });

    // ── PAGE 4: MONTHLY BREAKDOWN ────────────────────────────────────
    doc.addPage();
    drawPageHeader(doc, "月度明細", `共 ${monthly.length} 個月`, logoData, generatedAt);
    y = 90;

    y = drawSectionTitle(doc, "月度財務明細", y);

    const mCols = [
      { label: "月份", x: 35, w: 60 },
      { label: "GMV", x: 100, w: 85, align: "right" },
      { label: "退款", x: 190, w: 75, align: "right" },
      { label: "淨收入", x: 270, w: 85, align: "right" },
      { label: "平台收入", x: 360, w: 90, align: "right" },
      { label: "訂單數", x: 455, w: 50, align: "right" },
      { label: "取消", x: 510, w: 45, align: "right" },
    ];
    y = drawTableHeader(doc, mCols, y);

    const sorted = [...monthly].reverse();
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      if (y > 780) {
        doc.addPage();
        drawPageHeader(doc, "月度明細（續）", `共 ${monthly.length} 個月`, logoData, generatedAt);
        y = 90;
        y = drawTableHeader(doc, mCols, y);
      }
      y = drawTableRow(doc, [
        { val: fmtDate(m.yearMonth), x: 35, w: 60 },
        { val: fmt(m.totalSalesHkd), x: 100, w: 85, align: "right", color: C.blue },
        { val: m.refundedAmountHkd > 0 ? `-${fmt(m.refundedAmountHkd)}` : "—", x: 190, w: 75, align: "right", color: m.refundedAmountHkd > 0 ? C.red : C.textMuted },
        { val: fmt(m.netRevenueHkd), x: 270, w: 85, align: "right", color: m.netRevenueHkd >= 0 ? C.green : C.red },
        { val: fmt(m.platformIncomeHkd), x: 360, w: 90, align: "right", color: "#d97706" },
        { val: `${m.orderCount}`, x: 455, w: 50, align: "right" },
        { val: `${m.cancelledCount}`, x: 510, w: 45, align: "right", color: m.cancelledCount > 0 ? C.red : C.textMuted },
      ], y, i % 2 === 1);
    }

    // Total row
    if (y > 780) {
      doc.addPage();
      drawPageHeader(doc, "月度明細（續）", `共 ${monthly.length} 個月`, logoData, generatedAt);
      y = 90;
    }
    fillRect(doc, 30, y, 535, 18, C.navy);
    pdfText(doc, "合計", 35, y + 4, { bold: true, size: 9, color: C.gold });
    pdfText(doc, fmt(overall.totalSalesHkd), 100, y + 4, { bold: true, size: 9, color: C.gold, width: 85, align: "right" });
    pdfText(doc, overall.refundedAmountHkd > 0 ? `-${fmt(overall.refundedAmountHkd)}` : "—", 190, y + 4, { bold: true, size: 9, color: C.gold, width: 75, align: "right" });
    pdfText(doc, fmt(overall.netRevenueHkd), 270, y + 4, { bold: true, size: 9, color: C.gold, width: 85, align: "right" });
    pdfText(doc, fmt(overall.platformIncomeHkd), 360, y + 4, { bold: true, size: 9, color: C.gold, width: 90, align: "right" });
    pdfText(doc, `${overall.totalOrders}`, 455, y + 4, { bold: true, size: 9, color: C.gold, width: 50, align: "right" });
    pdfText(doc, `${overall.cancelledCount}`, 510, y + 4, { bold: true, size: 9, color: C.gold, width: 45, align: "right" });
    y += 30;

    y += 10;
    hLine(doc, 30, 565, y, C.border, 0.5);
    pdfText(doc, `本報告由系統自動生成，數據截至 ${generatedAt}。已付款訂單（payment_received / processing / shipped / delivered / completed）。取消/退款訂單獨立計算。`, 30, y + 8, { size: 7.5, color: C.textMuted, width: 535 });

    doc.end();
  });
}
