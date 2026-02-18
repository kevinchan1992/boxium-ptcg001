import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Pause, Play, CheckCircle, XCircle } from "lucide-react";

interface BatchTaskProgressBarProps {
  taskType: 'eBay' | 'SNKRDUNK';
  progress: {
    taskId: number;
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
    totalItems: number;
    processedItems: number;
    successCount: number;
    failureCount: number;
    progress: number;
    errors: Array<{ cardId: number; cardName: string; error: string }>;
  } | null;
  onPause: () => void;
  onResume: () => void;
  isPauseLoading?: boolean;
  isResumeLoading?: boolean;
}

export function BatchTaskProgressBar({
  taskType,
  progress,
  onPause,
  onResume,
  isPauseLoading = false,
  isResumeLoading = false,
}: BatchTaskProgressBarProps) {
  if (!progress) {
    return null;
  }

  const isRunning = progress.status === 'running';
  const isPaused = progress.status === 'paused';
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            {isPaused && <Pause className="w-4 h-4 text-yellow-600" />}
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
            {isFailed && <XCircle className="w-4 h-4 text-red-600" />}
            <h3 className="font-semibold text-sm">
              {taskType} 批量更新
              {isRunning && " - 進行中"}
              {isPaused && " - 已暫停"}
              {isCompleted && " - 已完成"}
              {isFailed && " - 失敗"}
            </h3>
          </div>
          
          {/* Pause/Resume Button */}
          {(isRunning || isPaused) && (
            <Button
              size="sm"
              variant="outline"
              onClick={isPaused ? onResume : onPause}
              disabled={isPauseLoading || isResumeLoading}
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
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress.progress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>
              進度: {progress.processedItems} / {progress.totalItems} ({progress.progress}%)
            </span>
            <span>
              成功: {progress.successCount} | 失敗: {progress.failureCount}
            </span>
          </div>
        </div>

        {/* Error Summary */}
        {progress.errors.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-red-600 hover:text-red-700">
              查看 {progress.errors.length} 個錯誤
            </summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {progress.errors.slice(0, 10).map((error, index) => (
                <div key={index} className="text-gray-700 dark:text-gray-300 pl-2 border-l-2 border-red-300">
                  <span className="font-medium">{error.cardName}</span>: {error.error}
                </div>
              ))}
              {progress.errors.length > 10 && (
                <div className="text-gray-500 pl-2">
                  還有 {progress.errors.length - 10} 個錯誤...
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}
