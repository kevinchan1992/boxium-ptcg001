/**
 * SNKRDUNK HTTP API Service
 * 
 * Directly calls SNKRDUNK's internal REST API instead of using Playwright browser automation.
 * This approach is ~50-100x faster (0.2-0.5s vs 20-33s per request).
 * 
 * API endpoint (confirmed from browser network requests 2026-05-03):
 *   GET /v1/apparels/{apparelId}/used
 * 
 * Parameters:
 *   - perPage: number (items per page)
 *   - page: number (page number, 1-indexed)
 *   - order: string (empty = default sort)
 *   - withAllColors: boolean
 *   - isSaleOnly: boolean (true = only on-sale items)
 *   - conditionIds: number (-1 = all conditions)
 * 
 * Response: { apparelUsedItems: Array<ApparelUsedItem> }
 * Note: price is in JPY (integer), condition in displayShortConditionTitle
 */

import { convertToHKD } from "../utils/currency";
import { logPerformance } from "./performanceTracker";

const SNKRDUNK_API_BASE = "https://snkrdunk.com/v1";

interface SnkrdunkApiItem {
  id: number;
  price: number;                    // JPY integer, e.g. 2000
  commaPrice: string;               // e.g. "¥2,000"
  status: number;                   // 0 = on-sale
  statusText: string;               // e.g. "出品中/入札中"
  displayShortConditionTitle: string; // e.g. "PSA10", "A", "B", "C", "D"
  displayWearCount: string;         // same as displayShortConditionTitle
  wearCount: string;                // internal condition key
  primaryPhoto: { id: number; imageUrl: string } | null;
  isDisplaySold: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SnkrdunkApiResponse {
  apparelUsedItems: SnkrdunkApiItem[];
}

export interface SnkrdunkListing {
  url: string;
  listingId?: string; // Unique listing ID for deduplication
  price: number;
  currency: string;
  grade: string;
  image?: string;
  status?: 'on-sale' | 'sold';
}

/**
 * Convert JPY price to HKD via convertToHKD utility
 * SNKRDUNK API returns prices in JPY (integer)
 */
function parsePriceJPY(priceJPY: number): { amount: number; currency: string } {
  return { amount: priceJPY, currency: "JPY" };
}

/**
 * Fetch used listings from SNKRDUNK API for a specific apparel/card
 */
async function fetchSnkrdunkApiPage(
  snkrdunkId: string,
  options: {
    page?: number;
    perPage?: number;
    isSaleOnly?: boolean;
  } = {}
): Promise<SnkrdunkApiItem[]> {
  const {
    page = 1,
    perPage = 50,
    isSaleOnly = true,
  } = options;

  const url = new URL(`${SNKRDUNK_API_BASE}/apparels/${snkrdunkId}/used`);
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("order", "");
  url.searchParams.set("withAllColors", "false");
  url.searchParams.set("isSaleOnly", String(isSaleOnly));
  url.searchParams.set("conditionIds", "-1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ja,en;q=0.9",
      "Referer": `https://snkrdunk.com/apparels/${snkrdunkId}/used`,
      "Origin": "https://snkrdunk.com",
    },
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`SNKRDUNK API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as SnkrdunkApiResponse;
  return data.apparelUsedItems || [];
}

/**
 * Scrape SNKRDUNK listings using direct HTTP API calls
 * Uses the correct /v1/apparels/{id}/used endpoint discovered from browser network requests.
 * 
 * @param snkrdunkId - SNKRDUNK apparel ID (e.g., "753270")
 * @returns Array of all condition listings sorted by price (lowest first)
 */
export async function scrapeSnkrdunkListingsViaApi(
  snkrdunkId: string
): Promise<SnkrdunkListing[]> {
  const startTime = Date.now();
  
  console.log(`[SNKRDUNK API] Starting API fetch for SNKRDUNK ID: ${snkrdunkId}`);

  try {
    // Only fetch on-sale items - we only want to show items currently available for purchase
    const onSaleItems = await fetchSnkrdunkApiPage(snkrdunkId, { isSaleOnly: true, perPage: 50 });

    console.log(`[SNKRDUNK API] Fetched ${onSaleItems.length} on-sale items`);

    // Return ALL conditions (PSA 10, A, B, C, D, etc.) - frontend will filter
    const allItems = onSaleItems;

    console.log(`[SNKRDUNK API] All on-sale items: ${allItems.length}`);

    // Convert to unified listing format
    const listings: SnkrdunkListing[] = allItems.map((item) => {
      const { amount, currency } = parsePriceJPY(item.price);
      const priceInHKD = convertToHKD(amount, currency);

      // Normalize condition: PSA10 → PSA 10, A/B/C/D stay as-is
      const rawCondition = item.displayShortConditionTitle || item.displayWearCount || "";
      const grade = rawCondition.replace(/^PSA(\d)/, "PSA $1").replace(/^BGS(\d)/, "BGS $1");

      const listingId = String(item.id);
      return {
        url: `https://snkrdunk.com/apparels/${snkrdunkId}/used/${listingId}`,
        listingId, // Unique listing ID for deduplication
        price: priceInHKD,
        currency: "HKD",
        grade,
        image: item.primaryPhoto?.imageUrl || undefined,
        status: 'on-sale' as const,
      };
    });

    // Sort by price (lowest first)
    listings.sort((a, b) => a.price - b.price);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[SNKRDUNK API] Completed in ${elapsed}s: ${listings.length} listings (all conditions)`);

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
