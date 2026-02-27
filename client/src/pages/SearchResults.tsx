import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle, Lightbulb } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";

export default function SearchResults() {
  const searchParams = useSearch();
  const query = new URLSearchParams(searchParams).get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 50;

  // Calculate offset based on current page
  const offset = (currentPage - 1) * limit;

  // Fetch search results with offset support — use products.search to include sealed products
  const { data: searchData, isLoading, error } = trpc.products.search.useQuery(
    { query: query || "", limit, offset },
    { enabled: !!query, retry: 1 }
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
  
  // Reset page when query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query]);
  
  // Page navigation handlers
  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
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
      document.title = `搜尋「${query}」的寶可夢卡牌價格 - BOXIUM PTCG 市場格價平台`;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `在 BOXIUM 搜尋「${query}」相關的寶可夢卡牌，查看 PSA 10 價格、SNKRDUNK 交易記錄和市場趨勢分析。`);
      }
      
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', `${query},寶可夢卡牌,PSA 10,卡牌價格,SNKRDUNK,市場格價`);
      }
    } else {
      document.title = '搜尋寶可夢卡牌價格 - BOXIUM PTCG 市場格價平台';
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
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
            { label: "主頁", href: "/" },
            { label: "搜尋" }
          ]}
        />
        
        {/* Search Bar */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <form onSubmit={handleSearch} className="relative max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜尋卡牌..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-4 sm:py-5 md:py-6 text-sm sm:text-base md:text-lg bg-card border-border rounded-lg sm:rounded-xl focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>
        </div>

        {/* Results Header with H1 */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
            {query ? `搜尋「${query}」的寶可夢卡牌價格` : '搜尋寶可夢卡牌價格'}
          </h1>
          {isLoading ? (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">搜尋中...</p>
          ) : (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
              找到 {searchResults.length} 張卡牌
            </p>
          )}
        </div>

        {/* Results Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">搜尋出錯,請重試</p>
            </div>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            {/* Results count and page info */}
            <div className="mb-4 text-sm text-muted-foreground flex justify-between items-center">
              <span>第 {currentPage} 頁 / 共 {totalPages} 頁（總共 {totalResults} 張卡牌）</span>
              <span>顯示 {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, totalResults)} 張</span>
            </div>
            
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
            {searchResults.map((card: any) => (
              <div
                key={card.id}
                onClick={() => handleItemClick(card)}
                className="bg-card rounded-lg border border-border overflow-hidden cursor-pointer transform transition-all hover:scale-110 hover:shadow-lg"
              >
                <div className="aspect-[2/3] relative bg-muted">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">無圖片</p>
                    </div>
                  )}
                </div>
                <div className="p-1.5 sm:p-2">
                  {card.productType === 'sealed_product' && (
                    <span className="inline-block text-[8px] sm:text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded mb-0.5 font-medium">
                      卡盒
                    </span>
                  )}
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
                  {card.latestPrice && (
                    <p className="text-xs sm:text-sm font-bold text-primary">
                      {formatCurrency(card.latestPrice)}
                    </p>
                  )}
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
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在尋找相似搜尋...</span>
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
