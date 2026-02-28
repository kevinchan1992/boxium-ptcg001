/**
 * Batch Update Resilience Tests - v6 Serial Mode
 * 
 * v6 switched from parallel processing to pure serial mode
 * to match the manual "add data source" pattern that works reliably.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Batch Update Resilience & Optimization (v6 - Serial)', () => {
  const persistentBatchUpdatePath = path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts');
  const batchSchedulerPath = path.join(__dirname, 'batchUpdateScheduler.ts');
  let persistentBatchUpdateCode: string;
  let batchSchedulerCode: string;

  beforeAll(() => {
    persistentBatchUpdateCode = fs.readFileSync(persistentBatchUpdatePath, 'utf-8');
    batchSchedulerCode = fs.readFileSync(batchSchedulerPath, 'utf-8');
  });

  describe('v6 Serial Configuration', () => {
    it('should NOT have parallel processing (root cause of stalls)', () => {
      expect(persistentBatchUpdateCode).not.toContain('PARALLEL_LIMIT');
      expect(persistentBatchUpdateCode).not.toMatch(/await\s+Promise\.allSettled/);
    });

    it('should have delay between products', () => {
      expect(persistentBatchUpdateCode).toContain('DELAY_BETWEEN_PRODUCTS');
    });

    it('should have delay after error', () => {
      expect(persistentBatchUpdateCode).toContain('DELAY_AFTER_ERROR');
    });

    it('should use fetchPriceHistoryFromApi with throwOnError', () => {
      expect(persistentBatchUpdateCode).toContain('fetchPriceHistoryFromApi');
      expect(persistentBatchUpdateCode).toContain('throwOnError: true');
    });

    it('should use db.addPriceHistory (same as manual add)', () => {
      expect(persistentBatchUpdateCode).toContain('db.addPriceHistory');
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

  describe('Error Handling', () => {
    it('should have request timeout of 30 seconds', () => {
      expect(persistentBatchUpdateCode).toContain('REQUEST_TIMEOUT: 30000');
    });

    it('should distinguish timeout from HTTP errors', () => {
      expect(persistentBatchUpdateCode).toContain('isTimeout');
      expect(persistentBatchUpdateCode).toContain('consecutiveErrors');
    });

    it('should have max consecutive errors threshold', () => {
      expect(persistentBatchUpdateCode).toContain('MAX_CONSECUTIVE_ERRORS');
    });

    it('should reset consecutive errors on success', () => {
      expect(persistentBatchUpdateCode).toContain('consecutiveErrors = 0');
    });

    it('should mark task as failed when threshold is reached', () => {
      expect(persistentBatchUpdateCode).toContain("completeTask(taskId, 'failed')");
    });

    it('should have global try-catch for FATAL errors', () => {
      expect(persistentBatchUpdateCode).toContain('FATAL');
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

  describe('Progress Tracking', () => {
    it('should batch progress DB updates (not per-product)', () => {
      expect(persistentBatchUpdateCode).toContain('PROGRESS_DB_INTERVAL');
      expect(persistentBatchUpdateCode).toContain('pendingSuccessFlush');
    });

    it('should use atomic bulk progress updates', () => {
      expect(persistentBatchUpdateCode).toContain('updateTaskProgressBulkSuccess');
      expect(persistentBatchUpdateCode).toContain('updateTaskProgressBulkFailure');
    });

    it('should save metadata periodically', () => {
      expect(persistentBatchUpdateCode).toContain('PROGRESS_SAVE_INTERVAL');
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
