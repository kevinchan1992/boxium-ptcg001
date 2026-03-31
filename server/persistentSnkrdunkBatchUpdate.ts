/**
 * SNKRDUNK Persistent Batch Update (v7.3 - PARALLEL=8)
 * 
 * v7 proved controlled 2-parallel is STABLE and FAST (~3.6/s, 0 failures).
 * 
 * v7.1 FIX: Metadata save was failing because processedProductKeys array
 * grew beyond MySQL TEXT column limit (65KB) at ~3000 keys.
 * 
 * SOLUTION: Stop storing processedProductKeys in metadata.
 * Instead, use processedCount (integer) for resume tracking.
 * On resume, rely on SKIP_RECENTLY_UPDATED_HOURS to skip already-updated
 * products (their lastFetchedAt is recent), which is more reliable anyway.
 * The in-memory processedKeys Set is still used during a single run to
 * prevent re-processing within the same execution.
 * 
 * v7.2 UPGRADE: PARALLEL raised from 2 → 4 after stability testing (2026-03-09).
 * Test result: 20/20 success at P=4, throughput 4.07 c/s (1.7x vs P=2).
 * DB connection pool peak at P=4: ~6-7 connections (safe within pool=10).
 * Other tasks (cachePreloader, trendingCards, autoCompleteOrders) are all
 * sequential and do not compete with batch update connections.
 * 
 * v7.3 UPGRADE: PARALLEL raised from 4 → 8 (2026-03-31).
 * SNKRDUNK API is stateless HTTP — no session/cookie limits per connection.
 * Each product: 1 API call (avg ~0.3s) + 2 DB ops (drizzle releases immediately).
 * DELAY_BETWEEN_BATCHES: 50ms → 0ms (no throttle needed for stateless HTTP).
 * DELAY_AFTER_ERROR: 1000ms → 500ms (faster recovery).
 * REQUEST_TIMEOUT: 30s → 15s (fail fast on slow/dead endpoints).
 * Expected throughput: ~7-8 c/s (2x vs v7.2 at P=4).
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } from './snkrdunkScraper';
import { getRecentlyViewedCardIds } from './db';

// ─── Configuration (v7.3 - Higher Parallelism) ──────────────
const CONFIG = {
  // Number of products to process in parallel
  // v7.3: Raised to 8 (2026-03-31). SNKRDUNK API is stateless HTTP.
  // Each product: 1 API call (avg ~0.3s) + 2 DB ops (drizzle releases immediately).
  // Expected peak DB connections: ~8-10, safe with pool=20.
  // Expected throughput: ~7-8 c/s (2x vs v7.2 at P=4).
  PARALLEL: 8,

  // Delay between parallel batches (ms)
  // Set to 0 — no throttle needed for stateless HTTP API calls.
  DELAY_BETWEEN_BATCHES: 0,

  // Delay after error (ms)
  // Reduced from 1000ms to 500ms to recover faster.
  DELAY_AFTER_ERROR: 500,

  // API request timeout (ms)
  // Reduced from 30s to 15s to fail fast on slow/dead endpoints.
  REQUEST_TIMEOUT: 15000,
  
  // Max consecutive errors before stopping (HTTP errors only, not timeouts)
  MAX_CONSECUTIVE_ERRORS: 50,
  
  // Progress save interval (save metadata every N products)
  PROGRESS_SAVE_INTERVAL: 200,
  
  // Progress DB update interval (update task progress every N products)
  PROGRESS_DB_INTERVAL: 50,
  
  // Skip products updated within this many hours
  SKIP_RECENTLY_UPDATED_HOURS: 12,
  
  // Max auto-resume attempts (raised from 3 to 20 to survive frequent sandbox restarts)
  MAX_AUTO_RESUME_ATTEMPTS: 20,
};

// ─── Types ────────────────────────────────────────────────────────
interface ProductInfo {
  id: number;
  name: string;
  productType: string;
  snkrdunkId: string;
  lastFetchedAt: Date | null;
  sourceUrl: string;
  dataSourceId: number;
}

interface ProcessResult {
  success: boolean;
  productKey: string;
  error?: { cardId: number; cardName: string; error: string };
  isTimeout?: boolean;
}

/**
 * Get all SNKRDUNK products with their data source info
 */
async function getAllSnkrdunkProducts(): Promise<ProductInfo[]> {
  const { data: allDataSources } = await db.getDataSources({ pageSize: 100000 });
  const snkrdunkSources = allDataSources.filter((ds: any) => ds.source === 'snkrdunk');
  
  const uniqueProducts = new Map<string, ProductInfo>();
  
  for (const source of snkrdunkSources) {
    const productType = source.productType || 'single_card';
    const key = `${productType}:${source.cardId}`;
    
    if (uniqueProducts.has(key)) continue;
    
    const snkrdunkId = extractSnkrdunkId(source.sourceUrl);
    if (!snkrdunkId) continue;
    
    const name = source.card?.name || `Product ${source.cardId}`;
    
    uniqueProducts.set(key, {
      id: source.cardId,
      name,
      productType,
      snkrdunkId,
      lastFetchedAt: source.lastFetchedAt ? new Date(source.lastFetchedAt) : null,
      sourceUrl: source.sourceUrl || '',
      dataSourceId: source.id,
    });
  }

  return Array.from(uniqueProducts.values());
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save task metadata (compact format - no full key list)
 * 
 * v7.1: Only stores processedCount, errors (last 50), and resumeCount.
 * This keeps metadata well under MySQL TEXT 65KB limit.
 */
async function saveTaskMetadata(
  taskId: number, 
  processedCount: number, 
  errors: Array<{ cardId: number; cardName: string; error: string }>,
  resumeCount: number,
): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;
    
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');
    
    const metadata = {
      errors: errors.slice(-50), // Keep last 50 errors (was 100)
      processedCount,
      resumeCount,
    };
    
    await database.update(scheduledTasks)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(scheduledTasks.id, taskId));
  } catch (e) {
    console.error(`[BatchUpdate] Failed to save metadata: ${(e as Error).message}`);
  }
}

/**
 * Process a single product - fetch prices and save to DB.
 * Returns a result object (never throws).
 */
async function processSingleProduct(product: ProductInfo): Promise<ProcessResult> {
  const productKey = `${product.productType}:${product.id}`;
  
  try {
    // Step 1: Fetch price history from SNKRDUNK API (HTTP, not DB)
    const productType: "single_card" | "sealed_product" = 
      product.productType === 'sealed_product' ? 'sealed_product' : 'single_card';
    
    const rawPriceHistory = await fetchPriceHistoryFromApi(
      product.snkrdunkId, 
      productType,
      { timeout: CONFIG.REQUEST_TIMEOUT, throwOnError: true }
    );

    // Validate and filter using unified validator (grade normalisation + min-price + IQR)
    const { validateAndFilterPriceHistory } = await import('./utils/priceValidator');
    const priceHistory = validateAndFilterPriceHistory(rawPriceHistory ?? [], productType);
    
    // Step 2: Batch insert all price records at once
    if (priceHistory && priceHistory.length > 0) {
      const database = await db.getDb();
      if (database) {
        const { priceHistory: priceHistoryTable } = await import('../drizzle/schema_new');
        
        // Assign sourcePosition (0-based index in API response) to differentiate same-day same-price
        // transactions. The UNIQUE INDEX now includes sourcePosition, so all distinct API records
        // can be stored without false-positive deduplication.
        const records = priceHistory.map((entry, idx) => ({
          cardId: product.id,
          source: "snkrdunk" as const,
          price: convertJpyToHkd(entry.price).toString(),
          currency: "HKD",
          jpyPrice: entry.jpyPrice ?? entry.price, // Original JPY price - used for stable deduplication
          sourcePosition: idx, // Position in API response (0-based) - allows multiple same-day same-price records
          grade: productType === 'single_card' ? (entry.normalisedGrade ?? null) : null,
          quantity: productType === 'sealed_product' ? (entry.quantity || null) : null,
          productType,
          soldAt: entry.soldAt,
          listingUrl: product.sourceUrl,
        }));
        
        // ─── Bulk purchase detection (isSuspectedBulk) ─────────────
        // For single cards: compute 30-day median JPY price per grade,
        // then flag any transaction exceeding 4× the median as a suspected bulk/lot.
        // This prevents lot purchases (e.g., ¥65,000 for 8 cards) from skewing PSA10 averages.
        const BULK_MULTIPLIER = 4;
        const medianByGrade = new Map<string, number>();
        if (productType === 'single_card') {
          // Group existing non-bulk records by grade to compute per-grade medians
          const gradeGroups = new Map<string, number[]>();
          for (const rec of records) {
            const g = rec.grade || 'unknown';
            if (!gradeGroups.has(g)) gradeGroups.set(g, []);
            gradeGroups.get(g)!.push(rec.jpyPrice as number);
          }
          for (const [grade, prices] of Array.from(gradeGroups.entries())) {
            const sorted = [...prices].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];
            medianByGrade.set(grade, median);
          }
        }

        // Apply isSuspectedBulk flag based on median threshold
        const flaggedRecords = records.map(rec => {
          if (productType !== 'single_card') return rec;
          const grade = rec.grade || 'unknown';
          const median = medianByGrade.get(grade);
          const jpyPrice = rec.jpyPrice as number;
          const isSuspectedBulk = !!(median && median > 0 && jpyPrice > BULK_MULTIPLIER * median);
          return { ...rec, isSuspectedBulk };
        });

        // Batch insert in chunks of 50 to avoid query size limits.
        // The UNIQUE INDEX (cardId, source, grade, soldAt, jpyPrice, sourcePosition) handles deduplication.
        // onDuplicateKeyUpdate with isSuspectedBulk updates the flag on re-runs.
        const { sql } = await import('drizzle-orm');
        for (let i = 0; i < flaggedRecords.length; i += 50) {
          const chunk = flaggedRecords.slice(i, i + 50);
          try {
            await database
              .insert(priceHistoryTable)
              .values(chunk)
              .onDuplicateKeyUpdate({ set: { isSuspectedBulk: sql`VALUES(isSuspectedBulk)` } });
          } catch (insertErr: any) {
            // If batch fails, fall back to individual inserts with no-op dedup
            for (const record of chunk) {
              try {
                await database
                  .insert(priceHistoryTable)
                  .values(record)
                  .onDuplicateKeyUpdate({ set: { isSuspectedBulk: sql`VALUES(isSuspectedBulk)` } });
              } catch (e) {
                // Skip silently
              }
            }
          }
        }
      }
    }
    
    // Step 3: Update data source status (1 DB op)
    await db.updateDataSourceFetchStatus(product.dataSourceId, "success");
    
    return { success: true, productKey };
    
  } catch (error: any) {
    const isTimeout = error.isTimeout || 
                      error.code === 'ECONNABORTED' || 
                      error.message?.includes('timeout') || 
                      error.message?.includes('Timeout');
    
    return {
      success: false,
      productKey,
      isTimeout,
      error: {
        cardId: product.id,
        cardName: product.name,
        error: error.message || String(error),
      },
    };
  }
}

/**
 * Core batch processing — v7.2 CONTROLLED PARALLEL
 * 
 * Processes products in groups of 4 using Promise.allSettled.
 * Each group is fully resolved before starting the next group.
 * This keeps DB connections at max 6-7 (well within pool of 10).
 */
async function runControlledParallelProcessing(
  taskId: number,
  productsToUpdate: ProductInfo[],
  alreadyProcessedKeys: Set<string>,
  resumeCount: number,
): Promise<void> {
  const processedKeys = new Set(alreadyProcessedKeys);
  const errors: Array<{ cardId: number; cardName: string; error: string }> = [];
  let consecutiveErrors = 0;
  let successCount = 0;
  let failCount = 0;
  let pendingSuccessFlush = 0;
  let pendingFailFlush = 0;
  const startTime = Date.now();
  
  // Filter out already processed
  const remaining = productsToUpdate.filter(p => {
    const key = `${p.productType}:${p.id}`;
    return !processedKeys.has(key);
  });
  
  if (remaining.length === 0) {
    console.log(`[BatchUpdate] All products already processed, completing task`);
    await batchTaskManager.completeTask(taskId, 'completed');
    return;
  }
  
  console.log(`[BatchUpdate] v7.1 Controlled Parallel (${CONFIG.PARALLEL}): Processing ${remaining.length} products (${processedKeys.size} already done)`);
  
  // ─── Process in pairs ─────────────────────────────────────────
  for (let i = 0; i < remaining.length; i += CONFIG.PARALLEL) {
    // Check pause/cancel every 20 products
    if (i % 20 === 0 && i > 0) {
      try {
        if (await batchTaskManager.isTaskCancelled(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} cancelled at ${i}/${remaining.length}`);
          break;
        }
        if (await batchTaskManager.isTaskPaused(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} paused at ${i}/${remaining.length}`);
          while (await batchTaskManager.isTaskPaused(taskId)) {
            await delay(3000);
          }
          console.log(`[BatchUpdate] Task ${taskId} resumed`);
        }
      } catch (e) {
        console.warn(`[BatchUpdate] Status check failed: ${(e as Error).message}`);
      }
    }
    
    // Get the current batch (1 or 2 products)
    const batch = remaining.slice(i, i + CONFIG.PARALLEL);
    
    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(product => processSingleProduct(product))
    );
    
    // Process results
    let batchHadError = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        processedKeys.add(r.productKey);
        
        if (r.success) {
          successCount++;
          pendingSuccessFlush++;
          consecutiveErrors = 0;
        } else {
          failCount++;
          pendingFailFlush++;
          batchHadError = true;
          
          if (r.error) {
            errors.push(r.error);
          }
          
          // Only count non-timeout errors as consecutive
          if (!r.isTimeout) {
            consecutiveErrors++;
          }
        }
      } else {
        // Promise itself rejected (shouldn't happen since processSingleProduct catches all)
        failCount++;
        pendingFailFlush++;
        batchHadError = true;
        consecutiveErrors++;
      }
    }
    
    // Flush progress to DB periodically
    if (pendingSuccessFlush >= CONFIG.PROGRESS_DB_INTERVAL) {
      await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
      pendingSuccessFlush = 0;
    }
    if (pendingFailFlush >= CONFIG.PROGRESS_DB_INTERVAL) {
      await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
      pendingFailFlush = 0;
    }
    
    // Log progress periodically
    const totalProcessed = successCount + failCount;
    if (totalProcessed % 100 === 0 && totalProcessed > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = totalProcessed / elapsed;
      const eta = speed > 0 ? (remaining.length - i) / speed : 0;
      console.log(`[BatchUpdate] Progress: ${i + CONFIG.PARALLEL}/${remaining.length} | Success: ${successCount} | Fail: ${failCount} | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min`);
    }
    
    // Save metadata periodically (v7.1: compact format, no key list)
    if (processedKeys.size % CONFIG.PROGRESS_SAVE_INTERVAL === 0) {
      await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount);
    }
    
    // Stop if too many consecutive HTTP errors
    if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
      const errorMsg = `Auto-stopped: ${consecutiveErrors} consecutive HTTP errors. Last: ${errors[errors.length - 1]?.error || 'unknown'}`;
      console.error(`[BatchUpdate] ${errorMsg}`);
      
      // Flush remaining
      if (pendingSuccessFlush > 0) await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
      if (pendingFailFlush > 0) await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
      await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount);
      
      try {
        const database = await db.getDb();
        if (database) {
          const { scheduledTasks } = await import('../drizzle/schema_new');
          const { eq } = await import('drizzle-orm');
          await database.update(scheduledTasks)
            .set({ errorMessage: errorMsg })
            .where(eq(scheduledTasks.id, taskId));
        }
      } catch (e) {}
      
      await batchTaskManager.completeTask(taskId, 'failed');
      return;
    }
    
    // Delay between batches
    if (batchHadError) {
      await delay(CONFIG.DELAY_AFTER_ERROR);
    } else {
      await delay(CONFIG.DELAY_BETWEEN_BATCHES);
    }
  }
  
  // ─── Flush remaining progress ─────────────────────────────────
  if (pendingSuccessFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
  }
  if (pendingFailFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
  }
  await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount);
  
  // ─── Complete ─────────────────────────────────────────────────
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = (successCount + failCount) / elapsed;
  console.log(`[BatchUpdate] ✅ Completed: ${remaining.length} products in ${Math.ceil(elapsed / 60)} minutes (${speed.toFixed(1)}/s)`);
  console.log(`[BatchUpdate] Results: ${successCount} success, ${failCount} failed`);
  
  await batchTaskManager.completeTask(taskId, 'completed');
}

/**
 * Check if a SNKRDUNK batch update is currently running.
 * Used by priceUpdateScheduler to avoid triggering a new catch-up
 * when autoResumeOnStartup has already resumed an active task.
 */
export async function isSnkrdunkBatchUpdateRunning(): Promise<boolean> {
  return batchTaskManager.hasRunningTask('batch_snkrdunk_update');
}

/**
 * Execute SNKRDUNK batch update with persistent task tracking.
 */
export async function executePersistentSnkrdunkBatchUpdate(): Promise<{ taskId: number; totalCards: number; skippedCards: number }> {
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  const allProducts = await getAllSnkrdunkProducts();
  
  const now = new Date();
  const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
  
  const productsToUpdate: ProductInfo[] = [];
  let skippedCount = 0;
  
  for (const product of allProducts) {
    if (product.lastFetchedAt && (now.getTime() - product.lastFetchedAt.getTime()) < skipThreshold) {
      skippedCount++;
    } else {
      productsToUpdate.push(product);
    }
  }
  
  // Get recently viewed/searched card IDs for priority ordering (last 7 days)
  let recentCardIds: Set<number> = new Set();
  try {
    recentCardIds = await getRecentlyViewedCardIds(7);
    console.log(`[BatchUpdate] Found ${recentCardIds.size} recently viewed cards to prioritize`);
  } catch (err) {
    console.warn('[BatchUpdate] Failed to fetch recently viewed cards, using default order:', err);
  }

  // Sort: recently viewed first, then oldest-updated first
  productsToUpdate.sort((a, b) => {
    const aRecent = recentCardIds.has(a.id);
    const bRecent = recentCardIds.has(b.id);
    // Priority tier 1: recently viewed cards come first
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    // Priority tier 2: within same tier, oldest-updated comes first
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime;
  });
  
  console.log(`[BatchUpdate] Found ${allProducts.length} products, skipping ${skippedCount} recently updated, updating ${productsToUpdate.length} (${recentCardIds.size > 0 ? `${Math.min(recentCardIds.size, productsToUpdate.length)} priority cards first` : 'default order'})`);

  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute in background with global error handler
  (async () => {
    try {
      await runControlledParallelProcessing(taskId, productsToUpdate, new Set(), 0);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL: ${error.message}`);
      console.error(error.stack);
      
      try {
        const database = await db.getDb();
        if (database) {
          const { scheduledTasks } = await import('../drizzle/schema_new');
          const { eq } = await import('drizzle-orm');
          await database.update(scheduledTasks)
            .set({ 
              status: 'failed',
              completedAt: new Date(),
              errorMessage: `FATAL: ${error.message}` 
            })
            .where(eq(scheduledTasks.id, taskId));
        }
      } catch (dbErr) {
        console.error(`[BatchUpdate] Failed to mark task as failed: ${(dbErr as Error).message}`);
      }
    }
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedCount };
}

/**
 * Resume a failed/stalled task from its last progress.
 * 
 * v7.1: No longer relies on processedProductKeys from metadata.
 * Instead, uses SKIP_RECENTLY_UPDATED_HOURS to filter out already-updated products.
 * The task's processedItems count is used for progress reporting.
 */
export async function resumeFailedTask(taskId: number): Promise<{ taskId: number; totalCards: number; skippedCards: number; resumedFrom: number }> {
  const database = await db.getDb();
  if (!database) throw new Error('Database not available');
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  const [task] = await database.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);
  if (!task) throw new Error(`Task ${taskId} not found`);
  
  let resumeCount = 0;
  
  if (task.metadata) {
    try {
      const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
      resumeCount = (meta.resumeCount || 0) + 1;
    } catch (e) {}
  }
  
  // Use processedItems from the task record as the resume point
  const resumedFrom = task.processedItems || 0;
  
  // Get all products and filter by SKIP_RECENTLY_UPDATED_HOURS
  // Products that were already updated in this batch run will have recent lastFetchedAt
  const allProducts = await getAllSnkrdunkProducts();
  
  const now = new Date();
  const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
  
  const productsToUpdate = allProducts.filter(p => {
    if (p.lastFetchedAt && (now.getTime() - p.lastFetchedAt.getTime()) < skipThreshold) {
      return false; // Skip recently updated
    }
    return true;
  });
  
  console.log(`[BatchUpdate] Manual resume of task ${taskId}: ${resumedFrom} already done (by processedItems), ${productsToUpdate.length} remaining (by lastFetchedAt filter)`);
  
  const newTaskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', allProducts.length);
  
  // Pre-fill progress for already-processed items
  const alreadyDone = allProducts.length - productsToUpdate.length;
  if (alreadyDone > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(newTaskId, alreadyDone);
  }
  
  (async () => {
    try {
      await runControlledParallelProcessing(newTaskId, productsToUpdate, new Set(), resumeCount);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL during manual resume: ${error.message}`);
      try {
        await batchTaskManager.completeTask(newTaskId, 'failed');
      } catch (e) {}
    }
  })();
  
  return { taskId: newTaskId, totalCards: productsToUpdate.length, skippedCards: alreadyDone, resumedFrom: alreadyDone };
}

/**
 * Auto-resume a stalled task on server startup.
 * 
 * v7.1: Uses SKIP_RECENTLY_UPDATED_HOURS to determine which products
 * still need processing, instead of relying on processedProductKeys metadata.
 */
export async function autoResumeOnStartup(): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;
    
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq, and, gt, or, desc } = await import('drizzle-orm');
    
    // Look back 24 hours for tasks that were interrupted (either still 'running' or
    // recently marked 'failed' by recoverStalledTasks on this startup).
    // recoverStalledTasks runs BEFORE autoResumeOnStartup, so a task that was
    // 'running' during the previous session is now 'failed' with completedAt set
    // to the current startup time. We detect those by checking completedAt within
    // the last 2 minutes AND the error message contains 'Auto-recovered'.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    // First priority: still-running tasks (rare but possible)
    const runningCandidates = await database
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasks.status, 'running'),
          gt(scheduledTasks.updatedAt, twentyFourHoursAgo),
        )
      )
      .orderBy(desc(scheduledTasks.updatedAt))
      .limit(1);
    
    // Second priority: tasks just marked failed by recoverStalledTasks (within last 2 min)
    const recentlyFailedCandidates = await database
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasks.status, 'failed'),
          gt(scheduledTasks.completedAt, twoMinutesAgo),
          gt(scheduledTasks.processedItems, 0), // must have made some progress
        )
      )
      .orderBy(desc(scheduledTasks.completedAt))
      .limit(1);
    
    const candidates = runningCandidates.length > 0 ? runningCandidates : recentlyFailedCandidates;
    
    if (candidates.length === 0) {
      console.log('[BatchUpdate] No eligible tasks for auto-resume');
      return;
    }
    
    const task = candidates[0];
    
    let resumeCount = 0;
    
    if (task.metadata) {
      try {
        const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
        resumeCount = (meta.resumeCount || 0) + 1;
      } catch (e) {}
    }
    
    if (resumeCount > CONFIG.MAX_AUTO_RESUME_ATTEMPTS) {
      console.log(`[BatchUpdate] Task ${task.id} exceeded max resume attempts (${resumeCount}), marking as failed permanently`);
      // Don't call completeTask again if already failed
      if (task.status !== 'failed') {
        await batchTaskManager.completeTask(task.id, 'failed');
      }
      return;
    }
    
    // If the task was marked 'failed' by recoverStalledTasks, reset it to 'running'
    // so runControlledParallelProcessing can update its progress normally.
    if (task.status === 'failed') {
      await database
        .update(scheduledTasks)
        .set({ status: 'running', completedAt: null, errorMessage: null, updatedAt: new Date() })
        .where(eq(scheduledTasks.id, task.id));
      console.log(`[BatchUpdate] Reset task ${task.id} from failed → running for auto-resume`);
    }
    
    // Use SKIP_RECENTLY_UPDATED_HOURS to determine remaining products
    const allProducts = await getAllSnkrdunkProducts();
    const now = new Date();
    const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
    
    const remainingProducts = allProducts.filter(p => {
      if (p.lastFetchedAt && (now.getTime() - p.lastFetchedAt.getTime()) < skipThreshold) {
        return false;
      }
      return true;
    });
    
    const alreadyDone = allProducts.length - remainingProducts.length;
    
    if (remainingProducts.length === 0) {
      console.log(`[BatchUpdate] Task ${task.id} has no remaining products to process (all ${alreadyDone} already updated within ${CONFIG.SKIP_RECENTLY_UPDATED_HOURS}h), marking as completed`);
      await batchTaskManager.completeTask(task.id, 'completed');
      return;
    }
    
    console.log(`[BatchUpdate] Auto-resuming task ${task.id} (${alreadyDone} already done by lastFetchedAt, ${remainingProducts.length} remaining, resume #${resumeCount})`);
    
    (async () => {
      try {
        await runControlledParallelProcessing(task.id, remainingProducts, new Set(), resumeCount);
      } catch (error: any) {
        console.error(`[BatchUpdate] FATAL during resume: ${error.message}`);
        try {
          await batchTaskManager.completeTask(task.id, 'failed');
        } catch (e) {}
      }
    })();
  } catch (error) {
    console.error('[BatchUpdate] Auto-resume check failed:', error);
  }
}
