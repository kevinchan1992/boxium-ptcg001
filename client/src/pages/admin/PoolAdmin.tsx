/**
 * PoolAdmin — 福袋卡池管理後台（重構版）
 * 兩欄式佈局：左側輸入區 + 右側 Sticky 財務看板
 * 即時連動計算（無需按鈕）、帶標籤獎品卡片、彩色等級識別
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, RefreshCw, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, Play, Pause, Info
} from "lucide-react";

// ─── 型別 ────────────────────────────────────────────────────────────────────
type RewardType = "rainbow" | "gold" | "blue" | "milestone";

type RewardInput = {
  name: string;
  rewardType: RewardType;
  effectTier: number;
  cost: number;
  quantity: number;
  triggerAt?: number;
};

// ─── 等級樣式常數 ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<RewardType, {
  label: string;
  emoji: string;
  badge: string;
  border: string;
  headerBg: string;
  dot: string;
}> = {
  rainbow: {
    label: "Rainbow（超級大賞）",
    emoji: "🌈",
    badge: "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white",
    border: "border-purple-500/40",
    headerBg: "bg-gradient-to-r from-purple-900/40 to-pink-900/30",
    dot: "bg-purple-400",
  },
  gold: {
    label: "Gold（二等賞）",
    emoji: "🥇",
    badge: "bg-gradient-to-r from-yellow-500 to-amber-600 text-black",
    border: "border-yellow-500/40",
    headerBg: "bg-gradient-to-r from-yellow-900/30 to-amber-900/20",
    dot: "bg-yellow-400",
  },
  blue: {
    label: "Blue（普通暗卡）",
    emoji: "💙",
    badge: "bg-gradient-to-r from-blue-500 to-cyan-600 text-white",
    border: "border-blue-500/40",
    headerBg: "bg-gradient-to-r from-blue-900/30 to-cyan-900/20",
    dot: "bg-blue-400",
  },
  milestone: {
    label: "Milestone（里程碑）",
    emoji: "🎯",
    badge: "bg-gradient-to-r from-green-500 to-emerald-600 text-white",
    border: "border-green-500/40",
    headerBg: "bg-gradient-to-r from-green-900/30 to-emerald-900/20",
    dot: "bg-green-400",
  },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-zinc-700 text-zinc-300" },
  active: { label: "進行中", cls: "bg-green-500/20 text-green-400 border border-green-500/30" },
  sold_out: { label: "已售完", cls: "bg-blue-500/20 text-blue-400" },
  archived: { label: "已封存", cls: "bg-zinc-600 text-zinc-400" },
};

// ─── Tooltip 說明元件 ─────────────────────────────────────────────────────────
function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help">
      <Info className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
      <span className="absolute left-5 top-0 z-50 hidden group-hover:block w-52 bg-zinc-800 border border-zinc-600 text-zinc-300 text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed">
        {text}
      </span>
    </span>
  );
}

// ─── 即時財務計算（純前端，無需 API 呼叫）────────────────────────────────────
function calcFinancials(params: {
  pricePoints: number;
  visibleCardCost: number;
  totalSlots: number;
  miscCost: number;
  rewards: RewardInput[];
}) {
  const { pricePoints, visibleCardCost, totalSlots, miscCost, rewards } = params;
  const gmv = pricePoints * totalSlots;
  const visibleCardTotalCost = visibleCardCost * totalSlots;
  const hiddenRewardsCost = rewards
    .filter(r => r.rewardType !== "milestone")
    .reduce((sum, r) => sum + r.cost * r.quantity, 0);
  const milestoneCost = rewards
    .filter(r => r.rewardType === "milestone")
    .reduce((sum, r) => sum + r.cost * r.quantity, 0);
  const totalCost = visibleCardTotalCost + hiddenRewardsCost + milestoneCost + miscCost;
  const grossProfit = gmv - totalCost;
  const grossMargin = gmv > 0 ? (grossProfit / gmv) * 100 : 0;
  const returnRate = gmv > 0 ? (totalCost / gmv) * 100 : 0;
  const riskLight = grossMargin >= 25 ? "green" : grossMargin >= 10 ? "yellow" : "red";
  return { gmv, visibleCardTotalCost, hiddenRewardsCost, milestoneCost, totalCost, grossProfit, grossMargin, returnRate, riskLight };
}

// ─── 財務看板（右側 Sticky）──────────────────────────────────────────────────
function FinancialPanel({ fin }: { fin: ReturnType<typeof calcFinancials> }) {
  const riskCls = fin.riskLight === "green"
    ? "border-green-500/40 bg-green-500/10 text-green-400"
    : fin.riskLight === "yellow"
    ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
    : "border-red-500/40 bg-red-500/10 text-red-400";

  const RiskIcon = fin.riskLight === "green" ? CheckCircle
    : fin.riskLight === "yellow" ? AlertTriangle : XCircle;

  const riskMsg = fin.riskLight === "green" ? "財務健康，可以發布"
    : fin.riskLight === "yellow" ? "毛利率偏低，建議調整"
    : "毛利率過低，無法發布";

  return (
    <div className="bg-[#1a1a1a] border border-zinc-700/60 rounded-2xl overflow-hidden">
      {/* 看板標題 */}
      <div className="bg-zinc-900/80 px-5 py-4 border-b border-zinc-700/60 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-yellow-400" />
        <span className="text-white font-semibold text-sm">財務即時看板</span>
        <span className="ml-auto text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">自動更新</span>
      </div>

      <div className="p-5 space-y-4">
        {/* 風控燈號 */}
        <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${riskCls}`}>
          <RiskIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">
              風控：{fin.riskLight === "green" ? "綠燈 ✅" : fin.riskLight === "yellow" ? "黃燈 ⚠️" : "紅燈 ❌"}
            </div>
            <div className="text-xs opacity-80 mt-0.5">{riskMsg}</div>
          </div>
        </div>

        {/* 核心指標大字 */}
        <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-400 text-xs">總收入 (GMV)</span>
            <span className="text-white font-mono font-bold text-lg">{fin.gmv.toLocaleString()}<span className="text-zinc-400 text-xs ml-1">點</span></span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-400 text-xs">總成本</span>
            <span className="text-zinc-300 font-mono font-semibold">−{fin.totalCost.toLocaleString()}<span className="text-zinc-500 text-xs ml-1">點</span></span>
          </div>
          <div className="border-t border-zinc-700 pt-3 flex justify-between items-baseline">
            <span className="text-zinc-300 text-sm font-medium">預估淨利</span>
            <span className={`font-mono font-black text-xl ${fin.grossProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
              {fin.grossProfit >= 0 ? "+" : ""}{fin.grossProfit.toLocaleString()}
              <span className="text-xs font-normal ml-1">點</span>
            </span>
          </div>
        </div>

        {/* 毛利率 + 回報率 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 rounded-xl p-3 text-center">
            <div className="text-zinc-400 text-[10px] mb-1">毛利率</div>
            <div className={`font-mono font-bold text-xl ${fin.grossMargin >= 25 ? "text-green-400" : fin.grossMargin >= 10 ? "text-yellow-400" : "text-red-400"}`}>
              {fin.grossMargin.toFixed(1)}%
            </div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 text-center">
            <div className="text-zinc-400 text-[10px] mb-1">回報率</div>
            <div className="font-mono font-bold text-xl text-zinc-300">{fin.returnRate.toFixed(1)}%</div>
          </div>
        </div>

        {/* 成本明細 */}
        <div className="space-y-2">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">成本明細</div>
          {[
            { label: "可見卡成本", value: fin.visibleCardTotalCost, color: "text-blue-400" },
            { label: "隱藏獎品成本", value: fin.hiddenRewardsCost, color: "text-purple-400" },
            { label: "里程碑成本", value: fin.milestoneCost, color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center bg-zinc-900/60 rounded-lg px-3 py-2">
              <span className="text-zinc-400 text-xs">{label}</span>
              <span className={`font-mono text-sm font-semibold ${color}`}>{value.toLocaleString()}<span className="text-zinc-500 text-[10px] ml-1">點</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 獎品卡片 ─────────────────────────────────────────────────────────────────
function RewardCard({
  reward, idx, onChange, onRemove
}: {
  reward: RewardInput;
  idx: number;
  onChange: (idx: number, field: keyof RewardInput, value: any) => void;
  onRemove: (idx: number) => void;
}) {
  const cfg = TIER_CONFIG[reward.rewardType];

  return (
    <div className={`rounded-xl border ${cfg.border} overflow-hidden`}>
      {/* 卡片標題列 */}
      <div className={`${cfg.headerBg} px-4 py-2.5 flex items-center justify-between border-b ${cfg.border}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="text-sm font-semibold text-white">{cfg.emoji} {cfg.label}</span>
        </div>
        <button
          onClick={() => onRemove(idx)}
          className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 欄位區 */}
      <div className="bg-[#1e1e1e] p-4 space-y-3">
        {/* 第一行：等級選擇 */}
        <div>
          <Label className="text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5 block">獎品等級</Label>
          <select
            value={reward.rewardType}
            onChange={e => onChange(idx, "rewardType", e.target.value as RewardType)}
            className="w-full bg-[#2a2a2a] border border-zinc-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50 transition-colors"
          >
            <option value="rainbow">🌈 Rainbow（超級大賞）</option>
            <option value="gold">🥇 Gold（二等賞）</option>
            <option value="blue">💙 Blue（普通暗卡）</option>
            <option value="milestone">🎯 Milestone（里程碑）</option>
          </select>
        </div>

        {/* 第二行：獎品名稱 */}
        <div>
          <Label className="text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5 block">
            獎品名稱
            <Tip text="請輸入卡片名稱與品項，例如：Lillie PSA10、皮卡丘 AR PSA10" />
          </Label>
          <Input
            value={reward.name}
            onChange={e => onChange(idx, "name", e.target.value)}
            placeholder="例：Lillie PSA10"
            className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
          />
        </div>

        {/* 第三行：數量 + 單張成本 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5 block">
              配給數量（張）
              <Tip text="此等級獎品在整個卡池中的總張數" />
            </Label>
            <Input
              type="number"
              value={reward.quantity}
              min={1}
              onChange={e => onChange(idx, "quantity", Number(e.target.value))}
              className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
            />
          </div>
          <div>
            <Label className="text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5 block">
              單張成本（點）
              <Tip text="每張此獎品的採購成本，用於計算財務健康度" />
            </Label>
            <Input
              type="number"
              value={reward.cost}
              min={0}
              onChange={e => onChange(idx, "cost", Number(e.target.value))}
              className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
            />
          </div>
        </div>

        {/* 里程碑專屬：觸發抽數 */}
        {reward.rewardType === "milestone" && (
          <div>
            <Label className="text-zinc-400 text-[11px] uppercase tracking-wider mb-1.5 block">
              觸發抽數（每 N 抽觸發一次）
              <Tip text="例如填入 25，代表每抽第 25、50、75、100 格時觸發里程碑獎品" />
            </Label>
            <Input
              type="number"
              value={reward.triggerAt ?? ""}
              min={1}
              onChange={e => onChange(idx, "triggerAt", Number(e.target.value))}
              placeholder="例：25（每 25 抽觸發一次）"
              className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
            />
          </div>
        )}

        {/* 小計顯示 */}
        <div className="flex justify-between items-center bg-zinc-900/60 rounded-lg px-3 py-2 mt-1">
          <span className="text-zinc-500 text-xs">此獎品小計</span>
          <span className={`font-mono text-sm font-bold ${cfg.dot.replace("bg-", "text-")}`}>
            {(reward.cost * reward.quantity).toLocaleString()} 點
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 主頁面 ──────────────────────────────────────────────────────────────────
export default function PoolAdmin() {
  const utils = trpc.useUtils();

  // 表單狀態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pricePoints, setPricePoints] = useState(1550);
  const [visibleCardCost, setVisibleCardCost] = useState(300);
  const [buybackPoints, setBuybackPoints] = useState(300);
  const [totalSlots, setTotalSlots] = useState(100);
  const [miscCost, setMiscCost] = useState(0);
  const [generateCover, setGenerateCover] = useState(false);
  const [rewards, setRewards] = useState<RewardInput[]>([
    { name: "彩虹閃卡 PSA10", rewardType: "rainbow", effectTier: 1, cost: 8000, quantity: 1 },
    { name: "金卡 PSA10", rewardType: "gold", effectTier: 2, cost: 2000, quantity: 3 },
    { name: "藍卡 PSA10", rewardType: "blue", effectTier: 3, cost: 800, quantity: 8 },
    { name: "里程碑特典", rewardType: "milestone", effectTier: 2, cost: 1500, quantity: 4, triggerAt: 25 },
  ]);

  // 即時財務計算（useMemo 確保只在依賴變更時重算）
  const fin = useMemo(() => calcFinancials({
    pricePoints, visibleCardCost, totalSlots, miscCost, rewards
  }), [pricePoints, visibleCardCost, totalSlots, miscCost, rewards]);

  // 查詢所有卡池
  const { data: pools, isLoading } = trpc.lootpool.adminPool.listAll.useQuery();

  // Mutations
  const createMutation = trpc.lootpool.adminPool.create.useMutation({
    onSuccess: (data) => {
      toast.success(`卡池已建立 #${data.poolId}（風控：${data.financials.riskLight}）`);
      utils.lootpool.adminPool.listAll.invalidate();
    },
    onError: (e) => toast.error(`建立失敗：${e.message}`),
  });

  const publishMutation = trpc.lootpool.adminPool.publish.useMutation({
    onSuccess: () => {
      toast.success("卡池已發布！");
      utils.lootpool.adminPool.listAll.invalidate();
    },
    onError: (e) => toast.error(`發布失敗：${e.message}`),
  });

  const maintenanceMutation = trpc.lootpool.adminPool.setMaintenance.useMutation({
    onSuccess: () => utils.lootpool.adminPool.listAll.invalidate(),
  });

  const handleAddReward = () => {
    setRewards(prev => [...prev, { name: "", rewardType: "blue", effectTier: 3, cost: 500, quantity: 1 }]);
  };

  const handleRemoveReward = (idx: number) => {
    setRewards(prev => prev.filter((_, i) => i !== idx));
  };

  const handleRewardChange = (idx: number, field: keyof RewardInput, value: any) => {
    setRewards(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleCreate = async () => {
    if (!title.trim()) return toast.error("請填寫卡池名稱");
    if (fin.riskLight === "red") return toast.error("財務風控紅燈，請調整參數後再建立");
    await createMutation.mutateAsync({
      title, description: description || undefined,
      pricePoints, visibleCardCost, buybackPoints,
      totalSlots, miscCost, rewards, generateCover,
    });
  };

  const poolList = Array.isArray(pools) ? pools : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 頂部標題 */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              🎴 福袋卡池管理
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">建立、發布、管理所有福袋卡池</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              fin.riskLight === "green" ? "bg-green-500/20 text-green-400" :
              fin.riskLight === "yellow" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              {fin.riskLight === "green" ? "✅ 財務健康" : fin.riskLight === "yellow" ? "⚠️ 建議調整" : "❌ 風控紅燈"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">

          {/* ── 左欄：輸入區 ── */}
          <div className="space-y-5">

            {/* 現有卡池列表 */}
            <div className="bg-[#1a1a1a] border border-zinc-700/60 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900/80 px-5 py-3.5 border-b border-zinc-700/60 flex items-center justify-between">
                <span className="text-white font-semibold text-sm">現有卡池</span>
                <span className="text-zinc-500 text-xs">{poolList.length} 個</span>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-sm py-4 justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin" /> 載入中...
                  </div>
                ) : poolList.length === 0 ? (
                  <div className="text-center text-zinc-500 py-6 text-sm">尚無卡池，請在下方建立第一個</div>
                ) : (
                  <div className="space-y-2">
                    {poolList.map((pool: any) => {
                      const statusCfg = STATUS_BADGE[pool.status] ?? STATUS_BADGE.draft;
                      return (
                        <div key={pool.id} className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 rounded-xl p-3.5 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-white truncate">{pool.title}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">
                                {pool.pricePoints?.toLocaleString()} 點/格 · {pool.soldSlots ?? 0}/{pool.totalSlots} 格
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusCfg.cls}`}>
                              {statusCfg.label}
                            </span>
                            {pool.maintenanceMode && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 whitespace-nowrap">
                                維護中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                            {pool.status === "draft" && (
                              <Button
                                size="sm"
                                onClick={() => publishMutation.mutate({ poolId: pool.id })}
                                disabled={publishMutation.isPending}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs h-7 px-3"
                              >
                                <Play className="w-3 h-3 mr-1" /> 發布
                              </Button>
                            )}
                            {pool.status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => maintenanceMutation.mutate({ poolId: pool.id, maintenance: !pool.maintenanceMode })}
                                className="text-xs h-7 px-3 border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-700"
                              >
                                {pool.maintenanceMode ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                                {pool.maintenanceMode ? "恢復" : "維護"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 建立新卡池 */}
            <div className="bg-[#1a1a1a] border border-zinc-700/60 rounded-2xl overflow-hidden">
              <div className="bg-zinc-900/80 px-5 py-3.5 border-b border-zinc-700/60 flex items-center gap-2">
                <Plus className="w-4 h-4 text-yellow-400" />
                <span className="text-white font-semibold text-sm">建立新卡池</span>
              </div>

              <div className="p-5 space-y-5">
                {/* ── 基本資訊 ── */}
                <div>
                  <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-3 font-medium">基本資訊</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 block">卡池名稱 <span className="text-red-400">*</span></Label>
                      <Input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="例：2025 皮卡丘限定福袋"
                        className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 block">描述（可選）</Label>
                      <Input
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="卡池說明、特色介紹..."
                        className="bg-[#2a2a2a] border-zinc-600 text-white placeholder:text-zinc-600 focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* ── 格子參數 ── */}
                <div>
                  <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-3 font-medium">格子參數</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 flex items-center">
                        格子單價（點）
                        <Tip text="每個格子的售出價格，即玩家每次抽卡需花費的點數" />
                      </Label>
                      <Input
                        type="number"
                        value={pricePoints}
                        onChange={e => setPricePoints(Number(e.target.value))}
                        className="bg-[#2a2a2a] border-zinc-600 text-white focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 flex items-center">
                        總格子數
                        <Tip text="整個卡池的格子總數，即最多可以售出幾格" />
                      </Label>
                      <Input
                        type="number"
                        value={totalSlots}
                        onChange={e => setTotalSlots(Number(e.target.value))}
                        min={10}
                        max={200}
                        className="bg-[#2a2a2a] border-zinc-600 text-white focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* ── 成本參數 ── */}
                <div>
                  <div className="text-zinc-400 text-[10px] uppercase tracking-widest mb-3 font-medium">成本參數</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 flex items-center">
                        可見卡成本（點/格）
                        <Tip text="每格附帶的普通可見卡片採購成本" />
                      </Label>
                      <Input
                        type="number"
                        value={visibleCardCost}
                        onChange={e => setVisibleCardCost(Number(e.target.value))}
                        className="bg-[#2a2a2a] border-zinc-600 text-white focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 flex items-center">
                        官方回購（點/張）
                        <Tip text="當玩家抽中不想要時，系統以此價格向玩家回購卡片" />
                      </Label>
                      <Input
                        type="number"
                        value={buybackPoints}
                        onChange={e => setBuybackPoints(Number(e.target.value))}
                        className="bg-[#2a2a2a] border-zinc-600 text-white focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                    <div>
                      <Label className="text-zinc-300 text-xs mb-1.5 flex items-center">
                        雜費（點）
                        <Tip text="包裝、運費、平台費等其他固定成本" />
                      </Label>
                      <Input
                        type="number"
                        value={miscCost}
                        onChange={e => setMiscCost(Number(e.target.value))}
                        className="bg-[#2a2a2a] border-zinc-600 text-white focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* ── 獎品設定 ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-zinc-400 text-[10px] uppercase tracking-widest font-medium">獎品設定</div>
                    <button
                      onClick={handleAddReward}
                      className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <Plus className="w-3 h-3" /> 新增獎品
                    </button>
                  </div>
                  <div className="space-y-3">
                    {rewards.map((r, idx) => (
                      <RewardCard
                        key={idx}
                        reward={r}
                        idx={idx}
                        onChange={handleRewardChange}
                        onRemove={handleRemoveReward}
                      />
                    ))}
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* AI 封面 + 建立按鈕 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-zinc-900/60 rounded-xl px-4 py-3">
                    <Switch checked={generateCover} onCheckedChange={setGenerateCover} />
                    <div>
                      <Label className="text-zinc-300 text-sm cursor-pointer">AI 生成封面圖</Label>
                      <p className="text-zinc-500 text-xs mt-0.5">自動根據卡池名稱生成封面（需額外時間）</p>
                    </div>
                  </div>

                  {fin.riskLight === "red" && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      財務風控紅燈，請調整格子單價或降低成本後再建立
                    </div>
                  )}

                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !title.trim() || fin.riskLight === "red"}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-base py-5 rounded-xl disabled:opacity-50"
                  >
                    {createMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    建立草稿卡池
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 右欄：Sticky 財務看板 ── */}
          <div className="xl:sticky xl:top-6">
            <FinancialPanel fin={fin} />
          </div>
        </div>
      </div>
    </div>
  );
}

