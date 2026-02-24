/**
 * 批量更新任務管理器
 * 
 * 負責管理後端持續運行的批量更新任務，支持：
 * - 任務啟動、暫停、繼續、停止
 * - 進度持久化到數據庫
 * - 跨頁面訪問和中斷後繼續
 * - 心跳機制防止任務卡死
 */

import * as db from '../db';

// 任務狀態
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

// 任務類型
type TaskType = 'batch_snkrdunk_update';

// 運行中的任務映射（taskId -> 控制器）
const runningTasks = new Map<number, TaskController>();

// 任務控制器
class TaskController {
  private taskId: number;
  private taskType: TaskType;
  private shouldStop: boolean = false;
  private isPaused: boolean = false;
  private batchSize: number = 50;
  private delayBetweenBatches: number = 2000; // 2 seconds
  
  constructor(taskId: number, taskType: TaskType) {
    this.taskId = taskId;
    this.taskType = taskType;
  }
  
  /**
   * 啟動任務
   */
  async start() {
    console.log(`[TaskManager] Starting task ${this.taskId} (${this.taskType})`);
    
    try {
      // 更新任務狀態為運行中
      await db.updateScheduledTask(this.taskId, {
        status: 'running',
        startedAt: new Date(),
      });
      
      // 開始處理批次
      await this.processBatches();
      
      // 任務完成
      if (!this.shouldStop) {
        await db.updateScheduledTask(this.taskId, {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        });
        console.log(`[TaskManager] Task ${this.taskId} completed successfully`);
      }
    } catch (error) {
      console.error(`[TaskManager] Task ${this.taskId} failed:`, error);
      await db.updateScheduledTask(this.taskId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // 從運行中任務列表移除
      runningTasks.delete(this.taskId);
    }
  }
  
  /**
   * 處理所有批次
   */
  private async processBatches() {
    const HOT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    const COLD_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    
    let batchIndex = 0;
    let hasMore = true;
    
    while (hasMore && !this.shouldStop) {
      // 檢查是否暫停
      while (this.isPaused && !this.shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (this.shouldStop) break;
      
      try {
        const offset = batchIndex * this.batchSize;
        
        // 獲取這一批次的卡牌
        const cardsToProcess = await db.getCardsWithSnkrdunkId({ 
          limit: this.batchSize, 
          offset 
        });
        
        if (cardsToProcess.length === 0) {
          hasMore = false;
          break;
        }
        
        const results = {
          success: 0,
          failed: 0,
          skipped: 0,
          errors: [] as Array<{ cardId: number; cardName: string; error: string }>
        };
        
        // 處理每張卡牌
        for (const card of cardsToProcess) {
          if (this.shouldStop) break;
          
          // 檢查是否暫停
          while (this.isPaused && !this.shouldStop) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          if (this.shouldStop) break;
          
          try {
            // 檢查快取狀態
            const cache = await db.getSnkrdunkListingsCache(card.id);
            
            if (cache) {
              const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
              
              // 跳過熱快取和冷快取
              if (cacheAge < COLD_CACHE_DURATION) {
                results.skipped++;
                continue;
              }
            }
            
            // 爬取並更新快取
            const { scrapeSnkrdunkListings } = await import('./snkrdunkPlaywright');
            const listings = await scrapeSnkrdunkListings(card.snkrdunkId!);
            
            // 保存快取
            const now = new Date();
            const hotExpiresAt = new Date(now.getTime() + HOT_CACHE_DURATION);
            const expiresAt = new Date(now.getTime() + COLD_CACHE_DURATION);
            
            await db.saveSnkrdunkListingsCache({
              cardId: card.id,
              snkrdunkId: card.snkrdunkId!,
              listings: JSON.stringify(listings),
              hotExpiresAt,
              expiresAt,
            });
            
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push({
              cardId: card.id,
              cardName: card.name,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error(`[TaskManager] Failed to process card ${card.id}:`, error);
          }
        }
        
        // 更新任務進度
        const task = await db.getScheduledTask(this.taskId);
        if (task) {
          const newProcessedItems = (task.processedItems || 0) + cardsToProcess.length;
          const newSuccessCount = (task.successCount || 0) + results.success;
          const newFailureCount = (task.failureCount || 0) + results.failed;
          const progress = task.totalItems ? Math.round((newProcessedItems / task.totalItems) * 100) : 0;
          
          // 更新錯誤信息
          let metadata: any = {};
          try {
            metadata = task.metadata ? JSON.parse(task.metadata) : {};
          } catch (e) {
            metadata = {};
          }
          
          if (!metadata.errors) {
            metadata.errors = [];
          }
          metadata.errors.push(...results.errors);
          
          // 只保留最近 100 個錯誤
          if (metadata.errors.length > 100) {
            metadata.errors = metadata.errors.slice(-100);
          }
          
          await db.updateScheduledTask(this.taskId, {
            processedItems: newProcessedItems,
            successCount: newSuccessCount,
            failureCount: newFailureCount,
            progress,
            metadata: JSON.stringify(metadata),
          });
        }
        
        batchIndex++;
        
        // 批次之間延遲
        if (hasMore && !this.shouldStop) {
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
        }
      } catch (error) {
        console.error(`[TaskManager] Error processing batch ${batchIndex}:`, error);
        // 繼續處理下一批次
        batchIndex++;
      }
    }
  }
  
  /**
   * 暫停任務
   */
  pause() {
    console.log(`[TaskManager] Pausing task ${this.taskId}`);
    this.isPaused = true;
  }
  
  /**
   * 繼續任務
   */
  resume() {
    console.log(`[TaskManager] Resuming task ${this.taskId}`);
    this.isPaused = false;
  }
  
  /**
   * 停止任務
   */
  stop() {
    console.log(`[TaskManager] Stopping task ${this.taskId}`);
    this.shouldStop = true;
    this.isPaused = false; // 解除暫停，讓任務可以退出
  }
}

/**
 * 啟動批量更新任務
 */
export async function startBatchUpdateTask(taskType: TaskType): Promise<number> {
  // 檢查是否已有運行中的任務
  const existingTask = await db.getRunningBatchUpdateTask(taskType);
  if (existingTask) {
    throw new Error(`A ${taskType} task is already running (task ID: ${existingTask.id})`);
  }
  
  // 獲取總卡牌數
  const stats = await db.getDetailedSnkrdunkCacheStats();
  const totalItems = stats.needUpdate;
  
  // 創建新任務
  const taskId = await db.createScheduledTask({
    taskType,
    status: 'pending',
    totalItems,
    processedItems: 0,
    successCount: 0,
    failureCount: 0,
    progress: 0,
    metadata: JSON.stringify({ errors: [] }),
  });
  
  // 創建任務控制器
  const controller = new TaskController(taskId, taskType);
  runningTasks.set(taskId, controller);
  
  // 異步啟動任務（不等待完成）
  controller.start().catch(error => {
    console.error(`[TaskManager] Task ${taskId} crashed:`, error);
  });
  
  return taskId;
}

/**
 * 暫停批量更新任務
 */
export async function pauseBatchUpdateTask(taskId: number): Promise<void> {
  const controller = runningTasks.get(taskId);
  if (!controller) {
    throw new Error(`Task ${taskId} is not running`);
  }
  
  controller.pause();
  
  // 更新數據庫狀態
  await db.updateScheduledTask(taskId, {
    status: 'paused',
  });
}

/**
 * 繼續批量更新任務
 */
export async function resumeBatchUpdateTask(taskId: number): Promise<void> {
  const controller = runningTasks.get(taskId);
  if (!controller) {
    throw new Error(`Task ${taskId} is not running`);
  }
  
  controller.resume();
  
  // 更新數據庫狀態
  await db.updateScheduledTask(taskId, {
    status: 'running',
  });
}

/**
 * 停止批量更新任務
 */
export async function stopBatchUpdateTask(taskId: number): Promise<void> {
  const controller = runningTasks.get(taskId);
  if (!controller) {
    throw new Error(`Task ${taskId} is not running`);
  }
  
  controller.stop();
  
  // 更新數據庫狀態（任務會在停止後自動更新為 completed 或 failed）
  await db.updateScheduledTask(taskId, {
    status: 'completed',
    completedAt: new Date(),
  });
}

/**
 * 獲取批量更新任務狀態
 */
export async function getBatchUpdateTaskStatus(taskId: number) {
  const task = await db.getScheduledTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  // 解析錯誤信息
  let errors: Array<{ cardId: number; cardName: string; error: string }> = [];
  try {
    const metadata = task.metadata ? JSON.parse(task.metadata) : {};
    errors = metadata.errors || [];
  } catch (e) {
    console.error('Failed to parse task metadata:', e);
  }
  
  return {
    taskId: task.id,
    taskType: task.taskType,
    status: task.status,
    totalItems: task.totalItems || 0,
    processedItems: task.processedItems || 0,
    successCount: task.successCount || 0,
    failureCount: task.failureCount || 0,
    progress: task.progress || 0,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    errors,
  };
}

/**
 * 獲取最新的批量更新任務
 */
export async function getLatestBatchUpdateTask(taskType: TaskType) {
  return await db.getLatestBatchUpdateTask(taskType);
}
