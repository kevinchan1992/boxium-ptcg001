import { useEffect, useState, createContext, useContext, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, LogOut, User, Bell, Tag, ShoppingBag, LogIn, Package, MessageSquare, CheckCheck, ExternalLink, ShoppingCart, ScrollText, Search, BarChart2, TrendingUp, Award, Store } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";

/** Small badge showing cart item count */
function CartBadge() {
  const { data: user } = trpc.auth.me.useQuery();
  const { data } = trpc.marketplace.getCartCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60000,
  });
  const count = data?.count ?? 0;
  if (count === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Context to trigger cart icon bounce animation from anywhere */
const CartBounceContext = createContext<{ trigger: () => void }>({ trigger: () => {} });
export function useCartBounce() { return useContext(CartBounceContext); }

export function TopNav() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showSellDialog, setShowSellDialog] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'notif' | 'msg'>('notif');
  const [cartBouncing, setCartBouncing] = useState(false);
  const cartBounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCartBounce = () => {
    setCartBouncing(true);
    if (cartBounceTimer.current) clearTimeout(cartBounceTimer.current);
    cartBounceTimer.current = setTimeout(() => setCartBouncing(false), 600);
  };

  const { data: user } = trpc.auth.me.useQuery();
  const { data: sellerCenterAccess } = trpc.grading.getSellerCenterAccess.useQuery(undefined, { staleTime: 60000 });
  const showSellButton = user?.role === 'admin' || sellerCenterAccess?.allowed !== false;
  const { data: lootModeData } = trpc.lootpool.checkMaintenanceMode.useQuery(undefined, { staleTime: 60000 });
  const showLootPool = !(lootModeData?.enabled) || user?.role === 'admin';
  const utils = trpc.useUtils();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      toast.success(t("topnav.logoutSuccess"));
      // Clear all tRPC cache to reset auth state
      await utils.invalidate();
      // Hard reload to ensure all state is cleared (including cookies)
      // Redirect to home page top regardless of current page
      window.location.replace("/#top");
    },
    onError: (err) => {
      console.error('[Logout] Error:', err);
      // Even if API fails, force reload to clear client state and go to home top
      window.location.replace("/#top");
    },
  });

  const { data: unreadData, refetch: refetchUnread } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 30000 }
  );

  const { data: msgUnreadData } = trpc.marketplace.getTotalUnreadMessages.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 30000 }
  );
  const totalUnread = (unreadData?.count ?? 0) + (msgUnreadData?.count ?? 0);

  const { data: notifData, isLoading: notifLoading } = trpc.notifications.getMyNotifications.useQuery(
    { limit: 10, offset: 0 },
    { enabled: !!user && notifOpen && notifTab === 'notif', staleTime: 10000 }
  );

  const { data: msgThreads, isLoading: msgThreadsLoading } = trpc.marketplace.getRecentUnreadOrderThreads.useQuery(
    undefined,
    { enabled: !!user && notifOpen && notifTab === 'msg', refetchInterval: notifOpen ? 15000 : false }
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMyNotifications.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getMyNotifications.invalidate();
      toast.success(t("topnav.allMarkedAsRead"));
    },
  });

  const handleNotifClick = (notif: { id: number; linkUrl?: string | null; isRead: boolean }) => {
    if (!notif.isRead) {
      markAsReadMutation.mutate({ notificationId: notif.id });
    }
    setNotifOpen(false);
    if (notif.linkUrl) {
      setLocation(notif.linkUrl);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "offer": return <MessageSquare className="w-4 h-4 text-yellow-400" />;
      case "trade": return <Tag className="w-4 h-4 text-green-400" />;
      case "payment": return <Package className="w-4 h-4 text-blue-400" />;
      case "shipping": return <Package className="w-4 h-4 text-purple-400" />;
      case "auction_outbid": return <Bell className="w-4 h-4 text-orange-400" />;
      case "auction_won": return <ShoppingBag className="w-4 h-4 text-green-400" />;
      case "auction_sold": return <Tag className="w-4 h-4 text-green-400" />;
      case "auction_ending_soon": return <Bell className="w-4 h-4 text-red-400" />;
      case "auction_started": return <Tag className="w-4 h-4 text-blue-400" />;
      case "auction_approved": return <Package className="w-4 h-4 text-green-400" />;
      case "auction_rejected": return <Bell className="w-4 h-4 text-red-400" />;
      case "auction_cancelled": return <Bell className="w-4 h-4 text-gray-400" />;
      case "auction_ended_no_bid": return <Bell className="w-4 h-4 text-gray-400" />;
      case "auction_violation": return <Bell className="w-4 h-4 text-red-500" />;
      default: return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const navItems = [
    { href: "/", label: t("common.home") },
    { href: "/research", label: t("common.research") },
    { href: "/pricing", label: t("common.priceComparison") },
    { href: "/trending", label: "TCG 漲幅榜" },
    { href: "/marketplace", label: t("topnav.marketplace") },
    { href: "/grading", label: t("common.grading") },
    { href: "/blog", label: t("common.blog") },
    { href: "/auction/terms", label: t("common.auctionTerms", "買賣條款") },
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
    <CartBounceContext.Provider value={{ trigger: triggerCartBounce }}>
    <>
      {/* Sell Guide Dialog for unauthenticated users */}
      <Dialog open={showSellDialog} onOpenChange={setShowSellDialog}>
        <DialogContent bottomSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#FEDD00]" />
              {t("topnav.becomeSellerTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("topnav.becomeSellerDescription")}
            </p>
            <div className="space-y-2">
              {[
                t("topnav.featureFreeListing"),
                t("topnav.featurePaymentMethods"),
                t("topnav.featureOrderManagement"),
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#FEDD00] font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              {t("topnav.loginToSell")}
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowSellDialog(false); setLocation("/register"); }}
            >
              {t("topnav.registerFree")}
            </Button>
            <Button
              className="flex-1 bg-[#FEDD00] text-black hover:bg-[#FEDD00]/90 font-bold"
              onClick={() => { setShowSellDialog(false); setLocation("/login"); }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t("topnav.loginAndList")}
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
          {/* Single row: hamburger on left, center nav, icons on right */}
          <div className="flex items-center h-14 gap-1 relative">

            {/* Hamburger — leftmost */}
            <motion.button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white p-2 flex-shrink-0"
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

            {/* BOXIUM Logo — appears when scrolled, desktop only */}
            <AnimatePresence>
              {isScrolled && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="hidden md:flex items-center flex-shrink-0"
                >
                  <Link href="/">
                    <img
                      src="/boxium-logo.png"
                      alt="BOXIUM"
                      className="h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                    />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Center nav — desktop/tablet only (md+), absolutely centered */}
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-0.5">
              {[
                { href: "/research", label: t("common.research"), Icon: Search, tip: t("topnav.tipResearch") },
                { href: "/pricing", label: t("common.priceComparison"), Icon: BarChart2, tip: t("topnav.tipPricing") },
                { href: "/trending", label: "漲幅榜", Icon: TrendingUp, tip: "PSA 10 漲幅 / 跌幅 / 波動排行" },
                { href: "/grading", label: t("common.grading"), Icon: Award, tip: t("topnav.tipGrading") },
                { href: "/marketplace", label: t("topnav.marketplace"), Icon: Store, tip: t("topnav.tipMarketplace") },
              ].map((item) => (
                <div key={item.href} className="relative group/nav">
                  <Link
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                      isActive(item.href)
                        ? "text-white bg-white/10"
                        : "text-white/50 hover:text-white/85 hover:bg-white/5"
                    }`}
                    style={{ letterSpacing: '0.02em' }}
                  >
                    <item.Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                    {item.label}
                    {/* Active underline indicator */}
                    {isActive(item.href) && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[1px] rounded-full bg-white/60" />
                    )}
                  </Link>
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-black/90 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 z-50 border border-white/10 shadow-xl">
                    {item.tip}
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-l border-t border-white/10 rotate-45" />
                  </div>
                </div>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />            {/* 出售商品 button — full text on lg+, icon-only on md~lg */}
            {showSellButton && (
              <motion.button
                onClick={handleSellClick}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-200 whitespace-nowrap"
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#FFFFFF',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Tag className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                {/* Hide label on md~lg to avoid crowding center nav */}
                <span className="hidden lg:inline">{t("topnav.sellItem")}</span>
              </motion.button>
            )}
            {/* Shopping Cart — logged-in only */}
            {user && (
              <Link href="/cart">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={cartBouncing ? { scale: [1, 1.3, 0.9, 1.15, 1] } : {}}
                  transition={cartBouncing ? { duration: 0.5, ease: "easeInOut" } : {}}
                >
                  <Button variant="ghost" size="sm" className="relative text-white hover:text-[#FEDD00] p-2">
                    <ShoppingCart className="w-5 h-5" />
                    <CartBadge />
                  </Button>
                </motion.div>
              </Link>
            )}

            {/* Notification Bell — logged-in only */}
            {user && (
              <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                <DropdownMenuTrigger asChild>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button variant="ghost" size="sm" className="relative text-white hover:text-[#FEDD00] p-2">
                      <Bell className="w-5 h-5" />
                      {totalUnread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-0 bg-[#111] border-white/15 text-white">
                  {/* Tab Header */}
                  <div className="flex border-b border-white/10">
                    <button
                      className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        notifTab === 'notif' ? 'text-white border-b-2 border-[#FEDD00]' : 'text-white/50 hover:text-white/80'
                      }`}
                      onClick={() => setNotifTab('notif')}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {t("topnav.notifications")}
                      {(unreadData?.count ?? 0) > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                          {(unreadData?.count ?? 0) > 9 ? '9+' : unreadData?.count}
                        </span>
                      )}
                    </button>
                    <button
                      className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        notifTab === 'msg' ? 'text-white border-b-2 border-[#FEDD00]' : 'text-white/50 hover:text-white/80'
                      }`}
                      onClick={() => setNotifTab('msg')}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {t("topnav.messages")}
                      {(msgUnreadData?.count ?? 0) > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                          {(msgUnreadData?.count ?? 0) > 9 ? '9+' : msgUnreadData?.count}
                        </span>
                      )}
                    </button>
                    {notifTab === 'notif' && (unreadData?.count ?? 0) > 0 && (
                      <button
                        className="px-3 py-2.5 text-white/40 hover:text-white/70 transition-colors"
                        title={t("notifications.markAllRead")}
                        onClick={() => markAllAsReadMutation.mutate()}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Notification Tab */}
                  {notifTab === 'notif' && (
                    <>
                      <ScrollArea className="max-h-[320px]">
                        {notifLoading ? (
                          <div className="flex items-center justify-center py-8 text-white/40 text-sm">{t("common.loading")}</div>
                        ) : !notifData || notifData.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/40">
                            <Bell className="w-8 h-8 opacity-30" />
                            <span className="text-sm">{t("topnav.noNotificationsTitle")}</span>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {notifData.map((notif) => (
                              <button
                                key={notif.id}
                                className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3 ${
                                  !notif.isRead ? "bg-white/[0.03]" : ""
                                }`}
                                onClick={() => handleNotifClick(notif)}
                              >
                                <div className="mt-0.5 flex-shrink-0">{getNotifIcon(notif.type)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-xs font-medium leading-tight ${
                                      !notif.isRead ? "text-white" : "text-white/70"
                                    }`}>{notif.title}</p>
                                    {!notif.isRead && <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#FEDD00] mt-1" />}
                                  </div>
                                  {notif.body && (
                                    <p className="text-[11px] text-white/50 mt-0.5 leading-snug line-clamp-2">{notif.body}</p>
                                  )}
                                  <p className="text-[10px] text-white/30 mt-1">
                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: zhTW })}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="border-t border-white/10 px-4 py-2">
                        <Link href="/profile?tab=notifications" onClick={() => setNotifOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full text-xs text-white/50 hover:text-white h-7">
                            {t("topnav.viewAllNotifications")}
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}

                  {/* Messages Tab */}
                  {notifTab === 'msg' && (
                    <>
                      <ScrollArea className="max-h-[320px]">
                        {msgThreadsLoading ? (
                          <div className="flex items-center justify-center py-8 text-white/40 text-sm">{t("common.loading")}</div>
                        ) : !msgThreads || msgThreads.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/40">
                            <MessageSquare className="w-8 h-8 opacity-30" />
                            <span className="text-sm">{t("topnav.noUnreadMessagesTitle")}</span>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {msgThreads.map((thread) => (
                              <button
                                key={thread.orderNo}
                                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3 bg-white/[0.03]"
                                onClick={() => {
                                  setNotifOpen(false);
                                  setLocation(`/orders/${thread.orderNo}`);
                                }}
                              >
                                <div className="mt-0.5 flex-shrink-0">
                                  <MessageSquare className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium text-white leading-tight">
                                      {t("topnav.order")} #{thread.orderNo}
                                    </p>
                                    {thread.unreadCount > 0 && (
                                      <span className="flex-shrink-0 bg-red-500 text-white text-[9px] font-bold rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                                        {thread.unreadCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-white/50 mt-0.5 leading-snug line-clamp-2">
                                    {thread.latestContent || `[${t("topnav.imageMessage")}]`}
                                  </p>
                                  <p className="text-[10px] text-white/30 mt-1">
                                    {thread.latestAt ? formatDistanceToNow(new Date(thread.latestAt), { addSuffix: true, locale: zhTW }) : ''}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="border-t border-white/10 px-4 py-2">
                        <Link href="/orders" onClick={() => setNotifOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full text-xs text-white/50 hover:text-white h-7">
                            {t("topnav.viewAllMessages")}
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* User icon / auth */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:text-[#FEDD00] p-2">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuLabel className="truncate max-w-[180px]">{user.name || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setLocation("/profile"); }}>
                    <User className="w-4 h-4 mr-2" />
                    {t("topnav.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setLocation("/seller"); }}>
                    <Tag className="w-4 h-4 mr-2" />
                    {t("topnav.sellerDashboard")}
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => { setLocation("/admin"); }}>
                      <span className="w-4 h-4 mr-2 text-red-400">⚙</span>
                    {t("common.admin")}
                  </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("topnav.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:text-[#FEDD00] p-2"
                onClick={() => setLocation("/login")}
              >
                <User className="w-5 h-5" />
              </Button>
            )}

          </div>
        </div>
      </nav>

      {/* ── Editorial Table-of-Contents Drawer ── */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 280 }}
            className="fixed top-0 left-0 bottom-0 z-40 flex flex-col"
            style={{
              width: "min(320px, 85vw)",
              background: "rgba(8,8,10,0.97)",
              backdropFilter: "blur(20px)",
              borderRight: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "8px 0 40px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header strip */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p style={{ fontFamily: "monospace", fontSize: "8px", letterSpacing: "0.25em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>BOXIUM TCG</p>
                <p style={{ fontFamily: "monospace", fontSize: "7px", letterSpacing: "0.2em", color: "rgba(255,255,255,0.15)", textTransform: "uppercase", marginTop: "2px" }}>NAVIGATION INDEX</p>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav items — editorial TOC */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">
              {/* BOXIUM 福袋 — 第一項，維護模式開啟時非管理員隱藏 */}
              {showLootPool && (
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05, type: "spring", damping: 28, stiffness: 260 }}
                >
                  <Link href="/pools" onClick={handleNavClick}>
                    <div
                      className="group relative flex items-baseline gap-3 py-3 cursor-pointer"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(168,85,247,0.7)", flexShrink: 0, width: "20px" }}>
                        00
                      </span>
                      <span
                        className="group-hover:translate-x-1.5 transition-transform duration-200 animate-rainbow-shift"
                        style={{
                          fontFamily: "'Playfair Display', Georgia, serif",
                          fontSize: "clamp(18px, 4vw, 22px)",
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          lineHeight: 1.1,
                          background: "linear-gradient(90deg, #a855f7, #ec4899, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)",
                          backgroundSize: "200% auto",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        BOXIUM 盲盒
                      </span>
                      <span className="absolute bottom-0 left-8 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "rgba(168,85,247,0.3)" }} />
                    </div>
                  </Link>
                </motion.div>
              )}
              {navItems.map((item, index) => {
                const active = isActive(item.href);
                const num = String(index + 1).padStart(2, "0");
                return (
                  <motion.div
                    key={item.href}
                    initial={{ x: -24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.05 + index * 0.055, type: "spring", damping: 28, stiffness: 260 }}
                  >
                    <Link href={item.href} onClick={handleNavClick}>
                      <div
                        className="group relative flex items-baseline gap-3 py-3 cursor-pointer"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        {/* Index number */}
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "9px",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            color: active ? "rgba(254,221,0,0.6)" : "rgba(255,255,255,0.2)",
                            flexShrink: 0,
                            width: "20px",
                            transition: "color 0.2s",
                          }}
                        >
                          {num}
                        </span>

                        {/* Label */}
                        <span
                          className="group-hover:translate-x-1.5 transition-transform duration-200"
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: "clamp(18px, 4vw, 22px)",
                            fontWeight: active ? 700 : 400,
                            letterSpacing: "0.02em",
                            color: active ? "#FFFFFF" : "rgba(255,255,255,0.55)",
                            lineHeight: 1.1,
                            transition: "color 0.2s",
                          }}
                        >
                          {item.label}
                        </span>

                        {/* ACTIVE badge */}
                        {active && (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "7px",
                              fontWeight: 900,
                              letterSpacing: "0.15em",
                              color: "#000",
                              background: "#FEDD00",
                              padding: "1px 5px",
                              borderRadius: "2px",
                              boxShadow: "0 0 8px rgba(254,221,0,0.5)",
                              alignSelf: "center",
                              flexShrink: 0,
                            }}
                          >
                            CURRENT
                          </span>
                        )}

                        {/* Hover underline */}
                        <span
                          className="absolute bottom-0 left-8 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          style={{ background: "rgba(255,255,255,0.15)" }}
                        />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}

              {/* Sell item */}
              {showSellButton && (
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 + navItems.length * 0.055, type: "spring", damping: 28, stiffness: 260 }}
                >
                  <div
                    className="group relative flex items-baseline gap-3 py-3 cursor-pointer"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onClick={() => { handleNavClick(); handleSellClick(); }}
                  >
                    <span style={{ fontFamily: "monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(254,221,0,0.6)", flexShrink: 0, width: "20px" }}>
                      {String(navItems.length + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="group-hover:translate-x-1.5 transition-transform duration-200"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 400, letterSpacing: "0.02em", color: "#FEDD00", lineHeight: 1.1 }}
                    >
                      {t("topnav.sellItem")}
                    </span>
                    <span className="absolute bottom-0 left-8 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.15)" }} />
                  </div>
                </motion.div>
              )}

              {/* Admin link */}
              {user?.role === "admin" && (
                <motion.div
                  initial={{ x: -24, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 + (navItems.length + 1) * 0.055, type: "spring", damping: 28, stiffness: 260 }}
                >
                  <Link href="/admin" onClick={handleNavClick}>
                    <div
                      className="group relative flex items-baseline gap-3 py-3 cursor-pointer"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <span style={{ fontFamily: "monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,80,80,0.6)", flexShrink: 0, width: "20px" }}>
                        {String(navItems.length + 2).padStart(2, "0")}
                      </span>
                      <span
                        className="group-hover:translate-x-1.5 transition-transform duration-200"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 400, letterSpacing: "0.02em", color: "rgba(255,100,100,0.8)", lineHeight: 1.1 }}
                      >
                        {t("nav.admin")}
                      </span>
                      <span className="absolute bottom-0 left-8 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "rgba(255,255,255,0.15)" }} />
                    </div>
                  </Link>
                </motion.div>
              )}
            </div>

            {/* Footer: Language + Login/Register */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="px-6 pb-6 pt-4 space-y-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <LanguageSwitcher />
              </div>
              {!user && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-white border-white/20 hover:bg-white/10 bg-transparent text-xs"
                    onClick={() => { setLocation("/login"); handleNavClick(); }}
                  >
                    {t("topnav.login")}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#FEDD00] text-black hover:bg-[#FEDD00]/90 text-xs font-bold"
                    onClick={() => { setLocation("/register"); handleNavClick(); }}
                  >
                    {t("topnav.register")}
                  </Button>
                </div>
              )}
              <p style={{ fontFamily: "monospace", fontSize: "7px", letterSpacing: "0.2em", color: "rgba(255,255,255,1)", textTransform: "uppercase" }}>
                © BOXIUM TCG · LUCK IN EVERY BOX
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
    </CartBounceContext.Provider>
  );
}
