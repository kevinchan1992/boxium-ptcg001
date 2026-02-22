import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function AdminTrendingCards() {
  const { t } = useTranslation();
  const [isCalculating, setIsCalculating] = useState(false);

  // 查詢當前快取的熱門卡牌
  const { data: trendingCards = [], isLoading, refetch } = trpc.cards.getTrending.useQuery({ limit: 5 });

  // 手動觸發計算
  const calculateMutation = trpc.admin.calculateTrendingCards.useMutation({
    onSuccess: () => {
      toast.success(t("admin.trendingCards.calculateSuccess"));
      refetch(); // 重新載入數據
      setIsCalculating(false);
    },
    onError: (error) => {
      toast.error(`${t("admin.trendingCards.calculateError")}: ${error.message}`);
      setIsCalculating(false);
    },
  });

  const handleCalculate = () => {
    setIsCalculating(true);
    calculateMutation.mutate();
  };

  // 計算下次更新時間（每日 06:00 HKT）
  const getNextUpdateTime = () => {
    const now = new Date();
    const hktOffset = 8 * 60; // HKT is UTC+8
    const nowHKT = new Date(now.getTime() + (hktOffset - now.getTimezoneOffset()) * 60000);
    
    let nextUpdate = new Date(nowHKT);
    nextUpdate.setHours(6, 0, 0, 0);
    
    // 如果現在已經過了今天的 06:00，則設定為明天
    if (nowHKT.getHours() >= 6) {
      nextUpdate.setDate(nextUpdate.getDate() + 1);
    }
    
    return nextUpdate.toLocaleString('zh-TW', { 
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                {t("admin.trendingCards.title")}
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs sm:text-sm">
                {t("admin.trendingCards.description")}
              </CardDescription>
            </div>
            <Button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isCalculating ? 'animate-spin' : ''}`} />
              {isCalculating ? t("admin.trendingCards.calculating") : t("admin.trendingCards.recalculate")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 時間資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm text-gray-400">{t("admin.trendingCards.nextUpdate")}</p>
              <p className="text-base sm:text-lg font-semibold text-white">{getNextUpdateTime()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">{t("admin.trendingCards.updateFrequency")}</p>
              <p className="text-base sm:text-lg font-semibold text-white">{t("admin.trendingCards.daily6am")}</p>
            </div>
          </div>

          {/* TOP 5 卡牌列表 */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{t("admin.trendingCards.currentTop5")}</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">
                {t("common.loading")}
              </div>
            ) : trendingCards.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {t("admin.trendingCards.noData")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {trendingCards.map((card, index) => (
                  <Card key={card.id} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4 space-y-2">
                      {/* 排名標籤 */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-500">
                          #{index + 1}
                        </span>
                        <span className={`text-sm font-bold ${
                          (card.priceChange || 0) > 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {card.priceChangeFormatted}
                        </span>
                      </div>
                      
                      {/* 卡牌圖片 */}
                      <div className="aspect-[2.5/3.5] relative overflow-hidden rounded-lg bg-gray-700">
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.name ?? ""}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                            {t("common.noImage")}
                          </div>
                        )}
                      </div>
                      
                      {/* 卡牌名稱 */}
                      <div>
                        <p className="text-sm font-medium text-white line-clamp-2">
                          {card.name}
                        </p>
                        <p className="text-base sm:text-lg font-bold text-orange-500">
                          HK${card.currentPrice?.toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
