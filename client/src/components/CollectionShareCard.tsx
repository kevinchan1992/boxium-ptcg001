/**
 * CollectionShareCard — Generates a shareable 1080×1080 image card
 * showing the user's collection value for FB/IG sharing.
 *
 * Uses html2canvas to render a hidden DOM node to a PNG blob,
 * then offers download + Web Share API.
 */
import { useRef, useState, useCallback } from "react";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Share2, Download, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

// ─── Brand tokens ──────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

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
  };
  userName?: string;
  onClose: () => void;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        width: 1080,
        height: 1080,
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
    const canvas = previewUrl
      ? null
      : await generateImage();

    let dataUrl: string;
    if (previewUrl) {
      dataUrl = previewUrl;
    } else if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else {
      return;
    }

    const link = document.createElement("a");
    link.download = `boxium-collection-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [previewUrl, generateImage]);

  const handleShare = useCallback(async () => {
    const canvas = previewUrl ? null : await generateImage();
    let dataUrl: string;
    if (previewUrl) {
      dataUrl = previewUrl;
    } else if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
      setPreviewUrl(dataUrl);
    } else {
      return;
    }

    // Convert to blob for Web Share API
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
    // Fallback: download
    const link = document.createElement("a");
    link.download = "boxium-collection.png";
    link.href = dataUrl;
    link.click();
  }, [previewUrl, generateImage, stats]);

  // If no preview yet, show the card + generate button
  // If preview exists, show the preview image + action buttons

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Preview or Card */}
        {previewUrl ? (
          <div className="p-4">
            <img src={previewUrl} alt="分享卡預覽" className="w-full rounded-2xl" />
          </div>
        ) : (
          /* Hidden render target — 1080×1080 scaled down via CSS */
          <div className="overflow-hidden" style={{ height: 320 }}>
            <div
              style={{
                width: 1080,
                height: 1080,
                transform: "scale(0.296)",
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

        {/* Hidden full-size canvas for capture (always rendered) */}
        {previewUrl && (
          <div
            style={{
              position: "absolute",
              left: -9999,
              top: -9999,
              width: 1080,
              height: 1080,
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
        <div className="p-4 pt-0 space-y-2">
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

// ─── The actual 1080×1080 card DOM ────────────────────────────
import { forwardRef } from "react";

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

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: `linear-gradient(145deg, ${BRAND_BLUE} 0%, #0a06c4 50%, #06038d 100%)`,
        fontFamily: "'Helvetica Neue', Arial, 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "72px 80px",
        boxSizing: "border-box",
      }}
    >
      {/* Background decorative circles */}
      <div style={{
        position: "absolute", top: -120, right: -120,
        width: 480, height: 480,
        borderRadius: "50%",
        background: "rgba(254,221,0,0.08)",
      }} />
      <div style={{
        position: "absolute", bottom: -80, left: -80,
        width: 320, height: 320,
        borderRadius: "50%",
        background: "rgba(254,221,0,0.06)",
      }} />
      <div style={{
        position: "absolute", top: 300, right: -60,
        width: 200, height: 200,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />

      {/* ── Header: Logo + Brand ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 60 }}>
        {/* Logo area */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Yellow square logo */}
          <div style={{
            width: 80, height: 80,
            background: BRAND_YELLOW,
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {/* Tag icon in blue */}
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" fill={BRAND_BLUE} />
              <line x1="7" y1="7" x2="7.01" y2="7" stroke={BRAND_YELLOW} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div style={{ color: "white", fontSize: 44, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
              BOXIUM
            </div>
            <div style={{ color: BRAND_YELLOW, fontSize: 18, fontWeight: 600, letterSpacing: 3, marginTop: 4 }}>
              PTCG
            </div>
          </div>
        </div>
        {/* Date */}
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 22, fontWeight: 500 }}>
          {dateStr}
        </div>
      </div>

      {/* ── Title ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 24, fontWeight: 500, marginBottom: 8 }}>
          {userName ? `${userName} 的收藏報告` : "我的卡牌收藏"}
        </div>
        <div style={{ color: "white", fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>
          個人收藏價值總覽
        </div>
        {/* Yellow underline */}
        <div style={{ width: 80, height: 5, background: BRAND_YELLOW, borderRadius: 3, marginTop: 16 }} />
      </div>

      {/* ── Main Value Card ── */}
      <div style={{
        background: BRAND_YELLOW,
        borderRadius: 32,
        padding: "40px 48px",
        marginBottom: 32,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: 160, height: 160,
          borderRadius: "50%",
          background: "rgba(6,3,141,0.08)",
        }} />
        <div style={{ color: BRAND_BLUE, fontSize: 22, fontWeight: 700, marginBottom: 12, opacity: 0.7 }}>
          總市值
        </div>
        <div style={{ color: BRAND_BLUE, fontSize: 72, fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
          {stats.currency}
        </div>
        <div style={{ color: BRAND_BLUE, fontSize: 68, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1 }}>
          {formatNum(stats.totalMarketValue)}
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
        {/* Purchase Cost */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "28px 32px",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: 500, marginBottom: 10 }}>
            購入成本
          </div>
          <div style={{ color: "white", fontSize: 32, fontWeight: 800 }}>
            {stats.currency}
          </div>
          <div style={{ color: "white", fontSize: 30, fontWeight: 800 }}>
            {formatNum(stats.totalCost)}
          </div>
        </div>

        {/* Holdings */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: "28px 32px",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: 500, marginBottom: 10 }}>
            持有
          </div>
          <div style={{ color: "white", fontSize: 56, fontWeight: 900, lineHeight: 1 }}>
            {stats.totalQuantity}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 24, fontWeight: 600 }}>
            張卡牌
          </div>
        </div>

        {/* Unrealized P&L */}
        <div style={{
          background: isGain ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.15)",
          borderRadius: 24,
          padding: "28px 32px",
          border: `1px solid ${isGain ? "rgba(22,163,74,0.3)" : "rgba(220,38,38,0.3)"}`,
          gridColumn: "1 / -1",
        }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: 500, marginBottom: 10 }}>
            未實現盈虧
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div style={{ color: gainColor, fontSize: 44, fontWeight: 900 }}>
              {gainSign}{stats.currency} {formatNum(stats.totalGain)}
            </div>
            <div style={{
              background: gainColor,
              color: "white",
              fontSize: 22,
              fontWeight: 800,
              padding: "4px 16px",
              borderRadius: 100,
            }}>
              {gainSign}{stats.totalGainPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 24,
        borderTop: "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 20 }}>
          boxium.asia
        </div>
        <div style={{
          background: BRAND_YELLOW,
          color: BRAND_BLUE,
          fontSize: 18,
          fontWeight: 800,
          padding: "8px 24px",
          borderRadius: 100,
          letterSpacing: 0.5,
        }}>
          立即追蹤你的收藏
        </div>
      </div>
    </div>
  );
});

ShareCardCanvas.displayName = "ShareCardCanvas";
