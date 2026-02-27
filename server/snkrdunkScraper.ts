/**
 * SNKRDUNK Scraper Service
 * Uses Axios + Cheerio to extract card data from SNKRDUNK pages
 */

import axios from "axios";
import * as cheerio from "cheerio";

export interface SnkrdunkCardData {
  name: string;
  nameJa: string;
  imageUrl: string | null;
  priceHistory: Array<{
    price: number;
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
}> {
  try {
    const apiUrl = `https://snkrdunk.com/v1/apparels/${productId}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": `https://snkrdunk.com/apparels/${productId}`,
      },
      timeout: 15000,
    });

    const data = response.data;
    
    return {
      name: data.name || "Unknown Card",
      nameJa: data.localizedName || data.name || "Unknown Card",
      imageUrl: data.primaryMedia?.imageUrl || null,
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
 * Fetch price history from SNKRDUNK API
 * API endpoint: /v1/apparels/{id}/sales-history
 */
export async function fetchPriceHistoryFromApi(productId: string, productType: "single_card" | "sealed_product" = "single_card"): Promise<Array<{
  price: number;
  currency: string;
  soldAt: Date;
  grade?: string;
  quantity?: string;
}>> {
  try {
    const apiUrl = `https://snkrdunk.com/v1/apparels/${productId}/sales-history?size_id=0&page=1&per_page=100`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": `https://snkrdunk.com/apparels/${productId}`,
      },
      timeout: 15000,
    });

    const data = response.data;
    const priceHistory: Array<{
      price: number;
      currency: string;
      soldAt: Date;
      grade?: string;
      quantity?: string;
    }> = [];

    // Parse API response
    if (data.history && Array.isArray(data.history)) {
      for (const item of data.history) {
        const record: {
          price: number;
          currency: string;
          soldAt: Date;
          grade?: string;
          quantity?: string;
        } = {
          price: item.price,
          currency: "JPY",
          soldAt: parseJapaneseDate(item.date),
        };
        
        // For single cards: store grade (e.g., "PSA 10", "中古")
        // For sealed products: store quantity (e.g., "10盒", "1盒")
        if (productType === "single_card") {
          record.grade = item.condition || undefined;
        } else {
          record.quantity = item.condition || undefined; // "condition" field contains quantity for sealed products
        }
        
        priceHistory.push(record);
      }
    }

    return priceHistory;
  } catch (error: any) {
    console.error("Error fetching price history from API:", error.message);
    // Return empty array if API fails, don't throw error
    return [];
  }
}

/**
 * Parse Japanese date string to Date object
 * Examples: "2025/12/10" → Date object
 */
function parseJapaneseDate(dateStr: string): Date {
  // Format: YYYY/MM/DD
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  
  return new Date();
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
 */
export async function fetchPriceHistory(url: string, productType: "single_card" | "sealed_product" = "single_card"): Promise<Array<{
  price: number;
  currency: string;
  soldAt: Date;
  grade?: string;
  quantity?: string;
}>> {
  const productId = extractSnkrdunkId(url);
  if (!productId) {
    throw new Error("Invalid SNKRDUNK URL: Cannot extract product ID");
  }
  
  return await fetchPriceHistoryFromApi(productId, productType);
}
