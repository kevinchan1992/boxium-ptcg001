/**
 * PSA Console Matcher v1.1
 * ─────────────────────────────────────────────────────────────────────────────
 * 在 Chrome 瀏覽器的 Console 中執行（已開啟 psacard.com 頁面）
 * 用 fetch() 直接抓 PSA 搜尋結果（同域名，無 CORS 問題）
 * 自動搜尋每張卡片的 PSA specId 並回報給後端 API
 *
 * 使用方式：
 * 1. 在 Chrome 開啟 https://www.psacard.com/auctionprices/search?q=Pikachu
 * 2. 按 F12 → Console
 * 3. 貼上此腳本並按 Enter
 */
(async function PSAConsoleMatcher() {

  // ─── 設定（請根據需要修改）────────────────────────────────────────────────
  const API_BASE = 'https://boxiumptcg-mua4eq38.manus.space/api/trpc';
  const SECRET = '8b18fbb278c6b6f8960a8e27dc88169724dd9f0b4f8a4d220eec3211f4dbc5a5';  // 會被自動替換
  const BATCH_SIZE = 20;
  const DELAY_MS = 2500;
  const TEST_MODE = true;   // 測試模式：只處理 5 張
  const MAX_CARDS = TEST_MODE ? 5 : 999999;

  // ─── PSA Set Keywords ────────────────────────────────────────────────────
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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function detectLanguage(card) {
    const lang = (card.language || '').toLowerCase();
    if (lang === 'ja' || lang === 'japanese' || lang === 'jp') return 'japanese';
    if (lang === 'en' || lang === 'english') return 'english';
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(card.name || '');
    return hasJapanese ? 'japanese' : 'english';
  }

  function extractPureNumber(cardNumber) {
    if (!cardNumber) return null;
    const m = String(cardNumber).match(/(\d+)/);
    return m ? m[1] : null;
  }

  function buildSearchQuery(card) {
    const lang = detectLanguage(card);
    const setName = card.setName || card.series || '';
    const name = card.name || '';
    const langStr = lang === 'japanese' ? 'japanese' : 'EN';
    const parts = [];
    if (name) parts.push(name);
    if (card.cardNumber) parts.push(`[${card.cardNumber}]`);
    if (setName) parts.push(`(${setName})`);
    parts.push(langStr);
    parts.push('pokemon');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function parseSearchResults(html) {
    const results = [];
    const seen = new Set();
    // Method 1: RSC payload (Next.js)
    const scriptRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
    let sm;
    while ((sm = scriptRegex.exec(html)) !== null) {
      let decoded;
      try { decoded = JSON.parse(`"${sm[1]}"`); }
      catch { decoded = sm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
      const specRegex = /"specId":(\d+),"categoryId":\d+,"setName":"([^"]*)","collectibleYear":"([^"]*)","collectibleSubject":"([^"]*)","variety":"([^"]*)","setNumber":"([^"]*)"/g;
      let m;
      while ((m = specRegex.exec(decoded)) !== null) {
        const [, specId, setName, year, subject, variety, setNumber] = m;
        if (seen.has(specId)) continue;
        seen.add(specId);
        results.push({ specId, title: `${subject} ${setName} ${setNumber} ${variety} ${year}`.trim(), setName, year, subject, variety, setNumber });
      }
    }
    // Method 2: href fallback
    if (results.length === 0) {
      const linkRegex = /href="([^"]*\/auctionprices\/[^"]*\/values\/[^"]*\/(\d+))"/gi;
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const specId = m[2];
        if (specId && !seen.has(specId)) {
          seen.add(specId);
          results.push({ specId, title: specId });
        }
      }
    }
    return results;
  }

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

      if (pureNum) {
        const numPattern = new RegExp(`#${pureNum}\\b|\\b${pureNum}\\b`);
        const numInTitle = numPattern.test(result.title);
        const numInSetNumber = resultSetNumber === pureNum.padStart(3, '0') ||
                               resultSetNumber === pureNum ||
                               resultSetNumber.startsWith(pureNum + '/');
        if (!numInTitle && !numInSetNumber) continue;
      }

      if (lang === 'japanese') {
        if (!title.includes('japanese') && !title.includes('japan') && !title.includes('jp ') &&
            !resultSetName.includes('japanese') && !resultSetName.includes('japan')) continue;
      } else {
        if (title.includes('japanese') || title.includes('japan') ||
            resultSetName.includes('japanese') || resultSetName.includes('japan')) continue;
      }

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

  // ─── API Calls ────────────────────────────────────────────────────────────
  async function getUnmatchedBatch(offset) {
    const input = { secret: SECRET, limit: BATCH_SIZE, offset };
    // tRPC v11 GET format: wrap input in {json: ...}
    const res = await fetch(`${API_BASE}/admin.psaGetUnmatchedBatch?input=${encodeURIComponent(JSON.stringify({json: input}))}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    // tRPC response format: {result:{data:{json:...}}}
    if (json.result?.data?.json) return json.result.data.json;
    if (json.result?.data) return json.result.data;
    throw new Error('Unexpected API response: ' + JSON.stringify(json).slice(0, 200));
  }

  async function submitResults(results) {
    const res = await fetch(`${API_BASE}/admin.psaBatchUpdateSpecIds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { secret: SECRET, results } }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Submit error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    if (json.result?.data?.json) return json.result.data.json;
    return json.result?.data ?? json;
  }

  // ─── Fetch PSA Search (same-origin fetch, no CORS) ────────────────────────
  async function searchPsa(query) {
    const url = `/auctionprices/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      credentials: 'include',  // include cookies
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error('CF_BLOCK');
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  PSA Console Matcher v1.1                        ║');
  console.log(`║  Mode: ${TEST_MODE ? '🧪 TEST (5 cards)' : '🚀 FULL RUN'}                          ║`);
  console.log('╚══════════════════════════════════════════════════╝');

  // Verify we're on psacard.com
  if (!window.location.hostname.includes('psacard.com')) {
    console.error('❌ Please run this script on psacard.com!');
    console.error('   Open: https://www.psacard.com/auctionprices/search?q=Pikachu');
    return;
  }

  // Get first batch
  let firstBatch;
  try {
    firstBatch = await getUnmatchedBatch(0);
    console.log(`✅ API connected. Total unmatched: ${firstBatch.total}`);
  } catch (e) {
    console.error('❌ Failed to connect to API:', e.message);
    console.error('Check that SECRET is correct');
    return;
  }

  const total = Math.min(firstBatch.total, MAX_CARDS);
  console.log(`🚀 Starting... Processing ${total} cards`);

  let cards = [...firstBatch.cards];
  let offset = BATCH_SIZE;
  let totalProcessed = 0;
  let totalMatched = 0;
  let totalNoMatch = 0;
  let cfBlocks = 0;

  while (totalProcessed < total) {
    // Refill cards if needed
    if (cards.length === 0) {
      try {
        const batch = await getUnmatchedBatch(offset);
        cards = [...batch.cards];
        offset += BATCH_SIZE;
        if (cards.length === 0) { console.log('No more cards'); break; }
      } catch (e) {
        console.error('Failed to get batch:', e.message);
        await sleep(5000);
        continue;
      }
    }

    const card = cards.shift();
    const query = buildSearchQuery(card);
    console.log(`[${totalProcessed + 1}/${total}] ${card.name} [${card.cardNumber}] — ${query}`);

    let specId = null;
    let error = null;

    try {
      const html = await searchPsa(query);
      // Check for CF challenge in fetched HTML
      if (html.includes('Just a moment') || html.includes('Verify you are human')) {
        cfBlocks++;
        console.warn(`  ⚠️ CF challenge in response (${cfBlocks}x). Waiting 30s...`);
        await sleep(30000);
        // Retry once
        try {
          const html2 = await searchPsa(query);
          const results2 = parseSearchResults(html2);
          specId = matchCard(card, results2);
        } catch (e2) {
          error = e2.message;
        }
      } else {
        const results = parseSearchResults(html);
        specId = matchCard(card, results);
        if (specId) {
          console.log(`  ✅ specId=${specId}`);
          totalMatched++;
        } else {
          console.log(`  ❌ No match (${results.length} results found)`);
          totalNoMatch++;
        }
      }
    } catch (e) {
      error = e.message;
      if (e.message === 'CF_BLOCK') {
        cfBlocks++;
        console.warn(`  🚫 CF Block (${cfBlocks}x). Waiting 60s...`);
        await sleep(60000);
      } else {
        console.error(`  ⚠️ Error: ${e.message}`);
      }
    }

    // Submit result (even if no match, to mark as attempted)
    try {
      await submitResults([{ cardId: card.id, specId: specId || null }]);
    } catch (e) {
      console.error(`  Submit failed: ${e.message}`);
    }

    totalProcessed++;

    // Progress every 10 cards
    if (totalProcessed % 10 === 0) {
      console.log(`📈 Progress: ${totalProcessed}/${total} | ✅ ${totalMatched} matched | ❌ ${totalNoMatch} no match | 🚫 ${cfBlocks} CF blocks`);
    }

    if (totalProcessed < total) {
      const delay = DELAY_MS + Math.floor(Math.random() * 1000);
      await sleep(delay);
    }
  }

  console.log('');
  console.log('🏁 PSA Console Matcher Done!');
  console.log(`  ✅ Matched:  ${totalMatched}`);
  console.log(`  ❌ No match: ${totalNoMatch}`);
  console.log(`  🚫 CF blocks: ${cfBlocks}`);
  console.log(`  Total:      ${totalProcessed}`);
})();
