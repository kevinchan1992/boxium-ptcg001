/**
 * PoolAdmin - 福袋卡池管理後台
 * 兩欄佈局：左側設定輸入 + 右側即時財務看板
 * 功能：建立/發布/封存卡池、卡片搜尋綁定、彩色等級識別、智慧隱藏卡計算
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, Search, X, ChevronDown, ChevronUp,
  Archive, Rocket, Edit3, Eye, RefreshCw
} from "lucide-react";

// ─── 類型定義 ────────────────────────────────────────────────────────────────
type RewardType = "rainbow" | "gold" | "blue" | "milestone";

interface RewardItem {
  id: string; // 前端臨時 ID
  rewardType: RewardType;
  name: string;
  imageUrl: string;
  cardId?: number;
  cost: number;
  quantity: number;
  triggerAt?: number; // milestone 專用：第幾抽觸發
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
const TIER_CONFIG: Record<RewardType, { label: string; badgeClass: string; borderClass: string; headerClass: string }> = {
  rainbow: {
    label: "彩虹 Rainbow",
    badgeClass: "bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-400 text-white border-0",
    borderClass: "border-purple-500/40",
    headerClass: "bg-gradient-to-r from-purple-900/40 to-pink-900/30",
  },
  gold: {
    label: "黃金 Gold",
    badgeClass: "bg-yellow-500 text-black border-0",
    borderClass: "border-yellow-500/40",
    headerClass: "bg-yellow-900/20",
  },
  blue: {
    label: "藍色 Blue",
    badgeClass: "bg-blue-500 text-white border-0",
    borderClass: "border-blue-500/40",
    headerClass: "bg-blue-900/20",
  },
  milestone: {
    label: "里程碑 Milestone",
    badgeClass: "bg-orange-500 text-white border-0",
    borderClass: "border-orange-500/40",
    headerClass: "bg-orange-900/20",
  },
};

// ─── 深色輸入框 className ─────────────────────────────────────────────────────
const darkInput =
  "bg-[#2a2a2a] border-zinc-700 text-white placeholder-zinc-500 " +
  "focus-visible:bg-[#2a2a2a] focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500";

// ─── 卡片搜尋 Modal ───────────────────────────────────────────────────────────
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

  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    const t = setTimeout(() => setDebouncedQuery(val), 400);
    return () => clearTimeout(t);
  }, []);

  const { data, isFetching } = trpc.cards.search.useQuery(
    { query: debouncedQuery, limit: 24, cardsOnly: true },
    { enabled: debouncedQuery.trim().length >= 1 }
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-zinc-800 text-white max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">搜尋卡片</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            className={`pl-9 ${darkInput}`}
            placeholder="輸入卡片名稱..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto mt-2">
          {isFetching && (
            <div className="flex items-center justify-center py-8 text-zinc-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              搜尋中...
            </div>
          )}
          {!isFetching && data?.cards && data.cards.length === 0 && debouncedQuery && (
            <div className="text-center py-8 text-zinc-500">找不到相關卡片</div>
          )}
          {!isFetching && !debouncedQuery && (
            <div className="text-center py-8 text-zinc-500">請輸入卡片名稱開始搜尋</div>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
            {data?.cards?.map((card: any) => (
              <button
                key={card.id}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border border-zinc-800 hover:border-zinc-500 hover:bg-zinc-800/50 transition-all text-left"
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
                    className="w-full aspect-[2/3] object-contain rounded"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-zinc-800 rounded flex items-center justify-center text-zinc-600 text-xs">
                    無圖
                  </div>
                )}
                <span className="text-xs text-zinc-300 text-center leading-tight line-clamp-2">{card.name}</span>
                {card.rarity && <span className="text-[10px] text-zinc-500">{card.rarity}</span>}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
      <div className={`rounded-xl border ${cfg.borderClass} bg-zinc-900/60 overflow-hidden`}>
        {/* 卡片標頭 */}
        <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.headerClass}`}>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs px-2 py-0.5 ${cfg.badgeClass}`}>{cfg.label}</Badge>
            {reward.name && (
              <span className="text-sm text-zinc-300 truncate max-w-[180px]">{reward.name}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="text-zinc-500 hover:text-zinc-300 p-1"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              className="text-zinc-500 hover:text-red-400 p-1"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 卡片內容 */}
        {!collapsed && (
          <div className="p-4 space-y-3">
            {/* 卡片綁定 */}
            <div className="flex gap-3">
              {reward.imageUrl ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={reward.imageUrl}
                    alt={reward.name}
                    className="w-16 h-24 object-contain rounded border border-zinc-700"
                  />
                  <button
                    className="absolute -top-1 -right-1 bg-zinc-800 rounded-full p-0.5 text-zinc-400 hover:text-white"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  className="w-16 h-24 flex-shrink-0 rounded border-2 border-dashed border-zinc-700 hover:border-zinc-500 flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="w-4 h-4" />
                  <span className="text-[10px]">搜尋卡片</span>
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

            {/* 數量 / 成本 / 觸發抽數 */}
            <div className="grid grid-cols-3 gap-2">
              {reward.rewardType !== "milestone" && (
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">
                    數量 <span className="text-zinc-600">（張）</span>
                  </Label>
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
                  <Label className="text-xs text-zinc-400 mb-1 block">
                    觸發抽數 <span className="text-zinc-600">（第幾抽）</span>
                  </Label>
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
                <Label className="text-xs text-zinc-400 mb-1 block">
                  成本 <span className="text-zinc-600">（HKD）</span>
                </Label>
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
                  <span className="text-xs text-zinc-500 mb-1">小計成本</span>
                  <span className="text-sm text-zinc-300 font-mono">
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

// ─── 財務看板 ─────────────────────────────────────────────────────────────────
function FinancialDashboard({ form }: { form: PoolFormData }) {
  const namedQty = form.rewards
    .filter((r) => r.rewardType !== "milestone")
    .reduce((s, r) => s + r.quantity, 0);
  const hiddenCount = Math.max(0, form.totalSlots - namedQty);

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

  const StatRow = ({
    label,
    value,
    sub,
    color,
  }: {
    label: string;
    value: string;
    sub?: string;
    color?: string;
  }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-mono font-medium ${color ?? "text-zinc-200"}`}>{value}</span>
        {sub && <div className="text-xs text-zinc-600">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-1">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        即時財務看板
      </h3>

      {/* 卡池規模 */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">卡池規模</div>
      <StatRow label="總格數" value={`${form.totalSlots} 格`} />
      <StatRow label="命名獎品格" value={`${namedQty} 格`} />
      <StatRow
        label="隱藏卡格（自動計算）"
        value={`${hiddenCount} 格`}
        color={hiddenCount < 0 ? "text-red-400" : "text-zinc-200"}
      />
      {hiddenCount < 0 && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
          ⚠ 獎品數量超過總格數 {Math.abs(hiddenCount)} 格
        </div>
      )}

      {/* 收入 */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mt-3 mb-1">收入</div>
      <StatRow
        label="每格售價"
        value={`${form.pricePoints} 點`}
        sub={`HK$${form.pricePoints}`}
      />
      <StatRow
        label="總收入（滿池）"
        value={`HK$${totalRevenue.toLocaleString()}`}
        color="text-green-400"
      />

      {/* 成本 */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mt-3 mb-1">成本</div>
      <StatRow label="命名獎品成本" value={`HK$${rewardCost.toLocaleString()}`} />
      <StatRow label="里程碑獎品成本" value={`HK$${milestoneCost.toLocaleString()}`} />
      <StatRow
        label="可見卡成本"
        value={`HK$${visibleCost.toLocaleString()}`}
        sub={`HK$${form.visibleCardCost}/格 × ${form.totalSlots}`}
      />
      <StatRow label="雜項成本" value={`HK$${form.miscCost.toLocaleString()}`} />
      <StatRow
        label="總成本"
        value={`HK$${totalCost.toLocaleString()}`}
        color="text-red-400"
      />

      {/* 利潤 */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mt-3 mb-1">利潤</div>
      <StatRow
        label="預期利潤（滿池）"
        value={`HK$${profit.toLocaleString()}`}
        color={profit >= 0 ? "text-green-400" : "text-red-400"}
      />
      <StatRow
        label="利潤率"
        value={`${margin.toFixed(1)}%`}
        color={margin >= 20 ? "text-green-400" : margin >= 0 ? "text-yellow-400" : "text-red-400"}
      />

      {/* 回購 */}
      <div className="text-xs text-zinc-500 uppercase tracking-wider mt-3 mb-1">官方回購</div>
      <StatRow
        label="隱藏卡回購點數"
        value={`${form.officialBuybackPoints} 點/張`}
      />
      <StatRow
        label="總回購成本"
        value={`HK$${buybackTotal.toLocaleString()}`}
        sub={`${hiddenCount} 張 × ${form.officialBuybackPoints}`}
      />
    </div>
  );
}

// ─── 建立/編輯卡池表單 ────────────────────────────────────────────────────────
function PoolForm({ onSuccess }: { onSuccess: () => void }) {
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

  const createMutation = trpc.lootpool.adminPool.create.useMutation({
    onSuccess: () => {
      toast.success("卡池建立成功", { description: "已儲存為草稿，可在列表中發布" });
      onSuccess();
    },
    onError: (err) => toast.error("建立失敗", { description: err.message }),
  });

  const updateField = <K extends keyof PoolFormData>(key: K, val: PoolFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const addReward = (type: RewardType) => {
    const newReward: RewardItem = {
      id: `${Date.now()}-${Math.random()}`,
      rewardType: type,
      name: "",
      imageUrl: "",
      cost: 0,
      quantity: 1,
    };
    setForm((prev) => ({ ...prev, rewards: [...prev.rewards, newReward] }));
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
    createMutation.mutate({
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
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* 左欄：設定輸入 */}
      <div className="space-y-6">
        {/* 基本設定 */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">基本設定</h3>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">
              卡池標題 <span className="text-zinc-600">（僅後台顯示，用戶看不到）</span>
            </Label>
            <Input
              className={darkInput}
              placeholder="例：2025年1月彩虹池 #001"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-400 mb-1 block">
              備注說明 <span className="text-zinc-600">（選填，後台備注用）</span>
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
              <Label className="text-xs text-zinc-400 mb-1 block">
                總格數 <span className="text-zinc-600">（1–1000）</span>
              </Label>
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
              <Label className="text-xs text-zinc-400 mb-1 block">
                每格售價 <span className="text-zinc-600">（點數，1點=HK$1）</span>
              </Label>
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
              <Label className="text-xs text-zinc-400 mb-1 block">
                官方回購點數 <span className="text-zinc-600">（隱藏卡每張）</span>
              </Label>
              <Input
                type="number"
                min={0}
                className={darkInput}
                value={form.officialBuybackPoints}
                onChange={(e) => updateField("officialBuybackPoints", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">
                可見卡成本 <span className="text-zinc-600">（HKD/格）</span>
              </Label>
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
              <Label className="text-xs text-zinc-400 mb-1 block">
                雜項成本 <span className="text-zinc-600">（HKD，一次性）</span>
              </Label>
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
        </section>

        {/* 獎品設定 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300">獎品設定</h3>
            <div className="flex gap-2 flex-wrap">
              {(["rainbow", "gold", "blue", "milestone"] as RewardType[]).map((type) => {
                const cfg = TIER_CONFIG[type];
                return (
                  <button
                    key={type}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all hover:opacity-80 ${cfg.badgeClass}`}
                    onClick={() => addReward(type)}
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    {cfg.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {form.rewards.length === 0 && (
            <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-600">
              點擊上方按鈕新增獎品等級
            </div>
          )}

          <div className="space-y-3">
            {form.rewards.map((reward, idx) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                index={idx}
                onChange={(updated) => updateReward(reward.id, updated)}
                onRemove={() => removeReward(reward.id)}
              />
            ))}
          </div>
        </section>

        {/* 提交按鈕 */}
        <Button
          className="w-full bg-zinc-700 hover:bg-zinc-600 text-white"
          onClick={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />建立中...</>
          ) : (
            <>儲存為草稿</>
          )}
        </Button>
      </div>

      {/* 右欄：財務看板（sticky） */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <FinancialDashboard form={form} />
      </div>
    </div>
  );
}

// ─── 卡池列表 ─────────────────────────────────────────────────────────────────
function PoolList() {
  const utils = trpc.useUtils();
  const { data: pools, isLoading, refetch } = trpc.lootpool.adminPool.list.useQuery();

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

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-zinc-700 text-zinc-300",
      active: "bg-green-700 text-green-200",
      archived: "bg-zinc-800 text-zinc-500",
    };
    const label: Record<string, string> = {
      draft: "草稿",
      active: "進行中",
      archived: "已封存",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? "bg-zinc-700 text-zinc-300"}`}>
        {label[status] ?? status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">{pools?.length ?? 0} 個卡池</span>
        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          重新整理
        </Button>
      </div>

      {pools?.length === 0 && (
        <div className="text-center py-12 text-zinc-600">尚無卡池，請在「建立新卡池」分頁建立</div>
      )}

      {pools?.map((pool: any) => (
        <div
          key={pool.id}
          className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-4"
        >
          {pool.coverImageUrl ? (
            <img
              src={pool.coverImageUrl}
              alt={pool.title}
              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 bg-zinc-800 rounded-lg flex-shrink-0 flex items-center justify-center text-zinc-600 text-xs">
              無封面
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {statusBadge(pool.status)}
              <span className="text-sm font-medium text-white truncate">{pool.title}</span>
            </div>
            <div className="text-xs text-zinc-500 space-x-3">
              <span>共 {pool.totalSlots} 格</span>
              <span>售價 {pool.pricePoints} 點/格</span>
              <span>建立於 {new Date(pool.createdAt).toLocaleDateString("zh-TW")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pool.status === "draft" && (
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-600 text-white text-xs"
                onClick={() => publishMutation.mutate({ poolId: pool.id })}
                disabled={publishMutation.isPending}
              >
                <Rocket className="w-3 h-3 mr-1" />
                發布
              </Button>
            )}
            {pool.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 text-zinc-400 hover:text-white text-xs"
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
  );
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────
export default function PoolAdmin() {
  const [tab, setTab] = useState<"list" | "create">("list");
  const utils = trpc.useUtils();

  const handleCreateSuccess = () => {
    utils.lootpool.adminPool.list.invalidate();
    setTab("list");
  };

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* 頁首 */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">福袋卡池管理</h1>
            <p className="text-sm text-zinc-500 mt-0.5">建立、設定並發布 BOXIUM 福袋卡池</p>
          </div>
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === "list" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => setTab("list")}
            >
              <Eye className="w-4 h-4 inline mr-1.5" />
              卡池列表
            </button>
            <button
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === "create" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => setTab("create")}
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              建立新卡池
            </button>
          </div>
        </div>
      </div>

      {/* 內容 */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "list" && <PoolList />}
        {tab === "create" && <PoolForm onSuccess={handleCreateSuccess} />}
      </div>
    </div>
  );
}
