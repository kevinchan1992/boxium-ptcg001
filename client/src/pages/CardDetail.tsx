import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";

import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Loader2, AlertCircle, Heart, Package, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { ShareButton } from "@/components/ShareButton";
import { useTranslation } from "react-i18next";

import { formatCurrency } from "@/lib/formatCurrency";
import { formatDate } from "@/lib/formatDate";

const grades = ["PSA 10", "中古"];

interface CardDetailProps {
  sealedProductId?: number;
}

export default function CardDetail({ sealedProductId }: CardDetailProps = {}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/card/:id");
  const [, sealedParams] = useRoute("/sealed-product/:id");
  const [activeGrade, setActiveGrade] = useState<string | null>(null);

  // Resolve cardId from: direct prop > /sealed-product/:id > /card/:id
  const cardId = sealedProductId ??
    (sealedParams?.id ? parseInt(sealedParams.id, 10) : null) ??
    (params?.id ? parseInt(params.id, 10) : null);

  // Determine productType from URL path, prop, or auto-detect
  const [productType, setProductType] = useState<'single_card' | 'sealed_product' | undefined>(
    sealedProductId || sealedParams?.id ? 'sealed_product' : undefined
  );

  // Try to detect productType from URL query params or path
  useEffect(() => {
    if (sealedProductId || sealedParams?.id) {
      setProductType('sealed_product');
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');
    if (type === 'sealed_product' || type === 'single_card') {
      setProductType(type);
    } else {
      setProductType(undefined); // Will auto-detect
    }
  }, [cardId, sealedProductId, sealedParams?.id]);

  // Fetch card details - try cards table first (existing behavior for backward compatibility)
  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId && productType !== 'sealed_product', retry: 1 }
  );

  // Fetch sealed product details if productType is sealed_product or card not found
  const { data: sealedProduct, isLoading: sealedLoading } = trpc.products.getById.useQuery(
    { id: cardId!, productType: 'sealed_product' },
    { enabled: !!cardId && (productType === 'sealed_product' || (!cardLoading && !card && productType === undefined)), retry: 1 }
  );

  // Determine the actual product to display
  const isSealedProduct = productType === 'sealed_product' || (!card && !!sealedProduct);
  const product = isSealedProduct ? sealedProduct : card;
  const isLoading = cardLoading || (productType === 'sealed_product' && sealedLoading);

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
      removeFromWatchlist.mutate({ cardId: cardId! });
    } else {
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

  // ─── On-demand price refresh (triggered when user views card) ───
  const utils = trpc.useUtils();
  const triggerRefresh = trpc.cards.triggerPriceRefresh.useMutation({
    onSuccess: (result) => {
      if (result.status === 'success' && result.recordsAdded > 0) {
        // Invalidate price-related queries so UI refreshes with new data
        utils.prices.getHistory.invalidate({ cardId: cardId! });
        utils.prices.getStatistics.invalidate({ cardId: cardId! });
        utils.cards.getPriceTrendData.invalidate({ cardId: cardId! });
        utils.products.getPriceHistory.invalidate();
      }
    },
  });

  // Auto-trigger price refresh when card detail page loads (both single cards and sealed products)
  const [refreshTriggered, setRefreshTriggered] = useState(false);
  useEffect(() => {
    if (cardId && product && !refreshTriggered) {
      setRefreshTriggered(true);
      triggerRefresh.mutate({
        cardId,
        productType: isSealedProduct ? 'sealed_product' : 'single_card',
      });
    }
  }, [cardId, product, refreshTriggered, isSealedProduct]);

  // Reset trigger when cardId changes
  useEffect(() => {
    setRefreshTriggered(false);
  }, [cardId]);

  // Fetch price history from SNKRDUNK
  const normalizeGrade = (grade: string | null) => {
    if (!grade) return undefined;
    if (grade === "中古") return "中古";
    return grade.replace(/\s+/g, '');
  };

  // For single cards: use existing price history API
  const { data: priceHistory = [], isLoading: priceLoading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "snkrdunk",
      grade: normalizeGrade(activeGrade),
      limit: 50,
    },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  // For sealed products: use products price history API
  const { data: sealedPriceHistory = [], isLoading: sealedPriceLoading } = trpc.products.getPriceHistory.useQuery(
    {
      productId: cardId!,
      productType: 'sealed_product',
      source: "snkrdunk",
      limit: 50,
    },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  // Use the appropriate price history
  const activePriceHistory = isSealedProduct ? sealedPriceHistory : priceHistory;
  const activePriceLoading = isSealedProduct ? sealedPriceLoading : priceLoading;

  // 動態時間範圍調整：2個月 → 3個月 → 6個月
  const [timeRangeDays, setTimeRangeDays] = useState(60);
  const [actualMonths, setActualMonths] = useState(2);

  useEffect(() => {
    setTimeRangeDays(60);
    setActualMonths(2);
  }, [cardId]);

  // 獨立查詢 PSA 10 價格歷史用於計算參考價格 (single cards only)
  const { data: psa10PriceHistory = [], isLoading: psa10Loading } = trpc.prices.getHistory.useQuery(
    {
      cardId: cardId!,
      source: "snkrdunk",
      grade: "PSA10",
      limit: 10,
      days: timeRangeDays,
    },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  // For sealed products: get recent price history for reference price
  const { data: sealedRecentPrices = [], isLoading: sealedRecentLoading } = trpc.products.getPriceHistory.useQuery(
    {
      productId: cardId!,
      productType: 'sealed_product',
      source: "snkrdunk",
      limit: 10,
      days: timeRangeDays,
    },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  const activeRecentPrices = isSealedProduct ? sealedRecentPrices : psa10PriceHistory;
  const activeRecentLoading = isSealedProduct ? sealedRecentLoading : psa10Loading;

  // 動態調整時間範圍
  useEffect(() => {
    if (activeRecentLoading) return;
    
    const recordCount = activeRecentPrices.length;
    
    if (recordCount >= 3) {
      if (timeRangeDays === 60) setActualMonths(2);
      else if (timeRangeDays === 90) setActualMonths(3);
      else if (timeRangeDays === 180) setActualMonths(6);
    } else {
      if (timeRangeDays === 60) {
        setTimeRangeDays(90);
        setActualMonths(3);
      } else if (timeRangeDays === 90) {
        setTimeRangeDays(180);
        setActualMonths(6);
      } else if (timeRangeDays === 180) {
        setActualMonths(6);
      }
    }
  }, [activeRecentPrices.length, timeRangeDays, activeRecentLoading]);

  // Fetch price trend data
  // For single cards: use existing API
  const { data: priceTrendData, isLoading: trendLoading } = trpc.cards.getPriceTrendData.useQuery(
    { cardId: cardId!, days: 0 },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  // For sealed products: use products API
  const { data: sealedTrendData, isLoading: sealedTrendLoading } = trpc.products.getPriceTrendData.useQuery(
    { productId: cardId!, productType: 'sealed_product', days: 0 },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  const activeTrendData = isSealedProduct ? sealedTrendData : priceTrendData;
  const activeTrendLoading = isSealedProduct ? sealedTrendLoading : trendLoading;

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t("cardDetail.noData")}</p>
        </div>
      </div>
    );
  }

  // Calculate reference price
  // For sealed products: latest transaction price ÷ quantity (reflects per-unit value)
  // For single cards: average of recent PSA 10 transactions (unchanged)
  const calculateReferencePrice = () => {
    if (activeRecentPrices.length === 0) return "N/A";
    
    if (isSealedProduct) {
      // Sealed product: use latest transaction price ÷ quantity
      const latest = activeRecentPrices[0]; // Already sorted by date desc
      const price = parseFloat(latest.price);
      // Extract numeric quantity from strings like "3個", "10個", "1個"
      const qtyStr = latest.quantity || '1';
      const qtyMatch = qtyStr.match(/(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      return (price / Math.max(qty, 1)).toFixed(2);
    } else {
      // Single card: average of recent PSA 10 transactions (unchanged)
      const avg = activeRecentPrices.reduce((sum: number, p: any) => sum + parseFloat(p.price), 0) / activeRecentPrices.length;
      return avg.toFixed(2);
    }
  };
  
  const avgPrice = calculateReferencePrice();
  const recordCount = activeRecentPrices.length;

  // Calculate price trend (7-day comparison)
  const calculatePriceTrend = () => {
    if (activeRecentPrices.length < 2) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recent7Days = activeRecentPrices.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= sevenDaysAgo && soldDate <= now;
    });

    const previous7Days = activeRecentPrices.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= fourteenDaysAgo && soldDate < sevenDaysAgo;
    });

    if (recent7Days.length === 0 || previous7Days.length === 0) return null;

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

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
      {/* Breadcrumb */}
      <Breadcrumb 
        items={[
          { label: t("common.home"), href: "/" },
          { label: t("common.research"), href: "/research" },
          { label: product.name }
        ]}
      />
      
      {/* Header */}
      <div className="mb-4">
        {/* Product Type Badge */}
        {isSealedProduct && (
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {t("cardDetail.boosterBox")}
            </span>
          </div>
        )}
        <h1 className="text-base sm:text-xl font-bold text-foreground mb-1">
          {product.name}
        </h1>
        {product.nameJa && (
          <p className="text-sm sm:text-base text-muted-foreground mb-2">{product.nameJa}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <BrandButton 
            size="sm" 
            onClick={() => setLocation(`/pricing/${product.id}${isSealedProduct ? '?type=sealed_product' : ''}`)}
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
          <ShareButton cardName={product.name} cardId={cardId!} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Product Image */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
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

        {/* Right Column - Product Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grade Filters - only for single cards */}
          {!isSealedProduct && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
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
          )}

          {/* Reference Price */}
          <div className="bg-card rounded-lg p-3 sm:p-4 md:p-6 border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-foreground break-words">
                {isSealedProduct ? (
                  <>{t("cardDetail.sealedReferencePrice")}: {formatCurrency(avgPrice)}</>
                ) : (
                  <>PSA 10 {t("cardDetail.referencePrice")}: {formatCurrency(avgPrice)}</>
                )}
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
              {isSealedProduct ? (
                t("cardDetail.basedOnLatestSealedRecords", { count: recordCount, months: actualMonths })
              ) : (
                t("cardDetail.basedOnLatestRecords", { count: recordCount, months: actualMonths })
              )}
              {priceTrend && (
                <span className="ml-2">· {t("cardDetail.priceTrend")}</span>
              )}
            </p>
            {/* Price Refresh Status Indicator */}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {triggerRefresh.isPending ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                  <span>{t("cardDetail.priceUpdating", "正在更新最新成交價格...")}</span>
                </>
              ) : triggerRefresh.data?.status === 'success' && triggerRefresh.data.recordsAdded > 0 ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span>{t("cardDetail.priceUpdated", "價格已更新")}</span>
                </>
              ) : triggerRefresh.data?.status === 'cooldown' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>{t("cardDetail.priceUpToDate", "價格已是最新")}</span>
                </>
              ) : triggerRefresh.data?.status === 'success' && triggerRefresh.data.recordsAdded === 0 ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>{t("cardDetail.priceUpToDate", "價格已是最新")}</span>
                </>
              ) : triggerRefresh.data?.status === 'no_source' ? (
                null
              ) : triggerRefresh.data?.status === 'error' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{t("cardDetail.priceUpdateFailed", "價格更新失敗")}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* Price History Table */}
          <div className="bg-card rounded-lg p-3 sm:p-4 md:p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-foreground">
                SNKRDUNK {t("cardDetail.actualPriceHistory")}
              </h3>
            </div>
            {activePriceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activePriceHistory.length > 0 ? (
              <div className="overflow-y-auto max-h-96 scrollbar-hide overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-full sm:min-w-[300px]">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr>
                      <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm">
                        {t("cardDetail.date")}
                      </th>
                      <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm w-16 sm:w-24">
                        {/* Show "數量" for sealed products, "評級" for single cards */}
                        {isSealedProduct ? t("cardDetail.quantity") : t("cardDetail.grade")}
                      </th>
                      <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground font-medium text-xs sm:text-sm">
                        {t("cardDetail.price")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activePriceHistory.map((item, index) => {
                      // For sealed products: show quantity (e.g., "10盒", "1盒")
                      // For single cards: show grade (e.g., "PSA 10", "中古")
                      const displayValue = isSealedProduct ? (item.quantity || '-') : (item.quantity || item.grade);
                      const isEmpty = !displayValue;
                      
                      return (
                        <tr key={index} className="hover:bg-muted/50 transition-colors">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-muted-foreground text-xs sm:text-sm">
                            {item.soldAt ? formatDate(item.soldAt) : "N/A"}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-foreground text-xs sm:text-sm w-16 sm:w-24">
                            {isEmpty ? (
                              <span className="inline-flex items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 rounded-md bg-muted text-[10px] sm:text-xs font-medium whitespace-nowrap">
                                {isSealedProduct ? '-' : t("cardDetail.usedGrade")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center font-medium whitespace-nowrap text-xs sm:text-sm">{displayValue}</span>
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
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                {isSealedProduct ? t("cardDetail.noSealedData") : t("cardDetail.noGradeData")}
              </p>
            )}
          </div>

          {/* Price Trend Chart */}
          <PriceTrendChart
            cardName={product.name}
            trendData={activeTrendData?.trendData || []}
            stats={activeTrendData?.stats || {
              snkrdunk: { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 }
            }}
            isLoading={activeTrendLoading}
          />

          {/* Basic Information */}
          <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {t("cardDetail.basicInfo")}
            </h3>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="text-muted-foreground w-32">
                  {isSealedProduct ? t("cardDetail.productName") : t("cardDetail.cardName")}:
                </dt>
                <dd className="text-foreground">{product.name}</dd>
              </div>
              {product.nameJa && (
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.japaneseName")}:</dt>
                  <dd className="text-foreground">{product.nameJa}</dd>
                </div>
              )}
              {isSealedProduct && (
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.boxType")}:</dt>
                  <dd className="text-foreground">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium">
                      <Package className="w-3.5 h-3.5" />
                      {t("cardDetail.boosterBox")}
                    </span>
                  </dd>
                </div>
              )}
              {isSealedProduct && 'styleCode' in product && product.styleCode && (
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.styleCode", "系列編號")}:</dt>
                  <dd className="text-foreground">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-mono">
                      {product.styleCode}
                    </span>
                  </dd>
                </div>
              )}
              {!isSealedProduct && 'cardNumber' in product && product.cardNumber && (
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.cardNumber")}:</dt>
                  <dd className="text-foreground">{product.cardNumber}</dd>
                </div>
              )}
              {product.series && (
                <div className="flex">
                  <dt className="text-muted-foreground w-32">{t("cardDetail.series")}:</dt>
                  <dd className="text-foreground">{product.series}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
