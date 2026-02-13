import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 使用 Firecrawl MCP 工具抓取 SNKRDUNK 列表頁
 */
export async function scrapeSnkrdunkListPage(page: number): Promise<string[]> {
  const url = `https://snkrdunk.com/apparel-categories/25?isSaleOnly=false&department_name=hobby&itemCondition=new&brand_id=pokemon&page=${page}`;
  console.log(`[scrapeSnkrdunkListPage] Fetching URL: ${url}`);
  
  try {
    const command = `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '{"url": "${url}", "formats": ["html"], "waitFor": 3000}'`;
    const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer
    
    // 解析輸出，提取 JSON 結果文件路徑
    const match = stdout.match(/Tool execution result saved to: (.+\.json)/);
    if (!match) {
      throw new Error("Failed to find result file path");
    }
    
    const resultFilePath = match[1];
    
    // 讀取結果文件
    const { stdout: jsonContent } = await execAsync(`cat ${resultFilePath}`);
    const result = JSON.parse(jsonContent);
    
    if (!result.html) {
      throw new Error("No HTML content in result");
    }
    
    // 從 HTML 中提取卡牌 ID
    const cardIds = extractCardIdsFromHtml(result.html);
    
    // 轉換為完整 URL
    const urls = cardIds.map(id => `https://snkrdunk.com/apparels/${id}#1`);
    
    return urls;
  } catch (error) {
    console.error(`Error scraping page ${page}:`, error);
    throw error;
  }
}

/**
 * 從 HTML 中提取卡牌 ID
 */
function extractCardIdsFromHtml(html: string): string[] {
  const regex = /\/apparels\/(\d+)/g;
  const ids = new Set<string>();
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  
  return Array.from(ids);
}

/**
 * 抓取多頁列表
 */
export async function scrapeSnkrdunkPages(
  startPage: number,
  endPage: number,
  onProgress?: (current: number, total: number, urls: string[]) => void
): Promise<string[]> {
  const allUrls: string[] = [];
  const total = endPage - startPage + 1;
  
  console.log(`[scrapeSnkrdunkPages] Starting to scrape pages ${startPage} to ${endPage} (total: ${total} pages)`);
  
  for (let page = startPage; page <= endPage; page++) {
    try {
      console.log(`[scrapeSnkrdunkPages] Scraping page ${page}/${endPage}...`);
      const urls = await scrapeSnkrdunkListPage(page);
      console.log(`[scrapeSnkrdunkPages] Page ${page} returned ${urls.length} URLs`);
      allUrls.push(...urls);
      
      if (onProgress) {
        onProgress(page - startPage + 1, total, urls);
      }
      
      // 延遲 1 秒避免請求過快
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[scrapeSnkrdunkPages] Failed to scrape page ${page}:`, error);
      // 繼續處理下一頁
    }
  }
  
  console.log(`[scrapeSnkrdunkPages] Completed scraping ${total} pages, total URLs before dedup: ${allUrls.length}`);
  
  // 去重
  const uniqueUrls = Array.from(new Set(allUrls));
  console.log(`[scrapeSnkrdunkPages] After deduplication: ${uniqueUrls.length} unique URLs`);
  
  return uniqueUrls;
}

/**
 * 抓取所有 1575 頁
 */
export async function scrapeAllSnkrdunkPages(
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  return scrapeSnkrdunkPages(1, 1575, (current, total, urls) => {
    console.log(`Scraped page ${current}/${total}, found ${urls.length} cards`);
    if (onProgress) {
      onProgress(current, total);
    }
  });
}
