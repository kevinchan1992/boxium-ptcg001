/**
 * Pools — 福袋大廳（全面重構 v2）
 * 設計參考：Clove / DOPA! 高級盲盒平台
 * 佈局：手機雙列 / 桌面三四欄、頂部分類 Tab、深邃暗色背景
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Coins, Lock, AlertTriangle, Package, Sparkles, Gift, Star, Box, Flame } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PoolCard } from "@/components/PoolCard";

/* ── 分類 Tab 定義 ── */
const POOL_CATEGORIES = ["hot", "premium", "beginner", "box"] as const;
type PoolCategoryId = typeof POOL_CATEGORIES[number];
type CategoryId = PoolCategoryId | "all";

const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: "all",       label: "全部",       icon: "❆" },
  { id: "hot",       label: "熱門推薦",   icon: "🔥" },
  { id: "premium",   label: "高回報區",   icon: "💎" },
  { id: "beginner",  label: "新手限定",   icon: "🔰" },
  { id: "box",       label: "精選 BOX",   icon: "📦" },
];

/** 依卡池屬性決定分類（前端邏輯，可依後端欄位調整） */
function getPoolCategory(pool: any): PoolCategoryId {
  const price = pool.pricePoints ?? 0;
  const total = pool.totalSlots ?? 100;
  const drawn = pool.drawnCount ?? 0;
  const remaining = total - drawn;
  const fillRate = drawn / Math.max(total, 1);

  // 即將售罄 → 熱門
  if (fillRate > 0.6) return "hot";
  // 高單價 → 高回報
  if (price >= 300) return "premium";
  // 低單價 → 新手
  if (price <= 80) return "beginner";
  // 大格數 → 精選 BOX
  if (total >= 5000) return "box";
  return "hot";
}

export default function Pools() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  const { data: authData } = trpc.auth.me.useQuery();
  const user = authData;
  const { data, isLoading } = trpc.lootpool.list.useQuery();
  const { data: balanceData } = trpc.lootpool.myBalance.useQuery(undefined, {
    enabled: !!user,
  });

  /* ── 依分類過濾 ── */
  const allPools = data?.pools ?? [];
  const filteredPools = useMemo(() => {
    if (activeCategory === "all") return allPools;
    return allPools.filter((p: any) => getPoolCategory(p) === activeCategory);
  }, [allPools, activeCategory]);

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#06040f" }}>
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm tracking-wider">載入卡池中...</span>
        </div>
      </div>
    );
  }

  /* ── 維護模式 ── */
  if (data?.maintenanceMode && user?.role !== "admin") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 pb-20"
        style={{ background: "#06040f" }}
      >
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">系統維護中</h2>
        <p className="text-zinc-400 max-w-sm">
          {data.maintenanceMessage ?? "福袋系統正在維護，請稍後再試。"}
        </p>
        <BottomTabBar />
      </div>
    );
  }

  const pools = allPools;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#06040f" }}>

      {/* ══════════════════════════════════════
          頁首 Hero Banner
      ══════════════════════════════════════ */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0d0521 0%, #130a2e 40%, #0a1628 100%)",
          borderBottom: "1px solid rgba(139,92,246,0.15)",
        }}
      >
        {/* 背景光暈裝飾 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 10% 50%, rgba(139,92,246,0.12) 0%, transparent 60%)," +
              "radial-gradient(ellipse 40% 60% at 90% 30%, rgba(59,130,246,0.10) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            {/* 左側標題 */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className="text-xs font-bold tracking-[0.25em] uppercase"
                  style={{ color: "rgba(139,92,246,0.7)" }}
                >
                  BOXIUM
                </span>
                <span className="w-4 h-px" style={{ background: "rgba(139,92,246,0.4)" }} />
                <span
                  className="text-xs font-bold tracking-[0.25em] uppercase"
                  style={{ color: "rgba(139,92,246,0.7)" }}
                >
                  LOOT POOL
                </span>
              </div>
              <h1
                className="text-2xl md:text-3xl font-black tracking-tight text-white"
                style={{ textShadow: "0 0 30px rgba(139,92,246,0.4)" }}
              >
                福袋大廳
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {pools.length > 0
                  ? `${pools.length} 個卡池開放中 · 抽取稀有寶可夢卡牌`
                  : "抽取稀有寶可夢卡牌"}
              </p>
            </div>

            {/* 右側點數 / 登入 */}
            {user ? (
              <Link href="/points">
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 hover:scale-105"
                  style={{
                    background: "rgba(234,179,8,0.08)",
                    border: "1px solid rgba(234,179,8,0.25)",
                  }}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-sm font-black text-amber-400 leading-none">
                      {balanceData?.balance?.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-[9px] text-zinc-500 leading-none mt-0.5">點數餘額</div>
                  </div>
                </div>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  size="sm"
                  className="text-xs h-8 font-bold"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    border: "none",
                    color: "white",
                  }}
                >
                  <Lock className="w-3 h-3 mr-1" />
                  登入抽卡
                </Button>
              </Link>
            )}
          </div>

          {/* 快速統計 */}
          {pools.length > 0 && (
            <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              {[
                {
                  icon: <Sparkles className="w-3 h-3" />,
                  label: "可用卡池",
                  value: pools.length,
                  color: "#a78bfa",
                },
                {
                  icon: <Coins className="w-3 h-3" />,
                  label: "最低入場",
                  value: `${Math.min(...pools.map((p: any) => p.pricePoints))} 點`,
                  color: "#fbbf24",
                },
                {
                  icon: <Gift className="w-3 h-3" />,
                  label: "最大格數",
                  value: `${Math.max(...pools.map((p: any) => p.totalSlots)).toLocaleString()} 格`,
                  color: "#60a5fa",
                },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span className="text-xs text-zinc-500">{s.label}</span>
                  <span className="text-xs font-bold" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          分類 Tab 橫向滾動
      ══════════════════════════════════════ */}
      <div
        className="sticky top-0 z-30 overflow-x-auto"
        style={{
          background: "rgba(6,4,15,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        <div className="flex gap-1 px-4 py-2.5 min-w-max">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap"
                style={
                  isActive
                    ? {
                        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                        color: "#ffffff",
                        boxShadow: "0 0 16px rgba(124,58,237,0.4)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.45)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }
                }
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.id !== "all" && (
                  <span
                    className="text-[9px] rounded-full px-1.5 py-0.5 font-bold"
                    style={
                      isActive
                        ? { background: "rgba(255,255,255,0.2)", color: "white" }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
                    }
                  >
                    {allPools.filter((p: any) => {
                      if (cat.id === "all") return true;
                      return (getPoolCategory(p) as string) === (cat.id as string);
                    }).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════
          卡池網格
      ══════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-3 py-4 md:px-6 md:py-8">
        {filteredPools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Package className="w-9 h-9 text-zinc-700" />
            </div>
            <h3 className="text-base font-semibold text-zinc-400">
              {activeCategory === "all" ? "暫無可用卡池" : "此分類暫無卡池"}
            </h3>
            <p className="text-sm text-zinc-600 mt-1.5">
              {activeCategory === "all"
                ? "新卡池即將上線，敬請期待"
                : "請切換其他分類查看"}
            </p>
            {activeCategory !== "all" && (
              <button
                onClick={() => setActiveCategory("all")}
                className="mt-4 text-xs text-purple-400 underline underline-offset-2"
              >
                查看全部卡池
              </button>
            )}
          </div>
        ) : (
          /* 手機雙列 / 桌面三欄 / 大桌面四欄 */
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 lg:gap-6">
            {filteredPools.map((pool: any) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}

        {/* 點數說明 */}
        {pools.length > 0 && (
          <div
            className="mt-10 rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
              關於 BOXIUM 點數
            </h3>
            <ul className="text-xs text-zinc-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                HK$1 = 1 點，可用於抽取福袋
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                抽到隱藏卡可選擇官方回購（點數）或實體寄出
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                點數儲值後不可退款，請確認後再購買
              </li>
            </ul>
            <Link href="/points">
              <button
                className="mt-4 w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-80"
                style={{
                  background: "rgba(234,179,8,0.08)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  color: "#fbbf24",
                }}
              >
                <Coins className="w-3 h-3 inline mr-1.5" />
                前往儲值點數
              </button>
            </Link>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
