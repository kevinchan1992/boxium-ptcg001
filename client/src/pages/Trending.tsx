import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Flame, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

type TrendingTab = 'searches' | 'priceIncrease' | 'priceDecrease' | 'newlyAdded';

export default function Trending() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TrendingTab>('searches');
  const days = 1; // Fixed to 24 hours

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
      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-1 md:mb-2">
              {t('trending.title')}
            </h1>
            <p className="text-gray-400 text-sm md:text-lg">
              {t('trending.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
          <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-800 h-auto">
            <TabsTrigger 
              value="searches" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm"
            >
              <Flame className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('trending.searchHeat')}</span>
              <span className="sm:hidden">{t('trending.searchHeatShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="priceIncrease" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm"
            >
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('trending.priceSurge')}</span>
              <span className="sm:hidden">{t('trending.priceSurgeShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="priceDecrease" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm"
            >
              <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('trending.priceDrop')}</span>
              <span className="sm:hidden">{t('trending.priceDropShort')}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="newlyAdded" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 flex-col md:flex-row gap-1 md:gap-2 py-2 md:py-2.5 text-xs md:text-sm"
            >
              <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{t('trending.newlyAdded')}</span>
              <span className="sm:hidden">{t('trending.newlyAddedShort')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="mt-4 md:mt-8">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
                    {currentData[1] && <RunnerUpCard card={currentData[1]} rank={2} type={activeTab} />}
                    {currentData[2] && <RunnerUpCard card={currentData[2]} rank={3} type={activeTab} />}
                  </div>
                )}

                {/* Ranking List (Top 4-10) */}
                {currentData.length > 3 && (
                  <div className="mt-4 md:mt-6">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">{t('trending.fullRanking')}</h2>
                    <div className="space-y-2 md:space-y-3">
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
      
      {/* Footer */}
      <Footer />
    </div>
  );
}

// Champion Card Component (Rank 1)
function ChampionCard({ card, rank, type }: { card: any; rank: number; type: TrendingTab }) {
  const { t } = useTranslation();
  // Better image fallback handling
  const imageUrl = card.imageUrl || card.imageUrlHiRes || '';
  const hasValidImage = imageUrl && imageUrl.trim() !== '';

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-900/30 via-orange-900/30 to-red-900/30 border-2 border-yellow-500/50 shadow-2xl shadow-yellow-500/20 hover:shadow-yellow-500/40 transition-all duration-300 hover:scale-[1.01] md:hover:scale-[1.02]">
      {/* Golden Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 animate-pulse" />
      
      <div className="relative p-4 md:p-8">
        <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
          {/* Rank Badge */}
          <div className="flex-shrink-0 self-center md:self-start">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl md:text-4xl font-bold text-white shadow-lg animate-pulse">
              🏆
            </div>
          </div>

          {/* Card Image */}
          <div className="flex-shrink-0 self-center md:self-start">
            {hasValidImage ? (
              <img
                src={imageUrl}
                alt={card.name}
                className="w-40 md:w-56 h-auto rounded-lg shadow-xl border-2 border-yellow-500/50"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-40 md:w-56 h-56 md:h-80 rounded-lg shadow-xl border-2 border-yellow-500/50 bg-slate-800 flex items-center justify-center text-gray-500 text-sm">
                {t('trending.noImage')}
              </div>
            )}
          </div>

          {/* Card Info */}
          <div className="flex-1 w-full md:w-auto">
            <h3 className="text-xl md:text-3xl font-bold text-white mb-1 md:mb-2 line-clamp-2">{card.name}</h3>
            {card.nameJa && <p className="text-sm md:text-lg text-gray-400 mb-2 md:mb-4 line-clamp-1">{card.nameJa}</p>}
            
            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
              <div>
                <p className="text-xs md:text-sm text-gray-400">{t('trending.currentPrice')}</p>
                <p className="text-lg md:text-2xl font-bold text-yellow-400">
                  {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
                </p>
              </div>

              {type === 'searches' && card.searchCount && (
                <div>
                  <p className="text-xs md:text-sm text-gray-400">{t('trending.searchCount')}</p>
                  <p className="text-lg md:text-2xl font-bold text-orange-400">
                    🔥 {card.searchCount} 次
                  </p>
                </div>
              )}

              {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
                <div>
                  <p className="text-xs md:text-sm text-gray-400">{t('trending.priceChange')}</p>
                  <p className={`text-lg md:text-2xl font-bold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
                    {card.priceChangePercent > 0 ? '↑' : '↓'} {Math.abs(card.priceChangePercent).toFixed(2)}%
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
              <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-sm md:text-base">
                {t('trending.viewDetails')}
              </Button>
              <Button variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 text-sm md:text-base">
                {t('trending.goToSnkrdunk')}
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
  const { t } = useTranslation();
  const borderColor = rank === 2 ? 'border-gray-400/50' : 'border-amber-700/50';
  const badgeEmoji = rank === 2 ? '🥈' : '🥉';
  
  const imageUrl = card.imageUrl || card.imageUrlHiRes || '';
  const hasValidImage = imageUrl && imageUrl.trim() !== '';

  return (
    <Card className={`overflow-hidden bg-gradient-to-br from-slate-900/50 to-slate-800/50 border-2 ${borderColor} hover:shadow-xl transition-all duration-300 hover:scale-[1.01] md:hover:scale-[1.02]`}>
      <div className="p-4 md:p-6">
        <div className="flex items-start gap-3 md:gap-4">
          <div className="text-3xl md:text-4xl flex-shrink-0">{badgeEmoji}</div>
          
          {hasValidImage ? (
              <img
                src={imageUrl}
                alt={card.name}
                className="w-32 md:w-40 h-auto rounded-lg shadow-lg flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
              <div className="w-32 md:w-40 h-44 md:h-56 rounded-lg shadow-lg bg-slate-800 flex items-center justify-center text-gray-500 text-xs flex-shrink-0">
              {t('trending.noImage')}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="text-base md:text-xl font-bold text-white mb-1 line-clamp-2">{card.name}</h4>
            {card.nameJa && <p className="text-xs md:text-sm text-gray-400 mb-2 md:mb-3 line-clamp-1">{card.nameJa}</p>}
            
            <div className="space-y-1 md:space-y-2">
              <p className="text-base md:text-lg font-semibold text-yellow-400">
                {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
              </p>

              {type === 'searches' && card.searchCount && (
                <p className="text-xs md:text-sm text-gray-300">
                  🔥 {card.searchCount} 次搜尋
                </p>
              )}

              {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
                <p className={`text-xs md:text-sm font-semibold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
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
  const { t } = useTranslation();
  const imageUrl = card.imageUrl || card.imageUrlHiRes || '';
  const hasValidImage = imageUrl && imageUrl.trim() !== '';

  return (
    <Card className="overflow-hidden bg-slate-900/30 border border-slate-800 hover:bg-slate-900/50 hover:border-slate-700 transition-all duration-200">
      <div className="p-3 md:p-4">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Rank Number */}
          <div className="flex-shrink-0 w-8 md:w-10 text-center">
            <span className="text-lg md:text-xl font-bold text-gray-400">#{rank}</span>
          </div>

          {/* Card Image */}
          {hasValidImage ? (
              <img
                src={imageUrl}
                alt={card.name}
                className="w-16 md:w-20 h-auto rounded shadow-md flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
              <div className="w-16 md:w-20 h-22 md:h-28 rounded shadow-md bg-slate-800 flex items-center justify-center text-gray-500 text-[10px] flex-shrink-0">
              {t('trending.noImage')}
            </div>
          )}

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <h5 className="text-sm md:text-base font-semibold text-white mb-0.5 md:mb-1 line-clamp-1">{card.name}</h5>
            {card.nameJa && <p className="text-xs text-gray-400 mb-1 md:mb-2 line-clamp-1">{card.nameJa}</p>}
            
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <span className="text-sm md:text-base font-semibold text-yellow-400">
                {card.currentPrice ? `HKD $${card.currentPrice.toLocaleString()}` : 'N/A'}
              </span>

              {type === 'searches' && card.searchCount && (
                <span className="text-xs md:text-sm text-gray-300">
                  🔥 {card.searchCount}
                </span>
              )}

              {(type === 'priceIncrease' || type === 'priceDecrease') && card.priceChangePercent !== undefined && (
                <span className={`text-xs md:text-sm font-semibold ${card.priceChangePercent > 0 ? 'text-green-400' : 'text-blue-400'}`}>
                  {card.priceChangePercent > 0 ? '↑' : '↓'} {Math.abs(card.priceChangePercent).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-4 md:space-y-6">
      <Skeleton className="h-48 md:h-64 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Skeleton className="h-32 md:h-48 w-full" />
        <Skeleton className="h-32 md:h-48 w-full" />
      </div>
      <div className="space-y-2 md:space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 md:h-20 w-full" />
        ))}
      </div>
    </div>
  );
}

// Empty State
function EmptyState({ activeTab }: { activeTab: TrendingTab }) {
  const { t } = useTranslation();
  const messages = {
    searches: t('trending.emptySearches'),
    priceIncrease: t('trending.emptyPriceIncrease'),
    priceDecrease: t('trending.emptyPriceDecrease'),
    newlyAdded: t('trending.emptyNewlyAdded'),
  };

  return (
    <div className="text-center py-12 md:py-16">
      <p className="text-lg md:text-xl text-gray-400">{messages[activeTab]}</p>
      <p className="text-sm md:text-base text-gray-500 mt-2">{t('trending.emptyHint')}</p>
    </div>
  );
}
