import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Search, ShoppingBag, Award, User, ShoppingCart, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { CameraSearchSheet } from "@/components/CameraSearchSheet";

interface TabItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  labelFallback: string;
  matchPaths?: string[];
}

const TABS: TabItem[] = [
  {
    path: "/",
    icon: Home,
    labelKey: "nav.home",
    labelFallback: "Home",
    matchPaths: ["/"],
  },
  {
    path: "/research",
    icon: Search,
    labelKey: "nav.research",
    labelFallback: "Search",
    matchPaths: ["/research", "/search", "/card/", "/pricing"],
  },
  {
    path: "/marketplace",
    icon: ShoppingBag,
    labelKey: "nav.marketplace",
    labelFallback: "Market",
    matchPaths: ["/marketplace", "/auction", "/cart", "/seller"],
  },
  {
    path: "/grading",
    icon: Award,
    labelKey: "nav.grading",
    labelFallback: "Grading",
    matchPaths: ["/grading"],
  },
  {
    path: "/profile",
    icon: User,
    labelKey: "nav.profile",
    labelFallback: "Profile",
    matchPaths: ["/profile", "/orders", "/notifications", "/wishlist"],
  },
];

function isTabActive(tab: TabItem, location: string): boolean {
  if (tab.path === "/" && location === "/") return true;
  if (tab.path === "/" && location !== "/") return false;
  return (tab.matchPaths ?? [tab.path]).some((p) =>
    p.endsWith("/") ? location.startsWith(p) : location === p || location.startsWith(p + "/") || location.startsWith(p + "?")
  );
}

export function BottomTabBar() {
  const [location, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const { t } = useTranslation();
  const [showCameraSheet, setShowCameraSheet] = useState(false);
  const [scanButtonVisible, setScanButtonVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide scan button on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (delta > 6) {
        // Scrolling down — hide
        setScanButtonVisible(false);
      } else if (delta < -6) {
        // Scrolling up — show
        setScanButtonVisible(true);
      }

      lastScrollY.current = currentY;

      // Auto-show after user stops scrolling for 2s
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setScanButtonVisible(true), 2000);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  // Cart count badge
  const { data: cartCount } = trpc.marketplace.getCartCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Hide on admin pages and full-screen pages
  const hiddenPaths = ["/admin", "/login", "/register", "/verify-email", "/resend-verification", "/auction/terms"];
  const shouldHide = hiddenPaths.some((p) => location.startsWith(p));
  if (shouldHide) return null;

  // Show scan button on search-related pages (mobile only)
  const scanPages = ["/research", "/pricing", "/search"];
  const showScanButton = scanPages.some(
    (p) => location === p || location.startsWith(p + "/") || location.startsWith(p + "?")
  );

  // Determine camera scan destination based on current page
  const isPricingPage = location === "/pricing" || location.startsWith("/pricing/") || location.startsWith("/pricing?");
  const cameraCardLinkPrefix = isPricingPage ? "pricing" : "card";

  return (
    <>
      {/* Scan Button — shown above nav bar on search/pricing pages (mobile only) */}
      <AnimatePresence>
        {showScanButton && (
          <motion.div
            className="fixed left-0 right-0 z-40 md:hidden px-4 pb-2"
            style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))" }}
            initial={{ y: 0, opacity: 1 }}
            animate={{
              y: scanButtonVisible ? 0 : 80,
              opacity: scanButtonVisible ? 1 : 0,
            }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <button
              type="button"
              onClick={() => setShowCameraSheet(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={{
                background: "white",
                color: "#111",
                boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
              }}
            >
              <Camera className="w-5 h-5" />
              <span>{t("camera.scanTitle")}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Search Sheet */}
      <CameraSearchSheet
        open={showCameraSheet}
        onOpenChange={setShowCameraSheet}
        cardLinkPrefix={cameraCardLinkPrefix}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      >
        {/* Backdrop blur bar */}
        <div className="bg-black/90 backdrop-blur-md border-t border-white/10" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="flex items-stretch h-14">
            {TABS.map((tab) => {
              const active = isTabActive(tab, location);
              const Icon = tab.icon;
              const label = t(tab.labelKey, tab.labelFallback);
              const isMarket = tab.path === "/marketplace";
              const cartCountNum = typeof cartCount === 'number' ? cartCount : (cartCount as any)?.count ?? 0;
              const showCartBadge = isMarket && !!user && cartCountNum > 0;

              return (
                <button
                  key={tab.path}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative tap-highlight-transparent"
                  onClick={() => {
                    if (tab.path === "/profile" && !user) {
                      setLocation("/login");
                    } else {
                      setLocation(tab.path);
                    }
                  }}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                >
                  {/* Active indicator dot */}
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#FEDD00]"
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        exit={{ opacity: 0, scaleX: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Icon with cart badge */}
                  <div className="relative">
                    <motion.div
                      animate={{ scale: active ? 1.1 : 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      {isMarket && !!user ? (
                        <ShoppingCart
                          className={`w-5 h-5 transition-colors ${active ? "text-[#FEDD00]" : "text-white/60"}`}
                        />
                      ) : (
                        <Icon
                          className={`w-5 h-5 transition-colors ${active ? "text-[#FEDD00]" : "text-white/60"}`}
                        />
                      )}
                    </motion.div>
                    {showCartBadge && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {cartCountNum > 99 ? "99+" : cartCountNum}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-[10px] font-medium leading-none transition-colors ${
                      active ? "text-[#FEDD00]" : "text-white/50"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
