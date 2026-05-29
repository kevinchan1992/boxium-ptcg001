import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Pause, Play, CheckCircle, XCircle, X, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";

interface BatchTaskProgressBarProps {
  taskType: 'SNKRDUNK';
  progress: {
    taskId: number;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
    totalItems: number;
    processedItems: number;
    successCount: number;
    failureCount: number;
    progress: number;
    errors: Array<{ cardId: number; cardName: string; error: string }>;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  onPause: () => void;
  onResume: () => void;
  onCancel?: () => void;
  isPauseLoading?: boolean;
  isResumeLoading?: boolean;
}

export function BatchTaskProgressBar({
  taskType,
  progress,
  onPause,
  onResume,
  onCancel,
  isPauseLoading = false,
  isResumeLoading = false,
}: BatchTaskProgressBarProps) {
  const { t } = useTranslation();
  const [startTime] = useState(Date.now());
  const [estimatedTime, setEstimatedTime] = useState<string>("");
  const [processingSpeed, setProcessingSpeed] = useState<string>("");
  const [showCelebration, setShowCelebration] = useState(false);

  if (!progress) {
    return null;
  }

  const isRunning = progress.status === 'running';
  const isPaused = progress.status === 'paused';
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  // 計算預估剩餘時間和處理速度
  useEffect(() => {
    if (isRunning && progress.processedItems > 0) {
      const elapsedMs = Date.now() - startTime;
      const elapsedMin = elapsedMs / 60000;
      const speed = progress.processedItems / elapsedMin;
      const remainingItems = progress.totalItems - progress.processedItems;
      const estimatedMin = remainingItems / speed;

      setProcessingSpeed(`${speed.toFixed(1)} 張/分鐘`);

      if (estimatedMin < 1) {
        setEstimatedTime("少於 1 分鐘");
      } else if (estimatedMin < 60) {
        setEstimatedTime(`約 ${Math.ceil(estimatedMin)} 分鐘`);
      } else {
        const hours = Math.floor(estimatedMin / 60);
        const mins = Math.ceil(estimatedMin % 60);
        setEstimatedTime(`約 ${hours} 小時 ${mins} 分鐘`);
      }
    }
  }, [progress.processedItems, isRunning, startTime, progress.totalItems]);

  // 完成時顯示慶祝動畫
  useEffect(() => {
    if (isCompleted && !showCelebration) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }, [isCompleted]);

  // SNKRDUNK 配色方案
  const colorScheme = {
    bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950',
    border: 'border-blue-200 dark:border-blue-800',
    progress: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    icon: 'text-blue-600',
    pulse: 'animate-pulse'
  };

  return (
    <Card className={`p-4 ${colorScheme.bg} ${colorScheme.border} border-2 transition-all duration-300 ${showCelebration ? 'scale-105 shadow-2xl' : 'shadow-md'}`}>
      <div className="space-y-3">
        {/* Header with Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status Icon */}
            <div className={isRunning ? colorScheme.pulse : ''}>
              {isRunning && <Loader2 className={`w-5 h-5 animate-spin ${colorScheme.icon}`} />}
              {isPaused && <Pause className="w-5 h-5 text-yellow-600" />}
              {isCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
              {isFailed && <XCircle className="w-5 h-5 text-red-600" />}
            </div>
            
            {/* Title and Status */}
            <div>
              <h3 className="font-bold text-base">
                {taskType} {t("batch.batchUpdate")}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {isRunning && t("batch.processing")}
                {isPaused && t("batch.paused")}
                {isCompleted && t("batch.completed")}
                {isFailed && t("batch.failed")}
              </p>
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {(isRunning || isPaused) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={isPaused ? onResume : onPause}
                  disabled={isPauseLoading || isResumeLoading}
                  className="hover:scale-105 transition-transform"
                >
                  {isPauseLoading || isResumeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isPaused ? (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      繼續
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-1" />
                      暫停
                    </>
                  )}
                </Button>
                {onCancel && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onCancel}
                    className="hover:scale-105 transition-transform"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {t("common.cancel")}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Large Progress Percentage */}
        <div className="flex items-center justify-between">
          <div className="text-4xl font-bold text-gray-800 dark:text-gray-200">
            {progress.progress}%
          </div>
          {isRunning && (
            <div className="text-right text-sm text-gray-600 dark:text-gray-400">
              <div>⚡ {processingSpeed}</div>
              <div>⏱️ 剩餘 {estimatedTime}</div>
            </div>
          )}
        </div>

        {/* Progress Bar with Animation */}
        <div className="space-y-2">
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${colorScheme.progress} transition-all duration-500 ease-out ${isRunning ? 'animate-pulse' : ''}`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              📊 進度: {progress.processedItems} / {progress.totalItems}
            </span>
            <span>
              ✅ {progress.successCount} | ❌ {progress.failureCount}
            </span>
          </div>
        </div>

        {/* Error Summary with Better Design */}
        {progress.errors.length > 0 && (
          <details className="text-xs bg-red-50 dark:bg-red-950 rounded-lg p-3 border border-red-200 dark:border-red-800">
            <summary className="cursor-pointer text-red-700 dark:text-red-400 font-semibold flex items-center gap-2 hover:text-red-800 dark:hover:text-red-300">
              <AlertCircle className="w-4 h-4" />
              {t("batch.error")}詳情 ({progress.errors.length} 個)
            </summary>
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {progress.errors.slice(0, 10).map((error, index) => (
                <div key={index} className="bg-white dark:bg-gray-900 p-2 rounded border-l-4 border-red-500">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{error.cardName}</div>
                  <div className="text-red-600 dark:text-red-400 text-xs mt-1">{error.error}</div>
                </div>
              ))}
              {progress.errors.length > 10 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-2">
                  還有 {progress.errors.length - 10} 個{t("batch.error")}未顯示
                </div>
              )}
            </div>
          </details>
        )}

        {/* Celebration Message */}
        {showCelebration && isCompleted && (
          <div className="text-center py-2 bg-green-100 dark:bg-green-900 rounded-lg animate-bounce">
            <p className="text-green-700 dark:text-green-300 font-semibold">
              🎉 批量更新完成！{t("batch.success")}處理 {progress.successCount} 張卡牌
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
