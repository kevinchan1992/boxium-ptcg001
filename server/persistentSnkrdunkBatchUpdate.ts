/**
 * SNKRDUNK Persistent Batch Update
 * 
 * The single, authoritative batch update executor for SNKRDUNK price data.
 * All progress is tracked via the database (batchTaskManager), not in-memory.
 * 
 * Optimizations (v3 - Auto-Resume):
 * - Auto-resume: on server restart, automatically continues from where it left off
 * - Tracks processed product IDs in task metadata to enable resume
 * - Only fetches price history (1 API call per product, skips card details)
 * - 15 concurrent requests — SNKRDUNK API is stable with JSON endpoints
 * - Minimal delays between batches — API rate limits are generous for JSON endpoints
 * - Higher failure thresholds — based on real-world experience (1300+ successful in a row)
 * - Exponential backoff only on genuine rate limiting (5+ consecutive failures)
 * - Smart skip: skip products updated within 23 hours
 * - Per-request and per-batch timeout protection
 * - Auto-stop after 30 consecutive failures
 * 
 * Expected performance: ~34,000 products in ~30-45 minutes
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { fetchPriceHistory, convertJpyToHkd } from './snkrdunkScraper';

// ─── Configuration (v3 - Speed Optimized + Auto-Resume) ───────────
const CONFIG = {
  // Concurrency: 15 concurrent requests (SNKRDUNK JSON API handles this well)
  PARALLEL_LIMIT: 15,
  
  // Delays (ms) — minimized based on real-world experience
  MIN_DELAY: 100,
  MAX_DELAY: 300,
  BATCH_PAUSE: 500,
  BATCH_SIZE: 100,
  
  // Exponential backoff — higher thresholds based on real experience
  INITIAL_BACKOFF: 3000,
  MAX_BACKOFF: 120000,
  BACKOFF_MULTIPLIER: 2,
  
  // Failure thresholds — much more tolerant based on real data
  MAX_CONSECUTIVE_FAILURES: 30,
  BACKOFF_TRIGGER: 5,
  BACKOFF_RESET_ON_SUCCESS: true,
  
  // Timeouts
  REQUEST_TIMEOUT: 15000,
  PARALLEL_TIMEOUT: 45000,
  
  // Smart skip
  SKIP_RECENTLY_UPDATED_HOURS: 23,
  
  // Auto-resume
  MAX_AUTO_RESUME_ATTEMPTS: 3,       // Max times a task can be auto-resumed
  PROCESSED_IDS_SAVE_INTERVAL: 50,   // Save processed IDs to metadata every N products
};

// ─── Types ────────────────────────────────────────────────────────
interface TaskMetadata {
  errors: Array<{ cardId: number; cardName: string; error: string }>;
  processedProductKeys?: string[];   // e.g. ["single_card:123", "sealed_product:456"]
  resumeCount?: number;              // How many times this task has been auto-resumed
  resumeHistory?: Array<{ at: string; fromProcessed: number }>;
}

interface ProductInfo {
  id: number;
  name: string;
  productType: string;
  lastFetchedAt: Date | null;
  sourceUrl: string;
}

/**
 * Randomized delay to avoid detection patterns
 */
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms: ${label}`));
    }, ms);
    
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Get all SNKRDUNK products and data sources
 */
async function getAllSnkrdunkProducts(): Promise<{
  allProducts: ProductInfo[];
  snkrdunkSources: any[];
}> {
  const { data: allDataSources } = await db.getDataSources({ pageSize: 100000 });
  const snkrdunkSources = allDataSources.filter((ds: any) => ds.source === 'snkrdunk');
  
  const uniqueProducts = new Map<string, ProductInfo>();
  
  for (const source of snkrdunkSources) {
    const productType = source.productType || 'single_card';
    const key = `${productType}:${source.cardId}`;
    
    if (uniqueProducts.has(key)) continue;
    
    if (source.card) {
      uniqueProducts.set(key, {
        id: source.card.id,
        name: source.card.name,
        productType,
        lastFetchedAt: source.lastFetchedAt ? new Date(source.lastFetchedAt) : null,
        sourceUrl: source.sourceUrl || '',
      });
    } else if (productType === 'sealed_product') {
      try {
        const sealedProduct = await db.getSealedProductById(source.cardId);
        if (sealedProduct) {
          uniqueProducts.set(key, {
            id: sealedProduct.id,
            name: sealedProduct.name,
            productType,
            lastFetchedAt: source.lastFetchedAt ? new Date(source.lastFetchedAt) : null,
            sourceUrl: source.sourceUrl || '',
          });
        }
      } catch (e) {
        // Skip if sealed product not found
      }
    }
  }

  return {
    allProducts: Array.from(uniqueProducts.values()),
    snkrdunkSources,
  };
}

/**
 * Save processed product keys to task metadata (periodically)
 */
async function saveProcessedKeys(taskId: number, processedKeys: Set<string>, resumeCount: number, resumeHistory: Array<{ at: string; fromProcessed: number }>): Promise<void> {
  const database = await db.getDb();
  if (!database) return;
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  // Get current errors from metadata
  const task = await batchTaskManager.getBatchTaskProgress(taskId);
  const currentMetadata: TaskMetadata = task?.errors 
    ? { errors: task.errors, processedProductKeys: Array.from(processedKeys), resumeCount, resumeHistory }
    : { errors: [], processedProductKeys: Array.from(processedKeys), resumeCount, resumeHistory };
  
  await database.update(scheduledTasks)
    .set({ metadata: JSON.stringify(currentMetadata) })
    .where(eq(scheduledTasks.id, taskId));
}

/**
 * Core batch processing logic — shared between new tasks and resumed tasks
 */
async function runBatchProcessing(
  taskId: number,
  productsToUpdate: ProductInfo[],
  snkrdunkSources: any[],
  alreadyProcessedKeys: Set<string>,
  resumeCount: number,
  resumeHistory: Array<{ at: string; fromProcessed: number }>,
): Promise<void> {
  let consecutiveFailures = 0;
  let currentBackoff = CONFIG.INITIAL_BACKOFF;
  let shouldStop = false;
  let totalProcessed = 0;
  const processedKeys = new Set(alreadyProcessedKeys);
  let lastSavedCount = processedKeys.size;
  const startTime = Date.now();
  
  // Filter out already processed products
  const remainingProducts = productsToUpdate.filter(p => {
    const key = `${p.productType}:${p.id}`;
    return !processedKeys.has(key);
  });
  
  if (remainingProducts.length === 0) {
    console.log(`[BatchUpdate] All products already processed, completing task`);
    await batchTaskManager.completeTask(taskId, 'completed');
    return;
  }
  
  console.log(`[BatchUpdate] Processing ${remainingProducts.length} remaining products (${processedKeys.size} already done)`);
  
  // ─── Inner helper: process a single product ───────────────────
  async function processProduct(product: ProductInfo) {
    if (shouldStop) return;
    
    const productKey = `${product.productType}:${product.id}`;
    
    // Double-check: skip if already processed (race condition guard)
    if (processedKeys.has(productKey)) return;
    
    try {
      const productDataSources = snkrdunkSources.filter((ds: any) => {
        const dsProductType = ds.productType || 'single_card';
        return ds.cardId === product.id && dsProductType === product.productType;
      });
      
      if (productDataSources.length === 0 || !productDataSources[0].sourceUrl) {
        processedKeys.add(productKey);
        await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
        totalProcessed++;
        return;
      }

      const dataSource = productDataSources[0];
      const productType: "single_card" | "sealed_product" = 
        (product.productType === 'sealed_product') ? 'sealed_product' : 'single_card';

      // Only fetch price history (skip card details for speed)
      const priceHistory = await withTimeout(
        fetchPriceHistory(dataSource.sourceUrl, productType),
        CONFIG.REQUEST_TIMEOUT,
        `fetchPriceHistory ${product.id}`
      );
      
      if (!priceHistory || priceHistory.length === 0) {
        processedKeys.add(productKey);
        await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
        totalProcessed++;
        return;
      }

      // Save price data
      let recordsAdded = 0;
      for (const priceItem of priceHistory) {
        const priceHKD = convertJpyToHkd(priceItem.price);
        await db.addPriceHistory({
          cardId: product.id,
          source: 'snkrdunk',
          price: priceHKD.toString(),
          currency: 'HKD',
          grade: productType === 'sealed_product' ? undefined : priceItem.grade,
          quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
          productType,
          soldAt: priceItem.soldAt,
        });
        recordsAdded++;
      }

      // Update data source status
      for (const ds of productDataSources) {
        await db.updateDataSourceFetchStatus(ds.id, "success");
      }

      processedKeys.add(productKey);
      await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
      totalProcessed++;
      
      // Log progress every 100 products with speed stats
      if (totalProcessed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = totalProcessed / elapsed;
        const remaining = remainingProducts.length - totalProcessed;
        const eta = remaining / speed;
        console.log(`[BatchUpdate] Progress: ${totalProcessed}/${remainingProducts.length} (${(totalProcessed / remainingProducts.length * 100).toFixed(1)}%) | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min`);
      }
      
      // Periodically save processed keys to metadata for resume capability
      if (processedKeys.size - lastSavedCount >= CONFIG.PROCESSED_IDS_SAVE_INTERVAL) {
        await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
        lastSavedCount = processedKeys.size;
      }
      
      // Reset backoff on success
      consecutiveFailures = 0;
      currentBackoff = CONFIG.INITIAL_BACKOFF;
      
    } catch (error: any) {
      console.error(`[BatchUpdate] Error updating ${product.productType} ${product.id}: ${error.message}`);
      processedKeys.add(productKey);
      await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, error.message);
      totalProcessed++;
      
      consecutiveFailures++;
      
      if (consecutiveFailures >= CONFIG.BACKOFF_TRIGGER) {
        currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
      }
      
      // Auto-stop after too many consecutive failures
      if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
        const errorMsg = `Auto-stopped: ${consecutiveFailures} consecutive failures. Last error: ${error.message}. Possible rate limiting or network issues.`;
        console.error(`[BatchUpdate] ${errorMsg}`);
        
        // Save processed keys before stopping (for future resume)
        await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
        
        const database = await db.getDb();
        if (database) {
          const { scheduledTasks } = await import('../drizzle/schema_new');
          const { eq } = await import('drizzle-orm');
          await database.update(scheduledTasks)
            .set({ errorMessage: errorMsg })
            .where(eq(scheduledTasks.id, taskId));
        }
        
        await batchTaskManager.completeTask(taskId, 'failed');
        shouldStop = true;
        return;
      }
    }
  }
  
  // ─── Main batch loop ───────────────────────────────────────────
  console.log(`[BatchUpdate] Starting batch update: ${remainingProducts.length} products, ${Math.ceil(remainingProducts.length / CONFIG.BATCH_SIZE)} batches`);
  
  for (let i = 0; i < remainingProducts.length; i += CONFIG.BATCH_SIZE) {
    if (shouldStop) break;
    
    const batch = remainingProducts.slice(i, i + CONFIG.BATCH_SIZE);
    
    // Check if task is paused or cancelled
    while (await batchTaskManager.isTaskPaused(taskId)) {
      // Save progress while paused
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (await batchTaskManager.isTaskCancelled(taskId)) {
      console.log(`[BatchUpdate] Task ${taskId} cancelled, saving progress and stopping...`);
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
      return;
    }
    
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remainingProducts.length / CONFIG.BATCH_SIZE);
    console.log(`[BatchUpdate] Processing batch ${batchNum}/${totalBatches} (${batch.length} products)`);
    
    // Process batch with limited parallelism
    for (let j = 0; j < batch.length; j += CONFIG.PARALLEL_LIMIT) {
      if (shouldStop) break;
      
      const parallelBatch = batch.slice(j, j + CONFIG.PARALLEL_LIMIT);
      
      // If we're in backoff mode, wait before processing
      if (consecutiveFailures >= CONFIG.BACKOFF_TRIGGER) {
        console.log(`[BatchUpdate] Backoff: waiting ${currentBackoff / 1000}s due to ${consecutiveFailures} consecutive failures`);
        await new Promise(resolve => setTimeout(resolve, currentBackoff));
      }
      
      // Process products in parallel with timeout protection
      try {
        await withTimeout(
          Promise.all(parallelBatch.map(product => processProduct(product))),
          CONFIG.PARALLEL_TIMEOUT,
          `Parallel batch at index ${j}`
        );
      } catch (batchError: any) {
        console.error(`[BatchUpdate] Parallel batch timeout: ${batchError.message}`);
        
        for (const product of parallelBatch) {
          const pKey = `${product.productType}:${product.id}`;
          if (!processedKeys.has(pKey)) {
            processedKeys.add(pKey);
            await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, 'Batch timeout');
            totalProcessed++;
          }
        }
        
        consecutiveFailures += parallelBatch.length;
        currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
        
        if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
          const errorMsg = `Auto-stopped: ${consecutiveFailures} consecutive failures (batch timeout). Possible rate limiting.`;
          console.error(`[BatchUpdate] ${errorMsg}`);
          
          // Save processed keys before stopping
          await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
          
          const database = await db.getDb();
          if (database) {
            const { scheduledTasks } = await import('../drizzle/schema_new');
            const { eq } = await import('drizzle-orm');
            await database.update(scheduledTasks)
              .set({ errorMessage: errorMsg })
              .where(eq(scheduledTasks.id, taskId));
          }
          
          await batchTaskManager.completeTask(taskId, 'failed');
          shouldStop = true;
          break;
        }
      }
      
      // Minimal delay between parallel groups (only when not in backoff)
      if (!shouldStop && consecutiveFailures < CONFIG.BACKOFF_TRIGGER) {
        await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY);
      }
    }
    
    // Short pause between batches
    if (!shouldStop && i + CONFIG.BATCH_SIZE < remainingProducts.length) {
      await randomDelay(CONFIG.BATCH_PAUSE - 200, CONFIG.BATCH_PAUSE + 300);
    }
  }

  // Complete task (only if not already stopped)
  if (!shouldStop) {
    // Final save of processed keys
    await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[BatchUpdate] Batch update completed: ${remainingProducts.length} products in ${Math.ceil(elapsed / 60)} minutes (${(remainingProducts.length / elapsed).toFixed(1)}/s avg)`);
    await batchTaskManager.completeTask(taskId, 'completed');
  }
}

/**
 * Execute SNKRDUNK batch update with persistent task tracking.
 * All progress is stored in the database via batchTaskManager.
 */
export async function executePersistentSnkrdunkBatchUpdate(): Promise<{ taskId: number; totalCards: number; skippedCards: number }> {
  // Check if there's already a running task
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  // Get all SNKRDUNK products
  const { allProducts, snkrdunkSources } = await getAllSnkrdunkProducts();
  
  // Smart skip: separate products into "needs update" and "recently updated"
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
  
  // Sort: prioritize products that haven't been updated in the longest time
  productsToUpdate.sort((a, b) => {
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime; // Oldest first
  });
  
  console.log(`[BatchUpdate] Found ${allProducts.length} unique products, skipping ${skippedCount} recently updated, updating ${productsToUpdate.length}`);
  console.log(`[BatchUpdate] Config: parallel=${CONFIG.PARALLEL_LIMIT}, batchSize=${CONFIG.BATCH_SIZE}, delay=${CONFIG.MIN_DELAY}-${CONFIG.MAX_DELAY}ms, batchPause=${CONFIG.BATCH_PAUSE}ms`);

  // Create persistent task in database
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background
  (async () => {
    await runBatchProcessing(taskId, productsToUpdate, snkrdunkSources, new Set(), 0, []);
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedCount };
}

/**
 * Resume a failed/stalled task from where it left off.
 * Reads the processedProductKeys from task metadata and skips already-processed products.
 */
export async function resumeFailedTask(failedTaskId: number): Promise<{ taskId: number; totalCards: number; skippedCards: number; resumedFrom: number }> {
  // Check if there's already a running task
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  // Get the failed task's metadata to find processed product keys
  const failedTask = await batchTaskManager.getBatchTaskProgress(failedTaskId);
  if (!failedTask) {
    throw new Error(`Task ${failedTaskId} not found`);
  }
  
  // Parse metadata to get processed keys
  let processedKeys = new Set<string>();
  let resumeCount = 0;
  let resumeHistory: Array<{ at: string; fromProcessed: number }> = [];
  
  const database = await db.getDb();
  if (database) {
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');
    
    const tasks = await database
      .select({ metadata: scheduledTasks.metadata })
      .from(scheduledTasks)
      .where(eq(scheduledTasks.id, failedTaskId))
      .limit(1);
    
    if (tasks[0]?.metadata) {
      try {
        const meta: TaskMetadata = JSON.parse(tasks[0].metadata);
        if (meta.processedProductKeys) {
          processedKeys = new Set(meta.processedProductKeys);
        }
        resumeCount = (meta.resumeCount || 0) + 1;
        resumeHistory = meta.resumeHistory || [];
      } catch (e) {
        console.warn(`[BatchUpdate] Failed to parse metadata for task ${failedTaskId}, starting fresh`);
      }
    }
  }
  
  if (resumeCount > CONFIG.MAX_AUTO_RESUME_ATTEMPTS) {
    throw new Error(`Task has been auto-resumed ${resumeCount - 1} times already (max: ${CONFIG.MAX_AUTO_RESUME_ATTEMPTS}). Please start a new task instead.`);
  }
  
  const resumedFrom = processedKeys.size;
  console.log(`[BatchUpdate] Resuming from task ${failedTaskId}: ${resumedFrom} products already processed (resume #${resumeCount})`);
  
  // Get all current SNKRDUNK products
  const { allProducts, snkrdunkSources } = await getAllSnkrdunkProducts();
  
  // Smart skip: same logic as new task
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
  
  productsToUpdate.sort((a, b) => {
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime;
  });
  
  // Calculate remaining products (not yet processed)
  const remainingCount = productsToUpdate.filter(p => !processedKeys.has(`${p.productType}:${p.id}`)).length;
  
  console.log(`[BatchUpdate] Total products: ${productsToUpdate.length}, already processed: ${resumedFrom}, remaining: ${remainingCount}`);
  
  // Create a NEW task for the resume (so it gets its own ID and progress tracking)
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', remainingCount);
  
  // Record resume history
  resumeHistory.push({ at: new Date().toISOString(), fromProcessed: resumedFrom });
  
  // Execute in background, passing the already-processed keys
  (async () => {
    await runBatchProcessing(taskId, productsToUpdate, snkrdunkSources, processedKeys, resumeCount, resumeHistory);
  })();

  return { taskId, totalCards: remainingCount, skippedCards: skippedCount, resumedFrom };
}

/**
 * Auto-resume stalled tasks on server startup.
 * Called from server startup after recoverStalledTasks marks tasks as failed.
 * Checks if any recently failed tasks should be auto-resumed.
 */
export async function autoResumeOnStartup(): Promise<{ resumed: boolean; taskId?: number; resumedFrom?: number }> {
  const database = await db.getDb();
  if (!database) {
    return { resumed: false };
  }
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq, and, desc } = await import('drizzle-orm');
  
  const { gt } = await import('drizzle-orm');

  // Find the most recent failed task that was auto-recovered (stalled) within the last 2 hours
  // Use 2-hour window to avoid resuming old tasks after a long downtime
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentFailedTasks = await database
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
        eq(scheduledTasks.status, 'failed'),
        gt(scheduledTasks.updatedAt, twoHoursAgo)
      )
    )
    .orderBy(desc(scheduledTasks.updatedAt))
    .limit(5); // Check up to 5 recent failed tasks
  
  if (recentFailedTasks.length === 0) {
    console.log('[BatchUpdate] No recently failed tasks to auto-resume (within 2 hours)');
    return { resumed: false };
  }
  
  // Find the best candidate: auto-recovered task with most progress
  // Prefer tasks that were stalled (auto-recovered on startup) over tasks that failed due to rate limits
  const eligibleTasks = recentFailedTasks.filter(t => {
    const isAutoRecoveredTask = t.errorMessage?.includes('Auto-recovered on server startup');
    const hasProgressItems = (t.processedItems || 0) > 0;
    return isAutoRecoveredTask && hasProgressItems;
  });
  
  // Sort by processedItems descending (resume the most advanced task)
  eligibleTasks.sort((a, b) => (b.processedItems || 0) - (a.processedItems || 0));
  
  const failedTask = eligibleTasks[0];
  
  if (!failedTask) {
    console.log('[BatchUpdate] No eligible tasks for auto-resume (no auto-recovered tasks with progress found)');
    return { resumed: false };
  }
  
  // Only auto-resume if:
  // 1. Task was auto-recovered (error message contains "Auto-recovered on server startup")
  // 2. Task has processed some items (not a completely failed task)
  // 3. Task was created within the last 24 hours
  // 4. Task hasn't been resumed too many times
  const isAutoRecovered = failedTask.errorMessage?.includes('Auto-recovered on server startup');
  const hasProgress = (failedTask.processedItems || 0) > 0;
  const isRecent = failedTask.createdAt && (Date.now() - new Date(failedTask.createdAt).getTime()) < 24 * 60 * 60 * 1000;
  
  let resumeCount = 0;
  if (failedTask.metadata) {
    try {
      const meta: TaskMetadata = JSON.parse(failedTask.metadata);
      resumeCount = meta.resumeCount || 0;
    } catch (e) {
      // ignore parse errors
    }
  }
  const canResume = resumeCount < CONFIG.MAX_AUTO_RESUME_ATTEMPTS;
  
  if (!isAutoRecovered || !hasProgress || !isRecent || !canResume) {
    console.log(`[BatchUpdate] Task ${failedTask.id} not eligible for auto-resume: autoRecovered=${isAutoRecovered}, hasProgress=${hasProgress}, isRecent=${isRecent}, canResume=${canResume} (resumeCount=${resumeCount})`);
    return { resumed: false };
  }
  
  console.log(`[BatchUpdate] Auto-resuming task ${failedTask.id} (processed ${failedTask.processedItems}/${failedTask.totalItems})`);
  
  try {
    const result = await resumeFailedTask(failedTask.id);
    console.log(`[BatchUpdate] Auto-resume successful: new task ${result.taskId}, resuming from ${result.resumedFrom} products`);
    return { resumed: true, taskId: result.taskId, resumedFrom: result.resumedFrom };
  } catch (error: any) {
    console.error(`[BatchUpdate] Auto-resume failed: ${error.message}`);
    return { resumed: false };
  }
}
