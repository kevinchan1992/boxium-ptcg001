import * as cron from 'node-cron';
import { getPriceUpdateSchedule, updateSnkrdunkLastExecutedAt, addScheduleExecutionHistory, updateScheduleExecutionHistory } from './db';
import { executeSnkrdunkBatchUpdate } from './batchUpdateExecutor';

let snkrdunkCronJob: ReturnType<typeof cron.schedule> | null = null;

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
        scheduleType: 'snkrdunk_update',
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
 * Restart scheduler with updated configuration
 */
export async function restartPriceUpdateScheduler() {
  console.log('[PriceUpdateScheduler] Restarting price update scheduler...');
  
  // Stop all existing jobs
  stopSnkrdunkScheduler();
  
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
  };
}

/**
 * Trending cards calculation scheduler
 * Runs daily at 06:00 HKT to calculate TOP 5 trending cards
 */
let trendingCardsCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start trending cards calculation scheduler
 * Runs daily at 06:00 HKT (Hong Kong Time)
 */
export function startTrendingCardsScheduler() {
  // Stop existing job if any
  if (trendingCardsCronJob) {
    trendingCardsCronJob.stop();
  }

  // Cron expression for 06:00 daily (Asia/Hong_Kong timezone)
  // Format: minute hour day month weekday
  const cronExpression = '0 6 * * *'; // Every day at 06:00

  console.log(`[TrendingCardsScheduler] Starting trending cards scheduler with cron: ${cronExpression} (06:00 HKT daily)`);

  trendingCardsCronJob = cron.schedule(
    cronExpression,
    async () => {
      console.log('[TrendingCardsScheduler] Executing scheduled trending cards calculation...');
      const startTime = new Date();
      let historyId: number | null = null;
      
      try {
        // Create execution history record
        historyId = await addScheduleExecutionHistory({
          scheduleType: 'trending_update',
          executionType: 'scheduled',
          status: 'running',
          startedAt: startTime,
        });
        
        // Import calculateAndCacheTrendingCards from db
        const { calculateAndCacheTrendingCards } = await import('./db');
        
        // Execute calculation
        await calculateAndCacheTrendingCards();
        
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        // Update execution history with success
        if (historyId !== null) {
          await updateScheduleExecutionHistory(historyId, {
            status: 'completed',
            completedAt: endTime,
            durationMs: duration,
          });
        }
        
        console.log(`[TrendingCardsScheduler] Trending cards calculation completed successfully in ${duration}ms`);
      } catch (error) {
        console.error('[TrendingCardsScheduler] Trending cards calculation failed:', error);
        
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
    },
    {
      timezone: 'Asia/Hong_Kong', // Use Hong Kong timezone
    }
  );

  console.log('[TrendingCardsScheduler] Trending cards scheduler started successfully');
}

/**
 * Stop trending cards calculation scheduler
 */
export function stopTrendingCardsScheduler() {
  if (trendingCardsCronJob) {
    trendingCardsCronJob.stop();
    trendingCardsCronJob = null;
    console.log('[TrendingCardsScheduler] Trending cards scheduler stopped');
  }
}
