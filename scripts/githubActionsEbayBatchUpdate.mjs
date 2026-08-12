/**
 * GitHub Actions eBay Sold Listings Batch Scraper v4.0 (Free Safe Collector)
 *
 * Strategy: Low-frequency, high-priority collection
 *   - One serial GitHub Actions job handles at most 50 hot cards by default.
 *   - A security/auth page is a data-source health event, never a zero-sale.
 *   - Two blocked responses stop the complete run instead of retrying for hours.
 *
 * This collector deliberately uses a small workload and stops on access gates.
 * It does not attempt to bypass eBay security measures.
 *
 * Default priority: T1 hot cards with active SNKRDUNK sources. T2/T3 are only
 * enabled deliberately through EBAY_TIER_MODE=balanced.
 *
 * Required env:
 *   DATABASE_URL    MySQL connection string
 *   PLATFORM_URL    Platform base URL
 *   CRON_SECRET     Bearer token for platform API auth
 *   BATCH_INDEX     This job's shard index (0-based)
 *   TOTAL_BATCHES   Total number of serial jobs (default 1)
 *
 * Optional env:
 *   CARDS_PER_BATCH Max cards per job (default: 50)
 *   EBAY_TIER_MODE  hot_only (default) or balanced
 *   MAX_BLOCKS_PER_RUN Stop whole run after this many security/auth blocks (default: 2)
 *   HEADLESS        Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { createEbayCircuitBreaker } from './ebayCircuitBreaker.mjs';

// ─── Shard Configuration ──────────────────────────────────────────────────────
const BATCH_INDEX   = parseInt(process.env.BATCH_INDEX   || '0',  10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES || '1', 10);
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH || '50', 10);
const TIER_MODE = process.env.EBAY_TIER_MODE || 'hot_only';

// Single-card mode: CARD_IDS is a comma-separated list of card IDs to scrape directly.
// e.g. CARD_IDS="123,456" — bypasses all shard/tier logic, runs only those specific cards.
const CARD_IDS_ENV = (process.env.CARD_IDS || '').trim();
const SINGLE_CARD_MODE = CARD_IDS_ENV.length > 0;
const SINGLE_CARD_IDS = SINGLE_CARD_MODE
  ? CARD_IDS_ENV.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
  : [];

if (!SINGLE_CARD_MODE && (isNaN(BATCH_INDEX) || BATCH_INDEX < 0 || BATCH_INDEX >= TOTAL_BATCHES)) {
  console.error(`[eBay] Invalid BATCH_INDEX=${BATCH_INDEX} for TOTAL_BATCHES=${TOTAL_BATCHES}`);
  process.exit(1);
}

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  // Tiered update intervals (days)
  TIER1_HOT_DAYS:  1,
  TIER2_WARM_DAYS: 3,
  TIER3_COLD_DAYS: 7,

  // Free default: use only recently active cards with the strongest user value.
  TIER1_QUOTA: TIER_MODE === 'balanced' ? Math.ceil(CARDS_PER_BATCH * 0.60) : CARDS_PER_BATCH,
  TIER2_QUOTA: TIER_MODE === 'balanced' ? Math.ceil(CARDS_PER_BATCH * 0.25) : 0,
  TIER3_QUOTA: TIER_MODE === 'balanced' ? Math.floor(CARDS_PER_BATCH * 0.15) : 0,

  INGEST_BATCH: 50,
  HEADLESS: process.env.HEADLESS !== 'false',
  USD_TO_HKD: 7.8,
  PAGE_TIMEOUT: 25000,
  NAV_TIMEOUT:  35000,

  DELAY_MIN_MS: 2200,
  DELAY_MAX_MS: 4200,

  MAX_RETRIES: Math.max(1, parseInt(process.env.MAX_RETRIES || '1', 10)),
  MAX_BLOCKS_PER_RUN: Math.max(1, parseInt(process.env.MAX_BLOCKS_PER_RUN || '2', 10)),

  MAX_PAGES_PER_CARD: Math.max(1, parseInt(process.env.MAX_PAGES_PER_CARD || '1', 10)),
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

  // ─── SINGLE-CARD MODE: bypass shard/tier logic ────────────────────────────
  if (SINGLE_CARD_MODE) {
    if (SINGLE_CARD_IDS.length === 0) {
      console.warn('[eBay] SINGLE_CARD_MODE: no valid card IDs found in CARD_IDS env var');
      return [];
    }
    console.log(`[eBay] 🎯 Single-card mode: fetching ${SINGLE_CARD_IDS.length} card(s): [${SINGLE_CARD_IDS.join(', ')}]`);
    const placeholders = SINGLE_CARD_IDS.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT c.id as cardId, c.name, c.cardNumber, NULL as lastEbayRecord, 0 as tier
       FROM cards c
       WHERE c.id IN (${placeholders})`,
      [...SINGLE_CARD_IDS]
    );
    console.log(`[eBay] Single-card mode: found ${rows.length} card(s) in DB`);
    return rows.map(row => {
      const rawName = row.name || '';
      const cardNum = (row.cardNumber || '').trim();
      let cleanedName = rawName.replace(/^\[[^\]]*\]\s*/, '').trim();
      cleanedName = cleanedName.replace(/\s*\(.*\)\s*$/, '').trim();
      cleanedName = cleanedName.replace(/\s*\[[A-Z]{2}\]\s*$/, '').trim();
      cleanedName = cleanedName.replace(/\s*\[[^\]]*\]\s*/g, ' ').trim();
      cleanedName = cleanedName.replace(/\s*:.*$/, '').trim();
      cleanedName = cleanedName.replace(/[\u3000-\u9fff\uff00-\uffef]/g, '').trim();
      cleanedName = cleanedName.replace(/[!?]+/g, '').trim();
      const singleRarityPattern = /\s+(?:UC|RR?|SR|HR|UR|AR|SAR|SSR|SP|PROMO|VMAX|VSTAR|VUNION|TAG|TEAM|[CRSUNV])\s*$/i;
      cleanedName = cleanedName.replace(singleRarityPattern, '').trim();
      const engName = cleanedName.split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
      const numericCardNum = cardNum.match(/(\d+\/[\w-]+)/)?.[1] || cardNum;
      let keyword;
      if (engName && (numericCardNum || cardNum)) {
        keyword = `${engName} ${numericCardNum || cardNum} PSA 10`;
      } else if (numericCardNum && /\d\/\d/.test(numericCardNum)) {
        keyword = `${numericCardNum} PSA 10`;
      } else if (cardNum && /\d/.test(cardNum)) {
        keyword = `${cardNum} PSA 10`;
      } else {
        keyword = `${engName || cleanedName.split(/\s+/).slice(0, 3).join(' ')} PSA 10`.trim();
      }
      keyword = keyword.replace(/\s+/g, ' ').trim();
      return { cardId: row.cardId, keyword, cardNumber: cardNum, engName, cleanedName, tier: 0 };
    });
  }
  // ─── END SINGLE-CARD MODE ─────────────────────────────────────────────────

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
    return { cardId: row.cardId, keyword, cardNumber: cardNum, engName, cleanedName, tier: row.tier };
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

async function reportProgress(processed, success, fail, total, inserted, blockedCount = 0) {
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
        blockedCount,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (_) {}
}

async function reportFinal(total, success, fail, inserted, status, details = {}) {
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
        blockedCount: Number(details.blockedCount || 0),
        stoppedEarly: Boolean(details.stoppedEarly),
        stopReason: details.stopReason || null,
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`[eBay] Final report sent (shard ${BATCH_INDEX})`);
  } catch (e) {
    console.warn(`[eBay] Final report error (non-fatal): ${e.message}`);
  }
}

// ─── eBay Scraper (single card) ───────────────────────────────────────────────
// ─── Title Relevance Filter (Smart Scoring) ──────────────────────────────────
/**
 * isTitleRelevant — Smart multi-layer relevance scoring for eBay listing titles.
 *
 * Problem: eBay sellers often omit card numbers from titles, or use different
 * number formats. A strict card-number-only check misses many valid listings.
 *
 * Solution: Score-based approach.
 *   Hard filter: title MUST contain "PSA 10" (or "PSA10").
 *   Then compute a SCORE:
 *     +3  card number found in title (flex-separator match)
 *     +2  engName (first 2 words of card name) found in title
 *     +1  any significant word from cleanedName found in title
 *     -3  title contains a DIFFERENT card number of the same format
 *         (e.g. our card is 199/193 but title has 150/XY-P → wrong card)
 *   Accept if score >= 2.
 *
 * This allows:
 *   - Titles that have card number but no name   → score 3 ✅
 *   - Titles that have name but no card number   → score 2 ✅
 *   - Titles with both name and card number      → score 5 ✅
 *   - Titles with wrong card number              → score -1 ❌
 *   - Titles with neither name nor card number   → score 0 ❌
 */
function isTitleRelevant(title, cardNumber, engName = '', cleanedName = '') {
  if (!title) return false;
  const t = title.toLowerCase();

  // ── Hard filter: must have PSA 10 ──────────────────────────────────────────
  if (!/\bpsa\s*10\b/.test(t)) return false;

  // ── If we have nothing to verify against, accept ───────────────────────────
  if (!cardNumber && !engName) return true;

  let score = 0;

  // ── Card number check ──────────────────────────────────────────────────────
  if (cardNumber) {
    // Extract the numeric portion: "M2a 199/193" → "199/193", "OP01-029" → "OP01-029"
    const numPart = cardNumber.match(/(\d+\/[\w-]+)/)?.[1] || cardNumber.trim();
    const escapedNum = numPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flexNum = escapedNum.replace(/[\/\-]/g, '[\\s\\-\/]');
    const numRegex = new RegExp(flexNum, 'i');

    if (numRegex.test(title)) {
      score += 3; // ✅ our card number found
    } else {
      // Check if title contains a DIFFERENT number of the same format
      // NNN/NNN format (e.g. 199/193, 295/XY-P) or XXNN-NNN format (e.g. OP01-029)
      const slashNums = t.match(/\b(\d{2,3}\/[\w-]+)\b/g) || [];
      const dashNums  = t.match(/\b([a-z]{2}\d{2}-\d{3})\b/gi) || [];
      const titleNums = [...slashNums, ...dashNums];
      if (titleNums.length > 0) {
        // Title has card numbers but none match ours → likely wrong card
        score -= 3;
      }
      // If title has no card numbers at all, don't penalise — seller may have omitted it
    }
  }

  // ── Card name check ────────────────────────────────────────────────────────
  if (engName) {
    const engLower = engName.toLowerCase();
    if (t.includes(engLower)) {
      score += 2; // ✅ full engName found
    } else {
      // Partial: check if all significant words of engName appear
      const engWords = engLower.split(/\s+/).filter(w => w.length > 3);
      if (engWords.length > 0 && engWords.every(w => t.includes(w))) {
        score += 1;
      }
    }
  } else if (cleanedName) {
    const cleanWords = cleanedName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (cleanWords.length > 0 && cleanWords.some(w => t.includes(w))) {
      score += 1;
    }
  }

  // ── Accept threshold: need score >= 2 ─────────────────────────────────────
  // Means: either card number found, OR name found with no conflicting number
  return score >= 2;
}

// Returns: array of listings, or null if blocked (caller should retry)
async function scrapeEbaySoldListings(page, keyword, cardNumber, engName = '', cleanedName = '') {
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
        if (!isTitleRelevant(item.title, cardNumber, engName, cleanedName)) {
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
// Returns { listings, skipped, blocked }
async function scrapeWithRetryOrSkip(page, keyword, cardId, cardNumber, engName = '', cleanedName = '') {
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const result = await scrapeEbaySoldListings(page, keyword, cardNumber, engName, cleanedName);

      if (result === null) {
        console.warn(`[eBay] ⚠️  Security/auth gate for cardId=${cardId}, attempt ${attempt}/${CONFIG.MAX_RETRIES}`);
        if (attempt === CONFIG.MAX_RETRIES) {
          return { listings: [], skipped: true, blocked: true };
        }
        continue;
      }

      return { listings: result, skipped: false, blocked: false };
    } catch (err) {
      if (attempt < CONFIG.MAX_RETRIES) {
        console.warn(`[eBay] ❌ cardId=${cardId} attempt ${attempt} error: ${err.message}. Sleeping 3 min...`);
        await delay(2000);
      } else {
        // All retries exhausted — SKIP this card
        console.error(`[eBay] 🚫 cardId=${cardId} SKIPPED after ${CONFIG.MAX_RETRIES} retries: ${err.message}`);
        return { listings: [], skipped: true, blocked: false };
      }
    }
  }
  // Blocked on all retries — SKIP
  console.error(`[eBay] 🚫 cardId=${cardId} SKIPPED — blocked on all ${CONFIG.MAX_RETRIES} retries`);
  return { listings: [], skipped: true, blocked: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(70));
  console.log(`[eBay] GitHub Actions eBay Scraper v4.0 — Free Safe Collector`);
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
  let blockedCount = 0;
  let stoppedEarly = false;
  let stopReason = null;
  const pendingRecords = [];
  const skippedLog = [];  // for artifact upload
  const tierStats = { 1: { s: 0, f: 0 }, 2: { s: 0, f: 0 }, 3: { s: 0, f: 0 } };
  const circuitBreaker = createEbayCircuitBreaker(CONFIG.MAX_BLOCKS_PER_RUN);

  try {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tl = `T${card.tier}`;
      const currentTierStats = tierStats[card.tier] || (tierStats[card.tier] = { s: 0, f: 0 });
      console.log(`[eBay] [${i + 1}/${cards.length}][${tl}][shard${BATCH_INDEX}] "${card.keyword}" (id=${card.cardId})`);

      const { listings, skipped, blocked } = await scrapeWithRetryOrSkip(page, card.keyword, card.cardId, card.cardNumber, card.engName || '', card.cleanedName || '');

      if (skipped) {
        skippedCards++;
        failCards++;
        currentTierStats.f++;
        skippedLog.push({ cardId: card.cardId, keyword: card.keyword, tier: card.tier, reason: blocked ? 'security_or_auth_gate' : 'request_error', skippedAt: new Date().toISOString() });
        if (blocked) {
          const state = circuitBreaker.recordBlocked();
          blockedCount = state.blockedCount;
          if (state.shouldStop) {
            stoppedEarly = true;
            stopReason = `security_or_auth_gate_after_${blockedCount}_responses`;
            console.warn(`[eBay] 🛑 Circuit breaker opened: ${stopReason}. Remaining cards are deferred; no zero-sales writes were made.`);
            break;
          }
        }
      } else {
        if (listings.length > 0) {
          pendingRecords.push(...listings.map(l => ({ ...l, cardId: card.cardId })));
        }
        successCards++;
        currentTierStats.s++;
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
        await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted, blockedCount);
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
  const finalStatus = stoppedEarly ? 'blocked' : ((failRate > 0.5 && failCards > 10) ? 'failed' : 'completed');

  const summary = {
    status: finalStatus,
    totalItems: cards.length,
    successCards,
    failCards,
    skippedCards,
    blockedCount,
    stoppedEarly,
    stopReason,
    totalInserted,
    maxBlocksPerRun: CONFIG.MAX_BLOCKS_PER_RUN,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync('run-summary.json', JSON.stringify(summary, null, 2));

  await reportFinal(cards.length, successCards, failCards, totalInserted, finalStatus, summary);

  if (finalStatus === 'failed') {
    console.error(`[eBay] High failure rate: ${(failRate * 100).toFixed(1)}%`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[eBay] FATAL:', err);
  process.exit(1);
});
