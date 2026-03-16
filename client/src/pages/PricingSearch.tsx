import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, AlertCircle, ShoppingBag, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";

const ITEMS_PER_PAGE = 50;

export default function PricingSearch() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const query = params.get("q") || "";
  // Read page from URL param so browser back/forward restores it
  const pageFromUrl = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTriggeredRef = useRef<string>(""); // track query+page to avoid duplicate triggers

  // Sync search input when URL query changes
  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Fetch search results from database (with pagination)
  const { data: searchData, isLoading, error } = trpc.cards.search.useQuery(
    { query: query || "", limit: ITEMS_PER_PAGE, offset },
    { enabled: !!query, retry: 1 }
  );

  // Extract cards array from response
  const searchResults = searchData?.cards || [];
  const total = searchData?.total || 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

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
    // Load test confirmed: 30 concurrent scrapes only add ~8% latency to search API
    // HTTP API is fast (~0.2-1.5s/card), so 50 cards complete within ~10-15s
    const batchToRefresh = uncachedIds.slice(0, 50);
    setIsRefreshing(true);
    triggerRefresh.mutate(
      { cardIds: batchToRefresh },
      {
        onSettled: () => {
          // After background scraping completes, refetch prices to show updated values
          // Wait 8s: HTTP API is fast (~0.2-1.5s/card), 50 cards complete in ~8-15s
          setTimeout(() => {
            refetchPrices();
            setIsRefreshing(false);
          }, 8000); // wait 8s for scraping to complete
        },
      }
    );
  }, [cardIds, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // New search always resets to page 1
      setLocation(`/pricing/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/pricing/${cardId}`);
  };

  const goToPage = (page: number) => {
    // Update URL with new page number so browser back/forward works
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
      <div className="mb-8">
        <CardSearchDropdown
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={(q) => {
            if (q.trim()) setLocation(`/pricing/search?q=${encodeURIComponent(q)}`);
          }}
          className="max-w-2xl"
          inputClassName="pr-4 py-6 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
          cardLinkPrefix="card"
        />
      </div>

      {/* Results Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">
            {t("pricing.searchResultsFor")}: "{query}"
          </h2>
          {isRefreshing && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>更新在售價格中...</span>
            </div>
          )}
        </div>
        {isLoading ? (
          <p className="text-muted-foreground mt-2">{t("pricing.searching")}</p>
        ) : (
          <>
            <p className="text-muted-foreground mt-2">
              {t("pricing.foundCards", { count: total })}
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
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{t("pricing.searching")}</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{t("pricing.searchError")}</p>
          </div>
        </div>
      ) : searchResults.length > 0 ? (
        <>
          <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5 sm:gap-2">
            {searchResults.map((card: any) => {
              const lowestPrice = lowestPrices[card.id];
              return (
                <div
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="bg-card rounded-lg border border-border overflow-hidden cursor-pointer transform transition-all hover:scale-110 hover:shadow-lg"
                >
                  <div className="aspect-[2/3] relative bg-muted">
                    {card.imageUrl ? (
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">{t("pricing.noImage")}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-1.5 sm:p-2">
                    <h3 className="font-semibold text-foreground text-[10px] sm:text-xs mb-0.5 truncate">
                      {card.name}
                    </h3>
                    {card.nameJa && (
                      <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1 truncate line-clamp-1">
                        {card.nameJa}
                      </p>
                    )}
                    {card.cardNumber && (
                      <p className="text-[9px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">
                        #{card.cardNumber}
                      </p>
                    )}
                    {/* Lowest active listing price from SNKRDUNK */}
                    {lowestPrice !== undefined ? (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <ShoppingBag className="w-2.5 h-2.5 text-orange-400 flex-shrink-0" />
                        <p className="text-[9px] sm:text-xs font-bold text-orange-400">
                          HK${lowestPrice.toLocaleString()}起
                        </p>
                      </div>
                    ) : isRefreshing ? (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <RefreshCw className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0 animate-spin" />
                        <p className="text-[9px] sm:text-xs text-muted-foreground">更新中</p>
                      </div>
                    ) : null}
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
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {query ? t("pricing.noResults") : t("pricing.enterKeyword")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
