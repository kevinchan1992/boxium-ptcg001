import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Batch Update Resilience Improvements', () => {
  const persistentBatchUpdatePath = path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts');
  const batchSchedulerPath = path.join(__dirname, 'batchUpdateScheduler.ts');
  let persistentBatchUpdateCode: string;
  let batchSchedulerCode: string;

  beforeAll(() => {
    persistentBatchUpdateCode = fs.readFileSync(persistentBatchUpdatePath, 'utf-8');
    batchSchedulerCode = fs.readFileSync(batchSchedulerPath, 'utf-8');
  });

  describe('Configuration', () => {
    it('should have reduced parallel limit (2 instead of 5)', () => {
      expect(persistentBatchUpdateCode).toContain('PARALLEL_LIMIT: 2');
    });

    it('should have randomized delay between requests (800-2000ms)', () => {
      expect(persistentBatchUpdateCode).toContain('MIN_DELAY: 800');
      expect(persistentBatchUpdateCode).toContain('MAX_DELAY: 2000');
    });

    it('should have batch pause of 5 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('BATCH_PAUSE: 5000');
    });

    it('should have reduced batch size (40 instead of 80)', () => {
      expect(persistentBatchUpdateCode).toContain('BATCH_SIZE: 40');
    });
  });

  describe('Exponential Backoff', () => {
    it('should have initial backoff of 5 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('INITIAL_BACKOFF: 5000');
    });

    it('should have max backoff of 5 minutes', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_BACKOFF: 300000');
    });

    it('should have backoff multiplier of 2', () => {
      expect(persistentBatchUpdateCode).toContain('BACKOFF_MULTIPLIER: 2');
    });

    it('should trigger backoff after 3 consecutive failures', () => {
      expect(persistentBatchUpdateCode).toContain('BACKOFF_TRIGGER: 3');
    });

    it('should implement backoff wait before processing', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveFailures >= CONFIG.BACKOFF_TRIGGER');
      expect(persistentBatchUpdateCode).toContain('await new Promise(resolve => setTimeout(resolve, currentBackoff))');
    });

    it('should increase backoff on failure', () => {
      expect(persistentBatchUpdateCode).toContain('currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF)');
    });

    it('should reset backoff on success', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveFailures = 0');
      expect(persistentBatchUpdateCode).toContain('currentBackoff = CONFIG.INITIAL_BACKOFF');
    });
  });

  describe('Timeout Protection', () => {
    it('should have per-request timeout of 20 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('REQUEST_TIMEOUT: 20000');
    });

    it('should have parallel batch timeout of 60 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('PARALLEL_TIMEOUT: 60000');
    });

    it('should wrap scrape calls with timeout', () => {
      expect(persistentBatchUpdateCode).toContain('withTimeout(');
      expect(persistentBatchUpdateCode).toContain('CONFIG.REQUEST_TIMEOUT');
    });

    it('should wrap Promise.all with timeout', () => {
      expect(persistentBatchUpdateCode).toContain('withTimeout(');
      expect(persistentBatchUpdateCode).toContain('CONFIG.PARALLEL_TIMEOUT');
    });
  });

  describe('Smart Skip', () => {
    it('should skip products updated within 20 hours', () => {
      expect(persistentBatchUpdateCode).toContain('SKIP_RECENTLY_UPDATED_HOURS: 23');
    });

    it('should check lastFetchedAt for skip logic', () => {
      expect(persistentBatchUpdateCode).toContain('product.lastFetchedAt');
      expect(persistentBatchUpdateCode).toContain('skipThreshold');
    });

    it('should sort products by oldest first', () => {
      expect(persistentBatchUpdateCode).toContain('aTime - bTime');
      expect(persistentBatchUpdateCode).toContain('Oldest first');
    });
  });

  describe('Consecutive Failure Detection', () => {
    it('should auto-stop after 15 consecutive failures', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_CONSECUTIVE_FAILURES: 15');
    });

    it('should track consecutive failures', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveFailures++');
    });

    it('should mark task as failed when threshold is reached', () => {
      expect(persistentBatchUpdateCode).toContain("completeTask(taskId, 'failed')");
    });

    it('should store error message in database', () => {
      expect(persistentBatchUpdateCode).toContain('errorMessage: errorMsg');
    });
  });

  describe('Randomized Delays', () => {
    it('should have a randomDelay function', () => {
      expect(persistentBatchUpdateCode).toContain('function randomDelay');
      expect(persistentBatchUpdateCode).toContain('Math.random()');
    });

    it('should use randomized delays between batches', () => {
      expect(persistentBatchUpdateCode).toContain('await randomDelay(CONFIG.MIN_DELAY, CONFIG.MAX_DELAY)');
    });

    it('should use randomized pause between batch groups', () => {
      expect(persistentBatchUpdateCode).toContain('await randomDelay(CONFIG.BATCH_PAUSE');
    });
  });

  describe('Sealed Product Support', () => {
    it('should handle sealed_product type', () => {
      expect(persistentBatchUpdateCode).toContain("'sealed_product'");
      expect(persistentBatchUpdateCode).toContain('updateSealedProduct');
    });

    it('should handle single_card type', () => {
      expect(persistentBatchUpdateCode).toContain("'single_card'");
      expect(persistentBatchUpdateCode).toContain('updateCard');
    });
  });

  describe('Scheduler Integration', () => {
    it('should use persistent batch update in scheduler', () => {
      expect(batchSchedulerCode).toContain('executePersistentSnkrdunkBatchUpdate');
    });

    it('should NOT use old batchUpdateExecutor in scheduler', () => {
      expect(batchSchedulerCode).not.toContain('executeSnkrdunkBatchUpdate');
    });
  });
});
