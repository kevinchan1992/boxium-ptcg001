/**
 * 批量更新 SNKRDUNK 價格的進度追蹤機制
 * 使用全局變量追蹤批量更新的進度和狀態（獨立於 eBay 批量更新）
 */

export interface SnkrdunkBatchUpdateProgress {
  isRunning: boolean;
  isPaused: boolean;
  totalCards: number;
  processedCards: number;
  successCount: number;
  failureCount: number;
  totalRecordsAdded: number;
  errors: Array<{
    cardId: number;
    cardName: string;
    error: string;
  }>;
  startTime: number | null;
  endTime: number | null;
}

// 全局進度變量
let snkrdunkBatchUpdateProgress: SnkrdunkBatchUpdateProgress = {
  isRunning: false,
  isPaused: false,
  totalCards: 0,
  processedCards: 0,
  successCount: 0,
  failureCount: 0,
  totalRecordsAdded: 0,
  errors: [],
  startTime: null,
  endTime: null,
};

/**
 * 獲取當前 SNKRDUNK 批量更新進度
 */
export function getSnkrdunkBatchUpdateProgress(): SnkrdunkBatchUpdateProgress {
  return { ...snkrdunkBatchUpdateProgress };
}

/**
 * 初始化 SNKRDUNK 批量更新進度
 */
export function initSnkrdunkBatchUpdateProgress(totalCards: number): void {
  snkrdunkBatchUpdateProgress = {
    isRunning: true,
    isPaused: false,
    totalCards,
    processedCards: 0,
    successCount: 0,
    failureCount: 0,
    totalRecordsAdded: 0,
    errors: [],
    startTime: Date.now(),
    endTime: null,
  };
}

/**
 * 更新處理進度（成功）
 */
export function updateSnkrdunkProgressSuccess(recordsAdded: number): void {
  snkrdunkBatchUpdateProgress.processedCards += 1;
  snkrdunkBatchUpdateProgress.successCount += 1;
  snkrdunkBatchUpdateProgress.totalRecordsAdded += recordsAdded;
}

/**
 * 更新處理進度（失敗）
 */
export function updateSnkrdunkProgressFailure(cardId: number, cardName: string, error: string): void {
  snkrdunkBatchUpdateProgress.processedCards += 1;
  snkrdunkBatchUpdateProgress.failureCount += 1;
  snkrdunkBatchUpdateProgress.errors.push({ cardId, cardName, error });
}

/**
 * 暫停 SNKRDUNK 批量更新
 */
export function pauseSnkrdunkBatchUpdate(): void {
  if (snkrdunkBatchUpdateProgress.isRunning) {
    snkrdunkBatchUpdateProgress.isPaused = true;
    console.log('[SnkrdunkBatchUpdate] Paused');
  }
}

/**
 * 繼續 SNKRDUNK 批量更新
 */
export function resumeSnkrdunkBatchUpdate(): void {
  if (snkrdunkBatchUpdateProgress.isRunning && snkrdunkBatchUpdateProgress.isPaused) {
    snkrdunkBatchUpdateProgress.isPaused = false;
    console.log('[SnkrdunkBatchUpdate] Resumed');
  }
}

/**
 * 檢查是否已暫停
 */
export function isSnkrdunkPaused(): boolean {
  return snkrdunkBatchUpdateProgress.isPaused;
}

/**
 * 完成 SNKRDUNK 批量更新
 */
export function completeSnkrdunkBatchUpdate(): void {
  snkrdunkBatchUpdateProgress.isRunning = false;
  snkrdunkBatchUpdateProgress.isPaused = false;
  snkrdunkBatchUpdateProgress.endTime = Date.now();
  console.log('[SnkrdunkBatchUpdate] Completed');
}

/**
 * 重置 SNKRDUNK 批量更新進度
 */
export function resetSnkrdunkBatchUpdateProgress(): void {
  snkrdunkBatchUpdateProgress = {
    isRunning: false,
    isPaused: false,
    totalCards: 0,
    processedCards: 0,
    successCount: 0,
    failureCount: 0,
    totalRecordsAdded: 0,
    errors: [],
    startTime: null,
    endTime: null,
  };
}
