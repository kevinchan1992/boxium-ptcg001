import { useState } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Instagram, User, LogOut, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import Footer from "@/components/Footer";


function TrendingCardsGrid() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: trendingCards = [], isLoading } = trpc.cards.getTrending.useQuery({ limit: 5 });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: "#06038d" }}></div>
      </div>
    );
  }

  if (trendingCards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">{t("home.noTrendingCards")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
      {trendingCards.map((card: any) => (
        <div
          key={card.id}
          onClick={() => setLocation(`/card/${card.id}`)}
          className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer hover:scale-105 border-2 border-transparent hover:border-[#ffed00]"
        >
          {/* Card Image */}
          <div className="aspect-[2.5/3.5] bg-gray-100 relative overflow-hidden">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-sm">{t("home.noImage")}</span>
              </div>
            )}
            {/* Price Change Badge */}
            <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 md:top-2 md:right-2 bg-red-500 text-white px-1 py-0.5 sm:px-1.5 sm:py-0.5 md:px-2 md:py-1 rounded text-[8px] sm:text-[10px] md:text-xs font-bold shadow-lg">
              {card.priceChangeFormatted}
            </div>
          </div>

          {/* Card Info */}
          <div className="p-1 sm:p-1.5 md:p-2 lg:p-3">
            <h3 className="font-bold text-[9px] sm:text-[10px] md:text-xs lg:text-sm mb-0.5 line-clamp-2" style={{ color: "#06038d" }}>
              {card.name}
            </h3>
            {card.nameJa && (
              <p className="text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] text-gray-500 mb-1 line-clamp-1">{card.nameJa}</p>
            )}
            <div className="flex items-baseline gap-0.5">
              <span className="text-[10px] sm:text-xs md:text-sm lg:text-base font-bold" style={{ color: "#06038d" }}>
                HK${card.currentPrice.toFixed(0)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch real card count from database
  const { data: stats } = trpc.cards.getStats.useQuery();
  


  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
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
                <div className="text-base md:text-2xl font-bold text-[#ffed00] mb-0.5">{stats?.totalCards || 0}+</div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.trackedCards")}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 md:p-5 border border-white/20 text-center">
                <div className="text-base md:text-2xl font-bold text-[#ffed00] mb-0.5">2</div>
                <div className="text-white/80 text-[9px] md:text-xs">{t("home.dataSources")}</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/research">
                <Button
                  className="px-8 md:px-10 py-3 md:py-4 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105"
                  style={{ backgroundColor: "#ffed00", color: "#06038d" }}
                >
                  {t("home.startExploring")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-5 md:mb-8">
            <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5" style={{ color: "#06038d" }}>
              {t("home.coreFeatures")}
            </h2>
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2">
              {t("home.coreFeaturesDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Search className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>{t("home.smartSearch")}</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                {t("home.smartSearchDesc")}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <TrendingUp className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>{t("home.priceTrend")}</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                {t("home.priceTrendDesc")}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <BarChart3 className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>{t("home.marketStats")}</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                {t("home.marketStatsDesc")}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Trophy className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>{t("home.topRanking")}</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                {t("home.topRankingDesc")}
              </p>
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
            <p className="text-gray-600 text-xs md:text-sm max-w-2xl mx-auto px-2">
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
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#ffed00" }}>
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

      {/* CTA Section */}
      <section className="py-6 md:py-12 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 md:mb-3" style={{ color: "#06038d" }}>
            {t("home.readyToStart")}
          </h2>
          <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm mb-3 md:mb-5 leading-relaxed px-2">
            {t("home.readyToStartDesc")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center px-2">
            <Link href="/research">
              <Button
                className="px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105"
                style={{ backgroundColor: "#06038d", color: "white" }}
              >
                {t("home.startSearching")}
              </Button>
            </Link>
            <Link href="/research">
              <Button
                variant="outline"
                className="px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105 border-2"
                style={{ borderColor: "#06038d", color: "#06038d" }}
              >
                {t("home.viewMarketTrends")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
