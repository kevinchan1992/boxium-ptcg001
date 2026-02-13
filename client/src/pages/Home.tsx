import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, TrendingUp, Search, BarChart3, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm border-b" style={{ borderColor: "#e0e0e0" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-10"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/research" className="text-gray-700 hover:text-[#06038d] transition-colors font-medium">卡牌搜尋</Link>
              <Link href="/admin" className="text-gray-700 hover:text-[#06038d] transition-colors font-medium">管理後台</Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-4 space-y-3">
              <Link href="/research" className="block text-gray-700 hover:text-[#06038d] transition-colors font-medium">卡牌搜尋</Link>
              <Link href="/admin" className="block text-gray-700 hover:text-[#06038d] transition-colors font-medium">管理後台</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <h1 className="text-white text-4xl md:text-5xl font-bold mb-4 leading-tight">
                  歡迎來到 Boxium ~ 遊戲迷專屬世界
                </h1>
                <p className="text-white/80 text-lg leading-relaxed">
                  整合全球市場數據，為PTCG愛好者和收藏家提供即時、準確的卡牌價格資訊。追蹤卡牌的價格趨勢，做出明智的投資決策。
                </p>
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold text-[#ffed00] mb-2">500+</div>
                  <div className="text-white/80 text-sm">已追蹤卡牌</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold text-[#ffed00] mb-2">2 個</div>
                  <div className="text-white/80 text-sm">數據源</div>
                </div>
              </div>

              <Link href="/research">
                <Button
                  className="w-full md:w-auto px-8 py-3 text-lg font-semibold rounded-lg transition-all hover:scale-105 hover:shadow-2xl"
                  style={{ backgroundColor: "#ffed00", color: "#06038d" }}
                >
                  開始搜尋 →
                </Button>
              </Link>
            </div>

            {/* Right - Search Preview */}
            <div className="hidden md:block">
              <div className="bg-white rounded-xl shadow-2xl p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">搜尋卡牌</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="輸入卡牌名稱或編號..."
                      className="pl-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06038d] focus:border-transparent"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filter Tags */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">評級篩選</label>
                  <div className="flex flex-wrap gap-2">
                    {["PSA 10", "BGS 10", "中古"].map((grade) => (
                      <button
                        key={grade}
                        className="px-4 py-2 rounded-full text-sm font-medium border-2 transition-all hover:bg-[#06038d] hover:text-white hover:border-[#06038d]"
                        style={{ borderColor: "#06038d", color: "#06038d" }}
                      >
                        {grade}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: "#06038d" }}>
              核心功能
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              BOXIUM 提供專業的卡牌價格分析工具，幫助您做出更明智的投資決策
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Search className="h-7 w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: "#06038d" }}>智能搜尋</h3>
              <p className="text-gray-600 leading-relaxed">
                快速搜尋數百張卡牌，支援名稱、編號、系列等多維度篩選
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-6" style={{ backgroundColor: "#ffed00" }}>
                <TrendingUp className="h-7 w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: "#06038d" }}>價格趨勢</h3>
              <p className="text-gray-600 leading-relaxed">
                查看 90 天內的價格變化，掌握市場動態和投資時機
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-6" style={{ backgroundColor: "#ffed00" }}>
                <BarChart3 className="h-7 w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: "#06038d" }}>市場統計</h3>
              <p className="text-gray-600 leading-relaxed">
                實時市場數據分析，了解卡牌的平均價格和市場表現
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white border-2 border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-[#ffed00] transition-all">
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-6" style={{ backgroundColor: "#ffed00" }}>
                <Trophy className="h-7 w-7" style={{ color: "#06038d" }} />
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: "#06038d" }}>熱門排行</h3>
              <p className="text-gray-600 leading-relaxed">
                發現市場上最熱門的卡牌，跟蹤投資者的選擇
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-20 px-4" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: "#06038d" }}>
              權威數據源
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              整合全球領先的卡牌交易平台，確保數據的準確性和實時性
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* SNKRDUNK */}
            <div className="bg-white rounded-xl p-8 shadow-md border-l-4" style={{ borderColor: "#06038d" }}>
              <h3 className="text-2xl font-bold mb-4" style={{ color: "#06038d" }}>SNKRDUNK</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                日本領先的卡牌交易平台，提供最新的 PSA 10 評級卡牌交易數據和市場趨勢分析
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <div>✓ 實時交易數據</div>
                <div>✓ PSA 評級支援</div>
                <div>✓ 日幣價格</div>
              </div>
            </div>

            {/* eBay */}
            <div className="bg-white rounded-xl p-8 shadow-md border-l-4" style={{ borderColor: "#ffed00" }}>
              <h3 className="text-2xl font-bold mb-4" style={{ color: "#06038d" }}>eBay</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                全球最大的線上拍賣平台，提供國際市場的卡牌交易記錄和價格參考
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <div>✓ 全球市場數據</div>
                <div>✓ PSA 評級支援</div>
                <div>✓ 美元價格</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: "#06038d" }}>
            準備好開始你的PTCG之旅了嗎？
          </h2>
          <p className="text-gray-600 text-lg mb-10 leading-relaxed">
            使用 BOXIUM 的智能搜尋和價格分析工具，找到你的愛好收藏品。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/research">
              <Button
                className="px-8 py-3 text-lg font-semibold rounded-lg transition-all hover:scale-105"
                style={{ backgroundColor: "#06038d", color: "white" }}
              >
                開始搜尋卡牌
              </Button>
            </Link>
            <Link href="/research">
              <Button
                variant="outline"
                className="px-8 py-3 text-lg font-semibold rounded-lg transition-all hover:scale-105 border-2"
                style={{ borderColor: "#06038d", color: "#06038d" }}
              >
                查看市場趨勢
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t" style={{ backgroundColor: "#06038d" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-8">
            {/* Brand */}
            <div>
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-10 mb-4"
              />
              <p className="text-white/80 leading-relaxed">
                專注於 Pokémon TCG 價格查詢與市場分析的綜合平台
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-4">快速導航</h4>
              <ul className="space-y-2">
                <li><Link href="/research" className="text-white/80 hover:text-white transition-colors">卡牌搜尋</Link></li>
                <li><Link href="/research" className="text-white/80 hover:text-white transition-colors">市場分析</Link></li>
                <li><Link href="/admin" className="text-white/80 hover:text-white transition-colors">管理後台</Link></li>
              </ul>
            </div>

            {/* Info */}
            <div>
              <h4 className="text-white font-bold mb-4">關於我們</h4>
              <p className="text-white/80 text-sm leading-relaxed">
                BOXIUM 致力於為 Pokémon TCG 投資者和收藏家提供最準確、最專業的市場資訊和價格分析工具。
              </p>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-white/60 text-sm">
            <p>© 2026 BOXIUM. All rights reserved. | Luck in Every Box</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
