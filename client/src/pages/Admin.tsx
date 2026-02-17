import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Database, TrendingUp } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminDataSources } from "@/components/AdminDataSources";
import { AdminTrendingCards } from "@/components/AdminTrendingCards";

import { useTranslation } from "react-i18next";

export default function Admin() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-black py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{t("admin.title")}</h1>
            <p className="text-gray-300">{t("admin.statistics")}</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">{t("admin.statistics")}</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{t("admin.title")}</span>
              </TabsTrigger>
            <TabsTrigger value="datasources" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              {t("admin.dataSources")}
            </TabsTrigger>
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">熱門卡牌</span>
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
          </Tabs>
        </div>
    </div>
  );
}
