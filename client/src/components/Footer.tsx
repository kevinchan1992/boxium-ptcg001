import { useState } from "react";
import { Link } from "wouter";
import { Facebook, Instagram, Globe, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

// WhatsApp SVG icon (official brand icon)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const languages = [
  { code: "zh-TW", label: "繁中" },
  { code: "en",    label: "EN" },
  { code: "ja",    label: "日本語" },
];

function FooterAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:block">
      {/* Desktop: always show */}
      <div className="hidden lg:block">
        <h4 className="text-white font-semibold text-xs uppercase tracking-widest mb-5">
          {title}
        </h4>
        {children}
      </div>
      {/* Mobile: accordion */}
      <div className="lg:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full py-3 border-b border-white/10"
        >
          <h4 className="text-white font-semibold text-xs uppercase tracking-widest">
            {title}
          </h4>
          <ChevronDown
            className={`w-4 h-4 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            open ? "max-h-60 opacity-100 pt-3 pb-1" : "max-h-0 opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Footer() {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("preferred-language", code);
  };

  return (
    <footer style={{ backgroundColor: "#06038d", paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} className="border-t border-white/10">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-12">

        {/* Main grid: 4 columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-10">

          {/* Col 1: Brand + Slogan */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 lg:block">
              <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                <img
                  src="/boxium-logo.png"
                  alt="BOXIUM Logo"
                  className="h-10 lg:h-12 lg:mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                />
              </Link>
              <p className="text-[#FEDD00] text-sm font-semibold tracking-wide lg:mb-3">
                Luck in Every Box
              </p>
            </div>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs hidden lg:block">
              {t("footer.description")}
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <FooterAccordion title={t("footer.quickLinks")}>
            <ul className="space-y-3">
              <li>
                <Link href="/research" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  卡牌搜尋
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  市場格價
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  市集
                </Link>
              </li>
              <li>
                <Link href="/grading" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  PSA 鑑定
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  平台介紹
                </Link>
              </li>
            </ul>
          </FooterAccordion>

          {/* Col 3: About Us */}
          <FooterAccordion title={t("footer.aboutUs")}>
            <ul className="space-y-3">
              <li>
                <Link href="/contact" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  聯絡我們
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.disclaimer")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="/auction/terms" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.auctionTerms", "買賣條款")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </FooterAccordion>

          {/* Col 4: Follow Us */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-widest mb-3 lg:mb-5">
              Follow Us
            </h4>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/share/18ENwGABRe/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-white/25 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-all duration-200"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/boxium.gamecard?igsh=MTBha2wyNWR4d3lpcQ%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-white/25 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-all duration-200"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/85255090102"
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                className="flex items-center justify-center w-10 h-10 rounded-full border border-white/25 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-all duration-200"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-xs">
            © {currentYear} BOXIUM. All rights reserved.
          </p>

          {/* Language switcher */}
          <div className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5 text-white/40 mr-1" />
            {languages.map((lang, idx) => (
              <span key={lang.code} className="flex items-center">
                <button
                  onClick={() => changeLanguage(lang.code)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    i18n.language === lang.code
                      ? "text-[#FEDD00] font-semibold"
                      : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {lang.label}
                </button>
                {idx < languages.length - 1 && (
                  <span className="text-white/20 text-xs">|</span>
                )}
              </span>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
