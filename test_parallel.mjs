import axios from 'axios';

async function testParallel(count) {
  const baseIds = ['774193', '335535', '816214', '774212', '335536', '774194', '335537', '774195',
                   '774196', '335538', '816215', '774213', '335539', '774197', '335540', '774198'];
  const testIds = baseIds.slice(0, count);
  
  console.log(`Testing ${count} concurrent requests...`);
  const start = Date.now();
  
  const results = await Promise.allSettled(testIds.map(async (id) => {
    const reqStart = Date.now();
    try {
      const response = await axios.get(`https://snkrdunk.com/v1/apparels/${id}/sales-history?size_id=0&page=1&per_page=10`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': `https://snkrdunk.com/apparels/${id}`,
        },
        timeout: 15000,
      });
      const elapsed = Date.now() - reqStart;
      return { id, elapsed, status: response.status, ok: true };
    } catch (e) {
      const elapsed = Date.now() - reqStart;
      return { id, elapsed, error: e.message, ok: false };
    }
  }));
  
  const totalElapsed = Date.now() - start;
  const successes = results.filter(r => r.value && r.value.ok).length;
  const errors = results.filter(r => r.value && !r.value.ok).length;
  console.log(`Total time: ${totalElapsed}ms`);
  console.log(`Successes: ${successes} / Errors: ${errors}`);
  console.log(`Effective speed: ${(count / (totalElapsed / 1000)).toFixed(2)} items/sec`);
  
  results.forEach(r => {
    if (r.value && !r.value.ok) {
      console.log(`  Error for ${r.value.id}: ${r.value.elapsed}ms ${r.value.error}`);
    }
  });
  
  return { totalElapsed, successes, errors };
}

// Test with different parallelism levels
console.log('=== SNKRDUNK API Parallelism Test ===\n');

const r1 = await testParallel(1);
console.log('');
const r4 = await testParallel(4);
console.log('');
const r8 = await testParallel(8);
console.log('');

console.log('\n=== Summary ===');
console.log(`P=1: ${(1000/r1.totalElapsed).toFixed(2)}/s`);
console.log(`P=4: ${(4000/r4.totalElapsed).toFixed(2)}/s`);
console.log(`P=8: ${(8000/r8.totalElapsed).toFixed(2)}/s`);
