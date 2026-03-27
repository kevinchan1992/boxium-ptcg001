import { useState } from "react";
import {
  LayoutDashboard, Users, Database, TrendingUp, FileText, HardDrive,
  Clock, Activity, History, MapPin, Mail, FlaskConical, Settings,
  ShoppingCart, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft
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
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

/* ─── Navigation Groups ─────────────────────────────────────────────── */
interface NavItem {
  id: string;
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
    // Overview
    { id: "dashboard", label: t("admin.statistics"), icon: <LayoutDashboard className="w-[18px] h-[18px]" />, group: "overview" },
    { id: "users", label: "帳號管理", icon: <Users className="w-[18px] h-[18px]" />, group: "overview" },
    // Content
    { id: "datasources", label: t("admin.dataSources"), icon: <Database className="w-[18px] h-[18px]" />, group: "content" },
    { id: "trending", label: "熱門卡牌", icon: <TrendingUp className="w-[18px] h-[18px]" />, group: "content" },
    { id: "blog", label: "博客管理", icon: <FileText className="w-[18px] h-[18px]" />, group: "content" },
    // System
    { id: "cache", label: "緩存管理", icon: <HardDrive className="w-[18px] h-[18px]" />, group: "system" },
    { id: "schedule", label: "排程管理", icon: <Clock className="w-[18px] h-[18px]" />, group: "system" },
    { id: "performance", label: "性能監控", icon: <Activity className="w-[18px] h-[18px]" />, group: "system" },
    { id: "taskhistory", label: "任務歷史", icon: <History className="w-[18px] h-[18px]" />, group: "system" },
    // Communication
    { id: "emaillogs", label: "電郵日誌", icon: <Mail className="w-[18px] h-[18px]" />, group: "communication" },
    { id: "emailtest", label: "電郵測試", icon: <FlaskConical className="w-[18px] h-[18px]" />, group: "communication" },
    // Other
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
    case "cache": return <AdminCacheManagement />;
    case "schedule": return <AdminScheduleManagement />;
    case "performance": return <AdminScraperPerformance />;
    case "taskhistory": return <AdminTaskHistory />;
    case "sfstations": return <AdminSFStationUpdate />;
    case "emaillogs": return <AdminEmailLogs />;
    case "emailtest": return <AdminEmailTest />;
    case "platformsettings": return <AdminPlatformSettings />;
    default: return <AdminDashboard />;
  }
}

/* ─── Main Admin Page ────────────────────────────────────────────────── */
export default function Admin() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navItems = useNavItems();

  const activeItem = navItems.find(item => item.id === activeTab);

  return (
    <div className="flex h-screen overflow-hidden bg-[#060618]">
      {/* ─── Left Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col border-r border-white/[0.06] bg-[#0a0a1e] transition-all duration-300 ease-in-out shrink-0",
          sidebarCollapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          "flex items-center h-14 border-b border-white/[0.06] px-4 shrink-0",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-7 rounded-full bg-[#FEDD00] shrink-0" />
              <h1 className="text-[15px] font-semibold text-white truncate tracking-tight">
                {t("admin.title")}
              </h1>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors shrink-0"
            title={sidebarCollapsed ? "展開側邊欄" : "收合側邊欄"}
          >
            {sidebarCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const groupItems = navItems.filter(item => item.group === group.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.id} className="mb-1">
                {/* Group Label */}
                {!sidebarCollapsed && (
                  <div className="px-2.5 pt-3 pb-1.5 first:pt-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500/80">
                      {group.label}
                    </span>
                  </div>
                )}
                {sidebarCollapsed && group.id !== "overview" && (
                  <div className="mx-2.5 my-2 border-t border-white/[0.06]" />
                )}
                {/* Group Items */}
                {groupItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center gap-2.5 rounded-lg transition-all duration-150 group relative",
                        sidebarCollapsed ? "justify-center px-0 py-2.5 mx-auto" : "px-2.5 py-2",
                        isActive
                          ? "bg-[#06038d] text-white shadow-[0_1px_3px_rgba(6,3,141,0.4)]"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className={cn(
                          "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-[#FEDD00]",
                          sidebarCollapsed ? "h-5" : "h-5"
                        )} />
                      )}
                      <span className={cn(
                        "shrink-0 transition-colors",
                        isActive ? "text-[#FEDD00]" : "text-gray-500 group-hover:text-gray-300"
                      )}>
                        {item.icon}
                      </span>
                      {!sidebarCollapsed && (
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
            onClick={() => navigate("/admin/marketplace")}
            title={sidebarCollapsed ? "商場管理" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg py-2.5 transition-all duration-150",
              "text-[#FEDD00] hover:bg-[#FEDD00]/[0.08] border border-[#FEDD00]/20 hover:border-[#FEDD00]/40",
              sidebarCollapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <ShoppingCart className="w-[18px] h-[18px] shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-[13px] font-medium truncate">商場管理</span>
            )}
          </button>
        </div>
      </aside>

      {/* ─── Right Content Area ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="flex items-center h-14 border-b border-white/[0.06] bg-[#0a0a1e]/80 backdrop-blur-sm px-6 shrink-0">
          <div className="flex items-center gap-3">
            {activeItem && (
              <span className="text-gray-500">{activeItem.icon}</span>
            )}
            <h2 className="text-[15px] font-semibold text-white">
              {activeItem?.label ?? t("admin.statistics")}
            </h2>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            <AdminContent activeTab={activeTab} />
          </div>
        </div>
      </main>
    </div>
  );
}
