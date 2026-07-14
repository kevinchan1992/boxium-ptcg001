/**
 * shareCardGenerator.ts
 * Server-side Canvas rendering for the 1080×1080 share card.
 * Uses node-canvas to draw directly — no DOM, no CSS, no CORS issues.
 */
import { createCanvas, loadImage, registerFont } from "canvas";
import type { Canvas, CanvasRenderingContext2D } from "canvas";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────
export interface ShareCardData {
  totalMarketValue: number;
  totalGain: number;
  totalGainPct: number;
  totalQuantity: number;
  currency: string;
  topCards: Array<{
    cardName: string;
    imageUrl: string | null;
    grader: string;
    grade: string | null;
    marketPrice: number | null;
    unrealizedGainPct: number | null;
  }>;
  shareUrl: string;
  logoBase64?: string; // optional pre-encoded logo
}

// ─── Helpers ──────────────────────────────────────────────────
function fmtCurrency(val: number, currency = "HKD"): string {
  return `${currency} ${val.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(val: number): string {
  return `${val >= 0 ? "▲" : "▼"} ${Math.abs(val).toFixed(1)}%`;
}

// Draw rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draw gold gradient divider line
function drawDivider(ctx: CanvasRenderingContext2D, y: number, x1 = 60, x2 = 1020) {
  const grad = ctx.createLinearGradient(x1, y, x2, y);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.2, "#C9A84C");
  grad.addColorStop(0.8, "#C9A84C");
  grad.addColorStop(1, "transparent");
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

// Fetch image from URL with timeout, convert to PNG via sharp (handles WebP/AVIF)
async function fetchImage(url: string): Promise<ReturnType<typeof loadImage> | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const rawBuf = Buffer.from(await resp.arrayBuffer());
    // Convert to PNG using sharp so node-canvas can handle WebP/AVIF/etc.
    let pngBuf: Buffer;
    try {
      const sharp = (await import("sharp")).default;
      pngBuf = await sharp(rawBuf).png().toBuffer();
    } catch {
      // sharp failed — try raw buffer directly (JPEG/PNG may work)
      pngBuf = rawBuf;
    }
    return loadImage(pngBuf);
  } catch {
    return null;
  }
}

// Draw QR code using a simple pixel-based approach via qrcode library
async function drawQRCode(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, size: number
) {
  try {
    // Use qrcode npm package
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: "#1A1A1A", light: "#FFFFFF" },
    });
    const img = await loadImage(dataUrl);
    // White background
    ctx.save();
    roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 8);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#EAEAEA";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(img, x, y, size, size);
  } catch (e) {
    // fallback: draw placeholder
    ctx.save();
    ctx.fillStyle = "#F3F4F6";
    roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 8);
    ctx.fill();
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("QR", x + size / 2, y + size / 2);
    ctx.restore();
  }
}

// ─── Main Generator ───────────────────────────────────────────
export async function generateShareCard(data: ShareCardData): Promise<Buffer> {
  const W = 1080, H = 1080;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const gainPositive = data.totalGain >= 0;
  const gainColor = gainPositive ? "#047857" : "#dc2626";
  const gainBg = gainPositive ? "#ECFDF5" : "#FEF2F2";
  const gainBorder = gainPositive ? "#A7F3D0" : "#FECACA";
  const currency = data.currency ?? "HKD";

  // ── Background ──────────────────────────────────────────────
  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, W, H);

  // Diagonal texture
  ctx.save();
  ctx.strokeStyle = "rgba(201,168,76,0.04)";
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 41) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Outer black border
  ctx.save();
  ctx.strokeStyle = "#1A1A1A";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  ctx.restore();

  // Inner gold border
  ctx.save();
  ctx.strokeStyle = "#C9A84C";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.restore();

  // ── BLOCK 1: HEADER (top: 28, height: 148) ──────────────────
  const LOGO_PATH = path.join(process.cwd(), "server", "assets", "boxium-logo-black.png");

  // Try to load logo
  let logoImg: Awaited<ReturnType<typeof loadImage>> | null = null;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      logoImg = await loadImage(LOGO_PATH);
    } else if (data.logoBase64) {
      logoImg = await loadImage(data.logoBase64);
    }
  } catch { /* skip */ }

  const HEADER_TOP = 38;
  let logoRight = 60; // track where logo ends for VAULT badge

  if (logoImg) {
    const logoH = 52;
    const logoW = Math.round((logoImg.width / logoImg.height) * logoH);
    ctx.drawImage(logoImg, 60, HEADER_TOP, logoW, logoH);
    logoRight = 60 + logoW + 14;
  } else {
    // Text fallback
    ctx.save();
    ctx.font = "bold 36px Georgia, serif";
    ctx.fillStyle = "#1A1A1A";
    ctx.fillText("BOXIUM", 60, HEADER_TOP + 38);
    logoRight = 60 + ctx.measureText("BOXIUM").width + 14;
    ctx.restore();
  }

  // VAULT black capsule badge
  const vaultText = "VAULT";
  ctx.save();
  ctx.font = "bold 11px Arial, sans-serif";
  const vaultW = ctx.measureText(vaultText).width + 26;
  const vaultH = 24;
  const vaultY = HEADER_TOP + 14;
  roundRect(ctx, logoRight, vaultY, vaultW, vaultH, 5);
  ctx.fillStyle = "#1A1A1A";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(vaultText, logoRight + 13, vaultY + 16);
  ctx.restore();

  // WWW.BOXIUM.ASIA
  ctx.save();
  ctx.font = "600 10px Arial, sans-serif";
  ctx.fillStyle = "#888888";
  ctx.textAlign = "left";
  ctx.fillText("W W W . B O X I U M . A S I A", 60, HEADER_TOP + 76);
  ctx.restore();

  // TCG PORTFOLIO CERTIFICATE
  ctx.save();
  ctx.font = "700 11px Arial, sans-serif";
  ctx.fillStyle = "#C9A84C";
  ctx.textAlign = "left";
  ctx.fillText("TCG PORTFOLIO CERTIFICATE", 60, HEADER_TOP + 100);
  ctx.restore();

  // Date (right side)
  const dateStr = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
  ctx.save();
  ctx.font = "11px Arial, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, W - 60, HEADER_TOP + 20);
  ctx.restore();

  // Divider after header
  drawDivider(ctx, 196);

  // ── BLOCK 2: PORTFOLIO VALUE (top: 208, height: 260) ────────
  const PV_TOP = 208;

  // Label
  ctx.save();
  ctx.font = "600 11px Arial, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.textAlign = "left";
  ctx.fillText("PORTFOLIO VALUE", 60, PV_TOP + 16);
  ctx.restore();

  // Big number — 72px mono
  ctx.save();
  ctx.font = "900 72px 'Courier New', monospace";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "left";
  ctx.fillText(fmtCurrency(data.totalMarketValue, currency), 60, PV_TOP + 100);
  ctx.restore();

  // ROI badge
  const roiText = fmtPct(data.totalGainPct);
  ctx.save();
  ctx.font = "900 30px 'Courier New', monospace";
  const roiW = ctx.measureText(roiText).width + 40;
  const roiH = 52;
  const roiY = PV_TOP + 118;
  roundRect(ctx, 60, roiY, roiW, roiH, 100);
  ctx.fillStyle = gainBg;
  ctx.fill();
  ctx.strokeStyle = gainBorder;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = gainColor;
  ctx.textAlign = "left";
  ctx.fillText(roiText, 60 + 20, roiY + 36);
  ctx.restore();

  // Profit amount
  const profitText = `${gainPositive ? "+" : ""}${fmtCurrency(data.totalGain, currency)}`;
  ctx.save();
  ctx.font = "800 30px 'Courier New', monospace";
  ctx.fillStyle = gainColor;
  ctx.textAlign = "left";
  ctx.fillText(profitText, 60 + roiW + 20, roiY + 32);
  ctx.restore();

  // Unrealized profit label
  ctx.save();
  ctx.font = "10px Arial, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.textAlign = "left";
  ctx.fillText(`UNREALIZED PROFIT · ${data.totalQuantity} CARDS`, 60 + roiW + 20, roiY + 50);
  ctx.restore();

  // Divider after portfolio
  drawDivider(ctx, 482);

  // ── BLOCK 3: TOP 3 CARDS (top: 492, height: 390) ────────────
  const CARDS_TOP = 492;
  const CARD_W = 300;
  const CARD_GAP = 30;
  const CARD_IMG_H = 200;
  const rankColors = ["#C9A84C", "#A0A0A0", "#CD7F32"];

  // Section label
  ctx.save();
  ctx.font = "700 9px Arial, sans-serif";
  ctx.fillStyle = "#C9A84C";
  ctx.textAlign = "left";
  ctx.fillText("TOP 3 珍藏 · FINEST HOLDINGS", 60, CARDS_TOP + 14);
  ctx.restore();

  // Load card images in parallel
  const cardImages = await Promise.all(
    data.topCards.slice(0, 3).map(async (card) => {
      if (!card.imageUrl) return null;
      return fetchImage(card.imageUrl);
    })
  );

  for (let i = 0; i < 3; i++) {
    const card = data.topCards[i];
    const cardX = 60 + i * (CARD_W + CARD_GAP);
    const imgY = CARDS_TOP + 26;
    const rankColor = rankColors[i] ?? "#C9A84C";

    // Card image container
    ctx.save();
    roundRect(ctx, cardX, imgY, CARD_W, CARD_IMG_H, 10);
    ctx.fillStyle = "#E8E6E1";
    ctx.fill();
    ctx.strokeStyle = rankColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card image
    const img = cardImages[i];
    if (img) {
      ctx.save();
      roundRect(ctx, cardX, imgY, CARD_W, CARD_IMG_H, 10);
      ctx.clip();
      // Cover fit
      const imgAspect = img.width / img.height;
      const boxAspect = CARD_W / CARD_IMG_H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > boxAspect) {
        sw = img.height * boxAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / boxAspect;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, cardX, imgY, CARD_W, CARD_IMG_H);
      ctx.restore();
    }

    // Foil overlay
    const foil = ctx.createLinearGradient(cardX, imgY, cardX + CARD_W, imgY + CARD_IMG_H);
    foil.addColorStop(0, "rgba(255,255,255,0.3)");
    foil.addColorStop(0.4, "rgba(255,255,255,0.05)");
    foil.addColorStop(0.7, "rgba(255,220,100,0.1)");
    foil.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(ctx, cardX, imgY, CARD_W, CARD_IMG_H, 10);
    ctx.fillStyle = foil;
    ctx.fill();
    ctx.restore();

    // Rank badge
    ctx.save();
    ctx.beginPath();
    ctx.arc(cardX + 22, imgY + 22, 14, 0, Math.PI * 2);
    ctx.fillStyle = rankColor;
    ctx.fill();
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), cardX + 22, imgY + 27);
    ctx.restore();

    if (!card) continue;

    // Grade badge
    const gradeText = card.grade
      ? (card.grade.toUpperCase().startsWith(card.grader?.toUpperCase()) ? card.grade : `${card.grader?.toUpperCase()} ${card.grade}`)
      : card.grader?.toUpperCase() ?? "";
    const gradeY = imgY + CARD_IMG_H + 10;
    ctx.save();
    ctx.font = "700 10px Arial, sans-serif";
    const gradeW = ctx.measureText(gradeText).width + 20;
    roundRect(ctx, cardX, gradeY, gradeW, 20, 4);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#E5E7EB";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Grade dot
    const dotColor = { PSA: "#dc2626", CGC: "#2563eb", BGS: "#7c3aed" }[card.grader?.toUpperCase() as string] ?? "#9CA3AF";
    ctx.beginPath();
    ctx.arc(cardX + 8, gradeY + 10, 3, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "left";
    ctx.fillText(gradeText, cardX + 14, gradeY + 14);
    ctx.restore();

    // Card name (2 lines max)
    const nameY = gradeY + 30;
    ctx.save();
    ctx.font = "700 13px Arial, sans-serif";
    ctx.fillStyle = "#1A1A1A";
    ctx.textAlign = "left";
    // Simple word wrap
    const maxW = CARD_W;
    const words = card.cardName.split(" ");
    let line1 = "", line2 = "";
    let lineIdx = 0;
    for (const word of words) {
      const test = (lineIdx === 0 ? line1 : line2) + (lineIdx === 0 && line1 ? " " : lineIdx === 1 && line2 ? " " : "") + word;
      if (ctx.measureText(test).width > maxW && lineIdx === 0) {
        lineIdx = 1;
        line2 = word;
      } else if (lineIdx === 0) {
        line1 = test;
      } else {
        const t2 = line2 + (line2 ? " " : "") + word;
        if (ctx.measureText(t2).width > maxW) {
          line2 = line2 + "…";
          break;
        }
        line2 = t2;
      }
    }
    ctx.fillText(line1, cardX, nameY);
    if (line2) ctx.fillText(line2, cardX, nameY + 18);
    ctx.restore();

    // Market value
    if (card.marketPrice != null) {
      const mvY = nameY + (line2 ? 42 : 26);
      ctx.save();
      ctx.font = "900 18px 'Courier New', monospace";
      ctx.fillStyle = "#1A1A1A";
      ctx.textAlign = "left";
      ctx.fillText(fmtCurrency(card.marketPrice, currency), cardX, mvY);
      ctx.restore();

      // Gain %
      if (card.unrealizedGainPct != null) {
        ctx.save();
        ctx.font = "900 15px Arial, sans-serif";
        ctx.fillStyle = card.unrealizedGainPct >= 0 ? "#047857" : "#dc2626";
        ctx.textAlign = "left";
        ctx.fillText(fmtPct(card.unrealizedGainPct), cardX, mvY + 22);
        ctx.restore();
      }
    }
  }

  // Divider before footer
  drawDivider(ctx, 878);

  // ── BLOCK 4: FOOTER (top: 888, height: 162) ─────────────────
  const FOOTER_TOP = 888;

  // Left: CTA
  ctx.save();
  ctx.font = "13px Arial, sans-serif";
  ctx.fillStyle = "#4B4B4B";
  ctx.textAlign = "left";
  ctx.fillText("Create your vault at", 60, FOOTER_TOP + 18);
  ctx.restore();

  ctx.save();
  ctx.font = "900 22px Georgia, serif";
  ctx.fillStyle = "#1A1A1A";
  ctx.textAlign = "left";
  ctx.fillText("boxium.asia", 60, FOOTER_TOP + 48);
  ctx.restore();

  ctx.save();
  ctx.font = "9px Arial, sans-serif";
  ctx.fillStyle = "#9CA3AF";
  ctx.textAlign = "left";
  ctx.fillText("TCG PORTFOLIO MANAGEMENT", 60, FOOTER_TOP + 68);
  ctx.restore();

  // Right: QR Code
  const QR_SIZE = 100;
  const qrX = W - 60 - QR_SIZE;
  const qrY = FOOTER_TOP + 4;
  await drawQRCode(ctx, data.shareUrl, qrX, qrY, QR_SIZE);

  // QR label
  ctx.save();
  ctx.font = "9px Arial, sans-serif";
  ctx.fillStyle = "#6B7280";
  ctx.textAlign = "center";
  ctx.fillText("揃碼查看完整收藏", qrX + QR_SIZE / 2, qrY + QR_SIZE + 18);
  ctx.fillText("Scan to View Vault", qrX + QR_SIZE / 2, qrY + QR_SIZE + 32);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
