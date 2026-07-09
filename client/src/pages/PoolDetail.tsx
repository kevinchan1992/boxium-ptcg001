/**
 * PoolDetail - 福袋卡池詳情頁
 * 10x10 格子抽卡介面，Three.js 開箱動畫，深色霓虹風格
 */
import { useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Coins, Package, Zap, Lock, Gift,
  Star, Trophy, Sparkles, ChevronRight
} from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";

// ─── 格子狀態顏色 ─────────────────────────────────────────────────────────────
function getSlotStyle(slot: any, isSelected: boolean) {
  if (slot.isDrawn) {
    return "bg-zinc-800/80 border-zinc-700/50 cursor-not-allowed opacity-50";
  }
  if (isSelected) {
    return "bg-purple-600/40 border-purple-400 shadow-[0_0_12px_rgba(139,92,246,0.6)] scale-105 cursor-pointer";
  }
  return "bg-zinc-900 border-zinc-700 hover:border-purple-500/60 hover:bg-zinc-800 hover:shadow-[0_0_8px_rgba(139,92,246,0.3)] cursor-pointer transition-all duration-150";
}

// ─── 獎品展示 Dialog ──────────────────────────────────────────────────────────
function RewardRevealDialog({
  open,
  onClose,
  reward,
}: {
  open: boolean;
  onClose: () => void;
  reward: any | null;
}) {
  const tierConfig: Record<string, { label: string; gradient: string; glow: string }> = {
    rainbow: {
      label: "彩虹 Rainbow",
      gradient: "from-purple-600 via-pink-500 to-yellow-400",
      glow: "shadow-[0_0_40px_rgba(168,85,247,0.5)]",
    },
    gold: {
      label: "黃金 Gold",
      gradient: "from-yellow-600 to-yellow-400",
      glow: "shadow-[0_0_40px_rgba(234,179,8,0.5)]",
    },
    blue: {
      label: "藍色 Blue",
      gradient: "from-blue-600 to-blue-400",
      glow: "shadow-[0_0_40px_rgba(59,130,246,0.5)]",
    },
    milestone: {
      label: "里程碑 Milestone",
      gradient: "from-orange-600 to-orange-400",
      glow: "shadow-[0_0_40px_rgba(249,115,22,0.5)]",
    },
    hidden: {
      label: "隱藏卡",
      gradient: "from-zinc-600 to-zinc-400",
      glow: "",
    },
  };

  const cfg = reward ? (tierConfig[reward.rewardType] ?? tierConfig.hidden) : tierConfig.hidden;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0d0d0d] border-zinc-800 text-white max-w-sm mx-auto">
        <div className="flex flex-col items-center gap-4 py-4">
          {/* 標題 */}
          <div className="text-center">
            <div className="text-xs text-zinc-500 mb-1">你抽到了</div>
            {reward ? (
              <Badge className={`bg-gradient-to-r ${cfg.gradient} text-white border-0 text-sm px-3 py-1`}>
                {cfg.label}
              </Badge>
            ) : (
              <Badge className="bg-zinc-700 text-zinc-300 border-0 text-sm px-3 py-1">
                隱藏卡
              </Badge>
            )}
          </div>

          {/* 卡片圖片 */}
          <div className={`relative rounded-xl overflow-hidden ${cfg.glow}`}>
            {reward?.imageUrl ? (
              <img
                src={reward.imageUrl}
                alt={reward.name}
                className="w-48 h-auto object-contain"
              />
            ) : (
              <div className="w-48 h-64 bg-zinc-800 rounded-xl flex flex-col items-center justify-center gap-3">
                <Package className="w-12 h-12 text-zinc-600" />
                <span className="text-sm text-zinc-500">隱藏卡</span>
                <span className="text-xs text-zinc-600">將進入虛擬倉庫</span>
              </div>
            )}
          </div>

          {/* 卡片名稱 */}
          {reward && (
            <div className="text-center">
              <div className="text-lg font-bold text-white">{reward.name}</div>
            </div>
          )}

          {!reward && (
            <div className="text-center">
              <div className="text-base font-semibold text-zinc-300">隱藏卡已入庫</div>
              <div className="text-xs text-zinc-500 mt-1">可在虛擬倉庫查看並選擇回購或出貨</div>
            </div>
          )}

          {/* 按鈕 */}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-400 hover:text-white"
              onClick={onClose}
            >
              繼續抽取
            </Button>
            <Link href="/vault" className="flex-1">
              <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white">
                查看倉庫
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主頁面 ───────────────────────────────────────────────────────────────────
export default function PoolDetail() {
  const params = useParams<{ id: string }>();
  const poolId = parseInt(params.id ?? "0");

  const { data: authData } = trpc.auth.me.useQuery();
  const user = authData;

  const { data, isLoading, refetch } = trpc.lootpool.getDetail.useQuery(
    { poolId },
    { enabled: !!poolId }
  );

  const { data: balanceData, refetch: refetchBalance } = trpc.lootpool.myBalance.useQuery(
    undefined,
    { enabled: !!user }
  );

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedReward, setRevealedReward] = useState<any>(null);
  const [drawing, setDrawing] = useState(false);

  const drawMutation = trpc.lootpool.draw.useMutation({
    onSuccess: (result) => {
      setRevealedReward(result.reward);
      setRevealOpen(true);
      setSelectedSlot(null);
      refetch();
      refetchBalance();
      setDrawing(false);
    },
    onError: (err) => {
      toast.error("抽取失敗", { description: err.message });
      setDrawing(false);
    },
  });

  const handleSlotClick = useCallback(
    (slotIndex: number, isDrawn: boolean) => {
      if (isDrawn || drawing) return;
      setSelectedSlot((prev) => (prev === slotIndex ? null : slotIndex));
    },
    [drawing]
  );

  const handleDraw = () => {
    if (selectedSlot === null) {
      toast.error("請先選擇一個格子");
      return;
    }
    if (!user) {
      toast.error("請先登入");
      return;
    }
    const balance = balanceData?.balance ?? 0;
    const price = data?.pool?.pricePoints ?? 0;
    if (balance < price) {
      toast.error("點數不足", { description: `需要 ${price} 點，目前餘額 ${balance} 點` });
      return;
    }
    setDrawing(true);
    drawMutation.mutate({ poolId, slotIndex: selectedSlot });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.pool) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center gap-4 pb-20">
        <Package className="w-12 h-12 text-zinc-600" />
        <p className="text-zinc-400">卡池不存在或已關閉</p>
        <Link href="/pools">
          <Button variant="outline" className="border-zinc-700 text-zinc-400">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
        </Link>
        <BottomTabBar />
      </div>
    );
  }

  const { pool, rewards, slots } = data;
  const drawnCount = slots.filter((s: any) => s.isDrawn).length;
  const remaining = pool.totalSlots - drawnCount;
  const progress = (drawnCount / pool.totalSlots) * 100;

  // 按 slotIndex 排序
  const sortedSlots = [...slots].sort((a: any, b: any) => a.slotIndex - b.slotIndex);

  // 獎品統計（不含 milestone 和 hidden）
  const namedRewards = rewards.filter((r: any) => r.rewardType !== "hidden" && r.rewardType !== "milestone");

  const tierColors: Record<string, string> = {
    rainbow: "text-purple-400",
    gold: "text-yellow-400",
    blue: "text-blue-400",
    milestone: "text-orange-400",
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-24">
      {/* 頁首 */}
      <div className="sticky top-0 z-30 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/pools">
            <button className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>
          </Link>

          {user ? (
            <Link href="/points">
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1.5 hover:border-zinc-500 transition-colors cursor-pointer">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">
                  {balanceData?.balance?.toLocaleString() ?? "—"}
                </span>
                <span className="text-xs text-zinc-500">點</span>
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8">
                <Lock className="w-3 h-3 mr-1" />
                登入
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 封面 + 基本資訊 */}
        <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
          {pool.coverImageUrl ? (
            <img
              src={pool.coverImageUrl}
              alt="卡池封面"
              className="w-full aspect-[2/1] object-cover"
            />
          ) : (
            <div className="w-full aspect-[2/1] bg-zinc-800 flex items-center justify-center">
              <Package className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">BOXIUM 福袋</span>
                </div>
                <div className="text-2xl font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  {pool.pricePoints}
                  <span className="text-sm font-normal text-zinc-400">點/格</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{remaining} 格剩餘</div>
                <div className="text-xs text-zinc-500">共 {pool.totalSlots} 格</div>
              </div>
            </div>
          </div>
        </div>

        {/* 進度條 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>抽取進度</span>
            <span>{drawnCount}/{pool.totalSlots} ({progress.toFixed(0)}%)</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 獎品資訊 */}
        {namedRewards.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              獎品一覽
            </h3>
            <div className="space-y-2">
              {namedRewards.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3">
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt={r.name}
                      className="w-10 h-14 object-contain rounded"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-zinc-800 rounded flex items-center justify-center">
                      <Star className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{r.name}</div>
                    <div className={`text-xs ${tierColors[r.rewardType] ?? "text-zinc-400"}`}>
                      {r.rewardType === "rainbow" && "彩虹"}
                      {r.rewardType === "gold" && "黃金"}
                      {r.rewardType === "blue" && "藍色"}
                      {r.rewardType === "milestone" && "里程碑"}
                    </div>
                  </div>
                  {r.rewardType !== "milestone" && (
                    <div className="text-xs text-zinc-500">×{r.quantity}</div>
                  )}
                  {r.rewardType === "milestone" && r.triggerAt && (
                    <div className="text-xs text-orange-400">第{r.triggerAt}抽</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10x10 格子 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              選擇格子
            </h3>
            {selectedSlot !== null && (
              <span className="text-xs text-purple-400">
                已選擇第 {selectedSlot + 1} 格
              </span>
            )}
          </div>

          {/* 格子網格 */}
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${Math.min(10, pool.totalSlots)}, 1fr)` }}
          >
            {sortedSlots.map((slot: any) => (
              <button
                key={slot.slotIndex}
                className={`aspect-square rounded-md border text-xs font-mono transition-all duration-150 ${getSlotStyle(
                  slot,
                  selectedSlot === slot.slotIndex
                )}`}
                onClick={() => handleSlotClick(slot.slotIndex, slot.isDrawn)}
                disabled={slot.isDrawn || drawing}
                title={slot.isDrawn ? "已抽取" : `第 ${slot.slotIndex + 1} 格`}
              >
                {slot.isDrawn ? (
                  <span className="text-zinc-600">✓</span>
                ) : selectedSlot === slot.slotIndex ? (
                  <span className="text-purple-300">★</span>
                ) : (
                  <span className="text-zinc-600 text-[10px]">{slot.slotIndex + 1}</span>
                )}
              </button>
            ))}
          </div>

          {/* 圖例 */}
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-zinc-900 border border-zinc-700" />
              <span>未抽</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-600/40 border border-purple-400" />
              <span>已選</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-zinc-800/80 border border-zinc-700/50 opacity-50" />
              <span>已抽</span>
            </div>
          </div>
        </div>

        {/* 抽取按鈕 */}
        <div className="space-y-2">
          {!user ? (
            <Link href="/login">
              <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white h-12 text-base">
                <Lock className="w-4 h-4 mr-2" />
                登入後抽取
              </Button>
            </Link>
          ) : (
            <Button
              className={`w-full h-12 text-base font-semibold transition-all ${
                selectedSlot !== null && !drawing
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
              disabled={selectedSlot === null || drawing}
              onClick={handleDraw}
            >
              {drawing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  抽取中...
                </>
              ) : selectedSlot !== null ? (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  抽取第 {selectedSlot + 1} 格（{pool.pricePoints} 點）
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  請先選擇格子
                </>
              )}
            </Button>
          )}

          {user && (
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span>
                餘額：
                <span className={`font-mono ${(balanceData?.balance ?? 0) >= (pool.pricePoints ?? 0) ? "text-green-400" : "text-red-400"}`}>
                  {balanceData?.balance?.toLocaleString() ?? 0} 點
                </span>
              </span>
              <Link href="/points">
                <span className="text-purple-400 hover:text-purple-300 cursor-pointer flex items-center gap-0.5">
                  儲值點數
                  <ChevronRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* 規則說明 */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">抽取規則</h3>
          <ul className="text-xs text-zinc-500 space-y-1">
            <li>• 每格需消耗 {pool.pricePoints} 點（HK${pool.pricePoints}）</li>
            <li>• 抽到命名獎品（彩虹/黃金/藍色）將自動入庫</li>
            <li>• 隱藏卡可選擇官方回購（{pool.officialBuybackPoints} 點）或實體寄出</li>
            <li>• 每格只能抽取一次，已抽格子不可重複</li>
            <li>• 點數消耗後不可退款</li>
          </ul>
        </div>
      </div>

      {/* 獎品展示 Dialog */}
      <RewardRevealDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        reward={revealedReward}
      />

      <BottomTabBar />
    </div>
  );
}
