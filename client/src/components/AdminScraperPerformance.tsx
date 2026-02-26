import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminScraperPerformance() {
  const [source, setSource] = useState<"all" | "snkrdunk">("all");
  const [hours, setHours] = useState(24);

  const { data: performance, isLoading, refetch } = trpc.admin.getScraperPerformance.useQuery(
    { source, hours },
    { refetchInterval: 30000 } // Auto-refresh every 30 seconds
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">爬蟲性能監控</CardTitle>
          <CardDescription className="text-xs md:text-sm">載入中...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!performance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">爬蟲性能監控</CardTitle>
          <CardDescription className="text-xs md:text-sm">無法載入性能數據</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 5000) return "text-green-600";
    if (time <= 15000) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-base md:text-lg">爬蟲性能監控</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                實時監控爬蟲性能指標和錯誤日誌
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger className="w-[140px] text-xs md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有來源</SelectItem>
                  <SelectItem value="snkrdunk">SNKRDUNK</SelectItem>
                </SelectContent>
              </Select>

              <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                <SelectTrigger className="w-[120px] text-xs md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">過去 1 小時</SelectItem>
                  <SelectItem value="6">過去 6 小時</SelectItem>
                  <SelectItem value="24">過去 24 小時</SelectItem>
                  <SelectItem value="72">過去 3 天</SelectItem>
                  <SelectItem value="168">過去 7 天</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={() => refetch()}
                variant="outline"
                size="sm"
                className="text-xs md:text-sm"
              >
                <RefreshCw className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              總請求數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{performance.totalRequests}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span>{performance.successCount} 成功</span>
              <XCircle className="h-3 w-3 text-red-600" />
              <span>{performance.errorCount} 失敗</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${getSuccessRateColor(performance.successRate)}`}>
              {performance.successRate}%
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              {performance.successRate >= 90 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span>
                {performance.successRate >= 90 ? "表現良好" : "需要關注"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              平均響應時間
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl md:text-2xl font-bold ${getResponseTimeColor(performance.avgResponseTime)}`}>
              {(performance.avgResponseTime / 1000).toFixed(2)}s
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{performance.avgResponseTime}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
              處理項目數
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{performance.totalItemsProcessed}</div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span>{performance.timeoutCount} 超時</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">最近爬取記錄</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            顯示最近 10 次爬取操作
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {performance.recentLogs.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground text-center py-4">
                暫無記錄
              </p>
            ) : (
              performance.recentLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg border bg-card text-xs md:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === "success" ? "default" : "destructive"} className="text-xs">
                      {log.source.toUpperCase()}
                    </Badge>
                    <span className="text-muted-foreground">
                      {log.operationType === "batch" ? "批量" : "單個"}
                    </span>
                    {log.cardId && (
                      <span className="text-muted-foreground">
                        卡牌 ID: {log.cardId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">
                      {(log.responseTime / 1000).toFixed(2)}s
                    </span>
                    {log.itemsProcessed > 0 && (
                      <span className="text-muted-foreground">
                        {log.itemsProcessed} 項
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("zh-TW")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Logs */}
      {performance.errorLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg text-red-600">錯誤日誌</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              顯示最近 20 條錯誤記錄
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performance.errorLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        {log.source.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {log.status === "timeout" ? "超時" : "錯誤"}
                      </Badge>
                      {log.cardId && (
                        <span className="text-xs text-muted-foreground">
                          卡牌 ID: {log.cardId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("zh-TW")}
                    </span>
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-red-700 dark:text-red-300 font-mono">
                      {log.errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
