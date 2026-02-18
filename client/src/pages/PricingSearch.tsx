import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Input } from "@/components/ui/input";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

export default function PricingSearch() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const query = new URLSearchParams(searchParams).get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();

  // Fetch search results from database
  const { data: searchResults = [], isLoading, error } = trpc.cards.search.useQuery(
    { query: query || "", limit: 50 },
    { enabled: !!query, retry: 1 }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/pricing/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/pricing/${cardId}`);
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
      
      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("pricing.searchPlaceholder")}
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
          {t("pricing.searchResultsFor")}: "{query}"
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground mt-2">{t("pricing.searching")}</p>
        ) : (
          <p className="text-muted-foreground mt-2">
            {t("pricing.foundCards", { count: searchResults.length })}
          </p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {searchResults.map((card: any) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className="bg-card rounded-lg border border-border overflow-hidden cursor-pointer transform transition-all hover:scale-105 hover:shadow-xl"
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
                    <p className="text-muted-foreground text-sm">{t("pricing.noImage")}</p>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-foreground text-sm mb-1 truncate">
                  {card.name}
                </h3>
                {card.nameJa && (
                  <p className="text-xs text-muted-foreground mb-1 truncate">
                    {card.nameJa}
                  </p>
                )}
                {card.cardNumber && (
                  <p className="text-xs text-muted-foreground">
                    #{card.cardNumber}
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
              {query ? t("pricing.noResults") : t("pricing.enterKeyword")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
