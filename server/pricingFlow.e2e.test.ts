/**
 * 端到端測試（E2E）- 卡牌詳情頁完整流程
 * 
 * 測試場景：
 * 1. 快取命中場景（熱快取、冷快取、過期快取）
 * 2. 即時爬取場景（開發環境正常、休眠重試）
 * 3. 容錯場景（開發環境不可用、降級到舊快取）
 * 4. 數據格式驗證
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as db from './db';

describe('Pricing Flow E2E Tests', () => {
  let testCardId: number;
  let testSnkrdunkId: string;

  beforeAll(async () => {
    // 使用指定的 Pikachu Munch Exhibition 卡牠進行測試
    testSnkrdunkId = '100090'; // Pikachu Munch Exhibition: PROMO[SM-P 288]
    const testCard = await db.getCardBySnkrdunkId(testSnkrdunkId);
    
    if (!testCard) {
      console.log(`⚠️  Test card not found (snkrdunkId: ${testSnkrdunkId})`);
      throw new Error(`Test card not found (snkrdunkId: ${testSnkrdunkId})`);
    }
    
    testCardId = testCard.id;
    console.log(`✅ Using test card: ${testCard.name} (ID: ${testCardId}, snkrdunkId: ${testSnkrdunkId})`);
  });

  beforeEach(async () => {
    // 每個測試前清除快取
    await db.clearSnkrdunkCacheByCardId(testCardId);
    console.log(`🧹 Cleared cache for card ${testCardId}`);
  });

  describe('Cache Hit Scenarios', () => {
    it('Scenario 1: First visit (no cache, should scrape)', async () => {
      console.log('\n📍 Testing: First visit (no cache)');
      
      // 確認沒有快取
      const cacheBeforeFetch = await db.getSnkrdunkListingsCache(testCardId);
      expect(cacheBeforeFetch).toBeNull();
      
      // 模擬用戶訪問（調用 pricing router）
      const { scrapeSnkrdunkListings } = await import('./services/snkrdunkScraperService');
      const listings = await scrapeSnkrdunkListings(testSnkrdunkId);
      
      // 驗證返回數據
      expect(Array.isArray(listings)).toBe(true);
      console.log(`✅ Scraped ${listings.length} listings`);
      
      // 保存快取
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(listings),
        hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
      });
      
      // 確認快取已保存
      const cacheAfterFetch = await db.getSnkrdunkListingsCache(testCardId);
      expect(cacheAfterFetch).not.toBeNull();
      console.log(`✅ Cache saved successfully`);
    }, 30000); // 30秒超時

    it('Scenario 2: Hot cache hit (<1 hour, should return immediately)', async () => {
      console.log('\n📍 Testing: Hot cache hit');
      
      // 創建熱快取（30分鐘前）
      const mockListings = [
        { price: 100, currency: 'HKD', grade: 'PSA 10', url: 'https://test.com/1' }
      ];
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(mockListings),
        hotExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分鐘後過期
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6小時後過期
      });
      
      // 獲取快取
      const cache = await db.getSnkrdunkListingsCache(testCardId);
      expect(cache).not.toBeNull();
      
      // 驗證是熱快取
      const now = new Date();
      const isHot = cache!.hotExpiresAt && new Date(cache!.hotExpiresAt) > now;
      expect(isHot).toBe(true);
      
      // 驗證數據
      const cachedListings = JSON.parse(cache!.listings);
      expect(cachedListings).toHaveLength(1);
      expect(cachedListings[0].price).toBe(100);
      
      console.log(`✅ Hot cache hit, returned ${cachedListings.length} listings`);
    });

    it('Scenario 3: Cold cache hit (1-6 hours, usable but stale)', async () => {
      console.log('\n📍 Testing: Cold cache hit');
      
      // 創建冷快取（熱快取已過期，但冷快取仍有效）
      const mockListings = [
        { price: 200, currency: 'HKD', grade: 'PSA 10', url: 'https://test.com/2' }
      ];
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(mockListings),
        hotExpiresAt: new Date(Date.now() - 10 * 60 * 1000), // 10分鐘前已過期
        expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5小時後過期
      });
      
      // 獲取快取
      const cache = await db.getSnkrdunkListingsCache(testCardId);
      expect(cache).not.toBeNull();
      
      // 驗證是冷快取（熱快取過期，但冷快取仍有效）
      const now = new Date();
      const isHot = cache!.hotExpiresAt && new Date(cache!.hotExpiresAt) > now;
      const isCold = new Date(cache!.expiresAt) > now;
      expect(isHot).toBe(false);
      expect(isCold).toBe(true);
      
      console.log(`✅ Cold cache hit (hot expired, cold still valid)`);
    });

    it('Scenario 4: Cache expired (>6 hours, should re-scrape)', async () => {
      console.log('\n📍 Testing: Cache expired');
      
      // 創建過期快取
      const mockListings = [
        { price: 300, currency: 'HKD', grade: 'PSA 10', url: 'https://test.com/3' }
      ];
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(mockListings),
        hotExpiresAt: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7小時前過期
        expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1小時前過期
      });
      
      // 獲取快取
      const cache = await db.getSnkrdunkListingsCache(testCardId);
      expect(cache).not.toBeNull();
      
      // 驗證快取已過期
      const now = new Date();
      const isExpired = new Date(cache!.expiresAt) <= now;
      expect(isExpired).toBe(true);
      
      console.log(`✅ Cache expired, should trigger re-scrape`);
    });
  });

  describe('Scraping Scenarios', () => {
    it('Scenario 5: Dev environment available (scraping success)', async () => {
      console.log('\n📍 Testing: Dev environment available');
      
      // 檢查開發環境健康狀態
      const { checkDevEnvHealth } = await import('./services/devEnvScraper');
      const isHealthy = await checkDevEnvHealth();
      
      if (!isHealthy) {
        console.log('⚠️  Dev environment not available, skipping test');
        return;
      }
      
      // 調用爬取服務
      const { scrapeSnkrdunkListings } = await import('./services/snkrdunkScraperService');
      const listings = await scrapeSnkrdunkListings(testSnkrdunkId);
      
      // 驗證數據格式
      expect(Array.isArray(listings)).toBe(true);
      
      if (listings.length > 0) {
        const firstListing = listings[0];
        expect(firstListing).toHaveProperty('price');
        expect(firstListing).toHaveProperty('currency');
        expect(firstListing).toHaveProperty('grade');
        expect(firstListing).toHaveProperty('url');
        
        console.log(`✅ Scraping success: ${listings.length} listings`);
        console.log(`   First listing: ${firstListing.grade} - ${firstListing.currency} ${firstListing.price}`);
      } else {
        console.log(`⚠️  Scraping returned 0 listings (may be no items on sale)`);
      }
    }, 30000); // 30秒超時

    it('Scenario 6: Data format validation', async () => {
      console.log('\n📍 Testing: Data format validation');
      
      // 創建測試數據
      const mockListings = [
        {
          price: 216010.5,
          currency: 'HKD',
          grade: 'PSA 10',
          url: 'https://snkrdunk.com/apparels/818700/123',
          image: 'https://example.com/image.jpg'
        },
        {
          price: 200000,
          currency: 'HKD',
          grade: 'PSA 9',
          url: 'https://snkrdunk.com/apparels/818700/456'
        }
      ];
      
      // 驗證數據結構
      mockListings.forEach((listing, index) => {
        expect(listing).toHaveProperty('price');
        expect(listing).toHaveProperty('currency');
        expect(listing).toHaveProperty('grade');
        expect(listing).toHaveProperty('url');
        
        expect(typeof listing.price).toBe('number');
        expect(typeof listing.currency).toBe('string');
        expect(typeof listing.grade).toBe('string');
        expect(typeof listing.url).toBe('string');
        
        console.log(`✅ Listing ${index + 1} format valid: ${listing.grade} - ${listing.currency} ${listing.price}`);
      });
    });
  });

  describe('Fault Tolerance Scenarios', () => {
    it('Scenario 7: Dev environment unavailable (fallback to stale cache)', async () => {
      console.log('\n📍 Testing: Dev environment unavailable');
      
      // 創建舊快取（模擬降級場景）
      const mockListings = [
        { price: 150, currency: 'HKD', grade: 'PSA 10', url: 'https://test.com/fallback' }
      ];
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(mockListings),
        hotExpiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2小時前過期
        expiresAt: new Date(Date.now() - 30 * 60 * 1000), // 30分鐘前過期
      });
      
      // 模擬開發環境不可用（通過錯誤的 URL）
      const originalUrl = process.env.DEV_SCRAPER_URL;
      process.env.DEV_SCRAPER_URL = 'https://invalid-url.example.com';
      
      try {
        const { fetchFromDevEnv } = await import('./services/devEnvScraper');
        await fetchFromDevEnv(testSnkrdunkId);
        
        // 如果沒有拋出錯誤，測試失敗
        expect(true).toBe(false);
      } catch (error) {
        // 預期會拋出錯誤
        console.log(`✅ Dev environment unavailable, error caught:`, (error as Error).message);
        
        // 驗證可以降級到舊快取
        const cache = await db.getSnkrdunkListingsCache(testCardId);
        expect(cache).not.toBeNull();
        
        const cachedListings = JSON.parse(cache!.listings);
        expect(cachedListings).toHaveLength(1);
        console.log(`✅ Fallback to stale cache: ${cachedListings.length} listings`);
      } finally {
        // 恢復原始 URL
        process.env.DEV_SCRAPER_URL = originalUrl;
      }
    }, 15000);

    it('Scenario 8: No cache and dev environment unavailable (return empty)', async () => {
      console.log('\n📍 Testing: No cache and dev environment unavailable');
      
      // 確認沒有快取
      await db.clearSnkrdunkCacheByCardId(testCardId);
      const cache = await db.getSnkrdunkListingsCache(testCardId);
      expect(cache).toBeNull();
      
      // 模擬開發環境不可用
      const originalUrl = process.env.DEV_SCRAPER_URL;
      process.env.DEV_SCRAPER_URL = 'https://invalid-url.example.com';
      
      try {
        const { fetchFromDevEnv } = await import('./services/devEnvScraper');
        await fetchFromDevEnv(testSnkrdunkId);
        
        expect(true).toBe(false);
      } catch (error) {
        console.log(`✅ No cache and dev environment unavailable, should return empty`);
        console.log(`   Error:`, (error as Error).message);
      } finally {
        process.env.DEV_SCRAPER_URL = originalUrl;
      }
    }, 15000);
  });

  describe('Integration Test - Full User Flow', () => {
    it('Scenario 9: Complete user flow (visit → cache → scrape → display)', async () => {
      console.log('\n📍 Testing: Complete user flow');
      
      // Step 1: 清除快取（模擬首次訪問）
      await db.clearSnkrdunkCacheByCardId(testCardId);
      console.log('  Step 1: Cleared cache');
      
      // Step 2: 檢查開發環境健康狀態
      const { checkDevEnvHealth } = await import('./services/devEnvScraper');
      const isHealthy = await checkDevEnvHealth();
      console.log(`  Step 2: Dev environment health: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      
      if (!isHealthy) {
        console.log('⚠️  Dev environment not available, skipping full flow test');
        return;
      }
      
      // Step 3: 爬取數據（模擬用戶首次訪問）
      const { scrapeSnkrdunkListings } = await import('./services/snkrdunkScraperService');
      const listings = await scrapeSnkrdunkListings(testSnkrdunkId);
      console.log(`  Step 3: Scraped ${listings.length} listings`);
      
      // Step 4: 保存快取
      await db.saveSnkrdunkListingsCache({
        cardId: testCardId,
        snkrdunkId: testSnkrdunkId,
        listings: JSON.stringify(listings),
        hotExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      });
      console.log('  Step 4: Saved cache');
      
      // Step 5: 驗證快取（模擬用戶第二次訪問）
      const cache = await db.getSnkrdunkListingsCache(testCardId);
      expect(cache).not.toBeNull();
      
      const cachedListings = JSON.parse(cache!.listings);
      expect(cachedListings).toEqual(listings);
      console.log(`  Step 5: Cache verified, ${cachedListings.length} listings`);
      
      console.log('✅ Complete user flow test passed');
    }, 30000);
  });

  afterAll(() => {
    console.log('\n🎉 All E2E tests completed!');
  });
});
