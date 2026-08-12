import assert from 'node:assert/strict';
import { createEbayCircuitBreaker } from './ebayCircuitBreaker.mjs';

const breaker = createEbayCircuitBreaker(2);
assert.deepEqual(breaker.recordBlocked(), { blockedCount: 1, shouldStop: false });
assert.deepEqual(breaker.recordBlocked(), { blockedCount: 2, shouldStop: true });
assert.equal(breaker.blockedCount, 2);
assert.equal(breaker.maxBlocks, 2);

const minimumBreaker = createEbayCircuitBreaker(0);
assert.deepEqual(minimumBreaker.recordBlocked(), { blockedCount: 1, shouldStop: true });

console.log('eBay circuit breaker rules passed');
