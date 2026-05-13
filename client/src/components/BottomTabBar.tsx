import { useLocation, Link } from "wouter";
import { Home, Search, ShoppingBag, User, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCapacitor } from "@/hooks/useCapacitor";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface TabItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  activeMatch?: string[];
}

/**
 * BottomTabBar - Native-style bottom navigation for Capacitor APP
 *
 * Only rendered when running inside a Capacitor native app.
 * Provides quick access to the 5 most important sections.
 *
 * Safe Area: The parent container has padding-bottom = safe-area-inset-bottom
 * via the .bottom-tab-bar CSS class in capacitor-app.css
 */
export function BottomTabBar() {
  const { isNative } = useCapacitor();
  const [location] = useLocation();
  const { t } = useTranslation();
  const { data: user } = trpc.auth.me.useQuery();

  // Only render in native app mode
  if (!isNative) return null;

  const tabs: TabItem[] = [
    {
      path: "/",
      icon: <Home className="w-5 h-5" />,
      label: t("nav.home", "首頁"),
      activeMatch: ["/"],
    },
    {
      path: "/research",
      icon: <Search className="w-5 h-5" />,
      label: t("nav.research", "搜尋"),
      activeMatch: ["/research", "/search", "/card/"],
    },
    {
      path: "/trending",
      icon: <TrendingUp className="w-5 h-5" />,
      label: t("nav.trending", "排行"),
      activeMatch: ["/trending", "/pricing"],
    },
    {
      path: "/marketplace",
      icon: <ShoppingBag className="w-5 h-5" />,
      label: t("nav.marketplace", "市集"),
      activeMatch: ["/marketplace", "/auction", "/cart"],
    },
    {
      path: user ? "/profile" : "/login",
      icon: <User className="w-5 h-5" />,
      label: user ? t("nav.profile", "我的") : t("nav.login", "登入"),
      activeMatch: ["/profile", "/login", "/register", "/orders", "/grading"],
    },
  ];

  const isActive = (tab: TabItem): boolean => {
    if (!tab.activeMatch) return location === tab.path;
    return tab.activeMatch.some((match) => {
      if (match === "/") return location === "/";
      return location.startsWith(match);
    });
  };

  return (
    <div
      className={cn(
        "bottom-tab-bar",
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-black/95 backdrop-blur-md border-t border-white/10",
        "flex items-start justify-around",
        "pt-2"
      )}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link key={tab.path} href={tab.path}>
            <div
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg",
                "transition-all duration-150",
                active
                  ? "text-orange-400"
                  : "text-gray-400 active:text-gray-200"
              )}
            >
              <div
                className={cn(
                  "relative transition-transform duration-150",
                  active && "scale-110"
                )}
              >
                {tab.icon}
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">
                {tab.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
