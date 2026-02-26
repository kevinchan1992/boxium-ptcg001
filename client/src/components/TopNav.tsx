import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, User } from "lucide-react";
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
  
  // Get current user
  const { data: user } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
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
      {/* 遮罩層 with Animation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
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
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-16 relative">
            {/* Mobile Menu Button - Left */}
            <motion.button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-white p-2 absolute left-0"
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                initial={false}
                animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </motion.div>
            </motion.button>

            {/* Desktop Navigation - Center */}
            <div className="hidden md:flex items-center gap-4 lg:gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-xs lg:text-sm font-medium transition-colors hover:text-[#ffed00] group whitespace-nowrap ${
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
                  className="text-xs lg:text-sm font-medium bg-red-600 px-2 py-1 rounded hover:bg-red-700 transition-colors whitespace-nowrap"
                >

                  {t("nav.admin")}
                </Link>
              )}
            </div>

            {/* Right Side: Language Switcher + Auth */}
            <div className="flex items-center gap-3 absolute right-0">
              {/* Language Switcher */}
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>
              
              {/* Auth Buttons */}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:text-[#ffed00] text-xs lg:text-sm">
                      <User className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                      <span className="hidden md:inline max-w-[80px] lg:max-w-none truncate">{user.name || user.email}</span>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-[#ffed00] text-xs lg:text-sm px-2 md:px-4"
                    onClick={() => setLocation("/login")}
                  >
                    登入
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#ffed00] text-black hover:bg-[#ffed00]/90 text-xs lg:text-sm px-2 md:px-4"
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

      {/* Mobile Menu with Framer Motion */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-16 left-0 right-0 bg-black/95 backdrop-blur-md border-b border-white/10 z-40 md:hidden"
          >
            <div className="container mx-auto px-6 py-8 space-y-2">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block text-lg font-medium transition-colors py-3 px-4 rounded-lg ${
                      isActive(item.href)
                        ? "text-[#ffed00] bg-white/5"
                        : "text-white/80 hover:text-[#ffed00] hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              
              {/* 管理後台連結 - 僅管理員可見 */}
              {user?.role === "admin" && (
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: navItems.length * 0.05 }}
                >
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-lg font-medium text-red-400 hover:text-red-300 hover:bg-white/5 py-3 px-4 rounded-lg"
                  >
                    {t("nav.admin")}
                  </Link>
                </motion.div>
              )}

              {/* Language Switcher for Mobile */}
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: (navItems.length + 1) * 0.05 }}
                className="pt-6 border-t border-white/10"
              >
                <LanguageSwitcher />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
