import { AlertTriangle, Shield, Clock, ExternalLink, Server, Scale, Users, Lock, Copyright, Calendar, ShoppingCart } from "lucide-react";
import Footer from "@/components/Footer";
import PageHead from "@/components/PageHead";
import StructuredData from "@/components/StructuredData";
import { useTranslation } from "react-i18next";

export default function Disclaimer() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  
  const lastUpdated = currentLang === 'ja' ? '2026年3月16日' : currentLang === 'en' ? 'March 16, 2026' : '2026年3月16日';

  // FAQ Structured Data for SEO
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUMの価格データは正確ですか？' : currentLang === 'en' ? 'Is BOXIUM price data accurate?' : 'BOXIUM 的價格數據準確嗎？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('disclaimerPage.sections.priceData.content')
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'TCGカードへの投資にはリスクがありますか？' : currentLang === 'en' ? 'Is investing in TCG cards risky?' : '投資 TCG 卡牌有風險嗎？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('disclaimerPage.sections.investmentRisk.content')
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? '価格データが遅延するのはなぜですか？' : currentLang === 'en' ? 'Why is price data delayed?' : '為什麼價格數據會延遲？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('disclaimerPage.sections.dataDelay.content')
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'BOXIUMは外部リンクに責任を負いますか？' : currentLang === 'en' ? 'Is BOXIUM responsible for external links?' : 'BOXIUM 對外部連結負責嗎？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('disclaimerPage.sections.externalLinks.content')
        }
      },
      {
        "@type": "Question",
        "name": currentLang === 'ja' ? 'サービスが中断した場合はどうなりますか？' : currentLang === 'en' ? 'What happens if the service is interrupted?' : '如果服務中斷怎麼辦？',
        "acceptedAnswer": {
          "@type": "Answer",
          "text": t('disclaimerPage.sections.serviceInterruption.content')
        }
      }
    ]
  };

  // WebPage Structured Data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${t('disclaimerPage.title')} - BOXIUM TCG`,
    "description": t('disclaimerPage.subtitle'),
    "url": "https://boxiumptcg.manus.space/disclaimer",
    "isPartOf": {
      "@type": "WebSite",
      "name": "BOXIUM TCG",
      "url": "https://boxiumptcg.manus.space"
    }
  };

  const sections = [
    {
      icon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.priceData.title'),
      content: t('disclaimerPage.sections.priceData.content')
    },
    {
      icon: <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.marketplaceDisclaimer.title'),
      content: t('disclaimerPage.sections.marketplaceDisclaimer.content')
    },
    {
      icon: <Shield className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.investmentRisk.title'),
      content: t('disclaimerPage.sections.investmentRisk.content')
    },
    {
      icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.dataDelay.title'),
      content: t('disclaimerPage.sections.dataDelay.content')
    },
    {
      icon: <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.externalLinks.title'),
      content: t('disclaimerPage.sections.externalLinks.content')
    },
    {
      icon: <Server className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.serviceInterruption.title'),
      content: t('disclaimerPage.sections.serviceInterruption.content')
    },
    {
      icon: <Scale className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.jurisdiction.title'),
      content: t('disclaimerPage.sections.jurisdiction.content')
    },
    {
      icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.userConduct.title'),
      content: t('disclaimerPage.sections.userConduct.content')
    },
    {
      icon: <Lock className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.dataPrivacy.title'),
      content: t('disclaimerPage.sections.dataPrivacy.content')
    },
    {
      icon: <Copyright className="w-5 h-5 sm:w-6 sm:h-6" />,
      title: t('disclaimerPage.sections.intellectualProperty.title'),
      content: t('disclaimerPage.sections.intellectualProperty.content')
    }
  ];

  return (
    <>
      <StructuredData data={faqStructuredData} />
      <StructuredData data={structuredData} />
      <PageHead 
        title={`${t('disclaimerPage.title')} - BOXIUM TCG`}
        description={t('disclaimerPage.subtitle')}
        keywords="disclaimer,terms,BOXIUM,PTCG,legal,user guidelines,免責聲明,服務條款,法律聲明,用戶規範,免責事項"
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
            {t('disclaimerPage.title')}
          </h1>
          
          <p className="text-center text-gray-600 text-sm sm:text-base mb-8 sm:mb-10">
            {t('disclaimerPage.subtitle')}
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
              <span>{t('disclaimerPage.lastUpdated')}：{lastUpdated}</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              {t('disclaimerPage.contactInfo')}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </>
  );
}
