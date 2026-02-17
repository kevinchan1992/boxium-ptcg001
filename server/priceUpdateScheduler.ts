import * as cron from 'node-cron';
import { getPriceUpdateSchedule, updateSnkrdunkLastExecutedAt, updateEbayLastExecutedAt, addScheduleExecutionHistory, updateScheduleExecutionHistory } from './db';
import { executeSnkrdunkBatchUpdate, executeEbayBatchUpdate } from './batchUpdateExecutor';

let snkrdunkCronJob: ReturnType<typeof cron.schedule> | null = null;
let ebayCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Initialize price update scheduler
 * This function should be called when the server starts
 */
export async function initPriceUpdateScheduler() {
  console.log('[PriceUpdateScheduler] Initializing price update scheduler...');
  
  try {
    // Get current schedule configuration
    const config = await getPriceUpdateSchedule();
    
    if (!config) {
      console.warn('[PriceUpdateScheduler] No schedule configuration found');
      return;
    }

    // Start SNKRDUNK scheduler if enabled
    if (config.snkrdunkEnabled) {
      startSnkrdunkScheduler(config.snkrdunkUpdateTime);
    }

    // Start eBay scheduler if enabled
    if (config.ebayEnabled) {
      startEbayScheduler(config.ebayUpdateTime);
    }

    console.log('[PriceUpdateScheduler] Price update scheduler initialized successfully');
  } catch (error) {
    console.error('[PriceUpdateScheduler] Failed to initialize scheduler:', error);
  }
}

/**
 * Start SNKRDUNK price update scheduler
 * @param updateTime - Time in HH:mm format (e.g., "09:00")
 */
function startSnkrdunkScheduler(updateTime: string) {
  // Stop existing job if any
  if (snkrdunkCronJob) {
    snkrdunkCronJob.stop();
  }

  const [hour, minute] = updateTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`; // Every day at specified time

  console.log(`[PriceUpdateScheduler] Starting SNKRDUNK scheduler with cron: ${cronExpression} (${updateTime})`);

  snkrdunkCronJob = cron.schedule(cronExpression, async () => {
    console.log('[PriceUpdateScheduler] Executing scheduled SNKRDUNK price update...');
    const startTime = new Date();
    let historyId: number | null = null;
    
    try {
      // Create execution history record
      historyId = await addScheduleExecutionHistory({
        scheduleType: 'snkrdunk_daily_update',
        executionType: 'scheduled',
        status: 'running',
        startedAt: startTime,
      });
      
      // Execute SNKRDUNK batch update
      const result = await executeSnkrdunkBatchUpdate();
      await updateSnkrdunkLastExecutedAt();
      
      // Update execution history with success
      const endTime = new Date();
      if (historyId !== null) {
        await updateScheduleExecutionHistory(historyId, {
          status: 'completed',
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          snkrdunkSuccessCount: result.successCount || 0,
          snkrdunkFailureCount: result.failureCount || 0,
          snkrdunkRecordsAdded: result.totalRecordsAdded || 0,
        });
      }
      
      console.log('[PriceUpdateScheduler] SNKRDUNK price update completed successfully');
    } catch (error) {
      console.error('[PriceUpdateScheduler] SNKRDUNK price update failed:', error);
      
      // Update execution history with failure
      if (historyId !== null) {
        const endTime = new Date();
        await updateScheduleExecutionHistory(historyId, {
          status: 'failed',
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, {
    timezone: 'Asia/Hong_Kong'
  });

  snkrdunkCronJob.start();
  console.log('[PriceUpdateScheduler] SNKRDUNK scheduler started');
}

/**
 * Start eBay price update scheduler
 * @param updateTime - Time in HH:mm format (e.g., "21:00")
 */
function startEbayScheduler(updateTime: string) {
  // Stop existing job if any
  if (ebayCronJob) {
    ebayCronJob.stop();
  }

  const [hour, minute] = updateTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`; // Every day at specified time

  console.log(`[PriceUpdateScheduler] Starting eBay scheduler with cron: ${cronExpression} (${updateTime})`);

  ebayCronJob = cron.schedule(cronExpression, async () => {
    console.log('[PriceUpdateScheduler] Executing scheduled eBay price update...');
    const startTime = new Date();
    let historyId: number | null = null;
    
    try {
      // Create execution history record
      historyId = await addScheduleExecutionHistory({
        scheduleType: 'ebay_daily_update',
        executionType: 'scheduled',
        status: 'running',
        startedAt: startTime,
      });
      
      // Execute eBay batch update
      const result = await executeEbayBatchUpdate();
      await updateEbayLastExecutedAt();
      
      // Update execution history with success
      const endTime = new Date();
      if (historyId !== null) {
        await updateScheduleExecutionHistory(historyId, {
          status: 'completed',
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          ebaySuccessCount: result.successCount || 0,
          ebayFailureCount: result.failureCount || 0,
          ebayRecordsAdded: result.totalRecordsAdded || 0,
        });
      }
      
      console.log('[PriceUpdateScheduler] eBay price update completed successfully');
    } catch (error) {
      console.error('[PriceUpdateScheduler] eBay price update failed:', error);
      
      // Update execution history with failure
      if (historyId !== null) {
        const endTime = new Date();
        await updateScheduleExecutionHistory(historyId, {
          status: 'failed',
          completedAt: endTime,
          durationMs: endTime.getTime() - startTime.getTime(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, {
    timezone: 'Asia/Hong_Kong'
  });

  ebayCronJob.start();
  console.log('[PriceUpdateScheduler] eBay scheduler started');
}

/**
 * Stop SNKRDUNK scheduler
 */
export function stopSnkrdunkScheduler() {
  if (snkrdunkCronJob) {
    snkrdunkCronJob.stop();
    snkrdunkCronJob = null;
    console.log('[PriceUpdateScheduler] SNKRDUNK scheduler stopped');
  }
}

/**
 * Stop eBay scheduler
 */
export function stopEbayScheduler() {
  if (ebayCronJob) {
    ebayCronJob.stop();
    ebayCronJob = null;
    console.log('[PriceUpdateScheduler] eBay scheduler stopped');
  }
}

/**
 * Restart scheduler with updated configuration
 */
export async function restartPriceUpdateScheduler() {
  console.log('[PriceUpdateScheduler] Restarting price update scheduler...');
  
  // Stop all existing jobs
  stopSnkrdunkScheduler();
  stopEbayScheduler();
  
  // Reinitialize with new configuration
  await initPriceUpdateScheduler();
  
  console.log('[PriceUpdateScheduler] Price update scheduler restarted');
}

/**
 * Get scheduler status
 */
export function getPriceUpdateSchedulerStatus() {
  return {
    snkrdunkSchedulerRunning: snkrdunkCronJob !== null,
    ebaySchedulerRunning: ebayCronJob !== null,
  };
}
