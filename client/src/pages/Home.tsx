import { useState } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Search, BarChart3, Trophy, Facebook, Twitter, Instagram, Mail, User, LogOut, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";


function TrendingCardsGrid() {
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
        <p className="text-gray-500 text-lg">暂無熱門卡牌數據</p>
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
                <span className="text-sm">無圖片</span>
              </div>
            )}
            {/* Price Change Badge */}
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-red-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold shadow-lg">
              {card.priceChangeFormatted}
            </div>
          </div>

          {/* Card Info */}
          <div className="p-3 sm:p-4">
            <h3 className="font-bold text-xs sm:text-sm mb-1 line-clamp-1" style={{ color: "#06038d" }}>
              {card.name}
            </h3>
            {card.nameJa && (
              <p className="text-[10px] sm:text-xs text-gray-500 mb-2 line-clamp-1">{card.nameJa}</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-sm sm:text-base md:text-lg font-bold" style={{ color: "#06038d" }}>
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
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  


  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Hero Section */}
      <section className="pt-16 md:pt-20 pb-16 md:pb-24 px-4 sm:px-6" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center text-center space-y-8 md:space-y-12">
            {/* LOGO - Responsive sizing */}
            <div className="w-full max-w-xs md:max-w-2xl">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="w-full h-auto"
              />
            </div>

            {/* Content - Responsive text sizes */}
            <div className="space-y-4 md:space-y-6 max-w-3xl px-2">
              <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
                歡迎來到 Boxium ~ 遊戲迷專屬世界
              </h1>
              <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed">
                整合全球市場數據，為PTCG愛好者和收藏家提供即時、準確的卡牌價格資訊。追蹤卡牌的價格趨勢，做出明智的投資決策。
              </p>
            </div>

            {/* Key Stats - Responsive layout */}
            <div className="grid grid-cols-2 gap-4 md:gap-6 w-full max-w-md px-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6 border border-white/20 text-center">
                <div className="text-2xl md:text-3xl font-bold text-[#ffed00] mb-2">500+</div>
                <div className="text-white/80 text-xs md:text-sm">已追蹤卡牌</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6 border border-white/20 text-center">
                <div className="text-2xl md:text-3xl font-bold text-[#ffed00] mb-2">2 個</div>
                <div className="text-white/80 text-xs md:text-sm">數據源</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
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
      <section className="py-12 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: "#06038d" }}>
              核心功能
            </h2>
            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto px-2">
              BOXIUM 提供專業的卡牌價格分析工具，幫助您做出更明智的投資決策
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Search className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>智能搜尋</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                快速搜尋數百張卡牌，支援名稱、編號、系列等多維度篩選
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <TrendingUp className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>價格趨勢</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                查看 90 天內的價格變化，掌握市場動態和投資時機
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <BarChart3 className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>市場統計</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                實時市場數據分析，了解卡牌的平均價格和市場表現
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-lg flex items-center justify-center mb-4 md:mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Trophy className="h-6 md:h-7 w-6 md:w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-lg md:text-xl font-bold mb-3" style={{ color: "#06038d" }}>熱門排行</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                發現市場上最熱門的卡牌，跟蹤投資者的選擇
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Cards Section */}
      <section className="py-12 md:py-20 px-4 sm:px-6" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Flame className="w-8 h-8 md:w-10 md:h-10" style={{ color: "#ff4500" }} />
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: "#06038d" }}>
                熱門卡牌
              </h2>
            </div>
            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto px-2">
              近期價格漲幅最高的卡牌，掌握市場熱點
            </p>
          </div>

          <TrendingCardsGrid />
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-12 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: "#06038d" }}>
              權威數據源
            </h2>
            <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto px-2">
              整合全球領先的卡牌交易平台，確保數據的準確性和實時性
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* SNKRDUNK */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#06038d" }}>
              <h3 className="text-xl md:text-2xl font-bold mb-4" style={{ color: "#06038d" }}>SNKRDUNK</h3>
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                日本領先的卡牌交易平台，提供最新的 PSA 10 評級卡牌交易數據和市場趨勢分析
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ 實時交易數據</div>
                <div>✓ PSA 評級支援</div>
                <div>✓ 日幣價格</div>
              </div>
            </div>

            {/* eBay */}
            <div className="bg-white rounded-xl p-6 md:p-8 shadow-md border-l-4" style={{ borderColor: "#ffed00" }}>
              <h3 className="text-xl md:text-2xl font-bold mb-4" style={{ color: "#06038d" }}>eBay</h3>
              <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">
                全球最大的線上拍賣平台，提供國際市場的卡牌交易記錄和價格參考
              </p>
              <div className="space-y-2 text-xs md:text-sm text-gray-600">
                <div>✓ 全球市場數據</div>
                <div>✓ PSA 評級支援</div>
                <div>✓ 美元價格</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6" style={{ color: "#06038d" }}>
            準備好開始你的PTCG之旅了嗎？
          </h2>
          <p className="text-gray-600 text-base md:text-lg mb-8 md:mb-10 leading-relaxed px-2">
            使用 BOXIUM 的智能搜尋和價格分析工具，找到你的愛好收藏品。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center px-2">
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
      <footer className="py-12 md:py-16 px-4 sm:px-6 border-t" style={{ backgroundColor: "#06038d" }}>
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
                <li><Link href="/favorites" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">我的收藏</Link></li>
                <li><Link href="/research" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">市場分析</Link></li>
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
