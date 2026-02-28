/**
 * SNKRDUNK Persistent Batch Update (v6 - Serial Mode)
 * 
 * ROOT CAUSE OF ALL PREVIOUS STALLS:
 * mysql2 default connection pool = 10 connections.
 * v4/v5 used Promise.allSettled with 5 parallel products, each needing 3-4 DB ops.
 * 5 × 4 = 20 simultaneous DB operations > 10 connections = DEADLOCK.
 * 
 * WHY MANUAL ADD WORKS:
 * Manual "add SNKRDUNK data source" processes ONE product at a time, serially.
 * It calls: scrapeSnkrdunkPage → addPriceHistory (loop) → updateDataSourceFetchStatus.
 * All sequential. Never exceeds 1 DB connection at a time. Never stalls.
 * 
 * v6 SOLUTION: Copy the exact same pattern as manual add.
 * - Pure serial processing: ONE product at a time, NO parallelism
 * - Same function calls as manual add (fetchPriceHistoryFromApi → addPriceHistory → updateStatus)
 * - No withTimeout, no Promise.allSettled, no complex state machines
 * - Simple for loop, simple try/catch, simple progress tracking
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } from './snkrdunkScraper';

// ─── Configuration (v6 - Keep It Simple) ────────────────────────
const CONFIG = {
  // Delay between products (ms) - be polite to SNKRDUNK API
  DELAY_BETWEEN_PRODUCTS: 300,
  
  // Delay after error (ms)
  DELAY_AFTER_ERROR: 2000,
  
  // API request timeout (ms)
  REQUEST_TIMEOUT: 30000,
  
  // Max consecutive errors before stopping (HTTP errors only, not timeouts)
  MAX_CONSECUTIVE_ERRORS: 50,
  
  // Progress save interval (save metadata every N products)
  PROGRESS_SAVE_INTERVAL: 100,
  
  // Progress DB update interval (update task progress every N products)
  PROGRESS_DB_INTERVAL: 10,
  
  // Skip products updated within this many hours
  SKIP_RECENTLY_UPDATED_HOURS: 23,
  
  // Max auto-resume attempts
  MAX_AUTO_RESUME_ATTEMPTS: 3,
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
 * Save task metadata (errors + processed keys)
 */
async function saveTaskMetadata(
  taskId: number, 
  processedKeys: string[], 
  errors: Array<{ cardId: number; cardName: string; error: string }>,
  resumeCount: number,
): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;
    
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');
    
    const metadata = {
      errors: errors.slice(-100),
      processedProductKeys: processedKeys,
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
 * Core batch processing — v6 PURE SERIAL
 * 
 * This is intentionally simple. It processes ONE product at a time,
 * exactly like the manual "add SNKRDUNK data source" function.
 * No parallelism, no withTimeout, no Promise.allSettled.
 */
async function runSerialBatchProcessing(
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
  let skipCount = 0;
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
  
  console.log(`[BatchUpdate] v6 Serial Mode: Processing ${remaining.length} products one-by-one (${processedKeys.size} already done)`);
  
  // ─── Simple serial loop ───────────────────────────────────────
  for (let i = 0; i < remaining.length; i++) {
    const product = remaining[i];
    const productKey = `${product.productType}:${product.id}`;
    
    // Check pause/cancel every 10 products (not every product to reduce DB load)
    if (i % 10 === 0) {
      try {
        if (await batchTaskManager.isTaskCancelled(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} cancelled at ${i}/${remaining.length}`);
          break;
        }
        if (await batchTaskManager.isTaskPaused(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} paused at ${i}/${remaining.length}`);
          // Wait until unpaused
          while (await batchTaskManager.isTaskPaused(taskId)) {
            await delay(3000);
          }
          console.log(`[BatchUpdate] Task ${taskId} resumed`);
        }
      } catch (e) {
        // If we can't check status, just continue processing
        console.warn(`[BatchUpdate] Status check failed: ${(e as Error).message}`);
      }
    }
    
    try {
      // ─── Step 1: Fetch price history from SNKRDUNK API ───────
      // (Same as manual add: scrapeSnkrdunkPage → fetchPriceHistoryFromApi)
      const productType: "single_card" | "sealed_product" = 
        product.productType === 'sealed_product' ? 'sealed_product' : 'single_card';
      
      const priceHistory = await fetchPriceHistoryFromApi(
        product.snkrdunkId, 
        productType,
        { timeout: CONFIG.REQUEST_TIMEOUT, throwOnError: true }
      );
      
      // ─── Step 2: Save price history ──────────────────────────
      // (Same as manual add: for loop with db.addPriceHistory)
      if (priceHistory && priceHistory.length > 0) {
        for (const priceEntry of priceHistory) {
          const priceHkd = convertJpyToHkd(priceEntry.price);
          try {
            await db.addPriceHistory({
              cardId: product.id,
              source: "snkrdunk",
              price: priceHkd.toString(),
              currency: "HKD",
              grade: productType === 'single_card' ? priceEntry.grade : undefined,
              quantity: productType === 'sealed_product' ? priceEntry.quantity : undefined,
              productType,
              soldAt: priceEntry.soldAt,
              listingUrl: product.sourceUrl,
            });
          } catch (insertErr) {
            // Skip duplicate or invalid records, don't fail the whole product
          }
        }
      }
      
      // ─── Step 3: Update data source status ───────────────────
      // (Same as manual add: updateDataSourceFetchStatus)
      await db.updateDataSourceFetchStatus(product.dataSourceId, "success");
      
      // ─── Step 4: Track progress ──────────────────────────────
      processedKeys.add(productKey);
      successCount++;
      pendingSuccessFlush++;
      consecutiveErrors = 0; // Reset on success
      
      // Flush progress to DB periodically (not every product)
      if (pendingSuccessFlush >= CONFIG.PROGRESS_DB_INTERVAL) {
        await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
        pendingSuccessFlush = 0;
      }
      if (pendingFailFlush > 0) {
        await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
        pendingFailFlush = 0;
      }
      
      // Log progress periodically
      if ((successCount + failCount) % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = (successCount + failCount) / elapsed;
        const eta = speed > 0 ? (remaining.length - i) / speed : 0;
        console.log(`[BatchUpdate] Progress: ${i + 1}/${remaining.length} | Success: ${successCount} | Fail: ${failCount} | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min`);
      }
      
      // Save metadata periodically
      if (processedKeys.size % CONFIG.PROGRESS_SAVE_INTERVAL === 0) {
        await saveTaskMetadata(taskId, Array.from(processedKeys), errors, resumeCount);
      }
      
      // Delay between products (be polite to API)
      await delay(CONFIG.DELAY_BETWEEN_PRODUCTS);
      
    } catch (error: any) {
      // Product failed
      processedKeys.add(productKey);
      failCount++;
      pendingFailFlush++;
      
      const isTimeout = error.isTimeout || 
                        error.code === 'ECONNABORTED' || 
                        error.message?.includes('timeout') || 
                        error.message?.includes('Timeout');
      
      errors.push({ 
        cardId: product.id, 
        cardName: product.name, 
        error: error.message || String(error) 
      });
      
      // Only count non-timeout errors as consecutive errors
      if (!isTimeout) {
        consecutiveErrors++;
      } else {
        // Timeout: don't count as consecutive error, just skip and continue
        consecutiveErrors = 0;
      }
      
      // Log errors periodically (not every one)
      if (failCount % 10 === 0) {
        console.warn(`[BatchUpdate] ${failCount} failures so far. Last: ${error.message} (consecutive: ${consecutiveErrors})`);
      }
      
      // Stop if too many consecutive HTTP errors (not timeouts)
      if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
        const errorMsg = `Auto-stopped: ${consecutiveErrors} consecutive HTTP errors. Last: ${error.message}`;
        console.error(`[BatchUpdate] ${errorMsg}`);
        
        // Flush remaining progress
        if (pendingSuccessFlush > 0) {
          await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
        }
        if (pendingFailFlush > 0) {
          await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
        }
        await saveTaskMetadata(taskId, Array.from(processedKeys), errors, resumeCount);
        
        // Save error message
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
      
      // Longer delay after error
      await delay(CONFIG.DELAY_AFTER_ERROR);
    }
  }
  
  // ─── Flush remaining progress ─────────────────────────────────
  if (pendingSuccessFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
  }
  if (pendingFailFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
  }
  await saveTaskMetadata(taskId, Array.from(processedKeys), errors, resumeCount);
  
  // ─── Complete ─────────────────────────────────────────────────
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`[BatchUpdate] ✅ Completed: ${remaining.length} products in ${Math.ceil(elapsed / 60)} minutes`);
  console.log(`[BatchUpdate] Results: ${successCount} success, ${failCount} failed, ${skipCount} skipped`);
  
  await batchTaskManager.completeTask(taskId, 'completed');
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
  
  // Sort: oldest first (haven't been updated in longest time)
  productsToUpdate.sort((a, b) => {
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime;
  });
  
  console.log(`[BatchUpdate] Found ${allProducts.length} products, skipping ${skippedCount} recently updated, updating ${productsToUpdate.length}`);

  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute in background with global error handler
  (async () => {
    try {
      await runSerialBatchProcessing(taskId, productsToUpdate, new Set(), 0);
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
 * Called from admin UI to manually resume a task.
 */
export async function resumeFailedTask(taskId: number): Promise<{ taskId: number; totalCards: number; skippedCards: number; resumedFrom: number }> {
  const database = await db.getDb();
  if (!database) throw new Error('Database not available');
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  const [task] = await database.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);
  if (!task) throw new Error(`Task ${taskId} not found`);
  
  // Parse metadata to get processed keys
  let processedKeys = new Set<string>();
  let resumeCount = 0;
  
  if (task.metadata) {
    try {
      const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
      if (meta.processedProductKeys) {
        processedKeys = new Set(meta.processedProductKeys);
      }
      resumeCount = (meta.resumeCount || 0) + 1;
    } catch (e) {}
  }
  
  const resumedFrom = processedKeys.size;
  
  // Get all products
  const allProducts = await getAllSnkrdunkProducts();
  const productsToUpdate = allProducts.filter(p => {
    const key = `${p.productType}:${p.id}`;
    return !processedKeys.has(key);
  });
  
  console.log(`[BatchUpdate] Manual resume of task ${taskId}: ${resumedFrom} already done, ${productsToUpdate.length} remaining`);
  
  // Create a new task for tracking
  const newTaskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', allProducts.length);
  
  // Pre-set the progress to account for already processed items
  if (resumedFrom > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(newTaskId, resumedFrom);
  }
  
  // Run in background
  (async () => {
    try {
      await runSerialBatchProcessing(newTaskId, allProducts, processedKeys, resumeCount);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL during manual resume: ${error.message}`);
      try {
        await batchTaskManager.completeTask(newTaskId, 'failed');
      } catch (e) {}
    }
  })();
  
  return { taskId: newTaskId, totalCards: productsToUpdate.length, skippedCards: resumedFrom, resumedFrom };
}

/**
 * Auto-resume a stalled task on server startup.
 * Finds the most recent running task within 2 hours and resumes it.
 */
export async function autoResumeOnStartup(): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;
    
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq, and, gt, desc } = await import('drizzle-orm');
    
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const candidates = await database
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasks.status, 'running'),
          gt(scheduledTasks.updatedAt, twoHoursAgo),
        )
      )
      .orderBy(desc(scheduledTasks.updatedAt))
      .limit(1);
    
    if (candidates.length === 0) {
      console.log('[BatchUpdate] No eligible tasks for auto-resume');
      return;
    }
    
    const task = candidates[0];
    
    // Parse metadata to get processed keys
    let processedKeys = new Set<string>();
    let resumeCount = 0;
    
    if (task.metadata) {
      try {
        const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
        if (meta.processedProductKeys) {
          processedKeys = new Set(meta.processedProductKeys);
        }
        resumeCount = (meta.resumeCount || 0) + 1;
      } catch (e) {}
    }
    
    if (resumeCount > CONFIG.MAX_AUTO_RESUME_ATTEMPTS) {
      console.log(`[BatchUpdate] Task ${task.id} exceeded max resume attempts (${resumeCount}), marking as failed`);
      await batchTaskManager.completeTask(task.id, 'failed');
      return;
    }
    
    console.log(`[BatchUpdate] Auto-resuming task ${task.id} (processed ${processedKeys.size}, resume #${resumeCount})`);
    
    // Get all products and resume
    const allProducts = await getAllSnkrdunkProducts();
    
    // Resume in background
    (async () => {
      try {
        await runSerialBatchProcessing(task.id, allProducts, processedKeys, resumeCount);
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
