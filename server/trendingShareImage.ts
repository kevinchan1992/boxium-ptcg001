/**
 * Trending Share Image Generator
 *
 * Generates a 1080x1080 PNG image for social media sharing (Instagram/Threads).
 * Uses Satori (JSX→SVG) + @resvg/resvg-js (SVG→PNG).
 *
 * Endpoint: GET /api/share/trending?type=gainers|losers|volatile&days=7&limit=3
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Font loading ────────────────────────────────────────────────────────────────────────────────────
const FONTS_DIR = path.join(__dirname, "fonts");

let fontDataBold: Buffer | null = null;
let fontDataRegular: Buffer | null = null;

function loadFonts() {
  if (!fontDataBold) {
    fontDataBold = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Bold.otf"));
  }
  if (!fontDataRegular) {
    fontDataRegular = fs.readFileSync(path.join(FONTS_DIR, "NotoSansTC-Regular.otf"));
  }
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
  changePercent: number; // positive = gain, negative = loss, for volatile = volatility %
}

export interface ShareImageOptions {
  type: ShareImageType;
  items: ShareCardItem[];
  dateLabel?: string; // e.g. "2025.06.10"
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPrice(price: number, currency: string): string {
  if (currency === "JPY") {
    return `¥${Math.round(price).toLocaleString()}`;
  }
  return `HKD ${Math.round(price).toLocaleString()}`;
}

function formatChange(value: number, type: ShareImageType): string {
  if (type === "volatile") {
    return `${Math.abs(value).toFixed(1)}%`;
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function getChangeColor(value: number, type: ShareImageType): string {
  if (type === "volatile") return "#FFB800"; // amber for volatility
  if (value >= 0) return "#00E676"; // green for gains
  return "#FF5252"; // red for losses
}

function getRankBadgeColor(rank: number): { bg: string; text: string } {
  if (rank === 1) return { bg: "#FFD700", text: "#1a1a2e" };
  if (rank === 2) return { bg: "#C0C0C0", text: "#1a1a2e" };
  if (rank === 3) return { bg: "#CD7F32", text: "#ffffff" };
  return { bg: "#2a2a4a", text: "#aaaacc" };
}

function getTitleInfo(type: ShareImageType, days: number): { title: string; subtitle: string } {
  if (type === "gainers") {
    return {
      title: days <= 1 ? "今日漲幅榜" : `${days}日漲幅榜`,
      subtitle: `PSA 10 Market · ${days}D Top Gainers`,
    };
  }
  if (type === "losers") {
    return {
      title: days <= 1 ? "今日跌幅榜" : `${days}日跌幅榜`,
      subtitle: `PSA 10 Market · ${days}D Top Losers`,
    };
  }
  return {
    title: days <= 1 ? "今日波動榜" : `${days}日波動榜`,
    subtitle: `PSA 10 Market · ${days}D Most Volatile`,
  };
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateTrendingShareImage(
  options: ShareImageOptions,
  days: number = 7
): Promise<Buffer> {
  loadFonts();

  const { type, items, dateLabel } = options;
  const displayItems = items.slice(0, 5); // max 5 items
  const { title, subtitle } = getTitleInfo(type, days);
  const today = dateLabel || new Date().toLocaleDateString("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/\//g, ".");

  // Canvas size: 1080x1080 (Instagram square)
  const W = 1080;
  const H = 1080;

  // Build JSX-like object tree for Satori
  // Satori uses React-like element objects: { type, props: { style, children } }
  const itemCount = displayItems.length;
  const cardHeight = itemCount <= 3 ? 160 : itemCount === 4 ? 140 : 120;
  const cardGap = itemCount <= 3 ? 20 : 16;
  const topSectionH = 220;
  const bottomSectionH = 80;
  const contentH = H - topSectionH - bottomSectionH;
  const totalCardsH = itemCount * cardHeight + (itemCount - 1) * cardGap;
  const cardsPaddingTop = Math.max(20, (contentH - totalCardsH) / 2);

  const rankCards = displayItems.map((item) => {
    const rankColors = getRankBadgeColor(item.rank);
    const changeColor = getChangeColor(item.changePercent, type);
    const changeText = formatChange(item.changePercent, type);
    const priceText = formatPrice(item.latestPrice, item.currency);
    const cardLabel = item.cardNumber ? `[${item.cardNumber}]` : (item.setName ? item.setName : "");

    return {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          height: `${cardHeight}px`,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          borderRadius: "16px",
          border: `1px solid ${item.rank === 1 ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
          padding: "0 28px",
          boxSizing: "border-box",
          boxShadow: item.rank === 1 ? "0 0 20px rgba(255,215,0,0.15)" : "none",
          marginBottom: `${cardGap}px`,
        },
        children: [
          // Rank badge
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                background: rankColors.bg,
                flexShrink: 0,
                marginRight: "24px",
              },
              children: {
                type: "span",
                props: {
                  style: {
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: rankColors.text,
                    fontFamily: "NotoSansTC",
                  },
                  children: `#${item.rank}`,
                },
              },
            },
          },
          // Card info
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
                marginRight: "16px",
              },
              children: [
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: itemCount <= 3 ? "26px" : "22px",
                      fontWeight: "bold",
                      color: "#FFFFFF",
                      fontFamily: "NotoSansTC",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    children: truncateText(item.cardName, 28),
                  },
                },
                cardLabel ? {
                  type: "span",
                  props: {
                    style: {
                      fontSize: "16px",
                      color: "#8888aa",
                      fontFamily: "NotoSansTC",
                      marginTop: "4px",
                    },
                    children: cardLabel,
                  },
                } : null,
              ].filter(Boolean),
            },
          },
          // Price & change
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                flexShrink: 0,
              },
              children: [
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: itemCount <= 3 ? "36px" : "30px",
                      fontWeight: "bold",
                      color: changeColor,
                      fontFamily: "NotoSansTC",
                      lineHeight: 1,
                    },
                    children: changeText,
                  },
                },
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: "18px",
                      color: "#ccccdd",
                      fontFamily: "NotoSansTC",
                      marginTop: "6px",
                    },
                    children: priceText,
                  },
                },
              ],
            },
          },
        ],
      },
    };
  });

  const svgElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${W}px`,
        height: `${H}px`,
        background: "#0a0a14",
        fontFamily: "NotoSansTC",
        position: "relative",
      },
      children: [
        // Background texture overlay (subtle dots)
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "radial-gradient(ellipse at 20% 20%, rgba(255,215,0,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(100,100,255,0.04) 0%, transparent 60%)",
            },
          },
        },
        // ── Header ──────────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "48px 56px 0",
              height: `${topSectionH}px`,
              flexShrink: 0,
            },
            children: [
              // Logo + brand
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column" },
                  children: [
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "32px",
                          fontWeight: "bold",
                          color: "#FFFFFF",
                          fontFamily: "NotoSansTC",
                          letterSpacing: "2px",
                        },
                        children: "BOXIUM",
                      },
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "18px",
                          color: "#FFD700",
                          fontFamily: "NotoSansTC",
                          letterSpacing: "4px",
                          marginTop: "-2px",
                        },
                        children: "PTCG",
                      },
                    },
                  ],
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
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: "24px",
                    padding: "10px 24px",
                    border: "1px solid rgba(255,255,255,0.12)",
                  },
                  children: {
                    type: "span",
                    props: {
                      style: {
                        fontSize: "22px",
                        color: "#ccccdd",
                        fontFamily: "NotoSansTC",
                      },
                      children: today,
                    },
                  },
                },
              },
            ],
          },
        },
        // Title section
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "-60px",
              paddingBottom: "8px",
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "72px",
                    fontWeight: "bold",
                    color: "#FFFFFF",
                    fontFamily: "NotoSansTC",
                    letterSpacing: "4px",
                  },
                  children: title,
                },
              },
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "22px",
                    color: "#FFD700",
                    fontFamily: "NotoSansTC",
                    marginTop: "4px",
                    letterSpacing: "1px",
                  },
                  children: subtitle,
                },
              },
            ],
          },
        },
        // ── Cards list ───────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              padding: `${cardsPaddingTop}px 56px 0`,
              flex: 1,
            },
            children: rankCards,
          },
        },
        // ── Footer ───────────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 56px",
              height: `${bottomSectionH}px`,
              borderTop: "1px solid rgba(255,215,0,0.25)",
              flexShrink: 0,
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "22px",
                    color: "#FFD700",
                    fontFamily: "NotoSansTC",
                  },
                  children: "🔗 boxiumptcg.manus.space/trending",
                },
              },
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "18px",
                    color: "#666688",
                    fontFamily: "NotoSansTC",
                  },
                  children: "數據來源：eBay & SNKRDUNK",
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
      {
        name: "NotoSansTC",
        data: fontDataBold!,
        weight: 700,
        style: "normal",
      },
      {
        name: "NotoSansTC",
        data: fontDataRegular!,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
