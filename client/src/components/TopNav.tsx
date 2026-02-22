import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "wouter";
import { Menu, X, LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function TopNav() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Get current user
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.system.logout.useMutation({
    onSuccess: () => {
      toast.success("登出成功");
      window.location.href = "/";
    },
  });
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    { href: "/", label: t("common.home") },
    { href: "/research", label: t("common.research") },
    { href: "/pricing", label: t("common.priceComparison") },
    { href: "/trending", label: t("common.trending") },
    { href: "/blog", label: t("common.blog") },
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
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button - Left */}
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

            {/* Desktop Navigation - Center */}
            <div className="hidden md:flex items-center gap-12 flex-1 justify-center">
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
              
              {/* 管理後台連結 - 僅管理員可見 */}
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-base font-medium bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition-colors"
                >
                  {t("nav.admin")}
                </Link>
              )}
            </div>

            {/* Right Side: Language Switcher + Auth */}
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>
              
              {/* Auth Buttons */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:text-[#ffed00]">
                      <User className="w-4 h-4 mr-2" />
                      {user.name || user.email}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>我的帳號</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/profile")}>
                      <User className="w-4 h-4 mr-2" />
                      個人中心
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      登出
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-[#ffed00]"
                    onClick={() => setLocation("/login")}
                  >
                    登入
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#ffed00] text-black hover:bg-[#ffed00]/90"
                    onClick={() => setLocation("/register")}
                  >
                    註冊
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`fixed top-16 left-0 right-0 bg-black/95 backdrop-blur-md border-b border-white/10 z-40 md:hidden transition-all duration-300 ${
          isMobileMenuOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-6 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block text-base font-medium transition-colors ${
                isActive(item.href)
                  ? "text-[#ffed00]"
                  : "text-white/80 hover:text-[#ffed00]"
              }`}
            >
              {item.label}
            </Link>
          ))}
          
          {/* 管理後台連結 - 僅管理員可見 */}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-base font-medium text-red-400 hover:text-red-300"
            >
              {t("nav.admin")}
            </Link>
          )}

          {/* Language Switcher for Mobile */}
          <div className="pt-4 border-t border-white/10">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </>
  );
}
