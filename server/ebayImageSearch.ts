/**
 * eBay Image Search API integration
 * Uses eBay Browse API's searchByImage method
 */

import axios from "axios";

// eBay API credentials from environment variables
const EBAY_APP_ID = process.env.EBAY_APP_ID || "";
const EBAY_CERT_ID = process.env.EBAY_CERT_ID || "";

// eBay OAuth token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get eBay OAuth access token using Client Credentials Grant
 * @returns OAuth access token
 */
async function getEbayAccessToken(): Promise<string> {
  // Return cached token if still valid
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) {
    console.log("[eBay OAuth] Using cached access token");
    return cachedToken;
  }

  try {
    console.log("[eBay OAuth] Requesting new access token...");
    
    const credentials = Buffer.from(`${EBAY_APP_ID}:${EBAY_CERT_ID}`).toString('base64');
    
    const response = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    cachedToken = response.data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    tokenExpiry = now + (response.data.expires_in - 300) * 1000;
    
    console.log("[eBay OAuth] Successfully obtained access token");
    return cachedToken!;
  } catch (error: any) {
    console.error("[eBay OAuth] Error obtaining access token:", error.message);
    throw new Error(`Failed to obtain eBay access token: ${error.message}`);
  }
}

/**
 * Search eBay items using image (Base64 encoded)
 * @param base64Image - Base64 encoded image string
 * @param categoryId - Optional eBay category ID to narrow search
 * @param limit - Maximum number of results to return (default: 20)
 * @returns Array of eBay item summaries
 */
export async function searchEbayByImage(
  base64Image: string,
  categoryId?: string,
  limit: number = 20
): Promise<any[]> {
  try {
    console.log(`[eBay Image Search] Searching with image (Base64 length: ${base64Image.length})`);
    
    // Get OAuth access token
    const accessToken = await getEbayAccessToken();
    
    // Build query parameters
    const params: any = {
      limit: limit,
    };
    
    if (categoryId) {
      params.category_ids = categoryId;
    }
    
    // Call eBay searchByImage API
    const response = await axios.post(
      'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image',
      {
        image: base64Image,
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        params: params,
        timeout: 30000, // 30 seconds timeout
      }
    );

    const items = response.data.itemSummaries || [];
    console.log(`[eBay Image Search] Found ${items.length} items`);
    
    return items;
  } catch (error: any) {
    console.error(`[eBay Image Search] Error: ${error.message}`);
    if (error.response) {
      console.error(`[eBay Image Search] API Response:`, error.response.data);
    }
    throw new Error(`eBay image search failed: ${error.message}`);
  }
}

/**
 * Search eBay items using image with price conversion to HKD
 * @param base64Image - Base64 encoded image string
 * @param convertUsdToHkd - Function to convert USD to HKD
 * @param categoryId - Optional eBay category ID to narrow search
 * @param limit - Maximum number of results to return (default: 20)
 * @returns Array of eBay items with prices converted to HKD
 */
export async function searchEbayByImageWithHkd(
  base64Image: string,
  convertUsdToHkd: (usd: number) => Promise<number>,
  categoryId?: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const items = await searchEbayByImage(base64Image, categoryId, limit);
    
    // Convert prices to HKD
    const itemsWithHkd = [];
    for (const item of items) {
      try {
        const usdPrice = parseFloat(item.price?.value || "0");
        const hkdPrice = await convertUsdToHkd(usdPrice);
        
        itemsWithHkd.push({
          ...item,
          priceHkd: hkdPrice,
        });
      } catch (error: any) {
        console.error(`[eBay Image Search] Error converting price: ${error.message}`);
        // Skip items with price conversion errors
      }
    }
    
    console.log(`[eBay Image Search] Converted ${itemsWithHkd.length} items to HKD`);
    return itemsWithHkd;
  } catch (error: any) {
    console.error(`[eBay Image Search] Error with HKD conversion: ${error.message}`);
    throw error;
  }
}
