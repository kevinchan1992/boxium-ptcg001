export function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TARGET_BRANDS = new Map([
  ['pokemon', { gameId: 1, name: 'Pokemon Card Game' }],
  ['onepiece', { gameId: 2, name: 'ONE PIECE' }],
  ['yu-gi-oh', { gameId: 3, name: 'YU-GI-OH' }],
  ['dragon-ball-super-card-game', { gameId: 60001, name: 'Dragon Ball Super Card Game' }],
  ['union-arena', { gameId: 60002, name: 'UNION ARENA' }],
  ['weis-schwarz', { gameId: 60003, name: 'Weiß Schwarz' }],
  ['gundam-card-game', { gameId: 60004, name: 'Gundam Card Game' }],
]);

export function isTargetTradingCard(product) {
  const brand = product?.brands?.map(({ id }) => TARGET_BRANDS.get(id)).find(Boolean);
  const isSingleCard = product?.categories?.some(
    ({ id, name }) => Number(id) === 25 || name === 'trading-card-single',
  );

  return brand && isSingleCard ? brand : null;
}

export function createHighWaterRange(highWater, lookback, forward) {
  const start = Math.max(1, highWater - lookback);
  const end = highWater + forward;
  const ids = [];
  for (let id = end; id >= start; id -= 1) ids.push(id);
  return { start, end, ids };
}
