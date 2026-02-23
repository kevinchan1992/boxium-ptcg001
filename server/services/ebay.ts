/**
 * eBay Browse API Service
 * 
 * This service integrates with eBay Finding API to search for active "Buy It Now" listings
 * for Pokemon TCG cards with PSA 10 grading.
 * 
 * API Documentation: https://developer.ebay.com/devzone/finding/callref/findItemsAdvanced.html
 */

import { logPerformance } from "./performanceTracker";

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

/**
 * Fetch eBay listings for a Pokemon TCG card with PSA 10 grading
 * 
 * @param params - Search parameters including card name, number, and series
 * @returns Array of formatted eBay listings
 */
export async function fetchEbayListings(params: EbaySearchParams): Promise<EbayListing[]> {
  const startTime = Date.now();
  let performanceLogged = false;
  const { cardName, cardNumber, series } = params;

  // Construct search query
  // Example: "Charizard ex 110 PSA 10"
  let searchQuery = `${cardName}`;
  if (cardNumber) {
    searchQuery += ` ${cardNumber}`;
  }
  if (series) {
    searchQuery += ` ${series}`;
  }
  searchQuery += ' PSA 10';

  console.log('[eBay Service] Searching for:', searchQuery);

  try {
    // Get eBay App ID from environment
    const ebayAppId = process.env.EBAY_APP_ID;
    if (!ebayAppId) {
      throw new Error('EBAY_APP_ID environment variable is not set');
    }

    // eBay Finding API endpoint (correct format)
    const apiUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
    
    // Construct URL with query parameters
    const url = new URL(apiUrl);
    url.searchParams.append('OPERATION-NAME', 'findItemsAdvanced');
    url.searchParams.append('SERVICE-VERSION', '1.0.0');
    url.searchParams.append('SECURITY-APPNAME', ebayAppId);
    url.searchParams.append('RESPONSE-DATA-FORMAT', 'JSON');
    url.searchParams.append('keywords', searchQuery);
    url.searchParams.append('paginationInput.entriesPerPage', '50');
    
    // Filter for "Buy It Now" listings only
    url.searchParams.append('itemFilter(0).name', 'ListingType');
    url.searchParams.append('itemFilter(0).value', 'FixedPrice');
    
    // Filter for Pokemon TCG category
    url.searchParams.append('categoryId', '183454');
    
    // Sort by price (lowest first)
    url.searchParams.append('sortOrder', 'PricePlusShippingLowest');

    console.log('[eBay Service] API URL:', url.toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[eBay Service] API error response:', errorText);
      throw new Error(`eBay API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[eBay Service] API response:', JSON.stringify(data).substring(0, 500));
    
    // Parse eBay API response
    const searchResult = data.findItemsAdvancedResponse?.[0];
    if (!searchResult) {
      console.error('[eBay Service] Invalid API response structure');
      return [];
    }

    const ack = searchResult.ack?.[0];
    if (ack !== 'Success') {
      console.error('[eBay Service] API returned non-success ack:', ack);
      if (searchResult.errorMessage) {
        console.error('[eBay Service] Error message:', searchResult.errorMessage);
      }
      return [];
    }

    const items = searchResult.searchResult?.[0]?.item || [];
    console.log(`[eBay Service] Found ${items.length} listings`);

    // Format eBay listings to unified format
    const listings: EbayListing[] = items.map((item: any) => {
      const itemId = item.itemId?.[0] || '';
      const title = item.title?.[0] || '';
      const price = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0');
      const currency = item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'USD';
      const image = item.galleryURL?.[0] || item.pictureURLLarge?.[0] || '';
      const productUrl = item.viewItemURL?.[0] || '';
      const sellerName = item.sellerInfo?.[0]?.sellerUserName?.[0] || 'Unknown';
      const sellerRating = parseInt(item.sellerInfo?.[0]?.feedbackScore?.[0] || '0');
      const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown';

      return {
        id: `ebay-${itemId}`,
        market: 'ebay',
        title,
        price,
        currency,
        image,
        productUrl,
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

    console.log(`[eBay Service] Returning ${validListings.length} valid listings`);
    
    // Log performance
    const responseTime = Date.now() - startTime;
    await logPerformance({
      source: 'ebay',
      operationType: 'single',
      status: 'success',
      responseTime,
      itemsProcessed: validListings.length
    }).catch(e => console.error('[eBay Service] Failed to log performance:', e));
    performanceLogged = true;
    
    return validListings;
  } catch (error: any) {
    console.error('[eBay Service] Error fetching listings:', error);
    
    // Log performance failure
    if (!performanceLogged) {
      const responseTime = Date.now() - startTime;
      await logPerformance({
        source: 'ebay',
        operationType: 'single',
        status: 'error',
        responseTime,
        itemsProcessed: 0,
        errorMessage: error.message || String(error)
      }).catch(e => console.error('[eBay Service] Failed to log performance:', e));
    }
    
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Test function to verify eBay API integration
 */
export async function testEbayAPI() {
  try {
    console.log('[eBay Service] Testing API integration...');
    const results = await fetchEbayListings({
      cardName: 'Charizard ex',
      cardNumber: '110',
    });
    console.log(`[eBay Service] Test successful: ${results.length} listings found`);
    return results;
  } catch (error) {
    console.error('[eBay Service] Test failed:', error);
    throw error;
  }
}
