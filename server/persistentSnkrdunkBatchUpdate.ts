import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { scrapeSnkrdunkPage, convertJpyToHkd } from './snkrdunkScraper';
import * as batchUpdateSnkrdunkProgress from './batchUpdateSnkrdunkProgress';

/**
 * Execute SNKRDUNK batch update with persistent task tracking
 * This function runs in the background and survives page navigation
 * 
 * Optimizations:
 * - Parallel processing: Process 5 cards concurrently
 * - Reduced delay: 100ms between cards (down from 150ms)
 * - Process all cards without skipping (for daily scheduled updates)
 * - Supports both single_card and sealed_product types
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
  const uniqueProducts = new Map<string, { id: number; name: string; productType: string }>();
  
  for (const source of snkrdunkSources) {
    const productType = source.productType || 'single_card';
    const key = `${productType}:${source.cardId}`;
    
    if (source.card) {
      // Card found via LEFT JOIN (works for single_card type)
      uniqueProducts.set(key, {
        id: source.card.id,
        name: source.card.name,
        productType,
      });
    } else if (productType === 'sealed_product') {
      // For sealed products, the LEFT JOIN on cards table returns null
      // We need to fetch from sealedProducts table
      try {
        const sealedProduct = await db.getSealedProductById(source.cardId);
        if (sealedProduct) {
          uniqueProducts.set(key, {
            id: sealedProduct.id,
            name: sealedProduct.name,
            productType,
          });
        }
      } catch (e) {
        // Skip if sealed product not found
      }
    }
  }

  const allProducts = Array.from(uniqueProducts.values());
  console.log(`[PersistentSnkrdunkBatchUpdate] Found ${allProducts.length} unique products (cards + sealed products)`);

  // Process all products without skipping
  const productsToUpdate = allProducts;
  
  console.log(`[PersistentSnkrdunkBatchUpdate] Starting batch update for ${productsToUpdate.length} products`);

  // Initialize progress tracking (for frontend display)
  batchUpdateSnkrdunkProgress.initSnkrdunkBatchUpdateProgress(productsToUpdate.length);

  // Create persistent task (for database persistence)
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute batch update in background (async IIFE) with parallel processing
  (async () => {
    const BATCH_SIZE = 80; // Process 80 products per batch
    const PARALLEL_LIMIT = 5; // Process 5 products concurrently
    const CARD_DELAY = 100; // 100ms delay between products (reduced from 150ms)
    
    // Split products into batches
    for (let i = 0; i < productsToUpdate.length; i += BATCH_SIZE) {
      const batch = productsToUpdate.slice(i, i + BATCH_SIZE);
      
      // Check if task is paused or cancelled before processing each batch
      while (await batchTaskManager.isTaskPaused(taskId)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (await batchTaskManager.isTaskCancelled(taskId)) {
        console.log(`[PersistentSnkrdunkBatchUpdate] Task ${taskId} cancelled, stopping...`);
        return;
      }
      
      console.log(`[PersistentSnkrdunkBatchUpdate] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(productsToUpdate.length / BATCH_SIZE)} (${batch.length} products)`);
      
      // Process batch with parallel processing (5 products at a time)
      for (let j = 0; j < batch.length; j += PARALLEL_LIMIT) {
        const parallelBatch = batch.slice(j, j + PARALLEL_LIMIT);
        
        // Process products in parallel
        await Promise.all(parallelBatch.map(async (product) => {
          try {
            // Get product's SNKRDUNK data sources
            const productDataSources = snkrdunkSources.filter((ds: any) => {
              const dsProductType = ds.productType || 'single_card';
              return ds.cardId === product.id && dsProductType === product.productType;
            });
            
            if (productDataSources.length === 0) {
              // 無數據源不計入錯誤，跳過
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Use first data source URL
            const dataSource = productDataSources[0];
            if (!dataSource.sourceUrl) {
              // URL 為空不計入錯誤，跳過
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Scrape SNKRDUNK page (pass productType to handle sealed products correctly)
            const productType: "single_card" | "sealed_product" = (product.productType === 'sealed_product') ? 'sealed_product' : 'single_card';
            const scrapedData = await scrapeSnkrdunkPage(dataSource.sourceUrl, productType);
            if (!scrapedData || !scrapedData.priceHistory || scrapedData.priceHistory.length === 0) {
              // 沒有價格數據是正常情況，不計入錯誤
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Update product info based on type
            if (productType === 'sealed_product') {
              await db.updateSealedProduct(product.id, {
                name: scrapedData.name,
                nameJa: scrapedData.nameJa,
                imageUrl: scrapedData.imageUrl || undefined,
              });
            } else {
              await db.updateCard(product.id, {
                name: scrapedData.name,
                nameJa: scrapedData.nameJa,
                imageUrl: scrapedData.imageUrl || undefined,
              });
            }

            // Save price data to priceHistory table
            let recordsAdded = 0;
            for (const priceItem of scrapedData.priceHistory) {
              const priceHKD = await convertJpyToHkd(priceItem.price);
              await db.addPriceHistory({
                cardId: product.id,
                source: 'snkrdunk',
                price: priceHKD.toString(),
                currency: 'HKD',
                grade: productType === 'sealed_product' ? undefined : priceItem.grade,
                quantity: productType === 'sealed_product' ? (priceItem.grade || undefined) : undefined,
                productType: productType as 'single_card' | 'sealed_product',
                soldAt: priceItem.soldAt,
              });
              recordsAdded++;
            }

            // Update all data sources for this product
            for (const ds of productDataSources) {
              await db.updateDataSourceFetchStatus(ds.id, "success");
            }

            await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
            batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(recordsAdded);
            console.log(`[PersistentSnkrdunkBatchUpdate] Updated ${productType} ${product.id}, added ${recordsAdded} records`);
          } catch (error: any) {
            console.error(`[PersistentSnkrdunkBatchUpdate] Error updating ${product.productType} ${product.id}: ${error.message}`);
            await batchTaskManager.updateTaskProgressFailure(taskId, product.id, product.name, error.message);
            batchUpdateSnkrdunkProgress.updateSnkrdunkProgressFailure(product.id, product.name, error.message);
          }
        }));
        
        // Small delay between parallel batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, CARD_DELAY * PARALLEL_LIMIT));
      }
      
      // Rate limiting: pause between batches
      if (i + BATCH_SIZE < productsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause between batches (reduced from 3s)
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    batchUpdateSnkrdunkProgress.completeSnkrdunkBatchUpdate();
    console.log(`[PersistentSnkrdunkBatchUpdate] Batch update completed (processed: ${productsToUpdate.length})`);
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: 0 };
}
