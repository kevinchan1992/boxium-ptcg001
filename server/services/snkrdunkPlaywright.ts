/**
 * SNKRDUNK Service using Playwright
 * Scrapes PSA 10 used product listings from SNKRDUNK
 */

import { chromium } from "playwright";

export interface SnkrdunkListing {
  url: string;
  price: number;
  currency: string;
  grade: string;
  image?: string;
}

/**
 * Scrape SNKRDUNK PSA 10 listings using Playwright
 * @param snkrdunkId - SNKRDUNK product ID (e.g., 737036)
 * @returns Array of PSA 10 listings sorted by price (lowest first)
 */
export async function scrapeSnkrdunkListings(
  snkrdunkId: string
): Promise<SnkrdunkListing[]> {
  const url = `https://snkrdunk.com/en/trading-cards/${snkrdunkId}/used?sort=latest&isOnlyOnSale=true`;

  console.log(`[SNKRDUNK Playwright] Fetching URL: ${url}`);

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // Navigate to page with increased timeout and faster load strategy
    await page.goto(url, { 
      waitUntil: "domcontentloaded", // Faster than networkidle
      timeout: 60000 // Increase timeout to 60 seconds
    });

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Extract product data using the same logic as the browser script
    const listings = await page.evaluate(() => {
      // Find all links with price info
      // SNKRDUNK uses different patterns, so we need to be more specific
      const allLinks = Array.from(document.querySelectorAll("a"));
      
      // Filter links that contain both price and grade information
      const productLinks = allLinks.filter((link) => {
        const text = link.textContent || "";
        // Look for links with "NEW" or "SG $" and PSA/grade info
        const hasPrice = text.includes("SG $") || text.includes("NEW");
        const hasGrade = text.includes("PSA") || /\b[A-D]\b/.test(text);
        return hasPrice && hasGrade;
      });

      console.log(`Found ${allLinks.length} total links, ${productLinks.length} product links`);

      return productLinks
        .slice(0, 50) // Limit to first 50 products
        .map((link) => {
          const text = link.textContent || "";
          const href = link.getAttribute("href") || "";

          // Extract price (e.g., "SG $2150" or "NEW SG $2150")
          const priceMatch = text.match(/SG\s*\$(\d+)/);
          let price = priceMatch ? parseInt(priceMatch[1]) : 0;
          
          // If no price found, try alternative pattern
          if (price === 0) {
            const altPriceMatch = text.match(/\$(\d+)/);
            price = altPriceMatch ? parseInt(altPriceMatch[1]) : 0;
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
            currency: "SGD",
            isPsa10,
          };
        })
        .filter((item) => item.price > 0); // Filter out invalid items
    });

    // Filter only PSA 10 items
    const psa10Listings = listings.filter((item) => item.isPsa10);

    // Sort by price (lowest first)
    psa10Listings.sort((a, b) => a.price - b.price);

    console.log(
      `[SNKRDUNK Playwright] Extracted ${listings.length} total listings`
    );
    console.log(
      `[SNKRDUNK Playwright] Found ${psa10Listings.length} PSA 10 listings`
    );

    return psa10Listings;
  } catch (error: any) {
    console.error("[SNKRDUNK Playwright] Error:", error.message);
    throw new Error(`Failed to scrape SNKRDUNK: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
