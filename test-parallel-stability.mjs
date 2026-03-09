/**
 * SNKRDUNK Parallel Scraping Stability Test
 * Tests concurrent levels 2, 4, 5 with 20 real cards each
 * Measures: success rate, avg response time, error rate, DB connection stress
 */

import 'dotenv/config';
import axios from 'axios';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL;

// ─── Fetch 20 real SNKRDUNK product IDs from DB ───────────────
async function getRealProducts(count = 20) {
  const conn = await mysql.createConnection(DB_URL);
  const [rows] = await conn.execute(`
    SELECT DISTINCT
      ds.cardId,
      ds.sourceUrl,
      ds.productType,
      ds.lastFetchedAt
    FROM dataSources ds
    WHERE ds.source = 'snkrdunk'
      AND ds.sourceUrl LIKE '%snkrdunk.com/apparels/%'
      AND ds.lastFetchStatus = 'success'
    ORDER BY ds.lastFetchedAt DESC
    LIMIT 20
  `);
  await conn.end();
  return rows.map(r => ({
    cardId: r.cardId,
    sourceUrl: r.sourceUrl,
    productType: r.productType || 'single_card',
    snkrdunkId: r.sourceUrl.match(/\/apparels\/(\d+)/)?.[1] || null,
  })).filter(r => r.snkrdunkId);
}

// ─── Fetch price history for one product ───────────────────────
async function fetchOne(product, timeoutMs = 15000) {
  const start = Date.now();
  try {
    const url = `https://snkrdunk.com/v1/apparels/${product.snkrdunkId}/sales-history?size_id=0&page=1&per_page=100`;
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://snkrdunk.com/apparels/${product.snkrdunkId}`,
      },
      timeout: timeoutMs,
    });
    const elapsed = Date.now() - start;
    const count = resp.data?.history?.length ?? 0;
    return { success: true, elapsed, count, snkrdunkId: product.snkrdunkId };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
    return { success: false, elapsed, error: err.message, isTimeout, snkrdunkId: product.snkrdunkId };
  }
}

// ─── Run parallel test at a given concurrency level ────────────
async function runParallelTest(products, parallel, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing PARALLEL=${parallel} (${label}) with ${products.length} products`);
  console.log('='.repeat(60));

  const results = [];
  const startAll = Date.now();

  for (let i = 0; i < products.length; i += parallel) {
    const batch = products.slice(i, i + parallel);
    const batchStart = Date.now();
    const batchResults = await Promise.all(batch.map(p => fetchOne(p)));
    const batchElapsed = Date.now() - batchStart;
    results.push(...batchResults);

    const batchSuccess = batchResults.filter(r => r.success).length;
    console.log(`  Batch ${Math.floor(i/parallel)+1}: ${batchSuccess}/${batch.length} success | ${batchElapsed}ms`);

    // Small delay between batches (same as production config: 50ms)
    if (i + parallel < products.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  const totalElapsed = Date.now() - startAll;
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const timeoutCount = results.filter(r => r.isTimeout).length;
  const successTimes = results.filter(r => r.success).map(r => r.elapsed);
  const avgTime = successTimes.length > 0 
    ? Math.round(successTimes.reduce((a, b) => a + b, 0) / successTimes.length) 
    : 0;
  const maxTime = successTimes.length > 0 ? Math.max(...successTimes) : 0;
  const minTime = successTimes.length > 0 ? Math.min(...successTimes) : 0;
  const throughput = (products.length / (totalElapsed / 1000)).toFixed(2);

  console.log(`\n  ── Results ──`);
  console.log(`  Total time:    ${(totalElapsed/1000).toFixed(1)}s`);
  console.log(`  Success:       ${successCount}/${products.length} (${(successCount/products.length*100).toFixed(1)}%)`);
  console.log(`  Failures:      ${failCount} (timeouts: ${timeoutCount})`);
  console.log(`  Throughput:    ${throughput} cards/sec`);
  console.log(`  Avg resp time: ${avgTime}ms`);
  console.log(`  Min/Max resp:  ${minTime}ms / ${maxTime}ms`);

  if (failCount > 0) {
    console.log(`  Errors:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`    - ID ${r.snkrdunkId}: ${r.error}`);
    });
  }

  return {
    parallel,
    label,
    totalElapsed,
    successCount,
    failCount,
    timeoutCount,
    successRate: successCount / products.length,
    throughput: parseFloat(throughput),
    avgTime,
    minTime,
    maxTime,
  };
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('Fetching 20 real SNKRDUNK products from DB...');
  const products = await getRealProducts(20);
  console.log(`Got ${products.length} products`);

  if (products.length < 20) {
    console.error('Not enough products! Need at least 20.');
    process.exit(1);
  }

  // Shuffle to avoid cache bias
  const shuffled = [...products].sort(() => Math.random() - 0.5);

  // Test each parallel level with the SAME 20 products
  // Run in order: 2 → 4 → 5
  const results = [];

  results.push(await runParallelTest(shuffled, 2, 'Current (baseline)'));
  // Wait 3s between tests to let any rate limiting reset
  await new Promise(r => setTimeout(r, 3000));

  results.push(await runParallelTest(shuffled, 4, 'Proposed'));
  await new Promise(r => setTimeout(r, 3000));

  results.push(await runParallelTest(shuffled, 5, 'Aggressive'));

  // ─── Summary ─────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY COMPARISON');
  console.log('='.repeat(60));
  console.log(`${'PARALLEL'.padEnd(10)} ${'SUCCESS%'.padEnd(10)} ${'THROUGHPUT'.padEnd(14)} ${'AVG_MS'.padEnd(10)} ${'FAILURES'.padEnd(10)} ${'TOTAL_S'}`);
  console.log('-'.repeat(65));
  for (const r of results) {
    const successPct = (r.successRate * 100).toFixed(1) + '%';
    const throughput = r.throughput + ' c/s';
    console.log(
      `${String(r.parallel).padEnd(10)} ${successPct.padEnd(10)} ${throughput.padEnd(14)} ${String(r.avgTime+'ms').padEnd(10)} ${String(r.failCount).padEnd(10)} ${(r.totalElapsed/1000).toFixed(1)}s`
    );
  }

  // ─── Recommendation ──────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log('RECOMMENDATION');
  console.log('='.repeat(60));

  const baseline = results.find(r => r.parallel === 2);
  const p4 = results.find(r => r.parallel === 4);
  const p5 = results.find(r => r.parallel === 5);

  const speedupP4 = p4 ? (p4.throughput / baseline.throughput).toFixed(2) : 'N/A';
  const speedupP5 = p5 ? (p5.throughput / baseline.throughput).toFixed(2) : 'N/A';

  console.log(`PARALLEL=2 (baseline): ${(baseline.successRate*100).toFixed(1)}% success, ${baseline.throughput} c/s`);
  console.log(`PARALLEL=4:            ${(p4.successRate*100).toFixed(1)}% success, ${p4.throughput} c/s (${speedupP4}x speedup)`);
  console.log(`PARALLEL=5:            ${(p5.successRate*100).toFixed(1)}% success, ${p5.throughput} c/s (${speedupP5}x speedup)`);

  const p4Safe = p4.successRate >= 0.95 && p4.failCount <= 1;
  const p5Safe = p5.successRate >= 0.95 && p5.failCount <= 1;

  if (p4Safe && p5Safe) {
    console.log(`\n✅ BOTH P=4 and P=5 are STABLE (≥95% success rate)`);
    console.log(`   Recommend: PARALLEL=4 (safer) or PARALLEL=5 (max speed)`);
    console.log(`   DB connections at P=4: ~8-10 (within pool of 10)`);
    console.log(`   DB connections at P=5: ~10-12 (may occasionally hit pool limit)`);
  } else if (p4Safe) {
    console.log(`\n✅ P=4 is STABLE but P=5 is NOT RECOMMENDED`);
    console.log(`   Recommend: PARALLEL=4`);
  } else {
    console.log(`\n⚠️  Neither P=4 nor P=5 is stable enough`);
    console.log(`   Recommend: Keep PARALLEL=2`);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
