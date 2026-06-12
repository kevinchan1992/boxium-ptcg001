/**
 * GitHub Actions eBay Sold Listings Batch Scraper v3.1
 *
 * Strategy: Full Coverage (Method A)
 *   - 12 parallel GitHub Actions jobs, each handles 1/12 of the card pool
 *   - 12 × 4700 = 56,400 cards/day → covers all 56K cards daily
 *   - Sharding: WHERE MOD(c.id, TOTAL_BATCHES) = BATCH_INDEX
 *
 * Anti-detection features:
 *   ① Extreme asset blocking  — images, fonts, CSS, ads, analytics all aborted
 *      → page load drops from ~3s to <1s; only HTML text is read
 *   ② Browser fingerprint rotation — 6 realistic UA/platform/language/viewport/tz profiles
 *   ③ Stealth init script — hides navigator.webdriver, fakes plugins & chrome object
 *   ④ Dynamic random delay — 1.5–3.5s between cards
 *   ⑤ Smart retry & skip — on 403/CAPTCHA: sleep 3 min, retry up to 3×; then SKIP card
 *      (skipped cards logged to skipped-cards.json for next day's run)
 *
 * Tiered priority within each shard:
 *   T1 (Hot, 40%)  — SNKRDUNK cards, update every 1 day
 *   T2 (Warm, 35%) — cards with eBay history, update every 3 days
 *   T3 (Cold, 25%) — never scraped or stale, update every 7 days
 *
 * Required env:
 *   DATABASE_URL    MySQL connection string
 *   PLATFORM_URL    Platform base URL
 *   CRON_SECRET     Bearer token for platform API auth
 *   BATCH_INDEX     This job's shard index (0-based)
 *   TOTAL_BATCHES   Total number of parallel jobs (e.g. 12)
 *
 * Optional env:
 *   CARDS_PER_BATCH Max cards per job (default: 4700)
 *   HEADLESS        Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// ─── Shard Configuration ──────────────────────────────────────────────────────
const BATCH_INDEX   = parseInt(process.env.BATCH_INDEX   || '0',  10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES || '12', 10);
// 56,000 ÷ 12 ≈ 4,667 cards/shard; at 2.5s/card ≈ 194 min ≈ 3.2h (well within 5.5h limit)
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH || '4700', 10);

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

  // Quota per tier within this shard (40% / 35% / 25%)
  TIER1_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.40),
  TIER2_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.35),
  TIER3_QUOTA: Math.ceil(CARDS_PER_BATCH * 0.25),

  INGEST_BATCH: 50,
  HEADLESS: process.env.HEADLESS !== 'false',
  USD_TO_HKD: 7.8,
  PAGE_TIMEOUT: 25000,
  NAV_TIMEOUT:  35000,

  // ① Dynamic random delay between cards: 1.5–3.5s
  DELAY_MIN_MS: 1500,
  DELAY_MAX_MS: 3500,

  // ⑤ On block/CAPTCHA: sleep 3 min then retry
  RETRY_SLEEP_MS: 180000,   // 3 minutes
  MAX_RETRIES: 3,

  MAX_PAGES_PER_CARD: 3,
  MAX_LISTINGS_PER_CARD: 60,
  PROGRESS_REPORT_INTERVAL: 50,
};

// ─── ② Browser Fingerprint Pool ───────────────────────────────────────────────
const BROWSER_PROFILES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'en-US,en;q=0.9',
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

// Each shard gets a deterministic but unique profile
const PROFILE = BROWSER_PROFILES[BATCH_INDEX % BROWSER_PROFILES.length];

// ─── ① Blocked Resource Types & URL Patterns ─────────────────────────────────
// Block static assets only — do NOT block xhr/fetch/script/other as eBay uses
// dynamic requests to load search results (blocking them causes 0 listings)
const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'media', 'font', 'stylesheet', 'ping',
]);

const BLOCKED_URL_PATTERNS = [
  // Ad & tracking networks
  /doubleclick\.net/i, /googlesyndication\.com/i, /googletagmanager\.com/i,
  /googletagservices\.com/i, /google-analytics\.com/i, /analytics\.google\.com/i,
  /facebook\.net/i, /fbcdn\.net/i, /scorecardresearch\.com/i,
  /quantserve\.com/i, /omtrdc\.net/i, /adobedtm\.com/i,
  // eBay-specific analytics & image CDNs (we only need text)
  /rover\.ebay\.com/i, /ebayrtm\.com/i, /ebayadservices\.com/i,
  /ebayimg\.com/i, /ebaystatic\.com\/rs\//i,
  // Font CDNs
  /fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i,
];

// ─── ③ Stealth Init Script ────────────────────────────────────────────────────
// Injected into every page context before any page scripts run
const STEALTH_SCRIPT = `
  // Remove webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Fake realistic plugin list
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

  // Fake chrome object (absent in headless Chromium)
  window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };

  // Permissions API — avoid automation detection via notification check
  const _origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (p) =>
    p.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : _origQuery(p);

  // Remove automation-related CDP globals
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
  delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay(min, max) { return delay(min + Math.random() * (max - min)); }

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

// Detect if eBay is blocking us (403, CAPTCHA page, or empty results after redirect)
function isBlockedPage(title, url) {
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();
  return (
    t.includes('captcha') ||
    t.includes('security') ||
    t.includes('access denied') ||
    t.includes('robot') ||
    u.includes('captcha') ||
    u.includes('security-appchallenge')
  );
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
    console.log(`[DB] Connected (shard ${BATCH_INDEX}/${TOTAL_BATCHES})`);
  }
  return pool;
}

// ─── Tiered Card Selection (Sharded by MOD) ───────────────────────────────────
async function getCardsToScrape() {
  const db = await getPool();
  const now = Date.now();

  const tier1Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER1_HOT_DAYS * 86400000));
  const tier2Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER2_WARM_DAYS * 86400000));
  const tier3Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER3_COLD_DAYS * 86400000));

  const t1Limit = Math.floor(CONFIG.TIER1_QUOTA);
  const t2Limit = Math.floor(CONFIG.TIER2_QUOTA);
  const t3Limit = Math.floor(CONFIG.TIER3_QUOTA);

  // TIER 1: Hot (SNKRDUNK) cards in this shard
  const [tier1Rows] = await db.execute(
    `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
            MAX(ph.soldAt) as lastEbayRecord, 1 as tier
     FROM cards c
     INNER JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
     LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
     WHERE MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
     GROUP BY c.id, c.name, c.cardNumber
     HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
     ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
     LIMIT ${t1Limit}`,
    [tier1Cutoff]
  );

  const tier1Ids = tier1Rows.map(r => r.cardId);

  // TIER 2: Warm (have eBay history, no SNKRDUNK) in this shard
  let tier2Rows = [];
  if (t2Limit > 0) {
    const excl = tier1Ids.length > 0 ? `AND c.id NOT IN (${tier1Ids.map(() => '?').join(',')})` : '';
    const [rows] = await db.execute(
      `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
              MAX(ph.soldAt) as lastEbayRecord, 2 as tier
       FROM cards c
       INNER JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
       LEFT JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
       WHERE ds.id IS NULL
         AND MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
         ${excl}
       GROUP BY c.id, c.name, c.cardNumber
       HAVING lastEbayRecord < ?
       ORDER BY lastEbayRecord ASC
       LIMIT ${t2Limit}`,
      [...tier1Ids, tier2Cutoff]
    );
    tier2Rows = rows;
  }

  const tier2Ids = tier2Rows.map(r => r.cardId);
  const excludeIds = [...tier1Ids, ...tier2Ids];

  // TIER 3: Cold (never scraped or stale) in this shard
  let tier3Rows = [];
  if (t3Limit > 0) {
    const excl = excludeIds.length > 0 ? `AND c.id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
    const [rows] = await db.execute(
      `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
              MAX(ph.soldAt) as lastEbayRecord, 3 as tier
       FROM cards c
       LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
       WHERE MOD(c.id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
         ${excl}
       GROUP BY c.id, c.name, c.cardNumber
       HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
       ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
       LIMIT ${t3Limit}`,
      [...excludeIds, tier3Cutoff]
    );
    tier3Rows = rows;
  }

  const allRows = [...tier1Rows, ...tier2Rows, ...tier3Rows];
  console.log(`[eBay] Shard ${BATCH_INDEX}: T1=${tier1Rows.length} T2=${tier2Rows.length} T3=${tier3Rows.length} total=${allRows.length}`);

  return allRows.map(row => {
    const rawName = row.name || '';
    const cardNum = (row.cardNumber || '').trim();

    // ── Extract English card name from the name field ──────────────────────────
    // name format examples:
    //   "[OP01-029] Radical Beam!! UC"        → engName = "Radical Beam"
    //   "[SM12a 219/173] Eevee GX HR"         → engName = "Eevee GX"
    //   "Sigilyph C [BW1 024/053](Pack)"      → engName = "Sigilyph"
    //   "Sanji R [OP12-070] [EN](Pack)"       → engName = "Sanji"
    //   "Slowpoke: PROMO[PROMO E 004/T](...)" → engName = "Slowpoke"
    //   "Voltorb :1ED [e2 034/092](Pack)"     → engName = "Voltorb"
    //   "Meowth : Old Back [PMCG2 No.052]"    → engName = "Meowth"
    //
    // Step 1: strip leading bracket section e.g. "[OP01-029] " or "[SM12a 219/173] "
    let cleanedName = rawName.replace(/^\[[^\]]*\]\s*/, '').trim();
    // Step 2: strip trailing parenthesis section e.g. "(DUELIST LEGACY Volume.5)"
    cleanedName = cleanedName.replace(/\s*\(.*\)\s*$/, '').trim();
    // Step 3: strip trailing [EN] [JP] [XX] language tags
    cleanedName = cleanedName.replace(/\s*\[[A-Z]{2}\]\s*$/, '').trim();
    // Step 4: strip inline bracket sections that appear mid-name e.g. "PROMO[PROMO E 004/T]" → "PROMO"
    cleanedName = cleanedName.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
    // Step 5: remove colon-based descriptors e.g. ":1ED", ": Old Back", ": PROMO"
    cleanedName = cleanedName.replace(/\s*:.*$/, '').trim();
    // Step 6: remove Japanese characters
    cleanedName = cleanedName.replace(/[\u3000-\u9fff\uff00-\uffef]/g, '').trim();
    // Step 7: remove !! ? punctuation
    cleanedName = cleanedName.replace(/[!?]+/g, '').trim();
    // Step 8: remove single-char rarity suffixes at end (C, R, S, N, V) — must be standalone word
    //         but keep multi-char type suffixes like GX, EX, VMAX, VSTAR
    const singleRarityPattern = /\s+(?:UC|RR?|SR|HR|UR|AR|SAR|SSR|SP|PROMO|VMAX|VSTAR|VUNION|TAG|TEAM|[CRSUNV])\s*$/i;
    cleanedName = cleanedName.replace(singleRarityPattern, '').trim();
    // Step 9: take first 2 words max (keeps query concise and precise)
    const engName = cleanedName.split(/\s+/).filter(Boolean).slice(0, 2).join(' ');

    // ── Extract card number ────────────────────────────────────────────────────
    // Extract the "NNN/NNN" or "NNN/X" part from cardNumber (strip set code prefix)
    // e.g. "M2a 199/193"   → "199/193"
    //      "S8b 043/080"   → "043/080"
    //      "PROMO E 004/T" → "004/T"
    //      "XY-P 295/XY-P" → "295/XY-P"
    const numericCardNum = cardNum.match(/(\d+\/[\w-]+)/)?.[1] || cardNum;

    // ── Build keyword: "{engName} {cardNum} PSA 10" ───────────────────────────
    let keyword;
    if (engName && (numericCardNum || cardNum)) {
      // Best case: have both name and card number
      const num = numericCardNum || cardNum;
      keyword = `${engName} ${num} PSA 10`;
    } else if (numericCardNum && /\d\/\d/.test(numericCardNum)) {
      // Fallback: card number only (NNN/NNN format)
      keyword = `${numericCardNum} PSA 10`;
    } else if (cardNum && /\d/.test(cardNum)) {
      // Fallback: other card number formats
      keyword = `${cardNum} PSA 10`;
    } else {
      // Last resort: name only
      keyword = `${engName || cleanedName.split(/\s+/).slice(0, 3).join(' ')} PSA 10`.trim();
    }

    keyword = keyword.replace(/\s+/g, ' ').trim();
    return { cardId: row.cardId, keyword, cardNumber: cardNum, tier: row.tier };
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cronSecret}` },
      body: JSON.stringify({ records }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) { console.warn(`[eBay] Ingest HTTP ${resp.status}`); return { inserted: 0, skipped: records.length }; }
    return await resp.json();
  } catch (e) {
    console.warn(`[eBay] Ingest failed (non-fatal): ${e.message}`);
    return { inserted: 0, skipped: records.length };
  }
}

async function reportProgress(processed, success, fail, total, inserted) {
  if (!platformUrl || !cronSecret) return;
  const elapsed = (Date.now() - startTime) / 1000;
  const speed = elapsed > 0 ? processed / elapsed : 0;
  const eta = speed > 0 ? Math.ceil((total - processed) / speed / 60) : 0;
  try {
    await fetch(`${platformUrl}/api/scheduled/github-ebay-batch-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cronSecret}` },
      body: JSON.stringify({
        runId: `${runId}-shard${BATCH_INDEX}`,
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

async function reportFinal(total, success, fail, inserted, status) {
  if (!platformUrl || !cronSecret) return;
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && runId
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}` : null;
  try {
    await fetch(`${platformUrl}/api/scheduled/github-ebay-batch-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cronSecret}` },
      body: JSON.stringify({
        totalItems: total, successCount: success, failureCount: fail,
        durationMs: Date.now() - startTime,
        startedAt: new Date(startTime).toISOString(),
        status, runId: `${runId}-shard${BATCH_INDEX}`, runUrl,
        totalInserted: inserted, batchIndex: BATCH_INDEX, totalBatches: TOTAL_BATCHES,
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[eBay] Final report sent (shard ${BATCH_INDEX})`);
  } catch (e) {
    console.warn(`[eBay] Final report error (non-fatal): ${e.message}`);
  }
}

// ─── eBay Scraper (single card) ───────────────────────────────────────────────
// ─── Title Relevance Filter ──────────────────────────────────────────────────
// Returns true if the listing title is relevant to the target card.
// Rules:
//   1. Title must contain "PSA 10" (or "PSA10") — case-insensitive
//   2. Title must contain the card number (e.g. "199/193", "OP01-029", "295/XY-P")
//      We accept the number portion with flexible separators (space, dash, slash)
function isTitleRelevant(title, cardNumber) {
  if (!title) return false;
  const t = title.toLowerCase();

  // Rule 1: must contain PSA 10
  if (!/\bpsa\s*10\b/.test(t)) return false;

  // Rule 2: must contain the card number (if we have one)
  if (!cardNumber) return true; // no card number to check against — accept

  // Extract the numeric portion from cardNumber:
  //   "M2a 199/193"   → "199/193"
  //   "XY-P 295/XY-P" → "295/XY-P"
  //   "OP01-029"       → "OP01-029" (keep as-is — it IS the identifier)
  //   "PROMO E 004/T" → "004/T"
  const numPart = cardNumber.match(/(\d+\/[\w-]+)/)?.[1] || cardNumber.trim();

  // Build a flexible regex that allows any non-alphanumeric separator between parts
  // e.g. "199/193" matches "199/193", "199 193", "199-193"
  // e.g. "OP01-029" matches "OP01-029", "OP01 029"
  const escapedNum = numPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex special chars
  const flexNum = escapedNum.replace(/[\/\-]/g, '[\\s\\-\/]'); // allow flexible separators
  const numRegex = new RegExp(flexNum, 'i');

  return numRegex.test(title);
}

// Returns: array of listings, or null if blocked (caller should retry)
async function scrapeEbaySoldListings(page, keyword, cardNumber) {
  const listings = [];
  const encodedKeyword = encodeURIComponent(keyword);

  for (let pageNum = 1; pageNum <= CONFIG.MAX_PAGES_PER_CARD; pageNum++) {
    if (listings.length >= CONFIG.MAX_LISTINGS_PER_CARD) break;

    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedKeyword}&LH_Sold=1&LH_Complete=1&_pgn=${pageNum}&_ipg=60`;

    try {
      // Use 'load' to wait for JS-rendered content (eBay results are dynamic)
      const response = await page.goto(url, { waitUntil: 'load', timeout: CONFIG.NAV_TIMEOUT });

      // ⑤ Detect 403 or redirect to block page
      const status = response?.status() || 200;
      if (status === 403 || status === 429) {
        console.warn(`[eBay] HTTP ${status} for "${keyword}" page ${pageNum} — blocked`);
        return null;
      }

      const title = await page.title();
      const currentUrl = page.url();
      if (isBlockedPage(title, currentUrl)) {
        console.warn(`[eBay] Block/CAPTCHA page detected for "${keyword}" — title: "${title}"`);
        return null;
      }

      // Wait for results to appear — eBay renders via JS after page load
      // eBay updated HTML structure: items are now li.s-card (was li.s-item)
      const selectorFound = await page.waitForSelector(
        'li.s-card, ul.srp-results li',
        { timeout: CONFIG.PAGE_TIMEOUT }
      ).then(() => true).catch(() => false);

      if (!selectorFound) {
        // Debug: log page title and item count to diagnose
        const debugInfo = await page.evaluate(() => ({
          title: document.title,
          bodyLen: document.body?.innerText?.length || 0,
          sCardCount: document.querySelectorAll('li.s-card').length,
          srpCount: document.querySelectorAll('ul.srp-results').length,
        }));
        console.warn(`[eBay] No results selector found for "${keyword}" — title:"${debugInfo.title}" bodyLen:${debugInfo.bodyLen} s-card:${debugInfo.sCardCount} srp-ul:${debugInfo.srpCount}`);
      }

      const pageListings = await page.evaluate(() => {
        const items = [];
        // eBay new structure (2025+): li.s-card inside ul.srp-results
        // Title:  .su-styled-text.primary.default  (or fallback: a[href*="itm"] text)
        // Price:  .s-card__price
        // Date:   .su-styled-text.positive.default  (contains "Sold May 9, 2026")
        // Link:   a[href*="itm"]
        const candidates = document.querySelectorAll('li.s-card');
        for (const el of candidates) {
          // Title: primary.default span
          const titleEl = el.querySelector('.su-styled-text.primary.default, .s-item__title');
          const title = titleEl?.textContent?.trim() || '';
          if (!title || title.toLowerCase().includes('shop on ebay')) continue;

          // Price: s-card__price or fallback
          const priceEl = el.querySelector('.s-card__price, .s-item__price, [class*="s-card__price"]');
          const priceText = priceEl?.textContent?.trim() || '';

          // Sold date: positive.default span ("Sold May 9, 2026")
          const dateEl = el.querySelector(
            '.su-styled-text.positive.default, .s-item__ended-date, [class*="ended-date"]'
          );
          const dateText = dateEl?.textContent?.trim() || '';

          // Link
          const linkEl = el.querySelector('a[href*="itm"], a[href*="ebay.com/itm"]');
          const listingUrl = linkEl?.href || '';

          if (title && priceText) items.push({ title, priceText, dateText, listingUrl });
        }
        return items;
      });

      if (pageListings.length === 0) break;

      for (const item of pageListings) {
        if (listings.length >= CONFIG.MAX_LISTINGS_PER_CARD) break;
        const priceUsd = parseEbayPrice(item.priceText);
        if (!priceUsd || priceUsd < 5) continue;
        // ✔ Title relevance check: must contain card number + PSA 10
        if (!isTitleRelevant(item.title, cardNumber)) {
          console.log(`[eBay] ⏩ Skipped irrelevant listing: "${item.title.slice(0, 80)}"`);
          continue;
        }
        const soldAt = parseEbaySoldDate(item.dateText);
        listings.push({
          priceUsd,
          priceHkd: Math.round(priceUsd * CONFIG.USD_TO_HKD * 100) / 100,
          title: item.title.slice(0, 512),
          soldAt: soldAt.toISOString(),
          listingUrl: item.listingUrl || null,
          grade: 'PSA 10',
        });
      }

      console.log(`[eBay] p${pageNum}: ${pageListings.length} listings for "${keyword}" (total: ${listings.length})`);

      if (pageNum < CONFIG.MAX_PAGES_PER_CARD && listings.length < CONFIG.MAX_LISTINGS_PER_CARD) {
        await delay(800 + Math.random() * 600); // brief inter-page pause
      }
    } catch (err) {
      console.warn(`[eBay] Error on page ${pageNum} for "${keyword}": ${err.message}`);
      break;
    }
  }

  return listings;
}

// ─── ⑤ Scrape with Retry & Skip ──────────────────────────────────────────────
// Returns { listings, skipped }
async function scrapeWithRetryOrSkip(page, keyword, cardId, cardNumber) {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const result = await scrapeEbaySoldListings(page, keyword, cardNumber);

      if (result === null) {
        // Blocked — sleep 3 min then retry
        const sleepMin = Math.round(CONFIG.RETRY_SLEEP_MS / 60000 * 10) / 10;
        console.warn(`[eBay] ⚠️  Blocked for cardId=${cardId}, attempt ${attempt}/${CONFIG.MAX_RETRIES}. Sleeping ${sleepMin} min...`);
        await delay(CONFIG.RETRY_SLEEP_MS);
        continue;
      }

      return { listings: result, skipped: false };
    } catch (err) {
      if (attempt < CONFIG.MAX_RETRIES) {
        console.warn(`[eBay] ❌ cardId=${cardId} attempt ${attempt} error: ${err.message}. Sleeping 3 min...`);
        await delay(CONFIG.RETRY_SLEEP_MS);
      } else {
        // All retries exhausted — SKIP this card
        console.error(`[eBay] 🚫 cardId=${cardId} SKIPPED after ${CONFIG.MAX_RETRIES} retries: ${err.message}`);
        return { listings: [], skipped: true };
      }
    }
  }
  // Blocked on all retries — SKIP
  console.error(`[eBay] 🚫 cardId=${cardId} SKIPPED — blocked on all ${CONFIG.MAX_RETRIES} retries`);
  return { listings: [], skipped: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log(`[eBay] GitHub Actions eBay Scraper v3.1 — Full Coverage`);
  console.log(`[eBay] Shard: ${BATCH_INDEX} / ${TOTAL_BATCHES}  |  Cards/shard: ${CARDS_PER_BATCH}`);
  console.log(`[eBay] Profile: ${PROFILE.userAgent.slice(0, 70)}`);
  console.log(`[eBay] Quota: T1=${CONFIG.TIER1_QUOTA} T2=${CONFIG.TIER2_QUOTA} T3=${CONFIG.TIER3_QUOTA}`);
  console.log('='.repeat(70));

  const cards = await getCardsToScrape();

  if (!cards.length) {
    console.log('[eBay] Nothing to scrape in this shard. All cards are up to date.');
    await (await getPool()).end();
    return;
  }

  console.log(`[eBay] Launching Playwright (headless=${CONFIG.HEADLESS})...`);
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

  // ① Extreme asset blocking — abort everything except scripts & documents
  await context.route('**/*', (route) => {
    const req = route.request();
    const type = req.resourceType();
    const url  = req.url();

    if (BLOCKED_RESOURCE_TYPES.has(type)) return route.abort();
    for (const pat of BLOCKED_URL_PATTERNS) {
      if (pat.test(url)) return route.abort();
    }
    return route.continue();
  });

  const page = await context.newPage();

  // ③ Stealth: inject before every page navigation
  await page.addInitScript(STEALTH_SCRIPT);

  let successCards = 0;
  let failCards    = 0;
  let skippedCards = 0;
  let totalInserted = 0;
  const pendingRecords = [];
  const skippedLog = [];  // for artifact upload
  const tierStats = { 1: { s: 0, f: 0 }, 2: { s: 0, f: 0 }, 3: { s: 0, f: 0 } };

  try {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tl = `T${card.tier}`;
      console.log(`[eBay] [${i + 1}/${cards.length}][${tl}][shard${BATCH_INDEX}] "${card.keyword}" (id=${card.cardId})`);

      const { listings, skipped } = await scrapeWithRetryOrSkip(page, card.keyword, card.cardId, card.cardNumber);

      if (skipped) {
        skippedCards++;
        failCards++;
        tierStats[card.tier].f++;
        skippedLog.push({ cardId: card.cardId, keyword: card.keyword, tier: card.tier, skippedAt: new Date().toISOString() });
      } else {
        if (listings.length > 0) {
          pendingRecords.push(...listings.map(l => ({ ...l, cardId: card.cardId })));
        }
        successCards++;
        tierStats[card.tier].s++;
        console.log(`[eBay] ✅ [${tl}] id=${card.cardId}: ${listings.length} listings`);
      }

      // Flush ingest batch
      if (pendingRecords.length >= CONFIG.INGEST_BATCH) {
        const batch = pendingRecords.splice(0, CONFIG.INGEST_BATCH);
        const result = await ingestRecords(batch);
        totalInserted += result.inserted || 0;
        console.log(`[eBay] Ingested: +${result.inserted} inserted, ${result.skipped} skipped`);
      }

      // Periodic progress report
      if ((i + 1) % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
        await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted);
      }

      // ④ Dynamic random delay 1.5–3.5s between cards
      if (i < cards.length - 1) {
        await randomDelay(CONFIG.DELAY_MIN_MS, CONFIG.DELAY_MAX_MS);
      }
    }

    // Final flush
    if (pendingRecords.length > 0) {
      const result = await ingestRecords(pendingRecords);
      totalInserted += result.inserted || 0;
      console.log(`[eBay] Final flush: +${result.inserted} inserted`);
    }
  } finally {
    await browser.close();
    await (await getPool()).end();

    // Write skipped cards log for artifact upload
    if (skippedLog.length > 0) {
      fs.writeFileSync('skipped-cards.json', JSON.stringify(skippedLog, null, 2));
      console.log(`[eBay] Skipped cards log written: ${skippedLog.length} entries`);
    }
  }

  const elapsed = Math.ceil((Date.now() - startTime) / 60000);
  console.log('='.repeat(70));
  console.log(`[eBay] SHARD ${BATCH_INDEX} DONE in ${elapsed} min`);
  console.log(`[eBay] ✅ Success: ${successCards}  ❌ Failed/Skipped: ${failCards} (${skippedCards} skipped)  📥 Inserted: ${totalInserted}`);
  console.log(`[eBay] T1: ${tierStats[1].s}✅/${tierStats[1].f}❌  T2: ${tierStats[2].s}✅/${tierStats[2].f}❌  T3: ${tierStats[3].s}✅/${tierStats[3].f}❌`);
  console.log('='.repeat(70));

  const failRate = failCards / (successCards + failCards || 1);
  const finalStatus = (failRate > 0.5 && failCards > 50) ? 'failed' : 'completed';

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
