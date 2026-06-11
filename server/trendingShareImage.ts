/**
 * Trending Share Image Generator (v5 — Horizontal Card Gallery Style)
 *
 * Design principles (matching reference image):
 * - Canvas: 1280 × 960 px (landscape 4:3)
 * - Background: deep navy blue gradient (#06038D → #0A0660) + large translucent "BOXIUM" watermark
 * - Header: BOXIUM logo (yellow box) centered top + date pill top-right
 * - Title: Large gold Chinese title + subtitle
 * - Cards: 5 cards in a horizontal row, each with PSA slab frame effect
 *   - #1 card is slightly larger / elevated
 *   - Rank badge (gold/silver/bronze/grey circle) top-left of each card
 *   - Change % badge (green) below card name
 * - Footer: boxium.asia/trending URL + DATA source note
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
const BRAND_BLUE = "#06038D";
const BRAND_YELLOW = "#FEDA00";
const BRAND_GOLD = "#C9A227";

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

async function fetchImageAsBase64(url: string, width = 200, height = 280): Promise<string | null> {
  if (!url) return null;
  const cacheKey = `${url}:${width}x${height}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey)!;

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
          const resized = await sharp(raw)
            .resize(width, height, { fit: "cover", position: "top" })
            .png()
            .toBuffer();
          const b64 = `data:image/png;base64,${resized.toString("base64")}`;
          imageCache.set(cacheKey, b64);
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
  days?: number;
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
  if (value >= 0) return "#4ADE80";
  return "#FF5252";
}

function getTitleLabel(type: ShareImageType, days: number): string {
  const dayStr = `${days}日`;
  if (type === "gainers") return `${dayStr}漲幅榜`;
  if (type === "losers") return `${dayStr}跌幅榜`;
  return `${dayStr}波動榜`;
}

function getRankBadgeStyle(rank: number): { bg: string; text: string; border: string; borderWidth: string } {
  if (rank === 1) return { bg: BRAND_YELLOW, text: BRAND_BLUE, border: BRAND_YELLOW, borderWidth: "0px" };
  if (rank === 2) return { bg: "rgba(192,192,192,0.25)", text: "#E0E0E0", border: "#C0C0C0", borderWidth: "2px" };
  if (rank === 3) return { bg: "rgba(180,110,30,0.25)", text: "#CD7F32", border: "#CD7F32", borderWidth: "2px" };
  return { bg: "rgba(255,255,255,0.08)", text: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.2)", borderWidth: "1.5px" };
}

// ── PSA Slab card component ───────────────────────────────────────────────────
function buildCardColumn(
  item: ShareCardItem,
  imageB64: string | null,
  type: ShareImageType,
  isFirst: boolean
) {
  const cardW = isFirst ? 230 : 190;
  const cardH = isFirst ? 322 : 266;
  const slabPad = isFirst ? 8 : 6;
  const badgeStyle = getRankBadgeStyle(item.rank);
  const changeText = formatChange(item.changePercent, type);
  const changeColor = getChangeColor(item.changePercent, type);
  const priceText = formatPrice(item.latestPrice, item.currency);

  // Truncate card name
  const maxNameLen = isFirst ? 18 : 16;
  const displayName = item.cardName.length > maxNameLen
    ? item.cardName.slice(0, maxNameLen - 1) + "…"
    : item.cardName;
  const displayNumber = item.cardNumber
    ? (item.cardNumber.length > 14 ? item.cardNumber.slice(0, 13) + "…" : item.cardNumber)
    : "";

  // PSA slab outer frame (dark grey gradient)
  const slabOuter = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        width: `${cardW + slabPad * 2}px`,
        borderRadius: "10px",
        background: "linear-gradient(160deg, #2a2a3a 0%, #1a1a28 60%, #0d0d1a 100%)",
        border: "1.5px solid rgba(255,255,255,0.15)",
        padding: `${slabPad}px ${slabPad}px ${slabPad + 4}px`,
        boxShadow: isFirst
          ? "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)"
          : "0 4px 16px rgba(0,0,0,0.5)",
        position: "relative" as const,
      },
      children: [
        // PSA label strip at top
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "20px",
              background: "linear-gradient(90deg, #1a1aff 0%, #0000cc 100%)",
              borderRadius: "4px 4px 0 0",
              marginBottom: "4px",
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: "9px",
                  fontWeight: "bold",
                  color: "#ffffff",
                  fontFamily: "Orbitron",
                  letterSpacing: "2px",
                },
                children: "PSA  10",
              },
            },
          },
        },
        // Card image area
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              width: `${cardW}px`,
              height: `${cardH}px`,
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(0,0,0,0.4)",
            },
            children: imageB64
              ? {
                  type: "img",
                  props: {
                    src: imageB64,
                    style: {
                      width: `${cardW}px`,
                      height: `${cardH}px`,
                      objectFit: "cover",
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
                      width: "100%",
                      height: "100%",
                      background: "rgba(255,255,255,0.05)",
                    },
                    children: {
                      type: "span",
                      props: {
                        style: { fontSize: "24px", color: "rgba(255,255,255,0.2)", fontFamily: "NotoSansTC" },
                        children: "?",
                      },
                    },
                  },
                },
          },
        },
        // Bottom slab strip
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "16px",
              background: "linear-gradient(90deg, #1a1aff 0%, #0000cc 100%)",
              borderRadius: "0 0 4px 4px",
              marginTop: "4px",
            },
            children: {
              type: "span",
              props: {
                style: {
                  fontSize: "7px",
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "Orbitron",
                  letterSpacing: "1px",
                },
                children: "GRADED CARD",
              },
            },
          },
        },
      ],
    },
  };

  // Rank badge (overlapping top-left of slab)
  const rank = item.rank;

  const rankBadge = {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute" as const,
        top: "-16px",
        left: "-16px",
        width: isFirst ? "40px" : "34px",
        height: isFirst ? "40px" : "34px",
        borderRadius: "50%",
        background: badgeStyle.bg,
        border: `${badgeStyle.borderWidth} solid ${badgeStyle.border}`,
        zIndex: 10,
        boxShadow: rank === 1 ? "0 2px 8px rgba(254,218,0,0.5)" : "none",
      },
      children: {
        type: "span",
        props: {
          style: {
            fontSize: isFirst ? "18px" : "15px",
            fontWeight: "bold",
            color: badgeStyle.text,
            fontFamily: "NotoSansTC",
            lineHeight: 1,
          },
          children: String(item.rank),
        },
      },
    },
  };

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: "10px",
        position: "relative" as const,
        marginTop: isFirst ? "0px" : "28px",
      },
      children: [
        // Slab + rank badge wrapper
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "relative" as const,
            },
            children: [slabOuter, rankBadge],
          },
        },
        // Card name
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              gap: "2px",
              width: `${cardW + slabPad * 2}px`,
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: isFirst ? "15px" : "13px",
                    fontWeight: "bold",
                    color: "#FFFFFF",
                    fontFamily: "NotoSansTC",
                    textAlign: "center",
                    lineHeight: 1.3,
                    maxWidth: "100%",
                  },
                  children: displayName,
                },
              },
              displayNumber
                ? {
                    type: "span",
                    props: {
                      style: {
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.45)",
                        fontFamily: "Orbitron",
                        textAlign: "center",
                      },
                      children: `[${displayNumber}]`,
                    },
                  }
                : { type: "span", props: { style: { display: "none" }, children: "" } },
              // Change badge
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    background: `${changeColor}22`,
                    border: `1px solid ${changeColor}66`,
                    marginTop: "2px",
                  },
                  children: {
                    type: "span",
                    props: {
                      style: {
                        fontSize: isFirst ? "15px" : "13px",
                        fontWeight: "bold",
                        color: changeColor,
                        fontFamily: "Orbitron",
                        letterSpacing: "0.5px",
                      },
                      children: changeText,
                    },
                  },
                },
              },
              // Price
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.55)",
                    fontFamily: "NotoSansTC",
                    textAlign: "center",
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
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateTrendingShareImage(
  options: ShareImageOptions
): Promise<Buffer> {
  loadAssets();

  const { type, items, dateLabel, days = 30 } = options;
  const displayItems = items.slice(0, 5);
  const today = dateLabel || new Date().toLocaleDateString("zh-HK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, ".");

  // Fetch all card images in parallel
  const imagePromises = displayItems.map((item) =>
    item.cardImageUrl
      ? fetchImageAsBase64(item.cardImageUrl, 210, 295)
      : Promise.resolve(null)
  );
  const cardImages = await Promise.all(imagePromises);

  // Build card columns
  const cardColumns = displayItems.map((item, idx) =>
    buildCardColumn(item, cardImages[idx], type, idx === 0)
  );

  const titleText = getTitleLabel(type, days);
  const subtitleText = "海賊王卡牌 PSA 10 ｜ 前5名";

  // ── Satori JSX tree ───────────────────────────────────────────────────────
  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        width: "1280px",
        height: "960px",
        background: `linear-gradient(135deg, #06038D 0%, #0A0660 50%, #04025A 100%)`,
        position: "relative" as const,
        overflow: "hidden",
        fontFamily: "NotoSansTC",
      },
      children: [
        // ── Background watermark "BOXIUM" ───────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "280px",
              fontWeight: "bold",
              color: "rgba(255,255,255,0.04)",
              fontFamily: "Orbitron",
              letterSpacing: "20px",
              whiteSpace: "nowrap" as const,
              userSelect: "none" as const,
              pointerEvents: "none" as const,
            },
            children: "BOXIUM",
          },
        },

        // ── Top border accent ───────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute" as const,
              top: "0",
              left: "0",
              right: "0",
              height: "4px",
              background: `linear-gradient(90deg, transparent, ${BRAND_YELLOW}, transparent)`,
            },
            children: "",
          },
        },

        // ── Header row: LOGO (center) + Date (right) ────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row" as const,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "28px 48px 0",
              width: "100%",
            },
            children: [
              // Left spacer (same width as date pill for balance)
              {
                type: "div",
                props: {
                  style: { display: "flex", width: "160px" },
                  children: "",
                },
              },
              // Center: BOXIUM logo
              logoBase64
                ? {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        padding: "8px 16px",
                        background: BRAND_YELLOW,
                        borderRadius: "12px",
                        border: `2px solid rgba(255,255,255,0.3)`,
                      },
                      children: {
                        type: "img",
                        props: {
                          src: logoBase64,
                          style: { width: "140px", height: "84px", objectFit: "contain" },
                        },
                      },
                    },
                  }
                : {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        padding: "10px 24px",
                        background: BRAND_YELLOW,
                        borderRadius: "12px",
                      },
                      children: {
                        type: "span",
                        props: {
                          style: {
                            fontSize: "36px",
                            fontWeight: "bold",
                            color: BRAND_BLUE,
                            fontFamily: "Orbitron",
                            letterSpacing: "4px",
                          },
                          children: "BOXIUM",
                        },
                      },
                    },
                  },
              // Right: Date pill
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px 20px",
                    borderRadius: "24px",
                    border: `1.5px solid ${BRAND_YELLOW}`,
                    background: "rgba(254,218,0,0.08)",
                    width: "160px",
                  },
                  children: {
                    type: "span",
                    props: {
                      style: {
                        fontSize: "16px",
                        fontWeight: "bold",
                        color: BRAND_YELLOW,
                        fontFamily: "Orbitron",
                        letterSpacing: "1px",
                      },
                      children: today,
                    },
                  },
                },
              },
            ],
          },
        },

        // ── Title section ───────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              marginTop: "24px",
              gap: "6px",
            },
            children: [
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "72px",
                    fontWeight: "bold",
                    color: BRAND_YELLOW,
                    fontFamily: fontNotoSerifBold ? "NotoSerifTC" : "NotoSansTC",
                    lineHeight: 1.1,
                    textShadow: `0 2px 12px rgba(254,218,0,0.3)`,
                  },
                  children: titleText,
                },
              },
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "22px",
                    color: "rgba(255,255,255,0.75)",
                    fontFamily: "NotoSansTC",
                    letterSpacing: "1px",
                  },
                  children: subtitleText,
                },
              },
            ],
          },
        },

        // ── Cards row ───────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row" as const,
              alignItems: "flex-start",
              justifyContent: "center",
        gap: "16px",
        marginTop: "20px",
        padding: "0 40px",
        flex: 1,
            },
            children: cardColumns,
          },
        },

        // ── Footer ──────────────────────────────────────────────────────────
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "row" as const,
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 48px 20px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              marginTop: "auto",
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: "8px" },
                  children: [
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "14px",
                          color: BRAND_YELLOW,
                          fontFamily: "NotoSansTC",
                          fontWeight: "bold",
                        },
                        children: "•",
                      },
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: "20px",
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
              {
                type: "span",
                props: {
                  style: {
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "NotoSansTC",
                    letterSpacing: "1px",
                  },
                  children: "DATA: SNKRDUNK  •  PSA 10",
                },
              },
            ],
          },
        },
      ],
    },
  };

  // ── Satori fonts config ───────────────────────────────────────────────────
  const fonts: Parameters<typeof satori>[1]["fonts"] = [];
  if (fontNotoSansBold) {
    fonts.push({ name: "NotoSansTC", data: fontNotoSansBold, weight: 700, style: "normal" });
  }
  if (fontNotoSansRegular) {
    fonts.push({ name: "NotoSansTC", data: fontNotoSansRegular, weight: 400, style: "normal" });
  }
  if (fontNotoSerifBold) {
    fonts.push({ name: "NotoSerifTC", data: fontNotoSerifBold, weight: 700, style: "normal" });
  }
  if (fontOrbitronBold) {
    fonts.push({ name: "Orbitron", data: fontOrbitronBold, weight: 700, style: "normal" });
  }

  const svg = await satori(element as any, {
    width: 1280,
    height: 960,
    fonts,
  });

  const pngBuffer = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
  return pngBuffer;
}
