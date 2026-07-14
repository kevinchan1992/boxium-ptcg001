/**
 * Vault — TCG 倉庫獨立頁面 (/vault)
 * 專業的 TCG 卡牌投資組合儀表板
 * - 總市值 / 購入成本 / 未實現盈虧 / 持有數量
 * - 持倉升值走勢圖 (recharts AreaChart)
 * - 升值 TOP 3 / 最高市值 TOP 3
 * - 卡牌列表（分頁、篩選、搜尋）
 * - 新增 / 編輯 / 刪除卡牌
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Plus, Search, ChevronDown, ChevronUp, Loader2,
  Star, ArrowUpRight, BarChart3, Wallet, RefreshCw,
  Layers, Filter, X, Edit2, Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Brand tokens ─────────────────────────────────────────────
const BRAND_BLUE = "#06038d";
const BRAND_YELLOW = "#FEDD00";
const GAIN_GREEN = "#16a34a";
const LOSS_RED = "#dc2626";

// ─── Grade badge ──────────────────────────────────────────────
function GradeBadge({ grader, grade }: { grader: string; grade?: string | null }) {
  const graderColor: Record<string, string> = {
    PSA: "#e63946", CGC: "#2196f3", BGS: "#9c27b0", RAW: "#607d8b",
  };
  const bg = graderColor[grader?.toUpperCase()] ?? "#607d8b";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black text-white"
      style={{ background: bg }}
    >
      {grader?.toUpperCase()}{grade ? ` ${grade}` : ""}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent = false, positive,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent?: boolean; positive?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={accent
        ? { background: BRAND_BLUE, color: "white" }
        : { background: "white", border: "1px solid #e5e7eb" }}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${accent ? "text-blue-200" : "text-gray-400"}`}>
          {label}
        </span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={accent
            ? { background: `${BRAND_YELLOW}30` }
            : { background: `${BRAND_BLUE}10` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accent ? BRAND_YELLOW : BRAND_BLUE }} />
        </div>
      </div>
      <p className={`text-xl font-black tabular-nums leading-tight ${accent ? "text-white" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs font-semibold tabular-nums ${
          positive === undefined
            ? accent ? "text-blue-200" : "text-gray-400"
            : positive ? "text-green-500" : "text-red-500"
        }`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function Vault() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Auth
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Data
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } =
    trpc.profile.getCollectionStats.useQuery(undefined, { enabled: !!user, retry: 1 });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"marketValue" | "gain" | "purchasedAt" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [graderFilter, setGraderFilter] = useState<string | undefined>(undefined);
  const [showTrend, setShowTrend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: collectionData, isLoading: itemsLoading, refetch: refetchItems } =
    trpc.profile.getCollection.useQuery(
      { page, sortBy, sortOrder, grader: graderFilter, limit: 20 },
      { enabled: !!user, retry: 1 }
    );
  const { data: trendData } = trpc.profile.getPortfolioTrend.useQuery(
    undefined, { enabled: !!user && showTrend, retry: 1 }
  );

  const items = collectionData?.items ?? [];
  const totalItems = collectionData?.total ?? 0;
  const totalPages = collectionData?.totalPages ?? 1;

  // Filtered items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.card?.name?.toLowerCase().includes(q) ||
      item.card?.cardNumber?.toLowerCase().includes(q) ||
      item.card?.series?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Add card dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ grader: "PSA", grade: "10", quantity: 1, purchasePrice: "" as string | number, notes: "" });
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);

  // Delete
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

  // ── Loading ──────────────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#f8f9fb" }}>
        <div className="h-40" style={{ background: BRAND_BLUE }} />
        <div className="max-w-4xl mx-auto px-4 -mt-16 pb-12 space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f8f9fb" }}>
        <div className="max-w-sm w-full rounded-3xl overflow-hidden shadow-2xl" style={{ background: BRAND_BLUE }}>
          <div className="p-8 text-center">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: BRAND_YELLOW }}>
              <Package className="w-10 h-10" style={{ color: BRAND_BLUE }} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">TCG 倉庫</h2>
            <p className="text-blue-200 text-sm mb-6">登入後即可追蹤你的卡牌投資組合、分析升值走勢</p>
            <Button
              className="w-full font-black text-base py-3 rounded-xl"
              style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
              onClick={() => setLocation("/login")}
            >
              立即登入
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-24" style={{ background: "#f0f2f8" }}>
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${BRAND_BLUE} 0%, #1a17c4 60%, #2d2adb 100%)` }}>
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10" style={{ background: BRAND_YELLOW }} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-5" style={{ background: BRAND_YELLOW }} />

        <div className="relative max-w-4xl mx-auto px-4 pt-6 pb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND_YELLOW }}>
                  <Package className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                </div>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_YELLOW }}>TCG VAULT</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">我的卡牌投資組合</h1>
              <p className="text-blue-200 text-sm mt-1">追蹤持倉市值 · 分析升值走勢 · 管理收藏</p>
            </div>
            <Button
              className="flex-shrink-0 font-black rounded-xl px-4 py-2 text-sm shadow-lg"
              style={{ background: BRAND_YELLOW, color: BRAND_BLUE }}
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              新增卡牌
            </Button>
          </div>

          {/* ── Big total market value ── */}
          {statsLoading ? (
            <div className="mt-6">
              <Skeleton className="h-10 w-48 bg-white/20 rounded-xl" />
              <Skeleton className="h-4 w-32 bg-white/10 rounded mt-2" />
            </div>
          ) : stats && (stats.totalQuantity ?? 0) > 0 ? (
            <div className="mt-6">
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300">總市值</p>
              <p className="text-4xl sm:text-5xl font-black text-white tabular-nums mt-1">
                {formatCurrency(stats.totalMarketValue)}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-sm font-black tabular-nums px-2 py-0.5 rounded-lg ${gainPositive ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                  {gainPositive ? "+" : ""}{gainPct.toFixed(1)}%
                </span>
                <span className={`text-sm font-semibold tabular-nums ${gainPositive ? "text-green-300" : "text-red-300"}`}>
                  {gainPositive ? "+" : ""}{formatCurrency(stats.totalGain)}
                </span>
                <span className="text-blue-300 text-xs">未實現盈虧</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 -mt-4 space-y-4">

        {/* ── Stats Grid ── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="購入成本"
              value={formatCurrency(stats.totalCost)}
              icon={DollarSign}
              sub={`${stats.totalQuantity ?? 0} 張卡牌`}
            />
            <StatCard
              label="未實現盈虧"
              value={`${gainPositive ? "+" : ""}${formatCurrency(stats.totalGain)}`}
              sub={`${gainPositive ? "+" : ""}${gainPct.toFixed(1)}%`}
              icon={gainPositive ? TrendingUp : TrendingDown}
              positive={gainPositive}
            />
            <StatCard
              label="持有張數"
              value={`${stats.totalQuantity ?? 0} 張`}
              sub={`${stats.totalItems} 個品項`}
              icon={Layers}
            />
            <StatCard
              label="平均每張成本"
              value={stats.totalCost > 0 && (stats.totalQuantity ?? 0) > 0
                ? formatCurrency(stats.totalCost / (stats.totalQuantity ?? 1))
                : "—"}
              icon={BarChart3}
            />
          </div>
        ) : null}

        {/* ── Trend Chart ── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <button
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
            onClick={() => setShowTrend(v => !v)}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${BRAND_BLUE}10` }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: BRAND_BLUE }} />
              </div>
              <span className="text-sm font-black" style={{ color: BRAND_BLUE }}>持倉升值走勢圖</span>
            </div>
            <div className="flex items-center gap-2">
              {!showTrend && gainPositive && stats && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  +{gainPct.toFixed(1)}%
                </span>
              )}
              {showTrend ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {showTrend && (
            <div className="px-4 pb-4">
              {!trendData ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: BRAND_BLUE }} />
                </div>
              ) : (trendData.points?.length ?? 0) < 2 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Package className="w-10 h-10 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">尚無足夠數據</p>
                    <p className="text-xs mt-1">新增至少 2 張不同日期購入的卡牌，即可查看走勢圖</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">按月份累計市值</p>
                    <p className="text-xs font-bold" style={{ color: BRAND_BLUE }}>
                      {trendData.points.length} 個月
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData.points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="vaultTrendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="vaultCostGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BRAND_YELLOW} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={BRAND_YELLOW} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={42} />
                      <RechartsTooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value ?? 0)),
                          name === "marketValue" ? "市值" : "成本"
                        ]}
                        contentStyle={{ borderRadius: 12, border: `1px solid ${BRAND_BLUE}20`, fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="cost" stroke={BRAND_YELLOW} strokeWidth={1.5}
                        fill="url(#vaultCostGrad)" dot={false} strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="marketValue" stroke={BRAND_BLUE} strokeWidth={2.5}
                        fill="url(#vaultTrendGrad)" dot={{ fill: BRAND_BLUE, r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 justify-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-0.5 rounded" style={{ background: BRAND_BLUE }} />
                      <span className="text-[10px] text-gray-500">市值</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: BRAND_YELLOW }} />
                      <span className="text-[10px] text-gray-500">成本</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Top Gainers & Top Value ── */}
        {stats && (stats.top3Gainers?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Top 3 升值 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4" style={{ color: BRAND_YELLOW }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>升值 TOP 3</span>
              </div>
              <div className="space-y-3">
                {stats.top3Gainers.map((item: any, idx: number) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                      style={idx === 0 ? { background: BRAND_BLUE, color: "white" } : { background: "#f3f4f6", color: "#6b7280" }}
                    >
                      {idx + 1}
                    </div>
                    {item.card?.imageUrl && (
                      <div className="flex-shrink-0 w-10 h-14">
                        <LazyImage
                          src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                          alt={item.card?.name ?? ""}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate leading-tight">{item.card?.name}</p>
                      <GradeBadge grader={item.grader} grade={item.grade} />
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black tabular-nums" style={{ color: GAIN_GREEN }}>
                        +{(item.unrealizedGainPct ?? 0).toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-gray-400 tabular-nums">{formatCurrency(item.unrealizedGain)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 市值 */}
            {(stats.top3ByValue?.length ?? 0) > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4" style={{ color: BRAND_BLUE }} />
                  <span className="text-xs font-black uppercase tracking-widest" style={{ color: BRAND_BLUE }}>最高市值 TOP 3</span>
                </div>
                <div className="space-y-3">
                  {stats.top3ByValue.map((item: any, idx: number) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={idx === 0 ? { background: BRAND_YELLOW, color: BRAND_BLUE } : { background: "#f3f4f6", color: "#6b7280" }}
                      >
                        {idx + 1}
                      </div>
                      {item.card?.imageUrl && (
                        <div className="flex-shrink-0 w-10 h-14">
                          <LazyImage
                            src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                            alt={item.card?.name ?? ""}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate leading-tight">{item.card?.name}</p>
                        <GradeBadge grader={item.grader} grade={item.grade} />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black tabular-nums" style={{ color: BRAND_BLUE }}>
                          {formatCurrency(item.marketPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Collection List ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          {/* List header */}
          <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: BRAND_BLUE }} />
              <span className="text-sm font-black" style={{ color: BRAND_BLUE }}>收藏列表</span>
              {totalItems > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: BRAND_BLUE }}>
                  {totalItems}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                style={{ borderColor: "#e5e7eb", color: BRAND_BLUE }}
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as any); setPage(1); }}
              >
                <option value="createdAt">最新加入</option>
                <option value="marketValue">市值排序</option>
                <option value="gain">盈虧排序</option>
                <option value="purchasedAt">購入日期</option>
              </select>
              {/* Grader filter */}
              <select
                className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                style={{ borderColor: "#e5e7eb", color: BRAND_BLUE }}
                value={graderFilter ?? ""}
                onChange={e => { setGraderFilter(e.target.value || undefined); setPage(1); }}
              >
                <option value="">全部</option>
                <option value="PSA">PSA</option>
                <option value="CGC">CGC</option>
                <option value="BGS">BGS</option>
                <option value="RAW">RAW</option>
              </select>
              <button
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                onClick={() => { refetchItems(); refetchStats(); }}
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #f0f0f0" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜尋卡牌名稱、編號..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border bg-gray-50 focus:outline-none focus:ring-1"
                style={{ borderColor: "#e5e7eb" }}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Items */}
          {itemsLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-10 h-14 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 text-gray-400">
              <Package className="w-12 h-12 opacity-20" />
              <div className="text-center">
                <p className="font-semibold text-gray-500">
                  {searchQuery ? "找不到符合的卡牌" : "倉庫還是空的"}
                </p>
                <p className="text-xs mt-1">
                  {searchQuery ? "請嘗試其他關鍵字" : "點擊「新增卡牌」開始建立你的收藏"}
                </p>
              </div>
              {!searchQuery && (
                <Button
                  className="font-bold rounded-xl"
                  style={{ background: BRAND_BLUE, color: "white" }}
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  新增第一張卡牌
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredItems.map((item: any) => {
                const gainPct = item.unrealizedGainPct ?? 0;
                const isGain = gainPct >= 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                    {/* Card image */}
                    <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-gray-100">
                      {item.card?.imageUrl ? (
                        <LazyImage
                          src={getProxiedImageUrl(item.card.imageUrl) ?? ""}
                          alt={item.card?.name ?? ""}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate leading-tight">
                        {item.card?.name ?? "未知卡牌"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <GradeBadge grader={item.grader} grade={item.grade} />
                        {item.quantity > 1 && (
                          <span className="text-[10px] text-gray-400">×{item.quantity}</span>
                        )}
                        {item.purchasePrice && (
                          <span className="text-[10px] text-gray-400">成本 {formatCurrency(item.purchasePrice)}</span>
                        )}
                      </div>
                    </div>

                    {/* Market value & gain */}
                    <div className="text-right flex-shrink-0">
                      {item.marketPrice ? (
                        <>
                          <p className="text-sm font-black tabular-nums text-gray-900">
                            {formatCurrency(item.marketPrice)}
                          </p>
                          {item.unrealizedGainPct != null && (
                            <p className={`text-[10px] font-bold tabular-nums ${isGain ? "text-green-600" : "text-red-500"}`}>
                              {isGain ? "+" : ""}{gainPct.toFixed(1)}%
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">—</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #f0f0f0" }}>
              <p className="text-xs text-gray-400">第 {page} / {totalPages} 頁，共 {totalItems} 張</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-3"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  上一頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-3"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  下一頁
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick add FAB (mobile) ── */}
        <div className="fixed bottom-20 right-4 sm:hidden z-40">
          <button
            className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center"
            style={{ background: BRAND_YELLOW }}
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-6 h-6" style={{ color: BRAND_BLUE }} />
          </button>
        </div>
      </div>

      {/* ── Add Card Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black" style={{ color: BRAND_BLUE }}>新增卡牌到倉庫</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Card picker */}
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1.5 block">選擇卡牌 *</Label>
              {selectedCard ? (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: `${BRAND_BLUE}08`, border: `1px solid ${BRAND_BLUE}20` }}
                  onClick={() => setShowCardPicker(true)}
                >
                  {selectedCard.imageUrl && (
                    <LazyImage src={getProxiedImageUrl(selectedCard.imageUrl) ?? ""} alt={selectedCard.name}
                      className="w-10 h-14 object-contain rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{selectedCard.name}</p>
                    <p className="text-[10px] text-gray-500">{selectedCard.series ?? selectedCard.cardNumber}</p>
                  </div>
                  <Edit2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </div>
              ) : (
                <button
                  className="w-full py-3 rounded-xl border-2 border-dashed text-xs font-bold transition-colors hover:bg-gray-50"
                  style={{ borderColor: `${BRAND_BLUE}30`, color: BRAND_BLUE }}
                  onClick={() => setShowCardPicker(true)}
                >
                  <Search className="w-4 h-4 inline mr-1" />
                  搜尋並選擇卡牌
                </button>
              )}
            </div>

            {/* Grader & Grade */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-gray-600 mb-1.5 block">評級機構</Label>
                <select
                  className="w-full text-sm border rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1"
                  style={{ borderColor: "#e5e7eb" }}
                  value={addForm.grader}
                  onChange={e => setAddForm(f => ({ ...f, grader: e.target.value }))}
                >
                  <option value="PSA">PSA</option>
                  <option value="CGC">CGC</option>
                  <option value="BGS">BGS</option>
                  <option value="RAW">RAW（未評級）</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-600 mb-1.5 block">評級分數</Label>
                <Input
                  placeholder="例：10"
                  value={addForm.grade}
                  onChange={e => setAddForm(f => ({ ...f, grade: e.target.value }))}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Quantity & Purchase price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-gray-600 mb-1.5 block">數量</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={addForm.quantity}
                  onChange={e => setAddForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-600 mb-1.5 block">購入價格 (HKD)</Label>
                <Input
                  type="number"
                  placeholder="選填"
                  value={addForm.purchasePrice}
                  onChange={e => setAddForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  className="rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Submit */}
            <Button
              className="w-full font-black rounded-xl py-2.5"
              style={{ background: BRAND_BLUE, color: "white" }}
              onClick={handleAddSubmit}
              disabled={addMutation.isPending || !selectedCard}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              加入倉庫
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Card Picker ── */}
      <CardPickerDialog
        open={showCardPicker}
        onOpenChange={(o) => setShowCardPicker(o)}
        onSelect={(card) => {
          setSelectedCard(card);
          setShowCardPicker(false);
        }}
      />

      {/* ── Delete confirm ── */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>確認移除</AlertDialogTitle>
            <AlertDialogDescription>這張卡牌將從你的倉庫中移除，此操作無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl font-bold"
              style={{ background: LOSS_RED, color: "white" }}
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
