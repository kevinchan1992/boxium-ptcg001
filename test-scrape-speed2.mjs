/**
 * SNKRDUNK 爬取速度對比測試
 * 
 * 比較兩個 API：
 * 1. /v1/apparels/{id}/sales-history  (舊版 JP API - 用於 fetchPriceHistoryFromApi)
 * 2. /en/v1/trading-cards/{id}/used-listings (新版 EN API - 用於 scrapeSnkrdunkListings)
 */
import https from 'https';

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data: null, raw: data.slice(0, 300) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout 15s')); });
  });
}

// 舊版 JP API（fetchPriceHistoryFromApi 使用的）
async function testOldSalesHistoryApi(snkrdunkId) {
  const url = `https://snkrdunk.com/v1/apparels/${snkrdunkId}/sales-history?size_id=0&page=1&per_page=100`;
  const start = Date.now();
  try {
    const result = await httpsGet(url, { 'Referer': `https://snkrdunk.com/apparels/${snkrdunkId}` });
    const elapsed = Date.now() - start;
    const count = result.data?.history?.length ?? 0;
    return { api: 'OLD /v1/apparels/sales-history', elapsed, status: result.status, count, ok: result.status === 200 };
  } catch(e) {
    return { api: 'OLD /v1/apparels/sales-history', elapsed: Date.now() - start, error: e.message, ok: false, status: 0, count: 0 };
  }
}

// 新版 EN API（batchUpdateTaskManager 的 scrapeSnkrdunkListings 使用的）
async function testNewListingsApi(snkrdunkId) {
  const url = `https://snkrdunk.com/en/v1/trading-cards/${snkrdunkId}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=true`;
  const start = Date.now();
  try {
    const result = await httpsGet(url, { 'Referer': 'https://snkrdunk.com/' });
    const elapsed = Date.now() - start;
    const count = result.data?.usedTradingCards?.length ?? 0;
    return { api: 'NEW /en/v1/trading-cards/used-listings', elapsed, status: result.status, count, ok: result.status === 200 };
  } catch(e) {
    return { api: 'NEW /en/v1/trading-cards/used-listings', elapsed: Date.now() - start, error: e.message, ok: false, status: 0, count: 0 };
  }
}

// 從資料庫取得一些真實的 snkrdunkId 來測試
// 注意：batchUpdateTaskManager 使用 card.snkrdunkId（trading card ID）
// 而 fetchPriceHistoryFromApi 使用 apparel ID（不同格式）
async function main() {
  console.log('=== SNKRDUNK API 速度對比測試 ===');
  console.log('時間:', new Date().toISOString());
  console.log('');
  
  // 測試 5 個已知的 ID
  const testIds = ['100090', '450624', '100091', '100092', '100093'];
  
  const oldTimes = [];
  const newTimes = [];
  
  for (const id of testIds) {
    console.log(`--- ID: ${id} ---`);
    
    const r1 = await testOldSalesHistoryApi(id);
    console.log(`  舊版 JP API: ${r1.elapsed}ms | HTTP ${r1.status} | ${r1.count} 筆記錄 | ${r1.ok ? '✓' : '✗ ' + (r1.error || '')}`);
    if (r1.ok) oldTimes.push(r1.elapsed);
    
    await new Promise(r => setTimeout(r, 300));
    
    const r2 = await testNewListingsApi(id);
    console.log(`  新版 EN API: ${r2.elapsed}ms | HTTP ${r2.status} | ${r2.count} 筆記錄 | ${r2.ok ? '✓' : '✗ ' + (r2.error || '')}`);
    if (r2.ok) newTimes.push(r2.elapsed);
    
    console.log('');
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('=== 速度統計 ===');
  if (oldTimes.length > 0) {
    const avg = Math.round(oldTimes.reduce((a,b) => a+b, 0) / oldTimes.length);
    const max = Math.max(...oldTimes);
    const min = Math.min(...oldTimes);
    console.log(`舊版 JP API: 平均 ${avg}ms | 最快 ${min}ms | 最慢 ${max}ms`);
    console.log(`  → 理論速度（含 200ms delay）: ${Math.round(3600000 / (avg + 200))} 卡/小時`);
    console.log(`  → 理論速度（含 2000ms delay）: ${Math.round(3600000 / (avg + 2000))} 卡/小時`);
  }
  if (newTimes.length > 0) {
    const avg = Math.round(newTimes.reduce((a,b) => a+b, 0) / newTimes.length);
    const max = Math.max(...newTimes);
    const min = Math.min(...newTimes);
    console.log(`新版 EN API: 平均 ${avg}ms | 最快 ${min}ms | 最慢 ${max}ms`);
    console.log(`  → 理論速度（含 200ms delay）: ${Math.round(3600000 / (avg + 200))} 卡/小時`);
    console.log(`  → 理論速度（含 2000ms delay）: ${Math.round(3600000 / (avg + 2000))} 卡/小時`);
  }
  
  console.log('');
  console.log('=== 批量任務速度分析 ===');
  console.log('batchUpdateTaskManager 設定:');
  console.log('  batchSize = 50 卡/批');
  console.log('  delayBetweenBatches = 2000ms (2秒)');
  console.log('  每張卡逐一處理（非並發）');
  console.log('');
  console.log('任務 870001 實際數據:');
  console.log('  處理 6850 張卡 | 耗時 147 分鐘 | 速度 0.77 卡/秒');
  console.log('  → 平均每張卡耗時: ~1299ms');
  console.log('');
  console.log('任務 840002 實際數據（昨天）:');
  console.log('  處理 21752 張卡 | 耗時 83 分鐘 | 速度 4.33 卡/秒');
  console.log('  → 平均每張卡耗時: ~231ms');
  console.log('');
  console.log('速度差異: 870001 比 840002 慢了約 5.6 倍');
}

main().catch(console.error);
