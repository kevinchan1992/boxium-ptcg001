import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandButton } from "@/components/ui/brand-button";
import { Play, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AdminPuppeteerTest() {
  const [enabled, setEnabled] = useState(false);

  const { data: testResult, isLoading: testing, refetch, error } = trpc.diagnostics.testPuppeteer.useQuery(
    undefined,
    { enabled }
  );

  const { data: metrics, isLoading: loadingMetrics, refetch: refetchMetrics } = trpc.diagnostics.getPuppeteerMetrics.useQuery();
  const { data: performance, isLoading: loadingPerformance, refetch: refetchPerformance } = trpc.diagnostics.getScraperPerformance.useQuery();

  const handleTest = () => {
    setEnabled(true);
    refetch();
  };

  const handleRefreshMetrics = () => {
    refetchMetrics();
    refetchPerformance();
    toast.success("性能數據已刷新");
  };

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

  const getStatusIcon = () => {
    if (testing) return <Activity className="h-5 w-5 animate-spin" />;
    if (!testResult) return <AlertCircle className="h-5 w-5 text-gray-400" />;
    if (testResult.success) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusText = () => {
    if (testing) return "測試中...";
    if (!testResult) return "未測試";
    if (testResult.success) return "✅ 測試成功";
    return "❌ 測試失敗";
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Puppeteer 狀態測試
              </CardTitle>
              <CardDescription>測試生產環境的 Puppeteer 瀏覽器是否正常運行</CardDescription>
            </div>
            {getStatusIcon()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">狀態</p>
              <p className="text-2xl font-bold">{getStatusText()}</p>
              {testResult && (
                <p className="text-sm text-muted-foreground mt-1">
                  耗時: {testResult.duration}ms
                </p>
              )}
            </div>
          </div>

          <BrandButton
            onClick={handleTest}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Activity className="mr-2 h-4 w-4 animate-spin" />
                測試中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                開始測試
              </>
            )}
          </BrandButton>

          {testResult && testResult.logs && (
            <div className="space-y-2">
              <p className="text-sm font-medium">測試日誌</p>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                {testResult.logs.map((log: string, i: number) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {testResult && !testResult.success && testResult.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-2">錯誤信息</p>
              <p className="text-sm text-red-600 font-mono">{testResult.error}</p>
              {testResult.stack && (
                <details className="mt-2">
                  <summary className="text-sm text-red-600 cursor-pointer">查看堆棧追蹤</summary>
                  <pre className="text-xs text-red-600 mt-2 overflow-x-auto">{testResult.stack}</pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                性能監控
              </CardTitle>
              <CardDescription>監控 Puppeteer 瀏覽器的內存使用和爬蟲性能</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshMetrics}
              disabled={loadingMetrics || loadingPerformance}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loadingMetrics || loadingPerformance) ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Browser Metrics */}
          {metrics && metrics.success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">瀏覽器狀態</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics.metrics.browserConnected ? (
                    <span className="text-green-600">✅ 已連接</span>
                  ) : (
                    <span className="text-red-600">❌ 未連接</span>
                  )}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">進程 ID</p>
                <p className="text-2xl font-bold mt-1">
                  {metrics.metrics.processInfo.pid || "N/A"}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">內存使用 (RSS)</p>
                <p className="text-2xl font-bold mt-1">
                  {formatBytes(metrics.metrics.processInfo.memoryUsage.rss)}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">堆內存 (Heap)</p>
                <p className="text-2xl font-bold mt-1">
                  {formatBytes(metrics.metrics.processInfo.memoryUsage.heapUsed)} / {formatBytes(metrics.metrics.processInfo.memoryUsage.heapTotal)}
                </p>
              </div>
            </div>
          )}

          {/* Scraper Performance */}
          {performance && performance.success && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">平均響應時間</p>
                <p className="text-2xl font-bold mt-1">
                  {performance.stats.averageResponseTime > 0 
                    ? `${performance.stats.averageResponseTime}ms` 
                    : "N/A"}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold mt-1">
                  {performance.stats.totalRequests > 0
                    ? `${performance.stats.successRate.toFixed(1)}%`
                    : "N/A"}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">總請求數</p>
                <p className="text-2xl font-bold mt-1">
                  {performance.stats.totalRequests}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">失敗請求數</p>
                <p className="text-2xl font-bold mt-1">
                  {performance.stats.failedRequests}
                </p>
              </div>
            </div>
          )}

          {metrics && !metrics.success && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">無法獲取性能數據</p>
              <p className="text-sm text-red-600 mt-1">{metrics.error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
