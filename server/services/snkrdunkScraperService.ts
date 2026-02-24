/**
 * 統一的 SNKRDUNK 爬取服務
 * 
 * 功能：
 * - 開發環境：直接使用 Playwright 爬取
 * - 生產環境：調用開發環境 API
 * - 自動判斷環境並選擇最佳方式
 */

import { scrapeSnkrdunkListings as playwrightScrape } from './snkrdunkPlaywright';
import { fetchFromDevEnv } from './devEnvScraper';

interface SnkrdunkListing {
  price: number;
  currency: string;
  grade: string;
  url: string;
  image?: string;
}

/**
 * 爬取 SNKRDUNK 商品列表
 * 
 * 根據環境自動選擇爬取方式：
 * - 開發環境：直接使用 Playwright
 * - 生產環境：調用開發環境 API
 * 
 * @param snkrdunkId SNKRDUNK 卡牌 ID
 * @returns 商品列表
 */
export async function scrapeSnkrdunkListings(snkrdunkId: string): Promise<SnkrdunkListing[]> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // 開發環境：直接使用 Playwright
    console.log(`[SNKRDUNK Service] Development mode: using Playwright directly`);
    return await playwrightScrape(snkrdunkId);
  } else {
    // 生產環境：調用開發環境 API
    console.log(`[SNKRDUNK Service] Production mode: calling dev environment API`);
    
    try {
      const result = await fetchFromDevEnv(snkrdunkId);
      return result.listings;
    } catch (error) {
      console.error(`[SNKRDUNK Service] Failed to fetch from dev environment:`, error);
      
      // 如果開發環境不可用，拋出錯誤
      // 調用方會使用快取降級
      throw new Error(`Dev environment unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * 檢查 SNKRDUNK 爬取服務是否可用
 * 
 * @returns 是否可用
 */
export async function isSnkrdunkScraperAvailable(): Promise<boolean> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // 開發環境：Playwright 總是可用
    return true;
  } else {
    // 生產環境：檢查開發環境健康狀態
    const { checkDevEnvHealth } = await import('./devEnvScraper');
    return await checkDevEnvHealth();
  }
}
