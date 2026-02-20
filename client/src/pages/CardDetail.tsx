import { useState } from "react";
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


const grades = ["PSA 10", "BGS 10", "中古"];

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

  // Check if card is favorited
  const { data: favoriteStatus } = trpc.favorites.isFavorited.useQuery(
    { cardId: cardId! },
    { enabled: !!cardId, retry: false }
  );

  const utils = trpc.useUtils();

  // Add to favorites mutation
  const addFavoriteMutation = trpc.favorites.add.useMutation({
    onSuccess: () => {
      utils.favorites.isFavorited.invalidate({ cardId: cardId! });
      toast.success(t("cardDetail.favorited"));
    },
    onError: () => {
      toast.error(t("common.login"));
    },
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = trpc.favorites.remove.useMutation({
    onSuccess: () => {
      utils.favorites.isFavorited.invalidate({ cardId: cardId! });
      toast.success(t("cardDetail.favorite"));
    },
    onError: () => {
      toast.error(t("cardDetail.noData"));
    },
  });

  const handleToggleFavorite = () => {
    if (!cardId) return;

    if (favoriteStatus?.isFavorited) {
      removeFavoriteMutation.mutate({ cardId });
    } else {
      addFavoriteMutation.mutate({ cardId });
    }
  };

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
  // 方案 C: 混合計算邏輯
  // 1. 優先使用最新 5 筆 PSA 10 交易的平均值
  // 2. 如果不足 5 筆，使用近 30 天 PSA 10 交易的加權平均
  // 3. 如果 30 天內數據不足，才使用所有 PSA 10 歷史數據
  const psa10OnlyHistory = priceHistory.filter(p => p.grade === "PSA 10" || p.grade === "PSA10" || p.grade === "PSA 10");
  
  const calculatePSA10ReferencePrice = () => {
    if (activeSource === "snkrdunk") {
      if (psa10OnlyHistory.length === 0) return "N/A";
      
      // Sort by soldAt date (newest first)
      const sortedHistory = [...psa10OnlyHistory].sort((a, b) => {
        const dateA = a.soldAt ? new Date(a.soldAt).getTime() : 0;
        const dateB = b.soldAt ? new Date(b.soldAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // 策略 1: 如果有 5 筆或以上，使用最新 5 筆的平均值
      if (sortedHistory.length >= 5) {
        const latest5 = sortedHistory.slice(0, 5);
        const avg = latest5.reduce((sum, p) => sum + parseFloat(p.price), 0) / latest5.length;
        return avg.toFixed(2);
      }
      
      // 策略 2: 如果不足 5 筆，檢查近 30 天的數據
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recent30Days = sortedHistory.filter(p => {
        if (!p.soldAt) return false;
        return new Date(p.soldAt) >= thirtyDaysAgo;
      });
      
      if (recent30Days.length >= 2) {
        // 使用加權平均：越新的交易權重越高
        let weightedSum = 0;
        let totalWeight = 0;
        recent30Days.forEach((p, index) => {
          const weight = recent30Days.length - index; // 最新的權重最高
          weightedSum += parseFloat(p.price) * weight;
          totalWeight += weight;
        });
        const weightedAvg = weightedSum / totalWeight;
        return weightedAvg.toFixed(2);
      }
      
      // 策略 3: 數據不足，使用所有 PSA 10 歷史數據的平均值
      const avg = sortedHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / sortedHistory.length;
      return avg.toFixed(2);
    } else {
      // eBay 邏輯保持不變
      if (ebayPriceHistory.length > 0) {
        return (ebayPriceHistory.reduce((sum, p) => sum + parseFloat(p.price), 0) / ebayPriceHistory.length).toFixed(2);
      } else if (ebaySoldItems.length > 0) {
        return (ebaySoldItems.reduce((sum, item) => sum + item.price, 0) / ebaySoldItems.length).toFixed(2);
      }
      return "N/A";
    }
  };
  
  const avgPrice = calculatePSA10ReferencePrice();

  // Get record count based on active source - Only PSA 10 for reference price
  // Show count of latest 5 records used for price calculation
  const recordCount = activeSource === "snkrdunk" 
    ? Math.min(psa10OnlyHistory.length, 5)
    : ebayPriceHistory.length > 0 
      ? ebayPriceHistory.length
      : ebaySoldItems.length;

  // Calculate price trend (7-day comparison) - Only use SNKRDUNK data
  const calculatePriceTrend = () => {
    if (activeSource !== "snkrdunk" || psa10OnlyHistory.length < 2) {
      return null;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get recent 7 days data
    const recent7Days = psa10OnlyHistory.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= sevenDaysAgo && soldDate <= now;
    });

    // Get previous 7 days data (7-14 days ago)
    const previous7Days = psa10OnlyHistory.filter(p => {
      if (!p.soldAt) return false;
      const soldDate = new Date(p.soldAt);
      return soldDate >= fourteenDaysAgo && soldDate < sevenDaysAgo;
    });

    if (recent7Days.length === 0 || previous7Days.length === 0) {
      return null;
    }

    const recentAvg = recent7Days.reduce((sum, p) => sum + parseFloat(p.price), 0) / recent7Days.length;
    const previousAvg = previous7Days.reduce((sum, p) => sum + parseFloat(p.price), 0) / previous7Days.length;
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
              variant={favoriteStatus?.isFavorited ? "default" : "outline"}
              size="sm"
              onClick={handleToggleFavorite}
              disabled={addFavoriteMutation.isPending || removeFavoriteMutation.isPending}
            >
              <Heart
                className={`h-4 w-4 mr-2 ${favoriteStatus?.isFavorited ? "fill-current" : ""}`}
              />
              {favoriteStatus?.isFavorited ? t("cardDetail.favorited") : t("cardDetail.favorite")}
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
            {/* Source and Grade Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={activeSource === "snkrdunk" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("snkrdunk")}
              >
                SNKRDUNK {t("cardDetail.actualPrice")}
              </Button>
              <Button
                variant={activeSource === "ebay" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveSource("ebay")}
              >
                eBay {t("cardDetail.marketPrice")}
              </Button>
              <div className="w-px h-8 bg-border mx-2" />
              {grades.map((grade) => (
                <Button
                  key={grade}
                  variant={activeGrade === grade ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                >
                  {grade}
                </Button>
              ))}
            </div>

            {/* Reference Price */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">
                  PSA 10 {t("cardDetail.referencePrice")}: {formatCurrency(avgPrice)}
                </h2>
                {priceTrend && (
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
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
              <p className="text-sm text-muted-foreground mt-2">
                {t("cardDetail.basedOnRecords", { count: recordCount })}
                {priceTrend && (
                  <span className="ml-2">· {t("cardDetail.priceTrend")}</span>
                )}
              </p>
            </div>

            {/* Price History Table - Vertical Scroll */}
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">
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
                <div className="overflow-y-auto max-h-96 scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">
                          {t("cardDetail.date")}
                        </th>
                        <th className="text-center py-3 px-4 text-muted-foreground font-medium text-sm w-24">
                          {t("cardDetail.grade")}
                        </th>
                        <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">
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
                            <td className="py-3 px-4 text-muted-foreground text-sm">
                              {item.soldAt ? formatShortDateTime(item.soldAt) : "N/A"}
                            </td>
                            <td className="py-3 px-4 text-center text-foreground text-sm w-24">
                              {isUngraded ? (
                                <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                  {t("cardDetail.usedGrade")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center font-medium">{displayGrade}</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-primary text-sm">
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
