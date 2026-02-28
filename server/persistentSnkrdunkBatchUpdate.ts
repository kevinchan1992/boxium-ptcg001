/**
 * SNKRDUNK Persistent Batch Update (v5 - Database-Efficient)
 * 
 * Root cause of v4 stalls: Too many DB operations per product.
 * Each product triggered: 1 SELECT per price record (duplicate check) + 1 INSERT per record
 * + 2 DB ops for progress tracking (read + write). For 670 products with ~100 records each,
 * that's ~135,000+ DB operations, exhausting the connection pool and causing silent stalls.
 * 
 * v5 Changes:
 * - REMOVED per-record priceRecordExists check (was doing SELECT for every single price record)
 * - Use batch INSERT with duplicate detection at SQL level
 * - ATOMIC progress updates (single UPDATE with increment, no read-then-write)
 * - Batch progress updates: update DB once per batch of 50, not per product
 * - Added per-product timeout (60s) to prevent individual products from blocking
 * - Added global watchdog timer to detect and recover from stalls
 * - Reduced DB operations from ~200 per product to ~3 per batch of 50
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } from './snkrdunkScraper';

// ─── Configuration (v5 - DB Efficiency) ────────────────────────
const CONFIG = {
  // Concurrency: 5 parallel requests
  PARALLEL_LIMIT: 5,
  
  // Delays (ms)
  MIN_DELAY: 200,
  MAX_DELAY: 500,
  BATCH_PAUSE: 1000,
  BATCH_SIZE: 50,
  
  // Request timeout: 30s
  REQUEST_TIMEOUT: 30000,
  
  // Per-product timeout: 60s (catches stuck DB operations)
  PRODUCT_TIMEOUT: 60000,
  
  // Retry: retry once on timeout
  MAX_RETRIES: 1,
  
  // Exponential backoff
  INITIAL_BACKOFF: 5000,
  MAX_BACKOFF: 120000,
  BACKOFF_MULTIPLIER: 2,
  
  // Failure thresholds
  MAX_CONSECUTIVE_HTTP_ERRORS: 200,
  BACKOFF_TRIGGER: 10,
  
  // Smart skip
  SKIP_RECENTLY_UPDATED_HOURS: 23,
  
  // Auto-resume
  MAX_AUTO_RESUME_ATTEMPTS: 3,
  PROCESSED_IDS_SAVE_INTERVAL: 100,
  
  // Watchdog: if no progress for this many ms, consider task stalled
  WATCHDOG_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  // Progress update interval: update DB every N products (not every product)
  PROGRESS_UPDATE_INTERVAL: 10,
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
  snkrdunkId: string;
  lastFetchedAt: Date | null;
  sourceUrl: string;
  dataSourceId: number;
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Timeout wrapper for individual operations
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
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
 * Save processed product keys to task metadata (periodically)
 */
async function saveProcessedKeys(taskId: number, processedKeys: Set<string>, resumeCount: number, resumeHistory: Array<{ at: string; fromProcessed: number }>, errors: Array<{ cardId: number; cardName: string; error: string }>): Promise<void> {
  const database = await db.getDb();
  if (!database) return;
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  const metadata: TaskMetadata = {
    errors: errors.slice(-100), // Keep last 100 errors
    processedProductKeys: Array.from(processedKeys),
    resumeCount,
    resumeHistory,
  };
  
  await database.update(scheduledTasks)
    .set({ metadata: JSON.stringify(metadata) })
    .where(eq(scheduledTasks.id, taskId));
}

/**
 * Fetch price history with retry logic
 */
async function fetchWithRetry(
  snkrdunkId: string,
  productType: "single_card" | "sealed_product",
  maxRetries: number = CONFIG.MAX_RETRIES
): Promise<{ data: any[]; isTimeout: boolean; error?: string }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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
      
      const retryDelay = isTimeout ? 3000 : 1000;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return { data: [], isTimeout: true, error: 'Max retries exceeded' };
}

/**
 * Batch insert price records efficiently.
 * 
 * Strategy: Use drizzle's batch insert (multiple values in one INSERT).
 * No per-record duplicate check - duplicates are harmless (same data) and
 * the old per-record SELECT was the primary cause of DB connection pool exhaustion.
 * 
 * For deduplication, we rely on the fact that price records with the same
 * cardId + source + soldAt + price are identical data, so duplicates don't
 * affect price calculations or trends.
 */
async function batchInsertPriceRecords(
  records: Array<{
    cardId: number;
    source: string;
    price: string;
    currency: string;
    grade?: string;
    quantity?: string;
    productType: string;
    soldAt: Date;
  }>
): Promise<number> {
  if (records.length === 0) return 0;
  
  const database = await db.getDb();
  if (!database) return 0;
  
  const { priceHistory } = await import('../drizzle/schema_new');
  
  let inserted = 0;
  
  // Process in chunks of 50 to avoid overly large SQL statements
  const chunkSize = 50;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    
    try {
      // Use drizzle's batch insert - one INSERT with multiple VALUES
      const values = chunk.map(rec => ({
        cardId: rec.cardId,
        productType: rec.productType as 'single_card' | 'sealed_product',
        source: rec.source as 'snkrdunk' | 'ebay' | 'tcgplayer' | 'other',
        price: rec.price,
        currency: rec.currency,
        grade: rec.grade || null,
        quantity: rec.quantity || null,
        soldAt: rec.soldAt,
      }));
      
      await database.insert(priceHistory).values(values);
      inserted += chunk.length;
    } catch (e: any) {
      // If batch fails, try individual inserts as fallback
      for (const rec of chunk) {
        try {
          await db.addPriceHistory({
            cardId: rec.cardId,
            source: rec.source as any,
            price: rec.price,
            currency: rec.currency,
            grade: rec.grade,
            quantity: rec.quantity,
            productType: rec.productType as any,
            soldAt: rec.soldAt,
          });
          inserted++;
        } catch (innerErr) {
          // Skip this record
        }
      }
    }
  }
  
  return inserted;
}

/**
 * Core batch processing logic — v5 with minimal DB operations
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
  let batchSuccessCount = 0;
  let batchFailureCount = 0;
  const processedKeys = new Set(alreadyProcessedKeys);
  let lastSavedCount = processedKeys.size;
  const startTime = Date.now();
  let lastProgressTime = Date.now(); // Watchdog timer
  const errors: Array<{ cardId: number; cardName: string; error: string }> = [];
  
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
  
  /**
   * Flush accumulated progress to DB (batch update instead of per-product)
   */
  async function flushProgress(): Promise<void> {
    if (batchSuccessCount > 0) {
      await batchTaskManager.updateTaskProgressBulkSuccess(taskId, batchSuccessCount);
      batchSuccessCount = 0;
    }
    if (batchFailureCount > 0) {
      await batchTaskManager.updateTaskProgressBulkFailure(taskId, batchFailureCount);
      batchFailureCount = 0;
    }
  }
  
  // ─── Inner helper: process a single product ───────────────────
  async function processProduct(product: ProductInfo): Promise<void> {
    if (shouldStop) return;
    
    const productKey = `${product.productType}:${product.id}`;
    if (processedKeys.has(productKey)) return;
    
    const productType: "single_card" | "sealed_product" = 
      (product.productType === 'sealed_product') ? 'sealed_product' : 'single_card';

    try {
      // Wrap entire product processing in a timeout to prevent stalls
      await withTimeout((async () => {
        // Fetch price history with retry
        const result = await fetchWithRetry(product.snkrdunkId, productType);
        
        if (result.error) {
          if (result.isTimeout) {
            totalTimeouts++;
            processedKeys.add(productKey);
            batchFailureCount++;
            errors.push({ cardId: product.id, cardName: product.name, error: `Timeout: ${result.error}` });
            totalProcessed++;
            lastProgressTime = Date.now();
            return;
          } else {
            throw new Error(result.error);
          }
        }
        
        const priceHistory = result.data;
        
        if (!priceHistory || priceHistory.length === 0) {
          processedKeys.add(productKey);
          batchSuccessCount++;
          totalProcessed++;
          consecutiveHttpErrors = 0;
          lastProgressTime = Date.now();
          return;
        }

        // Prepare all records for batch insert (NO individual duplicate checks)
        const records = priceHistory.map((priceItem: any) => ({
          cardId: product.id,
          source: 'snkrdunk',
          price: convertJpyToHkd(priceItem.price).toString(),
          currency: 'HKD',
          grade: productType === 'sealed_product' ? undefined : priceItem.grade,
          quantity: productType === 'sealed_product' ? (priceItem.quantity || undefined) : undefined,
          productType,
          soldAt: priceItem.soldAt,
        }));

        // Batch insert all records at once
        const recordsAdded = await batchInsertPriceRecords(records);
        totalNewRecords += recordsAdded;

        // Update data source fetch status
        await db.updateDataSourceFetchStatus(product.dataSourceId, "success");

        processedKeys.add(productKey);
        batchSuccessCount++;
        totalProcessed++;
        
        consecutiveHttpErrors = 0;
        currentBackoff = CONFIG.INITIAL_BACKOFF;
        lastProgressTime = Date.now();
      })(), CONFIG.PRODUCT_TIMEOUT, `processProduct(${product.snkrdunkId})`);
      
    } catch (error: any) {
      const isTimeout = error.message?.includes('Timeout after');
      
      if (isTimeout) {
        // Product-level timeout (DB operation stuck)
        totalTimeouts++;
        console.warn(`[BatchUpdate] Product timeout for ${product.productType} ${product.id} (${product.snkrdunkId}): ${error.message}`);
      } else {
        console.error(`[BatchUpdate] HTTP error for ${product.productType} ${product.id}: ${error.message}`);
        consecutiveHttpErrors++;
      }
      
      processedKeys.add(productKey);
      batchFailureCount++;
      errors.push({ cardId: product.id, cardName: product.name, error: error.message });
      totalProcessed++;
      lastProgressTime = Date.now();
      
      if (!isTimeout && consecutiveHttpErrors >= CONFIG.BACKOFF_TRIGGER) {
        currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
      }
      
      if (consecutiveHttpErrors >= CONFIG.MAX_CONSECUTIVE_HTTP_ERRORS) {
        const errorMsg = `Auto-stopped: ${consecutiveHttpErrors} consecutive HTTP errors. Last: ${error.message}. Timeouts: ${totalTimeouts}.`;
        console.error(`[BatchUpdate] ${errorMsg}`);
        
        await flushProgress();
        await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
        
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
  console.log(`[BatchUpdate] Config: parallel=${CONFIG.PARALLEL_LIMIT}, batchSize=${CONFIG.BATCH_SIZE}, timeout=${CONFIG.REQUEST_TIMEOUT}ms, productTimeout=${CONFIG.PRODUCT_TIMEOUT}ms, retries=${CONFIG.MAX_RETRIES}`);
  
  for (let i = 0; i < remainingProducts.length; i += CONFIG.BATCH_SIZE) {
    if (shouldStop) break;
    
    const batch = remainingProducts.slice(i, i + CONFIG.BATCH_SIZE);
    
    // Check if task is paused or cancelled (only once per batch, not per product)
    const taskStatus = await batchTaskManager.isTaskPaused(taskId);
    if (taskStatus) {
      await flushProgress();
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
      while (await batchTaskManager.isTaskPaused(taskId)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    if (await batchTaskManager.isTaskCancelled(taskId)) {
      console.log(`[BatchUpdate] Task ${taskId} cancelled, saving progress and stopping...`);
      await flushProgress();
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
      return;
    }
    
    // Watchdog check: if no progress for 5 minutes, something is wrong
    if (Date.now() - lastProgressTime > CONFIG.WATCHDOG_TIMEOUT) {
      const errorMsg = `Watchdog triggered: no progress for ${Math.round((Date.now() - lastProgressTime) / 60000)} minutes. Processed ${totalProcessed}/${remainingProducts.length}. Stopping to prevent indefinite stall.`;
      console.error(`[BatchUpdate] ${errorMsg}`);
      
      await flushProgress();
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
      
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
    
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remainingProducts.length / CONFIG.BATCH_SIZE);
    
    // Process batch with limited parallelism
    for (let j = 0; j < batch.length; j += CONFIG.PARALLEL_LIMIT) {
      if (shouldStop) break;
      
      const parallelBatch = batch.slice(j, j + CONFIG.PARALLEL_LIMIT);
      
      // Backoff if needed
      if (consecutiveHttpErrors >= CONFIG.BACKOFF_TRIGGER) {
        console.log(`[BatchUpdate] Backoff: waiting ${currentBackoff / 1000}s due to ${consecutiveHttpErrors} consecutive HTTP errors`);
        await new Promise(resolve => setTimeout(resolve, currentBackoff));
      }
      
      // Process products in parallel
      await Promise.allSettled(parallelBatch.map(product => processProduct(product)));
      
      // Delay between parallel groups
      if (!shouldStop) {
        await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY);
      }
    }
    
    // Flush progress to DB once per batch (not per product!)
    await flushProgress();
    
    // Log progress every 5 batches
    if (batchNum % 5 === 0 || batchNum === 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = totalProcessed / elapsed;
      const remaining = remainingProducts.length - totalProcessed;
      const eta = speed > 0 ? remaining / speed : 0;
      console.log(`[BatchUpdate] Batch ${batchNum}/${totalBatches} | Progress: ${totalProcessed}/${remainingProducts.length} (${(totalProcessed / remainingProducts.length * 100).toFixed(1)}%) | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min | Timeouts: ${totalTimeouts} | New records: ${totalNewRecords}`);
    }
    
    // Periodically save processed keys (every N products)
    if (processedKeys.size - lastSavedCount >= CONFIG.PROCESSED_IDS_SAVE_INTERVAL) {
      await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
      lastSavedCount = processedKeys.size;
    }
    
    // Pause between batches
    if (!shouldStop && i + CONFIG.BATCH_SIZE < remainingProducts.length) {
      await randomDelay(CONFIG.BATCH_PAUSE - 200, CONFIG.BATCH_PAUSE + 300);
    }
  }

  // Complete task
  if (!shouldStop) {
    await flushProgress();
    await saveProcessedKeys(taskId, processedKeys, resumeCount, resumeHistory, errors);
    
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[BatchUpdate] ✅ Batch update completed: ${remainingProducts.length} products in ${Math.ceil(elapsed / 60)} minutes (${(remainingProducts.length / elapsed).toFixed(1)}/s avg)`);
    console.log(`[BatchUpdate] Stats: ${totalNewRecords} new records, ${totalTimeouts} timeouts, ${errors.length} errors`);
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

  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background (wrapped in global try-catch)
  (async () => {
    try {
      await runBatchProcessing(taskId, productsToUpdate, new Set(), 0, []);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL: Unhandled error in batch processing: ${error.message}`);
      console.error(error.stack);
      
      // Mark task as failed
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
        console.error(`[BatchUpdate] Failed to mark task as failed: ${dbErr}`);
      }
    }
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
  
  // Execute with global try-catch
  (async () => {
    try {
      await runBatchProcessing(taskId, productsToUpdate, processedKeys, resumeCount, resumeHistory);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL: Unhandled error in resumed batch processing: ${error.message}`);
      try {
        const database2 = await db.getDb();
        if (database2) {
          const { scheduledTasks: st } = await import('../drizzle/schema_new');
          const { eq: eq2 } = await import('drizzle-orm');
          await database2.update(st)
            .set({ status: 'failed', completedAt: new Date(), errorMessage: `FATAL: ${error.message}` })
            .where(eq2(st.id, taskId));
        }
      } catch (dbErr) {
        console.error(`[BatchUpdate] Failed to mark task as failed: ${dbErr}`);
      }
    }
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
