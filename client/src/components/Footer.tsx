import { Link } from "wouter";
import { Facebook, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: "#06038d" }} className="border-t border-white/10">
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/*
          Responsive grid:
          - Mobile  (< sm):  1 col, stacked
          - Tablet  (sm–lg): 2 cols
          - Desktop (≥ lg):  4 cols side-by-side
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">

          {/* Col 1 – Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <img
                src="/boxium-logo.png"
                alt="BOXIUM Logo"
                className="h-16 mb-3 cursor-pointer hover:opacity-90 transition-opacity"
              />
            </Link>
            <p className="text-white/70 text-xs leading-relaxed">
              {t("footer.description")}
            </p>
          </div>

          {/* Col 2 – Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              {t("footer.quickLinks")}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/research" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.cardSearch")}
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.marketplace")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.blog")}
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.pricing")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3 – About Us */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              {t("footer.aboutUs")}
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.platformIntro")}
                </Link>
              </li>
              <li>
                <Link href="/disclaimer" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.disclaimer")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/70 hover:text-[#FEDD00] transition-colors text-sm">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4 – Social */}
          <div>
            <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">
              {t("footer.followUs") || "Follow Us"}
            </h4>
            <div className="flex gap-3">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/50 text-xs">
            © {currentYear} BOXIUM. All rights reserved.
          </p>
          <p className="text-white/40 text-xs tracking-wide">
            Luck in Every Box
          </p>
        </div>
      </div>
    </footer>
  );
}
