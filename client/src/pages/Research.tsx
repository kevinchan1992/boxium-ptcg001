import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { Camera } from "lucide-react";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import StructuredData from "@/components/StructuredData";
import { getProxiedImageUrl } from "@/lib/utils";

export default function Home() {
  const { t } = useTranslation();
  const searchParams = useSearch();
  const initialQuery = new URLSearchParams(searchParams).get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [, setLocation] = useLocation();
  const [showCameraSheet, setShowCameraSheet] = useState(false);

  // Sync search query when URL param changes
  useEffect(() => {
    const q = new URLSearchParams(searchParams).get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);

  // Fetch trending cards (top 5 based on PSA10 price increase)
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery(
    { limit: 5 },
    { retry: 1 }
  );

  // Fetch random card names for placeholder rotation
  const { data: randomCardNames = [] } = trpc.cards.getRandomCardNames.useQuery(
    { count: 10 },
    { retry: 1 }
  );

  // Map trending cards to card format for display
  const popularCards = trendingCards.map((card: any) => ({
    id: card.id,
    name: card.name,
    imageUrl: card.imageUrl,
  }));

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
      <div className="h-[calc(100dvh-3.5rem-56px)] md:min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8 overflow-hidden">
        {/* Hero Section */}
        <div className="text-center space-y-2 sm:space-y-5 max-w-3xl w-full">
          {/* Logo/Brand */}
          <div className="space-y-1 sm:space-y-3">
            <Link href="/">
              <img
                src="/boxium-logo-white.png"
                alt="BOXIUM"
                className="h-24 sm:h-28 mx-auto cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
            <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("research.title")}</h2>
          </div>
          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-muted-foreground px-4">
            {t("research.searchPlaceholder")}
          </p>

          {/* Search Box — Mobile: MobileSearchOverlay, Desktop: CardSearchDropdown */}
          {/* Mobile overlay trigger */}
          <div className="md:hidden">
            <MobileSearchOverlay
              initialQuery={searchQuery}
              placeholder={randomCardNames[0] || t("research.searchPlaceholder")}
              onSearch={(q) => {
                setSearchQuery(q);
                setLocation(`/search?q=${encodeURIComponent(q)}`);
              }}
              cardLinkPrefix="card"
              onCameraClick={() => setShowCameraSheet(true)}
            />
          </div>
          {/* Desktop dropdown */}
          <div className="hidden md:block relative max-w-2xl mx-auto">
            <CardSearchDropdown
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={(q) => {
                if (q.trim()) setLocation(`/search?q=${encodeURIComponent(q)}`);
              }}
              cardLinkPrefix="card"
              inputClassName="w-full py-5 text-base bg-card border-border rounded-xl focus:ring-2 focus:ring-primary pr-16"
              placeholder=""
            />
            {/* Typing Animation Placeholder (only when input is empty) */}
            {!searchQuery && randomCardNames.length > 0 && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-sm z-0">
                <TypeAnimation
                  sequence={randomCardNames.flatMap((name: string) => [name, 3000])}
                  wrapper="span"
                  speed={50}
                  repeat={Infinity}
                />
              </div>
            )}
            {/* Camera Button */}
            <button
              type="button"
              onClick={() => setShowCameraSheet(true)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
              title="拍照識別"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          {/* Top Gainers - Daily Price Increase Top 5 */}
          <div className="flex justify-center gap-3 sm:gap-4 mt-3 sm:mt-12 flex-wrap">
            {isLoading ? (
              // 骨架屏：5張卡牌形狀，與實際卡牌尺寸一致，避免版面位移
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative w-28 sm:w-32">
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted/60 animate-pulse" />
                </div>
              ))
            ) : popularCards.length > 0 ? (
              popularCards.map((card: any) => (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="group relative w-28 sm:w-32 transition-transform hover:scale-105"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                    <img
                      src={getProxiedImageUrl(card.imageUrl) ?? "https://via.placeholder.com/128x176?text=No+Image"}
                      alt={card.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                </button>
              ))
            ) : (
              <div className="w-full text-center py-12 text-muted-foreground">
                <p>{t("research.noResults")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Search Sheet */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
      />
    </>
  );
}
