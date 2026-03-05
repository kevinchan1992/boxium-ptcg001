import { LayoutDashboard, Users, Database, TrendingUp, FileText, HardDrive, Clock, Activity, History } from "lucide-react";
import { BrandTabs, BrandTabsList, BrandTabsTrigger, BrandTabsContent } from "@/components/BrandTabs";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminDataSources } from "@/components/AdminDataSources";
import { AdminTrendingCards } from "@/components/AdminTrendingCards";
import { AdminBlogManagement } from "@/components/AdminBlogManagement";
import { AdminCacheManagement } from "@/components/AdminCacheManagement";
import { AdminScheduleManagement } from "@/components/AdminScheduleManagement";
import { AdminScraperPerformance } from "@/components/AdminScraperPerformance";
import { AdminTaskHistory } from "@/components/AdminTaskHistory";

import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Admin() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-[#0a0a1a] py-4 sm:py-6 md:py-8 px-4 md:px-6 lg:px-8 xl:px-12">
      <div className="max-w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1280px] 2xl:max-w-[1400px] mx-auto space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full" style={{ background: "#FFD700" }} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{t("admin.title")}</h1>
            <p className="text-sm text-gray-400">{t("admin.statistics")}</p>
          </div>
        </div>

        {/* Brand Tabs */}
        <BrandTabs defaultValue="dashboard" variant="dark">
          <BrandTabsList wrap className="mb-2">
            <BrandTabsTrigger value="dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label={t("admin.statistics")}>{t("admin.statistics")}</BrandTabsTrigger>
            <BrandTabsTrigger value="users" icon={<Users className="w-4 h-4" />} label="帳號管理">帳號管理</BrandTabsTrigger>
            <BrandTabsTrigger value="datasources" icon={<Database className="w-4 h-4" />} label={t("admin.dataSources")}>{t("admin.dataSources")}</BrandTabsTrigger>
            <BrandTabsTrigger value="trending" icon={<TrendingUp className="w-4 h-4" />} label="熱門卡牌">熱門卡牌</BrandTabsTrigger>
            <BrandTabsTrigger value="blog" icon={<FileText className="w-4 h-4" />} label="博客管理">博客管理</BrandTabsTrigger>
            <BrandTabsTrigger value="cache" icon={<HardDrive className="w-4 h-4" />} label="緩存管理">緩存管理</BrandTabsTrigger>
            <BrandTabsTrigger value="schedule" icon={<Clock className="w-4 h-4" />} label="排程管理">排程管理</BrandTabsTrigger>
            <BrandTabsTrigger value="performance" icon={<Activity className="w-4 h-4" />} label="性能監控">性能監控</BrandTabsTrigger>
            <BrandTabsTrigger value="taskhistory" icon={<History className="w-4 h-4" />} label="任務歷史">任務歷史</BrandTabsTrigger>
          </BrandTabsList>

          <BrandTabsContent value="dashboard"><AdminDashboard /></BrandTabsContent>
          <BrandTabsContent value="users"><AdminUserManagement /></BrandTabsContent>
          <BrandTabsContent value="datasources"><AdminDataSources /></BrandTabsContent>
          <BrandTabsContent value="trending"><AdminTrendingCards /></BrandTabsContent>
          <BrandTabsContent value="blog"><AdminBlogManagement /></BrandTabsContent>
          <BrandTabsContent value="cache"><AdminCacheManagement /></BrandTabsContent>
          <BrandTabsContent value="schedule"><AdminScheduleManagement /></BrandTabsContent>
          <BrandTabsContent value="performance"><AdminScraperPerformance /></BrandTabsContent>
          <BrandTabsContent value="taskhistory"><AdminTaskHistory /></BrandTabsContent>
        </BrandTabs>

        {/* Marketplace shortcut */}
        <div className="border-t border-white/10 pt-6">
          <h3 className="text-base font-semibold text-white mb-3">商場管理</h3>
          <Link href="/admin/marketplace">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#06038d] text-white rounded-lg hover:bg-[#0804b8] transition-colors text-sm font-medium border border-[#FFD700]/30">
              🛒 進入商場管理後台
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
