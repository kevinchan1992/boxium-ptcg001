import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function SessionDebug() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [storageTest, setStorageTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkSession = async () => {
    setLoading(true);
    
    // 檢查 Supabase session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // 檢查 localStorage 可用性
    const storageAvailable = {
      localStorage: false,
      sessionStorage: false,
      cookies: false,
    };

    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      storageAvailable.localStorage = true;
    } catch (e) {
      console.error('localStorage not available:', e);
    }

    try {
      const testKey = '__storage_test__';
      window.sessionStorage.setItem(testKey, 'test');
      window.sessionStorage.removeItem(testKey);
      storageAvailable.sessionStorage = true;
    } catch (e) {
      console.error('sessionStorage not available:', e);
    }

    try {
      document.cookie = '__cookie_test__=test; path=/';
      storageAvailable.cookies = document.cookie.includes('__cookie_test__');
      document.cookie = '__cookie_test__=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    } catch (e) {
      console.error('Cookies not available:', e);
    }

    // 檢查 Supabase storage keys
    const supabaseKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          supabaseKeys.push(key);
        }
      }
    } catch (e) {
      console.error('Cannot read localStorage keys:', e);
    }

    setSessionInfo({
      hasSession: !!session,
      user: session?.user,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      error: error?.message,
    });

    setStorageTest({
      available: storageAvailable,
      supabaseKeys,
      browser: navigator.userAgent,
    });

    setLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  const StatusIcon = ({ available }: { available: boolean }) => {
    return available ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  return (
    <MainLayout>
      <div className="min-h-screen py-8 px-4 md:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">Session 診斷</h1>
              <p className="text-muted-foreground">檢查認證狀態和瀏覽器存儲可用性</p>
            </div>
            <Button onClick={checkSession} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              重新檢查
            </Button>
          </div>

          {/* Session 狀態 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {sessionInfo?.hasSession ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                Supabase Session 狀態
              </CardTitle>
              <CardDescription>
                {sessionInfo?.hasSession ? '已登入' : '未登入'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionInfo?.hasSession ? (
                <>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">用戶 Email</div>
                    <div className="text-lg">{sessionInfo.user?.email}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">用戶 ID</div>
                    <div className="text-sm font-mono">{sessionInfo.user?.id}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Session 過期時間</div>
                    <div className="text-sm">{sessionInfo.expiresAt}</div>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">
                  {sessionInfo?.error ? (
                    <div className="text-red-500">錯誤：{sessionInfo.error}</div>
                  ) : (
                    <div>沒有找到有效的 session</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 存儲可用性 */}
          <Card>
            <CardHeader>
              <CardTitle>瀏覽器存儲可用性</CardTitle>
              <CardDescription>檢查瀏覽器是否允許存儲數據</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">localStorage</div>
                  <div className="text-sm text-muted-foreground">
                    用於持久化 session
                  </div>
                </div>
                <StatusIcon available={storageTest?.available?.localStorage} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">sessionStorage</div>
                  <div className="text-sm text-muted-foreground">
                    備用存儲方案
                  </div>
                </div>
                <StatusIcon available={storageTest?.available?.sessionStorage} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Cookies</div>
                  <div className="text-sm text-muted-foreground">
                    用於跨域認證
                  </div>
                </div>
                <StatusIcon available={storageTest?.available?.cookies} />
              </div>
            </CardContent>
          </Card>

          {/* Supabase Storage Keys */}
          <Card>
            <CardHeader>
              <CardTitle>Supabase Storage Keys</CardTitle>
              <CardDescription>
                localStorage 中的 Supabase 相關數據
              </CardDescription>
            </CardHeader>
            <CardContent>
              {storageTest?.supabaseKeys?.length > 0 ? (
                <div className="space-y-2">
                  {storageTest.supabaseKeys.map((key: string) => (
                    <div key={key} className="text-sm font-mono bg-muted p-2 rounded">
                      {key}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">沒有找到 Supabase storage keys</div>
              )}
            </CardContent>
          </Card>

          {/* 瀏覽器信息 */}
          <Card>
            <CardHeader>
              <CardTitle>瀏覽器信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono break-all text-muted-foreground">
                {storageTest?.browser}
              </div>
            </CardContent>
          </Card>

          {/* 建議 */}
          {!storageTest?.available?.localStorage && (
            <Card className="border-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  localStorage 不可用
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>您的瀏覽器阻擋了 localStorage，這會導致 session 無法持久化。</p>
                <p className="font-medium">可能的原因：</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>使用隱私模式或無痕模式</li>
                  <li>瀏覽器設置阻擋了第三方 cookies 和存儲</li>
                  <li>Safari 的「防止跨網站追蹤」功能</li>
                  <li>Firefox 的「增強型追蹤保護」功能</li>
                </ul>
                <p className="font-medium mt-4">解決方案：</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>使用正常瀏覽模式（非隱私/無痕模式）</li>
                  <li>在瀏覽器設置中允許此網站使用 cookies 和存儲</li>
                  <li>嘗試使用其他瀏覽器（Chrome、Edge）</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
