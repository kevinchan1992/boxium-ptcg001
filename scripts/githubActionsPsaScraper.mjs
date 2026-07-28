/**
 * GitHub Actions PSA Spec Scraper v1.0
 *
 * Strategy: 20 parallel shards, each handles 1/20 of cards with psaSpecId
 *   - Uses Playwright + PSA refreshToken cookie (no login needed per-run)
 *   - Scrapes PSA spec page HTML for sales history
 *   - Stores results via /api/scheduled/ebay-ingest (source: 'ebay')
 *   - Tiered priority: recently viewed cards first
 *
 * Required env:
 *   DATABASE_URL        MySQL connection string
 *   PLATFORM_URL        Platform base URL
 *   CRON_SECRET         Bearer token for platform API auth
 *   PSA_REFRESH_TOKEN   PSA refreshToken cookie value
 *   BATCH_INDEX         This job's shard index (0-based)
 *   TOTAL_BATCHES       Total number of parallel jobs (e.g. 20)
 *
 * Optional env:
 *   CARDS_PER_BATCH     Max cards per shard (default: 4500)
 *   CARD_IDS            Comma-separated card IDs for single-card mode
 *   HEADLESS            Set to 'false' for debugging (default: true)
 */
import { chromium } from 'playwright';
import mysql from 'mysql2/promise';

// ─── Shard Configuration ──────────────────────────────────────────────────────
const BATCH_INDEX   = parseInt(process.env.BATCH_INDEX   || '0',  10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES || '20', 10);
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH || '4500', 10);
const CARD_IDS_ENV = (process.env.CARD_IDS || '').trim();
const SINGLE_CARD_MODE = CARD_IDS_ENV.length > 0;
const SINGLE_CARD_IDS = SINGLE_CARD_MODE
  ? CARD_IDS_ENV.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
  : [];

const PLATFORM_URL = process.env.PLATFORM_URL;
const CRON_SECRET  = process.env.CRON_SECRET;
const PSA_REFRESH_TOKEN = process.env.PSA_REFRESH_TOKEN;

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  HEADLESS: process.env.HEADLESS !== 'false',
  PAGE_TIMEOUT: 30000,
  NAV_TIMEOUT: 40000,
  DELAY_MIN_MS: 2000,
  DELAY_MAX_MS: 4500,
  RETRY_SLEEP_MS: 120000, // 2 min on block
  MAX_RETRIES: 3,
  INGEST_BATCH: 50,
  PROGRESS_REPORT_INTERVAL: 50,
  USD_TO_HKD: 7.8,
  // Update intervals (days)
  HOT_DAYS: 1,
  WARM_DAYS: 3,
  COLD_DAYS: 7,
};

// ─── Browser Profiles ─────────────────────────────────────────────────────────
const BROWSER_PROFILES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1366, height: 768 },
    timezone: 'America/New_York',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1440, height: 900 },
    timezone: 'America/Los_Angeles',
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    platform: 'Win32',
    language: 'en-US,en;q=0.5',
    viewport: { width: 1600, height: 900 },
    timezone: 'America/Chicago',
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    platform: 'MacIntel',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1280, height: 800 },
    timezone: 'America/Denver',
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    language: 'en-US,en;q=0.9',
    viewport: { width: 1920, height: 1200 },
    timezone: 'America/Toronto',
  },
];
const PROFILE = BROWSER_PROFILES[BATCH_INDEX % BROWSER_PROFILES.length];

// ─── Stealth Script ───────────────────────────────────────────────────────────
const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
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
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
  const _origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (p) =>
    p.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : _origQuery(p);
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = (min, max) => sleep(min + Math.floor(Math.random() * (max - min)));
const startTime = Date.now();
let dbPool = null;

async function getPool() {
  if (!dbPool) {
    dbPool = await mysql.createPool({
      uri: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionLimit: 5,
    });
  }
  return dbPool;
}

// ─── Database: Get cards to scrape ───────────────────────────────────────────
async function getCardsToScrape() {
  const pool = await getPool();
  const hotCutoff  = new Date(Date.now() - CONFIG.HOT_DAYS  * 86400000);
  const warmCutoff = new Date(Date.now() - CONFIG.WARM_DAYS * 86400000);
  const coldCutoff = new Date(Date.now() - CONFIG.COLD_DAYS * 86400000);

  const hotQuota  = Math.ceil(CARDS_PER_BATCH * 0.40);
  const warmQuota = Math.ceil(CARDS_PER_BATCH * 0.35);
  const coldQuota = Math.ceil(CARDS_PER_BATCH * 0.25);

  if (SINGLE_CARD_MODE) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.name, c.cardNumber, c.psaSpecId, c.series, c.setName
       FROM cards c
       WHERE c.id IN (${SINGLE_CARD_IDS.map(() => '?').join(',')})
         AND c.psaSpecId IS NOT NULL`,
      SINGLE_CARD_IDS
    );
    return rows.map(r => ({ ...r, tier: 1 }));
  }

  // T1: Hot — cards with SNKRDUNK data (high value), stale > 1 day
  const [t1] = await pool.execute(
    `SELECT DISTINCT c.id, c.name, c.cardNumber, c.psaSpecId, c.series, c.setName, c.psaScrapedAt
     FROM cards c
     INNER JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'snkrdunk'
     WHERE MOD(c.id, ?) = ?
       AND c.psaSpecId IS NOT NULL
       AND (c.psaScrapedAt IS NULL OR c.psaScrapedAt < ?)
     ORDER BY c.psaScrapedAt ASC, c.id ASC
     LIMIT ?`,
    [TOTAL_BATCHES, BATCH_INDEX, hotCutoff, hotQuota]
  );

  // T2: Warm — cards with existing PSA history, stale > 3 days
  const t1Ids = t1.map(r => r.id);
  const t1Exclude = t1Ids.length > 0 ? `AND c.id NOT IN (${t1Ids.map(() => '?').join(',')})` : '';
  const [t2] = await pool.execute(
    `SELECT DISTINCT c.id, c.name, c.cardNumber, c.psaSpecId, c.series, c.setName, c.psaScrapedAt
     FROM cards c
     INNER JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
     WHERE MOD(c.id, ?) = ?
       AND c.psaSpecId IS NOT NULL
       AND (c.psaScrapedAt IS NULL OR c.psaScrapedAt < ?)
       ${t1Exclude}
     ORDER BY c.psaScrapedAt ASC, c.id ASC
     LIMIT ?`,
    [TOTAL_BATCHES, BATCH_INDEX, warmCutoff, ...t1Ids, warmQuota]
  );

  // T3: Cold — any card with psaSpecId, stale > 7 days
  const t2Ids = t2.map(r => r.id);
  const allExclude = [...t1Ids, ...t2Ids];
  const allExcludeClause = allExclude.length > 0 ? `AND c.id NOT IN (${allExclude.map(() => '?').join(',')})` : '';
  const [t3] = await pool.execute(
    `SELECT c.id, c.name, c.cardNumber, c.psaSpecId, c.series, c.setName
     FROM cards c
     WHERE MOD(c.id, ?) = ?
       AND c.psaSpecId IS NOT NULL
       AND (c.psaScrapedAt IS NULL OR c.psaScrapedAt < ?)
       ${allExcludeClause}
     ORDER BY c.psaScrapedAt ASC, c.id ASC
     LIMIT ?`,
    [TOTAL_BATCHES, BATCH_INDEX, coldCutoff, ...allExclude, coldQuota]
  );

  return [
    ...t1.map(r => ({ ...r, tier: 1 })),
    ...t2.map(r => ({ ...r, tier: 2 })),
    ...t3.map(r => ({ ...r, tier: 3 })),
  ];
}

// ─── Update psaScrapedAt timestamp ───────────────────────────────────────────
async function markCardScraped(cardId) {
  const pool = await getPool();
  await pool.execute('UPDATE cards SET psaScrapedAt = NOW() WHERE id = ?', [cardId]);
}

// ─── Parse PSA Spec Page Sales History ───────────────────────────────────────
function parsePsaSalesHistory(html) {
  // PSA spec page sales history format:
  // <button aria-label="View Details" ...>
  //   <div>
  //     <p>PSA 10</p>
  //     <p>eBay · Auction</p>
  //     <p>Jul 23, 2026</p>
  //   </div>
  //   <p>$8,650.00</p>
  // </button>
  const sales = [];

  // Match all sale entries using regex (faster than DOM parsing)
  // Look for the grade, source, date, price pattern
  const gradePattern = /PSA\s+(\d+|Auth)/gi;
  const pricePattern = /\$[\d,]+\.?\d*/g;
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/g;

  // Extract all matches
  const grades = [...html.matchAll(gradePattern)].map(m => m[0].replace(/\s+/, ' ').trim());
  const prices = [...html.matchAll(pricePattern)].map(m => m[0]);
  const dates  = [...html.matchAll(datePattern)].map(m => m[0]);

  // Pair them up (each sale has grade, date, price in order)
  const count = Math.min(grades.length, prices.length, dates.length);
  for (let i = 0; i < count; i++) {
    const priceStr = prices[i].replace(/[$,]/g, '');
    const priceUsd = parseFloat(priceStr);
    if (isNaN(priceUsd) || priceUsd <= 0) continue;

    const soldAt = new Date(dates[i]);
    if (isNaN(soldAt.getTime())) continue;

    // Only include PSA 10 records (as per platform requirement)
    if (grades[i].toUpperCase() !== 'PSA 10') continue;

    sales.push({
      grade: grades[i],
      priceUsd,
      priceHkd: Math.round(priceUsd * CONFIG.USD_TO_HKD * 100) / 100,
      soldAt,
    });
  }

  return sales;
}

// ─── Scrape PSA Spec Page ─────────────────────────────────────────────────────
async function scrapePsaSpecPage(page, specId, retries = 0) {
  const url = `https://www.psacard.com/spec/psa/${specId}`;
  try {
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.NAV_TIMEOUT,
    });

    const finalUrl = page.url();

    // Check if redirected to login page
    if (finalUrl.includes('signin') || finalUrl.includes('login')) {
      console.log(`  [PSA] ⚠️  Redirected to login for specId=${specId} — cookie may be expired`);
      return { sales: [], blocked: true };
    }

    // Check for Cloudflare block
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required') || title.includes('Access denied')) {
      if (retries < CONFIG.MAX_RETRIES) {
        console.log(`  [PSA] 🛡️  Cloudflare block, sleeping ${CONFIG.RETRY_SLEEP_MS / 1000}s...`);
        await sleep(CONFIG.RETRY_SLEEP_MS);
        return scrapePsaSpecPage(page, specId, retries + 1);
      }
      return { sales: [], blocked: true };
    }

    // Wait for sales history to load
    try {
      await page.waitForSelector('button[aria-label="View Details"]', { timeout: 10000 });
    } catch (_) {
      // No sales history found (card has no PSA sales)
      console.log(`  [PSA] ℹ️  No sales history for specId=${specId}`);
      return { sales: [], blocked: false };
    }

    // Try to load more records (click "Load More" button if present)
    let loadMoreClicks = 0;
    while (loadMoreClicks < 3) {
      try {
        const loadMoreBtn = page.locator('button:has-text("Load More")').first();
        const isVisible = await loadMoreBtn.isVisible({ timeout: 2000 });
        if (!isVisible) break;
        await loadMoreBtn.click();
        await sleep(1500);
        loadMoreClicks++;
      } catch (_) {
        break;
      }
    }

    const html = await page.content();
    const sales = parsePsaSalesHistory(html);
    return { sales, blocked: false };

  } catch (e) {
    if (retries < CONFIG.MAX_RETRIES) {
      console.log(`  [PSA] Error, retry ${retries + 1}: ${e.message.slice(0, 80)}`);
      await sleep(5000);
      return scrapePsaSpecPage(page, specId, retries + 1);
    }
    console.warn(`  [PSA] Failed after ${CONFIG.MAX_RETRIES} retries: ${e.message.slice(0, 80)}`);
    return { sales: [], blocked: false };
  }
}

// ─── Ingest Records via Platform API ─────────────────────────────────────────
async function ingestRecords(records) {
  if (!PLATFORM_URL || !CRON_SECRET || !records.length) return { inserted: 0, skipped: 0 };
  try {
    const resp = await fetch(`${PLATFORM_URL}/api/scheduled/ebay-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn(`[PSA] Ingest HTTP ${resp.status}`);
      return { inserted: 0, skipped: records.length };
    }
    return await resp.json();
  } catch (e) {
    console.warn(`[PSA] Ingest failed: ${e.message}`);
    return { inserted: 0, skipped: records.length };
  }
}

// ─── Report Progress ──────────────────────────────────────────────────────────
async function reportProgress(processed, success, fail, total, inserted) {
  if (!PLATFORM_URL || !CRON_SECRET) return;
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? processed / elapsed : 0;
  const eta = speed > 0 ? Math.ceil((total - processed) / speed / 60) : 0;
  try {
    await fetch(`${PLATFORM_URL}/api/scheduled/github-ebay-batch-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CRON_SECRET}` },
      body: JSON.stringify({
        runId: `psa-scraper-shard${BATCH_INDEX}`,
        totalItems: total, processedItems: processed,
        successCount: success, failureCount: fail,
        startedAt: new Date(startTime).toISOString(),
        speedPerSec: Math.round(speed * 10) / 10,
        etaMinutes: eta, totalInserted: inserted,
        batchIndex: BATCH_INDEX, totalBatches: TOTAL_BATCHES,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (_) {}
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PSA Spec Scraper v1.0`);
  console.log(`Shard: ${BATCH_INDEX + 1}/${TOTAL_BATCHES}`);
  console.log(`Cards per batch: ${CARDS_PER_BATCH}`);
  console.log(`Headless: ${CONFIG.HEADLESS}`);
  console.log(`Profile: ${PROFILE.userAgent.slice(0, 60)}...`);
  console.log(`${'='.repeat(60)}\n`);

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!PSA_REFRESH_TOKEN) {
    console.error('[PSA] PSA_REFRESH_TOKEN is required but not set!');
    process.exit(1);
  }

  const cards = await getCardsToScrape();
  console.log(`📋 Cards to scrape: ${cards.length}`);

  if (cards.length === 0) {
    console.log('[PSA] Nothing to scrape in this shard. All cards are up to date.');
    await (await getPool()).end();
    return;
  }

  // ─── Launch Browser ────────────────────────────────────────────────────────
  console.log(`[PSA] Launching Playwright (headless=${CONFIG.HEADLESS})...`);
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
    },
  });

  // ─── Inject PSA refreshToken cookie ────────────────────────────────────────
  await context.addCookies([
    {
      name: 'refreshToken',
      value: PSA_REFRESH_TOKEN,
      domain: '.psacard.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  // ─── Block unnecessary resources ──────────────────────────────────────────
  await context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet', 'ping'].includes(type)) {
      return route.abort();
    }
    return route.continue();
  });

  await context.addInitScript(STEALTH_SCRIPT);
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT);

  let successCards = 0;
  let failCards = 0;
  let totalInserted = 0;
  let pendingRecords = [];
  let cookieExpired = false;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const tl = `T${card.tier}`;
    console.log(`[PSA] [${i + 1}/${cards.length}][${tl}][shard${BATCH_INDEX}] "${card.name}" (specId=${card.psaSpecId})`);

    if (cookieExpired) {
      console.log('[PSA] Cookie expired, stopping scrape.');
      break;
    }

    try {
      const { sales, blocked } = await scrapePsaSpecPage(page, card.psaSpecId);

      if (blocked) {
        cookieExpired = true;
        failCards++;
        break;
      }

      await markCardScraped(card.id);

      if (sales.length > 0) {
        pendingRecords.push(...sales.map(s => ({
          cardId: card.id,
          priceHkd: s.priceHkd,
          priceUsd: s.priceUsd,
          soldAt: s.soldAt.toISOString(),
          grade: s.grade,
          title: `PSA ${s.grade} | ${card.name} | ${card.cardNumber || ''}`,
          sourcePosition: 0,
        })));
        console.log(`  ✅ ${sales.length} PSA 10 sales found`);
        successCards++;
      } else {
        console.log(`  ⚪ No PSA 10 sales found`);
        successCards++;
      }

      // Flush ingest batch
      if (pendingRecords.length >= CONFIG.INGEST_BATCH) {
        const batch = pendingRecords.splice(0, CONFIG.INGEST_BATCH);
        const result = await ingestRecords(batch);
        totalInserted += result.inserted || 0;
        console.log(`[PSA] Ingested: +${result.inserted} inserted, ${result.skipped} skipped`);
      }

      // Progress report
      if ((i + 1) % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
        await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted);
      }

    } catch (e) {
      console.error(`[PSA] Error for specId=${card.psaSpecId}: ${e.message}`);
      failCards++;
    }

    // Random delay between cards
    if (i < cards.length - 1) {
      await randomDelay(CONFIG.DELAY_MIN_MS, CONFIG.DELAY_MAX_MS);
    }
  }

  // Final flush
  if (pendingRecords.length > 0) {
    const result = await ingestRecords(pendingRecords);
    totalInserted += result.inserted || 0;
    console.log(`[PSA] Final flush: +${result.inserted} inserted`);
  }

  await browser.close();
  await (await getPool()).end();

  const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PSA Spec Scraper — Shard ${BATCH_INDEX} Done in ${elapsed} min`);
  console.log(`  ✅ Success: ${successCards}`);
  console.log(`  ❌ Failed:  ${failCards}`);
  console.log(`  💾 Inserted: ${totalInserted} records`);
  if (cookieExpired) console.log(`  ⚠️  Cookie expired — please update PSA_REFRESH_TOKEN secret`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
