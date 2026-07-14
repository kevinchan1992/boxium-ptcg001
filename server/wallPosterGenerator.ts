/**
 * wallPosterGenerator.ts
 * Generates a 1080×1350 "Honour Certificate" poster for Wall of Sighs entries.
 * Uses node-canvas with Noto Sans CJK for Chinese text rendering.
 */
import { createCanvas, loadImage, registerFont } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import * as fs from "fs";

// Register fonts (same as shareCardGenerator)
try {
  registerFont("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf", { family: "Noto Sans" });
  registerFont("/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf", { family: "Noto Sans", weight: "bold" });
} catch { /* already registered */ }
try {
  if (fs.existsSync("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")) {
    registerFont("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", { family: "Noto Sans CJK" });
    registerFont("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", { family: "Noto Sans CJK", weight: "bold" });
  } else if (fs.existsSync("/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf")) {
    registerFont("/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf", { family: "Noto Sans CJK" });
    registerFont("/usr/share/fonts/truetype/noto/NotoSansCJKtc-Bold.otf", { family: "Noto Sans CJK", weight: "bold" });
  }
} catch { /* CJK fonts not available */ }

const FONT = "'Noto Sans CJK', 'Noto Sans', Arial, sans-serif";

export interface WallPosterData {
  displayName: string;
  totalValueHKD: number;
  sighs: number;
  topCardName?: string;
  topCardImageUrl?: string;
  topCardGrade?: string;
  topCardGrader?: string;
  topCardValueHKD?: number;
  wallUrl: string;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawGoldDivider(ctx: CanvasRenderingContext2D, y: number, x1 = 80, x2 = 1000) {
  const grad = ctx.createLinearGradient(x1, y, x2, y);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.15, "#C9A84C");
  grad.addColorStop(0.85, "#C9A84C");
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

async function fetchImage(url: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const rawBuf = Buffer.from(await resp.arrayBuffer());
    try {
      const sharp = (await import("sharp")).default;
      const pngBuf = await sharp(rawBuf).png().toBuffer();
      return loadImage(pngBuf);
    } catch {
      return loadImage(rawBuf);
    }
  } catch {
    return null;
  }
}

async function drawQRCode(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  try {
    const QRCode = await import("qrcode");
    const dataUrl = await QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: "#1A1A1A", light: "#FFFFFF" } });
    const img = await loadImage(dataUrl);
    ctx.save();
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 8);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#E5E5E5";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(img, x, y, size, size);
  } catch {
    ctx.save();
    ctx.fillStyle = "#F5F5F3";
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 8);
    ctx.fill();
    ctx.restore();
  }
}

export async function generateWallPoster(data: WallPosterData): Promise<Buffer> {
  const W = 1080, H = 1350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── Background: off-white luxury paper ──────────────────────────
  ctx.fillStyle = "#FAFAF8";
  ctx.fillRect(0, 0, W, H);

  // Subtle texture overlay (light grid)
  ctx.save();
  ctx.strokeStyle = "rgba(200,168,76,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // ── Outer gold border ────────────────────────────────────────────
  ctx.save();
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, "#C9A84C");
  borderGrad.addColorStop(0.5, "#F0D080");
  borderGrad.addColorStop(1, "#C9A84C");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  roundRect(ctx, 20, 20, W - 40, H - 40, 16);
  ctx.stroke();
  ctx.restore();

  // Inner thin border
  ctx.save();
  ctx.strokeStyle = "rgba(201,168,76,0.3)";
  ctx.lineWidth = 1;
  roundRect(ctx, 32, 32, W - 64, H - 64, 12);
  ctx.stroke();
  ctx.restore();

  // ── Header: BOXIUM logo area ─────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `bold 28px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("BOXIUM · TCG", W / 2, 90);
  ctx.restore();

  drawGoldDivider(ctx, 110);

  // ── Title: 嘆息之牆 ───────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `bold 52px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("嘆息之牆", W / 2, 180);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#737373";
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("THE WALL OF SIGHS · HONOUR CERTIFICATE", W / 2, 215);
  ctx.restore();

  drawGoldDivider(ctx, 240);

  // ── Recipient name ───────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "#737373";
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("茲證明", W / 2, 285);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `bold 44px ${FONT}`;
  ctx.textAlign = "center";
  // Truncate long names
  const name = data.displayName.length > 16 ? data.displayName.slice(0, 16) + "…" : data.displayName;
  ctx.fillText(name, W / 2, 345);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#737373";
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("已成功登上嘆息之牆，令全網 TCG 玩家為之嘆息", W / 2, 385);
  ctx.restore();

  drawGoldDivider(ctx, 410);

  // ── Total value display ──────────────────────────────────────────
  const valueStr = `HKD ${data.totalValueHKD.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  ctx.save();
  ctx.fillStyle = "#737373";
  ctx.font = `14px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("VAULT TOTAL VALUE", W / 2, 455);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `bold 56px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(valueStr, W / 2, 525);
  ctx.restore();

  // Sighs count
  ctx.save();
  ctx.fillStyle = "#C9A84C";
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${data.sighs.toLocaleString()} 次嘆息`, W / 2, 565);
  ctx.restore();

  drawGoldDivider(ctx, 590);

  // ── Top card section ─────────────────────────────────────────────
  let cardImgY = 620;
  if (data.topCardImageUrl) {
    const cardImg = await fetchImage(data.topCardImageUrl);
    if (cardImg) {
      const cardW = 260, cardH = 360;
      const cardX = (W - cardW) / 2;

      // Card shadow
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      roundRect(ctx, cardX - 4, cardImgY - 4, cardW + 8, cardH + 8, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.restore();

      // Card image clipped
      ctx.save();
      roundRect(ctx, cardX, cardImgY, cardW, cardH, 12);
      ctx.clip();
      ctx.drawImage(cardImg, cardX, cardImgY, cardW, cardH);
      ctx.restore();

      // Gold border on card
      ctx.save();
      ctx.strokeStyle = "#C9A84C";
      ctx.lineWidth = 2;
      roundRect(ctx, cardX, cardImgY, cardW, cardH, 12);
      ctx.stroke();
      ctx.restore();

      cardImgY += cardH + 20;
    }
  }

  // Top card info
  if (data.topCardName) {
    ctx.save();
    ctx.fillStyle = "#737373";
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("CROWN JEWEL", W / 2, cardImgY + 10);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#1A1A1A";
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = "center";
    const cardName = data.topCardName.length > 28 ? data.topCardName.slice(0, 28) + "…" : data.topCardName;
    ctx.fillText(cardName, W / 2, cardImgY + 42);
    ctx.restore();

    if (data.topCardGrader && data.topCardGrade) {
      ctx.save();
      ctx.fillStyle = "#C9A84C";
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`${data.topCardGrader} ${data.topCardGrade}`, W / 2, cardImgY + 68);
      ctx.restore();
    }

    if (data.topCardValueHKD && data.topCardValueHKD > 0) {
      ctx.save();
      ctx.fillStyle = "#1A1A1A";
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`HKD ${data.topCardValueHKD.toLocaleString("en-HK", { minimumFractionDigits: 2 })}`, W / 2, cardImgY + 96);
      ctx.restore();
    }
  }

  // ── Footer ───────────────────────────────────────────────────────
  const footerY = H - 140;
  drawGoldDivider(ctx, footerY);

  // QR code
  const qrSize = 80;
  const qrX = W - 80 - qrSize;
  const qrY = footerY + 20;
  await drawQRCode(ctx, data.wallUrl, qrX, qrY, qrSize);

  // Footer text
  ctx.save();
  ctx.fillStyle = "#1A1A1A";
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("boxium.asia", 80, footerY + 45);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#737373";
  ctx.font = `13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("嘆息之牆 · Wall of Sighs", 80, footerY + 68);
  ctx.fillText("掃碼瞻仰更多神級收藏", 80, footerY + 88);
  ctx.restore();

  // Date
  const dateStr = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
  ctx.save();
  ctx.fillStyle = "#B0B0B0";
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(dateStr, W / 2, H - 30);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
