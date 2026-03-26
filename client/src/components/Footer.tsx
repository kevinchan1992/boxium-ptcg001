import { Link } from "wouter";
import { Facebook, Instagram, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const languages = [
  { code: "zh-TW", label: "繁中", flag: "🇭🇰" },
  { code: "en",    label: "EN",   flag: "🇺🇸" },
  { code: "ja",    label: "日本語", flag: "🇯🇵" },
];

export default function Footer() {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("preferred-language", code);
  };

  return (
    <footer style={{ backgroundColor: "#06038d" }} className="border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Top row: Logo + Social (mobile: side by side) */}
        <div className="flex items-start justify-between mb-5">
          {/* Brand */}
          <div className="flex-1 min-w-0">
            <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-10 sm:h-12 mb-1.5 cursor-pointer hover:opacity-90 transition-opacity"
              />
            </Link>
            <p className="text-white/60 text-xs leading-relaxed hidden sm:block max-w-xs">
              {t("footer.description")}
            </p>
          </div>

          {/* Social icons – always visible top-right on mobile */}
          <div className="flex-shrink-0 ml-4">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-2 text-right">Follow Us</p>
            <div className="flex gap-2 justify-end">
              <a
                href="https://www.facebook.com/share/18ENwGABRe/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook"
                className="flex items-center justify-center w-7 h-7 rounded-full border border-white/20 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-colors"
              >
                <Facebook className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://www.instagram.com/boxium.gamecard?igsh=MTBha2wyNWR4d3lpcQ%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                className="flex items-center justify-center w-7 h-7 rounded-full border border-white/20 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Description – mobile only (below logo) */}
        <p className="text-white/60 text-xs leading-relaxed sm:hidden mb-4">
          {t("footer.description")}
        </p>

        {/* Links grid: 2 cols on mobile, 3 cols on tablet, 4 cols on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-4 sm:gap-x-6">

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-2">
              {t("footer.quickLinks")}
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/research" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  卡牌搜尋
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  市場格價
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  市集
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  最新消息
                </Link>
              </li>
            </ul>
          </div>

          {/* About Us */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-2">
              {t("footer.aboutUs")}
            </h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/about" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  {t("footer.platformIntro")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  {t("footer.disclaimer")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/65 hover:text-[#FEDD00] transition-colors text-xs sm:text-sm">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Social – tablet/desktop only (already shown top-right on mobile) */}
          <div className="hidden sm:block lg:col-span-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-2">
              Follow Us
            </h4>
            <div className="flex gap-2">
              <a
                href="https://www.facebook.com/share/18ENwGABRe/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-colors"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/boxium.gamecard?igsh=MTBha2wyNWR4d3lpcQ%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 text-white/70 hover:text-[#FEDD00] hover:border-[#FEDD00] transition-colors"
              >
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-row items-center justify-between gap-2 flex-wrap">
          <p className="text-white/50 text-xs">
            © {currentYear} BOXIUM. All rights reserved.
          </p>

          {/* Language switcher */}
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-white/40 mr-0.5" />
            {languages.map((lang, idx) => (
              <span key={lang.code} className="flex items-center">
                <button
                  onClick={() => changeLanguage(lang.code)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                    i18n.language === lang.code
                      ? "text-[#FEDD00] font-semibold"
                      : "text-white/50 hover:text-white/80"
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
