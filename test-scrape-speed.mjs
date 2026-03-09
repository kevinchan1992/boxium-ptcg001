/**
 * SNKRDUNK 爬取速度測試腳本
 * 測試 listings API 和 price history API 的實際速度
 */
import https from 'https';

const SNKRDUNK_API_BASE = "https://snkrdunk.com/en/v1";

// 測試用的卡牌 ID（從資料庫中已知的 SNKRDUNK ID）
const TEST_IDS = [
  "100090",  // 用戶報告的卡牌
  "450624",  // 另一張卡
  "123456",  // 隨機測試
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://snkrdunk.com/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch(e) {
          resolve({ status: res.statusCode, data: null, raw: data.slice(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function testListingsApi(snkrdunkId) {
  const url = `${SNKRDUNK_API_BASE}/trading-cards/${snkrdunkId}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=true`;
  const start = Date.now();
  try {
    const result = await httpsGet(url);
    const elapsed = Date.now() - start;
    const count = result.data?.usedTradingCards?.length ?? 0;
    return { api: 'listings', id: snkrdunkId, elapsed, status: result.status, count, ok: result.status === 200 };
  } catch(e) {
    return { api: 'listings', id: snkrdunkId, elapsed: Date.now() - start, error: e.message, ok: false };
  }
}

async function testSalesHistoryApi(snkrdunkId) {
  const url = `${SNKRDUNK_API_BASE}/trading-cards/${snkrdunkId}/sales-history?perPage=50&page=1`;
  const start = Date.now();
  try {
    const result = await httpsGet(url);
    const elapsed = Date.now() - start;
    const count = result.data?.usedTradingCards?.length ?? result.data?.salesHistory?.length ?? 0;
    return { api: 'sales-history', id: snkrdunkId, elapsed, status: result.status, count, ok: result.status === 200, keys: result.data ? Object.keys(result.data) : [] };
  } catch(e) {
    return { api: 'sales-history', id: snkrdunkId, elapsed: Date.now() - start, error: e.message, ok: false };
  }
}

async function testPriceHistoryApi(snkrdunkId) {
  // This is the API used in routers.ts for price history
  const url = `${SNKRDUNK_API_BASE}/trading-cards/${snkrdunkId}/used-listings?perPage=50&page=1&sortType=latest&isOnlyOnSale=false`;
  const start = Date.now();
  try {
    const result = await httpsGet(url);
    const elapsed = Date.now() - start;
    const count = result.data?.usedTradingCards?.length ?? 0;
    const soldCount = result.data?.usedTradingCards?.filter(i => i.isSold)?.length ?? 0;
    return { api: 'listings-all(sold+onsale)', id: snkrdunkId, elapsed, status: result.status, count, soldCount, ok: result.status === 200 };
  } catch(e) {
    return { api: 'listings-all', id: snkrdunkId, elapsed: Date.now() - start, error: e.message, ok: false };
  }
}

async function main() {
  console.log('=== SNKRDUNK API 速度測試 ===\n');
  
  for (const id of TEST_IDS) {
    console.log(`--- 測試 ID: ${id} ---`);
    
    // Test 1: Listings API (on-sale only) - used by batchUpdateTaskManager
    const r1 = await testListingsApi(id);
    console.log(`[Listings API - on-sale only] ${r1.elapsed}ms | Status: ${r1.status} | Count: ${r1.count} | ${r1.ok ? '✓' : '✗ ' + r1.error}`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Test 2: Listings API (all including sold) - used for price history
    const r2 = await testPriceHistoryApi(id);
    console.log(`[Listings API - all items]    ${r2.elapsed}ms | Status: ${r2.status} | Count: ${r2.count} (sold: ${r2.soldCount}) | ${r2.ok ? '✓' : '✗ ' + r2.error}`);
    
    await new Promise(r => setTimeout(r, 500));
    
    // Test 3: Sales History API
    const r3 = await testSalesHistoryApi(id);
    console.log(`[Sales History API]           ${r3.elapsed}ms | Status: ${r3.status} | Count: ${r3.count} | ${r3.ok ? '✓' : '✗ ' + r3.error} | Keys: ${r3.keys?.join(',')}`);
    
    console.log('');
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Multi-request speed test (simulate batch)
  console.log('=== 批量速度模擬（10張卡連續請求）===');
  const batchIds = ["100090", "450624", "100091", "100092", "100093", "100094", "100095", "100096", "100097", "100098"];
  const batchStart = Date.now();
  let successCount = 0;
  
  for (const id of batchIds) {
    const r = await testListingsApi(id);
    if (r.ok) successCount++;
    process.stdout.write(`  ID ${id}: ${r.elapsed}ms (${r.ok ? 'OK' : 'FAIL'})\n`);
    await new Promise(r => setTimeout(r, 200)); // 200ms delay between requests
  }
  
  const totalTime = Date.now() - batchStart;
  console.log(`\n批量結果: ${successCount}/10 成功 | 總耗時: ${totalTime}ms | 平均: ${Math.round(totalTime/10)}ms/卡`);
  console.log(`理論速度: ${(10000/totalTime * 3600).toFixed(0)} 卡/小時`);
}

main().catch(console.error);
