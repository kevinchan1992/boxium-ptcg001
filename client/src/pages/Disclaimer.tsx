import { AlertTriangle, Shield, Clock, ExternalLink, Server, Scale, Users, Lock, Copyright, Calendar } from "lucide-react";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import StructuredData from "@/components/StructuredData";

export default function Disclaimer() {
  const lastUpdated = "2026年2月18日";

  // FAQ Structured Data for SEO
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "BOXIUM 的價格數據準確嗎？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "本平台所提供的卡牌價格數據來自第三方來源（SNKRDUNK、eBay 等），僅供參考之用。我們不保證價格數據的準確性、完整性或即時性。實際交易價格可能因市場波動、賣家定價策略、卡牌狀況等因素而有所不同。用戶在進行任何交易前，應自行核實價格資訊。"
        }
      },
      {
        "@type": "Question",
        "name": "投資寶可夢卡牌有風險嗎？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "是的，寶可夢卡牌收藏和交易具有投資風險。卡牌價格可能因市場供需、流行趨勢、評級變化等因素而大幅波動。本平台提供的數據和分析工具不構成投資建議。用戶應根據自身財務狀況和風險承受能力，審慎評估並自行承擔所有投資決策的責任和後果。"
        }
      },
      {
        "@type": "Question",
        "name": "為什麼價格數據會延遲？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "本平台的價格數據可能存在延遲，更新頻率取決於數據來源的可用性和系統排程（通常為 12 小時更新一次）。顯示的價格不代表即時市場價格，可能與當前實際交易價格存在差異。用戶在做出交易決策時，應參考多個來源並確認最新價格資訊。"
        }
      },
      {
        "@type": "Question",
        "name": "BOXIUM 對外部連結負責嗎？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "本平台提供連結至外部網站（如 SNKRDUNK、eBay 等）以方便用戶查詢詳細資訊或進行交易。我們對這些外部網站的內容、隱私政策、安全性或交易行為不承擔任何責任。用戶訪問外部網站並進行交易時，應自行評估風險並遵守該網站的條款和條件。"
        }
      },
      {
        "@type": "Question",
        "name": "如果服務中斷怎麼辦？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "本平台可能因系統維護、技術升級、不可抗力或其他原因而暫時中斷服務。我們保留隨時修改、暫停或終止部分或全部服務的權利，恭不另行通知。我們不對因服務中斷、數據遺失或功能變更而造成的任何損失承擔責任。建議用戶定期備份重要資料。"
        }
      }
    ]
  };

  // WebPage Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "免責聲明 - BOXIUM PTCG",
    "description": "BOXIUM PTCG 平台免責聲明，說明價格數據、投資風險、服務條款等重要資訊",
    "url": "https://boxiumptcg.manus.space/disclaimer",
    "isPartOf": {
      "@type": "WebSite",
      "name": "BOXIUM PTCG",
      "url": "https://boxiumptcg.manus.space"
    }
  };

  const sections = [
    {
      icon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "價格數據免責",
      content: "本平台所提供的卡牌價格數據來自第三方來源（包括但不限於 SNKRDUNK、eBay 等），僅供參考之用。我們不保證價格數據的準確性、完整性或即時性。實際交易價格可能因市場波動、賣家定價策略、卡牌狀況等因素而有所不同。用戶在進行任何交易前，應自行核實價格資訊。"
    },
    {
      icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "投資風險提示",
      content: "寶可夢卡牌收藏和交易具有投資風險。卡牌價格可能因市場供需、流行趨勢、評級變化等因素而大幅波動。本平台提供的數據和分析工具不構成投資建議。用戶應根據自身財務狀況和風險承受能力，審慎評估並自行承擔所有投資決策的責任和後果。過往價格表現不代表未來收益。"
    },
    {
      icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "數據延遲說明",
      content: "本平台的價格數據可能存在延遲，更新頻率取決於數據來源的可用性和系統排程（通常為 12 小時更新一次）。顯示的價格不代表即時市場價格，可能與當前實際交易價格存在差異。用戶在做出交易決策時，應參考多個來源並確認最新價格資訊。"
    },
    {
      icon: <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "外部連結免責",
      content: "本平台提供連結至外部網站（如 SNKRDUNK、eBay 等）以方便用戶查詢詳細資訊或進行交易。我們對這些外部網站的內容、隱私政策、安全性或交易行為不承擔任何責任。用戶訪問外部網站並進行交易時，應自行評估風險並遵守該網站的條款和條件。"
    },
    {
      icon: <Server className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "服務中斷與變更",
      content: "本平台可能因系統維護、技術升級、不可抗力或其他原因而暫時中斷服務。我們保留隨時修改、暫停或終止部分或全部服務的權利，恕不另行通知。我們不對因服務中斷、數據遺失或功能變更而造成的任何損失承擔責任。"
    },
    {
      icon: <Scale className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "法律管轄與爭議解決",
      content: "本免責聲明及平台服務受中華民國（台灣）法律管轄。因使用本平台而產生的任何爭議，雙方應首先通過友好協商解決；協商不成的，應提交至台灣台北地方法院管轄。如本免責聲明的任何條款被認定為無效或不可執行，其餘條款仍然有效。"
    },
    {
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "用戶行為規範",
      content: "用戶在使用本平台時，不得進行以下行為：(1) 使用爬蟲程式或自動化工具大量抓取數據；(2) 嘗試未經授權訪問系統或數據庫；(3) 散佈惡意軟體或進行網路攻擊；(4) 冒充他人或提供虛假資訊；(5) 從事任何違法或侵害他人權益的行為。違反者將被終止服務使用權，並可能承擔法律責任。"
    },
    {
      icon: <Lock className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "數據隱私與保護",
      content: "本平台重視用戶隱私，不會販賣、出租或以其他方式向第三方披露用戶個人資訊。我們僅在提供服務、改善用戶體驗和遵守法律要求的範圍內使用用戶數據。具體隱私政策請參閱「隱私權政策」頁面。用戶有權要求查看、修改或刪除其個人資訊。"
    },
    {
      icon: <Copyright className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: "智慧財產權聲明",
      content: "「寶可夢」、「Pokémon」、「PTCG」及相關商標、圖像、名稱均為 The Pokémon Company、任天堂、GAME FREAK 等原廠所有。本平台僅提供市場數據分析服務，不擁有任何卡牌相關智慧財產權。本平台的設計、程式碼、文案等原創內容受著作權法保護，未經授權不得複製或使用。"
    }
  ];

  return (
    <>
      <StructuredData data={faqStructuredData} />
      <StructuredData data={structuredData} />
      <PageHead 
        title="免責聲明 - BOXIUM PTCG 寶可夢卡牌市場數據平台"
        description="BOXIUM 免責聲明：價格數據來自第三方來源僅供參考，不保證準確性。卡牌投資具有風險，用戶應自行評估並承擔決策責任。請仔細閱讀完整條款。"
        keywords="免責聲明,服務條款,BOXIUM,PTCG,法律聲明,用戶規範"
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
            免責聲明
          </h1>
          
          <p className="text-center text-gray-600 text-sm sm:text-base mb-8 sm:mb-10">
            請仔細閱讀以下條款。使用本平台即表示您同意並接受本免責聲明的所有內容。
          </p>

          {/* Disclaimer Sections */}
          <div className="space-y-6 sm:space-y-8">
            {sections.map((section, index) => (
              <section key={index} className="border-l-4 pl-4 sm:pl-6" style={{ borderColor: "#06038d" }}>
                <div className="flex items-start gap-3 sm:gap-4 mb-3">
                  <div className="flex-shrink-0 mt-1" style={{ color: "#06038d" }}>
                    {section.icon}
                  </div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold" style={{ color: "#06038d" }}>
                    {section.title}
                  </h2>
                </div>
                <p className="text-gray-700 text-sm sm:text-base leading-relaxed pl-9 sm:pl-10">
                  {section.content}
                </p>
              </section>
            ))}
          </div>

          {/* Last Updated */}
          <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-xs sm:text-sm">
              <Calendar className="w-4 h-4" />
              <span>最後更新日期：{lastUpdated}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              如對本免責聲明有任何疑問，請通過平台提供的聯絡方式與我們聯繫。
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </>
  );
}
