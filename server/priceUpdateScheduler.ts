import * as cron from 'node-cron';
import { getPriceUpdateSchedule, updateSnkrdunkLastExecutedAt, addScheduleExecutionHistory, updateScheduleExecutionHistory } from './db';
import { executePersistentSnkrdunkBatchUpdate } from './persistentSnkrdunkBatchUpdate';

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
      
      // Execute SNKRDUNK batch update (persistent version for better progress tracking)
      const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();
      console.log(`[PriceUpdateScheduler] Started persistent SNKRDUNK batch update, task ID: ${taskId}, total cards: ${totalCards}`);
      
      // Note: The persistent batch update runs in the background
      // We'll mark this execution as completed immediately, and the task manager will track the actual progress
      const result = { successCount: 0, failureCount: 0, totalRecordsAdded: 0 };
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

// ============================================================
// Auto-Complete Orders Cron Job
// Runs every hour: auto-complete shipped orders where autoCompleteAt has passed
// ============================================================
let autoCompleteOrdersCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startAutoCompleteOrdersScheduler() {
  if (autoCompleteOrdersCronJob) return;
  autoCompleteOrdersCronJob = cron.schedule(
    '0 * * * *', // Every hour at :00
    async () => {
      try {
        const { getDb, getSellerProfileByUserId } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lte, isNotNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        const overdueOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'shipped'),
              isNotNull(marketplaceOrders.autoCompleteAt),
              lte(marketplaceOrders.autoCompleteAt, now)
            )
          )
          .limit(100);

        if (overdueOrders.length === 0) return;
        console.log(`[AutoComplete] Found ${overdueOrders.length} orders to auto-complete`);

        for (const order of overdueOrders) {
          try {
            await db.update(marketplaceOrders)
              .set({ orderStatus: 'completed', buyerConfirmedAt: now, payoutStatus: 'processing' })
              .where(eq(marketplaceOrders.id, order.id));

            // Notify buyer: order auto-completed
            await createNotification({
              userId: order.buyerId,
              type: 'trade',
              title: '訂單已自動完成 ✅',
              body: `訂單 ${order.orderNo} 已超過 14 天未確認收貨，系統已自動完成訂單。如有問題請聯絡客服。`,
              linkUrl: '/orders',
            }).catch(() => {});

            // Trigger Stripe Transfer payout if C2C order
            if (order.sellerType === 'seller' && order.sellerId) {
              const sellerProfile = await getSellerProfileByUserId(order.sellerId);
              if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus === 'active') {
                try {
                  const Stripe = (await import('stripe')).default;
                  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
                  const receivable = Math.round(parseFloat(order.sellerReceivableHkd as string) * 100);
                  const transfer = await stripe.transfers.create({
                    amount: receivable,
                    currency: 'hkd',
                    destination: sellerProfile.stripeConnectId,
                    metadata: { order_no: order.orderNo, order_id: order.id.toString(), auto_completed: 'true' },
                  });
                  await db.update(marketplaceOrders)
                    .set({ payoutStatus: 'paid', stripeTransferId: transfer.id })
                    .where(eq(marketplaceOrders.id, order.id));
                  // Notify seller: Stripe payout transferred
                  await createNotification({
                    userId: order.sellerId,
                    type: 'trade',
                    title: '款項已自動轉帳 💰',
                    body: `訂單 ${order.orderNo} 已自動完成（買家 14 天內未確認收貨），HKD ${order.sellerReceivableHkd} 已轉帳至你的 Stripe 帳戶。`,
                    linkUrl: '/seller',
                  }).catch(() => {});
                } catch (err: any) {
                  console.error(`[AutoComplete] Stripe transfer failed for order ${order.orderNo}:`, err.message);
                  await db.update(marketplaceOrders)
                    .set({ payoutStatus: 'failed', stripeTransferError: err.message })
                    .where(eq(marketplaceOrders.id, order.id));
                  // Notify seller: payout failed
                  await createNotification({
                    userId: order.sellerId,
                    type: 'trade',
                    title: '訂單自動完成，款項轉帳失敗 ⚠️',
                    body: `訂單 ${order.orderNo} 已自動完成，但款項轉帳失敗，請聯絡客服處理。`,
                    linkUrl: '/seller',
                  }).catch(() => {});
                }
              } else {
                // Seller has no Stripe Connect or not active - notify them to contact admin
                await createNotification({
                  userId: order.sellerId,
                  type: 'trade',
                  title: '訂單已自動完成 ✅',
                  body: `訂單 ${order.orderNo} 已自動完成（買家 14 天內未確認收貨）。款項將由平台管理員安排轉帳，請留意後續通知。`,
                  linkUrl: '/seller',
                }).catch(() => {});
              }
            }
            console.log(`[AutoComplete] Order ${order.orderNo} auto-completed`);
          } catch (err) {
            console.error(`[AutoComplete] Failed to auto-complete order ${order.orderNo}:`, err);
          }
        }
      } catch (err) {
        console.error('[AutoComplete] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[AutoComplete] Auto-complete orders scheduler started');
}

export function stopAutoCompleteOrdersScheduler() {
  if (autoCompleteOrdersCronJob) {
    autoCompleteOrdersCronJob.stop();
    autoCompleteOrdersCronJob = null;
  }
}
