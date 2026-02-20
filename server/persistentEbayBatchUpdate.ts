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
  const { data: dataSources } = await db.getDataSources({ pageSize: 100000 });
  const uniqueCards = new Map<number, { id: number; name: string }>();
  
  for (const source of dataSources as any[]) {
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
        console.log(`[PersistentEbayBatchUpdate] Task ${taskId} cancelled, stopping...`);
        return;
      }
      
      console.log(`[PersistentEbayBatchUpdate] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cardsToUpdate.length / BATCH_SIZE)} (${batch.length} cards)`);
      
      // Process batch in parallel
      await Promise.all(batch.map(async (card) => {
        try {

          // Get full card info
          const fullCard = await db.getCardById(card.id);
          if (!fullCard) {
            // 卡牙不存在是數據問題，不計入錯誤
            await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
            return;
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
            // 未找到 eBay 商品是正常情況，不計入錯誤
            await batchTaskManager.updateTaskProgressSuccess(taskId, 0);
            return;
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
        } catch (error: any) {
          console.error(`[PersistentEbayBatchUpdate] Error updating card ${card.id}: ${error.message}`);
          await batchTaskManager.updateTaskProgressFailure(taskId, card.id, card.name, error.message);
        }
      }));
      
      // Rate limiting: pause between batches
      if (i + BATCH_SIZE < cardsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second pause between batches
      }
    }

    // Complete task
    await batchTaskManager.completeTask(taskId, 'completed');
    console.log(`[PersistentEbayBatchUpdate] Batch update completed`);
  })();

  return { taskId, totalCards: cardsToUpdate.length };
}
