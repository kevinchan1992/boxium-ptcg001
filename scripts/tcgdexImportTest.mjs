/**
 * TCGdex Import - Quick test (first 5 sets only, no DB write)
 * Tests API connectivity and data mapping
 */

const TCGDEX_BASE = 'https://api.tcgdex.net/v2/en';
const TEST_SETS = 5;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BoxiumTCG-Importer/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.json();
}

function buildImageUrl(imageBase) {
  if (!imageBase) return null;
  return `${imageBase}/high.webp`;
}

function mapCard(card, setName, seriesName) {
  return {
    cardId: `tcgdex-${card.id}`,
    gameId: 1,
    name: card.name || '',
    series: seriesName || null,
    setName: setName || null,
    cardNumber: String(card.localId || ''),
    rarity: card.rarity || null,
    language: 'en',
    imageUrl: buildImageUrl(card.image),
  };
}

async function main() {
  console.log('=== TCGdex Import Test (first 5 sets, no DB write) ===\n');

  const sets = await fetchJson(`${TCGDEX_BASE}/sets`);
  console.log(`Total sets available: ${sets.length}\n`);

  let totalCards = 0;
  for (let i = 0; i < Math.min(TEST_SETS, sets.length); i++) {
    const setInfo = sets[i];
    await sleep(200);
    const setDetail = await fetchJson(`${TCGDEX_BASE}/sets/${setInfo.id}`);
    if (!setDetail?.cards) {
      console.log(`  [${i+1}] ${setInfo.name} (${setInfo.id}): NO CARDS`);
      continue;
    }
    const seriesName = setDetail.serie?.name || null;
    const mapped = setDetail.cards.map(c => mapCard(c, setInfo.name, seriesName));
    totalCards += mapped.length;

    // Show first card as sample
    const sample = mapped[0];
    console.log(`  [${i+1}] ${setInfo.name} (${setInfo.id}) — ${mapped.length} cards, series: ${seriesName}`);
    console.log(`       Sample: ${JSON.stringify(sample)}`);
  }

  console.log(`\n✅ Test complete. ${TEST_SETS} sets, ${totalCards} cards would be imported.`);
  console.log(`   Estimated total (214 sets): ~${Math.round(totalCards / TEST_SETS * 214).toLocaleString()} cards`);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
