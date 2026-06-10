import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Zap, BarChart2, Clock, ChevronRight, Flame, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import { getProxiedImageUrl } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatCurrency";

// ─── Brand constants ─────────────────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

// ─── Tab type ─────────────────────────────────────────────────────────────────
type TabKey = "gainers" | "losers" | "volatile";
type PeriodKey = "7" | "14" | "30";

// ─── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-lg"
      style={{ background: "linear-gradient(135deg, #FFD700, #FFA500)", color: "#1a0a00" }}>
      1
    </div>
  );
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow"
      style={{ background: "linear-gradient(135deg, #C0C0C0, #A0A0A0)", color: "#1a1a1a" }}>
      2
    </div>
  );
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow"
      style={{ background: "linear-gradient(135deg, #CD7F32, #A0522D)", color: "#fff" }}>
      3
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
      style={{ background: "#f1f5f9", color: "#64748b" }}>
      {rank}
    </div>
  );
}

// ─── Price change badge ───────────────────────────────────────────────────────
function ChangeBadge({ value, isVolatility = false }: { value: number; isVolatility?: boolean }) {
  if (isVolatility) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ background: "#fef3c7", color: "#92400e" }}>
        <Zap className="w-3 h-3" />
        {value.toFixed(1)}%
      </span>
    );
  }
  const isPos = value >= 0;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{
        background: isPos ? "#dcfce7" : "#fee2e2",
        color: isPos ? GAIN_GREEN : LOSS_RED,
      }}>
      {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPos ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-200" />
      <div className="w-14 h-14 rounded-lg bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="w-20 h-6 bg-gray-200 rounded-full" />
    </div>
  );
}

// ─── Card row (list view) ─────────────────────────────────────────────────────
interface CardRowProps {
  rank: number;
  cardId: number;
  cardName: string;
  cardImage: string | null;
  currentPrice: number;
  changeValue: number;
  changeLabel: string;
  currency: string;
  isVolatility?: boolean;
  oldPrice?: number;
}

function CardRow({ rank, cardId, cardName, cardImage, currentPrice, changeValue, changeLabel, currency, isVolatility, oldPrice }: CardRowProps) {
  const imgSrc = cardImage ? getProxiedImageUrl(cardImage) : null;

  return (
    <Link href={`/card/${cardId}`}>
      <div className="group flex items-center gap-3 md:gap-4 px-4 py-3.5 border-b border-gray-100 hover:bg-blue-50/60 transition-all duration-200 cursor-pointer">
        {/* Rank */}
        <div className="flex-shrink-0">
          <RankBadge rank={rank} />
        </div>

        {/* Card image */}
        <div className="flex-shrink-0 w-12 h-16 md:w-14 md:h-[4.5rem] rounded-lg overflow-hidden bg-gray-100 shadow-sm border border-gray-200">
          {imgSrc ? (
            <img src={imgSrc} alt={cardName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
          )}
        </div>

        {/* Card info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold text-gray-900 truncate leading-tight group-hover:text-blue-800 transition-colors">
            {cardName}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">PSA 10</span>
            {oldPrice != null && oldPrice > 0 && (
              <span className="text-xs text-gray-400 line-through">{formatCurrency(oldPrice, currency)}</span>
            )}
          </div>
        </div>

        {/* Price + change */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
          <span className="text-sm md:text-base font-bold text-gray-900">
            {formatCurrency(currentPrice, currency)}
          </span>
          <ChangeBadge value={changeValue} isVolatility={isVolatility} />
        </div>

        {/* Arrow */}
        <ChevronRight className="flex-shrink-0 w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  );
}

// ─── Featured hero card (rank #1) ─────────────────────────────────────────────
interface HeroCardProps {
  cardId: number;
  cardName: string;
  cardImage: string | null;
  currentPrice: number;
  changeValue: number;
  currency: string;
  isVolatility?: boolean;
  label: string;
}

function HeroCard({ cardId, cardName, cardImage, currentPrice, changeValue, currency, isVolatility, label }: HeroCardProps) {
  const imgSrc = cardImage ? getProxiedImageUrl(cardImage) : null;
  const isPos = changeValue >= 0;

  return (
    <Link href={`/card/${cardId}`}>
      <div className="group relative overflow-hidden rounded-2xl cursor-pointer shadow-xl border border-white/20 h-full"
        style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a6b 60%, #2d1b8e 100%)` }}>
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(circle at 70% 50%, ${isPos ? "#22c55e" : "#ef4444"} 0%, transparent 60%)` }} />

        {/* Content */}
        <div className="relative z-10 p-5 md:p-6 flex flex-col h-full">
          {/* Label */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
              <Flame className="w-3 h-3" />
              {label}
            </span>
            <span className="text-white/60 text-xs">#1</span>
          </div>

          {/* Card image + info */}
          <div className="flex items-end gap-4 flex-1">
            <div className="w-20 md:w-24 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 group-hover:scale-105 transition-transform duration-300">
              {imgSrc ? (
                <img src={imgSrc} alt={cardName} className="w-full h-auto" />
              ) : (
                <div className="w-full aspect-[3/4] bg-white/10 flex items-center justify-center text-white/30 text-xs">No img</div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base md:text-lg leading-tight mb-2 line-clamp-2">
                {cardName}
              </p>
              <div className="text-white/70 text-xs mb-3">PSA 10 · SNKRDUNK</div>
              <div className="text-2xl md:text-3xl font-black text-white mb-2">
                {formatCurrency(currentPrice, currency)}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                style={{
                  background: isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                  color: isPos ? "#86efac" : "#fca5a5",
                  border: `1px solid ${isPos ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                }}>
                {isPos ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {isPos ? "+" : ""}{changeValue.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* View detail */}
          <div className="mt-4 flex items-center gap-1 text-white/50 text-xs group-hover:text-white/80 transition-colors">
            查看詳情 <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, color }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
        style={{ background: `${color}15`, border: `1.5px solid ${color}30` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <h2 className="text-base md:text-lg font-black text-gray-900 leading-tight">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Stat ticker ──────────────────────────────────────────────────────────────
function StatTicker({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-100">
      <span className="text-lg md:text-2xl font-black" style={{ color }}>{value}</span>
      <span className="text-[10px] md:text-xs text-gray-500 mt-0.5 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrendingPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<PeriodKey>("30");
  const [activeTab, setActiveTab] = useState<TabKey>("gainers");
  const [now, setNow] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const periodDays = parseInt(period);

  // Fetch data
  const { data: gainers = [], isLoading: gainersLoading } = trpc.marketInsights.getTopGainers.useQuery(
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

  // Derive losers from gainers (sorted ascending)
  const losers = [...gainers].sort((a, b) => a.priceChange - b.priceChange).slice(0, 10);

  const periodLabel: Record<PeriodKey, string> = {
    "7": "7天",
    "14": "14天",
    "30": "30天",
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "gainers", label: "漲幅榜", icon: <TrendingUp className="w-4 h-4" />, color: GAIN_GREEN },
    { key: "losers", label: "跌幅榜", icon: <TrendingDown className="w-4 h-4" />, color: LOSS_RED },
    { key: "volatile", label: "波動榜", icon: <Zap className="w-4 h-4" />, color: "#d97706" },
  ];

  const activeData = activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volatile;
  const isLoading = activeTab === "volatile" ? volatileLoading : gainersLoading;
  const heroCard = activeData[0] ?? null;
  const listCards = activeData.slice(1);

  // Format update time
  const updateTime = now.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" });
  const updateDate = now.toLocaleDateString("zh-HK", { month: "short", day: "numeric" });

  const sectionConfig = {
    gainers: {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "PSA 10 漲幅排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格升幅最大的卡牌`,
      color: GAIN_GREEN,
      heroLabel: "本期最大升幅",
    },
    losers: {
      icon: <TrendingDown className="w-5 h-5" />,
      title: "PSA 10 跌幅排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格跌幅最大的卡牌`,
      color: LOSS_RED,
      heroLabel: "本期最大跌幅",
    },
    volatile: {
      icon: <Zap className="w-5 h-5" />,
      title: "PSA 10 波動排行",
      subtitle: `過去 ${periodLabel[period]}，SNKRDUNK 成交價格波動最大的卡牌`,
      color: "#d97706",
      heroLabel: "本期最大波動",
    },
  };

  const cfg = sectionConfig[activeTab];

  return (
    <>
      <PageHead
        title={`TCG 漲幅榜 · PSA 10 市場排行 - BOXIUM`}
        description={`查看 Pokémon TCG PSA 10 評級卡牌的漲幅榜、跌幅榜和波動榜。基於 SNKRDUNK 真實成交數據，每日更新。`}
        keywords="PTCG 漲幅榜, PSA 10 價格, 寶可夢卡牌排行, SNKRDUNK 成交"
      />

      <div className="min-h-screen" style={{ background: "#f8f9fb" }}>

        {/* ── Magazine Header ─────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a6b 70%, #0d0550 100%)` }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-0">

            {/* Top bar */}
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

            {/* Magazine masthead */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-1 h-8 rounded-full" style={{ background: BRAND_YELLOW }} />
                  <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
                    TCG 市場排行榜
                  </h1>
                </div>
                <p className="text-white/60 text-sm md:text-base ml-4 pl-3 border-l border-white/20">
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
                    style={period === p
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
                value={overview?.totalPriceRecords ? `${(overview.totalPriceRecords / 10000).toFixed(0)}萬+` : "—"}
                color="#7c3aed"
              />
              <StatTicker
                label={`${periodLabel[period]}平均漲幅`}
                value={overview?.avgPriceChange7d != null && !isNaN(overview.avgPriceChange7d)
                  ? `${overview.avgPriceChange7d >= 0 ? "+" : ""}${overview.avgPriceChange7d.toFixed(1)}%`
                  : "—"}
                color={overview?.avgPriceChange7d != null && !isNaN(overview.avgPriceChange7d) && overview.avgPriceChange7d >= 0 ? GAIN_GREEN : LOSS_RED}
              />
            </div>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2 px-4 md:px-6 py-3.5 text-sm font-bold transition-all duration-200 border-b-2 -mb-px"
                  style={activeTab === tab.key
                    ? { color: tab.color, borderColor: tab.color }
                    : { color: "#9ca3af", borderColor: "transparent" }
                  }
                >
                  <span style={activeTab === tab.key ? { color: tab.color } : { color: "#9ca3af" }}>
                    {tab.icon}
                  </span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.slice(0, 2)}</span>
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">

          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : activeData.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">暫無足夠數據</p>
              <p className="text-gray-400 text-sm mt-1">請嘗試切換其他時間範圍</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">

              {/* Left: Hero card + section header */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                {/* Section header */}
                <SectionHeader
                  icon={cfg.icon}
                  title={cfg.title}
                  subtitle={cfg.subtitle}
                  color={cfg.color}
                />

                {/* Hero card */}
                {heroCard && (
                  <div className="flex-1">
                    <HeroCard
                      cardId={heroCard.cardId}
                      cardName={heroCard.cardName}
                      cardImage={heroCard.cardImage ?? null}
                      currentPrice={activeTab === "volatile"
                        ? (heroCard as any).avgPrice
                        : (heroCard as any).latestPrice}
                      changeValue={activeTab === "volatile"
                        ? (heroCard as any).volatility
                        : (heroCard as any).priceChange}
                      currency={heroCard.currency}
                      isVolatility={activeTab === "volatile"}
                      label={cfg.heroLabel}
                    />
                  </div>
                )}

                {/* Data source note */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="w-5 h-5 flex-shrink-0">
                    <img src="/snkrdunk-logo.png" alt="SNKRDUNK" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <p className="text-xs text-blue-700 leading-tight">
                    數據來源：SNKRDUNK 實際成交記錄，每日自動更新
                  </p>
                </div>
              </div>

              {/* Right: Ranking list */}
              <div className="lg:col-span-2">
                {/* Magazine-style issue header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">排名</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">Top {listCards.length + 1}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {periodLabel[period]}統計
                  </span>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Table header */}
                  <div className="flex items-center gap-3 md:gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="w-8 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">排名</div>
                    <div className="w-14 flex-shrink-0" />
                    <div className="flex-1 text-xs font-bold text-gray-400 uppercase tracking-wider">卡牌</div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-right pr-8">
                      {activeTab === "volatile" ? "波動率" : "漲跌幅"}
                    </div>
                  </div>

                  {/* Rows #2 onwards */}
                  {listCards.map((card, idx) => {
                    const isVolatility = activeTab === "volatile";
                    const currentPrice = isVolatility ? (card as any).avgPrice : (card as any).latestPrice;
                    const changeValue = isVolatility ? (card as any).volatility : (card as any).priceChange;
                    const oldPrice = isVolatility ? undefined : (card as any).oldestPrice;
                    return (
                      <CardRow
                        key={card.cardId}
                        rank={idx + 2}
                        cardId={card.cardId}
                        cardName={card.cardName}
                        cardImage={card.cardImage ?? null}
                        currentPrice={currentPrice}
                        changeValue={changeValue}
                        changeLabel={isVolatility ? "波動率" : "漲跌幅"}
                        currency={card.currency}
                        isVolatility={isVolatility}
                        oldPrice={oldPrice}
                      />
                    );
                  })}

                  {/* Empty state for list */}
                  {listCards.length === 0 && heroCard && (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      目前只有 1 筆符合條件的數據
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-gray-400 mt-3 px-1 leading-relaxed">
                  * 以上數據僅供參考，不構成投資建議。卡牌市場價格受多種因素影響，請自行評估風險。
                </p>
              </div>
            </div>
          )}

          {/* ── Market insight CTA ───────────────────────────────────── */}
          <div className="mt-8 md:mt-10 rounded-2xl overflow-hidden shadow-lg"
            style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a0a6b 100%)` }}>
            <div className="px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
                    AI 分析
                  </span>
                </div>
                <h3 className="text-white font-black text-lg md:text-xl">想了解更多市場趨勢？</h3>
                <p className="text-white/60 text-sm mt-1">查看完整 PSA 10 價格走勢圖，追蹤你的心儀卡牌</p>
              </div>
              <div className="flex gap-3">
                <Link href="/pricing">
                  <button className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}>
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
