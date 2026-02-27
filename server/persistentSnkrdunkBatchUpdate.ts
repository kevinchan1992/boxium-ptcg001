/**
 * SNKRDUNK Persistent Batch Update
 * 
 * The single, authoritative batch update executor for SNKRDUNK price data.
 * All progress is tracked via the database (batchTaskManager), not in-memory.
 * 
 * Optimizations:
 * - Only fetches price history (1 API call per product, skips card details)
 * - 5 concurrent requests with randomized delays
 * - Exponential backoff on consecutive failures
 * - Smart skip: skip products updated within 23 hours
 * - Per-request and per-batch timeout protection
 * - Auto-stop after 15 consecutive failures
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { fetchPriceHistory, convertJpyToHkd } from './snkrdunkScraper';

// ─── Configuration ───────────────────────────────────────────────
const CONFIG = {
  // Concurrency: 5 concurrent requests (only 1 API call per product)
  PARALLEL_LIMIT: 5,
  
  // Delays (ms)
  MIN_DELAY: 300,            // Minimum delay between parallel batches
  MAX_DELAY: 800,            // Maximum delay between parallel batches (randomized)
  BATCH_PAUSE: 2000,         // Pause between batches of 50
  BATCH_SIZE: 50,            // Products per batch
  
  // Exponential backoff
  INITIAL_BACKOFF: 5000,     // 5 seconds initial backoff
  MAX_BACKOFF: 300000,       // 5 minutes max backoff
  BACKOFF_MULTIPLIER: 2,     // Double the backoff each time
  
  // Failure thresholds
  MAX_CONSECUTIVE_FAILURES: 15,  // Auto-fail after 15 consecutive failures
  BACKOFF_TRIGGER: 3,            // Start exponential backoff after 3 consecutive failures
  
  // Timeouts
  REQUEST_TIMEOUT: 20000,    // 20s per individual request
  PARALLEL_TIMEOUT: 60000,   // 60s for a parallel batch
  
  // Smart skip
  SKIP_RECENTLY_UPDATED_HOURS: 23, // Skip products updated within 23 hours
};

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
 * Execute SNKRDUNK batch update with persistent task tracking.
 * All progress is stored in the database via batchTaskManager.
 */
export async function executePersistentSnkrdunkBatchUpdate(): Promise<{ taskId: number; totalCards: number; skippedCards: number }> {
  // Check if there's already a running task
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  // Get all SNKRDUNK data sources
  const { data: allDataSources } = await db.getDataSources({ pageSize: 100000 });
  const snkrdunkSources = allDataSources.filter((ds: any) => ds.source === 'snkrdunk');
  
  // Get unique products (both cards and sealed products)
  const uniqueProducts = new Map<string, { 
    id: number; 
    name: string; 
    productType: string;
    lastFetchedAt: Date | null;
    sourceUrl: string;
  }>();
  
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

  const allProducts = Array.from(uniqueProducts.values());
  
  // Smart skip: separate products into "needs update" and "recently updated"
  const now = new Date();
  const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
  
  const productsToUpdate: typeof allProducts = [];
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

  // Create persistent task in database (this is the ONLY progress source)
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background
  (async () => {
    let consecutiveFailures = 0;
    let currentBackoff = CONFIG.INITIAL_BACKOFF;
    let shouldStop = false;
    
    // ─── Inner helper: process a single product ───────────────────
    async function processProduct(
      product: { id: number; name: string; productType: string; sourceUrl: string },
    ) {
      if (shouldStop) return;
      
      try {
        const productDataSources = snkrdunkSources.filter((ds: any) => {
          const dsProductType = ds.productType || 'single_card';
          return ds.cardId === product.id && dsProductType === product.productType;
        });
        
        if (productDataSources.length === 0 || !productDataSources[0].sourceUrl) {
          await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
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
          await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
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

        await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
        console.log(`[BatchUpdate] Updated ${productType} ${product.id}, added ${recordsAdded} records`);
        
        // Reset backoff on success
        consecutiveFailures = 0;
        currentBackoff = CONFIG.INITIAL_BACKOFF;
        
      } catch (error: any) {
        console.error(`[BatchUpdate] Error updating ${product.productType} ${product.id}: ${error.message}`);
        await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, error.message);
        
        consecutiveFailures++;
        
        if (consecutiveFailures >= CONFIG.BACKOFF_TRIGGER) {
          currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
        }
        
        // Auto-stop after too many consecutive failures
        if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
          const errorMsg = `Auto-stopped: ${consecutiveFailures} consecutive failures. Last error: ${error.message}. Possible rate limiting or network issues.`;
          console.error(`[BatchUpdate] ${errorMsg}`);
          
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
    for (let i = 0; i < productsToUpdate.length; i += CONFIG.BATCH_SIZE) {
      if (shouldStop) break;
      
      const batch = productsToUpdate.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Check if task is paused or cancelled
      while (await batchTaskManager.isTaskPaused(taskId)) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      if (await batchTaskManager.isTaskCancelled(taskId)) {
        console.log(`[BatchUpdate] Task ${taskId} cancelled, stopping...`);
        return;
      }
      
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(productsToUpdate.length / CONFIG.BATCH_SIZE);
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
            await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, 'Batch timeout');
          }
          
          consecutiveFailures += parallelBatch.length;
          currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF);
          
          if (consecutiveFailures >= CONFIG.MAX_CONSECUTIVE_FAILURES) {
            const errorMsg = `Auto-stopped: ${consecutiveFailures} consecutive failures (batch timeout). Possible rate limiting.`;
            console.error(`[BatchUpdate] ${errorMsg}`);
            
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
        
        // Randomized delay between parallel batches
        if (!shouldStop) {
          await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY);
        }
      }
      
      // Pause between batches
      if (!shouldStop && i + CONFIG.BATCH_SIZE < productsToUpdate.length) {
        await randomDelay(CONFIG.BATCH_PAUSE - 500, CONFIG.BATCH_PAUSE + 1000);
      }
    }

    // Complete task (only if not already stopped)
    if (!shouldStop) {
      await batchTaskManager.completeTask(taskId, 'completed');
      console.log(`[BatchUpdate] Batch update completed (processed: ${productsToUpdate.length})`);
    }
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedCount };
}
