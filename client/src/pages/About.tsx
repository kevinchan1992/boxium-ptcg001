import { Search, TrendingUp, Flame, Award, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import StructuredData from "@/components/StructuredData";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  
  // 查詢平台統計數據
  const { data: stats } = trpc.cards.getStats.useQuery();
  
  // FAQ Structured Data for SEO
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUM PTCGとは何ですか？' : currentLang === 'en' ? 'What is BOXIUM PTCG?' : 'BOXIUM PTCG 是什麼？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentLang === 'ja' ? 'BOXIUM PTCGは、Pokémon TCGの価格照会と市場分析に特化した総合プラットフォームです。世界市場のデータを統合し、PTCGファンとコレクターに正確でリアルタイムなカード価格情報を提供し、カードの価格トレンドを追跡し、賢明な投資決定を下すのを支援します。' : currentLang === 'en' ? 'BOXIUM PTCG is a comprehensive platform focused on Pokémon TCG price inquiry and market analysis. We integrate global market data to provide PTCG enthusiasts and collectors with accurate and real-time card price information, helping you track card price trends and make informed investment decisions.' : 'BOXIUM PTCG 是一個專注於 Pokémon TCG 價格查詢與市場分析的綜合平台。我們整合全球市場數據，為 PTCG 愛好者和收藏家提供準確、即時的卡牌價格資訊，幫助您追蹤卡牌的價格趨勢，做出明智的投資決策。'
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUMのデータソースは何ですか？' : currentLang === 'en' ? 'What are BOXIUM\'s data sources?' : 'BOXIUM 的數據來源是什麼？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentLang === 'ja' ? '私たちのデータは主に2つの信頼できるソースから来ています：SNKRDUNK（日本最大のスニーカーとカード取引プラットフォーム、実際の取引価格記録を提供）とeBay（世界最大のオークションプラットフォーム、国際市場のカード取引データをカバー）。すべてのデータは実際の取引記録であり、推定値ではありません。' : currentLang === 'en' ? 'Our data mainly comes from two reliable sources: SNKRDUNK (Japan\'s largest sneaker and card trading platform, providing real transaction price records) and eBay (the world\'s largest auction platform, covering international market card transaction data). All data are real transaction records, not estimates.' : '我們的數據主要來自兩個可靠來源：SNKRDUNK（日本最大的球鞋和卡牌交易平台，提供真實成交價格記錄）和 eBay（全球最大的拍賣平台，涵蓋國際市場的卡牌交易數據）。所有數據均為真實交易記錄，非估價。'
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'データはどのくらいの頻度で更新されますか？' : currentLang === 'en' ? 'How often is data updated?' : '數據多久更新一次？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentLang === 'ja' ? '私たちのシステムは12時間ごとに価格データを自動更新し、最新の市場情報を取得できるようにします。トレンドリーダーボードは24時間以内のデータに基づいて動的に生成され、市場トレンドをリアルタイムで反映します。' : currentLang === 'en' ? 'Our system automatically updates price data every 12 hours to ensure you get the freshest market information. The trending leaderboard is dynamically generated based on data within 24 hours, reflecting market trends in real-time.' : '我們的系統每 12 小時自動更新一次價格數據，確保您獲得最新鮮的市場資訊。熱門排行榜則是基於 24 小時內的數據動態生成，即時反映市場趨勢。'
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUMはどのグレードをサポートしていますか？' : currentLang === 'en' ? 'What grades does BOXIUM support?' : 'BOXIUM 支援哪些評級？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentLang === 'ja' ? '私たちは、PSA 10、BGS 10、および中古グレード（A、B、C、D）を含む複数のグレードシステムをサポートしています。カード詳細ページで異なるグレードの価格記録をフィルタリングし、異なるグレードの市場価値の違いを理解できます。' : currentLang === 'en' ? 'We support multiple grading systems, including PSA 10, BGS 10, and used grades (A, B, C, D). You can filter price records of different grades on the card details page to understand the market value differences of different grades.' : '我們支援多種評級系統，包括 PSA 10、BGS 10、以及中古等級（A、B、C、D）。您可以在卡牌詳情頁面篩選不同評級的價格記錄，了解不同評級的市場價值差異。'
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUMでカードを検索するにはどうすればよいですか？' : currentLang === 'en' ? 'How to search for cards using BOXIUM?' : '如何使用 BOXIUM 搜尋卡牌？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": currentLang === 'ja' ? 'ホームページまたはカード検索ページの検索ボックスにカード名、番号、またはシリーズ名を入力できます。中国語、英語、日本語のマルチ言語検索をサポートし、1000+枚の人気カード情報をカバーしています。検索結果には、カード画像、現在の価格、および過去の取引記録が表示されます。' : currentLang === 'en' ? 'You can enter the card name, number, or series name in the search box on the homepage or card search page. We support multi-language search in Chinese, English, and Japanese, covering 1000+ popular card information. Search results will display card images, current prices, and historical transaction records.' : '您可以在首頁或卡牌搜尋頁面的搜尋框中輸入卡牌名稱、編號或系列名稱。我們支援中文、英文、日文多語言搜尋，涵蓋 1000+ 張熱門卡牌資訊。搜尋結果會顯示卡牌圖片、當前價格和歷史交易記錄。'
        }
      }
    ]
  };

  // AboutPage Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": `${t('aboutPage.title')} - BOXIUM PTCG`,
    "description": t('aboutPage.subtitle'),
    "url": "https://boxiumptcg.manus.space/about",
    "mainEntity": {
      "@type": "Organization",
      "name": "BOXIUM",
      "description": t('aboutPage.subtitle'),
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
      title: t('aboutPage.services.cardSearch.title'),
      description: t('aboutPage.services.cardSearch.description').replace('{{count}}', String(stats?.totalCards || "699+"))
    },
    {
      icon: <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: t('aboutPage.services.priceTracking.title'),
      description: t('aboutPage.services.priceTracking.description')
    },
    {
      icon: <Flame className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: t('aboutPage.services.marketTrends.title'),
      description: t('aboutPage.services.marketTrends.description')
    },
    {
      icon: <Award className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: t('aboutPage.services.gradeAnalysis.title'),
      description: t('aboutPage.services.gradeAnalysis.description')
    }
  ];

  const features = [
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: t('aboutPage.features.realData') },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: t('aboutPage.features.autoUpdate') },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: t('aboutPage.features.multiCurrency') },
    { icon: <Check className="w-4 h-4 sm:w-5 sm:h-5" />, text: t('aboutPage.features.responsive') }
  ];

  const dataSources = [
    {
      name: "SNKRDUNK",
      description: t('aboutPage.sources.snkrdunk'),
      logo: "/snkrdunk-logo.png"
    },
    {
      name: "eBay",
      description: t('aboutPage.sources.ebay'),
      logo: "/ebay-logo.png"
    }
  ];

  return (
    <>
      <StructuredData data={faqStructuredData} />
      <StructuredData data={structuredData} />
      <PageHead 
        title={`${t('aboutPage.title')} - BOXIUM PTCG`}
        description={t('aboutPage.subtitle')}
        keywords="BOXIUM,寶可夢卡牌,PTCG,PSA 10,卡牌價格,市場數據,SNKRDUNK,關於我們,about,Pokémon cards,card prices,market data"
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
            {t('aboutPage.title')}
          </h1>
          
          <p className="text-center text-gray-700 text-sm sm:text-base md:text-lg mb-8 sm:mb-10 leading-relaxed">
            {t('aboutPage.subtitle')}
          </p>

          {/* 平台數據統計 */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-10 sm:mb-12">
              <div className="text-center p-4 sm:p-6 rounded-lg" style={{ backgroundColor: "#f0f4ff" }}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2" style={{ color: "#06038d" }}>
                  {stats.totalCards}+
                </div>
                <div className="text-xs sm:text-sm text-gray-600">{t('aboutPage.trackedCards')}</div>
              </div>
              <div className="text-center p-4 sm:p-6 rounded-lg" style={{ backgroundColor: "#f0f4ff" }}>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2" style={{ color: "#06038d" }}>
                  2
                </div>
                <div className="text-xs sm:text-sm text-gray-600">{t('aboutPage.dataSources')}</div>
              </div>
            </div>
          )}

          {/* 我們的使命 */}
          <section className="mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6" style={{ color: "#06038d" }}>
              {t('aboutPage.ourMission')}
            </h2>
            <p className="text-gray-700 text-sm sm:text-base leading-relaxed">
              {t('aboutPage.missionContent')}
            </p>
          </section>

          {/* 核心服務 */}
          <section className="mb-10 sm:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8" style={{ color: "#06038d" }}>
              {t('aboutPage.coreServices')}
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
              {t('aboutPage.platformFeatures')}
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
              {t('aboutPage.dataSources')}
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
              {t('aboutPage.contactInfo')}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </>
  );
}
