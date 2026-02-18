import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export function TopNav() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: t("common.home") },
    { href: "/research", label: t("common.research") },
    { href: "/trending", label: t("common.trending") },
    { href: "/blog", label: t("common.blog") },
    { href: "/pricing", label: t("common.pricing") },
    { href: "/about", label: t("common.about") },
  ];



  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center h-16 relative">
          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center gap-12">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  className={`text-base font-medium transition-colors hover:text-[#ffed00] ${
                    isActive(item.href)
                      ? "text-[#ffed00]"
                      : "text-white/80"
                  }`}
                >
                  {item.label}
                </a>
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
            className="md:hidden text-white p-2"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "text-[#ffed00] bg-white/5"
                        : "text-white/80 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </a>
                </Link>
              ))}
              
              {/* Language Switcher in Mobile Menu */}
              <div className="px-4 py-2 border-t border-white/10 mt-2 pt-4">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
