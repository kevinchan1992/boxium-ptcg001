import { useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
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
              <Link href="/research" className="text-gray-700 hover:text-[#06038d] transition-colors">卡牌搜尋</Link>
              <Link href="/admin" className="text-gray-700 hover:text-[#06038d] transition-colors">管理後台</Link>
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
              <Link href="/research" className="block text-gray-700 hover:text-[#06038d] transition-colors">研究</Link>
              <Link href="/admin" className="block text-gray-700 hover:text-[#06038d] transition-colors">管理後台</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Full Screen */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src="/hero-pokemon-cards.jpg"
            alt="Pokemon Trading Cards Collection"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#06038d]/80 via-[#06038d]/70 to-[#06038d]/90"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-white text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-light tracking-wide mb-8 leading-relaxed">
            專注於 Pokémon TCG 之價格查詢與交易的綜合平台
          </h1>
          <p className="text-white/90 text-lg md:text-xl font-light mb-12 max-w-2xl mx-auto leading-relaxed">
            整合多個市場的價格數據，為香港及台灣的收藏家提供最權威的市場資訊
          </p>
          <Link href="/research">
            <button
              className="px-8 py-4 text-lg font-medium rounded-full transition-all hover:scale-105 hover:shadow-2xl"
              style={{ backgroundColor: "#fedd00", color: "#06038d" }}
            >
              開始探索
            </button>
          </Link>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-1.5 bg-white/50 rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-32 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-sm uppercase tracking-widest mb-6" style={{ color: "#06038d" }}>我們的使命</h2>
          <p className="text-4xl md:text-5xl font-light leading-relaxed text-gray-800 mb-8">
            為收藏家提供透明、準確的市場資訊
          </p>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            BOXIUM 致力於整合 SNKRDUNK、eBay 等權威數據源，提供即時更新的價格走勢與專業評級資訊，讓每一位收藏家都能做出明智的投資決策。
          </p>
        </div>
      </section>

      {/* Visual Divider */}
      <section className="relative h-[60vh] overflow-hidden">
        <img
          src="/section-booster-packs.jpg"
          alt="Pokemon Booster Packs Collection"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center">
          <div className="max-w-2xl mx-auto px-8 text-white">
            <h3 className="text-3xl md:text-4xl font-light mb-4">專業評級，值得信賴</h3>
            <p className="text-lg font-light leading-relaxed">
              支援 PSA 10、BGS 10 等國際權威評級標準，精準追蹤每一張卡牌的市場價值。
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-center mb-16" style={{ color: "#06038d", fontSize: '16px' }}>核心服務</h2>
          
          <div className="grid md:grid-cols-2 gap-16">
            {/* Feature 1 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fedd00" }}>
                <span className="text-2xl font-bold" style={{ color: "#06038d" }}>1</span>
              </div>
              <h3 className="text-2xl font-light" style={{ color: "#06038d" }}>權威數據源</h3>
              <p className="text-gray-600 leading-relaxed">
                整合 SNKRDUNK、eBay 等國際知名平台的交易數據，確保價格資訊的準確性與可靠性。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fedd00" }}>
                <span className="text-2xl font-bold" style={{ color: "#06038d" }}>2</span>
              </div>
              <h3 className="text-2xl font-light" style={{ color: "#06038d" }}>即時更新</h3>
              <p className="text-gray-600 leading-relaxed">
                每 12 小時自動更新價格數據，讓您隨時掌握市場最新動態，不錯過任何投資機會。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fedd00" }}>
                <span className="text-2xl font-bold" style={{ color: "#06038d" }}>3</span>
              </div>
              <h3 className="text-2xl font-light" style={{ color: "#06038d" }}>本地化服務</h3>
              <p className="text-gray-600 leading-relaxed">
                專為香港及台灣市場設計，支援港幣與台幣顯示，提供最貼近本地收藏家需求的服務。
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fedd00" }}>
                <span className="text-2xl font-bold" style={{ color: "#06038d" }}>4</span>
              </div>
              <h3 className="text-2xl font-light" style={{ color: "#06038d" }}>專業評級</h3>
              <p className="text-gray-600 leading-relaxed">
                支援 PSA 10、BGS 10 及中古品等多種評級標準，幫助您精準評估卡牌的真實價值。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-light mb-8 text-gray-800">準備好開始了嗎？</h2>
          <p className="text-lg text-gray-600 mb-12 leading-relaxed">
            立即探索我們的搜尋工具，發掘您的下一個收藏目標。
          </p>
          <Link href="/research">
            <button
              className="px-8 py-4 text-lg font-medium rounded-full transition-all hover:scale-105 hover:shadow-2xl"
              style={{ backgroundColor: "#06038d", color: "white" }}
            >
              前往搜尋卡牌頁面
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM Logo"
              className="h-12"
            />
          </div>
          <p className="text-gray-500 text-sm">
            © 2026 BOXIUM. 專注於 Pokémon TCG 價格查詢與交易的綜合平台。
          </p>
        </div>
      </footer>
    </div>
  );
}
