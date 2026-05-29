import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { ExternalLink, Loader2, AlertCircle, RefreshCw, ArrowLeft, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";

interface PricingItem {
  id: string;
  title: string;
  price: number;
  currency: string;
  imageUrl: string;
  source: "ebay" | "snkrdunk";
  buyUrl: string;
  seller?: string;
  condition?: string;
}

// Grade sort order (higher = shown first)
const GRADE_SORT_ORDER: Record<string, number> = {
  "PSA 10": 100, "PSA10": 100,
  "PSA 9": 90, "PSA9": 90,
  "PSA 8": 80, "PSA8": 80,
  "PSA 7": 70, "PSA7": 70,
  "PSA 6": 60, "PSA6": 60,
  "PSA 5": 50, "PSA5": 50,
  "PSA 4": 40, "PSA4": 40,
  "PSA 3": 30, "PSA3": 30,
  "PSA 2": 20, "PSA2": 20,
  "PSA 1": 10, "PSA1": 10,
  "BGS 10": 95, "BGS10": 95,
  "BGS 9.5": 85, "BGS9.5": 85,
  "BGS 9": 75, "BGS9": 75,
  "BGS 8.5": 65, "BGS8.5": 65,
  "BGS 8": 55, "BGS8": 55,
  "A": 45,
  "B": 35,
  "C": 25,
  "D": 15,
  "Used": 5,
  "other": 0,
};

// Normalize condition string to a canonical filter key
function normalizeCondition(condition?: string): string {
  if (!condition) return "other";
  const c = condition.trim().toUpperCase();
  // PSA grades: PSA10, PSA 10, PSA10GL, etc.
  const psaMatch = c.match(/^PSA\s*(\d+(?:\.\d+)?)/);
  if (psaMatch) return `PSA${psaMatch[1]}`;
  // BGS grades: BGS9.5, BGS 9.5, etc.
  const bgsMatch = c.match(/^BGS\s*(\d+(?:\.\d+)?)/);
  if (bgsMatch) return `BGS${bgsMatch[1]}`;
  // SGC grades
  const sgcMatch = c.match(/^SGC\s*(\d+(?:\.\d+)?)/);
  if (sgcMatch) return `SGC${sgcMatch[1]}`;
  // ARS grades (SNKRDUNK internal)
  const arsMatch = c.match(/^ARS\s*(\d+(?:\.\d+)?)/);
  if (arsMatch) return `ARS${arsMatch[1]}`;
  // SNKRDUNK A/B/C/D grades
  if (c === "A" || c === "A品") return "A";
  if (c === "B" || c === "B品") return "B";
  if (c === "C" || c === "C品") return "C";
  if (c === "D" || c === "D品") return "D";
  // eBay used/ungraded
  if (c === "USED" || c === "UNGRADED" || c === "GRADED") return "Used";
  // Fallback: return the original trimmed value so it still shows as a filter
  return condition.trim();
}

// Get display label for a normalized grade key
function getGradeLabel(key: string): string {
  if (key === "Used") return "中古";
  if (key === "A") return "A品";
  if (key === "B") return "B品";
  if (key === "C") return "C品";
  if (key === "D") return "D品";
  // PSA10 → PSA 10, BGS9.5 → BGS 9.5, etc.
  const psaMatch = key.match(/^PSA(\d+(?:\.\d+)?)$/);
  if (psaMatch) return `PSA ${psaMatch[1]}`;
  const bgsMatch = key.match(/^BGS(\d+(?:\.\d+)?)$/);
  if (bgsMatch) return `BGS ${bgsMatch[1]}`;
  const sgcMatch = key.match(/^SGC(\d+(?:\.\d+)?)$/);
  if (sgcMatch) return `SGC ${sgcMatch[1]}`;
  const arsMatch = key.match(/^ARS(\d+(?:\.\d+)?)$/);
  if (arsMatch) return `ARS ${arsMatch[1]}`;
  return key;
}

export default function PricingDetail() {
  const { t } = useTranslation();
  const { data: user } = trpc.auth.me.useQuery();
  const [, params] = useRoute("/pricing/:id");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const idParam = params?.id;
  const cardId = idParam ? parseInt(idParam, 10) : null;

  // If this is a sealed product, redirect to the sealed product detail page
  const typeParam = new URLSearchParams(searchString).get("type");
  const isSealedProductRedirect = typeParam === "sealed_product" && !!idParam;

  useEffect(() => {
    if (isSealedProductRedirect) {
      setLocation(`/sealed-product/${idParam}`, { replace: true });
    }
  }, [isSealedProductRedirect, idParam, setLocation]);

  // Active grade filter - default to "all"
  const [activeGrade, setActiveGrade] = useState<string>("all");

  // Admin: clear cache mutation
  const clearCacheMutation = trpc.pricing.clearCache.useMutation({
    onSuccess: () => {
      toast.success("快取已清除，正在重新抓取最新資料...");
      refetch();
    },
    onError: (err) => {
      toast.error(`清除失敗: ${err.message}`);
    },
  });

  // Fetch pricing data (eBay + SNKRDUNK) - use database ID
  // Do NOT fetch if this is a sealed product redirect (wrong ID would be used)
  // retry: 3 with exponential backoff to handle cold-start timeouts (eBay 15s + SNKRDUNK 75s)
  const { data: pricingData, isLoading: pricingLoading, refetch, error: pricingError, isFetching } = trpc.pricing.getListings.useQuery(
    { cardId: cardId! },
    { 
      enabled: !!cardId && !isSealedProductRedirect, 
      retry: 3,
      retryDelay: (attempt) => Math.min(2000 * Math.pow(2, attempt), 15000), // 2s, 4s, 8s
      staleTime: 30 * 60 * 1000, // 30 minutes cache
      gcTime: 60 * 60 * 1000, // 1 hour
    }
  );
  
  // Extract card info from pricing data
  const card = pricingData?.card;
  const cardLoading = pricingLoading;
  const cardError = pricingError;

  const handleRefresh = () => {
    refetch();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/pricing");
    }
  };

  const handleViewDetail = () => {
    if (card?.id) {
      setLocation(`/card/${card.id}`);
    }
  };

  // Filter listings by active grade
  const filteredListings = useMemo(() => {
    const all = pricingData?.listings || [];
    if (activeGrade === "all") return all;
    return all.filter((item) => normalizeCondition(item.condition) === activeGrade);
  }, [pricingData?.listings, activeGrade]);

  // Calculate price statistics for the filtered listings
  const filteredPrices = filteredListings.map((item) => item.price);
  const lowestPrice = filteredPrices.length > 0 ? Math.min(...filteredPrices) : 0;
  const highestPrice = filteredPrices.length > 0 ? Math.max(...filteredPrices) : 0;
  const averagePrice = filteredPrices.length > 0
    ? filteredPrices.reduce((sum, price) => sum + price, 0) / filteredPrices.length
    : 0;

  // Dynamically compute which grades have listings, sorted by importance
  const availableGrades = useMemo(() => {
    const all = pricingData?.listings || [];
    const gradeCountMap = new Map<string, number>();
    for (const item of all) {
      const key = normalizeCondition(item.condition);
      gradeCountMap.set(key, (gradeCountMap.get(key) || 0) + 1);
    }
    // Sort by GRADE_SORT_ORDER descending; unknown grades go after known ones alphabetically
    return Array.from(gradeCountMap.entries())
      .sort(([a], [b]) => {
        const orderA = GRADE_SORT_ORDER[a] ?? 1;
        const orderB = GRADE_SORT_ORDER[b] ?? 1;
        if (orderB !== orderA) return orderB - orderA;
        return a.localeCompare(b);
      })
      .map(([key, count]) => ({ key, label: getGradeLabel(key), count }));
  }, [pricingData?.listings]);

  if (cardLoading || (isFetching && !pricingData)) {
    return (
      <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8 animate-pulse">
        {/* Skeleton breadcrumb */}
        <div className="h-4 w-48 bg-muted rounded mb-6" />
        {/* Skeleton back/view buttons */}
        <div className="flex gap-2 mb-4">
          <div className="h-9 w-20 bg-muted rounded" />
          <div className="h-9 w-28 bg-muted rounded" />
        </div>
        {/* Skeleton card header */}
        <div className="bg-card rounded-lg border border-border p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 aspect-[3/4] bg-muted rounded-lg" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="grid grid-cols-3 gap-4 mt-6">
                {[0,1,2].map(i => <div key={i} className="bg-muted rounded-lg h-20" />)}
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton listings */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="aspect-square bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-5 bg-muted rounded w-1/2 mt-1" />
                <div className="h-8 bg-muted rounded w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center mt-6 gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t("pricing.loading")}</span>
        </div>
      </div>
    );
  }

  if (pricingError && !isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">{t("pricing.loadError") || "載入失敗，請重試"}</p>
          <p className="text-xs text-muted-foreground/60 mb-4">{pricingError?.message}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleBack}>
              {t("common.back")}
            </Button>
            <Button onClick={() => refetch()} style={{ backgroundColor: '#0804b3', color: 'white' }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("pricing.retry") || "重試"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{t("pricing.cardNotFound")}</p>
          <Button onClick={handleBack} className="mt-4">
            {t("common.back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <PageHead
      title={`${card.name} PSA 10 市場格價 - BOXIUM TCG`}
      description={`查看 ${card.name} 的 PSA 10 市場列價，整合 SNKRDUNK 及 eBay 即時成交資料。`}
      ogImage={card.imageUrl ? getProxiedImageUrl(card.imageUrl) ?? undefined : undefined}
    />
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
      {/* Breadcrumb */}
      <Breadcrumb 
        items={[
          { label: t("common.home"), href: "/" },
          { label: t("common.pricing"), href: "/pricing" },
          { label: card.name }
        ]}
      />

      {/* Back Button and View Detail Button */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="ghost"
          onClick={handleBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("common.back")}
        </Button>
        <Button
          onClick={handleViewDetail}
          style={{ backgroundColor: '#0804b3', color: 'white' }}
          className="hover:opacity-90"
        >
          {t("pricing.viewDetail")}
        </Button>
      </div>

      {/* Card Header */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Card Image */}
          <div className="w-full md:w-64 flex-shrink-0">
            <img
              src={getProxiedImageUrl(card.imageUrl) ?? "https://via.placeholder.com/256x352?text=No+Image"}
              alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像${card.series ? ` - ${card.series}` : ''}`}
              className="w-full rounded-lg shadow-lg"
            />
          </div>

          {/* Card Info */}
          <div className="flex-1">
            <h1 className="text-base sm:text-xl font-bold text-foreground mb-2">{card.name}</h1>
            {card.nameJa && (
              <p className="text-sm sm:text-base text-muted-foreground mb-2">{card.nameJa}</p>
            )}
            {card.cardNumber && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                {t("pricing.cardNumber")}: {card.cardNumber}
              </p>
            )}
            {card.series && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                {t("pricing.series")}: {card.series}
              </p>
            )}

            {/* Price Statistics - dynamic based on active grade filter */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t("pricing.lowestPrice")}</p>
                <p className="text-sm sm:text-lg font-bold text-green-500">
                  {lowestPrice > 0 ? formatCurrency(lowestPrice) : "N/A"}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t("pricing.averagePrice")}</p>
                <p className="text-sm sm:text-lg font-bold text-primary">
                  {averagePrice > 0 ? formatCurrency(averagePrice) : "N/A"}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t("pricing.highestPrice")}</p>
                <p className="text-sm sm:text-lg font-bold text-red-500">
                  {highestPrice > 0 ? formatCurrency(highestPrice) : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Listings Header with Grade Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base sm:text-xl font-bold text-foreground mr-2">
            {activeGrade === "all"
              ? t("pricing.allListings")
              : `${getGradeLabel(activeGrade)} 在售商品（按{t("pricingDetail.price")}排序）`}
          </h2>
          {/* Grade filter buttons - dynamically show only grades with listings */}
          <div className="flex flex-wrap gap-1.5">
            {/* "All" button always shown */}
            <button
              onClick={() => setActiveGrade("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                activeGrade === "all"
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-muted border-border text-foreground hover:border-primary/50 hover:text-primary"
              }`}
            >
              全部
            </button>
            {/* Dynamic grade buttons - only show grades that have listings */}
            {availableGrades.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setActiveGrade(key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                  activeGrade === key
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : "bg-muted border-border text-foreground hover:border-primary/50 hover:text-primary"
                }`}
              >
                {label}
                <span className="ml-1 text-[10px] opacity-70">({count})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && cardId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearCacheMutation.mutate({ cardId })}
              disabled={clearCacheMutation.isPending}
              className="text-orange-500 border-orange-500/50 hover:bg-orange-500/10"
              title="清除快取並重新抓取"
            >
              <Trash2 className={`w-4 h-4 mr-1 ${clearCacheMutation.isPending ? "animate-spin" : ""}`} />
              清除快取
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pricingLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${pricingLoading ? "animate-spin" : ""}`} />
            {t("pricing.refresh")}
          </Button>
        </div>
      </div>

      {/* Listings Grid */}
      {pricingLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{t("pricing.loadingListings")}</span>
        </div>
      ) : filteredListings.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {filteredListings.map((item: PricingItem) => (
            <div
              key={item.id}
              className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Item Image */}
              <div className="aspect-square relative bg-muted">
                <img
                  src={getProxiedImageUrl(item.imageUrl) ?? "https://via.placeholder.com/300?text=No+Image"}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {/* Source Badge */}
                <div className="absolute top-2 right-2">
                  {item.source === "ebay" ? (
                    <div className="bg-white rounded px-2 py-1 shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg">
                      <img 
                        src="/ebay-logo.png" 
                        alt="eBay" 
                        className="h-6 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-white rounded px-2 py-1 shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg">
                      <img 
                        src="/snkrdunk-logo.png" 
                        alt="SNKRDUNK" 
                        className="h-6 w-auto object-contain"
                      />
                    </div>
                  )}
                </div>
                {/* Condition Badge */}
                {item.condition && (
                  <div className="absolute top-2 left-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      normalizeCondition(item.condition) === "PSA10" || normalizeCondition(item.condition) === "PSA 10"
                        ? "bg-blue-600 text-white"
                        : normalizeCondition(item.condition) === "A"
                        ? "bg-green-600 text-white"
                        : normalizeCondition(item.condition) === "B"
                        ? "bg-yellow-500 text-black"
                        : normalizeCondition(item.condition) === "C"
                        ? "bg-orange-500 text-white"
                        : normalizeCondition(item.condition) === "D"
                        ? "bg-red-600 text-white"
                        : "bg-zinc-700 text-zinc-200"
                    }`}>
                      {item.condition}
                    </span>
                  </div>
                )}
              </div>

              {/* Item Info */}
              <div className="p-2 sm:p-3 md:p-4">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
                  {item.title}
                </h3>
                
                {/* Price */}
                <p className="text-sm sm:text-lg md:text-xl font-bold text-primary mb-1 sm:mb-2">
                  {formatCurrency(item.price)}
                </p>

                {/* Seller Info */}
                {item.seller && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1 line-clamp-1">
                    {t("pricing.seller")}: {item.seller}
                  </p>
                )}

                {/* Buy Button */}
                <BrandButton
                  size="sm"
                  className="w-full text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 py-1 sm:py-1.5 h-auto"
                  onClick={() => window.open(item.buyUrl, "_blank")}
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{t("pricing.buyNow")}</span>
                  <span className="sm:hidden">{t("pricing.buy")}</span>
                </BrandButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {activeGrade === "all" 
                ? t("pricing.noListings") 
                : `暫無 ${getGradeLabel(activeGrade)} 在售商品`
              }
            </p>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
