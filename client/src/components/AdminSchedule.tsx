import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Clock, CheckCircle, XCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

export function AdminSchedule() {
  const utils = trpc.useUtils();
  const [isManualRunning, setIsManualRunning] = useState(false);

  // 獲取排程設定
  const { data: scheduleConfig, isLoading: configLoading } = trpc.admin.getScheduleConfig.useQuery(undefined, {
    refetchInterval: 10000, // 每 10 秒刷新一次
  });

  // 獲取執行歷史
  const { data: executionHistory, isLoading: historyLoading } = trpc.admin.getScheduleExecutionHistory.useQuery(undefined, {
    refetchInterval: 5000, // 每 5 秒刷新一次
  });

  // 啟用/停用排程
  const updateScheduleEnabledMutation = trpc.admin.updateScheduleEnabled.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      utils.admin.getScheduleConfig.invalidate();
    },
    onError: (error: any) => {
      toast.error(`更新排程狀態失敗: ${error.message}`);
    },
  });

  // 立即手動觸發排程
  const triggerScheduleNowMutation = trpc.admin.triggerScheduleNow.useMutation({
    onSuccess: (result) => {
      setIsManualRunning(true);
      toast.success(result.message);
      utils.admin.getScheduleExecutionHistory.invalidate();
    },
    onError: (error: any) => {
      toast.error(`觸發排程失敗: ${error.message}`);
    },
  });

  // 檢查是否有正在運行的任務
  const hasRunningTask = executionHistory?.some(h => h.status === "running");

  // 當有運行中的任務完成時，停止手動運行狀態
  if (isManualRunning && !hasRunningTask) {
    setIsManualRunning(false);
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!scheduleConfig) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        未找到排程設定
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 排程設定卡片 */}
      <Card className="p-6">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          定時批量更新排程
        </h2>
        
        <div className="space-y-4">
          {/* 排程描述 */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              {scheduleConfig.description}
            </p>
          </div>

          {/* 排程狀態 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">排程狀態：</span>
              <span className={`text-sm font-semibold ${scheduleConfig.enabled ? "text-green-600" : "text-gray-500"}`}>
                {scheduleConfig.enabled ? "已啟用" : "已停用"}
              </span>
            </div>
            <Switch
              checked={scheduleConfig.enabled}
              onCheckedChange={(checked) => {
                updateScheduleEnabledMutation.mutate({ enabled: checked });
              }}
              disabled={updateScheduleEnabledMutation.isPending}
            />
          </div>

          {/* 執行時間資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">下次執行時間</span>
              </div>
              <p className="text-sm text-blue-700">
                {scheduleConfig.nextExecutionAt
                  ? new Date(scheduleConfig.nextExecutionAt).toLocaleString("zh-TW", {
                      timeZone: "Asia/Hong_Kong",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "未設定"}
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">上次執行時間</span>
              </div>
              <p className="text-sm text-gray-700">
                {scheduleConfig.lastExecutedAt
                  ? new Date(scheduleConfig.lastExecutedAt).toLocaleString("zh-TW", {
                      timeZone: "Asia/Hong_Kong",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "尚未執行"}
              </p>
            </div>
          </div>

          {/* 立即執行按鈕 */}
          <Button
            onClick={() => triggerScheduleNowMutation.mutate()}
            disabled={triggerScheduleNowMutation.isPending || hasRunningTask}
            className="w-full"
          >
            {triggerScheduleNowMutation.isPending || hasRunningTask ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                執行中...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                立即執行批量更新
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 執行歷史卡片 */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">
          執行歷史（最近 10 次）
        </h3>

        {historyLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !executionHistory || executionHistory.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">
            尚無執行歷史
          </div>
        ) : (
          <div className="space-y-3">
            {executionHistory.map((history) => (
              <div
                key={history.id}
                className={`p-4 rounded-lg border ${
                  history.status === "completed"
                    ? "bg-green-50 border-green-200"
                    : history.status === "failed"
                    ? "bg-red-50 border-red-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {history.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : history.status === "failed" ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                    )}
                    <span className="text-sm font-semibold">
                      {history.executionType === "manual" ? "手動執行" : "排程執行"}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      history.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : history.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {history.status === "completed" ? "完成" : history.status === "failed" ? "失敗" : "運行中"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(history.startedAt).toLocaleString("zh-TW", {
                      timeZone: "Asia/Hong_Kong",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {history.status !== "running" && (
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">eBay 更新</p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">✓ {history.ebaySuccessCount}</span>
                        <span className="text-red-600">✗ {history.ebayFailureCount}</span>
                        <span className="text-blue-600">📊 {history.ebayRecordsAdded} 筆</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">SNKRDUNK 更新</p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">✓ {history.snkrdunkSuccessCount}</span>
                        <span className="text-red-600">✗ {history.snkrdunkFailureCount}</span>
                        <span className="text-blue-600">📊 {history.snkrdunkRecordsAdded} 筆</span>
                      </div>
                    </div>
                  </div>
                )}

                {history.durationMs && (
                  <p className="text-xs text-muted-foreground mt-2">
                    執行時間: {(history.durationMs / 1000).toFixed(1)} 秒
                  </p>
                )}

                {history.errorMessage && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                    錯誤: {history.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
