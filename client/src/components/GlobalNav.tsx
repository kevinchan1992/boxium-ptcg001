import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, FileText, Shield, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlobalNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const navItems = [
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
        className="w-12 h-12 rounded-full shadow-lg transition-all hover:scale-110"
        style={{ backgroundColor: "#ffed00", color: "#06038d" }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
            className="absolute top-16 left-0 w-64 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="p-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <button
                      onClick={toggleMenu}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all hover:scale-[1.02]"
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
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
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
