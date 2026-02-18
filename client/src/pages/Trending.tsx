import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Flame, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type TimeRange = '1' | '7' | '30';
type TrendingTab = 'searches' | 'priceIncrease' | 'priceDecrease' | 'newlyAdded';

export default function Trending() {
  const [activeTab, setActiveTab] = useState<TrendingTab>('searches');
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const days = parseInt(timeRange);

  // Fetch trending data based on active tab
  const { data: searchData, isLoading: searchLoading, refetch: refetchSearch } = trpc.trending.getBySearches.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'searches', refetchInterval: 5 * 60 * 1000 } // Refresh every 5 minutes
  );

  const { data: priceIncreaseData, isLoading: priceIncreaseLoading, refetch: refetchPriceIncrease } = trpc.trending.getByPriceIncrease.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'priceIncrease', refetchInterval: 5 * 60 * 1000 }
  );

  const { data: priceDecreaseData, isLoading: priceDecreaseLoading, refetch: refetchPriceDecrease } = trpc.trending.getByPriceDecrease.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'priceDecrease', refetchInterval: 5 * 60 * 1000 }
  );

  const { data: newlyAddedData, isLoading: newlyAddedLoading, refetch: refetchNewlyAdded } = trpc.trending.getNewlyAdded.useQuery(
    { limit: 10, days },
    { enabled: activeTab === 'newlyAdded', refetchInterval: 5 * 60 * 1000 }
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'searches': return searchData || [];
      case 'priceIncrease': return priceIncreaseData || [];
      case 'priceDecrease': return priceDecreaseData || [];
      case 'newlyAdded': return newlyAddedData || [];
      default: return [];
    }
  };

  const isLoading = searchLoading || priceIncreaseLoading || priceDecreaseLoading || newlyAddedLoading;
  const currentData = getCurrentData();

  const handleRefresh = () => {
    switch (activeTab) {
      case 'searches': refetchSearch(); break;
      case 'priceIncrease': refetchPriceIncrease(); break;
      case 'priceDecrease': refetchPriceDecrease(); break;
      case 'newlyAdded': refetchNewlyAdded(); break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
              🔥 熱門排行榜
            </h1>
            <p className="text-gray-400 text-lg">
              追蹤最熱門的寶可夢卡牌市場趨勢
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Time Range Selector */}
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[140px] bg-slate-900 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24 小時</SelectItem>
                <SelectItem value="7">7 天</SelectItem>
                <SelectItem value="30">30 天</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="bg-slate-900 border-slate-700 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TrendingTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="searches" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500">
              <Flame className="w-4 h-4 mr-2" />
              搜尋熱度
            </TabsTrigger>
            <TabsTrigger value="priceIncrease" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500">
              <TrendingUp className="w-4 h-4 mr-2" />
              價格飆升
            </TabsTrigger>
            <TabsTrigger value="priceDecrease" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500">
              <TrendingDown className="w-4 h-4 mr-2" />
              價格暴跌
            </TabsTrigger>
            <TabsTrigger value="newlyAdded" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500">
              <Sparkles className="w-4 h-4 mr-2" />
              新上架
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="mt-8">
            {isLoading ? (
              <LoadingSkeleton />
            ) : currentData.length === 0 ? (
              <EmptyState activeTab={activeTab} />
            ) : (
              <>
                {/* Champion Card (Top 1) */}
                {currentData[0] && (
                  <ChampionCard card={currentData[0]} rank={1} type={activeTab} />
                )}

                {/* Runner-up Cards (Top 2-3) */}
                {currentData.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    {currentData[1] && <RunnerUpCard card={currentData[1]} rank={2} type={activeTab} />}
                    {currentData[2] && <RunnerUpCard card={currentData[2]} rank={3} type={activeTab} />}
                  </div>
                )}

                {/* Ranking List (Top 4-10) */}
                {currentData.length > 3 && (
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold text-white mb-4">完整排行榜</h2>
                    <div className="space-y-3">
                      {currentData.slice(3).map((card, index) => (
                        <RankingListItem key={card.id} card={card} rank={index + 4} type={activeTab} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// Champion Card Component (Rank 1)
function ChampionCard({ card, rank, type }: { card: any; rank: number; type: TrendingTab }) {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-900/30 via-orange-900/30 to-red-900/30 border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all duration-300 hover:scale-[1.02]">
      {/* Golden Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 animate-pulse" />
      
      <div className="relative p-8">
        <div className="flex items-start gap-6">
          {/* Rank Badge */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg animate-pulse">
              🏆
            </div>
          </div>

          {/* Card Image */}
          <div className="flex-shrink-0">
            <img
              src={card.imageUrl || "/placeholder-card.png"}
              alt={card.name}
              className="w-48 h-auto rounded-lg shadow-xl border-2 border-yellow-500/50"
            />
          </div>

          {/* Card Info */}
          <div className="flex-1">
            <h3 className="text-3xl font-bold text-white mb-2">{card.name}</h3>
            {card.nameJa && <p className="text-lg text-gray-400 mb-4">{card.nameJa}</p>}
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-400">當前價格</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
                </p>
              </div>

              {type === 'searches' && card.searchCount && (
                <div>
                  <p className="text-sm text-gray-400">搜尋次數</p>
                  <p className="text-2xl font-bold text-orange-400">
                    🔥 {card.searchCount} 次
                  </p>
                </div>
              )}

              {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
                <div>
                  <p className="text-sm text-gray-400">價格變化</p>
                  <p className={`text-2xl font-bold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
                    {card.priceChangePercent > 0 ? '↑' : '↓'} {Math.abs(card.priceChangePercent).toFixed(2)}%
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600">
                查看詳情
              </Button>
              <Button variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10">
                前往 SNKRDUNK
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Runner-up Card Component (Rank 2-3)
function RunnerUpCard({ card, rank, type }: { card: any; rank: number; type: TrendingTab }) {
  const borderColor = rank === 2 ? 'border-gray-400/50' : 'border-amber-700/50';
  const badgeEmoji = rank === 2 ? '🥈' : '🥉';

  return (
    <Card className={`overflow-hidden bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-2 ${borderColor} hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{badgeEmoji}</div>
          
          <img
            src={card.imageUrl || "/placeholder-card.png"}
            alt={card.name}
            className="w-32 h-auto rounded-lg shadow-lg"
          />

          <div className="flex-1">
            <h4 className="text-xl font-bold text-white mb-1">{card.name}</h4>
            {card.nameJa && <p className="text-sm text-gray-400 mb-3">{card.nameJa}</p>}
            
            <div className="space-y-2">
              <p className="text-lg font-semibold text-yellow-400">
                {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
              </p>

              {type === 'searches' && card.searchCount && (
                <p className="text-sm text-gray-300">
                  🔥 {card.searchCount} 次搜尋
                </p>
              )}

              {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
                <p className={`text-sm font-semibold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
                  {card.priceChangePercent > 0 ? '↑' : '↓'} {Math.abs(card.priceChangePercent).toFixed(2)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Ranking List Item Component (Rank 4-10)
function RankingListItem({ card, rank, type }: { card: any; rank: number; type: TrendingTab }) {
  return (
    <Card className="overflow-hidden bg-slate-900/50 border border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 transition-all duration-200">
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Rank Number */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-400">#{rank}</span>
          </div>

          {/* Card Image */}
          <img
            src={card.imageUrl || "/placeholder-card.png"}
            alt={card.name}
            className="w-16 h-auto rounded shadow-md"
          />

          {/* Card Info */}
          <div className="flex-1">
            <h5 className="font-semibold text-white">{card.name}</h5>
            {card.nameJa && <p className="text-xs text-gray-400">{card.nameJa}</p>}
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="font-semibold text-yellow-400">
              {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
            </p>

            {type === 'searches' && card.searchCount && (
              <p className="text-xs text-gray-400">
                🔥 {card.searchCount} 次
              </p>
            )}

            {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
              <p className={`text-sm font-semibold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
                {card.priceChangePercent > 0 ? '↑' : '↓'} {Math.abs(card.priceChangePercent).toFixed(2)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 w-full bg-slate-800" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48 w-full bg-slate-800" />
        <Skeleton className="h-48 w-full bg-slate-800" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

// Empty State
function EmptyState({ activeTab }: { activeTab: TrendingTab }) {
  const messages = {
    searches: '目前沒有足夠的搜尋數據',
    priceIncrease: '目前沒有價格上漲的卡牌',
    priceDecrease: '目前沒有價格下跌的卡牌',
    newlyAdded: '目前沒有新上架的卡牌',
  };

  return (
    <Card className="p-12 text-center bg-slate-900/50 border-slate-800">
      <p className="text-xl text-gray-400">{messages[activeTab]}</p>
      <p className="text-sm text-gray-500 mt-2">請稍後再試或選擇其他時間範圍</p>
    </Card>
  );
}
