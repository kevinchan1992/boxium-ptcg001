/**
 * 批量更新執行器
 * 用於排程任務和手動觸發的批量更新
 * 
 * [eBay cleanup] executeEbayBatchUpdate 已移除，僅保留 SNKRDUNK 批量更新
 */

import * as db from "./db";
import { scrapeSnkrdunkPage, convertJpyToHkd } from "./snkrdunkScraper";

export interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  totalRecordsAdded: number;
}

/**
 * 執行 SNKRDUNK 批量更新
 */
export async function executeSnkrdunkBatchUpdate(): Promise<BatchUpdateResult> {
  let successCount = 0;
  let failureCount = 0;
  let totalRecordsAdded = 0;

  try {
    // 獲取所有 SNKRDUNK 數據源的唯一卡牌
    const { data: dataSources } = await db.getDataSources({ pageSize: 100000 });
    const snkrdunkSources = dataSources.filter((ds: any) => ds.source === "snkrdunk");
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
    console.log(`[SnkrdunkBatchUpdate] Processing ${cardsToUpdate.length} cards`);

    for (const card of cardsToUpdate) {
      try {
        // 獲取該卡牌的 SNKRDUNK 數據源
        const cardDataSources = snkrdunkSources.filter(ds => ds.cardId === card.id);
        if (cardDataSources.length === 0) {
          failureCount++;
          continue;
        }

        // 使用第一個數據源的 URL
        const dataSource = cardDataSources[0];
        const url = dataSource.sourceUrl;

        // 爬取 SNKRDUNK 頁面
        const cardData = await scrapeSnkrdunkPage(url);

        // 更新卡牌資訊
        await db.updateCard(card.id, {
          name: cardData.name,
          nameJa: cardData.nameJa,
          imageUrl: cardData.imageUrl || undefined,
        });

        // 儲存價格歷史
        let recordsAdded = 0;
        for (const priceEntry of cardData.priceHistory) {
          const priceHkd = convertJpyToHkd(priceEntry.price);
          await db.addPriceHistory({
            cardId: card.id,
            source: "snkrdunk",
            price: priceHkd.toString(),
            currency: "HKD",
            grade: priceEntry.grade,
            soldAt: priceEntry.soldAt,
            listingUrl: url,
          });
          recordsAdded++;
        }

        // 更新所有該卡牌的 SNKRDUNK 數據源狀態
        for (const ds of cardDataSources) {
          await db.updateDataSourceFetchStatus(ds.id, "success");
        }

        successCount++;
        totalRecordsAdded += recordsAdded;
        console.log(`[SnkrdunkBatchUpdate] Updated card ${card.id}, added ${recordsAdded} records`);

        // 每處理 3 張卡片暫停 2 秒，避免 API 限制
        if (successCount % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`[SnkrdunkBatchUpdate] Error updating card ${card.id}: ${error.message}`);
        failureCount++;
      }
    }

    console.log(`[SnkrdunkBatchUpdate] Completed: ${successCount} success, ${failureCount} failures, ${totalRecordsAdded} records added`);
    return { successCount, failureCount, totalRecordsAdded };
  } catch (error: any) {
    console.error(`[SnkrdunkBatchUpdate] Fatal error: ${error.message}`);
    throw error;
  }
}
