import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Database, Clock } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminUserManagement } from "@/components/AdminUserManagement";
import { AdminDataSources } from "@/components/AdminDataSources";
import { AdminSchedule } from "@/components/AdminSchedule";

export default function Admin() {
  return (
    <div className="min-h-screen py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">管理員後台</h1>
            <p className="text-muted-foreground">系統管理與數據監控中心</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">數據統計</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">用戶管理</span>
              </TabsTrigger>
            <TabsTrigger value="datasources" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              數據源管理
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              排程管理
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

            <TabsContent value="schedule" className="mt-6">
              <AdminSchedule />
            </TabsContent>
          </Tabs>
        </div>
    </div>
  );
}
