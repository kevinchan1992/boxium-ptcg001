import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Sample search results
const sampleResults = [
  {
    id: 1,
    name: "MEGA Charizard X ex",
    series: "XY - Flashfire",
    cardNumber: "108",
    imageUrl: "https://images.pokemontcg.io/xy2/108_hires.png",
    price: "HKD $5,909",
  },
  {
    id: 2,
    name: "Charizard VMAX",
    series: "Champion's Path",
    cardNumber: "074",
    imageUrl: "https://images.pokemontcg.io/swsh35/074_hires.png",
    price: "HKD $3,200",
  },
  {
    id: 3,
    name: "Charizard GX",
    series: "Burning Shadows",
    cardNumber: "150",
    imageUrl: "https://images.pokemontcg.io/sm3/150_hires.png",
    price: "HKD $2,800",
  },
];

export default function SearchResults() {
  const searchParams = useSearch();
  const query = new URLSearchParams(searchParams).get("q") || "";
  const [searchQuery, setSearchQuery] = useState(query);
  const [, setLocation] = useLocation();

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
    <MainLayout>
      <div className="min-h-screen py-8 px-8">
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
          <p className="text-muted-foreground mt-2">
            找到 {sampleResults.length} 張卡牌
          </p>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sampleResults.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className="bg-card rounded-lg border border-border overflow-hidden cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl"
            >
              <div className="aspect-[2/3] relative">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground mb-1 truncate">
                  {card.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {card.series} · {card.cardNumber}
                </p>
                <p className="text-lg font-bold text-primary">{card.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
