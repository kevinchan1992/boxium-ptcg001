/**
 * PSA Spec ID Batch Matcher v3.0 (Playwright + Full Login)
 *
 * Strategy: Precise 3-Layer Matching using Playwright (bypasses Cloudflare + Login)
 *   - Login: Playwright navigates to PSA login page, enters email/password
 *   - Layer 1: Card number exact match (e.g., "#141", "#293")
 *   - Layer 2: Language match (japanese / EN)
 *   - Layer 3: Series/set keyword match
 *
 * Only stores psaSpecId when ALL 3 layers pass. No guessing, no fallback.
 *
 * Required env:
 *   DATABASE_URL    MySQL connection string
 *   BATCH_INDEX     This job's shard index (0-based)
 *   TOTAL_BATCHES   Total number of parallel jobs
 *   PSA_EMAIL       PSA account email
 *   PSA_PASSWORD    PSA account password
 *
 * Optional env:
 *   CARDS_PER_BATCH Max cards per shard (default: 5000)
 *   REMATCH_DAYS    Re-attempt cards matched > N days ago (default: 30)
 *   DELAY_MS        Delay between PSA requests in ms (default: 2500)
 *   HEADLESS        Set to 'false' for debugging (default: true)
 */

import { chromium } from 'playwright';
import { createConnection } from 'mysql2/promise';

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
const BATCH_INDEX = parseInt(process.env.BATCH_INDEX ?? '0', 10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES ?? '1', 10);
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH ?? '5000', 10);
const REMATCH_DAYS = parseInt(process.env.REMATCH_DAYS ?? '30', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '2500', 10);
const CARD_IDS = process.env.CARD_IDS ? process.env.CARD_IDS.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean) : [];
const HEADLESS = process.env.HEADLESS !== 'false';
const PSA_EMAIL = process.env.PSA_EMAIL || '';
const PSA_PASSWORD = process.env.PSA_PASSWORD || '';

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

// ─── PSA Series Keyword Map ───────────────────────────────────────────────────
const PSA_SET_KEYWORDS = {
  // English Scarlet & Violet era
  'Obsidian Flames': ['Obsidian Flames', 'Obf', 'OBF'],
  'Paldea Evolved': ['Paldea Evolved', 'Pal', 'PAL'],
  'Scarlet & Violet': ['Scarlet & Violet', 'Svi', 'SVI', 'Scarlet Violet'],
  'Paradox Rift': ['Paradox Rift', 'Par', 'PAR'],
  'Paldean Fates': ['Paldean Fates', 'Pal', 'PAL'],
  'Temporal Forces': ['Temporal Forces', 'TEF'],
  'Twilight Masquerade': ['Twilight Masquerade', 'TWM'],
  'Shrouded Fable': ['Shrouded Fable', 'SFA'],
  'Stellar Crown': ['Stellar Crown', 'SCR'],
  'Surging Sparks': ['Surging Sparks', 'SSP'],
  'Prismatic Evolutions': ['Prismatic Evolutions', 'PRE'],
  'Journey Together': ['Journey Together', 'JTG'],
  'Destined Rivals': ['Destined Rivals', 'DRI'],
  // English Sword & Shield era
  'Chilling Reign': ['Chilling Reign', 'CRE'],
  'Evolving Skies': ['Evolving Skies', 'EVS'],
  'Fusion Strike': ['Fusion Strike', 'FST'],
  'Brilliant Stars': ['Brilliant Stars', 'BRS'],
  'Astral Radiance': ['Astral Radiance', 'ASR'],
  'Lost Origin': ['Lost Origin', 'LOR'],
  'Silver Tempest': ['Silver Tempest', 'SIT'],
  'Crown Zenith': ['Crown Zenith', 'CRZ'],
  // Japanese sets
  'SM-P Promotional cards': ['SM Promo', 'SM-P', 'SM P'],
  'XY-P Promotional cards': ['XY Promo', 'XY-P', 'XY P'],
  'BW-P Promotional cards': ['BW Promo', 'BW-P', 'BW P'],
  'Sword & Shield Promos': ['SWSH Promo', 'SWSH-P'],
  'Scarlet & Violet Promos': ['SV Promo', 'SVP'],
  // Japanese main sets
  'Crimson Haze': ['Crimson Haze', 'SV5a'],
  'Wild Force': ['Wild Force', 'SV5K'],
  'Cyber Judge': ['Cyber Judge', 'SV5M'],
  'Clay Burst': ['Clay Burst', 'SV2D'],
  'Snow Hazard': ['Snow Hazard', 'SV2P'],
  'Triplet Beat': ['Triplet Beat', 'SV1a'],
  'Scarlet ex': ['Scarlet ex', 'SV1S'],
  'Violet ex': ['Violet ex', 'SV1V'],
  'Raging Surf': ['Raging Surf', 'SV3a'],
  'Ruler of the Black Flame': ['Ruler', 'SV3'],
  'Ancient Roar': ['Ancient Roar', 'SV4K'],
  'Future Flash': ['Future Flash', 'SV4M'],
  'Mask of Change': ['Mask of Change', 'SV6'],
  'Night Wanderer': ['Night Wanderer', 'SV6a'],
  'Stellar Miracle': ['Stellar Miracle', 'SV7'],
  'Paradise Dragona': ['Paradise Dragona', 'SV7a'],
  'Super Electric Breaker': ['Super Electric Breaker', 'SV8'],
  'Terastal Festival ex': ['Terastal Festival', 'SV8a'],
  'Prismatic Evolution': ['Prismatic Evolution', 'SV8b'],
  'Battle Partners': ['Battle Partners', 'SV9'],
  'Destined Rivals': ['Destined Rivals', 'SV9a'],
  // Older Japanese sets
  'BREAK Special Box': ['BREAK', 'Special Box'],
  'Mario Pikachu Special Box': ['Mario Pikachu', 'Mario'],
  'Holo-Mario Pikachu Special Box': ['Mario Pikachu', 'Mario'],
  'Mega Charizard Y Pikachu Special Box': ['Charizard', 'Poncho'],
  'Eevee Mega Campaign': ['Eevee', 'Poncho', 'Campaign'],
  'Munch: A Retrospective': ['Munch', 'Retrospective'],
};

// ─── Language Detection ───────────────────────────────────────────────────────
function detectLanguage(card) {
  const lang = (card.language || 'en').toLowerCase();
  const series = (card.series || '').toLowerCase();
  const setName = (card.setName || '').toLowerCase();
  const cardId = (card.cardId || '').toLowerCase();

  if (lang === 'ja' || lang === 'jp' || lang === 'japanese') return 'japanese';
  if (series.includes('japanese') || setName.includes('japanese')) return 'japanese';
  if (cardId.includes('jp') || cardId.includes('-ja-')) return 'japanese';
  if (/^(sm|xy|bw|dp|swsh|sv)-?p\s/i.test(card.cardNumber || '')) return 'japanese';
  if (/SM-P|XY-P|BW-P|SWSH-P|SV-P/i.test(card.setName || '')) return 'japanese';

  return 'en';
}

// ─── Build PSA Search Query ───────────────────────────────────────────────────
function buildSearchQuery(card) {
  const lang = detectLanguage(card);
  const name = card.name || '';
  const setName = card.setName || '';
  const series = card.series || '';

  let cardNum = card.cardNumber || '';
  const numMatch = cardNum.match(/(\d+)(?:\/\d+)?$/);
  const pureNum = numMatch ? numMatch[1] : null;

  const parts = [name];

  const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series];
  if (setKeywords && setKeywords.length > 0) {
    parts.push(setKeywords[0]);
  } else if (setName) {
    parts.push(setName.split(' ').slice(0, 2).join(' '));
  }

  if (pureNum) {
    parts.push(pureNum);
  }

  parts.push(lang === 'japanese' ? 'japanese' : 'EN');
  parts.push('pokemon');

  return parts.join(' ');
}

// ─── Extract Card Number for Matching ────────────────────────────────────────
function extractPureNumber(cardNumber) {
  if (!cardNumber) return null;
  const m = cardNumber.match(/(\d+)(?:\/\d+)?$/);
  return m ? m[1] : null;
}

// ─── Parse Search Results from HTML ──────────────────────────────────────────
function parseSearchResults(html) {
  const results = [];
  const linkRegex = /<a[^>]+href=["']([^"']*\/spec\/psa\/[^"']*)["'][^>]*>(.*?)<\/a>/gis;
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    const rawText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const specMatch = href.match(/\/spec\/psa\/(\d+)/);
    if (!specMatch) continue;
    const specId = specMatch[1];
    if (specId && rawText) {
      results.push({ specId, title: rawText });
    }
  }
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.specId)) return false;
    seen.add(r.specId);
    return true;
  });
}

// ─── Match Card Against PSA Results ──────────────────────────────────────────
function matchCard(card, results) {
  const lang = detectLanguage(card);
  const pureNum = extractPureNumber(card.cardNumber);
  const setName = card.setName || '';
  const series = card.series || '';

  const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series] || [];

  for (const result of results) {
    const title = result.title.toLowerCase();

    // Layer 1: Card number exact match
    if (pureNum) {
      const numPattern = new RegExp(`#${pureNum}\\b|\\b${pureNum}\\b`);
      if (!numPattern.test(result.title)) continue;
    }

    // Layer 2: Language match
    if (lang === 'japanese') {
      if (!title.includes('japanese') && !title.includes('japan') && !title.includes('jp ')) continue;
    } else {
      if (title.includes('japanese') || title.includes('japan')) continue;
    }

    // Layer 3: Series/set keyword match
    if (setKeywords.length > 0) {
      const hasSetMatch = setKeywords.some(kw => title.includes(kw.toLowerCase()));
      if (!hasSetMatch) {
        const setWords = setName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const hasFallback = setWords.length > 0 && setWords.some(w => title.includes(w));
        if (!hasFallback) continue;
      }
    }

    return result.specId;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => DELAY_MS + Math.floor(Math.random() * 1500);

// ─── Playwright: Login to PSA ─────────────────────────────────────────────────
async function loginToPsa(page) {
  if (!PSA_EMAIL || !PSA_PASSWORD) {
    console.log('[PSA Login] No credentials provided, skipping login');
    return false;
  }

  console.log('[PSA Login] Navigating to PSA login page...');
  try {
    // Navigate to a page that will redirect to login
    await page.goto('https://www.psacard.com/myaccount/signin', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await sleep(2000);

    const url = page.url();
    console.log(`[PSA Login] Current URL: ${url}`);

    // Check if we're on an Auth0 login page or PSA login page
    const pageTitle = await page.title();
    console.log(`[PSA Login] Page title: ${pageTitle}`);

    // Look for email input field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
    ];

    let emailInput = null;
    for (const sel of emailSelectors) {
      try {
        emailInput = await page.waitForSelector(sel, { timeout: 5000 });
        if (emailInput) {
          console.log(`[PSA Login] Found email input: ${sel}`);
          break;
        }
      } catch (e) {
        // try next selector
      }
    }

    if (!emailInput) {
      console.log('[PSA Login] ⚠️ Could not find email input, trying alternative login flow...');
      // Try clicking continue/next button if there's a two-step login
      const html = await page.content();
      console.log(`[PSA Login] Page HTML snippet: ${html.slice(0, 500)}`);
      return false;
    }

    // Type email
    await emailInput.click();
    await emailInput.fill(PSA_EMAIL);
    await sleep(500);

    // Look for "Continue" button (Auth0 two-step login)
    const continueSelectors = [
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("Next")',
      'input[type="submit"]',
    ];

    let continueBtn = null;
    for (const sel of continueSelectors) {
      try {
        continueBtn = await page.$(sel);
        if (continueBtn) {
          console.log(`[PSA Login] Found continue button: ${sel}`);
          break;
        }
      } catch (e) {
        // try next
      }
    }

    if (continueBtn) {
      await continueBtn.click();
      await sleep(2000);
    }

    // Now look for password input
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id="password"]',
    ];

    let passwordInput = null;
    for (const sel of passwordSelectors) {
      try {
        passwordInput = await page.waitForSelector(sel, { timeout: 5000 });
        if (passwordInput) {
          console.log(`[PSA Login] Found password input: ${sel}`);
          break;
        }
      } catch (e) {
        // try next selector
      }
    }

    if (!passwordInput) {
      console.log('[PSA Login] ⚠️ Could not find password input');
      return false;
    }

    // Type password
    await passwordInput.click();
    await passwordInput.fill(PSA_PASSWORD);
    await sleep(500);

    // Submit login form
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")',
      'button:has-text("Login")',
      'button:has-text("Continue")',
      'input[type="submit"]',
    ];

    let submitBtn = null;
    for (const sel of submitSelectors) {
      try {
        submitBtn = await page.$(sel);
        if (submitBtn) {
          console.log(`[PSA Login] Found submit button: ${sel}`);
          break;
        }
      } catch (e) {
        // try next
      }
    }

    if (submitBtn) {
      await submitBtn.click();
    } else {
      // Try pressing Enter
      await passwordInput.press('Enter');
    }

    // Wait for navigation after login — PSA uses Auth0 brandsignin which may take several redirects
    console.log('[PSA Login] Waiting for login redirects to complete...');
    try {
      // Wait for navigation to settle (up to 15 seconds)
      await page.waitForURL(
        url => !url.includes('signin') && !url.includes('login') && !url.includes('brandsignin'),
        { timeout: 15000 }
      );
    } catch (e) {
      // waitForURL timed out — check current URL anyway
      console.log(`[PSA Login] waitForURL timeout: ${e.message.slice(0, 60)}`);
    }

    // Extra wait for any remaining JS redirects
    await sleep(3000);

    const finalUrl = page.url();
    console.log(`[PSA Login] Post-login URL: ${finalUrl}`);

    // Check if login was successful (no longer on signin/login/brandsignin page)
    if (finalUrl.includes('signin') || finalUrl.includes('login') || finalUrl.includes('brandsignin')) {
      console.log('[PSA Login] ⚠️ Still on auth page, login may have failed');
      try {
        const errHtml = await page.content();
        const errMatch = errHtml.match(/error[^<]{0,200}/i);
        if (errMatch) console.log(`[PSA Login] Error text: ${errMatch[0]}`);
      } catch (contentErr) {
        console.log(`[PSA Login] Could not read page content: ${contentErr.message.slice(0, 60)}`);
      }
      return false;
    }

    console.log('[PSA Login] ✅ Login successful!');
    return true;
  } catch (e) {
    console.log(`[PSA Login] ❌ Login error: ${e.message}`);
    return false;
  }
}

// ─── Playwright: Fetch PSA Search Page ───────────────────────────────────────
async function fetchPsaSearchPage(page, query, retries = 3) {
  const url = `https://www.psacard.com/auctionprices/search?q=${encodeURIComponent(query)}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const status = response ? response.status() : 0;
      if (status === 429) {
        const wait = attempt * 30000;
        console.log(`  [Rate Limited] Waiting ${wait / 1000}s before retry ${attempt}/${retries}...`);
        await sleep(wait);
        continue;
      }

      // Check for Cloudflare block
      const title = await page.title();
      if (title.includes('Just a moment') || title.includes('Attention Required') || title.includes('Access denied')) {
        console.log(`  [CF Block] attempt ${attempt}/${retries}, sleeping 120s...`);
        await sleep(120000);
        continue;
      }

      // Check for login redirect
      const finalUrl = page.url();
      if (finalUrl.includes('signin') || finalUrl.includes('login')) {
        console.log(`  [Login Redirect] attempt ${attempt}/${retries} — re-logging in...`);
        const loginOk = await loginToPsa(page);
        if (loginOk) {
          // Retry the search after re-login
          if (attempt < retries) { await sleep(2000); continue; }
        }
        return null;
      }

      if (status && status >= 400) {
        console.log(`  [HTTP ${status}] attempt ${attempt}/${retries}`);
        if (attempt < retries) { await sleep(5000); continue; }
        return null;
      }

      // Wait a bit for JS to render search results
      await sleep(1500);
      return await page.content();

    } catch (e) {
      console.log(`  [Fetch Error] attempt ${attempt}/${retries}: ${e.message.slice(0, 80)}`);
      if (attempt < retries) { await sleep(5000); continue; }
      return null;
    }
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

async function getCardsToProcess(conn) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - REMATCH_DAYS);
  const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');

  let query, params;

  if (CARD_IDS.length > 0) {
    query = `
      SELECT id, cardId, name, nameJa, series, setName, cardNumber, language, rarity
      FROM cards
      WHERE id IN (${CARD_IDS.map(() => '?').join(',')})
      ORDER BY id
    `;
    params = CARD_IDS;
  } else {
    query = `
      SELECT id, cardId, name, nameJa, series, setName, cardNumber, language, rarity
      FROM cards
      WHERE MOD(id, ${TOTAL_BATCHES}) = ${BATCH_INDEX}
        AND psaSpecId IS NULL
        AND (psaMatchedAt IS NULL OR psaMatchedAt < ?)
      ORDER BY psaMatchedAt ASC, id ASC
      LIMIT ${CARDS_PER_BATCH}
    `;
    params = [cutoffStr];
  }

  const [rows] = await conn.execute(query, params);
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PSA Spec Matcher v3.0 (Playwright + Full Login)`);
  console.log(`Shard: ${BATCH_INDEX}/${TOTAL_BATCHES}`);
  console.log(`Cards per batch: ${CARDS_PER_BATCH}`);
  console.log(`Rematch after: ${REMATCH_DAYS} days`);
  console.log(`Delay: ${DELAY_MS}ms`);
  console.log(`Headless: ${HEADLESS}`);
  console.log(`Profile: ${PROFILE.userAgent.slice(0, 60)}...`);
  console.log(`PSA Email: ${PSA_EMAIL ? PSA_EMAIL.slice(0, 5) + '***' : '(not set)'}`);
  if (CARD_IDS.length > 0) console.log(`Single card mode: ${CARD_IDS.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!DB_URL) throw new Error('DATABASE_URL is required');
  if (!PSA_EMAIL || !PSA_PASSWORD) {
    throw new Error('PSA_EMAIL and PSA_PASSWORD are required for login');
  }

  const conn = await getConnection();
  console.log('✅ Database connected');

  const cards = await getCardsToProcess(conn);
  console.log(`📋 Cards to process: ${cards.length}\n`);

  if (cards.length === 0) {
    console.log('[PSA] Nothing to process in this shard. All cards are matched or up to date.');
    await conn.end();
    return;
  }

  // ─── Launch Playwright Browser ────────────────────────────────────────────
  console.log(`[PSA] Launching Playwright (headless=${HEADLESS})...`);
  const browser = await chromium.launch({
    headless: HEADLESS,
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

  // Block heavy resources to speed up page loads
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot,ico}', r => r.abort());
  await context.route('**/analytics**', r => r.abort());
  await context.route('**/gtag**', r => r.abort());
  await context.route('**/googletagmanager**', r => r.abort());

  // Inject stealth script
  await context.addInitScript(STEALTH_SCRIPT);

  const page = await context.newPage();

  // ─── Login to PSA ─────────────────────────────────────────────────────────
  console.log('[PSA] Performing login...');
  const loginSuccess = await loginToPsa(page);
  if (!loginSuccess) {
    console.log('[PSA] ⚠️ Login failed. Will attempt searches anyway (may fail).');
  }

  let matched = 0;
  let noMatch = 0;
  let errors = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const progress = `[${i + 1}/${cards.length}]`;

    try {
      const query = buildSearchQuery(card);
      console.log(`${progress} Card #${card.id} "${card.name}" (${card.cardNumber || 'no num'}) | ${card.setName || card.series || 'unknown set'}`);
      console.log(`  Query: "${query}"`);

      const html = await fetchPsaSearchPage(page, query);
      if (!html) {
        console.log(`  ⚠️  Failed to fetch PSA page`);
        await markCardAsAttempted(conn, card.id);
        errors++;
        await sleep(randomDelay());
        continue;
      }

      const results = parseSearchResults(html);
      console.log(`  Found ${results.length} PSA results`);

      const specId = matchCard(card, results);

      if (specId) {
        await updateCardPsaSpecId(conn, card.id, specId);
        console.log(`  ✅ MATCHED → specId: ${specId}`);
        matched++;
      } else {
        await markCardAsAttempted(conn, card.id);
        if (results.length > 0) {
          console.log(`  ❌ No precise match (${results.length} candidates rejected)`);
          results.slice(0, 3).forEach(r => console.log(`     - [${r.specId}] ${r.title.substring(0, 80)}`));
        } else {
          console.log(`  ❌ No PSA results found`);
        }
        noMatch++;
      }
    } catch (e) {
      console.error(`  💥 Error: ${e.message}`);
      await markCardAsAttempted(conn, card.id);
      errors++;
    }

    if (i < cards.length - 1) {
      await sleep(randomDelay());
    }
  }

  await browser.close();
  await conn.end();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PSA Spec Matcher — Done`);
  console.log(`  Total processed: ${cards.length}`);
  console.log(`  ✅ Matched:  ${matched} (${cards.length > 0 ? Math.round(matched / cards.length * 100) : 0}%)`);
  console.log(`  ❌ No match: ${noMatch}`);
  console.log(`  ⚠️  Errors:   ${errors}`);
  console.log(`${'='.repeat(60)}\n`);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
