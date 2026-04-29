import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Database, TrendingUp, FileText,
  HardDrive, Clock, Activity, History, MapPin, Mail, FlaskConical,
  Settings, ShoppingCart, PanelLeftClose, PanelLeft, Menu, X,
  MessageSquare, Sparkles, Shield, Wand2, BookOpen, Wrench, ChevronRight
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
const STORAGE_KEY_SECTION = "boxium_admin_active_section";
const STORAGE_KEY_TAB = "boxium_admin_active_tab";
const STORAGE_KEY_COLLAPSED = "boxium_admin_sidebar_collapsed";

/* ─── Section & Tab Definitions ─────────────────────────────────────── */

// Each "section" is a sidebar item; each section has one or more "tabs"
interface TabDef {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  tabs: TabDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "overview",
    label: "統計總覽",
    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
    tabs: [
      { id: "dashboard", label: "統計資訊", icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: "users", label: "帳號管理", icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    id: "content",
    label: "內容管理",
    icon: <FileText className="w-[18px] h-[18px]" />,
    tabs: [
      { id: "datasources", label: "數據源管理", icon: <Database className="w-4 h-4" /> },
      { id: "trending", label: "熱門卡牌", icon: <TrendingUp className="w-4 h-4" /> },
      { id: "blog", label: "博客管理", icon: <FileText className="w-4 h-4" /> },
      { id: "quick-publish", label: "AI 出文章", icon: <Wand2 className="w-4 h-4" /> },
      { id: "content-workflow", label: "AI 工作流", icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    id: "system",
    label: "系統運維",
    icon: <Wrench className="w-[18px] h-[18px]" />,
    tabs: [
      { id: "cache", label: "緩存管理", icon: <HardDrive className="w-4 h-4" /> },
      { id: "schedule", label: "排程管理", icon: <Clock className="w-4 h-4" /> },
      { id: "performance", label: "性能監控", icon: <Activity className="w-4 h-4" /> },
      { id: "taskhistory", label: "任務歷史", icon: <History className="w-4 h-4" /> },
      { id: "security", label: "安全監控", icon: <Shield className="w-4 h-4" /> },
      { id: "emaillogs", label: "電郵日誌", icon: <Mail className="w-4 h-4" /> },
      { id: "emailtest", label: "電郵測試", icon: <FlaskConical className="w-4 h-4" /> },
      { id: "messages", label: "訊息管理", icon: <MessageSquare className="w-4 h-4" /> },
    ],
  },
  {
    id: "finance",
    label: "財務記錄",
    icon: <BookOpen className="w-[18px] h-[18px]" />,
    tabs: [
      { id: "card-inventory", label: "買取賣出記錄", icon: <BookOpen className="w-4 h-4" /> },
    ],
  },
  {
    id: "settings",
    label: "設定",
    icon: <Settings className="w-[18px] h-[18px]" />,
    tabs: [
      { id: "sfstations", label: "順豐站管理", icon: <MapPin className="w-4 h-4" /> },
      { id: "platformsettings", label: "平台設定", icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

// Build a flat map: tabId → sectionId
const TAB_TO_SECTION: Record<string, string> = {};
SECTIONS.forEach(s => s.tabs.forEach(t => { TAB_TO_SECTION[t.id] = s.id; }));

// Default tab for each section
const SECTION_DEFAULT_TAB: Record<string, string> = {};
SECTIONS.forEach(s => { SECTION_DEFAULT_TAB[s.id] = s.tabs[0].id; });

type SectionId = typeof SECTIONS[number]["id"];

function getStoredSection(): SectionId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SECTION);
    if (stored && SECTIONS.find(s => s.id === stored)) return stored as SectionId;
  } catch { /* ignore */ }
  return "overview";
}

function getStoredTab(sectionId: SectionId): string {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_TAB}_${sectionId}`);
    const section = SECTIONS.find(s => s.id === sectionId);
    if (stored && section?.tabs.find(t => t.id === stored)) return stored;
  } catch { /* ignore */ }
  return SECTION_DEFAULT_TAB[sectionId];
}

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  } catch { return false; }
}

/* ─── Tab Content Renderer ───────────────────────────────────────────── */
function TabContent({ tabId }: { tabId: string }) {
  switch (tabId) {
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

/* ─── In-page Tab Bar ────────────────────────────────────────────────── */
function SectionTabBar({
  section,
  activeTab,
  onSelect,
}: {
  section: SectionDef;
  activeTab: string;
  onSelect: (tabId: string) => void;
}) {
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = tabBarRef.current;
    if (!el) return;
    const check = () => setShowFade(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    el.addEventListener("scroll", check);
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [section.tabs]);

  // Only render the tab bar if there are multiple tabs
  if (section.tabs.length <= 1) return null;

  return (
    <div className="relative border-b border-white/[0.06] bg-[#0a0a1e]/60 shrink-0">
      <div
        ref={tabBarRef}
        className="flex overflow-x-auto scrollbar-none px-4 md:px-6 gap-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {section.tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all duration-150 shrink-0",
                isActive
                  ? "border-[#FEDD00] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20"
              )}
            >
              <span className={cn("shrink-0", isActive ? "text-[#FEDD00]" : "text-gray-500")}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
      {/* Right fade hint for mobile */}
      {showFade && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#0a0a1e] to-transparent sm:hidden" />
      )}
    </div>
  );
}

/* ─── Sidebar Navigation ─────────────────────────────────────────────── */
function SidebarNav({
  activeSection,
  onSelect,
  collapsed,
  onToggleCollapse,
  onMarketplace,
  isMobile,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onMarketplace: () => void;
  isMobile: boolean;
}) {
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
              管理後台
            </h1>
          </div>
        )}
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
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 scrollbar-thin">
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              title={!showLabels ? section.label : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative",
                !showLabels ? "justify-center px-0 py-2.5 mx-auto" : "px-2.5 py-2.5",
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
                {section.icon}
              </span>
              {showLabels && (
                <>
                  <span className="text-[13px] font-medium truncate flex-1 text-left">{section.label}</span>
                  {section.tabs.length > 1 && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      isActive ? "bg-white/20 text-white" : "bg-white/[0.06] text-gray-500"
                    )}>
                      {section.tabs.length}
                    </span>
                  )}
                </>
              )}
            </button>
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
  const [, navigate] = useLocation();

  // Active section (sidebar item)
  const [activeSection, setActiveSection] = useState<SectionId>(getStoredSection);

  // Active tab per section (stored separately)
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    SECTIONS.forEach(s => { result[s.id] = getStoredTab(s.id); });
    return result;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persist active section
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SECTION, activeSection); } catch { /* ignore */ }
  }, [activeSection]);

  // Persist active tab per section
  useEffect(() => {
    SECTIONS.forEach(s => {
      try { localStorage.setItem(`${STORAGE_KEY_TAB}_${s.id}`, activeTabs[s.id] ?? SECTION_DEFAULT_TAB[s.id]); } catch { /* ignore */ }
    });
  }, [activeTabs]);

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

  // Listen for cross-component navigation events
  useEffect(() => {
    const handleNavigateToBlog = () => {
      setActiveSection("content");
      setActiveTabs(prev => ({ ...prev, content: "blog" }));
      setMobileMenuOpen(false);
    };
    const handleNavigateToQuickPublish = () => {
      setActiveSection("content");
      setActiveTabs(prev => ({ ...prev, content: "quick-publish" }));
      setMobileMenuOpen(false);
    };
    window.addEventListener("navigate-to-blog", handleNavigateToBlog);
    window.addEventListener("navigate-to-quick-publish", handleNavigateToQuickPublish);
    return () => {
      window.removeEventListener("navigate-to-blog", handleNavigateToBlog);
      window.removeEventListener("navigate-to-quick-publish", handleNavigateToQuickPublish);
    };
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const handleSelectSection = useCallback((id: SectionId) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
  }, []);

  const handleSelectTab = useCallback((sectionId: string, tabId: string) => {
    setActiveTabs(prev => ({ ...prev, [sectionId]: tabId }));
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const handleMarketplace = useCallback(() => {
    navigate("/admin/marketplace");
    setMobileMenuOpen(false);
  }, [navigate]);

  const currentSection = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0];
  const currentTabId = activeTabs[activeSection] ?? SECTION_DEFAULT_TAB[activeSection];

  return (
    <div className="flex h-screen overflow-hidden bg-[#060618]">
      {/* ─── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-white/[0.06] bg-[#0a0a1e] transition-all duration-300 ease-in-out shrink-0",
          sidebarCollapsed ? "w-[68px]" : "w-[220px]"
        )}
      >
        <SidebarNav
          activeSection={activeSection}
          onSelect={handleSelectSection}
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
          "fixed inset-y-0 left-0 z-50 w-[240px] bg-[#0a0a1e] border-r border-white/[0.06] transition-transform duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarNav
          activeSection={activeSection}
          onSelect={handleSelectSection}
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
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 text-[14px]">
            <span className="text-gray-500 shrink-0">{currentSection.icon}</span>
            <span className="text-gray-400 font-medium shrink-0">{currentSection.label}</span>
            {currentSection.tabs.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                <span className="text-white font-semibold truncate">
                  {currentSection.tabs.find(t => t.id === currentTabId)?.label ?? ""}
                </span>
              </>
            )}
          </div>
        </header>

        {/* In-page Tab Bar */}
        <SectionTabBar
          section={currentSection}
          activeTab={currentTabId}
          onSelect={(tabId) => handleSelectTab(activeSection, tabId)}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8">
            <TabContent tabId={currentTabId} />
          </div>
        </div>
      </main>
    </div>
  );
}
