/**
 * ShareCard — 1080×1080 隱藏分享圖片模板
 * 奢華雜誌感「個人資產證書」設計
 * 用 html-to-image 渲染為 PNG
 */
import React from "react";
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

function getProxied(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
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
  ({ stats, topCards, userName, shareUrl, logoBase64 }, ref) => {
    const gainPositive = stats.totalGain >= 0;
    const gainColor = gainPositive ? "#047857" : "#dc2626";
    const currency = stats.currency ?? "HKD";

    // Foil shine overlay gradient
    const foilGradient =
      "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 40%, rgba(255,220,100,0.12) 70%, rgba(255,255,255,0) 100%)";

    return (
      <div
        ref={ref}
        id="share-card-template"
        style={{
          // Fixed 1080×1080 — will be captured by html-to-image
          width: "1080px",
          height: "1080px",
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          overflow: "hidden",
          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
          background: "#FAF9F6",
          // Outer border frame
          border: "3px solid #1A1A1A",
          boxSizing: "border-box",
        }}
      >
        {/* ── Inner gold border frame ── */}
        <div
          style={{
            position: "absolute",
            inset: "10px",
            border: "1px solid #C9A84C",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        {/* ── Background texture (subtle diagonal lines) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.025) 40px, rgba(201,168,76,0.025) 41px)",
            pointerEvents: "none",
          }}
        />

        {/* ── Content container (padding inside inner border) ── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding: "52px 64px 44px",
            height: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── TOP: Brand Header ── */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "36px",
            }}
          >
            {/* Logo + title */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                {/* BOXIUM Logo image */}
                <img
                  src={logoBase64 ?? "https://static-assets-cdn.manus.space/webdev-static-assets/Mua4eQ38uVnrovHUJBRepi/boxium-logo-black.webp"}
                  alt="BOXIUM"
                  style={{
                    height: "46px",
                    width: "auto",
                    objectFit: "contain",
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "700",
                    letterSpacing: "0.32em",
                    color: "#737373",
                    background: "#F0EDE8",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    alignSelf: "center",
                  }}
                >
                  VAULT
                </span>
              </div>
              <p
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.42em",
                  color: "#C9A84C",
                  fontWeight: "700",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                TCG PORTFOLIO CERTIFICATE
              </p>
            </div>

            {/* Date stamp */}
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: "10px",
                  color: "#9CA3AF",
                  letterSpacing: "0.1em",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  margin: 0,
                }}
              >
                {new Date().toLocaleDateString("zh-HK", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              {userName && (
                <p
                  style={{
                    fontSize: "11px",
                    color: "#737373",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    marginTop: "2px",
                    margin: "2px 0 0",
                  }}
                >
                  {userName}
                </p>
              )}
            </div>
          </div>

          {/* ── Gold divider ── */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
              marginBottom: "36px",
            }}
          />

          {/* ── CENTER: Core Financial Data ── */}
          <div style={{ marginBottom: "40px" }}>
            <p
              style={{
                fontSize: "10px",
                letterSpacing: "0.3em",
                color: "#9CA3AF",
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: "600",
                textTransform: "uppercase",
                marginBottom: "10px",
                margin: "0 0 10px",
              }}
            >
              PORTFOLIO VALUE
            </p>

            {/* Big number */}
            <p
              style={{
                fontSize: "96px",
                fontWeight: "900",
                letterSpacing: "-0.04em",
                color: "#1A1A1A",
                lineHeight: 1,
                fontFamily: "'Courier New', 'Courier', monospace",
                margin: "0 0 16px",
              }}
            >
              {fmtCurrency(stats.totalMarketValue, currency)}
            </p>

            {/* ROI + Profit row */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {/* ROI badge */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 18px",
                  borderRadius: "100px",
                  background: gainPositive ? "#ECFDF5" : "#FEF2F2",
                  border: `1px solid ${gainPositive ? "#A7F3D0" : "#FECACA"}`,
                }}
              >
                <span
                  style={{
                    fontSize: "36px",
                    fontWeight: "900",
                    color: gainColor,
                    fontFamily: "'Courier New', monospace",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {gainPositive ? "▲" : "▼"} {Math.abs(stats.totalGainPct).toFixed(1)}%
                </span>
              </div>

              {/* Profit amount */}
              <div>
                <p
                  style={{
                    fontSize: "28px",
                    fontWeight: "800",
                    color: gainColor,
                    fontFamily: "'Courier New', monospace",
                    margin: "0 0 2px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {gainPositive ? "+" : ""}{fmtCurrency(stats.totalGain, currency)}
                </p>
                <p
                  style={{
                    fontSize: "10px",
                    color: "#9CA3AF",
                    fontFamily: "system-ui, sans-serif",
                    letterSpacing: "0.1em",
                    margin: 0,
                  }}
                >
                  UNREALIZED PROFIT · {stats.totalQuantity} CARDS
                </p>
              </div>
            </div>
          </div>

          {/* ── Gold divider ── */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
              marginBottom: "36px",
            }}
          />

          {/* ── MIDDLE-BOTTOM: TOP 3 Cards ── */}
          <div style={{ flex: 1, marginBottom: "32px" }}>
            <p
              style={{
                fontSize: "9px",
                letterSpacing: "0.35em",
                color: "#C9A84C",
                fontFamily: "system-ui, sans-serif",
                fontWeight: "700",
                textTransform: "uppercase",
                marginBottom: "20px",
                margin: "0 0 20px",
              }}
            >
              TOP 3 珍藏 · FINEST HOLDINGS
            </p>

            <div style={{ display: "flex", gap: "24px" }}>
              {topCards.slice(0, 3).map((card, idx) => {
                const rankColors = ["#C9A84C", "#A0A0A0", "#CD7F32"];
                const rankColor = rankColors[idx] ?? "#C9A84C";
                                // 優先使用預先轉換的 base64（避免跨域），fallback 到 proxied URL
                const imgSrc = card.imageBase64 ?? getProxied(card.imageUrl);
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {/* Card image container (3:4 ratio) */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "133.33%", // 3:4 aspect ratio
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "#E8E6E1",
                        border: `2px solid ${rankColor}`,
                        boxShadow: `0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5) inset`,
                      }}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={card.cardName}
                          style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
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
                          position: "absolute",
                          inset: 0,
                          background: foilGradient,
                          pointerEvents: "none",
                        }}
                      />

                      {/* Rank badge */}
                      <div
                        style={{
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
                          fontSize: "12px",
                          fontWeight: "900",
                          color: "#FFFFFF",
                          fontFamily: "system-ui, sans-serif",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        }}
                      >
                        {idx + 1}
                      </div>
                    </div>

                    {/* Card info */}
                    <div>
                      {/* Grade badge */}
                      <div
                        style={{
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
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: gradeDotColor(card.grader),
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            color: "#1A1A1A",
                            fontFamily: "system-ui, sans-serif",
                            letterSpacing: "0.05em",
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
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: "700",
                          color: "#1A1A1A",
                          fontFamily: "system-ui, sans-serif",
                          lineHeight: 1.3,
                          marginBottom: "4px",
                          margin: "0 0 4px",
                          // Clamp to 2 lines
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {card.cardName}
                      </p>

                      {/* Market value */}
                      {card.marketPrice != null && (
                        <p
                          style={{
                            fontSize: "18px",
                            fontWeight: "900",
                            color: "#1A1A1A",
                            fontFamily: "'Courier New', monospace",
                            letterSpacing: "-0.01em",
                            margin: "0 0 2px",
                          }}
                        >
                          {fmtCurrency(card.marketPrice, currency)}
                        </p>
                      )}

                      {/* Gain % */}
                      {card.unrealizedGainPct != null && (
                        <p
                          style={{
                            fontSize: "15px",
                            fontWeight: "800",
                            color: card.unrealizedGainPct >= 0 ? "#047857" : "#dc2626",
                            fontFamily: "system-ui, sans-serif",
                            margin: 0,
                          }}
                        >
                          {card.unrealizedGainPct >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(card.unrealizedGainPct).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fill empty slots if < 3 cards */}
              {topCards.length < 3 &&
                Array.from({ length: 3 - topCards.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ flex: 1 }} />
                ))}
            </div>
          </div>

          {/* ── Gold divider ── */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent)",
              marginBottom: "28px",
            }}
          />

          {/* ── BOTTOM: QR Code + Footer ── */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            {/* Left: Footer text */}
            <div>
              <p
                style={{
                  fontSize: "13px",
                  color: "#4B4B4B",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.05em",
                  margin: "0 0 4px",
                }}
              >
                Create your vault at
              </p>
              <p
                style={{
                  fontSize: "20px",
                  fontWeight: "900",
                  color: "#1A1A1A",
                  fontFamily: "'Playfair Display', Georgia, serif",
                  letterSpacing: "0.02em",
                  margin: 0,
                }}
              >
                boxium.asia
              </p>
              <p
                style={{
                  fontSize: "9px",
                  color: "#9CA3AF",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.2em",
                  marginTop: "4px",
                  margin: "4px 0 0",
                  textTransform: "uppercase",
                }}
              >
                TCG Portfolio Management
              </p>
            </div>

            {/* Right: QR Code */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <div
                style={{
                  padding: "10px",
                  background: "#FFFFFF",
                  border: "1px solid #EAEAEA",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <QRCodeSVG
                  value={shareUrl}
                  size={90}
                  fgColor="#1A1A1A"
                  bgColor="#FFFFFF"
                  level="M"
                />
              </div>
              <p
                style={{
                  fontSize: "9px",
                  color: "#9CA3AF",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.1em",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                掃碼查看完整收藏
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = "ShareCard";

export default ShareCard;
