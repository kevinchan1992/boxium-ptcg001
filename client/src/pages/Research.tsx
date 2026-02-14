import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  // Fetch popular cards from database
  const { data: popularCards = [], isLoading } = trpc.cards.getPopular.useQuery(
    { limit: 5 },
    { retry: 1 }
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
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">卡牌搜尋</h2>
        </div>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-muted-foreground px-4">
          取得任何卡牌的深入研究報告
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="MEGA Charizard X ex 110"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
            />
          </div>
        </form>

        {/* Popular Cards */}
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              <p>暫無卡牌數據,請在管理員後台添加 SNKRDUNK 卡牌</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
