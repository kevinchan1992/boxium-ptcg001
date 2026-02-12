import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { TrendingUp, Database, Globe, Shield, Menu } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#06038d]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#06038d]/95 backdrop-blur-sm border-b border-[#fedd00]/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-[#fedd00] flex items-center justify-center">
                  <span className="text-[#06038d] font-bold text-xl">B</span>
                </div>
                <span className="text-[#fedd00] font-bold text-xl">BOXIUM</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/research">
                <a className="text-gray-200 hover:text-[#fedd00] transition-colors font-medium">研究</a>
              </Link>
              <Link href="/pricing">
                <a className="text-gray-200 hover:text-[#fedd00] transition-colors font-medium">格價</a>
              </Link>
              <Link href="/profile">
                <a className="text-gray-200 hover:text-[#fedd00] transition-colors font-medium">用戶</a>
              </Link>
              <Link href="/admin">
                <Button variant="outline" className="border-[#fedd00] text-[#fedd00] hover:bg-[#fedd00]/10">
                  管理後台
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-[#fedd00]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-3">
              <Link href="/research">
                <a className="block text-gray-200 hover:text-[#fedd00] transition-colors font-medium">研究</a>
              </Link>
              <Link href="/pricing">
                <a className="block text-gray-200 hover:text-[#fedd00] transition-colors font-medium">格價</a>
              </Link>
              <Link href="/profile">
                <a className="block text-gray-200 hover:text-[#fedd00] transition-colors font-medium">用戶</a>
              </Link>
              <Link href="/admin">
                <a className="block text-gray-200 hover:text-[#fedd00] transition-colors font-medium">管理後台</a>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center space-y-8">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM"
              className="w-full max-w-3xl h-auto"
            />
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#fedd00] max-w-4xl leading-tight">
              專注於 Pokémon TCG 之價格查詢與交易的綜合平台
            </h1>
            <p className="text-lg md:text-xl text-gray-200 max-w-3xl">
              結合國際權威價格數據源與本地化交易功能，服務香港與台灣地區的玩家、收藏家與實體店鋪
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/research">
                <Button size="lg" className="bg-[#fedd00] text-[#06038d] hover:bg-[#fedd00]/90 font-bold text-lg px-12 py-6">
                  開始查詢
                </Button>
              </Link>
              <Link href="/admin">
                <Button size="lg" variant="outline" className="border-[#fedd00] text-[#fedd00] hover:bg-[#fedd00]/10 font-bold text-lg px-12 py-6">
                  管理後台
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4 bg-white/5">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-[#fedd00] mb-12">
            我們的使命
          </h2>
          <Card className="p-8 md:p-12 bg-white/10 backdrop-blur-sm border-[#fedd00]/30">
            <p className="text-lg md:text-xl text-gray-100 leading-relaxed text-center">
              BOXIUM 致力於為 Pokémon TCG 愛好者提供最準確、最即時的卡牌價格資訊。我們整合全球主要交易平台的數據，讓玩家和收藏家能夠做出明智的交易決策，同時為實體店鋪提供市場趨勢分析，助力業務發展。
            </p>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-[#fedd00] mb-16">
            服務特色
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-8 bg-white/10 backdrop-blur-sm border-[#fedd00]/30 hover:border-[#fedd00]/60 hover:bg-white/15 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#fedd00]/20 flex items-center justify-center">
                  <Database className="w-10 h-10 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-[#fedd00]">權威數據源</h3>
                <p className="text-gray-200 leading-relaxed">
                  整合 SNKRDUNK、eBay 等國際主流交易平台，提供最全面的價格數據
                </p>
              </div>
            </Card>

            <Card className="p-8 bg-white/10 backdrop-blur-sm border-[#fedd00]/30 hover:border-[#fedd00]/60 hover:bg-white/15 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#fedd00]/20 flex items-center justify-center">
                  <TrendingUp className="w-10 h-10 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-[#fedd00]">即時更新</h3>
                <p className="text-gray-200 leading-relaxed">
                  每 12 小時自動更新價格數據，確保您獲得最新的市場資訊
                </p>
              </div>
            </Card>

            <Card className="p-8 bg-white/10 backdrop-blur-sm border-[#fedd00]/30 hover:border-[#fedd00]/60 hover:bg-white/15 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#fedd00]/20 flex items-center justify-center">
                  <Globe className="w-10 h-10 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-[#fedd00]">本地化服務</h3>
                <p className="text-gray-200 leading-relaxed">
                  專為香港與台灣地區設計，支援 HKD/TWD 幣種轉換與本地化交易功能
                </p>
              </div>
            </Card>

            <Card className="p-8 bg-white/10 backdrop-blur-sm border-[#fedd00]/30 hover:border-[#fedd00]/60 hover:bg-white/15 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#fedd00]/20 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-[#fedd00]">專業評級</h3>
                <p className="text-gray-200 leading-relaxed">
                  支援 PSA、BGS 等專業評級卡牌價格查詢，精準掌握不同品相的市場價值
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-white/5">
        <div className="container mx-auto max-w-4xl">
          <Card className="p-12 md:p-16 bg-[#fedd00]/15 backdrop-blur-sm border-[#fedd00]/40">
            <div className="text-center space-y-6">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#fedd00]">
                開始您的 Pokémon TCG 價格查詢之旅
              </h2>
              <p className="text-lg md:text-xl text-gray-100">
                立即體驗 BOXIUM 的專業價格查詢服務，讓每一次交易都充滿信心
              </p>
              <Link href="/research">
                <Button size="lg" className="bg-[#fedd00] text-[#06038d] hover:bg-[#fedd00]/90 font-bold text-lg px-16 py-6 mt-4">
                  立即開始
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-[#fedd00]/20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-[#fedd00] flex items-center justify-center">
                <span className="text-[#06038d] font-bold text-lg">B</span>
              </div>
              <span className="text-[#fedd00] font-bold text-lg">BOXIUM</span>
            </div>
            <p className="text-gray-300 text-sm">
              © 2026 BOXIUM. LUCK IN EVERY BOX.
            </p>
            <div className="flex space-x-6">
              <Link href="/research">
                <a className="text-gray-300 hover:text-[#fedd00] transition-colors text-sm">研究</a>
              </Link>
              <Link href="/pricing">
                <a className="text-gray-300 hover:text-[#fedd00] transition-colors text-sm">格價</a>
              </Link>
              <Link href="/admin">
                <a className="text-gray-300 hover:text-[#fedd00] transition-colors text-sm">管理後台</a>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
