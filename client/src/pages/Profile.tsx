import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("已登出");
    window.location.href = '/';
  };
  
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </MainLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center px-8">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-foreground">用戶中心</h1>
            <p className="text-lg text-muted-foreground">
              請先登入以查看您的個人資料
            </p>
            <Button
              onClick={() => setLocation("/login")}
              variant="default"
            >
              登入
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl font-bold text-foreground mb-8">用戶中心</h1>

          {/* User Info Card */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              個人資料
            </h2>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="text-muted-foreground w-32">用戶名稱:</dt>
                <dd className="text-foreground">{user?.user_metadata?.name || user?.email?.split('@')[0] || "未設定"}</dd>
              </div>
              <div className="flex">
                <dt className="text-muted-foreground w-32">電子郵件:</dt>
                <dd className="text-foreground">{user?.email || "未設定"}</dd>
              </div>
              <div className="flex">
                <dt className="text-muted-foreground w-32">登入方式:</dt>
                <dd className="text-foreground">{user?.app_metadata?.provider || "未知"}</dd>
              </div>
              <div className="flex">
                <dt className="text-muted-foreground w-32">角色:</dt>
                <dd className="text-foreground">
                  {user?.role === "admin" ? "管理員" : "一般用戶"}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              快速操作
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => toast.info("功能開發中,敬請期待!")}
                variant="outline"
                className="h-20"
              >
                我的收藏
              </Button>
              <Button
                onClick={() => toast.info("功能開發中,敬請期待!")}
                variant="outline"
                className="h-20"
              >
                我的拍賣
              </Button>
              <Button
                onClick={() => toast.info("功能開發中,敬請期待!")}
                variant="outline"
                className="h-20"
              >
                我的報價
              </Button>
              <Button
                onClick={() => toast.info("功能開發中,敬請期待!")}
                variant="outline"
                className="h-20"
              >
                交易歷史
              </Button>
            </div>
          </Card>

          {/* Logout Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleLogout}
              className="w-full"
              variant="destructive"
            >
              登出
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
