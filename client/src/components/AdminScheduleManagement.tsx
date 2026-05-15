import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatHKLocale } from "@/lib/formatDate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Save, RefreshCw, Play, AlertCircle, CheckCircle2, Pause, PlayCircle, ChevronDown, ChevronUp, XCircle, Github, ExternalLink, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

/**
 * ScheduleHealthStats component - displays schedule health statistics (last 7 days)
 */
function ScheduleHealthStats() {
  const { data: stats } = trpc.admin.getScheduleHealthStats.useQuery();
  
  if (!stats) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg lg:text-xl">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            排程健康統計（最近 7 天）
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
            查看排程任務的執行健康度和性能指標
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            載入中...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小時 ${minutes % 60}分鐘`;
    } else if (minutes > 0) {
      return `${minutes}分鐘 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };
  
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400';
    if (rate >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg lg:text-xl">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
          排程健康統計（最近 7 天）
        </CardTitle>
        <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
          查看排程任務的執行健康度和性能指標
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SNKRDUNK 健康統計 */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm sm:text-base">SNKRDUNK 批量更新</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">總執行次數</p>
              <p className="text-white text-lg font-semibold">{stats.snkrdunk.totalExecutions}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">成功率</p>
              <p className={`text-lg font-semibold ${getSuccessRateColor(stats.snkrdunk.successRate)}`}>
                {stats.snkrdunk.successRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">平均執行時間</p>
              <p className="text-white text-lg font-semibold">
                {formatDuration(stats.snkrdunk.averageExecutionTime)}
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">失敗次數</p>
              <p className="text-red-400 text-lg font-semibold">{stats.snkrdunk.failureCount}</p>
            </div>
          </div>
          
          {/* 失敗原因統計 */}
          {stats.snkrdunk.failureReasons.length > 0 && (
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-2">失敗原因統計（Top 5）</p>
              <ul className="space-y-1">
                {stats.snkrdunk.failureReasons.map((reason, index) => (
                  <li key={index} className="text-xs text-gray-300 flex justify-between">
                    <span className="truncate mr-2">{reason.reason}</span>
                    <span className="text-red-400 font-medium">{reason.count}次</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Trending 健康統計 */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm sm:text-base">Trending 計算</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">總執行次數</p>
              <p className="text-white text-lg font-semibold">{stats.trending.totalExecutions}</p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">成功率</p>
              <p className={`text-lg font-semibold ${getSuccessRateColor(stats.trending.successRate)}`}>
                {stats.trending.successRate.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">平均執行時間</p>
              <p className="text-white text-lg font-semibold">
                {formatDuration(stats.trending.averageExecutionTime)}
              </p>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-1">失敗次數</p>
              <p className="text-red-400 text-lg font-semibold">{stats.trending.failureCount}</p>
            </div>
          </div>
          
          {/* 失敗原因統計 */}
          {stats.trending.failureReasons.length > 0 && (
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-gray-400 text-xs mb-2">失敗原因統計（Top 5）</p>
              <ul className="space-y-1">
                {stats.trending.failureReasons.map((reason, index) => (
                  <li key={index} className="text-xs text-gray-300 flex justify-between">
                    <span className="truncate mr-2">{reason.reason}</span>
                    <span className="text-red-400 font-medium">{reason.count}次</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ExecutionHistory component - displays schedule execution history
 */
function ExecutionHistory() {
  const { data: history } = trpc.admin.getScheduleExecutionHistory.useQuery() as { data: { snkrdunk: any[], trending: any[] } | undefined };
  
  if (!history) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg lg:text-xl">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            排程執行歷史
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
            查看排程任務的執行記錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            載入中...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小時 ${minutes % 60}分鐘`;
    } else if (minutes > 0) {
      return `${minutes}分鐘 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return formatHKLocale(date, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'running':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '完成';
      case 'failed':
        return '失敗';
      case 'running':
        return '運行中';
      default:
        return status;
    }
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg lg:text-xl">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
          排程執行歷史
        </CardTitle>
        <CardDescription className="text-gray-400 text-xs sm:text-sm lg:text-base">
          查看排程任務的執行記錄
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SNKRDUNK 執行歷史 */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm sm:text-base lg:text-lg">💰 SNKRDUNK 批量更新歷史</h3>
          {(history as any).snkrdunk && (history as any).snkrdunk.length > 0 ? (
            <div className="space-y-2">
              {(history as any).snkrdunk.map((record: any) => (
                <div key={record.id} className="p-3 lg:p-4 bg-gray-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-xs sm:text-sm lg:text-base ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400">
                      {record.executionType === 'manual' ? '手動觸發' : record.executionType === 'catchup' ? '補執行' : '自動排程'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-300 space-y-1">
                    <div>開始時間：{formatDate(record.startedAt)}</div>
                    {record.completedAt && (
                      <div>完成時間：{formatDate(record.completedAt)}</div>
                    )}
                    {record.durationMs && (
                      <div>耗時：{formatDuration(record.durationMs)}</div>
                    )}
                    {(record.snkrdunkSuccessCount != null || record.snkrdunkRecordsAdded != null) && (
                      <div className="text-green-400">
                        成功: {record.snkrdunkSuccessCount ?? 0} 張 | 新增記錄: {record.snkrdunkRecordsAdded ?? 0}
                      </div>
                    )}
                    {record.snkrdunkFailureCount > 0 && (
                      <div className="text-red-400">失敗: {record.snkrdunkFailureCount} 張</div>
                    )}
                    {record.errorMessage && (
                      <div className="text-red-400 mt-2">錯誤：{record.errorMessage}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-xs sm:text-sm lg:text-base p-3 lg:p-4 bg-gray-800 rounded-lg">
              尚無執行記錄
            </div>
          )}
        </div>
        {/* Trending 執行歷史 */}
        <div className="space-y-3">
          <h3 className="text-white font-medium text-sm sm:text-base lg:text-lg">🔥 熱門卡牌計算歷史</h3>
          {history.trending && history.trending.length > 0 ? (
            <div className="space-y-2">
              {history.trending.map((record: any) => (
                <div key={record.id} className="p-3 lg:p-4 bg-gray-800 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-xs sm:text-sm lg:text-base ${getStatusColor(record.status)}`}>
                      {getStatusText(record.status)}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-400">
                      {record.executionType === 'manual' ? '手動觸發' : record.executionType === 'catchup' ? '補執行' : '自動排程'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-300 space-y-1">
                    <div>開始時間：{formatDate(record.startedAt)}</div>
                    {record.completedAt && (
                      <div>完成時間：{formatDate(record.completedAt)}</div>
                    )}
                    {record.durationMs && (
                      <div>耗時：{formatDuration(record.durationMs)}</div>
                    )}
                    {record.errorMessage && (
                      <div className="text-red-400 mt-2">錯誤：{record.errorMessage}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-xs sm:text-sm lg:text-base p-3 lg:p-4 bg-gray-800 rounded-lg">
              尚無執行記錄
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminScheduleManagement() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  // 獲取當前排程設定
  const { data: schedule, refetch } = trpc.admin.getPriceUpdateSchedule.useQuery();
  
  // 追蹤是否剛啟動了批量更新（用於保持輪詢）
  const [justStarted, setJustStarted] = useState(false);
  
  // 獲取批量更新進度（輪詢）
  const { data: progress } = trpc.admin.getBatchUpdateProgress.useQuery(undefined, {
    refetchInterval: (query) => {
      // 如果正在運行或剛啟動，每 3 秒輪詢一次
      if (query.state.data?.isRunning || justStarted) {
        // 如果數據已返回且 isRunning 為 true，清除 justStarted
        if (query.state.data?.isRunning && justStarted) {
          setJustStarted(false);
        }
        return 3000;
      }
      // 否則每 30 秒檢查一次（以防其他地方啟動了任務）
      return 30000;
    },
  });
  
  // 本地狀態
  const [snkrdunkEnabled, setSnkrdunkEnabled] = useState(schedule?.snkrdunkEnabled ?? false);
  const [snkrdunkTime, setSnkrdunkTime] = useState(schedule?.snkrdunkUpdateTime ?? "01:00");
  const [snkrdunkTime2, setSnkrdunkTime2] = useState((schedule as any)?.snkrdunkUpdateTime2 ?? "13:00");
  const [snkrdunkUpdateMode, setSnkrdunkUpdateMode] = useState<'platform' | 'github_actions'>((schedule as any)?.snkrdunkUpdateMode ?? 'github_actions');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  
  // 當 schedule 數據載入時同步更新本地狀態
  useEffect(() => {
    if (schedule) {
      setSnkrdunkEnabled(schedule.snkrdunkEnabled ?? false);
      setSnkrdunkTime(schedule.snkrdunkUpdateTime ?? "01:00");
      setSnkrdunkTime2((schedule as any)?.snkrdunkUpdateTime2 ?? "13:00");
      setSnkrdunkUpdateMode((schedule as any)?.snkrdunkUpdateMode ?? 'github_actions');
    }
  }, [schedule]);
  
  // 更新排程設定
  const updateSchedule = trpc.admin.updatePriceUpdateSchedule.useMutation({
    onSuccess: () => {
      toast.success("排程設定已更新", {
        description: "價格更新排程設定已成功保存",
      });
      refetch();
    },
    onError: (error) => {
      toast.error("更新失敗", {
        description: error.message,
      });
    },
  });
  
  const handleSave = () => {
    updateSchedule.mutate({
      snkrdunkEnabled,
      snkrdunkUpdateTime: snkrdunkTime,
      snkrdunkUpdateTime2: snkrdunkTime2 || null,
      snkrdunkUpdateMode,
    } as any);
  };
  
  // 手動觸發 SNKRDUNK 批量更新
  const triggerSnkrdunkUpdate = trpc.admin.batchUpdateSnkrdunkPrices.useMutation({
    onSuccess: (data) => {
      toast.success("SNKRDUNK 批量更新已啟動", {
        description: data.message,
      });
      setJustStarted(true);
      // 立即刷新進度查詢
      utils.admin.getBatchUpdateProgress.invalidate();
      refetch();
    },
    onError: (error) => {
      toast.error("啟動失敗", {
        description: error.message,
      });
    },
  });
  
  // 強制取消批量更新
  const cancelUpdate = trpc.admin.cancelPersistentTask.useMutation({
    onSuccess: () => {
      toast.success("批量更新已強制取消");
      utils.admin.getBatchUpdateProgress.invalidate();
    },
    onError: (error) => {
      toast.error("取消失敗", {
        description: error.message,
      });
    },
  });
  
  // 暫停批量更新
  const pauseUpdate = trpc.admin.pauseBatchUpdate.useMutation({
    onSuccess: () => {
      toast.success("批量更新已暫停");
    },
    onError: (error) => {
      toast.error("暫停失敗", {
        description: error.message,
      });
    },
  });
  
  // 繼續批量更新
  const resumeUpdate = trpc.admin.resumeBatchUpdate.useMutation({
    onSuccess: () => {
      toast.success("批量更新已繼續");
    },
    onError: (error) => {
      toast.error("繼續失敗", {
        description: error.message,
      });
    },
  });

  // 手動觸發熱門卡牌快速更新
  const triggerHotCardPoll = trpc.admin.triggerHotCardPoll.useMutation({
    onSuccess: (data) => {
      toast.success("熱門卡牌更新完成", {
        description: `已更新 ${data.updated} 張，跳過 ${data.skipped} 張，失敗 ${data.failed} 張`,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("熱門卡牌更新失敗", {
        description: error.message,
      });
    },
  });
  
  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            價格更新排程設定
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm">
            設定 SNKRDUNK 價格的自動更新時間
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SNKRDUNK 排程設定 */}
          <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
            {/* 更新模式切換 */}
            <div className="space-y-2">
              <Label className="text-white font-medium text-sm sm:text-base">SNKRDUNK 批量更新模式</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSnkrdunkUpdateMode('github_actions')}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    snkrdunkUpdateMode === 'github_actions'
                      ? 'bg-green-900/50 border-green-500 text-green-300'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Github className="w-4 h-4" />
                  <div className="text-left">
                    <div>GitHub Actions （主要）</div>
                    <div className="text-xs opacity-70">每日 01:00 HKT 自動執行</div>
                  </div>
                  {snkrdunkUpdateMode === 'github_actions' && <span className="ml-auto text-xs bg-green-700 text-green-200 px-1.5 py-0.5 rounded">啟用</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setSnkrdunkUpdateMode('platform')}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                    snkrdunkUpdateMode === 'platform'
                      ? 'bg-blue-900/50 border-blue-500 text-blue-300'
                      : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <div className="text-left">
                    <div>平台內建排程</div>
                    <div className="text-xs opacity-70">使用下方時間設定</div>
                  </div>
                  {snkrdunkUpdateMode === 'platform' && <span className="ml-auto text-xs bg-blue-700 text-blue-200 px-1.5 py-0.5 rounded">啟用</span>}
                </button>
              </div>
              {snkrdunkUpdateMode === 'github_actions' && (
                <div className="flex items-start gap-2 p-2 bg-green-900/20 border border-green-800 rounded text-xs text-green-300">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>GitHub Actions 模式：儲存時會自動啟用 GitHub Actions 排程、停用平台內建 cron，避免重複執行。每日 02:00 HKT 執行一次。</span>
                </div>
              )}
              {snkrdunkUpdateMode === 'platform' && (
                <div className="flex items-start gap-2 p-2 bg-blue-900/20 border border-blue-800 rounded text-xs text-blue-300">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>平台內建排程模式：儲存時會自動停用 GitHub Actions 排程，由平台伺服器獨立執行，不會重複。</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white font-medium text-sm sm:text-base">SNKRDUNK 批量更新</Label>
                <p className="text-sm text-gray-400">
                  每日自動更新所有卡牌的 SNKRDUNK 價格
                </p>
              </div>
              <Switch
                checked={snkrdunkEnabled}
                onCheckedChange={setSnkrdunkEnabled}
              />
            </div>
            
            {snkrdunkEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white">第一次更新時間（香港時間）</Label>
                    <Input
                      type="time"
                      value={snkrdunkTime}
                      onChange={(e) => setSnkrdunkTime(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">第二次更新時間（香港時間）</Label>
                    <Input
                      type="time"
                      value={snkrdunkTime2}
                      onChange={(e) => setSnkrdunkTime2(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  每日執行兩次：{snkrdunkTime} 和 {snkrdunkTime2}（香港時間）
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    (schedule as any)?.snkrdunkSchedulerRunning
                      ? 'bg-green-900 text-green-300'
                      : 'bg-red-900 text-red-300'
                  }`}>
                    排程1 {(schedule as any)?.snkrdunkSchedulerRunning ? '✓ 運行中' : '✗ 未運行'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    (schedule as any)?.snkrdunkScheduler2Running
                      ? 'bg-green-900 text-green-300'
                      : 'bg-red-900 text-red-300'
                  }`}>
                    排程2 {(schedule as any)?.snkrdunkScheduler2Running ? '✓ 運行中' : '✗ 未運行'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  最後執行時間：{schedule?.snkrdunkLastExecutedAt 
                    ? formatHKLocale(schedule.snkrdunkLastExecutedAt, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : "尚未執行"}
                </p>
              </div>
            )}
            
            {/* 手動更新按鈕 */}
            <div className="pt-2">
              <Button
                onClick={() => triggerSnkrdunkUpdate.mutate()}
                disabled={triggerSnkrdunkUpdate.isPending || progress?.isRunning}
                variant="outline"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
              >
                {triggerSnkrdunkUpdate.isPending || progress?.isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    立即更新所有 SNKRDUNK 卡牌
                  </>
                )}
              </Button>
            </div>
            
            {/* 進度條 */}
            {progress?.isRunning && (
              <div className="space-y-3 p-4 bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">更新進度</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">
                      {progress.processedCards} / {progress.totalCards}
                    </span>
                    {progress.isPaused ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeUpdate.mutate()}
                        disabled={resumeUpdate.isPending}
                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white border-green-500"
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        繼續
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseUpdate.mutate()}
                        disabled={pauseUpdate.isPending}
                        className="h-7 px-2 bg-orange-600 hover:bg-orange-700 text-white border-orange-500"
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        暫停
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if ((progress as any)?.taskId) {
                          cancelUpdate.mutate({ taskId: (progress as any).taskId });
                        }
                      }}
                      disabled={cancelUpdate.isPending || !(progress as any)?.taskId}
                      className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white border-red-500"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      取消
                    </Button>
                  </div>
                </div>
                <Progress 
                  value={progress.totalCards > 0 ? Math.min(100, (progress.processedCards / progress.totalCards) * 100) : 0} 
                  className="h-2"
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      成功: {progress.successCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-red-500" />
                      失敗: {progress.failureCount}
                    </span>
                    {progress.isPaused && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <Pause className="w-3 h-3" />
                        已暫停
                      </span>
                    )}
                  </div>
                  <span>
                    {progress.totalCards > 0 ? Math.min(100, Math.round((progress.processedCards / progress.totalCards) * 100)) : 0}%
                  </span>
                </div>
                {/* 速度和 ETA */}
                {((progress as any)?.speedPerSec > 0 || (progress as any)?.etaMinutes > 0) && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {(progress as any)?.speedPerSec > 0 && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <span className="font-mono">{(progress as any).speedPerSec.toFixed(1)}</span>
                          <span className="text-gray-500">張/秒</span>
                        </span>
                      )}
                      {(progress as any)?.source === 'github_actions' && (
                        <span className="text-gray-500 text-xs">GitHub Actions</span>
                      )}
                    </div>
                    {(progress as any)?.etaMinutes > 0 && (
                      <span className="text-yellow-400">
                        預計剩餘 {(progress as any).etaMinutes} 分鐘
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* 錯誤詳情 */}
            {progress?.failureCount && progress.failureCount > 0 && !progress?.isRunning && (
              <div className="space-y-2 p-4 bg-red-900/20 border border-red-800 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="w-full justify-between text-red-300 hover:text-red-200 hover:bg-red-900/30"
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    查看錯誤詳情 ({progress?.failureCount} 個失敗)
                  </span>
                  {showErrorDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
                
                {showErrorDetails && progress?.errors && progress.errors.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {progress.errors.map((error, index) => (
                        <div key={index} className="p-3 bg-gray-800 rounded text-xs">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 space-y-1">
                              <div className="text-white font-medium">
                                卡牌 ID: {error.cardId}
                              </div>
                              {error.cardName && (
                                <div className="text-gray-400">
                                  {error.cardName}
                                </div>
                              )}
                              <div className="text-red-300">
                                {error.error}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          
          {/* 保存按鈕 */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={updateSchedule.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              {updateSchedule.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存設定
                </>
              )}
            </Button>
          </div>
          
          {/* 熱門卡牌快速更新 */}
          <div className="space-y-3 p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white font-medium text-sm sm:text-base">熱門卡牌快速更新</Label>
                <p className="text-sm text-gray-400">
                  每 30 分鐘自動更新最近 7 天被查看最多的前 100 張卡牌
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                (schedule as any)?.hotCardPollSchedulerRunning
                  ? 'bg-green-900 text-green-300'
                  : 'bg-red-900 text-red-300'
              }`}>
                {(schedule as any)?.hotCardPollSchedulerRunning ? '✓ 排程運行中' : '✗ 排程未啟動'}
              </span>
            </div>
            {(schedule as any)?.hotCardPollIsRunning && (
              <p className="text-xs text-yellow-400">⚡ 目前正在更新熱門卡牌...</p>
            )}
            {(schedule as any)?.hotCardPollLastRunAt && (
              <p className="text-xs text-gray-400">
                上次執行：{new Date((schedule as any).hotCardPollLastRunAt).toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} (HKT)
                {(schedule as any)?.hotCardPollLastResult && (
                  <span className="ml-2 text-gray-500">
                    更新 {(schedule as any).hotCardPollLastResult.updated} 張，跳過 {(schedule as any).hotCardPollLastResult.skipped} 張，失敗 {(schedule as any).hotCardPollLastResult.failed} 張
                  </span>
                )}
              </p>
            )}
            <Button
              onClick={() => triggerHotCardPoll.mutate()}
              disabled={triggerHotCardPoll.isPending || (schedule as any)?.hotCardPollIsRunning}
              variant="outline"
              className="w-full bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
            >
              {triggerHotCardPoll.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />更新中...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" />立即更新熱門卡牌（前 100 張）</>
              )}
            </Button>
          </div>

          {/* 說明文字 */}
          <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>注意事項：</strong>
            </p>
            <ul className="text-sm text-blue-300 mt-2 space-y-1 list-disc list-inside">
              <li>排程時間使用香港時間（GMT+8）</li>
              <li>建議將更新時間設定在凌晨，避免影響用戶使用</li>
              <li>預設更新時間為凌晨 01:00</li>
              <li>批量更新可能需要較長時間，請耐心等待</li>
              <li>保存設定後，排程器將自動重啟以應用新設定</li>
              <li>熱門卡牌快速更新：每 30 分鐘更新最熱門的前 100 張卡牌，提升熱門卡牌的價格即時性</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Actions 批次更新說明 */}
      <GitHubActionsGuide />

      {/* 排程健康統計 */}
      <ScheduleHealthStats />

      {/* 排程執行歷史 */}
      <ExecutionHistory />
    </div>
  );
}

/**
 * WorkflowStatusBadge - 顯示 GitHub Actions workflow 執行狀態
 */
function WorkflowStatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'queued') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-900/40 text-yellow-300 border border-yellow-700"><RefreshCw className="w-3 h-3 animate-spin" />排隊中</span>;
  }
  if (status === 'in_progress') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-900/40 text-blue-300 border border-blue-700"><RefreshCw className="w-3 h-3 animate-spin" />執行中</span>;
  }
  if (status === 'completed') {
    if (conclusion === 'success') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/40 text-green-300 border border-green-700"><CheckCircle2 className="w-3 h-3" />成功</span>;
    if (conclusion === 'failure') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-900/40 text-red-300 border border-red-700"><XCircle className="w-3 h-3" />失敗</span>;
    if (conclusion === 'cancelled') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300 border border-gray-600"><XCircle className="w-3 h-3" />已取消</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-300 border border-gray-600"><CheckCircle2 className="w-3 h-3" />{conclusion ?? '完成'}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400 border border-gray-600">{status}</span>;
}

function GitHubActionsGuide() {
  const [expanded, setExpanded] = useState(false);
  const [pollingWorkflow, setPollingWorkflow] = useState<string | null>(null);

  const { data: priceUpdateStatus } = trpc.admin.getWorkflowRunStatus.useQuery(
    { workflow: 'snkrdunk-batch-update' },
    { refetchInterval: pollingWorkflow === 'snkrdunk-batch-update' ? 8000 : 30000, enabled: expanded }
  );

  const { data: listingsUpdateStatus } = trpc.admin.getWorkflowRunStatus.useQuery(
    { workflow: 'snkrdunk-listings-batch-update' },
    { refetchInterval: pollingWorkflow === 'snkrdunk-listings-batch-update' ? 8000 : 30000, enabled: expanded }
  );

  useEffect(() => {
    if (pollingWorkflow === 'snkrdunk-batch-update' && priceUpdateStatus?.status === 'completed') setPollingWorkflow(null);
    if (pollingWorkflow === 'snkrdunk-listings-batch-update' && listingsUpdateStatus?.status === 'completed') setPollingWorkflow(null);
  }, [pollingWorkflow, priceUpdateStatus?.status, listingsUpdateStatus?.status]);

  const triggerWorkflow = trpc.admin.triggerGitHubActionsWorkflow.useMutation({
    onSuccess: (data) => {
      toast.success(data.message, {
        action: {
          label: '查看 Actions',
          onClick: () => window.open(data.repoUrl, '_blank'),
        },
        duration: 8000,
      });
      setPollingWorkflow(data.workflow);
      setTimeout(() => setPollingWorkflow(null), 10 * 60 * 1000);
    },
    onError: (err) => {
      toast.error(`觸發失敗：${err.message}`);
    },
  });

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <CardTitle className="flex items-center justify-between text-white text-base sm:text-lg">
          <span className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            GitHub Actions 批次更新（沙盒獨立方案）
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </CardTitle>
        <CardDescription className="text-gray-400 text-xs sm:text-sm">
          此方案讓批次更新在 GitHub 雲端執行，完全不依賴本平台伺服器是否在線
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {/* 狀態說明 */}
          <div className="flex items-start gap-3 p-3 bg-green-900/20 border border-green-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-green-300 text-sm font-medium">Workflow 已就緒</p>
              <p className="text-green-400/80 text-xs mt-1">
                兩個 workflow 均已就緒：<br/>
                <code className="bg-gray-800 px-1 rounded">snkrdunk-batch-update.yml</code> — 每日 01:00 HKT 更新價格歷史<br/>
                <code className="bg-gray-800 px-1 rounded">snkrdunk-listings-batch-update.yml</code> — 每 6 小時更新在售商品
              </p>
            </div>
          </div>

          {/* 設定步驟 */}
          <div className="space-y-3">
            <h3 className="text-white font-medium text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              必要設定步驟（一次性）
            </h3>
            <ol className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <div>
                  <p className="font-medium text-white">前往 GitHub 倉庫設定</p>
                  <p className="text-gray-400 text-xs mt-1">在 GitHub 倉庫頁面，點擊 <strong>Settings → Secrets and variables → Actions</strong></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <div>
                  <p className="font-medium text-white">新增 Secret：DATABASE_URL</p>
                  <p className="text-gray-400 text-xs mt-1">點擊 <strong>New repository secret</strong>，名稱填 <code className="bg-gray-800 px-1 rounded">DATABASE_URL</code>，值填入 MySQL 連接字串</p>
                  <p className="text-yellow-400 text-xs mt-1">⚠️ 連接字串格式：<code className="bg-gray-800 px-1 rounded">mysql://用戶名:密碼@主機:埠/資料庫名</code></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                <div>
                  <p className="font-medium text-white">手動測試執行</p>
                  <p className="text-gray-400 text-xs mt-1">前往 GitHub 倉庫 → <strong>Actions → SNKRDUNK Batch Price Update → Run workflow</strong></p>
                </div>
              </li>
            </ol>
          </div>

          {/* 手動觸發按鈕 + 狀態 */}
          <div className="space-y-3">
            <p className="text-gray-400 text-xs font-medium flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              立即手動觸發 GitHub Actions
            </p>

            {/* Price History Workflow */}
            <div className="p-3 bg-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-300">價格歷史更新</span>
                {priceUpdateStatus && (
                  <div className="flex items-center gap-2">
                    <WorkflowStatusBadge status={priceUpdateStatus.status} conclusion={priceUpdateStatus.conclusion} />
                    <a href={priceUpdateStatus.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
              {priceUpdateStatus && (
                <p className="text-xs text-gray-500">
                  #{priceUpdateStatus.runNumber} · {priceUpdateStatus.event === 'schedule' ? '排程' : '手動'} · {formatHKLocale(priceUpdateStatus.updatedAt)}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border-blue-700 text-xs h-8 justify-start"
                disabled={triggerWorkflow.isPending}
                onClick={() => triggerWorkflow.mutate({ workflow: 'snkrdunk-batch-update' })}
              >
                {triggerWorkflow.isPending && triggerWorkflow.variables?.workflow === 'snkrdunk-batch-update' ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-2" />
                )}
                立即觸發
              </Button>
            </div>

            {/* Listings Workflow */}
            <div className="p-3 bg-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-300">在售商品更新</span>
                {listingsUpdateStatus && (
                  <div className="flex items-center gap-2">
                    <WorkflowStatusBadge status={listingsUpdateStatus.status} conclusion={listingsUpdateStatus.conclusion} />
                    <a href={listingsUpdateStatus.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
              {listingsUpdateStatus && (
                <p className="text-xs text-gray-500">
                  #{listingsUpdateStatus.runNumber} · {listingsUpdateStatus.event === 'schedule' ? '排程' : '手動'} · {formatHKLocale(listingsUpdateStatus.updatedAt)}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-purple-900/30 hover:bg-purple-800/50 text-purple-300 border-purple-700 text-xs h-8 justify-start"
                disabled={triggerWorkflow.isPending}
                onClick={() => triggerWorkflow.mutate({ workflow: 'snkrdunk-listings-batch-update' })}
              >
                {triggerWorkflow.isPending && triggerWorkflow.variables?.workflow === 'snkrdunk-listings-batch-update' ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 mr-2" />
                )}
                立即觸發
              </Button>
            </div>

            <p className="text-gray-500 text-xs">觸發後每 8 秒自動更新狀態，完成後恢復 30 秒輪詢</p>
          </div>
          {/* 快速連結 */}
          <div className="flex flex-wrap gap-2">
            <a
              href="https://github.com/kevinchan1992/boxium-ptcg001/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-md transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              前往 GitHub Actions
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* 技術說明 */}
          <div className="p-3 bg-gray-800 rounded-lg space-y-2">
            <p className="text-gray-400 text-xs font-medium">技術說明</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>腳本位置：<code className="bg-gray-700 px-1 rounded">scripts/githubActionsBatchUpdate.mjs</code></li>
              <li>每次執行：8 個並行工作者，跳過 12 小時內已更新的卡牌</li>
              <li>預計時間：約 2 小時完成 55,000+ 張卡牌</li>
              <li>GitHub Actions 免費額度：每月 2,000 分鐘（約 33 小時），足夠每日執行</li>
              <li>可在 GitHub Actions 頁面手動觸發，並自訂 PARALLEL 和 SKIP_HOURS 參數</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
