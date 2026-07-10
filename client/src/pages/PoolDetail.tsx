/**
 * PoolDetail — 純白玩味潮流風格 (Playful Premium)
 * 品牌藍高亮 · 高級雜誌感 · 日系 Gacha 機台
 */
import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Coins, Lock, Star, Trophy, Sparkles, Package, RotateCcw } from "lucide-react";
import { CardImage } from "@/components/CardImage";

const BRAND = "#06038D";
const BRAND_HOVER = "#0805b8";

// ─── Theme helper (reused from PoolCard) ─────────────────────────────────────
function getTheme(imgs: any[]) {
  const types = imgs.map((r: any) => r.rewardType);
  if (types.includes("rainbow")) return {
    bg: "linear-gradient(160deg,#0d0020 0%,#4c1d95 25%,#7c3aed 50%,#db2777 75%,#f59e0b 100%)",
    glow: "rgba(167,139,250,0.9)",
  };
  if (types.includes("milestone")) return {
    bg: "linear-gradient(160deg,#1c0700 0%,#9a3412 30%,#ea580c 60%,#fbbf24 100%)",
    glow: "rgba(251,146,60,0.9)",
  };
  if (types.includes("gold")) return {
    bg: "linear-gradient(160deg,#1c0e00 0%,#78350f 30%,#d97706 60%,#fde68a 100%)",
    glow: "rgba(252,211,77,0.9)",
  };
  return {
    bg: "linear-gradient(160deg,#020617 0%,#1e3a8a 25%,#1d4ed8 55%,#60a5fa 100%)",
    glow: "rgba(96,165,250,0.9)",
  };
}

// ─── 3D Hero Cover (enlarged 2.5× from PoolCard) ─────────────────────────────
function HeroCover({ imgs, theme }: { imgs: any[]; theme: ReturnType<typeof getTheme> }) {
  const [c1, c2, c3] = imgs;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: theme.bg }}>
      {/* Centre glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 70% at 50% 55%, ${theme.glow} 0%, transparent 65%)`,
      }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 130% 130% at 50% 50%, transparent 45%, rgba(0,0,0,0.45) 100%)",
      }} />
      {/* Sparkle particles */}
      {[...Array(14)].map((_, i) => (
        <div key={i} className="absolute rounded-full animate-pulse pointer-events-none" style={{
          width: `${2 + (i % 3) * 1.5}px`,
          height: `${2 + (i % 3) * 1.5}px`,
          background: "rgba(255,255,255,0.55)",
          top: `${8 + (i * 7) % 78}%`,
          left: `${4 + (i * 11) % 88}%`,
          animationDelay: `${i * 0.28}s`,
          animationDuration: `${1.6 + (i % 4) * 0.55}s`,
        }} />
      ))}

      {/* Stacked cards — 2.5× scale */}
      {imgs.length > 0 ? (
        <div className="absolute inset-0 overflow-hidden">
          {c3 && (
            <CardImage src={c3.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "130%", width: "auto",
                top: "-15%", left: "-14%",
                transform: "rotate(-22deg)",
                filter: "drop-shadow(0 28px 36px rgba(0,0,0,0.65))",
                opacity: 0.45, zIndex: 1,
              }} />
          )}
          {c2 && (
            <CardImage src={c2.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "130%", width: "auto",
                top: "-15%", right: "-14%",
                transform: "rotate(20deg)",
                filter: "drop-shadow(0 28px 36px rgba(0,0,0,0.65))",
                opacity: 0.55, zIndex: 2,
              }} />
          )}
          {c1 && (
            <CardImage src={c1.imageUrl} alt="" draggable={false}
              className="absolute object-contain rounded-sm pointer-events-none"
              style={{
                height: "145%", width: "auto",
                top: "-22%", left: "50%",
                transform: "translateX(-50%) rotate(-5deg)",
                filter: [
                  "drop-shadow(0 40px 28px rgba(0,0,0,0.7))",
                  `drop-shadow(0 0 40px ${theme.glow})`,
                  "drop-shadow(0 6px 10px rgba(0,0,0,0.85))",
                ].join(" "),
                zIndex: 3,
              }} />
          )}
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/40">
          <span className="text-7xl">🎴</span>
          <span className="text-xs font-semibold tracking-widest uppercase">Mystery Pool</span>
        </div>
      )}

      {/* Bottom fade to white */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
        height: "40%",
        background: "linear-gradient(to top, rgba(248,250,252,1) 0%, rgba(248,250,252,0.6) 50%, transparent 100%)",
      }} />
    </div>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────
function TierBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; style: React.CSSProperties }> = {
    rainbow: {
      label: "彩虹 RAINBOW",
      style: {
        background: "linear-gradient(90deg,#7c3aed,#ec4899,#f59e0b,#22c55e,#3b82f6,#7c3aed)",
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        border: "1px solid rgba(124,58,237,0.3)",
      },
    },
    gold: {
      label: "黃金 GOLD",
      style: {
        background: "linear-gradient(90deg,#92400e,#d97706,#fbbf24)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        border: "1px solid rgba(217,119,6,0.3)",
      },
    },
    blue: {
      label: "藍色 BLUE",
      style: { color: BRAND, border: `1px solid rgba(6,3,141,0.25)` },
    },
    milestone: {
      label: "里程碑",
      style: { color: "#ea580c", border: "1px solid rgba(234,88,12,0.25)" },
    },
  };
  const c = cfg[type] ?? { label: type.toUpperCase(), style: { color: "#64748b", border: "1px solid #e2e8f0" } };
  return (
    <span className="inline-block text-[10px] font-black tracking-[0.2em] uppercase px-2.5 py-1 rounded-full"
      style={c.style}>
      {c.label}
    </span>
  );
}

// ─── Slot grid style ──────────────────────────────────────────────────────────
function getSlotStyle(isDrawn: boolean, isSelected: boolean): React.CSSProperties {
  if (isDrawn) return {
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    cursor: "not-allowed",
    opacity: 0.5,
  };
  if (isSelected) return {
    backgroundColor: BRAND,
    border: `1px solid ${BRAND}`,
    boxShadow: `0 0 15px rgba(6,3,141,0.4)`,
    transform: "scale(1.08)",
    color: "#fff",
  };
  return {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    cursor: "pointer",
  };
}

// ─── Reward Reveal Dialog ─────────────────────────────────────────────────────
function RewardRevealDialog({ open, onClose, reward }: { open: boolean; onClose: () => void; reward: any | null }) {
  const tierGrad: Record<string, string> = {
    rainbow: "linear-gradient(135deg,#7c3aed,#ec4899,#f59e0b)",
    gold: "linear-gradient(135deg,#d97706,#fbbf24)",
    blue: `linear-gradient(135deg,${BRAND},#3b82f6)`,
    milestone: "linear-gradient(135deg,#ea580c,#fbbf24)",
  };
  const grad = reward ? (tierGrad[reward.rewardType] ?? `linear-gradient(135deg,${BRAND},#7c3aed)`) : `linear-gradient(135deg,${BRAND},#7c3aed)`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white border-0 shadow-2xl max-w-sm mx-auto rounded-none p-0 overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 w-full" style={{ background: grad }} />
        <div className="px-8 pt-8 pb-7 flex flex-col items-center gap-5 text-center">
          <div>
            <p className="text-xs tracking-[0.3em] text-slate-400 uppercase mb-2">YOU GOT</p>
            {reward ? (
              <TierBadge type={reward.rewardType} />
            ) : (
              <span className="text-xs tracking-widest uppercase text-slate-400 border border-slate-200 px-3 py-1 rounded-full">
                HIDDEN CARD
              </span>
            )}
          </div>

          <div className="relative">
            {reward?.imageUrl ? (
              <CardImage src={reward.imageUrl} alt={reward.name}
                className="w-44 h-auto object-contain"
                style={{ filter: `drop-shadow(0 20px 30px rgba(0,0,0,0.15))` }} />
            ) : (
              <div className="w-44 h-60 bg-slate-50 flex flex-col items-center justify-center gap-3 rounded-sm">
                <Package className="w-10 h-10 text-slate-300" />
                <span className="text-xs text-slate-400 tracking-wide">隱藏卡已入庫</span>
              </div>
            )}
          </div>

          {reward && (
            <p className="text-lg font-bold text-slate-900 tracking-tight">{reward.name}</p>
          )}
          {!reward && (
            <p className="text-sm text-slate-500">可在虛擬倉庫查看並選擇回購或出貨</p>
          )}

          <div className="flex gap-3 w-full pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 border border-slate-200 text-slate-600 text-xs tracking-widest uppercase hover:border-slate-400 transition-colors">
              繼續抽取
            </button>
            <Link href="/vault" className="flex-1">
              <button className="w-full py-3 text-white text-xs tracking-widest uppercase transition-colors"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}>
                查看倉庫
              </button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PoolDetail() {
  const params = useParams<{ id: string }>();
  const poolId = parseInt(params.id ?? "0");

  const { data: authData } = trpc.auth.me.useQuery();
  const user = authData;

  const { data, isLoading, refetch } = trpc.lootpool.getDetail.useQuery(
    { poolId }, { enabled: !!poolId }
  );
  const { data: balanceData, refetch: refetchBalance } = trpc.lootpool.myBalance.useQuery(
    undefined, { enabled: !!user }
  );

  // selectedSlots: Set of slotIndex for multi-select
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [multiMode, setMultiMode] = useState<10 | 100 | null>(null); // which multi-draw mode is active
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealedReward, setRevealedReward] = useState<any>(null);
  const [multiRevealOpen, setMultiRevealOpen] = useState(false);
  const [multiRevealResults, setMultiRevealResults] = useState<any[]>([]);
  const [drawing, setDrawing] = useState(false);

  const drawMutation = trpc.lootpool.draw.useMutation({
    onSuccess: (result) => {
      setRevealedReward(result.reward);
      setRevealOpen(true);
      setSelectedSlots(new Set());
      setMultiMode(null);
      refetch();
      refetchBalance();
      setDrawing(false);
    },
    onError: (err) => {
      toast.error("抽取失敗", { description: err.message });
      setDrawing(false);
    },
  });

  const multiDrawMutation = trpc.lootpool.multiDraw.useMutation({
    onSuccess: (result) => {
      setMultiRevealResults(result.results);
      setMultiRevealOpen(true);
      setSelectedSlots(new Set());
      setMultiMode(null);
      refetch();
      refetchBalance();
      setDrawing(false);
    },
    onError: (err) => {
      toast.error("連抽失敗", { description: err.message });
      setDrawing(false);
    },
  });

  const handleSlotClick = useCallback((slotIndex: number, isDrawn: boolean) => {
    if (isDrawn || drawing) return;
    if (multiMode === null) {
      // Single draw mode: toggle single selection
      setSelectedSlots(prev => {
        const next = new Set(prev);
        if (next.has(slotIndex)) { next.delete(slotIndex); } else { next.clear(); next.add(slotIndex); }
        return next;
      });
    } else {
      // Multi-draw mode: toggle up to multiMode slots
      setSelectedSlots(prev => {
        const next = new Set(prev);
        if (next.has(slotIndex)) {
          next.delete(slotIndex);
        } else if (next.size < multiMode) {
          next.add(slotIndex);
        } else {
          toast.error(`最多只能選 ${multiMode} 個格子`);
        }
        return next;
      });
    }
  }, [drawing, multiMode]);

  const handleDraw = (count: number = 1) => {
    if (!user) { toast.error("請先登入"); return; }
    const balance = balanceData?.balance ?? 0;
    const pricePerSlot = data?.pool?.pricePoints ?? 0;

    if (count === 1) {
      // Single draw
      const selectedArr = Array.from(selectedSlots);
      if (selectedArr.length === 0) { toast.error("請先選擇一個格子"); return; }
      const slotIndex = selectedArr[0];
      if (balance < pricePerSlot) {
        toast.error("點數不足", { description: `需要 ${pricePerSlot} 點，目前餘額 ${balance} 點` });
        return;
      }
      setDrawing(true);
      drawMutation.mutate({ poolId, slotIndex });
    } else {
      // Multi draw: need exactly count slots selected
      const selectedArr = Array.from(selectedSlots);
      if (selectedArr.length !== count) {
        toast.error(`請選擇 ${count} 個格子`, { description: `目前已選 ${selectedArr.length} 個` });
        return;
      }
      const totalCost = pricePerSlot * count;
      if (balance < totalCost) {
        toast.error("點數不足", { description: `需要 ${totalCost} 點，目前餘額 ${balance} 點` });
        return;
      }
      setDrawing(true);
      multiDrawMutation.mutate({ poolId, slotIndexes: selectedArr });
    }
  };

  const handleMultiModeToggle = (mode: 10 | 100) => {
    if (multiMode === mode) {
      setMultiMode(null);
      setSelectedSlots(new Set());
    } else {
      setMultiMode(mode);
      setSelectedSlots(new Set());
    }
  };

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!data?.pool) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 pb-20">
        <Package className="w-12 h-12 text-slate-300" />
        <p className="text-slate-400 text-sm tracking-wide">卡池不存在或已關閉</p>
        <Link href="/pools">
          <button className="flex items-center gap-2 text-xs tracking-widest uppercase border border-slate-200 px-5 py-2.5 text-slate-600 hover:border-slate-400 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            返回列表
          </button>
        </Link>
      </div>
    );
  }

  const { pool, rewards, slots } = data;
  const drawnCount = slots.filter((s: any) => s.isDrawn).length;
  const remaining = pool.totalSlots - drawnCount;
  const progress = (drawnCount / pool.totalSlots) * 100;
  const sortedSlots = [...slots].sort((a: any, b: any) => a.slotIndex - b.slotIndex);
  const namedRewards = rewards.filter((r: any) => r.rewardType !== "hidden" && r.rewardType !== "milestone");
  const milestoneRewards = rewards.filter((r: any) => r.rewardType === "milestone");
  const rewardImgs = namedRewards.filter((r: any) => r.imageUrl).slice(0, 3);
  const theme = getTheme(rewardImgs);
  const balance = balanceData?.balance ?? 0;
  const price = pool.pricePoints ?? 0;

  return (
    <>
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)' }}>

      {/* ─── Sticky Top Nav ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/pools">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs tracking-widest uppercase">Back</span>
            </button>
          </Link>
          <span className="text-xs tracking-[0.3em] uppercase font-light" style={{ color: BRAND }}>
            BOXIUM · BLIND BOX
          </span>
          {user ? (
            <Link href="/points">
              <div className="flex items-center gap-1.5 cursor-pointer group">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-mono font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                  {balance.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">pts</span>
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <button className="flex items-center gap-1.5 text-xs tracking-widest uppercase px-3 py-1.5 text-white transition-colors"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}>
                <Lock className="w-3 h-3" />
                登入
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ─── Hero Console (16:9) ─────────────────────────────────────────── */}
      <div className="relative w-full" style={{ aspectRatio: "16/9", maxHeight: "56vw" }}>
        {pool.coverImageUrl ? (
          <CardImage src={pool.coverImageUrl} alt="封面" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <HeroCover imgs={rewardImgs} theme={theme} />
        )}

        {/* Overlay info — bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-10"
          style={{ background: "linear-gradient(to top, rgba(248,250,252,0.98) 0%, rgba(248,250,252,0.7) 40%, transparent 100%)" }}>
          <div className="max-w-2xl mx-auto flex items-end justify-between">
            <div>
              <p className="text-xs tracking-[0.3em] text-slate-400 uppercase font-light mb-1">BLIND BOX</p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                {pool.name}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 leading-none">
                {price.toLocaleString()}
                <span className="text-sm font-normal text-slate-400 ml-1">pts</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{remaining} / {pool.totalSlots} 格剩餘</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2 tracking-wide">
            <span>DRAW PROGRESS</span>
            <span className="font-mono">{drawnCount}/{pool.totalSlots} ({progress.toFixed(0)}%)</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: BRAND }} />
          </div>
        </div>

        {/* Prize showcase */}
        {namedRewards.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <Trophy className="w-4 h-4" style={{ color: BRAND }} />
              <p className="text-xs tracking-[0.3em] text-slate-400 uppercase font-light">PRIZE SHOWCASE</p>
            </div>

            {/* Group by tier */}
            {(["rainbow", "gold", "blue"] as const).map((tier) => {
              const tierRewards = namedRewards.filter((r: any) => r.rewardType === tier);
              if (tierRewards.length === 0) return null;
              return (
                <div key={tier} className="mb-6">
                  <div className="mb-3">
                    <TierBadge type={tier} />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                    {tierRewards.map((r: any) => (
                      <div key={r.id} className="flex-shrink-0 rounded-sm overflow-hidden"
                        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)", width: "150px" }}>
                        {r.imageUrl ? (
                          <CardImage src={r.imageUrl} alt={r.name}
                            className="w-full aspect-[2/3] object-cover" />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-slate-100 flex items-center justify-center">
                            <Star className="w-6 h-6 text-slate-300" />
                          </div>
                        )}
                        <div className="px-2 py-2 bg-white">
                          <p className="text-[10px] font-semibold text-slate-400 tracking-wide">PSA 10 · 參考價格</p>
                          <p className="text-xs font-mono font-bold text-slate-800 mt-0.5 truncate">
                            {r.psa10Price ?? "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Milestone */}
            {milestoneRewards.length > 0 && (
              <div className="mb-4">
                <div className="mb-3"><TierBadge type="milestone" /></div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                  {milestoneRewards.map((r: any) => (
                    <div key={r.id} className="flex-shrink-0 rounded-sm overflow-hidden"
                      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)", width: "150px" }}>
                      {r.imageUrl ? (
                        <CardImage src={r.imageUrl} alt={r.name} className="w-full aspect-[2/3] object-cover" />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-slate-100 flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                      <div className="px-2 py-2 bg-white">
                        {r.triggerAt && <p className="text-[10px] text-orange-400 font-mono">第 {r.triggerAt} 抄</p>}
                        <p className="text-[10px] font-semibold text-slate-400 tracking-wide">PSA 10 · 參考價格</p>
                        <p className="text-xs font-mono font-bold text-slate-800 mt-0.5 truncate">
                          {r.psa10Price ?? "—"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Slot grid */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4" style={{ color: BRAND }} />
              <p className="text-xs tracking-[0.3em] text-slate-400 uppercase font-light">
                {multiMode ? `SELECT ${multiMode} SLOTS` : "SELECT A SLOT"}
              </p>
            </div>
            {selectedSlots.size > 0 && (
              <span className="text-xs font-mono" style={{ color: BRAND }}>
                {multiMode
                  ? `${selectedSlots.size} / ${multiMode} SELECTED`
                  : `# ${Array.from(selectedSlots)[0] + 1} SELECTED`
                }
              </span>
            )}
          </div>

          {/* 手機 8 欄 / 桌面 10 欄 */}
          <div className="grid gap-1 grid-cols-8 md:grid-cols-10 w-full">
            {sortedSlots.map((slot: any) => {
              const isSelected = selectedSlots.has(slot.slotIndex);
              const style = getSlotStyle(slot.isDrawn, isSelected);
              return (
                <div key={slot.slotIndex} className="relative w-full" style={{ paddingTop: "100%" }}>
                  <button
                    className="absolute inset-0 text-[10px] font-mono transition-all duration-150 rounded-sm flex items-center justify-center leading-none"
                    style={style}
                    onClick={() => handleSlotClick(slot.slotIndex, slot.isDrawn)}
                    disabled={slot.isDrawn || drawing}
                    title={slot.isDrawn ? "已抽取" : `第 ${slot.slotIndex + 1} 格`}
                  >
                    {slot.isDrawn ? (
                      <span style={{ color: "#cbd5e1", fontSize: "10px" }}>✓</span>
                    ) : isSelected ? (
                      <span style={{ color: "#fff", fontSize: "10px" }}>★</span>
                    ) : (
                      <span>{slot.slotIndex + 1}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-white border border-slate-200" />
              <span>未抽</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BRAND }} />
              <span>已選</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-slate-100 border border-slate-200 opacity-50" />
              <span>已抽</span>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="border-t border-slate-100 pt-8">
          <p className="text-xs tracking-[0.3em] text-slate-300 uppercase font-light mb-3">RULES</p>
          <ul className="space-y-1.5">
            {[
              `每格消耗 ${price} 點（HK$${price}）`,
              "抽到命名獎品（彩虹/黃金/藍色）將自動入庫",
              `隱藏卡可選擇官方回購（${pool.officialBuybackPoints} 點）或實體寄出`,
              "每格只能抽取一次，已抽格子不可重複",
              "點數消耗後不可退款",
            ].map((t, i) => (
              <li key={i} className="text-xs tracking-wide text-slate-400 leading-relaxed flex gap-2">
                <span className="text-slate-200 flex-shrink-0">—</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Reward Reveal Dialog ────────────────────────────────────────── */}
      <RewardRevealDialog
        open={revealOpen}
        onClose={() => setRevealOpen(false)}
        reward={revealedReward}
      />

      {/* ─── Multi-Draw Results Dialog ───────────────────────────────────── */}
      <Dialog open={multiRevealOpen} onOpenChange={(v) => !v && setMultiRevealOpen(false)}>
        <DialogContent className="bg-white border-0 shadow-2xl max-w-lg mx-auto rounded-none p-0 overflow-hidden">
          <div className="h-1 w-full" style={{ background: `linear-gradient(90deg,${BRAND},#7c3aed,#ec4899,#f59e0b)` }} />
          <div className="px-6 pt-6 pb-5">
            <p className="text-xs tracking-[0.3em] text-slate-400 uppercase mb-1">MULTI-DRAW RESULTS</p>
            <p className="text-lg font-bold text-slate-900 mb-5">{multiRevealResults.length} 張結果</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
              {multiRevealResults.map((r: any, i: number) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  {r.reward?.imageUrl ? (
                    <CardImage src={r.reward.imageUrl} alt={r.reward.name}
                      className="w-full h-auto object-contain"
                      style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.12))" }} />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-slate-50 flex items-center justify-center rounded-sm">
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                  <span className="text-[9px] text-slate-400 font-mono">#{r.slotIndex + 1}</span>
                  {r.reward && (
                    <TierBadge type={r.reward.rewardType} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setMultiRevealOpen(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 text-xs tracking-widest uppercase hover:border-slate-400 transition-colors">
                繼續抽取
              </button>
              <Link href="/vault" className="flex-1">
                <button className="w-full py-3 text-white text-xs tracking-widest uppercase transition-colors"
                  style={{ backgroundColor: BRAND }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}>
                  查看倉庫
                </button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>

    {/* Sticky Drawer via Portal - bypasses PageTransition overflow-hidden */}
    {createPortal(
      <div
        className="fixed bottom-0 left-0 w-full z-[999]"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 -15px 30px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3">
          {!user ? (
            <Link href="/login">
              <button className="w-full py-3.5 text-white text-xs tracking-widest uppercase font-medium transition-colors"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND)}>
                <Lock className="w-3.5 h-3.5 inline mr-2" />
                登入後抽取
              </button>
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              {/* Balance info */}
              <div className="flex-shrink-0">
                <div className="text-xs text-slate-400 leading-none mb-0.5">餘額</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-mono font-bold ${balance >= price ? "text-slate-800" : "text-red-500"}`}>
                    {balance.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">pts</span>
                </div>
                <Link href="/points">
                  <span className="text-[10px] tracking-wide cursor-pointer hover:underline" style={{ color: BRAND }}>
                    儲值
                  </span>
                </Link>
              </div>

              {/* Draw buttons */}
              <div className="flex flex-1 gap-2">
                {/* 抽 1 次 — only shown when NOT in multi-mode */}
                {multiMode === null && (
                  <button
                    onClick={() => handleDraw(1)}
                    disabled={drawing || selectedSlots.size === 0}
                    className="flex-1 py-3 text-white text-xs tracking-widest uppercase font-medium transition-all duration-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: BRAND }}
                    onMouseEnter={e => { if (!drawing) e.currentTarget.style.backgroundColor = BRAND_HOVER; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = BRAND; }}
                    title={selectedSlots.size === 0 ? "請先選擇格子" : undefined}
                  >
                    {drawing ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin inline" />
                    ) : (
                      <>抽 1 次</>
                    )}
                  </button>
                )}

                {/* 10 連抽 — toggle mode, then confirm */}
                {multiMode !== 100 && (
                  <button
                    onClick={() => {
                      if (multiMode === 10) {
                        // Already in 10-mode: if 10 selected, execute; else toggle off
                        if (selectedSlots.size === 10) { handleDraw(10); }
                        else { handleMultiModeToggle(10); }
                      } else {
                        handleMultiModeToggle(10);
                      }
                    }}
                    disabled={drawing}
                    className="flex-1 py-3 text-xs tracking-widest uppercase font-medium transition-all duration-200 rounded-md border disabled:opacity-40"
                    style={{
                      color: multiMode === 10 ? "#fff" : BRAND,
                      borderColor: multiMode === 10 ? BRAND : `rgba(6,3,141,0.3)`,
                      backgroundColor: multiMode === 10 ? BRAND : "rgba(6,3,141,0.04)",
                    }}
                  >
                    {drawing && multiMode === 10 ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin inline" />
                    ) : multiMode === 10 ? (
                      selectedSlots.size === 10
                        ? <>確認 10 連抽</>
                        : <>{selectedSlots.size}/10 選中</>
                    ) : (
                      <>10 連抽</>
                    )}
                  </button>
                )}

                {/* 100 連 — toggle mode, then confirm */}
                {multiMode !== 10 && (
                  <button
                    onClick={() => {
                      if (multiMode === 100) {
                        if (selectedSlots.size === 100) { handleDraw(100); }
                        else { handleMultiModeToggle(100); }
                      } else {
                        handleMultiModeToggle(100);
                      }
                    }}
                    disabled={drawing}
                    className="flex-1 py-3 text-xs tracking-widest uppercase font-medium transition-all duration-200 rounded-md border disabled:opacity-40"
                    style={{
                      color: multiMode === 100 ? "#fff" : "#64748b",
                      borderColor: multiMode === 100 ? "#475569" : "#e2e8f0",
                      backgroundColor: multiMode === 100 ? "#475569" : "#fff",
                    }}
                  >
                    {drawing && multiMode === 100 ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin inline" />
                    ) : multiMode === 100 ? (
                      selectedSlots.size === 100
                        ? <>確認 100 連</>
                        : <>{selectedSlots.size}/100 選中</>
                    ) : (
                      <>100 連</>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
