import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Batch Update Resilience & Optimization (v4)', () => {
  const persistentBatchUpdatePath = path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts');
  const batchSchedulerPath = path.join(__dirname, 'batchUpdateScheduler.ts');
  let persistentBatchUpdateCode: string;
  let batchSchedulerCode: string;

  beforeAll(() => {
    persistentBatchUpdateCode = fs.readFileSync(persistentBatchUpdatePath, 'utf-8');
    batchSchedulerCode = fs.readFileSync(batchSchedulerPath, 'utf-8');
  });

  describe('v4 Optimized Configuration', () => {
    it('should have parallel limit of 5 (reduced from 15 for stability)', () => {
      expect(persistentBatchUpdateCode).toContain('PARALLEL_LIMIT: 5');
    });

    it('should have reduced delay (200-500ms)', () => {
      expect(persistentBatchUpdateCode).toContain('MIN_DELAY: 200');
      expect(persistentBatchUpdateCode).toContain('MAX_DELAY: 500');
    });

    it('should have batch pause of 1 second', () => {
      expect(persistentBatchUpdateCode).toContain('BATCH_PAUSE: 1000');
    });

    it('should have batch size of 50', () => {
      expect(persistentBatchUpdateCode).toContain('BATCH_SIZE: 50');
    });

    it('should only fetch price history using fetchPriceHistoryFromApi with throwOnError', () => {
      expect(persistentBatchUpdateCode).toContain('fetchPriceHistoryFromApi');
      expect(persistentBatchUpdateCode).toContain('throwOnError: true');
      // Should NOT use scrapeSnkrdunkPage (the old 2-API-call approach)
      expect(persistentBatchUpdateCode).not.toContain('scrapeSnkrdunkPage');
    });
  });

  describe('Architecture: Database-only progress tracking', () => {
    it('should use batchTaskManager as sole progress source', () => {
      expect(persistentBatchUpdateCode).toContain('batchTaskManager');
    });

    it('should NOT use old in-memory progress tracking', () => {
      expect(persistentBatchUpdateCode).not.toContain('batchUpdateSnkrdunkProgress');
    });

    it('should NOT import from deleted modules', () => {
      expect(persistentBatchUpdateCode).not.toContain('batchUpdateExecutor');
    });
  });

  describe('Exponential Backoff (only for HTTP errors)', () => {
    it('should have initial backoff of 5 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('INITIAL_BACKOFF: 5000');
    });

    it('should have max backoff of 120 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_BACKOFF: 120000');
    });

    it('should have backoff multiplier of 2', () => {
      expect(persistentBatchUpdateCode).toContain('BACKOFF_MULTIPLIER: 2');
    });

    it('should trigger backoff after 10 consecutive HTTP errors', () => {
      expect(persistentBatchUpdateCode).toContain('BACKOFF_TRIGGER: 10');
    });

    it('should implement backoff wait before processing', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveHttpErrors >= CONFIG.BACKOFF_TRIGGER');
      expect(persistentBatchUpdateCode).toContain('await new Promise(resolve => setTimeout(resolve, currentBackoff))');
    });

    it('should increase backoff on failure', () => {
      expect(persistentBatchUpdateCode).toContain('currentBackoff = Math.min(currentBackoff * CONFIG.BACKOFF_MULTIPLIER, CONFIG.MAX_BACKOFF)');
    });

    it('should reset backoff on success', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveHttpErrors = 0');
      expect(persistentBatchUpdateCode).toContain('currentBackoff = CONFIG.INITIAL_BACKOFF');
    });
  });

  describe('v4 Timeout & Retry Strategy', () => {
    it('should have request timeout of 30 seconds (increased from 15s)', () => {
      expect(persistentBatchUpdateCode).toContain('REQUEST_TIMEOUT: 30000');
    });

    it('should have retry logic with MAX_RETRIES: 1', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_RETRIES: 1');
    });

    it('should NOT use withTimeout wrapper (removed double timeout)', () => {
      // Should NOT call withTimeout as a function
      expect(persistentBatchUpdateCode).not.toMatch(/await\s+withTimeout\s*\(/);
      expect(persistentBatchUpdateCode).not.toMatch(/function\s+withTimeout/);
      expect(persistentBatchUpdateCode).not.toMatch(/import.*withTimeout/);
    });

    it('should use fetchWithRetry for retry logic', () => {
      expect(persistentBatchUpdateCode).toContain('fetchWithRetry');
    });

    it('should distinguish timeout from HTTP errors', () => {
      expect(persistentBatchUpdateCode).toContain('isTimeout');
      expect(persistentBatchUpdateCode).toContain('consecutiveHttpErrors');
    });
  });

  describe('Smart Skip', () => {
    it('should skip products updated within 23 hours', () => {
      expect(persistentBatchUpdateCode).toContain('SKIP_RECENTLY_UPDATED_HOURS: 23');
    });

    it('should check lastFetchedAt for skip logic', () => {
      expect(persistentBatchUpdateCode).toContain('lastFetchedAt');
      expect(persistentBatchUpdateCode).toContain('skipThreshold');
    });

    it('should sort products by oldest first', () => {
      expect(persistentBatchUpdateCode).toContain('aTime - bTime');
    });
  });

  describe('v4 Consecutive Failure Detection (HTTP errors only)', () => {
    it('should auto-stop after 200 consecutive HTTP errors (not timeouts)', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_CONSECUTIVE_HTTP_ERRORS: 200');
    });

    it('should track consecutive HTTP errors separately from timeouts', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveHttpErrors++');
    });

    it('should NOT count timeouts as consecutive failures', () => {
      expect(persistentBatchUpdateCode).toContain('DO NOT increment consecutiveHttpErrors for timeouts');
    });

    it('should mark task as failed when threshold is reached', () => {
      expect(persistentBatchUpdateCode).toContain("completeTask(taskId, 'failed')");
    });

    it('should store error message in database', () => {
      expect(persistentBatchUpdateCode).toContain('errorMessage: errorMsg');
    });
  });

  describe('Duplicate Price Record Prevention', () => {
    it('should check for existing records before inserting', () => {
      expect(persistentBatchUpdateCode).toContain('priceRecordExists');
    });

    it('should skip duplicate records', () => {
      expect(persistentBatchUpdateCode).toContain('isDuplicate');
      expect(persistentBatchUpdateCode).toContain('totalSkippedDuplicates');
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

  describe('Scheduler Integration', () => {
    it('should use persistent batch update in scheduler', () => {
      expect(batchSchedulerCode).toContain('executePersistentSnkrdunkBatchUpdate');
    });

    it('should NOT use old batchUpdateExecutor in scheduler', () => {
      expect(batchSchedulerCode).not.toContain('executeSnkrdunkBatchUpdate');
    });
  });
});
