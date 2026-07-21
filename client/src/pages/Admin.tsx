import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard, Users, Database, Package, TrendingUp, FileText,
  Wand2, Sparkles, HardDrive, Clock, Activity, History, Shield,
  Mail, FlaskConical, MessageSquare, Settings, MapPin, BookOpen,
  Crown, Wrench, PanelLeft, PanelLeftClose, X, Menu, ChevronRight,
  ShoppingCart, Search, Bell, ChevronDown, Building2, User,
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
import AdminCompanyCardInventory from "@/components/AdminCompanyCardInventory";
import AdminSealedProducts from "@/components/AdminSealedProducts";
import { AdminVipDashboard } from "@/pages/admin/AdminVipDashboard";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

/* ─── Storage Keys ───────────────────────────────────────────────────────── */
const STORAGE_KEY_SECTION = "boxium_admin_active_section";
const STORAGE_KEY_TAB = "boxium_admin_active_tab";
const STORAGE_KEY_COLLAPSED = "boxium_admin_sidebar_collapsed";

/* ─── Section & Tab Definitions ─────────────────────────────────────────── */
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
    icon: <LayoutDashboard className="w-[17px] h-[17px]" />,
    tabs: [
      { id: "dashboard", label: "統計資訊", icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: "users", label: "帳號管理", icon: <Users className="w-4 h-4" /> },
    ],
  },
  {
    id: "content",
    label: "內容管理",
    icon: <FileText className="w-[17px] h-[17px]" />,
    tabs: [
      { id: "datasources", label: "數據源管理", icon: <Database className="w-4 h-4" /> },
      { id: "sealed-products", label: "卡盒管理", icon: <Package className="w-4 h-4" /> },
      { id: "trending", label: "熱門卡牌", icon: <TrendingUp className="w-4 h-4" /> },
      { id: "blog", label: "博客管理", icon: <FileText className="w-4 h-4" /> },
      { id: "quick-publish", label: "AI 出文章", icon: <Wand2 className="w-4 h-4" /> },
      { id: "content-workflow", label: "AI 工作流", icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  {
    id: "system",
    label: "系統運維",
    icon: <Wrench className="w-[17px] h-[17px]" />,
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
    icon: <BookOpen className="w-[17px] h-[17px]" />,
    tabs: [
      { id: "company-inventory", label: "公司買取賣出", icon: <Building2 className="w-4 h-4" /> },
      { id: "card-inventory", label: "個人買賣紀錄", icon: <User className="w-4 h-4" /> },
      { id: "vip-subscriptions", label: "VIP 訂閱", icon: <Crown className="w-4 h-4" /> },
    ],
  },
  {
    id: "settings",
    label: "設定",
    icon: <Settings className="w-[17px] h-[17px]" />,
    tabs: [
      { id: "sfstations", label: "順豐站管理", icon: <MapPin className="w-4 h-4" /> },
      { id: "platformsettings", label: "平台設定", icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

const TAB_TO_SECTION: Record<string, string> = {};
SECTIONS.forEach(s => s.tabs.forEach(t => { TAB_TO_SECTION[t.id] = s.id; }));

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

/* ─── Tab Content Renderer ───────────────────────────────────────────────── */
function TabContent({ tabId }: { tabId: string }) {
  switch (tabId) {
    case "dashboard": return <AdminDashboard />;
    case "users": return <AdminUserManagement />;
    case "datasources": return <AdminDataSources />;
    case "sealed-products": return <AdminSealedProducts />;
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
    case "company-inventory": return <AdminCompanyCardInventory />;
    case "vip-subscriptions": return <AdminVipDashboard />;
    default: return <AdminDashboard />;
  }
}

/* ─── Section Tab Bar ────────────────────────────────────────────────────── */
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

  if (section.tabs.length <= 1) return null;

  return (
    <div className="relative shrink-0 adm-tab-bar">
      <div
        ref={tabBarRef}
        className="flex overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {section.tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={cn("adm-tab", isActive && "active")}
            >
              <span className="shrink-0">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>
      {showFade && (
        <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent sm:hidden" />
      )}
    </div>
  );
}

/* ─── Sidebar Navigation ─────────────────────────────────────────────────── */
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
    <div className="flex flex-col h-full adm-sidebar">
      {/* Sidebar Header */}
      <div className={cn(
        "adm-sidebar-header shrink-0",
        !showLabels ? "justify-center" : "justify-between"
      )}>
        {showLabels && (
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Brand mark */}
            <div className="w-7 h-7 rounded-lg bg-[#06038D] flex items-center justify-center shrink-0">
              <span className="text-[#FEDD00] font-black text-[11px] leading-none">B</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[14px] font-bold text-[#0F172A] truncate tracking-tight leading-tight">
                BOXIUM
              </h1>
              <p className="text-[10px] text-[#94A3B8] font-medium tracking-wide">管理後台</p>
            </div>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
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
                "adm-nav-item",
                !showLabels ? "justify-center px-0 py-2.5" : "",
                isActive && "active"
              )}
            >
              <span className={cn("adm-nav-icon", isActive && "text-[#2563EB]")}>
                {section.icon}
              </span>
              {showLabels && (
                <>
                  <span className="flex-1 truncate text-left">{section.label}</span>
                  {section.tabs.length > 1 && (
                    <span className={cn("adm-nav-badge", isActive && "bg-[#BFDBFE] text-[#1D4ED8]")}>
                      {section.tabs.length}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-[#E2E8F0] p-2.5 shrink-0">
        <button
          onClick={onMarketplace}
          title={!showLabels ? "商場管理" : undefined}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg py-2.5 transition-all duration-150 text-[13px] font-medium",
            "text-[#06038D] hover:bg-[#EFF6FF] border border-[#BFDBFE] hover:border-[#2563EB]",
            !showLabels ? "justify-center px-0" : "px-3"
          )}
        >
          <ShoppingCart className="w-[17px] h-[17px] shrink-0" />
          {showLabels && <span className="truncate">商場管理</span>}
        </button>
      </div>
    </div>
  );
}

/* ─── Global Search Bar ──────────────────────────────────────────────────── */
function GlobalSearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.altKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 px-3 h-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] text-[13px] hover:border-[#CBD5E1] hover:bg-white transition-all min-w-[200px] max-w-[280px]"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">搜尋...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#E2E8F0] text-[10px] font-mono text-[#64748B]">
          ⌥K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-lg mx-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0]">
              <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜尋功能、頁面..."
                className="flex-1 text-[14px] text-[#0F172A] bg-transparent outline-none placeholder:text-[#94A3B8]"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[11px] font-mono text-[#64748B]">Esc</kbd>
            </div>
            <div className="py-2 px-2 max-h-[320px] overflow-y-auto">
              {SECTIONS.map(section => (
                <div key={section.id}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    {section.label}
                  </div>
                  {section.tabs
                    .filter(t => !query || t.label.includes(query))
                    .map(tab => (
                      <button
                        key={tab.id}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                        onClick={() => setOpen(false)}
                      >
                        <span className="text-[#64748B]">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main Admin Page ────────────────────────────────────────────────────── */
export default function Admin() {
  const [, navigate] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  const [activeSection, setActiveSection] = useState<SectionId>(getStoredSection);
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    SECTIONS.forEach(s => { result[s.id] = getStoredTab(s.id); });
    return result;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_SECTION, activeSection); } catch { /* ignore */ }
  }, [activeSection]);

  useEffect(() => {
    SECTIONS.forEach(s => {
      try { localStorage.setItem(`${STORAGE_KEY_TAB}_${s.id}`, activeTabs[s.id] ?? SECTION_DEFAULT_TAB[s.id]); } catch { /* ignore */ }
    });
  }, [activeTabs]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COLLAPSED, String(sidebarCollapsed)); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileMenuOpen(false); };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

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

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const currentSection = SECTIONS.find(s => s.id === activeSection) ?? SECTIONS[0];
  const currentTabId = activeTabs[activeSection] ?? SECTION_DEFAULT_TAB[activeSection];
  const currentTabLabel = currentSection.tabs.find(t => t.id === currentTabId)?.label ?? "";

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      {/* ─── Desktop Sidebar ─────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 transition-all duration-300 ease-in-out",
          sidebarCollapsed ? "w-[64px]" : "w-[220px]"
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
          className="fixed inset-0 z-40 bg-[#0F172A]/30 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[240px] transition-transform duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors z-10"
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
        {/* ── Top Header ── */}
        <header className="adm-header shrink-0 z-30">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors md:hidden shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb */}
          <div className="adm-breadcrumb min-w-0 flex-1">
            <span className="text-[#94A3B8] shrink-0">{currentSection.icon}</span>
            <span className="text-[#64748B] font-medium shrink-0">{currentSection.label}</span>
            {currentSection.tabs.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
                <span className="adm-breadcrumb-active truncate">{currentTabLabel}</span>
              </>
            )}
          </div>

          {/* Global Search */}
          <GlobalSearchBar />

          {/* Notification Bell */}
          <button className="relative p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0">
            <Bell className="w-4.5 h-4.5" />
          </button>

          {/* Profile Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#06038D] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
              </div>
              <span className="hidden sm:block text-[13px] font-medium text-[#0F172A] max-w-[100px] truncate">
                {user?.name ?? "Admin"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 adm-dropdown-content w-48">
                  <div className="px-3 py-2 border-b border-[#E2E8F0] mb-1">
                    <p className="text-[12px] font-semibold text-[#0F172A] truncate">{user?.name}</p>
                    <p className="text-[11px] text-[#94A3B8] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { navigate("/"); setProfileOpen(false); }}
                    className="adm-dropdown-item w-full"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    前往前台
                  </button>
                  <div className="h-px bg-[#E2E8F0] my-1" />
                  <button
                    onClick={() => logoutMutation.mutate()}
                    className="adm-dropdown-item danger w-full"
                  >
                    <X className="w-3.5 h-3.5" />
                    登出
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* ── In-page Tab Bar ── */}
        <SectionTabBar
          section={currentSection}
          activeTab={currentTabId}
          onSelect={(tabId) => handleSelectTab(activeSection, tabId)}
        />

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="p-4 md:p-6 lg:p-8">
            <TabContent tabId={currentTabId} />
          </div>
        </div>
      </main>
    </div>
  );
}
