/**
 * eBay Browse API Service (Unified)
 * 
 * Uses eBay Browse API (OAuth 2.0) to search for active "Buy It Now" listings.
 * Replaces the old Finding API which had strict rate limits (5,000/day).
 * 
 * Browse API Documentation: https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search
 */

import { logPerformance } from "./performanceTracker";

// ─── OAuth Token Cache ───────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get eBay OAuth 2.0 Access Token (with caching)
 * Uses Client Credentials Grant Flow
 */
async function getEbayAccessToken(): Promise<string> {
  // Check if cached token is still valid (refresh 5 minutes early)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  console.log('[eBay Browse API] Fetching new OAuth Access Token...');

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error('EBAY_APP_ID or EBAY_CERT_ID not configured');
  }

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

  // Cache the token
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  console.log('[eBay Browse API] Access Token obtained successfully');
  return data.access_token;
}

// ─── Types ───────────────────────────────────────────────────────────

interface EbayListing {
  id: string;
  market: 'ebay';
  title: string;
  price: number;
  currency: string;
  image: string;
  productUrl: string;
  seller: {
    name: string;
    rating?: number;
  };
  grade: string;
  condition: string;
  lastUpdated: string;
}

interface EbaySearchParams {
  cardName: string;
  cardNumber?: string;
  series?: string;
}

interface BrowseApiResponse {
  total: number;
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
    thumbnailImages?: Array<{
      imageUrl: string;
    }>;
    condition?: string;
    conditionId?: string;
    seller?: {
      username: string;
      feedbackPercentage?: string;
      feedbackScore?: number;
    };
    buyingOptions?: string[];
  }>;
  warnings?: Array<{ message: string }>;
}

// ─── Main Search Function ────────────────────────────────────────────

/**
 * Fetch eBay listings using Browse API
 * 
 * @param params - Search parameters including card name, number, and series
 * @returns Array of formatted eBay listings
 */
export async function fetchEbayListings(params: EbaySearchParams): Promise<EbayListing[]> {
  const startTime = Date.now();
  let performanceLogged = false;
  const { cardName, cardNumber, series } = params;

  // Construct search query
  let searchQuery = `${cardName}`;
  if (cardNumber) {
    searchQuery += ` ${cardNumber}`;
  }
  if (series) {
    searchQuery += ` ${series}`;
  }

  console.log('[eBay Browse API] Searching for:', searchQuery);

  try {
    const accessToken = await getEbayAccessToken();

    // Build Browse API search URL
    const searchUrl = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    searchUrl.searchParams.set('q', searchQuery);
    searchUrl.searchParams.set('limit', '50');
    // Filter: Buy It Now only (no condition filter - PSA graded cards use conditionId 2750 "Graded")
    searchUrl.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');
    // Pokemon TCG category
    searchUrl.searchParams.set('category_ids', '183454');
    // Sort by price (lowest first)
    searchUrl.searchParams.set('sort', 'price');

    console.log('[eBay Browse API] Request URL:', searchUrl.toString());

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[eBay Browse API] API error response:', errorText);
      throw new Error(`eBay Browse API request failed: ${response.status} ${response.statusText}`);
    }

    const data: BrowseApiResponse = await response.json();
    
    const items = data.itemSummaries || [];
    console.log(`[eBay Browse API] Found ${data.total} total, returned ${items.length} listings`);

    // Format Browse API response to unified EbayListing format
    const listings: EbayListing[] = items.map((item) => {
      const price = parseFloat(item.price.value) || 0;
      const currency = item.price.currency || 'USD';
      const image = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '';
      const sellerName = item.seller?.username || 'Unknown';
      const sellerRating = item.seller?.feedbackScore || 0;
      const condition = item.condition || 'Used';

      return {
        id: `ebay-${item.itemId}`,
        market: 'ebay' as const,
        title: item.title,
        price,
        currency,
        image,
        productUrl: item.itemWebUrl,
        seller: {
          name: sellerName,
          rating: sellerRating,
        },
        grade: 'PSA 10',
        condition,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Filter out listings with invalid data
    const validListings = listings.filter(
      (listing) => listing.price > 0 && listing.productUrl
    );

    console.log(`[eBay Browse API] Returning ${validListings.length} valid listings`);

    // Log performance
    const responseTime = Date.now() - startTime;
    await logPerformance({
      source: 'ebay',
      operationType: 'single',
      status: 'success',
      responseTime,
      itemsProcessed: validListings.length,
    }).catch((e) => console.error('[eBay Browse API] Failed to log performance:', e));
    performanceLogged = true;

    return validListings;
  } catch (error: any) {
    console.error('[eBay Browse API] Error fetching listings:', error);

    // Log performance failure
    if (!performanceLogged) {
      const responseTime = Date.now() - startTime;
      await logPerformance({
        source: 'ebay',
        operationType: 'single',
        status: 'error',
        responseTime,
        itemsProcessed: 0,
        errorMessage: error.message || String(error),
      }).catch((e) => console.error('[eBay Browse API] Failed to log performance:', e));
    }

    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Test function to verify eBay Browse API integration
 */
export async function testEbayAPI() {
  try {
    console.log('[eBay Browse API] Testing API integration...');
    const results = await fetchEbayListings({
      cardName: 'Charizard ex',
      cardNumber: '110',
    });
    console.log(`[eBay Browse API] Test successful: ${results.length} listings found`);
    return results;
  } catch (error) {
    console.error('[eBay Browse API] Test failed:', error);
    throw error;
  }
}
