import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Instagram, User, LogOut, Flame, ChevronRight, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";
import StructuredData from "@/components/StructuredData";
import { formatCurrency, formatPriceChange } from "@/lib/formatCurrency";



// Rank medal config — professional metallic palette
const RANK_CONFIG: Record<number, { gradient: string; textColor: string; borderColor: string; label: string }> = {
  1: {
    gradient: "linear-gradient(135deg, #f5c518 0%, #e8a900 50%, #c8860a 100%)",
    textColor: "#5a3a00",
    borderColor: "rgba(248,197,24,0.6)",
    label: "1",
  },
  2: {
    gradient: "linear-gradient(135deg, #e8e8e8 0%, #c8c8c8 50%, #a0a0a0 100%)",
    textColor: "#3a3a3a",
    borderColor: "rgba(192,192,192,0.6)",
    label: "2",
  },
  3: {
    gradient: "linear-gradient(135deg, #e8a87c 0%, #cd7f32 50%, #a0520a 100%)",
    textColor: "#fff",
    borderColor: "rgba(205,127,50,0.6)",
    label: "3",
  },
  4: {
    gradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)",
    textColor: "#e2e8f0",
    borderColor: "rgba(74,85,104,0.5)",
    label: "4",
  },
  5: {
    gradient: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)",
    textColor: "#e2e8f0",
    borderColor: "rgba(74,85,104,0.5)",
    label: "5",
  },
};

function TrendingCardRow({ gameId, logoUrl, logoAlt, accentColor, badgeBg }: {
  gameId: number;
  logoUrl: string;
  logoAlt: string;
  accentColor: string;
  badgeBg: string;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery({ limit: 5, gameId });
  const logSearchMutation = trpc.cards.logSearch.useMutation();

  return (
    <div className="mb-8 md:mb-10">
      {/* Section header with game logo */}
      <div className="flex items-center gap-3 mb-4">
        {/* Left accent bar */}
        <div
          className="h-6 w-[3px] rounded-full flex-shrink-0"
          style={{ background: accentColor }}
        />
        {/* Game logo */}
        <img
          src={logoUrl}
          alt={logoAlt}
          className="h-7 sm:h-9 md:h-11 w-auto object-contain flex-shrink-0"
          loading="lazy"
        />
        {/* Thin divider line */}
        <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accentColor}40, transparent)` }} />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor }} />
        </div>
      ) : trendingCards.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">{t("home.noTrendingCards")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 lg:gap-5">
          {trendingCards.map((card: any, index: number) => {
            const rankNum = card.rank ?? (index + 1);
            const rc = RANK_CONFIG[rankNum] || RANK_CONFIG[5];
            return (
              <div
                key={card.id}
                onClick={() => {
                  logSearchMutation.mutate({ cardId: card.id, source: "home_page" });
                  setLocation(`/card/${card.id}`);
                }}
                className="group bg-white rounded-xl overflow-hidden shadow hover:shadow-xl transition-all duration-200 cursor-pointer border border-gray-100 hover:border-[#FEDD00]"
              >
                {/* Card Image */}
                <div className="aspect-[2.5/3.5] bg-gray-50 relative overflow-hidden">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <span className="text-xs">{t("home.noImage")}</span>
                    </div>
                  )}

                  {/* Rank Medal — top-left: circular metallic badge */}
                  <div
                    className="absolute top-1 left-1 flex items-center justify-center rounded-full font-black shadow-md select-none"
                    style={{
                      background: rc.gradient,
                      color: rc.textColor,
                      border: `1.5px solid ${rc.borderColor}`,
                      fontSize: "clamp(7px, 1.6vw, 12px)",
                      width: "clamp(16px, 3.8vw, 24px)",
                      height: "clamp(16px, 3.8vw, 24px)",
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {rc.label}
                  </div>

                  {/* Price Change Badge — top-right */}
                  <div
                    className="absolute top-1 right-1 text-white font-bold shadow-md rounded"
                    style={{
                      background: badgeBg,
                      fontSize: "clamp(6px, 1.4vw, 11px)",
                      padding: "1px 4px",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {card.priceChangeFormatted}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-1 sm:p-1.5 md:p-2">
                  <h3
                    className="font-semibold text-[8px] sm:text-[10px] md:text-[11px] lg:text-xs mb-0.5 line-clamp-2 leading-tight"
                    style={{ color: "#06038d" }}
                  >
                    {card.name}
                  </h3>
                  {card.nameJa && (
                    <p className="text-[7px] sm:text-[8px] md:text-[9px] text-gray-400 mb-0.5 line-clamp-1">
                      {card.nameJa}
                    </p>
                  )}
                  <p
                    className="text-[9px] sm:text-[11px] md:text-xs lg:text-sm font-bold tabular-nums"
                    style={{ color: "#06038d" }}
                  >
                    {formatCurrency(card.currentPrice)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const POKEMON_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/pokemon-logo_69947aad.avif";
const ONEPIECE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/onepiece-logo_666cea4e.avif";
const YUGIOH_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663320884517/Mua4eQ38uVnrovHUJBRepi/yugioh-logo_d165899b.webp";

function TrendingCardsGrid() {
  return (
    <div>
      <TrendingCardRow
        gameId={1}
        logoUrl={POKEMON_LOGO}
        logoAlt="Pokémon TCG"
        accentColor="#06038d"
        badgeBg="linear-gradient(135deg, #e63946, #c1121f)"
      />
      <TrendingCardRow
        gameId={2}
        logoUrl={ONEPIECE_LOGO}
        logoAlt="One Piece Card Game"
        accentColor="#dc2626"
        badgeBg="linear-gradient(135deg, #dc2626, #991b1b)"
      />
      <TrendingCardRow
        gameId={3}
        logoUrl={YUGIOH_LOGO}
        logoAlt="Yu-Gi-Oh! TCG"
        accentColor="#7c3aed"
        badgeBg="linear-gradient(135deg, #7c3aed, #5b21b6)"
      />
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  
  // Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BOXIUM PTCG",
    "description": "整合全球 TCG 市場數據，為集換式卡牌愛好者提供即時、準確的價格資訊與市場分析",
    "url": "https://boxiumptcg.manus.space",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://boxiumptcg.manus.space/research?q={search_term_string}",
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "BOXIUM",
      "logo": {
        "@type": "ImageObject",
        "url": "https://boxiumptcg.manus.space/boxium-logo.png"
      }
    }
  };
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch real card count from database
  const { data: stats } = trpc.cards.getStats.useQuery();
  
  return (
    <>
      <StructuredData data={structuredData} />
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f8f9fa" }}>
        {/* Hero Section */}
      <section className="pt-16 md:pt-20 pb-16 md:pb-24 px-4 sm:px-6" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-4 md:space-y-8">
            {/* LOGO - Responsive sizing */}
            <div className="w-full max-w-[280px] md:max-w-2xl">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="w-full h-auto"
              />
            </div>

            {/* Content - Responsive text sizes */}
            <div className="space-y-1.5 md:space-y-3 max-w-3xl px-2">
              <h1 className="text-white text-base sm:text-lg md:text-2xl font-bold leading-tight">
                {t("home.welcome")}
              </h1>
              <p className="text-white/80 text-[11px] sm:text-xs md:text-base leading-relaxed">
                {t("home.description")}
              </p>
            </div>

            {/* Key Stats - Responsive layout */}
            <div className="grid grid-cols-2 gap-2 md:gap-5 w-full max-w-md px-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">{stats?.totalCards || 0}+</div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.trackedCards")}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#FEDD00] mb-0.5">2</div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.dataSources")}</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-row flex-wrap justify-center gap-3">
              <Link href="/research">
                <Button
                  className="px-8 md:px-10 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "#FEDD00", color: "#06038d" }}
                >
                  {t("home.startExploring")}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  className="px-8 md:px-10 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105 border-2 border-[#FEDD00] bg-transparent text-[#FEDD00] hover:bg-[#FEDD00]/10"
                >
                  {t("home.goToMarketplace")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* Trending Cards Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Flame className="w-6 h-6 md:w-8 md:h-8" style={{ color: "#ff4500" }} />
              <h2 className="text-base sm:text-lg md:text-xl font-bold" style={{ color: "#06038d" }}>
                {t("home.trendingCards")}
              </h2>
            </div>
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2 font-semibold">
              {t("home.trendingCardsDesc")}
            </p>
          </div>

          <TrendingCardsGrid />
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-8">
            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5" style={{ color: "#06038d" }}>
              {t("home.dataSources")}
            </h2>
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2">
              {t("home.dataSourcesDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* SNKRDUNK */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#06038d" }}>
              <img src="/snkrdunk-logo.png" alt="SNKRDUNK" className="h-8 md:h-10 mb-4 max-w-[120px] md:max-w-[180px] object-contain" />
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                {t("home.snkrdunkDesc")}
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ {t("home.realtimeData")}</div>
                <div>✓ {t("home.psaSupport")}</div>
                <div>✓ {t("home.jpyPrice")}</div>
              </div>
            </div>

            {/* eBay */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#FEDD00" }}>
              <img src="/ebay-logo.png" alt="eBay" className="h-8 md:h-10 mb-4 max-w-[120px] md:max-w-[180px] object-contain" />
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                {t("home.ebayDesc")}
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ {t("home.globalMarket")}</div>
                <div>✓ {t("home.psaSupport")}</div>
                <div>✓ 美元價格</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Three Cards */}
      <section className="py-6 md:py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 md:mb-3 text-center" style={{ color: "#06038d" }}>
            {t("home.readyToStart")}
          </h2>
          <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm mb-4 md:mb-6 leading-relaxed text-center max-w-2xl mx-auto">
            {t("home.readyToStartDesc")}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-5">
            {/* Card 1: Search Cards */}
            <Link href="/research" className="block w-full">
              <div className="group relative overflow-hidden rounded-xl p-3 sm:p-5 md:p-7 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] h-full select-none" style={{ backgroundColor: "#06038d" }}>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Search className="w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[#FEDD00] flex-shrink-0" />
                  <h3 className="text-white font-bold text-[11px] sm:text-sm md:text-base leading-tight">{t("home.startSearching")}</h3>
                </div>
                <p className="text-white/70 text-[9px] sm:text-xs md:text-sm leading-snug">
                  {t("home.searchCardsDesc", "搜尋卡片、查看價格走勢與市場數據")}
                </p>
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#FEDD00] transition-all">
                  <ChevronRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white/60 group-hover:text-[#06038d]" />
                </div>
              </div>
            </Link>
            {/* Card 2: Market Pricing */}
            <Link href="/pricing" className="block w-full">
              <div className="group relative overflow-hidden rounded-xl p-3 sm:p-5 md:p-7 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] border-2 h-full select-none bg-white" style={{ borderColor: "#06038d" }}>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <BarChart3 className="w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" style={{ color: "#06038d" }} />
                  <h3 className="font-bold text-[11px] sm:text-sm md:text-base leading-tight" style={{ color: "#06038d" }}>{t("home.viewMarketTrends")}</h3>
                </div>
                <p className="text-[9px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.65 }}>
                  {t("home.marketTrendsDesc", "查看市場價格走勢、比較各平台行情")}
                </p>
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: "rgba(6,3,141,0.08)" }}>
                  <ChevronRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" style={{ color: "#06038d" }} />
                </div>
              </div>
            </Link>
            {/* Card 3: Marketplace */}
            <Link href="/marketplace" className="block w-full">
              <div className="group relative overflow-hidden rounded-xl p-3 sm:p-5 md:p-7 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] h-full select-none" style={{ backgroundColor: "#FEDD00" }}>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <ShoppingBag className="w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 flex-shrink-0" style={{ color: "#06038d" }} />
                  <h3 className="font-bold text-[11px] sm:text-sm md:text-base leading-tight" style={{ color: "#06038d" }}>{t("home.goToMarketplace")}</h3>
                </div>
                <p className="text-[9px] sm:text-xs md:text-sm leading-snug" style={{ color: "#06038d", opacity: 0.7 }}>
                  {t("home.marketplaceDesc", "瀏覽市集商品、參與拍賣、安全交易")}
                </p>
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all" style={{ backgroundColor: "rgba(6,3,141,0.1)" }}>
                  <ChevronRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" style={{ color: "#06038d" }} />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
      </div>
    </>
  );
}
