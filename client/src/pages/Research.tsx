import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  // Fetch trending cards (top 5 based on PSA10 price increase)
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 5 },
    { retry: 1 }
  );

  // Map trending cards to card format for display
  const popularCards = trendingCards.map((card: any) => ({
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
  }));

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
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("research.loading")}</span>
            </div>
          ) : popularCards.length > 0 ? (
            popularCards.map((card: any) => (
              <img
                key={card.id}
                src={card.imageUrl || "https://via.placeholder.com/128x176?text=No+Image"}
                alt={card.name}
                onClick={() => handleCardClick(card.id)}
                className="w-32 h-44 object-cover rounded-lg shadow-lg cursor-pointer transform transition-all hover:scale-110 hover:shadow-2xl"
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t("research.noResults")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
