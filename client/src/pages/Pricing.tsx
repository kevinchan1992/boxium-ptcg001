import { useState } from "react";
import { CardSearchDropdown } from "@/components/CardSearchDropdown";
import { MobileSearchOverlay } from "@/components/MobileSearchOverlay";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { TypeAnimation } from 'react-type-animation';
import { getProxiedImageUrl } from "@/lib/utils";
import PageHead from "@/components/PageHead";

export default function Pricing() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
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
    cardNumber: card.cardNumber || null,
    series: card.series || null,
  }));

  const handleCardClick = (cardId: number) => {
    setLocation(`/pricing/${cardId}`);
  };

  return (
    <>
      <PageHead
        title="市場格價 - BOXIUM PTCG | PSA 10 卡牌市場價格查詢"
        description="查詢 Pokémon、One Piece、遊戲王等 TCG 卡牌的 PSA 10 市場格價，整合 SNKRDUNK 及 eBay 真實交易數據，掌握最新市場行情。"
        keywords="PSA 10 格價, 卡牌市場價格, Pokémon TCG 格價, SNKRDUNK, eBay 卡牌"
      />
      <div className="min-h-[calc(100dvh-3.5rem-56px)] md:min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8 pb-14 md:pb-0">
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
          </div>

          {/* Top Gainers - Daily Price Increase Top 5 */}
          <div className="flex justify-center gap-3 sm:gap-4 mt-3 sm:mt-12 flex-wrap">
            {isLoading ? (
              // Skeleton: 5 card shapes matching actual card dimensions
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="relative w-28 sm:w-32">
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted/60 animate-pulse" />
                </div>
              ))
            ) : popularCards.length > 0 ? (
              popularCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className="group relative w-28 sm:w-32 transition-transform hover:scale-105"
                >
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                    <img
                      src={getProxiedImageUrl(card.imageUrl) ?? ""}
                      alt={`${card.name}${card.cardNumber ? ` ${card.cardNumber}` : ''} 卡牌圖像${card.series ? ` - ${card.series}` : ''}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                </button>
              ))
            ) : (
              <div className="w-full text-center py-12 text-muted-foreground">
                <p>{t("pricing.noResults") || "暫無熱門卡牌"}</p>
              </div>
            )}
          </div>

          {/* Hint Text */}
          <p className="text-xs text-muted-foreground mt-8">
            {t("pricing.hint")}
          </p>
        </div>
      </div>
    </>
  );
}
