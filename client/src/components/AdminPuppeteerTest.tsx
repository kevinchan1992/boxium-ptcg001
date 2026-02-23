import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Play, CheckCircle, XCircle, AlertCircle, Activity, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AdminPuppeteerTest() {
  const [enabled, setEnabled] = useState(false);

  const { data: testResult, isLoading: testing, refetch, error } = trpc.diagnostics.testPuppeteer.useQuery(
    undefined,
    { enabled }
  );

  const installMutation = trpc.diagnostics.installPuppeteer.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Puppeteer 安裝成功", {
          description: `安裝完成，耗時 ${Math.round(result.duration / 1000)}秒`,
        });
        // 安裝成功後自動重新測試
        setTimeout(() => {
          setEnabled(true);
          refetch();
        }, 1000);
      } else {
        toast.error("Puppeteer 安裝失敗", {
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

  const diagnoseMutation = trpc.diagnostics.diagnosePuppeteerInstallation.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("診斷完成", {
          description: "所有檢查通過，查看詳細結果",
        });
      } else {
        toast.error("診斷發現問題", {
          description: "查看建議解決方案",
        });
      }
    },
    onError: (error) => {
      toast.error("診斷失敗", {
        description: error.message,
      });
    },
  });

  const installFromCDNMutation = trpc.diagnostics.installPuppeteerFromCDN.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Puppeteer 安裝成功", {
          description: `安裝完成，耗時 ${Math.round(result.duration / 1000)}秒`,
        });
        // 安裝成功後自動重新測試
        setTimeout(() => {
          setEnabled(true);
          refetch();
        }, 1000);
      } else {
        toast.error("Puppeteer 安裝失敗", {
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
        toast.success("Puppeteer 測試成功", {
          description: `瀏覽器啟動成功，耗時 ${testResult.duration}ms`,
        });
      } else {
        toast.error("Puppeteer 測試失敗", {
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

  const testPuppeteer = () => {
    setEnabled(true);
    refetch();
  };

  const installPuppeteer = () => {
    if (confirm("確定要安裝 Puppeteer 瀏覽器嗎？\n\n這將下載約 280MB 的檔案，需要 2-3 分鐘。\n安裝過程中請勿關閉頁面。")) {
      installMutation.mutate();
    }
  };

  const installFromCDN = () => {
    if (confirm("確定要從 CDN 安裝 Puppeteer 瀏覽器嗎？\n\n這將從 Manus CDN 下載預打包的瀏覽器檔案（257MB），\n繞過外部網絡限制，需要 2-3 分鐘。\n安裝過程中請勿關閉頁面。")) {
      installFromCDNMutation.mutate();
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
          <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
          Puppeteer 狀態測試
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          測試生產環境的 Puppeteer 瀏覽器是否正常運行
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <BrandButton
              onClick={testPuppeteer}
              disabled={testing || installMutation.isPending || installFromCDNMutation.isPending || diagnoseMutation.isPending}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              {testing ? "測試中..." : "開始測試"}
            </BrandButton>

            <Button
              onClick={() => diagnoseMutation.mutate()}
              disabled={testing || installMutation.isPending || installFromCDNMutation.isPending || diagnoseMutation.isPending}
              variant="outline"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
            >
              {diagnoseMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Activity className="w-4 h-4 mr-2" />
              )}
              {diagnoseMutation.isPending ? "診斷中..." : "環境診斷"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={installFromCDN}
              disabled={testing || installMutation.isPending || installFromCDNMutation.isPending || diagnoseMutation.isPending}
              variant="outline"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-700"
            >
              {installFromCDNMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {installFromCDNMutation.isPending ? "安裝中..." : "從 CDN 安裝（推薦）"}
            </Button>

            <Button
              onClick={installPuppeteer}
              disabled={testing || installMutation.isPending || installFromCDNMutation.isPending || diagnoseMutation.isPending}
              variant="outline"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white border-amber-600"
            >
              {installMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {installMutation.isPending ? "安裝中..." : "直接安裝"}
            </Button>
          </div>
        </div>

        {/* 診斷結果 */}
        {diagnoseMutation.data && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              {diagnoseMutation.data.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {diagnoseMutation.data.success ? "✅ 診斷完成" : "❌ 發現問題"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {diagnoseMutation.data.checks.length} 個檢查項目
                </p>
              </div>
            </div>

            {/* 建議 */}
            {diagnoseMutation.data.recommendations && diagnoseMutation.data.recommendations.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-700">建議解決方案</p>
                    <ul className="text-xs text-amber-600 mt-1 space-y-1">
                      {diagnoseMutation.data.recommendations.map((rec: string, index: number) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 檢查結果 */}
            {diagnoseMutation.data.checks && diagnoseMutation.data.checks.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  查看詳細檢查結果 ({diagnoseMutation.data.checks.length} 個項目)
                </summary>
                <div className="mt-2 space-y-2">
                  {diagnoseMutation.data.checks.map((check: any, index: number) => (
                    <div key={index} className="p-2 rounded bg-muted">
                      <div className="flex items-center gap-2">
                        {check.status === "success" && <CheckCircle className="w-3 h-3 text-green-500" />}
                        {check.status === "error" && <XCircle className="w-3 h-3 text-red-500" />}
                        {check.status === "warning" && <AlertCircle className="w-3 h-3 text-amber-500" />}
                        {check.status === "info" && <Activity className="w-3 h-3 text-blue-500" />}
                        <span className="text-xs font-medium">{check.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                        {typeof check.details === "string" ? check.details : JSON.stringify(check.details, null, 2)}
                      </div>
                      {check.stdout && (
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          <strong>stdout:</strong> {check.stdout}
                        </div>
                      )}
                      {check.stderr && (
                        <div className="mt-1 text-xs text-red-600 font-mono">
                          <strong>stderr:</strong> {check.stderr}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* CDN 安裝結果 */}
        {installFromCDNMutation.data && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              {installFromCDNMutation.data.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {installFromCDNMutation.data.success ? "✅ CDN 安裝成功" : "❌ CDN 安裝失敗"}
                </p>
                <p className="text-xs text-muted-foreground">
                  耗時: {Math.round(installFromCDNMutation.data.duration / 1000)}秒
                </p>
              </div>
            </div>

            {/* CDN 安裝錯誤信息 */}
            {installFromCDNMutation.data.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">錯誤信息</p>
                    <p className="text-xs text-red-600 mt-1 font-mono">
                      {installFromCDNMutation.data.error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CDN 安裝日誌 */}
            {installFromCDNMutation.data.logs && installFromCDNMutation.data.logs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  查看 CDN 安裝日誌 ({installFromCDNMutation.data.logs.length} 條)
                </summary>
                <div className="mt-2 p-3 rounded-lg bg-muted font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {installFromCDNMutation.data.logs.map((log: string, index: number) => (
                    <div key={index} className="text-xs">
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

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
