import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Search, Activity, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MarketInsights() {
  const { t, i18n } = useTranslation();

  // Fetch market data
  const { data: topGainers, isLoading: loadingGainers } = trpc.marketInsights.getTopGainers.useQuery({ days: 7, limit: 5 });
  const { data: topSearched, isLoading: loadingSearched } = trpc.marketInsights.getTopSearched.useQuery({ days: 7, limit: 5 });
  const { data: topVolatile, isLoading: loadingVolatile } = trpc.marketInsights.getTopVolatile.useQuery({ days: 7, limit: 5 });
  const { data: overview, isLoading: loadingOverview } = trpc.marketInsights.getMarketOverview.useQuery();

  // LLM market analysis
  const [analysis, setAnalysis] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const generateAnalysisMutation = trpc.marketInsights.generateAnalysis.useMutation();

  // Generate analysis when data is loaded
  useEffect(() => {
    if (!loadingGainers && !loadingSearched && !loadingVolatile && !loadingOverview && !analysis) {
      setLoadingAnalysis(true);
      generateAnalysisMutation.mutate(
        { language: i18n.language as "zh-TW" | "en" | "ja" },
        {
          onSuccess: (data) => {
            setAnalysis(typeof data.analysis === 'string' ? data.analysis : '');
            setLoadingAnalysis(false);
          },
          onError: () => {
            setAnalysis("市場分析生成失敗，請稍後再試。");
            setLoadingAnalysis(false);
          },
        }
      );
    }
  }, [loadingGainers, loadingSearched, loadingVolatile, loadingOverview, analysis]);

  const formatPrice = (price: number, currency: string = "HKD") => {
    return `${currency} ${price.toFixed(2)}`;
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white">
      {/* Header Banner */}
      <div className="bg-yellow-400 text-blue-900 py-8 px-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <BarChart3 className="w-12 h-12" />
            <div>
              <h1 className="text-4xl font-bold">BOXIUM 市場快報</h1>
              <p className="text-lg">本週 PTCG 市場洞察報告</p>
            </div>
          </div>
          <p className="text-sm opacity-80">
            {new Date().toLocaleDateString("zh-TW", { 
              year: "numeric", 
              month: "long", 
              day: "numeric",
              weekday: "long"
            })}
          </p>
        </div>
      </div>

      {/* Market Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {loadingOverview ? (
            <>
              <Skeleton className="h-24 bg-blue-800" />
              <Skeleton className="h-24 bg-blue-800" />
              <Skeleton className="h-24 bg-blue-800" />
              <Skeleton className="h-24 bg-blue-800" />
            </>
          ) : (
            <>
              <Card className="bg-blue-800/50 border-blue-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-yellow-400">{overview?.totalCards || 0}</div>
                  <div className="text-sm text-blue-200">追蹤卡牌數量</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-800/50 border-blue-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-yellow-400">{overview?.totalPriceRecords || 0}</div>
                  <div className="text-sm text-blue-200">價格記錄數量</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-800/50 border-blue-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-yellow-400">{overview?.totalSearches || 0}</div>
                  <div className="text-sm text-blue-200">用戶搜尋次數</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-800/50 border-blue-700">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-yellow-400">
                    {formatPercentage(overview?.avgPriceChange7d || 0)}
                  </div>
                  <div className="text-sm text-blue-200">7 天平均漲幅</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Top Gainers */}
        <Card className="bg-blue-800/30 border-blue-700 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <TrendingUp className="w-6 h-6" />
              本週漲幅 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingGainers ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 bg-blue-800" />
                ))}
              </div>
            ) : topGainers && topGainers.length > 0 ? (
              <div className="space-y-4">
                {topGainers.map((card, index) => (
                  <div
                    key={card.cardId}
                    className="flex items-center gap-4 p-4 bg-blue-900/50 rounded-lg hover:bg-blue-900/70 transition-colors"
                  >
                    <div className="text-3xl font-bold text-yellow-400 w-12">
                      #{index + 1}
                    </div>
                    {card.cardImage && (
                      <img
                        src={card.cardImage}
                        alt={card.cardName}
                        className="w-20 h-28 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{card.cardName}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-blue-300">
                          {formatPrice(card.oldestPrice, card.currency)} → {formatPrice(card.latestPrice, card.currency)}
                        </span>
                        <span className="text-green-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          {formatPercentage(card.priceChange)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-blue-300">
                暫無數據，請稍後再試
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Searched */}
        <Card className="bg-blue-800/30 border-blue-700 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Search className="w-6 h-6" />
              熱門搜尋 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSearched ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 bg-blue-800" />
                ))}
              </div>
            ) : topSearched && topSearched.length > 0 ? (
              <div className="space-y-4">
                {topSearched.map((card, index) => (
                  <div
                    key={card.cardId}
                    className="flex items-center gap-4 p-4 bg-blue-900/50 rounded-lg hover:bg-blue-900/70 transition-colors"
                  >
                    <div className="text-3xl font-bold text-yellow-400 w-12">
                      #{index + 1}
                    </div>
                    {card.cardImage && (
                      <img
                        src={card.cardImage}
                        alt={card.cardName}
                        className="w-20 h-28 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{card.cardName}</h3>
                      <div className="flex items-center gap-2 mt-2 text-sm text-blue-300">
                        <Search className="w-4 h-4" />
                        <span>{card.searchCount} 次搜尋</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-blue-300">
                暫無數據，請稍後再試
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Volatile */}
        <Card className="bg-blue-800/30 border-blue-700 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Activity className="w-6 h-6" />
              價格波動 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVolatile ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 bg-blue-800" />
                ))}
              </div>
            ) : topVolatile && topVolatile.length > 0 ? (
              <div className="space-y-4">
                {topVolatile.map((card, index) => (
                  <div
                    key={card.cardId}
                    className="flex items-center gap-4 p-4 bg-blue-900/50 rounded-lg hover:bg-blue-900/70 transition-colors"
                  >
                    <div className="text-3xl font-bold text-yellow-400 w-12">
                      #{index + 1}
                    </div>
                    {card.cardImage && (
                      <img
                        src={card.cardImage}
                        alt={card.cardName}
                        className="w-20 h-28 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{card.cardName}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-blue-300">
                          最低: {formatPrice(card.minPrice, card.currency)}
                        </span>
                        <span className="text-blue-300">
                          最高: {formatPrice(card.maxPrice, card.currency)}
                        </span>
                        <span className="text-orange-400 font-bold flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          波動率: {formatPercentage(card.volatility)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-blue-300">
                暫無數據，請稍後再試
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Analysis (LLM Generated) */}
        <Card className="bg-yellow-400/10 border-yellow-400/30">
          <CardHeader>
            <CardTitle className="text-yellow-400">市場分析</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAnalysis ? (
              <div className="space-y-2">
                <Skeleton className="h-4 bg-blue-800" />
                <Skeleton className="h-4 bg-blue-800" />
                <Skeleton className="h-4 bg-blue-800" />
                <Skeleton className="h-4 bg-blue-800 w-3/4" />
              </div>
            ) : (
              <div className="text-blue-200 whitespace-pre-wrap leading-relaxed">
                {analysis || "正在生成市場分析..."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
