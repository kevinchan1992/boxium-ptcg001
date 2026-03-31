import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Font paths - bundled with the server
const FONT_DIR = path.join(process.cwd(), "server/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSansTC-Regular.otf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSansTC-Bold.otf");

// ── BOXIUM Brand Palette (Dark Theme) ──────────────────────────────────
// All pages use dark backgrounds to match the BOXIUM website aesthetic.
const C = {
  // Backgrounds — layered dark blues
  pageBg: "#0A0A1A",       // Deepest background (full page fill)
  cardBg: "#12122A",       // Section / card background
  cardBg2: "#1A1A38",      // Alternate row / lighter card
  headerBg: "#06038D",     // BOXIUM brand blue (header bars, table headers)
  headerBg2: "#0A07B0",    // Slightly lighter brand blue (hover / accent)
  divider: "#2A2A50",      // Subtle divider lines

  // Brand accent
  gold: "#FEDD00",         // BOXIUM yellow — primary accent
  goldDim: "#C9A800",      // Dimmer gold for secondary labels

  // Text
  white: "#FFFFFF",
  textPrimary: "#E8E8FF",  // Near-white with slight blue tint
  textSecondary: "#9090B8", // Muted secondary text
  textMuted: "#5A5A80",    // Very muted (footnotes, labels)

  // Semantic colours — kept subtle against dark bg
  positive: "#34D399",     // Emerald green (profit / positive)
  negative: "#F87171",     // Soft red (loss / refund)
  stripe: "#818CF8",       // Indigo (Stripe brand)
  alipay: "#22D3EE",       // Cyan (Alipay brand)
  amount: "#93C5FD",       // Light blue (GMV / amounts)
  fee: "#FCD34D",          // Amber (fees)
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
  const { color = C.textPrimary, bold = false, size = 10, ...rest } = opts;
  const [r, g, b] = hexToRgb(color);
  doc.save()
    .font(bold ? "NotoTC-Bold" : "NotoTC-Regular")
    .fontSize(size)
    .fillColor([r, g, b] as any)
    .text(str, x, y, rest)
    .restore();
}

/**
 * Draw a decorative circle accent — subtle semi-transparent circle
 * used in page corners for visual interest (matches BOXIUM website style).
 */
function drawCircleAccent(doc: PDFKit.PDFDocument, cx: number, cy: number, radius: number, color: string, opacity = 0.08) {
  const [r, g, b] = hexToRgb(color);
  doc.save().opacity(opacity).circle(cx, cy, radius).fill([r, g, b] as any).restore();
}

/**
 * Draw the page header with BOXIUM brand blue bar + gold accent line.
 * Logo is placed on the left; title and date on the right.
 */
function drawPageHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  logoData: Buffer | null,
  generatedAt: string
) {
  const W = 595;

  // Full-width brand blue header bar
  fillRect(doc, 0, 0, W, 76, C.headerBg);

  // Gold accent line at bottom of header
  fillRect(doc, 0, 73, W, 3, C.gold);

  // Decorative circle — top-right corner
  drawCircleAccent(doc, W - 20, 20, 60, C.gold, 0.07);

  // Logo
  if (logoData) {
    try { doc.image(logoData, 24, 12, { height: 50, fit: [130, 50] }); } catch { /* skip */ }
  }

  // Title block — centred vertically in the header
  // If no logo, shift title left; otherwise use offset
  const titleX = logoData ? 170 : 30;
  const titleWidth = logoData ? W - 180 - 170 : W - 200;
  pdfText(doc, title, titleX, 14, { bold: true, size: 18, color: C.gold, width: titleWidth });
  pdfText(doc, subtitle, titleX, 38, { size: 9, color: C.textSecondary, width: titleWidth });

  // Date / classification — right-aligned
  pdfText(doc, generatedAt, W - 165, 18, { size: 8, color: C.textSecondary, width: 140, align: "right" });
  pdfText(doc, "BOXIUM PTCG · 財務審核用途", W - 165, 34, { size: 7.5, color: C.textMuted, width: 140, align: "right" });
}

/**
 * Draw a section title with a gold left-border accent.
 * Returns the y position after the title + divider.
 */
function drawSectionTitle(doc: PDFKit.PDFDocument, label: string, y: number): number {
  // Gold vertical bar
  fillRect(doc, 30, y, 4, 18, C.gold);
  // Slight background pill behind the label
  fillRect(doc, 34, y, 200, 18, C.cardBg2);
  pdfText(doc, label, 42, y + 2, { bold: true, size: 12, color: C.white });
  // Subtle full-width divider
  hLine(doc, 30, 565, y + 22, C.divider, 0.5);
  return y + 30;
}

/**
 * Draw a KPI metric card with dark background and gold/coloured value.
 */
function drawKpiCard(
  doc: PDFKit.PDFDocument,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  bgColor: string, valueColor: string
) {
  // Card background
  fillRect(doc, x, y, w, h, bgColor);
  // Gold top-border accent
  fillRect(doc, x, y, w, 3, C.gold);
  // Subtle inner border
  const [r, g, b] = hexToRgb(C.divider);
  doc.save().lineWidth(0.5).rect(x, y, w, h).stroke([r, g, b] as any).restore();

  pdfText(doc, label, x + 10, y + 10, { size: 7.5, color: C.textSecondary, width: w - 20 });
  pdfText(doc, value, x + 10, y + 24, { bold: true, size: 11, color: valueColor, width: w - 20 });
  if (sub) pdfText(doc, sub, x + 10, y + 44, { size: 7.5, color: C.textMuted, width: w - 20 });
}

/**
 * Draw a table header row with brand blue background and gold labels.
 */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: Array<{ label: string; x: number; w: number; align?: string }>,
  y: number
): number {
  fillRect(doc, 30, y, 535, 20, C.headerBg);
  // Gold bottom accent line on header
  fillRect(doc, 30, y + 18, 535, 2, C.gold);
  for (const col of cols) {
    pdfText(doc, col.label, col.x, y + 5, {
      bold: true, size: 8, color: C.gold,
      width: col.w, align: (col.align as any) || "left",
    });
  }
  return y + 22;
}

/**
 * Draw a table data row — alternating dark backgrounds.
 */
function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: Array<{ val: string; x: number; w: number; align?: string; color?: string }>,
  y: number,
  isEven: boolean
): number {
  const rowBg = isEven ? C.cardBg : C.cardBg2;
  fillRect(doc, 30, y, 535, 17, rowBg);
  for (const cell of cells) {
    pdfText(doc, cell.val, cell.x, y + 3, {
      size: 8, color: cell.color || C.textPrimary,
      width: cell.w, align: (cell.align as any) || "left",
    });
  }
  hLine(doc, 30, 565, y + 17, C.divider, 0.3);
  return y + 17;
}

/**
 * Draw a P&L detail row — label on left, value on right.
 */
function drawPlRow(
  doc: PDFKit.PDFDocument,
  label: string, value: string, y: number,
  opts: { indent?: boolean; bold?: boolean; bg?: string; valueColor?: string } = {}
): number {
  const { indent = false, bold = false, bg, valueColor = C.textPrimary } = opts;
  const rowBg = bg || (indent ? C.cardBg : C.cardBg2);
  fillRect(doc, 30, y, 535, 19, rowBg);
  pdfText(doc, label, indent ? 52 : 38, y + 4, { bold, size: 9, color: indent ? C.textSecondary : C.white, width: 340 });
  pdfText(doc, value, 385, y + 4, { bold, size: 9, color: valueColor, width: 170, align: "right" });
  hLine(doc, 30, 565, y + 19, C.divider, 0.3);
  return y + 19;
}

export async function generateFinancialReportPdf(report: SalesReport, months: number): Promise<Buffer> {
  const { overall, monthly } = report;

  // Load logo — use pre-converted PNG files (WebP is not supported by PDFKit)
  // The server/fonts/boxium-logo-pdf.png is a proper PNG converted from the WebP source.
  let logoData: Buffer | null = null;
  const logoCandidates = [
    path.join(process.cwd(), "server/fonts/boxium-logo-pdf.png"),
    path.join(process.cwd(), "server/fonts/boxium-logo-white-pdf.png"),
    path.join(process.cwd(), "client/public/boxium-logo.png"),
  ];
  for (const candidate of logoCandidates) {
    try {
      if (fs.existsSync(candidate)) {
        logoData = fs.readFileSync(candidate);
        break;
      }
    } catch { /* try next */ }
  }

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
    const H = 842;

    // ── PAGE 1: COVER ────────────────────────────────────────────────────
    doc.addPage();

    // Full dark background
    fillRect(doc, 0, 0, W, H, C.pageBg);

  // Top brand blue band
  fillRect(doc, 0, 0, W, 8, C.headerBg);

  // Decorative circles — top-right and bottom-left (matches BOXIUM website style)
  drawCircleAccent(doc, W - 60, 80, 120, C.gold, 0.07);
  // Bottom-left
  drawCircleAccent(doc, 60, H - 80, 90, C.gold, 0.05);

    // Horizontal gold accent lines for visual structure
    fillRect(doc, 0, 320, W, 2, C.gold);
    fillRect(doc, 0, 322, W, 1, C.headerBg);

    // Logo centred
    if (logoData) {
      try { doc.image(logoData, (W - 260) / 2, 100, { width: 260 }); } catch { /* skip */ }
    }

    // Title block
    pdfText(doc, "BOXIUM PTCG", W / 2 - 160, 340, { bold: true, size: 34, color: C.gold, width: 320, align: "center" });
    pdfText(doc, "財務報告", W / 2 - 160, 386, { bold: true, size: 26, color: C.white, width: 320, align: "center" });

    // Gold underline beneath title
    fillRect(doc, (W - 100) / 2, 426, 100, 3, C.gold);

    // Period info
    const reportPeriod = monthly.length > 0
      ? `${fmtDate(monthly[monthly.length - 1].yearMonth)} — ${fmtDate(monthly[0].yearMonth)}`
      : `最近 ${months} 個月`;

    pdfText(doc, "報告期間", W / 2 - 160, 448, { size: 9, color: C.textMuted, width: 320, align: "center" });
    pdfText(doc, reportPeriod, W / 2 - 160, 464, { bold: true, size: 14, color: C.textPrimary, width: 320, align: "center" });

    pdfText(doc, "生成日期", W / 2 - 160, 498, { size: 9, color: C.textMuted, width: 320, align: "center" });
    pdfText(doc, generatedAt, W / 2 - 160, 514, { bold: true, size: 14, color: C.textPrimary, width: 320, align: "center" });

    // Bottom classification bar
    fillRect(doc, 0, H - 40, W, 40, C.headerBg);
    pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 26, {
      size: 8, color: C.gold, width: W - 60, align: "center",
    });

    // ── PAGE 2: P&L SUMMARY ──────────────────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, W, H, C.pageBg);
    drawPageHeader(doc, "損益表", `報告期間：${months} 個月`, logoData, generatedAt);

    let y = 90;

    // KPI cards — all use brand dark backgrounds with gold/coloured values
    const cardW = 120, cardH = 64, cardGap = 13;
    const kpis = [
      { label: "GMV 總交易額", value: fmt(overall.totalSalesHkd), sub: `${overall.totalOrders} 筆訂單`, bg: "#0E0E2A", vc: C.amount },
      { label: "平台收入", value: fmt(overall.platformIncomeHkd), sub: "直售 + 手續費", bg: "#0A1A2A", vc: C.positive },
      { label: "退款金額", value: fmt(overall.refundedAmountHkd), sub: `${overall.refundedCount} 筆退款`, bg: "#1A0A0A", vc: C.negative },
      { label: "平台淨利潤", value: fmt(overall.platformNetProfitHkd), sub: "收入 - 已放款", bg: C.headerBg, vc: C.gold },
    ];
    for (let i = 0; i < kpis.length; i++) {
      const k = kpis[i];
      drawKpiCard(doc, 30 + i * (cardW + cardGap), y, cardW, cardH, k.label, k.value, k.sub, k.bg, k.vc);
    }
    y += cardH + 22;

    y = drawSectionTitle(doc, "損益明細", y);

    // Income section header
    fillRect(doc, 30, y, 535, 20, C.headerBg);
    fillRect(doc, 30, y, 4, 20, C.gold);
    pdfText(doc, "收入", 38, y + 5, { bold: true, size: 9, color: C.gold });
    y += 20;
    y = drawPlRow(doc, "平台直售收入", fmt(overall.platformSalesHkd), y, { indent: true });
    y = drawPlRow(doc, "C2C 手續費收入", fmt(overall.totalFeesHkd), y, { indent: true });
    y = drawPlRow(doc, "總收入", fmt(overall.platformIncomeHkd), y, { bold: true, bg: "#0A1A0A", valueColor: C.positive });

    y += 10;

    // Expense section header
    fillRect(doc, 30, y, 535, 20, C.headerBg);
    fillRect(doc, 30, y, 4, 20, C.gold);
    pdfText(doc, "支出 / 扣除", 38, y + 5, { bold: true, size: 9, color: C.gold });
    y += 20;
    y = drawPlRow(doc, "已放款給賣家", fmt(overall.paidOutHkd), y, { indent: true });
    y = drawPlRow(doc, "退款金額", fmt(overall.refundedAmountHkd), y, { indent: true, valueColor: C.negative });
    y = drawPlRow(doc, "總支出", fmt(overall.paidOutHkd + overall.refundedAmountHkd), y, { bold: true, bg: "#1A0A0A", valueColor: C.negative });

    y += 10;
    y = drawPlRow(doc, "平台淨利潤", fmt(overall.platformNetProfitHkd), y, { bold: true, bg: C.headerBg, valueColor: C.gold });

    y += 24;
    y = drawSectionTitle(doc, "待放款摘要", y);
    y = drawPlRow(doc, "待放款給賣家", fmt(overall.pendingPayoutHkd), y, { indent: true });
    y = drawPlRow(doc, "待放款筆數", `${overall.pendingPayoutCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "已放款筆數", `${overall.paidOutCount} 筆`, y, { indent: true });

    // Bottom classification bar
    fillRect(doc, 0, H - 30, W, 30, C.headerBg);
    pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 18, {
      size: 7.5, color: C.gold, width: W - 60, align: "center",
    });

    // ── PAGE 3: PAYMENT METHOD ANALYSIS ──────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, W, H, C.pageBg);
    drawPageHeader(doc, "收款分析", "付款方式分佈", logoData, generatedAt);
    y = 90;

    y = drawSectionTitle(doc, "付款方式分析", y);

    const halfW = 252;

    // Stripe card — indigo accent
    fillRect(doc, 30, y, halfW, 84, "#0D0D2A");
    fillRect(doc, 30, y, halfW, 3, C.stripe);
    const [sr, sg, sb] = hexToRgb(C.stripe);
    doc.save().lineWidth(0.8).rect(30, y, halfW, 84).stroke([sr, sg, sb] as any).restore();
    pdfText(doc, "Stripe", 46, y + 12, { bold: true, size: 15, color: C.stripe });
    pdfText(doc, fmt(overall.stripeSalesHkd), 46, y + 34, { bold: true, size: 13, color: C.white });
    pdfText(doc, `${overall.stripeCount} 筆訂單`, 46, y + 58, { size: 9, color: C.textSecondary });
    const stripePercent = overall.totalSalesHkd > 0 ? ((overall.stripeSalesHkd / overall.totalSalesHkd) * 100).toFixed(1) : "0.0";
    pdfText(doc, `${stripePercent}%`, 190, y + 30, { bold: true, size: 22, color: C.stripe, width: 80, align: "right" });

    // Alipay card — cyan accent
    fillRect(doc, 313, y, halfW, 84, "#0A1A1A");
    fillRect(doc, 313, y, halfW, 3, C.alipay);
    const [ar, ag, ab] = hexToRgb(C.alipay);
    doc.save().lineWidth(0.8).rect(313, y, halfW, 84).stroke([ar, ag, ab] as any).restore();
    pdfText(doc, "支付寶 HK", 329, y + 12, { bold: true, size: 15, color: C.alipay });
    pdfText(doc, fmt(overall.alipaySalesHkd), 329, y + 34, { bold: true, size: 13, color: C.white });
    pdfText(doc, `${overall.alipayCount} 筆訂單`, 329, y + 58, { size: 9, color: C.textSecondary });
    const alipayPercent = overall.totalSalesHkd > 0 ? ((overall.alipaySalesHkd / overall.totalSalesHkd) * 100).toFixed(1) : "0.0";
    pdfText(doc, `${alipayPercent}%`, 473, y + 30, { bold: true, size: 22, color: C.alipay, width: 80, align: "right" });
    y += 104;

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
      { val: "Stripe", x: 35, w: 100, color: C.stripe },
      { val: `${overall.stripeCount}`, x: 140, w: 60, align: "right" },
      { val: fmt(overall.stripeSalesHkd), x: 205, w: 120, align: "right", color: C.amount },
      { val: fmt(overall.stripePlatformSalesHkd), x: 330, w: 110, align: "right" },
      { val: fmt(overall.stripeSellerFeesHkd), x: 445, w: 100, align: "right", color: C.fee },
    ], y, false);
    y = drawTableRow(doc, [
      { val: "支付寶 HK", x: 35, w: 100, color: C.alipay },
      { val: `${overall.alipayCount}`, x: 140, w: 60, align: "right" },
      { val: fmt(overall.alipaySalesHkd), x: 205, w: 120, align: "right", color: C.amount },
      { val: fmt(overall.alipayPlatformSalesHkd), x: 330, w: 110, align: "right" },
      { val: fmt(overall.alipaySellerFeesHkd), x: 445, w: 100, align: "right", color: C.fee },
    ], y, true);

    // Total row
    fillRect(doc, 30, y, 535, 20, C.headerBg);
    fillRect(doc, 30, y, 4, 20, C.gold);
    pdfText(doc, "合計", 38, y + 5, { bold: true, size: 9, color: C.gold });
    pdfText(doc, `${overall.totalOrders}`, 140, y + 5, { bold: true, size: 9, color: C.gold, width: 60, align: "right" });
    pdfText(doc, fmt(overall.totalSalesHkd), 205, y + 5, { bold: true, size: 9, color: C.gold, width: 120, align: "right" });
    pdfText(doc, fmt(overall.platformSalesHkd), 330, y + 5, { bold: true, size: 9, color: C.gold, width: 110, align: "right" });
    pdfText(doc, fmt(overall.totalFeesHkd ?? 0), 445, y + 5, { bold: true, size: 9, color: C.gold, width: 100, align: "right" });
    y += 32;

    y = drawSectionTitle(doc, "取消 / 退款統計", y);
    y = drawPlRow(doc, "取消訂單數", `${overall.cancelledCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "退款訂單數", `${overall.refundedCount} 筆`, y, { indent: true });
    y = drawPlRow(doc, "退款總金額", fmt(overall.refundedAmountHkd), y, { indent: true, valueColor: C.negative });

    // Bottom classification bar
    fillRect(doc, 0, H - 30, W, 30, C.headerBg);
    pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 18, {
      size: 7.5, color: C.gold, width: W - 60, align: "center",
    });

    // ── PAGE 4: MONTHLY BREAKDOWN ─────────────────────────────────────────
    doc.addPage();
    fillRect(doc, 0, 0, W, H, C.pageBg);
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
      if (y > 770) {
        // Bottom bar before page break
        fillRect(doc, 0, H - 30, W, 30, C.headerBg);
        pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 18, {
          size: 7.5, color: C.gold, width: W - 60, align: "center",
        });
        doc.addPage();
        fillRect(doc, 0, 0, W, H, C.pageBg);
        drawPageHeader(doc, "月度明細（續）", `共 ${monthly.length} 個月`, logoData, generatedAt);
        y = 90;
        y = drawTableHeader(doc, mCols, y);
      }
      y = drawTableRow(doc, [
        { val: fmtDate(m.yearMonth), x: 35, w: 60, color: C.textPrimary },
        { val: fmt(m.totalSalesHkd), x: 100, w: 85, align: "right", color: C.amount },
        { val: m.refundedAmountHkd > 0 ? `-${fmt(m.refundedAmountHkd)}` : "—", x: 190, w: 75, align: "right", color: m.refundedAmountHkd > 0 ? C.negative : C.textMuted },
        { val: fmt(m.netRevenueHkd), x: 270, w: 85, align: "right", color: m.netRevenueHkd >= 0 ? C.positive : C.negative },
        { val: fmt(m.platformIncomeHkd), x: 360, w: 90, align: "right", color: C.fee },
        { val: `${m.orderCount}`, x: 455, w: 50, align: "right", color: C.textPrimary },
        { val: `${m.cancelledCount}`, x: 510, w: 45, align: "right", color: m.cancelledCount > 0 ? C.negative : C.textMuted },
      ], y, i % 2 === 1);
    }

    // Monthly total row
    if (y > 770) {
      fillRect(doc, 0, H - 30, W, 30, C.headerBg);
      pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 18, {
        size: 7.5, color: C.gold, width: W - 60, align: "center",
      });
      doc.addPage();
      fillRect(doc, 0, 0, W, H, C.pageBg);
      drawPageHeader(doc, "月度明細（續）", `共 ${monthly.length} 個月`, logoData, generatedAt);
      y = 90;
    }
    fillRect(doc, 30, y, 535, 20, C.headerBg);
    fillRect(doc, 30, y, 4, 20, C.gold);
    pdfText(doc, "合計", 38, y + 5, { bold: true, size: 9, color: C.gold });
    pdfText(doc, fmt(overall.totalSalesHkd), 100, y + 5, { bold: true, size: 9, color: C.gold, width: 85, align: "right" });
    pdfText(doc, overall.refundedAmountHkd > 0 ? `-${fmt(overall.refundedAmountHkd)}` : "—", 190, y + 5, { bold: true, size: 9, color: C.gold, width: 75, align: "right" });
    pdfText(doc, fmt(overall.netRevenueHkd), 270, y + 5, { bold: true, size: 9, color: C.gold, width: 85, align: "right" });
    pdfText(doc, fmt(overall.platformIncomeHkd), 360, y + 5, { bold: true, size: 9, color: C.gold, width: 90, align: "right" });
    pdfText(doc, `${overall.totalOrders}`, 455, y + 5, { bold: true, size: 9, color: C.gold, width: 50, align: "right" });
    pdfText(doc, `${overall.cancelledCount}`, 510, y + 5, { bold: true, size: 9, color: C.gold, width: 45, align: "right" });
    y += 32;

    // Footnote
    y += 8;
    hLine(doc, 30, 565, y, C.divider, 0.5);
    pdfText(doc, `本報告由系統自動生成，數據截至 ${generatedAt}。已付款訂單（payment_received / processing / shipped / delivered / completed）。取消/退款訂單獨立計算。`, 30, y + 8, { size: 7.5, color: C.textMuted, width: 535 });

    // Bottom classification bar (last page)
    fillRect(doc, 0, H - 30, W, 30, C.headerBg);
    pdfText(doc, "BOXIUM PTCG  ·  財務審核用途  ·  機密文件", 30, H - 18, {
      size: 7.5, color: C.gold, width: W - 60, align: "center",
    });

    doc.end();
  });
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
