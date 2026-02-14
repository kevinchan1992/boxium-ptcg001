/**
 * 圖片處理工具模組
 * 提供圖片下載、Base64 轉換等功能
 */

/**
 * 從 URL 下載圖片並轉換為 Base64 編碼
 * @param imageUrl 圖片 URL
 * @returns Base64 編碼的圖片字符串
 */
export async function downloadAndEncodeImage(imageUrl: string): Promise<string> {
  try {
    console.log(`[ImageUtils] 開始下載圖片: ${imageUrl}`);
    
    // 下載圖片
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15000), // 15 秒超時
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 轉換為 Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 轉換為 Base64
    const base64 = buffer.toString('base64');
    
    console.log(`[ImageUtils] 圖片下載成功，大小: ${buffer.length} bytes`);
    
    return base64;
  } catch (error) {
    console.error(`[ImageUtils] 圖片下載失敗: ${imageUrl}`, error);
    throw new Error(`Failed to download and encode image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 驗證 URL 是否為有效的圖片 URL
 * @param url URL 字符串
 * @returns 是否為有效的圖片 URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    
    // 檢查常見圖片副檔名
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    return imageExtensions.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * 從卡牌對象中獲取最佳圖片 URL
 * @param card 卡牌對象
 * @returns 最佳圖片 URL，優先使用高解析度圖片
 */
export function getBestImageUrl(card: { imageUrl?: string | null; imageUrlHiRes?: string | null }): string | null {
  // 優先使用高解析度圖片
  if (card.imageUrlHiRes && isValidImageUrl(card.imageUrlHiRes)) {
    return card.imageUrlHiRes;
  }
  
  // 回退到標準圖片
  if (card.imageUrl && isValidImageUrl(card.imageUrl)) {
    return card.imageUrl;
  }
  
  return null;
}
