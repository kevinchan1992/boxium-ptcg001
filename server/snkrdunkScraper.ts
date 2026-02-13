/**
 * SNKRDUNK Scraper Service
 * Uses Firecrawl MCP to extract card data from SNKRDUNK pages
 */

import { exec } from "child_process";
import { promisify } from "util";
import { scrapeWithBrowser } from "./browserScraper";

const execAsync = promisify(exec);

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
 * Scrape SNKRDUNK page using browser scraper (axios + cheerio)
 * Note: manus-mcp-cli is not available in production, so we use browser scraper directly
 */
export async function scrapeSnkrdunkPage(url: string): Promise<SnkrdunkCardData> {
  try {
    console.log(`[Scraper] Scraping ${url} using browser scraper`);
    
    const { markdown, metadata } = await scrapeWithBrowser(url);
    
    console.log(`[Scraper] Successfully scraped ${url}`);

    // Extract card name (Japanese)
    const nameMatch = markdown.match(/# (.+)\n\n(.+)\n\n/);
    const nameJa = nameMatch ? nameMatch[1].trim() : "Unknown Card";
    const nameEn = nameMatch ? nameMatch[2].trim() : "";

    // Extract image URL from metadata
    const imageUrl = metadata?.ogImage || metadata?.["twitter:image"] || null;

    // Parse price history from markdown
    const priceHistory = parsePriceHistory(markdown);

    console.log(`[Scraper] Extracted ${priceHistory.length} price records`);

    return {
      name: nameEn || nameJa,
      nameJa,
      imageUrl,
      priceHistory,
    };
  } catch (error) {
    console.error(`[Scraper] Failed to scrape ${url}:`, error);
    throw new Error(`Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse price history from SNKRDUNK markdown
 * Extracts data from "最近の売買履歴" section
 */
export function parsePriceHistory(markdown: string): Array<{
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

  // Find the price history section
  const historySection = markdown.match(/## 最近の売買履歴[\s\S]+?(?=##|$)/);
  if (!historySection) {
    return priceHistory;
  }

  const historyText = historySection[0];

  // Extract each transaction line
  // Format 1 (relative time): "41分前\n\nA\n\n¥53,500"
  // Format 2 (absolute date): "2026/02/08\n\nPSA10\n\n¥78,000"
  
  // Pattern 1: Relative time (分前, 時間前, 日前)
  const relativePattern = /(\d+(?:分|時間|日)前)\n+([A-Z0-9\s以下]+)\n+¥([\d,]+)/g;
  let match;

  while ((match = relativePattern.exec(historyText)) !== null) {
    const timeAgo = match[1];
    const grade = match[2].trim();
    const priceStr = match[3].replace(/,/g, "");
    const price = parseInt(priceStr, 10);

    if (isNaN(price)) continue;

    // Convert time ago to Date
    const soldAt = parseTimeAgo(timeAgo);

    priceHistory.push({
      price,
      currency: "JPY",
      soldAt,
      grade: grade || undefined,
    });
  }

  // Pattern 2: Absolute date (YYYY/MM/DD)
  const absolutePattern = /(\d{4}\/\d{2}\/\d{2})\n+([A-Z0-9\s]+)\n+¥([\d,]+)/g;
  
  while ((match = absolutePattern.exec(historyText)) !== null) {
    const dateStr = match[1];
    const grade = match[2].trim();
    const priceStr = match[3].replace(/,/g, "");
    const price = parseInt(priceStr, 10);

    if (isNaN(price)) continue;

    // Parse absolute date
    const soldAt = parseAbsoluteDate(dateStr);

    priceHistory.push({
      price,
      currency: "JPY",
      soldAt,
      grade: grade || undefined,
    });
  }

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
 * Parse absolute date string to Date
 * Example: "2026/02/08" → Date object for Feb 8, 2026
 */
function parseAbsoluteDate(dateStr: string): Date {
  // dateStr format: YYYY/MM/DD
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    return new Date();
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(parts[2], 10);
  
  return new Date(year, month, day);
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
