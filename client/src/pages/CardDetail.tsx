import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";

import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { ExternalLink, Loader2, AlertCircle, ChevronLeft, ChevronRight, Heart, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { ShareButton } from "@/components/ShareButton";
import { useTranslation } from "react-i18next";

import { formatCurrency, formatPriceChange } from "@/lib/formatCurrency";
import { formatShortDateTime, formatDate, formatDateTime } from "@/lib/formatDate";


const grades = ["PSA 10", "中古"];

export default function CardDetail() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/card/:id");
  const [activeSource, setActiveSource] = useState<"snkrdunk" | "ebay">("snkrdunk");
  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  const cardId = params?.id ? parseInt(params.id, 10) : null;

  // Fetch card details
  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId, retry: 1 }
  );

  // Get current user
  const { data: user } = trpc.auth.me.useQuery();

  // Check if card is in watchlist
  const { data: watchlistStatus, refetch: refetchWatchlistStatus } = trpc.profile.isInWatchlist.useQuery(
    { cardId: cardId! },
    { enabled: !!cardId && !!user, retry: 1 }
  );

  // Add to watchlist mutation
  const addToWatchlist = trpc.profile.addToWatchlist.useMutation({
    onSuccess: () => {
      toast.success("已加入收藏");
      refetchWatchlistStatus();
    },
    onError: (error) => {
      if (error.message.includes("already in watchlist")) {
        toast.error("此卡牌已在收藏列表中");
      } else {
        toast.error("加入收藏失敗：" + error.message);
      }
    },
  });

  // Remove from watchlist mutation
  const removeFromWatchlist = trpc.profile.removeFromWatchlistByCardId.useMutation({
    onSuccess: () => {
      toast.success("已從收藏中移除");
      refetchWatchlistStatus();
    },
    onError: (error) => {
      toast.error("移除收藏失敗：" + error.message);
    },
  });

  // Handle watchlist toggle (add or remove)
  const handleWatchlistToggle = () => {
    if (!user) {
      toast.error("請先登入才能使用收藏功能");
      setLocation("/login");
      return;
    }
    
    if (watchlistStatus?.isInWatchlist) {
      // Remove from watchlist
      removeFromWatchlist.mutate({ cardId: cardId! });
    } else {
      // Add to watchlist
      addToWatchlist.mutate({ cardId: cardId! });
    }
  };

  // Add view history mutation
  const addViewHistory = trpc.profile.addViewHistory.useMutation();

  // Auto-record view history when user visits card detail page
  useEffect(() => {
    if (user && cardId) {
      addViewHistory.mutate({ cardId });
    }
  }, [user, cardId]);

  // Fetch price history from SNKRDUNK
  const normalizeGrade = (grade: string | null) => {
    if (!grade) return undefined;
    // Handle special case for "中古" which should match A, B, C, D grades
    if (grade === "中古") return "中古";
    return grade.replace(/\s+/g, '');
  };

  const { data: priceHistory = [], isLoading: priceLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "snkrdunk",
      grade: normalizeGrade(activeGrade),
      limit: 50,
    },
    { enabled: !!cardId && activeSource === "snkrdunk", retry: 1 }
  );

  // 動態時間範圍調整：2個月 → 3個月 → 6個月
  const [timeRangeDays, setTimeRangeDays] = useState(60); // 預設 2 個月
  const [actualMonths, setActualMonths] = useState(2); // 實際使用的月份數

  // 當 cardId 變化時，重置時間範圍為初始值
  useEffect(() => {
    setTimeRangeDays(60);
    setActualMonths(2);
  }, [cardId]);

  // 獨立查詢 PSA 10 價格歷史用於計算參考價格
  const { data: psa10PriceHistory = [], isLoading: psa10Loading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "snkrdunk",
      grade: "PSA10",
      limit: 10,
      days: timeRangeDays,
    },
    { enabled: !!cardId, retry: 1 }
  );

  // 動態調整時間範圍：根據記錄數量動態調整
  useEffect(() => {
    // 等待數據載入完成後才進行調整
    if (psa10Loading) return;
    
    const recordCount = psa10PriceHistory.length;
    
    // 如果當前時間範圍內有足夠數據，不需要擴展
    if (recordCount >= 3) {
      // 根據當前 timeRangeDays 設置 actualMonths
      if (timeRangeDays === 60) {
        setActualMonths(2);
      } else if (timeRangeDays === 90) {
        setActualMonths(3);
      } else if (timeRangeDays === 180) {
        setActualMonths(6);
      }
    } else {
      // 記錄不足 3 筆，需要擴展時間範圍
      if (timeRangeDays === 60) {
        // 2個月不足，擴展到3個月
        setTimeRangeDays(90);
        setActualMonths(3);
      } else if (timeRangeDays === 90) {
        // 3個月不足，擴展到6個月
        setTimeRangeDays(180);
        setActualMonths(6);
      } else if (timeRangeDays === 180) {
        // 6個月仍不足 3 筆，維持 6 個月
        setActualMonths(6);
      }
    }
  }, [psa10PriceHistory.length, timeRangeDays, psa10Loading]);

  // Fetch eBay price history from database (PSA10 only) - 優先從資料庫載入緩存數據
  const { data: ebayPriceHistory = [], isLoading: ebayHistoryLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "ebay",
      grade: "PSA 10",
      limit: 50,
    },
    { enabled: !!cardId && activeSource === "ebay", retry: 1 }
  );

  // Fetch eBay sold items (PSA10 only) - 備用，當資料庫無數據時使用
  const { data: ebaySoldItems = [], isLoading: ebayLoading } = trpc.cards.getEbaySoldItems.useQuery(
    { cardId: cardId!, limit: 20 },
    { enabled: !!cardId && activeSource === "ebay" && ebayPriceHistory.length === 0, retry: 1 }
  );

  // Fetch eBay Browse API market price (active listings) - 備用，當資料庫無數據且 API 也無數據時使用
  const { data: ebayMarketPrice = [], isLoading: ebayMarketLoading } = trpc.cards.searchEbayMarketPrice.useQuery(
    { 
      cardName: card?.name || "",
      cardNumber: card?.cardNumber || undefined,
      limit: 10 
    },
    { enabled: !!card && activeSource === "ebay" && ebayPriceHistory.length === 0 && ebaySoldItems.length === 0, retry: 1 }
  );

  // Fetch current USD to HKD exchange rate
  const { data: exchangeRate } = trpc.cards.getExchangeRate.useQuery(
    undefined,
    { enabled: activeSource === "ebay", retry: 1 }
  );

  // Fetch price trend data (days: 0 means all data)
  const { data: priceTrendData, isLoading: trendLoading } = trpc.cards.getPriceTrendData.useQuery(
    { cardId: cardId!, days: 0 },
    { enabled: !!cardId, retry: 1 }
  );

  if (!cardId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t("cardDetail.noData")}</p>
        </div>
      </div>
    );
  }

  if (cardLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t("cardDetail.noData")}</p>
        </div>
      </div>
    );
  }

  // Calculate average price based on active source - Only PSA 10 for reference price
  // 新邏輯: 使用最近 10 筆 PSA 10 成交記錄的平均值（根據 knowledge base 建議）
  const calculatePSA10ReferencePrice = () => {
    if (activeSource === "snkrdunk") {
      // 使用獨立查詢的 PSA 10 價格歷史（最近 10 筆）
      if (psa10PriceHistory.length === 0) return "N/A";
      
      // 計算最近 10 筆 PSA 10 記錄的平均值
      const avg = psa10PriceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / psa10PriceHistory.length;
      return avg.toFixed(2);
    } else {
      // eBay 邏輯：使用最近 10 筆記錄
      if (ebayPriceHistory.length > 0) {
        const recentEbay = ebayPriceHistory.slice(0, 10);
        return (recentEbay.reduce((sum, p) => sum + parseFloat(p.price), 0) / recentEbay.length).toFixed(2);
      } else if (ebaySoldItems.length > 0) {
        const recentEbay = ebaySoldItems.slice(0, 10);
        return (recentEbay.reduce((sum, item) => sum + item.price, 0) / recentEbay.length).toFixed(2);
      }
      return "N/A";
    }
  };
  
  const avgPrice = calculatePSA10ReferencePrice();

  // Get record count based on active source - Only PSA 10 for reference price
  // Show count of records used for price calculation (latest 10 records)
  const recordCount = activeSource === "snkrdunk" 
    ? psa10PriceHistory.length
    : ebayPriceHistory.length > 0 
      ? Math.min(ebayPriceHistory.length, 10)
      : Math.min(ebaySoldItems.length, 10);

  // Calculate price trend (7-day comparison) - Only use SNKRDUNK data
  const calculatePriceTrend = () => {
    if (activeSource !== "snkrdunk" || psa10PriceHistory.length < 2) {
      return null;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get recent 7 days data
    const recent7Days = psa10PriceHistory.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= sevenDaysAgo && soldDate <= now;
    });

    // Get previous 7 days data (7-14 days ago)
    const previous7Days = psa10PriceHistory.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= fourteenDaysAgo && soldDate < sevenDaysAgo;
    });

    if (recent7Days.length === 0 || previous7Days.length === 0) {
      return null;
    }

    const recentAvg = recent7Days.reduce((sum: number, p: any) => sum + parseFloat(p.price), 0) / recent7Days.length;
    const previousAvg = previous7Days.reduce((sum: number, p: any) => sum + parseFloat(p.price), 0) / previous7Days.length;
    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;

    return {
      change: changePercent,
      isIncrease: changePercent > 0,
      isDecrease: changePercent < 0
    };
  };

  const priceTrend = calculatePriceTrend();

  // Group prices by grade
  const pricesByGrade: Record<string, typeof priceHistory> = {};
  priceHistory.forEach((p) => {
    const grade = p.grade || "中古";
    if (!pricesByGrade[grade]) {
      pricesByGrade[grade] = [];
    }
    pricesByGrade[grade].push(p);
  });

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: t("common.home"), href: "/" },
            { label: t("common.research"), href: "/research" },
            { label: card.name }
          ]}
        />
        
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-base sm:text-xl font-bold text-foreground mb-1">
            {card.name}
          </h1>
          {card.nameJa && (
            <p className="text-sm sm:text-base text-muted-foreground mb-2">{card.nameJa}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <BrandButton 
              size="sm" 
              onClick={() => setLocation(`/pricing/${card.id}`)}
            >
              {t("cardDetail.comparePrice")}
            </BrandButton>
            <Button
              size="sm"
              variant={watchlistStatus?.isInWatchlist ? "default" : "outline"}
              onClick={handleWatchlistToggle}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
              className={watchlistStatus?.isInWatchlist ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Heart className={`w-4 h-4 mr-1 ${watchlistStatus?.isInWatchlist ? "fill-current" : ""}`} />
              {watchlistStatus?.isInWatchlist ? "從收藏中移除" : "加入收藏"}
            </Button>
            <ShareButton cardName={card.name} cardId={cardId!} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Card Image */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full rounded-lg shadow-2xl hover:scale-105 transition-transform duration-300"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">{t("home.noImage")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Card Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Source and Grade Filters - 手機版優化 */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
              <Button
                variant={activeSource === "snkrdunk" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("snkrdunk")}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[36px] whitespace-nowrap"
              >
                SNKRDUNK {t("cardDetail.actualPrice")}
              </Button>
              <Button
                variant={activeSource === "ebay" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("ebay")}
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[36px] whitespace-nowrap"
              >
                eBay {t("cardDetail.marketPrice")}
              </Button>
              <div className="w-px h-6 sm:h-8 bg-border mx-1 sm:mx-2" />
              {grades.map((grade) => (
                <Button
                  key={grade}
                  variant={activeGrade === grade ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                  className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[36px] whitespace-nowrap"
                >
                  {grade}
                </Button>
              ))}
            </div>

            {/* Reference Price */}
            <div className="bg-card rounded-lg p-3 sm:p-4 md:p-6 border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-foreground break-words">
                  PSA 10 {t("cardDetail.referencePrice")}: {formatCurrency(avgPrice)}
                </h2>
                {priceTrend && (
                  <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-semibold whitespace-nowrap ${
                    priceTrend.isIncrease 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                      : priceTrend.isDecrease 
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    <span>
                      {priceTrend.isIncrease 
                        ? t("cardDetail.priceIncrease") 
                        : t("cardDetail.priceDecrease")}
                    </span>
                    <span>{Math.abs(priceTrend.change).toFixed(1)}%</span>
                  </div>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                {activeSource === "snkrdunk" 
                  ? t("cardDetail.basedOnLatestRecords", { count: recordCount, months: actualMonths })
                  : t("cardDetail.basedOnRecords", { count: recordCount })}
                {priceTrend && (
                  <span className="ml-2">· {t("cardDetail.priceTrend")}</span>
                )}
              </p>
            </div>

            {/* Price History Table - Vertical Scroll */}
            <div className="bg-card rounded-lg p-3 sm:p-4 md:p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">
                  {activeSource === "snkrdunk" 
                    ? `SNKRDUNK ${t("cardDetail.actualPriceHistory")}` 
                    : `eBay ${t("cardDetail.marketPriceHistory")}`}
                </h3>
              </div>
              {activeSource === "ebay" && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    ℹ️ {t("cardDetail.ebayDisclaimer")}
                  </p>
                </div>
              )}
              {(activeSource === "snkrdunk" ? priceLoading : (ebayHistoryLoading || ebayLoading)) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : activeSource === "snkrdunk" && priceHistory.length > 0 ? (
                <div className="overflow-y-auto max-h-96 scrollbar-hide overflow-x-auto">
                  <table className="w-full min-w-[300px]">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm">
                          {t("cardDetail.date")}
                        </th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm w-16 sm:w-24">
                          {t("cardDetail.grade")}
                        </th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm">
                          {t("cardDetail.price")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {priceHistory.map((item, index) => {
                        // Determine display grade - show original grade (A, B, C, D) or badge for ungraded
                        const displayGrade = item.grade;
                        const isUngraded = !item.grade;
                        
                        return (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                              {item.soldAt ? formatShortDateTime(item.soldAt) : "N/A"}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-foreground text-xs sm:text-sm w-16 sm:w-24">
                              {isUngraded ? (
                                <span className="inline-flex items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 rounded-md bg-muted text-[10px] sm:text-xs font-medium whitespace-nowrap">
                                  {t("cardDetail.usedGrade")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center font-medium whitespace-nowrap text-xs sm:text-sm">{displayGrade}</span>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-semibold text-primary text-xs sm:text-sm">
                              {formatCurrency(item.price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : activeSource === "ebay" && ebayPriceHistory.length > 0 ? (
                <div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      📊 {t("cardDetail.cachedData")} {formatDateTime(ebayPriceHistory[0].createdAt)}
                    </p>
                  </div>
                  <div className="overflow-y-auto max-h-96 scrollbar-hide">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr>
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                            {t("cardDetail.date")}
                          </th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-32">
                            {t("cardDetail.hkdPrice")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ebayPriceHistory.map((record, index) => (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-foreground text-sm">
                              {record.listingUrl ? (
                                <a
                                  href={record.listingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-primary hover:underline flex items-center gap-2"
                                >
                                   {formatDate(record.soldAt || record.createdAt)}
                                   <ExternalLink className="w-3 h-3" />
                                 </a>
                               ) : (
                                 formatDate(record.soldAt || record.createdAt)
                              )}
                            </td>
                            <td className="py-3 px-4 text-right text-foreground font-medium text-sm">
                              {formatCurrency(parseFloat(record.price), 'JPY')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeSource === "ebay" && ebaySoldItems.length > 0 ? (
                <div className="overflow-y-auto max-h-96 scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                          {t("cardDetail.title")}
                        </th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium text-sm w-32">
                          {t("cardDetail.date")}
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-24">
                          {t("cardDetail.price")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ebaySoldItems.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-foreground text-sm">
                            <a
                              href={item.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline flex items-center gap-2"
                            >
                              {item.title}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground text-sm w-32">
                            {formatDate(item.soldDate)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
                            {formatCurrency(item.price, item.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : activeSource === "ebay" && ebayMarketPrice.length > 0 ? (
                <div>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      📊 {t("cardDetail.liveMarketData")}
                      {exchangeRate && (
                        <span className="ml-1">
                          {t("cardDetail.exchangeRate")}: 1 USD = {exchangeRate.rate.toFixed(4)} HKD
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="overflow-y-auto max-h-96 scrollbar-hide">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                          {t("cardDetail.productTitle")}
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-28">
                          {t("cardDetail.usdPrice")}
                        </th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm w-28">
                            {t("cardDetail.hkdPrice")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ebayMarketPrice.map((item, index) => (
                          <tr key={index} className="hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-4 text-foreground text-sm">
                              <a
                                href={item.itemWebUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary hover:underline flex items-center gap-2"
                              >
                                {item.title}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-muted-foreground text-sm">
                              {formatCurrency(parseFloat(item.price.value), 'USD')}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
                              {formatCurrency(item.priceHkd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {activeSource === "ebay" 
                    ? t("cardDetail.noEbayData") 
                    : t("cardDetail.noGradeData")}
                </p>
              )}
            </div>

            {/* Price Trend Chart */}
            <PriceTrendChart
              cardName={card.name}
              trendData={priceTrendData?.trendData || []}
              stats={priceTrendData?.stats || {
                snkrdunk: { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 },
                ebay: { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 }
              }}
              isLoading={trendLoading}
            />

            {/* Basic Information */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-xl font-semibold text-foreground mb-4">
                {t("cardDetail.basicInfo")}
              </h3>
              <dl className="space-y-3">
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.cardName")}:</dt>
                  <dd className="text-foreground">{card.name}</dd>
                </div>
                {card.nameJa && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">{t("cardDetail.japaneseName")}:</dt>
                    <dd className="text-foreground">{card.nameJa}</dd>
                  </div>
                )}
                {card.cardNumber && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">{t("cardDetail.cardNumber")}:</dt>
                    <dd className="text-foreground">{card.cardNumber}</dd>
                  </div>
                )}
                {card.series && (
                  <div className="flex">
                    <dt className="text-muted-foreground w-32">{t("cardDetail.series")}:</dt>
                    <dd className="text-foreground">{card.series}</dd>
                  </div>
                )}

              </dl>
            </div>
          </div>
        </div>
      

    </div>
  );
}
