/**
 * wallPosterGenerator.ts
 * Generates a 1080×1350 "Honour Certificate" poster for Wall of Sighs entries.
 * Design: Obsidian Stone Altar — dark basalt background, golden rune border, glowing gold typography.
 */
import { createCanvas, loadImage, registerFont } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import * as fs from "fs";
import * as path from "path";

// ── Font Registration ─────────────────────────────────────────────────────────
// Rib One for BOXIUM.TCG header (download if not present)
const RIB_ONE_PATH = "/tmp/RibOne-Regular.ttf";
const RIB_ONE_URL = "https://fonts.gstatic.com/s/ribone/v7/2sDcZGJLip7W2J7v7wQZZTAhWvA.ttf";

async function ensureRibOneFont() {
  if (!fs.existsSync(RIB_ONE_PATH)) {
    try {
      const resp = await fetch(RIB_ONE_URL);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(RIB_ONE_PATH, buf);
      }
    } catch { /* skip if download fails */ }
  }
  if (fs.existsSync(RIB_ONE_PATH)) {
    try { registerFont(RIB_ONE_PATH, { family: "Rib One" }); } catch { /* already registered */ }
  }
}

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

const CJK_FONT = "'Noto Sans CJK', 'Noto Sans', Arial, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  grad.addColorStop(0.12, "rgba(212,175,55,0.8)");
  grad.addColorStop(0.5, "#D4AF37");
  grad.addColorStop(0.88, "rgba(212,175,55,0.8)");
  grad.addColorStop(1, "transparent");
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  // thin inner glow line
  ctx.strokeStyle = "rgba(255,220,100,0.15)";
  ctx.lineWidth = 3;
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
    // Gold frame around QR
    ctx.save();
    ctx.strokeStyle = "rgba(212,175,55,0.7)";
    ctx.lineWidth = 2;
    roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 8);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(img, x, y, size, size);
  } catch {
    ctx.save();
    ctx.fillStyle = "#1E1E22";
    roundRect(ctx, x - 10, y - 10, size + 20, size + 20, 8);
    ctx.fill();
    ctx.restore();
  }
}

// Draw a glowing rune symbol (Elder Futhark style) at position
function drawRune(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 60, size / 60);
  ctx.strokeStyle = `rgba(212,175,55,${opacity})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `rgba(212,175,55,${opacity * 0.8})`;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  // Tiwaz rune: ↑ with crossbars
  ctx.moveTo(0, 30); ctx.lineTo(30, -30); ctx.lineTo(60, 30);
  ctx.moveTo(10, 5); ctx.lineTo(50, 5);
  ctx.stroke();
  ctx.restore();
}

function drawOthalaRune(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 60, size / 60);
  ctx.strokeStyle = `rgba(14,165,233,${opacity})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(14,165,233,${opacity * 0.8})`;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  // Othala: diamond with legs
  ctx.moveTo(30, 0); ctx.lineTo(60, 30); ctx.lineTo(30, 60); ctx.lineTo(0, 30); ctx.closePath();
  ctx.moveTo(0, 30); ctx.lineTo(-10, 55);
  ctx.moveTo(60, 30); ctx.lineTo(70, 55);
  ctx.stroke();
  ctx.restore();
}

// ── Main Export ───────────────────────────────────────────────────────────────
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

export async function generateWallPoster(data: WallPosterData): Promise<Buffer> {
  await ensureRibOneFont();

  const W = 1080, H = 1350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── 1. Background: Deep Obsidian Stone ───────────────────────────────────────
  // Base dark fill
  ctx.fillStyle = "#0D0D10";
  ctx.fillRect(0, 0, W, H);

  // Aurora radial gradient overlay
  const auroraGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.7);
  auroraGrad.addColorStop(0, "rgba(20,184,166,0.13)");
  auroraGrad.addColorStop(0.4, "rgba(14,165,233,0.08)");
  auroraGrad.addColorStop(1, "rgba(13,13,16,0)");
  ctx.fillStyle = auroraGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle stone texture (fine grid)
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 36) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // ── 2. Double Gold Border ────────────────────────────────────────────────────
  // Outer border
  ctx.save();
  const outerBorderGrad = ctx.createLinearGradient(0, 0, W, H);
  outerBorderGrad.addColorStop(0, "#8B6914");
  outerBorderGrad.addColorStop(0.3, "#D4AF37");
  outerBorderGrad.addColorStop(0.5, "#F5D060");
  outerBorderGrad.addColorStop(0.7, "#D4AF37");
  outerBorderGrad.addColorStop(1, "#8B6914");
  ctx.strokeStyle = outerBorderGrad;
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, W - 36, H - 36, 18);
  ctx.stroke();
  ctx.restore();

  // Inner border (thinner)
  ctx.save();
  ctx.strokeStyle = "rgba(212,175,55,0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, 30, 30, W - 60, H - 60, 14);
  ctx.stroke();
  ctx.restore();

  // ── 3. Corner Runes ──────────────────────────────────────────────────────────
  drawRune(ctx, 38, 38, 44, 0.55);
  // top-right: mirror
  ctx.save(); ctx.translate(W - 38, 38); ctx.scale(-1, 1); drawRune(ctx, 0, 0, 44, 0.55); ctx.restore();
  drawOthalaRune(ctx, 38, H - 90, 44, 0.45);
  ctx.save(); ctx.translate(W - 38, H - 90); ctx.scale(-1, 1); drawOthalaRune(ctx, 0, 0, 44, 0.45); ctx.restore();

  // ── 4. Header: BOXIUM · TCG (Rib One) ────────────────────────────────────────
  ctx.save();
  const ribOneAvailable = fs.existsSync(RIB_ONE_PATH);
  ctx.font = `bold 32px ${ribOneAvailable ? "'Rib One', " : ""}${CJK_FONT}`;
  ctx.textAlign = "center";
  // Gold gradient text simulation via shadow glow
  ctx.shadowColor = "rgba(212,175,55,0.6)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#D4AF37";
  ctx.fillText("BOXIUM · TCG", W / 2, 92);
  ctx.restore();

  drawGoldDivider(ctx, 116);

  // ── 5. Title: 嘆息之牆 ────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(212,175,55,0.4)";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#F0E6C8";
  ctx.font = `bold 58px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("嘆息之牆", W / 2, 192);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(180,160,100,0.7)";
  ctx.font = `16px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("THE WALL OF SIGHS  ·  HONOUR CERTIFICATE", W / 2, 228);
  ctx.restore();

  drawGoldDivider(ctx, 255);

  // ── 6. Recipient ─────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "rgba(160,140,80,0.8)";
  ctx.font = `15px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("茲 證 明", W / 2, 300);
  ctx.restore();

  // Giant glowing gold name
  ctx.save();
  const nameGrad = ctx.createLinearGradient(W / 2 - 200, 0, W / 2 + 200, 0);
  nameGrad.addColorStop(0, "#C9A84C");
  nameGrad.addColorStop(0.4, "#F5D060");
  nameGrad.addColorStop(0.6, "#FFE88A");
  nameGrad.addColorStop(1, "#C9A84C");
  ctx.fillStyle = nameGrad;
  ctx.shadowColor = "rgba(212,175,55,0.7)";
  ctx.shadowBlur = 28;
  ctx.font = `bold 52px ${CJK_FONT}`;
  ctx.textAlign = "center";
  const name = data.displayName.length > 14 ? data.displayName.slice(0, 14) + "…" : data.displayName;
  ctx.fillText(name, W / 2, 368);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(140,120,70,0.75)";
  ctx.font = `15px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("此生有幸，得瞻神蹟", W / 2, 400);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(160,140,80,0.6)";
  ctx.font = `14px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("已成功登上嘆息之牆，令全網 TCG 玩家為之嘆息", W / 2, 428);
  ctx.restore();

  drawGoldDivider(ctx, 452);

  // ── 7. Total Value ────────────────────────────────────────────────────────────
  const valueStr = `HKD ${data.totalValueHKD.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  ctx.save();
  ctx.fillStyle = "rgba(140,120,70,0.7)";
  ctx.font = `13px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("VAULT TOTAL VALUE", W / 2, 492);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.15)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#F0E6C8";
  ctx.font = `bold 60px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(valueStr, W / 2, 564);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#C9A84C";
  ctx.shadowColor = "rgba(212,175,55,0.5)";
  ctx.shadowBlur = 10;
  ctx.font = `bold 20px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${data.sighs.toLocaleString()} 次嘆息`, W / 2, 600);
  ctx.restore();

  drawGoldDivider(ctx, 626);

  // ── 8. Crown Jewel Card ───────────────────────────────────────────────────────
  let cardBottomY = 650;
  if (data.topCardImageUrl) {
    const cardImg = await fetchImage(data.topCardImageUrl);
    if (cardImg) {
      const cardW = 250, cardH = 350;
      const cardX = (W - cardW) / 2;
      const cardY = 650;

      // Deep 3D shadow
      ctx.save();
      ctx.shadowColor = "rgba(212,175,55,0.4)";
      ctx.shadowBlur = 55;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = "rgba(0,0,0,0.01)";
      roundRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fill();
      ctx.restore();

      // Dark shadow layer
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = "rgba(0,0,0,0.01)";
      roundRect(ctx, cardX + 6, cardY + 10, cardW - 12, cardH, 14);
      ctx.fill();
      ctx.restore();

      // Card image clipped with rounded corners
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.clip();
      ctx.drawImage(cardImg, cardX, cardY, cardW, cardH);
      ctx.restore();

      // PSA 10 gold border
      ctx.save();
      const cardBorderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      cardBorderGrad.addColorStop(0, "#8B6914");
      cardBorderGrad.addColorStop(0.25, "#D4AF37");
      cardBorderGrad.addColorStop(0.5, "#F5D060");
      cardBorderGrad.addColorStop(0.75, "#D4AF37");
      cardBorderGrad.addColorStop(1, "#8B6914");
      ctx.strokeStyle = cardBorderGrad;
      ctx.lineWidth = 3;
      roundRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.stroke();
      ctx.restore();

      // Inner gold glow border
      ctx.save();
      ctx.strokeStyle = "rgba(255,220,100,0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, cardX + 4, cardY + 4, cardW - 8, cardH - 8, 11);
      ctx.stroke();
      ctx.restore();

      cardBottomY = cardY + cardH + 20;
    }
  }

  // Card info
  if (data.topCardName) {
    ctx.save();
    ctx.fillStyle = "rgba(140,120,70,0.7)";
    ctx.font = `12px ${CJK_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("CROWN JEWEL", W / 2, cardBottomY + 8);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#E8D8A0";
    ctx.font = `bold 22px ${CJK_FONT}`;
    ctx.textAlign = "center";
    const cardName = data.topCardName.length > 26 ? data.topCardName.slice(0, 26) + "…" : data.topCardName;
    ctx.fillText(cardName, W / 2, cardBottomY + 40);
    ctx.restore();

    if (data.topCardGrader && data.topCardGrade) {
      ctx.save();
      ctx.fillStyle = "#C9A84C";
      ctx.shadowColor = "rgba(212,175,55,0.5)";
      ctx.shadowBlur = 8;
      ctx.font = `bold 16px ${CJK_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`${data.topCardGrader} ${data.topCardGrade}`, W / 2, cardBottomY + 66);
      ctx.restore();
    }

    if (data.topCardValueHKD && data.topCardValueHKD > 0) {
      ctx.save();
      ctx.fillStyle = "#F0E6C8";
      ctx.font = `bold 20px ${CJK_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(`HKD ${data.topCardValueHKD.toLocaleString("en-HK", { minimumFractionDigits: 2 })}`, W / 2, cardBottomY + 94);
      ctx.restore();
    }
  }

  // ── 9. Footer ─────────────────────────────────────────────────────────────────
  const footerY = H - 148;
  drawGoldDivider(ctx, footerY);

  // QR code (right side)
  const qrSize = 82;
  const qrX = W - 88 - qrSize;
  const qrY = footerY + 22;
  await drawQRCode(ctx, data.wallUrl, qrX, qrY, qrSize);

  // Footer text (left side)
  ctx.save();
  ctx.fillStyle = "#D4AF37";
  ctx.shadowColor = "rgba(212,175,55,0.4)";
  ctx.shadowBlur = 8;
  ctx.font = `bold 17px ${CJK_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("boxium.asia", 80, footerY + 46);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(140,120,70,0.7)";
  ctx.font = `13px ${CJK_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("嘆息之牆 · Wall of Sighs", 80, footerY + 70);
  ctx.fillText("諸神殿堂管理處", 80, footerY + 90);
  ctx.restore();

  // Date (center bottom)
  const dateStr = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
  ctx.save();
  ctx.fillStyle = "rgba(120,100,60,0.6)";
  ctx.font = `12px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(dateStr, W / 2, H - 28);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
