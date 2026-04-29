import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Users, Database, TrendingUp, FileText, HardDrive,
  Clock, Activity, History, MapPin, Mail, FlaskConical, Settings,
  ShoppingCart, PanelLeftClose, PanelLeft, Menu, X, MessageSquare, Sparkles, Shield, Wand2, BookOpen
} from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminDataSources } from "@/components/AdminDataSources";
import { AdminTrendingCards } from "@/components/AdminTrendingCards";
import { AdminBlogManagement } from "@/components/AdminBlogManagement";
import { AdminCacheManagement } from "@/components/AdminCacheManagement";
import { AdminScheduleManagement } from "@/components/AdminScheduleManagement";
import { AdminScraperPerformance } from "@/components/AdminScraperPerformance";
import { AdminTaskHistory } from "@/components/AdminTaskHistory";
import { AdminSFStationUpdate } from "@/components/AdminSFStationUpdate";
import AdminEmailLogs from "@/components/AdminEmailLogs";
import AdminEmailTest from "@/components/AdminEmailTest";
import AdminPlatformSettings from "@/components/AdminPlatformSettings";
import AdminMessages from "@/components/AdminMessages";
import { ContentWorkflowCenter } from "@/components/ContentWorkflowCenter";
import AdminSecurityMonitor from "@/components/AdminSecurityMonitor";
import AdminQuickPublish from "@/components/AdminQuickPublish";
import AdminCardInventory from "@/components/AdminCardInventory";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

/* ─── Constants ─────────────────────────────────────────────────────── */
const STORAGE_KEY_TAB = "boxium_admin_active_tab";
const STORAGE_KEY_COLLAPSED = "boxium_admin_sidebar_collapsed";

const VALID_TABS = [
  "dashboard", "users", "datasources", "trending", "blog", "quick-publish", "content-workflow",
  "cache", "schedule", "performance", "taskhistory", "security",
  "sfstations", "emaillogs", "emailtest", "platformsettings", "messages",
  "card-inventory",
] as const;

type TabId = typeof VALID_TABS[number];

function getStoredTab(): TabId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TAB);
    if (stored && VALID_TABS.includes(stored as TabId)) return stored as TabId;
  } catch { /* ignore */ }
  return "dashboard";
}

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  } catch { return false; }
}

/* ─── Navigation Groups ─────────────────────────────────────────────── */
interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_GROUPS = [
  { id: "overview", label: "總覽" },
  { id: "content", label: "內容管理" },
  { id: "system", label: "系統運維" },
  { id: "communication", label: "通訊" },
  { id: "other", label: "其他" },
];

function useNavItems(): NavItem[] {
  const { t } = useTranslation();
  return [
    { id: "dashboard", label: t("admin.statistics"), icon: <LayoutDashboard className="w-[18px] h-[18px]" />, group: "overview" },
    { id: "users", label: "帳號管理", icon: <Users className="w-[18px] h-[18px]" />, group: "overview" },
    { id: "datasources", label: t("admin.dataSources"), icon: <Database className="w-[18px] h-[18px]" />, group: "content" },
    { id: "trending", label: "熱門卡牌", icon: <TrendingUp className="w-[18px] h-[18px]" />, group: "content" },
    { id: "blog", label: "博客管理", icon: <FileText className="w-[18px] h-[18px]" />, group: "content" },
    { id: "quick-publish", label: "AI 出文章", icon: <Wand2 className="w-[18px] h-[18px]" />, group: "content" },
    { id: "content-workflow", label: "AI 工作流（進階）", icon: <Sparkles className="w-[18px] h-[18px]" />, group: "content" },
    { id: "cache", label: "緩存管理", icon: <HardDrive className="w-[18px] h-[18px]" />, group: "system" },
    { id: "schedule", label: "排程管理", icon: <Clock className="w-[18px] h-[18px]" />, group: "system" },
    { id: "performance", label: "性能監控", icon: <Activity className="w-[18px] h-[18px]" />, group: "system" },
    { id: "taskhistory", label: "任務歷史", icon: <History className="w-[18px] h-[18px]" />, group: "system" },
    { id: "security", label: "安全監控", icon: <Shield className="w-[18px] h-[18px]" />, group: "system" },
    { id: "emaillogs", label: "電郵日誌", icon: <Mail className="w-[18px] h-[18px]" />, group: "communication" },
    { id: "emailtest", label: "電郵測試", icon: <FlaskConical className="w-[18px] h-[18px]" />, group: "communication" },
    { id: "messages", label: "訊息管理", icon: <MessageSquare className="w-[18px] h-[18px]" />, group: "communication" },
    { id: "card-inventory", label: "買取賣出記錄", icon: <BookOpen className="w-[18px] h-[18px]" />, group: "other" },
    { id: "sfstations", label: "順豐站管理", icon: <MapPin className="w-[18px] h-[18px]" />, group: "other" },
    { id: "platformsettings", label: "平台設定", icon: <Settings className="w-[18px] h-[18px]" />, group: "other" },
  ];
}

/* ─── Content Renderer ───────────────────────────────────────────────── */
function AdminContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case "dashboard": return <AdminDashboard />;
    case "users": return <AdminUserManagement />;
    case "datasources": return <AdminDataSources />;
    case "trending": return <AdminTrendingCards />;
    case "blog": return <AdminBlogManagement />;
    case "quick-publish": return <AdminQuickPublish />;
    case "content-workflow": return <ContentWorkflowCenter />;
    case "cache": return <AdminCacheManagement />;
    case "schedule": return <AdminScheduleManagement />;
    case "performance": return <AdminScraperPerformance />;
    case "taskhistory": return <AdminTaskHistory />;
    case "sfstations": return <AdminSFStationUpdate />;
    case "emaillogs": return <AdminEmailLogs />;
    case "emailtest": return <AdminEmailTest />;
    case "platformsettings": return <AdminPlatformSettings />;
    case "messages": return <AdminMessages />;
    case "security": return <AdminSecurityMonitor />;
    case "card-inventory": return <AdminCardInventory />;
    default: return <AdminDashboard />;
  }
}

/* ─── Sidebar Navigation (shared between desktop & mobile) ───────── */
function SidebarNav({
  navItems,
  activeTab,
  onSelect,
  collapsed,
  onToggleCollapse,
  onMarketplace,
  isMobile,
}: {
  navItems: NavItem[];
  activeTab: string;
  onSelect: (id: TabId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMarketplace: () => void;
  isMobile: boolean;
}) {
  const { t } = useTranslation();
  const showLabels = isMobile || !collapsed;

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className={cn(
        "flex items-center h-14 border-b border-white/[0.06] px-4 shrink-0",
        !showLabels ? "justify-center" : "justify-between"
      )}>
        {showLabels && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-1.5 h-7 rounded-full bg-[#FEDD00] shrink-0" />
            <h1 className="text-[15px] font-semibold text-white truncate tracking-tight">
              {t("admin.title")}
            </h1>
          </div>
        )}
        {/* Desktop: collapse toggle; Mobile: hidden (close handled by overlay) */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors shrink-0"
            title={collapsed ? "展開側邊欄" : "收合側邊欄"}
          >
            {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 scrollbar-thin">
        {NAV_GROUPS.map((group) => {
          const groupItems = navItems.filter(item => item.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.id} className="mb-1">
              {showLabels && (
                <div className="px-2.5 pt-3 pb-1.5 first:pt-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500/80">
                    {group.label}
                  </span>
                </div>
              )}
              {!showLabels && group.id !== "overview" && (
                <div className="mx-2.5 my-2 border-t border-white/[0.06]" />
              )}
              {groupItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    title={!showLabels ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative",
                      !showLabels ? "justify-center px-0 py-2.5 mx-auto" : "px-2.5 py-2",
                      isActive
                        ? "bg-[#06038d] text-white shadow-[0_1px_3px_rgba(6,3,141,0.4)]"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#FEDD00]" />
                    )}
                    <span className={cn(
                      "shrink-0 transition-colors",
                      isActive ? "text-[#FEDD00]" : "text-gray-500 group-hover:text-gray-300"
                    )}>
                      {item.icon}
                    </span>
                    {showLabels && (
                      <span className="text-[13px] font-medium truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer — Marketplace Shortcut */}
      <div className="border-t border-white/[0.06] p-2.5 shrink-0">
        <button
          onClick={onMarketplace}
          title={!showLabels ? "商場管理" : undefined}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg py-2.5 transition-all duration-150",
            "text-[#FEDD00] hover:bg-[#FEDD00]/[0.08] border border-[#FEDD00]/20 hover:border-[#FEDD00]/40",
            !showLabels ? "justify-center px-0" : "px-3"
          )}
        >
          <ShoppingCart className="w-[18px] h-[18px] shrink-0" />
          {showLabels && (
            <span className="text-[13px] font-medium truncate">商場管理</span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Admin Page ────────────────────────────────────────────────── */
export default function Admin() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const navItems = useNavItems();

  // Restore from localStorage
  const [activeTab, setActiveTab] = useState<TabId>(getStoredTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persist active tab
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_TAB, activeTab); } catch { /* ignore */ }
  }, [activeTab]);

  // Persist sidebar collapsed state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(sidebarCollapsed)); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Listen for cross-component navigation events from ContentWorkflowCenter
  useEffect(() => {
    const handleNavigateToBlog = () => {
      setActiveTab('blog');
      setMobileMenuOpen(false);
    };
    const handleNavigateToQuickPublish = () => {
      setActiveTab('quick-publish');
      setMobileMenuOpen(false);
    };
    window.addEventListener('navigate-to-blog', handleNavigateToBlog);
    window.addEventListener('navigate-to-quick-publish', handleNavigateToQuickPublish);
    return () => {
      window.removeEventListener('navigate-to-blog', handleNavigateToBlog);
      window.removeEventListener('navigate-to-quick-publish', handleNavigateToQuickPublish);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleSelectTab = useCallback((id: TabId) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const handleMarketplace = useCallback(() => {
    navigate("/admin/marketplace");
    setMobileMenuOpen(false);
  }, [navigate]);

  const activeItem = navItems.find(item => item.id === activeTab);

  return (
    <div className="flex h-screen overflow-hidden bg-[#060618]">
      {/* ─── Desktop Sidebar (hidden on mobile) ──────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-white/[0.06] bg-[#0a0a1e] transition-all duration-300 ease-in-out shrink-0",
          sidebarCollapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        <SidebarNav
          navItems={navItems}
          activeTab={activeTab}
          onSelect={handleSelectTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onMarketplace={handleMarketplace}
          isMobile={false}
        />
      </aside>

      {/* ─── Mobile Overlay + Drawer ─────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-[#0a0a1e] border-r border-white/[0.06] transition-transform duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarNav
          navItems={navItems}
          activeTab={activeTab}
          onSelect={handleSelectTab}
          collapsed={false}
          onToggleCollapse={handleToggleCollapse}
          onMarketplace={handleMarketplace}
          isMobile={true}
        />
      </aside>

      {/* ─── Right Content Area ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="flex items-center h-14 border-b border-white/[0.06] bg-[#0a0a1e]/80 backdrop-blur-sm px-4 md:px-6 shrink-0 gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors md:hidden shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {activeItem && (
              <span className="text-gray-500 shrink-0">{activeItem.icon}</span>
            )}
            <h2 className="text-[15px] font-semibold text-white truncate">
              {activeItem?.label ?? t("admin.statistics")}
            </h2>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <AdminContent activeTab={activeTab} />
          </div>
        </div>
      </main>
    </div>
  );
}
