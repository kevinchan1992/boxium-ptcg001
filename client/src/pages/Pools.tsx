/**
 * Pools — 盲盒大廳（Editorial Premium Style）
 *
 * 設計語言：高級日系 / 歐美時尚雜誌感
 * - 純白 / slate-50 背景，大量留白
 * - 分類標籤：底線樣式，無填色塊
 * - 網格：手機單欄 / 桌面雙欄（max-w-5xl）
 * - 品牌藍 #06038D，無紫色/粉紅
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Package, Coins } from "lucide-react";
import { PoolCard } from "@/components/PoolCard";

/* ── 分類 Tab ── */
type PoolCategoryId = "hot" | "premium" | "beginner" | "box";
type CategoryId = PoolCategoryId | "all";

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "all",      label: "全部"    },
  { id: "hot",      label: "熱門"    },
  { id: "premium",  label: "高回報"  },
  { id: "beginner", label: "新手"    },
  { id: "box",      label: "精選 BOX" },
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
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div
            className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#06038D", borderTopColor: "transparent" }}
          />
          <span className="text-xs font-medium tracking-widest uppercase text-slate-400">
            Loading
          </span>
        </div>
      </div>
    );
  }

  /* ── 維護模式 ── */
  if (data?.maintenanceMode && (user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 text-center px-6 pb-20">
        <AlertTriangle className="w-10 h-10 text-slate-400" />
        <div>
          <h2 className="text-lg font-bold tracking-wide text-slate-800 mb-2">系統維護中</h2>
          <p className="text-sm text-slate-400 max-w-sm font-light leading-relaxed">
            {(data as any).maintenanceMessage ?? "盲盒系統正在維護，請稍後再試。"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28">

      {/* ══ 頁首 ══ */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* 左側品牌標題 */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-black tracking-[0.3em] uppercase"
                style={{ color: "#06038D" }}
              >
                BOXIUM
              </span>
              <span className="text-[10px] text-slate-300 font-light">×</span>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-slate-400">
                LOOT POOL
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-light tracking-wide">
              {allPools.length > 0 ? `${allPools.length} 個卡池開放中` : "敬請期待"}
            </p>
          </div>

          {/* 右側點數餘額 / 登入按鈕 */}
          {user ? (
            <Link href="/points">
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all hover:opacity-80"
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: "6px",
                }}
              >
                <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <div>
                  <div className="text-sm font-black text-amber-600 leading-none">
                    {balanceData?.balance?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-[9px] text-amber-400 leading-none mt-0.5 tracking-wide">
                    點數餘額
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <button
                className="px-4 py-2 text-xs font-medium tracking-widest text-white rounded-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: "#06038D" }}
              >
                登入抽卡
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ══ 分類標籤（雜誌底線樣式） ══ */}
      <div
        className="sticky top-0 z-30 bg-white border-b border-slate-100 overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        <div className="max-w-5xl mx-auto flex gap-0 px-4 min-w-max">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count =
              cat.id === "all"
                ? allPools.length
                : allPools.filter(
                    (p: any) =>
                      (getPoolCategory(p) as string) === (cat.id as string)
                  ).length;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={[
                  "relative flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold tracking-widest uppercase whitespace-nowrap transition-all duration-200",
                  "border-b-2",
                  isActive
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-400 hover:text-slate-600",
                ].join(" ")}
              >
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={[
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                      isActive
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-400",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ 卡池網格 ══ */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {filteredPools.length === 0 ? (
          /* 空狀態 */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 flex items-center justify-center mb-6">
              <Package className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold tracking-widest uppercase text-slate-400 mb-2">
              {activeCategory === "all" ? "暫無可用卡池" : "此分類暫無卡池"}
            </h3>
            <p className="text-xs text-slate-400 font-light leading-relaxed max-w-xs">
              {activeCategory === "all"
                ? "新卡池即將上線，敬請期待"
                : "請切換其他分類查看"}
            </p>
            {activeCategory !== "all" && (
              <button
                onClick={() => setActiveCategory("all")}
                className="mt-6 text-xs font-medium tracking-widest uppercase text-slate-500 underline underline-offset-4 hover:text-slate-800 transition-colors"
              >
                查看全部卡池
              </button>
            )}
          </div>
        ) : (
          /*
           * 網格佈局：
           *   手機 (<768px)  → 單欄 gap-6
           *   桌面 (≥768px)  → 雙欄 gap-8
           */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {filteredPools.map((pool: any) => (
              <PoolCard
                key={pool.id}
                pool={{
                  ...pool,
                  coverImageUrl: pool.coverImageUrl ?? null,
                  drawnCount:
                    pool.drawnCount ??
                    pool.totalSlots - (pool.remainingSlots ?? pool.totalSlots),
                }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
