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
  
  // Get unique cards
  const uniqueCards = new Map<number, { id: number; name: string }>();
  for (const source of snkrdunkSources) {
    if (source.card) {
      uniqueCards.set(source.card.id, {
        id: source.card.id,
        name: source.card.name,
      });
    }
  }

  const allCards = Array.from(uniqueCards.values());
  console.log(`[PersistentSnkrdunkBatchUpdate] Found ${allCards.length} unique cards`);

  // Process all cards without skipping
  const cardsToUpdate = allCards;
  
  console.log(`[PersistentSnkrdunkBatchUpdate] Starting batch update for ${cardsToUpdate.length} cards`);

  // Initialize progress tracking (for frontend display)
  batchUpdateSnkrdunkProgress.initSnkrdunkBatchUpdateProgress(cardsToUpdate.length);

  // Create persistent task (for database persistence)
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', cardsToUpdate.length);

  // Execute batch update in background (async IIFE) with parallel processing
  (async () => {
    const BATCH_SIZE = 80; // Process 80 cards per batch
    const PARALLEL_LIMIT = 5; // Process 5 cards concurrently
    const CARD_DELAY = 100; // 100ms delay between cards (reduced from 150ms)
    
    // Split cards into batches
    for (let i = 0; i < cardsToUpdate.length; i += BATCH_SIZE) {
      const batch = cardsToUpdate.slice(i, i + BATCH_SIZE);
      
      // Check if task is paused or cancelled before processing each batch
      while (await batchTaskManager.isTaskPaused(taskId)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (await batchTaskManager.isTaskCancelled(taskId)) {
        console.log(`[PersistentSnkrdunkBatchUpdate] Task ${taskId} cancelled, stopping...`);
        return;
      }
      
      console.log(`[PersistentSnkrdunkBatchUpdate] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cardsToUpdate.length / BATCH_SIZE)} (${batch.length} cards)`);
      
      // Process batch with parallel processing (5 cards at a time)
      for (let j = 0; j < batch.length; j += PARALLEL_LIMIT) {
        const parallelBatch = batch.slice(j, j + PARALLEL_LIMIT);
        
        // Process cards in parallel
        await Promise.all(parallelBatch.map(async (card) => {
          try {
            // Get card's SNKRDUNK data sources
            const cardDataSources = snkrdunkSources.filter((ds: any) => ds.cardId === card.id);
            if (cardDataSources.length === 0) {
              // 無數據源不計入錯誤，跳過
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Use first data source URL
            const dataSource = cardDataSources[0];
            if (!dataSource.sourceUrl) {
              // URL 為空不計入錯誤，跳過
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Scrape SNKRDUNK page (pass productType to handle sealed products correctly)
            const productType = dataSource.productType || "single_card";
            const scrapedData = await scrapeSnkrdunkPage(dataSource.sourceUrl, productType);
            if (!scrapedData || !scrapedData.priceHistory || scrapedData.priceHistory.length === 0) {
              // 沒有價格數據是正常情況，不計入錯誤
              await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
              batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(0);
              return;
            }

            // Save price data to priceHistory table
            let recordsAdded = 0;
            for (const priceItem of scrapedData.priceHistory) {
              const priceHKD = await convertJpyToHkd(priceItem.price);
              await db.addPriceHistory({
                cardId: card.id,
                source: 'snkrdunk',
                price: priceHKD.toString(),
                currency: 'HKD',
                grade: priceItem.grade,
                soldAt: priceItem.soldAt,
              });
              recordsAdded++;
            }

            // Update all data sources for this card
            for (const ds of cardDataSources) {
              await db.updateDataSourceFetchStatus(ds.id, "success");
            }

            await batchTaskManager.updateTaskProgressSuccess(taskId, recordsAdded);
            batchUpdateSnkrdunkProgress.updateSnkrdunkProgressSuccess(recordsAdded);
            console.log(`[PersistentSnkrdunkBatchUpdate] Updated card ${card.id}, added ${recordsAdded} records`);
          } catch (error: any) {
            console.error(`[PersistentSnkrdunkBatchUpdate] Error updating card ${card.id}: ${error.message}`);
            await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, error.message);
            batchUpdateSnkrdunkProgress.updateSnkrdunkProgressFailure(card.id, card.name, error.message);
          }
        }));
        
        // Small delay between parallel batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, CARD_DELAY * PARALLEL_LIMIT));
      }
      
      // Rate limiting: pause between batches
      if (i + BATCH_SIZE < cardsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause between batches (reduced from 3s)
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    batchUpdateSnkrdunkProgress.completeSnkrdunkBatchUpdate();
    console.log(`[PersistentSnkrdunkBatchUpdate] Batch update completed (processed: ${cardsToUpdate.length})`);
  })();

  return { taskId, totalCards: cardsToUpdate.length, skippedCards: 0 };
}
