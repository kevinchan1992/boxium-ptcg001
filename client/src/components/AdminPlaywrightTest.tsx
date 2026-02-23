import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Play, CheckCircle, XCircle, AlertCircle, Activity, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AdminPlaywrightTest() {
  const [enabled, setEnabled] = useState(false);

  const { data: testResult, isLoading: testing, refetch, error } = trpc.diagnostics.testPlaywright.useQuery(
    undefined,
    { enabled }
  );

  const installMutation = trpc.diagnostics.installPlaywright.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Playwright 安裝成功", {
          description: `安裝完成，耗時 ${Math.round(result.duration / 1000)}秒`,
        });
        // 安裝成功後自動重新測試
        setTimeout(() => {
          setEnabled(true);
          refetch();
        }, 1000);
      } else {
        toast.error("Playwright 安裝失敗", {
          description: result.error || "未知錯誤",
        });
      }
    },
    onError: (error) => {
      toast.error("安裝失敗", {
        description: error.message,
      });
    },
  });

  // Handle test results
  useState(() => {
    if (testResult && enabled) {
      if (testResult.success) {
        toast.success("Playwright 測試成功", {
          description: `瀏覽器啟動成功，耗時 ${testResult.duration}ms`,
        });
      } else {
        toast.error("Playwright 測試失敗", {
          description: testResult.error || "未知錯誤",
        });
      }
    }
    if (error && enabled) {
      toast.error("測試失敗", {
        description: (error as any).message,
      });
    }
  });

  const testPlaywright = () => {
    setEnabled(true);
    refetch();
  };

  const installPlaywright = () => {
    if (confirm("確定要安裝 Playwright 瀏覽器嗎？\n\n這將下載約 280MB 的文件，需要 2-3 分鐘。\n安裝過程中請勿關閉頁面。")) {
      installMutation.mutate();
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
          Playwright 狀態測試
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          測試生產環境的 Playwright 瀏覽器是否正常運行
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <BrandButton
            onClick={testPlaywright}
            disabled={testing || installMutation.isPending}
            className="flex-1"
          >
            <Play className="w-4 h-4 mr-2" />
            {testing ? "測試中..." : "開始測試"}
          </BrandButton>

          <Button
            onClick={installPlaywright}
            disabled={testing || installMutation.isPending}
            variant="outline"
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
          >
            {installMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {installMutation.isPending ? "安裝中..." : "安裝 Playwright"}
          </Button>
        </div>

        {/* 安裝結果 */}
        {installMutation.data && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              {installMutation.data.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {installMutation.data.success ? "✅ 安裝成功" : "❌ 安裝失敗"}
                </p>
                <p className="text-xs text-muted-foreground">
                  耗時: {Math.round(installMutation.data.duration / 1000)}秒
                </p>
              </div>
            </div>

            {/* 安裝錯誤信息 */}
            {installMutation.data.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">錯誤信息</p>
                    <p className="text-xs text-red-600 mt-1 font-mono">
                      {installMutation.data.error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 安裝日誌 */}
            {installMutation.data.logs && installMutation.data.logs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  查看安裝日誌 ({installMutation.data.logs.length} 條)
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-muted font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {installMutation.data.logs.map((log: string, index: number) => (
                    <div key={index} className="text-xs">
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 測試結果 */}
        {testResult && (
          <div className="space-y-3">
            {/* 測試結果摘要 */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {testResult.success ? "✅ 測試成功" : "❌ 測試失敗"}
                </p>
                <p className="text-xs text-muted-foreground">
                  耗時: {testResult.duration}ms
                </p>
              </div>
            </div>

            {/* 詳細狀態 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {testResult.browserLaunched ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span>瀏覽器啟動</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {testResult.pageLoaded ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span>頁面創建</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                {testResult.snkrdunkAccessible ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span>SNKRDUNK 網站訪問</span>
              </div>
            </div>

            {/* 測試錯誤信息 */}
            {testResult.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">錯誤信息</p>
                    <p className="text-xs text-red-600 mt-1 font-mono">
                      {testResult.error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 測試詳細日誌 */}
            {testResult.logs && testResult.logs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  查看測試日誌 ({testResult.logs.length} 條)
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-muted font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {testResult.logs.map((log: string, index: number) => (
                    <div key={index} className="text-xs">
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
