/**
 * SNKRDUNK Persistent Batch Update
 * 
 * The single, authoritative batch update executor for SNKRDUNK price data.
 * All progress is tracked via the database (batchTaskManager), not in-memory.
 * 
 * Optimizations (v2 - Speed Optimized):
 * - Only fetches price history (1 API call per product, skips card details)
 * - 15 concurrent requests (up from 5) — SNKRDUNK API is stable with JSON endpoints
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

// ─── Configuration (v2 - Speed Optimized) ───────────────────────
const CONFIG = {
  // Concurrency: 15 concurrent requests (SNKRDUNK JSON API handles this well)
  // Real-world testing shows 0 failures in 1326 consecutive requests
  PARALLEL_LIMIT: 15,
  
  // Delays (ms) — minimized based on real-world experience
  MIN_DELAY: 100,             // 100ms minimum between parallel groups (was 300ms)
  MAX_DELAY: 300,             // 300ms maximum between parallel groups (was 800ms)
  BATCH_PAUSE: 500,           // 500ms pause between batches of 100 (was 2000ms for 50)
  BATCH_SIZE: 100,            // Products per batch (was 50)
  
  // Exponential backoff — higher thresholds based on real experience
  INITIAL_BACKOFF: 3000,      // 3 seconds initial backoff (was 5s)
  MAX_BACKOFF: 120000,        // 2 minutes max backoff (was 5 minutes)
  BACKOFF_MULTIPLIER: 2,      // Double the backoff each time
  
  // Failure thresholds — much more tolerant based on real data
  MAX_CONSECUTIVE_FAILURES: 30,   // Auto-fail after 30 consecutive failures (was 15)
  BACKOFF_TRIGGER: 5,             // Start backoff after 5 consecutive failures (was 3)
  BACKOFF_RESET_ON_SUCCESS: true, // Reset backoff counter on any success
  
  // Timeouts
  REQUEST_TIMEOUT: 15000,     // 15s per individual request (was 20s, API is fast)
  PARALLEL_TIMEOUT: 45000,    // 45s for a parallel batch (was 60s)
  
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
  console.log(`[BatchUpdate] Config: parallel=${CONFIG.PARALLEL_LIMIT}, batchSize=${CONFIG.BATCH_SIZE}, delay=${CONFIG.MIN_DELAY}-${CONFIG.MAX_DELAY}ms, batchPause=${CONFIG.BATCH_PAUSE}ms`);

  // Create persistent task in database (this is the ONLY progress source)
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background
  (async () => {
    let consecutiveFailures = 0;
    let currentBackoff = CONFIG.INITIAL_BACKOFF;
    let shouldStop = false;
    let totalProcessed = 0;
    const startTime = Date.now();
    
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

        await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
        totalProcessed++;
        
        // Log progress every 100 products with speed stats
        if (totalProcessed % 100 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = totalProcessed / elapsed;
          const remaining = productsToUpdate.length - totalProcessed;
          const eta = remaining / speed;
          console.log(`[BatchUpdate] Progress: ${totalProcessed}/${productsToUpdate.length} (${(totalProcessed / productsToUpdate.length * 100).toFixed(1)}%) | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min`);
        }
        
        // Reset backoff on success
        consecutiveFailures = 0;
        currentBackoff = CONFIG.INITIAL_BACKOFF;
        
      } catch (error: any) {
        console.error(`[BatchUpdate] Error updating ${product.productType} ${product.id}: ${error.message}`);
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
    console.log(`[BatchUpdate] Starting batch update: ${productsToUpdate.length} products, ${Math.ceil(productsToUpdate.length / CONFIG.BATCH_SIZE)} batches`);
    
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
            totalProcessed++;
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
        
        // Minimal delay between parallel groups (only when not in backoff)
        if (!shouldStop && consecutiveFailures < CONFIG.BACKOFF_TRIGGER) {
          await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY);
        }
      }
      
      // Short pause between batches
      if (!shouldStop && i + CONFIG.BATCH_SIZE < productsToUpdate.length) {
        await randomDelay(CONFIG.BATCH_PAUSE - 200, CONFIG.BATCH_PAUSE + 300);
      }
    }

    // Complete task (only if not already stopped)
    if (!shouldStop) {
      const elapsed = (Date.now() - startTime) / 1000;
      console.log(`[BatchUpdate] Batch update completed: ${productsToUpdate.length} products in ${Math.ceil(elapsed / 60)} minutes (${(productsToUpdate.length / elapsed).toFixed(1)}/s avg)`);
      await batchTaskManager.completeTask(taskId, 'completed');
    }
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedCount };
}
