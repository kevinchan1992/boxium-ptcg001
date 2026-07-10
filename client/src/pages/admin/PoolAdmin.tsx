/**
 * PoolAdmin - 福袋卡池管理後台（重構版）
 * 現代 SaaS 管理後台風格：卡片式佈局、分頁標籤、財務看板網格、磨砂玻璃搜尋彈窗
 */
import { useState, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Search, X, ChevronDown, ChevronUp,
  Archive, Rocket, Edit3, Eye, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, BarChart3, Package,
  Layers, Sparkles
} from "lucide-react";

// ─── 類型定義 ────────────────────────────────────────────────────────────────
type RewardType = "rainbow" | "gold" | "blue" | "milestone";
interface RewardItem {
  id: string;
  rewardType: RewardType;
  name: string;
  imageUrl: string;
  cardId?: number;
  cost: number;
  quantity: number;
  triggerAt?: number;
}
interface PoolFormData {
  title: string;
  description: string;
  totalSlots: number;
  pricePoints: number;
  officialBuybackPoints: number;
  visibleCardCost: number;
  miscCost: number;
  rewards: RewardItem[];
}

// ─── 等級顏色設定 ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<RewardType, {
  label: string;
  shortLabel: string;
  badgeClass: string;
  borderClass: string;
  headerBg: string;
  accentColor: string;
  tabActiveClass: string;
}> = {
  rainbow: {
    label: "彩虹 Rainbow",
    shortLabel: "彩虹",
    badgeClass: "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white border-0",
    borderClass: "border-l-4 border-l-purple-500",
    headerBg: "bg-gradient-to-r from-purple-900/30 to-pink-900/20",
    accentColor: "text-purple-400",
    tabActiveClass: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40",
  },
  gold: {
    label: "黃金 Gold",
    shortLabel: "黃金",
    badgeClass: "bg-yellow-500 text-black border-0",
    borderClass: "border-l-4 border-l-yellow-500",
    headerBg: "bg-yellow-900/20",
    accentColor: "text-yellow-400",
    tabActiveClass: "bg-yellow-600 text-black shadow-lg shadow-yellow-900/40",
  },
  blue: {
    label: "藍色 Blue",
    shortLabel: "藍色",
    badgeClass: "bg-blue-500 text-white border-0",
    borderClass: "border-l-4 border-l-blue-500",
    headerBg: "bg-blue-900/20",
    accentColor: "text-blue-400",
    tabActiveClass: "bg-blue-600 text-white shadow-lg shadow-blue-900/40",
  },
  milestone: {
    label: "里程碑 Milestone",
    shortLabel: "里程碑",
    badgeClass: "bg-orange-500 text-white border-0",
    borderClass: "border-l-4 border-l-orange-500",
    headerBg: "bg-orange-900/20",
    accentColor: "text-orange-400",
    tabActiveClass: "bg-orange-600 text-white shadow-lg shadow-orange-900/40",
  },
};

// ─── 深色輸入框 ───────────────────────────────────────────────────────────────
const darkInput =
  "bg-zinc-800/60 border-zinc-700 text-white placeholder-zinc-500 " +
  "focus-visible:bg-zinc-800 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20";

// ─── 現代搜尋彈窗 ─────────────────────────────────────────────────────────────
function CardSearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (card: { id: number; name: string; imageUrl: string; cardId: string; setName?: string; rarity?: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 24, cardsOnly: true },
    { enabled: debouncedQuery.trim().length >= 1 }
  );

  const handleClose = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[82vh] flex flex-col rounded-3xl border border-zinc-800 shadow-2xl"
        style={{ background: "#0f0f0f", boxShadow: "0 25px 60px rgba(0,0,0,0.7)" }}
      >
        {/* 頂部標題列 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">搜尋卡片</h3>
              <p className="text-xs text-zinc-500">搜索並綁定對應卡牌</p>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 搜尋輸入框 */}
        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-zinc-800/80 border border-zinc-700 text-white placeholder-zinc-500 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
              placeholder="輸入卡片名稱或卡號..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-600 transition-colors"
                onClick={() => setQuery("")}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 結果區域 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* 載入中 */}
          {isFetching && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-sm text-zinc-400">搜尋中...</span>
            </div>
          )}

          {/* 初始提示 */}
          {!isFetching && !debouncedQuery && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 flex items-center justify-center">
                <Layers className="w-7 h-7 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">輸入關鍵字開始搜尋</p>
              <p className="text-xs text-zinc-600">支援卡片名稱、卡號搜尋</p>
            </div>
          )}

          {/* 無結果 */}
          {!isFetching && debouncedQuery && data?.cards?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 flex items-center justify-center">
                <Search className="w-7 h-7 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">找不到相關卡片</p>
              <p className="text-xs text-zinc-600">請嘗試輸入其他關鍵字或卡片編號</p>
            </div>
          )}

          {/* 結果網格 */}
          {!isFetching && data?.cards && data.cards.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {data.cards.map((card: any) => (
                <button
                  key={card.id}
                  className="group flex flex-col items-center gap-2 p-2.5 rounded-2xl border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-950/20 transition-all duration-200 text-left"
                  onClick={() =>
                    onSelect({
                      id: card.id,
                      name: card.name,
                      imageUrl: card.imageUrl ?? "",
                      cardId: card.cardId,
                      setName: card.setName,
                      rarity: card.rarity,
                    })
                  }
                >
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full aspect-[2/3] object-contain rounded-lg group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600 text-xs">
                      無圖
                    </div>
                  )}
                  <span className="text-xs text-zinc-300 text-center leading-tight line-clamp-2 w-full">{card.name}</span>
                  {card.rarity && (
                    <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">{card.rarity}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 獎品卡片組件 ─────────────────────────────────────────────────────────────
function RewardCard({
  reward,
  index,
  onChange,
  onRemove,
}: {
  reward: RewardItem;
  index: number;
  onChange: (updated: RewardItem) => void;
  onRemove: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const cfg = TIER_CONFIG[reward.rewardType];

  const handleCardSelect = (card: { id: number; name: string; imageUrl: string }) => {
    onChange({ ...reward, name: card.name, imageUrl: card.imageUrl, cardId: card.id });
    setSearchOpen(false);
  };

  return (
    <>
      <CardSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleCardSelect}
      />
      <div className={`rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden ${cfg.borderClass} transition-all`}>
        {/* 標頭 */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.headerBg}`}>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs px-2 py-0.5 ${cfg.badgeClass}`}>{cfg.label}</Badge>
            {reward.name && (
              <span className="text-sm text-zinc-300 truncate max-w-[180px]">{reward.name}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 內容 */}
        {!collapsed && (
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              {reward.imageUrl ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-16 h-24 object-contain rounded-lg border border-zinc-700"
                  />
                  <button
                    className="absolute -top-1 -right-1 bg-zinc-800 rounded-full p-1 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  className="w-16 h-24 flex-shrink-0 rounded-lg border-2 border-dashed border-zinc-700 hover:border-blue-500/50 hover:bg-blue-950/10 flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-blue-400 transition-all"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="w-4 h-4" />
                  <span className="text-[10px]">搜尋</span>
                </button>
              )}

              <div className="flex-1 space-y-2">
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">卡片名稱</Label>
                  <Input
                    className={`h-8 text-sm ${darkInput}`}
                    placeholder="手動輸入或搜尋綁定"
                    value={reward.name}
                    onChange={(e) => onChange({ ...reward, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">圖片 URL（可選）</Label>
                  <Input
                    className={`h-8 text-sm ${darkInput}`}
                    placeholder="https://..."
                    value={reward.imageUrl}
                    onChange={(e) => onChange({ ...reward, imageUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {reward.rewardType !== "milestone" && (
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">數量（張）</Label>
                  <Input
                    type="number"
                    min={1}
                    className={`h-8 text-sm ${darkInput}`}
                    value={reward.quantity}
                    onChange={(e) => onChange({ ...reward, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
              )}
              {reward.rewardType === "milestone" && (
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">觸發抽數</Label>
                  <Input
                    type="number"
                    min={1}
                    className={`h-8 text-sm ${darkInput}`}
                    placeholder="例：25"
                    value={reward.triggerAt ?? ""}
                    onChange={(e) => onChange({ ...reward, triggerAt: parseInt(e.target.value) || undefined })}
                  />
                </div>
              )}
              <div>
                <Label className="text-xs text-zinc-400 mb-1 block">成本（HKD）</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className={`h-8 text-sm ${darkInput}`}
                  value={reward.cost}
                  onChange={(e) => onChange({ ...reward, cost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              {reward.rewardType !== "milestone" && (
                <div className="flex flex-col justify-end">
                  <span className="text-xs text-zinc-500 mb-1">小計</span>
                  <span className="text-sm text-zinc-300 font-mono font-medium">
                    HK${(reward.cost * reward.quantity).toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── 財務看板（網格指標卡片版）────────────────────────────────────────────────
function FinancialDashboard({ form }: { form: PoolFormData }) {
  const namedQty = form.rewards
    .filter((r) => r.rewardType !== "milestone")
    .reduce((s, r) => s + r.quantity, 0);
  const hiddenCount = Math.max(0, form.totalSlots - namedQty);
  const overflowCount = Math.max(0, namedQty - form.totalSlots);

  const totalRevenue = form.totalSlots * form.pricePoints;
  const rewardCost = form.rewards
    .filter((r) => r.rewardType !== "milestone")
    .reduce((s, r) => s + r.cost * r.quantity, 0);
  const milestoneCost = form.rewards
    .filter((r) => r.rewardType === "milestone")
    .reduce((s, r) => s + r.cost, 0);
  const visibleCost = form.visibleCardCost * form.totalSlots;
  const totalCost = rewardCost + milestoneCost + visibleCost + form.miscCost;
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const buybackTotal = form.officialBuybackPoints * hiddenCount;

  const isProfit = profit >= 0;
  const isGoodMargin = margin >= 20;

  return (
    <div className="space-y-4">
      {/* 主要指標網格 */}
      <div className="grid grid-cols-1 gap-3">
        {/* 總收入 */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">總收入（滿池）</span>
          </div>
          <div className="text-2xl font-bold font-mono text-green-400">
            HK${totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-600 mt-1">{form.totalSlots} 格 × {form.pricePoints} 點</div>
        </div>

        {/* 總成本 */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-red-400" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">總成本</span>
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">
            HK${totalCost.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-600 mt-1 space-y-0.5">
            <div>獎品 HK${rewardCost.toLocaleString()} + 里程碑 HK${milestoneCost.toLocaleString()}</div>
            <div>可見卡 HK${visibleCost.toLocaleString()} + 雜項 HK${form.miscCost.toLocaleString()}</div>
          </div>
        </div>

        {/* 預期利潤 */}
        <div className={`border rounded-xl p-4 transition-colors ${
          isProfit
            ? "bg-green-950/20 border-green-800/40"
            : "bg-red-950/20 border-red-800/40"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {isProfit
                ? <TrendingUp className="w-4 h-4 text-green-400" />
                : <TrendingDown className="w-4 h-4 text-red-400" />
              }
              <span className="text-xs text-zinc-500 uppercase tracking-wider">預期利潤</span>
            </div>
            {!isProfit && (
              <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full font-medium">
                ⚠ 虧損
              </span>
            )}
            {isProfit && isGoodMargin && (
              <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full font-medium">
                ✓ 健康
              </span>
            )}
          </div>
          <div className={`text-2xl font-bold font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
            HK${profit.toLocaleString()}
          </div>
          <div className={`text-sm font-semibold mt-1 ${
            isGoodMargin ? "text-green-400" : margin >= 0 ? "text-yellow-400" : "text-red-400"
          }`}>
            利潤率 {margin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 卡池規模 */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-500 uppercase tracking-wider">卡池規模</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-bold text-white">{form.totalSlots}</div>
            <div className="text-xs text-zinc-500">總格數</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2">
            <div className="text-lg font-bold text-blue-400">{namedQty}</div>
            <div className="text-xs text-zinc-500">命名獎品</div>
          </div>
          <div className={`rounded-lg p-2 ${overflowCount > 0 ? "bg-red-900/30" : "bg-zinc-800/50"}`}>
            <div className={`text-lg font-bold ${overflowCount > 0 ? "text-red-400" : "text-zinc-300"}`}>
              {overflowCount > 0 ? `-${overflowCount}` : hiddenCount}
            </div>
            <div className="text-xs text-zinc-500">{overflowCount > 0 ? "超出" : "暗卡"}</div>
          </div>
        </div>
        {overflowCount > 0 && (
          <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            獎品數量超過總格數 {overflowCount} 格，請調整
          </div>
        )}
      </div>

      {/* 官方回購 */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-2">
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">官方回購估算</div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">每張回購</span>
          <span className="text-zinc-300 font-mono">{form.officialBuybackPoints} 點</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">暗卡總回購</span>
          <span className="text-zinc-300 font-mono">HK${buybackTotal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 獎品設定分頁 ─────────────────────────────────────────────────────────────
function RewardSection({
  rewards,
  totalSlots,
  onAdd,
  onUpdate,
  onRemove,
}: {
  rewards: RewardItem[];
  totalSlots: number;
  onAdd: (type: RewardType) => void;
  onUpdate: (id: string, updated: RewardItem) => void;
  onRemove: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<RewardType>("rainbow");
  const TABS: RewardType[] = ["rainbow", "gold", "blue", "milestone"];

  const namedQty = rewards
    .filter((r) => r.rewardType !== "milestone")
    .reduce((s, r) => s + r.quantity, 0);
  const hiddenCount = Math.max(0, totalSlots - namedQty);
  const overflowCount = Math.max(0, namedQty - totalSlots);

  const tabRewards = rewards.filter((r) => r.rewardType === activeTab);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
      {/* 分頁標籤列 */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/60">
        {TABS.map((type) => {
          const cfg = TIER_CONFIG[type];
          const count = rewards.filter((r) => r.rewardType === type).length;
          const isActive = activeTab === type;
          return (
            <button
              key={type}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 px-2 text-xs font-medium transition-all relative ${
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              onClick={() => setActiveTab(type)}
            >
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${
                isActive ? cfg.tabActiveClass : "bg-transparent"
              }`}>
                {cfg.shortLabel}
              </span>
              {count > 0 && (
                <span className={`text-[10px] ${isActive ? cfg.accentColor : "text-zinc-600"}`}>
                  {count} 項
                </span>
              )}
              {isActive && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
                  type === "rainbow" ? "bg-gradient-to-r from-purple-500 to-pink-500" :
                  type === "gold" ? "bg-yellow-500" :
                  type === "blue" ? "bg-blue-500" : "bg-orange-500"
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* 分頁內容 */}
      <div className="p-4 space-y-3">
        {/* 暗卡計算提示（僅在非 milestone 分頁顯示） */}
        {activeTab !== "milestone" && (
          <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${
            overflowCount > 0
              ? "bg-red-900/20 border border-red-800/40 text-red-400"
              : "bg-zinc-800/40 text-zinc-500"
          }`}>
            <span>命名獎品 {namedQty} 格 / 總格數 {totalSlots} 格</span>
            <span className={overflowCount > 0 ? "text-red-400 font-medium" : "text-zinc-400"}>
              {overflowCount > 0 ? `⚠ 超出 ${overflowCount} 格` : `暗卡 ${hiddenCount} 格`}
            </span>
          </div>
        )}

        {/* 新增按鈕 */}
        <button
          className={`w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            TIER_CONFIG[activeTab].borderClass.replace("border-l-4 border-l-", "border-")
          } hover:opacity-80 ${TIER_CONFIG[activeTab].accentColor}`}
          style={{ borderStyle: "dashed" }}
          onClick={() => onAdd(activeTab)}
        >
          <Plus className="w-4 h-4" />
          新增 {TIER_CONFIG[activeTab].label}
        </button>

        {/* 獎品列表 */}
        {tabRewards.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            尚未新增 {TIER_CONFIG[activeTab].label} 獎品
          </div>
        ) : (
          <div className="space-y-3">
            {tabRewards.map((reward, idx) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                index={idx}
                onChange={(updated) => onUpdate(reward.id, updated)}
                onRemove={() => onRemove(reward.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 建立/編輯卡池表單 ────────────────────────────────────────────────────────
function PoolForm({ onSuccess, editingPoolId, onCancelEdit }: { onSuccess: () => void; editingPoolId?: number; onCancelEdit?: () => void }) {
  const isEditing = !!editingPoolId;
  const [form, setForm] = useState<PoolFormData>({
    title: "",
    description: "",
    totalSlots: 100,
    pricePoints: 100,
    officialBuybackPoints: 30,
    visibleCardCost: 5,
    miscCost: 0,
    rewards: [],
  });
  const [loadedPoolId, setLoadedPoolId] = useState<number | null>(null);

  // 載入草稿資料
  const { data: existingData, isLoading: isLoadingExisting } = trpc.lootpool.adminPool.getWithRewards.useQuery(
    { poolId: editingPoolId! },
    { enabled: !!editingPoolId }
  );

  // 將現有資料填入表單
  useEffect(() => {
    if (existingData && editingPoolId && loadedPoolId !== editingPoolId) {
      const { pool, rewards } = existingData;
      setForm({
        title: pool.title ?? "",
        description: pool.description ?? "",
        totalSlots: pool.totalSlots,
        pricePoints: pool.pricePoints,
        officialBuybackPoints: pool.officialBuybackPoints ?? 30,
        visibleCardCost: pool.visibleCardCost ?? 5,
        miscCost: pool.miscCost ?? 0,
        rewards: rewards.map((r: any) => ({
          id: `existing-${r.id}`,
          rewardType: r.rewardType as RewardType,
          name: r.name,
          imageUrl: r.imageUrl ?? "",
          cardId: r.cardId ?? undefined,
          cost: r.cost,
          quantity: r.quantity,
          triggerAt: r.triggerAt ?? undefined,
        })),
      });
      setLoadedPoolId(editingPoolId);
    }
  }, [existingData, editingPoolId, loadedPoolId]);

  const createMutation = trpc.lootpool.adminPool.create.useMutation({
    onSuccess: () => {
      toast.success("卡池建立成功", { description: "已儲存為草稿，可在列表中發布" });
      onSuccess();
    },
    onError: (err) => toast.error("建立失敗", { description: err.message }),
  });

  const updateMutation = trpc.lootpool.adminPool.updateWithRewards.useMutation({
    onSuccess: () => {
      toast.success("草稿已更新");
      onSuccess();
    },
    onError: (err) => toast.error("更新失敗", { description: err.message }),
  });

  const updateField = <K extends keyof PoolFormData>(key: K, val: PoolFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const addReward = (type: RewardType) => {
    setForm((prev) => ({
      ...prev,
      rewards: [...prev.rewards, {
        id: `${Date.now()}-${Math.random()}`,
        rewardType: type,
        name: "",
        imageUrl: "",
        cost: 0,
        quantity: 1,
      }],
    }));
  };

  const updateReward = (id: string, updated: RewardItem) =>
    setForm((prev) => ({
      ...prev,
      rewards: prev.rewards.map((r) => (r.id === id ? updated : r)),
    }));

  const removeReward = (id: string) =>
    setForm((prev) => ({ ...prev, rewards: prev.rewards.filter((r) => r.id !== id) }));

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error("請填寫卡池標題");
      return;
    }
    const payload = {
      title: form.title,
      description: form.description || undefined,
      totalSlots: form.totalSlots,
      pricePoints: form.pricePoints,
      officialBuybackPoints: form.officialBuybackPoints,
      visibleCardCost: form.visibleCardCost,
      miscCost: form.miscCost,
      rewards: form.rewards.map((r) => ({
        name: r.name || "未命名",
        rewardType: r.rewardType,
        cost: r.cost,
        quantity: r.quantity,
        triggerAt: r.triggerAt,
        imageUrl: r.imageUrl || undefined,
        cardId: r.cardId,
      })),
    };
    if (isEditing && editingPoolId) {
      updateMutation.mutate({ poolId: editingPoolId, ...payload });
      return;
    }
    createMutation.mutate(payload);
  };

  if (isEditing && isLoadingExisting) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        載入草稿資料中...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      {/* 左欄 */}
      <div className="space-y-5">
        {/* 編輯模式標題 */}
        {isEditing && (
          <div className="flex items-center gap-3 bg-blue-950/30 border border-blue-800/40 rounded-xl px-4 py-3">
            <Edit3 className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-sm text-blue-300 font-medium">正在編輯草稿卡池</span>
            {onCancelEdit && (
              <button className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors" onClick={onCancelEdit}>
                取消編輯
              </button>
            )}
          </div>
        )}
        {/* 基本設定卡片 */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">基本設定</h3>
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">
              卡池標題 <span className="text-zinc-600 ml-1">（僅後台顯示，用戶看不到）</span>
            </Label>
            <Input
              className={darkInput}
              placeholder="例：2025年1月彩虹池 #001"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1.5 block">
              備注說明 <span className="text-zinc-600 ml-1">（選填）</span>
            </Label>
            <Textarea
              className={`${darkInput} resize-none`}
              rows={2}
              placeholder="內部備注..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">總格數</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                className={darkInput}
                value={form.totalSlots}
                onChange={(e) => updateField("totalSlots", parseInt(e.target.value) || 100)}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">每格售價（點數）</Label>
              <Input
                type="number"
                min={1}
                className={darkInput}
                value={form.pricePoints}
                onChange={(e) => updateField("pricePoints", parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">回購點數/張</Label>
              <Input
                type="number"
                min={0}
                className={darkInput}
                value={form.officialBuybackPoints}
                onChange={(e) => updateField("officialBuybackPoints", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">可見卡成本/格</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                className={darkInput}
                value={form.visibleCardCost}
                onChange={(e) => updateField("visibleCardCost", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1.5 block">雜項成本（HKD）</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                className={darkInput}
                value={form.miscCost}
                onChange={(e) => updateField("miscCost", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* 獎品設定卡片 */}
        <RewardSection
          rewards={form.rewards}
          totalSlots={form.totalSlots}
          onAdd={addReward}
          onUpdate={updateReward}
          onRemove={removeReward}
        />

        {/* 提交按鈕 */}
        <Button
          className={`w-full text-white hover:scale-[1.01] transition-all ${
            isEditing ? "bg-blue-700 hover:bg-blue-600" : "bg-zinc-700 hover:bg-zinc-600"
          }`}
          onClick={handleSubmit}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {(createMutation.isPending || updateMutation.isPending) ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{isEditing ? "更新中..." : "建立中..."}</>
          ) : (
            <>{isEditing ? <><Edit3 className="w-4 h-4 mr-2" />儲存修改</> : "儲存為草稿"}</>
          )}
        </Button>
      </div>

      {/* 右欄：財務看板（sticky） */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-300">即時財務看板</span>
        </div>
        <FinancialDashboard form={form} />
      </div>
    </div>
  );
}

// ─── 刪除確認 Dialog ──────────────────────────────────────────────────────────
function DeleteConfirmDialog({
  open,
  poolTitle,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  poolTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent className="!bg-zinc-900 border border-zinc-800 shadow-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-red-900/30">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <AlertDialogTitle className="text-white font-bold">刪除卡池</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-zinc-400 pl-13">
            確定要刪除此草稿卡池嗎？此操作無法復原。
            <span className="block mt-2 font-semibold text-zinc-200">
              「{poolTitle}」
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 bg-transparent"
            onClick={onCancel}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-700 hover:bg-red-600 text-white border-0 font-bold"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />刪除中...</> : "確認刪除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── 卡池列表 ─────────────────────────────────────────────────────────────────
function PoolList({ onEdit }: { onEdit: (poolId: number) => void }) {
  const utils = trpc.useUtils();
  const { data: pools, isLoading, refetch } = trpc.lootpool.adminPool.list.useQuery();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  const publishMutation = trpc.lootpool.adminPool.publish.useMutation({
    onSuccess: () => {
      toast.success("卡池已發布");
      utils.lootpool.adminPool.list.invalidate();
    },
    onError: (err) => toast.error("發布失敗", { description: err.message }),
  });

  const archiveMutation = trpc.lootpool.adminPool.archive.useMutation({
    onSuccess: () => {
      toast.success("卡池已封存");
      utils.lootpool.adminPool.list.invalidate();
    },
    onError: (err) => toast.error("封存失敗", { description: err.message }),
  });

  const deleteMutation = trpc.lootpool.adminPool.delete.useMutation({
    onSuccess: () => {
      toast.success("卡池已刪除");
      utils.lootpool.adminPool.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error("刪除失敗", { description: err.message });
      setDeleteTarget(null);
    },
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-zinc-700/60 text-zinc-300 border-zinc-600",
      active: "bg-green-900/40 text-green-300 border-green-700",
      archived: "bg-zinc-800/60 text-zinc-500 border-zinc-700",
    };
    const labels: Record<string, string> = {
      draft: "草稿",
      active: "進行中",
      archived: "已封存",
    };
    return (
      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${styles[status] ?? styles.draft}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  return (
    <>
      <DeleteConfirmDialog
        open={!!deleteTarget}
        poolTitle={deleteTarget?.title ?? ""}
        onConfirm={() => deleteTarget && deleteMutation.mutate({ poolId: deleteTarget.id })}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMutation.isPending}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 font-medium">{pools?.length ?? 0} 個卡池</span>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white h-8" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            重新整理
          </Button>
        </div>

        {pools?.length === 0 && (
          <div className="text-center py-16 text-zinc-600 border-2 border-dashed border-zinc-800 rounded-xl">
            尚無卡池，請在「建立新卡池」分頁建立
          </div>
        )}

        {pools?.map((pool: any) => (
          <div
            key={pool.id}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
          >
            {pool.coverImageUrl ? (
              <img
                src={pool.coverImageUrl}
                alt={pool.title}
                className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 bg-zinc-800 rounded-lg flex-shrink-0 flex items-center justify-center text-zinc-600 text-xs">
                無封面
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {statusBadge(pool.status)}
                <span className="text-sm font-semibold text-white truncate">{pool.title}</span>
              </div>
              <div className="text-xs text-zinc-500 flex gap-3">
                <span>{pool.totalSlots} 格</span>
                <span>{pool.pricePoints} 點/格</span>
                <span>{new Date(pool.createdAt).toLocaleDateString("zh-TW")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {pool.status === "draft" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 text-xs h-8 transition-all"
                    onClick={() => onEdit(pool.id)}
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    編輯
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-700 hover:bg-green-600 text-white text-xs h-8 hover:scale-[1.02] transition-all"
                    onClick={() => publishMutation.mutate({ poolId: pool.id })}
                    disabled={publishMutation.isPending}
                  >
                    <Rocket className="w-3 h-3 mr-1" />
                    發布
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-400 hover:bg-red-900/20 text-xs h-8 transition-all"
                    onClick={() => setDeleteTarget({ id: pool.id, title: pool.title })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
              {pool.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 bg-transparent text-zinc-400 hover:text-white text-xs h-8 hover:scale-[1.02] transition-all"
                  onClick={() => archiveMutation.mutate({ poolId: pool.id })}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="w-3 h-3 mr-1" />
                  封存
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────
export default function PoolAdmin() {
  const [tab, setTab] = useState<"list" | "create" | "edit">("list");
  const [editingPoolId, setEditingPoolId] = useState<number | undefined>(undefined);
  const utils = trpc.useUtils();

  const handleCreateSuccess = () => {
    utils.lootpool.adminPool.list.invalidate();
    setTab("list");
  };

  const handleEditSuccess = () => {
    utils.lootpool.adminPool.list.invalidate();
    setEditingPoolId(undefined);
    setTab("list");
  };

  const handleEdit = (poolId: number) => {
    setEditingPoolId(poolId);
    setTab("edit");
  };

  const handleCancelEdit = () => {
    setEditingPoolId(undefined);
    setTab("list");
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* 頁首 */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">福袋卡池管理</h1>
            <p className="text-xs text-zinc-500 mt-0.5">建立、設定並發布 BOXIUM 福袋卡池</p>
          </div>
          {/* 分頁切換 */}
          <div className="flex gap-1 bg-zinc-900/80 border border-zinc-800 rounded-xl p-1">
            <button
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all hover:scale-[1.01] ${
                tab === "list"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => { setTab("list"); setEditingPoolId(undefined); }}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1.5" />
              卡池列表
            </button>
            <button
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all hover:scale-[1.01] ${
                tab === "create"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => { setTab("create"); setEditingPoolId(undefined); }}
            >
              <Plus className="w-3.5 h-3.5 inline mr-1.5" />
              建立新卡池
            </button>
            {tab === "edit" && (
              <button className="px-4 py-1.5 text-sm rounded-lg font-medium bg-blue-700 text-white shadow-sm">
                <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />
                編輯草稿
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 內容 */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "list" && <PoolList onEdit={handleEdit} />}
        {tab === "create" && <PoolForm onSuccess={handleCreateSuccess} />}
        {tab === "edit" && editingPoolId && (
          <PoolForm
            onSuccess={handleEditSuccess}
            editingPoolId={editingPoolId}
            onCancelEdit={handleCancelEdit}
          />
        )}
      </div>
    </div>
  );
}
