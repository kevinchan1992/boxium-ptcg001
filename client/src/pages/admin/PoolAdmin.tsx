/**
 * PoolAdmin — 福袋卡池管理後台
 * 左側：卡池列表 + 建立表單
 * 右側：即時財務計算器（風控燈號）
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, RefreshCw, Zap, TrendingUp, AlertTriangle, CheckCircle,
  XCircle, Eye, Settings, Play, Pause
} from "lucide-react";

// ─── 型別 ────────────────────────────────────────────────────────────────────
type RewardInput = {
  name: string;
  rewardType: "rainbow" | "gold" | "blue" | "milestone";
  effectTier: number;
  cost: number;
  quantity: number;
  triggerAt?: number;
};

const TIER_COLORS: Record<string, string> = {
  rainbow: "from-purple-500 via-pink-500 to-yellow-400",
  gold: "from-yellow-400 to-amber-600",
  blue: "from-blue-400 to-cyan-600",
  milestone: "from-green-400 to-emerald-600",
};

const TIER_LABELS: Record<string, string> = {
  rainbow: "🌈 Rainbow（超級大賞）",
  gold: "🥇 Gold（二等賞）",
  blue: "💙 Blue（普通暗卡）",
  milestone: "🎯 Milestone（里程碑）",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  active: { label: "進行中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  cancelled: { label: "已取消", variant: "destructive" },
};

// ─── 財務計算器面板 ──────────────────────────────────────────────────────────
function FinancialCalculator({
  pricePoints, visibleCardCost, totalSlots, rewards, miscCost
}: {
  pricePoints: number; visibleCardCost: number; totalSlots: number;
  rewards: RewardInput[]; miscCost: number;
}) {
  const calcMutation = trpc.lootpool.adminPool.calcFinancials.useMutation();

  const handleCalc = useCallback(async () => {
    await calcMutation.mutateAsync({
      pricePoints, visibleCardCost, totalSlots, miscCost,
      rewards: rewards.map(r => ({ rewardType: r.rewardType, cost: r.cost, quantity: r.quantity })),
    });
  }, [pricePoints, visibleCardCost, totalSlots, miscCost, rewards]);

  const fin = calcMutation.data;

  const riskColor = fin?.riskLight === "green"
    ? "text-green-400 border-green-500/30 bg-green-500/10"
    : fin?.riskLight === "yellow"
    ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";

  const RiskIcon = fin?.riskLight === "green" ? CheckCircle
    : fin?.riskLight === "yellow" ? AlertTriangle : XCircle;

  return (
    <Card className="bg-zinc-900 border-zinc-700 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-yellow-400" />
          財務計算器
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleCalc}
          disabled={calcMutation.isPending || !pricePoints || !totalSlots}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
        >
          {calcMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          即時計算
        </Button>

        {fin && (
          <div className="space-y-3">
            {/* 風控燈號 */}
            <div className={`rounded-lg border p-3 flex items-center gap-3 ${riskColor}`}>
              <RiskIcon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">
                  {fin.riskLight === "green" ? "風控：綠燈 ✅" : fin.riskLight === "yellow" ? "風控：黃燈 ⚠️" : "風控：紅燈 ❌"}
                </div>
                <div className="text-xs opacity-80">
                  {fin.riskLight === "red" ? "毛利率過低，無法發布" : fin.riskLight === "yellow" ? "毛利率偏低，建議調整" : "財務健康，可以發布"}
                </div>
              </div>
            </div>

            {/* 財務數據 */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "GMV（總收入）", value: `${fin.gmv.toLocaleString()} 點` },
                { label: "總成本", value: `${fin.totalCost.toLocaleString()} 點` },
                { label: "毛利潤", value: `${fin.grossProfit.toLocaleString()} 點`, highlight: fin.grossProfit >= 0 },
                { label: "毛利率", value: `${fin.grossMargin.toFixed(1)}%`, highlight: fin.grossMargin >= 20 },
                { label: "可見卡成本", value: `${fin.visibleCardTotalCost.toLocaleString()} 點` },
                { label: "隱藏獎品成本", value: `${fin.hiddenRewardsCost.toLocaleString()} 點` },
                { label: "里程碑成本", value: `${fin.milestoneCost.toLocaleString()} 點` },
                { label: "回報率", value: `${fin.returnRate.toFixed(1)}%` },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="bg-zinc-800 rounded p-2">
                  <div className="text-zinc-400 text-xs">{label}</div>
                  <div className={`font-mono font-semibold ${highlight === false ? "text-red-400" : highlight ? "text-green-400" : "text-white"}`}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!fin && (
          <div className="text-center text-zinc-500 text-sm py-8">
            填寫左側參數後點擊「即時計算」
          </div>
        )}
      </CardContent>
    </Card>
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
    await createMutation.mutateAsync({
      title, description: description || undefined,
      pricePoints, visibleCardCost, buybackPoints,
      totalSlots, miscCost, rewards, generateCover,
    });
  };

  const poolList = Array.isArray(pools) ? pools : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* 標題 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🎴</span> 福袋卡池管理
          </h1>
          <p className="text-zinc-400 text-sm mt-1">建立、發布、管理所有福袋卡池</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 左側：建立表單 */}
          <div className="xl:col-span-2 space-y-4">
            {/* 卡池列表 */}
            <Card className="bg-zinc-900 border-zinc-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center justify-between">
                  <span>現有卡池 ({poolList.length})</span>
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {poolList.length === 0 ? (
                  <div className="text-center text-zinc-500 py-6 text-sm">尚無卡池</div>
                ) : (
                  <div className="space-y-2">
                    {poolList.map((pool: any) => (
                      <div key={pool.id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium text-sm text-white">{pool.title}</div>
                            <div className="text-xs text-zinc-400">
                              {pool.pricePoints} 點 · {pool.soldSlots ?? 0}/{pool.totalSlots} 格
                            </div>
                          </div>
                          <Badge variant={STATUS_BADGE[pool.status]?.variant ?? "secondary"}>
                            {STATUS_BADGE[pool.status]?.label ?? pool.status}
                          </Badge>
                          {pool.maintenanceMode ? (
                            <Badge variant="outline" className="text-orange-400 border-orange-400">維護中</Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {pool.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => publishMutation.mutate({ poolId: pool.id })}
                              disabled={publishMutation.isPending}
                              className="bg-green-600 hover:bg-green-500 text-white text-xs h-7"
                            >
                              <Play className="w-3 h-3 mr-1" /> 發布
                            </Button>
                          )}
                          {pool.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => maintenanceMutation.mutate({ poolId: pool.id, maintenance: !pool.maintenanceMode })}
                              className="text-xs h-7 border-zinc-600"
                            >
                              {pool.maintenanceMode ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                              {pool.maintenanceMode ? "恢復" : "維護"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 建立新卡池 */}
            <Card className="bg-zinc-900 border-zinc-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-yellow-400" /> 建立新卡池
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 基本資訊 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-zinc-300 text-xs">卡池名稱 *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="例：2025 皮卡丘限定福袋" className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-zinc-300 text-xs">描述（可選）</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="卡池說明..." className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">格子單價（點）</Label>
                    <Input type="number" value={pricePoints} onChange={e => setPricePoints(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">總格子數</Label>
                    <Input type="number" value={totalSlots} onChange={e => setTotalSlots(Number(e.target.value))}
                      min={10} max={100} className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">可見卡成本（點/張）</Label>
                    <Input type="number" value={visibleCardCost} onChange={e => setVisibleCardCost(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">官方回購（點/張）</Label>
                    <Input type="number" value={buybackPoints} onChange={e => setBuybackPoints(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-zinc-300 text-xs">雜費（點）</Label>
                    <Input type="number" value={miscCost} onChange={e => setMiscCost(Number(e.target.value))}
                      className="bg-zinc-800 border-zinc-600 text-white mt-1" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={generateCover} onCheckedChange={setGenerateCover} />
                    <Label className="text-zinc-300 text-xs">AI 生成封面圖</Label>
                  </div>
                </div>

                <Separator className="bg-zinc-700" />

                {/* 獎品設定 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-zinc-300 text-sm font-semibold">獎品設定</Label>
                    <Button size="sm" variant="outline" onClick={handleAddReward}
                      className="text-xs h-7 border-zinc-600 text-zinc-300">
                      <Plus className="w-3 h-3 mr-1" /> 新增
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {rewards.map((r, idx) => (
                      <div key={idx} className="bg-zinc-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className={`text-xs font-medium bg-gradient-to-r ${TIER_COLORS[r.rewardType]} bg-clip-text text-transparent`}>
                            {TIER_LABELS[r.rewardType]}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveReward(idx)}
                            className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-2">
                            <Input value={r.name} onChange={e => handleRewardChange(idx, "name", e.target.value)}
                              placeholder="獎品名稱" className="bg-zinc-700 border-zinc-600 text-white text-xs h-7" />
                          </div>
                          <div>
                            <select value={r.rewardType}
                              onChange={e => handleRewardChange(idx, "rewardType", e.target.value)}
                              className="w-full bg-zinc-700 border border-zinc-600 text-white text-xs h-7 rounded px-1">
                              <option value="rainbow">Rainbow</option>
                              <option value="gold">Gold</option>
                              <option value="blue">Blue</option>
                              <option value="milestone">Milestone</option>
                            </select>
                          </div>
                          <div>
                            <Input type="number" value={r.effectTier} min={1} max={3}
                              onChange={e => handleRewardChange(idx, "effectTier", Number(e.target.value))}
                              placeholder="Tier" className="bg-zinc-700 border-zinc-600 text-white text-xs h-7" />
                          </div>
                          <div>
                            <Input type="number" value={r.cost}
                              onChange={e => handleRewardChange(idx, "cost", Number(e.target.value))}
                              placeholder="成本(點)" className="bg-zinc-700 border-zinc-600 text-white text-xs h-7" />
                          </div>
                          <div>
                            <Input type="number" value={r.quantity} min={1}
                              onChange={e => handleRewardChange(idx, "quantity", Number(e.target.value))}
                              placeholder="數量" className="bg-zinc-700 border-zinc-600 text-white text-xs h-7" />
                          </div>
                          {r.rewardType === "milestone" && (
                            <div className="col-span-2">
                              <Input type="number" value={r.triggerAt ?? ""}
                                onChange={e => handleRewardChange(idx, "triggerAt", Number(e.target.value))}
                                placeholder="觸發格數(25/50/75/100)" className="bg-zinc-700 border-zinc-600 text-white text-xs h-7" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !title.trim()}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                >
                  {createMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  建立草稿卡池
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右側：財務計算器 */}
          <div className="xl:col-span-1">
            <FinancialCalculator
              pricePoints={pricePoints}
              visibleCardCost={visibleCardCost}
              totalSlots={totalSlots}
              rewards={rewards}
              miscCost={miscCost}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
