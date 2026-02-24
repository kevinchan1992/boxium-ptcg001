/**
 * 生產環境調用開發環境爬蟲服務
 * 
 * 功能：
 * - 調用開發環境的 /api/dev/scrape API
 * - 實施重試機制（處理沙盒休眠）
 * - 實施超時控制
 */

interface DevScraperResponse {
  success: boolean;
  snkrdunkId: string;
  listings: any[];
  scrapedAt: string;
  totalListings: number;
  error?: string;
}

/**
 * 調用開發環境爬取 SNKRDUNK 數據
 * @param snkrdunkId SNKRDUNK 卡牌 ID
 * @returns 爬取結果
 * @throws Error 如果開發環境未配置或爬取失敗
 */
export async function fetchFromDevEnv(snkrdunkId: string): Promise<DevScraperResponse> {
  const DEV_SCRAPER_URL = process.env.DEV_SCRAPER_URL;
  const DEV_SCRAPER_API_KEY = process.env.DEV_SCRAPER_API_KEY;

  // 檢查環境變量
  if (!DEV_SCRAPER_URL || !DEV_SCRAPER_API_KEY) {
    throw new Error('Dev scraper not configured (missing DEV_SCRAPER_URL or DEV_SCRAPER_API_KEY)');
  }

  // 第一次嘗試
  try {
    console.log(`[DevScraper] Fetching ${snkrdunkId} from dev environment...`);
    const response = await fetchWithTimeout(`${DEV_SCRAPER_URL}/api/dev/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEV_SCRAPER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ snkrdunkId })
    }, 35000); // 35秒超時

    if (!response.ok) {
      throw new Error(`Dev scraper HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Scraping failed');
    }

    console.log(`[DevScraper] Success: ${result.totalListings} listings for ${snkrdunkId}`);
    return result;
  } catch (error) {
    // 第一次失敗，可能是沙盒休眠，等待 5 秒後重試
    console.log(`[DevScraper] First attempt failed, retrying in 5 seconds...`, error);
    await sleep(5000);

    try {
      const response = await fetchWithTimeout(`${DEV_SCRAPER_URL}/api/dev/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DEV_SCRAPER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ snkrdunkId })
      }, 35000);

      if (!response.ok) {
        throw new Error(`Dev scraper HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Scraping failed');
      }

      console.log(`[DevScraper] Retry success: ${result.totalListings} listings for ${snkrdunkId}`);
      return result;
    } catch (retryError) {
      console.error(`[DevScraper] Retry failed for ${snkrdunkId}:`, retryError);
      throw retryError;
    }
  }
}

/**
 * 檢查開發環境健康狀態
 * @returns 是否健康
 */
export async function checkDevEnvHealth(): Promise<boolean> {
  const DEV_SCRAPER_URL = process.env.DEV_SCRAPER_URL;
  
  if (!DEV_SCRAPER_URL) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(`${DEV_SCRAPER_URL}/api/dev/health`, {
      method: 'GET'
    }, 5000);
    
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 帶超時的 fetch
 */
function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout)
  });
}

/**
 * 延遲函數
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
