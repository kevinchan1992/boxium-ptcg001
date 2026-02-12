/**
 * SNKRDUNK Scraper Service
 * Uses Firecrawl MCP to extract card data from SNKRDUNK pages
 */

import { exec } from "child_process";
import { promisify } from "util";

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
 * Scrape SNKRDUNK page using Firecrawl MCP
 */
export async function scrapeSnkrdunkPage(url: string): Promise<SnkrdunkCardData> {
  try {
    // Call Firecrawl MCP via manus-mcp-cli
    const command = `manus-mcp-cli tool call firecrawl_scrape --server firecrawl --input '${JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    })}'`;

    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes("Tool execution result saved")) {
      throw new Error(`Firecrawl error: ${stderr}`);
    }

    // Parse the JSON output
    const resultMatch = stdout.match(/Tool execution result:\n({[\s\S]+})/);
    if (!resultMatch) {
      throw new Error("Failed to parse Firecrawl output");
    }

    const result = JSON.parse(resultMatch[1]);
    const markdown = result.markdown;

    if (!markdown) {
      throw new Error("No markdown content returned from Firecrawl");
    }

    // Extract card name (Japanese)
    const nameMatch = markdown.match(/# (.+)\n\n(.+)\n\n/);
    const nameJa = nameMatch ? nameMatch[1].trim() : "Unknown Card";
    const nameEn = nameMatch ? nameMatch[2].trim() : "";

    // Extract image URL from metadata
    const imageUrl = result.metadata?.ogImage || result.metadata?.["twitter:image"] || null;

    // Parse price history from markdown
    const priceHistory = parsePriceHistory(markdown);

    return {
      name: nameEn || nameJa,
      nameJa,
      imageUrl,
      priceHistory,
    };
  } catch (error) {
    console.error("Error scraping SNKRDUNK page:", error);
    throw error;
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
  // Format: "41分前\n\nA\n\n¥53,500"
  // or: "4時間前\n\nPSA10\n\n¥78,000"
  const transactionPattern = /(\d+(?:分|時間|日)前)\n\n([A-Z0-9\s]+)\n\n¥([\d,]+)/g;
  let match;

  while ((match = transactionPattern.exec(historyText)) !== null) {
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
