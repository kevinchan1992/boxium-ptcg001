import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, AlertTriangle, Activity, Zap, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AdminScraperPerformance() {
  const [source, setSource] = useState<"all" | "snkrdunk">("all");
  const [hours, setHours] = useState(24);

  const { data: performance, isLoading, refetch } = trpc.admin.getScraperPerformance.useQuery(
    { source, hours },
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-base md:text-lg text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              爬蟲性能監控
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-slate-500">載入中...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-lg animate-pulse">
                  <div className="h-3 bg-slate-200 rounded w-1/2 mb-3"></div>
                  <div className="h-8 bg-slate-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!performance) {
    return (
      <Card className="bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-base md:text-lg text-slate-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            爬蟲性能監控
          </CardTitle>
          <CardDescription className="text-xs md:text-sm text-slate-500">無法載入性能數據</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return "text-green-400";
    if (rate >= 70) return "text-yellow-400";
    return "text-red-400";
  };

  const getSuccessRateBg = (rate: number) => {
    if (rate >= 90) return "bg-green-500/10 border-green-500/20";
    if (rate >= 70) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  const getResponseTimeColor = (time: number) => {
    if (time <= 5000) return "text-green-400";
    if (time <= 15000) return "text-yellow-400";
    return "text-red-400";
  };

  const getResponseTimeBg = (time: number) => {
    if (time <= 5000) return "bg-green-500/10 border-green-500/20";
    if (time <= 15000) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  // Calculate success rate bar width
  const successBarWidth = Math.max(performance.successRate, 2);
  const errorBarWidth = Math.max(100 - performance.successRate, 2);

  return (
    <div className="space-y-4">
      {/* Header with Filters */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-base md:text-lg text-slate-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-400" />
                爬蟲性能監控
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-slate-500 mt-1">
                實時監控數據抓取性能、成功率和錯誤日誌
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger className="w-[130px] text-xs md:text-sm bg-slate-50 border-slate-200 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有來源</SelectItem>
                  <SelectItem value="snkrdunk">SNKRDUNK</SelectItem>
                </SelectContent>
              </Select>

              <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
                <SelectTrigger className="w-[120px] text-xs md:text-sm bg-slate-50 border-slate-200 text-slate-900">
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
                className="text-xs md:text-sm border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50"
              >
                <RefreshCw className="h-3 w-3 md:h-4 md:w-4 mr-1" />
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requests */}
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-slate-500 font-medium">總請求數</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900">{performance.totalRequests.toLocaleString()}</div>
            <div className="flex items-center gap-3 mt-3 text-xs">
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {performance.successCount.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="h-3 w-3" />
                {performance.errorCount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className={`border ${getSuccessRateBg(performance.successRate)} bg-white`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              {performance.successRate >= 90 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className="text-xs text-slate-500 font-medium">成功率</span>
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${getSuccessRateColor(performance.successRate)}`}>
              {performance.successRate}%
            </div>
            {/* Mini bar chart */}
            <div className="flex gap-0.5 mt-3 h-2 rounded-full overflow-hidden bg-slate-50">
              <div
                className="bg-green-500 rounded-l-full transition-all"
                style={{ width: `${successBarWidth}%` }}
              />
              <div
                className="bg-red-500 rounded-r-full transition-all"
                style={{ width: `${errorBarWidth}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card className={`border ${getResponseTimeBg(performance.avgResponseTime)} bg-white`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-slate-500 font-medium">平均響應時間</span>
            </div>
            <div className={`text-2xl md:text-3xl font-bold ${getResponseTimeColor(performance.avgResponseTime)}`}>
              {(performance.avgResponseTime / 1000).toFixed(2)}s
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {performance.avgResponseTime}ms
            </div>
          </CardContent>
        </Card>

        {/* Items Processed */}
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-slate-500 font-medium">處理項目數</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900">{performance.totalItemsProcessed.toLocaleString()}</div>
            <div className="flex items-center gap-1 mt-3 text-xs">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              <span className="text-yellow-400">{performance.timeoutCount} 超時</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs */}
      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg text-slate-900">最近爬取記錄</CardTitle>
          <CardDescription className="text-xs md:text-sm text-slate-500">
            顯示最近 10 次爬取操作
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {performance.recentLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">暫無爬取記錄</p>
              </div>
            ) : (
              performance.recentLogs.map((log: any) => (
                <div
                  key={log.id}
                  className={`flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 rounded-lg border text-xs md:text-sm ${
                    log.status === "success"
                      ? "bg-slate-50/50 border-slate-200"
                      : "bg-red-950/30 border-red-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={log.status === "success" ? "default" : "destructive"}
                      className="text-xs font-mono"
                    >
                      {log.source.toUpperCase()}
                    </Badge>
                    <span className="text-slate-500">
                      {log.operationType === "batch" ? "批量" : "單個"}
                    </span>
                    {log.cardId && (
                      <span className="text-slate-400 font-mono text-xs">
                        #{log.cardId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-slate-500">
                    <span className={`font-mono ${
                      log.responseTime > 10000 ? "text-yellow-400" : "text-slate-400"
                    }`}>
                      {(log.responseTime / 1000).toFixed(2)}s
                    </span>
                    {log.itemsProcessed > 0 && (
                      <span>{log.itemsProcessed} 項</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {formatHKLocale(log.createdAt)}
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
        <Card className="bg-white border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg text-red-400 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              錯誤日誌
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-slate-500">
              顯示最近 20 條錯誤記錄
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {performance.errorLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border border-red-800/40 bg-red-950/20"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs font-mono">
                        {log.source.toUpperCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          log.status === "timeout"
                            ? "border-yellow-600 text-yellow-400"
                            : "border-red-600 text-red-400"
                        }`}
                      >
                        {log.status === "timeout" ? "超時" : "錯誤"}
                      </Badge>
                      {log.cardId && (
                        <span className="text-xs text-slate-400 font-mono">
                          #{log.cardId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatHKLocale(log.createdAt)}
                    </span>
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-red-300 font-mono bg-red-950/40 p-2 rounded mt-1 break-all">
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
