/**
 * SNKRDUNK Service using Playwright
 * Scrapes PSA 10 used product listings from SNKRDUNK
 * Now scrapes both on-sale and sold items for comprehensive pricing data
 */

import { chromium } from "playwright";
import { convertToHKD } from "../utils/currency";

export interface SnkrdunkListing {
  url: string;
  price: number;
  currency: string;
  grade: string;
  image?: string;
  status?: 'on-sale' | 'sold'; // Track item status
}

/**
 * Scrape SNKRDUNK PSA 10 listings using Playwright
 * Scrapes both on-sale and sold items to provide comprehensive pricing data
 * @param snkrdunkId - SNKRDUNK product ID (e.g., 737036)
 * @returns Array of PSA 10 listings sorted by price (lowest first), including both on-sale and sold items
 */
export async function scrapeSnkrdunkListings(
  snkrdunkId: string,
  retryCount = 0
): Promise<SnkrdunkListing[]> {
  // Scrape both on-sale and sold items for comprehensive data
  const onSaleUrl = `https://snkrdunk.com/en/trading-cards/${snkrdunkId}/used?sort=latest&isOnlyOnSale=true`;
  const soldUrl = `https://snkrdunk.com/en/trading-cards/${snkrdunkId}/used?sort=latest`;
  
  console.log(`[SNKRDUNK Playwright] Starting comprehensive scrape for SNKRDUNK ID: ${snkrdunkId} (attempt ${retryCount + 1}/3)`);
  console.log(`[SNKRDUNK Playwright] Will scrape both on-sale and sold items`);
  
  try {
    // Scrape both URLs in parallel for better performance
    const [onSaleListings, soldListings] = await Promise.all([
      scrapeSnkrdunkUrl(snkrdunkId, onSaleUrl, 'on-sale'),
      scrapeSnkrdunkUrl(snkrdunkId, soldUrl, 'sold')
    ]);
    
    // Merge and deduplicate listings
    const allListings = [...onSaleListings, ...soldListings];
    const uniqueListings = deduplicateListings(allListings);
    
    // Sort by price (lowest first)
    uniqueListings.sort((a, b) => a.price - b.price);
    
    console.log(`[SNKRDUNK Playwright] Total listings: ${uniqueListings.length} (${onSaleListings.length} on-sale + ${soldListings.length} sold, after deduplication)`);
    
    if (uniqueListings.length > 0) {
      const minPrice = Math.min(...uniqueListings.map(l => l.price));
      const maxPrice = Math.max(...uniqueListings.map(l => l.price));
      const onSaleCount = uniqueListings.filter(l => l.status === 'on-sale').length;
      const soldCount = uniqueListings.filter(l => l.status === 'sold').length;
      console.log(`[SNKRDUNK Playwright] Price range: HKD ${minPrice.toFixed(2)} - HKD ${maxPrice.toFixed(2)}`);
      console.log(`[SNKRDUNK Playwright] Status breakdown: ${onSaleCount} on-sale, ${soldCount} sold`);
    }
    
    return uniqueListings;
  } catch (error) {
    console.error(`[SNKRDUNK Playwright] Comprehensive scrape failed:`, error);
    
    // Retry logic
    if (retryCount < 2) {
      console.log(`[SNKRDUNK Playwright] Retrying (${retryCount + 1}/2)...`);
      const waitTime = 2000 * (retryCount + 1);
      console.log(`[SNKRDUNK Playwright] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return scrapeSnkrdunkListings(snkrdunkId, retryCount + 1);
    }
    
    throw new Error(`Failed to scrape SNKRDUNK after 3 attempts: ${error}`);
  }
}

/**
 * Deduplicate listings based on URL
 */
function deduplicateListings(listings: SnkrdunkListing[]): SnkrdunkListing[] {
  const seen = new Set<string>();
  return listings.filter(listing => {
    if (seen.has(listing.url)) {
      return false;
    }
    seen.add(listing.url);
    return true;
  });
}

/**
 * Scrape a single SNKRDUNK URL
 */
async function scrapeSnkrdunkUrl(
  snkrdunkId: string,
  url: string,
  status: 'on-sale' | 'sold'
): Promise<SnkrdunkListing[]> {
  const startTime = Date.now();

  console.log(`[SNKRDUNK Playwright] Scraping ${status} items for SNKRDUNK ID: ${snkrdunkId}`);
  console.log(`[SNKRDUNK Playwright] Target URL: ${url}`);

  let browser;
  try {
    // Launch browser with anti-detection measures
    console.log(`[SNKRDUNK Playwright] Launching browser...`);
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    const page = await context.newPage();
    console.log(`[SNKRDUNK Playwright] Browser launched, navigating to page...`);

    // Navigate to page with faster load strategy
    await page.goto(url, { 
      waitUntil: "domcontentloaded", // Wait for DOM to be loaded
      timeout: 60000
    });

    // Wait for page to load - optimized to 6 seconds for better performance
    console.log(`[SNKRDUNK Playwright] Waiting for page to load...`);
    
    // Smart wait: wait for product links to appear
    try {
      await page.waitForSelector('a', { timeout: 10000 });
      console.log(`[SNKRDUNK Playwright] Product links detected, waiting additional time for full load...`);
    } catch (e) {
      console.log(`[SNKRDUNK Playwright] No links detected within 10s, proceeding anyway...`);
    }
    
    // Optimized wait time: 6 seconds (reduced from 8 seconds)
    await page.waitForTimeout(6000);
    console.log(`[SNKRDUNK Playwright] Page load complete, extracting data...`);

    // Extract product data using the same logic as the browser script
    const listings: any[] = await page.evaluate(() => {
      // Find all links with price info
      // SNKRDUNK uses different patterns, so we need to be more specific
      const allLinks = Array.from(document.querySelectorAll("a"));
      
      // Filter links that contain both price and grade information
      const productLinks = allLinks.filter((link) => {
        const text = link.textContent || "";
        // Look for links with price (US $, SG $, HK $, or NEW) and PSA/grade info
        const hasPrice = text.includes("US $") || text.includes("SG $") || text.includes("HK $") || text.includes("NEW");
        const hasGrade = text.includes("PSA") || /\b[A-D]\b/.test(text);
        return hasPrice && hasGrade;
      });

      console.log(`Found ${allLinks.length} total links, ${productLinks.length} product links`);

      return productLinks
        .slice(0, 50) // Limit to first 50 products
        .map((link) => {
          const text = link.textContent || "";
          const href = link.getAttribute("href") || "";

          // Extract price (support US$, HK$, and SG$, with or without commas)
          // Examples: "US $12695", "HK $11999", "HK $11,999", "SG $2150", "SG $2,150"
          const priceMatch = text.match(/(?:US|HK|SG)\s*\$([\d,]+)/);
          let price = 0;
          let currency = "HKD"; // Default currency
          
          if (priceMatch) {
            // Remove commas and convert to integer
            const amount = parseInt(priceMatch[1].replace(/,/g, ""));
            // Detect currency from the match
            if (text.includes("US $")) {
              currency = "USD";
            } else if (text.includes("SG $")) {
              currency = "SGD";
            } else {
              currency = "HKD";
            }
            // Store original amount, we'll convert later
            price = amount;
          }
          
          // If no price found, try alternative pattern (just $ followed by numbers)
          if (price === 0) {
            const altPriceMatch = text.match(/\$([\d,]+)/);
            if (altPriceMatch) {
              const amount = parseInt(altPriceMatch[1].replace(/,/g, ""));
              // Assume SGD if no currency prefix
              currency = "SGD";
              price = amount;
            }
          }

          // Extract grade (e.g., "PSA 10", "A", "B", etc.)
          const gradeMatch = text.match(
            /(PSA\s*\d+|PSA\s*\d+\s*or\s*under|ARS\s*\d+|[A-D](?!\w))/
          );
          const grade = gradeMatch ? gradeMatch[1].trim() : "Unknown";

          // Extract image
          const img = link.querySelector("img");
          const image = img ? img.getAttribute("src") : null;

          // Check if it's PSA 10
          const isPsa10 = grade.includes("PSA 10") || grade === "PSA10";

          return {
            price,
            grade,
            url: href.startsWith("http")
              ? href
              : `https://snkrdunk.com${href}`,
            image: image || undefined,
            currency,
            isPsa10,
          };
        })
        .filter((item: any) => item.price > 0); // Filter out invalid items
    });

    // Convert all prices to HKD
    const listingsWithConvertedPrices = listings.map((listing) => {
      const priceInHKD = convertToHKD(listing.price, listing.currency);
      return {
        ...listing,
        price: priceInHKD,
        currency: "HKD", // All prices are now in HKD
        status, // Add status field
      };
    });

    // Filter only PSA 10 items
    const psa10Listings = listingsWithConvertedPrices.filter((item) => item.isPsa10);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[SNKRDUNK Playwright] Extraction complete in ${elapsedTime}s: ${listings.length} total listings, ${psa10Listings.length} PSA 10 ${status} listings`
    );
    
    // Log price range if PSA 10 listings found
    if (psa10Listings.length > 0) {
      const minPrice = Math.min(...psa10Listings.map(l => l.price));
      const maxPrice = Math.max(...psa10Listings.map(l => l.price));
      console.log(
        `[SNKRDUNK Playwright] ${status} price range: HKD ${minPrice.toFixed(2)} - HKD ${maxPrice.toFixed(2)}`
      );
    } else {
      console.warn(`[SNKRDUNK Playwright] WARNING: No PSA 10 ${status} listings found for SNKRDUNK ID ${snkrdunkId}`);
    }

    return psa10Listings;
  } catch (error: any) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[SNKRDUNK Playwright] ERROR after ${elapsedTime}s:`, error.message);
    console.error(`[SNKRDUNK Playwright] Error stack:`, error.stack);
    console.error(`[SNKRDUNK Playwright] Failed SNKRDUNK ID: ${snkrdunkId}, Status: ${status}`);
    
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
