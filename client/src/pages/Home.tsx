import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { TrendingUp, Database, Globe, Shield } from "lucide-react";

export default function Home() {
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#06038d] via-[#0a0560] to-background">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-8">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM"
              className="w-full max-w-2xl h-auto"
            />
            <p className="text-2xl md:text-3xl font-bold text-[#fedd00] max-w-3xl">
              專注於 Pokémon TCG 之價格查詢與交易的綜合平台
            </p>
            <p className="text-lg md:text-xl text-gray-200 max-w-2xl">
              結合國際權威價格數據源與本地化交易功能，服務香港與台灣地區的玩家、收藏家與實體店鋪
            </p>
            <div className="flex gap-4 mt-8">
              <Link href="/research">
                <Button size="lg" className="bg-[#fedd00] text-[#06038d] hover:bg-[#fedd00]/90 font-bold text-lg px-8">
                  開始查詢
                </Button>
              </Link>
              <Link href="/admin">
                <Button size="lg" variant="outline" className="border-[#fedd00] text-[#fedd00] hover:bg-[#fedd00]/10 font-bold text-lg px-8">
                  管理後台
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-[#fedd00] mb-12">
              我們的使命
            </h2>
            <Card className="p-8 bg-card/50 backdrop-blur-sm border-[#fedd00]/20">
              <p className="text-lg text-foreground leading-relaxed text-center">
                BOXIUM 致力於為 Pokémon TCG 愛好者提供最準確、最即時的卡牌價格資訊。我們整合全球主要交易平台的數據，讓玩家和收藏家能夠做出明智的交易決策，同時為實體店鋪提供市場趨勢分析，助力業務發展。
              </p>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#fedd00] mb-12">
            服務特色
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 bg-card/50 backdrop-blur-sm border-[#fedd00]/20 hover:border-[#fedd00]/50 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#fedd00]/10 flex items-center justify-center">
                  <Database className="w-8 h-8 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-foreground">權威數據源</h3>
                <p className="text-muted-foreground">
                  整合 SNKRDUNK、eBay 等國際主流交易平台，提供最全面的價格數據
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-[#fedd00]/20 hover:border-[#fedd00]/50 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#fedd00]/10 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-foreground">即時更新</h3>
                <p className="text-muted-foreground">
                  每 12 小時自動更新價格數據，確保您獲得最新的市場資訊
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-[#fedd00]/20 hover:border-[#fedd00]/50 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#fedd00]/10 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-foreground">本地化服務</h3>
                <p className="text-muted-foreground">
                  專為香港與台灣地區設計，支援 HKD/TWD 幣種轉換與本地化交易功能
                </p>
              </div>
            </Card>

            <Card className="p-6 bg-card/50 backdrop-blur-sm border-[#fedd00]/20 hover:border-[#fedd00]/50 transition-all">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#fedd00]/10 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-[#fedd00]" />
                </div>
                <h3 className="text-xl font-bold text-foreground">專業評級</h3>
                <p className="text-muted-foreground">
                  支援 PSA、BGS 等專業評級卡牌價格查詢，精準掌握不同品相的市場價值
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 pb-24">
          <Card className="p-12 bg-[#fedd00]/10 backdrop-blur-sm border-[#fedd00]/30 max-w-4xl mx-auto">
            <div className="text-center space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-[#fedd00]">
                開始您的 Pokémon TCG 價格查詢之旅
              </h2>
              <p className="text-lg text-foreground">
                立即體驗 BOXIUM 的專業價格查詢服務，讓每一次交易都充滿信心
              </p>
              <Link href="/research">
                <Button size="lg" className="bg-[#fedd00] text-[#06038d] hover:bg-[#fedd00]/90 font-bold text-lg px-12">
                  立即開始
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </MainLayout>
  );
}
