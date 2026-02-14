import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw } from "lucide-react";

export default function Debug() {
  const [cookies, setCookies] = useState<string>("");
  const { user, loading } = useAuth();

  useEffect(() => {
    setCookies(document.cookie);
  }, []);

  const handleClearCookies = () => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    setCookies("");
    window.location.reload();
  };

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-4 md:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">認證診斷</h1>
            <p className="text-muted-foreground">檢查當前的認證狀態和 Cookie</p>
          </div>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">用戶狀態</h2>
              {loading ? (
                <p className="text-muted-foreground">載入中...</p>
              ) : user ? (
                <div className="space-y-2">
                  <p><span className="font-medium">ID:</span> {user.id}</p>
                  <p><span className="font-medium">郵箱:</span> {user.email}</p>
                  <p className="text-green-600 font-medium">✓ 已登入（使用 Supabase Auth）</p>
                </div>
              ) : (
                <p className="text-red-600 font-medium">✗ 未登入</p>
              )}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Cookie 狀態</h2>
              {cookies ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-2">當前 Cookie:</p>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                    {cookies.split("; ").map((c, i) => (
                      <div key={i}>{c}</div>
                    ))}
                  </pre>
                </div>
              ) : (
                <p className="text-muted-foreground">沒有 Cookie</p>
              )}
              <Button
                onClick={handleClearCookies}
                variant="destructive"
                size="sm"
                className="mt-4"
              >
                清除所有 Cookie
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
