/**
 * Puppeteer Browser Pool
 * Manages a single shared browser instance to reduce startup overhead
 */

import puppeteer, { Browser } from "puppeteer";

class PuppeteerPool {
  private browser: Browser | null = null;
  private initPromise: Promise<Browser> | null = null;
  private lastUsed: number = Date.now();
  private idleTimeout: NodeJS.Timeout | null = null;

  async getBrowser(): Promise<Browser> {
    this.lastUsed = Date.now();

    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }

    if (this.initPromise) {
      console.log("[Puppeteer Pool] Waiting for browser initialization...");
      return this.initPromise;
    }

    if (this.browser && this.browser.connected) {
      console.log("[Puppeteer Pool] Reusing existing browser instance");
      return this.browser;
    }

    console.log("[Puppeteer Pool] Initializing new browser instance...");

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.log("[Puppeteer Pool] Failed to close old browser");
      }
      this.browser = null;
    }

    this.initPromise = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    try {
      const browser = await this.initPromise;
      this.browser = browser;
      console.log("[Puppeteer Pool] Browser initialized successfully");
      this.scheduleIdleTimeout();
      return this.browser;
    } catch (error) {
      console.error("[Puppeteer Pool] Failed to initialize browser:", error);
      throw error;
    } finally {
      this.initPromise = null;
    }
  }

  private scheduleIdleTimeout() {
    const IDLE_TIMEOUT = 5 * 60 * 1000;
    this.idleTimeout = setTimeout(async () => {
      const idleTime = Date.now() - this.lastUsed;
      if (idleTime >= IDLE_TIMEOUT) {
        console.log("[Puppeteer Pool] Browser idle for 5 minutes, closing...");
        await this.closeBrowser();
      }
    }, IDLE_TIMEOUT);
  }

  async closeBrowser() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
        console.log("[Puppeteer Pool] Browser closed");
      } catch (error) {
        console.error("[Puppeteer Pool] Error closing browser:", error);
      }
      this.browser = null;
    }
  }

  isConnected(): boolean {
    return this.browser !== null && this.browser.connected;
  }
}

export const puppeteerPool = new PuppeteerPool();

process.on("SIGINT", async () => {
  await puppeteerPool.closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await puppeteerPool.closeBrowser();
  process.exit(0);
});
