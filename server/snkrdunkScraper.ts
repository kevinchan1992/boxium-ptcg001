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

    // Parse price history from the table
    const priceHistory = parsePriceHistoryFromHtml($);

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
 * Parse price history from SNKRDUNK HTML
 * Extracts data from "最近の売買履歴" section
 */
export function parsePriceHistoryFromHtml($: cheerio.CheerioAPI): Array<{
  price: number;
  currency: string;
  soldAt: Date;
  grade?: string;
}> {
  const priceHistory: Array<{
    price: number;
    currency: string;
    soldAt: Date;
    grade?: string;
  }> = [];

  // Find all transaction rows in the price history section
  // SNKRDUNK uses a table or list structure for price history
  $("table tr, .price-history-item, .transaction-item").each((_, element) => {
    const $row = $(element);
    
    // Extract time ago (e.g., "41分前", "4時間前", "1日前")
    const timeText = $row.find("td:nth-child(1), .time, .date").text().trim();
    
    // Extract grade (e.g., "A", "PSA10", "PSA9")
    const gradeText = $row.find("td:nth-child(2), .grade, .condition").text().trim();
    
    // Extract price (e.g., "¥53,500", "¥78,000")
    const priceText = $row.find("td:nth-child(3), .price, .amount").text().trim();
    
    // Parse price
    const priceMatch = priceText.match(/¥([\d,]+)/);
    if (!priceMatch) return;
    
    const price = parseInt(priceMatch[1].replace(/,/g, ""), 10);
    if (isNaN(price)) return;
    
    // Parse time ago
    const soldAt = parseTimeAgo(timeText);
    
    priceHistory.push({
      price,
      currency: "JPY",
      soldAt,
      grade: gradeText || undefined,
    });
  });

  return priceHistory;
}

/**
 * Convert Japanese time ago string to Date
 * Examples: "41分前" → 41 minutes ago, "4時間前" → 4 hours ago, "1日前" → 1 day ago
 */
function parseTimeAgo(timeAgo: string): Date {
  const now = new Date();

  if (timeAgo.includes("分前")) {
    const minutes = parseInt(timeAgo.replace("分前", ""), 10);
    return new Date(now.getTime() - minutes * 60 * 1000);
  } else if (timeAgo.includes("時間前")) {
    const hours = parseInt(timeAgo.replace("時間前", ""), 10);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  } else if (timeAgo.includes("日前")) {
    const days = parseInt(timeAgo.replace("日前", ""), 10);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return now;
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
