/**
 * useShareImage
 * Generates a BOXIUM-branded share image using HTML Canvas.
 * Returns a function that, given listing data, produces a PNG data URL.
 *
 * Layout (1080 × 1080 px – Instagram Story / Square):
 *   - Deep blue gradient background (#06038d → #0a06b5)
 *   - BOXIUM brand header with logo text
 *   - Product image (centred, rounded)
 *   - Product title (white, bold, wrapped)
 *   - Price badge (yellow on dark)
 *   - Footer: "BOXIUM TCG • boxium.asia"
 */

export interface ShareImageOptions {
  title: string;
  priceHkd: string;
  imageUrl?: string | null;
  condition?: string;
}

const W = 1080;
const H = 1080;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const words = text.split(" ");
  let line = "";
  let lineCount = 0;
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + " ";
      currentY += lineHeight;
      lineCount++;
      if (lineCount >= maxLines - 1) {
        // Last allowed line – truncate with ellipsis
        const remaining = words.slice(n).join(" ");
        let truncated = remaining;
        while (ctx.measureText(truncated + "…").width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated.trim() + "…", x, currentY);
        return currentY + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    // Timeout after 5s
    setTimeout(() => resolve(null), 5000);
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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

export async function generateShareImage(options: ShareImageOptions): Promise<string> {
  const { title, priceHkd, imageUrl, condition } = options;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background gradient ──────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#04028a");
  bgGrad.addColorStop(0.5, "#0a06b5");
  bgGrad.addColorStop(1, "#06038d");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Subtle dot grid pattern ──────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let gx = 0; gx < W; gx += 40) {
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Top accent bar ───────────────────────────────────────────────────────────
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, "#f5c800");
  accentGrad.addColorStop(1, "#FEDD00");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 12);

  // ── BOXIUM brand header ──────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 96px Arial, sans-serif";
  ctx.letterSpacing = "8px";
  ctx.textAlign = "center";
  ctx.fillText("BOXIUM", W / 2, 130);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "32px Arial, sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("LUCK IN EVERY BOX", W / 2, 178);

  // ── Divider line ─────────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 205);
  ctx.lineTo(W - 80, 205);
  ctx.stroke();

  // ── Product image ────────────────────────────────────────────────────────────
  const imgSize = 460;
  const imgX = (W - imgSize) / 2;
  const imgY = 230;

  // Shadow behind image
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;

  if (imageUrl) {
    const productImg = await loadImage(imageUrl);
    if (productImg) {
      ctx.save();
      roundedRect(ctx, imgX, imgY, imgSize, imgSize, 32);
      ctx.clip();
      ctx.drawImage(productImg, imgX, imgY, imgSize, imgSize);
      ctx.restore();
    } else {
      // Fallback placeholder
      ctx.save();
      roundedRect(ctx, imgX, imgY, imgSize, imgSize, 32);
      const placeholderGrad = ctx.createLinearGradient(imgX, imgY, imgX + imgSize, imgY + imgSize);
      placeholderGrad.addColorStop(0, "#1a1580");
      placeholderGrad.addColorStop(1, "#2a20c0");
      ctx.fillStyle = placeholderGrad;
      ctx.fill();
      ctx.restore();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "bold 48px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BOXIUM", W / 2, imgY + imgSize / 2 + 16);
    }
  } else {
    ctx.save();
    roundedRect(ctx, imgX, imgY, imgSize, imgSize, 32);
    const placeholderGrad = ctx.createLinearGradient(imgX, imgY, imgX + imgSize, imgY + imgSize);
    placeholderGrad.addColorStop(0, "#1a1580");
    placeholderGrad.addColorStop(1, "#2a20c0");
    ctx.fillStyle = placeholderGrad;
    ctx.fill();
    ctx.restore();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BOXIUM", W / 2, imgY + imgSize / 2 + 16);
  }

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ── Condition badge ──────────────────────────────────────────────────────────
  if (condition) {
    const badgeText = condition;
    ctx.font = "bold 28px Arial, sans-serif";
    const badgeW = ctx.measureText(badgeText).width + 32;
    const badgeH = 44;
    const badgeX = imgX + imgSize - badgeW - 12;
    const badgeY = imgY + 12;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 30);
  }

  // ── Product title ────────────────────────────────────────────────────────────
  const titleY = imgY + imgSize + 52;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "0px";
  const afterTitleY = wrapText(ctx, title, W / 2, titleY, W - 160, 68, 3);

  // ── Price badge ──────────────────────────────────────────────────────────────
  const priceText = `HKD ${parseFloat(priceHkd).toFixed(2)}`;
  ctx.font = "bold 58px Arial, sans-serif";
  const priceW = ctx.measureText(priceText).width + 60;
  const priceH = 80;
  const priceX = (W - priceW) / 2;
  const priceY = Math.max(afterTitleY + 16, 870);

  const priceGrad = ctx.createLinearGradient(priceX, priceY, priceX + priceW, priceY);
  priceGrad.addColorStop(0, "#f5c800");
  priceGrad.addColorStop(1, "#FEDD00");
  ctx.fillStyle = priceGrad;
  roundedRect(ctx, priceX, priceY, priceW, priceH, 16);
  ctx.fill();

  ctx.fillStyle = "#06038d";
  ctx.textAlign = "center";
  ctx.fillText(priceText, W / 2, priceY + 56);

  // ── Bottom accent bar ────────────────────────────────────────────────────────
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, H - 12, W, 12);

  // ── Footer text ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "28px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("BOXIUM TCG  •  boxium.asia", W / 2, H - 28);

  return canvas.toDataURL("image/png");
}

export function downloadShareImage(dataUrl: string, filename = "boxium-share.png") {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
