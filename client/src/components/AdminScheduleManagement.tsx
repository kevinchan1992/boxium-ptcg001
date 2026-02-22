import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, Save, RefreshCw, Play, AlertCircle, CheckCircle2, Pause, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";

export function AdminScheduleManagement() {
  const { t } = useTranslation();
  
  // 獲取當前排程設定
  const { data: schedule, refetch } = trpc.admin.getPriceUpdateSchedule.useQuery();
  
  // 獲取批量更新進度（輪詢）
  const { data: progress } = trpc.admin.getBatchUpdateProgress.useQuery(undefined, {
    refetchInterval: (query) => {
      // 如果正在運行，每 3 秒輪詢一次
      if (query.state.data?.isRunning) {
        return 3000;
      }
      // 否則停止輪詢
      return false;
    },
  });
  
  // 本地狀態
  const [snkrdunkEnabled, setSnkrdunkEnabled] = useState(schedule?.snkrdunkEnabled ?? false);
  const [snkrdunkTime, setSnkrdunkTime] = useState(schedule?.snkrdunkUpdateTime ?? "01:00");
  const [ebayEnabled, setEbayEnabled] = useState(schedule?.ebayEnabled ?? false);
  const [ebayTime, setEbayTime] = useState(schedule?.ebayUpdateTime ?? "01:00");
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  
  // 當 schedule 數據載入時同步更新本地狀態
  useEffect(() => {
    if (schedule) {
      setSnkrdunkEnabled(schedule.snkrdunkEnabled);
      setSnkrdunkTime(schedule.snkrdunkUpdateTime);
      setEbayEnabled(schedule.ebayEnabled);
      setEbayTime(schedule.ebayUpdateTime);
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
      ebayEnabled,
      ebayUpdateTime: ebayTime,
    });
  };
  
  // 手動觸發 SNKRDUNK 批量更新
  const triggerSnkrdunkUpdate = trpc.admin.batchUpdateSnkrdunkPrices.useMutation({
    onSuccess: (data) => {
      toast.success("SNKRDUNK 批量更新已啟動", {
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("啟動失敗", {
        description: error.message,
      });
    },
  });
  
  // 手動觸發 eBay 批量更新
  const triggerEbayUpdate = trpc.admin.batchUpdateEbayPrices.useMutation({
    onSuccess: (data) => {
      toast.success("eBay 批量更新已啟動", {
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("啟動失敗", {
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
  
  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            價格更新排程設定
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs sm:text-sm">
            設定 SNKRDUNK 和 eBay 價格的自動更新時間
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* SNKRDUNK 排程設定 */}
          <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
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
              <div className="space-y-2">
                <Label className="text-white">更新時間（香港時間）</Label>
                <Input
                  type="time"
                  value={snkrdunkTime}
                  onChange={(e) => setSnkrdunkTime(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white max-w-xs"
                />
                <p className="text-xs text-gray-400">
                  最後執行時間：{schedule?.snkrdunkLastExecutedAt 
                    ? new Date(schedule.snkrdunkLastExecutedAt).toLocaleString('zh-TW', { 
                        timeZone: 'Asia/Hong_Kong',
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
                  </div>
                </div>
                <Progress 
                  value={(progress.processedCards / progress.totalCards) * 100} 
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
                    {Math.round((progress.processedCards / progress.totalCards) * 100)}%
                  </span>
                </div>
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
          
          {/* eBay 排程設定 */}
          <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white font-medium text-sm sm:text-base">eBay 批量更新</Label>
                <p className="text-sm text-gray-400">
                  每日自動更新所有卡牌的 eBay 價格
                </p>
              </div>
              <Switch
                checked={ebayEnabled}
                onCheckedChange={setEbayEnabled}
              />
            </div>
            
            {ebayEnabled && (
              <div className="space-y-2">
                <Label className="text-white">更新時間（香港時間）</Label>
                <Input
                  type="time"
                  value={ebayTime}
                  onChange={(e) => setEbayTime(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white max-w-xs"
                />
                <p className="text-xs text-gray-400">
                  最後執行時間：{schedule?.ebayLastExecutedAt 
                    ? new Date(schedule.ebayLastExecutedAt).toLocaleString('zh-TW', { 
                        timeZone: 'Asia/Hong_Kong',
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
                onClick={() => triggerEbayUpdate.mutate()}
                disabled={triggerEbayUpdate.isPending}
                variant="outline"
                className="w-full bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
              >
                {triggerEbayUpdate.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    立即更新所有 eBay 卡牌
                  </>
                )}
              </Button>
            </div>
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
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
