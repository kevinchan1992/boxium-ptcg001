/**
 * PoolDetail — 福袋卡池詳細頁
 * DOPA/Clove 風格：10×10 格子網格、抽卡流程、WebGL 開箱動畫
 */
import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, Lock, CheckCircle, Trophy, ArrowLeft, Loader2 } from "lucide-react";
import UnboxingAnimation from "@/components/UnboxingAnimation";

// 格子狀態顏色
const SLOT_COLORS = {
  available: "bg-zinc-800 hover:bg-zinc-700 border-zinc-600 hover:border-yellow-500/50 cursor-pointer hover:shadow-[0_0_8px_rgba(250,204,21,0.2)]",
  mine: "bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-yellow-500/50 cursor-default",
  sold: "bg-zinc-900 border-zinc-700 cursor-default opacity-50",
  milestone: "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/50",
};

const TIER_GLOW = {
  1: "shadow-[0_0_30px_rgba(168,85,247,0.6)] border-purple-400",
  2: "shadow-[0_0_25px_rgba(234,179,8,0.5)] border-yellow-400",
  3: "shadow-[0_0_20px_rgba(59,130,246,0.4)] border-blue-400",
};

export default function PoolDetail() {
  const params = useParams<{ id: string }>();
  const poolId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [drawResult, setDrawResult] = useState<any>(null);
  const [showAnimation, setShowAnimation] = useState(false);

  const { data, isLoading } = trpc.lootpool.pool.getById.useQuery({ poolId }, { enabled: !!poolId });
  const { data: slotsData, refetch: refetchSlots } = trpc.lootpool.pool.getSlots.useQuery({ poolId }, { enabled: !!poolId });

  const drawMutation = trpc.lootpool.pool.draw.useMutation({
    onSuccess: (result) => {
      setDrawResult(result);
      setShowAnimation(true);
      refetchSlots();
    },
    onError: (e) => {
      toast.error(e.message);
      setSelectedSlot(null);
    },
  });

  const handleSlotClick = useCallback((slotNumber: number, slot: any) => {
    if (slot?.buyerUserId) return; // 已售出
    if (!user) {
      navigate("/login");
      return;
    }
    setSelectedSlot(slotNumber);
  }, [user, poolId]);

  const handleDraw = useCallback(async () => {
    if (!selectedSlot) return;
    await drawMutation.mutateAsync({ poolId, slotNumber: selectedSlot });
  }, [selectedSlot, poolId]);

  const handleAnimationComplete = () => {
    setShowAnimation(false);
    setDrawResult(null);
    setSelectedSlot(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (!data?.pool) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">😢</div>
          <h2 className="text-xl font-bold">卡池不存在</h2>
          <Button onClick={() => navigate("/pools")} className="mt-4" variant="outline">
            返回列表
          </Button>
        </div>
      </div>
    );
  }

  const { pool, rewards } = data;
  const slots = Array.isArray(slotsData) ? slotsData : [];
  const slotMap = new Map(slots.map((s: any) => [s.slotNumber, s]));

  const soldCount = slots.filter((s: any) => s.buyerUserId).length;
  const soldPct = pool.totalSlots > 0 ? Math.round((soldCount / pool.totalSlots) * 100) : 0;

  const isMaintenance = pool.maintenanceMode;
  const isCompleted = pool.status === "completed";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 開箱動畫 */}
      {showAnimation && drawResult && (
        <UnboxingAnimation
          result={drawResult}
          onComplete={handleAnimationComplete}
        />
      )}

      {/* 頂部資訊 */}
      <div className="relative overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(250,204,21,0.06),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/pools")}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回列表
          </button>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* 封面 */}
            <div className="w-full md:w-48 h-32 md:h-36 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
              {pool.coverImageUrl ? (
                <img src={pool.coverImageUrl} alt={pool.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🎴</div>
              )}
            </div>

            {/* 資訊 */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-black text-white">{pool.title}</h1>
                {isMaintenance && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">維護中</Badge>}
                {isCompleted && <Badge className="bg-zinc-600/50 text-zinc-300">已結束</Badge>}
              </div>
              {pool.description && <p className="text-zinc-400 text-sm mb-3">{pool.description}</p>}

              {/* 進度條 */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span>{soldCount}/{pool.totalSlots} 格已抽</span>
                  <span>{soldPct}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all"
                    style={{ width: `${soldPct}%` }} />
                </div>
              </div>

              {/* 獎品預覽 */}
              <div className="flex flex-wrap gap-2">
                {rewards.map((r: any) => (
                  <div key={r.id} className={`text-xs px-2 py-1 rounded-full border ${
                    r.rewardType === "rainbow" ? "bg-purple-500/10 border-purple-500/30 text-purple-300" :
                    r.rewardType === "gold" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" :
                    r.rewardType === "milestone" ? "bg-green-500/10 border-green-500/30 text-green-300" :
                    "bg-blue-500/10 border-blue-500/30 text-blue-300"
                  }`}>
                    {r.rewardType === "rainbow" ? "🌈" : r.rewardType === "gold" ? "🥇" : r.rewardType === "milestone" ? "🎯" : "💙"} {r.name} ×{r.quantity}
                  </div>
                ))}
              </div>
            </div>

            {/* 抽卡面板 */}
            <div className="w-full md:w-56 bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-bold text-xl">{pool.pricePoints.toLocaleString()}</span>
                <span className="text-zinc-400 text-sm">點/格</span>
              </div>

              {selectedSlot ? (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-300">
                    已選：<span className="text-yellow-400 font-bold">#{String(selectedSlot).padStart(2, "0")}</span>
                  </div>
                  <Button
                    onClick={handleDraw}
                    disabled={drawMutation.isPending || isMaintenance || isCompleted}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                  >
                    {drawMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 抽取中...</>
                    ) : (
                      <><Zap className="w-4 h-4 mr-2" /> 確認抽取</>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSlot(null)}
                    className="w-full text-zinc-400 text-xs">
                    取消
                  </Button>
                </div>
              ) : (
                <div className="text-center text-zinc-500 text-sm py-2">
                  {isMaintenance ? "🔧 維護中，暫停抽取" :
                   isCompleted ? "✅ 此卡池已結束" :
                   "點擊下方格子選擇"}
                </div>
              )}

              {!user && (
                <p className="text-zinc-500 text-xs mt-2 text-center">
                  <button onClick={() => navigate("/login")} className="text-yellow-400 hover:underline">登入</button> 後即可抽取
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 10×10 格子網格 */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-white mb-4">選擇格子</h2>
        <div className="grid grid-cols-10 gap-1.5 md:gap-2">
          {Array.from({ length: pool.totalSlots }, (_, i) => i + 1).map(slotNum => {
            const slot = slotMap.get(slotNum);
            const isSold = !!slot?.buyerUserId;
            const                     isMine = user && slot?.buyerUserId === user.id;
            const isMilestone = slot?.isMilestone;
            const isSelected = selectedSlot === slotNum;

            return (
              <button
                key={slotNum}
                onClick={() => !isSold && handleSlotClick(slotNum, slot)}
                disabled={isSold || isMaintenance || isCompleted}
                className={`
                  relative aspect-square rounded-lg border text-xs font-bold transition-all duration-150
                  flex items-center justify-center
                  ${isSelected ? "bg-yellow-500/30 border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)] scale-110 z-10" :
                    isMine ? SLOT_COLORS.mine :
                    isSold ? SLOT_COLORS.sold :
                    isMilestone ? SLOT_COLORS.milestone :
                    SLOT_COLORS.available}
                `}
              >
                {isMine ? (
                  <CheckCircle className="w-3 h-3 text-yellow-400" />
                ) : isSold ? (
                  <Lock className="w-3 h-3 text-zinc-600" />
                ) : isMilestone ? (
                  <Trophy className="w-2.5 h-2.5 text-green-400" />
                ) : (
                  <span className={`text-[10px] ${isSelected ? "text-yellow-300" : "text-zinc-400"}`}>
                    {String(slotNum).padStart(2, "0")}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 圖例 */}
        <div className="flex flex-wrap gap-4 mt-6 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-zinc-800 border border-zinc-600" />
            <span>可選</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50" />
            <span>我的</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-zinc-900 border border-zinc-700 opacity-50" />
            <span>已售</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50" />
            <span>里程碑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
