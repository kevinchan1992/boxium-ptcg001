/**
 * Diagnostics Router
 * Provides diagnostic endpoints for troubleshooting production issues
 */

import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { playwrightPool } from "../services/playwrightPool";

export const diagnosticsRouter = router({
  /**
   * Test if Playwright can launch a browser
   */
  testPlaywright: adminProcedure.query(async () => {
    const startTime = Date.now();
    const result: any = {
      success: false,
      error: null,
      browserLaunched: false,
      pageLoaded: false,
      snkrdunkAccessible: false,
      duration: 0,
      logs: [],
    };

    try {
      result.logs.push(`[${new Date().toISOString()}] Starting Playwright test...`);

      // Test 1: Launch browser
      result.logs.push(`[${new Date().toISOString()}] Attempting to launch browser...`);
      const browser = await playwrightPool.getBrowser();
      result.browserLaunched = true;
      result.logs.push(`[${new Date().toISOString()}] ✅ Browser launched successfully`);

      // Test 2: Create page
      result.logs.push(`[${new Date().toISOString()}] Creating new page...`);
      const page = await browser.newPage();
      result.pageLoaded = true;
      result.logs.push(`[${new Date().toISOString()}] ✅ Page created successfully`);

      // Test 3: Access SNKRDUNK
      result.logs.push(`[${new Date().toISOString()}] Accessing SNKRDUNK website...`);
      const testUrl = "https://snkrdunk.com/en/trading-cards/737036/used?sort=latest&isOnlyOnSale=true";
      
      try {
        await page.goto(testUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        result.snkrdunkAccessible = true;
        result.logs.push(`[${new Date().toISOString()}] ✅ SNKRDUNK website accessible`);

        // Get page title
        const title = await page.title();
        result.logs.push(`[${new Date().toISOString()}] Page title: ${title}`);

        // Check if page loaded correctly
        const bodyText = await page.evaluate(() => document.body.innerText);
        result.logs.push(`[${new Date().toISOString()}] Page content length: ${bodyText.length} characters`);

      } catch (navError: any) {
        result.logs.push(`[${new Date().toISOString()}] ❌ Failed to access SNKRDUNK: ${navError.message}`);
        result.error = `Navigation error: ${navError.message}`;
      }

      await page.close();
      result.logs.push(`[${new Date().toISOString()}] Page closed`);

      result.success = result.browserLaunched && result.pageLoaded;
      result.duration = Date.now() - startTime;
      result.logs.push(`[${new Date().toISOString()}] Test completed in ${result.duration}ms`);

    } catch (error: any) {
      result.error = error.message;
      result.logs.push(`[${new Date().toISOString()}] ❌ Error: ${error.message}`);
      result.logs.push(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
      result.duration = Date.now() - startTime;
    }

    return result;
  }),

  /**
   * Test SNKRDUNK scraping for a specific card
   */
  testSnkrdunkScraping: adminProcedure
    .input(z.object({ snkrdunkId: z.string() }))
    .query(async ({ input }: { input: { snkrdunkId: string } }) => {
      const startTime = Date.now();
      const result: any = {
        success: false,
        error: null,
        listings: [],
        duration: 0,
        logs: [],
      };

      try {
        result.logs.push(`[${new Date().toISOString()}] Testing SNKRDUNK scraping for ID: ${input.snkrdunkId}`);

        // Import scraping function
        const { scrapeSnkrdunkListings } = await import("../services/snkrdunkPlaywright");

        // Attempt to scrape
        const listings = await scrapeSnkrdunkListings(input.snkrdunkId);
        
        result.success = true;
        result.listings = listings;
        result.duration = Date.now() - startTime;
        result.logs.push(`[${new Date().toISOString()}] ✅ Scraping successful: ${listings.length} listings found`);
        result.logs.push(`[${new Date().toISOString()}] Duration: ${result.duration}ms`);

      } catch (error: any) {
        result.error = error.message;
        result.logs.push(`[${new Date().toISOString()}] ❌ Scraping failed: ${error.message}`);
        result.logs.push(`[${new Date().toISOString()}] Stack trace: ${error.stack}`);
        result.duration = Date.now() - startTime;
      }

      return result;
    }),



  /**
   * Get system information
   */
  getSystemInfo: adminProcedure.query(async () => {
    const os = await import("os");
    const process = await import("process");

    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      nodeVersion: process.version,
      uptime: os.uptime(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        // Don't expose sensitive env vars
      },
    };
  }),
});
