/**
 * Rate Limiter Service
 * 
 * Implements token bucket algorithm to limit API request rates
 * Prevents exceeding eBay API quotas (5,000 calls/day)
 */

interface RateLimiterConfig {
  maxTokens: number; // Maximum number of tokens in the bucket
  refillRate: number; // Tokens added per minute
  refillInterval: number; // Interval in milliseconds to refill tokens
}

class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill() {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    const intervalsElapsed = Math.floor(elapsedTime / this.config.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.config.refillRate;
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Try to consume a token
   * @returns true if token was consumed, false if rate limit exceeded
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Get time until next token refill (in milliseconds)
   */
  getTimeUntilRefill(): number {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefillTime;
    return Math.max(0, this.config.refillInterval - timeSinceLastRefill);
  }
}

/**
 * eBay API Rate Limiter
 * 
 * Configuration:
 * - Max tokens: 100 (burst capacity)
 * - Refill rate: 3 tokens per minute (180 per hour, ~4,320 per day)
 * - Refill interval: 60,000ms (1 minute)
 * 
 * This keeps us safely under the 5,000 calls/day limit
 */
export const ebayRateLimiter = new RateLimiter({
  maxTokens: 100, // Allow burst of 100 requests
  refillRate: 3, // Add 3 tokens per minute
  refillInterval: 60000, // 1 minute in milliseconds
});

/**
 * Wait until a token is available
 * @param maxWaitTime Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns true if token was acquired, false if timeout
 */
export async function waitForToken(maxWaitTime: number = 5 * 60 * 1000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    if (ebayRateLimiter.tryConsume()) {
      return true;
    }

    // Wait for next refill
    const waitTime = Math.min(
      ebayRateLimiter.getTimeUntilRefill(),
      maxWaitTime - (Date.now() - startTime)
    );

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return false;
}

/**
 * Get rate limiter status
 */
export function getRateLimiterStatus() {
  return {
    availableTokens: ebayRateLimiter.getTokenCount(),
    timeUntilRefill: ebayRateLimiter.getTimeUntilRefill(),
  };
}
