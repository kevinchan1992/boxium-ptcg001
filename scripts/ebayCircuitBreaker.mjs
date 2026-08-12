/**
 * Pure run-level circuit breaker for eBay sold-listing collection.
 * A blocked/security-gated response is not a "zero sales" result. Two such
 * responses stop the current GitHub runner and leave remaining cards for a
 * later, backoff-controlled run.
 */
export function createEbayCircuitBreaker(maxBlocks = 2) {
  const requestedLimit = Number(maxBlocks);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.floor(requestedLimit)
    : 1;
  let blockedCount = 0;

  return {
    recordBlocked() {
      blockedCount += 1;
      return {
        blockedCount,
        shouldStop: blockedCount >= limit,
      };
    },
    get blockedCount() {
      return blockedCount;
    },
    get maxBlocks() {
      return limit;
    },
  };
}
