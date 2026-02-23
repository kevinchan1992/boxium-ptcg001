/**
 * SNKRDUNK Service using Playwright
 * Scrapes PSA 10 used product listings from SNKRDUNK
 * Now scrapes both on-sale and sold items for comprehensive pricing data
 */

import { puppeteerPool } from "./puppeteerPool";
import { convertToHKD } from "../utils/currency";
import { logPerformance } from "./performanceTracker";

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
  
  console.log(`[SNKRDUNK Puppeteer] Starting comprehensive scrape for SNKRDUNK ID: ${snkrdunkId} (attempt ${retryCount + 1}/3)`);
  console.log(`[SNKRDUNK Puppeteer] Will scrape both on-sale and sold items`);
  
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
    
    console.log(`[SNKRDUNK Puppeteer] Total listings: ${uniqueListings.length} (${onSaleListings.length} on-sale + ${soldListings.length} sold, after deduplication)`);
    
    if (uniqueListings.length > 0) {
      const minPrice = Math.min(...uniqueListings.map(l => l.price));
      const maxPrice = Math.max(...uniqueListings.map(l => l.price));
      const onSaleCount = uniqueListings.filter(l => l.status === 'on-sale').length;
      const soldCount = uniqueListings.filter(l => l.status === 'sold').length;
      console.log(`[SNKRDUNK Puppeteer] Price range: HKD ${minPrice.toFixed(2)} - HKD ${maxPrice.toFixed(2)}`);
      console.log(`[SNKRDUNK Puppeteer] Status breakdown: ${onSaleCount} on-sale, ${soldCount} sold`);
    }
    
    return uniqueListings;
  } catch (error) {
    console.error(`[SNKRDUNK Puppeteer] Comprehensive scrape failed:`, error);
    
    // Exponential backoff retry
    if (retryCount < 2) {
      const retryDelays = [1000, 3000, 8000];
      const waitTime = retryDelays[retryCount];
      console.log(`[SNKRDUNK Puppeteer] Retrying (${retryCount + 1}/3), waiting ${waitTime}ms...`);
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
  let performanceLogged = false;

  console.log(`[SNKRDUNK Puppeteer] Scraping ${status} items for SNKRDUNK ID: ${snkrdunkId}`);
  console.log(`[SNKRDUNK Puppeteer] Target URL: ${url}`);

  let page: any = null;

  try {
    console.log(`[SNKRDUNK Puppeteer] Getting browser from pool...`);
    const browser = await puppeteerPool.getBrowser();

    // Puppeteer doesn't use context, create page directly
    page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1920, height: 1080 });
    console.log(`[SNKRDUNK Puppeteer] Browser ready, navigating to page...`);

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate with optimized timeout
    await page.goto(url, { 
      waitUntil: "domcontentloaded",
      timeout: 20000
    });

    console.log(`[SNKRDUNK Puppeteer] Waiting for page to load...`);
    
    // Smart wait for product links
    try {
      await page.waitForSelector('a[href*="/trading-cards/"]', { 
        timeout: 8000,
        state: 'attached'
      });
      console.log(`[SNKRDUNK Puppeteer] Product links detected`);
    } catch (e) {
      console.log(`[SNKRDUNK Puppeteer] No product links detected within 8s, proceeding...`);
    }
    
    // Dynamic wait based on page complexity
    const linkCount = await page.locator('a').count();
    const waitTime = Math.min(2000 + linkCount * 30, 5000);
    console.log(`[SNKRDUNK Puppeteer] Detected ${linkCount} links, waiting ${waitTime}ms...`);
    await page.waitForTimeout(waitTime);
    console.log(`[SNKRDUNK Puppeteer] Page load complete, extracting data...`);

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
      `[SNKRDUNK Puppeteer] Extraction complete in ${elapsedTime}s: ${listings.length} total listings, ${psa10Listings.length} PSA 10 ${status} listings`
    );
    
    // Log price range if PSA 10 listings found
    if (psa10Listings.length > 0) {
      const minPrice = Math.min(...psa10Listings.map(l => l.price));
      const maxPrice = Math.max(...psa10Listings.map(l => l.price));
      console.log(
        `[SNKRDUNK Puppeteer] ${status} price range: HKD ${minPrice.toFixed(2)} - HKD ${maxPrice.toFixed(2)}`
      );
    } else {
      console.warn(`[SNKRDUNK Puppeteer] WARNING: No PSA 10 ${status} listings found for SNKRDUNK ID ${snkrdunkId}`);
    }

    // Log performance
    const responseTime = Date.now() - startTime;
    await logPerformance({
      source: 'snkrdunk',
      operationType: 'single',
      status: 'success',
      responseTime,
      itemsProcessed: psa10Listings.length
    }).catch(e => console.error('[SNKRDUNK Puppeteer] Failed to log performance:', e));
    performanceLogged = true;
    
    return psa10Listings;
  } catch (error: any) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[SNKRDUNK Puppeteer] ERROR after ${elapsedTime}s:`, error.message);
    console.error(`[SNKRDUNK Puppeteer] Error stack:`, error.stack);
    console.error(`[SNKRDUNK Puppeteer] Failed SNKRDUNK ID: ${snkrdunkId}, Status: ${status}`);
    
    // Log performance failure
    if (!performanceLogged) {
      const responseTime = Date.now() - startTime;
      await logPerformance({
        source: 'snkrdunk',
        operationType: 'single',
        status: error.name === 'TimeoutError' ? 'timeout' : 'error',
        responseTime,
        itemsProcessed: 0,
        errorMessage: error.message
      }).catch(e => console.error('[SNKRDUNK Puppeteer] Failed to log performance:', e));
    }
    
    throw error;
  } finally {
    // Don't close browser (managed by pool), just close page and context
    try {
      if (page) await page.close();
      // Puppeteer doesn't use context
    } catch (e) {
      console.log(`[SNKRDUNK Puppeteer] Error closing page/context:`, e);
    }
  }
}
