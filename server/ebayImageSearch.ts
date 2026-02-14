/**
 * eBay Image Search API 模組
 * 提供 eBay searchByImage API 調用功能
 */

// OAuth Token 緩存
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * 獲取 eBay OAuth 2.0 Access Token
 * @returns Access Token
 */
export async function getEbayAccessToken(): Promise<string> {
  // 檢查緩存的 token 是否仍然有效（提前 5 分鐘刷新）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    console.log('[eBay Image Search] 使用緩存的 Access Token');
    return cachedToken.token;
  }

  console.log('[eBay Image Search] 獲取新的 Access Token');

  try {
    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (!appId || !certId) {
      throw new Error('eBay API credentials not configured');
    }

    // 使用 Client Credentials Grant 獲取 token
    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay OAuth failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    // 緩存 token
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    console.log('[eBay Image Search] Access Token 獲取成功');
    return data.access_token;
  } catch (error) {
    console.error('[eBay Image Search] 獲取 Access Token 失敗:', error);
    throw error;
  }
}

/**
 * eBay searchByImage API 響應類型
 */
interface EbayImageSearchResponse {
  itemSummaries?: Array<{
    itemId: string;
    title: string;
    price: {
      value: string;
      currency: string;
    };
    itemWebUrl: string;
    image?: {
      imageUrl: string;
    };
  }>;
  total?: number;
}

/**
 * 使用圖片搜尋 eBay 商品
 * @param base64Image Base64 編碼的圖片
 * @param categoryId 可選的類別 ID
 * @param limit 返回結果數量限制
 * @returns eBay 商品列表
 */
export async function searchEbayByImage(
  base64Image: string,
  categoryId?: string,
  limit: number = 20
): Promise<EbayImageSearchResponse> {
  try {
    console.log('[eBay Image Search] 開始圖片搜尋');
    
    const accessToken = await getEbayAccessToken();

    // 構建請求 URL
    let url = `https://api.ebay.com/buy/browse/v1/item_summary/search_by_image?limit=${limit}`;
    if (categoryId) {
      url += `&category_ids=${categoryId}`;
    }

    // 調用 searchByImage API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      body: JSON.stringify({
        image: base64Image,
      }),
      signal: AbortSignal.timeout(30000), // 30 秒超時
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay searchByImage failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as EbayImageSearchResponse;
    
    console.log(`[eBay Image Search] 圖片搜尋成功，找到 ${data.total || 0} 個商品`);
    
    return data;
  } catch (error) {
    console.error('[eBay Image Search] 圖片搜尋失敗:', error);
    throw error;
  }
}

/**
 * 使用圖片搜尋 eBay 商品並轉換價格為 HKD
 * @param base64Image Base64 編碼的圖片
 * @param convertUsdToHkd USD 轉 HKD 的函數
 * @param categoryId 可選的類別 ID
 * @param limit 返回結果數量限制
 * @returns eBay 商品列表（價格已轉換為 HKD）
 */
export async function searchEbayByImageWithHkd(
  base64Image: string,
  convertUsdToHkd: (usdPrice: number) => Promise<number>,
  categoryId?: string,
  limit: number = 20
): Promise<Array<{ price: number; currency: string; url: string; soldAt: number }>> {
  const searchResult = await searchEbayByImage(base64Image, categoryId, limit);

  if (!searchResult.itemSummaries || searchResult.itemSummaries.length === 0) {
    return [];
  }

  // 轉換價格為 HKD
  const items = await Promise.all(
    searchResult.itemSummaries.map(async (item) => {
      try {
        const usdPrice = parseFloat(item.price.value);
        const hkdPrice = await convertUsdToHkd(usdPrice);

        return {
          price: hkdPrice,
          currency: 'HKD',
          url: item.itemWebUrl,
          soldAt: Date.now(),
        };
      } catch (error) {
        console.error(`[eBay Image Search] 價格轉換失敗: ${item.itemId}`, error);
        return null;
      }
    })
  );

  // 過濾掉轉換失敗的商品
  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}
