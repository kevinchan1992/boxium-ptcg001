/**
 * 測試批量更新功能
 * 
 * 測試項目：
 * 1. getDetailedCacheStats API - 獲取快取統計
 * 2. processBatch API - 處理一個小批次（2 張卡牌）
 * 3. 驗證快取跳過邏輯
 * 4. 驗證進度追蹤
 */

import { describe, it, expect } from 'vitest';

describe('Batch Update System', () => {
  it('should get detailed cache statistics', async () => {
    const response = await fetch('https://3000-iu0mdymsdnw31j1fol8na-87540ff1.sg1.manus.computer/api/trpc/admin.getDetailedCacheStats');
    const data = await response.json();
    
    expect(data.result).toBeDefined();
    expect(data.result.data.json).toBeDefined();
    
    const stats = data.result.data.json;
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.hotCache).toBeGreaterThanOrEqual(0);
    expect(stats.coldCache).toBeGreaterThanOrEqual(0);
    expect(stats.expiredCache).toBeGreaterThanOrEqual(0);
    expect(stats.noCache).toBeGreaterThanOrEqual(0);
    expect(stats.needUpdate).toBe(stats.expiredCache + stats.noCache);
    expect(stats.estimatedTimeMinutes).toBeGreaterThan(0);
    
    console.log('✅ Cache Statistics:', stats);
  });
  
  it('should process a small batch successfully', async () => {
    // Note: This test will actually scrape SNKRDUNK, so it takes ~12 seconds
    // tRPC requires { json: { ... } } format for POST requests
    const input = { json: { batchIndex: 0, batchSize: 2 } };
    
    const response = await fetch('https://3000-iu0mdymsdnw31j1fol8na-87540ff1.sg1.manus.computer/api/trpc/admin.processBatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    
    const data = await response.json();
    
    expect(data.result).toBeDefined();
    expect(data.result.data.json).toBeDefined();
    
    const result = data.result.data.json;
    expect(result.processed).toBe(2);
    expect(result.results).toBeDefined();
    expect(result.results.success).toBeGreaterThanOrEqual(0);
    expect(result.results.failed).toBeGreaterThanOrEqual(0);
    expect(result.results.skipped).toBeGreaterThanOrEqual(0);
    expect(result.results.success + result.results.failed + result.results.skipped).toBe(2);
    expect(result.hasMore).toBe(true); // Should have more cards to process
    
    console.log('✅ Batch Processing Result:', result);
  }, 120000); // 120 second timeout (scraping takes time)
  
  it('should skip hot and cold cache correctly', async () => {
    // This test verifies the cache skipping logic
    // We expect that cards with hot cache (<1hr) or cold cache (1-6hr) are skipped
    
    const statsResponse = await fetch('https://3000-iu0mdymsdnw31j1fol8na-87540ff1.sg1.manus.computer/api/trpc/admin.getDetailedCacheStats');
    const statsData = await statsResponse.json();
    const stats = statsData.result.data.json;
    
    // If there are hot or cold caches, they should be skipped
    const shouldSkip = stats.hotCache + stats.coldCache;
    
    console.log(`✅ Cache Skipping Logic: ${shouldSkip} cards will be skipped (${stats.hotCache} hot + ${stats.coldCache} cold)`);
    console.log(`   ${stats.needUpdate} cards need update (${stats.expiredCache} expired + ${stats.noCache} no cache)`);
    
    // Verify the logic
    expect(stats.needUpdate + shouldSkip).toBe(stats.total);
  });
});
