import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";

export default function Home() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  // Fetch trending cards (top 5 based on PSA10 price increase)
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 5 },
    { retry: 1 }
  );

  // Map trending cards to card format for display (keep all data for display)
  const popularCards = trendingCards;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/card/${cardId}`);
  };

  // Generate WebSite with SearchAction structured data for SEO
  const generateSearchActionData = () => {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "BOXIUM PTCG",
      "url": "https://boxiumptcg.manus.space/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://boxiumptcg.manus.space/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    };
  };

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <StructuredData data={generateSearchActionData()} />
      
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 md:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-3xl w-full">
        {/* Logo/Brand */}
        <div className="space-y-3">
          <img
            src="/boxium-logo-white.png"
            alt="BOXIUM"
            className="h-24 sm:h-28 mx-auto"
          />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("research.title")}</h2>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t("research.searchPlaceholder")}
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("research.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        {/* Top Gainers - Daily Price Increase Top 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-12">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("research.loading")}</span>
            </div>
          ) : popularCards.length > 0 ? (
            popularCards.map((card: any) => (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="bg-card border border-border rounded-lg overflow-hidden cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  <img
                    src={card.imageUrl || "https://via.placeholder.com/300x420?text=No+Image"}
                    alt={card.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 min-h-[2.5rem]">
                    {card.name}
                  </h3>
                  {card.avgPrice && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">PSA 10</span>
                      <span className="text-sm font-bold text-primary">
                        HKD {parseFloat(card.avgPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {card.priceChangePercent && (
                    <div className={`flex items-center gap-1 text-xs font-semibold ${
                      parseFloat(card.priceChangePercent) > 0 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      <span>{parseFloat(card.priceChangePercent) > 0 ? '↑' : '↓'}</span>
                      <span>{Math.abs(parseFloat(card.priceChangePercent)).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t("research.noResults")}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
    </>
  );
}
