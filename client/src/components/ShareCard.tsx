/**
 * ShareCard — 1080×1080 隱藏分享圖片模板
 * 奢華雜誌感「個人資產證書」設計
 * 完全重構：固定高度區塊分層，防止任何文字重疊
 * 用 html-to-image 渲染為 PNG
 */
import React from "react";
import { BOXIUM_LOGO_BASE64 } from "@/lib/logoBase64";
import { QRCodeSVG } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────
export interface ShareCardStats {
  totalMarketValue: number;
  totalGain: number;
  totalGainPct: number;
  totalCost: number;
  totalQuantity: number;
  currency?: string;
}

export interface ShareCardItem {
  cardName: string;
  imageUrl: string | null;
  imageBase64: string | null; // pre-fetched base64 data URL to avoid CORS
  grader: string;
  grade: string | null;
  marketPrice: number | null;
  unrealizedGainPct: number | null;
}

interface ShareCardProps {
  stats: ShareCardStats;
  topCards: ShareCardItem[];
  userName?: string;
  shareUrl: string;
  logoBase64?: string | null; // pre-fetched base64 to avoid CORS
}

// ─── Helpers ─────────────────────────────────────────────────
function fmtCurrency(val: number, currency = "HKD") {
  return `${currency} ${val.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Grade dot color ─────────────────────────────────────────
function gradeDotColor(grader: string) {
  const map: Record<string, string> = {
    PSA: "#dc2626", CGC: "#2563eb", BGS: "#7c3aed", RAW: "#9ca3af",
  };
  return map[grader?.toUpperCase()] ?? "#9ca3af";
}

// ─── ShareCard Component ──────────────────────────────────────
const ShareCard = React.forwardRef<HTMLDivElement, ShareCardProps>(
  ({ stats, topCards, userName: _userName, shareUrl, logoBase64 }, ref) => {
    const gainPositive = stats.totalGain >= 0;
    const gainColor = gainPositive ? "#047857" : "#dc2626";
    const gainBg = gainPositive ? "#ECFDF5" : "#FEF2F2";
    const gainBorder = gainPositive ? "#A7F3D0" : "#FECACA";
    const currency = stats.currency ?? "HKD";

    // Foil shine overlay gradient
    const foilGradient =
      "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, rgba(255,220,100,0.12) 70%, rgba(255,255,255,0) 100%)";

    // ── Base reset styles applied to ALL elements inside the card ──
    // This prevents any global Tailwind/CSS from leaking in
    const BASE: React.CSSProperties = {
      boxSizing: "border-box",
      margin: 0,
      padding: 0,
      border: "none",
      outline: "none",
      lineHeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      listStyle: "none",
      WebkitFontSmoothing: "antialiased",
    };

    const MONO = "'Courier New', 'Courier', monospace";
    const SANS = "system-ui, -apple-system, Arial, sans-serif";
    const SERIF = "Georgia, 'Times New Roman', serif";

    return (
      <div
        ref={ref}
        id="share-card-template"
        style={{
          ...BASE,
          // ── Fixed 1080×1080 — captured by html-to-image ──
          width: "1080px",
          height: "1080px",
          minWidth: "1080px",
          minHeight: "1080px",
          maxWidth: "1080px",
          maxHeight: "1080px",
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          overflow: "hidden",
          display: "block",
          fontFamily: SERIF,
          background: "#FAF9F6",
          border: "3px solid #1A1A1A",
        }}
      >
        {/* ── Inner gold border frame ── */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "10px",
            right: "10px",
            bottom: "10px",
            left: "10px",
            border: "1px solid #C9A84C",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        {/* ── Background diagonal texture ── */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.025) 40px, rgba(201,168,76,0.025) 41px)",
            pointerEvents: "none",
          }}
        />

        {/* ══════════════════════════════════════════════════
            BLOCK 1 — HEADER  (top: 0, height: 148px)
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "28px",
            left: "60px",
            right: "60px",
            height: "148px",
            display: "block",
          }}
        >
          {/* Left: Logo + VAULT badge + URLs */}
          <div
            style={{
              ...BASE,
              display: "inline-block",
              verticalAlign: "top",
              width: "65%",
            }}
          >
            {/* Logo row */}
            <div
              style={{
                ...BASE,
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "10px",
              }}
            >
              <img
                src={logoBase64 ?? BOXIUM_LOGO_BASE64}
                alt="BOXIUM"
                style={{
                  ...BASE,
                  height: "58px",
                  width: "auto",
                  objectFit: "contain",
                  display: "block",
                }}
              />
              {/* Black capsule VAULT badge */}
              <span
                style={{
                  ...BASE,
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: "800",
                  letterSpacing: "0.28em",
                  color: "#FFFFFF",
                  background: "#1A1A1A",
                  padding: "5px 13px",
                  borderRadius: "6px",
                  fontFamily: SANS,
                  textTransform: "uppercase",
                  lineHeight: "1.4",
                }}
              >
                VAULT
              </span>
            </div>

            {/* Platform URL */}
            <div
              style={{
                ...BASE,
                fontSize: "10px",
                letterSpacing: "0.25em",
                color: "#888888",
                fontWeight: "600",
                fontFamily: SANS,
                textTransform: "uppercase",
                display: "block",
                marginBottom: "6px",
                lineHeight: "1.4",
              }}
            >
              WWW.BOXIUM.ASIA
            </div>

            {/* Certificate label */}
            <div
              style={{
                ...BASE,
                fontSize: "11px",
                letterSpacing: "0.42em",
                color: "#C9A84C",
                fontWeight: "700",
                fontFamily: SANS,
                textTransform: "uppercase",
                display: "block",
                lineHeight: "1.4",
              }}
            >
              TCG PORTFOLIO CERTIFICATE
            </div>
          </div>

          {/* Right: Date only (no username) */}
          <div
            style={{
              ...BASE,
              display: "inline-block",
              verticalAlign: "top",
              width: "35%",
              textAlign: "right",
            }}
          >
            <div
              style={{
                ...BASE,
                fontSize: "11px",
                color: "#9CA3AF",
                letterSpacing: "0.1em",
                fontFamily: SANS,
                lineHeight: "1.5",
                display: "block",
              }}
            >
              {new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* ── Gold divider after header ── */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "186px",
            left: "60px",
            right: "60px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
          }}
        />

        {/* ══════════════════════════════════════════════════
            BLOCK 2 — PORTFOLIO VALUE  (top: 198px, height: 270px)
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "198px",
            left: "60px",
            right: "60px",
            height: "270px",
            display: "block",
          }}
        >
          {/* Label */}
          <div
            style={{
              ...BASE,
              fontSize: "11px",
              letterSpacing: "0.35em",
              color: "#9CA3AF",
              fontFamily: SANS,
              fontWeight: "600",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "12px",
              lineHeight: "1.4",
            }}
          >
            PORTFOLIO VALUE
          </div>

          {/* Big number — single line, 72px */}
          <div
            style={{
              ...BASE,
              fontSize: "72px",
              fontWeight: "900",
              letterSpacing: "-0.03em",
              color: "#1A1A1A",
              lineHeight: "1",
              fontFamily: MONO,
              display: "block",
              marginBottom: "24px",
              whiteSpace: "nowrap",
            }}
          >
            {fmtCurrency(stats.totalMarketValue, currency)}
          </div>

          {/* ROI + Profit — single row, 32px */}
          <div
            style={{
              ...BASE,
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* ROI badge */}
            <div
              style={{
                ...BASE,
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 20px",
                borderRadius: "100px",
                background: gainBg,
                border: `1px solid ${gainBorder}`,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  ...BASE,
                  fontSize: "32px",
                  fontWeight: "900",
                  color: gainColor,
                  fontFamily: MONO,
                  letterSpacing: "-0.02em",
                  lineHeight: "1",
                  whiteSpace: "nowrap",
                }}
              >
                {gainPositive ? "▲" : "▼"} {Math.abs(stats.totalGainPct).toFixed(1)}%
              </span>
            </div>

            {/* Profit amount */}
            <div style={{ ...BASE, display: "block" }}>
              <div
                style={{
                  ...BASE,
                  fontSize: "32px",
                  fontWeight: "800",
                  color: gainColor,
                  fontFamily: MONO,
                  lineHeight: "1",
                  letterSpacing: "-0.01em",
                  display: "block",
                  marginBottom: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                {gainPositive ? "+" : ""}{fmtCurrency(stats.totalGain, currency)}
              </div>
              <div
                style={{
                  ...BASE,
                  fontSize: "10px",
                  color: "#9CA3AF",
                  fontFamily: SANS,
                  letterSpacing: "0.1em",
                  display: "block",
                  lineHeight: "1.4",
                }}
              >
                UNREALIZED PROFIT · {stats.totalQuantity} CARDS
              </div>
            </div>
          </div>
        </div>

        {/* ── Gold divider after portfolio ── */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "478px",
            left: "60px",
            right: "60px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
          }}
        />

        {/* ══════════════════════════════════════════════════
            BLOCK 3 — TOP 3 CARDS  (top: 490px, height: 400px)
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "490px",
            left: "60px",
            right: "60px",
            height: "400px",
            display: "block",
          }}
        >
          {/* Section label */}
          <div
            style={{
              ...BASE,
              fontSize: "9px",
              letterSpacing: "0.35em",
              color: "#C9A84C",
              fontFamily: SANS,
              fontWeight: "700",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "16px",
              lineHeight: "1.4",
            }}
          >
            TOP 3 珍藏 · FINEST HOLDINGS
          </div>

          {/* Cards grid */}
          <div
            style={{
              ...BASE,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "28px",
              height: "360px",
            }}
          >
            {Array.from({ length: 3 }).map((_, idx) => {
              const card = topCards[idx];
              const rankColors = ["#C9A84C", "#A0A0A0", "#CD7F32"];
              const rankColor = rankColors[idx] ?? "#C9A84C";
              const imgSrc = card?.imageBase64 ?? null;

              return (
                <div
                  key={idx}
                  style={{
                    ...BASE,
                    display: "block",
                    height: "360px",
                  }}
                >
                  {/* Card image container — fixed 220px height */}
                  <div
                    style={{
                      ...BASE,
                      position: "relative",
                      width: "100%",
                      height: "220px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      background: "#E8E6E1",
                      border: `2px solid ${rankColor}`,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      display: "block",
                      marginBottom: "10px",
                    }}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={card?.cardName ?? ""}
                        style={{
                          ...BASE,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          ...BASE,
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9CA3AF",
                          fontSize: "32px",
                        }}
                      >
                        🃏
                      </div>
                    )}

                    {/* Foil shine overlay */}
                    <div
                      style={{
                        ...BASE,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: foilGradient,
                        pointerEvents: "none",
                      }}
                    />

                    {/* Rank badge */}
                    <div
                      style={{
                        ...BASE,
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: rankColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: "900",
                        color: "#FFFFFF",
                        fontFamily: SANS,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      {idx + 1}
                    </div>
                  </div>

                  {/* Card info — block elements, no overlap */}
                  {card && (
                    <div style={{ ...BASE, display: "block" }}>
                      {/* Grade badge */}
                      <div
                        style={{
                          ...BASE,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "#FFFFFF",
                          border: "1px solid #E5E7EB",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            ...BASE,
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: gradeDotColor(card.grader),
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            ...BASE,
                            fontSize: "10px",
                            fontWeight: "700",
                            color: "#1A1A1A",
                            fontFamily: SANS,
                            letterSpacing: "0.05em",
                            lineHeight: "1.4",
                          }}
                        >
                          {card.grade && card.grade.toUpperCase().startsWith(card.grader?.toUpperCase())
                            ? card.grade
                            : card.grade
                              ? `${card.grader?.toUpperCase()} ${card.grade}`
                              : card.grader?.toUpperCase()}
                        </span>
                      </div>

                      {/* Card name */}
                      <div
                        style={{
                          ...BASE,
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#1A1A1A",
                          fontFamily: SANS,
                          lineHeight: "1.35",
                          display: "-webkit-box" as "block",
                          marginBottom: "5px",
                          overflow: "hidden",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical" as "vertical",
                        }}
                      >
                        {card.cardName}
                      </div>

                      {/* Market value */}
                      {card.marketPrice != null && (
                        <div
                          style={{
                            ...BASE,
                            fontSize: "18px",
                            fontWeight: "900",
                            color: "#1A1A1A",
                            fontFamily: MONO,
                            letterSpacing: "-0.01em",
                            display: "block",
                            lineHeight: "1.3",
                            marginBottom: "3px",
                          }}
                        >
                          {fmtCurrency(card.marketPrice, currency)}
                        </div>
                      )}

                      {/* Gain % */}
                      {card.unrealizedGainPct != null && (
                        <div
                          style={{
                            ...BASE,
                            fontSize: "15px",
                            fontWeight: "900",
                            color: card.unrealizedGainPct >= 0 ? "#047857" : "#dc2626",
                            fontFamily: SANS,
                            display: "block",
                            lineHeight: "1.3",
                          }}
                        >
                          {card.unrealizedGainPct >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(card.unrealizedGainPct).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Gold divider before footer ── */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "900px",
            left: "60px",
            right: "60px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
          }}
        />

        {/* ══════════════════════════════════════════════════
            BLOCK 4 — FOOTER  (top: 910px, height: 142px)
        ══════════════════════════════════════════════════ */}
        <div
          style={{
            ...BASE,
            position: "absolute",
            top: "910px",
            left: "60px",
            right: "60px",
            height: "142px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: CTA text */}
          <div style={{ ...BASE, display: "block" }}>
            <div
              style={{
                ...BASE,
                fontSize: "13px",
                color: "#4B4B4B",
                fontFamily: SANS,
                letterSpacing: "0.05em",
                display: "block",
                lineHeight: "1.4",
                marginBottom: "4px",
              }}
            >
              Create your vault at
            </div>
            <div
              style={{
                ...BASE,
                fontSize: "22px",
                fontWeight: "900",
                color: "#1A1A1A",
                fontFamily: SERIF,
                letterSpacing: "0.02em",
                display: "block",
                lineHeight: "1.2",
                marginBottom: "4px",
              }}
            >
              boxium.asia
            </div>
            <div
              style={{
                ...BASE,
                fontSize: "9px",
                color: "#9CA3AF",
                fontFamily: SANS,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                display: "block",
                lineHeight: "1.4",
              }}
            >
              TCG Portfolio Management
            </div>
          </div>

          {/* Right: QR Code + label */}
          <div
            style={{
              ...BASE,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                ...BASE,
                padding: "10px",
                background: "#FFFFFF",
                border: "1px solid #EAEAEA",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                display: "inline-block",
              }}
            >
              <QRCodeSVG
                value={shareUrl}
                size={100}
                fgColor="#1A1A1A"
                bgColor="#FFFFFF"
                level="M"
              />
            </div>
            <div
              style={{
                ...BASE,
                fontSize: "9px",
                color: "#6B7280",
                fontFamily: SANS,
                letterSpacing: "0.06em",
                textAlign: "center",
                display: "block",
                lineHeight: "1.5",
              }}
            >
              掃碼查看完整收藏
              <br />
              <span style={{ fontSize: "8px", letterSpacing: "0.04em" }}>Scan to View Vault</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

export default ShareCard;
