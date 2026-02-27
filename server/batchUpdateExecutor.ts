/**
 * 批量更新執行器
 * 用於排程任務和手動觸發的批量更新
 * 
 * [eBay cleanup] executeEbayBatchUpdate 已移除，僅保留 SNKRDUNK 批量更新
 * 支持 single_card 和 sealed_product 兩種產品類型
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
    
    // Group by productId and productType
    const uniqueProducts = new Map<string, { id: number; name: string; productType: string }>();
    
    for (const source of snkrdunkSources) {
      const productType = source.productType || 'single_card';
      const key = `${productType}:${source.cardId}`;
      
      if (source.card) {
        uniqueProducts.set(key, {
          id: source.card.id,
          name: source.card.name,
          productType,
        });
      } else if (productType === 'sealed_product') {
        // For sealed products, card join might return null since they're in sealedProducts table
        // We need to fetch the sealed product name separately
        const sealedProduct = await db.getSealedProductById(source.cardId);
        if (sealedProduct) {
          uniqueProducts.set(key, {
            id: sealedProduct.id,
            name: sealedProduct.name,
            productType,
          });
        }
      }
    }

    const productsToUpdate = Array.from(uniqueProducts.values());
    console.log(`[SnkrdunkBatchUpdate] Processing ${productsToUpdate.length} products (cards + sealed products)`);

    for (const product of productsToUpdate) {
      try {
        // 獲取該產品的 SNKRDUNK 數據源
        const productDataSources = snkrdunkSources.filter(ds => {
          const dsProductType = ds.productType || 'single_card';
          return ds.cardId === product.id && dsProductType === product.productType;
        });
        
        if (productDataSources.length === 0) {
          failureCount++;
          continue;
        }

        // 使用第一個數據源的 URL
        const dataSource = productDataSources[0];
        const url = dataSource.sourceUrl;

        // 爬取 SNKRDUNK 頁面
        const cardData = await scrapeSnkrdunkPage(url);

        // 根據產品類型更新不同的表
        if (product.productType === 'sealed_product') {
          // 更新卡盒產品資訊
          await db.updateSealedProduct(product.id, {
            name: cardData.name,
            nameJa: cardData.nameJa,
            imageUrl: cardData.imageUrl || undefined,
          });
        } else {
          // 更新單卡資訊
          await db.updateCard(product.id, {
            name: cardData.name,
            nameJa: cardData.nameJa,
            imageUrl: cardData.imageUrl || undefined,
          });
        }

        // 儲存價格歷史
        let recordsAdded = 0;
        for (const priceEntry of cardData.priceHistory) {
          const priceHkd = convertJpyToHkd(priceEntry.price);
          await db.addPriceHistory({
            cardId: product.id,
            source: "snkrdunk",
            price: priceHkd.toString(),
            currency: "HKD",
            grade: product.productType === 'sealed_product' ? undefined : priceEntry.grade,
            quantity: product.productType === 'sealed_product' ? (priceEntry.grade || undefined) : undefined,
            productType: product.productType as 'single_card' | 'sealed_product',
            soldAt: priceEntry.soldAt,
            listingUrl: url,
          });
          recordsAdded++;
        }

        // 更新所有該產品的 SNKRDUNK 數據源狀態
        for (const ds of productDataSources) {
          await db.updateDataSourceFetchStatus(ds.id, "success");
        }

        successCount++;
        totalRecordsAdded += recordsAdded;
        console.log(`[SnkrdunkBatchUpdate] Updated ${product.productType} ${product.id}, added ${recordsAdded} records`);

        // 每處理 3 個產品暫停 2 秒，避免 API 限制
        if (successCount % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`[SnkrdunkBatchUpdate] Error updating ${product.productType} ${product.id}: ${error.message}`);
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
