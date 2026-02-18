import { getTrendingByPriceIncrease } from './server/db.ts';

const results = await getTrendingByPriceIncrease({ limit: 10 });
console.log('=== Price Increase Ranking ===');
results.forEach((card, index) => {
  console.log(`${index + 1}. ${card.name} - ${card.priceChangePercent.toFixed(2)}% (${card.oldPrice} → ${card.currentPrice})`);
});
