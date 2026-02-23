import { describe, it, expect } from 'vitest';
import { puppeteerPool } from './services/puppeteerPool';
import { scrapeSnkrdunkListings } from './services/snkrdunkPuppeteer';

describe('Production Environment Diagnostics', () => {
  it('should successfully launch Puppeteer browser', async () => {
    console.log('Testing Puppeteer browser launch...');
    
    const browser = await puppeteerPool.getBrowser();
    
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
    
    console.log('✅ Browser launched successfully');
  }, 30000);

  it('should successfully create a page and navigate', async () => {
    console.log('Testing page creation and navigation...');
    
    const browser = await puppeteerPool.getBrowser();
    const page = await browser.newPage();
    
    expect(page).toBeDefined();
    
    // Test navigation to SNKRDUNK
    const testUrl = 'https://snkrdunk.com/en/trading-cards/737036/used?sort=latest&isOnlyOnSale=true';
    console.log(`Navigating to: ${testUrl}`);
    
    await page.goto(testUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    expect(title).toBeTruthy();
    
    await page.close();
    console.log('✅ Page navigation successful');
  }, 60000);

  it('should successfully scrape SNKRDUNK listings', async () => {
    console.log('Testing SNKRDUNK scraping...');
    
    // Test with a known card ID (Pikachu)
    const testSnkrdunkId = '737036';
    console.log(`Scraping SNKRDUNK ID: ${testSnkrdunkId}`);
    
    const listings = await scrapeSnkrdunkListings(testSnkrdunkId);
    
    console.log(`Found ${listings.length} listings`);
    
    expect(Array.isArray(listings)).toBe(true);
    
    if (listings.length > 0) {
      console.log('Sample listing:', listings[0]);
      expect(listings[0]).toHaveProperty('url');
      expect(listings[0]).toHaveProperty('price');
      expect(listings[0]).toHaveProperty('currency');
      expect(listings[0]).toHaveProperty('grade');
    }
    
    console.log('✅ SNKRDUNK scraping successful');
  }, 120000);
});
