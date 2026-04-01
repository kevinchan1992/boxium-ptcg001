import { useState } from "react";
import { Link } from "wouter";
import { Facebook, Instagram, Globe, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <footer style={{ backgroundColor: "#06038d" }} className="border-t border-white/10">
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
                <Link href="/blog" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  最新消息
                </Link>
              </li>
            </ul>
          </FooterAccordion>

          {/* Col 3: About Us */}
          <FooterAccordion title={t("footer.aboutUs")}>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.platformIntro")}
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
                <Link href="/privacy" className="text-white/60 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </FooterAccordion>

          {/* Col 4: Follow Us */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-widest mb-5 hidden lg:block">
              Follow Us
            </h4>
            <div className="flex gap-3 mt-4 lg:mt-0">
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
