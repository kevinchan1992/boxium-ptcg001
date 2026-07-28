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
  // PSA setName keywords for matching — key = DB setName or series, value = PSA setName substrings
  const PSA_SET_KEYWORDS = {
    // ── Scarlet & Violet era (SV) ──────────────────────────────────────────
    'Obsidian Flames': ['Obsidian Flames'],
    'Paldea Evolved': ['Paldea Evolved'],
    'Scarlet & Violet': ['Scarlet & Violet Base'],
    'Paradox Rift': ['Paradox Rift'],
    'Paldean Fates': ['Paldean Fates'],
    'Temporal Forces': ['Temporal Forces'],
    'Twilight Masquerade': ['Twilight Masquerade'],
    'Shrouded Fable': ['Shrouded Fable'],
    'Stellar Crown': ['Stellar Crown'],
    'Surging Sparks': ['Surging Sparks'],
    'Prismatic Evolutions': ['Prismatic Evolutions'],
    'Journey Together': ['Journey Together'],
    'Destined Rivals': ['Destined Rivals'],
    'SV-P Promotional cards': ['SV Promo', 'Scarlet & Violet Promo'],
    'Scarlet & Violet Promos': ['SV Promo', 'Scarlet & Violet Promo'],
    'Pokémon GO': ['Pokemon GO'],
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
    'Pokemon Card 151': ['Pokemon Card 151', '151'],
    'Clay Burst': ['Clay Burst'],
    'Snow Hazard': ['Snow Hazard'],
    'Triplet Beat': ['Triplet Beat'],
    'Violet ex': ['Violet ex'],
    'Scarlet ex': ['Scarlet ex'],
    'Ruler of the Black Flame': ['Ruler of the Black Flame'],
    'Raging Surf': ['Raging Surf'],
    'Paradise Dragona': ['Paradise Dragona'],
    // ── Sword & Shield era (SWSH / S series) ──────────────────────────────
    'Chilling Reign': ['Chilling Reign'],
    'Evolving Skies': ['Evolving Skies'],
    'Fusion Strike': ['Fusion Strike'],
    'Brilliant Stars': ['Brilliant Stars'],
    'Astral Radiance': ['Astral Radiance'],
    'Lost Origin': ['Lost Origin'],
    'Silver Tempest': ['Silver Tempest'],
    'Crown Zenith': ['Crown Zenith'],
    'Sword & Shield Promos': ['SWSH Promo', 'Sword & Shield Promo'],
    'SWSH-P': ['SWSH Promo', 'Sword & Shield Promo'],
    // S-series Japanese sets
    's12': ['Paradigm Trigger'],
    's11': ['Lost Abyss'],
    's11a': ['Incandescent Arcana'],
    's10': ['Time Gazer', 'Space Juggler', 'Astral Radiance'],
    's10b': ['Pokemon GO'],
    's10a': ['Dark Phantasma'],
    's9': ['Star Birth', 'Brilliant Stars'],
    's9a': ['Battle Region'],
    's8': ['Fusion Arts', 'Fusion Strike'],
    's8a': ['25th Anniversary Collection'],
    's8b': ['VMAX Climax'],
    's7': ['Evolving Skies', 'Blue Sky Stream', 'Silver Lance'],
    's7D': ['Blue Sky Stream'],
    's7R': ['Silver Lance'],
    's6': ['Chilling Reign', 'Jet-Black Spirit', 'Silver Lance'],
    's6a': ['Eevee Heroes'],
    's6H': ['Silver Lance'],
    's5': ['Battle Styles', 'Single Strike Master', 'Rapid Strike Master'],
    's5I': ['Single Strike Master'],
    's5R': ['Rapid Strike Master'],
    's4': ['Vivid Voltage', 'Amazing Volt Tackle'],
    's4a': ['Shiny Star V'],
    's3': ['Darkness Ablaze', 'Infinity Zone'],
    's3a': ['Legendary Heartbeat'],
    's2': ['Rebel Clash', 'Explosive Walker'],
    's2a': ['Explosive Walker'],
    's1': ['Sword & Shield Base', 'VMAX Rising'],
    's1a': ['VMAX Rising'],
    's1H': ['Sword & Shield'],
    's1W': ['Sword & Shield'],
    'SC': ['Starter Set VMAX'],
    'SC-C': ['Starter Set VMAX'],
    // ── Sun & Moon era (SM series) ─────────────────────────────────────────
    'SM-P Promotional cards': ['SM Promo', 'Sun & Moon Promo'],
    'SM1': ['Collection Sun', 'Collection Moon'],
    'SM1M': ['Collection Moon'],
    'SM1S': ['Collection Sun'],
    'SM2': ['Alolan Moonlight', 'Islands Await You'],
    'SM2K': ['Islands Await You'],
    'SM2L': ['Alolan Moonlight'],
    'SM3': ['Shining Legends', 'Burning Shadows', 'Facing a New Trial'],
    'SM3H': ['Facing a New Trial'],
    'SM3N': ['Darkness that Consumes Light'],
    'SM4': ['Crimson Invasion', 'The Best of XY'],
    'SM4A': ['Ultradimensional Beasts'],
    'SM4S': ['Ultra Sun'],
    'SM4+': ['Ultra Moon'],
    'SM5': ['Ultra Prism', 'Ultra Force'],
    'SM5M': ['Ultra Moon'],
    'SM5S': ['Ultra Sun'],
    'SM6': ['Forbidden Light'],
    'SM6a': ['Dragon Storm'],
    'SM6b': ['Champion Road'],
    'SM7': ['Celestial Storm', 'Sky-Splitting Charisma'],
    'SM7A': ['Fairy Rise'],
    'SM7B': ['Dragon Majesty'],
    'SM8': ['Lost Thunder', 'Super-Burst Impact'],
    'SM8a': ['Dark Order'],
    'SM9': ['Team Up', 'Night Unison'],
    'SM9a': ['GG End'],
    'SM9b': ['Full Metal Wall'],
    'SM10': ['Unbroken Bonds', 'Double Blaze'],
    'SM10a': ['GG End'],
    'SM10b': ['Sky Legend'],
    'SM11': ['Unified Minds', 'Miracle Twin'],
    'SM11a': ['Remix Bout'],
    'SM11b': ['Dream League'],
    'SM12': ['Cosmic Eclipse', 'Alter Genesis'],
    'SM12a': ['Tag All Stars'],
    // ── XY era ────────────────────────────────────────────────────────────
    'XY-P Promotional cards': ['XY Promo', 'XY & Z Promo'],
    'XY1': ['XY Base', 'Collection X', 'Collection Y'],
    'XY2': ['Flashfire', 'Wild Blaze'],
    'XY3': ['Furious Fists', 'Rising Fist'],
    'XY4': ['Phantom Forces', 'Phantom Gate'],
    'XY5': ['Primal Clash', 'Gaia Volcano', 'Tidal Storm'],
    'XY6': ['Roaring Skies', 'Emerald Break'],
    'XY7': ['Ancient Origins', 'Blue Impact', 'Red Flash'],
    'XY8': ['BREAKthrough', 'Blue Shock', 'Red Excitement'],
    'XY9': ['BREAKpoint', 'Rage of the Broken Heavens'],
    'XY10': ['Fates Collide', 'Awakening Psychic King'],
    'XY11': ['Steam Siege', 'Fever-Burst Fighter', 'Cruel Traitor'],
    'XY12': ['Evolutions', 'Expansion Pack 20th Anniversary'],
    'XYBH': ['Generations', 'Radiant Collection'],
    // ── Black & White era (BW series) ─────────────────────────────────────
    'BW-P Promotional cards': ['BW Promo', 'Black & White Promo'],
    'BW1': ['Black & White Base', 'Black Collection', 'White Collection'],
    'BW2': ['Emerging Powers', 'Red Collection'],
    'BW3': ['Noble Victories', 'Dark Rush'],
    'BW4': ['Next Destinies', 'Freeze Bolt', 'Cold Flare'],
    'BW5': ['Dark Explorers', 'Dragon Blade', 'Dragon Blast'],
    'BW6': ['Dragons Exalted', 'Dragon Blade'],
    'BW7': ['Boundaries Crossed', 'Freeze Bolt'],
    'BW8': ['Plasma Storm', 'Cold Flare'],
    'BW9': ['Plasma Freeze', 'Spiral Force', 'Thunder Knuckle'],
    'BW10': ['Plasma Blast', 'Megalo Cannon'],
    'BW11': ['Legendary Treasures', 'Radiant Collection'],
    'BWP': ['BW Promo'],
    // ── HeartGold & SoulSilver era (HGSS) ────────────────────────────────
    'HGSS': ['HeartGold SoulSilver', 'Heart Gold Collection', 'Soul Silver Collection'],
    'HS': ['HeartGold SoulSilver'],
    'UL': ['Unleashed', 'Reviving Legends'],
    'UD': ['Undaunted', 'Clash at the Summit'],
    'TM': ['Triumphant', 'Legend'],
    'CL': ['Call of Legends'],
    // ── Platinum era ──────────────────────────────────────────────────────
    'PL': ['Platinum Base'],
    'RR': ['Rising Rivals', 'Bonds to the End of Time'],
    'SV': ['Supreme Victors', 'Beat of the Frontier'],
    'AR': ['Arceus'],
    // ── Diamond & Pearl era (DP) ──────────────────────────────────────────
    'DP1': ['Diamond & Pearl Base', 'Space-Time Creation'],
    'DP2': ['Mysterious Treasures', 'Secret of the Lakes'],
    'DP3': ['Secret Wonders', 'Shining Darkness'],
    'DP4': ['Great Encounters', 'Moonlit Pursuit', 'Dawn Dash'],
    'DP5': ['Majestic Dawn', 'Temple of Anger', 'Cry from the Mysterious'],
    'DP6': ['Legends Awakened', 'Intense Fight in the Destroyed Sky'],
    'DP7': ['Stormfront', 'Shaymin LV.X Collection Pack'],
    'DPt': ['Platinum', 'Galactic Conquest'],
    // ── EX era (PCG / ADV / e series) ────────────────────────────────────
    'PCG1': ['FireRed LeafGreen', 'Flight of Legends'],
    'PCG2': ['Team Rocket Returns', 'Rocket Gang Strikes Back'],
    'PCG3': ['Deoxys', 'Clash of the Blue Sky'],
    'PCG4': ['Emerald', 'Golden Sky Silvery Ocean'],
    'PCG5': ['Unseen Forces', 'Mirage Forest'],
    'PCG6': ['Delta Species', 'Holon Research Tower'],
    'PCG7': ['Legend Maker', 'Miracle Crystal'],
    'PCG8': ['Holon Phantoms', 'Holon Phantom'],
    'PCG9': ['Crystal Guardians', 'Offense and Defense of the Furthest Ends'],
    'PCG10': ['Dragon Frontiers', 'Earth Shaking Thunder'],
    'PCG11': ['Power Keepers', 'World Champions Pack'],
    'ADV1': ['EX Ruby Sapphire', 'ADV Expansion Pack'],
    'ADV2': ['EX Sandstorm', 'Miracle of the Desert'],
    'ADV3': ['EX Dragon', 'Rulers of the Heavens'],
    'ADV4': ['EX Team Magma vs Team Aqua', 'Magma vs Aqua'],
    'ADV5': ['EX Hidden Legends', 'Undone Seal'],
    'e1': ['Expedition Base', 'Base Expansion Pack'],
    'e2': ['Aquapolis', 'The Town on No Map'],
    'e3': ['Skyridge', 'Wind from the Sea'],
    'e4': ['EX Ruby Sapphire'],
    'e5': ['Mysterious Mountains'],
    'e6': ['Wind from the Sea'],
    // ── Neo era ────────────────────────────────────────────────────────────
    'N1': ['Neo Genesis', 'Gold Silver'],
    'N2': ['Neo Discovery', 'Crossing the Ruins'],
    'N3': ['Neo Revelation', 'Awakening Legends'],
    'N4': ['Neo Destiny', 'Darkness & to Light'],
    // ── Gym / Base era ─────────────────────────────────────────────────────
    'G1': ['Gym Heroes', 'Leaders Stadium'],
    'G2': ['Gym Challenge', 'Challenge from the Darkness'],
    'B2': ['Jungle'],
    'B3': ['Fossil'],
    'B4': ['Base Set 2'],
    'B5': ['Team Rocket'],
    // ── Misc ───────────────────────────────────────────────────────────────
    'Expansion Pack "Lost Abyss"': ['Lost Abyss'],
    'Expansion Pack "Incandescent Arcana"': ['Incandescent Arcana'],
    'Expansion Pack "Paradigm Trigger"': ['Paradigm Trigger'],
    'Expansion Pack "Clash at the Summit"': ['Clash at the Summit'],
    'Expansion Pack "Ruler of the Black Flame"': ['Ruler of the Black Flame'],
    'Expansion Pack "Pokemon GO"': ['Pokemon GO'],
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Japanese set code prefixes used in DB setName field
  const JP_SET_PREFIXES = /^(s\d|s1[0-9]|SM\d|SM1[0-9]|XY\d|BW\d|DP\d|DPt|PCG\d|ADV\d|HGSS|HS|UL|UD|TM|CL|PL|RR|AR|e\d|N\d|G\d|B\d|SC|SWSH)/i;

  function detectLanguage(card) {
    const lang = (card.language || '').toLowerCase();
    if (lang === 'ja' || lang === 'japanese' || lang === 'jp') return 'japanese';
    // Check if setName is a Japanese set code (e.g. DP3, ADV1, e5, s12, SM1M)
    const setName = card.setName || '';
    if (JP_SET_PREFIXES.test(setName)) return 'japanese';
    // Check for Japanese characters in name
    const hasJapanese = /[\u3040-\u30ff\u4e00-\u9fff]/.test(card.name || '');
    if (hasJapanese) return 'japanese';
    if (lang === 'en' || lang === 'english') return 'english';
    return 'english';
  }

  function extractPureNumber(cardNumber) {
    if (!cardNumber) return null;
    const m = String(cardNumber).match(/(\d+)/);
    return m ? m[1] : null;
  }

  function buildSearchQuery(card) {
    const lang = detectLanguage(card);
    const name = card.name || '';
    const cardNumber = card.cardNumber || '';

    // Step 1: Extract clean name — only first 2-3 meaningful words, strip special chars
    // Remove everything after ':', '[', '(', or Japanese brackets
    const cleanName = name
      .replace(/[:\[\(（【「『〔\{].*/g, '')  // strip from special chars onward
      .replace(/[^a-zA-Z0-9\s\-'éèêëàâùûüôîïœæç]/g, ' ')  // keep latin chars
      .replace(/\s+/g, ' ')
      .trim();
    // Take only first 3 words max
    const nameWords = cleanName.split(/\s+/).filter(w => w.length > 0).slice(0, 3).join(' ');

    // Step 2: Extract set abbreviation from card number (e.g. "EBB" from "EBB 093/093")
    // Card numbers can be: "EBB 093/093", "093/093", "SV-P 123", "SWSH123", "BW-P 001"
    const setAbbr = cardNumber.match(/^([A-Z][A-Z0-9\-]{1,5})\s/)?.[1] || '';
    // Extract the numeric part
    const numPart = cardNumber.match(/(\d{1,4})/)?.[1] || '';

    const parts = [];
    if (nameWords) parts.push(nameWords);
    if (setAbbr) parts.push(setAbbr);
    if (numPart) parts.push(numPart);
    if (lang === 'japanese') parts.push('japanese');
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
    // ─── 三重驗證：全部通過才儲存 specId，不猜測，不 fallback ─────────────
    const lang = detectLanguage(card);
    const pureNum = extractPureNumber(card.cardNumber);
    const cardNumber = card.cardNumber || '';
    const setName = card.setName || '';
    const series = card.series || '';
    const setKeywords = PSA_SET_KEYWORDS[setName] || PSA_SET_KEYWORDS[series] || [];

    // 從卡號提取 set abbreviation（例如 "EBB" from "EBB 093/093"）
    const setAbbr = cardNumber.match(/^([A-Z][A-Z0-9\-]{1,5})\s/)?.[1]?.toLowerCase() || '';

    for (const result of results) {
      const title = result.title.toLowerCase();
      const resultSetName = (result.setName || '').toLowerCase();
      const resultSetNumber = (result.setNumber || '').toLowerCase();

      // ── 第一層：卡號精確匹配（必須通過）──────────────────────────────────
      // pureNum 必須精確出現在 setNumber 或 title 中
      if (!pureNum) continue;  // 沒有卡號的卡片跳過（無法驗證）

      const paddedNum = pureNum.padStart(3, '0');
      const numInSetNumber =
        resultSetNumber === paddedNum ||
        resultSetNumber === pureNum ||
        resultSetNumber.startsWith(paddedNum + '/') ||
        resultSetNumber.startsWith(pureNum + '/');

      if (!numInSetNumber) continue;  // setNumber 不符合，直接跳過

      // ── 第二層：語言匹配（必須通過）──────────────────────────────────────
      if (lang === 'japanese') {
        // 日文卡必須在 title 或 setName 中有 japanese/japan 字樣
        const isJapanese =
          title.includes('japanese') || title.includes('japan') ||
          resultSetName.includes('japanese') || resultSetName.includes('japan');
        if (!isJapanese) continue;
      } else {
        // 英文卡不能有 japanese/japan 字樣
        const isJapanese =
          title.includes('japanese') || title.includes('japan') ||
          resultSetName.includes('japanese') || resultSetName.includes('japan');
        if (isJapanese) continue;
      }

      // ── 第三層：系列匹配（有 keywords 時必須通過）────────────────────────
      if (setKeywords.length > 0) {
        const hasSetMatch = setKeywords.some(kw =>
          title.includes(kw.toLowerCase()) || resultSetName.includes(kw.toLowerCase())
        );
        if (!hasSetMatch) continue;  // 系列不符合，直接跳過（不 fallback）
      } else if (setAbbr) {
        // 沒有 PSA_SET_KEYWORDS 但有 setAbbr，嘗試用 setAbbr 匹配 setName
        const abbrInSet = resultSetName.includes(setAbbr) || title.includes(setAbbr);
        if (!abbrInSet) continue;
      }

      // 三層全部通過
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
