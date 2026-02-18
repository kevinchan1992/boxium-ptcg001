import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export function TopNav() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const navItems = [
    { href: "/", label: t("common.home") },
    { href: "/research", label: t("common.research") },
    { href: "/trending", label: t("common.trending") },
    { href: "/blog", label: t("common.blog") },
    { href: "/pricing", label: t("common.pricing") },
    { href: "/about", label: t("common.about") },
  ];

  // 頁面載入動畫
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  // 滾動行為優化
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <>
      {/* 遮罩層 */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-white/10 transition-all duration-500 ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        } ${
          isScrolled
            ? "bg-black/95 backdrop-blur-md shadow-lg"
            : "bg-black/80 backdrop-blur-md"
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-16 relative">
            {/* Desktop Navigation - Centered */}
            <div className="hidden md:flex items-center gap-12">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-base font-medium transition-colors hover:text-[#ffed00] group ${
                    isActive(item.href)
                      ? "text-[#ffed00]"
                      : "text-white/80"
                  }`}
                >
                  {item.label}
                  {/* Active 或 Hover 下劃線動畫 */}
                  <span className={`absolute -bottom-1 h-0.5 bg-[#ffed00] transition-all duration-300 ${
                    isActive(item.href)
                      ? "w-full left-0"
                      : "left-1/2 w-0 group-hover:w-full group-hover:left-0"
                  }`} />
                </Link>
              ))}
            </div>

            {/* Language Switcher - Absolute Right */}
            <div className="hidden md:flex items-center gap-4 absolute right-0">
              <LanguageSwitcher />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-white p-2 absolute left-0"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu - 從右側滑入 */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-md z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header with LOGO */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="cursor-pointer"
            >
              <img
                src="/boxium-logo-white.png"
                alt="BOXIUM"
                className="h-8 w-auto hover:opacity-80 transition-opacity"
              />
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Menu Items */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-6 py-3 text-base font-medium transition-all ${
                    isActive(item.href)
                      ? "text-[#ffed00] bg-white/10 border-l-4 border-[#ffed00]"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Language Switcher in Mobile Menu */}
          <div className="p-4 border-t border-white/10">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
