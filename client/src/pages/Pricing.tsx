import { useState } from "react";
import { Search, Camera, Loader2 } from "lucide-react";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { getProxiedImageUrl } from "@/lib/utils";

export default function Pricing() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const [showCameraSheet, setShowCameraSheet] = useState(false);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/pricing/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleCardClick = (cardId: number) => {
    setLocation(`/pricing/${cardId}`);
  };

  const handleCameraClick = () => setShowCameraSheet(true);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8">
      {/* Hero Section */}
      <div className="text-center space-y-5 max-w-3xl w-full">
        {/* Logo/Brand */}
        <div className="space-y-3">
          <Link href="/">
            <img
              src="/boxium-logo-white.png"
              alt="BOXIUM"
              className="h-24 sm:h-28 mx-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("pricing.title")}</h2>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-muted-foreground px-4">
          {t("pricing.subtitle")}
        </p>

        {/* Search Box — Mobile: MobileSearchOverlay, Desktop: CardSearchDropdown */}
        {/* Mobile overlay trigger */}
        <div className="md:hidden">
          <MobileSearchOverlay
            initialQuery={searchQuery}
            cardNames={randomCardNames}
            placeholder={t("pricing.searchPlaceholder") || "搜尋卡牌名稱..."}
            onSearch={(q) => {
              setSearchQuery(q);
              setLocation(`/pricing/search?q=${encodeURIComponent(q)}`);
            }}
            cardLinkPrefix="pricing"
            onCameraClick={handleCameraClick}
          />
        </div>
        {/* Desktop dropdown */}
        <div className="hidden md:block relative max-w-2xl mx-auto">
          <CardSearchDropdown
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(q) => {
              if (q.trim()) setLocation(`/pricing/search?q=${encodeURIComponent(q)}`);
            }}
            cardLinkPrefix="pricing"
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
            onClick={handleCameraClick}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
            title={t('pricing.imageSearch') || '圖片搜尋'}
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Button — full-width, prominent camera CTA (both mobile & desktop) */}
        <div className="w-full max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleCameraClick}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] hover:opacity-90"
            style={{
              background: 'white',
              color: '#111',
              boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            }}
          >
            <Camera className="w-5 h-5" />
            <span>掃描卡牌識別</span>
          </button>
        </div>

        {/* Top Gainers - Daily Price Increase Top 5 */}
        <div className="flex justify-center gap-4 mt-12 flex-wrap">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{t("pricing.loading")}</span>
            </div>
          ) : (
            popularCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="group relative w-28 sm:w-32 transition-transform hover:scale-105"
              >
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                  <img
                    src={getProxiedImageUrl(card.imageUrl) ?? ""}
                    alt={card.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                </div>

              </button>
            ))
          )}
        </div>

        {/* Hint Text */}
        <p className="text-xs text-muted-foreground mt-8">
          {t("pricing.hint")}
        </p>
      </div>

      {/* Camera Search Sheet — unified with Research page */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
        onCardSelect={(card) => {
          setLocation(`/pricing/${card.id}`);
        }}
      />
    </div>
  );
}
