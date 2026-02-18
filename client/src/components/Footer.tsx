import { Link } from "wouter";
import { Facebook, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 px-4 sm:px-6 border-t" style={{ backgroundColor: "#06038d" }}>
      <div className="max-w-6xl mx-auto">
        {/* Brand Section */}
        <div className="mb-6">
          <Link href="/">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM Logo"
              className="h-10 md:h-12 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </Link>
          <p className="text-white/80 text-sm leading-relaxed max-w-2xl">
            {t("footer.description")}
          </p>
        </div>

        {/* Two Column Layout: Quick Links + About Us */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-3 text-sm">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2">
              <li><Link href="/research" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.cardSearch")}</Link></li>
              <li><Link href="/trending" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.trending")}</Link></li>
              <li><Link href="/blog" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.blog")}</Link></li>
              <li><Link href="/pricing" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.pricing")}</Link></li>
            </ul>
          </div>

          {/* About Us + Social Links */}
          <div>
            <h4 className="text-white font-bold mb-3 text-sm">{t("footer.aboutUs")}</h4>
            <ul className="space-y-2 mb-4">
              <li><Link href="/about" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.platformIntro")}</Link></li>
              <li><Link href="/disclaimer" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.disclaimer")}</Link></li>
              <li><Link href="/admin" className="text-white/80 hover:text-white transition-colors text-sm">{t("footer.adminPanel")}</Link></li>
            </ul>
            <div className="flex gap-4">
              <a href="https://www.facebook.com/share/18ENwGABRe/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/boxium.gamecard?igsh=MTBha2wyNWR4d3lpcQ%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-[#ffed00] transition-colors" title="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Links - Single Row */}
        <div className="border-t border-white/20 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-3">
            <Link href="/terms" className="text-white/80 hover:text-white transition-colors text-xs py-2 px-1">
              {t("footer.terms")}
            </Link>
            <span className="text-white/40">|</span>
            <Link href="/privacy" className="text-white/80 hover:text-white transition-colors text-xs py-2 px-1">
              {t("footer.privacy")}
            </Link>
            <span className="text-white/40">|</span>
            <Link href="/disclaimer" className="text-white/80 hover:text-white transition-colors text-xs py-2 px-1">
              {t("footer.disclaimer")}
            </Link>
            <span className="text-white/40">|</span>
            <Link href="/about" className="text-white/80 hover:text-white transition-colors text-xs py-2 px-1">
              {t("footer.about")}
            </Link>
          </div>
          <p className="text-center text-white/60 text-xs">© {currentYear} BOXIUM. All rights reserved. | Luck in Every Box</p>
        </div>
      </div>
    </footer>
  );
}
