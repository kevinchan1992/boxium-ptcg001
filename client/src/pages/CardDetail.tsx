import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Loader2, AlertCircle, Heart, Package, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
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

  const cardId = sealedProductId ??
    (sealedParams?.id ? parseInt(sealedParams.id, 10) : null) ??
    (params?.id ? parseInt(params.id, 10) : null);

  const [productType, setProductType] = useState<'single_card' | 'sealed_product' | undefined>(
    sealedProductId || sealedParams?.id ? 'sealed_product' : undefined
  );

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
      setProductType(undefined);
    }
  }, [cardId, sealedProductId, sealedParams?.id]);

  const { data: card, isLoading: cardLoading, error: cardError } = trpc.cards.getById.useQuery(
    { id: cardId! },
    { enabled: !!cardId && productType !== 'sealed_product', retry: 1 }
  );

  const { data: sealedProduct, isLoading: sealedLoading } = trpc.products.getById.useQuery(
    { id: cardId!, productType: 'sealed_product' },
    { enabled: !!cardId && (productType === 'sealed_product' || (!cardLoading && !card && productType === undefined)), retry: 1 }
  );

  const isSealedProduct = productType === 'sealed_product' || (!card && !!sealedProduct);
  const product = isSealedProduct ? sealedProduct : card;
  const isLoading = cardLoading || (productType === 'sealed_product' && sealedLoading);

  const { data: user } = trpc.auth.me.useQuery();

  const { data: watchlistStatus, refetch: refetchWatchlistStatus } = trpc.profile.isInWatchlist.useQuery(
    { cardId: cardId! },
    { enabled: !!cardId && !!user, retry: 1 }
  );

  const addToWatchlist = trpc.profile.addToWatchlist.useMutation({
    onSuccess: () => { toast.success("已加入收藏"); refetchWatchlistStatus(); },
    onError: (error) => {
      if (error.message.includes("already in watchlist")) toast.error("此卡牌已在收藏列表中");
      else toast.error("加入收藏失敗：" + error.message);
    },
  });

  const removeFromWatchlist = trpc.profile.removeFromWatchlistByCardId.useMutation({
    onSuccess: () => { toast.success("已從收藏中移除"); refetchWatchlistStatus(); },
    onError: (error) => { toast.error("移除收藏失敗：" + error.message); },
  });

  const handleWatchlistToggle = () => {
    if (!user) { toast.error("請先登入才能使用收藏功能"); setLocation("/login"); return; }
    if (watchlistStatus?.isInWatchlist) removeFromWatchlist.mutate({ cardId: cardId! });
    else addToWatchlist.mutate({ cardId: cardId! });
  };

  const addViewHistory = trpc.profile.addViewHistory.useMutation();
  useEffect(() => {
    if (user && cardId) addViewHistory.mutate({ cardId });
  }, [user, cardId]);

  const utils = trpc.useUtils();
  const triggerRefresh = trpc.cards.triggerPriceRefresh.useMutation({
    onSuccess: (result) => {
      if (result.status === 'success' && result.recordsAdded > 0) {
        utils.prices.getHistory.invalidate({ cardId: cardId! });
        utils.prices.getStatistics.invalidate({ cardId: cardId! });
        utils.cards.getPriceTrendData.invalidate({ cardId: cardId! });
        utils.products.getPriceHistory.invalidate();
      }
    },
  });

  const [refreshTriggered, setRefreshTriggered] = useState(false);
  useEffect(() => {
    if (cardId && product && !refreshTriggered) {
      setRefreshTriggered(true);
      triggerRefresh.mutate({ cardId, productType: isSealedProduct ? 'sealed_product' : 'single_card' });
    }
  }, [cardId, product, refreshTriggered, isSealedProduct]);

  useEffect(() => { setRefreshTriggered(false); }, [cardId]);

  const normalizeGrade = (grade: string | null) => {
    if (!grade) return undefined;
    if (grade === "中古") return "中古";
    return grade.replace(/\s+/g, '');
  };

  const { data: priceHistory = [], isLoading: priceLoading } = trpc.prices.getHistory.useQuery(
    { cardId: cardId!, source: "snkrdunk", grade: normalizeGrade(activeGrade), limit: 50 },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  const { data: sealedPriceHistory = [], isLoading: sealedPriceLoading } = trpc.products.getPriceHistory.useQuery(
    { productId: cardId!, productType: 'sealed_product', source: "snkrdunk", limit: 50 },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  const activePriceHistory = isSealedProduct ? sealedPriceHistory : priceHistory;
  const activePriceLoading = isSealedProduct ? sealedPriceLoading : priceLoading;

  const { data: psa10PriceHistory = [], isLoading: psa10Loading } = trpc.prices.getHistory.useQuery(
    { cardId: cardId!, source: "snkrdunk", grade: "PSA10", limit: 500, days: 90 },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  const { data: sealedRecentPrices = [], isLoading: sealedRecentLoading } = trpc.products.getPriceHistory.useQuery(
    { productId: cardId!, productType: 'sealed_product', source: "snkrdunk", limit: 10, days: 60 },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  const activeRecentPrices = isSealedProduct ? sealedRecentPrices : psa10PriceHistory;

  const { data: priceTrendData, isLoading: trendLoading } = trpc.cards.getPriceTrendData.useQuery(
    { cardId: cardId!, days: 0 },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

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
  const calculateReferencePrice = () => {
    if (activeRecentPrices.length === 0) return "N/A";
    if (isSealedProduct) {
      const latest = activeRecentPrices[0];
      if (!latest) return "N/A";
      const price = parseFloat(latest.price as any);
      const qty = latest.quantity ? parseInt(latest.quantity as any, 10) : 1;
      return isNaN(price) ? "N/A" : (price / (qty || 1)).toString();
    }
    // Single card: time-decay weighted average
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    let records = activeRecentPrices.filter(p => {
      if (!p.soldAt) return false;
      return new Date(p.soldAt) >= thirtyDaysAgo;
    });
    if (records.length < 3) {
      records = activeRecentPrices.filter(p => {
        if (!p.soldAt) return false;
        return new Date(p.soldAt) >= ninetyDaysAgo;
      });
    }
    if (records.length === 0) return "N/A";
    const HALF_LIFE_DAYS = 7;
    let weightedSum = 0;
    let totalWeight = 0;
    for (const record of records) {
      const price = parseFloat(record.price as any);
      if (isNaN(price)) continue;
      const daysAgo = record.soldAt
        ? (now.getTime() - new Date(record.soldAt).getTime()) / (1000 * 60 * 60 * 24)
        : 30;
      const weight = Math.pow(2, -daysAgo / HALF_LIFE_DAYS);
      weightedSum += price * weight;
      totalWeight += weight;
    }
    return totalWeight > 0 ? (weightedSum / totalWeight).toString() : "N/A";
  };

  const avgPrice = calculateReferencePrice();
  const recordCount = activeRecentPrices.length;

  // Calculate min/max from PSA10 records
  const psa10Prices = activeRecentPrices.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
  const minPrice = psa10Prices.length > 0 ? Math.min(...psa10Prices) : null;
  const maxPrice = psa10Prices.length > 0 ? Math.max(...psa10Prices) : null;

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
    return { change: changePercent, isIncrease: changePercent > 0, isDecrease: changePercent < 0 };
  };

  const priceTrend = calculatePriceTrend();

  return (
    <div className="min-h-screen bg-background py-4 px-3 sm:py-6 sm:px-4 md:px-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t("common.home"), href: "/" },
          { label: t("common.research"), href: "/research" },
          { label: product.name }
        ]}
      />

      <div className="max-w-6xl mx-auto">
        {/* ── Hero Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Card Image */}
          <div className="lg:col-span-1 flex justify-center lg:justify-start">
            <div className="relative w-full">
              {isSealedProduct && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-black text-xs font-bold">
                  <Package className="w-3 h-3" />
                  {t("cardDetail.boosterBox")}
                </div>
              )}
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full rounded-xl shadow-2xl hover:scale-[1.02] transition-transform duration-300"
                  style={{ height: "auto" }}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-zinc-800 rounded-xl flex items-center justify-center">
                  <p className="text-zinc-500 text-sm">{t("home.noImage")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card Info + Price */}
          <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
            {/* Title */}
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight mb-1">
                {product.name}
              </h1>
              {product.nameJa && (
                <p className="text-sm text-zinc-400">{product.nameJa}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <BrandButton
                size="sm"
                onClick={() => setLocation(`/pricing/${product.id}${isSealedProduct ? '?type=sealed_product' : ''}`)}
                className="flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t("cardDetail.comparePrice")}
              </BrandButton>
              <Button
                size="sm"
                variant="outline"
                onClick={handleWatchlistToggle}
                disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
                className={`border-zinc-600 ${watchlistStatus?.isInWatchlist
                  ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                  : "bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700"
                  }`}
              >
                <Heart className={`w-3.5 h-3.5 mr-1.5 ${watchlistStatus?.isInWatchlist ? "fill-current" : ""}`} />
                {watchlistStatus?.isInWatchlist ? "從收藏中移除" : "加入收藏"}
              </Button>
              <ShareButton cardName={product.name} cardId={cardId!} />
            </div>

            {/* Grade Filter - single cards only */}
            {!isSealedProduct && (
              <div className="flex flex-wrap gap-1.5">
                {grades.map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border ${activeGrade === grade
                      ? "bg-[#1565C0] border-[#1976D2] text-white shadow-lg shadow-blue-900/30"
                      : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            )}

            {/* ── Price Reference Card (deep blue, like MarketplaceListing) ── */}
            <div className="rounded-xl overflow-hidden border border-[#1565C0]/50">
              {/* Card Header */}
              <div className="bg-[#0D47A1] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FFD600]" />
                  <span className="text-sm font-semibold text-white">
                    {isSealedProduct ? t("cardDetail.sealedReferencePrice") : `PSA 10 ${t("cardDetail.referencePrice")}`}
                  </span>
                </div>
                {/* Refresh status */}
                <div className="flex items-center gap-1.5 text-xs">
                  {triggerRefresh.isPending ? (
                    <><RefreshCw className="w-3 h-3 animate-spin text-[#FFD600]" /><span className="text-zinc-300">{t("cardDetail.priceUpdating", "更新中...")}</span></>
                  ) : triggerRefresh.data?.status === 'success' && triggerRefresh.data.recordsAdded > 0 ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /><span className="text-green-400">{t("cardDetail.priceUpdated", "已更新")}</span></>
                  ) : triggerRefresh.data?.status === 'cooldown' || (triggerRefresh.data?.status === 'success' && triggerRefresh.data.recordsAdded === 0) ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /><span className="text-blue-300">{t("cardDetail.priceUpToDate", "最新")}</span></>
                  ) : null}
                </div>
              </div>

              {/* Price Stats Grid */}
              <div className="bg-[#0A2472]/80 backdrop-blur-sm">
                <div className="grid grid-cols-3 divide-x divide-[#1565C0]/40">
                  {/* Average Price */}
                  <div className="px-3 py-4 text-center">
                    <p className="text-[10px] sm:text-xs text-zinc-400 mb-1">參考均價</p>
                    <p className="text-sm sm:text-base md:text-lg font-bold text-[#FFD600] leading-tight">
                      {avgPrice === "N/A" ? "N/A" : formatCurrency(avgPrice)}
                    </p>
                    {priceTrend && (
                      <div className={`mt-1 flex items-center justify-center gap-0.5 text-[10px] font-semibold ${priceTrend.isIncrease ? 'text-green-400' : priceTrend.isDecrease ? 'text-red-400' : 'text-zinc-400'}`}>
                        {priceTrend.isIncrease ? <TrendingUp className="w-3 h-3" /> : priceTrend.isDecrease ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        <span>{Math.abs(priceTrend.change).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  {/* Min Price */}
                  <div className="px-3 py-4 text-center">
                    <p className="text-[10px] sm:text-xs text-zinc-400 mb-1">最低成交</p>
                    <p className="text-sm sm:text-base font-bold text-green-400 leading-tight">
                      {minPrice !== null ? formatCurrency(minPrice.toString()) : "N/A"}
                    </p>
                  </div>
                  {/* Max Price */}
                  <div className="px-3 py-4 text-center">
                    <p className="text-[10px] sm:text-xs text-zinc-400 mb-1">最高成交</p>
                    <p className="text-sm sm:text-base font-bold text-red-400 leading-tight">
                      {maxPrice !== null ? formatCurrency(maxPrice.toString()) : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Footer note */}
                <div className="px-4 py-2 border-t border-[#1565C0]/30 flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500">
                    {isSealedProduct
                      ? t("cardDetail.basedOnLatestSealedRecords", { count: recordCount, months: 2 })
                      : t("cardDetail.basedOnLatestRecordsWeighted", { count: recordCount })
                    }
                    {priceTrend && <span className="ml-1">· {t("cardDetail.priceTrend")}</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Price History Table ── */}
        <div className="rounded-xl overflow-hidden border border-zinc-800 mb-4 sm:mb-6">
          <div className="bg-zinc-900 px-4 py-3 flex items-center gap-2 border-b border-zinc-800">
            <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block" />
            <h3 className="text-sm sm:text-base font-semibold text-white">
              SNKRDUNK {t("cardDetail.actualPriceHistory")}
            </h3>
          </div>
          {activePriceLoading ? (
            <div className="flex items-center justify-center py-10 bg-zinc-900/50">
              <Loader2 className="w-6 h-6 animate-spin text-[#FFD600]" />
            </div>
          ) : activePriceHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-80 overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    <th className="text-left py-2.5 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wide">
                      {t("cardDetail.date")}
                    </th>
                    <th className="text-center py-2.5 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wide">
                      {isSealedProduct ? t("cardDetail.quantity") : t("cardDetail.grade")}
                    </th>
                    <th className="text-right py-2.5 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wide">
                      {t("cardDetail.price")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activePriceHistory.map((item, index) => {
                    const displayValue = isSealedProduct ? (item.quantity || '-') : (item.quantity || item.grade);
                    const isEmpty = !displayValue;
                    return (
                      <tr key={index} className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${index % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-900/60'}`}>
                        <td className="py-2.5 px-4 text-zinc-400 text-xs sm:text-sm">
                          {item.soldAt ? formatDate(item.soldAt) : "N/A"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isEmpty ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-500 text-xs">
                              {isSealedProduct ? '-' : t("cardDetail.usedGrade")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-[#0D47A1]/60 text-blue-300 text-xs font-medium border border-[#1565C0]/40">
                              {displayValue}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[#FFD600] text-xs sm:text-sm">
                          {formatCurrency(item.price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center bg-zinc-900/30">
              <p className="text-zinc-500 text-sm">
                {isSealedProduct ? t("cardDetail.noSealedData") : t("cardDetail.noGradeData")}
              </p>
            </div>
          )}
        </div>

        {/* ── Price Trend Chart ── */}
        <div className="mb-4 sm:mb-6">
          <PriceTrendChart
            cardName={product.name}
            trendData={activeTrendData?.trendData || []}
            stats={activeTrendData?.stats || {
              snkrdunk: { minPrice: 0, maxPrice: 0, avgPrice: 0, latestPrice: 0 }
            }}
            isLoading={activeTrendLoading}
          />
        </div>

        {/* ── Basic Information ── */}
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="bg-zinc-900 px-4 py-3 flex items-center gap-2 border-b border-zinc-800">
            <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block" />
            <h3 className="text-sm sm:text-base font-semibold text-white">
              {t("cardDetail.basicInfo")}
            </h3>
          </div>
          <div className="bg-zinc-900/30 p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">
                  {isSealedProduct ? t("cardDetail.productName") : t("cardDetail.cardName")}
                </dt>
                <dd className="text-sm text-white font-medium">{product.name}</dd>
              </div>
              {product.nameJa && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("cardDetail.japaneseName")}</dt>
                  <dd className="text-sm text-white font-medium">{product.nameJa}</dd>
                </div>
              )}
              {isSealedProduct && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("cardDetail.boxType")}</dt>
                  <dd>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
                      <Package className="w-3 h-3" />
                      {t("cardDetail.boosterBox")}
                    </span>
                  </dd>
                </div>
              )}
              {isSealedProduct && 'styleCode' in product && product.styleCode && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("cardDetail.styleCode", "系列編號")}</dt>
                  <dd>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">
                      {product.styleCode}
                    </span>
                  </dd>
                </div>
              )}
              {!isSealedProduct && 'cardNumber' in product && product.cardNumber && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("cardDetail.cardNumber")}</dt>
                  <dd className="text-sm text-white font-medium">{product.cardNumber}</dd>
                </div>
              )}
              {product.series && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[10px] text-zinc-500 uppercase tracking-wide">{t("cardDetail.series")}</dt>
                  <dd className="text-sm text-white font-medium">{product.series}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
