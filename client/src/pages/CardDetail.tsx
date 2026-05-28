import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Breadcrumb, generateBreadcrumbJsonLd } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Loader2, AlertCircle, Heart, Package, RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink, ShoppingCart, Tag, BookmarkPlus } from "lucide-react";
import { CardDetailSkeleton } from "@/components/PageSkeletons";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { ShareButton } from "@/components/ShareButton";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatDate } from "@/lib/formatDate";
import { ImageLightbox, ClickableCardImage } from "@/components/ImageLightbox";
import { getProxiedImageUrl } from "@/lib/utils";
import { AddEditSheet } from "@/components/CollectionSection";
import PageHead from "@/components/PageHead";

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const ebayRef = useRef<HTMLDivElement>(null);

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
    onMutate: async () => {
      await utils.profile.isInWatchlist.cancel({ cardId: cardId! });
      const prev = utils.profile.isInWatchlist.getData({ cardId: cardId! });
      utils.profile.isInWatchlist.setData({ cardId: cardId! }, { isInWatchlist: true });
      return { prev };
    },
    onSuccess: () => { toast.success("已加入收藏"); },
    onError: (error, _vars, context) => {
      if (context?.prev !== undefined) utils.profile.isInWatchlist.setData({ cardId: cardId! }, context.prev);
      if (error.message.includes("already in watchlist")) toast.error("此卡牌已在收藏列表中");
      else toast.error("加入收藏失敗：" + error.message);
    },
    onSettled: () => { refetchWatchlistStatus(); },
  });

  const removeFromWatchlist = trpc.profile.removeFromWatchlistByCardId.useMutation({
    onMutate: async () => {
      await utils.profile.isInWatchlist.cancel({ cardId: cardId! });
      const prev = utils.profile.isInWatchlist.getData({ cardId: cardId! });
      utils.profile.isInWatchlist.setData({ cardId: cardId! }, { isInWatchlist: false });
      return { prev };
    },
    onSuccess: () => { toast.success("已從收藏中移除"); },
    onError: (error, _vars, context) => {
      if (context?.prev !== undefined) utils.profile.isInWatchlist.setData({ cardId: cardId! }, context.prev);
      toast.error("移除收藏失敗：" + error.message);
    },
    onSettled: () => { refetchWatchlistStatus(); },
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
    // Return grade as-is — DB stores canonical form with spaces (e.g. "PSA 10")
    // Do NOT strip spaces: "PSA 10" → "PSA10" would break the grade filter
    return grade;
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
    { cardId: cardId!, source: "snkrdunk", grade: "PSA 10", limit: 500, days: 90 },
    { enabled: !!cardId && !isSealedProduct, retry: 1 }
  );

  const { data: sealedRecentPrices = [], isLoading: sealedRecentLoading } = trpc.products.getPriceHistory.useQuery(
    { productId: cardId!, productType: 'sealed_product', source: "snkrdunk", limit: 10, days: 60 },
    { enabled: !!cardId && isSealedProduct, retry: 1 }
  );

  const activeRecentPrices = isSealedProduct ? sealedRecentPrices : psa10PriceHistory;

  // Marketplace lowest listing price for JSON-LD offers
  const { data: lowestListingData } = trpc.marketplace.getListings.useQuery(
    { cardIds: [cardId!], pageSize: 1, sortBy: 'price_asc' },
    { enabled: !!cardId && !isSealedProduct, staleTime: 5 * 60 * 1000, retry: 1 }
  );
  const lowestMarketplacePrice = lowestListingData?.listings?.[0]?.priceHkd ?? null;

  // eBay listings for sealed products
  const { data: ebayData, isLoading: ebayLoading, refetch: refetchEbay } = trpc.pricing.getListings.useQuery(
    { sealedProductId: cardId! },
    { enabled: !!cardId && isSealedProduct, retry: 1, staleTime: 30 * 60 * 1000 }
  );
  const ebayListings = ebayData?.listings || [];

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
    return <CardDetailSkeleton />;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW 3-TIER PRICE ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 主顯示：近期成交中位數（最近 5 筆 → 14 天 → 30 天）
  // 2. 輔助顯示：短期加權均價（7 天加權平均）
  // 3. 價格帶：30 天 P25/P75
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Helper: Simple median ────────────────────────────────────────────────
  const simpleMedian = (prices: number[]): number | null => {
    if (prices.length === 0) return null;
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  // ── Helper: Parse quantity from string (e.g. "3個" → 3, "10個" → 10) ────────
  const parseQuantity = (qty: any): number => {
    if (!qty) return 1;
    const n = parseInt(String(qty).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n <= 0 ? 1 : n;
  };

  // ── Helper: Get unit price for sealed product (total price ÷ quantity) ──────
  const getSealedUnitPrice = (record: any): number | null => {
    const price = parseFloat(record.price as any);
    if (isNaN(price)) return null;
    const qty = parseQuantity(record.quantity);
    return price / qty;
  };

  // ── Helper: Weighted average ─────────────────────────────────────────────
  const weightedAverage = (records: typeof activeRecentPrices, halfLifeDays: number): number | null => {
    if (records.length === 0) return null;
    const now = new Date();
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of records) {
      const price = parseFloat(r.price as any);
      if (isNaN(price)) continue;
      const daysAgo = r.soldAt
        ? (now.getTime() - new Date(r.soldAt).getTime()) / (1000 * 60 * 60 * 24)
        : halfLifeDays * 2;
      const w = Math.pow(2, -daysAgo / halfLifeDays);
      weightedSum += price * w;
      totalWeight += w;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  };

  // ── 1️⃣ MAIN: 近期成交中位數（最近 5 筆 → 14 天 → 30 天）──────────────────
  const calculateRecentMedian = (): { price: number | null; source: string; recordCount: number } => {
    if (activeRecentPrices.length === 0) return { price: null, source: "N/A", recordCount: 0 };
    if (isSealedProduct) {
      // 卡盒：用最近 10 筆的時間加權平均單盒價格（越近的交易權重越高）
      const records = activeRecentPrices.slice(0, 10);
      if (records.length === 0) return { price: null, source: "N/A", recordCount: 0 };
      const now = new Date();
      let weightedSum = 0;
      let totalWeight = 0;
      let validCount = 0;
      for (const r of records) {
        const unitPrice = getSealedUnitPrice(r);
        if (unitPrice === null) continue;
        const daysAgo = r.soldAt
          ? (now.getTime() - new Date(r.soldAt).getTime()) / (1000 * 60 * 60 * 24)
          : 30;
        const w = Math.pow(2, -daysAgo / 14); // 14-day half-life
        weightedSum += unitPrice * w;
        totalWeight += w;
        validCount++;
      }
      if (validCount === 0) return { price: null, source: "N/A", recordCount: 0 };
      const avgUnitPrice = totalWeight > 0 ? weightedSum / totalWeight : null;
      const sourceLabel = validCount >= 10 ? "最近 10 筆" : validCount >= 5 ? `最近 ${validCount} 筆` : `${validCount} 筆`;
      return { price: avgUnitPrice, source: sourceLabel, recordCount: validCount };
    }

    // Step 1: Try latest 5 records
    if (activeRecentPrices.length >= 5) {
      const latest5 = activeRecentPrices.slice(0, 5);
      const prices = latest5.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      if (prices.length >= 5) {
        return { price: simpleMedian(prices), source: "最近 5 筆", recordCount: 5 };
      }
    }

    // Step 2: Try 14-day window
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const records14d = activeRecentPrices.filter(p => p.soldAt && new Date(p.soldAt) >= fourteenDaysAgo);
    if (records14d.length >= 3) {
      const prices = records14d.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      return { price: simpleMedian(prices), source: "14 天", recordCount: prices.length };
    }

    // Step 3: Try 30-day window
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const records30d = activeRecentPrices.filter(p => p.soldAt && new Date(p.soldAt) >= thirtyDaysAgo);
    if (records30d.length >= 3) {
      const prices = records30d.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      return { price: simpleMedian(prices), source: "30 天", recordCount: prices.length };
    }

    // Fallback: use all available records
    const allPrices = activeRecentPrices.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
    return { price: simpleMedian(allPrices), source: "全部記錄", recordCount: allPrices.length };
  };

  const recentMedianResult = calculateRecentMedian();
  const mainPrice = recentMedianResult.price;
  const mainPriceSource = recentMedianResult.source;
  const mainPriceRecordCount = recentMedianResult.recordCount;

  // ── 2️⃣ AUXILIARY: 短期加權均價（7 天加權平均）──────────────────────────────
  const calculateWeightedAvg = (): { price: number | null; recordCount: number } => {
    if (activeRecentPrices.length === 0 || isSealedProduct) return { price: null, recordCount: 0 };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const records7d = activeRecentPrices.filter(p => p.soldAt && new Date(p.soldAt) >= sevenDaysAgo);
    if (records7d.length < 2) return { price: null, recordCount: 0 };
    return { price: weightedAverage(records7d, 7), recordCount: records7d.length };
  };

  const weightedAvgResult = calculateWeightedAvg();
  const auxPrice = weightedAvgResult.price;
  const auxPriceRecordCount = weightedAvgResult.recordCount;

  // ── 3️⃣ PRICE BAND: 30 天價格帶（P25/P75）────────────────────────────────
  const recordCount = activeRecentPrices.length;

  // ── Latest single trade ───────────────────────────────────────────────────
  const latestTrade = activeRecentPrices.length > 0 ? activeRecentPrices[0] : null;
  // For sealed products: show unit price (total ÷ qty); for single cards: show raw price
  const latestTradePrice = latestTrade
    ? (isSealedProduct ? getSealedUnitPrice(latestTrade) : parseFloat(latestTrade.price as any))
    : null;

  // ── 30-day P25 / P75 (Price Band) ────────────────────────────────────────
  const thirtyDayPrices = (() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return activeRecentPrices
      .filter(p => !isSealedProduct && p.soldAt && new Date(p.soldAt) >= cutoff)
      .map(p => parseFloat(p.price as any))
      .filter(p => !isNaN(p))
      .sort((a, b) => a - b);
  })();
  const p25 = thirtyDayPrices.length >= 4
    ? thirtyDayPrices[Math.floor(thirtyDayPrices.length * 0.25)]
    : null;
  const p75 = thirtyDayPrices.length >= 4
    ? thirtyDayPrices[Math.floor(thirtyDayPrices.length * 0.75)]
    : null;

  // For sealed products: compute unit prices (total ÷ qty); for single cards: use raw prices
  const psa10Prices = isSealedProduct
    ? activeRecentPrices.map(p => getSealedUnitPrice(p)).filter((p): p is number => p !== null)
    : activeRecentPrices.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
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
    <>
    <PageHead
      title={`${product.name} 價格走勢 - BOXIUM TCG`}
      description={`查看 ${product.name} 的即時市場價格、PSA 10 成交記錄及價格走勢分析。`}
      ogImage={product.imageUrl ? getProxiedImageUrl(product.imageUrl) ?? undefined : undefined}
    />
    {/* JSON-LD structured data for Google rich results */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          ...(product.imageUrl ? { image: [getProxiedImageUrl(product.imageUrl) ?? product.imageUrl] } : {}),
          description: `${product.name} 寶可夢卡牌 - 查看即時市場價格、PSA 10 成交記錄及價格走勢分析。`,
          brand: {
            "@type": "Brand",
            name: "Pokémon TCG",
          },
          ...(product.series ? { category: product.series } : {}),
          ...(!isSealedProduct && 'cardNumber' in product && product.cardNumber
            ? { sku: product.cardNumber }
            : {}),
          // additionalProperty: card number and series for rich snippet context
          additionalProperty: [
            ...(!isSealedProduct && 'cardNumber' in product && product.cardNumber
              ? [{ "@type": "PropertyValue", name: "cardNumber", value: product.cardNumber }]
              : []),
            ...(product.series
              ? [{ "@type": "PropertyValue", name: "series", value: product.series }]
              : []),
            ...(!isSealedProduct
              ? [{ "@type": "PropertyValue", name: "grade", value: "PSA 10" }]
              : []),
          ],
          // Offer: marketplace lowest listing price (real-time) + aggregate historical price
          offers: [
            ...(lowestMarketplacePrice !== null
              ? [{
                  "@type": "Offer",
                  priceCurrency: "HKD",
                  price: lowestMarketplacePrice.toFixed(2),
                  availability: "https://schema.org/InStock",
                  url: `${typeof window !== 'undefined' ? window.location.origin : ''}/market`,
                  seller: { "@type": "Organization", name: "BOXIUM TCG" },
                  itemCondition: "https://schema.org/UsedCondition",
                  description: "BOXIUM TCG 市集最低上架價格",
                }]
              : []),
            ...(minPrice !== null && maxPrice !== null
              ? [{
                  "@type": "AggregateOffer",
                  priceCurrency: "HKD",
                  lowPrice: minPrice.toFixed(2),
                  highPrice: maxPrice.toFixed(2),
                  offerCount: psa10Prices.length,
                  availability: "https://schema.org/InStock",
                  description: "PSA 10 近期成交價格區間",
                }]
              : []),
          ],
          url: `${typeof window !== 'undefined' ? window.location.origin : ''}/card/${cardId}`,
        }),
      }}
    />
    {/* BreadcrumbList JSON-LD for Google rich results */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(
          generateBreadcrumbJsonLd(
            [
              { label: t("common.home"), href: "/" },
              { label: t("common.research"), href: "/research" },
              { label: product.name },
            ],
            typeof window !== 'undefined' ? window.location.origin : ''
          )
        ),
      }}
    />
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
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_4fr] gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Card Image */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full lg:sticky lg:top-6 lg:self-start">
              {isSealedProduct && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-black text-xs font-bold">
                  <Package className="w-3 h-3" />
                  {t("cardDetail.boosterBox")}
                </div>
              )}
              {product.imageUrl ? (
                <>
                  <ClickableCardImage
                    src={getProxiedImageUrl(product.imageUrl) ?? ""}
                    alt={`${product.name}${!isSealedProduct && 'cardNumber' in product && product.cardNumber ? ` ${product.cardNumber}` : ''} 卡牌圖像${product.series ? ` - ${product.series}` : ''}`}
                    className="w-full rounded-xl shadow-2xl"
                    style={{ height: "auto" }}
                    onClick={() => setLightboxOpen(true)}
                  />
                  <ImageLightbox
                    src={getProxiedImageUrl(product.imageUrl) ?? ""}
                    alt={`${product.name}${!isSealedProduct && 'cardNumber' in product && product.cardNumber ? ` ${product.cardNumber}` : ''} 卡牌圖像${product.series ? ` - ${product.series}` : ''}`}
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                  />
                </>
              ) : (
                <div className="w-full aspect-[2/3] bg-zinc-800 rounded-xl flex items-center justify-center">
                  <p className="text-zinc-500 text-sm">{t("home.noImage")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card Info + Price */}
          <div className="flex flex-col gap-3 sm:gap-4">
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
                onClick={() => {
                  if (isSealedProduct) {
                    // Scroll to eBay section
                    ebayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    setLocation(`/pricing/${product.id}`);
                  }
                }}
                className="flex items-center gap-1.5"
              >
                {isSealedProduct ? <ShoppingCart className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                {isSealedProduct ? '查看在售商品' : t("cardDetail.comparePrice")}
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
                {watchlistStatus?.isInWatchlist ? "從追蹤中移除" : "追蹤"}
              </Button>
              {/* 加入個人收藏清單 — only for single cards */}
              {!isSealedProduct && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!user) { toast.error("請先登入才能使用收藏功能"); setLocation("/login"); return; }
                    setShowCollectionSheet(true);
                  }}
                  className="border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
                  加入收藏清單
                </Button>
              )}
              <ShareButton cardName={product.name} cardId={cardId!} />
            </div>



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

              {/* Price Stats Grid - 3-tier architecture */}
              <div className="bg-[#0A2472]/80 backdrop-blur-sm">

                {/* 主顯示：近期成交中位數 */}
                <div className="px-4 pt-4 pb-3 border-b border-[#1565C0]/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FFD600] inline-block" />
                        <p className="text-[10px] sm:text-xs text-zinc-300 font-semibold tracking-wide">
                          {isSealedProduct ? '參考均價' : '近期成交中位數'}
                        </p>
                        {!isSealedProduct && mainPriceSource !== "N/A" && (
                          <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">
                            {mainPriceSource}
                          </span>
                        )}
                      </div>
                      {mainPrice !== null ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[10px] text-zinc-400">HKD</span>
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold text-[#FFD600] leading-none">
                            {mainPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xl sm:text-2xl font-bold text-[#FFD600]">N/A</p>
                      )}
                      {mainPriceRecordCount > 0 && (
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                          {isSealedProduct
                            ? `基於最近 ${mainPriceRecordCount} 筆成交加權平均（單盒價）`
                            : `基於 ${mainPriceRecordCount} 筆成交記錄`
                          }
                        </p>
                      )}
                    </div>
                    {priceTrend && (
                      <div className={`flex flex-col items-end gap-0.5 ${priceTrend.isIncrease ? 'text-green-400' : priceTrend.isDecrease ? 'text-red-400' : 'text-zinc-400'}`}>
                        <div className="flex items-center gap-0.5 text-sm font-bold">
                          {priceTrend.isIncrease ? <TrendingUp className="w-4 h-4" /> : priceTrend.isDecrease ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          <span>{Math.abs(priceTrend.change).toFixed(1)}%</span>
                        </div>
                        <p className="text-[9px] text-zinc-500">7 天趨勢</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 輔助資訊：3 欄小數據 */}
                <div className="grid grid-cols-3 divide-x divide-[#1565C0]/40">

                  {/* 小欄 1: 短期加權均價 */}
                  <div className="px-3 py-3 text-center">
                    <p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">
                      {isSealedProduct ? '最新成交' : '7天加權均價'}
                    </p>
                    {!isSealedProduct ? (
                      auxPrice !== null ? (
                        <>
                          <p className="text-[9px] text-zinc-500">HKD</p>
                          <p className="text-xs sm:text-sm font-semibold text-blue-300 leading-tight">
                            {auxPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[8px] text-zinc-600 mt-0.5">{auxPriceRecordCount} 筆</p>
                        </>
                      ) : (
                        <p className="text-xs font-semibold text-zinc-600">-</p>
                      )
                    ) : (
                      latestTradePrice !== null ? (
                        <>
                          <p className="text-[9px] text-zinc-500">HKD</p>
                          <p className="text-xs sm:text-sm font-semibold text-blue-300 leading-tight">
                            {latestTradePrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          {latestTrade?.soldAt && (
                            <p className="text-[8px] text-zinc-600 mt-0.5">
                              {new Date(latestTrade.soldAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                            </p>
                          )}
                        </>
                      ) : <p className="text-xs font-semibold text-zinc-600">N/A</p>
                    )}
                  </div>

                  {/* 小欄 2: 最近單筆成交 */}
                  <div className="px-3 py-3 text-center">
                    <p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">
                      {isSealedProduct ? '最近總金額' : '最近單筆'}
                    </p>
                    {latestTrade !== null ? (
                      <>
                        <p className="text-[9px] text-zinc-500">HKD</p>
                        <p className="text-xs sm:text-sm font-semibold text-white leading-tight">
                          {isSealedProduct
                            ? parseFloat(latestTrade.price as any).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : (latestTradePrice !== null && !isNaN(latestTradePrice)
                                ? latestTradePrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                : 'N/A')
                          }
                        </p>
                        {isSealedProduct && latestTrade.quantity && (
                          <p className="text-[8px] text-zinc-600 mt-0.5">
                            {latestTrade.quantity}個盒
                          </p>
                        )}
                        {latestTrade?.soldAt && (
                          <p className="text-[8px] text-zinc-600 mt-0.5">
                            {new Date(latestTrade.soldAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-zinc-600">N/A</p>
                    )}
                  </div>

                  {/* 小欄 3: 30 天價格帶 */}
                  <div className="px-3 py-3 text-center">
                    {!isSealedProduct && p25 !== null && p75 !== null ? (
                      <>
                        <p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">30天價格帶</p>
                        <p className="text-[9px] text-zinc-500">HKD</p>
                        <p className="text-[10px] sm:text-xs font-semibold text-green-400 leading-tight">
                          {p25.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[8px] text-zinc-600">↕</p>
                        <p className="text-[10px] sm:text-xs font-semibold text-orange-400 leading-tight">
                          {p75.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[8px] text-zinc-600 mt-0.5">P25 / P75</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[9px] sm:text-[10px] text-zinc-500 mb-1">最高成交</p>
                        {maxPrice !== null ? (
                          <>
                            <p className="text-[9px] text-zinc-500">HKD</p>
                            <p className="text-xs sm:text-sm font-semibold text-orange-400 leading-tight">
                              {maxPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </>
                        ) : <p className="text-xs font-semibold text-zinc-600">N/A</p>}
                      </>
                    )}
                  </div>

                </div>

                {/* Footer note */}
                <div className="px-4 py-2 border-t border-[#1565C0]/30">
                  <p className="text-[10px] text-zinc-500">
                    {isSealedProduct
                      ? `參考均價基於最近 ${mainPriceRecordCount} 筆 SNKRDUNK 成交計算單盒價（加権平均）`
                      : `中位數基於 ${mainPriceRecordCount} 筆 PSA 10 成交記錄（${mainPriceSource}）`
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
          <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#FFD600] inline-block" />
              <h3 className="text-sm sm:text-base font-semibold text-white">
                SNKRDUNK {t("cardDetail.actualPriceHistory")}
              </h3>
            </div>
            {/* Grade Filter - single cards only */}
            {!isSealedProduct && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {priceLoading && activeGrade && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                )}
                {grades.map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setActiveGrade(activeGrade === grade ? null : grade)}
                    disabled={priceLoading}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border relative ${
                      activeGrade === grade
                        ? "bg-[#1565C0] border-[#1976D2] text-white shadow-lg shadow-blue-900/30"
                        : "bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    } ${priceLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {grade}
                    {activeGrade === grade && priceLoading && (
                      <span className="absolute inset-0 rounded-lg bg-[#1565C0]/40 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activePriceLoading ? (
            <div className="flex flex-col items-center justify-center py-10 bg-zinc-900/50 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#FFD600]" />
              {activeGrade && (
                <p className="text-xs text-zinc-500 animate-pulse">
                  正在載入 {activeGrade} 成交記錄...
                </p>
              )}
            </div>
          ) : activePriceHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-80 overflow-x-auto transition-opacity duration-300">
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
                    {isSealedProduct && (
                      <th className="text-right py-2.5 px-4 text-zinc-500 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                        單盒價
                      </th>
                    )}
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
                        {isSealedProduct && (
                          <td className="py-2.5 px-4 text-right text-xs sm:text-sm">
                            {(() => {
                              const unitPrice = getSealedUnitPrice(item);
                              const qty = parseQuantity(item.quantity);
                              return unitPrice !== null && qty > 1 ? (
                                <span className="text-green-400 font-medium">
                                  {formatCurrency(unitPrice)}
                                </span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              );
                            })()}
                          </td>
                        )}
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
            isSealedProduct={isSealedProduct}
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

      {/* ── eBay Listings Section (Sealed Products only) ── */}
      {isSealedProduct && (
        <div ref={ebayRef} className="mt-4 sm:mt-6 rounded-xl border border-zinc-800 overflow-hidden">
          {/* Header */}
          <div className="bg-zinc-900 px-4 py-3 flex items-center justify-between border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-blue-400 inline-block" />
              <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-400" />
                eBay 在售商品
              </h3>
              {!ebayLoading && (
                <span className="text-xs text-zinc-500">（按價格排序）</span>
              )}
            </div>
            <button
              onClick={() => refetchEbay()}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
          </div>

          {/* Content */}
          {ebayLoading ? (
            <div className="py-12 flex items-center justify-center bg-zinc-900/30">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-zinc-400">正在搜尋 eBay 在售商品...</span>
            </div>
          ) : ebayListings.length === 0 ? (
            <div className="py-12 text-center bg-zinc-900/30">
              <ShoppingCart className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">目前 eBay 沒有找到相關在售商品</p>
              <p className="text-zinc-600 text-xs mt-1">可嘗試刷新或稍後再查看</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4 bg-zinc-900/30">
              {ebayListings.map((item: any, index: number) => (
                <a
                  key={item.id || index}
                  href={item.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col bg-zinc-800/60 rounded-xl overflow-hidden border border-zinc-700/50 hover:border-blue-500/50 hover:bg-zinc-800 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10"
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-zinc-900">
                    {item.imageUrl ? (
                      <img
                        src={getProxiedImageUrl(item.imageUrl) ?? ""}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                    {/* eBay badge */}
                    <div className="absolute top-1.5 right-1.5 bg-[#e53238] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      eBay
                    </div>
                    {/* Price badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                      <p className="text-green-400 font-bold text-sm">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                    <p className="text-[11px] text-zinc-300 leading-tight line-clamp-3 group-hover:text-white transition-colors">
                      {item.title}
                    </p>
                    {item.seller && (
                      <p className="text-[10px] text-zinc-500 truncate">
                        賣家: {item.seller}
                      </p>
                    )}
                    <div className="mt-auto pt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-medium group-hover:text-blue-300">
                        <ExternalLink className="w-2.5 h-2.5" />
                        前往購買
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Footer note */}
          {ebayListings.length > 0 && (
            <div className="px-4 py-2.5 bg-zinc-900/50 border-t border-zinc-800 flex items-center gap-1.5">
              <Tag className="w-3 h-3 text-zinc-500" />
              <p className="text-[11px] text-zinc-500">
                共 {ebayListings.length} 件在售商品・價格已換算為 HKD・點擊前往 eBay 購買
              </p>
            </div>
          )}
        </div>
      )}

      {/* Similar Cards Section */}
      {!isSealedProduct && cardId && (
        <SimilarCardsSection cardId={cardId} series={product.series ?? null} setName={product.setName ?? null} cardName={product.name} />
      )}
    </div>

    {/* ── Add to Collection Sheet (prefilled with current card) ── */}
    {!isSealedProduct && (
      <AddEditSheet
        open={showCollectionSheet}
        onOpenChange={setShowCollectionSheet}
        editItem={null}
        prefillCard={product && cardId ? {
          id: cardId,
          name: product.name,
          imageUrl: product.imageUrl ?? null,
          series: product.series ?? null,
        } : null}
        onSuccess={() => setShowCollectionSheet(false)}
      />
    )}
    </>
  );
}

function SimilarCardsSection({ cardId, series, setName, cardName }: { cardId: number; series: string | null; setName: string | null; cardName: string }) {
  const [, setLocation] = useLocation();
  // Display the set name or series as section subtitle
  const sectionLabel = setName || series || cardName.split(/[\s\[\(]/)[0];
  const { data: similarCards, isLoading } = trpc.cards.getSimilarCards.useQuery(
    { cardId, series: series ?? undefined, setName: setName ?? undefined, limit: 12 },
    { enabled: !!cardId }
  );

  if (isLoading) return null;
  if (!similarCards || similarCards.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl bg-zinc-900/80 border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-yellow-400" />
          <h3 className="text-base font-semibold text-white">同系列卡牌</h3>
          {sectionLabel && <span className="text-xs text-zinc-500 ml-1">{sectionLabel}</span>}
        </div>
        <button
          onClick={() => setLocation(`/search?q=${encodeURIComponent(sectionLabel)}`)}
          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1 font-medium"
        >
          查看更多
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" role="list" aria-label="同系列卡牌列表">
        {similarCards.map((card: any) => (
          <a
            key={card.id}
            href={`/card/${card.id}`}
            onClick={(e) => { e.preventDefault(); setLocation(`/card/${card.id}`); }}
            className="group flex flex-col gap-2 text-left hover:scale-[1.03] transition-transform duration-200"
            title={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 價格資訊`}
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
              {card.imageUrl ? (
                <img
                  src={getProxiedImageUrl(card.imageUrl) ?? ""}
                  alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像`}
                  className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">無圖</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2 group-hover:text-yellow-400 transition-colors">
              {card.name}
            </p>
            {card.latestPrice && (
              <p className="text-[10px] text-yellow-400 font-semibold">
                HKD {Number(card.latestPrice).toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
