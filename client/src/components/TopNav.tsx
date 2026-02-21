import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Bell, Heart, User, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

export function TopNav() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { user, isLoading } = useAuth();
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // 清除所有 tRPC 緩存
      utils.invalidate();
      // 強制刷新頁面以清除所有狀態
      window.location.href = "/";
    },
  });

  // 獲取未讀通知數量（如果用戶已登入）
  // TODO: 實作 notifications API
  const unreadCount = 0;

  const loginUrl = getLoginUrl();

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
              
              {/* 登入用戶顯示我的收藏 */}
              {user && (
                <Link
                  href="/favorites"
                  className={`relative text-base font-medium transition-colors hover:text-[#ffed00] group flex items-center gap-1 ${
                    isActive("/favorites")
                      ? "text-[#ffed00]"
                      : "text-white/80"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {t("nav.favorites")}
                  <span className={`absolute -bottom-1 h-0.5 bg-[#ffed00] transition-all duration-300 ${
                    isActive("/favorites")
                      ? "w-full left-0"
                      : "left-1/2 w-0 group-hover:w-full group-hover:left-0"
                  }`} />
                </Link>
              )}

              {/* 管理員顯示 */}
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-base font-medium bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition-colors"
                >
                  {t("nav.admin")}
                </Link>
              )}
            </div>

            {/* Right Side: Language + Notifications + User Menu / Login */}
            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>

              {/* 通知圖標（僅登入用戶顯示） */}
              {user && (
                <Link href="/notifications">
                  <a className="relative hover:text-[#ffed00] transition-colors text-white">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <Badge
                        variant="destructive"
                        className="absolute -top-2 -right-2 px-1.5 py-0.5 text-xs min-w-[20px] h-5 flex items-center justify-center"
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Badge>
                    )}
                  </a>
                </Link>
              )}

              {/* Loading State */}
              {isLoading && (
                <Skeleton className="w-24 h-10 bg-white/20 rounded" />
              )}

              {/* User Menu */}
              {!isLoading && user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 hover:bg-white/10 text-white"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-[#ffed00] text-[#06038d] font-bold">
                          {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden lg:inline font-medium">
                        {user.name || user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm">
                      <p className="font-medium">{user.name || t("nav.user")}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <a className="flex items-center cursor-pointer w-full">
                          <User className="w-4 h-4 mr-2" />
                          {t("nav.dashboard")}
                        </a>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/favorites">
                        <a className="flex items-center cursor-pointer w-full">
                          <Heart className="w-4 h-4 mr-2" />
                          {t("nav.favorites")}
                        </a>
                      </Link>
                    </DropdownMenuItem>

                    {user.role === "admin" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin">
                            <a className="flex items-center cursor-pointer w-full text-red-600">
                              <Settings className="w-4 h-4 mr-2" />
                              {t("nav.admin")}
                            </a>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logoutMutation.mutate()}
                      className="cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Login Button */}
              {!isLoading && !user && (
                <Button
                  asChild
                  className="bg-[#ffed00] text-[#06038d] hover:bg-[#ffed00]/90 border-none font-bold"
                >
                  <a href={loginUrl}>{t("nav.login")}</a>
                </Button>
              )}
            </div>
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
              
              {/* 登入用戶顯示我的收藏 */}
              {user && (
                <Link
                  href="/favorites"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-6 py-3 text-base font-medium transition-all flex items-center gap-2 ${
                    isActive("/favorites")
                      ? "text-[#ffed00] bg-white/10 border-l-4 border-[#ffed00]"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {t("nav.favorites")}
                </Link>
              )}

              {/* 管理員顯示 */}
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-6 py-3 text-base font-medium transition-all bg-red-600 text-white hover:bg-red-700"
                >
                  {t("nav.admin")}
                </Link>
              )}
            </div>
          </div>

          {/* Language Switcher + Login/User Menu in Mobile */}
          <div className="p-4 border-t border-white/10 space-y-3">
            <LanguageSwitcher />
            
            {!isLoading && !user && (
              <Button
                asChild
                className="w-full bg-[#ffed00] text-[#06038d] hover:bg-[#ffed00]/90 font-bold"
              >
                <a href={loginUrl}>{t("nav.login")}</a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
