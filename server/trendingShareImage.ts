/**
 * Trending Share Image Generator (v4 — Japanese Pro Style)
 *
 * Design principles:
 * - Brand colors: #08038d (deep blue) + #feda00 (bright yellow)
 * - Background: pure #08038d + subtle central radial glow (same blue family)
 * - Title: Noto Serif TC (Japanese mincho) in #feda00 + Orbitron small English subtitle
 * - Rank badges: circle shape — #1 yellow/blue, #2-3 white outline, #4-5 semi-transparent
 * - Card rows: semi-transparent white container (rgba 5%) + card image with white border float
 * - Change %: Orbitron font for geometric tech feel
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

// ── Brand colors ──────────────────────────────────────────────────────────────
const BRAND_BLUE = "#08038d";
const BRAND_YELLOW = "#feda00";

// ── Cached assets ─────────────────────────────────────────────────────────────
let fontNotoSansBold: Buffer | null = null;
let fontNotoSansRegular: Buffer | null = null;
let fontNotoSerifBold: Buffer | null = null;
let fontOrbitronBold: Buffer | null = null;
let logoBase64: string | null = null;

function loadAssets() {
  if (!fontNotoSansBold) {
    fontNotoSansBold = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Bold.otf"));
  }
  if (!fontNotoSansRegular) {
    fontNotoSansRegular = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Regular.otf"));
  }
  if (!fontNotoSerifBold) {
    const serifPath = path.join(FONTS_DIR, "NotoSerifTC-Bold.ttf");
    if (fs.existsSync(serifPath)) {
      fontNotoSerifBold = fs.readFileSync(serifPath);
    }
  }
  if (!fontOrbitronBold) {
    const orbitronPath = path.join(FONTS_DIR, "Orbitron-Bold.ttf");
    if (fs.existsSync(orbitronPath)) {
      fontOrbitronBold = fs.readFileSync(orbitronPath);
    }
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
          // Resize to 108×152px (card aspect ratio ~0.71)
          const resized = await sharp(raw)
            .resize(108, 152, { fit: "cover", position: "top" })
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
  if (type === "volatile") return BRAND_YELLOW;
  if (value >= 0) return "#00E676";
  return "#FF5252";
}

/**
 * Japanese-style circular rank badge
 * #1: yellow fill + brand blue text
 * #2-3: white outline circle + white text
 * #4-5: semi-transparent dark + dim text
 */
function buildRankBadge(rank: number) {
  const SIZE = 48;
  let bgColor: string;
  let textColor: string;
  let borderColor: string;
  let borderWidth: string;

  if (rank === 1) {
    bgColor = BRAND_YELLOW;
    textColor = BRAND_BLUE;
    borderColor = BRAND_YELLOW;
    borderWidth = "0px";
  } else if (rank <= 3) {
    bgColor = "transparent";
    textColor = "#FFFFFF";
    borderColor = "rgba(255,255,255,0.85)";
    borderWidth = "1.5px";
  } else {
    bgColor = "rgba(255,255,255,0.06)";
    textColor = "rgba(255,255,255,0.40)";
    borderColor = "rgba(255,255,255,0.18)";
    borderWidth = "1px";
  }

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        borderRadius: "50%",
        background: bgColor,
        border: `${borderWidth} solid ${borderColor}`,
        flexShrink: 0,
      },
      children: {
        type: "span",
        props: {
          style: {
            fontSize: "18px",
            fontWeight: "bold",
            color: textColor,
            fontFamily: "NotoSansTC",
            lineHeight: 1,
          },
          children: `${rank}`,
        },
      },
    },
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
        padding: "16px 20px",
        marginBottom: isLast ? "0px" : "10px",
        borderRadius: "12px",
        // Japanese card layering: subtle semi-transparent container
        background: isTop3
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.03)",
        border: isTop3
          ? `1px solid rgba(254,218,0,0.15)`
          : "1px solid rgba(255,255,255,0.06)",
        gap: "16px",
      },
      children: [
        // ── Rank badge (circle) ─────────────────────────────────────────
        buildRankBadge(item.rank),
        // ── Card image with white border float effect ───────────────────
        cardImgB64
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  width: `${IMG_W}px`,
                  height: `${IMG_H}px`,
                  borderRadius: "6px",
                  overflow: "hidden",
                  flexShrink: 0,
                  // White border + shadow = "floating card" effect
                  border: "1.5px solid rgba(255,255,255,0.85)",
                  boxShadow: isTop3
                    ? `0 6px 20px rgba(0,0,0,0.55), 0 2px 8px ${changeColor}30`
                    : "0 4px 12px rgba(0,0,0,0.45)",
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: `${IMG_W}px`,
                  height: `${IMG_H}px`,
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  flexShrink: 0,
                },
                children: {
                  type: "span",
                  props: {
                    style: { fontSize: "20px", color: "rgba(255,255,255,0.15)" },
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
              gap: "3px",
              justifyContent: "center",
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: isTop3 ? "21px" : "19px",
                    fontWeight: "bold",
                    color: isTop3 ? "#FFFFFF" : "rgba(255,255,255,0.75)",
                    fontFamily: "NotoSansTC",
                    lineHeight: 1.35,
                  },
                  children: truncateText(item.cardName, 22),
                },
              },
              cardLabel
                ? {
                    type: "span",
                    props: {
                      style: {
                        fontSize: "13px",
                        color: "rgba(254,218,0,0.55)",
                        fontFamily: "NotoSansTC",
                        letterSpacing: "0.5px",
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
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "NotoSansTC",
                    marginTop: "2px",
                  },
                  children: String(priceText),
                },
              },
            ].filter(Boolean),
          },
        },
        // ── Change percent (Orbitron geometric font) ────────────────────
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
                  fontSize: isTop3 ? "30px" : "26px",
                  fontWeight: "bold",
                  color: changeColor,
                  fontFamily: "Orbitron",
                  lineHeight: 1,
                  letterSpacing: "-0.5px",
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

  // Title info
  let titleZH: string;
  let subtitleEN: string;
  let accentColor: string;

  if (type === "gainers") {
    titleZH = `${days}日漲幅榜`;
    subtitleEN = `WEEKLY GAINERS · PSA 10 · TOP 5`;
    accentColor = "#00E676";
  } else if (type === "losers") {
    titleZH = `${days}日跌幅榜`;
    subtitleEN = `WEEKLY LOSERS · PSA 10 · TOP 5`;
    accentColor = "#FF5252";
  } else {
    titleZH = `${days}日波動榜`;
    subtitleEN = `WEEKLY VOLATILE · PSA 10 · TOP 5`;
    accentColor = BRAND_YELLOW;
  }

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
  const H = 1350;

  const svgElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        width: `${W}px`,
        height: `${H}px`,
        background: BRAND_BLUE,
        position: "relative" as const,
        overflow: "hidden",
      },
      children: [
        // ── Background: pure brand blue + subtle central radial glow ────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: 0, left: 0, right: 0, bottom: 0,
              // Subtle radial glow in same blue family — elevates the flat color
              background: `radial-gradient(ellipse 80% 60% at 50% 30%, #1208c8 0%, #08038d 45%, #040265 100%)`,
            },
          },
        },
        // ── Yellow accent line at top ────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: 0, left: 0, right: 0,
              height: "4px",
              background: BRAND_YELLOW,
            },
          },
        },
        // ── Subtle corner accent (top-right) ─────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: "-80px",
              right: "-80px",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(254,218,0,0.08) 0%, transparent 65%)`,
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
              padding: "48px 60px 44px",
              boxSizing: "border-box" as const,
              position: "relative" as const,
              zIndex: 1,
            },
            children: [
              // ── Header: LOGO + date badge ──────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row" as const,
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "36px",
                  },
                  children: [
                    logoBase64
                      ? {
                          type: "img",
                          props: {
                            src: logoBase64,
                            style: {
                              width: "200px",
                              height: "120px",
                              objectFit: "contain" as const,
                            },
                          },
                        }
                      : {
                          type: "span",
                          props: {
                            style: {
                              fontSize: "36px",
                              fontWeight: "bold",
                              color: BRAND_YELLOW,
                              fontFamily: "NotoSansTC",
                            },
                            children: "BOXIUM",
                          },
                        },
                    // Date badge — clean pill shape
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(254,218,0,0.10)",
                          borderRadius: "28px",
                          padding: "10px 24px",
                          border: `1px solid rgba(254,218,0,0.35)`,
                        },
                        children: {
                          type: "span",
                          props: {
                            style: {
                              fontSize: "20px",
                              color: BRAND_YELLOW,
                              fontFamily: "Orbitron",
                              letterSpacing: "2px",
                            },
                            children: today,
                          },
                        },
                      },
                    },
                  ],
                },
              },
              // ── Title section (Japanese mincho style) ─────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column" as const,
                    marginBottom: "28px",
                  },
                  children: [
                    // Yellow accent bar + main title
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "row" as const,
                          alignItems: "center",
                          gap: "16px",
                          marginBottom: "8px",
                        },
                        children: [
                          // Accent bar
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                width: "6px",
                                height: "68px",
                                borderRadius: "3px",
                                background: BRAND_YELLOW,
                                flexShrink: 0,
                              },
                            },
                          },
                          // Main title in Noto Serif TC (Japanese mincho)
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: "76px",
                                fontWeight: "bold",
                                color: BRAND_YELLOW,
                                fontFamily: "NotoSerifTC",
                                letterSpacing: "3px",
                                lineHeight: 1,
                              },
                              children: titleZH,
                            },
                          },
                        ],
                      },
                    },
                    // Small English subtitle in Orbitron (Jaapokki-style)
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "14px",
                          color: "rgba(255,255,255,0.35)",
                          fontFamily: "Orbitron",
                          letterSpacing: "4px",
                          marginLeft: "22px",
                        },
                        children: subtitleEN,
                      },
                    },
                  ],
                },
              },
              // ── Thin yellow divider ────────────────────────────────────
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    height: "1px",
                    background: `linear-gradient(90deg, ${BRAND_YELLOW}80 0%, ${BRAND_YELLOW}20 60%, transparent 100%)`,
                    marginBottom: "16px",
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
                    justifyContent: "space-between",
                    gap: "0px",
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
                    paddingTop: "16px",
                    borderTop: `1px solid rgba(254,218,0,0.20)`,
                    marginTop: "8px",
                  },
                  children: [
                    // Site URL with yellow dot
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
                                display: "flex",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: BRAND_YELLOW,
                                flexShrink: 0,
                              },
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: "22px",
                                fontWeight: "bold",
                                color: BRAND_YELLOW,
                                fontFamily: "Orbitron",
                                letterSpacing: "0.5px",
                              },
                              children: "boxium.asia/trending",
                            },
                          },
                        ],
                      },
                    },
                    // Data source label
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.25)",
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

  // Build font list for Satori
  const satorifonts: Array<{ name: string; data: Buffer; weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900; style: "normal" | "italic" }> = [
    { name: "NotoSansTC", data: fontNotoSansBold!, weight: 700, style: "normal" },
    { name: "NotoSansTC", data: fontNotoSansRegular!, weight: 400, style: "normal" },
  ];
  if (fontNotoSerifBold) {
    satorifonts.push({ name: "NotoSerifTC", data: fontNotoSerifBold, weight: 700, style: "normal" });
  }
  if (fontOrbitronBold) {
    satorifonts.push({ name: "Orbitron", data: fontOrbitronBold, weight: 700, style: "normal" });
  }

  const svg = await satori(svgElement as any, {
    width: W,
    height: H,
    fonts: satorifonts,
  });

  // Use sharp (librsvg) to convert SVG → PNG — works in Cloud Run without native binaries
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}
