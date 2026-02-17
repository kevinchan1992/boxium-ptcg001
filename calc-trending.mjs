import { calculateAndCacheTrendingCards } from './server/db.js';
console.log('[Calc] Starting...');
try {
  await calculateAndCacheTrendingCards();
  console.log('[Calc] Success!');
} catch (e) {
  console.error('[Calc] Error:', e.message);
}
