#!/usr/bin/env node
/**
 * PSA Playwright Matcher v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 * 在本地電腦執行，使用 Playwright（真實 Chrome）繞過 Cloudflare Bot Management。
 * 自動登入 PSA 帳號後執行批量搜尋。
 *
 * 使用方式：
 *   node psaPlaywrightMatcher.mjs --test      # 測試模式（每帳號 5 張）
 *   node psaPlaywrightMatcher.mjs             # 正式執行
 *
 * accounts.json 格式：
 *   [
 *     { "email": "user1@example.com", "password": "yourpassword" }
 *   ]
 *
 * 環境變數：
 *   DATABASE_URL    MySQL 連線字串（必填）
 *   DELAY_MS        每個請求間隔 ms（預設：3000）
 *   HEADLESS        設為 'false' 可看到瀏覽器視窗（預設：true）
 */

import { chromium } from 'playwright';
import { createConnection } from 'mysql2/promise';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '3000', 10);
const CARDS_PER_WORKER = parseInt(process.env.CARDS_PER_WORKER ?? '0', 10);
const REMATCH_DAYS = parseInt(process.env.REMATCH_DAYS ?? '30', 10);
const TEST_MODE = process.argv.includes('--test') || process.env.TEST_MODE === 'true';
const HEADLESS = process.env.HEADLESS !== 'false'; // default true
const ACCOUNTS_FILE = join(__dirname, 'accounts.json');

// ─── PSA Series Keyword Map ───────────────────────────────────────────────────
const PSA_SET_KEYWORDS = {
  'Obsidian Flames': ['Obsidian Flames', 'OBF'],
  'Paldea Evolved': ['Paldea Evolved', 'PAL'],
  'Scarlet & Violet': ['Scarlet & Violet', 'SVI', 'Scarlet Violet'],
  'Paradox Rift': ['Paradox Rift', 'PAR'],
  'Paldean Fates': ['Paldean Fates'],
  'Temporal Forces': ['Temporal Forces', 'TEF'],
  'Twilight Masquerade': ['Twilight Masquerade', 'TWM'],
  'Shrouded Fable': ['Shrouded Fable', 'SFA'],
  'Stellar Crown': ['Stellar Crown', 'SCR'],
  'Surging Sparks': ['Surging Sparks', 'SSP'],
  'Prismatic Evolutions': ['Prismatic Evolutions', 'PRE'],
  'Journey Together': ['Journey Together', 'JTG'],
  'Destined Rivals': ['Destined Rivals', 'DRI'],
  'Chilling Reign': ['Chilling Reign', 'CRE'],
  'Evolving Skies': ['Evolving Skies', 'EVS'],
  'Fusion Strike': ['Fusion Strike', 'FST'],
  'Brilliant Stars': ['Brilliant Stars', 'BRS'],
  'Astral Radiance': ['Astral Radiance', 'ASR'],
  'Lost Origin': ['Lost Origin', 'LOR'],
  'Silver Tempest': ['Silver Tempest', 'SIT'],
  'Crown Zenith': ['Crown Zenith', 'CRZ'],
  'SM-P Promotional cards': ['SM Promo', 'SM-P'],
  'XY-P Promotional cards': ['XY Promo', 'XY-P'],
  'BW-P Promotional cards': ['BW Promo', 'BW-P'],
  'Sword & Shield Promos': ['SWSH Promo', 'SWSH-P'],
  'Scarlet & Violet Promos': ['SV Promo', 'SVP'],
  'SV-P Promotional cards': ['SV Promo', 'SV-P'],
  'Pokémon GO': ['Pokemon GO', 'PGO'],
  'Vstar Universe': ['VSTAR Universe'],
  'Shiny Treasure ex': ['Shiny Treasure'],
  'Wild Force': ['Wild Force'],
  'Cyber Judge': ['Cyber Judge'],
  'Crimson Haze': ['Crimson Haze'],
  'Night Wanderer': ['Night Wanderer'],
  'Stellar Miracle': ['Stellar Miracle'],
  'Super Electric Breaker': ['Super Electric Breaker'],
  'Mask of Change': ['Mask of Change'],
  'Ancient Roar': ['Ancient Roar'],
  'Future Flash': ['Future Flash'],
  'Pokemon Card 151': ['Pokemon Card 151', 'SV2a', '151'],
  'Clay Burst': ['Clay Burst', 'SV2D'],
  'Snow Hazard': ['Snow Hazard', 'SV2P'],
  'Triplet Beat': ['Triplet Beat', 'SV1a'],
  'Violet ex': ['Violet ex', 'SV1V'],
  'Scarlet ex': ['Scarlet ex', 'SV1S'],
  'Ruler of the Black Flame': ['Ruler of the Black Flame', 'SV3'],
  'Raging Surf': ['Raging Surf', 'SV3a'],
  'Paradise Dragona': ['Paradise Dragona', 'SV4K'],
  'Expansion Pack "Lost Abyss"': ['Lost Abyss', 'S11'],
  'Expansion Pack "Incandescent Arcana"': ['Incandescent Arcana', 'S11a'],
  'Expansion Pack "Paradigm Trigger"': ['Paradigm Trigger', 'S12'],
  'Expansion Pack "Clash at the Summit"': ['Clash at the Summit', 'L3'],
  'Expansion Pack "Ruler of the Black Flame"': ['Ruler of the Black Flame', 'SV3', 'SVF'],
  'Expansion Pack "Pokemon GO"': ['Pokemon GO', 's10b'],
};

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(card) {
  const lang = (card.language || '').toLowerCase();
  if (lang === 'ja' || lang === 'japanese' || lang === 'jp') return 'japanese';
  if (lang === 'en' || lang === 'english') return 'english';
  const name = card.name || '';
  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(name);
  return hasJapanese ? 'japanese' : 'english';
}

function extractPureNumber(cardNumber) {
  if (!cardNumber) return null;
  const m = String(cardNumber).match(/(\d+)/);
  return m ? m[1] : null;
}

// ─── Build Search Query ───────────────────────────────────────────────────────
function buildSearchQuery(card) {
  const lang = detectLanguage(card);
  const pureNum = extractPureNumber(card.cardNumber);
  const setName = card.setName || card.series || '';
  const name = card.name || '';
  const langStr = lang === 'japanese' ? 'japanese' : 'EN';

  let parts = [];
  if (name) parts.push(name);
  if (pureNum && card.cardNumber) parts.push(`[${card.cardNumber}]`);
  if (setName) parts.push(`(${setName})`);
  parts.push(langStr);
  parts.push('pokemon');

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ─── Parse RSC Payload ────────────────────────────────────────────────────────
function parseSearchResults(html) {
  const results = [];
  const seen = new Set();

  // Method 1: RSC payload (Next.js React Server Components)
  const scriptRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let sm;
  while ((sm = scriptRegex.exec(html)) !== null) {
    let decoded;
    try {
      decoded = JSON.parse(`"${sm[1]}"`);
    } catch {
      decoded = sm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    const specRegex = /"specId":(\d+),"categoryId":\d+,"setName":"([^"]*)","collectibleYear":"([^"]*)","collectibleSubject":"([^"]*)","variety":"([^"]*)","setNumber":"([^"]*)"/g;
    let m;
    while ((m = specRegex.exec(decoded)) !== null) {
      const [, specId, setName, year, subject, variety, setNumber] = m;
      if (seen.has(specId)) continue;
      seen.add(specId);
      const title = `${subject} ${setName} ${setNumber} ${variety} ${year}`.trim();
      results.push({ specId, title, setName, year, subject, variety, setNumber });
    }
  }

  // Method 2: Fallback — href links
  if (results.length === 0) {
    const linkRegex = /<a[^>]+href=["']([^"']*\/auctionprices\/[^"']*\/values\/[^"']*\/(\d+))["'][^>]*>(.*?)<\/a>/gis;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const specId = m[2];
      const rawText = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (specId && rawText && !seen.has(specId)) {
        seen.add(specId);
        results.push({ specId, title: rawText });
      }
    }
  }

  return results;
}

// ─── Match Card ───────────────────────────────────────────────────────────────
function matchCard(card, results) {
  const lang = detectLanguage(card);
  const pureNum = extractPureNumber(card.cardNumber);
  const setName = card.setName || '';
  const series = card.series || '';
  const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series] || [];

  for (const result of results) {
    const title = result.title.toLowerCase();
    const resultSetName = (result.setName || '').toLowerCase();
    const resultSetNumber = (result.setNumber || '').toLowerCase();

    // Layer 1: Card number exact match
    if (pureNum) {
      const numPattern = new RegExp(`#${pureNum}\\b|\\b${pureNum}\\b`);
      const numInTitle = numPattern.test(result.title);
      const numInSetNumber = resultSetNumber === pureNum.padStart(3, '0') ||
                             resultSetNumber === pureNum ||
                             resultSetNumber.startsWith(pureNum + '/');
      if (!numInTitle && !numInSetNumber) continue;
    }

    // Layer 2: Language match
    if (lang === 'japanese') {
      if (!title.includes('japanese') && !title.includes('japan') && !title.includes('jp ') &&
          !resultSetName.includes('japanese') && !resultSetName.includes('japan')) continue;
    } else {
      if (title.includes('japanese') || title.includes('japan') ||
          resultSetName.includes('japanese') || resultSetName.includes('japan')) continue;
    }

    // Layer 3: Series/set keyword match
    if (setKeywords.length > 0) {
      const hasSetMatch = setKeywords.some(kw =>
        title.includes(kw.toLowerCase()) || resultSetName.includes(kw.toLowerCase())
      );
      if (!hasSetMatch) {
        const setWords = setName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const hasFallback = setWords.length > 0 && setWords.some(w =>
          title.includes(w) || resultSetName.includes(w)
        );
        if (!hasFallback) continue;
      }
    }

    return result.specId;
  }
  return null;
}

// ─── Database ─────────────────────────────────────────────────────────────────
async function getConnection() {
  const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error('Cannot parse DATABASE_URL');
  const [, user, pass, host, port, database] = match;
  return createConnection({ host, port: parseInt(port), user, password: pass, database, ssl: { rejectUnauthorized: false } });
}

async function getCardsForWorker(conn, workerIdx, totalWorkers, limit) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - REMATCH_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

  const limitClause = limit > 0 ? `LIMIT ${limit}` : 'LIMIT 100000';
  const [rows] = await conn.execute(
    `SELECT id, cardId, name, nameJa, series, setName, cardNumber, language, rarity
     FROM cards
     WHERE MOD(id, ?) = ?
       AND psaSpecId IS NULL
       AND (psaMatchedAt IS NULL OR psaMatchedAt < ?)
     ORDER BY psaMatchedAt ASC, id ASC
     ${limitClause}`,
    [totalWorkers, workerIdx, cutoffStr]
  );
  return rows;
}

async function updateCardPsaSpecId(conn, cardId, specId) {
  await conn.execute(
    'UPDATE cards SET psaSpecId = ?, psaMatchedAt = NOW() WHERE id = ?',
    [specId, cardId]
  );
}

async function markCardAsAttempted(conn, cardId) {
  await conn.execute(
    'UPDATE cards SET psaMatchedAt = NOW() WHERE id = ?',
    [cardId]
  );
}

async function getTotalUnmatched(conn) {
  const [rows] = await conn.execute(
    'SELECT COUNT(*) as cnt FROM cards WHERE psaSpecId IS NULL'
  );
  return rows[0].cnt;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => DELAY_MS + Math.floor(Math.random() * 1000);

// ─── Check if page has search results ────────────────────────────────────────
function isSearchResultPage(html) {
  return html.includes('__next_f') || html.includes('specId') || html.includes('auctionprices');
}

function isLoginPage(html, url) {
  // If we're on psacard.com, it's NOT a login page
  if (url.includes('psacard.com')) return false;
  return url.includes('/signin') || url.includes('/login') || url.includes('collectors.com/brandsignin') ||
         html.includes('Sign in to PSA') || html.includes('Sign In to PSA');
}

// ─── PSA Login via Playwright ─────────────────────────────────────────────────
async function loginToPsa(page, email, password, workerIdx) {
  console.log(`  [W${workerIdx}] Navigating to PSA login...`);

  // Go directly to the collectors.com login page
  await page.goto('https://app.collectors.com/brandsignin?brand=psa&returnUrl=https://www.psacard.com/auctionprices', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await sleep(2000);

  // Handle CF challenge if present
  const titleText = await page.title();
  if (titleText.includes('Just a moment')) {
    console.log(`  [W${workerIdx}] CF challenge on login page, waiting up to 30s...`);
    try {
      await page.waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 30000 });
    } catch {
      console.log(`  [W${workerIdx}] CF challenge timeout`);
      return false;
    }
    await sleep(2000);
  }

  const currentUrl = page.url();
  console.log(`  [W${workerIdx}] Current URL: ${currentUrl}`);

  // If already redirected away from signin (session exists), go to PSA directly
  if (!currentUrl.includes('signin') && !currentUrl.includes('login')) {
    console.log(`  [W${workerIdx}] Session already active, navigating to PSA...`);
    await page.goto('https://www.psacard.com/auctionprices/search?q=Pikachu', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await sleep(2000);
    const psaUrl = page.url();
    const psaHtml = await page.content();
    if (psaUrl.includes('psacard.com') && !isLoginPage(psaHtml, psaUrl)) {
      console.log(`  [W${workerIdx}] PSA accessible, login successful!`);
      return true;
    }
  }

  // Fill email
  try {
    console.log(`  [W${workerIdx}] Looking for email field...`);
    const emailInput = page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.click();
    await emailInput.fill(email);
    await sleep(500);

    // Some forms have a "Continue" button before showing password
    const continueBtn = page.locator('button[type="submit"]:has-text("Continue"), button:has-text("Continue")').first();
    const hasContinue = await continueBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasContinue) {
      await continueBtn.click();
      await sleep(1500);
    }

    // Fill password
    console.log(`  [W${workerIdx}] Looking for password field...`);
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.click();
    await passwordInput.fill(password);
    await sleep(500);

    // Submit - find the actual sign in button on the login form
    console.log(`  [W${workerIdx}] Submitting login...`);
    // Press Enter to submit (most reliable)
    await passwordInput.press('Enter');

    // Wait for navigation away from login page
    console.log(`  [W${workerIdx}] Waiting for post-login navigation...`);
    try {
      await page.waitForURL(url => !url.includes('signin') && !url.includes('login'), { timeout: 30000 });
    } catch {
      // Navigation might have already happened
    }
    await sleep(2000);

    // Navigate to PSA search page regardless of where we ended up
    const postLoginUrl = page.url();
    console.log(`  [W${workerIdx}] Post-login URL: ${postLoginUrl}`);
    
    if (!postLoginUrl.includes('psacard.com')) {
      console.log(`  [W${workerIdx}] Navigating to PSA search page...`);
      await page.goto('https://www.psacard.com/auctionprices/search?q=Pikachu', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await sleep(2000);
    }

    const finalUrl = page.url();
    const finalHtml = await page.content();
    if (isLoginPage(finalHtml, finalUrl)) {
      console.log(`  [W${workerIdx}] Still on login page after submit`);
      return false;
    }
    console.log(`  [W${workerIdx}] Login successful! URL: ${finalUrl}`);
    return true;

  } catch (e) {
    // Even if there was an error, check if we ended up on PSA
    const errorUrl = page.url();
    const errorTitle = await page.title();
    console.log(`  [W${workerIdx}] Login attempt error: ${e.message.slice(0, 100)}`);
    console.log(`  [W${workerIdx}] Current - URL: ${errorUrl}, Title: ${errorTitle}`);
    
    // If we're not on signin page, try navigating to PSA directly
    if (!errorUrl.includes('signin') && !errorUrl.includes('login')) {
      console.log(`  [W${workerIdx}] Not on login page, trying PSA directly...`);
      await page.goto('https://www.psacard.com/auctionprices/search?q=Pikachu', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      }).catch(() => {});
      await sleep(2000);
      const tryUrl = page.url();
      const tryHtml = await page.content();
      if (tryUrl.includes('psacard.com') && !isLoginPage(tryHtml, tryUrl)) {
        console.log(`  [W${workerIdx}] PSA accessible after error recovery!`);
        return true;
      }
    }
    return false;
  }
}

// ─── Fetch PSA Search via Playwright ─────────────────────────────────────────
async function fetchPsaPagePlaywright(page, query, workerIdx) {
  const url = `https://www.psacard.com/auctionprices/search?q=${encodeURIComponent(query)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Handle CF challenge
      const titleText = await page.title();
      if (titleText.includes('Just a moment')) {
        console.log(`  [W${workerIdx}] CF challenge, waiting up to 20s...`);
        try {
          await page.waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 20000 });
        } catch {
          console.log(`  [W${workerIdx}] CF challenge timeout, retrying...`);
          await sleep(5000);
          continue;
        }
        await sleep(1500);
      }

      // Wait for Next.js RSC data to be injected
      await sleep(1000);

      const currentUrl = page.url();
      const html = await page.content();

      // Check if redirected to login
      if (isLoginPage(html, currentUrl)) {
        console.log(`  [W${workerIdx}] Redirected to login page`);
        return { html: null, needsLogin: true };
      }

      return { html, needsLogin: false };

    } catch (e) {
      console.log(`  [W${workerIdx}] Page error: ${e.message.slice(0, 80)}, attempt ${attempt}/3`);
      if (attempt < 3) { await sleep(5000); continue; }
      return { html: null, needsLogin: false };
    }
  }
  return { html: null, needsLogin: false };
}

// ─── Worker ───────────────────────────────────────────────────────────────────
async function runWorker(workerIdx, totalWorkers, account, sharedStats) {
  const conn = await getConnection();
  const limit = TEST_MODE ? 5 : (CARDS_PER_WORKER > 0 ? CARDS_PER_WORKER : 0);
  const cards = await getCardsForWorker(conn, workerIdx, totalWorkers, limit);

  console.log(`[W${workerIdx}] ${account.email.slice(0, 10)}*** — ${cards.length} cards to process`);

  if (cards.length === 0) {
    console.log(`[W${workerIdx}] Nothing to process`);
    await conn.end();
    return;
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const page = await context.newPage();

  // Login
  console.log(`[W${workerIdx}] Logging in...`);
  const loggedIn = await loginToPsa(page, account.email, account.password, workerIdx);
  if (!loggedIn) {
    console.error(`[W${workerIdx}] ❌ Login failed, skipping worker`);
    await browser.close();
    await conn.end();
    return;
  }

  let matched = 0, noMatch = 0, errors = 0;
  let loginRetries = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const query = buildSearchQuery(card);

    if (i % 50 === 0) {
      const pct = Math.round(i / cards.length * 100);
      console.log(`[W${workerIdx}] Progress: ${i}/${cards.length} (${pct}%) | matched=${matched} noMatch=${noMatch} errors=${errors}`);
    }

    try {
      const { html, needsLogin } = await fetchPsaPagePlaywright(page, query, workerIdx);

      if (needsLogin) {
        if (loginRetries >= 3) {
          console.error(`[W${workerIdx}] Too many login retries, stopping`);
          break;
        }
        loginRetries++;
        console.log(`[W${workerIdx}] Re-logging in (attempt ${loginRetries}/3)...`);
        const reLoggedIn = await loginToPsa(page, account.email, account.password, workerIdx);
        if (!reLoggedIn) {
          console.error(`[W${workerIdx}] Re-login failed, stopping`);
          break;
        }
        i--; // Retry this card
        continue;
      }

      loginRetries = 0; // Reset on success

      if (!html) {
        await markCardAsAttempted(conn, card.id);
        errors++;
        sharedStats.errors++;
        await sleep(randomDelay());
        continue;
      }

      const results = parseSearchResults(html);
      const specId = matchCard(card, results);

      if (specId) {
        await updateCardPsaSpecId(conn, card.id, specId);
        matched++;
        sharedStats.matched++;
        console.log(`[W${workerIdx}] ✅ #${card.id} "${card.name}" → specId: ${specId}`);
      } else {
        await markCardAsAttempted(conn, card.id);
        noMatch++;
        sharedStats.noMatch++;
        if (results.length > 0) {
          console.log(`[W${workerIdx}] ❌ #${card.id} "${card.name}" — ${results.length} candidates, no match`);
        } else {
          console.log(`[W${workerIdx}] ❌ #${card.id} "${card.name}" — 0 results`);
        }
      }
    } catch (e) {
      console.error(`[W${workerIdx}] 💥 Error on card #${card.id}: ${e.message}`);
      await markCardAsAttempted(conn, card.id);
      errors++;
      sharedStats.errors++;
    }

    if (i < cards.length - 1) {
      await sleep(randomDelay());
    }
  }

  console.log(`[W${workerIdx}] Done — matched=${matched} noMatch=${noMatch} errors=${errors}`);
  await browser.close();
  await conn.end();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('PSA Playwright Matcher v2.1');
  console.log(`Mode: ${TEST_MODE ? '🧪 TEST (5 cards per worker)' : '🚀 PRODUCTION'}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`Delay: ${DELAY_MS}ms between requests`);
  console.log('='.repeat(60) + '\n');

  if (!DB_URL) {
    console.error('❌ DATABASE_URL not set. Please set it in .env or environment.');
    process.exit(1);
  }

  // Load accounts
  if (!existsSync(ACCOUNTS_FILE)) {
    console.error(`❌ accounts.json not found at ${ACCOUNTS_FILE}`);
    writeFileSync(ACCOUNTS_FILE, JSON.stringify([
      { "email": "your-psa-email@example.com", "password": "your-password" }
    ], null, 2));
    console.log('Please edit accounts.json with your PSA account credentials and run again.');
    process.exit(1);
  }

  const accounts = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
  const validAccounts = accounts.filter(a => a.email && a.password && a.password !== 'your-password');
  if (!validAccounts.length) {
    console.error('❌ No valid accounts in accounts.json. Please add email and password.');
    process.exit(1);
  }

  console.log(`✅ Loaded ${validAccounts.length} account(s)`);

  // Check DB connection
  const testConn = await getConnection();
  const total = await getTotalUnmatched(testConn);
  console.log(`📋 Total unmatched cards in DB: ${total}`);
  await testConn.end();

  const totalWorkers = validAccounts.length;
  console.log(`🚀 Starting ${totalWorkers} parallel worker(s)...\n`);

  const sharedStats = { matched: 0, noMatch: 0, errors: 0 };
  const startTime = Date.now();

  // Run all workers in parallel
  await Promise.all(
    validAccounts.map((account, idx) =>
      runWorker(idx, totalWorkers, account, sharedStats)
    )
  );

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  console.log('\n' + '='.repeat(60));
  console.log('PSA Playwright Matcher — Done');
  console.log(`  Time elapsed: ${mins}m ${secs}s`);
  console.log(`  ✅ Matched:  ${sharedStats.matched}`);
  console.log(`  ❌ No match: ${sharedStats.noMatch}`);
  console.log(`  ⚠️  Errors:   ${sharedStats.errors}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
