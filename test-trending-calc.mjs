import { calculateAndCacheTrendingCards, getCachedTrendingCards } from './server/db.ts';

console.log('Starting manual trending cards calculation...');

try {
  await calculateAndCacheTrendingCards();
  console.log('\n✅ Calculation completed!');
  
  console.log('\nFetching cached results...');
  const results = await getCachedTrendingCards();
  
  console.log(`\n📊 Top ${results.length} Trending Cards:`);
  results.forEach((card, index) => {
    console.log(`\n${index + 1}. ${card.name}`);
    console.log(`   Old Price: HKD ${card.oldPrice}`);
    console.log(`   Current Price: HKD ${card.currentPrice}`);
    console.log(`   Change: ${card.priceChange.toFixed(2)}%`);
  });
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
