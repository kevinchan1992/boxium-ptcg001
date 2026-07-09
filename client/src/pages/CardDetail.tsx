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

const GRADE_KEYS = ["PSA 10", "used"];

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
  // 3D tilt effect for card image
  const [tilt, setTilt] = useState({ x: 0, y: 0, glare: 0 });
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    const glare = Math.sqrt(x * x + y * y) / 14;
    setTilt({ x, y, glare });
  };
  const handleCardMouseLeave = () => setTilt({ x: 0, y: 0, glare: 0 });

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
    onSuccess: () => { toast.success(t("cardDetail.addedToWatchlist")); },
    onError: (error, _vars, context) => {
      if (context?.prev !== undefined) utils.profile.isInWatchlist.setData({ cardId: cardId! }, context.prev);
      if (error.message.includes("already in watchlist")) toast.error(t("cardDetail.alreadyInWatchlist"));
      else toast.error(t("cardDetail.addWatchlistFailed", { msg: error.message }));
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
    onSuccess: () => { toast.success(t("cardDetail.removedFromWatchlist")); },
    onError: (error, _vars, context) => {
      if (context?.prev !== undefined) utils.profile.isInWatchlist.setData({ cardId: cardId! }, context.prev);
      toast.error(t("cardDetail.removeWatchlistFailed", { msg: error.message }));
    },
    onSettled: () => { refetchWatchlistStatus(); },
  });

  const handleWatchlistToggle = () => {
    if (!user) { toast.error(t("cardDetail.loginToWatchlist")); setLocation("/login"); return; }
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
    // Map frontend key "used" to DB canonical value "中古"
    // DB stores SNKRDUNK condition field directly (e.g. "PSA 10", "中古")
    if (grade === "used") return "中古";
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

  // eBay sold listings history (single cards only)
  const { data: ebayPriceHistory = [], isLoading: ebayHistoryLoading } = trpc.prices.getHistory.useQuery(
    { cardId: cardId!, source: "ebay", grade: "PSA 10", limit: 60 },
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
  const lowestMarketplacePrice = lowestListingData?.listings?.[0]?.priceHkd != null ? parseFloat(lowestListingData.listings[0].priceHkd as any) : null;

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

  // TCGPlayer / Cardmarket market prices (TCGdex-sourced cards only)
  // TCGdex cards have cardId starting with 'tcgdex-'; SNKRDUNK cards do not
  const isTcgdexCard = !isSealedProduct && ((card as any)?.cardId?.startsWith('tcgdex-') ?? false);
  const { data: tcgMarketPrice, isLoading: tcgPriceLoading } = trpc.cards.getTcgMarketPrice.useQuery(
    { cardId: cardId! },
    { enabled: !!cardId && isTcgdexCard, retry: 1 }
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
      // 卡盒：用最近 10 筆的時間加權平均{t("cardDetail.perBoxPrice")}格（越近的交易權重越高）
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
      const sourceLabel = validCount >= 10 ? t("cardDetail.recentN", { n: 10 }) : validCount >= 5 ? t("cardDetail.recentN", { n: validCount }) : t("cardDetail.nRecords", { n: validCount });
      return { price: avgUnitPrice, source: sourceLabel, recordCount: validCount };
    }

    // Step 1: Try latest 5 records
    if (activeRecentPrices.length >= 5) {
      const latest5 = activeRecentPrices.slice(0, 5);
      const prices = latest5.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      if (prices.length >= 5) {
        return { price: simpleMedian(prices), source: t("cardDetail.recentN", { n: 5 }), recordCount: 5 };
      }
    }

    // Step 2: Try 14-day window
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const records14d = activeRecentPrices.filter(p => p.soldAt && new Date(p.soldAt) >= fourteenDaysAgo);
    if (records14d.length >= 3) {
      const prices = records14d.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      return { price: simpleMedian(prices), source: t("cardDetail.days14"), recordCount: prices.length };
    }

    // Step 3: Try 30-day window
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const records30d = activeRecentPrices.filter(p => p.soldAt && new Date(p.soldAt) >= thirtyDaysAgo);
    if (records30d.length >= 3) {
      const prices = records30d.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
      return { price: simpleMedian(prices), source: t("cardDetail.days30"), recordCount: prices.length };
    }

    // Fallback: use all available records
    const allPrices = activeRecentPrices.map(p => parseFloat(p.price as any)).filter(p => !isNaN(p));
    return { price: simpleMedian(allPrices), source: t("cardDetail.allRecords"), recordCount: allPrices.length };
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
      title={!isSealedProduct && 'cardNumber' in product && product.cardNumber
        ? `${product.cardNumber} | ${product.name.replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^)]*\)/g, '').trim()} ${t("cardDetail.psa10PriceTitle")} - BOXIUM`
        : `${product.name} ${t("cardDetail.priceTrendTitle")} - BOXIUM TCG`}
      description={t("cardDetail.pageDescription", { name: `${!isSealedProduct && 'cardNumber' in product && product.cardNumber ? `${product.cardNumber} ` : ''}${product.name.replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^)]*\)/g, '').trim()}` })}
      ogImage={product.imageUrl ? getProxiedImageUrl(product.imageUrl) ?? undefined : undefined}
    />
    {/* JSON-LD structured data for Google rich results */}
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: !isSealedProduct && 'cardNumber' in product && product.cardNumber
            ? `${product.name.replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^)]*\)/g, '').trim()} ${product.cardNumber}`
            : product.name,
          ...(product.imageUrl ? { image: [getProxiedImageUrl(product.imageUrl) ?? product.imageUrl] } : {}),
          description: t("cardDetail.jsonLdDescription", { name: product.name }),
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
                  description: t("cardDetail.marketLowestPrice"),
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
                  description: t("cardDetail.psa10PriceRange"),
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
    <div className="min-h-screen relative" style={{ background: '#111215' }}>
      {/* Blurred artwork background */}
      {product.imageUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${getProxiedImageUrl(product.imageUrl) ?? ''})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(80px) saturate(0.5) brightness(0.15)',
            transform: 'scale(1.2)',
          }}
        />
      )}
      <div className="relative z-10 py-4 px-3 sm:py-6 sm:px-4 md:px-6">
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
            <div
              className="relative w-full lg:sticky lg:top-6 lg:self-start cursor-pointer"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
              style={{
                transform: `perspective(800px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
                transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.5s ease' : 'transform 0.1s ease',
              }}
            >
              {isSealedProduct && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-black text-xs font-bold">
                  <Package className="w-3 h-3" />
                  {t("cardDetail.boosterBox")}
                </div>
              )}
              {product.imageUrl ? (
                <>
                  {/* Fixed-height container: both SNKRDUNK and TCGdex images fill the same area */}
                  <div
                    className="w-full rounded-xl overflow-hidden shadow-2xl flex items-center justify-center bg-zinc-900/30"
                    style={{ height: 'clamp(380px, 60vw, 620px)' }}
                  >
                    <ClickableCardImage
                      src={getProxiedImageUrl(product.imageUrl) ?? ""}
                      alt={`${product.name}${!isSealedProduct && 'cardNumber' in product && product.cardNumber ? ` ${product.cardNumber}` : ''} ${t("cardDetail.cardImage")}${product.series ? ` - ${product.series}` : ''}`}
                      className="max-h-full w-auto"
                      style={{
                        objectFit: 'contain',
                        objectPosition: 'center',
                        display: 'block',
                        // TCGdex cards have high-res images that appear too large;
                        // cap them to ~200px wide to match SNKRDUNK card display size
                        maxWidth: isTcgdexCard ? '200px' : '100%',
                      }}
                      onClick={() => setLightboxOpen(true)}
                    />
                  </div>
                  <ImageLightbox
                    src={getProxiedImageUrl(product.imageUrl) ?? ""}
                    alt={`${product.name}${!isSealedProduct && 'cardNumber' in product && product.cardNumber ? ` ${product.cardNumber}` : ''} ${t("cardDetail.cardImage")}${product.series ? ` - ${product.series}` : ''}`}
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                  />
                </>
              ) : (
                <div className="w-full rounded-xl bg-zinc-800 flex items-center justify-center" style={{ height: 'clamp(320px, 55vw, 560px)' }}>
                  <p className="text-zinc-500 text-sm">{t("home.noImage")}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card Info + Price */}
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Title — Magazine Editorial Style */}
            <div className="relative">
              {/* Decorative card number watermark */}
              {!isSealedProduct && 'cardNumber' in product && product.cardNumber && (
                <span
                  className="absolute -top-4 -left-2 select-none pointer-events-none"
                  style={{
                    fontSize: 'clamp(60px, 12vw, 120px)',
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.04)',
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                    zIndex: 0,
                  }}
                  aria-hidden="true"
                >
                  {product.cardNumber}
                </span>
              )}
              {/* Series / type tag */}
              {(product.series || isSealedProduct) && (
                <p className="text-[10px] sm:text-xs text-[#FFD600] uppercase tracking-[0.2em] font-semibold mb-2 relative z-10">
                  {isSealedProduct ? '◆ SEALED PRODUCT' : `◆ ${product.series}`}
                </p>
              )}
              {/* Main title */}
              <h1
                className="relative z-10 leading-tight mb-1"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(22px, 3.5vw, 44px)',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  letterSpacing: '-0.01em',
                }}
              >
                {!isSealedProduct && 'cardNumber' in product && product.cardNumber
                  ? product.name.replace(/\s*\[[^\]]*\]/g, '').replace(/\s*\([^)]*\)/g, '').trim()
                  : product.name}
              </h1>
              {/* Japanese name */}
              {product.nameJa && (
                <p className="text-sm text-zinc-400 mt-1 relative z-10" style={{ fontStyle: 'italic' }}>{product.nameJa}</p>
              )}
              {/* Card number badge */}
              {!isSealedProduct && 'cardNumber' in product && product.cardNumber && (
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 border border-zinc-700/60 bg-zinc-800/40 relative z-10">
                  {product.cardNumber}
                </span>
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
                {watchlistStatus?.isInWatchlist ? t("cardDetail.removeFromTracking") : t("cardDetail.track")}
              </Button>
              {/* 加入個人收藏清單 — only for single cards */}
              {!isSealedProduct && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!user) { toast.error(t("cardDetail.loginToWatchlist")); setLocation("/login"); return; }
                    setShowCollectionSheet(true);
                  }}
                  className="border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700"
                >
                  <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
                  {t("cardDetail.addToCollection")}
                </Button>
              )}
              <ShareButton cardName={product.name} cardId={cardId!} />
            </div>



            {/* ── Price Reference Card (editorial dark fashion) ── */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Card Header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-[0.25em] font-semibold" style={{ color: '#999999' }}>
                    {isSealedProduct ? t("cardDetail.sealedReferencePrice") : `PSA 10 · ${t("cardDetail.referencePrice")}`}
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

              {/* Price Stats Grid - editorial magazine style */}
              <div>

                {/* 主顯示：近期成交中位數 — Magazine headline number */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] mb-3" style={{ color: '#666666' }}>
                        {isSealedProduct ? t("cardDetail.referenceAvgPrice") : t("cardDetail.recentMedian")}
                        {!isSealedProduct && mainPriceSource !== "N/A" && (
                          <span className="ml-2 normal-case tracking-normal" style={{ color: '#555555' }}>· {mainPriceSource}</span>
                        )}
                      </p>
                      {mainPrice !== null ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-light" style={{ color: '#888888' }}>HKD</span>
                          <span
                            style={{
                              fontFamily: "'Playfair Display', Georgia, serif",
                              fontSize: 'clamp(32px, 5vw, 52px)',
                              fontWeight: 700,
                              color: '#FFFFFF',
                              lineHeight: 1,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {mainPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>N/A</p>
                      )}
                      {mainPriceRecordCount > 0 && (
                        <p className="text-[9px] mt-1.5" style={{ color: '#555555' }}>
                          {isSealedProduct
                            ? t("cardDetail.basedOnRecentWeightedAvg", { n: mainPriceRecordCount })
                            : t("cardDetail.basedOnNRecords", { n: mainPriceRecordCount })
                          }
                        </p>
                      )}
                    </div>
                    {priceTrend && (
                      <div className={`flex flex-col items-end gap-0.5 ${priceTrend.isIncrease ? '' : priceTrend.isDecrease ? '' : ''}`}>
                        <div
                          className="flex items-center gap-1 text-sm font-semibold"
                          style={{ color: priceTrend.isIncrease ? '#2ecc71' : priceTrend.isDecrease ? '#8B1A1A' : '#888888' }}
                        >
                          {priceTrend.isIncrease ? <TrendingUp className="w-4 h-4" /> : priceTrend.isDecrease ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          <span>{Math.abs(priceTrend.change).toFixed(1)}%</span>
                        </div>
                        <p className="text-[9px]" style={{ color: '#555555' }}>{t("cardDetail.trend7days")}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 輔助資訊：3 欄小數據 */}
                <div className="grid grid-cols-3 divide-x" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', '--tw-divide-opacity': '0.06' } as React.CSSProperties}>

                  {/* 小欄 1: 短期加權均價 */}
                  <div className="px-3 py-4 text-center flex flex-col gap-1">
                    <p className="text-[8px] uppercase tracking-[0.15em]" style={{ color: '#555555' }}>
                      {isSealedProduct ? t("cardDetail.latestTrade") : t("cardDetail.weighted7dAvg")}
                    </p>
                    {!isSealedProduct ? (
                      auxPrice !== null ? (
                        <>
                          <p className="text-sm font-semibold" style={{ color: '#E5E5E5' }}>
                            {auxPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          <p className="text-[8px]" style={{ color: '#444444' }}>{t("cardDetail.nRecords", { n: auxPriceRecordCount })}</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold" style={{ color: '#444444' }}>-</p>
                      )
                    ) : (
                      latestTradePrice !== null ? (
                        <>
                          <p className="text-sm font-semibold" style={{ color: '#E5E5E5' }}>
                            {latestTradePrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                          {latestTrade?.soldAt && (
                            <p className="text-[8px]" style={{ color: '#444444' }}>
                              {new Date(latestTrade.soldAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                            </p>
                          )}
                        </>
                      ) : <p className="text-sm font-semibold" style={{ color: '#444444' }}>N/A</p>
                    )}
                  </div>

                  {/* 小欄 2: 最近單筆成交 */}
                  <div className="px-3 py-4 text-center flex flex-col gap-1">
                    <p className="text-[8px] uppercase tracking-[0.15em]" style={{ color: '#555555' }}>
                      {isSealedProduct ? t("cardDetail.recentTotalAmount") : t("cardDetail.recentSingle")}
                    </p>
                    {latestTrade !== null ? (
                      <>
                        <p className="text-sm font-semibold" style={{ color: '#E5E5E5' }}>
                          {isSealedProduct
                            ? parseFloat(latestTrade.price as any).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : (latestTradePrice !== null && !isNaN(latestTradePrice)
                                ? latestTradePrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                : 'N/A')
                          }
                        </p>
                        {isSealedProduct && latestTrade.quantity && (
                          <p className="text-[8px]" style={{ color: '#444444' }}>
                            {t("cardDetail.nBoxes", { n: latestTrade.quantity })}
                          </p>
                        )}
                        {latestTrade?.soldAt && (
                          <p className="text-[8px]" style={{ color: '#444444' }}>
                            {new Date(latestTrade.soldAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-semibold" style={{ color: '#444444' }}>N/A</p>
                    )}
                  </div>

                  {/* 小欄 3: 30 天價格帶 */}
                  <div className="px-3 py-4 text-center flex flex-col gap-1">
                    {!isSealedProduct && p25 !== null && p75 !== null ? (
                      <>
                        <p className="text-[8px] uppercase tracking-[0.15em]" style={{ color: '#555555' }}>{t("cardDetail.priceRange30d")}</p>
                        <p className="text-sm font-semibold" style={{ color: '#2ecc71' }}>
                          {p25.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[8px]" style={{ color: '#444444' }}>↕</p>
                        <p className="text-sm font-semibold" style={{ color: '#E5E5E5' }}>
                          {p75.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-[8px]" style={{ color: '#444444' }}>P25 / P75</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[8px] uppercase tracking-[0.15em]" style={{ color: '#555555' }}>{t("cardDetail.highestTrade")}</p>
                        {maxPrice !== null ? (
                          <p className="text-sm font-semibold" style={{ color: '#E5E5E5' }}>
                            {maxPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        ) : <p className="text-sm font-semibold" style={{ color: '#444444' }}>N/A</p>}
                      </>
                    )}
                  </div>

                </div>

                {/* Footer note */}
                <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-[9px]" style={{ color: '#444444' }}>
                    {isSealedProduct
                      ? t("cardDetail.sealedPriceNote", { n: mainPriceRecordCount })
                      : t("cardDetail.medianNote", { n: mainPriceRecordCount, source: mainPriceSource })
                    }
                    {priceTrend && <span className="ml-1">· {t("cardDetail.priceTrend")}</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Price History Table (non-TCGdex cards / SNKRDUNK only) ── */}
        {!isTcgdexCard && <div className="rounded-xl overflow-hidden mb-4 sm:mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>
                SNKRDUNK · {t("cardDetail.actualPriceHistory")}
              </h3>
              {priceLoading && activeGrade && (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#666666' }} />
              )}
            </div>
            {/* Grade Filter - single cards only — editorial pill buttons */}
            {!isSealedProduct && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {GRADE_KEYS.map((gradeKey) => {
                  const gradeLabel = gradeKey === "used" ? t("cardDetail.gradeUsed") : gradeKey;
                  const isActive = activeGrade === gradeKey;
                  return (
                  <button
                    key={gradeKey}
                    onClick={() => setActiveGrade(activeGrade === gradeKey ? null : gradeKey)}
                    disabled={priceLoading}
                    className="relative text-[10px] font-mono transition-all duration-200"
                    style={{
                      padding: '3px 8px',
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: '2px',
                      color: isActive ? '#FFFFFF' : '#666666',
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      opacity: priceLoading ? 0.5 : 1,
                      cursor: priceLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isActive && priceLoading && (
                      <span className="absolute inset-0 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    )}
                    {gradeLabel}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
          {activePriceLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#555555' }} />
              {activeGrade && (
                <p className="text-[10px] animate-pulse" style={{ color: '#555555' }}>
                  {t("cardDetail.loadingGradeRecords", { grade: activeGrade })}
                </p>
              )}
            </div>
          ) : activePriceHistory.length > 0 ? (
            <div className="overflow-y-auto max-h-80 px-4 py-3">
              {/* Timeline card flow */}
              <div className="relative">
                {/* Vertical timeline line */}
                <div
                  className="absolute left-[5px] top-2 bottom-2 w-px"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                />
                <div className="flex flex-col gap-0">
                  {activePriceHistory.map((item, index) => {
                    const displayValue = isSealedProduct ? (item.quantity || '-') : (item.quantity || item.grade);
                    const isEmpty = !displayValue;
                    const unitPrice = isSealedProduct ? getSealedUnitPrice(item) : null;
                    const qty = isSealedProduct ? parseQuantity(item.quantity) : 0;
                    return (
                      <div
                        key={index}
                        className="relative pl-5 py-2.5 flex items-center justify-between group"
                        style={{ borderBottom: index < activePriceHistory.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      >
                        {/* Timeline dot */}
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border"
                          style={{
                            background: '#111215',
                            borderColor: 'rgba(255,255,255,0.2)',
                            zIndex: 1,
                          }}
                        />
                        {/* Date */}
                        <span className="text-[10px] font-mono w-16 flex-shrink-0" style={{ color: '#555555' }}>
                          {item.soldAt ? formatDate(item.soldAt) : 'N/A'}
                        </span>
                        {/* Grade / Qty badge */}
                        <span
                          className="text-[9px] font-mono mx-2"
                          style={{
                            padding: '1px 5px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '2px',
                            color: isEmpty ? '#444444' : '#999999',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {isEmpty ? (isSealedProduct ? '-' : t("cardDetail.usedGrade")) : displayValue}
                        </span>
                        {/* Price */}
                        <div className="flex flex-col items-end ml-auto">
                          <span className="text-xs font-semibold" style={{ color: '#E5E5E5' }}>
                            {formatCurrency(item.price)}
                          </span>
                          {isSealedProduct && unitPrice !== null && qty > 1 && (
                            <span className="text-[9px]" style={{ color: '#2ecc71' }}>
                              {formatCurrency(unitPrice)}/{t("cardDetail.perBox", "每盒")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm" style={{ color: '#555555' }}>
                {isSealedProduct ? t("cardDetail.noSealedData") : t("cardDetail.noGradeData")}
              </p>
            </div>
                    )}
        </div>}
        {/* ── eBay Sold History (single cards only) ── */}
        {!isSealedProduct && (
          <div className="rounded-xl overflow-hidden mb-4 sm:mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>
                  eBay · {t("cardDetail.actualPriceHistory")}
                </h3>
                <span
                  className="text-[9px] font-mono"
                  style={{
                    padding: '1px 5px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '2px',
                    color: '#666666',
                    letterSpacing: '0.1em',
                  }}
                >
                  PSA 10
                </span>
              </div>
              {ebayPriceHistory.length > 0 && (
                <span className="text-[9px] font-mono" style={{ color: '#555555' }}>
                  {t("cardDetail.nRecords", { n: ebayPriceHistory.length })}
                </span>
              )}
            </div>
            {ebayHistoryLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#555555' }} />
              </div>
            ) : ebayPriceHistory.length > 0 ? (
              <div className="overflow-y-auto max-h-80 px-4 py-3">
                {/* Timeline card flow */}
                <div className="relative">
                  <div
                    className="absolute left-[5px] top-2 bottom-2 w-px"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  />
                  <div className="flex flex-col gap-0">
                    {ebayPriceHistory.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="relative pl-5 py-2.5 flex items-center gap-2 group"
                        style={{ borderBottom: index < ebayPriceHistory.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}
                      >
                        {/* Timeline dot */}
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border"
                          style={{ background: '#111215', borderColor: 'rgba(255,255,255,0.2)', zIndex: 1 }}
                        />
                        {/* Date */}
                        <span className="text-[10px] font-mono w-16 flex-shrink-0" style={{ color: '#555555' }}>
                          {item.soldAt ? formatDate(item.soldAt) : 'N/A'}
                        </span>
                        {/* Title */}
                        <div className="flex-1 min-w-0 hidden sm:block">
                          {item.listingUrl ? (
                            <a
                              href={item.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 group/link"
                            >
                              <span className="text-[10px] line-clamp-1 transition-colors" style={{ color: '#666666' }}>
                                {item.title || '—'}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" style={{ color: '#888888' }} />
                            </a>
                          ) : (
                            <span className="text-[10px] line-clamp-1" style={{ color: '#555555' }}>{item.title || '—'}</span>
                          )}
                        </div>
                        {/* Price */}
                        <span className="text-xs font-semibold ml-auto flex-shrink-0" style={{ color: '#E5E5E5' }}>
                          {formatCurrency(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: '#555555' }}>{t("cardDetail.noEbayData")}</p>
                <p className="text-xs mt-1" style={{ color: '#444444' }}>{t("cardDetail.ebayDataComingSoon", "eBay 成交記錄將由 GitHub Actions 定期更新")}</p>
              </div>
            )}
            {ebayPriceHistory.length > 0 && (
              <div className="px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <p className="text-[9px]" style={{ color: '#444444' }}>
                  {t("cardDetail.ebayDataNote", "eBay PSA 10 已成交記錄，由 GitHub Actions 定期爬取更新")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TCGPlayer / Cardmarket Market Price (TCGdex-sourced cards only) ── */}
        {isTcgdexCard && (
          <div className="rounded-xl overflow-hidden mb-4 sm:mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#999999' }}>
                  TCGPlayer / Cardmarket · 市場參考價
                </h3>
                {tcgPriceLoading && (
                  <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#666666' }} />
                )}
              </div>
              <span className="text-[9px] font-mono" style={{ color: '#555555' }}>未分級原版</span>
            </div>
            {tcgPriceLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#555555' }} />
              </div>
            ) : !tcgMarketPrice ? (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: '#555555' }}>暫無市場價格資料</p>
              </div>
            ) : (
              <div className="p-4">
                {/* Exchange rate constants: USD→HKD ≈ 7.8, EUR→HKD ≈ 8.5 */}
                {(() => {
                  const USD_TO_HKD = 7.8;
                  const EUR_TO_HKD = 8.5;
                  const p = tcgMarketPrice as any;
                  const fmtUsd = (v: any) => `HKD ${(Number(v) * USD_TO_HKD).toFixed(0)}`;
                  const fmtEur = (v: any) => `HKD ${(Number(v) * EUR_TO_HKD).toFixed(0)}`;
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      {/* TCGPlayer */}
                      {(p.tcgLow != null || p.tcgMid != null || p.tcgMarket != null) && (
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#666666' }}>TCGPlayer</p>
                          <p className="text-[9px] mb-3" style={{ color: '#444444' }}>USD → HKD (×{USD_TO_HKD})</p>
                          <div className="space-y-2">
                            {p.tcgLow != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>Low</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtUsd(p.tcgLow)}</span>
                              </div>
                            )}
                            {p.tcgMid != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>Mid</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtUsd(p.tcgMid)}</span>
                              </div>
                            )}
                            {p.tcgMarket != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>Market</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#F5C518' }}>{fmtUsd(p.tcgMarket)}</span>
                              </div>
                            )}
                            {p.tcgHigh != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>High</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtUsd(p.tcgHigh)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Cardmarket */}
                      {(p.cmAvg != null || p.cmTrend != null) && (
                        <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#666666' }}>Cardmarket</p>
                          <p className="text-[9px] mb-3" style={{ color: '#444444' }}>EUR → HKD (×{EUR_TO_HKD})</p>
                          <div className="space-y-2">
                            {p.cmAvg != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>Avg</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtEur(p.cmAvg)}</span>
                              </div>
                            )}
                            {p.cmTrend != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>Trend</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#F5C518' }}>{fmtEur(p.cmTrend)}</span>
                              </div>
                            )}
                            {p.cmAvg7 != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>7-day Avg</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtEur(p.cmAvg7)}</span>
                              </div>
                            )}
                            {p.cmAvg30 != null && (
                              <div className="flex justify-between items-center">
                                <span className="text-[11px]" style={{ color: '#888888' }}>30-day Avg</span>
                                <span className="text-sm font-mono font-semibold" style={{ color: '#E5E5E5' }}>{fmtEur(p.cmAvg30)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {tcgMarketPrice.updatedAt && (
                  <p className="text-[9px] mt-3" style={{ color: '#444444' }}>
                    更新時間：{new Date(tcgMarketPrice.updatedAt).toLocaleDateString('zh-HK')} · 資料來源：TCGdex API · 未分級原版卡市場參考價，非 PSA 鑑定價
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {/* ── Price Trend Chart ── */}
        <div className="mb-4 sm:mb-6 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                {t("cardDetail.ebayListings")}
              </h3>
              {!ebayLoading && (
                <span className="text-xs text-zinc-500">{t("cardDetail.sortedByPrice")}</span>
              )}
            </div>
            <button
              onClick={() => refetchEbay()}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t("common.refresh")}
            </button>
          </div>

          {/* Content */}
          {ebayLoading ? (
            <div className="py-12 flex items-center justify-center bg-zinc-900/30">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-sm text-zinc-400">{t("cardDetail.searchingEbay")}</span>
            </div>
          ) : ebayListings.length === 0 ? (
            <div className="py-12 text-center bg-zinc-900/30">
              <ShoppingCart className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">{t("cardDetail.noEbayListings")}</p>
              <p className="text-zinc-600 text-xs mt-1">{t("cardDetail.tryRefreshLater")}</p>
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
                        {t("cardDetail.seller")}: {item.seller}
                      </p>
                    )}
                    <div className="mt-auto pt-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-medium group-hover:text-blue-300">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {t("cardDetail.goToBuy")}
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
                {t("cardDetail.ebayListingsSummary", { count: ebayListings.length })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Similar Cards Section */}
      {!isSealedProduct && cardId && (
        <SimilarCardsSection cardId={cardId} series={product.series ?? null} setName={product.setName ?? null} cardName={product.name ?? ''} />
      )}
    </div>{/* closes z-10 wrapper */}
    </div>{/* closes min-h-screen */}

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
  const { t } = useTranslation();
  // Display the set name or series as section subtitle
  const sectionLabel = setName || series || (cardName ? cardName.split(/[\s\[\(]/)[0] : null);
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
          <h3 className="text-base font-semibold text-white">{t("cardDetail.sameSeriesCards")}</h3>
          {sectionLabel && <span className="text-xs text-zinc-500 ml-1">{sectionLabel}</span>}
        </div>
        <button
          onClick={() => setLocation(`/search?q=${encodeURIComponent(sectionLabel ?? '')}`)}
          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors flex items-center gap-1 font-medium"
        >
          {t("common.viewMore")}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" role="list" aria-label={t("cardDetail.sameSeriesCardsList")}>
        {similarCards.map((card: any) => (
          <a
            key={card.id}
            href={`/card/${card.id}`}
            onClick={(e) => { e.preventDefault(); setLocation(`/card/${card.id}`); }}
            className="group flex flex-col gap-2 text-left hover:scale-[1.03] transition-transform duration-200"
            title={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} ${t("cardDetail.priceInfo")}`}
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800">
              {card.imageUrl ? (
                <img
                  src={getProxiedImageUrl(card.imageUrl) ?? ""}
                  alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} ${t("cardDetail.cardImage")}`}
                  className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-zinc-600 text-xs">{t("common.noImage")}</span>
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
