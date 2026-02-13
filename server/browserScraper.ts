/**
 * Browser-based Scraper Service using Puppeteer
 * Uses headless Chrome to execute JavaScript and extract dynamic content
 */

import puppeteer from "puppeteer";

export interface BrowserScraperOptions {
  timeout?: number;
  waitForSelector?: string;
}

/**
 * Scrape a webpage using Puppeteer and convert to markdown-like format
 * Creates a fresh browser instance for each request to avoid connection issues
 */
export async function scrapeWithBrowser(
  url: string,
  options: BrowserScraperOptions = {}
): Promise<{ markdown: string; metadata: any }> {
  let browser = null;
  let page = null;

  try {
    // Launch a fresh browser instance for each request
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled", // Hide automation
      ],
    });

    page = await browser.newPage();

    // Set viewport and user agent (anti-detection)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Remove webdriver flag (anti-detection)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Navigate to the page with longer timeout and faster wait strategy
    await page.goto(url, {
      waitUntil: "domcontentloaded", // Faster than networkidle2
      timeout: options.timeout || 60000, // 60 seconds timeout
    });

    // Wait for dynamic content to load
    // For SNKRDUNK, wait for the price history section
    try {
      await page.waitForSelector('body', { timeout: 5000 });
      // Give extra time for JavaScript to execute
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.warn('[Scraper] Timeout waiting for content, proceeding anyway');
    }
    
    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    }

    // Extract metadata
    const metadata = await page.evaluate(() => {
      return {
        title: document.title || "",
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || null,
        "twitter:image": document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || null,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      };
    });

    // Extract text content in markdown-like format
    const markdown = await page.evaluate(() => {
      let md = "";

      // Extract main title
      const h1 = document.querySelector("h1");
      if (h1) {
        md += `# ${h1.textContent?.trim()}\n\n`;
      }

      // Try to extract structured content first
      // Look for common SNKRDUNK selectors
      const priceHistorySection = document.querySelector('[class*="price"], [class*="history"], [class*="売買"]');
      if (priceHistorySection && 'innerText' in priceHistorySection) {
        md += (priceHistorySection as HTMLElement).innerText + "\n\n";
      }

      // Extract all visible text content
      const bodyText = document.body.innerText;
      md += bodyText;

      return md;
    });

    await page.close();
    await browser.close();

    return { markdown, metadata };
  } catch (error) {
    // Clean up resources
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    console.error("Error in browser scraper:", error);
    throw new Error(`Failed to scrape with browser: ${error instanceof Error ? error.message : String(error)}`);
  }
}
