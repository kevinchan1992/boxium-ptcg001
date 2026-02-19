import { useState, useEffect } from "react";
import { TaskPerformanceChart } from "./TaskPerformanceChart";
import { TaskHistory } from "./TaskHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Database, AlertCircle, Zap, X, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

export function AdminCacheManagement() {
  const [cardIdInput, setCardIdInput] = useState("");
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [showRefreshAllDialog, setShowRefreshAllDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);

  // Fetch cache statistics
  const { data: cacheStats, refetch: refetchStats } = trpc.admin.getCacheStats.useQuery();

  // Fetch task progress (poll every 3 seconds if task is running)
  const { data: taskProgress } = trpc.admin.getTaskProgress.useQuery(
    { taskId: currentTaskId! },
    {
      enabled: currentTaskId !== null,
      refetchInterval: 3000, // Poll every 3 seconds
    }
  );

  // Clear specific card cache mutation
  const clearCardCache = trpc.admin.clearCardCache.useMutation({
    onSuccess: (result) => {
      toast.success("緩存已清除", {
        description: `已清除卡牌 ${cardIdInput} 的 ${result.deletedCount} 條緩存記錄`,
      });
      setCardIdInput("");
      refetchStats();
    },
    onError: (error) => {
      toast.error("清除失敗", {
        description: error.message,
      });
    },
  });

  // Clear all cache mutation
  const clearAllCache = trpc.admin.clearAllCache.useMutation({
    onSuccess: (result) => {
      toast.success("所有緩存已清除", {
        description: `已清除 ${result.deletedCount} 條緩存記錄`,
      });
      refetchStats();
      setShowClearAllDialog(false);
    },
    onError: (error) => {
      toast.error("清除失敗", {
        description: error.message,
      });
      setShowClearAllDialog(false);
    },
  });

  // Start refresh all cards cache mutation
  const startRefreshAllCardsCache = trpc.admin.startRefreshAllCardsCache.useMutation({
    onSuccess: (result) => {
      if (result.success && result.taskId) {
        setCurrentTaskId(result.taskId);
        toast.success("任務已啟動", {
          description: `開始更新 ${result.totalCards} 張卡牌的緩存`,
        });
      } else {
        toast.error("啟動失敗", {
          description: result.error || "未知錯誤",
        });
      }
      setShowRefreshAllDialog(false);
    },
    onError: (error) => {
      toast.error("啟動失敗", {
        description: error.message,
      });
      setShowRefreshAllDialog(false);
    },
  });

  // Cancel task mutation
  const cancelTask = trpc.admin.cancelTask.useMutation({
    onSuccess: () => {
      toast.success("任務已取消");
      setCurrentTaskId(null);
      refetchStats();
    },
    onError: (error) => {
      toast.error("取消失敗", {
        description: error.message,
      });
    },
  });

  const handleClearCardCache = () => {
    const cardId = parseInt(cardIdInput, 10);
    if (isNaN(cardId) || cardId <= 0) {
      toast.error("無效的卡牌 ID", {
        description: "請輸入有效的卡牌 ID（正整數）",
      });
      return;
    }
    clearCardCache.mutate({ cardId });
  };

  const handleClearAllCache = () => {
    clearAllCache.mutate();
  };

  const handleStartRefreshAllCardsCache = () => {
    startRefreshAllCardsCache.mutate();
  };

  const handleCancelTask = () => {
    if (currentTaskId) {
      cancelTask.mutate({ taskId: currentTaskId });
    }
  };

  // Calculate progress percentage
  const progressPercentage = taskProgress
    ? (taskProgress.processedItems / taskProgress.totalItems) * 100
    : 0;

  // Calculate estimated time remaining
  const estimatedTimeRemaining = taskProgress && taskProgress.processedItems > 0
    ? ((taskProgress.totalItems - taskProgress.processedItems) * 2.5) / 60 // 2.5 seconds per card, convert to minutes
    : null;

  // Parse current item
  const currentItem = taskProgress?.currentItem
    ? (() => {
        try {
          return JSON.parse(taskProgress.currentItem);
        } catch {
          return null;
        }
      })()
    : null;

  // Show completion toast when task completes
  useEffect(() => {
    if (taskProgress?.status === "completed") {
      toast.success("任務完成", {
        description: `成功更新 ${taskProgress.successCount} 張卡牌，失敗 ${taskProgress.failureCount} 張`,
      });
      setCurrentTaskId(null);
      refetchStats();
    } else if (taskProgress?.status === "failed") {
      toast.error("任務失敗", {
        description: taskProgress.errorMessage || "未知錯誤",
      });
      setCurrentTaskId(null);
    } else if (taskProgress?.status === "cancelled") {
      setCurrentTaskId(null);
    }
  }, [taskProgress?.status]);

  return (
    <div className="space-y-6">
      {/* Cache Statistics */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Database className="w-5 h-5" />
            緩存統計
          </CardTitle>
          <CardDescription className="text-gray-400">
            查看當前 SNKRDUNK 價格緩存狀態
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cacheStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">總緩存數量</p>
                <p className="text-2xl font-bold text-white">{cacheStats.totalCount}</p>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">最舊緩存</p>
                <p className="text-sm font-medium text-white">
                  {cacheStats.oldestCache 
                    ? new Date(cacheStats.oldestCache).toLocaleString("zh-TW")
                    : "N/A"}
                </p>
              </div>
              <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">最新緩存</p>
                <p className="text-sm font-medium text-white">
                  {cacheStats.newestCache 
                    ? new Date(cacheStats.newestCache).toLocaleString("zh-TW")
                    : "N/A"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-400">載入中...</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            className="w-full md:w-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新統計
          </Button>
        </CardContent>
      </Card>

      {/* Clear Specific Card Cache */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">清除指定卡牌緩存</CardTitle>
          <CardDescription className="text-gray-400">
            輸入卡牌 ID 清除該卡牌的 SNKRDUNK 價格緩存，強制重新抓取最新數據
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardId" className="text-gray-300">卡牌 ID</Label>
            <div className="flex gap-2">
              <Input
                id="cardId"
                type="number"
                placeholder="例如: 180001"
                value={cardIdInput}
                onChange={(e) => setCardIdInput(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <Button
                onClick={handleClearCardCache}
                disabled={clearCardCache.isPending || !cardIdInput}
                className="whitespace-nowrap"
              >
                {clearCardCache.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    清除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除緩存
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">使用說明</p>
              <p>清除緩存後，下次訪問該卡牌的 Pricing 頁面時，系統將自動重新抓取 SNKRDUNK 最新價格數據。</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Refresh All Cards Cache */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5" />
            更新所有卡牌緩存
          </CardTitle>
          <CardDescription className="text-gray-400">
            一鍵更新整個平台所有卡牌的 SNKRDUNK 價格緩存，確保所有卡牌都顯示最新商品數據
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {taskProgress && (taskProgress.status === "running" || taskProgress.status === "pending") && (
            <div className="space-y-4 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">更新進度</span>
                  <span className="text-white font-medium">
                    {taskProgress.processedItems} / {taskProgress.totalItems}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded">
                  <span className="text-green-400 font-medium">成功: {taskProgress.successCount}</span>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 p-3 rounded">
                  <span className="text-red-400 font-medium">失敗: {taskProgress.failureCount}</span>
                </div>
              </div>

              {/* Current Item */}
              {currentItem && (
                <div className="bg-zinc-900 p-3 rounded border border-zinc-700">
                  <p className="text-xs text-gray-400 mb-1">當前處理</p>
                  <p className="text-sm text-white font-medium">{currentItem.name}</p>
                  <p className="text-xs text-gray-500">卡牌 ID: {currentItem.cardId} | SNKRDUNK ID: {currentItem.snkrdunkId}</p>
                </div>
              )}

              {/* Estimated Time */}
              {estimatedTimeRemaining !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>預估剩餘時間: {Math.ceil(estimatedTimeRemaining)} 分鐘</span>
                </div>
              )}

              {/* Cancel Button */}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelTask}
                disabled={cancelTask.isPending}
                className="w-full"
              >
                {cancelTask.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    取消中...
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    取消任務
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">使用說明</p>
              <p>此操作將清除所有卡牌的現有緩存，並重新抓取所有 SNKRDUNK 商品數據。處理時間取決於卡牌數量，每張卡牌約需 2-3 秒。任務將在後台執行，即使關閉頁面也會繼續。</p>
            </div>
          </div>

          <Button
            variant="default"
            onClick={() => setShowRefreshAllDialog(true)}
            disabled={startRefreshAllCardsCache.isPending || (taskProgress?.status === "running" || taskProgress?.status === "pending")}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700"
          >
            {startRefreshAllCardsCache.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                啟動中...
              </>
            ) : (taskProgress?.status === "running" || taskProgress?.status === "pending") ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                更新中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                更新所有卡牌緩存
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Clear All Cache */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">清除所有緩存</CardTitle>
          <CardDescription className="text-gray-400">
            清除所有卡牌的 SNKRDUNK 價格緩存，強制重新抓取所有數據
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium mb-1">警告</p>
              <p>此操作將清除所有緩存數據，下次訪問時需要重新抓取。建議使用「更新所有卡牌緩存」功能，可以自動重新抓取數據。</p>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowClearAllDialog(true)}
            disabled={clearAllCache.isPending}
            className="w-full md:w-auto"
          >
            {clearAllCache.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                清除中...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                清除所有緩存
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Clear All Cache Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">確認清除所有緩存？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              此操作將清除所有卡牌的 SNKRDUNK 價格緩存。這個操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllCache}
              className="bg-red-600 hover:bg-red-700"
            >
              確認清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Performance Monitoring */}
      <TaskPerformanceChart />

      {/* Task History */}
      <TaskHistory />

      {/* Refresh All Cards Cache Confirmation Dialog */}
      <AlertDialog open={showRefreshAllDialog} onOpenChange={setShowRefreshAllDialog}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">確認更新所有卡牌緩存？</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              此操作將更新所有有 SNKRDUNK 數據源的卡牌緩存。處理時間可能較長（每張卡牌約 2-3 秒），任務將在後台執行，請耐心等待。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white border-zinc-700">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartRefreshAllCardsCache}
              className="bg-blue-600 hover:bg-blue-700"
            >
              確認更新
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
