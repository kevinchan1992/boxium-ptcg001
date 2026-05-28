import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShoppingBag, Tag, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import { getProxiedImageUrl } from "@/lib/utils";

const ITEMS_PER_PAGE = 40;

export default function PricingSearch() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const query = params.get("q") || "";
  // Read page from URL param so browser back/forward restores it
  const pageFromUrl = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  // IMPORTANT: initialise searchQuery from URL query directly.
  // Do NOT sync searchQuery from URL after mount — this prevents the dropdown
  // from re-opening when the URL changes after a search submission.
  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCameraSheet, setShowCameraSheet] = useState(false);
  const refreshTriggeredRef = useRef<string>(""); // track query+page to avoid duplicate triggers

  // Sync the visible input text when the user navigates back/forward (URL changes)
  // but NOT when the component first mounts from a search submission.
  const prevQueryRef = useRef(query);
  useEffect(() => {
    // Only sync if the URL query actually changed (e.g., browser back/forward)
    if (query !== prevQueryRef.current) {
      prevQueryRef.current = query;
      setSearchQuery(query);
    }
  }, [query]);

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Fetch search results from database (with pagination)
  // NOTE: grade filter parsing happens server-side in cards.search (pricing-only logic)
  //
  // Reliability improvements for slow/cold-start responses:
  // - retry: 2 → retries twice on failure (handles cold-start timeouts)
  // - retryDelay: exponential backoff starting at 2s (gives server time to warm up)
  // - staleTime: 60s → prevents unnecessary refetches when navigating back
  // - gcTime: 5min → keeps data in cache longer for back/forward navigation
  const { data: searchData, isLoading, isFetching, error, refetch } = trpc.cards.search.useQuery(
    { query: query || "", limit: ITEMS_PER_PAGE, offset },
    {
      enabled: !!query,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(2000 * Math.pow(2, attemptIndex), 10000),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }
  );

  // Extract cards array and grade label from response
  const searchResults = searchData?.cards || [];
  const total = searchData?.total || 0;
  const sealedCount = (searchData as any)?.sealedCount || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  // gradeLabel is returned by the server when a grade keyword was detected (e.g. "BGS 9.5")
  const gradeLabel: string | null = (searchData as any)?.gradeLabel ?? null;

  // Get card IDs for lowest listing price query
  const cardIds = useMemo(() => searchResults.map((c: any) => c.id), [searchResults]);

  // Batch query lowest active listing prices (from SNKRDUNK cache)
  const { data: lowestPricesData, refetch: refetchPrices } = trpc.cards.getLowestListingPrices.useQuery(
    { cardIds },
    { enabled: cardIds.length > 0 }
  );
  const lowestPrices: Record<number, number> = lowestPricesData?.prices || {};

  // Background cache refresh mutation (stale-while-revalidate)
  const triggerRefresh = trpc.cards.triggerCacheRefresh.useMutation();

  // When search results load, trigger background cache refresh for cards without fresh cache
  useEffect(() => {
    if (cardIds.length === 0 || isLoading) return;
    const triggerKey = `${query}-${currentPage}`;
    if (refreshTriggeredRef.current === triggerKey) return; // already triggered for this page
    refreshTriggeredRef.current = triggerKey;

    // Determine which cards don't have a cached price yet
    const uncachedIds = cardIds.filter((id: number) => lowestPrices[id] === undefined);
    if (uncachedIds.length === 0) return;

    // Trigger background scraping for all uncached cards on the page (up to 50)
    const batchToRefresh = uncachedIds.slice(0, 50);
    setIsRefreshing(true);
    triggerRefresh.mutate(
      { cardIds: batchToRefresh },
      {
        onSettled: () => {
          setTimeout(() => {
            refetchPrices();
            setIsRefreshing(false);
          }, 8000);
        },
      }
    );
  }, [cardIds, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardClick = (card: any) => {
    if (card.productType === 'sealed_product') {
      setLocation(`/sealed-product/${card.id}`);
    } else {
      setLocation(`/pricing/${card.id}`);
    }
  };

  const goToPage = (page: number) => {
    const newParams = new URLSearchParams();
    newParams.set("q", query);
    if (page > 1) newParams.set("page", String(page));
    setLocation(`/pricing/search?${newParams.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // Determine the display state:
  // - isLoading: initial load (no data yet, first fetch)
  // - isFetching && !isLoading: background refetch (show stale data with subtle indicator)
  // - error && !searchData: failed with no cached data → show error with retry
  // - error && searchData: failed but have stale data → show stale data with warning
  const showSkeleton = isLoading;
  const showError = !!error && !searchData;
  const hasResults = !showSkeleton && !showError && searchResults.length > 0;
  const showEmpty = !showSkeleton && !showError && searchResults.length === 0 && !!query;

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t("common.home"), href: "/" },
          { label: t("common.pricing"), href: "/pricing" },
          { label: t("pricing.searchResults") }
        ]}
      />

      {/* Search Bar with Dropdown */}
      <div className="mb-8 max-w-2xl">
        <CardSearchDropdown
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={(q) => {
            if (q.trim()) setLocation(`/pricing/search?q=${encodeURIComponent(q)}`);
          }}
          cardLinkPrefix="pricing"
          inputClassName="py-6 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
          placeholder={t("pricing.searchPlaceholder")}
          showCameraButton
          onCameraClick={() => setShowCameraSheet(true)}
        />
      </div>

      {/* Camera Search Sheet */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
        cardLinkPrefix="pricing"
      />

      {/* Results Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-foreground">
            {t("pricing.searchResultsFor")}: "{query}"
          </h2>
          {/* Background refresh indicator */}
          {isRefreshing && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 items-center">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-muted-foreground">更新在售價格中</span>
            </div>
          )}
          {/* Background refetch indicator (when stale data is shown) */}
          {isFetching && !isLoading && (
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground">{t("pricing.searching")}</span>
            </div>
          )}
        </div>

        {/* Grade filter badge — only shown when a grade keyword was detected */}
        {gradeLabel && !isLoading && (
          <div className="flex items-center gap-2 mt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-sm font-medium">
              <Tag className="w-3.5 h-3.5" />
              <span>品相過濾：{gradeLabel} 在售商品</span>
            </div>
            <button
              onClick={() => {
                // Strip the grade keyword from the query and re-search
                const stripped = query.replace(
                  /\b(psa\s*\d+(\.\d+)?|bgs\s*\d+(\.\d+)?|ars\s*\d+\+?|grade\s*[a-d]|中古[abcd])\b/gi,
                  ""
                ).replace(/\s+/g, " ").trim();
                if (stripped) {
                  setLocation(`/pricing/search?q=${encodeURIComponent(stripped)}`);
                } else {
                  setLocation("/pricing");
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              清除過濾
            </button>
          </div>
        )}

        {showSkeleton ? (
          <div className="flex items-center gap-3 mt-2">
            <div className="h-3 w-28 rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded-full bg-muted animate-pulse" />
          </div>
        ) : showError ? null : (
          <>
            <p className="text-muted-foreground mt-2">
              {gradeLabel
                ? `找到 ${total} 張卡牌有 ${gradeLabel} 在售商品`
                : t("pricing.foundCards", { count: total + sealedCount })}
            </p>
            {totalPages > 1 && (
              <p className="text-xs text-muted-foreground mt-1">
                第 {currentPage} 頁 / 共 {totalPages} 頁（顯示 {offset + 1}–{Math.min(offset + ITEMS_PER_PAGE, total)} 張）
              </p>
            )}
          </>
        )}
      </div>

      {/* Results Grid */}
      {showSkeleton ? (
        <>
          {/* Skeleton header: count + page info placeholder */}
          <div className="mb-4 flex items-center justify-between">
            <div className="h-4 w-32 rounded-full bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
          </div>

          {/* Skeleton card grid — 40 cards matching real layout */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl overflow-hidden"
                style={{ animationDelay: `${(i % 8) * 40}ms` }}
              >
                {/* Card image skeleton */}
                <div className="aspect-[2/3] relative bg-muted overflow-hidden">
                  {/* Shimmer sweep */}
                  <div
                    className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
                      animationDelay: `${(i % 8) * 40}ms`,
                    }}
                  />
                </div>

                {/* Card info skeleton */}
                <div className="p-1.5 sm:p-2 space-y-1">
                  {/* Title line 1 */}
                  <div className="h-2 sm:h-2.5 rounded-full bg-muted animate-pulse" style={{ width: `${70 + (i % 3) * 10}%`, animationDelay: `${(i % 8) * 40}ms` }} />
                  {/* Title line 2 — shorter */}
                  <div className="h-2 sm:h-2.5 rounded-full bg-muted animate-pulse" style={{ width: `${45 + (i % 4) * 8}%`, animationDelay: `${(i % 8) * 40 + 80}ms` }} />
                  {/* Price line */}
                  <div className="h-2 sm:h-2.5 rounded-full bg-orange-400/20 animate-pulse mt-1" style={{ width: `${40 + (i % 3) * 12}%`, animationDelay: `${(i % 8) * 40 + 160}ms` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Shimmer keyframe injected once */}
          <style>{`
            @keyframes shimmer {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(200%); }
            }
          `}</style>
        </>
      ) : showError ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{t("pricing.searchError")}</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? t("pricing.searching") : t("pricing.retrySearch")}
            </Button>
          </div>
        </div>
      ) : hasResults ? (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
            {searchResults.map((card: any) => {
              const lowestPrice = lowestPrices[card.id];
              const isSealedProduct = card.productType === 'sealed_product';
              return (
                <div
                  key={`${isSealedProduct ? 'sealed' : 'card'}-${card.id}`}
                  onClick={() => handleCardClick(card)}
                  className="bg-card rounded-xl border border-border overflow-hidden cursor-pointer transform transition-all hover:scale-[1.03] hover:shadow-lg"
                >
                  <div className="aspect-[2/3] relative bg-muted">
                    {card.imageUrl ? (
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ""}
                        alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground text-xs">{t("pricing.noImage")}</p>
                      </div>
                    )}
                    {/* Sealed product badge */}
                    {isSealedProduct && (
                      <div className="absolute top-1 left-1">
                        <div className="bg-purple-600/90 backdrop-blur-sm text-white text-[7px] sm:text-[8px] font-bold px-1 py-0.5 rounded">
                          卡盒
                        </div>
                      </div>
                    )}
                    {/* Grade badge on card thumbnail when grade filter is active */}
                    {gradeLabel && !isSealedProduct && (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="bg-blue-500/80 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded text-center truncate">
                          {gradeLabel}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-1.5 sm:p-2 flex flex-col">
                    <h3 className="font-semibold text-foreground text-[9px] sm:text-xs mb-0 sm:mb-0.5 line-clamp-2 leading-tight">
                      {card.name}
                    </h3>
                    {card.nameJa && (
                      <p className="hidden sm:block text-[10px] text-muted-foreground mb-0.5 truncate">
                        {card.nameJa}
                      </p>
                    )}
                    {card.cardNumber && (
                      <p className="hidden sm:block text-[10px] text-muted-foreground mb-1">
                        #{card.cardNumber}
                      </p>
                    )}
                    {/* Price display */}
                    <div className="mt-auto pt-1">
                      {isSealedProduct ? (
                        // Sealed product: show latest sold price
                        card.latestPrice ? (
                          <div className="flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-400 flex-shrink-0" />
                            <p className="text-[9px] sm:text-xs font-bold text-green-400 truncate">
                              HKD {Number(card.latestPrice).toLocaleString()}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">
                            {t("pricing.noListings")}
                          </p>
                        )
                      ) : (
                        // Regular card: show lowest active listing price
                        lowestPrice !== undefined ? (
                          <div className="flex items-center gap-0.5">
                            <ShoppingBag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-orange-400 flex-shrink-0" />
                            <p className="text-[9px] sm:text-xs font-bold text-orange-400 truncate">
                              HKD {lowestPrice.toLocaleString()}起
                            </p>
                          </div>
                        ) : isRefreshing ? (
                          <div className="space-y-1">
                            <div className="h-2 sm:h-2.5 w-full rounded animate-pulse bg-muted-foreground/20" />
                            <div className="h-2 sm:h-2.5 w-2/3 rounded animate-pulse bg-muted-foreground/15" />
                          </div>
                        ) : (
                          <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">
                            {t("pricing.noListings")}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
                variant="outline"
                size="sm"
              >
                上一頁
              </Button>

              <div className="flex gap-1 flex-wrap justify-center">
                {getPageNumbers().map((page, index) =>
                  page === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-2 py-1 text-muted-foreground text-sm">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={`page-${page}`}
                      onClick={() => goToPage(page as number)}
                      disabled={isLoading}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="min-w-[36px]"
                    >
                      {page}
                    </Button>
                  )
                )}
              </div>

              <Button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                variant="outline"
                size="sm"
              >
                下一頁
              </Button>
            </div>
          )}
        </>
      ) : showEmpty ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t("pricing.noResults")}
            </p>
          </div>
        </div>
      ) : !query ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {t("pricing.enterKeyword")}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
