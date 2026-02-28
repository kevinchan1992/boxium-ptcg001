/**
 * Batch Update Resilience Tests - v7 Controlled Parallel Mode
 * 
 * v7 uses controlled parallelism (2 concurrent) for speed,
 * while staying safely within DB connection pool limits.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Helper to get non-comment code lines
function getNonCommentLines(content: string): string {
  return content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

describe('Batch Update Resilience & Optimization (v7 - Controlled Parallel)', () => {
  const persistentBatchUpdatePath = path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts');
  const batchSchedulerPath = path.join(__dirname, 'batchUpdateScheduler.ts');
  let persistentBatchUpdateCode: string;
  let codeOnly: string;
  let batchSchedulerCode: string;

  beforeAll(() => {
    persistentBatchUpdateCode = fs.readFileSync(persistentBatchUpdatePath, 'utf-8');
    codeOnly = getNonCommentLines(persistentBatchUpdateCode);
    batchSchedulerCode = fs.readFileSync(batchSchedulerPath, 'utf-8');
  });

  describe('v7 Controlled Parallel Configuration', () => {
    it('should use controlled parallelism (PARALLEL: 2)', () => {
      expect(persistentBatchUpdateCode).toMatch(/PARALLEL:\s*2/);
    });

    it('should use Promise.allSettled for controlled parallel processing', () => {
      expect(codeOnly).toContain('Promise.allSettled');
    });

    it('should have short delay between batches (50ms)', () => {
      expect(persistentBatchUpdateCode).toContain('DELAY_BETWEEN_BATCHES');
    });

    it('should have delay after error', () => {
      expect(persistentBatchUpdateCode).toContain('DELAY_AFTER_ERROR');
    });

    it('should use fetchPriceHistoryFromApi with throwOnError', () => {
      expect(persistentBatchUpdateCode).toContain('fetchPriceHistoryFromApi');
      expect(persistentBatchUpdateCode).toContain('throwOnError: true');
    });

    it('should use batch INSERT for price records', () => {
      expect(codeOnly).toContain('.insert(priceHistoryTable).values(chunk)');
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
