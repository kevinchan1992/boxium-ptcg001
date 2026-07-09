/**
 * Pools — 福袋卡池列表頁
 * DOPA/Clove 風格：黑色背景、霓虹光效、卡片式佈局
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Package, ChevronRight, Sparkles } from "lucide-react";

const TIER_GLOW: Record<string, string> = {
  active: "shadow-[0_0_20px_rgba(250,204,21,0.3)] border-yellow-500/30",
  draft: "border-zinc-700",
  completed: "border-zinc-600 opacity-60",
};

export default function Pools() {
  const { data: pools, isLoading } = trpc.lootpool.pool.list.useQuery();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(250,204,21,0.08),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 text-yellow-400 text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            BOXIUM 福袋系統
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
            🎴 神秘福袋
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            選擇你的格子，開啟屬於你的 PSA10 稀有卡牌
          </p>
        </div>
      </div>

      {/* 卡池列表 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-zinc-900 rounded-2xl h-64 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : !pools?.length ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-400">目前沒有進行中的福袋</h2>
            <p className="text-zinc-500 mt-2">請稍後再來查看</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pools.map((pool: any) => (
              <PoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PoolCard({ pool }: { pool: any }) {
  const soldPct = pool.totalSlots > 0
    ? Math.round(((pool.soldSlots ?? 0) / pool.totalSlots) * 100)
    : 0;

  return (
    <Link href={`/pools/${pool.id}`}>
      <div className={`group relative bg-zinc-900 rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] ${TIER_GLOW[pool.status] ?? "border-zinc-700"}`}>
        {/* 封面圖 */}
        <div className="relative h-44 bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden">
          {pool.coverImageUrl ? (
            <img src={pool.coverImageUrl} alt={pool.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-6xl opacity-30">🎴</div>
            </div>
          )}
          {/* 光效遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
          {/* 維護標籤 */}
          {pool.maintenanceMode && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">維護中</Badge>
            </div>
          )}
          {/* 格子進度 */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex justify-between text-xs text-zinc-300 mb-1">
              <span>{pool.soldSlots ?? 0}/{pool.totalSlots} 格已抽</span>
              <span>{soldPct}%</span>
            </div>
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${soldPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 卡片資訊 */}
        <div className="p-4">
          <h3 className="font-bold text-white text-base line-clamp-1 mb-1">{pool.title}</h3>
          {pool.description && (
            <p className="text-zinc-400 text-xs line-clamp-2 mb-3">{pool.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-lg">{pool.pricePoints.toLocaleString()}</span>
              <span className="text-zinc-400 text-sm">點/格</span>
            </div>
            <Button size="sm" className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs h-8 px-3 group-hover:shadow-[0_0_12px_rgba(250,204,21,0.4)]">
              選格子 <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
