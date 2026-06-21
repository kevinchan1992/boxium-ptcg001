/**
 * CollectionShareCard — Generates a shareable 1080×1350 image card
 * showing the user's collection value + top 3 cards for FB/IG sharing.
 *
 * Uses html2canvas to render a hidden DOM node to a PNG blob,
 * then offers download + Web Share API.
 */
import { useRef, useState, useCallback, forwardRef } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2, X } from "lucide-react";

// ─── Brand tokens ──────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

// Canvas dimensions — 4:5 ratio (ideal for IG feed)
const CARD_W = 1080;
const CARD_H = 1350;
// Scale factor for the in-modal preview
const PREVIEW_SCALE = 0.296;

interface CollectionShareCardProps {
  stats: {
    totalMarketValue: number;
    totalCost: number;
    totalGain: number;
    totalGainPct: number;
    totalQuantity: number;
    totalItems: number;
    currency: string;
    top3Gainers?: any[];
    top3ByValue?: any[];
  };
  userName?: string;
  onClose: () => void;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortName(name: string | null | undefined, maxLen = 18): string {
  if (!name) return "—";
  return name.length > maxLen ? name.slice(0, maxLen - 1) + "…" : name;
}

export function CollectionShareCard({ stats, userName, onClose }: CollectionShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isGain = stats.totalGain >= 0;
  const gainColor = isGain ? GAIN_GREEN : LOSS_RED;
  const gainSign = isGain ? "+" : "";

  const generateImage = useCallback(async () => {
    if (!cardRef.current) return null;
    setGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: CARD_W,
        height: CARD_H,
        logging: false,
      });
      return canvas;
    } finally {
      setGenerating(false);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    const canvas = await generateImage();
    if (!canvas) return;
    setPreviewUrl(canvas.toDataURL("image/png"));
  }, [generateImage]);

  const handleDownload = useCallback(async () => {
    let dataUrl: string;
    if (previewUrl) {
      dataUrl = previewUrl;
    } else {
      const canvas = await generateImage();
      if (!canvas) return;
      dataUrl = canvas.toDataURL("image/png");
    }
    const link = document.createElement("a");
    link.download = `boxium-collection-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [previewUrl, generateImage]);

  const handleShare = useCallback(async () => {
    let dataUrl: string;
    if (previewUrl) {
      dataUrl = previewUrl;
    } else {
      const canvas = await generateImage();
      if (!canvas) return;
      dataUrl = canvas.toDataURL("image/png");
      setPreviewUrl(dataUrl);
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "boxium-collection.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "我的 BOXIUM 卡牌收藏",
          text: `我的卡牌收藏總市值達 ${stats.currency} ${formatNum(stats.totalMarketValue)}！`,
        });
        return;
      } catch {
        // fallback to download
      }
    }
    const link = document.createElement("a");
    link.download = "boxium-collection.png";
    link.href = dataUrl;
    link.click();
  }, [previewUrl, generateImage, stats]);

  const previewH = Math.round(CARD_H * PREVIEW_SCALE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Scrollable preview area */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {previewUrl ? (
            <div className="p-4">
              <img src={previewUrl} alt="分享卡預覽" className="w-full rounded-2xl" />
            </div>
          ) : (
            <div className="overflow-hidden" style={{ height: previewH }}>
              <div
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  transform: `scale(${PREVIEW_SCALE})`,
                  transformOrigin: "top left",
                  pointerEvents: "none",
                }}
              >
                <ShareCardCanvas
                  ref={cardRef}
                  stats={stats}
                  userName={userName}
                  gainColor={gainColor}
                  gainSign={gainSign}
                  isGain={isGain}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hidden full-size canvas for capture (off-screen when preview shown) */}
        {previewUrl && (
          <div
            style={{
              position: "fixed",
              left: -9999,
              top: -9999,
              width: CARD_W,
              height: CARD_H,
              pointerEvents: "none",
            }}
          >
            <ShareCardCanvas
              ref={cardRef}
              stats={stats}
              userName={userName}
              gainColor={gainColor}
              gainSign={gainSign}
              isGain={isGain}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="p-4 space-y-2 border-t border-gray-100">
          {!previewUrl && (
            <Button
              className="w-full font-bold text-sm h-11 rounded-xl"
              style={{ background: BRAND_BLUE, color: "white" }}
              onClick={handlePreview}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />生成中...</>
              ) : (
                <>生成分享圖片</>
              )}
            </Button>
          )}
          {previewUrl && (
            <>
              <Button
                className="w-full font-bold text-sm h-11 rounded-xl gap-2"
                style={{ background: BRAND_BLUE, color: "white" }}
                onClick={handleShare}
                disabled={generating}
              >
                <Share2 className="w-4 h-4" />
                分享到 FB / IG
              </Button>
              <Button
                variant="outline"
                className="w-full font-bold text-sm h-11 rounded-xl gap-2"
                onClick={handleDownload}
                disabled={generating}
              >
                <Download className="w-4 h-4" />
                下載圖片
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── The actual 1080×1350 card DOM ────────────────────────────
const ShareCardCanvas = forwardRef<
  HTMLDivElement,
  {
    stats: CollectionShareCardProps["stats"];
    userName?: string;
    gainColor: string;
    gainSign: string;
    isGain: boolean;
  }
>(({ stats, userName, gainColor, gainSign, isGain }, ref) => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const top3 = stats.top3ByValue ?? stats.top3Gainers ?? [];

  return (
    <div
      ref={ref}
      style={{
        width: CARD_W,
        height: CARD_H,
        background: `linear-gradient(160deg, #0a07b8 0%, ${BRAND_BLUE} 60%, #040280 100%)`,
        fontFamily: "'Helvetica Neue', Arial, 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        boxSizing: "border-box",
      }}
    >
      {/* Background decorative circles */}
      <div style={{ position: "absolute", top: -140, right: -140, width: 520, height: 520, borderRadius: "50%", background: "rgba(254,221,0,0.07)" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 380, height: 380, borderRadius: "50%", background: "rgba(254,221,0,0.05)" }} />
      <div style={{ position: "absolute", top: 400, right: -80, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

      {/* ── Header: Logo + Date ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 72, height: 72, background: BRAND_YELLOW, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" fill={BRAND_BLUE} />
              <line x1="7" y1="7" x2="7.01" y2="7" stroke={BRAND_YELLOW} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ color: "white", fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>BOXIUM</div>
            <div style={{ color: BRAND_YELLOW, fontSize: 16, fontWeight: 600, letterSpacing: 3, marginTop: 3 }}>PTCG</div>
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 20, fontWeight: 500 }}>{dateStr}</div>
      </div>

      {/* ── Title ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 22, fontWeight: 500, marginBottom: 6 }}>
          {userName ? `${userName} 的收藏報告` : "我的卡牌收藏"}
        </div>
        <div style={{ color: "white", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>個人收藏價值總覽</div>
        <div style={{ width: 72, height: 5, background: BRAND_YELLOW, borderRadius: 3, marginTop: 14 }} />
      </div>

      {/* ── Main Value Card ── */}
      <div style={{ background: BRAND_YELLOW, borderRadius: 28, padding: "32px 44px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -24, right: -24, width: 140, height: 140, borderRadius: "50%", background: "rgba(6,3,141,0.08)" }} />
        <div style={{ color: BRAND_BLUE, fontSize: 20, fontWeight: 700, marginBottom: 8, opacity: 0.65 }}>總市值</div>
        <div style={{ color: BRAND_BLUE, fontSize: 60, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>{stats.currency}</div>
        <div style={{ color: BRAND_BLUE, fontSize: 58, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.1 }}>{formatNum(stats.totalMarketValue)}</div>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
        {/* Cost */}
        <div style={{ background: "rgba(255,255,255,0.09)", borderRadius: 20, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.13)" }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 17, fontWeight: 500, marginBottom: 8 }}>購入成本</div>
          <div style={{ color: "white", fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{stats.currency}</div>
          <div style={{ color: "white", fontSize: 20, fontWeight: 800 }}>{formatNum(stats.totalCost)}</div>
        </div>
        {/* Holdings */}
        <div style={{ background: "rgba(255,255,255,0.09)", borderRadius: 20, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.13)" }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 17, fontWeight: 500, marginBottom: 8 }}>持有</div>
          <div style={{ color: "white", fontSize: 44, fontWeight: 900, lineHeight: 1 }}>{stats.totalQuantity}</div>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 18, fontWeight: 600 }}>張卡牌</div>
        </div>
        {/* P&L */}
        <div style={{ background: isGain ? "rgba(22,163,74,0.14)" : "rgba(220,38,38,0.14)", borderRadius: 20, padding: "20px 22px", border: `1px solid ${isGain ? "rgba(22,163,74,0.28)" : "rgba(220,38,38,0.28)"}` }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 17, fontWeight: 500, marginBottom: 8 }}>盈虧</div>
          <div style={{ color: gainColor, fontSize: 22, fontWeight: 900, lineHeight: 1.2 }}>
            {gainSign}{stats.totalGainPct.toFixed(1)}%
          </div>
          <div style={{ background: gainColor, color: "white", fontSize: 14, fontWeight: 800, padding: "3px 10px", borderRadius: 100, display: "inline-block", marginTop: 6 }}>
            {gainSign}{stats.currency} {formatNum(stats.totalGain)}
          </div>
        </div>
      </div>

      {/* ── Top 3 Cards Section ── */}
      {top3.length > 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 4, height: 28, background: BRAND_YELLOW, borderRadius: 2 }} />
            <div style={{ color: "white", fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>
              最高市值卡牌 TOP 3
            </div>
          </div>

          {/* Card items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {top3.slice(0, 3).map((item: any, idx: number) => {
              const cardName = item.card?.name || item.card?.nameJa || "Unknown";
              const cardNumber = item.card?.cardNumber || "";
              const grade = item.grade ? `${item.grader} ${item.grade}` : item.grader;
              const price = item.marketPrice;
              const imgUrl = item.card?.imageUrl;

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 20,
                    padding: "16px 20px",
                    border: idx === 0 ? `1.5px solid ${BRAND_YELLOW}40` : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: idx === 0 ? BRAND_YELLOW : "rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, fontWeight: 900,
                    color: idx === 0 ? BRAND_BLUE : "rgba(255,255,255,0.7)",
                  }}>
                    {idx + 1}
                  </div>

                  {/* Card thumbnail */}
                  {imgUrl ? (
                    <div style={{
                      width: 56, height: 78, borderRadius: 8, overflow: "hidden", flexShrink: 0,
                      border: "1.5px solid rgba(255,255,255,0.2)",
                      background: "rgba(0,0,0,0.3)",
                    }}>
                      <img
                        src={imgUrl}
                        alt={cardName}
                        crossOrigin="anonymous"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 56, height: 78, borderRadius: 8, flexShrink: 0,
                      background: "rgba(255,255,255,0.1)",
                      border: "1.5px solid rgba(255,255,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                        <path d="M3 9h18M9 3v18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                      </svg>
                    </div>
                  )}

                  {/* Card info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "white", fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
                      {shortName(cardName, 20)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {cardNumber && (
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 17, fontWeight: 500 }}>
                          #{cardNumber}
                        </div>
                      )}
                      <div style={{
                        background: "rgba(254,221,0,0.2)", color: BRAND_YELLOW,
                        fontSize: 15, fontWeight: 700, padding: "2px 10px", borderRadius: 100,
                      }}>
                        {grade}
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  {price != null && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: 500 }}>HKD</div>
                      <div style={{ color: idx === 0 ? BRAND_YELLOW : "white", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>
                        {formatNum(price)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        marginTop: top3.length > 0 ? 28 : "auto",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.12)",
      }}>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 18 }}>boxium.asia</div>
        <div style={{ background: BRAND_YELLOW, color: BRAND_BLUE, fontSize: 16, fontWeight: 800, padding: "7px 22px", borderRadius: 100, letterSpacing: 0.5 }}>
          立即追蹤你的收藏
        </div>
      </div>
    </div>
  );
});

ShareCardCanvas.displayName = "ShareCardCanvas";
