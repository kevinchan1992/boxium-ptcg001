/**
 * 批量更新 eBay 價格的進度追蹤機制
 * 使用全局變量追蹤批量更新的進度和狀態
 */

export interface BatchUpdateProgress {
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
let batchUpdateProgress: BatchUpdateProgress = {
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
 * 獲取當前批量更新進度
 */
export function getBatchUpdateProgress(): BatchUpdateProgress {
  return { ...batchUpdateProgress };
}

/**
 * 初始化批量更新進度
 */
export function initBatchUpdateProgress(totalCards: number): void {
  batchUpdateProgress = {
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
export function updateProgressSuccess(recordsAdded: number): void {
  batchUpdateProgress.processedCards += 1;
  batchUpdateProgress.successCount += 1;
  batchUpdateProgress.totalRecordsAdded += recordsAdded;
}

/**
 * 更新處理進度（失敗）
 */
export function updateProgressFailure(cardId: number, cardName: string, error: string): void {
  batchUpdateProgress.processedCards += 1;
  batchUpdateProgress.failureCount += 1;
  batchUpdateProgress.errors.push({ cardId, cardName, error });
}

/**
 * 暫停批量更新
 */
export function pauseBatchUpdate(): void {
  if (batchUpdateProgress.isRunning) {
    batchUpdateProgress.isPaused = true;
    console.log('[BatchUpdate] Paused');
  }
}

/**
 * 繼續批量更新
 */
export function resumeBatchUpdate(): void {
  if (batchUpdateProgress.isRunning && batchUpdateProgress.isPaused) {
    batchUpdateProgress.isPaused = false;
    console.log('[BatchUpdate] Resumed');
  }
}

/**
 * 檢查是否已暫停
 */
export function isPaused(): boolean {
  return batchUpdateProgress.isPaused;
}

/**
 * 完成批量更新
 */
export function completeBatchUpdate(): void {
  batchUpdateProgress.isRunning = false;
  batchUpdateProgress.isPaused = false;
  batchUpdateProgress.endTime = Date.now();
  console.log('[BatchUpdate] Completed');
}

/**
 * 重置批量更新進度
 */
export function resetBatchUpdateProgress(): void {
  batchUpdateProgress = {
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
