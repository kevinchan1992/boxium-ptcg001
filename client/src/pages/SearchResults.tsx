import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Search, Loader2, AlertCircle, Lightbulb, RefreshCw, LayoutGrid, List, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";

// Hot category shortcuts
const HOT_CATEGORIES = [
  { label: "Pokémon", query: "Pokémon" },
  { label: "One Piece", query: "One Piece" },
  { label: "Yu-Gi-Oh!", query: "Yu-Gi-Oh" },
  { label: "PSA 10", query: "PSA 10" },
];

type ViewMode = "gallery" | "list";

export default function SearchResults() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const query = params.get("q") || "";
  // Read page from URL param so browser back/forward restores it
  const pageFromUrl = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  const [searchQuery, setSearchQuery] = useState(query);
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");
  const [, setLocation] = useLocation();
  const limit = 40;

  // Sync input text only on browser back/forward, NOT on search submission
  const prevQueryRef = useRef(query);
  useEffect(() => {
    if (query !== prevQueryRef.current) {
      prevQueryRef.current = query;
      setSearchQuery(query);
    }
  }, [query]);

  // Calculate offset based on current page
  const offset = (currentPage - 1) * limit;

  // Fetch search results with offset support — use products.search to include sealed products
  // Reliability: retry 2x with exponential backoff for cold-start timeouts
  const { data: searchData, isLoading, isFetching, error, refetch } = trpc.products.search.useQuery(
    { query: query || "", limit, offset },
    {
      enabled: !!query,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(2000 * Math.pow(2, attemptIndex), 10000),
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
    }
  );
  
  // Extract items array from response, sorted by price descending (no-price items go to end)
  const searchResults = (searchData?.items || []).slice().sort((a: any, b: any) => {
    const priceA = a.latestPrice != null ? Number(a.latestPrice) : -1;
    const priceB = b.latestPrice != null ? Number(b.latestPrice) : -1;
    return priceB - priceA;
  });
  const totalResults = searchData?.total || 0;
  
  // Fuzzy suggestion: only trigger when search is done and returned 0 results
  const hasNoResults = !isLoading && !error && !!query && totalResults === 0;
  const { data: suggestData, isLoading: isSuggesting } = trpc.cards.suggestQuery.useQuery(
    { query },
    { enabled: hasNoResults, retry: 0 }
  );
  const suggestions = suggestData?.suggestions ?? [];

  // Calculate total pages
  const totalPages = Math.ceil(totalResults / limit);
  
  // Navigate to a specific page by updating URL (preserves query)
  const goToPage = (page: number) => {
    const newParams = new URLSearchParams();
    newParams.set("q", query);
    if (page > 1) newParams.set("page", String(page));
    setLocation(`/search?${newParams.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  };
  
  // Generate page numbers to display (show max 7 pages)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  // SEO: Update document title and meta tags
  useEffect(() => {
    if (query) {
      document.title = t("searchResults.seo.titleWithQuery", { query });
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', t("searchResults.seo.descWithQuery", { query }));
      }
      
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', t("searchResults.seo.keywordsWithQuery", { query }));
      }
    } else {
      document.title = t("searchResults.seo.title");
    }
  }, [query]);

  const logSearchMutation = trpc.cards.logSearch.useMutation();

  const handleItemClick = (item: { id: number; productType: string }) => {
    if (item.productType === 'sealed_product') {
      setLocation(`/sealed-product/${item.id}`);
    } else {
      logSearchMutation.mutate({
        cardId: item.id,
        searchQuery: query,
        source: "search_page",
      });
      setLocation(`/card/${item.id}`);
    }
  };

  // Navigate to a suggested query
  const handleSuggestionClick = (suggestedQuery: string) => {
    setSearchQuery(suggestedQuery);
    setLocation(`/search?q=${encodeURIComponent(suggestedQuery)}`);
  };

  // Navigate to a hot category
  const handleCategoryClick = (categoryQuery: string) => {
    setSearchQuery(categoryQuery);
    setLocation(`/search?q=${encodeURIComponent(categoryQuery)}`);
  };

  // Price change pill helper (placeholder — no real change data from search API)
  // We show a subtle indicator based on price tier for visual richness
  const getPriceChangePill = (price: number | null | undefined) => {
    if (!price) return null;
    return null; // No change data available from search API
  };

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 sm:px-4 md:px-6 lg:px-8 pb-[140px] md:pb-6">
      {/* Breadcrumb */}
      <Breadcrumb 
        items={[
          { label: t("searchResults.breadcrumb.home"), href: "/" },
          { label: t("searchResults.breadcrumb.search") }
        ]}
      />
      
      {/* ── Integrated Search Suite ── */}
      <div className="max-w-3xl mx-auto mb-6 sm:mb-8">
        {/* Search Box — rounded-full, shadow-sm */}
        <CardSearchDropdown
          value={searchQuery}
          onChange={setSearchQuery}
          onSubmit={(q) => {
            if (q.trim()) setLocation(`/search?q=${encodeURIComponent(q)}`);
          }}
          cardLinkPrefix="card"
          inputClassName="h-12 rounded-full border border-slate-300 bg-white shadow-sm px-6 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
          placeholder={t("searchResults.search.placeholder")}
        />

        {/* Hot Category Shortcuts */}
        <div className="flex items-center gap-1 mt-3 flex-wrap justify-center">
          <span className="text-xs text-muted-foreground mr-1">熱門：</span>
          {HOT_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.query}
              onClick={() => handleCategoryClick(cat.query)}
              className={`text-xs px-3 py-1 rounded-full border transition-all duration-150 ${
                query === cat.query
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results Header + View Toggle ── */}
      <div className="mb-4 sm:mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">
            {query ? t("searchResults.header.titleWithQuery", { query }) : t("searchResults.header.title")}
          </h1>
          {isLoading ? (
            <p className="text-xs text-muted-foreground mt-0.5">{t("searchResults.header.loading")}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("searchResults.header.found", { count: searchResults.length })}
            </p>
          )}
        </div>

        {/* View Mode Toggle */}
        {searchResults.length > 0 && (
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white shadow-sm">
            <button
              onClick={() => setViewMode("gallery")}
              title="畫廊模式"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                viewMode === "gallery"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">畫廊</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="圖錄列表"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                viewMode === "list"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">列表</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Results Content ── */}
      {isLoading ? (
        /* Loading skeleton — gallery style */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
              <div className="aspect-[2/3] bg-slate-100 animate-pulse rounded-lg m-2" />
              <div className="px-3 pb-3 space-y-2">
                <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{t("searchResults.error.message")}</p>
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
      ) : searchResults.length > 0 ? (
        <>
          {/* Results count and page info */}
          <div className="mb-4 text-xs text-muted-foreground flex justify-between items-center">
            <span>{t("searchResults.pagination.pageInfo", { page: currentPage, total: totalPages, count: totalResults })}</span>
            <span>{t("searchResults.pagination.showing", { from: (currentPage - 1) * limit + 1, to: Math.min(currentPage * limit, totalResults) })}</span>
          </div>

          {/* ── Gallery Mode ── */}
          {viewMode === "gallery" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
              {searchResults.map((card: any) => (
                <div
                  key={card.id}
                  onClick={() => handleItemClick(card)}
                  className="bg-white border border-slate-200/80 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group"
                >
                  {/* Card Image Container */}
                  <div className="aspect-[2/3] relative bg-slate-50 rounded-lg m-2 overflow-hidden">
                    {card.imageUrl ? (
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ""}
                        alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} ${t("searchResults.card.imageAlt")}`}
                        className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground text-xs">{t("searchResults.card.noImage")}</p>
                      </div>
                    )}
                    {/* Sealed product badge overlay */}
                    {card.productType === 'sealed_product' && (
                      <span className="absolute top-1.5 left-1.5 bg-slate-900 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded font-medium">
                        SEALED
                      </span>
                    )}
                  </div>

                  {/* Card Info */}
                  <div className="px-3 pb-3 flex flex-col gap-1">
                    {/* Card Number / Rarity Badge */}
                    {(card.cardNumber || card.rarity) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {card.cardNumber && (
                          <span className="bg-slate-900 text-white text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">
                            {card.cardNumber}
                          </span>
                        )}
                        {card.rarity && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] tracking-wide px-2 py-0.5 rounded font-medium border border-slate-200">
                            {card.rarity}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Name */}
                    <h3 className="font-semibold text-slate-900 text-xs leading-tight line-clamp-2">
                      {card.name}
                    </h3>

                    {/* Japanese Name */}
                    {card.nameJa && (
                      <p className="hidden sm:block text-[10px] text-slate-400 truncate">
                        {card.nameJa}
                      </p>
                    )}

                    {/* Price Row */}
                    <div className="mt-1 flex items-center gap-1.5">
                      {card.latestPrice ? (
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {formatCurrency(card.latestPrice)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">--</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── List Mode ── */
            <div className="flex flex-col divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
              {searchResults.map((card: any) => (
                <div
                  key={card.id}
                  onClick={() => handleItemClick(card)}
                  className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors duration-150 group"
                >
                  {/* Thumbnail */}
                  <div className="w-10 sm:w-12 aspect-[2/3] flex-shrink-0 bg-slate-50 rounded-md overflow-hidden border border-slate-100">
                    {card.imageUrl ? (
                      <img
                        src={getProxiedImageUrl(card.imageUrl) ?? ""}
                        alt={card.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-slate-300 text-[8px]">N/A</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      {card.productType === 'sealed_product' && (
                        <span className="bg-slate-900 text-white text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded font-medium">
                          SEALED
                        </span>
                      )}
                      {card.cardNumber && (
                        <span className="bg-slate-900 text-white text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-medium">
                          {card.cardNumber}
                        </span>
                      )}
                      {card.rarity && (
                        <span className="bg-slate-100 text-slate-600 text-[10px] tracking-wide px-2 py-0.5 rounded font-medium border border-slate-200">
                          {card.rarity}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                      {card.name}
                    </h3>
                    {card.nameJa && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{card.nameJa}</p>
                    )}
                    {card.series && (
                      <p className="text-[11px] text-slate-400 truncate">{card.series}</p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {card.latestPrice ? (
                      <p className="text-sm font-bold text-slate-900">
                        {formatCurrency(card.latestPrice)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">--</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                onClick={goToPreviousPage}
                disabled={currentPage === 1 || isLoading}
                variant="outline"
                size="sm"
              >
                {t("common.prevPage")}
              </Button>
              
              <div className="flex gap-1">
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-3 py-1 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      onClick={() => goToPage(page as number)}
                      disabled={isLoading}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="min-w-[40px]"
                    >
                      {page}
                    </Button>
                  )
                ))}
              </div>
              
              <Button
                onClick={goToNextPage}
                disabled={currentPage === totalPages || isLoading}
                variant="outline"
                size="sm"
              >
                {t("common.nextPage")}
              </Button>
            </div>
          )}
        </>
      ) : (
        /* ── Zero results state ── */
        <div className="flex flex-col items-center justify-center py-12 gap-6">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-base">
              {query ? t("searchResults.noResults.withQuery", { query }) : t("searchResults.noResults.empty")}
            </p>
          </div>

          {/* Fuzzy suggestions */}
          {query && (
            <div className="w-full max-w-md">
              {isSuggesting ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 items-center">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-sm text-muted-foreground">{t("searchResults.suggestions.finding")}</span>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{t("searchResults.suggestions.didYouMean")}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.query}
                        onClick={() => handleSuggestionClick(s.query)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors border border-primary/20 hover:border-primary/40"
                      >
                        <Search className="w-3 h-3" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
