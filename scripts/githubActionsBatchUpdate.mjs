/**
 * GitHub Actions SNKRDUNK Batch Update Script v3.0 (Smart Skip)
 *
 * Self-contained ES Module using ONLY Node.js built-in modules + mysql2.
 * NO axios dependency - uses Node.js 22 built-in fetch() API.
 *
 * v3.0 changes:
 *   - Smart Skip: empty cards (no price history) are only re-checked every EMPTY_CARD_RECHECK_DAYS days
 *     (83.9% of cards have no history → skipping them reduces workload by ~6x)
 *   - Priority sort: failed > has-history > empty cards > oldest first
 *   - BATCH_LIMIT now applies AFTER smart-skip filtering
 *
 * Required env: DATABASE_URL (MySQL connection string)
 * Optional env: PARALLEL, SKIP_HOURS, MAX_CONSECUTIVE_ERR, REQUEST_TIMEOUT_MS, EMPTY_CARD_RECHECK_DAYS
 */

import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  PARALLEL: parseInt(process.env.PARALLEL || '8', 10),  // v2: Raised to 8 (stable with stateless HTTP API)
  SKIP_HOURS: parseInt(process.env.SKIP_HOURS || '8', 10),
  BATCH_LIMIT: parseInt(process.env.BATCH_LIMIT || '18547', 10), // 0 = no limit; applies AFTER smart-skip
  // v3.0 Smart Skip: empty cards (no price history) are only re-checked every N days
  // Real-world data: 83.9% of cards (46,775/55,734) have no history → 6x speedup
  EMPTY_CARD_RECHECK_DAYS: parseInt(process.env.EMPTY_CARD_RECHECK_DAYS || '7', 10),
  MAX_CONSECUTIVE_ERRORS: parseInt(process.env.MAX_CONSECUTIVE_ERR || '50', 10),
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),
  DELAY_AFTER_ERROR: 300,   // Reduced from 500ms to 300ms
  PROGRESS_LOG_INTERVAL: 100,
  PROGRESS_REPORT_INTERVAL: 500, // POST mid-run progress to platform every N items
  JPY_TO_HKD_RATE: 0.055,
  MAX_RETRIES: 3,           // Retry transient errors up to 3 times
  RETRY_DELAY_MS: 2000,     // Wait 2s between retries
};

// ─── Database Connection ──────────────────────────────────────────────────────
let pool;
async function getPool() {
  if (!pool) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL environment variable is required');
    const url = dbUrl.includes('timezone=')
      ? dbUrl
      : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}timezone=%2B08:00`;
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 15,
      charset: 'utf8mb4',
      connectTimeout: 30000,
    });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[DB] Connected to MySQL database');
  }
  return pool;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function convertJpyToHkd(jpy) { return Math.round(jpy * CONFIG.JPY_TO_HKD_RATE * 100) / 100; }
function extractSnkrdunkId(url) {
  if (!url) return null;
  const m = url.match(/\/apparels\/(\d+)/);
  return m ? m[1] : null;
}
function parseJapaneseDate(dateStr) {
  if (!dateStr) return new Date();

  // Absolute date: YYYY/MM/DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  }

  // Relative time: N日前, N時間前, N分前, 今日, 昨日, etc.
  const now = new Date();
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // 「N日前」 = N days ago
  const daysAgo = dateStr.match(/(\d+)日前/);
  if (daysAgo) {
    return new Date(nowUTC - parseInt(daysAgo[1]) * 86400000);
  }

  // 「N時間前」 = N hours ago (round to same day)
  const hoursAgo = dateStr.match(/(\d+)時間前/);
  if (hoursAgo) {
    const ms = now.getTime() - parseInt(hoursAgo[1]) * 3600000;
    const d = new Date(ms);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // 「N分前」 = N minutes ago (round to today)
  const minsAgo = dateStr.match(/(\d+)分前/);
  if (minsAgo) {
    return new Date(nowUTC);
  }

  // 「今日」 = today
  if (dateStr === '今日' || dateStr === '今天') {
    return new Date(nowUTC);
  }

  // 「昨日」 = yesterday
  if (dateStr === '昨日' || dateStr === '昨天') {
    return new Date(nowUTC - 86400000);
  }

  // Fallback: try native Date parse, if invalid return today
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    console.warn(`[parseJapaneseDate] Unknown date format: "${dateStr}", using today`);
    return new Date(nowUTC);
  }
  return parsed;
}
function computeRecordHash({ cardId, source, grade, soldAt, jpyPrice, sourcePosition }) {
  const ng = (g) => g ? g.trim().toUpperCase().replace(/\s+/g, ' ') : '__none__';
  const nd = (d) => {
    if (!d) return '__nodate__';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parts = [
    String(cardId),
    (source || '').toLowerCase(),
    ng(grade),
    nd(soldAt),
    String(jpyPrice != null ? Math.round(jpyPrice) : 0),
    String(sourcePosition ?? 0),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

// ─── Grade Normalisation ──────────────────────────────────────────────────────
const GRADE_MAP = {
  'PSA 10': 'PSA 10', 'PSA10': 'PSA 10', 'PSA-10': 'PSA 10',
  'PSA 9': 'PSA 9', 'PSA9': 'PSA 9',
  'PSA 8': 'PSA 8', 'PSA8': 'PSA 8',
  'PSA 7': 'PSA 7', 'PSA7': 'PSA 7',
  'PSA 6': 'PSA 6', 'PSA6': 'PSA 6',
  'PSA 5': 'PSA 5', 'PSA5': 'PSA 5',
  'PSA 4': 'PSA 4', 'PSA4': 'PSA 4',
  'PSA 3': 'PSA 3', 'PSA3': 'PSA 3',
  'PSA 2': 'PSA 2', 'PSA2': 'PSA 2',
  'PSA 1': 'PSA 1', 'PSA1': 'PSA 1',
  'BGS 10': 'BGS 10', 'BGS10': 'BGS 10',
  'BGS 9.5': 'BGS 9.5', 'BGS9.5': 'BGS 9.5',
  'BGS 9': 'BGS 9', 'BGS9': 'BGS 9',
  'CGC 10': 'CGC 10', 'CGC10': 'CGC 10',
  'SGC 10': 'SGC 10', 'SGC10': 'SGC 10',
  '未鑑定': '未鑑定', '中古': '中古', 'NM': 'NM', 'EX': 'EX',
};
function normaliseGrade(raw) {
  if (!raw) return undefined;
  const t = raw.trim();
  return GRADE_MAP[t] || t;
}
const GLOBAL_MIN_JPY = 100;
const MIN_BY_GRADE = { 'PSA 10': 500, 'PSA 9': 300, 'PSA 8': 200 };
function isValidEntry(entry, ng) {
  const p = entry.jpyPrice ?? entry.price;
  if (p < GLOBAL_MIN_JPY) return false;
  if (ng && MIN_BY_GRADE[ng] && p < MIN_BY_GRADE[ng]) return false;
  return true;
}
function validateHistory(entries, productType = 'single_card') {
  if (!entries || entries.length === 0) return [];
  return entries.filter(e => {
    const ng = productType === 'single_card' ? normaliseGrade(e.grade) : undefined;
    if (!isValidEntry(e, ng)) return false;
    e.normalisedGrade = ng;
    return true;
  });
}

// ─── SNKRDUNK API Fetcher (using built-in fetch) ──────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPriceHistoryFromApi(productId, productType = 'single_card') {
  const history = [];
  for (let page = 1; page <= 20; page++) {
    const url = `https://snkrdunk.com/v1/apparels/${productId}/sales-history?size_id=0&page=${page}&per_page=100`;
    let resp;
    try {
      resp = await fetchWithTimeout(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `https://snkrdunk.com/apparels/${productId}`,
        },
      }, CONFIG.REQUEST_TIMEOUT);
    } catch (err) {
      if (err.name === 'AbortError') {
        throw Object.assign(new Error(`Request timeout after ${CONFIG.REQUEST_TIMEOUT}ms`), { code: 'ECONNABORTED' });
      }
      throw err;
    }
    if (!resp.ok) {
      if (resp.status === 404) break;
      // Transient errors: don't mark as failed, let retry handle it
      const isTransient = resp.status === 429 || resp.status === 503 || resp.status === 502 || resp.status === 500;
      const err = Object.assign(new Error(`HTTP ${resp.status} for product ${productId}`), {
        httpStatus: resp.status,
        isTransient,
      });
      throw err;
    }
    const data = await resp.json();
    if (!data.history || !Array.isArray(data.history) || data.history.length === 0) break;
    for (const item of data.history) {
      history.push({
        price: item.price,
        jpyPrice: item.price,
        currency: 'JPY',
        soldAt: parseJapaneseDate(item.date),
        grade: productType === 'single_card' ? (item.condition || undefined) : undefined,
        quantity: productType === 'sealed_product' ? (item.size || undefined) : undefined,
      });
    }
    if (data.history.length < 100) break;
  }
  return history;
}

// ─── Database Operations ──────────────────────────────────────────────────────
async function getAllSnkrdunkProducts() {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT ds.id as dataSourceId, ds.cardId, ds.sourceUrl, ds.productType, ds.lastFetchedAt, ds.lastFetchStatus, c.name
     FROM dataSources ds
     LEFT JOIN cards c ON c.id = ds.cardId
     WHERE ds.source = 'snkrdunk' AND ds.isActive = 1`
  );

  // v3.0 Smart Skip: load set of cardIds that have at least one price history record
  const [histRows] = await db.execute(
    `SELECT DISTINCT cardId FROM priceHistory WHERE source = 'snkrdunk' LIMIT 100000`
  );
  const cardIdsWithHistory = new Set(histRows.map(r => r.cardId));
  console.log(`[BatchUpdate] Smart Skip: ${cardIdsWithHistory.size} cards have price history`);

  const unique = new Map();
  for (const row of rows) {
    const pt = row.productType || 'single_card';
    const key = `${pt}:${row.cardId}`;
    if (unique.has(key)) continue;
    const sid = extractSnkrdunkId(row.sourceUrl);
    if (!sid) continue;
    unique.set(key, {
      id: row.cardId,
      name: row.name || `Product ${row.cardId}`,
      productType: pt,
      snkrdunkId: sid,
      lastFetchedAt: row.lastFetchedAt ? new Date(row.lastFetchedAt) : null,
      lastFetchStatus: row.lastFetchStatus || null,
      sourceUrl: row.sourceUrl || '',
      dataSourceId: row.dataSourceId,
      hasHistory: cardIdsWithHistory.has(row.cardId), // v3.0 Smart Skip flag
    });
  }
  return Array.from(unique.values());
}

async function upsertPriceRecords(records) {
  if (!records.length) return;
  const db = await getPool();
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    const seen = new Set();
    const deduped = chunk.filter(r => {
      if (!r.recordHash) return true;
      if (seen.has(r.recordHash)) return false;
      seen.add(r.recordHash);
      return true;
    });
    if (!deduped.length) continue;
    const ph = deduped.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const vals = deduped.flatMap(r => [
      r.cardId, r.source, r.price, r.currency, r.jpyPrice, r.sourcePosition,
      r.grade || null, r.quantity || null, r.productType,
      r.soldAt ? r.soldAt.toISOString().slice(0, 19).replace('T', ' ') : null,
      r.listingUrl || null, r.recordHash || null,
    ]);
    try {
      await db.execute(
        `INSERT INTO priceHistory (cardId,source,price,currency,jpyPrice,sourcePosition,grade,quantity,productType,soldAt,listingUrl,recordHash)
         VALUES ${ph}
         ON DUPLICATE KEY UPDATE recordHash=VALUES(recordHash)`,
        vals
      );
    } catch (_) {
      for (const r of deduped) {
        try {
          await db.execute(
            `INSERT INTO priceHistory (cardId,source,price,currency,jpyPrice,sourcePosition,grade,quantity,productType,soldAt,listingUrl,recordHash)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE recordHash=VALUES(recordHash)`,
            [r.cardId, r.source, r.price, r.currency, r.jpyPrice, r.sourcePosition,
             r.grade || null, r.quantity || null, r.productType,
             r.soldAt ? r.soldAt.toISOString().slice(0, 19).replace('T', ' ') : null,
             r.listingUrl || null, r.recordHash || null]
          );
        } catch (_2) { /* skip */ }
      }
    }
  }
}

async function updateDataSourceStatus(dataSourceId, status) {
  const db = await getPool();
  await db.execute(
    'UPDATE dataSources SET lastFetchedAt=NOW(), lastFetchStatus=?, updatedAt=NOW() WHERE id=?',
    [status, dataSourceId]
  );
}

// ─── Process Single Product (with retry) ─────────────────────────────────────
async function processSingleProduct(product, attempt = 1) {
  const productKey = `${product.productType}:${product.id}`;
  try {
    const pt = product.productType === 'sealed_product' ? 'sealed_product' : 'single_card';
    const raw = await fetchPriceHistoryFromApi(product.snkrdunkId, pt);
    const history = validateHistory(raw || [], pt);
    if (history && history.length > 0) {
      const counters = new Map();
      const records = history.map(e => {
        const soldAtStr = e.soldAt ? e.soldAt.toISOString().slice(0, 10) : 'unknown';
        const gn = pt === 'single_card' ? (e.normalisedGrade ?? null) : null;
        const jp = e.jpyPrice ?? e.price;
        const grpKey = `${soldAtStr}|${gn ?? 'null'}|${jp}`;
        const pos = counters.get(grpKey) ?? 0;
        counters.set(grpKey, pos + 1);
        return {
          cardId: product.id,
          source: 'snkrdunk',
          price: convertJpyToHkd(e.price).toString(),
          currency: 'HKD',
          jpyPrice: jp,
          sourcePosition: pos,
          grade: gn,
          quantity: pt === 'sealed_product' ? (e.quantity || null) : null,
          productType: pt,
          soldAt: e.soldAt,
          listingUrl: product.sourceUrl,
          recordHash: computeRecordHash({
            cardId: product.id, source: 'snkrdunk', grade: gn,
            soldAt: e.soldAt, jpyPrice: jp, sourcePosition: pos,
          }),
        };
      });
      await upsertPriceRecords(records);
    }
    await updateDataSourceStatus(product.dataSourceId, 'success');
    return { success: true, productKey };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || (err.name === 'AbortError') || (err.message && err.message.includes('timeout'));
    const isTransient = isTimeout || err.isTransient === true;

    // Auto-retry transient errors (rate limit, timeout, server errors)
    if (isTransient && attempt < CONFIG.MAX_RETRIES) {
      const waitMs = CONFIG.RETRY_DELAY_MS * attempt; // exponential backoff: 2s, 4s, 6s
      console.warn(`[BatchUpdate] RETRY ${attempt}/${CONFIG.MAX_RETRIES - 1} for ${productKey} after ${waitMs}ms: ${err.message}`);
      await delay(waitMs);
      return processSingleProduct(product, attempt + 1);
    }

    // Only mark as 'failed' for permanent errors; transient errors keep previous status
    const newStatus = isTransient ? null : 'failed';
    if (newStatus) {
      await updateDataSourceStatus(product.dataSourceId, newStatus).catch(() => {});
    }
    // Log error for debugging in GitHub Actions
    const retryInfo = attempt > 1 ? ` (after ${attempt - 1} retries)` : '';
    console.error(`[BatchUpdate] ERROR ${productKey}${retryInfo}: ${err.message}${isTransient ? ' (transient, skipped)' : ' (failed)'}`);
    return { success: false, productKey, isTimeout, isTransient, error: err.message || String(err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('[BatchUpdate] GitHub Actions SNKRDUNK Batch Update');
  console.log(`[BatchUpdate] Config: PARALLEL=${CONFIG.PARALLEL}, SKIP_HOURS=${CONFIG.SKIP_HOURS}, BATCH_LIMIT=${CONFIG.BATCH_LIMIT || 'unlimited'}`);
  console.log('='.repeat(60));

  const allProducts = await getAllSnkrdunkProducts();
  console.log(`[BatchUpdate] Found ${allProducts.length} total SNKRDUNK products`);

  const now = new Date();
  const skipMs = CONFIG.SKIP_HOURS * 3600 * 1000;
  const emptyCardSkipMs = CONFIG.EMPTY_CARD_RECHECK_DAYS * 24 * 60 * 60 * 1000; // v3.0 Smart Skip

  // v3.0 Smart Skip filter:
  //   - Skip recently updated (within SKIP_HOURS) → same as before
  //   - Skip empty cards (no history) updated within EMPTY_CARD_RECHECK_DAYS days
  //   - Never skip cards with no lastFetchedAt (never fetched before)
  let skippedRecent = 0;
  let skippedEmpty = 0;
  const toUpdate = allProducts
    .filter(p => {
      const age = p.lastFetchedAt ? (now - p.lastFetchedAt) : Infinity;
      if (age < skipMs) { skippedRecent++; return false; }         // recently updated
      if (!p.hasHistory && age < emptyCardSkipMs) { skippedEmpty++; return false; } // empty card within recheck window
      return true;
    })
    .sort((a, b) => {
      // Priority: failed first, then has-history, then empty cards, then oldest first
      const aFailed = a.lastFetchStatus === 'failed' ? 0 : 1;
      const bFailed = b.lastFetchStatus === 'failed' ? 0 : 1;
      if (aFailed !== bFailed) return aFailed - bFailed;
      const aHist = a.hasHistory ? 0 : 1;
      const bHist = b.hasHistory ? 0 : 1;
      if (aHist !== bHist) return aHist - bHist; // has-history first
      const aTime = a.lastFetchedAt ? a.lastFetchedAt.getTime() : 0;
      const bTime = b.lastFetchedAt ? b.lastFetchedAt.getTime() : 0;
      return aTime - bTime; // oldest first
    });

  const failedCount = toUpdate.filter(p => p.lastFetchStatus === 'failed').length;
  const withHistoryCount = toUpdate.filter(p => p.hasHistory).length;

  // Apply BATCH_LIMIT: only process the oldest N products per run (after smart-skip)
  const limitedToUpdate = CONFIG.BATCH_LIMIT > 0 ? toUpdate.slice(0, CONFIG.BATCH_LIMIT) : toUpdate;
  console.log(
    `[BatchUpdate] Smart Skip v3.0: ${allProducts.length} total → ` +
    `skipped ${skippedRecent} recent + ${skippedEmpty} empty (${CONFIG.EMPTY_CARD_RECHECK_DAYS}d) → ` +
    `${toUpdate.length} eligible (${withHistoryCount} with history, ${failedCount} failed → priority)`
  );
  if (CONFIG.BATCH_LIMIT > 0 && toUpdate.length > CONFIG.BATCH_LIMIT) {
    console.log(`[BatchUpdate] BATCH_LIMIT=${CONFIG.BATCH_LIMIT}: processing ${limitedToUpdate.length}/${toUpdate.length} (oldest first)`);
  }

  if (!toUpdate.length) {
    console.log('[BatchUpdate] Nothing to update. All products are up to date.');
    await (await getPool()).end();
    return;
  }

  // ─── Mid-run progress reporter ───────────────────────────────────────────────
  const platformUrl = process.env.PLATFORM_URL;
  const cronSecret = process.env.CRON_SECRET;
  const runId = process.env.GITHUB_RUN_ID || null;
  let lastReportedTotal = 0;

  async function reportProgressToplatform(processedItems, successCount, failCount, totalItems) {
    if (!platformUrl || !cronSecret) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const speedPerSec = elapsed > 0 ? processedItems / elapsed : 0;
    const remaining = totalItems - processedItems;
    const etaMinutes = speedPerSec > 0 ? Math.ceil(remaining / speedPerSec / 60) : 0;
    try {
      await fetch(`${platformUrl}/api/scheduled/github-batch-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
          'User-Agent': 'Mozilla/5.0 (compatible; BoxiumGitHubActions/1.0)',
        },
        body: JSON.stringify({
          runId,
          totalItems,
          processedItems,
          successCount,
          failureCount: failCount,
          startedAt: new Date(startTime).toISOString(),
          speedPerSec: Math.round(speedPerSec * 10) / 10,
          etaMinutes,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      // Non-fatal: progress report failure should not stop the batch
      console.warn(`[BatchUpdate] Progress report failed (non-fatal): ${e.message}`);
    }
  }

  async function runBatch(items, label) {
    let successCount = 0, failCount = 0, transientFailCount = 0, consecutiveErrors = 0;
    const transientFailed = [];

    for (let i = 0; i < items.length; i += CONFIG.PARALLEL) {
      const batch = items.slice(i, i + CONFIG.PARALLEL);
      const results = await Promise.allSettled(batch.map(p => processSingleProduct(p)));

      let batchHadError = false;
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            successCount++; consecutiveErrors = 0;
          } else {
            failCount++; batchHadError = true;
            if (r.value.isTransient) {
              transientFailCount++;
              transientFailed.push(batch[idx]);
            } else if (!r.value.isTimeout) {
              consecutiveErrors++;
            }
          }
        } else {
          failCount++; batchHadError = true; consecutiveErrors++;
        }
      });

      const total = successCount + failCount;
      if (total % CONFIG.PROGRESS_LOG_INTERVAL === 0 || i + CONFIG.PARALLEL >= items.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? total / elapsed : 0;
        const eta = speed > 0 ? (items.length - total) / speed : 0;
        console.log(
          `[BatchUpdate] ${label} ${total}/${items.length} | ✅${successCount} ❌${failCount} ` +
          `| ${speed.toFixed(1)}/s | ETA:${Math.ceil(eta / 60)}min`
        );
      }

      // Mid-run progress report to platform every PROGRESS_REPORT_INTERVAL items
      if (total - lastReportedTotal >= CONFIG.PROGRESS_REPORT_INTERVAL) {
        lastReportedTotal = total;
        await reportProgressToplatform(total, successCount, failCount, limitedToUpdate.length);
      }

      if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
        console.error(`[BatchUpdate] Auto-stopped: ${consecutiveErrors} consecutive errors`);
        break;
      }
      if (batchHadError) await delay(CONFIG.DELAY_AFTER_ERROR);
    }
    return { successCount, failCount, transientFailCount, transientFailed };
  }

  // ── Main batch ──
  const mainResult = await runBatch(limitedToUpdate, '');
  let successCount = mainResult.successCount;
  let failCount = mainResult.failCount;

  // ── Retry round: re-process transient failures once more ──
  if (mainResult.transientFailed.length > 0) {
    console.log(`[BatchUpdate] Retry round: ${mainResult.transientFailed.length} transient failures, retrying...`);
    await delay(5000); // wait 5s before retry round
    const retryResult = await runBatch(mainResult.transientFailed, '[Retry]');
    successCount += retryResult.successCount;
    failCount = failCount - mainResult.transientFailed.length + retryResult.failCount;
    console.log(`[BatchUpdate] Retry round done: +${retryResult.successCount} recovered, ${retryResult.failCount} still failed`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const durationMs = Date.now() - startTime;
  console.log('='.repeat(60));
  console.log(`[BatchUpdate] COMPLETED: ${successCount} success, ${failCount} failed in ${Math.ceil(elapsed / 60)}min`);
  console.log('='.repeat(60));

  await (await getPool()).end();

  // ─── Report results to platform API ──────────────────────────────────────────────────
  // platformUrl, cronSecret, runId are already defined above (mid-run progress reporter)
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && runId
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`
    : null;

  const failRate = failCount / (successCount + failCount || 1);
  const finalStatus = (failRate > 0.5 && failCount > 100) ? 'failed' : 'completed';

  if (platformUrl && cronSecret) {
    try {
      const reportUrl = `${platformUrl}/api/scheduled/github-batch-report`;
      const body = JSON.stringify({
        totalItems: toUpdate.length,
        successCount,
        failureCount: failCount,
        durationMs,
        startedAt: new Date(startTime).toISOString(),
        status: finalStatus,
        runId,
        runUrl,
      });
      const resp = await fetch(reportUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        console.log(`[BatchUpdate] Platform report sent successfully (${resp.status})`);
      } else {
        const text = await resp.text().catch(() => '');
        console.warn(`[BatchUpdate] Platform report failed: HTTP ${resp.status} - ${text}`);
      }
    } catch (reportErr) {
      console.warn(`[BatchUpdate] Platform report error (non-fatal): ${reportErr.message}`);
    }
  } else {
    console.log('[BatchUpdate] PLATFORM_URL or CRON_SECRET not set, skipping platform report');
  }

  if (finalStatus === 'failed') {
    console.error(`[BatchUpdate] High failure rate: ${(failRate * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[BatchUpdate] FATAL:', err);
  process.exit(1);
});
