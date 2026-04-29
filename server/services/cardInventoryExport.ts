/**
 * Card Inventory Export Service
 * Generates PDF and Excel reports for card buy/sell records
 * Used for company tax filing purposes
 */

import PDFDocument from "pdfkit";
import { execSync } from "child_process";
import ExcelJS from "exceljs";
import fs from "fs";
import sharp from "sharp";
import path from "path";
import https from "https";
import http from "http";
import { getDb } from "../db";
import { cardInventory } from "../../drizzle/schema_new";
import { and, gte, lt } from "drizzle-orm";

// ─── Font Paths ────────────────────────────────────────────────────────────────
const FONT_DIR = path.join(process.cwd(), "server/fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSansTC-Regular.otf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSansTC-Bold.otf");
const LOGO_PATH = path.join(FONT_DIR, "boxium-logo-pdf.png");

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDD00";

// ─── Image Cache ──────────────────────────────────────────────────────────────
function getImageExtension(_url: string): "png" {
  // Always PNG since fetchImageBuffer converts all formats via sharp
  return "png";
}
const imageCache = new Map<string, Buffer>();

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url || !url.startsWith("http")) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;
  const rawBuf = await new Promise<Buffer | null>((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
  if (!rawBuf) return null;
  // Convert WebP (and any other format) to PNG for PDF/Excel compatibility
  try {
    const pngBuf = await sharp(rawBuf).png().toBuffer();
    imageCache.set(url, pngBuf);
    return pngBuf;
  } catch {
    // Fallback: return raw buffer if sharp fails
    imageCache.set(url, rawBuf);
    return rawBuf;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDateRange(year: number, month: number): { from: Date; to: Date } {
  if (month > 0) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    return { from, to };
  } else {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);
    return { from, to };
  }
}

async function fetchRecords(year: number, month: number) {
  const { from, to } = getDateRange(year, month);
  const db = await getDb();
  const rows = await db
    .select()
    .from(cardInventory)
    .where(and(gte(cardInventory.buyDate, from), lt(cardInventory.buyDate, to)))
    .orderBy(cardInventory.buyDate);
  return rows;
}

function fmtHkd(val: string | null | undefined): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return `HK$${n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function periodLabel(year: number, month: number): string {
  if (month > 0) return `${year}年${month}月`;
  return `${year}年度`;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
export async function generateCardInventoryPdf(year: number, month: number): Promise<Buffer> {
  const rows = await fetchRecords(year, month);
  const label = periodLabel(year, month);

  // Pre-fetch all card images in parallel
  const imageBuffers = await Promise.all(
    rows.map((r) => fetchImageBuffer(r.imageUrl || ""))
  );

  // Load logo
  let logoData: Buffer | null = null;
  try {
    if (fs.existsSync(LOGO_PATH)) logoData = fs.readFileSync(LOGO_PATH);
  } catch { /* skip */ }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register Chinese fonts
    doc.registerFont("NotoTC-Regular", FONT_REGULAR);
    doc.registerFont("NotoTC-Bold", FONT_BOLD);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 40;
    const contentW = pageW - margin * 2;

    // ── Header ──
    // Yellow background bar
    doc.rect(0, 0, pageW, 72).fill(BRAND_YELLOW);
    // Blue logo box
    if (logoData) {
      try {
        doc.image(logoData, margin, 10, { height: 52, fit: [140, 52] });
      } catch {
        // Fallback: draw text logo
        doc.roundedRect(margin, 12, 110, 46, 6).fill(BRAND_BLUE);
        doc.fillColor(BRAND_YELLOW).font("NotoTC-Bold").fontSize(20).text("BOXIUM", margin + 8, 18);
        doc.fillColor(BRAND_BLUE).font("NotoTC-Bold").fontSize(11).text("PTCG", margin + 8, 44);
      }
    } else {
      doc.roundedRect(margin, 12, 110, 46, 6).fill(BRAND_BLUE);
      doc.fillColor(BRAND_YELLOW).font("NotoTC-Bold").fontSize(20).text("BOXIUM", margin + 8, 18);
      doc.fillColor(BRAND_BLUE).font("NotoTC-Bold").fontSize(11).text("PTCG", margin + 8, 44);
    }

    // Title
    doc
      .fillColor(BRAND_BLUE)
      .font("NotoTC-Bold")
      .fontSize(18)
      .text("卡牌買取及賣出記錄", margin + 155, 16);
    doc
      .fillColor(BRAND_BLUE)
      .font("NotoTC-Regular")
      .fontSize(11)
      .text(`報告期間：${label}　　列印日期：${new Date().toLocaleDateString("zh-HK")}　　共 ${rows.length} 筆記錄`, margin + 155, 42);

    // ── Summary Stats ──
    const totalBuy = rows.reduce((s, r) => s + parseFloat(r.buyPriceHkd || "0"), 0);
    const soldRows = rows.filter((r) => r.status === "sold");
    const totalSell = soldRows.reduce((s, r) => s + parseFloat(r.sellPriceHkd || "0"), 0);
    const totalProfit = totalSell - totalBuy;
    const holdingRows = rows.filter((r) => r.status === "holding");

    let sy = 84;
    const statBoxW = (contentW - 30) / 4;
    const stats = [
      { label: "總買取金額 (HKD)", value: fmtHkd(totalBuy.toFixed(2)), color: BRAND_BLUE },
      { label: "總賣出金額 (HKD)", value: fmtHkd(totalSell.toFixed(2)), color: "#16a34a" },
      { label: "毛利 (HKD)", value: fmtHkd(totalProfit.toFixed(2)), color: totalProfit >= 0 ? "#16a34a" : "#dc2626" },
      { label: "持有中", value: `${holdingRows.length} 件`, color: "#d97706" },
    ];
    stats.forEach((stat, i) => {
      const sx = margin + i * (statBoxW + 10);
      doc.roundedRect(sx, sy, statBoxW, 44, 6).fill("#f8f9fa");
      doc.roundedRect(sx, sy, statBoxW, 44, 6).stroke("#e5e7eb");
      doc.fillColor("#6b7280").font("NotoTC-Regular").fontSize(9).text(stat.label, sx + 8, sy + 8, { width: statBoxW - 16 });
      doc.fillColor(stat.color).font("NotoTC-Bold").fontSize(14).text(stat.value, sx + 8, sy + 22, { width: statBoxW - 16 });
    });

    // ── Table ──
    // Image column (40px) + text columns
    // Total col widths = 762 = A4 landscape (841.89) - margin*2 (80)
    const IMG_COL_W = 40;
    const cols = [
      { label: "圖片", width: IMG_COL_W },  // 40
      { label: "日期", width: 60 },          // 60
      { label: "類型", width: 34 },          // 34
      { label: "卡牌/商品名稱", width: 148 }, // 148
      { label: "系列", width: 72 },          // 72
      { label: "等級", width: 50 },          // 50
      { label: "買取金額", width: 72 },      // 72
      { label: "買取來源", width: 68 },      // 68
      { label: "狀態", width: 42 },          // 42
      { label: "賣出金額", width: 66 },      // 66
      { label: "賣出渠道", width: 60 },      // 60
      { label: "備注", width: 50 },          // 50  ← total = 762
    ];

    const tableTop = sy + 60;
    // Dynamic row height based on notes length
    const getRowH = (notes: string | null) => {
      // Notes col is 50px wide (~8 chars/line at 7.5pt)
      const len = (notes || "").length;
      if (len === 0) return 44;
      if (len <= 8) return 44;
      if (len <= 16) return 56;
      if (len <= 24) return 68;
      return 80;
    };

    const drawTableHeader = (y: number) => {
      doc.rect(margin, y, contentW, 22).fill(BRAND_BLUE);
      let cx = margin;
      cols.forEach((col) => {
        doc.fillColor("white").font("NotoTC-Bold").fontSize(8)
          .text(col.label, cx + 4, y + 7, { width: col.width - 8, lineBreak: false });
        cx += col.width;
      });
    };

    drawTableHeader(tableTop);
    let currentPage = 1;
    // Pre-calculate total pages
    let simY = tableTop + 22;
    let totalPages = 1;
    rows.forEach((row) => {
      const rh = getRowH(row.notes);
      if (simY + rh > pageH - margin) { totalPages++; simY = margin + 22; }
      simY += rh;
    });
    const drawFooter = (pageNum: number) => {
      const footerY = pageH - 28;
      doc.moveTo(margin, footerY - 5).lineTo(pageW - margin, footerY - 5).stroke("#e5e7eb");
      doc.fillColor("#9ca3af").font("NotoTC-Regular").fontSize(8)
        .text(
          "BOXIUM PTCG  ·  www.boxium.asia  ·  此報告由系統自動生成，僅供內部財務記錄使用",
          margin, footerY, { width: contentW - 90, align: "center" }
        );
      doc.fillColor("#9ca3af").font("NotoTC-Regular").fontSize(8)
        .text(`第 ${pageNum} 頁 / 共 ${totalPages} 頁`, pageW - margin - 90, footerY, { width: 90, align: "right" });
    };

    let rowY = tableTop + 22;
    rows.forEach((row, idx) => {
      const ROW_H = getRowH(row.notes);
      if (rowY + ROW_H > pageH - margin) {
        drawFooter(currentPage);
        currentPage++;
        doc.addPage({ size: "A4", layout: "landscape" });
        rowY = margin;
        drawTableHeader(rowY);
        rowY += 22;
      }

      const bgColor = idx % 2 === 0 ? "white" : "#f9fafb";
      doc.rect(margin, rowY, contentW, ROW_H).fill(bgColor);
      doc.rect(margin, rowY, contentW, ROW_H).stroke("#e5e7eb");

      // Draw card image
      const imgBuf = imageBuffers[idx];
      const imgX = margin + 3;
      const imgY = rowY + 2;
      const imgH = ROW_H - 4;
      const imgW = IMG_COL_W - 6;
      if (imgBuf) {
        try {
          doc.image(imgBuf, imgX, imgY, { fit: [imgW, imgH], align: "center", valign: "center" });
        } catch {
          doc.rect(imgX, imgY, imgW, imgH).fill("#e5e7eb");
        }
      } else {
        doc.roundedRect(imgX, imgY, imgW, imgH, 3).fill("#e5e7eb");
        doc.fillColor("#9ca3af").font("NotoTC-Regular").fontSize(6)
          .text("無圖", imgX, imgY + imgH / 2 - 4, { width: imgW, align: "center" });
      }

      // Text cells (skip image col)
      const cells = [
        fmtDate(row.buyDate),
        row.itemType === "card" ? "單卡" : "封包",
        row.cardName,
        row.cardSet || "—",
        row.grade || "—",
        row.buyPriceCurrency !== "HKD"
          ? `${row.buyPriceCurrency} ${row.buyPriceOriginal}\n(${fmtHkd(row.buyPriceHkd)})`
          : fmtHkd(row.buyPriceHkd),
        row.buySource || "—",
        row.status === "holding" ? "持有中" : "已賣出",
        row.sellPriceHkd ? fmtHkd(row.sellPriceHkd) : "—",
        row.sellChannel || "—",
        row.notes || "—",
      ];

      let dcx = margin + IMG_COL_W; // skip image col
      cells.forEach((cell, ci) => {
        const colDef = cols[ci + 1]; // +1 to skip image col
        const textColor = ci === 7 ? (row.status === "holding" ? "#d97706" : "#16a34a") : "#111827";
        const textY = rowY + (ROW_H - 14) / 2; // vertically center
        const isNotesCol = ci === cells.length - 1;
        if (isNotesCol) {
          doc.fillColor(textColor).font("NotoTC-Regular").fontSize(7)
            .text(cell, dcx + 3, rowY + 4, { width: colDef.width - 6, lineBreak: true });
        } else {
          doc.fillColor(textColor).font("NotoTC-Regular").fontSize(7.5)
            .text(cell, dcx + 3, textY, { width: colDef.width - 6, ellipsis: true, lineBreak: false });
        }
        dcx += colDef.width;
      });

      rowY += ROW_H;
    });

    if (rows.length === 0) {
      doc.fillColor("#6b7280").font("NotoTC-Regular").fontSize(12)
        .text("此期間無記錄", margin, tableTop + 40, { width: contentW, align: "center" });
    }

    // ── Footer (last page) ──
    drawFooter(currentPage);

    doc.end();
  });
}

// ─── Excel Export ─────────────────────────────────────────────────────────────
export async function generateCardInventoryExcel(year: number, month: number): Promise<Buffer> {
  const rows = await fetchRecords(year, month);
  const label = periodLabel(year, month);

  // Pre-fetch all card images in parallel
  const imageBuffers = await Promise.all(
    rows.map((r) => fetchImageBuffer(r.imageUrl || ""))
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BOXIUM PTCG";
  workbook.created = new Date();

  // ── Sheet 1: Detail Records ──
  const sheet = workbook.addWorksheet("買賣記錄", { views: [{ state: "frozen", ySplit: 5 }] });

  // Logo image (rows 1-3)
  let logoImageId: number | null = null;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuf = fs.readFileSync(LOGO_PATH);
      logoImageId = workbook.addImage({ base64: logoBuf.toString("base64"), extension: "png" });
    }
  } catch { /* skip */ }

  // Logo area (rows 1-3, cols A-C)
  sheet.mergeCells("A1:C3");
  const logoCell = sheet.getCell("A1");
  if (logoImageId !== null) {
    logoCell.value = "";
    logoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_YELLOW.slice(1) } };
    sheet.addImage(logoImageId, "A1:C3");
  } else {
    logoCell.value = "BOXIUM PTCG";
    logoCell.font = { name: "Arial", bold: true, size: 18, color: { argb: "FF" + BRAND_BLUE.slice(1) } };
    logoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_YELLOW.slice(1) } };
    logoCell.alignment = { vertical: "middle", horizontal: "center" };
  }

  // Title (rows 1-2, cols D onwards)
  sheet.mergeCells("D1:L1");
  const titleCell = sheet.getCell("D1");
  titleCell.value = "卡牌買取及賣出記錄";
  titleCell.font = { name: "Arial", bold: true, size: 16, color: { argb: "FF" + BRAND_BLUE.slice(1) } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells("D2:L2");
  const subtitleCell = sheet.getCell("D2");
  subtitleCell.value = `報告期間：${label}　　列印日期：${new Date().toLocaleDateString("zh-HK")}　　共 ${rows.length} 筆記錄`;
  subtitleCell.font = { name: "Arial", size: 10, color: { argb: "FF555555" } };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  sheet.mergeCells("D3:L3");

  // Summary row 4
  const totalBuy = rows.reduce((s, r) => s + parseFloat(r.buyPriceHkd || "0"), 0);
  const soldRows = rows.filter((r) => r.status === "sold");
  const totalSell = soldRows.reduce((s, r) => s + parseFloat(r.sellPriceHkd || "0"), 0);
  const totalProfit = totalSell - totalBuy;
  const holdingRows = rows.filter((r) => r.status === "holding");

  sheet.mergeCells("A4:C4");
  const s1 = sheet.getCell("A4");
  s1.value = `總買取：HK$${totalBuy.toFixed(2)}`;
  s1.font = { bold: true, color: { argb: "FF" + BRAND_BLUE.slice(1) } };
  s1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8F5" } };

  sheet.mergeCells("D4:F4");
  const s2 = sheet.getCell("D4");
  s2.value = `總賣出：HK$${totalSell.toFixed(2)}`;
  s2.font = { bold: true, color: { argb: "FF16a34a" } };
  s2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFdcfce7" } };

  sheet.mergeCells("G4:I4");
  const s3 = sheet.getCell("G4");
  s3.value = `毛利：HK$${totalProfit.toFixed(2)}`;
  s3.font = { bold: true, color: { argb: totalProfit >= 0 ? "FF16a34a" : "FFdc2626" } };
  s3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: totalProfit >= 0 ? "FFdcfce7" : "FFfee2e2" } };

  sheet.mergeCells("J4:L4");
  const s4 = sheet.getCell("J4");
  s4.value = `持有中：${holdingRows.length} 件`;
  s4.font = { bold: true, color: { argb: "FFd97706" } };
  s4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFfef3c7" } };

  // Empty row 5
  sheet.getRow(5).height = 6;

  // Header row 6 (with image column)
  const headers = [
    { key: "image", header: "圖片", width: 14 },
    { key: "buyDate", header: "買取日期", width: 14 },
    { key: "itemType", header: "類型", width: 8 },
    { key: "cardName", header: "卡牌/商品名稱", width: 36 },
    { key: "cardSet", header: "卡牌系列", width: 18 },
    { key: "grade", header: "等級", width: 10 },
    { key: "buyPriceOriginal", header: "買取原始金額", width: 16 },
    { key: "buyPriceCurrency", header: "買取貨幣", width: 10 },
    { key: "buyPriceHkd", header: "買取金額(HKD)", width: 16 },
    { key: "buySource", header: "買取來源", width: 16 },
    { key: "status", header: "狀態", width: 10 },
    { key: "sellDate", header: "賣出日期", width: 14 },
    { key: "sellPriceHkd", header: "賣出金額(HKD)", width: 16 },
    { key: "sellChannel", header: "賣出渠道", width: 16 },
    { key: "profit", header: "毛利(HKD)", width: 14 },
    { key: "notes", header: "備註", width: 24 },
  ];

  sheet.columns = headers.map((h) => ({ key: h.key, width: h.width }));
  const headerRow = sheet.getRow(6);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.header;
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_BLUE.slice(1) } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
  headerRow.height = 24;

  // Data rows (starting at row 7)
  rows.forEach((row, idx) => {
    const buyHkd = parseFloat(row.buyPriceHkd || "0");
    const sellHkd = row.sellPriceHkd ? parseFloat(row.sellPriceHkd) : null;
    const profit = sellHkd !== null ? sellHkd - buyHkd : null;
    const excelRowNum = 7 + idx;

    const dataRow = sheet.getRow(excelRowNum);
    dataRow.getCell(1).value = ""; // image placeholder
    dataRow.getCell(2).value = row.buyDate ? new Date(row.buyDate).toLocaleDateString("zh-HK") : "—";
    dataRow.getCell(3).value = row.itemType === "card" ? "單卡" : "封包";
    dataRow.getCell(4).value = row.cardName;
    dataRow.getCell(5).value = row.cardSet || "";
    dataRow.getCell(6).value = row.grade || "";
    dataRow.getCell(7).value = parseFloat(row.buyPriceOriginal || "0");
    dataRow.getCell(8).value = row.buyPriceCurrency;
    dataRow.getCell(9).value = buyHkd;
    dataRow.getCell(10).value = row.buySource || "";
    dataRow.getCell(11).value = row.status === "holding" ? "持有中" : "已賣出";
    dataRow.getCell(12).value = row.sellDate ? new Date(row.sellDate).toLocaleDateString("zh-HK") : "";
    dataRow.getCell(13).value = sellHkd ?? "";
    dataRow.getCell(14).value = row.sellChannel || "";
    dataRow.getCell(15).value = profit ?? "";
    dataRow.getCell(16).value = row.notes || "";

    const bgColor = idx % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
    dataRow.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle" };
      if (colNum === 11) {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: row.status === "holding" ? "FFd97706" : "FF16a34a" } };
      }
      if (colNum === 15 && profit !== null) {
        cell.font = { name: "Arial", size: 9, bold: true, color: { argb: profit >= 0 ? "FF16a34a" : "FFdc2626" } };
      }
      if ([7, 9, 13, 15].includes(colNum)) cell.numFmt = '#,##0.00';
    });

    // Insert card image into col 1
    const imgBuf = imageBuffers[idx];
    if (imgBuf) {
      try {
        const imgExt = getImageExtension(row.imageUrl || "");
        const imgId = workbook.addImage({ base64: imgBuf.toString("base64"), extension: imgExt });
        const colLetter = "A";
        const imgRange = `${colLetter}${excelRowNum}:${colLetter}${excelRowNum}`;
        sheet.addImage(imgId, imgRange);
      } catch { /* skip if image format unsupported */ }
    }

    dataRow.height = 60; // tall enough for card image
  });

  // Freeze header rows
  sheet.views = [{ state: "frozen", ySplit: 6 }];

  // ── Sheet 2: Monthly Summary ──
  const summarySheet = workbook.addWorksheet("月度總表");
  const monthMap = new Map<string, { buy: number; sell: number; count: number; soldCount: number }>();
  rows.forEach((row) => {
    const d = new Date(row.buyDate);
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, { buy: 0, sell: 0, count: 0, soldCount: 0 });
    const m = monthMap.get(key)!;
    m.buy += parseFloat(row.buyPriceHkd || "0");
    m.count++;
    if (row.status === "sold" && row.sellPriceHkd) {
      m.sell += parseFloat(row.sellPriceHkd);
      m.soldCount++;
    }
  });

  summarySheet.mergeCells("A1:G1");
  const sumTitle = summarySheet.getCell("A1");
  sumTitle.value = `BOXIUM PTCG — 月度買賣總表 (${label})`;
  sumTitle.font = { name: "Arial", bold: true, size: 14, color: { argb: "FF" + BRAND_BLUE.slice(1) } };
  sumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_YELLOW.slice(1) } };
  sumTitle.alignment = { vertical: "middle", horizontal: "center" };
  summarySheet.getRow(1).height = 30;

  const sumHeaders = ["月份", "買取筆數", "總買取(HKD)", "賣出筆數", "總賣出(HKD)", "毛利(HKD)", "持有中筆數"];
  const sumHeaderRow = summarySheet.getRow(2);
  sumHeaders.forEach((h, i) => {
    const cell = sumHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_BLUE.slice(1) } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  summarySheet.getRow(2).height = 22;
  summarySheet.columns = [
    { width: 12 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 14 },
  ];

  let rowIdx = 0;
  let grandBuy = 0, grandSell = 0, grandCount = 0, grandSoldCount = 0;
  Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, m]) => {
      const profit = m.sell - m.buy;
      const holding = m.count - m.soldCount;
      grandBuy += m.buy; grandSell += m.sell; grandCount += m.count; grandSoldCount += m.soldCount;
      const r = summarySheet.addRow([key, m.count, m.buy, m.soldCount, m.sell, profit, holding]);
      const bg = rowIdx % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";
      r.eachCell((cell, ci) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: ci === 1 ? "left" : "right" };
        if ([3, 5, 6].includes(ci)) {
          cell.numFmt = '#,##0.00';
          if (ci === 6) cell.font = { name: "Arial", size: 10, bold: true, color: { argb: profit >= 0 ? "FF16a34a" : "FFdc2626" } };
        }
      });
      r.height = 20;
      rowIdx++;
    });

  const grandProfit = grandSell - grandBuy;
  const grandHolding = grandCount - grandSoldCount;
  const totalRow = summarySheet.addRow(["合計", grandCount, grandBuy, grandSoldCount, grandSell, grandProfit, grandHolding]);

  // ── Insert line chart below summary table ──
  try {
    const sortedEntries = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const chartData = {
      labels: sortedEntries.map(([k]) => k),
      buy: sortedEntries.map(([, m]) => Math.round(m.buy * 100) / 100),
      sell: sortedEntries.map(([, m]) => Math.round(m.sell * 100) / 100),
      year,
      month,
    };
    const chartScriptPath = path.join(process.cwd(), "server/scripts/generate_chart.py");
    const chartPngBuf = execSync(
      `python3 "${chartScriptPath}"`,
      { input: JSON.stringify(chartData), maxBuffer: 4 * 1024 * 1024, timeout: 15000 }
    );
    const chartImgId = workbook.addImage({ base64: Buffer.from(chartPngBuf).toString("base64"), extension: "png" as const });
    const chartStartRow = summarySheet.rowCount + 3;
    summarySheet.addImage(chartImgId, {
      tl: { col: 0, row: chartStartRow - 1 },
      br: { col: 7, row: chartStartRow + 17 },
    } as Parameters<typeof summarySheet.addImage>[1]);
  } catch (e) {
    console.warn("[Export] Chart generation failed:", e);
  }
  totalRow.eachCell((cell, ci) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND_YELLOW.slice(1) } };
    cell.font = { name: "Arial", bold: true, size: 11, color: { argb: "FF" + BRAND_BLUE.slice(1) } };
    cell.alignment = { vertical: "middle", horizontal: ci === 1 ? "left" : "right" };
    if ([3, 5, 6].includes(ci)) cell.numFmt = '#,##0.00';
  });
  totalRow.height = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
