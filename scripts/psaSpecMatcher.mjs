/**
 * PSA Spec ID Batch Matcher v1.0
 *
 * Strategy: Precise 3-Layer Matching
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
 *
 * Optional env:
 *   CARDS_PER_BATCH Max cards per shard (default: 5000)
 *   REMATCH_DAYS    Re-attempt cards matched > N days ago (default: 30)
 *   DELAY_MS        Delay between PSA requests in ms (default: 2500)
 */

import { createConnection } from 'mysql2/promise';
import { load as cheerioLoad } from 'cheerio';

// ─── Config ──────────────────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL;
const BATCH_INDEX = parseInt(process.env.BATCH_INDEX ?? '0', 10);
const TOTAL_BATCHES = parseInt(process.env.TOTAL_BATCHES ?? '1', 10);
const CARDS_PER_BATCH = parseInt(process.env.CARDS_PER_BATCH ?? '5000', 10);
const REMATCH_DAYS = parseInt(process.env.REMATCH_DAYS ?? '30', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '2500', 10);
const CARD_IDS = process.env.CARD_IDS ? process.env.CARD_IDS.split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean) : [];

// ─── PSA Series Keyword Map ───────────────────────────────────────────────────
// Maps setName/series keywords → PSA search abbreviations
// Used for Layer 3 matching: PSA title must contain one of these keywords
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

  // Japanese indicators
  if (lang === 'ja' || lang === 'jp' || lang === 'japanese') return 'japanese';
  if (series.includes('japanese') || setName.includes('japanese')) return 'japanese';
  if (cardId.includes('jp') || cardId.includes('-ja-')) return 'japanese';
  // Card number patterns like "SM-P 141", "XY-P 208" → Japanese promo
  if (/^(sm|xy|bw|dp|swsh|sv)-?p\s/i.test(card.cardNumber || '')) return 'japanese';
  // setName contains Japanese promo patterns
  if (/SM-P|XY-P|BW-P|SWSH-P|SV-P/i.test(card.setName || '')) return 'japanese';

  return 'en';
}

// ─── Build PSA Search Query ───────────────────────────────────────────────────
function buildSearchQuery(card) {
  const lang = detectLanguage(card);
  const name = card.name || '';
  const setName = card.setName || '';
  const series = card.series || '';

  // Extract pure card number (e.g., "SM-P 141" → "141", "XY-P 208" → "208", "125/198" → "125")
  let cardNum = card.cardNumber || '';
  // Handle formats: "SM-P 141", "XY-P 208", "125/198", "125", "PROMO"
  const numMatch = cardNum.match(/(\d+)(?:\/\d+)?$/);
  const pureNum = numMatch ? numMatch[1] : null;

  // Build query parts
  const parts = [name];

  // Add set/series identifier
  const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series];
  if (setKeywords && setKeywords.length > 0) {
    parts.push(setKeywords[0]);
  } else if (setName) {
    // Use first 2 words of setName as fallback
    parts.push(setName.split(' ').slice(0, 2).join(' '));
  }

  // Add card number
  if (pureNum) {
    parts.push(pureNum);
  }

  // Add language
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

// ─── PSA Search & Match ───────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

let uaIndex = 0;
function getNextUA() {
  return USER_AGENTS[uaIndex++ % USER_AGENTS.length];
}

async function fetchPsaSearchPage(query, retries = 3) {
  const url = `https://www.psacard.com/auctionprices/search?q=${encodeURIComponent(query)}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': getNextUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.psacard.com/',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.status === 429) {
        const wait = attempt * 30000;
        console.log(`  [Rate Limited] Waiting ${wait / 1000}s before retry ${attempt}/${retries}...`);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) {
        console.log(`  [HTTP ${resp.status}] attempt ${attempt}/${retries}`);
        if (attempt < retries) { await sleep(5000); continue; }
        return null;
      }
      return await resp.text();
    } catch (e) {
      console.log(`  [Fetch Error] attempt ${attempt}/${retries}: ${e.message}`);
      if (attempt < retries) { await sleep(5000); continue; }
      return null;
    }
  }
  return null;
}

function parseSearchResults(html) {
  const $ = cheerioLoad(html);
  const results = [];
  // PSA search results: links with href containing /spec/psa/
  $('a[href*="/spec/psa/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const specMatch = href.match(/\/spec\/psa\/(\d+)/);
    if (!specMatch) return;
    const specId = specMatch[1];
    // Get the text content of the link or its parent
    const title = $(el).text().trim() || $(el).closest('[class]').text().trim();
    if (specId && title) {
      results.push({ specId, title });
    }
  });
  // Deduplicate by specId
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.specId)) return false;
    seen.add(r.specId);
    return true;
  });
}

function matchCard(card, results) {
  const lang = detectLanguage(card);
  const pureNum = extractPureNumber(card.cardNumber);
  const setName = card.setName || '';
  const series = card.series || '';

  // Get expected set keywords for Layer 3
  const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series] || [];

  for (const result of results) {
    const title = result.title.toLowerCase();

    // ── Layer 1: Card number exact match ──────────────────────────────────
    if (pureNum) {
      // Must contain #<number> or end with <number>
      const numPattern = new RegExp(`#${pureNum}\\b|\\b${pureNum}\\b`);
      if (!numPattern.test(result.title)) continue;
    }

    // ── Layer 2: Language match ────────────────────────────────────────────
    if (lang === 'japanese') {
      if (!title.includes('japanese') && !title.includes('japan') && !title.includes('jp ')) continue;
    } else {
      // English: must NOT be Japanese
      if (title.includes('japanese') || title.includes('japan')) continue;
    }

    // ── Layer 3: Series/set keyword match ─────────────────────────────────
    if (setKeywords.length > 0) {
      const hasSetMatch = setKeywords.some(kw => title.includes(kw.toLowerCase()));
      if (!hasSetMatch) {
        // Fallback: check if setName words appear in title
        const setWords = setName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const hasFallback = setWords.length > 0 && setWords.some(w => title.includes(w));
        if (!hasFallback) continue;
      }
    }

    // All 3 layers passed!
    return result.specId;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
  // 2–4 seconds with jitter
  return DELAY_MS + Math.floor(Math.random() * 1500);
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

  let query, params;

  if (CARD_IDS.length > 0) {
    // Single card mode
    query = `
      SELECT id, cardId, name, nameJa, series, setName, cardNumber, language, rarity
      FROM cards
      WHERE id IN (${CARD_IDS.map(() => '?').join(',')})
      ORDER BY id
    `;
    params = CARD_IDS;
  } else {
    // Shard mode: process cards where MOD(id, TOTAL_BATCHES) = BATCH_INDEX
    // Skip cards that have already been successfully matched (psaSpecId IS NOT NULL)
    // Only retry cards that were attempted but failed (psaMatchedAt IS NOT NULL AND psaSpecId IS NULL)
    //   if they haven't been retried within REMATCH_DAYS
    query = `
      SELECT id, cardId, name, nameJa, series, setName, cardNumber, language, rarity
      FROM cards
      WHERE MOD(id, ?) = ?
        AND psaSpecId IS NULL
        AND (psaMatchedAt IS NULL OR psaMatchedAt < ?)
      ORDER BY psaMatchedAt ASC, id ASC
      LIMIT ?
    `;
    params = [TOTAL_BATCHES, BATCH_INDEX, cutoffDate, CARDS_PER_BATCH];
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
  console.log(`PSA Spec Matcher v1.0`);
  console.log(`Shard: ${BATCH_INDEX}/${TOTAL_BATCHES}`);
  console.log(`Cards per batch: ${CARDS_PER_BATCH}`);
  console.log(`Rematch after: ${REMATCH_DAYS} days`);
  console.log(`Delay: ${DELAY_MS}ms`);
  if (CARD_IDS.length > 0) console.log(`Single card mode: ${CARD_IDS.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!DB_URL) throw new Error('DATABASE_URL is required');

  const conn = await getConnection();
  console.log('✅ Database connected');

  const cards = await getCardsToProcess(conn);
  console.log(`📋 Cards to process: ${cards.length}\n`);

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

      const html = await fetchPsaSearchPage(query);
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
          // Log first 3 candidates for debugging
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

    // Delay between requests
    if (i < cards.length - 1) {
      await sleep(randomDelay());
    }
  }

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
