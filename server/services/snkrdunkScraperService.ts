/**
 * 統一的 SNKRDUNK 爬取服務
 * 
 * 策略優先級：
 * 1. HTTP API（最快，~0.2-0.5s）- 直接調用 SNKRDUNK 內部 REST API
 * 2. Playwright（降級方案，~20-33s）- 當 API 不可用時使用瀏覽器自動化
 * 3. Dev Environment API（生產環境降級）- 調用開發環境的 Playwright
 */

import { scrapeSnkrdunkListingsViaApi } from './snkrdunkApi';
import { scrapeSnkrdunkListings as playwrightScrape } from './snkrdunkPlaywright';
import { fetchFromDevEnv } from './devEnvScraper';

interface SnkrdunkListing {
  price: number;
  currency: string;
  grade: string;
  url: string;
  listingId?: string; // Unique listing ID for individual product URL
  image?: string;
  status?: 'on-sale' | 'sold';
}

/**
 * 爬取 SNKRDUNK 商品列表
 * 
 * 優先使用 HTTP API（速度最快），失敗時降級到 Playwright 或 Dev Environment API
 * 
 * @param snkrdunkId SNKRDUNK 卡牌 ID
 * @returns 商品列表
 */
export async function scrapeSnkrdunkListings(snkrdunkId: string): Promise<SnkrdunkListing[]> {
  // Strategy 1: Try HTTP API first (fastest, ~0.2-0.5s)
  try {
    console.log(`[SNKRDUNK Service] Trying HTTP API for ID: ${snkrdunkId}`);
    const listings = await scrapeSnkrdunkListingsViaApi(snkrdunkId);
    console.log(`[SNKRDUNK Service] HTTP API success: ${listings.length} listings`);
    return listings;
  } catch (apiError) {
    console.warn(`[SNKRDUNK Service] HTTP API failed:`, apiError instanceof Error ? apiError.message : apiError);
  }

  // Strategy 2: Fall back based on environment
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Development: fall back to Playwright
    console.log(`[SNKRDUNK Service] Falling back to Playwright for ID: ${snkrdunkId}`);
    try {
      return await playwrightScrape(snkrdunkId);
    } catch (playwrightError) {
      console.error(`[SNKRDUNK Service] Playwright also failed:`, playwrightError instanceof Error ? playwrightError.message : playwrightError);
      throw new Error(`All SNKRDUNK scraping methods failed for ID ${snkrdunkId}`);
    }
  } else {
    // Production: fall back to dev environment API
    console.log(`[SNKRDUNK Service] Falling back to dev environment API for ID: ${snkrdunkId}`);
    try {
      const result = await fetchFromDevEnv(snkrdunkId);
      return result.listings;
    } catch (devEnvError) {
      console.error(`[SNKRDUNK Service] Dev environment API also failed:`, devEnvError instanceof Error ? devEnvError.message : devEnvError);
      throw new Error(`All SNKRDUNK scraping methods failed for ID ${snkrdunkId}`);
    }
  }
}

/**
 * 檢查 SNKRDUNK 爬取服務是否可用
 * 
 * @returns 是否可用
 */
export async function isSnkrdunkScraperAvailable(): Promise<boolean> {
  // HTTP API is always available (no browser dependency)
  return true;
}
