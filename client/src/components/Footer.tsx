import { Link } from "wouter";
import { Facebook, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="py-8 md:py-12 px-4 sm:px-6 border-t" style={{ backgroundColor: "#06038d" }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <img
              src="/boxium-logo.png"
              alt="BOXIUM Logo"
              className="h-8 md:h-10 mb-4"
            />
            <p className="text-white/80 text-sm md:text-base leading-relaxed">
              專注於 Pokémon TCG 價格查詢與市場分析的綜合平台
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">快速連結</h4>
            <ul className="space-y-2">
              <li><Link href="/research" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">卡牌搜尋</Link></li>
              <li><Link href="/trending" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">熱門排行榜</Link></li>
              <li><Link href="/pricing" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">價格查詢</Link></li>
            </ul>
          </div>

          {/* About Us */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">關於我們</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">平台介紹</Link></li>
              <li><Link href="/disclaimer" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">免責聲明</Link></li>
              <li><Link href="/admin" className="text-white/80 hover:text-white transition-colors text-sm md:text-base">管理後台</Link></li>
            </ul>
          </div>

          {/* Social Links */}
          <div>
            <h4 className="text-white font-bold mb-4 text-sm md:text-base">社群媒體</h4>
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

        <div className="border-t border-white/20 pt-8 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-4">
            <Link href="/terms" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
              服務條款
            </Link>
            <span className="hidden sm:inline text-white/40">|</span>
            <Link href="/privacy" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
              隱私權政策
            </Link>
            <span className="hidden sm:inline text-white/40">|</span>
            <Link href="/disclaimer" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
              免責聲明
            </Link>
            <span className="hidden sm:inline text-white/40">|</span>
            <Link href="/about" className="text-white/80 hover:text-white transition-colors text-xs md:text-sm">
              關於我們
            </Link>
          </div>
          <p className="text-white/60 text-xs md:text-sm">© 2026 BOXIUM. All rights reserved. | Luck in Every Box</p>
        </div>
      </div>
    </footer>
  );
}
