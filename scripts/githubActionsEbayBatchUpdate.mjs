/**
 * GitHub Actions eBay Sold Listings Batch Scraper v3.0
 *
 * Parallel sharding strategy for 55,000+ cards:
 *   - 12 parallel GitHub Actions jobs, each handles 1/12 of the card pool
 *   - BATCH_INDEX (0-11) + TOTAL_BATCHES (12) env vars determine the shard
 *   - Sharding: WHERE MOD(c.id, TOTAL_BATCHES) = BATCH_INDEX
 *
 * Tiered update priority within each shard:
 *   - TIER 1 (Hot):  Cards with SNKRDUNK data source → update every 1 day
 *   - TIER 2 (Warm): Cards with existing eBay records (no SNKRDUNK) → update every 3 days
 *   - TIER 3 (Cold): All other cards (never scraped) → update every 7 days
 *
 * Anti-detection features:
 *   - Extreme asset blocking: images, fonts, CSS, ads, analytics blocked
 *   - Browser fingerprint rotation: randomized User-Agent, platform, language
 *   - navigator.webdriver hidden via page.addInitScript
 *   - Random 2-5s delay between cards
 *   - On failure: sleep 3-5 min, retry up to 3 times
 *   - Staggered startup handled by GitHub Actions workflow
 *
 * Required env:
 *   DATABASE_URL    - MySQL connection string
 *   PLATFORM_URL    - Platform base URL
 *   CRON_SECRET     - Bearer token for platform API auth
 *   BATCH_INDEX     - This job's shard index (0-based)
 *   TOTAL_BATCHES   - Total number of parallel jobs (e.g. 12)
 *
 * Optional env:
 *   CARDS_PER_BATCH - Max cards per job (default: 300)
 *   HEADLESS        - Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import mysql from 'mysql2/promise';

// ─── Shard Configuration ──────────────────────────────────────────────────────
const BATCH_INDEX   = parseInt(process.env.BATCH_INDEX   || '0',  10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES || '12', 10);
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH || '300', 10);

if (isNaN(BATCH_INDEX) || BATCH_INDEX < 0 || BATCH_INDEX >= TOTAL_BATCHES) {
  console.error(`[eBay] Invalid BATCH_INDEX=${BATCH_INDEX} for TOTAL_BATCHES=${TOTAL_BATCHES}`);
  process.exit(1);
}

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  // Tiered update intervals (days)
  TIER1_HOT_DAYS:  1,
  TIER2_WARM_DAYS: 3,
  TIER3_COLD_DAYS: 7,

  // Quota per tier within this shard
  TIER1_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.4),  // 40% hot
  TIER2_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.35), // 35% warm
  TIER3_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.25), // 25% cold

  INGEST_BATCH: 50,
  HEADLESS: process.env.HEADLESS !== 'false',
  USD_TO_HKD: 7.8,
  PAGE_TIMEOUT: 30000,
  NAV_TIMEOUT: 45000,

  // Anti-detection delays
  DELAY_MIN_MS: 2000,        // Min delay between cards
  DELAY_MAX_MS: 5000,        // Max delay between cards
  RETRY_SLEEP_MIN_MS: 180000, // 3 min sleep on failure
  RETRY_SLEEP_MAX_MS: 300000, // 5 min sleep on failure
  MAX_RETRIES: 3,             // Max retries per card

  MAX_PAGES_PER_CARD: 3,
  MAX_LISTINGS_PER_CARD: 60,
  PROGRESS_REPORT_INTERVAL: 20,
};

// ─── Browser Fingerprint Pool ─────────────────────────────────────────────────
// Rotate through realistic browser profiles to avoid fingerprinting
const BROWSER_PROFILES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'en-US',
    viewport: { width: 1920, height: 1080 },
    timezone: 'America/New_York',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1366, height: 768 },
    timezone: 'America/Chicago',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1440, height: 900 },
    timezone: 'America/Los_Angeles',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    platform: 'MacIntel',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1280, height: 800 },
    timezone: 'America/Denver',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    platform: 'Win32',
    language: 'en-US,en;q=0.5',
    viewport: { width: 1600, height: 900 },
    timezone: 'America/Phoenix',
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1920, height: 1200 },
    timezone: 'America/Toronto',
  },
];

// Pick a profile based on batch index (deterministic per job, different per job)
const PROFILE = BROWSER_PROFILES[BATCH_INDEX % BROWSER_PROFILES.length];

// ─── Blocked Resource Patterns ────────────────────────────────────────────────
// Block everything except HTML/JSON to minimize bandwidth and fingerprint surface
const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet', 'ping',
  'websocket', 'manifest', 'other',
]);

const BLOCKED_URL_PATTERNS = [
  // Ad networks
  /doubleclick\.net/i, /googlesyndication\.com/i, /googletagmanager\.com/i,
  /googletagservices\.com/i, /google-analytics\.com/i, /analytics\.google\.com/i,
  // Tracking
  /facebook\.net/i, /fbcdn\.net/i, /twitter\.com\/i\/jot/i,
  /scorecardresearch\.com/i, /quantserve\.com/i, /omtrdc\.net/i,
  // eBay-specific analytics/ads
  /rover\.ebay\.com/i, /ebayrtm\.com/i, /ebayadservices\.com/i,
  /ebayimg\.com/i,  // Block eBay images (we only need text)
  // Generic CDNs for fonts/images
  /fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i,
  /cloudfront\.net\/.*\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf)/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomDelay(minMs, maxMs) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return delay(ms);
}

function parseEbayPrice(priceText) {
  if (!priceText) return null;
  const cleaned = priceText.replace(/[^\d.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseEbaySoldDate(dateText) {
  if (!dateText) return new Date();
  try {
    const cleaned = dateText.replace(/^Sold\s+/i, '').trim();
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (_) {}
  return new Date();
}

function toMysqlDatetime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

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
      connectionLimit: 3,
      charset: 'utf8mb4',
      connectTimeout: 30000,
    });
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[DB] Connected to MySQL database (shard ${BATCH_INDEX}/${TOTAL_BATCHES})`);
  }
  return pool;
}

// ─── Tiered Card Selection (Sharded) ─────────────────────────────────────────
async function getCardsToScrape() {
  const db = await getPool();
  const now = Date.now();

  const tier1Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER1_HOT_DAYS * 86400000));
  const tier2Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER2_WARM_DAYS * 86400000));
  const tier3Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER3_COLD_DAYS * 86400000));

  const tier1Limit = Math.floor(CONFIG.TIER1_QUOTA);
  const tier2Limit = Math.floor(CONFIG.TIER2_QUOTA);
  const tier3Limit = Math.floor(CONFIG.TIER3_QUOTA);

  // TIER 1: Hot cards (SNKRDUNK) in this shard — update daily
  const [tier1Rows] = await db.execute(
    `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
            MAX(ph.soldAt) as lastEbayRecord,
            1 as tier
     FROM cards c
     INNER JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
     LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
     WHERE MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
     GROUP BY c.id, c.name, c.cardNumber
     HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
     ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
     LIMIT ${tier1Limit}`,
    [tier1Cutoff]
  );

  const tier1Ids = tier1Rows.map(r => r.cardId);

  // TIER 2: Warm cards (have eBay history, no SNKRDUNK) in this shard — update every 3 days
  let tier2Rows = [];
  if (tier2Limit > 0) {
    const excludeClause = tier1Ids.length > 0
      ? `AND c.id NOT IN (${tier1Ids.map(() => '?').join(',')})` : '';
    const [rows] = await db.execute(
      `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
              MAX(ph.soldAt) as lastEbayRecord,
              2 as tier
       FROM cards c
       INNER JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
       LEFT JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
       WHERE ds.id IS NULL
         AND MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
         ${excludeClause}
       GROUP BY c.id, c.name, c.cardNumber
       HAVING lastEbayRecord < ?
       ORDER BY lastEbayRecord ASC
       LIMIT ${tier2Limit}`,
      [...tier1Ids, tier2Cutoff]
    );
    tier2Rows = rows;
  }

  const tier2Ids = tier2Rows.map(r => r.cardId);
  const excludeIds = [...tier1Ids, ...tier2Ids];

  // TIER 3: Cold cards (never scraped or stale) in this shard — update every 7 days
  let tier3Rows = [];
  if (tier3Limit > 0) {
    const excludeClause = excludeIds.length > 0
      ? `AND c.id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
    const [rows] = await db.execute(
      `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
              MAX(ph.soldAt) as lastEbayRecord,
              3 as tier
       FROM cards c
       LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
       WHERE MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
         ${excludeClause}
       GROUP BY c.id, c.name, c.cardNumber
       HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
       ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
       LIMIT ${tier3Limit}`,
      [...excludeIds, tier3Cutoff]
    );
    tier3Rows = rows;
  }

  const allRows = [...tier1Rows, ...tier2Rows, ...tier3Rows];

  console.log(`[eBay] Shard ${BATCH_INDEX}/${TOTAL_BATCHES} — T1(hot)=${tier1Rows.length}, T2(warm)=${tier2Rows.length}, T3(cold)=${tier3Rows.length}`);
  console.log(`[eBay] Total cards to scrape this shard: ${allRows.length}`);

  return allRows.map(row => {
    const rawName = row.name || '';
    const bracketIdx = rawName.indexOf('[');
    const engName = bracketIdx > 0 ? rawName.slice(0, bracketIdx).trim() : rawName.trim();
    const cleanName = engName.replace(/[\u3000-\u9fff\uff00-\uffef]/g, '').trim();
    const cardNum = row.cardNumber || '';
    const keyword = `${cleanName} ${cardNum} PSA 10`.trim().replace(/\s+/g, ' ');
    return {
      cardId: row.cardId,
      keyword,
      cardNumber: cardNum,
      lastEbayRecord: row.lastEbayRecord,
      tier: row.tier,
    };
  });
}

// ─── Platform API Helpers ─────────────────────────────────────────────────────
const platformUrl = process.env.PLATFORM_URL;
const cronSecret  = process.env.CRON_SECRET;
const runId       = process.env.GITHUB_RUN_ID || null;
const startTime   = Date.now();

async function ingestRecords(records) {
  if (!platformUrl || !cronSecret || !records.length) return { inserted: 0, skipped: 0 };
  try {
    const resp = await fetch(`${platformUrl}/api/scheduled/ebay-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn(`[eBay] Ingest API error: HTTP ${resp.status}`);
      return { inserted: 0, skipped: records.length };
    }
    return await resp.json();
  } catch (e) {
    console.warn(`[eBay] Ingest API failed (non-fatal): ${e.message}`);
    return { inserted: 0, skipped: records.length };
  }
}

async function reportProgress(processedCards, successCards, failCards, totalCards, totalInserted) {
  if (!platformUrl || !cronSecret) return;
  const elapsed = (Date.now() - startTime) / 1000;
  const speedPerSec = elapsed > 0 ? processedCards / elapsed : 0;
  const remaining = totalCards - processedCards;
  const etaMinutes = speedPerSec > 0 ? Math.ceil(remaining / speedPerSec / 60) : 0;
  try {
    await fetch(`${platformUrl}/api/scheduled/github-ebay-batch-progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        runId: `${runId}-shard${BATCH_INDEX}`,
        totalItems: totalCards,
        processedItems: processedCards,
        successCount: successCards,
        failureCount: failCards,
        startedAt: new Date(startTime).toISOString(),
        speedPerSec: Math.round(speedPerSec * 10) / 10,
        etaMinutes,
        totalInserted,
        batchIndex: BATCH_INDEX,
        totalBatches: TOTAL_BATCHES,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn(`[eBay] Progress report failed (non-fatal): ${e.message}`);
  }
}

async function reportFinal(totalCards, successCards, failCards, totalInserted, status) {
  if (!platformUrl || !cronSecret) return;
  const durationMs = Date.now() - startTime;
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && runId
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`
    : null;
  try {
    const resp = await fetch(`${platformUrl}/api/scheduled/github-ebay-batch-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({
        totalItems: totalCards,
        successCount: successCards,
        failureCount: failCards,
        durationMs,
        startedAt: new Date(startTime).toISOString(),
        status,
        runId: `${runId}-shard${BATCH_INDEX}`,
        runUrl,
        totalInserted,
        batchIndex: BATCH_INDEX,
        totalBatches: TOTAL_BATCHES,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      console.log(`[eBay] Platform final report sent (shard ${BATCH_INDEX})`);
    } else {
      console.warn(`[eBay] Platform final report failed: HTTP ${resp.status}`);
    }
  } catch (e) {
    console.warn(`[eBay] Platform final report error (non-fatal): ${e.message}`);
  }
}

// ─── Stealth Init Script ──────────────────────────────────────────────────────
// Injected into every page before any scripts run — hides automation markers
const STEALTH_SCRIPT = `
  // Hide webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Override plugins to look like a real browser
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const arr = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      arr.__proto__ = PluginArray.prototype;
      return arr;
    }
  });

  // Override languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // Override permissions query to avoid detection
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters)
  );

  // Override chrome object
  window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {},
  };

  // Hide automation-related properties
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
`;

// ─── eBay Scraper ─────────────────────────────────────────────────────────────
async function scrapeEbaySoldListings(page, keyword) {
  const listings = [];
  const encodedKeyword = encodeURIComponent(keyword);

  for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES_PER_CARD; pageNum++) {
    if (listings.length >= CONFIG.MAX_LISTINGS_PER_CARD) break;

    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedKeyword}&LH_Sold=1&LH_Complete=1&_pgn=${pageNum}&_ipg=60`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.NAV_TIMEOUT });

      const title = await page.title();
      if (title.toLowerCase().includes('captcha') || title.toLowerCase().includes('security')) {
        console.warn(`[eBay] CAPTCHA/security page detected for "${keyword}" on page ${pageNum}`);
        return null; // Signal to caller that we need to retry with sleep
      }

      await page.waitForSelector('.srp-results, .s-item__wrapper, #srp-river-results', {
        timeout: CONFIG.PAGE_TIMEOUT,
      }).catch(() => {});

      const pageListings = await page.evaluate(() => {
        const items = [];
        const itemEls = document.querySelectorAll('.s-item__wrapper, li.s-item');
        itemEls.forEach(el => {
          const titleEl = el.querySelector('.s-item__title');
          const title = titleEl?.textContent?.trim() || '';
          if (!title || title.toLowerCase().includes('shop on ebay')) return;

          const priceEl = el.querySelector('.s-item__price');
          const priceText = priceEl?.textContent?.trim() || '';

          const dateEl = el.querySelector('.s-item__ended-date, .s-item__title--tag span, [class*="sold-date"]');
          const dateText = dateEl?.textContent?.trim() || '';

          const linkEl = el.querySelector('a.s-item__link');
          const listingUrl = linkEl?.href || '';

          if (title && priceText) {
            items.push({ title, priceText, dateText, listingUrl });
          }
        });
        return items;
      });

      if (pageListings.length === 0) {
        console.log(`[eBay] No listings on page ${pageNum} for "${keyword}", stopping`);
        break;
      }

      for (const item of pageListings) {
        if (listings.length >= CONFIG.MAX_LISTINGS_PER_CARD) break;
        const priceUsd = parseEbayPrice(item.priceText);
        if (!priceUsd || priceUsd < 5) continue;

        const soldAt = parseEbaySoldDate(item.dateText);
        const priceHkd = Math.round(priceUsd * CONFIG.USD_TO_HKD * 100) / 100;

        listings.push({
          priceUsd,
          priceHkd,
          title: item.title.slice(0, 512),
          soldAt: soldAt.toISOString(),
          listingUrl: item.listingUrl || null,
          grade: 'PSA 10',
        });
      }

      console.log(`[eBay] Page ${pageNum}: ${pageListings.length} listings for "${keyword}" (total: ${listings.length})`);

      if (pageNum < CONFIG.MAX_PAGES_PER_CARD && listings.length < CONFIG.MAX_LISTINGS_PER_CARD) {
        await delay(1200 + Math.random() * 800);
      }
    } catch (err) {
      console.warn(`[eBay] Error on page ${pageNum} for "${keyword}": ${err.message}`);
      break;
    }
  }

  return listings;
}

// ─── Scrape with Retry ────────────────────────────────────────────────────────
async function scrapeWithRetry(page, keyword, cardId) {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const result = await scrapeEbaySoldListings(page, keyword);

      if (result === null) {
        // CAPTCHA or security page — sleep and retry
        const sleepMs = CONFIG.RETRY_SLEEP_MIN_MS + Math.random() * (CONFIG.RETRY_SLEEP_MAX_MS - CONFIG.RETRY_SLEEP_MIN_MS);
        const sleepMin = Math.round(sleepMs / 60000 * 10) / 10;
        console.warn(`[eBay] ⚠️  CAPTCHA detected for cardId=${cardId}, attempt ${attempt}/${CONFIG.MAX_RETRIES}. Sleeping ${sleepMin} min...`);
        await delay(sleepMs);
        continue;
      }

      return result;
    } catch (err) {
      if (attempt < CONFIG.MAX_RETRIES) {
        const sleepMs = CONFIG.RETRY_SLEEP_MIN_MS + Math.random() * (CONFIG.RETRY_SLEEP_MAX_MS - CONFIG.RETRY_SLEEP_MIN_MS);
        const sleepMin = Math.round(sleepMs / 60000 * 10) / 10;
        console.warn(`[eBay] ❌ cardId=${cardId} attempt ${attempt}/${CONFIG.MAX_RETRIES} failed: ${err.message}. Sleeping ${sleepMin} min...`);
        await delay(sleepMs);
      } else {
        throw err;
      }
    }
  }
  return [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log(`[eBay] GitHub Actions eBay Sold Listings Batch Scraper v3.0`);
  console.log(`[eBay] Shard: ${BATCH_INDEX} / ${TOTAL_BATCHES} (0-indexed)`);
  console.log(`[eBay] Profile: ${PROFILE.userAgent.slice(0, 60)}...`);
  console.log(`[eBay] Quota: T1=${CONFIG.TIER1_QUOTA} T2=${CONFIG.TIER2_QUOTA} T3=${CONFIG.TIER3_QUOTA}`);
  console.log('='.repeat(70));

  const cards = await getCardsToScrape();

  if (!cards.length) {
    console.log('[eBay] Nothing to scrape in this shard. All cards are up to date.');
    await (await getPool()).end();
    return;
  }

  console.log(`[eBay] Launching Playwright browser (headless=${CONFIG.HEADLESS})...`);
  const browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--lang=${PROFILE.language.split(',')[0]}`,
    ],
  });

  const context = await browser.newContext({
    userAgent: PROFILE.userAgent,
    viewport: PROFILE.viewport,
    locale: PROFILE.language.split(',')[0],
    timezoneId: PROFILE.timezone,
    extraHTTPHeaders: {
      'Accept-Language': PROFILE.language,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  });

  // ── Extreme asset blocking ──────────────────────────────────────────────────
  await context.route('**/*', (route) => {
    const req = route.request();
    const resourceType = req.resourceType();
    const url = req.url();

    // Block by resource type
    if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
      return route.abort();
    }

    // Block by URL pattern
    for (const pattern of BLOCKED_URL_PATTERNS) {
      if (pattern.test(url)) {
        return route.abort();
      }
    }

    return route.continue();
  });

  const page = await context.newPage();

  // ── Stealth: inject before every page load ──────────────────────────────────
  await page.addInitScript(STEALTH_SCRIPT);

  let successCards = 0;
  let failCards = 0;
  let totalInserted = 0;
  const pendingRecords = [];
  const tierStats = { 1: { success: 0, fail: 0 }, 2: { success: 0, fail: 0 }, 3: { success: 0, fail: 0 } };

  try {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tierLabel = `T${card.tier}`;
      console.log(`[eBay] [${i + 1}/${cards.length}][${tierLabel}][shard${BATCH_INDEX}] "${card.keyword}" (cardId=${card.cardId})`);

      try {
        const listings = await scrapeWithRetry(page, card.keyword, card.cardId);

        if (listings.length > 0) {
          const records = listings.map(l => ({ ...l, cardId: card.cardId }));
          pendingRecords.push(...records);
          successCards++;
          tierStats[card.tier].success++;
          console.log(`[eBay] ✅ [${tierLabel}] cardId=${card.cardId}: ${listings.length} listings`);
        } else {
          successCards++;
          tierStats[card.tier].success++;
          console.log(`[eBay] ⚠️  [${tierLabel}] cardId=${card.cardId}: 0 listings found`);
        }

        // Flush ingest batch
        if (pendingRecords.length >= CONFIG.INGEST_BATCH) {
          const batch = pendingRecords.splice(0, CONFIG.INGEST_BATCH);
          const result = await ingestRecords(batch);
          totalInserted += result.inserted || 0;
          console.log(`[eBay] Ingested batch: +${result.inserted} inserted, ${result.skipped} skipped`);
        }

        // Periodic progress report
        if ((i + 1) % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
          await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted);
        }

        // Random delay between cards (2-5 seconds)
        if (i < cards.length - 1) {
          await randomDelay(CONFIG.DELAY_MIN_MS, CONFIG.DELAY_MAX_MS);
        }
      } catch (err) {
        failCards++;
        tierStats[card.tier].fail++;
        console.error(`[eBay] ❌ [${tierLabel}] cardId=${card.cardId} FAILED after ${CONFIG.MAX_RETRIES} retries: ${err.message}`);
        // Brief pause before continuing to next card
        await delay(5000);
      }
    }

    // Final flush
    if (pendingRecords.length > 0) {
      const result = await ingestRecords(pendingRecords);
      totalInserted += result.inserted || 0;
      console.log(`[eBay] Final flush: +${result.inserted} inserted, ${result.skipped} skipped`);
    }
  } finally {
    await browser.close();
    await (await getPool()).end();
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('='.repeat(70));
  console.log(`[eBay] SHARD ${BATCH_INDEX} COMPLETED in ${Math.ceil(elapsed / 60)}min`);
  console.log(`[eBay] Total: ${successCards} success, ${failCards} failed, ${totalInserted} records inserted`);
  console.log(`[eBay] T1(hot): ${tierStats[1].success} ok / ${tierStats[1].fail} fail`);
  console.log(`[eBay] T2(warm): ${tierStats[2].success} ok / ${tierStats[2].fail} fail`);
  console.log(`[eBay] T3(cold): ${tierStats[3].success} ok / ${tierStats[3].fail} fail`);
  console.log('='.repeat(70));

  const failRate = failCards / (successCards + failCards || 1);
  const finalStatus = (failRate > 0.5 && failCards > 20) ? 'failed' : 'completed';

  await reportFinal(cards.length, successCards, failCards, totalInserted, finalStatus);

  if (finalStatus === 'failed') {
    console.error(`[eBay] High failure rate: ${(failRate * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[eBay] FATAL:', err);
  process.exit(1);
});
