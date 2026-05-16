import * as cron from 'node-cron';
import { getPriceUpdateSchedule, updateSnkrdunkLastExecutedAt, updateSnkrdunkLastCatchupAt, addScheduleExecutionHistory, updateScheduleExecutionHistory } from './db';
import { executePersistentSnkrdunkBatchUpdate } from './persistentSnkrdunkBatchUpdate';

let snkrdunkCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Check if a scheduled time was missed since last execution.
 * Returns true if the given HH:mm time has passed today (or yesterday) since lastExecutedAt.
 * Uses a 23-hour window to avoid double-execution.
 */
function wasMissedSince(updateTime: string, lastExecutedAt: Date | null | undefined): boolean {
  const now = new Date();
  // Convert now to HKT
  const hktOffset = 8 * 60 * 60 * 1000;
  const nowHKT = new Date(now.getTime() + hktOffset);
  const [schedHour, schedMin] = updateTime.split(':').map(Number);

  // Build today's scheduled time in HKT
  const todayHKT = new Date(nowHKT);
  todayHKT.setUTCHours(schedHour, schedMin, 0, 0);
  const todayScheduledUTC = new Date(todayHKT.getTime() - hktOffset);

  // Build yesterday's scheduled time in HKT
  const yesterdayScheduledUTC = new Date(todayScheduledUTC.getTime() - 24 * 60 * 60 * 1000);

  // Determine the most recent scheduled time that has already passed
  const mostRecentScheduled = todayScheduledUTC <= now ? todayScheduledUTC : yesterdayScheduledUTC;

  if (!lastExecutedAt) {
    // Never executed — treat as missed if scheduled time was within last 24h
    return mostRecentScheduled <= now && (now.getTime() - mostRecentScheduled.getTime()) < 24 * 60 * 60 * 1000;
  }

  const lastExec = new Date(lastExecutedAt);
  // Missed if the most recent scheduled time is after the last execution
  return mostRecentScheduled > lastExec && mostRecentScheduled <= now;
}

/**
 * Check if catch-up is on cooldown (already ran today in HKT).
 * Returns true if a catch-up was already performed today (HKT date).
 */
function isCatchupOnCooldown(lastCatchupAt: Date | null | undefined): boolean {
  if (!lastCatchupAt) return false;
  const hktOffset = 8 * 60 * 60 * 1000;
  const nowHKT = new Date(Date.now() + hktOffset);
  const lastHKT = new Date(lastCatchupAt.getTime() + hktOffset);
  // Compare HKT calendar date (YYYY-MM-DD)
  const nowDate = `${nowHKT.getUTCFullYear()}-${nowHKT.getUTCMonth()}-${nowHKT.getUTCDate()}`;
  const lastDate = `${lastHKT.getUTCFullYear()}-${lastHKT.getUTCMonth()}-${lastHKT.getUTCDate()}`;
  return nowDate === lastDate;
}

/**
 * Execute a catch-up SNKRDUNK batch update (for missed scheduled runs).
 */
async function runCatchupSnkrdunkUpdate(reason: string) {
  console.log(`[PriceUpdateScheduler] Running catch-up SNKRDUNK update: ${reason}`);
  const startTime = new Date();
  let historyId: number | null = null;
  try {
    historyId = await addScheduleExecutionHistory({
      scheduleType: 'snkrdunk_update',
      executionType: 'catchup',
      status: 'running',
      startedAt: startTime,
    });
    const { taskId, totalCards } = await executePersistentSnkrdunkBatchUpdate();
    console.log(`[PriceUpdateScheduler] Catch-up started, task ID: ${taskId}, total cards: ${totalCards}`);
    await updateSnkrdunkLastExecutedAt();
    await updateSnkrdunkLastCatchupAt(); // Record catch-up time for cooldown
    const endTime = new Date();
    if (historyId !== null) {
      await updateScheduleExecutionHistory(historyId, {
        status: 'completed',
        completedAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        snkrdunkSuccessCount: 0,
        snkrdunkFailureCount: 0,
        snkrdunkRecordsAdded: 0,
      });
    }
  } catch (error) {
    console.error('[PriceUpdateScheduler] Catch-up SNKRDUNK update failed:', error);
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
}

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
    // When updateMode is 'github_actions', platform cron is disabled to avoid double-running
    const updateMode = (config as any).snkrdunkUpdateMode ?? 'platform';
    if (config.snkrdunkEnabled && updateMode !== 'github_actions') {
      // Fixed daily schedule: use configured time (default 02:00 HKT), single slot only
      const updateTime = config.snkrdunkUpdateTime || '02:00';
      startSnkrdunkScheduler(updateTime);

      // ── Catch-up check: run if scheduled time was missed ──
      // Delay slightly to allow DB connections to stabilize
      setTimeout(async () => {
        try {
          // Re-fetch config to get latest lastExecutedAt
          const freshConfig = await getPriceUpdateSchedule();
          if (!freshConfig?.snkrdunkEnabled) return;
          // ── 互斥：github_actions 模式下跳過 catch-up，避免平台內建排程重複執行 ──
          const freshUpdateMode = (freshConfig as any).snkrdunkUpdateMode ?? 'platform';
          if (freshUpdateMode === 'github_actions') {
            console.log('[PriceUpdateScheduler] Catch-up skipped: mode is github_actions, platform cron disabled');
            return;
          }

          const freshUpdateTime = freshConfig.snkrdunkUpdateTime || '02:00';
          const missed = wasMissedSince(freshUpdateTime, freshConfig.snkrdunkLastExecutedAt);

          if (missed) {
            // Check cooldown: only one catch-up per HKT calendar day
            const lastCatchupAt = (freshConfig as any).snkrdunkLastCatchupAt as Date | null | undefined;
            if (isCatchupOnCooldown(lastCatchupAt)) {
              const lastCatchupStr = lastCatchupAt ? new Date(lastCatchupAt).toISOString() : 'never';
              console.log(`[PriceUpdateScheduler] Catch-up cooldown active (already ran today HKT at ${lastCatchupStr}), skipping`);
            } else {
              // Also skip if autoResumeOnStartup already picked up a running/recently-failed task
              const { isSnkrdunkBatchUpdateRunning } = await import('./persistentSnkrdunkBatchUpdate');
              const alreadyRunning = await isSnkrdunkBatchUpdateRunning();
              if (alreadyRunning) {
                console.log('[PriceUpdateScheduler] Catch-up skipped: autoResumeOnStartup already resumed an active task');
              } else {
                const reason = `missed scheduled run (time=${freshUpdateTime}), last executed: ${freshConfig.snkrdunkLastExecutedAt?.toISOString() ?? 'never'}`;
                console.log(`[PriceUpdateScheduler] Detected missed execution — ${reason}`);
                await runCatchupSnkrdunkUpdate(reason);
              }
            }
          } else {
            console.log('[PriceUpdateScheduler] No missed executions detected, skipping catch-up');
          }
        } catch (err) {
          console.error('[PriceUpdateScheduler] Catch-up check failed:', err);
        }
      }, 15000); // wait 15s after server start
    }

    console.log('[PriceUpdateScheduler] Price update scheduler initialized successfully');
  } catch (error) {
    console.error('[PriceUpdateScheduler] Failed to initialize scheduler:', error);
  }
}

/**
 * Start SNKRDUNK price update scheduler
 * @param updateTime - Time in HH:mm format (e.g., "02:00")
 */
function startSnkrdunkScheduler(updateTime: string) {
  // Stop existing job if any
  if (snkrdunkCronJob) {
    snkrdunkCronJob.stop();
  }

  const [hour, minute] = updateTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`; // Every day at specified time

  console.log(`[PriceUpdateScheduler] Starting SNKRDUNK scheduler with cron: ${cronExpression} (${updateTime} HKT)`);

  const job = cron.schedule(cronExpression, async () => {
    console.log(`[PriceUpdateScheduler] Executing scheduled SNKRDUNK price update (${updateTime} HKT)...`);
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

  snkrdunkCronJob = job;
  job.start();
  console.log(`[PriceUpdateScheduler] SNKRDUNK scheduler started at ${updateTime} HKT`);
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

  // Warmup on startup: check if cache is stale and trigger calculation if needed
  setTimeout(async () => {
    try {
      const { getCachedTrendingCards } = await import('./db');
      const cached = await getCachedTrendingCards();
      if (!cached || cached.length === 0) {
        console.log('[TrendingCardsScheduler] No trending cache found on startup — triggering warmup calculation...');
        const { calculateAndCacheTrendingCards } = await import('./db');
        await calculateAndCacheTrendingCards();
        console.log('[TrendingCardsScheduler] Startup warmup completed');
      } else {
        console.log(`[TrendingCardsScheduler] Trending cache already warm (${cached.length} cards), skipping warmup`);
      }
    } catch (err) {
      console.error('[TrendingCardsScheduler] Startup warmup failed:', err);
    }
  }, 5000); // Delay 5s to let DB connections stabilise
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
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lte, isNotNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        const { inArray: inArr, ne } = await import('drizzle-orm');
        // NEW LOGIC: Only auto-complete orders that are NOT in 'disputed' status
        // (prevents auto-complete from triggering payout during active disputes)
        const overdueOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              inArr(marketplaceOrders.orderStatus, ['shipped', 'delivered']),
              ne(marketplaceOrders.orderStatus, 'disputed'),  // CRITICAL: exclude disputed orders
              isNotNull(marketplaceOrders.autoCompleteAt),
              lte(marketplaceOrders.autoCompleteAt, now)
            )
          )
          .limit(100);

        if (overdueOrders.length === 0) return;
        console.log(`[AutoComplete] Found ${overdueOrders.length} orders to auto-complete`);

        for (const order of overdueOrders) {
          try {
            // Platform orders: payment already collected by platform, no payout needed
            const isPlatformOrder = order.sellerType === 'platform';
            // NEW PAYOUT LOGIC: Set 48-hour cooling period for C2C orders (same as confirmReceipt)
            const payoutHoldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours from now
            await db.update(marketplaceOrders)
              .set({
                orderStatus: 'completed',
                buyerConfirmedAt: now,
                payoutStatus: isPlatformOrder ? 'not_applicable' : 'processing',
                payoutHoldUntil: isPlatformOrder ? null : payoutHoldUntil,
              })
              .where(eq(marketplaceOrders.id, order.id));

            // Notify buyer: order auto-completed
            await createNotification({
              userId: order.buyerId,
              type: 'trade',
              title: '訂單已自動完成 ✅',
              body: `訂單 ${order.orderNo} 已超過 14 天未確認收貨，系統已自動完成訂單。如有問題請聯絡客服。`,
              linkUrl: `/orders/${order.orderNo}`,
            }).catch(() => {});
            // Send auto-completed email to buyer
            try {
              const { sendOrderEmail, buildOrderAutoCompletedBuyerEmail, getOrderEmailData } = await import('./emailService');
              const emailData = await getOrderEmailData(order);
              const { subject, html } = buildOrderAutoCompletedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
              await sendOrderEmail({ userId: order.buyerId, subject, html, dedupeKey: `order_autocomplete_buyer_${order.id}` });
            } catch (emailErr: any) {
              console.warn(`[AutoComplete] Buyer email failed for order ${order.orderNo}:`, emailErr.message);
            }

            // NEW PAYOUT LOGIC: Do NOT trigger payout immediately.
            // The payoutHoldScheduler cron job will trigger executeSellerPayout
            // once payoutHoldUntil has passed AND no dispute exists.
            // Notify seller about auto-completion and 48-hour cooling period
            if (order.sellerType === 'seller' && order.sellerId) {
              const sellerProfile = await getSellerProfileById(order.sellerId);
              if (sellerProfile?.userId) {
                await createNotification({
                  userId: sellerProfile.userId,
                  type: 'trade',
                  title: '訂單已自動完成 ✅',
                  body: `訂單 ${order.orderNo} 已自動完成（買家 14 天內未確認收貨）。款項將在 48 小時後（${payoutHoldUntil.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}）自動放款，期間如無爭議即可收款。`,
                  linkUrl: `/seller`,
                }).catch(() => {});
                try {
                  const { sendOrderEmail, buildOrderAutoCompletedSellerEmail, getOrderEmailData } = await import('./emailService');
                  const emailData = await getOrderEmailData(order);
                  const { subject, html } = buildOrderAutoCompletedSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, receivableHkd: emailData.receivableHkd });
                  await sendOrderEmail({ userId: sellerProfile.userId, subject, html, dedupeKey: `order_autocomplete_seller_${order.id}` });
                } catch (emailErr: any) {
                  console.warn(`[AutoComplete] Seller email failed for order ${order.orderNo}:`, emailErr.message);
                }
              }
            }
            // Record status history: auto-complete (system)
            try {
              const { orderStatusHistory: osh } = await import('../drizzle/schema_new');
              await db.insert(osh).values({
                orderId: order.id,
                fromStatus: order.orderStatus,
                toStatus: 'completed',
                operatorId: null,
                operatorName: 'system',
                note: '系統自動完成（14 天未確認收貨）',
                entryType: 'status_change',
              });
            } catch (histErr: any) {
              console.warn(`[AutoComplete] orderStatusHistory insert failed for order ${order.orderNo}:`, histErr.message);
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

// ============================================================
// Shipping Overdue Reminder Scheduler
// Runs every hour: remind sellers who haven't shipped within 3 days of payment
// ============================================================
let shippingReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startShippingReminderScheduler() {
  if (shippingReminderCronJob) return;
  shippingReminderCronJob = cron.schedule(
    '*/30 * * * *', // Every 30 minutes
    async () => {
      try {
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lt, gte, isNull, or } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const { getUserById } = await import('./userManagement');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Window: orders paid between 12 hours and 12.5 hours ago
        // (30-minute window matches the cron frequency to avoid duplicates)
        const windowStart = new Date(now.getTime() - (12 * 60 + 30) * 60 * 1000); // 12h30m ago
        const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000);          // 12h ago

        // Find orders that: paid but not shipped, payment received 12-12.5 hours ago, reminder not yet sent
        const overdueOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              or(
                eq(marketplaceOrders.orderStatus, 'payment_received'),
                eq(marketplaceOrders.orderStatus, 'processing')
              ),
              gte(marketplaceOrders.updatedAt, windowStart),
              lt(marketplaceOrders.updatedAt, windowEnd),
              isNull(marketplaceOrders.shippingReminderSentAt)
            )
          )
          .limit(50);

        if (overdueOrders.length === 0) return;
        console.log(`[ShippingReminder] Found ${overdueOrders.length} overdue orders (12h window)`);

        for (const order of overdueOrders) {
          try {
            // Mark reminder as sent
            await db.update(marketplaceOrders)
              .set({ shippingReminderSentAt: now })
              .where(eq(marketplaceOrders.id, order.id));

            // Notify seller via in-app notification
            if (order.sellerId) {
              const sellerProf = await getSellerProfileById(order.sellerId);
              if (sellerProf?.userId) {
                await createNotification({
                  userId: sellerProf.userId,
                  type: 'trade',
                  title: '⏰ 請盡快安排出貨',
                  body: `訂單 ${order.orderNo} 已付款超過 12 小時，請盡快安排出貨並填寫追蹤號碼。`,
                  linkUrl: `/seller`,
                }).catch(() => {});

                // Send email to seller
                ;(async () => {
                  try {
                    const sellerUser = await getUserById(sellerProf.userId);
                    if (!sellerUser?.email) return;
                    const { sendEmail } = await import('./emailService');
                    const { wrapHtmlTest } = await import('./emailService');
                    const subject = `⏰ 出貨提醒 — 訂單 #${order.orderNo}`;
                    const html = wrapHtmlTest(
                      subject,
                      `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">出貨提醒 ⏰</h2>
                      <p style="margin:0 0 16px;color:#555;font-size:15px;">
                        親愛的 <strong>${sellerUser.name || '賣家'}</strong>，<br/>
                        訂單 <strong>#${order.orderNo}</strong> 已付款超過 12 小時，買家正在等候收貨。<br/>
                        請盡快安排出貨並在賣家中心填寫物流追蹤號碼。
                      </p>
                      <div style="text-align:center;margin:24px 0;">
                        <a href="https://boxium.asia/seller" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">前往賣家中心安排出貨</a>
                      </div>
                      <p style="color:#555;font-size:13px;text-align:center;">請在 48 小時內完成出貨，以維護良好的賣家評分。</p>`
                    );
                    await sendEmail({ to: sellerUser.email, subject, html, emailType: 'order', toUserId: sellerProf.userId, dedupeKey: `shipping_reminder_12h_${order.id}` });
                  } catch (e) {
                    console.warn(`[ShippingReminder] Email failed for order ${order.orderNo}:`, e);
                  }
                })();
              }
            }

            console.log(`[ShippingReminder] 12h reminder sent for order ${order.orderNo}`);
          } catch (err) {
            console.error(`[ShippingReminder] Failed to send reminder for order ${order.orderNo}:`, err);
          }
        }
      } catch (err) {
        console.error('[ShippingReminder] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[ShippingReminder] Shipping reminder scheduler started (every 30 min, 12h window)');
}

export function stopShippingReminderScheduler() {
  if (shippingReminderCronJob) {
    shippingReminderCronJob.stop();
    shippingReminderCronJob = null;
  }
}

// ─── 7-Day Confirm Receipt Reminder Scheduler ──────────────────────────────────
// Runs daily at 09:00 HKT to remind buyers who haven't confirmed receipt after 7 days
let confirmReceiptReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startConfirmReceiptReminderScheduler() {
  if (confirmReceiptReminderCronJob) return;
  confirmReceiptReminderCronJob = cron.schedule(
    '0 9 * * *', // Daily at 09:00 HKT
    async () => {
      try {
        const { getDb } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lt, isNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const { getUserById } = await import('./userManagement');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Orders shipped more than 7 days ago but not yet confirmed
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const overdueOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'shipped'),
              lt(marketplaceOrders.shippedAt, sevenDaysAgo),
              isNull(marketplaceOrders.confirmReceiptReminderSentAt)
            )
          )
          .limit(100);

        if (overdueOrders.length === 0) return;
        console.log(`[ConfirmReceiptReminder] Found ${overdueOrders.length} orders shipped >7 days without confirmation`);

        for (const order of overdueOrders) {
          try {
            // Mark reminder as sent first
            await db.update(marketplaceOrders)
              .set({ confirmReceiptReminderSentAt: now })
              .where(eq(marketplaceOrders.id, order.id));

            // Get listing info for email
            const { getListingById } = await import('./db');
            const listing = order.listingId ? await getListingById(order.listingId) : null;
            const itemName = listing?.title || '商品';
            const shippedDaysAgo = Math.floor((now.getTime() - new Date(order.shippedAt!).getTime()) / (1000 * 60 * 60 * 24));

            // In-app notification to buyer
            await createNotification({
              userId: order.buyerId,
              type: 'trade',
              title: '📦 請確認收貨',
              body: `訂單 ${order.orderNo} 已出貨超過 ${shippedDaysAgo} 天，請確認收貨或提出爭議。未確認的訂單將在出貨 14 天後自動完成。`,
              linkUrl: `/orders/${order.orderNo}`,
            }).catch(() => {});

            // Email notification to buyer
            ;(async () => {
              try {
                const buyerUser = await getUserById(order.buyerId);
                if (!buyerUser?.email) return;
                const { sendEmail, buildConfirmReceiptReminderEmail } = await import('./emailService');
                const { subject, html } = buildConfirmReceiptReminderEmail({
                  buyerName: buyerUser.name || '買家',
                  orderNo: order.orderNo,
                  itemName,
                  shippedDaysAgo,
                  ordersUrl: `https://boxium.asia/orders/${order.orderNo}`,
                });
                await sendEmail({ to: buyerUser.email, subject, html, emailType: 'order', toUserId: order.buyerId, dedupeKey: `confirm_receipt_7d_${order.id}` });
              } catch (e) {
                console.warn(`[ConfirmReceiptReminder] Email failed for order ${order.orderNo}:`, e);
              }
            })();

            console.log(`[ConfirmReceiptReminder] Reminder sent for order ${order.orderNo}`);
          } catch (err) {
            console.error(`[ConfirmReceiptReminder] Failed for order ${order.orderNo}:`, err);
          }
        }
      } catch (err) {
        console.error('[ConfirmReceiptReminder] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[ConfirmReceiptReminder] 7-day confirm receipt reminder scheduler started (daily at 09:00 HKT)');
}

export function stopConfirmReceiptReminderScheduler() {
  if (confirmReceiptReminderCronJob) {
    confirmReceiptReminderCronJob.stop();
    confirmReceiptReminderCronJob = null;
  }
}

// ─── Offer Expiry Reminder Scheduler ─────────────────────────────────────────
// Runs every hour at :15 to check for offers expiring within 6 hours
let offerExpiryReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startOfferExpiryReminderScheduler() {
  if (offerExpiryReminderCronJob) return;
  offerExpiryReminderCronJob = cron.schedule(
    '15 * * * *', // Every hour at :15
    async () => {
      try {
        const { getDb } = await import('./db');
        const { offers: offersTable } = await import('../drizzle/schema_new');
        const { and, eq, lte, gte, isNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const { sendEmail, buildOfferExpiringSoonEmail } = await import('./emailService');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Window: offers expiring between now and 6 hours from now
        const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        // Only notify once: offers that haven't had expiry reminder sent yet
        const expiringOffers = await db.select()
          .from(offersTable)
          .where(
            and(
              eq(offersTable.status, 'pending'),
              gte(offersTable.expiresAt, now),
              lte(offersTable.expiresAt, sixHoursLater),
              isNull(offersTable.expiryReminderSentAt)
            )
          )
          .limit(100);

        if (expiringOffers.length === 0) return;
        console.log(`[OfferExpiryReminder] Found ${expiringOffers.length} offers expiring within 6 hours`);

        for (const offer of expiringOffers) {
          try {
            // Mark reminder as sent first to avoid duplicate sends
            await db.update(offersTable)
              .set({ expiryReminderSentAt: now })
              .where(eq(offersTable.id, offer.id));

            // Get listing info
            const { getListingById, getSellerProfileById } = await import('./db');
            const listing = await getListingById(offer.listingId);
            if (!listing) continue;
            const sellerProfile = await getSellerProfileById(offer.sellerProfileId);
            if (!sellerProfile) continue;

            // In-app notification to seller
            await createNotification({
              userId: offer.sellerId,
              type: 'offer',
              title: '⏰ 出價即將過期',
              body: `您對「${listing.title}」的出價 HKD ${offer.offerPriceHkd} 將在 6 小時內過期，請盡快回應！`,
              linkUrl: '/seller',
              relatedId: offer.id,
            }).catch(() => {});

            // Get users for notifications
            const { users: usersTable } = await import('../drizzle/schema_new');
            const sellerUsers = await db.select().from(usersTable)
              .where(eq(usersTable.id, offer.sellerId))
              .limit(1);
            const sellerUser = sellerUsers[0];
            const buyerUsers = await db.select().from(usersTable)
              .where(eq(usersTable.id, offer.buyerId))
              .limit(1);
            const buyerUser = buyerUsers[0];
            const buyerName = buyerUser?.name || '買家';
            const sellerName = sellerUser?.name || '賣家';
            const expiresAtStr = offer.expiresAt.toLocaleString('zh-TW', {
              timeZone: 'Asia/Hong_Kong',
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit',
            }) + ' (HKT)';

            // Email notification to seller
            if (sellerUser?.email) {
              const { subject, html } = buildOfferExpiringSoonEmail({
                sellerName,
                buyerName,
                cardName: listing.title,
                offerAmountHkd: String(offer.offerPriceHkd),
                listingPriceHkd: listing.priceHkd ? String(listing.priceHkd) : '—',
                expiresAt: expiresAtStr,
                sellerDashboardUrl: 'https://boxium.asia/seller',
              });
              await sendEmail({ to: sellerUser.email, subject, html, emailType: 'offer', toUserId: offer.sellerId, dedupeKey: `offer_expiry_reminder_seller_${offer.id}` });
            }

            // ── Buyer notification (new) ──
            // In-app notification to buyer
            await createNotification({
              userId: offer.buyerId,
              type: 'offer',
              title: '⏰ 您的出價即將過期',
              body: `您對「${listing.title}」的出價 HKD ${offer.offerPriceHkd} 將在 6 小時內過期。如果賣家未回應，此出價將自動失效。`,
              linkUrl: '/orders?tab=offers',
              relatedId: offer.id,
            }).catch(() => {});

            // Email notification to buyer
            if (buyerUser?.email) {
              const { buildOfferExpiringSoonBuyerEmail } = await import('./emailService');
              const { subject: buyerSubject, html: buyerHtml } = buildOfferExpiringSoonBuyerEmail({
                buyerName,
                sellerName,
                cardName: listing.title,
                offerAmountHkd: String(offer.offerPriceHkd),
                expiresAt: expiresAtStr,
                ordersUrl: 'https://boxium.asia/orders?tab=offers',
              });
              await sendEmail({ to: buyerUser.email, subject: buyerSubject, html: buyerHtml, emailType: 'offer', toUserId: offer.buyerId, dedupeKey: `offer_expiry_reminder_buyer_${offer.id}` });
            }

            console.log(`[OfferExpiryReminder] Reminder sent for offer ${offer.id} (seller + buyer)`);
          } catch (err) {
            console.error(`[OfferExpiryReminder] Failed to process offer ${offer.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[OfferExpiryReminder] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[OfferExpiryReminder] Offer expiry reminder scheduler started');
}

export function stopOfferExpiryReminderScheduler() {
  if (offerExpiryReminderCronJob) {
    offerExpiryReminderCronJob.stop();
    offerExpiryReminderCronJob = null;
  }
}

// ─── Offer Expiry Auto-Cleanup Scheduler ─────────────────────────────────────
// Runs every hour at :45 to mark expired pending offers as 'expired'
let offerExpiryCleanupCronJob: ReturnType<typeof cron.schedule> | null = null;
export function startOfferExpiryCleanupScheduler() {
  if (offerExpiryCleanupCronJob) return;
  offerExpiryCleanupCronJob = cron.schedule(
    '45 * * * *', // Every hour at :45
    async () => {
      try {
        const { getDb } = await import('./db');
        const { offers: offersTable } = await import('../drizzle/schema_new');
        const { and, eq, lt } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;
        const now = new Date();
        // Find all pending offers where expiresAt has passed
        const expiredOffers = await db.select({ id: offersTable.id })
          .from(offersTable)
          .where(
            and(
              eq(offersTable.status, 'pending'),
              lt(offersTable.expiresAt, now)
            )
          );
        if (expiredOffers.length === 0) return;
        console.log(`[OfferExpiryCleanup] Marking ${expiredOffers.length} offers as expired`);
        // Batch update all expired offers
        await db.update(offersTable)
          .set({ status: 'expired' })
          .where(
            and(
              eq(offersTable.status, 'pending'),
              lt(offersTable.expiresAt, now)
            )
          );
        console.log(`[OfferExpiryCleanup] Successfully marked ${expiredOffers.length} offers as expired`);
      } catch (err) {
        console.error('[OfferExpiryCleanup] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[OfferExpiryCleanup] Offer expiry cleanup scheduler started (every hour at :45)');
}
export function stopOfferExpiryCleanupScheduler() {
  if (offerExpiryCleanupCronJob) {
    offerExpiryCleanupCronJob.stop();
    offerExpiryCleanupCronJob = null;
  }
}

// ─── Payment Timeout Auto-Cancel Scheduler ───────────────────────────────────
// Runs every 10 minutes to cancel pending_payment orders older than 30 minutes
// Also marks accepted offers as expired when their linked order is cancelled
let paymentTimeoutCancelCronJob: ReturnType<typeof cron.schedule> | null = null;
export function startPaymentTimeoutCancelScheduler() {
  if (paymentTimeoutCancelCronJob) return;
  paymentTimeoutCancelCronJob = cron.schedule(
    '*/10 * * * *', // Every 10 minutes
    async () => {
      try {
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders, marketplaceOrderItems, marketplaceListings, offers: offersTable } = await import('../drizzle/schema_new');
        const { and, eq, lt, inArray } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;
        const now = new Date();
        // Read timeout from systemSettings (default: 30 minutes)
        const { getSystemSetting } = await import('./db');
        const timeoutSetting = await getSystemSetting('payment_timeout_minutes').catch(() => null);
        const timeoutMinutes = timeoutSetting ? parseInt(timeoutSetting.settingValue) : 30;
        const cutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
        // P2-1 Fix: Alipay orders use a longer timeout (24 hours) since admin must manually confirm
        const alipayTimeoutSetting = await getSystemSetting('alipay_payment_timeout_minutes').catch(() => null);
        const alipayTimeoutMinutes = alipayTimeoutSetting ? parseInt(alipayTimeoutSetting.settingValue) : 24 * 60; // 24 hours default
        const alipayCutoff = new Date(now.getTime() - alipayTimeoutMinutes * 60 * 1000);

        // Find pending_payment orders older than timeout
        // P1-1 Fix: Also select paymentMethod and alipayProofStatus to exclude submitted Alipay orders
        const timedOutOrders = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          buyerId: marketplaceOrders.buyerId,
          sellerId: marketplaceOrders.sellerId,
          listingId: marketplaceOrders.listingId,
          createdAt: marketplaceOrders.createdAt,
          orderSource: marketplaceOrders.orderSource,
          auctionListingId: marketplaceOrders.auctionListingId,
          paymentMethod: marketplaceOrders.paymentMethod,
          alipayProofStatus: marketplaceOrders.alipayProofStatus,
        })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'pending_payment'),
              lt(marketplaceOrders.createdAt, cutoff)
            )
          );
        if (timedOutOrders.length === 0) return;
        console.log(`[PaymentTimeout] Found ${timedOutOrders.length} timed-out orders to cancel`);
        for (const order of timedOutOrders) {
          try {
            // P1-1 Fix: Skip Alipay orders that have submitted proof (pending_review) — admin needs to confirm
            if (order.paymentMethod === 'alipay_hk') {
              if (order.alipayProofStatus === 'pending_review') {
                console.log(`[PaymentTimeout] Skipping Alipay order ${order.orderNo} — proof submitted, awaiting admin review`);
                continue;
              }
              // P2-1 Fix: Alipay orders without proof use a longer timeout (24 hours)
              if (order.createdAt && order.createdAt > alipayCutoff) {
                console.log(`[PaymentTimeout] Skipping Alipay order ${order.orderNo} — within 24h Alipay timeout window`);
                continue;
              }
            }
            // Cancel the order
            await db.update(marketplaceOrders)
              .set({ orderStatus: 'cancelled', paymentStatus: 'cancelled', updatedAt: now })
              .where(eq(marketplaceOrders.id, order.id));
            // Restore listing stock using atomic operation
            const { restoreListingStock, getListingById, updateListing } = await import('./db');
            const items = await db.select()
              .from(marketplaceOrderItems)
              .where(eq(marketplaceOrderItems.orderId, order.id));
            if (items.length > 0) {
              for (const item of items) {
                await restoreListingStock(item.listingId, item.quantity ?? 1);
              }
            } else if (order.listingId) {
              // Fallback: no order items found, restore listing directly
              // Use restoreListingStock to also restore quantity and remainingQuantity
              await restoreListingStock(order.listingId, 1);
              console.log(`[PaymentTimeout] Fallback: restored listing ${order.listingId} stock+status to active for order ${order.id}`);
            }
            // Mark any accepted offers linked to this order as expired
            // so the listing can accept new offers
            await db.update(offersTable)
              .set({ status: 'expired', updatedAt: now })
              .where(
                and(
                  eq(offersTable.orderId, order.id),
                  eq(offersTable.status, 'accepted')
                )
              );
            console.log(`[PaymentTimeout] Expired accepted offers for cancelled order ${order.id}`);
            // Notify buyer
            await createNotification({
              userId: order.buyerId,
              type: 'order',
              title: '訂單已自動取消',
              body: `訂單 #${order.orderNo} 因超過 ${timeoutMinutes} 分鐘未完成付款，已自動取消，商品已重新上架。`,
              linkUrl: `/orders/${order.orderNo}`,
              relatedId: order.id,
            }).catch(() => {});
            // Notify seller (only if it's a C2C listing with a seller)
            // IMPORTANT: order.sellerId = sellerProfiles.id, NOT users.id
            if (order.sellerId != null) {
              const sellerProf = await getSellerProfileById(order.sellerId);
              if (sellerProf?.userId) {
              await createNotification({
                userId: sellerProf.userId,
                type: 'order',
                title: '買家未付款，訂單已取消',
                body: `訂單 #${order.orderNo} 因買家超過 ${timeoutMinutes} 分鐘未完成付款，已自動取消，商品已重新上架。`,
                  linkUrl: '/seller',
                  relatedId: order.id,
                }).catch(() => {});
              }
            }
            // ── Record violation for auction orders (no_payment) ──
            if (order.orderSource === 'auction') {
              try {
                const { createViolation, getViolationsByUserId } = await import('./db');
                // Count existing no_payment violations for this buyer
                const existingViolations = await getViolationsByUserId(order.buyerId);
                const noPaymentCount = existingViolations.filter(v => v.type === 'no_payment').length;
                // Determine penalty: 1st=warning, 2nd=ban_7d, 3rd+=ban_30d
                let penalty: 'warning' | 'ban_7d' | 'ban_30d' = 'warning';
                let banExpiresAt: Date | null = null;
                if (noPaymentCount === 1) {
                  penalty = 'ban_7d';
                  banExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                } else if (noPaymentCount >= 2) {
                  penalty = 'ban_30d';
                  banExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                }
                await createViolation({
                  userId: order.buyerId,
                  type: 'no_payment',
                  listingId: order.auctionListingId ?? order.listingId ?? undefined,
                  orderId: order.id,
                  penalty,
                  banExpiresAt: banExpiresAt ?? undefined,
                  adminNote: `訂單 #${order.orderNo} 逾時未付款，自動記錄違規（第 ${noPaymentCount + 1} 次）`,
                } as any);
                // Notify buyer about violation
                const violationMsg = penalty === 'warning'
                  ? '這是您的第 1 次警告，累計 3 次將被暫停競標資格。'
                  : penalty === 'ban_7d'
                  ? '您已被暫停競標資格 7 天。'
                  : '您已被暫停競標資格 30 天。';
                await createNotification({
                  userId: order.buyerId,
                  type: 'order',
                  title: '拍賣違規警告',
                  body: `訂單 #${order.orderNo} 因逾時未付款已被記錄違規。${violationMsg}`,
                  linkUrl: `/orders/${order.orderNo}`,
                  relatedId: order.id,
                }).catch(() => {});
                console.log(`[PaymentTimeout] Recorded auction violation (${penalty}) for buyer ${order.buyerId}, order ${order.orderNo}`);
              } catch (violationErr: any) {
                console.error(`[PaymentTimeout] Failed to record violation for order ${order.id}:`, violationErr.message);
              }
            }
            // Record status history: payment timeout cancellation (system)
            try {
              const { orderStatusHistory: osh } = await import('../drizzle/schema_new');
              await db.insert(osh).values({
                orderId: order.id,
                fromStatus: 'pending_payment',
                toStatus: 'cancelled',
                operatorId: null,
                operatorName: 'system',
                note: `進入超時自動取消（${timeoutMinutes} 分鐘未付款）`,
                entryType: 'status_change',
              });
            } catch (histErr: any) {
              console.warn(`[PaymentTimeout] orderStatusHistory insert failed for order ${order.orderNo}:`, histErr.message);
            }
            console.log(`[PaymentTimeout] Cancelled order ${order.orderNo} (id: ${order.id})`);
          } catch (err) {
            console.error(`[PaymentTimeout] Failed to cancel order ${order.id}:`, err);
          }
        }

        // ── Also handle accepted offers where buyer hasn't paid for 24 hours ──
        // These are offers that were accepted but the buyer never started checkout
        // or the Stripe session expired without creating an order
        // Read offer timeout from systemSettings (default: 24 hours)
        const offerTimeoutSetting = await getSystemSetting('offer_payment_timeout_hours').catch(() => null);
        const offerTimeoutHours = offerTimeoutSetting ? parseInt(offerTimeoutSetting.settingValue) : 24;
        const offerCutoff = new Date(now.getTime() - offerTimeoutHours * 60 * 60 * 1000);
        const expiredAcceptedOffers = await db.select({
          id: offersTable.id,
          buyerId: offersTable.buyerId,
          listingId: offersTable.listingId,
          offerPriceHkd: offersTable.offerPriceHkd,
          respondedAt: offersTable.respondedAt,
        })
          .from(offersTable)
          .where(
            and(
              eq(offersTable.status, 'accepted'),
              lt(offersTable.respondedAt, offerCutoff)
            )
          );
        if (expiredAcceptedOffers.length > 0) {
          console.log(`[PaymentTimeout] Found ${expiredAcceptedOffers.length} accepted offers with no payment after 24h`);
          for (const offer of expiredAcceptedOffers) {
            try {
              // Mark offer as expired
              await db.update(offersTable)
                .set({ status: 'expired', updatedAt: now })
                .where(eq(offersTable.id, offer.id));
              // Notify buyer
              await createNotification({
                userId: offer.buyerId,
                type: 'trade',
                title: '出價已過期',
                body: `你對商品的已接受出價 HKD ${offer.offerPriceHkd} 因超過 24 小時未完成付款，已自動過期。`,
                linkUrl: `/shop/${offer.listingId}`,
              }).catch(() => {});
              console.log(`[PaymentTimeout] Expired accepted offer ${offer.id} (no payment after 24h)`);
            } catch (err) {
              console.error(`[PaymentTimeout] Failed to expire offer ${offer.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.error('[PaymentTimeout] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[PaymentTimeout] Payment timeout cancel scheduler started (every 10 minutes, dynamic cutoff from systemSettings)');
}
export function stopPaymentTimeoutCancelScheduler() {
  if (paymentTimeoutCancelCronJob) {
    paymentTimeoutCancelCronJob.stop();
    paymentTimeoutCancelCronJob = null;
  }
}

// ─── Payment Reminder Scheduler ──────────────────────────────────────────────
// Runs every hour at :45 to remind buyers of pending_payment orders created
// between 12 and 13 hours ago (i.e. 12 hours before the 24-hour auto-cancel).
// Uses paymentReminderSentAt to ensure each order is only reminded once.
let paymentReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startPaymentReminderScheduler() {
  if (paymentReminderCronJob) return;
  paymentReminderCronJob = cron.schedule(
    '*/10 * * * *', // Every 10 minutes
    async () => {
      try {
        const { getDb, getListingById } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lt, gte, isNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const { getUserById } = await import('./userManagement');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Read reminder delay from systemSettings (default: 60 minutes)
        const { getSystemSetting } = await import('./db');
        const reminderSetting = await getSystemSetting('payment_reminder_minutes').catch(() => null);
        const reminderMinutes = reminderSetting ? parseInt(reminderSetting.settingValue) : 60;
        // Window: orders created between (reminderMinutes+10) and reminderMinutes ago
        // (10-minute window matches the cron frequency to avoid duplicates)
        const windowStart = new Date(now.getTime() - (reminderMinutes + 10) * 60 * 1000);
        const windowEnd   = new Date(now.getTime() - reminderMinutes * 60 * 1000);

        const ordersToRemind = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          buyerId: marketplaceOrders.buyerId,
          listingId: marketplaceOrders.listingId,
          createdAt: marketplaceOrders.createdAt,
        })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'pending_payment'),
              gte(marketplaceOrders.createdAt, windowStart),
              lt(marketplaceOrders.createdAt, windowEnd),
              isNull(marketplaceOrders.paymentReminderSentAt)
            )
          )
          .limit(100);

        if (ordersToRemind.length === 0) return;
        console.log(`[PaymentReminder] Found ${ordersToRemind.length} orders to remind (1h window)`);

        for (const order of ordersToRemind) {
          try {
            // Mark reminder as sent first to avoid duplicate sends
            await db.update(marketplaceOrders)
              .set({ paymentReminderSentAt: now })
              .where(eq(marketplaceOrders.id, order.id));

            // Send in-app notification to buyer
            await createNotification({
              userId: order.buyerId,
              type: 'order',
              title: '⏰ 付款提醒 — 訂單即將取消',
              body: `訂單 #${order.orderNo} 已超過 1 小時未付款，請盡快完成付款，否則訂單將自動取消。`,
              linkUrl: `/orders/${order.orderNo}`,
              relatedId: order.id,
            }).catch(() => {});

            // Send email reminder to buyer
            ;(async () => {
              try {
                const buyerUser = await getUserById(order.buyerId);
                if (!buyerUser?.email) return;
                const listing = order.listingId ? await getListingById(order.listingId) : null;
                const itemName = listing?.title || `訂單 #${order.orderNo}`;
                const { sendEmail } = await import('./emailService');
                const subject = `⏰ 付款提醒 — ${itemName}`;
                const { wrapHtmlTest } = await import('./emailService');
                const html = wrapHtmlTest(
                  subject,
                  `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">付款提醒 ⏰</h2>
                  <p style="margin:0 0 16px;color:#555;font-size:15px;">
                    親愛的 <strong>${buyerUser.name || '買家'}</strong>，<br/>
                    您的訂單 <strong>#${order.orderNo}</strong>（商品：<strong>${itemName}</strong>）已超過 1 小時未完成付款。<br/>
                    請盡快完成付款，否則訂單將在 24 小時後自動取消。
                  </p>
                  <div style="text-align:center;margin:24px 0;">
                    <a href="https://boxium.asia/orders" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">前往訂單頁付款</a>
                  </div>
                  <p style="color:#ef4444;font-size:13px;text-align:center;">⚠️ 逾期未付款，訂單將自動取消，商品將重新上架。</p>`
                );
                await sendEmail({ to: buyerUser.email, subject, html, emailType: 'order', toUserId: order.buyerId, dedupeKey: `payment_reminder_1h_${order.id}` });
              } catch (e) {
                console.warn(`[PaymentReminder] Email failed for order ${order.orderNo}:`, e);
              }
            })();

            console.log(`[PaymentReminder] Sent 1h reminder for order ${order.orderNo} (id: ${order.id})`);
          } catch (err) {
            console.error(`[PaymentReminder] Failed to send reminder for order ${order.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[PaymentReminder] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[PaymentReminder] Payment reminder scheduler started (every 10 min, 1h window)');
}

export function stopPaymentReminderScheduler() {
  if (paymentReminderCronJob) {
    paymentReminderCronJob.stop();
    paymentReminderCronJob = null;
  }
}


// ─── Cart Expiry Cleanup Scheduler ──────────────────────────────────────────
let cartExpiryCleanupCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Clear expired cart items (older than 14 days).
 * Runs daily at 03:00 HKT.
 */
async function runCartExpiryCleanup() {
  try {
    const { getDb } = await import('./db');
    const { cartItems } = await import('../drizzle/schema_new');
    const { lt } = await import('drizzle-orm');
    const database = await getDb();
    if (!database) return;
    const now = new Date();
    const result = await database.delete(cartItems).where(lt(cartItems.expiresAt, now));
    const deleted = (result as any).rowsAffected ?? 0;
    if (deleted > 0) {
      console.log(`[CartExpiry] Cleaned up ${deleted} expired cart items`);
    }
  } catch (err) {
    console.error('[CartExpiry] Cleanup error:', err);
  }
}

/**
 * Start the cart expiry cleanup scheduler (daily at 03:00 HKT).
 */
export function startCartExpiryCleanupScheduler() {
  if (cartExpiryCleanupCronJob) return;
  cartExpiryCleanupCronJob = cron.schedule(
    '0 3 * * *', // Daily at 03:00 HKT
    async () => {
      try {
        await runCartExpiryCleanup();
      } catch (err) {
        console.error('[CartExpiry] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[CartExpiry] Cart expiry cleanup scheduler started (daily at 03:00 HKT)');
  // Run once on startup to clear any already-expired items
  runCartExpiryCleanup().catch(err => console.error('[CartExpiry] Initial cleanup error:', err));
}

// ─── Alipay Review Timeout Reminder Scheduler ───────────────────────────────
let alipayReviewReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Check for Alipay payment proofs that have been pending review for >24 hours.
 * Sends a reminder notification to admin and marks the order so we don't spam.
 * Runs every hour.
 */
async function runAlipayReviewTimeoutCheck() {
  try {
    const { getDb } = await import('./db');
    const { marketplaceOrders } = await import('../drizzle/schema_new');
    const { and, eq, isNotNull, isNull, lte } = await import('drizzle-orm');
    const { notifyAdmin } = await import('./emailService');
    const database = await getDb();
    if (!database) return;

    // P2 Fix #9: Read Alipay review SLA from systemSettings (default: 24 hours)
    const { getSystemSetting } = await import('./db');
    const alipayReviewSlaSetting = await getSystemSetting('alipay_review_sla_hours').catch(() => null);
    const alipayReviewSlaHours = alipayReviewSlaSetting ? parseInt(alipayReviewSlaSetting.settingValue, 10) : 24;
    const cutoff = new Date(Date.now() - alipayReviewSlaHours * 60 * 60 * 1000);

    // Find orders with proof submitted >24hrs ago, not yet confirmed/rejected, and reminder not yet sent
    const overdueOrders = await database
      .select()
      .from(marketplaceOrders)
      .where(
        and(
          eq(marketplaceOrders.orderStatus, 'pending_payment'),
          eq(marketplaceOrders.paymentMethod, 'alipay_hk'),
          isNotNull(marketplaceOrders.alipayProofImageUrl),
          isNull(marketplaceOrders.alipayReviewReminderSentAt),
          lte(marketplaceOrders.alipayProofSubmittedAt, cutoff)
        )
      )
      .limit(20);

    if (overdueOrders.length === 0) return;

    console.log(`[AlipayReview] Found ${overdueOrders.length} overdue Alipay proof(s) pending review`);

    for (const order of overdueOrders) {
      try {
        const submittedAt = order.alipayProofSubmittedAt ? new Date(order.alipayProofSubmittedAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : '未知';
        await notifyAdmin({
          title: `⏰ 支付寶截圖待核對超過 24 小時`,
          content: `訂單 ${order.orderNo} 的買家於 ${submittedAt} 提交截圖，已超過 24 小時尚未核對。\n金額：HKD ${order.subtotalHkd}\n請盡快前往管理後台核對：/admin/marketplace`,
        });
        // Mark reminder as sent
        await database
          .update(marketplaceOrders)
          .set({ alipayReviewReminderSentAt: new Date() })
          .where(eq(marketplaceOrders.id, order.id));
        console.log(`[AlipayReview] Sent 24hr reminder for order ${order.orderNo}`);
      } catch (err) {
        console.error(`[AlipayReview] Failed to send reminder for order ${order.orderNo}:`, err);
      }
    }
  } catch (err) {
    console.error('[AlipayReview] Timeout check error:', err);
  }
}

/**
 * Start the Alipay review timeout reminder scheduler (every hour).
 */
export function startAlipayReviewReminderScheduler() {
  if (alipayReviewReminderCronJob) return;
  alipayReviewReminderCronJob = cron.schedule(
    '0 * * * *', // Every hour at :00
    async () => {
      try {
        await runAlipayReviewTimeoutCheck();
      } catch (err) {
        console.error('[AlipayReview] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[AlipayReview] Alipay review timeout reminder scheduler started (every hour)');
}

// ─── Cart Expiry Notification Scheduler ─────────────────────────────────────
let cartExpiryNotificationCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Notify users about cart items expiring within 3 days.
 * Runs daily at 10:00 HKT.
 */
async function runCartExpiryNotification() {
  try {
    const { getDb } = await import('./db');
    const { cartItems, marketplaceListings } = await import('../drizzle/schema_new');
    const { createNotification } = await import('./db/notifications');
    const { and, lte, gte, eq } = await import('drizzle-orm');
    const database = await getDb();
    if (!database) return;

    const { getSystemSetting } = await import('./db');
    const now = new Date();
    const reminderDaysSetting = await getSystemSetting('cart_expiry_reminder_days').catch(() => null);
    const reminderDays = reminderDaysSetting ? parseInt(reminderDaysSetting.settingValue) : 3;
    const threeDaysLater = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000);

    // Find cart items expiring within reminderDays days (but not yet expired)
    const expiringItems = await database
      .select({
        id: cartItems.id,
        userId: cartItems.userId,
        listingId: cartItems.listingId,
        expiresAt: cartItems.expiresAt,
      })
      .from(cartItems)
      .where(
        and(
          gte(cartItems.expiresAt, now),
          lte(cartItems.expiresAt, threeDaysLater)
        )
      )
      .limit(500);

    if (expiringItems.length === 0) return;

    // Group by userId
    const byUser = new Map<number, typeof expiringItems>();
    for (const item of expiringItems) {
      if (!byUser.has(item.userId)) byUser.set(item.userId, []);
      byUser.get(item.userId)!.push(item);
    }

    console.log(`[CartExpiry] Sending expiry notifications to ${byUser.size} user(s) for ${expiringItems.length} item(s)`);

    for (const [userId, items] of Array.from(byUser.entries())) {
      try {
        const count = items.length;
        const earliest = items.reduce((a: typeof items[0], b: typeof items[0]) => a.expiresAt < b.expiresAt ? a : b);
        const expiresInHours = Math.round((new Date(earliest.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60));
        const expiresInDays = Math.ceil(expiresInHours / 24);

        await createNotification({
          userId,
          type: 'trade',
          title: `🛒 購物車商品即將到期`,
          body: `你有 ${count} 件購物車商品將在 ${expiresInDays} 天內到期，請盡快結帳或移除，以免失效。`,
          linkUrl: '/cart',
        });
      } catch (err) {
        console.error(`[CartExpiry] Failed to notify user ${userId}:`, err);
      }
    }
  } catch (err) {
    console.error('[CartExpiry] Notification error:', err);
  }
}

/**
 * Start the cart expiry notification scheduler (daily at 10:00 HKT).
 */
export function startCartExpiryNotificationScheduler() {
  if (cartExpiryNotificationCronJob) return;
  cartExpiryNotificationCronJob = cron.schedule(
    '0 10 * * *', // Daily at 10:00 HKT
    async () => {
      try {
        await runCartExpiryNotification();
      } catch (err) {
        console.error('[CartExpiry] Notification scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[CartExpiry] Cart expiry notification scheduler started (daily at 10:00 HKT)');
}


// ─── Meetup Order Auto-Cancel Scheduler ──────────────────────────────────────
// Runs daily at 02:00 HKT to cancel meetup orders that have been in a
// payable state (payment_received / paid_held / processing) for more than 7 days
// without the seller confirming the meetup.
// ─────────────────────────────────────────────────────────────────────────────
let meetupAutoCancelCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startMeetupAutoCancelScheduler() {
  if (meetupAutoCancelCronJob) return;
  meetupAutoCancelCronJob = cron.schedule(
    '0 2 * * *', // Daily at 02:00 HKT
    async () => {
      try {
        await runMeetupAutoCancel();
      } catch (err) {
        console.error('[MeetupAutoCancel] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[MeetupAutoCancel] Meetup auto-cancel scheduler started (daily at 02:00 HKT)');
}

export function stopMeetupAutoCancelScheduler() {
  if (meetupAutoCancelCronJob) {
    meetupAutoCancelCronJob.stop();
    meetupAutoCancelCronJob = null;
  }
}

/**
 * Cancel meetup orders that have been unconfirmed for more than meetup_cancel_days days.
 * Exported for unit-testing.
 */
export async function runMeetupAutoCancel(overrideDays?: number): Promise<{ cancelled: number; errors: number }> {
  const { getDb, getSystemSetting, getSellerProfileById, restoreListingStock } = await import('./db');
  const { marketplaceOrders, marketplaceOrderItems, offers: offersTable } = await import('../drizzle/schema_new');
  const { and, eq, lt, inArray } = await import('drizzle-orm');
  const { createNotification } = await import('./db/notifications');

  const db = await getDb();
  if (!db) return { cancelled: 0, errors: 0 };

  const now = new Date();

  // Read timeout from systemSettings (default: 7 days)
  const daySetting = overrideDays != null
    ? null
    : await getSystemSetting('meetup_cancel_days').catch(() => null);
  const cancelDays = overrideDays ?? (daySetting ? parseInt(daySetting.settingValue) : 7);
  const cutoff = new Date(now.getTime() - cancelDays * 24 * 60 * 60 * 1000);

  // Find meetup orders stuck in payable states beyond the cutoff
  const stuckOrders = await db.select({
    id: marketplaceOrders.id,
    orderNo: marketplaceOrders.orderNo,
    buyerId: marketplaceOrders.buyerId,
    sellerId: marketplaceOrders.sellerId,
    listingId: marketplaceOrders.listingId,
    orderStatus: marketplaceOrders.orderStatus,
    createdAt: marketplaceOrders.createdAt,
  })
    .from(marketplaceOrders)
    .where(
      and(
        eq(marketplaceOrders.shippingMethod, 'meetup'),
        inArray(marketplaceOrders.orderStatus, ['payment_received', 'paid_held', 'processing']),
        lt(marketplaceOrders.createdAt, cutoff)
      )
    );

  if (stuckOrders.length === 0) {
    console.log('[MeetupAutoCancel] No stuck meetup orders found');
    return { cancelled: 0, errors: 0 };
  }

  console.log(`[MeetupAutoCancel] Found ${stuckOrders.length} stuck meetup orders to cancel (>${cancelDays} days)`);

  let cancelled = 0;
  let errors = 0;

  for (const order of stuckOrders) {
    try {
      // Cancel the order
      await db.update(marketplaceOrders)
        .set({ orderStatus: 'cancelled', updatedAt: now })
        .where(eq(marketplaceOrders.id, order.id));

      // Restore listing stock
      const items = await db.select()
        .from(marketplaceOrderItems)
        .where(eq(marketplaceOrderItems.orderId, order.id));

      if (items.length > 0) {
        for (const item of items) {
          await restoreListingStock(item.listingId, item.quantity ?? 1);
        }
      } else if (order.listingId) {
        await restoreListingStock(order.listingId, 1);
      }

      // Mark any accepted offers linked to this order as expired
      await db.update(offersTable)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(offersTable.orderId, order.id),
            eq(offersTable.status, 'accepted')
          )
        );

      // Notify buyer
      await createNotification({
        userId: order.buyerId,
        type: 'order',
        title: '面交訂單已自動取消',
        body: `訂單 #${order.orderNo} 因超過 ${cancelDays} 天未完成面交確認，已自動取消，商品已重新上架。如有疑問請聯絡賣家。`,
        linkUrl: `/orders/${order.orderNo}`,
        relatedId: order.id,
      }).catch(() => {});

      // Notify seller
      if (order.sellerId != null) {
        const sellerProf = await getSellerProfileById(order.sellerId);
        if (sellerProf?.userId) {
          await createNotification({
            userId: sellerProf.userId,
            type: 'order',
            title: '面交訂單已自動取消',
            body: `訂單 #${order.orderNo} 因超過 ${cancelDays} 天未確認面交，已自動取消，商品已重新上架。`,
            linkUrl: '/seller',
            relatedId: order.id,
          }).catch(() => {});
        }
      }

      console.log(`[MeetupAutoCancel] Cancelled meetup order ${order.orderNo} (id: ${order.id})`);
      cancelled++;
    } catch (err) {
      console.error(`[MeetupAutoCancel] Failed to cancel order ${order.id}:`, err);
      errors++;
    }
  }

  console.log(`[MeetupAutoCancel] Done: cancelled=${cancelled}, errors=${errors}`);
  return { cancelled, errors };
}

// ─── Listing Stock Consistency Repair Scheduler ─────────────────────────────
// Runs daily at 04:00 HKT to detect and repair listings with inconsistent stock.
// Fixes two known issues from legacy code:
//   1. active listings with quantity=0 (old buyerCancelOrder didn't restore quantity)
//   2. reserved listings with no pending_payment orders (stuck in reserved state)
let listingStockRepairCronJob: ReturnType<typeof cron.schedule> | null = null;
export function startListingStockRepairScheduler() {
  if (listingStockRepairCronJob) return;
  listingStockRepairCronJob = cron.schedule(
    '0 4 * * *', // Daily at 04:00 HKT
    async () => {
      try {
        const { getDb } = await import('./db');
        const { marketplaceListings, marketplaceOrders } = await import('../drizzle/schema_new');
        const { eq, and, sql: sqlFn, notInArray } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;

        // Fix 1: active listings with quantity=0 but no pending_payment orders
        // These are stuck due to legacy bug where buyerCancelOrder only restored status, not quantity
        const activeZeroStock = await db.execute(
          sqlFn`SELECT l.id, l.title, l.quantity, l.remainingQuantity
                FROM marketplaceListings l
                WHERE l.status = 'active'
                  AND l.quantity <= 0
                  AND NOT EXISTS (
                    SELECT 1 FROM marketplaceOrders o
                    WHERE o.listingId = l.id AND o.orderStatus = 'pending_payment'
                  )`
        );
        const fix1Rows = (activeZeroStock as any)?.[0] ?? [];
        if (fix1Rows.length > 0) {
          console.log(`[StockRepair] Found ${fix1Rows.length} active listings with quantity=0, repairing...`);
          for (const row of fix1Rows) {
            await db.execute(
              sqlFn`UPDATE marketplaceListings
                    SET quantity = 1, remainingQuantity = 1, updatedAt = NOW()
                    WHERE id = ${row.id} AND status = 'active' AND quantity <= 0`
            );
            console.log(`[StockRepair] Fixed listing ${row.id} (${row.title}): quantity restored to 1`);
          }
        }

        // Fix 2: reserved listings with no pending_payment orders (stuck reserved state)
        const stuckReserved = await db.execute(
          sqlFn`SELECT l.id, l.title, l.quantity, l.remainingQuantity
                FROM marketplaceListings l
                WHERE l.status = 'reserved'
                  AND NOT EXISTS (
                    SELECT 1 FROM marketplaceOrders o
                    WHERE o.listingId = l.id AND o.orderStatus = 'pending_payment'
                  )`
        );
        const fix2Rows = (stuckReserved as any)?.[0] ?? [];
        if (fix2Rows.length > 0) {
          console.log(`[StockRepair] Found ${fix2Rows.length} stuck reserved listings, repairing...`);
          for (const row of fix2Rows) {
            await db.execute(
              sqlFn`UPDATE marketplaceListings
                    SET status = 'active',
                        quantity = GREATEST(quantity, 1),
                        remainingQuantity = GREATEST(remainingQuantity, 1),
                        updatedAt = NOW()
                    WHERE id = ${row.id} AND status = 'reserved'`
            );
            console.log(`[StockRepair] Fixed stuck reserved listing ${row.id} (${row.title}): restored to active`);
          }
        }

        if (fix1Rows.length === 0 && fix2Rows.length === 0) {
          console.log('[StockRepair] No inconsistent listings found.');
        }
      } catch (err) {
        console.error('[StockRepair] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[StockRepair] Listing stock repair scheduler started (daily at 04:00 HKT)');
}
export function stopListingStockRepairScheduler() {
  if (listingStockRepairCronJob) {
    listingStockRepairCronJob.stop();
    listingStockRepairCronJob = null;
  }
}


// ============================================================
// P2 Fix #8: Payout Retry Scheduler
// Automatically retries failed payouts every 2 hours
// ============================================================
let payoutRetryCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startPayoutRetryScheduler() {
  if (payoutRetryCronJob) return;

  payoutRetryCronJob = cron.schedule(
    '0 */2 * * *', // Every 2 hours
    async () => {
      console.log('[PayoutRetry] Starting failed payout retry...');
      try {
        const { getDb } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { eq, and } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;

        // Find failed payouts that are retryable
        const failedOrders = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
        })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'completed'),
              eq(marketplaceOrders.sellerType, 'seller'),
              eq(marketplaceOrders.payoutStatus, 'failed')
            )
          )
          .limit(20);

        if (failedOrders.length === 0) {
          console.log('[PayoutRetry] No failed payouts to retry.');
          return;
        }

        console.log(`[PayoutRetry] Found ${failedOrders.length} failed payouts to retry.`);
        let succeeded = 0;
        let stillFailed = 0;

        for (const { id, orderNo } of failedOrders) {
          try {
            const { executeSellerPayout } = await import('./sellerPayout');
            const result = await executeSellerPayout(id);
            if (result.success) {
              succeeded++;
              console.log(`[PayoutRetry] \u2705 Order ${orderNo} retry succeeded: ${result.transferId}`);
            } else {
              stillFailed++;
              console.warn(`[PayoutRetry] \u274c Order ${orderNo} retry failed: ${result.error}`);
            }
          } catch (err: any) {
            stillFailed++;
            console.error(`[PayoutRetry] Order ${orderNo} retry threw:`, err.message);
          }
        }

        console.log(`[PayoutRetry] Completed: ${succeeded} succeeded, ${stillFailed} still failed.`);

        // Notify admin if there are persistent failures
        if (stillFailed > 0) {
          try {
            const { createNotification } = await import('./db/notifications');
            // Notify admin via owner notification
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: '放款重試報告',
              content: `自動重試 ${failedOrders.length} 筆失敗放款：${succeeded} 筆成功，${stillFailed} 筆仍失敗。請到管理後台查看詳情。`,
            });
          } catch {}
        }
      } catch (err) {
        console.error('[PayoutRetry] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[PayoutRetry] Payout retry scheduler started (every 2 hours)');
}

export function stopPayoutRetryScheduler() {
  if (payoutRetryCronJob) {
    payoutRetryCronJob.stop();
    payoutRetryCronJob = null;
  }
}


// ============================================================
// 48-Hour Cooling Period Payout Scheduler
// Triggers payout for orders where payoutHoldUntil has passed
// and no active dispute exists
// ============================================================
let payoutHoldSchedulerCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startPayoutHoldScheduler() {
  if (payoutHoldSchedulerCronJob) return;

  payoutHoldSchedulerCronJob = cron.schedule(
    '0 * * * *', // Every hour at :00
    async () => {
      console.log('[PayoutHold] Checking for orders past cooling period...');
      try {
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { eq, and, lte, isNotNull, ne } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Find orders where:
        // 1. payoutHoldUntil has passed
        // 2. orderStatus = 'completed'
        // 3. payoutStatus = 'processing' (not yet paid)
        // 4. orderStatus != 'disputed' (no active dispute)
        // 5. sellerType = 'seller' (C2C orders only)
        const readyOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              // orderStatus='completed' already excludes 'disputed' (P3-1: removed redundant ne condition)
              eq(marketplaceOrders.orderStatus, 'completed'),
              eq(marketplaceOrders.payoutStatus, 'processing'),
              eq(marketplaceOrders.sellerType, 'seller'),
              isNotNull(marketplaceOrders.payoutHoldUntil),
              lte(marketplaceOrders.payoutHoldUntil, now)
            )
          )
          .limit(50);

        if (readyOrders.length === 0) {
          console.log('[PayoutHold] No orders ready for payout.');
          return;
        }

        console.log(`[PayoutHold] Found ${readyOrders.length} orders ready for payout.`);
        let succeeded = 0;
        let failed = 0;

        for (const order of readyOrders) {
          try {
            const { executeSellerPayout } = await import('./sellerPayout');
            const payoutResult = await executeSellerPayout(order.id);
            if (payoutResult.success) {
              succeeded++;
              console.log(`[PayoutHold] ✅ Order ${order.orderNo} payout succeeded: ${payoutResult.transferId}, HKD ${payoutResult.amountHkd}`);
              // Notify seller: payout completed
              if (order.sellerId) {
                const sellerProfile = await getSellerProfileById(order.sellerId);
                if (sellerProfile?.userId) {
                  const amountStr = parseFloat(order.sellerReceivableHkd as string).toFixed(2);
                  await createNotification({
                    userId: sellerProfile.userId,
                    type: 'trade',
                    title: '💰 款項已成功轉帳',
                    body: `您的訂單 #${order.orderNo} 款項已成功轉帳至您的 Stripe 帳戶，金額 HKD ${amountStr}。`,
                    linkUrl: `/seller`,
                  }).catch(() => {});
                  // Send email notification to seller
                  ;(async () => {
                    try {
                      const { getUserById } = await import('./userManagement');
                      const sellerUser = await getUserById(sellerProfile.userId);
                      if (!sellerUser?.email) return;
                      const { sendEmail, wrapHtmlTest } = await import('./emailService');
                      const subject = `💰 款項已轉帳 — 訂單 #${order.orderNo}`;
                      const html = wrapHtmlTest(
                        subject,
                        `<h2 style="margin:0 0 8px;color:#06038d;font-size:22px;">款項已成功轉帳 💰</h2>
                        <p style="margin:0 0 16px;color:#555;font-size:15px;">
                          親愛的 <strong>${sellerUser.name || '賣家'}</strong>，<br/>
                          您的訂單 <strong>#${order.orderNo}</strong> 的 48 小時冷靜期已結束，款項已成功轉帳至您的 Stripe 帳戶。
                        </p>
                        <div style="background:#f0f4ff;border-radius:12px;padding:16px 20px;margin:0 0 20px;">
                          <p style="margin:0 0 6px;color:#06038d;font-size:13px;font-weight:600;">轉帳詳情</p>
                          <p style="margin:0 0 4px;color:#333;font-size:15px;">訂單號：<strong>#${order.orderNo}</strong></p>
                          <p style="margin:0 0 4px;color:#333;font-size:15px;">轉帳金額：<strong style="color:#06038d;font-size:18px;">HKD ${amountStr}</strong></p>
                          <p style="margin:0;color:#666;font-size:13px;">轉帳時間：${new Date().toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })}</p>
                        </div>
                        <div style="text-align:center;margin:24px 0;">
                          <a href="https://boxium.asia/seller" style="display:inline-block;background:#FFD700;color:#06038d;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:50px;text-decoration:none;">前往賣家中心查看</a>
                        </div>
                        <p style="color:#999;font-size:12px;text-align:center;">款項將在 1-3 個工作天內到達您的銀行帳戶，具體時間取決於 Stripe 的處理進度。</p>`
                      );
                      await sendEmail({ to: sellerUser.email, subject, html, emailType: 'order', toUserId: sellerProfile.userId, dedupeKey: `payout_completed_${order.id}` });
                    } catch (e) {
                      console.warn(`[PayoutHold] Email notification failed for order ${order.orderNo}:`, e);
                    }
                  })();
                }
              }
            } else {
              failed++;
              console.error(`[PayoutHold] ❌ Order ${order.orderNo} payout failed: ${payoutResult.error}`);
            }
          } catch (err: any) {
            failed++;
            console.error(`[PayoutHold] Order ${order.orderNo} payout threw:`, err.message);
          }
        }

        console.log(`[PayoutHold] Completed: ${succeeded} succeeded, ${failed} failed.`);

        // Notify admin if there are failures
        if (failed > 0) {
          try {
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: '48小時放款報告',
              content: `自動處理 ${readyOrders.length} 筆放款：${succeeded} 筆成功，${failed} 筆失敗。請到管理後台查看詳情。`,
            });
          } catch {}
        }
      } catch (err) {
        console.error('[PayoutHold] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[PayoutHold] 48-hour cooling period payout scheduler started (every hour)');
}

export function stopPayoutHoldScheduler() {
  if (payoutHoldSchedulerCronJob) {
    payoutHoldSchedulerCronJob.stop();
    payoutHoldSchedulerCronJob = null;
  }
}


// ============================================================
// P2 Fix #10: Dispute SLA Escalation Scheduler
// Checks for disputes past their SLA deadline and escalates
// ============================================================
let disputeSlaEscalationCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startDisputeSlaEscalationScheduler() {
  if (disputeSlaEscalationCronJob) return;

  disputeSlaEscalationCronJob = cron.schedule(
    '30 */4 * * *', // Every 4 hours at :30
    async () => {
      console.log('[DisputeSLA] Checking for overdue disputes...');
      try {
        const { getDb } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { eq, and, lte, isNotNull, isNull } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Find disputed orders past their SLA deadline that haven't been resolved
        const overdueDisputes = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
          disputeDeadlineAt: marketplaceOrders.disputeDeadlineAt,
          disputePriority: marketplaceOrders.disputePriority,
          subtotalHkd: marketplaceOrders.subtotalHkd,
        })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'disputed'),
              isNotNull(marketplaceOrders.disputeDeadlineAt),
              lte(marketplaceOrders.disputeDeadlineAt, now),
              isNull(marketplaceOrders.disputeResolvedAt)
            )
          )
          .limit(20);

        if (overdueDisputes.length === 0) {
          console.log('[DisputeSLA] No overdue disputes found.');
          return;
        }

        console.log(`[DisputeSLA] Found ${overdueDisputes.length} overdue dispute(s).`);

        // Escalate priority and notify admin
        for (const dispute of overdueDisputes) {
          try {
            // Escalate to high priority if not already
            if (dispute.disputePriority !== 'high') {
              await db.update(marketplaceOrders)
                .set({ disputePriority: 'high' })
                .where(eq(marketplaceOrders.id, dispute.id));
            }

            const openedAt = dispute.disputeOpenedAt
              ? new Date(dispute.disputeOpenedAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
              : '未知';
            const deadlineAt = dispute.disputeDeadlineAt
              ? new Date(dispute.disputeDeadlineAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
              : '未知';

            // Notify admin via email
            const { notifyAdmin } = await import('./emailService');
            await notifyAdmin({
              title: `⚠️ 爭議 SLA 超時 — 訂單 ${dispute.orderNo}`,
              content: `訂單 ${dispute.orderNo} 的爭議已超過 SLA 期限。\n開啟時間：${openedAt}\nSLA 期限：${deadlineAt}\n金額：HKD ${dispute.subtotalHkd}\n優先級已自動升級為「高」。請盡快處理。`,
            });

            // Also notify owner
            const { notifyOwner } = await import('./_core/notification');
            await notifyOwner({
              title: `爭議 SLA 超時 — ${dispute.orderNo}`,
              content: `訂單 ${dispute.orderNo} 的爭議已超過 SLA 期限，優先級已升級為「高」。`,
            });

            console.log(`[DisputeSLA] Escalated dispute for order ${dispute.orderNo} to high priority.`);
          } catch (err: any) {
            console.error(`[DisputeSLA] Failed to escalate dispute for order ${dispute.orderNo}:`, err.message);
          }
        }
      } catch (err) {
        console.error('[DisputeSLA] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[DisputeSLA] Dispute SLA escalation scheduler started (every 4 hours)');
}

export function stopDisputeSlaEscalationScheduler() {
  if (disputeSlaEscalationCronJob) {
    disputeSlaEscalationCronJob.stop();
    disputeSlaEscalationCronJob = null;
  }
}

// ─── Dispute 3-Day Reminder Scheduler ────────────────────────────────────────
let dispute3DayReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * Check for disputes that have been open for more than 3 days without resolution.
 * Runs every 6 hours. Sends an Email reminder to admin for each overdue dispute.
 */
export function startDispute3DayReminderScheduler() {
  if (dispute3DayReminderCronJob) return;
  dispute3DayReminderCronJob = cron.schedule(
    '0 */6 * * *', // Every 6 hours
    async () => {
      console.log('[Dispute3Day] Checking for disputes open > 3 days...');
      try {
        const { getDb } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { eq, and, lte, isNotNull } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;

        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        // Find disputes open for more than 3 days that are still unresolved
        const overdueDisputes = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          disputeOpenedAt: marketplaceOrders.disputeOpenedAt,
          subtotalHkd: marketplaceOrders.subtotalHkd,
          disputeReason: marketplaceOrders.disputeReason,
        })
          .from(marketplaceOrders)
          .where(
            and(
              eq(marketplaceOrders.orderStatus, 'disputed'),
              isNotNull(marketplaceOrders.disputeOpenedAt),
              lte(marketplaceOrders.disputeOpenedAt, threeDaysAgo)
            )
          )
          .limit(20);

        if (overdueDisputes.length === 0) {
          console.log('[Dispute3Day] No disputes open > 3 days.');
          return;
        }

        console.log(`[Dispute3Day] Found ${overdueDisputes.length} dispute(s) open > 3 days.`);

        // Build a summary email for admin
        const disputeList = overdueDisputes.map((d: any, i: number) => {
          const openedAt = d.disputeOpenedAt
            ? new Date(d.disputeOpenedAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })
            : '未知';
          const daysOpen = d.disputeOpenedAt
            ? Math.floor((Date.now() - new Date(d.disputeOpenedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          return `${i + 1}. 訂單 ${d.orderNo} — 已開啟 ${daysOpen} 天（${openedAt}）— HKD ${d.subtotalHkd}${d.disputeReason ? `\n   原因：${d.disputeReason}` : ''}`;
        }).join('\n');

        const { notifyAdmin } = await import('./emailService');
        await notifyAdmin({
          title: `⏰ ${overdueDisputes.length} 件爭議已超過 3 天未解決`,
          content: `以下爭議案件已開啟超過 3 天，請盡快處理：\n\n${disputeList}\n\n請前往管理後台 → 訊息管理 → 爭議訂單進行處理。`,
        });

        // Also notify owner via platform notification
        const { notifyOwner } = await import('./_core/notification');
        await notifyOwner({
          title: `${overdueDisputes.length} 件爭議超過 3 天未解決`,
          content: `共 ${overdueDisputes.length} 件爭議案件已開啟超過 3 天，請盡快介入處理。`,
        });

        console.log(`[Dispute3Day] Sent reminder for ${overdueDisputes.length} overdue dispute(s).`);
      } catch (err) {
        console.error('[Dispute3Day] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[Dispute3Day] Dispute 3-day reminder scheduler started (every 6 hours)');
}

export function stopDispute3DayReminderScheduler() {
  if (dispute3DayReminderCronJob) {
    dispute3DayReminderCronJob.stop();
    dispute3DayReminderCronJob = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Orphan Auction Order Repair Scheduler
// Detects ended_sold auctions with no corresponding order and re-creates them
// ─────────────────────────────────────────────────────────────────────────────
let orphanAuctionRepairCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startOrphanAuctionRepairScheduler() {
  if (orphanAuctionRepairCronJob) return;

  orphanAuctionRepairCronJob = cron.schedule(
    '0 */2 * * *', // Every 2 hours
    async () => {
      try {
        const { getDb } = await import('./db');
        const { marketplaceListings, marketplaceOrders, auctionBids } = await import('../drizzle/schema_new');
        const { eq, isNull, and } = await import('drizzle-orm');
        const db = await getDb();
        if (!db) return;

        // Find ended_sold auctions with no auctionOrderId
        const orphanListings = await db
          .select()
          .from(marketplaceListings)
          .where(and(
            eq(marketplaceListings.auctionStatus, 'ended_sold'),
            isNull(marketplaceListings.auctionOrderId)
          ))
          .limit(20);

        if (orphanListings.length === 0) return;

        console.log(`[OrphanAuctionRepair] Found ${orphanListings.length} orphan auction(s) to repair`);

        for (const listing of orphanListings) {
          try {
            // Check if an order already exists (by listingId + orderSource)
            const existingOrders = await db
              .select({ id: marketplaceOrders.id })
              .from(marketplaceOrders)
              .where(and(
                eq(marketplaceOrders.listingId, listing.id),
                eq(marketplaceOrders.orderSource, 'auction')
              ))
              .limit(1);

            if (existingOrders.length > 0) {
              // Order exists, just update the listing's auctionOrderId
              await db.update(marketplaceListings)
                .set({ auctionOrderId: existingOrders[0].id })
                .where(eq(marketplaceListings.id, listing.id));
              console.log(`[OrphanAuctionRepair] Linked existing order ${existingOrders[0].id} to auction ${listing.id}`);
              continue;
            }

            // No order exists - need to create one
            if (!listing.winnerId || !listing.winningBidId) {
              console.warn(`[OrphanAuctionRepair] Auction ${listing.id} has no winner, skipping`);
              continue;
            }

            // Get the winning bid
            const [winningBid] = await db
              .select()
              .from(auctionBids)
              .where(eq(auctionBids.id, listing.winningBidId))
              .limit(1);

            if (!winningBid) {
              console.warn(`[OrphanAuctionRepair] Winning bid ${listing.winningBidId} not found for auction ${listing.id}`);
              continue;
            }

            const winAmount = parseFloat(winningBid.amount as any);
            const itemSellerType = listing.sellerId ? 'seller' : 'platform';
            // Tiered fee rate: 5% for ≤5000, 4% for ≤10000, 3% for >10000
            let PLATFORM_FEE_RATE: number;
            if (itemSellerType === 'platform') {
              PLATFORM_FEE_RATE = 0;
            } else {
              try {
                const { getSystemSetting } = await import('./db');
                const [t1max, t1rate, t2max, t2rate, t3rate] = await Promise.all([
                  getSystemSetting('fee_tier_1_max'), getSystemSetting('fee_tier_1_rate'),
                  getSystemSetting('fee_tier_2_max'), getSystemSetting('fee_tier_2_rate'),
                  getSystemSetting('fee_tier_3_rate'),
                ]);
                const tier1Max  = t1max  ? parseFloat(t1max.settingValue)  : 5000;
                const tier1Rate = t1rate ? parseFloat(t1rate.settingValue) : 0.05;
                const tier2Max  = t2max  ? parseFloat(t2max.settingValue)  : 10000;
                const tier2Rate = t2rate ? parseFloat(t2rate.settingValue) : 0.04;
                const tier3Rate = t3rate ? parseFloat(t3rate.settingValue) : 0.03;
                if (winAmount <= tier1Max) PLATFORM_FEE_RATE = tier1Rate;
                else if (winAmount <= tier2Max) PLATFORM_FEE_RATE = tier2Rate;
                else PLATFORM_FEE_RATE = tier3Rate;
              } catch {
                PLATFORM_FEE_RATE = winAmount <= 5000 ? 0.05 : winAmount <= 10000 ? 0.04 : 0.03;
              }
            }
            const platformFee = parseFloat((winAmount * PLATFORM_FEE_RATE).toFixed(2));
            const sellerReceivable = parseFloat((winAmount - platformFee).toFixed(2));

            const { generateOrderNo, createMarketplaceOrder, createOrderItems } = await import('./db');
            const orderNo = await generateOrderNo();

            const newOrder = await createMarketplaceOrder({
              orderNo,
              buyerId: winningBid.bidderId,
              sellerId: listing.sellerId ?? undefined,
              sellerType: itemSellerType,
              listingId: listing.id,
              unitPriceHkd: winAmount.toFixed(2),
              quantity: 1,
              subtotalHkd: winAmount.toFixed(2),
              platformFeeRate: PLATFORM_FEE_RATE.toFixed(4),
              platformFeeHkd: platformFee.toFixed(2),
              sellerReceivableHkd: sellerReceivable.toFixed(2),
              paymentMethod: 'stripe',
              orderStatus: 'pending_payment',
              paymentStatus: 'pending',
              orderSource: 'auction',
              auctionListingId: listing.id,
              auctionWinningBidId: winningBid.id,
            } as any);

            if (newOrder) {
              await createOrderItems([{
                orderId: newOrder.id,
                listingId: listing.id,
                sellerId: listing.sellerId ?? undefined,
                sellerType: itemSellerType,
                title: listing.title ?? `拍賣品 #${listing.id}`,
                price: winAmount.toFixed(2),
                quantity: 1,
              } as any]);

              await db.update(marketplaceListings)
                .set({ auctionOrderId: newOrder.id })
                .where(eq(marketplaceListings.id, listing.id));

              console.log(`[OrphanAuctionRepair] Repaired auction ${listing.id} → created order ${orderNo} (id=${newOrder.id})`);
            }
          } catch (err) {
            console.error(`[OrphanAuctionRepair] Failed to repair auction ${listing.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[OrphanAuctionRepair] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );

  console.log('[OrphanAuctionRepair] Orphan auction order repair scheduler started (every 2 hours)');
}

export function stopOrphanAuctionRepairScheduler() {
  if (orphanAuctionRepairCronJob) {
    orphanAuctionRepairCronJob.stop();
    orphanAuctionRepairCronJob = null;
  }
}

// ─── PSA Grading Overdue Payment Reminder ────────────────────────────────────
let gradingOverdueCronJob: ReturnType<typeof cron.schedule> | null = null;

/**
 * PSA Grading Overdue Payment Reminder Scheduler
 * Runs daily at 10:00 HKT (02:00 UTC).
 * - Day 15: sends first reminder
 * - Day 25: sends final warning
 * - Day 30+: marks submission as overdue
 */
export function startGradingOverdueReminderScheduler() {
  if (gradingOverdueCronJob) return;
  gradingOverdueCronJob = cron.schedule(
    '0 2 * * *', // 10:00 HKT = 02:00 UTC
    async () => {
      try {
        const { getDb } = await import('./db');
        const { gradingSubmissions } = await import('../drizzle/schema_new');
        const { and, eq, isNotNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const { sendEmail } = await import('./emailService');
        const { getUserById } = await import('./userManagement');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        const pendingSubmissions = await db.select({
          id: gradingSubmissions.id,
          orderNo: gradingSubmissions.orderNo,
          userId: gradingSubmissions.userId,
          paymentDueAt: gradingSubmissions.paymentDueAt,
          totalFeeHkd: gradingSubmissions.totalFeeHkd,
          day15ReminderSentAt: gradingSubmissions.day15ReminderSentAt,
          day25ReminderSentAt: gradingSubmissions.day25ReminderSentAt,
        })
          .from(gradingSubmissions)
          .where(and(eq(gradingSubmissions.status, 'graded'), isNotNull(gradingSubmissions.paymentDueAt)))
          .limit(200);

        if (pendingSubmissions.length === 0) return;
        console.log(`[GradingOverdue] Checking ${pendingSubmissions.length} pending payment submissions`);

        for (const sub of pendingSubmissions) {
          try {
            if (!sub.paymentDueAt) continue;
            const dueAt = new Date(sub.paymentDueAt);
            const daysUntilDue = Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilDue <= 0) {
              await db.update(gradingSubmissions).set({ status: 'payment_overdue' }).where(eq(gradingSubmissions.id, sub.id));
              const user = await getUserById(sub.userId);
              if (user) {
                await createNotification({ userId: sub.userId, type: 'system', title: '⚠️ PSA 鑑定費用逾期未付', body: `您的鑑定申請 ${sub.orderNo} 付款期限已過，BOXIUM 將依條款對相關卡片自行處理。`, linkUrl: `/grading/orders/${sub.id}` });
                await sendEmail({ to: user.email, subject: `[BOXIUM] PSA 鑑定費用逾期 — ${sub.orderNo}`, html: `<p>您好，您的鑑定申請 <strong>${sub.orderNo}</strong> 付款期限已過，BOXIUM 將依服務條款處理相關卡片。如有疑問請聯絡客服。</p><p>BOXIUM 團隊</p>` });
              }
              console.log(`[GradingOverdue] Marked ${sub.orderNo} as overdue`);
            } else if (daysUntilDue <= 5 && !sub.day25ReminderSentAt) {
              await db.update(gradingSubmissions).set({ day25ReminderSentAt: now }).where(eq(gradingSubmissions.id, sub.id));
              const user = await getUserById(sub.userId);
              if (user) {
                await createNotification({ userId: sub.userId, type: 'payment', title: '🚨 最後警告：PSA 鑑定費用即將逾期', body: `申請 ${sub.orderNo} 還有 ${daysUntilDue} 天到期，費用 HK$${sub.totalFeeHkd}，請盡快付款。`, linkUrl: `/grading/orders/${sub.id}` });
                await sendEmail({ to: user.email, subject: `[BOXIUM] 最後警告：PSA 鑑定費用還有 ${daysUntilDue} 天到期`, html: `<p>您好，您的鑑定申請 <strong>${sub.orderNo}</strong> 付款期限還有 <strong>${daysUntilDue} 天</strong>，費用 HK$${sub.totalFeeHkd}，請盡快完成付款。</p><p>BOXIUM 團隊</p>` });
              }
              console.log(`[GradingOverdue] Sent day-25 final warning for ${sub.orderNo}`);
            } else if (daysUntilDue <= 15 && !sub.day15ReminderSentAt) {
              await db.update(gradingSubmissions).set({ day15ReminderSentAt: now }).where(eq(gradingSubmissions.id, sub.id));
              const user = await getUserById(sub.userId);
              if (user) {
                await createNotification({ userId: sub.userId, type: 'payment', title: '📢 提醒：PSA 鑑定費用待付款', body: `申請 ${sub.orderNo} 還有 ${daysUntilDue} 天到期，費用 HK$${sub.totalFeeHkd}，請記得在期限前付款。`, linkUrl: `/grading/orders/${sub.id}` });
                await sendEmail({ to: user.email, subject: `[BOXIUM] PSA 鑑定費用提醒：還有 ${daysUntilDue} 天到期`, html: `<p>您好，您的鑑定申請 <strong>${sub.orderNo}</strong> 鑑定已完成，付款期限還有 <strong>${daysUntilDue} 天</strong>，費用 HK$${sub.totalFeeHkd}。</p><p>BOXIUM 團隊</p>` });
              }
              console.log(`[GradingOverdue] Sent day-15 reminder for ${sub.orderNo}`);
            }
          } catch (err) {
            console.error(`[GradingOverdue] Error processing ${sub.orderNo}:`, err);
          }
        }
      } catch (err) {
        console.error('[GradingOverdue] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[GradingOverdue] PSA grading overdue reminder scheduler started (daily at 10:00 HKT)');
}

export function stopGradingOverdueReminderScheduler() {
  if (gradingOverdueCronJob) {
    gradingOverdueCronJob.stop();
    gradingOverdueCronJob = null;
  }
}

// ─── PSA Grading: Clean up awaiting_payment submissions older than 24 hours ──
let gradingAwaitingPaymentCleanupCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startGradingAwaitingPaymentCleanupScheduler() {
  if (gradingAwaitingPaymentCleanupCronJob) return;
  // Run every hour at minute 10 (standard 5-field cron)
  gradingAwaitingPaymentCleanupCronJob = cron.schedule(
    '10 * * * *',
    async () => {
      try {
        const { getDb: _getDb } = await import('./db');
        const db = await _getDb();
        if (!db) return;
        const { gradingSubmissions: _gSubs } = await import('../drizzle/schema_new');
        const { lt: _lt, and: _and, eq: _eq } = await import('drizzle-orm');
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        await db
          .update(_gSubs)
          .set({ status: 'cancelled' })
          .where(
            _and(
              _eq(_gSubs.status, 'awaiting_payment'),
              _lt(_gSubs.createdAt, cutoff)
            )
          );
        console.log(`[GradingCleanup] Cancelled awaiting_payment submissions older than 24h`);
      } catch (err) {
        console.error('[GradingCleanup] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[GradingCleanup] PSA grading awaiting_payment cleanup scheduler started (every hour at :10)');
}

export function stopGradingAwaitingPaymentCleanupScheduler() {
  if (gradingAwaitingPaymentCleanupCronJob) {
    gradingAwaitingPaymentCleanupCronJob.stop();
    gradingAwaitingPaymentCleanupCronJob = null;
  }
}

// ─── PSA Grading: Upgrade diff fee overdue reminder (48 hours) ────────────────
let gradingUpgradeOverdueCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startGradingUpgradeOverdueReminderScheduler() {
  if (gradingUpgradeOverdueCronJob) return;
  // Run every day at 11:00 HKT
  gradingUpgradeOverdueCronJob = cron.schedule(
    '0 11 * * *',
    async () => {
      try {
        const { getDb: _getDb } = await import('./db');
        const db = await _getDb();
        if (!db) return;
        const { gradingSubmissions: _gSubs } = await import('../drizzle/schema_new');
        const { isNotNull, isNull, lt: _lt, and: _and, or: _or } = await import('drizzle-orm');
        const { getUserById } = await import('./userManagement');
        const { createNotification } = await import('./db/notifications');
        const { sendEmail } = await import('./emailService');

        // Find submissions with upgrade checkout but not yet paid, created > 48h ago
        // Also check upgradeReminderSentAt to avoid sending duplicate reminders within 24h
        const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const overdueUpgrades = await db
          .select()
          .from(_gSubs)
          .where(
            _and(
              isNotNull(_gSubs.upgradeCheckoutSessionId),
              isNull(_gSubs.upgradePaidAt),
              _lt(_gSubs.upgradeCheckoutAt, cutoff48h),
              // Only send if never reminded OR last reminder was > 24h ago
              _or(
                isNull(_gSubs.upgradeReminderSentAt),
                _lt(_gSubs.upgradeReminderSentAt, cutoff24h)
              )
            )
          );

        for (const sub of overdueUpgrades) {
          try {
            const user = await getUserById(sub.userId);
            if (!user) continue;

            const diffFee = parseFloat(sub.upgradeDiffFeeHkd ?? '0');
            const newTotal = parseFloat(sub.totalFeeHkd ?? '0');

            // Send in-app notification
            await createNotification({
              userId: sub.userId,
              type: 'payment',
              title: '⚠️ 提醒：PSA 鑑定服務升級差價待補付',
              body: `申請 ${sub.orderNo} 的服務層級已升級，差價 HK$${diffFee.toLocaleString()} 尚未補付，新總費用 HK$${newTotal.toLocaleString()}，請盡快完成付款。`,
              linkUrl: `/grading/orders/${sub.id}`,
            });

            // Send email reminder
            await sendEmail({
              to: user.email,
              subject: `[BOXIUM] 提醒：PSA 鑑定服務升級差價待補付 - ${sub.orderNo}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #06038d;">PSA 鑑定服務升級差價提醒</h2>
                  <p>您好 ${user.name ?? '客戶'}，</p>
                  <p>您的 PSA 代客鑑定申請 <strong>${sub.orderNo}</strong> 的服務層級已升級，但差價尚未補付。</p>
                  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                    <tr style="background: #f5f5f5;">
                      <td style="padding: 8px 12px; font-weight: bold;">申請單號</td>
                      <td style="padding: 8px 12px;">${sub.orderNo}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 12px; font-weight: bold;">待補付差價</td>
                      <td style="padding: 8px 12px; color: #e65c00; font-weight: bold;">HK$${diffFee.toLocaleString()}</td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                      <td style="padding: 8px 12px; font-weight: bold;">新總費用</td>
                      <td style="padding: 8px 12px; font-weight: bold;">HK$${newTotal.toLocaleString()}</td>
                    </tr>
                  </table>
                  <p>請盡快登入 BOXIUM 完成差價補付，以確保您的鑑定申請順利進行。</p>
                  <a href="https://boxium.asia/grading/orders/${sub.id}" style="display: inline-block; background: #06038d; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">立即補付差價</a>
                  <p style="margin-top: 24px; color: #888; font-size: 12px;">BOXIUM 團隊</p>
                </div>
              `,
            });

            // Update upgradeReminderSentAt to prevent duplicate reminders within 24h
            const { eq: _eq } = await import('drizzle-orm');
            await db.update(_gSubs).set({ upgradeReminderSentAt: new Date() } as any).where(_eq(_gSubs.id, sub.id));
            console.log(`[GradingUpgradeOverdue] Sent 48h reminder for ${sub.orderNo}`);
          } catch (err) {
            console.error(`[GradingUpgradeOverdue] Error processing ${sub.orderNo}:`, err);
          }
        }
      } catch (err) {
        console.error('[GradingUpgradeOverdue] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[GradingUpgradeOverdue] PSA grading upgrade overdue reminder scheduler started (daily at 11:00 HKT)');
}

export function stopGradingUpgradeOverdueReminderScheduler() {
  if (gradingUpgradeOverdueCronJob) {
    gradingUpgradeOverdueCronJob.stop();
    gradingUpgradeOverdueCronJob = null;
  }
}
