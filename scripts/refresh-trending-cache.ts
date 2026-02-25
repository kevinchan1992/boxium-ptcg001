import { manualRefreshTrendingCache } from '../server/trendingCacheManager';

console.log('開始刷新 trending cache...');
const startTime = Date.now();

manualRefreshTrendingCache()
  .then(() => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Trending cache 刷新成功！耗時：${duration} 秒`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Trending cache 刷新失敗：', error);
    process.exit(1);
  });
