/**
 * SNKRDUNK HTTP API Service
 * 
 * Directly calls SNKRDUNK's internal REST API instead of using Playwright browser automation.
 * This approach is ~50-100x faster (0.2-0.5s vs 20-33s per request).
 * 
 * API endpoint discovered from SNKRDUNK's Vue.js frontend bundle:
 *   GET /en/v1/trading-cards/{tradingCardId}/used-listings
 * 
 * Parameters:
 *   - perPage: number (items per page, max 50)
 *   - page: number (page number, 1-indexed)
 *   - sortType: 'latest' | 'priceAsc' | 'priceDesc'
 *   - isOnlyOnSale: boolean (true = only on-sale items, false = include sold)
 *   - conditionId: number (optional, filter by condition)
 * 
 * Response: { usedTradingCards: Array<UsedTradingCard> }
 */

import { convertToHKD } from "../utils/currency";
import { logPerformance } from "./performanceTracker";

const SNKRDUNK_API_BASE = "https://snkrdunk.com/en/v1";

interface SnkrdunkApiItem {
  id: number;
  tradingCardId: number;
  listingUID: string;
  price: string;         // e.g. "US $2271", "SG $3048", "HK $11999"
  condition: string;     // e.g. "PSA 10", "A", "B", "D", "BGS 9.5"
  thumbnailUrl: string;
  isNew: boolean;
  isSold: boolean;
}

interface SnkrdunkApiResponse {
  usedTradingCards: SnkrdunkApiItem[];
}

export interface SnkrdunkListing {
  url: string;
  price: number;
  currency: string;
  grade: string;
  image?: string;
  status?: 'on-sale' | 'sold';
}

/**
 * Parse price string from SNKRDUNK API response
 * Examples: "US $2271", "SG $3048", "HK $11,999", "$114"
 */
function parsePrice(priceStr: string): { amount: number; currency: string } {
  // Match currency prefix and amount
  const match = priceStr.match(/(?:(US|SG|HK)\s*)?\$([\d,]+)/);
  if (!match) {
    return { amount: 0, currency: "SGD" };
  }

  const prefix = match[1] || "";
  const amount = parseInt(match[2].replace(/,/g, ""), 10);

  let currency: string;
  switch (prefix) {
    case "US":
      currency = "USD";
      break;
    case "SG":
      currency = "SGD";
      break;
    case "HK":
      currency = "HKD";
      break;
    default:
      // No prefix defaults to SGD (SNKRDUNK is Singapore-based for EN site)
      currency = "SGD";
      break;
  }

  return { amount, currency };
}

/**
 * Fetch used listings from SNKRDUNK API for a specific trading card
 */
async function fetchSnkrdunkApiPage(
  snkrdunkId: string,
  options: {
    page?: number;
    perPage?: number;
    sortType?: string;
    isOnlyOnSale?: boolean;
  } = {}
): Promise<SnkrdunkApiItem[]> {
  const {
    page = 1,
    perPage = 50,
    sortType = "latest",
    isOnlyOnSale = true,
  } = options;

  const url = new URL(`${SNKRDUNK_API_BASE}/trading-cards/${snkrdunkId}/used-listings`);
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sortType", sortType);
  url.searchParams.set("isOnlyOnSale", String(isOnlyOnSale));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": `https://snkrdunk.com/en/trading-cards/${snkrdunkId}/used`,
    },
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`SNKRDUNK API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as SnkrdunkApiResponse;
  return data.usedTradingCards || [];
}

/**
 * Scrape SNKRDUNK PSA 10 listings using direct HTTP API calls
 * Replaces the Playwright-based scraper for dramatically improved performance.
 * 
 * @param snkrdunkId - SNKRDUNK product ID (e.g., "737036")
 * @returns Array of PSA 10 listings sorted by price (lowest first)
 */
export async function scrapeSnkrdunkListingsViaApi(
  snkrdunkId: string
): Promise<SnkrdunkListing[]> {
  const startTime = Date.now();
  
  console.log(`[SNKRDUNK API] Starting API fetch for SNKRDUNK ID: ${snkrdunkId}`);

  try {
    // Fetch both on-sale and sold items in parallel
    const [onSaleItems, allItems] = await Promise.all([
      fetchSnkrdunkApiPage(snkrdunkId, { isOnlyOnSale: true, perPage: 50 }),
      fetchSnkrdunkApiPage(snkrdunkId, { isOnlyOnSale: false, perPage: 50 }),
    ]);

    console.log(`[SNKRDUNK API] Fetched ${onSaleItems.length} on-sale + ${allItems.length} all items`);

    // Merge and deduplicate by listingUID
    const seen = new Set<string>();
    const mergedItems: (SnkrdunkApiItem & { status: 'on-sale' | 'sold' })[] = [];

    // On-sale items first (they take priority)
    for (const item of onSaleItems) {
      if (!seen.has(item.listingUID)) {
        seen.add(item.listingUID);
        mergedItems.push({ ...item, status: 'on-sale' as const });
      }
    }

    // Then add sold items from the "all" list
    for (const item of allItems) {
      if (!seen.has(item.listingUID)) {
        seen.add(item.listingUID);
        mergedItems.push({
          ...item,
          status: item.isSold ? 'sold' as const : 'on-sale' as const,
        });
      }
    }

    // Filter PSA 10 only
    const psa10Items = mergedItems.filter(
      (item) => item.condition === "PSA 10" || item.condition === "PSA10"
    );

    console.log(`[SNKRDUNK API] After dedup: ${mergedItems.length} total, ${psa10Items.length} PSA 10`);

    // Convert to unified listing format
    const listings: SnkrdunkListing[] = psa10Items.map((item) => {
      const { amount, currency } = parsePrice(item.price);
      const priceInHKD = convertToHKD(amount, currency);

      return {
        url: `https://snkrdunk.com/en/trading-cards/used/listings/${item.listingUID}`,
        price: priceInHKD,
        currency: "HKD",
        grade: item.condition,
        image: item.thumbnailUrl || undefined,
        status: item.status,
      };
    });

    // Sort by price (lowest first)
    listings.sort((a, b) => a.price - b.price);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[SNKRDUNK API] Completed in ${elapsed}s: ${listings.length} PSA 10 listings`);

    if (listings.length > 0) {
      const minPrice = Math.min(...listings.map((l) => l.price));
      const maxPrice = Math.max(...listings.map((l) => l.price));
      const onSaleCount = listings.filter((l) => l.status === "on-sale").length;
      const soldCount = listings.filter((l) => l.status === "sold").length;
      console.log(`[SNKRDUNK API] Price range: HKD ${minPrice.toFixed(2)} - HKD ${maxPrice.toFixed(2)}`);
      console.log(`[SNKRDUNK API] Status: ${onSaleCount} on-sale, ${soldCount} sold`);
    }

    // Log performance
    await logPerformance({
      source: "snkrdunk",
      operationType: "single",
      status: "success",
      responseTime: Date.now() - startTime,
      itemsProcessed: listings.length,
    }).catch((e) =>
      console.error("[SNKRDUNK API] Failed to log performance:", e)
    );

    return listings;
  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[SNKRDUNK API] ERROR after ${elapsed}s:`, error.message);

    // Log performance failure
    await logPerformance({
      source: "snkrdunk",
      operationType: "single",
      status: error.name === "TimeoutError" ? "timeout" : "error",
      responseTime: Date.now() - startTime,
      itemsProcessed: 0,
      errorMessage: error.message,
    }).catch((e) =>
      console.error("[SNKRDUNK API] Failed to log performance:", e)
    );

    throw error;
  }
}
