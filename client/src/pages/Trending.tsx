import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Zap, BarChart2, Clock, ChevronRight, ArrowUpRight, ArrowDownRight, Share2, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import { getProxiedImageUrl } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";

// ─── Brand constants ─────────────────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

// ─── Tab / Period types ───────────────────────────────────────────────────────
type TabKey = "gainers" | "losers" | "volatile";
type PeriodKey = "7" | "14" | "30";

// ─── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#1a0a00" }}
      >
        1
      </div>
    );
  if (rank === 2)
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #C0C0C0, #A0A0A0)", color: "#1a1a1a" }}
      >
        2
      </div>
    );
  if (rank === 3)
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #CD7F32, #A0522D)", color: "#fff" }}
      >
        3
      </div>
    );
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: "#f1f5f9", color: "#64748b" }}
    >
      {rank}
    </div>
  );
}

// ─── Price change badge ───────────────────────────────────────────────────────
function ChangeBadge({ value, isVolatility = false }: { value: number; isVolatility?: boolean }) {
  if (isVolatility) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
        style={{ background: "#fef3c7", color: "#92400e" }}
      >
        <Zap className="w-3 h-3" />
        {value.toFixed(1)}%
      </span>
    );
  }
  const isPos = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
      style={{
        background: isPos ? "#dcfce7" : "#fee2e2",
        color: isPos ? GAIN_GREEN : LOSS_RED,
      }}
    >
      {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPos ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="w-12 h-16 rounded-lg bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-5 bg-gray-200 rounded-full w-16" />
      </div>
    </div>
  );
}

// ─── Card row ─────────────────────────────────────────────────────────────────
interface CardRowProps {
  rank: number;
  cardId: number;
  cardName: string;
  cardImage: string | null;
  currentPrice: number;
  changeValue: number;
  currency: string;
  isVolatility?: boolean;
  isFirst?: boolean;
}

function CardRow({
  rank,
  cardId,
  cardName,
  cardImage,
  currentPrice,
  changeValue,
  currency,
  isVolatility,
  isFirst,
}: CardRowProps) {
  const imgSrc = cardImage ? getProxiedImageUrl(cardImage) : null;

  return (
    <tr
      className={`group border-b border-gray-100 hover:bg-blue-50/60 transition-all duration-200 cursor-pointer ${
        isFirst ? "bg-amber-50/40" : ""
      }`}
      onClick={() => window.location.href = `/card/${cardId}`}
    >
      {/* Rank — col 1 */}
      <td className="text-center py-3 px-1 align-middle">
        <RankBadge rank={rank} />
      </td>

      {/* Image — col 2 */}
      <td className="py-3 align-middle">
        <div className="w-10 h-14 rounded-lg overflow-hidden bg-gray-100 shadow-sm border border-gray-200 mx-auto">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={cardName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
              No img
            </div>
          )}
        </div>
      </td>

      {/* Name + PSA — col 3, wraps freely */}
      <td className="py-3 pl-3 pr-2 align-middle">
        <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-blue-800 transition-colors break-words">
          {cardName}
        </p>
        <span className="text-xs text-gray-400 font-medium mt-0.5 block">PSA 10</span>
      </td>

      {/* Price + badge — col 4, always same column */}
      <td className="py-3 pr-2 align-middle text-right">
        <span className="text-sm font-bold text-gray-900 whitespace-nowrap block">
          {formatCurrency(currentPrice, currency)}
        </span>
        <div className="flex justify-end mt-1.5">
          <ChangeBadge value={changeValue} isVolatility={isVolatility} />
        </div>
      </td>

      {/* Arrow — col 5 */}
      <td className="py-3 align-middle text-center">
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all inline-block" />
      </td>
    </tr>
  );
}

// ─── Stat ticker ──────────────────────────────────────────────────────────────
function StatTicker({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-100">
      <span className="text-lg md:text-2xl font-black" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] md:text-xs text-gray-500 mt-0.5 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// ─── Share Image Button ──────────────────────────────────────────────────────
function ShareImageButton({ type, days, limit }: { type: string; days: number; limit: number }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const url = `/api/share/trending?type=${type}&days=${days}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to generate image");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    } catch (err) {
      console.error(err);
      alert("生成圖片失敗，請稍後再試");
    } finally {
      setIsGenerating(false);
    }
  }, [type, days, limit]);

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    const typeLabel = type === "gainers" ? "漲幅榜" : type === "losers" ? "跌幅榜" : "波動榜";
    a.download = `BOXIUM-PTCG-${typeLabel}-${days}D-${new Date().toLocaleDateString("zh-HK").replace(/\//g, "-")}.png`;
    a.click();
  }, [previewUrl, type, days]);

  const handleClose = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border"
        style={{
          background: "#06038d",
          color: "#FEDD00",
          borderColor: "#06038d",
          opacity: isGenerating ? 0.7 : 1,
        }}
        title="生成社媒分享圖 (1080×1080)"
      >
        {isGenerating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{isGenerating ? "生成中…" : "分享圖"}</span>
      </button>

      {/* Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={handleClose}
        >
          <div
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-sm text-gray-900">分享圖預覽</span>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            {/* Image */}
            <img src={previewUrl} alt="分享圖" className="w-full" />
            {/* Actions */}
            <div className="flex gap-2 p-4">
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "#06038d", color: "#FEDD00" }}
              >
                <Download className="w-4 h-4" />
                下載 PNG (1080×1080)
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center pb-3 px-4">
              適用於 Threads / Instagram 正方形貼文
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrendingPage() {
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const periodDays = parseInt(period);

  const { data: gainers = [], isLoading: gainersLoading } = trpc.marketInsights.getTopGainers.useQuery(
    { days: periodDays, limit: 10 },
    { staleTime: 5 * 60 * 1000 }
  );
  const { data: losers = [], isLoading: losersLoading } = trpc.marketInsights.getTopLosers.useQuery(
    { days: periodDays, limit: 10 },
    { staleTime: 5 * 60 * 1000 }
  );
  const { data: volatile = [], isLoading: volatileLoading } = trpc.marketInsights.getTopVolatile.useQuery(
    { days: periodDays, limit: 10 },
    { staleTime: 5 * 60 * 1000 }
  );
  const { data: overview } = trpc.marketInsights.getMarketOverview.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });

  const periodLabel: Record<PeriodKey, string> = { "7": "7天", "14": "14天", "30": "30天" };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "gainers", label: "漲幅榜", icon: <TrendingUp className="w-4 h-4" />, color: GAIN_GREEN },
    { key: "losers", label: "跌幅榜", icon: <TrendingDown className="w-4 h-4" />, color: LOSS_RED },
    { key: "volatile", label: "波動榜", icon: <Zap className="w-4 h-4" />, color: "#d97706" },
  ];

  const activeData = activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volatile;
  const isLoading =
    activeTab === "volatile" ? volatileLoading : activeTab === "losers" ? losersLoading : gainersLoading;

  const sectionConfig = {
    gainers: {
      title: "PSA 10 漲幅排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格升幅最大的 PSA 10 卡牌`,
      color: GAIN_GREEN,
      icon: <TrendingUp className="w-5 h-5" />,
    },
    losers: {
      title: "PSA 10 跌幅排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格跌幅最大的 PSA 10 卡牌`,
      color: LOSS_RED,
      icon: <TrendingDown className="w-5 h-5" />,
    },
    volatile: {
      title: "PSA 10 波動排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格波動最大的 PSA 10 卡牌`,
      color: "#d97706",
      icon: <Zap className="w-5 h-5" />,
    },
  };
  const cfg = sectionConfig[activeTab];

  const updateTime = now.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
  const updateDate = now.toLocaleDateString("zh-HK", { month: "short", day: "numeric" });

  return (
    <>
      <PageHead
        title="TCG 漲幅榜 · PSA 10 市場排行 - BOXIUM"
        description="查看 Pokémon TCG PSA 10 評級卡牌的漲幅榜、跌幅榜和波動榜。基於 SNKRDUNK 真實成交數據，每日更新。"
        keywords="PTCG 漲幅榜, PSA 10 價格, 寶可夢卡牌排行, SNKRDUNK 成交"
      />

      <div className="min-h-screen" style={{ background: "#f8f9fb" }}>

        {/* ── Magazine Header ─────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a6b 70%, #0d0550 100%)` }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-0">

            {/* Breadcrumb + timestamp */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <span className="text-white/60 text-xs hover:text-white/90 transition-colors cursor-pointer">BOXIUM</span>
                </Link>
                <span className="text-white/30 text-xs">/</span>
                <span className="text-white/90 text-xs font-semibold">市場排行榜</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs">
                <Clock className="w-3 h-3" />
                <span>更新於 {updateDate} {updateTime}</span>
              </div>
            </div>

            {/* Masthead */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-8 rounded-full" style={{ background: BRAND_YELLOW }} />
                  <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                    TCG 市場排行榜
                  </h1>
                </div>
                <p className="text-white/60 text-sm ml-4 pl-3 border-l border-white/20">
                  基於 SNKRDUNK 真實成交數據 · PSA 10 評級卡牌
                </p>
              </div>

              {/* Period selector */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 border border-white/20">
                {(["7", "14", "30"] as PeriodKey[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
                    style={
                      period === p
                        ? { background: BRAND_YELLOW, color: BRAND_BLUE }
                        : { color: "rgba(255,255,255,0.6)" }
                    }
                  >
                    {periodLabel[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats ticker */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 pb-6">
              <StatTicker
                label="追蹤卡牌"
                value={overview?.totalCards ? `${(overview.totalCards / 1000).toFixed(0)}K+` : "—"}
                color={BRAND_BLUE}
              />
              <StatTicker
                label="成交記錄"
                value={
                  overview?.totalPriceRecords
                    ? `${(overview.totalPriceRecords / 10000).toFixed(0)}萬+`
                    : "—"
                }
                color="#7c3aed"
              />
              <StatTicker
                label={`${periodLabel[period]}平均漲幅`}
                value={
                  overview?.avgPriceChange7d != null && !isNaN(overview.avgPriceChange7d)
                    ? `${overview.avgPriceChange7d >= 0 ? "+" : ""}${overview.avgPriceChange7d.toFixed(1)}%`
                    : "—"
                }
                color={
                  overview?.avgPriceChange7d != null &&
                  !isNaN(overview.avgPriceChange7d) &&
                  overview.avgPriceChange7d >= 0
                    ? GAIN_GREEN
                    : LOSS_RED
                }
              />
            </div>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-4 md:px-6 py-3.5 text-sm font-bold transition-all duration-200 border-b-2 -mb-px"
                  style={
                    activeTab === tab.key
                      ? { color: tab.color, borderColor: tab.color }
                      : { color: "#9ca3af", borderColor: "transparent" }
                  }
                >
                  <span style={activeTab === tab.key ? { color: tab.color } : { color: "#9ca3af" }}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
              <div className="flex-1" />
              <div className="flex items-center gap-1 text-xs text-gray-400 px-2">
                <BarChart2 className="w-3 h-3" />
                <span className="hidden md:inline">SNKRDUNK 數據</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-8">

          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: `${cfg.color}15`, border: `1.5px solid ${cfg.color}30` }}
            >
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-gray-900 leading-tight">{cfg.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.subtitle}</p>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:block">{periodLabel[period]}統計</span>
              <ShareImageButton
                type={activeTab}
                days={periodDays}
                limit={3}
              />
            </div>
          </div>

          {/* Card list */}
          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          ) : activeData.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">暫無足夠數據</p>
              <p className="text-gray-400 text-sm mt-1">
                此時間範圍內沒有找到至少有 2 筆 PSA 10 成交記錄的卡牌，請嘗試切換其他時間範圍
              </p>
            </div>
          ) : (
            <>
              {/* Table — HTML table for strict column alignment */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col style={{width: '2.5rem'}} />
                    <col style={{width: '3.5rem'}} />
                    <col />
                    <col style={{width: '9rem'}} />
                    <col style={{width: '1.5rem'}} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider py-2.5 px-1">#</th>
                      <th />
                      <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider py-2.5 pl-3">卡牌</th>
                      <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider py-2.5 pr-2">
                        {activeTab === "volatile" ? "波動率" : "漲跌幅"}
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.map((card, idx) => {
                      const isVolatility = activeTab === "volatile";
                      const currentPrice = isVolatility
                        ? (card as any).avgPrice
                        : (card as any).latestPrice;
                      const changeValue = isVolatility
                        ? (card as any).volatility
                        : (card as any).priceChange;
                      return (
                        <CardRow
                          key={card.cardId}
                          rank={idx + 1}
                          cardId={card.cardId}
                          cardName={card.cardName}
                          cardImage={card.cardImage ?? null}
                          currentPrice={currentPrice}
                          changeValue={changeValue}
                          currency={card.currency}
                          isVolatility={isVolatility}
                          isFirst={idx === 0}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-gray-400 mt-3 px-1 leading-relaxed">
                * 以上數據僅供參考，不構成投資建議。卡牌市場價格受多種因素影響，請自行評估風險。
              </p>
            </>
          )}

          {/* ── Data source note ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100 mt-4">
            <div className="w-5 h-5 flex-shrink-0">
              <img
                src="/snkrdunk-logo.png"
                alt="SNKRDUNK"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <p className="text-xs text-blue-700 leading-tight">
              數據來源：SNKRDUNK 實際成交記錄，每日自動更新。僅計算期間內有至少 2 筆 PSA 10 成交記錄的卡牌。
            </p>
          </div>

          {/* ── CTA ─────────────────────────────────────────────────── */}
          <div
            className="mt-6 md:mt-8 rounded-2xl overflow-hidden shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a6b 100%)` }}
          >
            <div className="px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                  >
                    AI 分析
                  </span>
                </div>
                <h3 className="text-white font-black text-lg md:text-xl">想了解更多市場趨勢？</h3>
                <p className="text-white/60 text-sm mt-1">查看完整 PSA 10 價格走勢圖，追蹤你的心儀卡牌</p>
              </div>
              <div className="flex gap-3">
                <Link href="/pricing">
                  <button
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
                  >
                    查看定價
                  </button>
                </Link>
                <Link href="/research">
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold border border-white/30 text-white hover:bg-white/10 transition-all">
                    搜尋卡牌
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
