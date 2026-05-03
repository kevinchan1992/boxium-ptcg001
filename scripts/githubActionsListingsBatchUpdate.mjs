/**
 * GitHub Actions SNKRDUNK Listings Batch Update Script
 *
 * Updates the snkrdunkListingsCache table for ALL cards with SNKRDUNK data sources.
 * This is SEPARATE from githubActionsBatchUpdate.mjs which handles price HISTORY.
 *
 * This script updates ON-SALE LISTINGS (current available items) every 6 hours.
 *
 * Self-contained ES Module using ONLY Node.js built-in modules + mysql2.
 * NO axios dependency - uses Node.js 22 built-in fetch() API.
 *
 * Required env: DATABASE_URL (MySQL connection string)
 * Optional env: PARALLEL, SKIP_HOT_CACHE_HOURS, MAX_CONSECUTIVE_ERR, REQUEST_TIMEOUT_MS
 */

import mysql from 'mysql2/promise';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  PARALLEL: parseInt(process.env.PARALLEL || '4', 10),
  // Skip cards whose hot cache is still valid (updated within this many hours)
  // Default: 1 hour — matches the hotExpiresAt TTL in the cache
  SKIP_HOT_CACHE_HOURS: parseFloat(process.env.SKIP_HOT_CACHE_HOURS || '1'),
  MAX_CONSECUTIVE_ERRORS: parseInt(process.env.MAX_CONSECUTIVE_ERR || '30', 10),
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT_MS || '12000', 10),
  DELAY_BETWEEN_BATCHES: 300,   // ms between parallel batches
  DELAY_AFTER_ERROR: 800,       // ms extra delay after a batch with errors
  PROGRESS_LOG_INTERVAL: 50,
  JPY_TO_HKD_RATE: 0.055,
  MAX_RETRIES: 3,               // Retry transient errors up to 3 times
  RETRY_DELAY_MS: 2000,         // Base wait between retries (exponential: 2s, 4s, 6s)
  // Hot cache TTL written into DB (1 hour)
  HOT_CACHE_TTL_MS: 1 * 60 * 60 * 1000,
  // Cold cache TTL written into DB (6 hours)
  COLD_CACHE_TTL_MS: 6 * 60 * 60 * 1000,
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
      connectionLimit: 10,
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

function convertJpyToHkd(jpy) {
  return Math.round(jpy * CONFIG.JPY_TO_HKD_RATE * 100) / 100;
}

function extractSnkrdunkId(url) {
  if (!url) return null;
  const m = url.match(/\/apparels\/(\d+)/);
  return m ? m[1] : null;
}

// ─── SNKRDUNK API Fetcher ─────────────────────────────────────────────────────
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

/**
 * Fetch on-sale listings from SNKRDUNK API for a single card.
 * Endpoint: GET /v1/apparels/{snkrdunkId}/used
 * Returns all conditions (PSA 10, A, B, C, D, etc.)
 */
async function fetchOnSaleListings(snkrdunkId) {
  const url = new URL(`https://snkrdunk.com/v1/apparels/${snkrdunkId}/used`);
  url.searchParams.set('perPage', '50');
  url.searchParams.set('page', '1');
  url.searchParams.set('order', '');
  url.searchParams.set('withAllColors', 'false');
  url.searchParams.set('isSaleOnly', 'true');
  url.searchParams.set('conditionIds', '-1');

  let resp;
  try {
    resp = await fetchWithTimeout(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ja,en;q=0.9',
        'Referer': `https://snkrdunk.com/apparels/${snkrdunkId}/used`,
        'Origin': 'https://snkrdunk.com',
      },
    }, CONFIG.REQUEST_TIMEOUT);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error(`Request timeout after ${CONFIG.REQUEST_TIMEOUT}ms for snkrdunkId=${snkrdunkId}`),
        { code: 'ECONNABORTED' }
      );
    }
    throw err;
  }

  if (!resp.ok) {
    if (resp.status === 404) {
      // Card not found on SNKRDUNK — return empty (not an error)
      return [];
    }
    const isTransient = resp.status === 429 || resp.status === 503 || resp.status === 502 || resp.status === 500;
    throw Object.assign(
      new Error(`HTTP ${resp.status} for snkrdunkId=${snkrdunkId}`),
      { httpStatus: resp.status, isTransient }
    );
  }

  const data = await resp.json();
  const items = data.apparelUsedItems || [];

  // Convert to unified listing format (same as snkrdunkApi.ts)
  return items.map((item) => {
    const priceHKD = convertJpyToHkd(item.price);
    const rawCondition = item.displayShortConditionTitle || item.displayWearCount || '';
    // Normalize: PSA10 → PSA 10, BGS10 → BGS 10
    const grade = rawCondition
      .replace(/^PSA(\d)/, 'PSA $1')
      .replace(/^BGS(\d)/, 'BGS $1');
    const listingId = String(item.id);
    return {
      url: `https://snkrdunk.com/apparels/${snkrdunkId}/used/${listingId}`,
      listingId,
      price: priceHKD,
      currency: 'HKD',
      grade,
      image: item.primaryPhoto?.imageUrl || undefined,
      status: 'on-sale',
    };
  }).sort((a, b) => a.price - b.price); // sort by price ascending
}

// ─── Database Operations ──────────────────────────────────────────────────────

/**
 * Get all cards with SNKRDUNK data sources (single_card only for /pricing page).
 * Returns: { cardId, snkrdunkId, cardName, hotExpiresAt }
 */
async function getAllSnkrdunkCards() {
  const db = await getPool();
  const [rows] = await db.execute(
    `SELECT ds.cardId, ds.sourceUrl, c.name as cardName,
            slc.hotExpiresAt, slc.id as cacheId
     FROM dataSources ds
     LEFT JOIN cards c ON c.id = ds.cardId
     LEFT JOIN snkrdunkListingsCache slc ON slc.cardId = ds.cardId
     WHERE ds.source = 'snkrdunk'
       AND ds.isActive = 1
       AND (ds.productType IS NULL OR ds.productType = 'single_card')
     ORDER BY ds.cardId`
  );

  // Deduplicate by cardId (take first occurrence)
  const seen = new Set();
  const cards = [];
  for (const row of rows) {
    if (seen.has(row.cardId)) continue;
    const snkrdunkId = extractSnkrdunkId(row.sourceUrl);
    if (!snkrdunkId) continue;
    seen.add(row.cardId);
    cards.push({
      cardId: row.cardId,
      snkrdunkId,
      cardName: row.cardName || `Card ${row.cardId}`,
      hotExpiresAt: row.hotExpiresAt ? new Date(row.hotExpiresAt) : null,
      hasCacheEntry: row.cacheId != null,
    });
  }
  return cards;
}

/**
 * Upsert snkrdunkListingsCache for a card.
 * Uses DELETE + INSERT (same pattern as db.ts saveSnkrdunkListingsCache).
 */
async function saveListingsCache(cardId, snkrdunkId, listings) {
  const db = await getPool();
  const now = new Date();
  const hotExpiresAt = new Date(now.getTime() + CONFIG.HOT_CACHE_TTL_MS);
  const expiresAt = new Date(now.getTime() + CONFIG.COLD_CACHE_TTL_MS);
  const listingsJson = JSON.stringify(listings);

  // Delete existing, then insert fresh
  await db.execute(
    'DELETE FROM snkrdunkListingsCache WHERE cardId = ?',
    [cardId]
  );
  await db.execute(
    `INSERT INTO snkrdunkListingsCache
       (cardId, snkrdunkId, listings, hotExpiresAt, expiresAt, cachedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [cardId, snkrdunkId, listingsJson, hotExpiresAt, expiresAt]
  );
}

// ─── Process Single Card (with retry) ────────────────────────────────────────
async function processSingleCard(card, attempt = 1) {
  const key = `card:${card.cardId}(${card.snkrdunkId})`;
  try {
    const listings = await fetchOnSaleListings(card.snkrdunkId);
    await saveListingsCache(card.cardId, card.snkrdunkId, listings);
    return { success: true, key, listingCount: listings.length };
  } catch (err) {
    const isTimeout = err.code === 'ECONNABORTED' || err.name === 'AbortError' ||
      (err.message && err.message.includes('timeout'));
    const isTransient = isTimeout || err.isTransient === true;

    // Auto-retry transient errors with exponential backoff
    if (isTransient && attempt < CONFIG.MAX_RETRIES) {
      const waitMs = CONFIG.RETRY_DELAY_MS * attempt; // 2s, 4s, 6s
      console.warn(`[ListingsUpdate] RETRY ${attempt}/${CONFIG.MAX_RETRIES - 1} for ${key} after ${waitMs}ms: ${err.message}`);
      await delay(waitMs);
      return processSingleCard(card, attempt + 1);
    }

    const retryInfo = attempt > 1 ? ` (after ${attempt - 1} retries)` : '';
    console.error(`[ListingsUpdate] ERROR ${key}${retryInfo}: ${err.message}${isTransient ? ' (transient, skipped)' : ' (permanent)'}`);
    return { success: false, key, isTransient, error: err.message || String(err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('[ListingsUpdate] GitHub Actions SNKRDUNK Listings Batch Update');
  console.log(`[ListingsUpdate] Config: PARALLEL=${CONFIG.PARALLEL}, SKIP_HOT_CACHE_HOURS=${CONFIG.SKIP_HOT_CACHE_HOURS}`);
  console.log('='.repeat(60));

  const allCards = await getAllSnkrdunkCards();
  console.log(`[ListingsUpdate] Found ${allCards.length} total SNKRDUNK single-card data sources`);

  const now = new Date();
  const skipMs = CONFIG.SKIP_HOT_CACHE_HOURS * 3600 * 1000;

  // Skip cards whose hot cache is still valid (updated within SKIP_HOT_CACHE_HOURS)
  const toUpdate = allCards.filter(card => {
    if (!card.hotExpiresAt) return true; // No cache yet → must update
    // Hot cache expires in the future AND was set recently → skip
    const hotExpiresMs = card.hotExpiresAt.getTime();
    const hotSetMs = hotExpiresMs - CONFIG.HOT_CACHE_TTL_MS; // when hot cache was set
    const ageMs = now.getTime() - hotSetMs;
    return ageMs >= skipMs; // Only update if cache is older than SKIP_HOT_CACHE_HOURS
  });

  const skippedCount = allCards.length - toUpdate.length;
  console.log(`[ListingsUpdate] Skipping ${skippedCount} cards with fresh hot cache, updating ${toUpdate.length} cards`);

  if (!toUpdate.length) {
    console.log('[ListingsUpdate] Nothing to update. All cards have fresh listings cache.');
    await (await getPool()).end();
    return;
  }

  // ── Batch runner ──
  async function runBatch(items, label) {
    let successCount = 0, failCount = 0, transientFailCount = 0, consecutiveErrors = 0;
    const transientFailed = [];
    let totalListings = 0;

    for (let i = 0; i < items.length; i += CONFIG.PARALLEL) {
      const batch = items.slice(i, i + CONFIG.PARALLEL);
      const results = await Promise.allSettled(batch.map(card => processSingleCard(card)));

      let batchHadError = false;
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          if (r.value.success) {
            successCount++;
            consecutiveErrors = 0;
            totalListings += r.value.listingCount || 0;
          } else {
            failCount++;
            batchHadError = true;
            if (r.value.isTransient) {
              transientFailCount++;
              transientFailed.push(batch[idx]);
            } else {
              consecutiveErrors++;
            }
          }
        } else {
          failCount++;
          batchHadError = true;
          consecutiveErrors++;
        }
      });

      const total = successCount + failCount;
      if (total % CONFIG.PROGRESS_LOG_INTERVAL === 0 || i + CONFIG.PARALLEL >= items.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? total / elapsed : 0;
        const eta = speed > 0 ? (items.length - total) / speed : 0;
        console.log(
          `[ListingsUpdate] ${label}${total}/${items.length} | ✅${successCount} ❌${failCount} ` +
          `| ${speed.toFixed(1)}/s | ETA:${Math.ceil(eta / 60)}min | listings:${totalListings}`
        );
      }

      if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
        console.error(`[ListingsUpdate] Auto-stopped: ${consecutiveErrors} consecutive errors`);
        break;
      }

      // Small delay between batches to be polite to the API
      await delay(batchHadError ? CONFIG.DELAY_AFTER_ERROR : CONFIG.DELAY_BETWEEN_BATCHES);
    }
    return { successCount, failCount, transientFailCount, transientFailed, totalListings };
  }

  // ── Main batch ──
  const mainResult = await runBatch(toUpdate, '');
  let successCount = mainResult.successCount;
  let failCount = mainResult.failCount;
  let totalListings = mainResult.totalListings;

  // ── Retry round: re-process transient failures once more ──
  if (mainResult.transientFailed.length > 0) {
    console.log(`[ListingsUpdate] Retry round: ${mainResult.transientFailed.length} transient failures, retrying after 5s...`);
    await delay(5000);
    const retryResult = await runBatch(mainResult.transientFailed, '[Retry] ');
    successCount += retryResult.successCount;
    failCount = failCount - mainResult.transientFailed.length + retryResult.failCount;
    totalListings += retryResult.totalListings;
    console.log(`[ListingsUpdate] Retry round done: +${retryResult.successCount} recovered, ${retryResult.failCount} still failed`);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const durationMs = Date.now() - startTime;
  console.log('='.repeat(60));
  console.log(`[ListingsUpdate] COMPLETED: ${successCount} success, ${failCount} failed in ${Math.ceil(elapsed / 60)}min`);
  console.log(`[ListingsUpdate] Total listings cached: ${totalListings} across ${successCount} cards`);
  console.log('='.repeat(60));

  await (await getPool()).end();

  // ─── Report results to platform API ──────────────────────────────────────────
  const platformUrl = process.env.PLATFORM_URL;
  const cronSecret = process.env.CRON_SECRET;
  const runId = process.env.GITHUB_RUN_ID || null;
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && runId
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`
    : null;

  const failRate = failCount / (successCount + failCount || 1);
  const finalStatus = (failRate > 0.5 && failCount > 50) ? 'failed' : 'completed';

  if (platformUrl && cronSecret) {
    try {
      const reportUrl = `${platformUrl}/api/scheduled/listings-batch-report`;
      const body = JSON.stringify({
        totalItems: toUpdate.length,
        successCount,
        failureCount: failCount,
        totalListings,
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
        console.log(`[ListingsUpdate] Platform report sent successfully (${resp.status})`);
      } else {
        const text = await resp.text().catch(() => '');
        console.warn(`[ListingsUpdate] Platform report failed: HTTP ${resp.status} - ${text}`);
      }
    } catch (reportErr) {
      console.warn(`[ListingsUpdate] Platform report error (non-fatal): ${reportErr.message}`);
    }
  } else {
    console.log('[ListingsUpdate] PLATFORM_URL or CRON_SECRET not set, skipping platform report');
  }

  if (finalStatus === 'failed') {
    console.error(`[ListingsUpdate] High failure rate: ${(failRate * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[ListingsUpdate] FATAL:', err);
  process.exit(1);
});
