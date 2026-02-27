/**
 * 批量更新排程器
 * 使用 node-cron 定時執行批量更新任務
 */

import * as cron from "node-cron";
import * as db from "./db";
import { executePersistentSnkrdunkBatchUpdate } from "./persistentSnkrdunkBatchUpdate";

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * 啟動排程任務
 */
export async function startScheduler() {
  try {
    // 獲取排程設定
    const config = await db.getScheduleConfig("batch_update_daily");
    
    if (!config) {
      console.log("[BatchUpdateScheduler] No schedule config found, skipping scheduler start");
      return;
    }

    if (!config.enabled) {
      console.log("[BatchUpdateScheduler] Schedule is disabled, skipping scheduler start");
      return;
    }

    // 如果已有排程任務在運行，先停止
    if (scheduledTask) {
      scheduledTask.stop();
      scheduledTask = null;
    }

    // 創建新的排程任務
    // cron 表達式格式：秒 分 時 日 月 星期
    // '0 1 * * *' = 每日凌晨 01:00（香港時間）
    scheduledTask = cron.schedule(
      config.cronExpression,
      async () => {
        console.log("[BatchUpdateScheduler] Starting scheduled batch update");
        await executeBatchUpdate("scheduled");
      },
      {
        timezone: config.timezone,
      }
    );

    // 計算下次執行時間
    const nextExecutionAt = getNextExecutionTime(config.cronExpression, config.timezone);
    await db.updateScheduleExecutionTimes(
      "batch_update_daily",
      config.lastExecutedAt || new Date(),
      nextExecutionAt
    );

    console.log(`[BatchUpdateScheduler] Scheduler started with cron expression: ${config.cronExpression}`);
    console.log(`[BatchUpdateScheduler] Next execution at: ${nextExecutionAt.toISOString()}`);
  } catch (error: any) {
    console.error(`[BatchUpdateScheduler] Failed to start scheduler: ${error.message}`);
  }
}

/**
 * 停止排程任務
 */
export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[BatchUpdateScheduler] Scheduler stopped");
  }
}

/**
 * 重新啟動排程任務
 */
export async function restartScheduler() {
  stopScheduler();
  await startScheduler();
}

/**
 * 執行批量更新
 */
async function executeBatchUpdate(executionType: "scheduled" | "manual") {
  const startTime = Date.now();
  
  try {
    // 創建執行歷史記錄
    const historyId = await db.addScheduleExecutionHistory({
      scheduleType: "batch_update_daily",
      executionType,
      status: "running",
      startedAt: new Date(),
    });

    console.log(`[BatchUpdateScheduler] Starting ${executionType} batch update (history ID: ${historyId})`);

    // 使用持久化版本的批量更新（支持防限流、指數退避、智能跳過）
    const { taskId, totalCards, skippedCards } = await executePersistentSnkrdunkBatchUpdate();
    console.log(`[BatchUpdateScheduler] SNKRDUNK persistent batch update started: taskId=${taskId}, totalCards=${totalCards}, skippedCards=${skippedCards}`);

    // 更新執行歷史（任務已在後台運行，這裡只記錄啟動狀態）
    const durationMs = Date.now() - startTime;
    await db.updateScheduleExecutionHistory(historyId, {
      status: "completed",
      ebaySuccessCount: 0,
      ebayFailureCount: 0,
      ebayRecordsAdded: 0,
      snkrdunkSuccessCount: totalCards,
      snkrdunkFailureCount: 0,
      snkrdunkRecordsAdded: 0,
      completedAt: new Date(),
      durationMs,
    });

    // 更新排程設定的執行時間
    const config = await db.getScheduleConfig("batch_update_daily");
    if (config) {
      const nextExecutionAt = getNextExecutionTime(config.cronExpression, config.timezone);
      await db.updateScheduleExecutionTimes(
        "batch_update_daily",
        new Date(),
        nextExecutionAt
      );
    }

    console.log(`[BatchUpdateScheduler] ${executionType} batch update completed in ${durationMs}ms`);
  } catch (error: any) {
    console.error(`[BatchUpdateScheduler] ${executionType} batch update failed: ${error.message}`);
    
    // 記錄失敗
    try {
      const historyId = await db.addScheduleExecutionHistory({
        scheduleType: "batch_update_daily",
        executionType,
        status: "failed",
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });
      console.log(`[BatchUpdateScheduler] Failure recorded (history ID: ${historyId})`);
    } catch (dbError: any) {
      console.error(`[BatchUpdateScheduler] Failed to record failure: ${dbError.message}`);
    }
  }
}

/**
 * 計算下次執行時間
 */
function getNextExecutionTime(cronExpression: string, timezone: string): Date {
  try {
    // 使用 node-cron 的內部邏輯計算下次執行時間
    // 簡化實現：假設每日 01:00 執行
    const now = new Date();
    const next = new Date(now);
    next.setHours(1, 0, 0, 0);
    
    // 如果今天的 01:00 已經過了，設定為明天的 01:00
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  } catch (error: any) {
    console.error(`[BatchUpdateScheduler] Failed to calculate next execution time: ${error.message}`);
    // 回退到 24 小時後
    const next = new Date();
    next.setHours(next.getHours() + 24);
    return next;
  }
}

// 在服務器啟動時自動啟動排程器
startScheduler().catch(error => {
  console.error(`[BatchUpdateScheduler] Failed to auto-start scheduler: ${error.message}`);
});
