/**
 * Pools — 福袋大廳（Clove 1:1 佈局）
 *
 * RWD：
 *   手機 (<640px)  → 單欄，全寬卡片
 *   桌面 (≥640px)  → 雙欄，max-w-4xl 居中
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Coins, Lock, AlertTriangle, Package } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PoolCard } from "@/components/PoolCard";

/* ── 分類 Tab ── */
type PoolCategoryId = "hot" | "premium" | "beginner" | "box";
type CategoryId = PoolCategoryId | "all";

const CATEGORIES: { id: CategoryId; label: string; emoji: string }[] = [
  { id: "all",      label: "全部",    emoji: "✦"  },
  { id: "hot",      label: "熱門",    emoji: "🔥" },
  { id: "premium",  label: "高回報",  emoji: "💎" },
  { id: "beginner", label: "新手",    emoji: "🔰" },
  { id: "box",      label: "精選BOX", emoji: "📦" },
];

function getPoolCategory(pool: any): PoolCategoryId {
  const price    = pool.pricePoints ?? 0;
  const total    = pool.totalSlots  ?? 100;
  const drawn    = pool.drawnCount  ?? 0;
  const fillRate = drawn / Math.max(total, 1);
  if (fillRate > 0.6)  return "hot";
  if (price >= 300)    return "premium";
  if (price <= 80)     return "beginner";
  if (total >= 5000)   return "box";
  return "hot";
}

export default function Pools() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  const { data: authData }    = trpc.auth.me.useQuery();
  const user                  = authData;
  const { data, isLoading }   = trpc.lootpool.list.useQuery();
  const { data: balanceData } = trpc.lootpool.myBalance.useQuery(undefined, { enabled: !!user });

  const allPools      = data?.pools ?? [];
  const filteredPools = useMemo(() => {
    if (activeCategory === "all") return allPools;
    return allPools.filter(
      (p: any) => (getPoolCategory(p) as string) === (activeCategory as string)
    );
  }, [allPools, activeCategory]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">載入卡池中...</span>
        </div>
      </div>
    );
  }

  /* ── 維護模式 ── */
  if (data?.maintenanceMode && (user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-center px-6 pb-20">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-xl font-bold text-slate-800">系統維護中</h2>
        <p className="text-slate-500 max-w-sm text-sm">
          {(data as any).maintenanceMessage ?? "福袋系統正在維護，請稍後再試。"}
        </p>
        <BottomTabBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">

      {/* ══ 頁首 ══ */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-blue-600">BOXIUM</span>
              <span className="text-[10px] text-slate-300">×</span>
              <span className="text-[10px] font-black tracking-[0.25em] uppercase text-slate-400">LOOT POOL</span>
            </div>

          </div>

          {user ? (
            <Link href="/points">
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer hover:scale-105 transition-all border"
                style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                <Coins className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="text-sm font-black text-amber-600 leading-none">
                    {balanceData?.balance?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-[9px] text-amber-400 leading-none mt-0.5">點數餘額</div>
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm" className="text-xs h-8 font-bold rounded-full px-4 bg-blue-600 text-white border-none hover:bg-blue-700">
                <Lock className="w-3 h-3 mr-1" />
                登入抽卡
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ══ 分類 Tab ══ */}
      <div
        className="sticky top-0 z-30 bg-white border-b border-slate-100 overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        <div className="max-w-4xl mx-auto flex gap-1.5 px-4 py-2.5 min-w-max">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = cat.id === "all"
              ? allPools.length
              : allPools.filter((p: any) => (getPoolCategory(p) as string) === (cat.id as string)).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300"
                style={isActive
                  ? { background: "#2563EB", color: "#fff", boxShadow: "0 6px 16px rgba(37,99,235,0.35)", transform: "scale(1.06)" }
                  : { background: "transparent", color: "#64748b", border: "1.5px solid #e2e8f0" }
                }
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold"
                  style={isActive
                    ? { background: "rgba(255,255,255,0.25)", color: "white" }
                    : { background: "#f1f5f9", color: "#94a3b8" }
                  }>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ 卡池網格 ══ */}
      <div className="max-w-4xl mx-auto px-4 py-5">
        {filteredPools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
              <Package className="w-9 h-9 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-500">
              {activeCategory === "all" ? "暫無可用卡池" : "此分類暫無卡池"}
            </h3>
            <p className="text-sm text-slate-400 mt-1.5">
              {activeCategory === "all" ? "新卡池即將上線，敬請期待" : "請切換其他分類查看"}
            </p>
            {activeCategory !== "all" && (
              <button onClick={() => setActiveCategory("all")}
                className="mt-4 text-xs font-semibold underline underline-offset-2 text-blue-600">
                查看全部卡池
              </button>
            )}
          </div>
        ) : (
          /*
           * Clove RWD 公式：
           *   手機 (<640px)  → 單欄
           *   桌面 (≥640px)  → 雙欄
           */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {filteredPools.map((pool: any) => (
              <PoolCard
                key={pool.id}
                pool={{
                  ...pool,
                  coverImageUrl: pool.coverImageUrl ?? null,
                  drawnCount: pool.drawnCount ?? (pool.totalSlots - (pool.remainingSlots ?? pool.totalSlots)),
                }}
              />
            ))}
          </div>
        )}


      </div>

      <BottomTabBar />
    </div>
  );
}
