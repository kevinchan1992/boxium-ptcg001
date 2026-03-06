import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, User, Bell, Tag, ShoppingBag, LogIn } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export function TopNav() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);

  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("登出成功");
      window.location.href = "/";
    },
  });

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
    setIsMenuOpen(false);
    if (!user) {
      // Show guide dialog for unauthenticated users
      setShowSellDialog(true);
    } else {
      // Logged-in users go directly to seller dashboard
      setLocation("/seller");
    }
  };

  const handleNavClick = () => setIsMenuOpen(false);

  return (
    <>
      {/* Sell Guide Dialog for unauthenticated users */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#ffed00]" />
              成為賣家，輕鬆出售卡牌
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              在 BOXIUM 平台上架你的寶可夢卡牌，觸及更多買家。
            </p>
            <div className="space-y-2">
              {[
                "免費上架，平台僅收取 5% 服務費",
                "支援 Stripe 信用卡及支付寶 HK 收款",
                "自動通知買家，輕鬆管理訂單",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#ffed00] font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              登入後即可立即上架商品，無需額外審核。
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowSellDialog(false); setLocation("/register"); }}
            >
              免費註冊
            </Button>
            <Button
              className="flex-1 bg-[#ffed00] text-black hover:bg-[#ffed00]/90 font-bold"
              onClick={() => { setShowSellDialog(false); setLocation("/login"); }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              登入並上架
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Nav Bar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b border-white/10 transition-all duration-500 ${
          isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        } ${
          isScrolled
            ? "bg-black/95 backdrop-blur-md shadow-lg"
            : "bg-black/80 backdrop-blur-md"
        }`}
      >
        <div className="px-4">
          {/* Single row: spacer on left, icons on right */}
          <div className="flex items-center justify-end h-14 gap-1">

            {/* 出售商品 button */}
            <motion.button
              onClick={handleSellClick}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 bg-[#ffed00] text-black text-sm font-bold px-3 py-1.5 rounded-md hover:bg-[#ffed00]/90 transition-colors whitespace-nowrap"
            >
              <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              <span>出售商品</span>
            </motion.button>

            {/* Notification Bell — logged-in only */}
            {user && (
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Link href="/notifications" onClick={handleNavClick}>
                  <Button variant="ghost" size="sm" className="relative text-white hover:text-[#ffed00] p-2">
                    <Bell className="w-5 h-5" />
                    {(unreadData?.count ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {(unreadData?.count ?? 0) > 9 ? "9+" : unreadData?.count}
                      </span>
                    )}
                  </Button>
                </Link>
              </motion.div>
            )}

            {/* User icon / auth */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:text-[#ffed00] p-2">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuLabel className="truncate max-w-[180px]">{user.name || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setLocation("/profile"); }}>
                    <User className="w-4 h-4 mr-2" />
                    個人中心
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setLocation("/seller"); }}>
                    <Tag className="w-4 h-4 mr-2" />
                    賣家中心
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => { setLocation("/admin"); }}>
                      <span className="w-4 h-4 mr-2 text-red-400">⚙</span>
                      管理後台
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:text-[#ffed00] p-2"
                onClick={() => setLocation("/login")}
              >
                <User className="w-5 h-5" />
              </Button>
            )}

            {/* Hamburger — rightmost */}
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white p-2"
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                initial={false}
                animate={{ rotate: isMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.25 }}
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </motion.div>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Compact dropdown panel — right-aligned, all devices */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ y: -8, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-14 right-4 w-56 bg-black/97 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl z-40"
          >
            <div className="px-2 py-3 space-y-0.5">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    href={item.href}
                    onClick={handleNavClick}
                    className={`flex items-center text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? "text-[#ffed00] bg-white/5"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                    {isActive(item.href) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ffed00]" />
                    )}
                  </Link>
                </motion.div>
              ))}

              {/* Sell link in hamburger menu */}
              <motion.div
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: navItems.length * 0.04 }}
              >
                <button
                  onClick={() => { handleNavClick(); handleSellClick(); }}
                  className="w-full flex items-center text-sm font-medium text-[#ffed00] hover:text-[#ffed00]/80 hover:bg-white/5 py-2 px-3 rounded-lg transition-colors"
                >
                  <Tag className="w-4 h-4 mr-2" />
                  出售商品
                </button>
              </motion.div>

              {/* Admin link */}
              {user?.role === "admin" && (
                <motion.div
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (navItems.length + 1) * 0.04 }}
                >
                  <Link
                    href="/admin"
                    onClick={handleNavClick}
                    className="flex items-center text-sm font-medium text-red-400 hover:text-red-300 hover:bg-white/5 py-2 px-3 rounded-lg"
                  >
                    {t("nav.admin")}
                  </Link>
                </motion.div>
              )}

              {/* Divider + Language + Login/Register */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: (navItems.length + 2) * 0.04 }}
                className="pt-2 mt-1 border-t border-white/10 space-y-1.5"
              >
                <div className="px-1">
                  <LanguageSwitcher />
                </div>
                {!user && (
                  <div className="flex gap-1.5 px-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-white border-white/30 hover:bg-white/10 bg-transparent text-xs"
                      onClick={() => { setLocation("/login"); handleNavClick(); }}
                    >
                      登入
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-[#ffed00] text-black hover:bg-[#ffed00]/90 text-xs"
                      onClick={() => { setLocation("/register"); handleNavClick(); }}
                    >
                      註冊
                    </Button>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
