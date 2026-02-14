import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, FileText, Shield, TrendingUp, DollarSign, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const navItems = [
    { href: "/", label: "主頁", icon: Home },
    { href: "/research", label: "卡牌研究", icon: TrendingUp },
    { href: "/pricing", label: "價格查詢", icon: DollarSign },
    { href: "/terms", label: "服務條款", icon: FileText },
    { href: "/privacy", label: "隱私權政策", icon: Shield },
  ];

  return (
    <div className="fixed top-4 left-4 z-50">
      {/* Menu Button */}
      <Button
        onClick={toggleMenu}
        className="w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg transition-all hover:scale-110"
        style={{ backgroundColor: "#ffed00", color: "#06038d" }}
      >
        {isOpen ? <X className="w-6 h-6 md:w-7 md:h-7" /> : <Menu className="w-6 h-6 md:w-7 md:h-7" />}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={toggleMenu}
            style={{ top: 0, left: 0 }}
          />

          {/* Menu Content */}
          <div
            className="absolute top-16 md:top-20 left-0 w-72 md:w-80 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="p-3 md:p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <button
                      onClick={toggleMenu}
                      className="w-full flex items-center gap-4 px-5 py-4 md:px-6 md:py-5 rounded-md transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                      <Icon className="w-6 h-6 md:w-7 md:h-7" />
                      <span className="font-medium text-base md:text-lg">{item.label}</span>
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
