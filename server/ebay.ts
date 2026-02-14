/**
 * eBay Browse API 整合模組
 * 用於搜尋活躍的 Buy It Now 商品作為市場參考價
 */

interface EbaySearchResult {
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
  condition?: string;
  seller?: {
    username: string;
    feedbackPercentage: string;
  };
}

interface EbaySearchResponse {
  total: number;
  itemSummaries?: EbaySearchResult[];
  warnings?: Array<{
    message: string;
  }>;
}

/**
 * 獲取 eBay OAuth Access Token
 * 使用 Client Credentials Grant Flow
 */
async function getEbayAccessToken(appId: string, certId: string): Promise<string> {
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
    throw new Error(`Failed to get eBay access token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * 搜尋 eBay 活躍商品（使用 Browse API）
 * @param query 搜尋關鍵字（例如：卡牌名稱 + PSA 10）
 * @param limit 返回結果數量（默認 10）
 */
export async function searchEbayItems(
  query: string,
  limit: number = 10
): Promise<EbaySearchResult[]> {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error('EBAY_APP_ID or EBAY_CERT_ID not configured');
  }

  // 獲取 Access Token
  const accessToken = await getEbayAccessToken(appId, certId);

  // 構建搜尋 URL
  const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('limit', limit.toString());
  // 只搜尋 Buy It Now 商品
  searchUrl.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');
  // 只搜尋 Used 狀態（評級卡牌通常是 Used）
  searchUrl.searchParams.set('filter', 'conditions:{USED}');
  // 按價格排序
  searchUrl.searchParams.set('sort', 'price');

  const response = await fetch(searchUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', // 美國市場
    },
  });

  if (!response.ok) {
    throw new Error(`eBay API error: ${response.statusText}`);
  }

  const data: EbaySearchResponse = await response.json();

  return data.itemSummaries || [];
}

/**
 * USD → HKD 貨幣換算
 * 使用 ExchangeRate-API（免費，無需 API Key）
 */
export async function convertUsdToHkd(usdAmount: number): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      // 如果 API 失敗，使用固定匯率作為後備（1 USD = 7.8 HKD）
      console.warn('Failed to fetch exchange rate, using fallback rate');
      return usdAmount * 7.8;
    }

    const data = await response.json();
    const hkdRate = data.rates.HKD;

    return usdAmount * hkdRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // 使用固定匯率作為後備
    return usdAmount * 7.8;
  }
}

/**
 * 獲取當前 USD → HKD 匯率
 */
export async function getUsdToHkdRate(): Promise<number> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      return 7.8; // 後備匯率
    }

    const data = await response.json();
    return data.rates.HKD;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 7.8; // 後備匯率
  }
}
