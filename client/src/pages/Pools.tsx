/**
 * Pools - 福袋卡池列表（用戶端）
 * 深色霓虹風格，DOPA/Clove 美學
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Package, ChevronRight, Zap, Lock, AlertTriangle } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";

// 卡池卡片
function PoolCard({ pool }: { pool: any }) {
  const drawnCount = pool.drawnCount ?? 0;
  const totalSlots = pool.totalSlots ?? 100;
  const progress = Math.min(100, (drawnCount / totalSlots) * 100);
  const remaining = totalSlots - drawnCount;

  return (
    <Link href={`/pools/${pool.id}`}>
      <div className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden cursor-pointer hover:border-zinc-600 transition-all duration-300 hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]">
        {/* 封面圖 */}
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
          {pool.coverImageUrl ? (
            <img
              src={pool.coverImageUrl}
              alt="卡池封面"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          {/* 漸層遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

          {/* 剩餘格數 badge */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-black/70 text-white border-zinc-700 backdrop-blur-sm text-xs">
              剩餘 {remaining} 格
            </Badge>
          </div>
        </div>

        {/* 卡池資訊 */}
        <div className="p-4">
          {/* 進度條 */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
              <span>已抽 {drawnCount}/{totalSlots}</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* 售價 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-lg font-bold text-white">{pool.pricePoints}</span>
              <span className="text-xs text-zinc-500">點/格</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400 group-hover:text-purple-400 transition-colors">
              <span className="text-xs">查看詳情</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Pools() {
  const { data: authData } = trpc.auth.me.useQuery();
  const user = authData;
  const { data, isLoading } = trpc.lootpool.list.useQuery();
  const { data: balanceData } = trpc.lootpool.myBalance.useQuery(undefined, {
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">載入卡池中...</span>
        </div>
      </div>
    );
  }

  // 維護模式
  if (data?.maintenanceMode) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center gap-4 text-center px-6 pb-20">
        <AlertTriangle className="w-12 h-12 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">系統維護中</h2>
        <p className="text-zinc-400 max-w-sm">
          {data.maintenanceMessage ?? "福袋系統正在維護，請稍後再試。"}
        </p>
        <BottomTabBar />
      </div>
    );
  }

  const pools = data?.pools ?? [];

  return (
    <div className="min-h-screen bg-[#0d0d0d] pb-24">
      {/* 頁首 */}
      <div className="sticky top-0 z-30 bg-[#0d0d0d]/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              BOXIUM 福袋
            </h1>
            <p className="text-xs text-zinc-500">抽取稀有寶可夢卡牌</p>
          </div>
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

      {/* 內容 */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {pools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-16 h-16 text-zinc-700 mb-4" />
            <h3 className="text-lg font-semibold text-zinc-400">暫無可用卡池</h3>
            <p className="text-sm text-zinc-600 mt-1">新卡池即將上線，敬請期待</p>
          </div>
        ) : (
          <>
            {/* 統計橫幅 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "可用卡池", value: pools.length, color: "text-purple-400" },
                {
                  label: "最低入場",
                  value: `${Math.min(...pools.map((p: any) => p.pricePoints))} 點`,
                  color: "text-yellow-400",
                },
                {
                  label: "最大格數",
                  value: `${Math.max(...pools.map((p: any) => p.totalSlots))} 格`,
                  color: "text-blue-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center"
                >
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* 卡池網格 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pools.map((pool: any) => (
                <PoolCard key={pool.id} pool={pool} />
              ))}
            </div>
          </>
        )}

        {/* 點數說明 */}
        <div className="mt-8 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">關於 BOXIUM 點數</h3>
          <ul className="text-xs text-zinc-500 space-y-1">
            <li>• HK$1 = 1 點，可用於抽取福袋</li>
            <li>• 抽到隱藏卡可選擇官方回購（點數）或實體寄出</li>
            <li>• 點數儲值後不可退款，請確認後再購買</li>
          </ul>
          <Link href="/points">
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs"
            >
              <Coins className="w-3 h-3 mr-1" />
              前往儲值點數
            </Button>
          </Link>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
