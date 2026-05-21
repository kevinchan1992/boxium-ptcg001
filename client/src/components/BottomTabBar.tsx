import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Search, ShoppingBag, Award, User, ShoppingCart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

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
    labelFallback: "首頁",
    matchPaths: ["/"],
  },
  {
    path: "/research",
    icon: Search,
    labelKey: "nav.research",
    labelFallback: "搜尋",
    matchPaths: ["/research", "/search", "/card/", "/pricing"],
  },
  {
    path: "/marketplace",
    icon: ShoppingBag,
    labelKey: "nav.marketplace",
    labelFallback: "市集",
    matchPaths: ["/marketplace", "/auction", "/cart", "/seller"],
  },
  {
    path: "/grading",
    icon: Award,
    labelKey: "nav.grading",
    labelFallback: "鑑定",
    matchPaths: ["/grading"],
  },
  {
    path: "/profile",
    icon: User,
    labelKey: "nav.profile",
    labelFallback: "我的",
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

  // Cart count badge
  const { data: cartCount } = trpc.marketplace.getCartCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Hide on admin pages and full-screen pages
  const hiddenPaths = ["/admin", "/login", "/register", "/verify-email", "/resend-verification", "/auction/terms"];
  const shouldHide = hiddenPaths.some((p) => location.startsWith(p));
  if (shouldHide) return null;

  return (
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
            const showCartBadge = isMarket && !!user && !!cartCount && cartCount > 0;

            return (
              <button
                key={tab.path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative tap-highlight-transparent"
                onClick={() => setLocation(tab.path)}
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
                      {cartCount > 99 ? "99+" : cartCount}
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
  );
}
