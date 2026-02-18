import { useState } from "react";
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/card/${cardId}`);
  };

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 md:px-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: "主頁", href: "/" },
            { label: "搜尋" }
          ]}
        />
        
        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="relative max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜尋卡牌..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-6 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>
        </div>

        {/* Results Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            搜尋結果: "{query}"
          </h2>
          {isLoading ? (
            <p className="text-muted-foreground mt-2">搜尋中...</p>
          ) : (
            <p className="text-muted-foreground mt-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                <div className="p-2">
                  <h3 className="font-semibold text-foreground text-xs mb-0.5 truncate">
                    {card.name}
                  </h3>
                  {card.nameJa && (
                    <p className="text-xs text-muted-foreground mb-1 truncate line-clamp-1">
                      {card.nameJa}
                    </p>
                  )}
                  {card.cardNumber && (
                    <p className="text-xs text-muted-foreground mb-1">
                      #{card.cardNumber}
                    </p>
                  )}
                  {card.latestPrice && (
                    <p className="text-sm font-bold text-primary">
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
