import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, Lightbulb, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { useTranslation } from "react-i18next";
import { getProxiedImageUrl } from "@/lib/utils";

export default function SearchResults() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const query = params.get("q") || "";
  // Read page from URL param so browser back/forward restores it
  const pageFromUrl = parseInt(params.get("page") || "1", 10);
  const currentPage = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  const [searchQuery, setSearchQuery] = useState(query);
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
  
  // Extract items array from response
  const searchResults = searchData?.items || [];
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
      document.title = `搜尋「${query}」的 TCG 卡牌價格 - BOXIUM 市場格價平台`;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `在 BOXIUM 搜尋「${query}」相關的 TCG 卡牌，查看 PSA 10 價格、SNKRDUNK 交易記錄和市場趨勢分析。`);
      }
      
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', `${query},TCG 卡牌,集換式卡牌,PSA 10,卡牌價格,SNKRDUNK,市場格價`);
      }
    } else {
      document.title = '搜尋 TCG 卡牌價格 - BOXIUM 市場格價平台';
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // New search always resets to page 1
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

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

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: t("searchResults.breadcrumb.home"), href: "/" },
            { label: t("searchResults.breadcrumb.search") }
          ]}
        />
        
        {/* Search Bar with Dropdown */}
        <div className="mb-4 sm:mb-6 md:mb-8 max-w-2xl">
          <CardSearchDropdown
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(q) => {
              if (q.trim()) setLocation(`/search?q=${encodeURIComponent(q)}`);
            }}
            cardLinkPrefix="card"
            inputClassName="py-4 sm:py-5 md:py-6 text-sm sm:text-base md:text-lg bg-card border-border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-primary"
            placeholder={t("searchResults.search.placeholder")}
          />
        </div>

        {/* Results Header with H1 */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
            {query ? `搜尋「${query}」的 TCG 卡牌價格` : '搜尋 TCG 卡牌價格'}
          </h1>
          {isLoading ? (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{t("searchResults.header.loading")}</p>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              找到 {searchResults.length} 張卡牌
            </p>
          )}
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-3">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="aspect-[2/3] bg-muted animate-pulse" />
                <div className="p-1.5 sm:p-2 space-y-1">
                  <div className="h-2 sm:h-2.5 w-full rounded bg-muted animate-pulse" />
                  <div className="h-2 sm:h-2.5 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2 sm:h-2.5 w-1/2 rounded bg-orange-400/20 animate-pulse mt-1" />
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
            <div className="mb-4 text-sm text-muted-foreground flex justify-between items-center">
              <span>第 {currentPage} 頁 / 共 {totalPages} 頁（總共 {totalResults} 張卡牌）</span>
              <span>顯示 {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, totalResults)} 張</span>
            </div>
            
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 sm:gap-2">
            {searchResults.map((card: any) => (
              <div
                key={card.id}
                onClick={() => handleItemClick(card)}
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
                      <p className="text-muted-foreground text-xs">{t("searchResults.card.noImage")}</p>
                    </div>
                  )}
                </div>
                <div className="p-1.5 sm:p-2 flex flex-col">
                  {card.productType === 'sealed_product' && (
                    <span className="inline-block text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded mb-0.5 font-medium">
                      卡盒
                    </span>
                  )}
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
                  <div className="mt-auto pt-1">
                    {card.latestPrice ? (
                      <p className="text-[9px] sm:text-xs font-bold text-primary truncate">
                        {formatCurrency(card.latestPrice)}
                      </p>
                    ) : (
                      <p className="text-[9px] sm:text-xs text-muted-foreground">--</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              {/* Previous button */}
              <Button
                onClick={goToPreviousPage}
                disabled={currentPage === 1 || isLoading}
                variant="outline"
                size="sm"
              >
                上一頁
              </Button>
              
              {/* Page numbers */}
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
              
              {/* Next button */}
              <Button
                onClick={goToNextPage}
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
          /* ── Zero results state ── */
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-base">
                {query ? `找不到「${query}」相符的卡牌` : "請輸入搜尋關鍵字"}
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
                    <span className="text-sm text-muted-foreground">正在尋找相似搜尋</span>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">您是否想搜尋：</span>
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
