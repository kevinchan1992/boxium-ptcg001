import test from 'node:test';
import assert from 'node:assert/strict';
import { createHighWaterRange, hasRequiredCardMetadata, isTargetTradingCard, readPositiveInt } from './snkrdunkHighWaterCore.mjs';

test('high-water range overlaps backwards and scans forward in newest-first order', () => {
  const { start, end, ids } = createHighWaterRange(896992, 10_000, 2_000);
  assert.equal(start, 886992);
  assert.equal(end, 898992);
  assert.equal(ids[0], 898992);
  assert.equal(ids.at(-1), 886992);
  assert.ok(ids.includes(892615));
});

test('target classifier only accepts configured TCG single cards', () => {
  assert.deepEqual(
    isTargetTradingCard({
      name: 'Pikachu [M6a 025/103]',
      primaryMedia: { imageUrl: 'https://cdn.snkrdunk.com/pikachu.webp' },
      brands: [{ id: 'pokemon' }],
      categories: [{ id: 25, name: 'trading-card-single' }],
    }),
    { gameId: 1, name: 'Pokemon Card Game' },
  );
  assert.equal(isTargetTradingCard({ name: 'Pikachu [M6a 025/103]', primaryMedia: { imageUrl: 'https://cdn.snkrdunk.com/pikachu.webp' }, brands: [{ id: 'pokemon' }], categories: [{ id: 26, name: 'trading-card-box' }] }), null);
  assert.equal(isTargetTradingCard({ name: 'Pikachu [M6a 025/103]', primaryMedia: { imageUrl: 'https://cdn.snkrdunk.com/pikachu.webp' }, brands: [{ id: 'nike' }], categories: [{ id: 25, name: 'trading-card-single' }] }), null);
  assert.equal(hasRequiredCardMetadata({ brands: [{ id: 'pokemon' }], categories: [{ id: 25, name: 'trading-card-single' }] }), false);
});

test('invalid numeric workflow inputs use the safe configured fallback', () => {
  assert.equal(readPositiveInt('0', 10000), 10000);
  assert.equal(readPositiveInt('-4', 10000), 10000);
  assert.equal(readPositiveInt('not-a-number', 10000), 10000);
  assert.equal(readPositiveInt('2000', 10000), 2000);
});
