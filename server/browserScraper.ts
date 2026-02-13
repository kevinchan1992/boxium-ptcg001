/**
 * Browser-based Scraper Service using Puppeteer
 * Uses headless Chrome to execute JavaScript and extract dynamic content
 */

import puppeteer from "puppeteer";

export interface BrowserScraperOptions {
  timeout?: number;
  waitForSelector?: string;
}

let browser: any = null;

/**
 * Get or create a shared browser instance
 */
async function getBrowser() {
  if (!browser) {
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
      ],
    });
  }
  return browser;
}

/**
 * Scrape a webpage using Puppeteer and convert to markdown-like format
 */
export async function scrapeWithBrowser(
  url: string,
  options: BrowserScraperOptions = {}
): Promise<{ markdown: string; metadata: any }> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate to the page with longer timeout and faster wait strategy
    await page.goto(url, {
      waitUntil: "domcontentloaded", // Faster than networkidle2
      timeout: options.timeout || 60000, // 60 seconds timeout
    });

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

      // Extract all text content in a structured way
      const bodyText = document.body.innerText;
      md += bodyText;

      return md;
    });

    await page.close();

    return { markdown, metadata };
  } catch (error) {
    await page.close();
    console.error("Error in browser scraper:", error);
    throw new Error(`Failed to scrape with browser: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Close the shared browser instance (call on server shutdown)
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
