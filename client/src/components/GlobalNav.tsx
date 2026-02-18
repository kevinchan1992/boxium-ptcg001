import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, FileText, Shield, TrendingUp, DollarSign, Home, Languages, BarChart3, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

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
    { href: "/pricing", label: t("common.pricing"), icon: DollarSign },
    { href: "/market-insights", label: t("common.marketInsights"), icon: BarChart3 },
    { href: "/terms", label: t("common.terms"), icon: FileText },
    { href: "/privacy", label: t("common.privacy"), icon: Shield },
  ];

  const languages = [
    { code: "zh-TW", label: "繁體中文" },
    { code: "en", label: "English" },
    { code: "ja", label: "日本語" },
  ];

  return (
    <div className="fixed top-3 right-3 z-50">
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
              
              {/* Language Divider */}
              <div className="border-t border-gray-200 my-2" />
              
              {/* Language Selector */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4" style={{ color: "#06038d" }} />
                  <span className="font-medium text-sm" style={{ color: "#06038d" }}>{t("common.language")}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
                      style={{
                        color: "#06038d",
                        backgroundColor: i18n.language === lang.code ? "#ffed00" : "transparent",
                        fontWeight: i18n.language === lang.code ? "600" : "normal",
                      }}
                      onMouseEnter={(e) => {
                        if (i18n.language !== lang.code) {
                          e.currentTarget.style.backgroundColor = "#f0f0f0";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (i18n.language !== lang.code) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
