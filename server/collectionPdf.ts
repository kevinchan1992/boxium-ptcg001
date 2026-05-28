/**
 * Collection PDF Export
 * Generates a PDF report of user's card collection using pdfkit
 */

import PDFDocument from "pdfkit";
import { CollectionItem, CollectionStats } from "./collection";
import { storagePut } from "./storage";

function formatHKD(value: number | null): string {
  if (value == null) return "—";
  return `HK$${value.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";
const GRAY = "#6b7280";
const LIGHT_GRAY = "#f3f4f6";
const DARK = "#111827";

export async function generateCollectionPdf(
  userName: string,
  items: CollectionItem[],
  stats: CollectionStats
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: "BOXIUM TCG - My Collection Report",
        Author: userName,
        Subject: "Personal Card Collection",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `collection-exports/${Date.now()}-${randomSuffix}.pdf`;
        const { url } = await storagePut(key, buffer, "application/pdf");
        resolve(url);
      } catch (err) {
        reject(err);
      }
    });
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80; // margins
    const leftMargin = 40;

    // ── Cover / Header ──────────────────────────────────────────────────────────
    // Blue header bar
    doc.rect(0, 0, doc.page.width, 80).fill(BRAND_BLUE);
    doc.fillColor("#FFFFFF").fontSize(22).font("Helvetica-Bold")
      .text("BOXIUM TCG", leftMargin, 20);
    doc.fillColor(BRAND_YELLOW).fontSize(11).font("Helvetica")
      .text("My Collection Report", leftMargin, 48);

    // Right side: date + user
    const exportDate = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
    doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica")
      .text(`${userName}  |  ${exportDate}`, leftMargin, 62, { align: "right", width: pageWidth });

    let y = 100;

    // ── Portfolio Summary ────────────────────────────────────────────────────────
    doc.fillColor(BRAND_BLUE).fontSize(13).font("Helvetica-Bold")
      .text("Portfolio Summary", leftMargin, y);
    y += 20;

    // Summary boxes (2 per row)
    const boxW = (pageWidth - 10) / 2;
    const boxH = 52;
    const summaryData = [
      { label: "Total Market Value", value: formatHKD(stats.totalMarketValue), color: DARK },
      { label: "Total Purchase Cost", value: formatHKD(stats.totalCost), color: DARK },
      {
        label: "Unrealized P&L",
        value: `${formatHKD(stats.totalGain)}  (${formatPct(stats.totalGainPct)})`,
        color: stats.totalGain >= 0 ? GAIN_GREEN : LOSS_RED,
      },
      { label: "Holdings", value: `${stats.totalQuantity} cards  /  ${stats.totalItems} entries`, color: DARK },
    ];

    for (let i = 0; i < summaryData.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = leftMargin + col * (boxW + 10);
      const by = y + row * (boxH + 8);

      doc.rect(bx, by, boxW, boxH).fill(LIGHT_GRAY);
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
        .text(summaryData[i].label, bx + 10, by + 10);
      doc.fillColor(summaryData[i].color).fontSize(14).font("Helvetica-Bold")
        .text(summaryData[i].value, bx + 10, by + 24, { width: boxW - 20 });
    }

    y += 2 * (boxH + 8) + 20;

    // Top 3 Gainers
    if (stats.top3Gainers.length > 0) {
      doc.fillColor(BRAND_BLUE).fontSize(11).font("Helvetica-Bold")
        .text("Top 3 Gainers", leftMargin, y);
      y += 16;
      stats.top3Gainers.forEach((item, idx) => {
        const pctStr = formatPct(item.unrealizedGainPct);
        const gainStr = formatHKD(item.unrealizedGain);
        doc.fillColor(GAIN_GREEN).fontSize(9).font("Helvetica-Bold")
          .text(`${idx + 1}.`, leftMargin, y);
        doc.fillColor(DARK).fontSize(9).font("Helvetica")
          .text(`${item.card.name ?? "Unknown"}  ${item.grader} ${item.grade ?? ""}  ×${item.quantity}`, leftMargin + 16, y);
        doc.fillColor(GAIN_GREEN).fontSize(9).font("Helvetica-Bold")
          .text(`${pctStr}  ${gainStr}`, leftMargin, y, { align: "right", width: pageWidth });
        y += 14;
      });
      y += 10;
    }

    // ── Divider ──────────────────────────────────────────────────────────────────
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).strokeColor(BRAND_BLUE).lineWidth(1).stroke();
    y += 16;

    // ── Collection Details Table ─────────────────────────────────────────────────
    doc.fillColor(BRAND_BLUE).fontSize(13).font("Helvetica-Bold")
      .text("Collection Details", leftMargin, y);
    y += 18;

    // Table header
    const colWidths = [140, 70, 30, 70, 70, 70]; // Card, Grade, Qty, Purchase, Market, P&L
    const colHeaders = ["Card", "Grade", "Qty", "Purchase", "Market", "P&L"];
    const colX = colWidths.reduce<number[]>((acc, w, i) => {
      acc.push(i === 0 ? leftMargin : acc[i - 1] + colWidths[i - 1]);
      return acc;
    }, []);

    // Header row
    doc.rect(leftMargin, y, pageWidth, 18).fill(BRAND_BLUE);
    colHeaders.forEach((h, i) => {
      doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
        .text(h, colX[i] + 4, y + 5, { width: colWidths[i] - 8, align: i >= 3 ? "right" : "left" });
    });
    y += 18;

    // Table rows
    items.forEach((item, idx) => {
      // Page break check
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
        // Re-draw header on new page
        doc.rect(leftMargin, y, pageWidth, 18).fill(BRAND_BLUE);
        colHeaders.forEach((h, i) => {
          doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold")
            .text(h, colX[i] + 4, y + 5, { width: colWidths[i] - 8, align: i >= 3 ? "right" : "left" });
        });
        y += 18;
      }

      const rowBg = idx % 2 === 0 ? "#FFFFFF" : LIGHT_GRAY;
      doc.rect(leftMargin, y, pageWidth, 20).fill(rowBg);

      const gainColor = (item.unrealizedGainPct ?? 0) >= 0 ? GAIN_GREEN : LOSS_RED;
      const cardName = item.card.name ?? "Unknown";
      const seriesLabel = item.card.series ? ` (${item.card.series})` : "";

      // Card name + series
      doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
        .text(cardName + seriesLabel, colX[0] + 4, y + 6, { width: colWidths[0] - 8, ellipsis: true });
      // Grade
      doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
        .text(`${item.grader} ${item.grade ?? ""}`, colX[1] + 4, y + 6, { width: colWidths[1] - 8 });
      // Qty
      doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
        .text(String(item.quantity), colX[2] + 4, y + 6, { width: colWidths[2] - 8, align: "right" });
      // Purchase price
      doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
        .text(formatHKD(item.purchasePrice), colX[3] + 4, y + 6, { width: colWidths[3] - 8, align: "right" });
      // Market price
      doc.fillColor(DARK).fontSize(7.5).font("Helvetica")
        .text(formatHKD(item.marketPrice), colX[4] + 4, y + 6, { width: colWidths[4] - 8, align: "right" });
      // P&L
      doc.fillColor(gainColor).fontSize(7.5).font("Helvetica-Bold")
        .text(formatPct(item.unrealizedGainPct), colX[5] + 4, y + 6, { width: colWidths[5] - 8, align: "right" });

      y += 20;
    });

    // ── Footer ───────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 30;
    doc.rect(0, footerY - 5, doc.page.width, 35).fill(BRAND_BLUE);
    doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica")
      .text("BOXIUM TCG  |  boxiumptcg.com  |  Market prices are for reference only", leftMargin, footerY, {
        align: "center",
        width: pageWidth,
      });

    doc.end();
  });
}
