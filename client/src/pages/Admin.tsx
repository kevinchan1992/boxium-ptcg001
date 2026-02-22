import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Database, TrendingUp, FileText, HardDrive, Clock } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";

import { AdminDataSources } from "@/components/AdminDataSources";
import { AdminTrendingCards } from "@/components/AdminTrendingCards";
import { AdminBlogManagement } from "@/components/AdminBlogManagement";
import { AdminCacheManagement } from "@/components/AdminCacheManagement";
import { AdminScheduleManagement } from "@/components/AdminScheduleManagement";

import { useTranslation } from "react-i18next";

export default function Admin() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-black py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">{t("admin.title")}</h1>
            <p className="text-sm sm:text-base text-gray-300">{t("admin.statistics")}</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">{t("admin.statistics")}</span>
              </TabsTrigger>
            <TabsTrigger value="datasources" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              {t("admin.dataSources")}
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">熱門卡牌</span>
            </TabsTrigger>
            <TabsTrigger value="blog" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">博客管理</span>
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              <span className="hidden sm:inline">緩存管理</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">排程管理</span>
            </TabsTrigger>
          </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <AdminDashboard />
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
          </Tabs>
        </div>
    </div>
  );
}
