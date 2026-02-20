import { Search, TrendingUp, Flame, Award, Check, Database, RefreshCw, Globe, Smartphone, BarChart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import StructuredData from "@/components/StructuredData";

export default function About() {
  // 查詢平台統計數據
  const { data: stats } = trpc.cards.getStats.useQuery();
  
  // FAQ Structured Data for SEO
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "BOXIUM PTCG 是什麼？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "BOXIUM PTCG 是一個專注於 Pokémon TCG 價格查詢與市場分析的綜合平台。我們整合全球市場數據，為 PTCG 愛好者和收藏家提供準確、即時的卡牌價格資訊，幫助您追蹤卡牌的價格趨勢，做出明智的投資決策。"
        }
      },
      {
        "@type": "Question",
        "name": "BOXIUM 的數據來源是什麼？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "我們的數據主要來自兩個可靠來源：SNKRDUNK（日本最大的球鞋和卡牌交易平台，提供真實成交價格記錄）和 eBay（全球最大的拍賣平台，涵蓋國際市場的卡牌交易數據）。所有數據均為真實交易記錄，非估價。"
        }
      },
      {
        "@type": "Question",
        "name": "數據多久更新一次？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "我們的系統每 12 小時自動更新一次價格數據，確保您獲得最新鮮的市場資訊。熱門排行榜則是基於 24 小時內的數據動態生成，即時反映市場趨勢。"
        }
      },
      {
        "@type": "Question",
        "name": "BOXIUM 支援哪些評級？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "我們支援多種評級系統，包括 PSA 10、BGS 10、以及中古等級（A、B、C、D）。您可以在卡牌詳情頁面篩選不同評級的價格記錄，了解不同評級的市場價值差異。"
        }
      },
      {
        "@type": "Question",
        "name": "如何使用 BOXIUM 搜尋卡牌？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "您可以在首頁或卡牌搜尋頁面的搜尋框中輸入卡牌名稱、編號或系列名稱。我們支援中文、英文、日文多語言搜尋，涵蓋 1000+ 張熱門卡牌資訊。搜尋結果會顯示卡牌圖片、當前價格和歷史交易記錄。"
        }
      }
    ]
  };

  // AboutPage Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "關於我們 - BOXIUM PTCG",
    "description": "為 Pokémon TCG 收藏家提供準確、即時的市場數據分析平台",
    "url": "https://boxiumptcg.manus.space/about",
    "mainEntity": {
      "@type": "Organization",
      "name": "BOXIUM",
      "description": "專注於 Pokémon TCG 價格查詢與市場分析的綜合平台",
      "logo": "https://boxiumptcg.manus.space/boxium-logo.png",
      "url": "https://boxiumptcg.manus.space",
      "sameAs": [
        "https://www.facebook.com/boxium",
        "https://www.instagram.com/boxium"
      ]
    }
  };

  const coreServices = [
    {
      icon: <Search className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "卡牌搜尋",
      description: "整合全球市場數據，快速找到目標卡牌。支援中文、英文、日文多語言搜尋，涵蓋 " + (stats?.totalCards || "699+") + " 張熱門卡牌資訊。"
    },
    {
      icon: <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "價格追蹤",
      description: "提供 SNKRDUNK 真實交易記錄，專注 PSA 10 高評級市場。每 12 小時自動更新，確保數據新鮮度。"
    },
    {
      icon: <Flame className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "市場趨勢",
      description: "24 小時熱門排行榜，即時掌握價格飆升和暴跌動態。搜尋熱度、價格變化、新上架卡牌一目了然。"
    },
    {
      icon: <Award className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "評級分析",
      description: "支援 PSA 10、BGS 10、中古等多評級價格比較。幫助收藏家了解不同評級的市場價值差異。"
    }
  ];

  const features = [
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: "真實交易數據（非估價）" },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: "自動更新機制（12 小時更新一次）" },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: "多貨幣支援（HKD/TWD/JPY/USD）" },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: "響應式設計（手機/桌面完美適配）" }
  ];

  const dataSources = [
    {
      name: "SNKRDUNK",
      description: "日本最大的球鞋和卡牌交易平台，提供真實成交價格記錄，專注 PSA 10 高評級市場數據",
      logo: "/snkrdunk-logo.png"
    },
    {
      name: "eBay",
      description: "全球最大的拍賣平台，涵蓋國際市場的卡牌交易數據，提供多元化的價格參考",
      logo: "/ebay-logo.png"
    }
  ];

  return (
    <>
      <StructuredData data={faqStructuredData} />
      <StructuredData data={structuredData} />
      <PageHead 
        title="關於我們 - BOXIUM PTCG 寶可夢卡牌市場數據平台"
        description="BOXIUM 提供專業的寶可夢卡牌市場數據分析工具，包含 PSA 10 價格追蹤、24 小時熱門排行榜、SNKRDUNK 真實交易記錄。整合全球市場數據，幫助收藏家做出明智的投資決策。"
        keywords="BOXIUM,寶可夢卡牌,PTCG,PSA 10,卡牌價格,市場數據,SNKRDUNK,關於我們"
      />
      <div className="min-h-screen py-8 sm:py-12 px-4 sm:px-6" style={{ backgroundColor: "#f8f9fa" }}>
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6 sm:p-8 md:p-12">
          {/* Logo */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM Logo"
              className="h-16 sm:h-20 md:h-24"
            />
          </div>
          
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-center" style={{ color: "#06038d" }}>
            關於 BOXIUM
          </h1>
          
          <p className="text-center text-gray-700 text-sm sm:text-base md:text-lg mb-8 sm:mb-10 leading-relaxed">
            為 Pokémon TCG 收藏家提供準確、即時的市場數據分析平台
          </p>

          {/* 平台數據統計 */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-10 sm:mb-12">
              <div className="text-center p-4 sm:p-6 rounded-lg" style={{ backgroundColor: "#f0f4ff" }}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2" style={{ color: "#06038d" }}>
                  {stats.totalCards}+
                </div>
                <div className="text-xs sm:text-sm text-gray-600">已追蹤卡牌</div>
              </div>
              <div className="text-center p-4 sm:p-6 rounded-lg" style={{ backgroundColor: "#f0f4ff" }}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2" style={{ color: "#06038d" }}>
                  2
                </div>
                <div className="text-xs sm:text-sm text-gray-600">資料來源</div>
              </div>
            </div>
          )}

          {/* 我們的使命 */}
          <section className="mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6" style={{ color: "#06038d" }}>
              我們的使命
            </h2>
            <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
              BOXIUM 致力於為 Pokémon TCG 收藏家和投資者提供最準確、最即時的市場數據。我們整合全球主要交易平台的真實成交記錄，透過專業的數據分析工具，幫助用戶掌握市場趨勢，做出明智的收藏和投資決策。
            </p>
          </section>

          {/* 核心服務 */}
          <section className="mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8" style={{ color: "#06038d" }}>
              核心服務
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {coreServices.map((service, index) => (
                <div key={index} className="p-4 sm:p-6 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3 mb-3" style={{ color: "#06038d" }}>
                    {service.icon}
                    <h3 className="text-base sm:text-lg font-semibold">{service.title}</h3>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 平台特色 */}
          <section className="mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6" style={{ color: "#06038d" }}>
              平台特色
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3 text-gray-700">
                  <div className="flex-shrink-0" style={{ color: "#06038d" }}>
                    {feature.icon}
                  </div>
                  <span className="text-xs sm:text-sm">{feature.text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 數據來源 */}
          <section className="mb-8 sm:mb-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6" style={{ color: "#06038d" }}>
              數據來源
            </h2>
            <div className="space-y-4">
              {dataSources.map((source, index) => (
                <div key={index} className="flex items-start gap-3 sm:gap-4 p-4 rounded-lg" style={{ backgroundColor: "#f0f4ff" }}>
                  <div className="flex-shrink-0">
                    <img 
                      src={source.logo} 
                      alt={source.name} 
                      className="h-10 sm:h-12 object-contain"
                      style={{ minWidth: '120px' }}
                    />
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs sm:text-sm mt-1">
                      {source.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 聯絡資訊 */}
          <div className="pt-6 sm:pt-8 border-t border-gray-200 text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              如有任何問題或建議，歡迎透過平台提供的聯絡方式與我們聯繫。
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </>
  );
}
