import { useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useLocation } from "wouter";

// Sample card data for demonstration
const sampleCards = [
  {
    id: 1,
    name: "MEGA Charizard X ex",
    imageUrl: "https://images.pokemontcg.io/xy2/108_hires.png",
  },
  {
    id: 2,
    name: "Pikachu",
    imageUrl: "https://images.pokemontcg.io/base1/58_hires.png",
  },
  {
    id: 3,
    name: "Blastoise",
    imageUrl: "https://images.pokemontcg.io/base1/2_hires.png",
  },
  {
    id: 4,
    name: "Venusaur",
    imageUrl: "https://images.pokemontcg.io/base1/15_hires.png",
  },
  {
    id: 5,
    name: "Mewtwo",
    imageUrl: "https://images.pokemontcg.io/base1/10_hires.png",
  },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
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
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl">
          {/* Logo/Brand */}
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-foreground">BOXIUM</span>{" "}
              <span className="text-primary">PTCG</span>
            </h1>
            <h2 className="text-3xl font-semibold text-foreground">研究</h2>
          </div>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground">
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
                className="w-full pl-12 pr-4 py-6 text-lg bg-card border-border rounded-xl focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>

          {/* Sample Cards */}
          <div className="flex justify-center gap-4 mt-12 flex-wrap">
            {sampleCards.map((card) => (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="cursor-pointer transform transition-all hover:scale-105 hover:shadow-2xl"
              >
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-32 h-44 object-cover rounded-lg shadow-lg"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
