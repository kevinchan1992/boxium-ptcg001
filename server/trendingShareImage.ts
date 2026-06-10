/**
 * Trending Share Image Generator (v3)
 *
 * Generates a 1080x1350 PNG image for social media sharing (Instagram/Threads portrait).
 * Uses Satori (JSX→SVG) + sharp (SVG→PNG via librsvg).
 * Fetches card images from URLs and embeds as base64 data URIs.
 *
 * Endpoint: GET /api/share/trending?type=gainers|losers|volatile&days=7&limit=5
 */
import satori from "satori";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Asset paths ───────────────────────────────────────────────────────────────
const FONTS_DIR = path.join(__dirname, "fonts");
const ASSETS_DIR = path.join(__dirname, "assets");

// ── Cached assets ─────────────────────────────────────────────────────────────
let fontDataBold: Buffer | null = null;
let fontDataRegular: Buffer | null = null;
let logoBase64: string | null = null;

function loadAssets() {
  if (!fontDataBold) {
    fontDataBold = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Bold.otf"));
  }
  if (!fontDataRegular) {
    fontDataRegular = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Regular.otf"));
  }
  if (!logoBase64) {
    const logoPath = path.join(ASSETS_DIR, "boxium-logo-blue-yellow.png");
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;
    }
  }
}

// ── Image fetcher ─────────────────────────────────────────────────────────────
const imageCache = new Map<string, string>(); // url → base64 data URI

async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000);
    const protocol = url.startsWith("https://") ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timeout);
        res.resume();
        resolve(null);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", async () => {
        clearTimeout(timeout);
        try {
          const raw = Buffer.concat(chunks);
          // Resize to 120×168px (card aspect ratio ~0.71) for performance
          const resized = await sharp(raw)
            .resize(120, 168, { fit: "cover", position: "top" })
            .png()
            .toBuffer();
          const b64 = `data:image/png;base64,${resized.toString("base64")}`;
          imageCache.set(url, b64);
          resolve(b64);
        } catch {
          resolve(null);
        }
      });
      res.on("error", () => { clearTimeout(timeout); resolve(null); });
    }).on("error", () => { clearTimeout(timeout); resolve(null); });
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type ShareImageType = "gainers" | "losers" | "volatile";

export interface ShareCardItem {
  rank: number;
  cardName: string;
  cardNumber?: string;
  setName?: string;
  latestPrice: number;
  currency: string;
  changePercent: number;
  cardImageUrl?: string;
}

export interface ShareImageOptions {
  type: ShareImageType;
  items: ShareCardItem[];
  dateLabel?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(price: number, currency: string): string {
  if (currency === "JPY") return `¥${Math.round(price).toLocaleString()}`;
  return `HKD ${Math.round(price).toLocaleString()}`;
}

function formatChange(value: number, type: ShareImageType): string {
  if (type === "volatile") return `${Math.abs(value).toFixed(1)}%`;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getChangeColor(value: number, type: ShareImageType): string {
  if (type === "volatile") return "#FFD700";
  if (value >= 0) return "#00E676";
  return "#FF5252";
}

function getRankBadgeStyle(rank: number): { bg: string; text: string; border: string } {
  if (rank === 1) return { bg: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)", text: "#0a0a1a", border: "#FFD700" };
  if (rank === 2) return { bg: "linear-gradient(135deg, #E8E8E8 0%, #B0B0B0 100%)", text: "#0a0a1a", border: "#C0C0C0" };
  if (rank === 3) return { bg: "linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)", text: "#ffffff", border: "#CD7F32" };
  return { bg: "rgba(255,255,255,0.08)", text: "#aaaacc", border: "rgba(255,255,255,0.15)" };
}

function getTitleInfo(type: ShareImageType, days: number): { title: string; subtitle: string; accentColor: string; changeLabel: string } {
  if (type === "gainers") return {
    title: `${days}日漲幅榜`,
    subtitle: `PSA 10 · TOP 5 GAINERS · ${days}D`,
    accentColor: "#00E676",
    changeLabel: "漲幅",
  };
  if (type === "losers") return {
    title: `${days}日跌幅榜`,
    subtitle: `PSA 10 · TOP 5 LOSERS · ${days}D`,
    accentColor: "#FF5252",
    changeLabel: "跌幅",
  };
  return {
    title: `${days}日波動榜`,
    subtitle: `PSA 10 · TOP 5 VOLATILE · ${days}D`,
    accentColor: "#FFD700",
    changeLabel: "波動",
  };
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

// ── Build card row ────────────────────────────────────────────────────────────
function buildCardRow(
  item: ShareCardItem,
  type: ShareImageType,
  isLast: boolean,
  cardImgB64: string | null
) {
  const rankStyle = getRankBadgeStyle(item.rank);
  const changeColor = getChangeColor(item.changePercent, type);
  const changeText = formatChange(item.changePercent, type);
  const priceText = formatPrice(item.latestPrice, item.currency);
  const cardLabel = item.cardNumber ? `[${item.cardNumber}]` : (item.setName || "");
  const isTop3 = item.rank <= 3;
  const IMG_W = 96;
  const IMG_H = 134;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row" as const,
        alignItems: "center",
        width: "100%",
        padding: "20px 0",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.07)",
        gap: "18px",
      },
      children: [
        // ── Rank badge ──────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: rankStyle.bg,
              border: `1.5px solid ${rankStyle.border}`,
              flexShrink: 0,
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: rankStyle.text,
                  fontFamily: "NotoSansTC",
                },
                children: `${item.rank}`,
              },
            },
          },
        },
        // ── Card image ──────────────────────────────────────────────────
        cardImgB64
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  width: `${IMG_W}px`,
                  height: `${IMG_H}px`,
                  borderRadius: "8px",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: isTop3 ? `2px solid ${changeColor}40` : "2px solid rgba(255,255,255,0.10)",
                  boxShadow: isTop3 ? `0 4px 16px ${changeColor}30` : "none",
                },
                children: {
                  type: "img",
                  props: {
                    src: cardImgB64,
                    style: {
                      width: `${IMG_W}px`,
                      height: `${IMG_H}px`,
                      objectFit: "cover" as const,
                    },
                  },
                },
              },
            }
          : {
              type: "div",
              props: {
                style: {
                  width: `${IMG_W}px`,
                  height: `${IMG_H}px`,
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "2px solid rgba(255,255,255,0.10)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
                children: {
                  type: "span",
                  props: {
                    style: { fontSize: "24px", color: "rgba(255,255,255,0.2)" },
                    children: "?",
                  },
                },
              },
            },
        // ── Card info ───────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
              flex: 1,
              overflow: "hidden",
              gap: "4px",
              justifyContent: "center",
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                  fontSize: isTop3 ? "24px" : "22px",
                  fontWeight: "bold",
                  color: isTop3 ? "#FFFFFF" : "#CCCCDD",
                  fontFamily: "NotoSansTC",
                  lineHeight: 1.3,
                  },
                  children: truncateText(item.cardName, 24),
                },
              },
              cardLabel
                ? {
                    type: "span",
                    props: {
                      style: {
                        fontSize: "14px",
                        color: "#555577",
                        fontFamily: "NotoSansTC",
                      },
                      children: cardLabel,
                    },
                  }
                : null,
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "14px",
                    color: "#888899",
                    fontFamily: "NotoSansTC",
                    marginTop: "2px",
                  },
                  children: String(priceText),
                },
              },
            ].filter(Boolean),
          },
        },
        // ── Change percent ──────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "flex-end",
              flexShrink: 0,
              justifyContent: "center",
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: isTop3 ? "36px" : "30px",
                  fontWeight: "bold",
                  color: changeColor,
                  fontFamily: "NotoSansTC",
                  lineHeight: 1,
                },
                children: changeText,
              },
            },
          },
        },
      ],
    },
  };
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateTrendingShareImage(
  options: ShareImageOptions,
  days: number = 7
): Promise<Buffer> {
  loadAssets();

  const { type, items, dateLabel } = options;
  const displayItems = items.slice(0, 5);
  const { title, subtitle, accentColor } = getTitleInfo(type, days);

  const today = dateLabel || new Date().toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, ".");

  // Fetch all card images in parallel
  const cardImages = await Promise.all(
    displayItems.map((item) =>
      item.cardImageUrl ? fetchImageAsBase64(item.cardImageUrl) : Promise.resolve(null)
    )
  );

  const W = 1080;
  const H = 1350; // Portrait format (4:5) — better for Instagram/Threads

  const svgElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        width: `${W}px`,
        height: `${H}px`,
        background: "#06038d",
        fontFamily: "NotoSansTC",
        position: "relative" as const,
        overflow: "hidden",
      },
      children: [
        // ── Background gradient ──────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: 0, left: 0, right: 0, bottom: 0,
              background: "linear-gradient(160deg, #0a07b0 0%, #05038a 30%, #030265 60%, #010040 100%)",
            },
          },
        },
        // ── Glow accent top-right ────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: "-120px", right: "-120px",
              width: "600px", height: "600px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor}15 0%, transparent 65%)`,
            },
          },
        },
        // ── Glow accent bottom-left ──────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              bottom: "-100px", left: "-100px",
              width: "500px", height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,221,0,0.12) 0%, transparent 65%)",
            },
          },
        },
        // ── Subtle grid texture overlay ──────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: 0.03,
              backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)",
            },
          },
        },
        // ── Content wrapper ──────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
              width: "100%",
              height: "100%",
              padding: "52px 64px 48px",
              boxSizing: "border-box" as const,
              position: "relative" as const,
              zIndex: 1,
            },
            children: [
              // ── Header: LOGO + date ────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row" as const,
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "40px",
                  },
                  children: [
                    logoBase64
                      ? {
                          type: "img",
                          props: {
                            src: logoBase64,
                            style: {
                              width: "220px",
                              height: "132px",
                              objectFit: "contain" as const,
                            },
                          },
                        }
                      : {
                          type: "span",
                          props: {
                            style: { fontSize: "40px", fontWeight: "bold", color: "#FEDD00", fontFamily: "NotoSansTC" },
                            children: "BOXIUM",
                          },
                        },
                    // Date badge
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255,221,0,0.10)",
                          borderRadius: "32px",
                          padding: "12px 28px",
                          border: "1px solid rgba(255,221,0,0.28)",
                        },
                        children: {
                          type: "span",
                          props: {
                            style: { fontSize: "22px", color: "#FEDD00", fontFamily: "NotoSansTC", letterSpacing: "1px" },
                            children: today,
                          },
                        },
                      },
                    },
                  ],
                },
              },
              // ── Title section ──────────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column" as const,
                    marginBottom: "24px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "row" as const,
                          alignItems: "center",
                          gap: "18px",
                          marginBottom: "10px",
                        },
                        children: [
                          // Accent bar
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "7px",
                                height: "64px",
                                borderRadius: "4px",
                                background: "#FEDD00",
                                flexShrink: 0,
                              },
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: "72px",
                                fontWeight: "bold",
                                color: "#FFFFFF",
                                fontFamily: "NotoSansTC",
                                letterSpacing: "2px",
                                lineHeight: 1,
                              },
                              children: title,
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "18px",
                          color: "rgba(255,255,255,0.40)",
                          fontFamily: "NotoSansTC",
                          letterSpacing: "4px",
                          marginLeft: "25px",
                        },
                        children: subtitle,
                      },
                    },
                  ],
                },
              },
              // ── Gold divider ───────────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    width: "100%",
                    height: "1px",
                    background: "linear-gradient(90deg, rgba(254,221,0,0.7) 0%, rgba(254,221,0,0.15) 55%, transparent 100%)",
                    marginBottom: "8px",
                  },
                },
              },
              // ── Cards list ─────────────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column" as const,
                    flex: 1,
                  },
                  children: displayItems.map((item, idx) =>
                    buildCardRow(item, type, idx === displayItems.length - 1, cardImages[idx])
                  ),
                },
              },
              // ── Footer ─────────────────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row" as const,
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "20px",
                    borderTop: "1px solid rgba(254,221,0,0.18)",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "row" as const,
                          alignItems: "center",
                          gap: "10px",
                        },
                        children: [
                          {
                            type: "div",
                            props: {
                              style: {
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "#FEDD00",
                                flexShrink: 0,
                              },
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#FEDD00",
                                fontFamily: "NotoSansTC",
                                letterSpacing: "0.5px",
                              },
                              children: "boxium.asia/trending",
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "15px",
                          color: "rgba(255,255,255,0.28)",
                          fontFamily: "NotoSansTC",
                          letterSpacing: "1px",
                        },
                        children: "DATA: SNKRDUNK · PSA 10",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(svgElement as any, {
    width: W,
    height: H,
    fonts: [
      { name: "NotoSansTC", data: fontDataBold!, weight: 700, style: "normal" },
      { name: "NotoSansTC", data: fontDataRegular!, weight: 400, style: "normal" },
    ],
  });

  // Use sharp (librsvg) to convert SVG → PNG — works in Cloud Run without native binaries
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}
