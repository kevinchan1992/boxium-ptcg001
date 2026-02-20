import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { searchEbayByImageWithHkd } from './ebayImageSearch';
import { searchEbayItems, convertUsdToHkd } from './ebay';
import { downloadAndEncodeImage, getBestImageUrl } from './imageUtils';

/**
 * Execute eBay batch update with persistent task tracking
 * This function runs in the background and survives page navigation
 */
export async function executePersistentEbayBatchUpdate(): Promise<{ taskId: number; totalCards: number }> {
  // Check if there's already a running task
  const hasRunning = await batchTaskManager.hasRunningTask('batch_ebay_update');
  if (hasRunning) {
    throw new Error('批量更新已在運行中');
  }

  // Get all unique cards from data sources
  const dataSourcesResult = await db.getDataSources();
  const dataSources = dataSourcesResult.data;
  const uniqueCards = new Map<number, { id: number; name: string }>();
  
  for (const source of dataSources) {
    if (source.card) {
      uniqueCards.set(source.card.id, {
        id: source.card.id,
        name: source.card.name,
      });
    }
  }

  const cardsToUpdate = Array.from(uniqueCards.values());
  console.log(`[PersistentEbayBatchUpdate] Starting batch update for ${cardsToUpdate.length} cards`);

  // Create persistent task
  const taskId = await batchTaskManager.createBatchTask('batch_ebay_update', cardsToUpdate.length);

  // Execute batch update in background (async IIFE)
  (async () => {
    for (const card of cardsToUpdate) {
      try {
        // Check if task is paused
        while (await batchTaskManager.isTaskPaused(taskId)) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Get full card info
        const fullCard = await db.getCardById(card.id);
        if (!fullCard) {
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, "卡牌不存在");
          continue;
        }

        // Simplify card name
        let simplifiedName = fullCard.name
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/[：:]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        // Build search query
        let searchQuery = simplifiedName;
        if (fullCard.cardNumber) {
          const coreCardNumber = fullCard.cardNumber.match(/\d+/)?.[0] || fullCard.cardNumber;
          searchQuery += ` ${coreCardNumber}`;
        }
        searchQuery += " PSA 10 Pokemon";

        let items: any[] = [];
        let searchMethod: 'image' | 'text' = 'text';
        const searchStartTime = Date.now();

        // Try image search first
        const imageUrl = getBestImageUrl(fullCard);
        if (imageUrl) {
          try {
            const base64Image = await downloadAndEncodeImage(imageUrl);
            if (base64Image) {
              const imageResults = await searchEbayByImageWithHkd(base64Image, convertUsdToHkd);
              if (imageResults && imageResults.length > 0) {
                items = imageResults;
                searchMethod = 'image';
                console.log(`[PersistentEbayBatchUpdate] Image search found ${items.length} items for ${fullCard.name}`);
              }
            }
          } catch (error: any) {
            console.error(`[PersistentEbayBatchUpdate] Image search failed for ${fullCard.name}: ${error.message}`);
          }
        }

        // Fallback to text search
        if (items.length === 0) {
          try {
            const textResults = await searchEbayItems(searchQuery);
            items = textResults;
            searchMethod = 'text';
            console.log(`[PersistentEbayBatchUpdate] Text search found ${items.length} items for ${fullCard.name}`);
          } catch (error: any) {
            console.error(`[PersistentEbayBatchUpdate] Text search failed for ${fullCard.name}: ${error.message}`);
          }
        }

        const searchDuration = Date.now() - searchStartTime;

        // Log search stats
        await db.addSearchStat({
          cardId: card.id,
          searchMethod,
          searchDuration,
          resultsCount: items.length,
          success: items.length > 0,
          errorMessage: items.length === 0 ? "未找到 eBay 商品" : undefined,
        });

        if (items.length === 0) {
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, "未找到 eBay 商品");
          continue;
        }

        // Save eBay data to priceHistory table
        let itemsAdded = 0;
        for (const item of items) {
          try {
            await db.addPriceHistory({
              cardId: card.id,
              source: 'ebay',
              price: item.priceHKD.toString(),
              currency: 'HKD',
              grade: 'PSA 10',
              listingUrl: item.itemWebUrl,
              soldAt: item.itemEndDate ? new Date(item.itemEndDate) : undefined,
            });
            itemsAdded++;
          } catch (error: any) {
            console.error(`[PersistentEbayBatchUpdate] Error adding eBay price: ${error.message}`);
          }
        }

        await batchTaskManager.updateTaskProgressSuccess(taskId, itemsAdded);
        console.log(`[PersistentEbayBatchUpdate] Updated card ${card.id}, added ${itemsAdded} records`);

        // Rate limiting: pause every 5 cards
        const progress = await batchTaskManager.getBatchTaskProgress(taskId);
        if (progress && progress.processedItems % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        console.error(`[PersistentEbayBatchUpdate] Error updating card ${card.id}: ${error.message}`);
        await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, error.message);
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    console.log(`[PersistentEbayBatchUpdate] Batch update completed`);
  })();

  return { taskId, totalCards: cardsToUpdate.length };
}
