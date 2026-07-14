/**
 * Vault — TCG 倉庫獨立頁面 (/vault)
 * Editorial Premium / Minimalist「洗鍊現代白」重構版
 * - 全域背景 #FAF9F6（Alabaster 暖白）
 * - 財務儀表板：Hero 大數字 + 橫向次要指標卡片
 * - 2/3 走勢圖 + 1/3 排行榜（Segmented Tab + 羅馬數字）
 * - 高對比輸入框 + 即時 ROI 計算
 */
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardPickerDialog, type SelectedCard } from "@/components/CardPickerDialog";
import { LazyImage } from "@/components/LazyImage";
import { getProxiedImageUrl } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, DollarSign,
  Plus, Search, Loader2, Star, BarChart3, Wallet,
  RefreshCw, Layers, X, Edit2, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Design tokens ────────────────────────────────────────────
const BG_PAGE    = "#FAF9F6";
const BG_CARD    = "#FFFFFF";
const BORDER     = "#EAEAEA";
const TEXT_PRI   = "#1A1A1A";
const TEXT_SEC   = "#737373";
const SUCCESS    = "#0F766E";
const DANGER     = "#991B1B";
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const LOGO_URL   = "/manus-storage/boxium-logo-yellow_5368dfb9.webp";

const ROMAN = ["I", "II", "III"];

// ─── Grade badge (精緻版：白底 + 彩點) ──────────────────────────
function GradeBadge({ grader, grade }: { grader: string; grade?: string | null }) {
  const dotColor: Record<string, string> = {
    PSA: "#dc2626", CGC: "#2563eb", BGS: "#7c3aed", RAW: "#9ca3af",
  };
  const dot = dotColor[grader?.toUpperCase()] ?? "#9ca3af";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        color: TEXT_PRI,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: dot }}
      />
      {/* Show grade if it already contains grader prefix (e.g. "PSA 10"), otherwise show "grader grade" */}
      {grade && grade.toUpperCase().startsWith(grader?.toUpperCase() ?? "__NONE__")
        ? grade
        : grade
          ? `${grader?.toUpperCase()} ${grade}`
          : grader?.toUpperCase()
      }
    </span>
  );
}

// ─── Metric card (secondary stats) ───────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, valueColor,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; valueColor?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 flex-1 min-w-0"
      style={{
        background: BG_CARD,
        border: `1px solid ${BORDER}`,
        // 單向朝下環境光投影
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
        // 頂部微弱漸層邊框（懸浮感）
        backgroundImage: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(250,249,246,0.4) 100%)",
      }}
    >
      <div className="flex items-center justify-between">
        {/* 小標籤：全大寫 + 拉寬字距 */}
        <span
          className="text-[9px] font-semibold uppercase"
          style={{ color: TEXT_SEC, letterSpacing: "0.2em" }}
        >
          {label}
        </span>
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#F5F5F3" }}>
          <Icon className="w-3 h-3" style={{ color: TEXT_SEC }} />
        </div>
      </div>
      <p
        className="text-lg font-bold tabular-nums leading-tight"
        style={{
          color: valueColor ?? TEXT_PRI,
          fontVariantNumeric: "tabular-nums",
          // 緊湊字距讓金融數字更專業
          letterSpacing: "-0.025em",
        }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px]" style={{ color: TEXT_SEC }}>{sub}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function Vault() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    trpc.profile.getCollectionStats.useQuery(undefined, { enabled: !!user, retry: 1 });

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"marketValue" | "gain" | "purchasedAt" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [graderFilter, setGraderFilter] = useState<string | undefined>(undefined);
  // 走勢圖固定展開，不再需要 showTrend toggle state
  const showTrend = true;
  const [searchQuery, setSearchQuery] = useState("");
  const [rankTab, setRankTab] = useState<"gain" | "value">("gain");

  const { data: collectionData, isLoading: itemsLoading, refetch: refetchItems } =
    trpc.profile.getCollection.useQuery(
      { page, sortBy, sortOrder, grader: graderFilter, limit: 20, priceMode: "grade" },
      { enabled: !!user, retry: 1 }
    );
  const { data: trendData } = trpc.profile.getPortfolioTrend.useQuery(
    undefined, { enabled: !!user, retry: 1 }
  );

  const items = collectionData?.items ?? [];
  const totalItems = collectionData?.total ?? 0;
  const totalPages = collectionData?.totalPages ?? 1;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.card?.name?.toLowerCase().includes(q) ||
      item.card?.cardNumber?.toLowerCase().includes(q) ||
      item.card?.series?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // ── Add card dialog state ─────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    grader: "PSA", grade: "10", quantity: 1,
    purchasePrice: "" as string | number, notes: "",
  });
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);

  // Reactive ROI calculation
  const currentMarketPrice = selectedCard?.referencePrice != null ? Number(selectedCard.referencePrice) : null;
  const purchasePriceNum = addForm.purchasePrice !== "" ? Number(addForm.purchasePrice) : null;
  const roiCalc = useMemo(() => {
    if (currentMarketPrice == null || purchasePriceNum == null || purchasePriceNum <= 0) return null;
    const qty = addForm.quantity || 1;
    const unrealized = (currentMarketPrice - purchasePriceNum) * qty;
    const roi = ((currentMarketPrice - purchasePriceNum) / purchasePriceNum) * 100;
    return { unrealized, roi };
  }, [currentMarketPrice, purchasePriceNum, addForm.quantity]);

  // ── Delete ────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const addMutation = trpc.profile.addToCollection.useMutation({
    onSuccess: () => {
      toast.success("已加入倉庫");
      setShowAddDialog(false);
      setSelectedCard(null);
      setAddForm({ grader: "PSA", grade: "10", quantity: 1, purchasePrice: "", notes: "" });
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = trpc.profile.removeFromCollection.useMutation({
    onSuccess: () => {
      toast.success("已從倉庫移除");
      setDeleteId(null);
      utils.profile.getCollection.invalidate();
      utils.profile.getCollectionStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAddSubmit() {
    if (!selectedCard) { toast.error("請先選擇卡牌"); return; }
    addMutation.mutate({
      cardId: selectedCard.id,
      grader: addForm.grader,
      grade: addForm.grade || null,
      quantity: addForm.quantity,
      purchasePrice: addForm.purchasePrice !== "" ? Number(addForm.purchasePrice) : null,
      notes: addForm.notes || null,
    });
  }

  const gainPct = stats?.totalGainPct ?? 0;
  const gainPositive = gainPct >= 0;

  // ── Loading ──────────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="min-h-screen" style={{ background: BG_PAGE }}>
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-12 space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: BG_PAGE }}>
        <div
          className="max-w-sm w-full rounded-2xl p-8 text-center"
          style={{ background: BG_CARD, border: `1px solid ${BORDER}`, boxShadow: "0 4px 20px -2px rgba(0,0,0,0.06)" }}
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: "#F5F5F3" }}>
            <Package className="w-8 h-8" style={{ color: TEXT_SEC }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: TEXT_PRI }}>TCG 倉庫</h2>
          <p className="text-sm mb-6" style={{ color: TEXT_SEC }}>登入後即可追蹤你的卡牌投資組合、分析升值走勢</p>
          <button
            className="w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: TEXT_PRI, color: "#FFFFFF" }}
            onClick={() => setLocation("/login")}
          >
            立即登入
          </button>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24" style={{ background: BG_PAGE }}>

      {/* ══ Masthead ══════════════════════════════════════════ */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{ background: "rgba(250,249,246,0.92)", backdropFilter: "blur(12px)", borderColor: BORDER }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            {/* BOXIUM in Rib One display font */}
            <span
              style={{
                fontFamily: "'Rib One', serif",
                fontSize: "22px",
                color: TEXT_PRI,
                letterSpacing: "0.02em",
                lineHeight: 1,
              }}
            >
              BOXIUM
            </span>
            <span
              className="text-[10px] font-bold tracking-[0.3em] uppercase px-1.5 py-0.5 rounded"
              style={{ color: TEXT_SEC, background: "#F0EDE8", letterSpacing: "0.25em" }}
            >
              VAULT
            </span>
          </div>
          {/* Add button */}
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{ background: TEXT_PRI, color: "#FFFFFF" }}
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">新增卡牌</span>
            <span className="sm:hidden">新增</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-6">

        {/* ══ Hero Financial Dashboard ══════════════════════ */}
        {statsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-2xl" />
            <div className="grid grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Hero stat */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                // 單向朝下環境光投影
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
                backgroundImage: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(250,249,246,0.5) 100%)",
              }}
            >
              {/* 小標籤：全大寫 + 拉寬字距 */}
              <p
                className="text-[9px] font-semibold uppercase mb-2"
                style={{ color: TEXT_SEC, letterSpacing: "0.2em" }}
              >
                PORTFOLIO VALUE
              </p>
              <p
                className="text-4xl sm:text-5xl font-bold leading-none tabular-nums"
                style={{
                  color: TEXT_PRI,
                  fontVariantNumeric: "tabular-nums",
                  // 緊湊字距讓大金額數字更專業
                  letterSpacing: "-0.03em",
                  // 使用 Playfair Display 襯線體增添奢華感
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                {formatCurrency(stats.totalMarketValue)}
              </p>
              {(stats.totalQuantity ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold tabular-nums"
                    style={{
                      background: gainPositive ? "#ECFDF5" : "#FEF2F2",
                      color: gainPositive ? SUCCESS : DANGER,
                    }}
                  >
                    {gainPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {gainPositive ? "▲" : "▼"} {Math.abs(gainPct).toFixed(1)}%
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: gainPositive ? SUCCESS : DANGER }}>
                    {gainPositive ? "+" : ""}{formatCurrency(stats.totalGain)}
                  </span>
                  <span className="text-xs" style={{ color: TEXT_SEC }}>未實現盈虧</span>
                </div>
              )}
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="購入成本"
                value={formatCurrency(stats.totalCost)}
                sub={`${stats.totalQuantity ?? 0} 張卡牌`}
                icon={DollarSign}
              />
              <MetricCard
                label="未實現盈虧"
                value={`${gainPositive ? "+" : ""}${formatCurrency(stats.totalGain)}`}
                sub={`${gainPositive ? "+" : ""}${gainPct.toFixed(1)}%`}
                icon={gainPositive ? TrendingUp : TrendingDown}
                valueColor={gainPositive ? SUCCESS : DANGER}
              />
              <MetricCard
                label="持有張數"
                value={`${stats.totalQuantity ?? 0} 張`}
                sub={`${stats.totalItems} 個品項`}
                icon={Layers}
              />
              <MetricCard
                label="平均每張成本"
                value={stats.totalCost > 0 && (stats.totalQuantity ?? 0) > 0
                  ? formatCurrency(stats.totalCost / (stats.totalQuantity ?? 1))
                  : "—"}
                icon={BarChart3}
              />
            </div>
          </div>
        ) : null}

        {/* ══ Split Layout: Trend Chart + Rankings ══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left 2/3: Trend Chart — 固定展開 */}
          <div
            className="lg:col-span-2 rounded-2xl overflow-hidden"
            style={{
              background: BG_CARD,
              border: `1px solid ${BORDER}`,
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
            }}
          >
            {/* 標題列 */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4" style={{ color: TEXT_SEC }} />
                <span className="text-sm font-semibold" style={{ color: TEXT_PRI }}>持倉升値走勢圖</span>
              </div>
              {gainPositive && stats && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#ECFDF5", color: SUCCESS }}
                >
                  +{gainPct.toFixed(1)}%
                </span>
              )}
            </div>

            {/* 圖表內容 */}
            <div className="px-5 py-5">
              {!trendData ? (
                <div className="h-52 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: TEXT_SEC }} />
                </div>
              ) : (trendData.points?.length ?? 0) < 2 ? (
                <div className="h-52 flex flex-col items-center justify-center gap-3">
                  <Package className="w-10 h-10 opacity-10" style={{ color: TEXT_PRI }} />
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: TEXT_PRI }}>尚無足夠數據</p>
                    <p className="text-xs mt-1" style={{ color: TEXT_SEC }}>新增至少 2 張不同日期購入的卡牌，即可查看走勢圖</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs" style={{ color: TEXT_SEC }}>按月份累計市値</p>
                    <p className="text-xs font-semibold" style={{ color: TEXT_PRI }}>{trendData.points.length} 個月</p>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData.points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="vaultTrendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FEDD00" stopOpacity={0.18} />
                          <stop offset="50%" stopColor="#06038d" stopOpacity={0.10} />
                          <stop offset="100%" stopColor="#06038d" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="vaultCostGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT_SEC }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: TEXT_SEC }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={42}
                      />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value ?? 0)),
                          name === "marketValue" ? "市値" : "成本"
                        ]}
                        contentStyle={{
                          borderRadius: 10, border: `1px solid ${BORDER}`,
                          fontSize: 12, background: BG_CARD, color: TEXT_PRI,
                        }}
                      />
                      <Area type="monotone" dataKey="cost" stroke="#94a3b8" strokeWidth={1.5}
                        fill="url(#vaultCostGrad)" dot={false} strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="marketValue" stroke={BRAND_BLUE} strokeWidth={2.5}
                        fill="url(#vaultTrendGrad)" dot={{ fill: BRAND_BLUE, r: 2.5 }} activeDot={{ r: 5, fill: BRAND_BLUE }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-5 mt-3 justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-0.5 rounded" style={{ background: TEXT_PRI }} />
                      <span className="text-[10px]" style={{ color: TEXT_SEC }}>市値</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 border-t-2 border-dashed" style={{ borderColor: "#94a3b8" }} />
                      <span className="text-[10px]" style={{ color: TEXT_SEC }}>成本</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right 1/3: Rankings — 橫向大卡片流 */}
          {stats && ((stats.top3Gainers?.length ?? 0) > 0 || (stats.top3ByValue?.length ?? 0) > 0) && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
              }}
            >
              {/* Segmented tab header */}
              <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div
                  className="flex rounded-lg p-0.5 gap-0.5"
                  style={{ background: "#F5F5F3" }}
                >
                  <button
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={rankTab === "gain"
                      ? { background: BG_CARD, color: TEXT_PRI, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                      : { background: "transparent", color: TEXT_SEC }
                    }
                    onClick={() => setRankTab("gain")}
                  >
                    <Star className="w-3 h-3 inline mr-1 mb-0.5" />
                    升値 TOP 3
                  </button>
                  <button
                    className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={rankTab === "value"
                      ? { background: BG_CARD, color: TEXT_PRI, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                      : { background: "transparent", color: TEXT_SEC }
                    }
                    onClick={() => setRankTab("value")}
                  >
                    <Wallet className="w-3 h-3 inline mr-1 mb-0.5" />
                    市値 TOP 3
                  </button>
                </div>
              </div>

              {/* Rankings — 橫向大卡片流 */}
              <div className="p-3 flex flex-col gap-2.5">
                {(() => {
                  const rankItems = rankTab === "gain"
                    ? (stats.top3Gainers ?? [])
                    : (stats.top3ByValue ?? []);
                  // 金銀銅配色
                  const medalColors = [
                    { bg: "rgba(253,224,71,0.12)", border: "rgba(253,224,71,0.40)", text: "#92400e", dot: "#d97706" },  // 金
                    { bg: "rgba(226,232,240,0.25)", border: "rgba(148,163,184,0.35)", text: "#475569", dot: "#94a3b8" },  // 銀
                    { bg: "rgba(234,215,205,0.20)", border: "rgba(180,120,90,0.25)", text: "#78350f", dot: "#b45309" },  // 銅
                  ];
                  return rankItems.map((item: any, idx: number) => {
                    const medal = medalColors[idx] ?? medalColors[2];
                    const isGainTab = rankTab === "gain";
                    return (
                      <div
                        key={item.id}
                        className="flex gap-3 rounded-xl p-2.5"
                        style={{
                          background: medal.bg,
                          border: `1px solid ${medal.border}`,
                        }}
                      >
                        {/* 卡牌圖片 — 3:4 比例大圖 */}
                        <div
                          className="flex-shrink-0 rounded-lg overflow-hidden relative"
                          style={{
                            width: "72px",
                            aspectRatio: "3/4",
                            background: "#F0EEE9",
                          }}
                        >
                          {item.card?.imageUrl ? (
                            <>
                              <LazyImage
                                src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                                alt={item.card?.name ?? ""}
                                className="w-full h-full object-contain"
                              />
                              <div
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 60%)" }}
                              />
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 opacity-20" style={{ color: TEXT_PRI }} />
                            </div>
                          )}
                          {/* 排名徽章 */}
                          <span
                            className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                            style={{ background: medal.dot, color: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.20)" }}
                          >
                            {idx + 1}
                          </span>
                        </div>

                        {/* 文字資訊 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <p
                              className="text-xs font-semibold leading-snug line-clamp-2"
                              style={{ color: TEXT_PRI }}
                              title={item.card?.name}
                            >
                              {item.card?.name}
                            </p>
                            <div className="mt-1">
                              <GradeBadge grader={item.grader} grade={item.grade} />
                            </div>
                          </div>
                          <div className="mt-2">
                            {isGainTab ? (
                              <>
                                <p
                                  className="text-base font-black tabular-nums leading-tight"
                                  style={{ color: SUCCESS, letterSpacing: "-0.03em" }}
                                >
                                  +{(item.unrealizedGainPct ?? 0).toFixed(1)}%
                                </p>
                                <p className="text-[10px] tabular-nums mt-0.5" style={{ color: TEXT_SEC }}>
                                  {formatCurrency(item.unrealizedGain)}
                                </p>
                              </>
                            ) : (
                              <>
                                <p
                                  className="text-sm font-black tabular-nums leading-tight"
                                  style={{ color: TEXT_PRI, letterSpacing: "-0.02em", fontFamily: "'Courier New', monospace" }}
                                >
                                  {formatCurrency(item.marketPrice)}
                                </p>
                                {item.unrealizedGainPct != null && (
                                  <p
                                    className="text-[10px] font-semibold tabular-nums mt-0.5"
                                    style={{ color: (item.unrealizedGainPct ?? 0) >= 0 ? SUCCESS : DANGER }}
                                  >
                                    {(item.unrealizedGainPct ?? 0) >= 0 ? "+" : ""}{(item.unrealizedGainPct ?? 0).toFixed(1)}%
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ══ Collection List ═══════════════════════════════ */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: BG_CARD,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.04)",
          }}
        >
          {/* List header */}
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            {/* Top row: title + refresh (always visible) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: TEXT_SEC }} />
                <span className="text-sm font-semibold" style={{ color: TEXT_PRI }}>收藏列表</span>
                {totalItems > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: TEXT_PRI }}
                  >
                    {totalItems}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Desktop: filters inline with title */}
                <div className="hidden sm:flex items-center gap-2">
                  {/* Sort select */}
                  <div className="relative group">
                    <select
                      className="appearance-none text-xs font-semibold tracking-wider rounded-lg pl-4 pr-9 py-2.5 focus:outline-none cursor-pointer"
                      style={{
                        background: "#FFFFFF",
                        color: TEXT_PRI,
                        border: `1px solid ${BORDER}`,
                        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                      }}
                      value={sortBy}
                      onChange={e => { setSortBy(e.target.value as any); setPage(1); }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = "#C8C8C8";
                        e.currentTarget.style.boxShadow = "0 2px 12px -2px rgba(0,0,0,0.08)";
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = BORDER;
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="createdAt">最新加入</option>
                      <option value="marketValue">市値排序</option>
                      <option value="gain">盈號排序</option>
                      <option value="purchasedAt">購入日期</option>
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="#737373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </div>
                  {/* Grader select */}
                  <div className="relative group">
                    <select
                      className="appearance-none text-xs font-semibold tracking-wider rounded-lg pl-4 pr-9 py-2.5 focus:outline-none cursor-pointer"
                      style={{
                        background: "#FFFFFF",
                        color: TEXT_PRI,
                        border: `1px solid ${BORDER}`,
                        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                      }}
                      value={graderFilter ?? ""}
                      onChange={e => { setGraderFilter(e.target.value || undefined); setPage(1); }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = "#C8C8C8";
                        e.currentTarget.style.boxShadow = "0 2px 12px -2px rgba(0,0,0,0.08)";
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = BORDER;
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <option value="">全部</option>
                      <option value="PSA">PSA</option>
                      <option value="CGC">CGC</option>
                      <option value="BGS">BGS</option>
                      <option value="RAW">RAW</option>
                    </select>
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="#737373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </div>
                </div>
                {/* Refresh button */}
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                  onClick={() => { refetchItems(); refetchStats(); }}
                  title="重新整理"
                >
                  <RefreshCw className="w-3.5 h-3.5" style={{ color: TEXT_SEC }} />
                </button>
              </div>
            </div>

            {/* Mobile: filters as 2-col grid (below title row) */}
            <div className="sm:hidden mt-3 grid grid-cols-2 gap-2">
              {/* Sort select */}
              <div className="relative group">
                <select
                  className="appearance-none w-full text-xs font-semibold tracking-wider rounded-lg pl-3.5 pr-8 py-2.5 focus:outline-none cursor-pointer"
                  style={{
                    background: "#FFFFFF",
                    color: TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                  value={sortBy}
                  onChange={e => { setSortBy(e.target.value as any); setPage(1); }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "#C8C8C8";
                    e.currentTarget.style.boxShadow = "0 2px 12px -2px rgba(0,0,0,0.08)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = BORDER;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="createdAt">最新加入</option>
                  <option value="marketValue">市値排序</option>
                  <option value="gain">盈號排序</option>
                  <option value="purchasedAt">購入日期</option>
                </select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#737373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
              {/* Grader select */}
              <div className="relative group">
                <select
                  className="appearance-none w-full text-xs font-semibold tracking-wider rounded-lg pl-3.5 pr-8 py-2.5 focus:outline-none cursor-pointer"
                  style={{
                    background: "#FFFFFF",
                    color: TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                  value={graderFilter ?? ""}
                  onChange={e => { setGraderFilter(e.target.value || undefined); setPage(1); }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "#C8C8C8";
                    e.currentTarget.style.boxShadow = "0 2px 12px -2px rgba(0,0,0,0.08)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = BORDER;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <option value="">全部</option>
                  <option value="PSA">PSA</option>
                  <option value="CGC">CGC</option>
                  <option value="BGS">BGS</option>
                  <option value="RAW">RAW</option>
                </select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#737373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: TEXT_SEC }} />
              <input
                type="text"
                placeholder="搜尋卡牌名稱、編號..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300"
                style={{
                  background: "#F5F5F3",
                  color: TEXT_PRI,
                  border: `1px solid ${BORDER}`,
                }}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5" style={{ color: TEXT_SEC }} />
                </button>
              )}
            </div>
          </div>

          {/* Items — Responsive Grid Layout */}
          {itemsLoading ? (
            <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "3/4" }} />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4">
              <Package className="w-12 h-12 opacity-10" style={{ color: TEXT_PRI }} />
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: TEXT_PRI }}>
                  {searchQuery ? "找不到符合的卡牌" : "倉庫目前是空的"}
                </p>
                <p className="text-xs mt-1" style={{ color: TEXT_SEC }}>
                  {searchQuery ? "請嘗試其他關鍵字" : "點擊「新增卡牌」開始建立你的收藏"}
                </p>
              </div>
              {!searchQuery && (
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: TEXT_PRI, color: "#FFFFFF" }}
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="w-4 h-4" />
                  新增第一張卡牌
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredItems.map((item: any) => {
                const itemGainPct = item.unrealizedGainPct ?? 0;
                const isGain = itemGainPct >= 0;
                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col rounded-2xl overflow-hidden"
                    style={{
                      background: BG_CARD,
                      border: `1px solid ${BORDER}`,
                      boxShadow: "0 4px 16px -4px rgba(0,0,0,0.06)",
                      transition: "transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = "translateY(-4px)";
                      el.style.boxShadow = "0 15px 30px -5px rgba(234,179,8,0.08), 0 8px 20px -8px rgba(0,0,0,0.10)";
                      el.style.borderColor = "rgba(234,179,8,0.30)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = "";
                      el.style.boxShadow = "0 4px 16px -4px rgba(0,0,0,0.06)";
                      el.style.borderColor = BORDER;
                    }}
                  >
                    {/* ── Card image (3:4 ratio) ── */}
                    <div
                      className="relative w-full overflow-hidden"
                      style={{ aspectRatio: "3/4", background: "#F0EEE9" }}
                    >
                      {item.card?.imageUrl ? (
                        <>
                          <LazyImage
                            src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                            alt={item.card?.name ?? ""}
                            className="w-full h-full object-contain"
                          />
                          {/* 閃卡折射光澤 — 對角線半透明漸層 */}
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 60%)" }}
                          />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 opacity-20" style={{ color: TEXT_PRI }} />
                        </div>
                      )}

                      {/* Delete button — top-right corner, appears on hover */}
                      <button
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(255,255,255,0.90)", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                        onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: "#DC2626" }} />
                      </button>

                      {/* Quantity badge — bottom-left corner */}
                      {item.quantity > 1 && (
                        <span
                          className="absolute bottom-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(26,26,26,0.75)", color: "#FFFFFF", backdropFilter: "blur(4px)" }}
                        >
                          ×{item.quantity}
                        </span>
                      )}
                    </div>

                    {/* ── Info below image ── */}
                    <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
                      {/* Row 1: Grade badge + gain% */}
                      <div className="flex items-center justify-between gap-1">
                        <GradeBadge grader={item.grader} grade={item.grade} />
                        {item.unrealizedGainPct != null ? (
                          <span
                            className="text-[10px] font-semibold tabular-nums"
                            style={{ color: isGain ? SUCCESS : DANGER }}
                          >
                            {isGain ? "+" : ""}{itemGainPct.toFixed(1)}%
                          </span>
                        ) : null}
                      </div>

                      {/* Row 2: Card name */}
                      <p
                        className="text-xs font-semibold leading-snug line-clamp-1"
                        style={{ color: TEXT_PRI }}
                        title={item.card?.name ?? ""}
                      >
                        {item.card?.name ?? "未知卡牌"}
                      </p>

                      {/* Row 3: Market value + cost */}
                      <div className="flex flex-col gap-0.5">
                        {item.marketPrice ? (
                          <p
                            className="text-sm font-bold tabular-nums leading-tight"
                            style={{ color: TEXT_PRI, fontFamily: "'Courier New', monospace", letterSpacing: "-0.02em" }}
                          >
                            {formatCurrency(item.marketPrice)}
                          </p>
                        ) : (
                          <p className="text-xs" style={{ color: TEXT_SEC }}>市值未知</p>
                        )}
                        {item.purchasePrice && (
                          <p className="text-[10px]" style={{ color: TEXT_SEC }}>
                            成本 {formatCurrency(item.purchasePrice)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: TEXT_SEC }}>第 {page} / {totalPages} 頁，共 {totalItems} 張</p>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: "#F5F5F3", color: TEXT_PRI, border: `1px solid ${BORDER}` }}
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  上一頁
                </button>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: "#F5F5F3", color: TEXT_PRI, border: `1px solid ${BORDER}` }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  下一頁
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Mobile FAB ─────────────────────────────────────── */}
      <div className="fixed bottom-20 right-4 sm:hidden z-40">
        <button
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: TEXT_PRI }}
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ══ Add Card Dialog ═══════════════════════════════════ */}
      <Dialog open={showAddDialog} onOpenChange={(o) => {
        setShowAddDialog(o);
        if (!o) { setSelectedCard(null); setAddForm({ grader: "PSA", grade: "10", quantity: 1, purchasePrice: "", notes: "" }); }
      }}>
        <DialogContent
          className="max-w-md"
          style={{
            background: "#FFFFFF",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 20px 50px rgba(0,0,0,0.10)",
          }}
        >
          {/* ── Modal Header ── */}
          <div className="px-6 pt-6 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <h2
              className="text-lg font-bold pr-8"
              style={{ color: TEXT_PRI, letterSpacing: "-0.02em" }}
            >
              新增卡牌到倉庫
            </h2>
            <p className="text-[11px] mt-1" style={{ color: TEXT_SEC }}>
              搜尋並選擇卡牌，系統將自動帶入當前市場參考價格
            </p>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* ── Card picker ── */}
            <div>
              <label
                className="block uppercase font-bold mb-2"
                style={{ color: TEXT_SEC, fontSize: "11px", letterSpacing: "0.15em" }}
              >
                選擇卡牌 <span style={{ color: DANGER }}>*</span>
              </label>
              {selectedCard ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ background: "#F5F5F3", border: `1px solid ${BORDER}` }}
                  onClick={() => setShowCardPicker(true)}
                >
                  {selectedCard.imageUrl && (
                    <LazyImage
                      src={getProxiedImageUrl(selectedCard.imageUrl) ?? ""}
                      alt={selectedCard.name}
                      className="w-10 h-14 object-contain rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: TEXT_PRI }}>{selectedCard.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: TEXT_SEC }}>
                      {selectedCard.series ?? selectedCard.cardNumber}
                    </p>
                    {currentMarketPrice != null && (
                      <p className="text-[11px] font-semibold mt-0.5" style={{ color: SUCCESS }}>
                        市場參考價：{formatCurrency(currentMarketPrice)}
                      </p>
                    )}
                  </div>
                  <Edit2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEXT_SEC }} />
                </div>
              ) : (
                <button
                  className="w-full py-3.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
                  style={{ borderColor: BORDER, color: TEXT_SEC, background: "#F5F5F3" }}
                  onClick={() => setShowCardPicker(true)}
                >
                  <Search className="w-4 h-4" />
                  搜尋並選擇卡牌
                </button>
              )}
            </div>

            {/* ── Grader & Grade ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block uppercase font-bold mb-2"
                  style={{ color: TEXT_SEC, fontSize: "11px", letterSpacing: "0.15em" }}
                >
                  評級機構
                </label>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>選擇卡牌的評級公司</p>
                <select
                  className="w-full text-sm rounded-xl px-3 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] focus:bg-white"
                  style={{
                    background: "#F5F5F3",
                    color: TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                  }}
                  value={addForm.grader}
                  onChange={e => {
                    const newGrader = e.target.value;
                    setAddForm(f => ({
                      ...f,
                      grader: newGrader,
                      // Clear grade when switching to RAW (ungraded)
                      grade: newGrader === "RAW" ? "" : f.grade,
                    }));
                  }}
                >
                  <option value="PSA">PSA</option>
                  <option value="CGC">CGC</option>
                  <option value="BGS">BGS</option>
                  <option value="RAW">RAW（未評級）</option>
                </select>
              </div>
              <div>
                <label
                  className="block uppercase font-bold mb-2"
                  style={{ color: TEXT_SEC, fontSize: "11px", letterSpacing: "0.15em" }}
                >
                  評級分數
                </label>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>
                  {addForm.grader === "RAW" ? "RAW 未評級，無評級分數" : "例：10、9、8"}
                </p>
                <input
                  type="text"
                  placeholder={addForm.grader === "RAW" ? "— 不適用 —" : "例：10"}
                  value={addForm.grader === "RAW" ? "" : addForm.grade}
                  onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))}
                  disabled={addForm.grader === "RAW"}
                  className="w-full text-sm rounded-xl px-3 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] focus:bg-white placeholder-[#9CA3AF]"
                  style={{
                    background: addForm.grader === "RAW" ? "#EBEBEB" : "#F5F5F3",
                    color: addForm.grader === "RAW" ? "#AAAAAA" : TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                    cursor: addForm.grader === "RAW" ? "not-allowed" : "text",
                    opacity: addForm.grader === "RAW" ? 0.6 : 1,
                  }}
                />
              </div>
            </div>

            {/* ── Quantity & Purchase price ── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="block uppercase font-bold mb-2"
                  style={{ color: TEXT_SEC, fontSize: "11px", letterSpacing: "0.15em" }}
                >
                  數量
                </label>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>持有張數</p>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={addForm.quantity}
                  onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full text-sm rounded-xl px-3 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] focus:bg-white"
                  style={{
                    background: "#F5F5F3",
                    color: TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                  }}
                />
              </div>
              <div>
                <label
                  className="block uppercase font-bold mb-2"
                  style={{ color: TEXT_SEC, fontSize: "11px", letterSpacing: "0.15em" }}
                >
                  購入成本 (HKD)
                </label>
                <p className="text-[11px] mb-2" style={{ color: "#9CA3AF" }}>你的買入總價（選填）</p>
                <input
                  type="number"
                  placeholder="例：3,000"
                  value={addForm.purchasePrice}
                  onChange={e => setAddForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  className="w-full text-sm rounded-xl px-3 py-2.5 transition-all focus:outline-none focus:ring-1 focus:ring-[#1A1A1A] focus:bg-white placeholder-[#9CA3AF]"
                  style={{
                    background: "#F5F5F3",
                    color: TEXT_PRI,
                    border: `1px solid ${BORDER}`,
                  }}
                />
              </div>
            </div>

            {/* ── Reactive ROI Calculator ── */}
            {roiCalc !== null && (
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: roiCalc.roi >= 0 ? "#F0FDF4" : "#FEF2F2",
                  border: `1px solid ${roiCalc.roi >= 0 ? "#BBF7D0" : "#FECACA"}`,
                }}
              >
                <p
                  className="uppercase font-bold"
                  style={{ color: roiCalc.roi >= 0 ? SUCCESS : DANGER, fontSize: "9px", letterSpacing: "0.2em" }}
                >
                  即時投資回報預估
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p
                      className="uppercase font-semibold mb-1"
                      style={{ color: TEXT_SEC, fontSize: "9px", letterSpacing: "0.15em" }}
                    >
                      未實現盈虧
                    </p>
                    <p
                      className="text-base font-bold tabular-nums"
                      style={{ color: roiCalc.unrealized >= 0 ? SUCCESS : DANGER, letterSpacing: "-0.02em" }}
                    >
                      {roiCalc.unrealized >= 0 ? "+" : ""}{formatCurrency(roiCalc.unrealized)}
                    </p>
                  </div>
                  <div>
                    <p
                      className="uppercase font-semibold mb-1"
                      style={{ color: TEXT_SEC, fontSize: "9px", letterSpacing: "0.15em" }}
                    >
                      投資回報率 (ROI)
                    </p>
                    <p
                      className="text-base font-bold tabular-nums"
                      style={{ color: roiCalc.roi >= 0 ? SUCCESS : DANGER, letterSpacing: "-0.02em" }}
                    >
                      {roiCalc.roi >= 0 ? "+" : ""}{roiCalc.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <p className="text-[10px]" style={{ color: TEXT_SEC }}>
                  基於市場參考價 {formatCurrency(currentMarketPrice!)} × {addForm.quantity} 張，成本 {formatCurrency(Number(addForm.purchasePrice))}
                </p>
              </div>
            )}

            {/* ── Submit ── */}
            <button
              className="w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all hover:bg-[#333333] active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: "#1A1A1A",
                color: "#FFFFFF",
                letterSpacing: "0.15em",
              }}
              onClick={handleAddSubmit}
              disabled={addMutation.isPending || !selectedCard}
            >
              {addMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />處理中...</>
                : <><Plus className="w-4 h-4" />加入倉庫</>
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Card Picker ─────────────────────────────────────── */}
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={(o) => setShowCardPicker(o)}
        onSelect={(card) => {
          setSelectedCard(card);
          setShowCardPicker(false);
        }}
      />

      {/* ── Delete confirm ──────────────────────────────────── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent
          className="rounded-2xl max-w-sm"
          style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: TEXT_PRI }}>確認移除</AlertDialogTitle>
            <AlertDialogDescription style={{ color: TEXT_SEC }}>
              這張卡牌將從你的倉庫中移除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              style={{ background: "#F5F5F3", color: TEXT_PRI, border: `1px solid ${BORDER}` }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl font-bold"
              style={{ background: DANGER, color: "white" }}
              onClick={() => deleteId && removeMutation.mutate({ itemId: deleteId })}
            >
              {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "移除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
