/**
 * wallPosterGenerator.ts
 * Generates a 1080×1350 "Honour Certificate" poster for Wall of Sighs entries.
 * Design: Nordic White Sanctuary — alabaster marble background, champagne gold typography, dawn-light glow.
 */
import { createCanvas, loadImage, registerFont } from "canvas";
import type { CanvasRenderingContext2D } from "canvas";
import * as fs from "fs";
import * as path from "path";

// ── Font Registration ─────────────────────────────────────────────────────────
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
    } catch { /* skip */ }
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

// Warm gold divider line
function drawGoldDivider(ctx: CanvasRenderingContext2D, y: number, x1 = 80, x2 = 1000) {
  const grad = ctx.createLinearGradient(x1, y, x2, y);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.12, "rgba(180,145,50,0.5)");
  grad.addColorStop(0.5, "rgba(180,145,50,0.85)");
  grad.addColorStop(0.88, "rgba(180,145,50,0.5)");
  grad.addColorStop(1, "transparent");
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
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
    const dataUrl = await QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: "#2A2010", light: "#FDFAF4" } });
    const img = await loadImage(dataUrl);
    ctx.save();
    ctx.strokeStyle = "rgba(180,145,50,0.6)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 8);
    ctx.fillStyle = "#FDFAF4";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(img, x, y, size, size);
  } catch {
    ctx.save();
    ctx.fillStyle = "#F0EBE0";
    roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 8);
    ctx.fill();
    ctx.restore();
  }
}

// Nordic rune — Tiwaz (victory/honour) — drawn in antique gold on white
function drawRune(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 60, size / 60);
  ctx.strokeStyle = `rgba(160,125,40,${opacity})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = `rgba(200,165,60,${opacity * 0.5})`;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 30); ctx.lineTo(30, -30); ctx.lineTo(60, 30);
  ctx.moveTo(10, 5); ctx.lineTo(50, 5);
  ctx.stroke();
  ctx.restore();
}

function drawOthalaRune(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opacity: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 60, size / 60);
  ctx.strokeStyle = `rgba(140,110,35,${opacity})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.shadowColor = `rgba(180,145,50,${opacity * 0.5})`;
  ctx.shadowBlur = 6;
  ctx.beginPath();
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
  card2ImageUrl?: string;
  card2ValueHKD?: number;
  card3ImageUrl?: string;
  card3ValueHKD?: number;
  card4ImageUrl?: string;
  card4ValueHKD?: number;
  card5ImageUrl?: string;
  card5ValueHKD?: number;
  wallUrl: string;
}

export async function generateWallPoster(data: WallPosterData): Promise<Buffer> {
  await ensureRibOneFont();

  const W = 1080, H = 1350;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── 1. Background: Nordic White Marble ──────────────────────────────────────
  // Base warm white
  ctx.fillStyle = "#FDFAF4";
  ctx.fillRect(0, 0, W, H);

  // Subtle marble vein lines (diagonal, very faint)
  ctx.save();
  ctx.strokeStyle = "rgba(180,160,120,0.07)";
  ctx.lineWidth = 1.5;
  for (let i = -H; i < W + H; i += 55) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H * 0.4, H);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(160,140,100,0.04)";
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 88) {
    ctx.beginPath();
    ctx.moveTo(i + 20, 0);
    ctx.lineTo(i + H * 0.35, H);
    ctx.stroke();
  }
  ctx.restore();

  // Dawn glow: warm gold + ice blue radial overlay at center
  const dawnGrad = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, W * 0.65);
  dawnGrad.addColorStop(0, "rgba(255,230,140,0.18)");
  dawnGrad.addColorStop(0.3, "rgba(200,175,100,0.08)");
  dawnGrad.addColorStop(0.6, "rgba(180,210,240,0.06)");
  dawnGrad.addColorStop(1, "rgba(253,250,244,0)");
  ctx.fillStyle = dawnGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle noise texture (fine dot grid)
  ctx.save();
  ctx.strokeStyle = "rgba(160,140,100,0.04)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // ── 2. Double Antique Gold Border ───────────────────────────────────────────
  // Outer border
  ctx.save();
  const outerGrad = ctx.createLinearGradient(0, 0, W, H);
  outerGrad.addColorStop(0, "#8B6914");
  outerGrad.addColorStop(0.3, "#C9A84C");
  outerGrad.addColorStop(0.5, "#E8C96A");
  outerGrad.addColorStop(0.7, "#C9A84C");
  outerGrad.addColorStop(1, "#8B6914");
  ctx.strokeStyle = outerGrad;
  ctx.lineWidth = 2.5;
  roundRect(ctx, 20, 20, W - 40, H - 40, 16);
  ctx.stroke();
  ctx.restore();

  // Inner border (hairline)
  ctx.save();
  ctx.strokeStyle = "rgba(180,145,50,0.30)";
  ctx.lineWidth = 1;
  roundRect(ctx, 32, 32, W - 64, H - 64, 12);
  ctx.stroke();
  ctx.restore();

  // ── 3. Corner Runes — REMOVED (clean minimal corners) ─────────────────────

  // ── 4. Header: BOXIUM · TCG ─────────────────────────────────────────────────
  ctx.save();
  const ribOneAvailable = fs.existsSync(RIB_ONE_PATH);
  ctx.font = `bold 30px ${ribOneAvailable ? "'Rib One', " : ""}${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#8B6914";
  ctx.fillText("BOXIUM · TCG", W / 2, 92);
  ctx.restore();

  drawGoldDivider(ctx, 116);

  // ── 5. Title: 嘆息之牆 ──────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "#2A1F0A";
  ctx.font = `bold 56px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(180,145,50,0.20)";
  ctx.shadowBlur = 14;
  ctx.fillText("歎息之牆", W / 2, 190);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(120,95,40,0.65)";
  ctx.font = `14px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("THE WALL OF WOW  ·  HONOUR CERTIFICATE", W / 2, 224);
  ctx.restore();

  drawGoldDivider(ctx, 250);

  // ── 6. Recipient ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = "rgba(100,80,35,0.65)";
  ctx.font = `14px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("茲 證 明", W / 2, 296);
  ctx.restore();

  // Name — champagne gold with emboss shadow (gold foil on stone)
  ctx.save();
  const nameGrad = ctx.createLinearGradient(W / 2 - 220, 0, W / 2 + 220, 0);
  nameGrad.addColorStop(0, "#8B6914");
  nameGrad.addColorStop(0.3, "#C9A84C");
  nameGrad.addColorStop(0.5, "#E8C96A");
  nameGrad.addColorStop(0.7, "#C9A84C");
  nameGrad.addColorStop(1, "#8B6914");
  ctx.fillStyle = nameGrad;
  // Emboss: dark shadow below, light highlight above
  ctx.shadowColor = "rgba(60,40,10,0.35)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.font = `bold 54px ${CJK_FONT}`;
  ctx.textAlign = "center";
  const name = data.displayName.length > 14 ? data.displayName.slice(0, 14) + "…" : data.displayName;
  ctx.fillText(name, W / 2, 366);
  // Highlight pass
  ctx.shadowColor = "rgba(255,240,160,0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = -1;
  ctx.fillText(name, W / 2, 366);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(100,80,35,0.60)";
  ctx.font = `14px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("此生有幸，得瞻神蹟", W / 2, 398);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(120,95,40,0.50)";
  ctx.font = `13px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("已成功登上歎息之牆，令全網 TCG 玩家為之歎息", W / 2, 424);
  ctx.restore();

  drawGoldDivider(ctx, 448);

  // ── 7. Total Value ───────────────────────────────────────────────────────────
  const valueStr = `HKD ${data.totalValueHKD.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  ctx.save();
  ctx.fillStyle = "rgba(100,80,35,0.55)";
  ctx.font = `12px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("VAULT TOTAL VALUE", W / 2, 488);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#1A1208";
  ctx.font = `bold 58px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(180,145,50,0.15)";
  ctx.shadowBlur = 8;
  ctx.fillText(valueStr, W / 2, 558);
  ctx.restore();

  ctx.save();
  const sigGrad = ctx.createLinearGradient(W / 2 - 80, 0, W / 2 + 80, 0);
  sigGrad.addColorStop(0, "#8B6914");
  sigGrad.addColorStop(0.5, "#C9A84C");
  sigGrad.addColorStop(1, "#8B6914");
  ctx.fillStyle = sigGrad;
  ctx.font = `bold 18px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${data.sighs.toLocaleString()} 次驚歎`, W / 2, 592);
  ctx.restore();

  drawGoldDivider(ctx, 618);

  // ── 8. Top 5 Cards — 3D Fan Array (Nordic White Sanctuary) ─────────────────
  // Collect up to 5 card image URLs
  const cardUrls = [
    data.topCardImageUrl,
    data.card2ImageUrl,
    data.card3ImageUrl,
    data.card4ImageUrl,
    data.card5ImageUrl,
  ].filter(Boolean) as string[];

  // Fan layout configs: [0]=center, [1]=left-inner, [2]=right-inner, [3]=left-outer, [4]=right-outer
  // All positions relative to poster center X=540
  type FanCfg = { offsetX: number; offsetY: number; rotate: number; scale: number; brightness: number; blur: number; z: number };
  const fanAll: FanCfg[] = [
    { offsetX: 0,    offsetY: -14, rotate: 0,   scale: 1.25, brightness: 1,    blur: 0,   z: 5 },
    { offsetX: -190, offsetY: 10,  rotate: -11, scale: 1.00, brightness: 0.85, blur: 0,   z: 4 },
    { offsetX:  190, offsetY: 10,  rotate:  11, scale: 1.00, brightness: 0.85, blur: 0,   z: 4 },
    { offsetX: -360, offsetY: 24,  rotate: -22, scale: 0.80, brightness: 0.60, blur: 0.8, z: 3 },
    { offsetX:  360, offsetY: 24,  rotate:  22, scale: 0.80, brightness: 0.60, blur: 0.8, z: 3 },
  ];
  const fanCfg = fanAll.slice(0, cardUrls.length);

  // Base card size (enlarged ~25% vs previous 240px)
  const BASE_CARD_W = 300;
  const BASE_CARD_H = Math.round(BASE_CARD_W * 4 / 3); // 400
  const fanCenterX = W / 2;
  const fanCenterY = 640 + BASE_CARD_H / 2 + 10;

  // Fetch all images in parallel
  const cardImages = await Promise.all(cardUrls.map(url => fetchImage(url)));

  // Card values aligned with cardUrls index (0=top1, 1=card2, ...)
  const cardValues = [
    data.topCardValueHKD,
    data.card2ValueHKD,
    data.card3ValueHKD,
    data.card4ValueHKD,
    data.card5ValueHKD,
  ];
  const topLabels = ["TOP 1", "TOP 2", "TOP 3", "TOP 4", "TOP 5"];

  // Draw back-to-front (highest z last = drawn on top)
  const drawOrder = [...fanCfg.map((c, i) => ({ ...c, i }))];
  drawOrder.sort((a, b) => a.z - b.z);

  for (const cfg of drawOrder) {
    const img = cardImages[cfg.i];
    if (!img) continue;
    const cw = Math.round(BASE_CARD_W * cfg.scale);
    const ch = Math.round(BASE_CARD_H * cfg.scale);
    const cx = fanCenterX + cfg.offsetX;
    const cy = fanCenterY + cfg.offsetY;
    const labelAlpha = cfg.scale >= 1 ? 1 : 0.75;
    const labelSize = cfg.scale >= 1 ? 13 : 11;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cfg.rotate * Math.PI / 180);
    const ctxAny = ctx as unknown as { filter: string };
    if (cfg.blur > 0) {
      ctxAny.filter = `blur(${cfg.blur}px) brightness(${cfg.brightness})`;
    } else {
      ctxAny.filter = `brightness(${cfg.brightness})`;
    }

    // Ambient glow behind card (only for center card)
    if (cfg.i === 0) {
      ctx.save();
      (ctx as unknown as { filter: string }).filter = "none";
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 0.9);
      glowGrad.addColorStop(0, "rgba(212,175,55,0.45)");
      glowGrad.addColorStop(0.5, "rgba(200,165,50,0.18)");
      glowGrad.addColorStop(1, "transparent");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, cw * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Re-apply filter for card draw
      (ctx as unknown as { filter: string }).filter = `brightness(${cfg.brightness})`;
    }

    // Drop shadow
    ctx.shadowColor = "rgba(80,60,20,0.30)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    // Clip to card shape and draw image (no border)
    ctx.save();
    roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 10);
    ctx.clip();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // object-contain: preserve aspect ratio
    const srcRatio = img.width / img.height;
    const dstRatio = cw / ch;
    let dw = cw, dh = ch, dx = -cw / 2, dy = -ch / 2;
    if (srcRatio > dstRatio) {
      dh = cw / srcRatio; dy = -dh / 2;
    } else {
      dw = ch * srcRatio; dx = -dw / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    ctx.restore();
  }

  // ── 9. Crown Jewel text block ─────────────────────────────────────────────
  // Positioned between card fan and footer divider
  const crownJewelY = fanCenterY + BASE_CARD_H / 2 * fanCfg[0].scale + 44;

  // "CROWN JEWEL" label
  ctx.save();
  ctx.fillStyle = "rgba(139,105,20,0.65)";
  ctx.font = `10px ${CJK_FONT}`;
  ctx.textAlign = "center";
  (ctx as unknown as { letterSpacing: string }).letterSpacing = "2px";
  ctx.fillText("CROWN JEWEL", W / 2, crownJewelY);
  ctx.restore();

  // Quote text (multi-line wrap)
  const quoteText = "\u300c\u9019\u662f\u7531\u6975\u81f4\u71b1\u611b\u8207\u7d55\u5c0d\u5be6\u529b\u923d\u5c31\u7684\u50b3\u5947\u4e4b\u7246\u3002\u4e94\u5f35\u795e\u7d1a\u5361\u724c\u5728\u6b64\u4ea4\u5f59\uff0c\u5176\u8000\u773c\u7684\u5149\u8292\u5c07\u6c38\u9060\u93f8\u523b\u65bc TCG \u6536\u85cf\u53f2\u518a\u4e4b\u4e2d\u3002\u300d";
  const quoteMaxWidth = W - 200;
  const quoteLineHeight = 26;
  const quoteFontSize = 16;
  ctx.save();
  ctx.font = `${quoteFontSize}px ${CJK_FONT}`;
  ctx.fillStyle = "rgba(60,45,20,0.75)";
  ctx.textAlign = "center";

  // Word-wrap the quote text
  const words = quoteText.split("");
  let line = "";
  let quoteLineY = crownJewelY + 24;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > quoteMaxWidth && n > 0) {
      ctx.fillText(line, W / 2, quoteLineY);
      line = words[n];
      quoteLineY += quoteLineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, W / 2, quoteLineY);
  ctx.restore();

  // ── 10. Footer ────────────────────────────────────────────────────────────────
  const footerY = H - 148;
  drawGoldDivider(ctx, footerY);

  // QR code (right side)
  const qrSize = 82;
  const qrX = W - 88 - qrSize;
  const qrY = footerY + 22;
  await drawQRCode(ctx, data.wallUrl, qrX, qrY, qrSize);

  // Footer text (left side)
  ctx.save();
  ctx.fillStyle = "#8B6914";
  ctx.font = `bold 16px ${CJK_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("boxium.asia", 80, footerY + 44);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(100,80,35,0.60)";
  ctx.font = `12px ${CJK_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("歎息之牆 · Wall of Sighs", 80, footerY + 66);
  ctx.fillText("諸神殿堂管理處", 80, footerY + 86);
  ctx.restore();

  // Date (center bottom)
  const dateStr = new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" });
  ctx.save();
  ctx.fillStyle = "rgba(100,80,35,0.45)";
  ctx.font = `11px ${CJK_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(dateStr, W / 2, H - 28);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
