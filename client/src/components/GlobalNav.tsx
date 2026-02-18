import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, FileText, Shield, TrendingUp, DollarSign, Home, Languages, BarChart3, Flame, Info, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export function GlobalNav() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const navItems = [
    { href: "/", label: t("common.home"), icon: Home },
    { href: "/research", label: t("common.research"), icon: TrendingUp },
    { href: "/trending", label: t("common.trending"), icon: Flame },
    { href: "/blog", label: t("common.blog"), icon: Newspaper },
    { href: "/pricing", label: t("common.pricing"), icon: DollarSign },
    { href: "/about", label: t("common.about"), icon: Info },
    // { href: "/terms", label: t("common.terms"), icon: FileText },
    // { href: "/privacy", label: t("common.privacy"), icon: Shield },
  ];

  const languages = [
    { code: "zh-TW", label: "繁體中文" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
  ];

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
      {/* Language Switcher */}
      <LanguageSwitcher />
      
      {/* Menu Button */}
      <Button
        onClick={toggleMenu}
        className="w-10 h-10 rounded-full shadow-md transition-all hover:scale-105"
        style={{ backgroundColor: "#ffed00", color: "#06038d" }}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Menu Content */}
          <div
            className="absolute top-14 right-0 w-56 rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <button
                      onClick={toggleMenu}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        color: "#06038d",
                        backgroundColor: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f0f0f0";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                  </Link>
                 );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
