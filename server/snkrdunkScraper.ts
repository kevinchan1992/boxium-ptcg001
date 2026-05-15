/**
 * SNKRDUNK Scraper Service
 * Uses Axios + Cheerio to extract card data from SNKRDUNK pages
 */

import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

// Disable HTTP Keep-Alive to prevent stale TLS connections after Cloud Run restarts.
// Without this, axios reuses TCP connections that become invalid after instance restart,
// causing 'Client network socket disconnected before secure TLS connection was established'.
const noKeepAliveAgent = new https.Agent({ keepAlive: false });

export interface SnkrdunkCardData {
  name: string;
  nameJa: string;
  imageUrl: string | null;
  styleCode?: string | null; // スタイルコード (e.g., "pkmn-tcg-M2")
  priceHistory: Array<{
    price: number;     // Original JPY price
    jpyPrice: number;  // Same as price (JPY) - kept for clarity
    currency: string;
    soldAt: Date;
    grade?: string; // For single cards (e.g., "PSA 10", "中古")
    quantity?: string; // For sealed products (e.g., "10盒", "1盒")
  }>;
}

/**
 * Extract SNKRDUNK product ID from URL
 * Supports both /apparels/ and /trading-cards/ paths
 * Examples:
 *   https://snkrdunk.com/apparels/455596#1 → 455596
 *   https://snkrdunk.com/en/trading-cards/91520/used?sort=latest → 91520
 */
export function extractSnkrdunkId(url: string): string | null {
  // Try /trading-cards/ path first (newer format)
  let match = url.match(/\/trading-cards\/(\d+)/);
  if (match) return match[1];
  
  // Fallback to /apparels/ path (older format)
  match = url.match(/\/apparels\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch card details from SNKRDUNK API
 * API endpoint: /v1/apparels/{id}
 */
export async function fetchCardDetailsFromApi(productId: string): Promise<{
  name: string;
  nameJa: string;
  imageUrl: string | null;
  styleCode: string | null;
}> {
  try {
    const apiUrl = `https://snkrdunk.com/v1/apparels/${productId}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": `https://snkrdunk.com/apparels/${productId}`,
        "Connection": "close",
      },
      httpsAgent: noKeepAliveAgent,
      timeout: 15000,
    });

    const data = response.data;
    
    return {
      name: data.name || "Unknown Card",
      nameJa: data.localizedName || data.name || "Unknown Card",
      imageUrl: data.primaryMedia?.imageUrl || null,
      styleCode: data.productNumber || null, // スタイルコード (e.g., "pkmn-tcg-M2")
    };
  } catch (error: any) {
    console.error("Error fetching card details from API:", error.message);
    throw new Error(`Failed to fetch card details: ${error.message}`);
  }
}

/**
 * Scrape SNKRDUNK page using API
 */
export async function scrapeSnkrdunkPage(url: string, productType: "single_card" | "sealed_product" = "single_card"): Promise<SnkrdunkCardData> {
  try {
    // Extract product ID from URL
    const productId = extractSnkrdunkId(url);
    if (!productId) {
      throw new Error("Invalid SNKRDUNK URL: Cannot extract product ID");
    }

    // Fetch card details from API
    const cardDetails = await fetchCardDetailsFromApi(productId);
    
    // Fetch price history from API
    const priceHistory = await fetchPriceHistoryFromApi(productId, productType);

    return {
      name: cardDetails.name,
      nameJa: cardDetails.nameJa,
      imageUrl: cardDetails.imageUrl,
      styleCode: cardDetails.styleCode,
      priceHistory,
    };
  } catch (error: any) {
    console.error("Error scraping SNKRDUNK page:", error);
    
    // Provide more detailed error messages
    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout: SNKRDUNK server took too long to respond");
    } else if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error("Network error: Unable to reach SNKRDUNK server");
    } else {
      throw new Error(error.message || String(error));
    }
  }
}

/**
 * Parse Japanese date string to Date object, returning both a stable soldAt (date-only)
 * and an estimatedSoldAt (precise timestamp for relative-time records).
 *
 * For absolute dates ("YYYY/MM/DD") and day-relative ("N日前"):
 *   soldAt = UTC midnight of that date (stable, timezone-independent)
 *   estimatedSoldAt = same as soldAt
 *
 * For hour-relative ("N時間前"):
 *   soldAt = UTC midnight of the estimated JST date (for display/grouping)
 *   estimatedSoldAt = crawlTime - N hours (precise timestamp, used for dynamic dedup window)
 *
 * @param dateStr  Raw date string from SNKRDUNK API
 * @param crawlTime  The moment this batch fetch started (captured once per fetchPriceHistoryFromApi call)
 */
function parseJapaneseDateWithMeta(dateStr: string, crawlTime: Date): { soldAt: Date; estimatedSoldAt: Date } {
  // Format 1: YYYY/MM/DD (absolute date)
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    return { soldAt: d, estimatedSoldAt: d };
  }

  // Format 2: "N日前" (N days ago)
  const daysAgoMatch = dateStr.match(/(\d+)日前/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const crawlJst = new Date(crawlTime.getTime() + jstOffsetMs);
    const targetJst = new Date(crawlJst.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const d = new Date(Date.UTC(targetJst.getUTCFullYear(), targetJst.getUTCMonth(), targetJst.getUTCDate(), 0, 0, 0, 0));
    return { soldAt: d, estimatedSoldAt: d };
  }

  // Format 3: "N時間前" (N hours ago) — relative-time record
  // estimatedSoldAt = precise timestamp (crawlTime - N hours)
  // soldAt = UTC midnight of the estimated JST date (for display grouping)
  const hoursAgoMatch = dateStr.match(/(\d+)時間前/);
  if (hoursAgoMatch) {
    const hoursAgo = parseInt(hoursAgoMatch[1], 10);
    const estimatedSoldAt = new Date(crawlTime.getTime() - hoursAgo * 60 * 60 * 1000);
    // Convert to JST date for the date-only soldAt
    const jstOffsetMs = 9 * 60 * 60 * 1000;
    const estimatedJst = new Date(estimatedSoldAt.getTime() + jstOffsetMs);
    const soldAt = new Date(Date.UTC(estimatedJst.getUTCFullYear(), estimatedJst.getUTCMonth(), estimatedJst.getUTCDate(), 0, 0, 0, 0));
    return { soldAt, estimatedSoldAt };
  }

  // Fallback: treat as today
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const crawlJst = new Date(crawlTime.getTime() + jstOffsetMs);
  const d = new Date(Date.UTC(crawlJst.getUTCFullYear(), crawlJst.getUTCMonth(), crawlJst.getUTCDate(), 0, 0, 0, 0));
  return { soldAt: d, estimatedSoldAt: d };
}

/**
 * Fetch price history from SNKRDUNK API
 * API endpoint: /v1/apparels/{id}/sales-history
 */
export async function fetchPriceHistoryFromApi(productId: string, productType: "single_card" | "sealed_product" = "single_card", options?: { timeout?: number; throwOnError?: boolean }): Promise<Array<{
  price: number;    // Original JPY price (used as-is for jpyPrice)
  jpyPrice: number; // Same as price - explicit JPY value for deduplication
  currency: string;
  soldAt: Date;
  isRelativeTime?: boolean; // true if date was "N時間前" (relative hours), needs dynamic dedup
  estimatedSoldAt?: Date;   // Precise estimated timestamp for relative-time records
  grade?: string;
  quantity?: string;
}>> {
  const timeout = options?.timeout || 15000;
  const throwOnError = options?.throwOnError || false;
  const PER_PAGE = 100;
  const MAX_PAGES = 20; // Safety cap: max 2000 records per card
  // Record crawl time ONCE at the start of this fetch, so all relative-time calculations
  // within this batch use the same reference point (avoids drift across pages).
  const crawlTime = new Date();
  const priceHistory: Array<{
    price: number;
    jpyPrice: number;
    currency: string;
    soldAt: Date;
    isRelativeTime?: boolean;
    estimatedSoldAt?: Date;
    grade?: string;
    quantity?: string;
  }> = [];

  try {
    // Paginate through ALL pages to capture every transaction
    for (let page = 1; page <= MAX_PAGES; page++) {
      const apiUrl = `https://snkrdunk.com/v1/apparels/${productId}/sales-history?size_id=0&page=${page}&per_page=${PER_PAGE}`;
      
      const response = await axios.get(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "Referer": `https://snkrdunk.com/apparels/${productId}`,
          "Connection": "close",
        },
        httpsAgent: noKeepAliveAgent,
        timeout,
      });
      const data = response.data;

      // No more pages if history is empty or missing
      if (!data.history || !Array.isArray(data.history) || data.history.length === 0) {
        break;
      }

      // Parse each record on this page
      for (const item of data.history) {
        // Detect relative-time records ("N時間前") before parsing
        const isRelativeTime = /\d+時間前/.test(item.date);
        const { soldAt, estimatedSoldAt } = parseJapaneseDateWithMeta(item.date, crawlTime);
        const record: {
          price: number;
          jpyPrice: number;
          currency: string;
          soldAt: Date;
          isRelativeTime?: boolean;
          estimatedSoldAt?: Date;
          grade?: string;
          quantity?: string;
        } = {
          price: item.price,       // Original JPY price
          jpyPrice: item.price,    // Store JPY for stable deduplication (unaffected by exchange rate)
          currency: "JPY",
          soldAt,
          ...(isRelativeTime ? { isRelativeTime: true, estimatedSoldAt } : {}),
        };
        
        // For single cards: store grade from "condition" field (e.g., "PSA 10", "中古")
        // For sealed products: store quantity from "size" field (e.g., "3個", "10個")
        if (productType === "single_card") {
          record.grade = item.condition || undefined;
        } else {
          record.quantity = item.size || undefined; // "size" field contains quantity for sealed products (e.g., "3個")
        }
        
        priceHistory.push(record);
      }

      // If fewer than PER_PAGE records returned, this is the last page
      if (data.history.length < PER_PAGE) {
        break;
      }
    }
    return priceHistory;
  } catch (error: any) {
    console.error("Error fetching price history from API:", error.message);
    if (throwOnError) {
      // Re-throw with categorized error info for batch processing
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
      const enhancedError = new Error(isTimeout ? `Timeout after ${timeout}ms` : `HTTP error: ${error.message}`);
      (enhancedError as any).isTimeout = isTimeout;
      (enhancedError as any).statusCode = error.response?.status;
      throw enhancedError;
    }
    // Return partial results if we already fetched some pages before the error
    return priceHistory.length > 0 ? priceHistory : [];
  }
}

/** @deprecated Use parseJapaneseDateWithMeta instead */
function parseJapaneseDate(dateStr: string): Date {
  return parseJapaneseDateWithMeta(dateStr, new Date()).soldAt;
}

/**
 * Convert JPY to HKD (approximate rate, should be updated regularly)
 */
export function convertJpyToHkd(jpy: number): number {
  const rate = 0.055; // Approximate rate, should fetch from API
  return Math.round(jpy * rate * 100) / 100;
}

/**
 * Convert JPY to TWD (approximate rate, should be updated regularly)
 */
export function convertJpyToTwd(jpy: number): number {
  const rate = 0.22; // Approximate rate, should fetch from API
  return Math.round(jpy * rate * 100) / 100;
}

/**
 * Update price history only (without re-scraping card data)
 * This function is optimized for scheduled updates where card info doesn't change
 * 
 * Returns the same type as fetchPriceHistoryFromApi, including jpyPrice for stable deduplication.
 * jpyPrice is the original JPY price, unaffected by exchange rate fluctuations.
 */
export async function fetchPriceHistory(url: string, productType: "single_card" | "sealed_product" = "single_card"): Promise<Array<{
  price: number;     // Original JPY price
  jpyPrice: number;  // Same as price - explicit JPY value for deduplication
  currency: string;
  soldAt: Date;
  isRelativeTime?: boolean;
  estimatedSoldAt?: Date;
  grade?: string;
  quantity?: string;
}>> {
  const productId = extractSnkrdunkId(url);
  if (!productId) {
    throw new Error("Invalid SNKRDUNK URL: Cannot extract product ID");
  }
  
  return await fetchPriceHistoryFromApi(productId, productType);
}
