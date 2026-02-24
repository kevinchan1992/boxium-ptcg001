/**
 * 測試生產環境配置
 * 
 * 驗證 DEV_SCRAPER_URL 和 DEV_SCRAPER_API_KEY 是否正確配置
 */

import { describe, it, expect } from 'vitest';

describe('Production Environment Configuration', () => {
  it('should have DEV_SCRAPER_URL configured', () => {
    const url = process.env.DEV_SCRAPER_URL;
    expect(url).toBeDefined();
    expect(url).toMatch(/^https:\/\//);
    console.log('✅ DEV_SCRAPER_URL:', url);
  });

  it('should have DEV_SCRAPER_API_KEY configured', () => {
    const apiKey = process.env.DEV_SCRAPER_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toHaveLength(64); // 32 bytes hex = 64 characters
    console.log('✅ DEV_SCRAPER_API_KEY is configured (64 characters)');
  });

  it('should be able to call dev environment health check', async () => {
    const url = process.env.DEV_SCRAPER_URL;
    
    if (!url) {
      throw new Error('DEV_SCRAPER_URL not configured');
    }

    try {
      const response = await fetch(`${url}/api/dev/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.playwrightReady).toBe(true);
      
      console.log('✅ Dev environment health check passed:', data);
    } catch (error) {
      console.error('❌ Dev environment health check failed:', error);
      throw error;
    }
  }, 10000);

  it('should be able to authenticate with dev environment', async () => {
    const url = process.env.DEV_SCRAPER_URL;
    const apiKey = process.env.DEV_SCRAPER_API_KEY;
    
    if (!url || !apiKey) {
      throw new Error('DEV_SCRAPER_URL or DEV_SCRAPER_API_KEY not configured');
    }

    try {
      // Test with valid API key (should not return 401)
      const response = await fetch(`${url}/api/dev/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ snkrdunkId: '100090' }),
        signal: AbortSignal.timeout(30000)
      });
      
      // Should not be 401 (authentication passed)
      expect(response.status).not.toBe(401);
      
      console.log('✅ Authentication passed, status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Scraping result:', {
          success: data.success,
          snkrdunkId: data.snkrdunkId,
          totalListings: data.totalListings
        });
      }
    } catch (error) {
      console.error('❌ Authentication test failed:', error);
      throw error;
    }
  }, 35000);
});
