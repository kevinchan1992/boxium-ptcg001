/**
 * GitHub Actions eBay Sold Listings Batch Scraper v2.0
 *
 * Tiered update strategy for 55,000+ cards:
 *   - TIER 1 (Hot):  Cards with SNKRDUNK data source → update every 1 day
 *   - TIER 2 (Warm): Cards with existing eBay records (no SNKRDUNK) → update every 3 days
 *   - TIER 3 (Cold): All other cards (never scraped) → update every 7 days
 *
 * Daily quota: ~3,000 cards → ~2.5 hours per run (within GitHub Actions 6h limit)
 *
 * Required env:
 *   DATABASE_URL   - MySQL connection string
 *   PLATFORM_URL   - Platform base URL
 *   CRON_SECRET    - Bearer token for platform API auth
 *
 * Optional env:
 *   BATCH_LIMIT    - Max cards per run (default: 3000)
 *   HEADLESS       - Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import mysql from 'mysql2/promise';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  // Tiered update intervals (days)
  TIER1_HOT_DAYS: 1,    // SNKRDUNK cards: update daily
  TIER2_WARM_DAYS: 3,   // Cards with eBay history: update every 3 days
  TIER3_COLD_DAYS: 7,   // All other cards: update every 7 days

  // Per-run quota: how many cards from each tier
  // Total ~3000/day → ~2.5 hours at 3s/card
  TIER1_QUOTA: 1000,    // Up to 1000 hot cards per run
  TIER2_QUOTA: 1000,    // Up to 1000 warm cards per run
  TIER3_QUOTA: 1000,    // Up to 1000 cold cards per run

  INGEST_BATCH: parseInt(process.env.INGEST_BATCH || '50', 10),
  HEADLESS: process.env.HEADLESS !== 'false',
  USD_TO_HKD: 7.8,
  PAGE_TIMEOUT: 30000,
  NAV_TIMEOUT: 45000,
  DELAY_BETWEEN_CARDS_MS: 2500,   // 2.5s base delay between cards
  DELAY_ON_BLOCK_MS: 15000,       // 15s wait on CAPTCHA/block
  MAX_PAGES_PER_CARD: 3,
  MAX_LISTINGS_PER_CARD: 60,
  PROGRESS_REPORT_INTERVAL: 20,
};

// Allow manual override via env
if (process.env.BATCH_LIMIT) {
  const limit = parseInt(process.env.BATCH_LIMIT, 10);
  if (!isNaN(limit) && limit > 0) {
    // Distribute manual limit evenly across tiers
    const perTier = Math.ceil(limit / 3);
    CONFIG.TIER1_QUOTA = perTier;
    CONFIG.TIER2_QUOTA = perTier;
    CONFIG.TIER3_QUOTA = perTier;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      connectionLimit: 5,
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

// ─── Tiered Card Selection ────────────────────────────────────────────────────
async function getCardsToScrape() {
  const db = await getPool();
  const now = Date.now();

  const tier1Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER1_HOT_DAYS * 86400000));
  const tier2Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER2_WARM_DAYS * 86400000));
  const tier3Cutoff = toMysqlDatetime(new Date(now - CONFIG.TIER3_COLD_DAYS * 86400000));

  const tier1Limit = Math.floor(CONFIG.TIER1_QUOTA);
  const tier2Limit = Math.floor(CONFIG.TIER2_QUOTA);
  const tier3Limit = Math.floor(CONFIG.TIER3_QUOTA);

  // TIER 1: Cards with active SNKRDUNK data source (hot cards) — update daily
  const [tier1Rows] = await db.execute(
    `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
            MAX(ph.soldAt) as lastEbayRecord,
            1 as tier
     FROM cards c
     INNER JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
     LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
     GROUP BY c.id, c.name, c.cardNumber
     HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
     ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
     LIMIT ${tier1Limit}`,
    [tier1Cutoff]
  );

  // Collect tier1 card IDs to exclude from tier2/tier3
  const tier1Ids = tier1Rows.map(r => r.cardId);
  const tier1IdSet = new Set(tier1Ids);

  // TIER 2: Cards with existing eBay records but no SNKRDUNK — update every 3 days
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
       WHERE ds.id IS NULL ${excludeClause}
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

  // TIER 3: All other cards (never scraped or cold) — update every 7 days
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
       WHERE 1=1 ${excludeClause}
       GROUP BY c.id, c.name, c.cardNumber
       HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
       ORDER BY (lastEbayRecord IS NOT NULL) ASC, lastEbayRecord ASC
       LIMIT ${tier3Limit}`,
      [...excludeIds, tier3Cutoff]
    );
    tier3Rows = rows;
  }

  const allRows = [...tier1Rows, ...tier2Rows, ...tier3Rows];

  console.log(`[eBay] Tier breakdown: T1(hot)=${tier1Rows.length}, T2(warm)=${tier2Rows.length}, T3(cold)=${tier3Rows.length}`);
  console.log(`[eBay] Total cards to scrape: ${allRows.length}`);

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
const cronSecret = process.env.CRON_SECRET;
const runId = process.env.GITHUB_RUN_ID || null;
const startTime = Date.now();

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
        runId,
        totalItems: totalCards,
        processedItems: processedCards,
        successCount: successCards,
        failureCount: failCards,
        startedAt: new Date(startTime).toISOString(),
        speedPerSec: Math.round(speedPerSec * 10) / 10,
        etaMinutes,
        totalInserted,
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
        runId,
        runUrl,
        totalInserted,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      console.log(`[eBay] Platform final report sent successfully`);
    } else {
      console.warn(`[eBay] Platform final report failed: HTTP ${resp.status}`);
    }
  } catch (e) {
    console.warn(`[eBay] Platform final report error (non-fatal): ${e.message}`);
  }
}

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
        console.warn(`[eBay] CAPTCHA detected for "${keyword}" on page ${pageNum}, waiting...`);
        await delay(CONFIG.DELAY_ON_BLOCK_MS);
        break;
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

      console.log(`[eBay] Page ${pageNum}: found ${pageListings.length} listings for "${keyword}" (total: ${listings.length})`);

      if (pageNum < CONFIG.MAX_PAGES_PER_CARD && listings.length < CONFIG.MAX_LISTINGS_PER_CARD) {
        await delay(1500 + Math.random() * 1000);
      }
    } catch (err) {
      console.warn(`[eBay] Error scraping page ${pageNum} for "${keyword}": ${err.message}`);
      break;
    }
  }

  return listings;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('[eBay] GitHub Actions eBay Sold Listings Batch Scraper v2.0');
  console.log(`[eBay] Tiered Strategy: T1(hot)=${CONFIG.TIER1_HOT_DAYS}d quota=${CONFIG.TIER1_QUOTA}, T2(warm)=${CONFIG.TIER2_WARM_DAYS}d quota=${CONFIG.TIER2_QUOTA}, T3(cold)=${CONFIG.TIER3_COLD_DAYS}d quota=${CONFIG.TIER3_QUOTA}`);
  console.log('='.repeat(60));

  const cards = await getCardsToScrape();

  if (!cards.length) {
    console.log('[eBay] Nothing to scrape. All cards are up to date.');
    await (await getPool()).end();
    return;
  }

  console.log('[eBay] Launching Playwright browser...');
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
      '--lang=en-US',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });

  const page = await context.newPage();

  let successCards = 0;
  let failCards = 0;
  let totalInserted = 0;
  const pendingRecords = [];

  // Track tier stats
  const tierStats = { 1: { success: 0, fail: 0 }, 2: { success: 0, fail: 0 }, 3: { success: 0, fail: 0 } };

  try {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tierLabel = `T${card.tier}`;
      console.log(`[eBay] [${i + 1}/${cards.length}][${tierLabel}] Scraping: "${card.keyword}" (cardId=${card.cardId})`);

      try {
        const listings = await scrapeEbaySoldListings(page, card.keyword);

        if (listings.length > 0) {
          const records = listings.map(l => ({ ...l, cardId: card.cardId }));
          pendingRecords.push(...records);
          successCards++;
          tierStats[card.tier].success++;
          console.log(`[eBay] ✅ [${tierLabel}] cardId=${card.cardId}: ${listings.length} listings scraped`);
        } else {
          successCards++;
          tierStats[card.tier].success++;
          console.log(`[eBay] ⚠️  [${tierLabel}] cardId=${card.cardId}: 0 listings found (keyword: "${card.keyword}")`);
        }

        if (pendingRecords.length >= CONFIG.INGEST_BATCH) {
          const batch = pendingRecords.splice(0, CONFIG.INGEST_BATCH);
          const result = await ingestRecords(batch);
          totalInserted += result.inserted || 0;
          console.log(`[eBay] Ingested batch: +${result.inserted} inserted, ${result.skipped} skipped`);
        }

        if ((i + 1) % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
          await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted);
        }

        if (i < cards.length - 1) {
          // Slightly longer delay for cold cards to be gentler on eBay
          const extraDelay = card.tier === 3 ? 500 : 0;
          await delay(CONFIG.DELAY_BETWEEN_CARDS_MS + extraDelay + Math.random() * 1000);
        }
      } catch (err) {
        failCards++;
        tierStats[card.tier].fail++;
        console.error(`[eBay] ❌ [${tierLabel}] cardId=${card.cardId} failed: ${err.message}`);
        await delay(CONFIG.DELAY_ON_BLOCK_MS);
      }
    }

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
  console.log('='.repeat(60));
  console.log(`[eBay] COMPLETED in ${Math.ceil(elapsed / 60)}min`);
  console.log(`[eBay] Total: ${successCards} success, ${failCards} failed, ${totalInserted} records inserted`);
  console.log(`[eBay] T1(hot): ${tierStats[1].success} ok / ${tierStats[1].fail} fail`);
  console.log(`[eBay] T2(warm): ${tierStats[2].success} ok / ${tierStats[2].fail} fail`);
  console.log(`[eBay] T3(cold): ${tierStats[3].success} ok / ${tierStats[3].fail} fail`);
  console.log('='.repeat(60));

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
