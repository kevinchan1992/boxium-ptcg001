import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, User, Bell, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
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

  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("登出成功");
      window.location.href = "/";
    },
  });

  const handleLogout = () => logoutMutation.mutate();

  const { data: unreadData } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 30000 }
  );

  const navItems = [
    { href: "/", label: t("common.home") },
    { href: "/research", label: t("common.research") },
    { href: "/pricing", label: t("common.priceComparison") },
    { href: "/trending", label: t("common.trending") },
    { href: "/blog", label: t("common.blog") },
    { href: "/about", label: t("common.about") },
    { href: "/marketplace", label: "商城" },
  ];

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const handleSellClick = () => {
    if (!user) {
      setLocation("/login");
    } else {
      setLocation("/seller/dashboard");
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-white/10 transition-all duration-500 ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        } ${
          isScrolled
            ? "bg-black/95 backdrop-blur-md shadow-lg"
            : "bg-black/80 backdrop-blur-md"
        }`}
      >
        <div className="px-4 md:px-6">
          <div className="flex items-center justify-between h-14 md:h-16">

            {/* ── Desktop: Logo + Nav Links (left) ── */}
            <div className="hidden md:flex items-center gap-6">
              {/* Logo */}
              <Link href="/" className="flex-shrink-0">
                <img src="/logo.png" alt="BOXIUM" className="h-8 w-auto" onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
                <span className="text-[#ffed00] font-bold text-lg tracking-wide hidden" style={{display: 'none'}}>BOXIUM</span>
              </Link>

              {/* Nav Links */}
              {navItems.map((item) => (
                <motion.div
                  key={item.href}
                  whileHover={{ y: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Link
                    href={item.href}
                    className={`relative text-sm font-medium whitespace-nowrap block ${
                      isActive(item.href) ? "text-[#ffed00]" : "text-white/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                    <motion.span
                      className="absolute -bottom-1 h-0.5 bg-[#ffed00]"
                      initial={false}
                      animate={{ width: isActive(item.href) ? "100%" : "0%", left: isActive(item.href) ? "0%" : "50%" }}
                      whileHover={{ width: "100%", left: "0%" }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    />
                  </Link>
                </motion.div>
              ))}

              {user?.role === "admin" && (
                <Link href="/admin" className="text-sm font-medium bg-red-600 px-2 py-1 rounded hover:bg-red-700 transition-colors whitespace-nowrap">
                  {t("nav.admin")}
                </Link>
              )}
            </div>

            {/* ── Mobile: empty left spacer ── */}
            <div className="md:hidden flex-1" />

            {/* ── Right Side (both mobile & desktop) ── */}
            {/* Order: 出售商品 | 通知鈴鐺 | 用戶圖示 | 語言(desktop only) | 漢堡(mobile only) */}
            <div className="flex items-center gap-1">

              {/* 出售商品 button */}
              <motion.button
                onClick={handleSellClick}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1 bg-[#ffed00] text-black text-xs font-bold px-2.5 py-1.5 rounded-md hover:bg-[#ffed00]/90 transition-colors whitespace-nowrap"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">出售商品</span>
              </motion.button>

              {/* Notification Bell */}
              {user && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Link href="/notifications">
                    <Button variant="ghost" size="sm" className="relative text-white hover:text-[#ffed00] p-2">
                      <Bell className="w-4 h-4" />
                      {(unreadData?.count ?? 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {(unreadData?.count ?? 0) > 9 ? "9+" : unreadData?.count}
                        </span>
                      )}
                    </Button>
                  </Link>
                </motion.div>
              )}

              {/* User Icon / Auth */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:text-[#ffed00] p-2">
                      <User className="w-4 h-4" />
                      <span className="hidden md:inline ml-1 max-w-[80px] truncate text-sm">{user.name || user.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>我的帳號</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/profile")}>
                      <User className="w-4 h-4 mr-2" />
                      個人中心
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/seller/dashboard")}>
                      <Tag className="w-4 h-4 mr-2" />
                      賣家中心
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
                    className="text-white hover:text-[#ffed00] text-sm px-3"
                    onClick={() => setLocation("/login")}
                  >
                    登入
                  </Button>
                  <Button
                    size="sm"
                    className="bg-white/10 text-white hover:bg-white/20 text-sm px-3"
                    onClick={() => setLocation("/register")}
                  >
                    註冊
                  </Button>
                </div>
              )}

              {/* Login icon for mobile (not logged in) */}
              {!user && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden text-white hover:text-[#ffed00] p-2"
                  onClick={() => setLocation("/login")}
                >
                  <User className="w-4 h-4" />
                </Button>
              )}

              {/* Language Switcher - desktop only */}
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>

              {/* Hamburger - mobile only, rightmost */}
              <motion.button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden text-white p-2"
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </motion.div>
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Slide-down Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-14 left-0 right-0 bg-black/95 backdrop-blur-md border-b border-white/10 z-40 md:hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block text-base font-medium py-2.5 px-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? "text-[#ffed00] bg-white/5"
                        : "text-white/80 hover:text-[#ffed00] hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}

              {user?.role === "admin" && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: navItems.length * 0.04 }}
                >
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-base font-medium text-red-400 hover:text-red-300 hover:bg-white/5 py-2.5 px-3 rounded-lg"
                  >
                    {t("nav.admin")}
                  </Link>
                </motion.div>
              )}

              {/* Sell button in menu */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: (navItems.length + 1) * 0.04 }}
                className="pt-2 border-t border-white/10"
              >
                <button
                  onClick={handleSellClick}
                  className="w-full flex items-center gap-2 bg-[#ffed00] text-black font-bold py-2.5 px-3 rounded-lg hover:bg-[#ffed00]/90 transition-colors"
                >
                  <Tag className="w-4 h-4" />
                  出售商品
                </button>
              </motion.div>

              {/* Language Switcher */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: (navItems.length + 2) * 0.04 }}
                className="pt-2"
              >
                <LanguageSwitcher />
              </motion.div>

              {/* Login/Register for non-logged-in mobile users */}
              {!user && (
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (navItems.length + 3) * 0.04 }}
                  className="flex gap-2 pt-2"
                >
                  <Button
                    variant="outline"
                    className="flex-1 text-white border-white/30 hover:bg-white/10"
                    onClick={() => { setLocation("/login"); setIsMobileMenuOpen(false); }}
                  >
                    登入
                  </Button>
                  <Button
                    className="flex-1 bg-[#ffed00] text-black hover:bg-[#ffed00]/90"
                    onClick={() => { setLocation("/register"); setIsMobileMenuOpen(false); }}
                  >
                    註冊
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
