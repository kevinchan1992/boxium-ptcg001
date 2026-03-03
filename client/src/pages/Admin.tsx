import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Database, TrendingUp, FileText, HardDrive, Clock, Activity, History } from "lucide-react";
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
    <div className="min-h-screen bg-black py-4 sm:py-6 md:py-8 px-4 md:px-6 lg:px-8 xl:px-12">
        <div className="max-w-full sm:max-w-[640px] md:max-w-[768px] lg:max-w-[1024px] xl:max-w-[1280px] 2xl:max-w-[1400px] mx-auto space-y-4 sm:space-y-6 md:space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1 sm:mb-2">{t("admin.title")}</h1>
            <p className="text-sm sm:text-base lg:text-lg text-gray-300">{t("admin.statistics")}</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-4 md:grid-cols-8 lg:flex lg:flex-wrap lg:w-auto lg:gap-2 overflow-x-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
                <LayoutDashboard className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">{t("admin.statistics")}</span>
              </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <Users className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">帳號管理</span>
            </TabsTrigger>
            <TabsTrigger value="datasources" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <Database className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">{t("admin.dataSources")}</span>
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">熱門卡牌</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <FileText className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">博客管理</span>
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <HardDrive className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">緩存管理</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <Clock className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">排程管理</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <Activity className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">性能監控</span>
            </TabsTrigger>
            <TabsTrigger value="taskhistory" className="flex items-center gap-1 lg:gap-2 text-xs lg:text-base lg:px-4 lg:py-2.5">
              <History className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">任務歷史</span>
            </TabsTrigger>
          </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <AdminDashboard />
            </TabsContent>

            <TabsContent value="users" className="mt-6">
              <AdminUserManagement />
            </TabsContent>

            <TabsContent value="datasources" className="mt-6">
              <AdminDataSources />
            </TabsContent>

            <TabsContent value="trending" className="mt-6">
              <AdminTrendingCards />
            </TabsContent>

            <TabsContent value="blog" className="mt-6">
              <AdminBlogManagement />
            </TabsContent>

            <TabsContent value="cache" className="mt-6">
              <AdminCacheManagement />
            </TabsContent>

            <TabsContent value="schedule" className="mt-6">
              <AdminScheduleManagement />
            </TabsContent>

            <TabsContent value="performance" className="mt-6">
              <AdminScraperPerformance />
            </TabsContent>

            <TabsContent value="taskhistory" className="mt-6">
              <AdminTaskHistory />
            </TabsContent>
          </Tabs>
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold mb-3">商場管理</h3>
            <Link href="/admin/marketplace">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-[#06038d] text-white rounded-lg hover:bg-[#0804b8] transition-colors text-sm font-medium">
                🛒 進入商場管理後台
              </button>
            </Link>
          </div>
        </div>
    </div>
  );
}
