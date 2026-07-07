import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, TrendingDown, Zap, Clock, Share2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import { getProxiedImageUrl } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";

// ─── Brand / accent constants ─────────────────────────────────────────────────
const GAIN_GREEN  = "#00ff87";   // neon green sticker
const LOSS_RED    = "#ff3b5c";   // neon red sticker
const VOLT_AMBER  = "#ffd60a";   // neon amber sticker

// ─── Collage hero: 20 card positions (% of container) ────────────────────────
const HERO_POSITIONS = [
  { top:  '-4%', left: '0%',   w: '14%', r: '-1.5deg', z: 7  },
  { top:   '4%', left: '12%',  w: '11%', r:  '1.2deg', z: 9  },
  { top:  '-2%', left: '22%',  w: '13%', r: '-0.8deg', z: 8  },
  { top:   '8%', left: '33%',  w: '12%', r:  '2deg',   z: 10 },
  { top:  '-3%', left: '44%',  w: '10%', r: '-1.8deg', z: 6  },
  { top:   '2%', left: '53%',  w: '14%', r:  '1deg',   z: 11 },
  { top:  '-1%', left: '66%',  w: '11%', r: '-1.2deg', z: 7  },
  { top:   '6%', left: '76%',  w: '13%', r:  '1.8deg', z: 9  },
  { top:  '-5%', left: '87%',  w: '12%', r: '-0.5deg', z: 8  },
  { top:  '28%', left: '2%',   w: '12%', r:  '1.5deg', z: 7  },
  { top:  '22%', left: '14%',  w: '15%', r: '-1deg',   z: 12 },
  { top:  '26%', left: '29%',  w: '11%', r:  '2.2deg', z: 8  },
  { top:  '20%', left: '40%',  w: '13%', r: '-1.5deg', z: 9  },
  { top:  '24%', left: '53%',  w: '10%', r:  '0.8deg', z: 6  },
  { top:  '18%', left: '63%',  w: '14%', r: '-0.8deg', z: 10 },
  { top:  '25%', left: '76%',  w: '12%', r:  '1.2deg', z: 8  },
  { top:  '22%', left: '87%',  w: '11%', r: '-2deg',   z: 7  },
  { top:  '50%', left: '5%',   w: '13%', r:  '1.8deg', z: 9  },
  { top:  '48%', left: '18%',  w: '11%', r: '-0.8deg', z: 8  },
  { top:  '52%', left: '29%',  w: '14%', r:  '1deg',   z: 10 },
];

// ─── Period / tab types ───────────────────────────────────────────────────────
type TabKey    = "gainers" | "losers" | "volatile";
type PeriodKey = "7" | "14" | "30";

// ─── Neon sticker badge ───────────────────────────────────────────────────────
function NeonBadge({
  value,
  isVolatility = false,
  size = "sm",
}: {
  value: number;
  isVolatility?: boolean;
  size?: "sm" | "lg";
}) {
  const isPos = value >= 0;
  const color  = isVolatility ? VOLT_AMBER : isPos ? GAIN_GREEN : LOSS_RED;
  const prefix = isVolatility ? "" : isPos ? "+" : "";
  const suffix = isVolatility ? "%" : "%";
  const fs     = size === "lg" ? "11px" : "9px";
  const px     = size === "lg" ? "7px" : "5px";
  const py     = size === "lg" ? "3px" : "2px";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        fontFamily: "monospace",
        fontWeight: 900,
        fontSize: fs,
        letterSpacing: "0.04em",
        color: "#000",
        background: color,
        borderRadius: "3px",
        padding: `${py} ${px}`,
        boxShadow: `0 0 8px ${color}80`,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {isVolatility ? <Zap size={8} strokeWidth={3} /> : isPos ? "▲" : "▼"}
      {prefix}{Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ─── Rank sticker ─────────────────────────────────────────────────────────────
function RankSticker({ rank }: { rank: number }) {
  const golds: Record<number, string> = {
    1: "linear-gradient(135deg,#FFD700,#FFA500)",
    2: "linear-gradient(135deg,#C0C0C0,#A0A0A0)",
    3: "linear-gradient(135deg,#CD7F32,#A0522D)",
  };
  const bg = golds[rank] || "rgba(255,255,255,0.12)";
  const tc = rank <= 2 ? "#000" : rank === 3 ? "#fff" : "rgba(255,255,255,0.7)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: bg,
        color: tc,
        fontSize: "9px",
        fontWeight: 900,
        fontFamily: "monospace",
        flexShrink: 0,
        boxShadow: rank <= 3 ? "0 2px 8px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {rank}
    </span>
  );
}

// ─── Gallery card tile ────────────────────────────────────────────────────────
function GalleryCard({
  rank,
  cardId,
  cardName,
  cardImage,
  currentPrice,
  changeValue,
  currency,
  isVolatility,
  tall,
}: {
  rank: number;
  cardId: number;
  cardName: string;
  cardImage: string | null;
  currentPrice: number;
  changeValue: number;
  currency: string;
  isVolatility?: boolean;
  tall?: boolean;
}) {
  const [, setLocation] = useLocation();
  const imgSrc = cardImage ? getProxiedImageUrl(cardImage) : null;

  return (
    <div
      className="group relative cursor-pointer flex-shrink-0"
      onClick={() => setLocation(`/card/${cardId}`)}
      style={{ breakInside: "avoid", marginBottom: "12px" }}
    >
      {/* Card image */}
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          aspectRatio: tall ? "3/5" : "3/4",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.04)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px rgba(0,0,0,0.85)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.7)";
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={cardName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", fontFamily: "monospace" }}>NO IMG</span>
          </div>
        )}

        {/* Bottom gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: "55%", background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)" }}
        />

        {/* Rank sticker — top-left */}
        <div className="absolute top-2 left-2">
          <RankSticker rank={rank} />
        </div>

        {/* Change sticker — top-right */}
        <div className="absolute top-2 right-2">
          <NeonBadge value={changeValue} isVolatility={isVolatility} />
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
          <p
            className="text-white font-semibold leading-tight line-clamp-2 mb-1"
            style={{ fontSize: "9px", letterSpacing: "0.01em" }}
          >
            {cardName}
          </p>
          <div className="flex items-center justify-between">
            <span
              style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}
            >
              PSA 10
            </span>
            <span
              style={{ fontSize: "9px", color: "rgba(255,255,255,0.85)", fontFamily: "monospace", fontWeight: 700 }}
            >
              {formatCurrency(currentPrice, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton gallery tile ────────────────────────────────────────────────────
function SkeletonTile({ tall }: { tall?: boolean }) {
  return (
    <div
      className="rounded-lg overflow-hidden bg-white/5 animate-pulse flex-shrink-0"
      style={{ aspectRatio: tall ? "3/5" : "3/4", marginBottom: "12px" }}
    />
  );
}

// ─── Share image button ───────────────────────────────────────────────────────
function ShareImageButton({ type, days, items }: { type: string; days: number; items: any[] }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!items || items.length === 0) { alert("暫無排名數據，請稍後再試"); return; }
    setIsGenerating(true);
    try {
      const shareItems = items.slice(0, 5).map((item: any, idx: number) => ({
        rank: idx + 1,
        cardName: item.cardName || item.name || "Unknown Card",
        cardNumber: item.cardNumber || undefined,
        setName: item.setName || undefined,
        latestPrice: Number(item.latestPrice || item.avgPrice || item.currentPrice || 0),
        currency: item.currency || "HKD",
        changePercent: Number(item.priceChange || item.volatility || 0),
        cardImageUrl: item.cardImage || item.imageUrl || undefined,
      }));
      const res = await fetch("/api/share/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, days, items: shareItems }),
      });
      if (!res.ok) throw new Error("Failed to generate image");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const typeLabel = type === "gainers" ? "漲幅榜" : type === "losers" ? "跌幅榜" : "波動榜";
      a.download = `BOXIUM-PTCG-${typeLabel}-${days}D-${new Date().toLocaleDateString("zh-HK").replace(/\//g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error(err);
      alert("生成圖片失敗，請稍後再試");
    } finally {
      setIsGenerating(false);
    }
  }, [type, days, items]);

  return (
    <button
      onClick={handleGenerate}
      disabled={isGenerating}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-all"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.6)",
        opacity: isGenerating ? 0.6 : 1,
      }}
    >
      {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Share2 size={11} />}
      <span className="hidden sm:inline">{isGenerating ? "生成中…" : "分享圖"}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrendingPage() {
  const [period, setPeriod]       = useState<PeriodKey>("30");
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [now, setNow]             = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const periodDays = parseInt(period);
  const periodLabel: Record<PeriodKey, string> = { "7": "7D", "14": "14D", "30": "30D" };

  const { data: gainers  = [], isLoading: gainersLoading  } = trpc.marketInsights.getTopGainers.useQuery({ days: periodDays, limit: 20 }, { staleTime: 5 * 60_000 });
  const { data: losers   = [], isLoading: losersLoading   } = trpc.marketInsights.getTopLosers.useQuery({ days: periodDays, limit: 20 }, { staleTime: 5 * 60_000 });
  const { data: volatile = [], isLoading: volatileLoading } = trpc.marketInsights.getTopVolatile.useQuery({ days: periodDays, limit: 20 }, { staleTime: 5 * 60_000 });
  const { data: overview } = trpc.marketInsights.getMarketOverview.useQuery(undefined, { staleTime: 10 * 60_000 });

  const activeData = activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volatile;
  const isLoading  = activeTab === "volatile" ? volatileLoading : activeTab === "losers" ? losersLoading : gainersLoading;

  // Hero collage: top 20 from current tab
  const heroCards = activeData.slice(0, 20);

  const tabs = [
    { key: "gainers"  as TabKey, label: "漲幅榜", icon: <TrendingUp  size={13} />, neon: GAIN_GREEN  },
    { key: "losers"   as TabKey, label: "跌幅榜", icon: <TrendingDown size={13} />, neon: LOSS_RED    },
    { key: "volatile" as TabKey, label: "波動榜", icon: <Zap          size={13} />, neon: VOLT_AMBER  },
  ];

  const activeNeon = tabs.find((t) => t.key === activeTab)?.neon ?? GAIN_GREEN;

  const updateTime = now.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
  const updateDate = now.toLocaleDateString("zh-HK", { month: "short", day: "numeric" });

  // Masonry: split cards into 2 columns, alternating tall/normal
  const col1 = activeData.filter((_, i) => i % 2 === 0);
  const col2 = activeData.filter((_, i) => i % 2 === 1);

  return (
    <>
      <PageHead
        title="TCG 漲幅榜 · PSA 10 市場排行 - BOXIUM"
        description="查看 Pokémon TCG PSA 10 評級卡牌的漲幅榜、跌幅榜和波動榜。基於 SNKRDUNK 真實成交數據，每日更新。"
        keywords="PTCG 漲幅榜, PSA 10 價格, 寶可夢卡牌排行, SNKRDUNK 成交"
      />

      {/* ── Ambient glows ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute" style={{ top: "-20%", left: "-10%", width: "60vw", height: "60vw", background: `radial-gradient(circle, ${activeNeon}12 0%, transparent 70%)`, filter: "blur(80px)", transition: "background 0.6s ease" }} />
        <div className="absolute" style={{ bottom: "-20%", right: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(80,40,160,0.08) 0%, transparent 70%)", filter: "blur(70px)" }} />
      </div>

      <div className="relative z-10">

        {/* ════════════════════════════════════════════════════════════════
            HERO: Collage poster wall
        ════════════════════════════════════════════════════════════════ */}
        <div
          className="relative overflow-hidden"
          style={{ height: "clamp(260px, 42vh, 420px)" }}
        >
          {/* Gradient fade bottom */}
          <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none" style={{ height: "55%", background: "linear-gradient(to top, #111215 0%, transparent 100%)" }} />
          {/* Gradient fade top */}
          <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none" style={{ height: "40px", background: "linear-gradient(to bottom, #111215 0%, transparent 100%)" }} />

          {/* Collage cards */}
          {isLoading
            ? HERO_POSITIONS.map((pos, i) => (
                <div
                  key={i}
                  className="absolute rounded-lg bg-white/5 animate-pulse"
                  style={{ top: pos.top, left: pos.left, width: pos.w, aspectRatio: "3/4", transform: `rotate(${pos.r})`, zIndex: pos.z }}
                />
              ))
            : heroCards.map((card, i) => {
                const pos = HERO_POSITIONS[i] || HERO_POSITIONS[0];
                const imgSrc = card.cardImage ? getProxiedImageUrl(card.cardImage) : null;
                return (
                  <div
                    key={card.cardId}
                    className="absolute rounded-lg overflow-hidden group cursor-pointer"
                    style={{
                      top: pos.top, left: pos.left, width: pos.w,
                      aspectRatio: "3/4",
                      transform: `rotate(${pos.r})`,
                      zIndex: pos.z,
                      boxShadow: "0 8px 28px rgba(0,0,0,0.7)",
                      transition: "transform 0.25s ease, z-index 0s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = `rotate(${pos.r}) scale(1.08)`;
                      (e.currentTarget as HTMLElement).style.zIndex = "50";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = `rotate(${pos.r}) scale(1)`;
                      (e.currentTarget as HTMLElement).style.zIndex = String(pos.z);
                    }}
                    onClick={() => window.location.href = `/card/${card.cardId}`}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt={card.cardName} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                  </div>
                );
              })
          }

          {/* Floating stat micro-labels (z-index 20) */}
          <div className="absolute inset-0 z-20 pointer-events-none flex items-end pb-6 px-5 sm:px-8 gap-3">
            {overview?.totalCards ? (
              <div
                className="flex flex-col px-3 py-2 rounded-lg pointer-events-auto"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "14px", color: "#fff", letterSpacing: "-0.02em" }}>
                  {(overview.totalCards / 1000).toFixed(0)}K+
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  CARDS
                </span>
              </div>
            ) : null}
            {overview?.totalPriceRecords ? (
              <div
                className="flex flex-col px-3 py-2 rounded-lg pointer-events-auto"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "14px", color: "#fff", letterSpacing: "-0.02em" }}>
                  {(overview.totalPriceRecords / 10000).toFixed(0)}萬+
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  RECORDS
                </span>
              </div>
            ) : null}
            {overview?.avgPriceChange7d != null && !isNaN(overview.avgPriceChange7d) ? (
              <div
                className="flex flex-col px-3 py-2 rounded-lg pointer-events-auto"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "14px", letterSpacing: "-0.02em", color: overview.avgPriceChange7d >= 0 ? GAIN_GREEN : LOSS_RED }}>
                  {overview.avgPriceChange7d >= 0 ? "+" : ""}{overview.avgPriceChange7d.toFixed(1)}%
                </span>
                <span style={{ fontFamily: "monospace", fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  AVG CHANGE
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            EDITORIAL HEADER (below hero)
        ════════════════════════════════════════════════════════════════ */}
        <div className="px-5 sm:px-8 md:px-12 pt-4 pb-0">
          {/* Breadcrumb + timestamp */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Link href="/">
                <span className="text-[9px] uppercase tracking-[0.2em] cursor-pointer" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>BOXIUM</span>
              </Link>
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "10px" }}>/</span>
              <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>市場排行榜</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "9px", fontFamily: "monospace" }}>
              <Clock size={9} />
              <span>{updateDate} {updateTime}</span>
            </div>
          </div>

          {/* Headline */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <h1
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "clamp(28px, 4.5vw, 56px)",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                TCG MARKET<br />
                <span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>RANKINGS.</span>
              </h1>
              <p className="mt-2 text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                SNKRDUNK · PSA 10 · 真實成交數據
              </p>
            </div>

            {/* Period selector */}
            <div
              className="flex items-center gap-1 self-start sm:self-auto"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "4px" }}
            >
              {(["7", "14", "30"] as PeriodKey[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded text-[10px] font-bold transition-all duration-200"
                  style={
                    period === p
                      ? { background: activeNeon, color: "#000", fontFamily: "monospace" }
                      : { color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }
                  }
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div
            className="flex items-center gap-1 mb-6"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0" }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold transition-all duration-200 -mb-px"
                style={
                  activeTab === tab.key
                    ? { color: tab.neon, borderBottom: `2px solid ${tab.neon}`, fontFamily: "monospace", letterSpacing: "0.08em" }
                    : { color: "rgba(255,255,255,0.3)", borderBottom: "2px solid transparent", fontFamily: "monospace", letterSpacing: "0.08em" }
                }
              >
                <span style={activeTab === tab.key ? { color: tab.neon } : { color: "rgba(255,255,255,0.3)" }}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            <ShareImageButton type={activeTab} days={periodDays} items={activeData} />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            MASONRY GALLERY
        ════════════════════════════════════════════════════════════════ */}
        <div className="px-5 sm:px-8 md:px-12 pb-10">
          {isLoading ? (
            /* Skeleton: 2-column masonry */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonTile key={i} tall={i % 3 === 1} />
              ))}
            </div>
          ) : activeData.length === 0 ? (
            <div className="py-20 text-center">
              <p style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontSize: "12px" }}>
                此時間範圍內暫無足夠數據，請嘗試切換其他時間範圍
              </p>
            </div>
          ) : (
            /* True CSS masonry (columns) */
            <div
              style={{
                columnCount: 2,
                columnGap: "12px",
              }}
              className="md:[column-count:3] lg:[column-count:4]"
            >
              {activeData.map((card, idx) => {
                const isVolatility  = activeTab === "volatile";
                const currentPrice  = isVolatility ? (card as any).avgPrice    : (card as any).latestPrice;
                const changeValue   = isVolatility ? (card as any).volatility  : (card as any).priceChange;
                // Alternate tall/normal to create masonry rhythm
                const tall = idx % 5 === 1 || idx % 5 === 3;
                return (
                  <GalleryCard
                    key={card.cardId}
                    rank={idx + 1}
                    cardId={card.cardId}
                    cardName={card.cardName}
                    cardImage={card.cardImage ?? null}
                    currentPrice={currentPrice}
                    changeValue={changeValue}
                    currency={card.currency}
                    isVolatility={isVolatility}
                    tall={tall}
                  />
                );
              })}
            </div>
          )}

          {/* Disclaimer */}
          <p className="mt-4 text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
            * 以上數據僅供參考，不構成投資建議。卡牌市場價格受多種因素影響，請自行評估風險。數據來源：SNKRDUNK 實際成交記錄，每日自動更新。
          </p>

          {/* CTA strip */}
          <div
            className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-5 rounded-xl"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
          >
            <div>
              <p className="text-white font-bold text-sm leading-tight">想了解更多市場趨勢？</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginTop: "2px" }}>查看完整 PSA 10 價格走勢圖，追蹤你的心儀卡牌</p>
            </div>
            <div className="flex gap-2">
              <Link href="/pricing">
                <button
                  className="px-4 py-2 rounded text-[11px] font-bold"
                  style={{ background: activeNeon, color: "#000", fontFamily: "monospace" }}
                >
                  市場格價
                </button>
              </Link>
              <Link href="/research">
                <button
                  className="px-4 py-2 rounded text-[11px] font-bold"
                  style={{ border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}
                >
                  搜尋卡牌
                </button>
              </Link>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
