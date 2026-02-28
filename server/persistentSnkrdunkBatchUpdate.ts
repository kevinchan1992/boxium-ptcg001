/**
 * SNKRDUNK Persistent Batch Update (v4 - Simplified & Resilient)
 * 
 * The single, authoritative batch update executor for SNKRDUNK price data.
 * All progress is tracked via the database (batchTaskManager), not in-memory.
 * 
 * v4 Changes:
 * - REMOVED double timeout (outer withTimeout + inner axios timeout)
 * - Reduced parallel from 15 to 5 for stability (less simultaneous timeouts)
 * - Increased axios timeout to 30s (SNKRDUNK API can be slow)
 * - Added retry logic: each request retries once before counting as failure
 * - Timeouts are NOT counted as consecutive failures (only HTTP errors are)
 * - Increased auto-stop threshold from 30 to 200 consecutive HTTP errors
 * - Simplified processProduct: only fetch price history, no card name updates
 * - Added duplicate price record check before inserting
 * 
 * Expected performance: ~34,000 products in ~60-90 minutes (slower but stable)
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } from './snkrdunkScraper';

// ─── Configuration (v4 - Stability First) ────────────────────────
const CONFIG = {
  // Concurrency: 5 parallel requests (reduced from 15 for stability)
  PARALLEL_LIMIT: 5,
  
  // Delays (ms)
  MIN_DELAY: 200,
  MAX_DELAY: 500,
  BATCH_PAUSE: 1000,
  BATCH_SIZE: 50,
  
  // Request timeout: 30s (increased from 15s, let axios handle it)
  REQUEST_TIMEOUT: 30000,
  
  // Retry: retry once on timeout
  MAX_RETRIES: 1,
  
  // Exponential backoff — only triggered by real HTTP errors, not timeouts
  INITIAL_BACKOFF: 5000,
  MAX_BACKOFF: 120000,
  BACKOFF_MULTIPLIER: 2,
  
  // Failure thresholds — much more tolerant
  // Only HTTP errors (4xx/5xx) count as consecutive failures
  // Timeouts are treated as transient and don't trigger auto-stop
  MAX_CONSECUTIVE_HTTP_ERRORS: 200,
  BACKOFF_TRIGGER: 10,
  
  // Smart skip
  SKIP_RECENTLY_UPDATED_HOURS: 23,
  
  // Auto-resume
  MAX_AUTO_RESUME_ATTEMPTS: 3,
  PROCESSED_IDS_SAVE_INTERVAL: 50,
};

// ─── Types ────────────────────────────────────────────────────────
interface TaskMetadata {
  errors: Array<{ cardId: number; cardName: string; error: string }>;
  processedProductKeys?: string[];
  resumeCount?: number;
  resumeHistory?: Array<{ at: string; fromProcessed: number }>;
}

interface ProductInfo {
  id: number;
  name: string;
  productType: string;
  snkrdunkId: string; // SNKRDUNK product ID extracted from sourceUrl
  lastFetchedAt: Date | null;
  sourceUrl: string;
  dataSourceId: number; // ID in dataSources table for updating fetch status
}

/**
 * Randomized delay to avoid detection patterns
 */
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get all SNKRDUNK products with their data source info
 * Pre-extracts snkrdunkId to avoid repeated URL parsing during processing
 */
async function getAllSnkrdunkProducts(): Promise<ProductInfo[]> {
  const { data: allDataSources } = await db.getDataSources({ pageSize: 100000 });
  const snkrdunkSources = allDataSources.filter((ds: any) => ds.source === 'snkrdunk');
  
  const uniqueProducts = new Map<string, ProductInfo>();
  
  for (const source of snkrdunkSources) {
    const productType = source.productType || 'single_card';
    const key = `${productType}:${source.cardId}`;
    
    if (uniqueProducts.has(key)) continue;
    
    // Extract SNKRDUNK ID from URL upfront
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
 * Save processed product keys to task metadata (periodically)
 */
async function saveProcessedKeys(taskId: number, processedKeys: Set<string>, resumeCount: number, resumeHistory: Array<{ at: string; fromProcessed: number }>): Promise<void> {
  const database = await db.getDb();
  if (!database) return;
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  const task = await batchTaskManager.getBatchTaskProgress(taskId);
  const currentMetadata: TaskMetadata = task?.errors 
    ? { errors: task.errors, processedProductKeys: Array.from(processedKeys), resumeCount, resumeHistory }
    : { errors: [], processedProductKeys: Array.from(processedKeys), resumeCount, resumeHistory };
  
  await database.update(scheduledTasks)
    .set({ metadata: JSON.stringify(currentMetadata) })
    .where(eq(scheduledTasks.id, taskId));
}

/**
 * Fetch price history with retry logic
 * Returns { data, isTimeout } to distinguish timeout from real errors
 */
async function fetchWithRetry(
  snkrdunkId: string,
  productType: "single_card" | "sealed_product",
  maxRetries: number = CONFIG.MAX_RETRIES
): Promise<{ data: any[]; isTimeout: boolean; error?: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use throwOnError=true so we can distinguish timeout from empty results
      // Use CONFIG.REQUEST_TIMEOUT (30s) instead of default 15s
      const priceHistory = await fetchPriceHistoryFromApi(snkrdunkId, productType, {
        timeout: CONFIG.REQUEST_TIMEOUT,
        throwOnError: true,
      });
      return { data: priceHistory, isTimeout: false };
    } catch (error: any) {
      const isTimeout = error.isTimeout || 
                        error.code === 'ECONNABORTED' || 
                        error.message?.includes('timeout') || 
                        error.message?.includes('Timeout');
      const isLastAttempt = attempt >= maxRetries;
      
      if (isLastAttempt) {
        return { data: [], isTimeout, error: error.message };
      }
      
      // Wait before retry (longer for timeouts)
      const retryDelay = isTimeout ? 3000 : 1000;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      console.log(`[BatchUpdate] Retry ${attempt + 1}/${maxRetries} for SNKRDUNK ID ${snkrdunkId} (${isTimeout ? 'timeout' : 'error'})`);
    }
  }
  
  return { data: [], isTimeout: true, error: 'Max retries exceeded' };
}

/**
 * Check if a price record already exists (to avoid duplicates)
 */
async function priceRecordExists(cardId: number, source: "snkrdunk" | "ebay" | "tcgplayer" | "other", soldAt: Date, price: string): Promise<boolean> {
  const database = await db.getDb();
  if (!database) return false;
  
  const { priceHistory } = await import('../drizzle/schema_new');
  const { eq, and } = await import('drizzle-orm');
  
  const existing = await database
    .select({ id: priceHistory.id })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.cardId, cardId),
        eq(priceHistory.source, source),
        eq(priceHistory.soldAt, soldAt),
        eq(priceHistory.price, price)
      )
    )
    .limit(1);
  
  return existing.length > 0;
}

/**
 * Core batch processing logic — shared between new tasks and resumed tasks
 */
async function runBatchProcessing(
  taskId: number,
  productsToUpdate: ProductInfo[],
  alreadyProcessedKeys: Set<string>,
  resumeCount: number,
  resumeHistory: Array<{ at: string; fromProcessed: number }>,
): Promise<void> {
  let consecutiveHttpErrors = 0;
  let currentBackoff = CONFIG.INITIAL_BACKOFF;
  let shouldStop = false;
  let totalProcessed = 0;
  let totalTimeouts = 0;
  let totalNewRecords = 0;
  let totalSkippedDuplicates = 0;
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
    if (processedKeys.has(productKey)) return;
    
    const productType: "single_card" | "sealed_product" = 
      (product.productType === 'sealed_product') ? 'sealed_product' : 'single_card';

    try {
      // Fetch price history with retry (NO outer withTimeout wrapper)
      const result = await fetchWithRetry(product.snkrdunkId, productType);
      
      if (result.error) {
        if (result.isTimeout) {
          // Timeout: log but DON'T count as consecutive HTTP error
          totalTimeouts++;
          processedKeys.add(productKey);
          await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, `Timeout (retry exhausted): ${result.error}`);
          totalProcessed++;
          // DO NOT increment consecutiveHttpErrors for timeouts
          return;
        } else {
          // Real HTTP error: count as consecutive failure
          throw new Error(result.error);
        }
      }
      
      const priceHistory = result.data;
      
      if (!priceHistory || priceHistory.length === 0) {
        processedKeys.add(productKey);
        await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
        totalProcessed++;
        consecutiveHttpErrors = 0; // Reset on success
        return;
      }

      // Save price data (with duplicate check)
      let recordsAdded = 0;
      for (const priceItem of priceHistory) {
        const priceHKD = convertJpyToHkd(priceItem.price);
        const priceStr = priceHKD.toString();
        
        // Check for duplicate before inserting
        const isDuplicate = await priceRecordExists(
          product.id, 'snkrdunk', priceItem.soldAt, priceStr
        );
        
        if (isDuplicate) {
          totalSkippedDuplicates++;
          continue;
        }
        
        await db.addPriceHistory({
          cardId: product.id,
          source: 'snkrdunk',
          price: priceStr,
          currency: 'HKD',
          grade: productType === 'sealed_product' ? undefined : priceItem.grade,
          quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
          productType,
          soldAt: priceItem.soldAt,
        });
        recordsAdded++;
      }
      totalNewRecords += recordsAdded;

      // Update data source fetch status
      await db.updateDataSourceFetchStatus(product.dataSourceId, "success");

      processedKeys.add(productKey);
      await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
      totalProcessed++;
      
      // Reset consecutive errors on success
      consecutiveHttpErrors = 0;
      currentBackoff = CONFIG.INITIAL_BACKOFF;
      
      // Log progress every 100 products
      if (totalProcessed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = totalProcessed / elapsed;
        const remaining = remainingProducts.length - totalProcessed;
        const eta = remaining / speed;
        console.log(`[BatchUpdate] Progress: ${totalProcessed}/${remainingProducts.length} (${(totalProcessed / remainingProducts.length * 100).toFixed(1)}%) | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min | Timeouts: ${totalTimeouts} | New records: ${totalNewRecords} | Duplicates skipped: ${totalSkippedDuplicates}`);
      }
      
      // Periodically save processed keys
      if (processedKeys.size - lastSavedCount >= CONFIG.PROCESSED_IDS_SAVE_INTERVAL) {
        await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
        lastSavedCount = processedKeys.size;
      }
      
    } catch (error: any) {
      console.error(`[BatchUpdate] HTTP error for ${product.productType} ${product.id}: ${error.message}`);
      processedKeys.add(productKey);
      await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, error.message);
      totalProcessed++;
      
      // Only count real HTTP errors (not timeouts) for consecutive failure tracking
      consecutiveHttpErrors++;
      
      if (consecutiveHttpErrors >= CONFIG.BACKOFF_TRIGGER) {
        currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
      }
      
      // Auto-stop after too many consecutive HTTP errors
      if (consecutiveHttpErrors >= CONFIG.MAX_CONSECUTIVE_HTTP_ERRORS) {
        const errorMsg = `Auto-stopped: ${consecutiveHttpErrors} consecutive HTTP errors. Last error: ${error.message}. Total timeouts: ${totalTimeouts}.`;
        console.error(`[BatchUpdate] ${errorMsg}`);
        
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
  console.log(`[BatchUpdate] Config: parallel=${CONFIG.PARALLEL_LIMIT}, batchSize=${CONFIG.BATCH_SIZE}, timeout=${CONFIG.REQUEST_TIMEOUT}ms, retries=${CONFIG.MAX_RETRIES}`);
  
  for (let i = 0; i < remainingProducts.length; i += CONFIG.BATCH_SIZE) {
    if (shouldStop) break;
    
    const batch = remainingProducts.slice(i, i + CONFIG.BATCH_SIZE);
    
    // Check if task is paused or cancelled
    while (await batchTaskManager.isTaskPaused(taskId)) {
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
    
    if (batchNum % 10 === 1) {
      console.log(`[BatchUpdate] Processing batch ${batchNum}/${totalBatches}`);
    }
    
    // Process batch with limited parallelism
    for (let j = 0; j < batch.length; j += CONFIG.PARALLEL_LIMIT) {
      if (shouldStop) break;
      
      const parallelBatch = batch.slice(j, j + CONFIG.PARALLEL_LIMIT);
      
      // If we're in backoff mode, wait before processing
      if (consecutiveHttpErrors >= CONFIG.BACKOFF_TRIGGER) {
        console.log(`[BatchUpdate] Backoff: waiting ${currentBackoff / 1000}s due to ${consecutiveHttpErrors} consecutive HTTP errors`);
        await new Promise(resolve => setTimeout(resolve, currentBackoff));
      }
      
      // Process products in parallel (NO outer timeout wrapper - each request has its own timeout)
      await Promise.allSettled(parallelBatch.map(product => processProduct(product)));
      
      // Delay between parallel groups
      if (!shouldStop) {
        await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY);
      }
    }
    
    // Pause between batches
    if (!shouldStop && i + CONFIG.BATCH_SIZE < remainingProducts.length) {
      await randomDelay(CONFIG.BATCH_PAUSE - 200, CONFIG.BATCH_PAUSE + 300);
    }
  }

  // Complete task
  if (!shouldStop) {
    await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory);
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[BatchUpdate] ✅ Batch update completed: ${remainingProducts.length} products in ${Math.ceil(elapsed / 60)} minutes (${(remainingProducts.length / elapsed).toFixed(1)}/s avg)`);
    console.log(`[BatchUpdate] Stats: ${totalNewRecords} new records, ${totalSkippedDuplicates} duplicates skipped, ${totalTimeouts} timeouts`);
    await batchTaskManager.completeTask(taskId, 'completed');
  }
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
    return aTime - bTime;
  });
  
  console.log(`[BatchUpdate] Found ${allProducts.length} unique products, skipping ${skippedCount} recently updated, updating ${productsToUpdate.length}`);
  console.log(`[BatchUpdate] Config: parallel=${CONFIG.PARALLEL_LIMIT}, batchSize=${CONFIG.BATCH_SIZE}, timeout=${CONFIG.REQUEST_TIMEOUT}ms, retries=${CONFIG.MAX_RETRIES}`);

  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background
  (async () => {
    await runBatchProcessing(taskId, productsToUpdate, new Set(), 0, []);
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedCount };
}

/**
 * Resume a failed/stalled task from where it left off.
 */
export async function resumeFailedTask(failedTaskId: number): Promise<{ taskId: number; totalCards: number; skippedCards: number; resumedFrom: number }> {
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  const failedTask = await batchTaskManager.getBatchTaskProgress(failedTaskId);
  if (!failedTask) {
    throw new Error(`Task ${failedTaskId} not found`);
  }
  
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
  
  productsToUpdate.sort((a, b) => {
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime;
  });
  
  const remainingCount = productsToUpdate.filter(p => !processedKeys.has(`${p.productType}:${p.id}`)).length;
  
  console.log(`[BatchUpdate] Total products: ${productsToUpdate.length}, already processed: ${resumedFrom}, remaining: ${remainingCount}`);
  
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', remainingCount);
  
  resumeHistory.push({ at: new Date().toISOString(), fromProcessed: resumedFrom });
  
  (async () => {
    await runBatchProcessing(taskId, productsToUpdate, processedKeys, resumeCount, resumeHistory);
  })();

  return { taskId, totalCards: remainingCount, skippedCards: skippedCount, resumedFrom };
}

/**
 * Auto-resume stalled tasks on server startup.
 */
export async function autoResumeOnStartup(): Promise<{ resumed: boolean; taskId?: number; resumedFrom?: number }> {
  const database = await db.getDb();
  if (!database) {
    return { resumed: false };
  }
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq, and, desc, gt } = await import('drizzle-orm');
  
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
    .limit(5);
  
  if (recentFailedTasks.length === 0) {
    console.log('[BatchUpdate] No recently failed tasks to auto-resume (within 2 hours)');
    return { resumed: false };
  }
  
  const eligibleTasks = recentFailedTasks.filter(t => {
    const isAutoRecoveredTask = t.errorMessage?.includes('Auto-recovered on server startup');
    const hasProgressItems = (t.processedItems || 0) > 0;
    return isAutoRecoveredTask && hasProgressItems;
  });
  
  eligibleTasks.sort((a, b) => (b.processedItems || 0) - (a.processedItems || 0));
  
  const failedTask = eligibleTasks[0];
  
  if (!failedTask) {
    console.log('[BatchUpdate] No eligible tasks for auto-resume (no auto-recovered tasks with progress found)');
    return { resumed: false };
  }
  
  const isAutoRecovered = failedTask.errorMessage?.includes('Auto-recovered on server startup');
  const hasProgress = (failedTask.processedItems || 0) > 0;
  const isRecent = failedTask.createdAt && (Date.now() - new Date(failedTask.createdAt).getTime()) < 24 * 60 * 60 * 1000;
  
  let resumeCount = 0;
  if (failedTask.metadata) {
    try {
      const meta: TaskMetadata = JSON.parse(failedTask.metadata);
      resumeCount = meta.resumeCount || 0;
    } catch (e) {
      // ignore
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
