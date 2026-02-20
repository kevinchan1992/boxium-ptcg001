import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { scrapeSnkrdunkPage, convertJpyToHkd } from './snkrdunkScraper';

/**
 * Execute SNKRDUNK batch update with persistent task tracking
 * This function runs in the background and survives page navigation
 */
export async function executePersistentSnkrdunkBatchUpdate(): Promise<{ taskId: number; totalCards: number }> {
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

  const cardsToUpdate = Array.from(uniqueCards.values());
  console.log(`[PersistentSnkrdunkBatchUpdate] Starting batch update for ${cardsToUpdate.length} cards`);

  // Create persistent task
  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', cardsToUpdate.length);

  // Execute batch update in background (async IIFE) with parallel processing
  (async () => {
    const BATCH_SIZE = 50; // Process 50 cards in parallel
    
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
      
      // Process batch in parallel
      await Promise.all(batch.map(async (card) => {
        try {

          // Get card's SNKRDUNK data sources
          const cardDataSources = snkrdunkSources.filter((ds: any) => ds.cardId === card.id);
          if (cardDataSources.length === 0) {
            // 無數據源不計入錯誤，跳過
            await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
            return;
          }

          // Use first data source URL
          const dataSource = cardDataSources[0];
          if (!dataSource.sourceUrl) {
            // URL 為空不計入錯誤，跳過
            await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
            return;
          }

          // Scrape SNKRDUNK page
          const scrapedData = await scrapeSnkrdunkPage(dataSource.sourceUrl);
          if (!scrapedData || !scrapedData.priceHistory || scrapedData.priceHistory.length === 0) {
            // 沒有價格數據是正常情況，不計入錯誤
            await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
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
          console.log(`[PersistentSnkrdunkBatchUpdate] Updated card ${card.id}, added ${recordsAdded} records`);
        } catch (error: any) {
          console.error(`[PersistentSnkrdunkBatchUpdate] Error updating card ${card.id}: ${error.message}`);
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, error.message);
        }
      }));
      
      // Rate limiting: pause between batches
      if (i + BATCH_SIZE < cardsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second pause between batches (SNKRDUNK needs more delay)
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    console.log(`[PersistentSnkrdunkBatchUpdate] Batch update completed`);
  })();

  return { taskId, totalCards: cardsToUpdate.length };
}
