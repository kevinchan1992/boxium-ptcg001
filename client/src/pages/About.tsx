import { Card } from "@/components/ui/card";
import { Search, TrendingUp, Flame, Award, Check, Database, RefreshCw, Globe, Smartphone, BarChart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";

export default function About() {
  // 查詢平台統計數據
  const { data: stats } = trpc.cards.getStats.useQuery();
  const coreServices = [
    {
      icon: <Search className="w-8 h-8" />,
      title: "卡牌搜尋",
      description: "整合全球市場數據，快速找到目標卡牌。支援中文、英文、日文多語言搜尋，涵蓋 699+ 張熱門卡牌資訊。"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "價格追蹤",
      description: "提供 SNKRDUNK 真實交易記錄，專注 PSA 10 高評級市場。每 12 小時自動更新，確保數據新鮮度。"
    },
    {
      icon: <Flame className="w-8 h-8" />,
      title: "市場趨勢",
      description: "24 小時熱門排行榜，即時掌握價格飆升和暴跌動態。搜尋熱度、價格變化、新上架卡牌一目了然。"
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "評級分析",
      description: "支援 PSA 10、BGS 10、中古等多評級價格比較。幫助收藏家了解不同評級的市場價值差異。"
    }
  ];

  const features = [
    { icon: <Check className="w-5 h-5" />, text: "真實交易數據（非估價）" },
    { icon: <Check className="w-5 h-5" />, text: "自動更新機制（12 小時更新一次）" },
    { icon: <Check className="w-5 h-5" />, text: "多貨幣支援（HKD/TWD/JPY/USD）" },
    { icon: <Check className="w-5 h-5" />, text: "響應式設計（手機/桌面完美適配）" }
  ];

  const dataSources = [
    {
      name: "SNKRDUNK",
      description: "日本最大的球鞋和卡牌交易平台，提供真實成交價格記錄",
      icon: <Database className="w-6 h-6" />
    },
    {
      name: "eBay",
      description: "全球最大的拍賣平台，涵蓋國際市場的卡牌交易數據",
      icon: <Globe className="w-6 h-6" />
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <PageHead 
        title="關於我們 - BOXIUM PTCG 寶可夢卡牌市場數據平台"
        description="BOXIUM 提供專業的寶可夢卡牌市場數據分析工具，包含 PSA 10 價格追蹤、24 小時熱門排行榜、SNKRDUNK 真實交易記錄。整合全球市場數據，幫助收藏家做出明智的投資決策。"
        keywords="BOXIUM,寶可夢卡牌,PTCG,PSA 10,卡牌價格,市場數據,SNKRDUNK,關於我們"
      />
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12 md:mb-16">
          <div className="flex justify-center mb-6">
            <img 
              src="/boxium-logo-white.png" 
              alt="BOXIUM Logo" 
              className="h-24 md:h-32 w-auto"
              onError={(e) => {
                // Fallback if image not found
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4">
            關於 BOXIUM
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            專業的寶可夢卡牌市場數據平台
          </p>
        </div>

        {/* Mission */}
        <div className="max-w-4xl mx-auto mb-16">
          <Card className="bg-slate-900/50 border-slate-700 p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
              我們的使命
            </h2>
            <p className="text-gray-300 text-base md:text-lg leading-relaxed text-center">
              為 PTCG 收藏家和投資者提供準確、即時的市場數據分析工具。我們相信，透明的價格資訊和專業的市場洞察，能夠幫助每一位收藏家做出更明智的決策，追蹤卡牌的價格趨勢，掌握市場脈動，做出明智的投資決策。
            </p>
          </Card>
        </div>

        {/* Platform Statistics */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            平台數據統計
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <BarChart className="w-7 h-7 text-blue-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">
                {stats?.totalCards?.toLocaleString() || '759+'}  
              </div>
              <div className="text-gray-400 text-sm">
                已追蹤卡牌數量
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Database className="w-7 h-7 text-orange-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">
                2
              </div>
              <div className="text-gray-400 text-sm">
                數據來源數量
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                  <RefreshCw className="w-7 h-7 text-green-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">
                2次/天
              </div>
              <div className="text-gray-400 text-sm">
                每日更新次數
              </div>
            </Card>
          </div>
        </div>

        {/* Core Services */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            核心服務
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            {coreServices.map((service, index) => (
              <Card key={index} className="bg-slate-900/50 border-slate-700 p-6 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                    {service.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Platform Features */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            平台特色
          </h2>
          <div className="max-w-3xl mx-auto">
            <Card className="bg-slate-900/50 border-slate-700 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                      {feature.icon}
                    </div>
                    <span className="text-gray-300 text-sm md:text-base">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Data Sources */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            數據來源
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {dataSources.map((source, index) => (
              <Card key={index} className="bg-slate-900/50 border-slate-700 p-6 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                    {source.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {source.name}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {source.description}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Why Choose BOXIUM */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-8">
            為什麼選擇 BOXIUM？
          </h2>
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 p-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                    1
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">專注 PSA 10 高評級市場</h3>
                    <p className="text-gray-300 text-sm">不同於泛用價格查詢工具，我們專注於最具投資價值的 PSA 10 評級卡牌市場。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                    2
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">真實交易記錄</h3>
                    <p className="text-gray-300 text-sm">所有價格數據來自真實成交記錄，而非估價或掛牌價，更貼近市場實際情況。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">24 小時熱門排行榜</h3>
                    <p className="text-gray-300 text-sm">即時追蹤市場動態，第一時間掌握價格飆升和暴跌的卡牌，不錯過任何投資機會。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                    4
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">免費使用</h3>
                    <p className="text-gray-300 text-sm">無需註冊即可查詢基本數據，讓每一位收藏家都能輕鬆獲取市場資訊。</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center mb-12">
          <p className="text-gray-400 text-lg mb-4">
            準備好探索寶可夢卡牌市場了嗎？
          </p>
          <a 
            href="/research" 
            className="inline-block px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-yellow-600 transition-colors"
          >
            開始搜尋卡牌
          </a>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}
