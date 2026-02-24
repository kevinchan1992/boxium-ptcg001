/**
 * 測試開發環境爬蟲 API
 * 
 * 測試內容：
 * 1. Health check endpoint
 * 2. API Key 認證
 * 3. Scrape endpoint（模擬測試）
 */

import { describe, it, expect } from 'vitest';

describe('Dev Scraper API', () => {
  const DEV_SCRAPER_API_KEY = process.env.DEV_SCRAPER_API_KEY;
  const BASE_URL = 'http://localhost:3000';

  it('should have DEV_SCRAPER_API_KEY configured', () => {
    expect(DEV_SCRAPER_API_KEY).toBeDefined();
    expect(DEV_SCRAPER_API_KEY).toHaveLength(64); // 32 bytes hex = 64 characters
    console.log('✅ DEV_SCRAPER_API_KEY is configured');
  });

  it('should respond to health check', async () => {
    const response = await fetch(`${BASE_URL}/api/dev/health`);
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.playwrightReady).toBe(true);
    expect(data.timestamp).toBeDefined();
    
    console.log('✅ Health check passed:', data);
  });

  it('should reject requests without API key', async () => {
    const response = await fetch(`${BASE_URL}/api/dev/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ snkrdunkId: '818700' })
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
    
    console.log('✅ Correctly rejected request without API key');
  });

  it('should reject requests with invalid API key', async () => {
    const response = await fetch(`${BASE_URL}/api/dev/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ snkrdunkId: '818700' })
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid API key');
    
    console.log('✅ Correctly rejected request with invalid API key');
  });

  it('should accept requests with valid API key', async () => {
    const response = await fetch(`${BASE_URL}/api/dev/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEV_SCRAPER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ snkrdunkId: '818700' })
    });
    
    // Should not be 401 (authentication passed)
    expect(response.status).not.toBe(401);
    
    // May be 500 if scraping fails, but authentication should pass
    if (response.status === 500) {
      const data = await response.json();
      console.log('⚠️  Scraping failed (expected in test environment):', data.error);
      expect(data.success).toBe(false);
    } else {
      // If scraping succeeds
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.snkrdunkId).toBe('818700');
      console.log('✅ Scraping succeeded:', data);
    }
    
    console.log('✅ API key authentication passed');
  }, 15000); // 15秒超時（爬取需要時間）

  it('should reject requests without snkrdunkId', async () => {
    const response = await fetch(`${BASE_URL}/api/dev/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEV_SCRAPER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Missing snkrdunkId parameter');
    
    console.log('✅ Correctly rejected request without snkrdunkId');
  });
});
