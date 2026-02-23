import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/formatCurrency";

export default function SearchResults() {
  const searchParams = useSearch();
  const query = new URLSearchParams(searchParams).get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();

  // Fetch search results - single query, no conditional hooks
  const { data: searchResults = [], isLoading, error } = trpc.cards.search.useQuery(
    { query: query || "", limit: 50 },
    { enabled: !!query, retry: 1 }
  );

  // SEO: Update document title and meta tags
  useEffect(() => {
    if (query) {
      document.title = `搜尋「${query}」的寶可夢卡牌價格 - BOXIUM PTCG 市場格價平台`;
      
      // Update meta description
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `在 BOXIUM 搜尋「${query}」相關的寶可夢卡牌，查看 PSA 10 價格、SNKRDUNK 交易記錄和市場趨勢分析。`);
      }
      
      // Update meta keywords (3-8 core keywords)
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

  const handleCardClick = (cardId: number) => {
    // Log user search behavior for trending cards
    logSearchMutation.mutate({
      cardId,
      searchQuery: query,
      source: "search_page",
    });
    setLocation(`/card/${cardId}`);
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
            {searchResults.map((card: any) => (
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
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">無圖片</p>
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
                  {card.latestPrice && (
                    <p className="text-xs sm:text-sm font-bold text-primary">
                      {formatCurrency(card.latestPrice)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {query ? "找不到相符的卡牌" : "請輸入搜尋關鍵字"}
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
