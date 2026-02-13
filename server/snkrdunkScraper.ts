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
    grade?: string;
  }>;
}

/**
 * Extract SNKRDUNK product ID from URL
 * Example: https://snkrdunk.com/apparels/455596#1 → 455596
 */
export function extractSnkrdunkId(url: string): string | null {
  const match = url.match(/\/apparels\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Scrape SNKRDUNK page using Axios + Cheerio
 */
export async function scrapeSnkrdunkPage(url: string): Promise<SnkrdunkCardData> {
  try {
    // Fetch HTML content with proper headers to avoid bot detection
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 30000, // 30 seconds timeout
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Extract card name (Japanese) from meta tags or title
    const nameJa = $('meta[property="og:title"]').attr("content") || 
                   $("title").text().split("｜")[0].trim() ||
                   $("h1").first().text().trim() ||
                   "Unknown Card";

    // Extract English name if available (usually in parentheses)
    const nameEnMatch = nameJa.match(/\(([^)]+)\)/);
    const nameEn = nameEnMatch ? nameEnMatch[1] : nameJa;

    // Extract image URL from meta tags
    const imageUrl = $('meta[property="og:image"]').attr("content") ||
                     $('meta[name="twitter:image"]').attr("content") ||
                     $(".product-image img").first().attr("src") ||
                     null;

    // Extract product ID from URL to fetch price history via API
    const productId = extractSnkrdunkId(url);
    const priceHistory = productId ? await fetchPriceHistoryFromApi(productId) : [];

    return {
      name: nameEn,
      nameJa,
      imageUrl,
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
export async function fetchPriceHistoryFromApi(productId: string): Promise<Array<{
  price: number;
  currency: string;
  soldAt: Date;
  grade?: string;
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
    }> = [];

    // Parse API response
    if (data.history && Array.isArray(data.history)) {
      for (const item of data.history) {
        priceHistory.push({
          price: item.price,
          currency: "JPY",
          soldAt: parseJapaneseDate(item.date),
          grade: item.condition || undefined,
        });
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
export async function updatePriceHistoryOnly(url: string): Promise<Array<{
  price: number;
  currency: string;
  soldAt: Date;
  grade?: string;
}>> {
  const productId = extractSnkrdunkId(url);
  if (!productId) {
    throw new Error("Invalid SNKRDUNK URL: Cannot extract product ID");
  }
  
  return await fetchPriceHistoryFromApi(productId);
}
