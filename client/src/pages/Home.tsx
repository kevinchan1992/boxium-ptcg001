import { useState } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Twitter, Instagram, Mail, User, LogOut, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";


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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
      {trendingCards.map((card: any) => (
        <div
          key={card.id}
          onClick={() => setLocation(`/card/${card.id}`)}
          className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer hover:scale-105 border-2 border-transparent hover:border-[#ffed00]"
        >
          {/* Card Image */}
          <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden">
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
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-red-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold shadow-lg">
              {card.priceChangeFormatted}
            </div>
          </div>

          {/* Card Info */}
          <div className="p-2 sm:p-3">
            <h3 className="font-bold text-[11px] sm:text-xs mb-0.5 line-clamp-1" style={{ color: "#06038d" }}>
              {card.name}
            </h3>
            {card.nameJa && (
              <p className="text-[9px] sm:text-[10px] text-gray-500 mb-1.5 line-clamp-1">{card.nameJa}</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-xs sm:text-sm md:text-base font-bold" style={{ color: "#06038d" }}>
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
                <div className="text-base md:text-2xl font-bold text-[#ffed00] mb-0.5">500+</div>
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
                  開始探索
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
              <h3 className="text-xl md:text-2xl font-bold mb-4" style={{ color: "#06038d" }}>SNKRDUNK</h3>
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
              <h3 className="text-xl md:text-2xl font-bold mb-4" style={{ color: "#06038d" }}>eBay</h3>
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
            準備好開始你的PTCG之旅了嗎？
          </h2>
          <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm mb-3 md:mb-5 leading-relaxed px-2">
            使用 BOXIUM 的智能搜尋和價格分析工具，找到你的愛好收藏品。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center px-2">
            <Link href="/research">
              <Button
                className="px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105"
                style={{ backgroundColor: "#06038d", color: "white" }}
              >
                開始搜尋卡牌
              </Button>
            </Link>
            <Link href="/research">
              <Button
                variant="outline"
                className="px-6 md:px-8 py-2 md:py-3 text-base md:text-lg font-semibold rounded-lg transition-all hover:scale-105 border-2"
                style={{ borderColor: "#06038d", color: "#06038d" }}
              >
                查看市場趨勢
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 md:py-12 px-4 sm:px-6 border-t" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-8">
            {/* Brand */}
            <div className="sm:col-span-2 md:col-span-1">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-8 md:h-10 mb-4"
              />
              <p className="text-white/80 text-sm md:text-base leading-relaxed">
                專注於 Pokémon TCG 價格查詢與市場分析的綜合平台
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm md:text-base">快速導航</h4>
              <ul className="space-y-2">
                <li><Link href="/research" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">卡牌搜尋</Link></li>
                <li><Link href="/research" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">市場分析</Link></li>
                <li><Link href="/pricing" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">價格查詢</Link></li>
                <li><Link href="/admin" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">管理後台</Link></li>
              </ul>
            </div>

            {/* Info */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm md:text-base">關於我們</h4>
              <p className="text-white/80 text-xs md:text-sm leading-relaxed">
                BOXIUM 致力於為 Pokémon TCG 投資者和收藏家提供最準確、最專業的市場資訊和價格分析工具。
              </p>
            </div>

            {/* Social Links */}
            <div>
              <h4 className="text-white font-bold mb-4 text-sm md:text-base">社交媒體</h4>
              <div className="flex gap-4">
                <a href="#" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Facebook">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Twitter">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Instagram">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Email">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-4">
              <Link href="/terms" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
                服務條款
              </Link>
              <span className="hidden sm:inline text-white/40">|</span>
              <Link href="/privacy" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
                隱私權政策
              </Link>
            </div>
            <p className="text-white/60 text-xs md:text-sm">© 2026 BOXIUM. All rights reserved. | Luck in Every Box</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
