/**
 * GitHub Actions eBay Sold Listings Batch Scraper v1.0
 *
 * Scrapes eBay completed/sold listings for PSA 10 graded Pokémon cards
 * using Playwright to bypass Cloudflare/bot detection.
 *
 * Strategy:
 *   - Fetch card keywords from platform API (built from card name + number)
 *   - Use Playwright (Chromium) to scrape eBay sold listings pages
 *   - Parse each listing: title, sold price (USD → HKD), sold date
 *   - Batch-ingest results into platform via /api/scheduled/ebay-ingest
 *   - Report progress and final status to platform
 *
 * Required env:
 *   DATABASE_URL   - MySQL connection string (for direct DB access)
 *   PLATFORM_URL   - Platform base URL (e.g. https://boxiumptcg-xxx.manus.space)
 *   CRON_SECRET    - Bearer token for platform API auth
 *
 * Optional env:
 *   BATCH_LIMIT    - Max cards to process per run (default: 100)
 *   SKIP_DAYS      - Skip cards updated within N days (default: 3)
 *   INGEST_BATCH   - Records to send per API call (default: 50)
 *   HEADLESS       - Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import mysql from 'mysql2/promise';

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  BATCH_LIMIT: parseInt(process.env.BATCH_LIMIT || '100', 10),
  SKIP_DAYS: parseInt(process.env.SKIP_DAYS || '3', 10),
  INGEST_BATCH: parseInt(process.env.INGEST_BATCH || '50', 10),
  HEADLESS: process.env.HEADLESS !== 'false',
  USD_TO_HKD: 7.8,
  PAGE_TIMEOUT: 30000,
  NAV_TIMEOUT: 45000,
  DELAY_BETWEEN_CARDS_MS: 2000,
  DELAY_ON_BLOCK_MS: 10000,
  MAX_PAGES_PER_CARD: 3,       // Max eBay result pages to scrape per card
  MAX_LISTINGS_PER_CARD: 60,   // Max sold listings to collect per card
  PROGRESS_REPORT_INTERVAL: 10, // Report progress every N cards
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseEbayPrice(priceText) {
  if (!priceText) return null;
  // Remove currency symbols, commas, spaces; handle "US $123.45" or "HK $123.45"
  const cleaned = priceText.replace(/[^\d.]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function parseEbaySoldDate(dateText) {
  if (!dateText) return new Date();
  try {
    // eBay formats: "Sold  Jan 15, 2025" or "Jan 15, 2025" or "15 Jan 2025"
    const cleaned = dateText.replace(/^Sold\s+/i, '').trim();
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (_) {}
  return new Date();
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

// ─── Get Cards to Scrape ──────────────────────────────────────────────────────
async function getCardsToScrape() {
  const db = await getPool();
  const skipMs = CONFIG.SKIP_DAYS * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - skipMs);

  // Get cards with SNKRDUNK data sources (active cards worth tracking)
  // Skip cards that have been scraped recently
  const [rows] = await db.execute(
    `SELECT DISTINCT c.id as cardId, c.name, c.cardNumber,
            MAX(ph.soldAt) as lastEbayRecord
     FROM cards c
     INNER JOIN dataSources ds ON ds.cardId = c.id AND ds.source = 'snkrdunk' AND ds.isActive = 1
     LEFT JOIN priceHistory ph ON ph.cardId = c.id AND ph.source = 'ebay'
     GROUP BY c.id, c.name, c.cardNumber
     HAVING lastEbayRecord IS NULL OR lastEbayRecord < ?
     ORDER BY lastEbayRecord ASC NULLS FIRST
     LIMIT ?`,
    [cutoffDate, CONFIG.BATCH_LIMIT]
  );

  return rows.map(row => {
    const rawName = row.name || '';
    const bracketIdx = rawName.indexOf('[');
    const engName = bracketIdx > 0 ? rawName.slice(0, bracketIdx).trim() : rawName.trim();
    // Remove Japanese/Chinese characters
    const cleanName = engName.replace(/[\u3000-\u9fff\uff00-\uffef]/g, '').trim();
    const cardNum = row.cardNumber || '';
    const keyword = `${cleanName} ${cardNum} PSA 10`.trim().replace(/\s+/g, ' ');
    return {
      cardId: row.cardId,
      keyword,
      cardNumber: cardNum,
      lastEbayRecord: row.lastEbayRecord,
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

    // eBay sold/completed listings URL
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodedKeyword}&LH_Sold=1&LH_Complete=1&_pgn=${pageNum}&_ipg=60`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.NAV_TIMEOUT });

      // Check for CAPTCHA or block page
      const title = await page.title();
      if (title.toLowerCase().includes('captcha') || title.toLowerCase().includes('security')) {
        console.warn(`[eBay] CAPTCHA detected for "${keyword}" on page ${pageNum}, waiting...`);
        await delay(CONFIG.DELAY_ON_BLOCK_MS);
        break;
      }

      // Wait for search results to load
      await page.waitForSelector('.srp-results, .s-item__wrapper, #srp-river-results', {
        timeout: CONFIG.PAGE_TIMEOUT,
      }).catch(() => {});

      // Extract listings using eBay's DOM structure
      const pageListings = await page.evaluate(() => {
        const items = [];
        // eBay sold listings selector
        const itemEls = document.querySelectorAll('.s-item__wrapper, li.s-item');
        itemEls.forEach(el => {
          // Skip "Shop on eBay" placeholder items
          const titleEl = el.querySelector('.s-item__title');
          const title = titleEl?.textContent?.trim() || '';
          if (!title || title.toLowerCase().includes('shop on ebay')) return;

          // Price
          const priceEl = el.querySelector('.s-item__price');
          const priceText = priceEl?.textContent?.trim() || '';

          // Sold date
          const dateEl = el.querySelector('.s-item__ended-date, .s-item__title--tag span, [class*="sold-date"]');
          const dateText = dateEl?.textContent?.trim() || '';

          // Listing URL
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
        if (!priceUsd || priceUsd < 5) continue; // Skip very cheap items (likely not PSA 10)

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

      // Small delay between pages to avoid rate limiting
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
  console.log('[eBay] GitHub Actions eBay Sold Listings Batch Scraper v1.0');
  console.log(`[eBay] Config: BATCH_LIMIT=${CONFIG.BATCH_LIMIT}, SKIP_DAYS=${CONFIG.SKIP_DAYS}`);
  console.log('='.repeat(60));

  // Get cards to scrape
  const cards = await getCardsToScrape();
  console.log(`[eBay] Found ${cards.length} cards to scrape`);

  if (!cards.length) {
    console.log('[eBay] Nothing to scrape. All cards are up to date.');
    await (await getPool()).end();
    return;
  }

  // Launch Playwright browser
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

  // Create browser context with realistic user agent
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

  try {
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      console.log(`[eBay] [${i + 1}/${cards.length}] Scraping: "${card.keyword}" (cardId=${card.cardId})`);

      try {
        const listings = await scrapeEbaySoldListings(page, card.keyword);

        if (listings.length > 0) {
          // Add cardId to each record
          const records = listings.map(l => ({ ...l, cardId: card.cardId }));
          pendingRecords.push(...records);
          successCards++;
          console.log(`[eBay] ✅ cardId=${card.cardId}: ${listings.length} listings scraped`);
        } else {
          // No listings found is not a failure (card may not have eBay PSA 10 sales)
          successCards++;
          console.log(`[eBay] ⚠️  cardId=${card.cardId}: 0 listings found (keyword: "${card.keyword}")`);
        }

        // Flush pending records in batches
        if (pendingRecords.length >= CONFIG.INGEST_BATCH) {
          const batch = pendingRecords.splice(0, CONFIG.INGEST_BATCH);
          const result = await ingestRecords(batch);
          totalInserted += result.inserted || 0;
          console.log(`[eBay] Ingested batch: +${result.inserted} inserted, ${result.skipped} skipped`);
        }

        // Report progress periodically
        if ((i + 1) % CONFIG.PROGRESS_REPORT_INTERVAL === 0) {
          await reportProgress(i + 1, successCards, failCards, cards.length, totalInserted);
        }

        // Delay between cards to avoid rate limiting
        if (i < cards.length - 1) {
          await delay(CONFIG.DELAY_BETWEEN_CARDS_MS + Math.random() * 1000);
        }
      } catch (err) {
        failCards++;
        console.error(`[eBay] ❌ cardId=${card.cardId} failed: ${err.message}`);
        await delay(CONFIG.DELAY_ON_BLOCK_MS);
      }
    }

    // Flush remaining records
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
  console.log(`[eBay] COMPLETED: ${successCards} success, ${failCards} failed, ${totalInserted} records inserted in ${Math.ceil(elapsed / 60)}min`);
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
