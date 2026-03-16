import * as cron from 'node-cron';
import { getPriceUpdateSchedule, updateSnkrdunkLastExecutedAt, updateSnkrdunkLastCatchupAt, addScheduleExecutionHistory, updateScheduleExecutionHistory } from './db';
import { executePersistentSnkrdunkBatchUpdate } from './persistentSnkrdunkBatchUpdate';

let snkrdunkCronJob: ReturnType<typeof cron.schedule> | null = null;
let snkrdunkCronJob2: ReturnType<typeof cron.schedule> | null = null;

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
    if (config.snkrdunkEnabled) {
      startSnkrdunkScheduler(config.snkrdunkUpdateTime, 1);
      // Start second scheduler if configured
      if (config.snkrdunkUpdateTime2) {
        startSnkrdunkScheduler(config.snkrdunkUpdateTime2, 2);
      }

      // ── Catch-up check: run if any scheduled time was missed ──
      // Delay slightly to allow DB connections to stabilize
      setTimeout(async () => {
        try {
          // Re-fetch config to get latest lastExecutedAt
          const freshConfig = await getPriceUpdateSchedule();
          if (!freshConfig?.snkrdunkEnabled) return;

          const missed1 = wasMissedSince(freshConfig.snkrdunkUpdateTime, freshConfig.snkrdunkLastExecutedAt);
          const missed2 = freshConfig.snkrdunkUpdateTime2
            ? wasMissedSince(freshConfig.snkrdunkUpdateTime2, freshConfig.snkrdunkLastExecutedAt)
            : false;

          if (missed1 || missed2) {
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
                const reason = `missed scheduled run (slot1=${missed1}, slot2=${missed2}), last executed: ${freshConfig.snkrdunkLastExecutedAt?.toISOString() ?? 'never'}`;
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
 * @param updateTime - Time in HH:mm format (e.g., "09:00")
 * @param slot - 1 for first slot, 2 for second slot
 */
function startSnkrdunkScheduler(updateTime: string, slot: 1 | 2 = 1) {
  // Stop existing job for this slot if any
  if (slot === 1 && snkrdunkCronJob) {
    snkrdunkCronJob.stop();
  } else if (slot === 2 && snkrdunkCronJob2) {
    snkrdunkCronJob2.stop();
  }

  const [hour, minute] = updateTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`; // Every day at specified time

  console.log(`[PriceUpdateScheduler] Starting SNKRDUNK scheduler #${slot} with cron: ${cronExpression} (${updateTime})`);

  const job = cron.schedule(cronExpression, async () => {
    console.log(`[PriceUpdateScheduler] Executing scheduled SNKRDUNK price update (slot #${slot})...`);
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

  if (slot === 1) {
    snkrdunkCronJob = job;
  } else {
    snkrdunkCronJob2 = job;
  }
  job.start();
  console.log(`[PriceUpdateScheduler] SNKRDUNK scheduler #${slot} started`);
}



/**
 * Stop SNKRDUNK scheduler
 */
export function stopSnkrdunkScheduler() {
  if (snkrdunkCronJob) {
    snkrdunkCronJob.stop();
    snkrdunkCronJob = null;
    console.log('[PriceUpdateScheduler] SNKRDUNK scheduler #1 stopped');
  }
  if (snkrdunkCronJob2) {
    snkrdunkCronJob2.stop();
    snkrdunkCronJob2 = null;
    console.log('[PriceUpdateScheduler] SNKRDUNK scheduler #2 stopped');
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
    snkrdunkScheduler2Running: snkrdunkCronJob2 !== null,
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
        const { getDb, getSellerProfileById } = await import('./db');
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
            // Send auto-completed email to buyer
            try {
              const { sendOrderEmail, buildOrderAutoCompletedBuyerEmail, getOrderEmailData } = await import('./emailService');
              const emailData = await getOrderEmailData(order);
              const { subject, html } = buildOrderAutoCompletedBuyerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd });
              await sendOrderEmail({ userId: order.buyerId, subject, html });
            } catch (emailErr: any) {
              console.warn(`[AutoComplete] Buyer email failed for order ${order.orderNo}:`, emailErr.message);
            }

            // Trigger Stripe Transfer payout if C2C order
            if (order.sellerType === 'seller' && order.sellerId) {
              // IMPORTANT: order.sellerId = sellerProfiles.id, NOT users.id
              const sellerProfile = await getSellerProfileById(order.sellerId);
              const sellerUserId = sellerProfile?.userId;
              if (sellerProfile?.stripeConnectId && sellerProfile.stripeConnectStatus === 'active') {
                try {
                  const Stripe = (await import('stripe')).default;
                  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
                  const receivable = Math.round(parseFloat(order.sellerReceivableHkd as string) * 100);
                  // Get Charge ID from PaymentIntent (source_transaction requires ch_xxx, not pi_xxx)
                  let chargeId: string | undefined;
                  if (order.stripePaymentIntentId) {
                    try {
                      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ['latest_charge'] });
                      chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge as any)?.id;
                    } catch { /* ignore, transfer without source_transaction */ }
                  }
                  const transfer = await stripe.transfers.create({
                    amount: receivable,
                    currency: 'hkd',
                    destination: sellerProfile.stripeConnectId,
                    ...(chargeId ? { source_transaction: chargeId } : {}),
                    metadata: { order_no: order.orderNo, order_id: order.id.toString(), auto_completed: 'true', trigger: 'auto_complete_14d' },
                  });
                  await db.update(marketplaceOrders)
                    .set({ payoutStatus: 'paid', stripeTransferId: transfer.id })
                    .where(eq(marketplaceOrders.id, order.id));
                  // Notify seller: Stripe payout transferred (use sellerUserId = users.id)
                  if (sellerUserId) {
                    await createNotification({
                      userId: sellerUserId,
                      type: 'trade',
                      title: '款項已自動轉帳 💰',
                      body: `訂單 ${order.orderNo} 已自動完成（買家 14 天內未確認收貨），HKD ${order.sellerReceivableHkd} 已轉帳至你的 Stripe 帳戶。`,
                      linkUrl: '/seller',
                    }).catch(() => {});
                    // Send auto-completed email to seller
                    try {
                      const { sendOrderEmail, buildOrderAutoCompletedSellerEmail, getOrderEmailData } = await import('./emailService');
                      const emailData = await getOrderEmailData(order);
                      const { subject, html } = buildOrderAutoCompletedSellerEmail({ orderNo: order.orderNo, itemName: emailData.itemName, priceHkd: emailData.priceHkd, receivableHkd: emailData.receivableHkd });
                      await sendOrderEmail({ userId: sellerUserId, subject, html });
                    } catch (emailErr: any) {
                      console.warn(`[AutoComplete] Seller email failed for order ${order.orderNo}:`, emailErr.message);
                    }
                  }
                } catch (err: any) {
                  console.error(`[AutoComplete] Stripe transfer failed for order ${order.orderNo}:`, err.message);
                  await db.update(marketplaceOrders)
                    .set({ payoutStatus: 'failed', stripeTransferError: err.message })
                    .where(eq(marketplaceOrders.id, order.id));
                  // Notify seller: payout failed (use sellerUserId = users.id)
                  if (sellerUserId) {
                    await createNotification({
                      userId: sellerUserId,
                      type: 'trade',
                      title: '訂單自動完成，款項轉帳失敗 ⚠️',
                      body: `訂單 ${order.orderNo} 已自動完成，但款項轉帳失敗，請聯絡客服處理。`,
                      linkUrl: '/seller',
                    }).catch(() => {});
                  }
                }
              } else {
                // Seller has no Stripe Connect or not active - notify them to contact admin
                if (sellerUserId) {
                  await createNotification({
                    userId: sellerUserId,
                    type: 'trade',
                    title: '訂單已自動完成 ✅',
                    body: `訂單 ${order.orderNo} 已自動完成（買家 14 天內未確認收貨）。款項將由平台管理員安排轉帳，請留意後續通知。`,
                    linkUrl: '/seller',
                  }).catch(() => {});
                }
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

// ============================================================
// Shipping Overdue Reminder Scheduler
// Runs every hour: remind sellers who haven't shipped within 3 days of payment
// ============================================================
let shippingReminderCronJob: ReturnType<typeof cron.schedule> | null = null;

export function startShippingReminderScheduler() {
  if (shippingReminderCronJob) return;
  shippingReminderCronJob = cron.schedule(
    '30 * * * *', // Every hour at :30
    async () => {
      try {
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lte, isNull, or } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // 3 days ago
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        // Find orders that: paid but not shipped, payment received > 3 days ago, reminder not yet sent
        const overdueOrders = await db.select()
          .from(marketplaceOrders)
          .where(
            and(
              or(
                eq(marketplaceOrders.orderStatus, 'payment_received'),
                eq(marketplaceOrders.orderStatus, 'processing')
              ),
              lte(marketplaceOrders.createdAt, threeDaysAgo),
              isNull(marketplaceOrders.shippingReminderSentAt)
            )
          )
          .limit(50);

        if (overdueOrders.length === 0) return;
        console.log(`[ShippingReminder] Found ${overdueOrders.length} overdue orders`);

        for (const order of overdueOrders) {
          try {
            // Mark reminder as sent
            await db.update(marketplaceOrders)
              .set({ shippingReminderSentAt: now })
              .where(eq(marketplaceOrders.id, order.id));

            // Notify seller (order.sellerId = sellerProfiles.id, must resolve to users.id)
            if (order.sellerId) {
              const sellerProf = await getSellerProfileById(order.sellerId);
              if (sellerProf?.userId) {
                await createNotification({
                  userId: sellerProf.userId,
                  type: 'trade',
                  title: '⏰ 請盡快安排出貨',
                  body: `訂單 ${order.orderNo} 已付款超過 3 天，請盡快安排出貨並填寫追蹤號碼，以維護良好的賣家評分。`,
                  linkUrl: '/seller',
                }).catch(() => {});
              }
            }

            // Notify admin
            await import('./_core/notification').then(({ notifyOwner }) =>
              notifyOwner({
                title: '賣家出貨超時提醒 ⏰',
                content: `訂單 ${order.orderNo} 已付款超過 3 天，賣家尚未出貨。`,
              }).catch(() => {})
            );

            console.log(`[ShippingReminder] Reminder sent for order ${order.orderNo}`);
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
  console.log('[ShippingReminder] Shipping reminder scheduler started');
}

export function stopShippingReminderScheduler() {
  if (shippingReminderCronJob) {
    shippingReminderCronJob.stop();
    shippingReminderCronJob = null;
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

            // Email notification to seller
            const { users: usersTable } = await import('../drizzle/schema_new');
            const sellerUsers = await db.select().from(usersTable)
              .where(eq(usersTable.id, offer.sellerId))
              .limit(1);
            const sellerUser = sellerUsers[0];
            if (sellerUser?.email) {
              const expiresAtStr = offer.expiresAt.toLocaleString('zh-TW', {
                timeZone: 'Asia/Hong_Kong',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              }) + ' (HKT)';
              // Get buyer name
              const buyerUsers = await db.select().from(usersTable)
                .where(eq(usersTable.id, offer.buyerId))
                .limit(1);
              const buyerName = buyerUsers[0]?.name || '買家';
              const { subject, html } = buildOfferExpiringSoonEmail({
                sellerName: sellerUser.name || '賣家',
                buyerName,
                cardName: listing.title,
                offerAmountHkd: String(offer.offerPriceHkd),
                listingPriceHkd: listing.priceHkd ? String(listing.priceHkd) : '—',
                expiresAt: expiresAtStr,
                sellerDashboardUrl: 'https://boxium.asia/seller',
              });
              await sendEmail({ to: sellerUser.email, subject, html });
            }

            console.log(`[OfferExpiryReminder] Reminder sent for offer ${offer.id}`);
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
// Runs every hour at :30 to cancel pending_payment orders older than 24 hours
let paymentTimeoutCancelCronJob: ReturnType<typeof cron.schedule> | null = null;
export function startPaymentTimeoutCancelScheduler() {
  if (paymentTimeoutCancelCronJob) return;
  paymentTimeoutCancelCronJob = cron.schedule(
    '30 * * * *', // Every hour at :30
    async () => {
      try {
        const { getDb, getSellerProfileById } = await import('./db');
        const { marketplaceOrders, marketplaceOrderItems, marketplaceListings } = await import('../drizzle/schema_new');
        const { and, eq, lt } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;
        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        // Find pending_payment orders older than 24 hours
        const timedOutOrders = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          buyerId: marketplaceOrders.buyerId,
          sellerId: marketplaceOrders.sellerId,
          createdAt: marketplaceOrders.createdAt,
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
            // Cancel the order
            await db.update(marketplaceOrders)
              .set({ orderStatus: 'cancelled', updatedAt: now })
              .where(eq(marketplaceOrders.id, order.id));
            // Get order items to restore listing stock
            const items = await db.select()
              .from(marketplaceOrderItems)
              .where(eq(marketplaceOrderItems.orderId, order.id));
            // Restore listing status back to 'active' if it was marked as sold
            for (const item of items) {
              await db.update(marketplaceListings)
                .set({ status: 'active' })
                .where(
                  and(
                    eq(marketplaceListings.id, item.listingId),
                    eq(marketplaceListings.status, 'sold')
                  )
                );
            }
            // Notify buyer
            await createNotification({
              userId: order.buyerId,
              type: 'order',
              title: '訂單已自動取消',
              body: `訂單 #${order.orderNo} 因超過 24 小時未完成付款，已自動取消。`,
              linkUrl: '/orders',
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
                  body: `訂單 #${order.orderNo} 因買家超過 24 小時未完成付款，已自動取消，商品已重新上架。`,
                  linkUrl: '/seller',
                  relatedId: order.id,
                }).catch(() => {});
              }
            }
            console.log(`[PaymentTimeout] Cancelled order ${order.orderNo} (id: ${order.id})`);
          } catch (err) {
            console.error(`[PaymentTimeout] Failed to cancel order ${order.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[PaymentTimeout] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );
  console.log('[PaymentTimeout] Payment timeout cancel scheduler started (every hour at :30)');
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
    '45 * * * *', // Every hour at :45
    async () => {
      try {
        const { getDb } = await import('./db');
        const { marketplaceOrders } = await import('../drizzle/schema_new');
        const { and, eq, lt, gte, isNull } = await import('drizzle-orm');
        const { createNotification } = await import('./db/notifications');
        const db = await getDb();
        if (!db) return;

        const now = new Date();
        // Window: orders created between 12 and 13 hours ago
        const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000); // 13h ago
        const windowEnd   = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12h ago

        const ordersToRemind = await db.select({
          id: marketplaceOrders.id,
          orderNo: marketplaceOrders.orderNo,
          buyerId: marketplaceOrders.buyerId,
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
        console.log(`[PaymentReminder] Found ${ordersToRemind.length} orders to remind`);

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
              title: '⏰ 訂單即將自動取消',
              body: `訂單 #${order.orderNo} 尚未完成付款，將在約 12 小時後自動取消，請盡快完成付款。`,
              linkUrl: `/orders/${order.orderNo}`,
              relatedId: order.id,
            }).catch(() => {});

            console.log(`[PaymentReminder] Sent reminder for order ${order.orderNo} (id: ${order.id})`);
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
  console.log('[PaymentReminder] Payment reminder scheduler started (every hour at :45)');
}

export function stopPaymentReminderScheduler() {
  if (paymentReminderCronJob) {
    paymentReminderCronJob.stop();
    paymentReminderCronJob = null;
  }
}

// ─── Hot Card Polling Scheduler ──────────────────────────────────────────────
// Runs every 30 minutes to update the top 100 most-viewed cards in the past 7 days.
// This ensures popular cards always have fresh price data without waiting for the
// full batch update cycle (~4 hours for 43k cards).
// ─────────────────────────────────────────────────────────────────────────────

let hotCardPollCronJob: ReturnType<typeof cron.schedule> | null = null;

/** Track whether a hot-card poll is already in progress (prevent overlap) */
let hotCardPollRunning = false;

/** Last time hot card poll ran (for status display) */
let hotCardPollLastRunAt: Date | null = null;
let hotCardPollLastResult: { updated: number; skipped: number; failed: number } | null = null;

/**
 * Execute one round of hot card polling.
 * Fetches the top N most-viewed cards and updates their SNKRDUNK price data.
 */
export async function runHotCardPoll(limit: number = 100): Promise<{ updated: number; skipped: number; failed: number }> {
  if (hotCardPollRunning) {
    console.log('[HotCardPoll] Already running, skipping this cycle');
    return { updated: 0, skipped: 0, failed: 0 };
  }

  hotCardPollRunning = true;
  const startTime = Date.now();
  let updated = 0, skipped = 0, failed = 0;

  try {
    console.log(`[HotCardPoll] Starting hot card poll (top ${limit} cards)...`);

    // Get top viewed card IDs
    const { getTopViewedCardIds } = await import('./db');
    const topCardIds = await getTopViewedCardIds(limit, 7);

    if (topCardIds.length === 0) {
      console.log('[HotCardPoll] No recently viewed cards found, skipping');
      hotCardPollRunning = false;
      return { updated: 0, skipped: 0, failed: 0 };
    }

    console.log(`[HotCardPoll] Found ${topCardIds.length} hot cards to update`);

    // Get data sources for these cards
    const dbModule = await import('./db');
    const { data: allDataSources } = await dbModule.getDataSources({ pageSize: 100000 });
    const snkrdunkSources = allDataSources.filter((ds: any) =>
      ds.source === 'snkrdunk' && topCardIds.includes(ds.cardId)
    );

    // Deduplicate by cardId + productType (same as batch update)
    const { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } = await import('./snkrdunkScraper');
    const uniqueProducts = new Map<string, any>();
    for (const source of snkrdunkSources) {
      const productType = source.productType || 'single_card';
      const key = `${productType}:${source.cardId}`;
      if (uniqueProducts.has(key)) continue;
      const snkrdunkId = extractSnkrdunkId(source.sourceUrl);
      if (!snkrdunkId) continue;
      uniqueProducts.set(key, { ...source, snkrdunkId, productType });
    }

    const products = Array.from(uniqueProducts.values());
    console.log(`[HotCardPoll] Processing ${products.length} unique products`);

    // Process in parallel batches of 2 (conservative to avoid API rate limits)
    const PARALLEL = 2;
    const { validateAndFilterPriceHistory } = await import('./utils/priceValidator');
    const database = await dbModule.getDb();
    if (!database) {
      console.warn('[HotCardPoll] Database not available');
      hotCardPollRunning = false;
      return { updated: 0, skipped: 0, failed: 0 };
    }
    const { priceHistory: priceHistoryTable, dataSources: dataSourcesTable } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');

    for (let i = 0; i < products.length; i += PARALLEL) {
      const batch = products.slice(i, i + PARALLEL);
      await Promise.all(batch.map(async (product) => {
        try {
          const productType: 'single_card' | 'sealed_product' =
            product.productType === 'sealed_product' ? 'sealed_product' : 'single_card';

          const rawPriceHistory = await fetchPriceHistoryFromApi(
            product.snkrdunkId,
            productType,
            { timeout: 20000, throwOnError: false }
          );

          if (!rawPriceHistory || rawPriceHistory.length === 0) {
            skipped++;
            return;
          }

          const priceHistory = validateAndFilterPriceHistory(rawPriceHistory, productType);
          if (priceHistory.length === 0) {
            skipped++;
            return;
          }

          // Batch insert price records
          const records = priceHistory.map(entry => ({
            cardId: product.cardId,
            source: 'snkrdunk' as const,
            price: convertJpyToHkd(entry.price).toString(),
            currency: 'HKD',
            jpyPrice: entry.jpyPrice ?? entry.price,
            grade: productType === 'single_card' ? (entry.normalisedGrade ?? null) : null,
            quantity: productType === 'sealed_product' ? (entry.quantity || null) : null,
            productType,
            soldAt: entry.soldAt,
            listingUrl: product.sourceUrl,
          }));

          for (let j = 0; j < records.length; j += 50) {
            const chunk = records.slice(j, j + 50);
            await database.insert(priceHistoryTable)
              .values(chunk)
              .onDuplicateKeyUpdate({ set: { cardId: chunk[0].cardId } });
          }

          // Update data source fetch status
          await database.update(dataSourcesTable)
            .set({ lastFetchedAt: new Date(), lastFetchStatus: 'success', fetchErrorMessage: null })
            .where(eq(dataSourcesTable.id, product.id));

          updated++;
        } catch (err: any) {
          console.warn(`[HotCardPoll] Failed to update card ${product.cardId}: ${err.message}`);
          failed++;
        }
      }));

      // Small delay between batches
      if (i + PARALLEL < products.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HotCardPoll] Completed in ${duration}s: updated=${updated}, skipped=${skipped}, failed=${failed}`);

    hotCardPollLastRunAt = new Date();
    hotCardPollLastResult = { updated, skipped, failed };
  } catch (err) {
    console.error('[HotCardPoll] Fatal error:', err);
  } finally {
    hotCardPollRunning = false;
  }

  return { updated, skipped, failed };
}

/**
 * Start the hot card polling scheduler (every 30 minutes).
 */
export function startHotCardPollScheduler() {
  if (hotCardPollCronJob) return;

  hotCardPollCronJob = cron.schedule(
    '*/30 * * * *', // Every 30 minutes
    async () => {
      try {
        await runHotCardPoll(100);
      } catch (err) {
        console.error('[HotCardPoll] Scheduler error:', err);
      }
    },
    { timezone: 'Asia/Hong_Kong' }
  );

  console.log('[HotCardPoll] Hot card polling scheduler started (every 30 minutes)');
}

/**
 * Stop the hot card polling scheduler.
 */
export function stopHotCardPollScheduler() {
  if (hotCardPollCronJob) {
    hotCardPollCronJob.stop();
    hotCardPollCronJob = null;
    console.log('[HotCardPoll] Hot card polling scheduler stopped');
  }
}

/**
 * Get hot card poll status (for admin UI).
 */
export function getHotCardPollStatus() {
  return {
    isRunning: hotCardPollRunning,
    schedulerActive: hotCardPollCronJob !== null,
    lastRunAt: hotCardPollLastRunAt,
    lastResult: hotCardPollLastResult,
  };
}
