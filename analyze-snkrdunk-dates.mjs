/**
 * 分析 SNKRDUNK API 原始資料，對比資料庫中的記錄
 * 重點：日期格式、時區處理、重複記錄
 * 
 * 執行方式: node -r dotenv/config analyze-snkrdunk-dates.mjs
 * 或: DATABASE_URL=xxx node analyze-snkrdunk-dates.mjs
 */
import https from 'https';
import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Run with: node -r dotenv/config analyze-snkrdunk-dates.mjs');
  process.exit(1);
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://snkrdunk.com/apparels/100090',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data: null, raw: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// 模擬 parseJapaneseDate 函數（現有版本）
function parseJapaneseDateCurrent(dateStr) {
  const now = new Date();
  
  // Handle relative dates like "N日前" (N days ago)
  const daysAgoMatch = dateStr.match(/^(\d+)日前$/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1], 10);
    const jstNow = new Date(now.getTime() + 9 * 3600000);
    const jstDate = new Date(jstNow.getTime() - daysAgo * 24 * 3600000);
    return new Date(Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate()));
  }
  
  // Handle "N時間前" (N hours ago)
  const hoursAgoMatch = dateStr.match(/^(\d+)時間前$/);
  if (hoursAgoMatch) {
    const hoursAgo = parseInt(hoursAgoMatch[1], 10);
    const jstNow = new Date(now.getTime() + 9 * 3600000);
    const jstDate = new Date(jstNow.getTime() - hoursAgo * 3600000);
    return new Date(Date.UTC(jstDate.getUTCFullYear(), jstDate.getUTCMonth(), jstDate.getUTCDate()));
  }
  
  // Handle absolute dates like "2025/12/10"
  const absoluteMatch = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (absoluteMatch) {
    const year = parseInt(absoluteMatch[1], 10);
    const month = parseInt(absoluteMatch[2], 10) - 1;
    const day = parseInt(absoluteMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }
  
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// JPY → HKD 轉換
function convertJpyToHkd(jpy) {
  return Math.round(jpy * 0.052 * 100) / 100;
}

async function main() {
  const conn = await createConnection(DATABASE_URL);
  
  // 1. 取得 SNKRDUNK API 原始資料
  console.log('=== SNKRDUNK API 原始資料（card 812832 / snkrdunkId 100090）===');
  const url = 'https://snkrdunk.com/v1/apparels/100090/sales-history?size_id=0&page=1&per_page=100';
  const result = await httpsGet(url);
  
  if (!result.data || !result.data.history) {
    console.log('API 失敗:', result.status, result.raw);
    await conn.end();
    return;
  }
  
  const history = result.data.history;
  console.log(`API 回傳 ${history.length} 筆記錄`);
  
  // 2. 解析每筆記錄
  const apiRecords = history.map((item, i) => {
    const parsedDate = parseJapaneseDateCurrent(item.date);
    const hkdPrice = convertJpyToHkd(item.price);
    return {
      idx: i + 1,
      rawDate: item.date,
      parsedDateUTC: parsedDate.toISOString().slice(0, 10),
      condition: item.condition,
      jpyPrice: item.price,
      hkdPrice,
    };
  });
  
  // 3. 顯示前 15 筆 API 記錄
  console.log('\n=== API 前 15 筆（含解析結果）===');
  apiRecords.slice(0, 15).forEach(r => {
    console.log(`[${r.idx}] rawDate: "${r.rawDate}" → UTC: ${r.parsedDateUTC} | ${r.condition} | ¥${r.jpyPrice} → HKD ${r.hkdPrice}`);
  });
  
  // 4. 日期格式統計
  const dateFormats = {};
  history.forEach(item => {
    const d = item.date;
    let format = 'unknown';
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(d)) format = 'YYYY/MM/DD';
    else if (/\d+日前/.test(d)) format = 'N日前';
    else if (/\d+時間前/.test(d)) format = 'N時間前';
    else if (/\d+分前/.test(d)) format = 'N分前';
    else if (/昨日/.test(d)) format = '昨日';
    dateFormats[format] = (dateFormats[format] || 0) + 1;
  });
  console.log('\n=== 日期格式分佈 ===');
  console.log(JSON.stringify(dateFormats));
  
  // 5. 相對日期詳情
  const relative = history.filter(item => !/^\d{4}\/\d{2}\/\d{2}$/.test(item.date));
  if (relative.length > 0) {
    console.log('\n=== 相對日期原始值 ===');
    relative.forEach(item => {
      const parsed = parseJapaneseDateCurrent(item.date);
      console.log(`  "${item.date}" → ${parsed.toISOString().slice(0, 10)} | ${item.condition} | ¥${item.price}`);
    });
  }
  
  // 6. 對比資料庫記錄
  const [dbRows] = await conn.query(`
    SELECT id, price, currency, grade, soldAt, createdAt
    FROM priceHistory
    WHERE cardId = 812832 AND source = 'snkrdunk'
    ORDER BY soldAt DESC, id DESC
    LIMIT 20
  `);
  
  console.log('\n=== 資料庫最近 20 筆記錄 ===');
  dbRows.forEach(r => {
    const soldAt = new Date(r.soldAt).toISOString().slice(0, 10);
    console.log(`DB soldAt: ${soldAt} | grade: ${r.grade} | price: ${r.price} HKD`);
  });
  
  // 7. 對比分析：API vs DB（前 20 筆）
  console.log('\n=== 對比分析（API vs DB）===');
  const dbSet = new Set(dbRows.map(r => {
    const soldAt = new Date(r.soldAt).toISOString().slice(0, 10);
    return `${soldAt}|${r.grade}|${parseFloat(r.price).toFixed(2)}`;
  }));
  
  let missingCount = 0;
  apiRecords.slice(0, 20).forEach(r => {
    const key = `${r.parsedDateUTC}|${r.condition}|${r.hkdPrice.toFixed(2)}`;
    if (!dbSet.has(key)) {
      console.log(`  ❌ API 有但 DB 沒有: ${r.parsedDateUTC} | ${r.condition} | HKD ${r.hkdPrice} (原始: "${r.rawDate}")`);
      missingCount++;
    } else {
      console.log(`  ✓  匹配: ${r.parsedDateUTC} | ${r.condition} | HKD ${r.hkdPrice}`);
    }
  });
  
  if (missingCount === 0) {
    console.log('  ✅ 前 20 筆全部匹配！');
  }
  
  // 8. 檢查 SNKRDUNK 網站顯示的「2026/03/08 PSA8以下 HKD60500」是否在 DB 中重複
  console.log('\n=== 重複記錄檢查 ===');
  const [dupes] = await conn.query(`
    SELECT soldAt, grade, price, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
    FROM priceHistory
    WHERE cardId = 812832 AND source = 'snkrdunk'
    GROUP BY soldAt, grade, price
    HAVING cnt > 1
    ORDER BY soldAt DESC
    LIMIT 10
  `);
  
  if (dupes.length === 0) {
    console.log('  ✅ 無重複記錄（按 soldAt+grade+price 去重）');
  } else {
    console.log(`  ❌ 發現 ${dupes.length} 組重複記錄：`);
    dupes.forEach(d => {
      const soldAt = new Date(d.soldAt).toISOString().slice(0, 10);
      console.log(`    ${soldAt} | ${d.grade} | ${d.price} HKD → ${d.cnt} 筆 (IDs: ${d.ids})`);
    });
  }
  
  // 9. 平台顯示的問題：03/07 和 03/08 都有 PSA8以下 HKD60500
  // 這是真實的兩筆不同成交，還是重複？
  console.log('\n=== 特定記錄分析（PSA8以下 HKD60500）===');
  const [specific] = await conn.query(`
    SELECT id, soldAt, grade, price, createdAt
    FROM priceHistory
    WHERE cardId = 812832 AND source = 'snkrdunk' AND grade = 'PSA8以下' AND price = 60500.00
    ORDER BY soldAt DESC
  `);
  specific.forEach(r => {
    const soldAt = new Date(r.soldAt).toISOString().slice(0, 10);
    const createdAt = new Date(r.createdAt).toISOString().slice(0, 16);
    console.log(`  ID:${r.id} | soldAt: ${soldAt} | price: ${r.price} | createdAt: ${createdAt}`);
  });
  
  // 10. 確認 SNKRDUNK 網站的「2日前」和「3日前」對應哪個日期
  // 今天是 2026/03/09 JST，所以：
  // 2日前 = 2026/03/07 JST → UTC 2026/03/07
  // 3日前 = 2026/03/06 JST → UTC 2026/03/06
  // 但 SNKRDUNK 網站顯示 2026/03/08 有 PSA8以下
  // 這說明「2日前」在 API 中已變成 2026/03/07，而 2026/03/08 是另一筆真實成交
  console.log('\n=== 時區分析 ===');
  const nowJST = new Date(Date.now() + 9 * 3600000);
  const nowHKT = new Date(Date.now() + 8 * 3600000);
  console.log(`現在時間 JST: ${nowJST.toISOString().replace('T', ' ').slice(0, 16)}`);
  console.log(`現在時間 HKT: ${nowHKT.toISOString().replace('T', ' ').slice(0, 16)}`);
  console.log(`現在時間 UTC: ${new Date().toISOString().replace('T', ' ').slice(0, 16)}`);
  
  await conn.end();
}

main().catch(console.error);
