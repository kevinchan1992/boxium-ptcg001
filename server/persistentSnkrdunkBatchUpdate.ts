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
  const allDataSourcesResult = await db.getDataSources();
  const snkrdunkSources = allDataSourcesResult.data.filter((ds: any) => ds.source === 'snkrdunk');
  
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

  // Execute batch update in background (async IIFE)
  (async () => {
    for (const card of cardsToUpdate) {
      try {
        // Check if task is paused
        while (await batchTaskManager.isTaskPaused(taskId)) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Check if task is cancelled (status = completed)
        const currentTask = await batchTaskManager.getBatchTaskProgress(taskId);
        if (!currentTask || currentTask.status === 'completed') {
          console.log(`[PersistentSnkrdunkBatchUpdate] Task ${taskId} cancelled, stopping`);
          return;
        }

        // Get card's SNKRDUNK data sources
        const cardDataSources = snkrdunkSources.filter((ds: any) => ds.cardId === card.id);
        if (cardDataSources.length === 0) {
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, "無 SNKRDUNK 數據源");
          continue;
        }

        // Use first data source URL
        const dataSource = cardDataSources[0];
        if (!dataSource.sourceUrl) {
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, "數據源 URL 為空");
          continue;
        }

        // Scrape SNKRDUNK page
        const scrapedData = await scrapeSnkrdunkPage(dataSource.sourceUrl);
        if (!scrapedData || !scrapedData.priceHistory || scrapedData.priceHistory.length === 0) {
          // This is a normal case: card has no price data on SNKRDUNK
          // Skip without counting as error
          await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
          console.log(`[PersistentSnkrdunkBatchUpdate] Card ${card.id} has no price data, skipping`);
          continue;
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

        // Rate limiting: pause every 3 cards
        const progress = await batchTaskManager.getBatchTaskProgress(taskId);
        if (progress && progress.processedItems % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`[PersistentSnkrdunkBatchUpdate] Error updating card ${card.id}: ${error.message}`);
        await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, error.message);
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    console.log(`[PersistentSnkrdunkBatchUpdate] Batch update completed`);
  })();

  return { taskId, totalCards: cardsToUpdate.length };
}
