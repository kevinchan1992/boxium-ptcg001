/**
 * Tests for SNKRDUNK Persistent Batch Update v6 (Serial Mode)
 * 
 * v6 uses pure serial processing (no parallelism) to match the
 * manual "add SNKRDUNK data source" pattern that works reliably.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import * as fs from 'fs';
import * as path from 'path';

// Read the source file for structural analysis
const sourceCode = fs.readFileSync(
  path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
  'utf-8'
);

describe('SNKRDUNK Batch Update v6 - Serial Mode', () => {
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Architecture: No parallelism (root cause fix)', () => {
    it('should NOT use Promise.allSettled (caused DB connection pool deadlock)', () => {
      // Should not appear as actual code (await Promise.allSettled)
      // May appear in comments explaining why it was removed
      expect(sourceCode).not.toMatch(/await\s+Promise\.allSettled/);
    });
    
    it('should NOT use Promise.all for product processing', () => {
      expect(sourceCode).not.toContain('Promise.all(parallelBatch');
    });
    
    it('should NOT have PARALLEL_LIMIT config', () => {
      expect(sourceCode).not.toContain('PARALLEL_LIMIT');
    });
    
    it('should use simple serial for loop', () => {
      expect(sourceCode).toContain('for (let i = 0; i < remaining.length; i++)');
    });
  });
  
  describe('Architecture: No complex timeout wrappers', () => {
    it('should NOT use withTimeout wrapper', () => {
      expect(sourceCode).not.toContain('function withTimeout');
      expect(sourceCode).not.toContain('PRODUCT_TIMEOUT');
    });
    
    it('should NOT have watchdog timer', () => {
      expect(sourceCode).not.toContain('WATCHDOG_TIMEOUT');
    });
  });
  
  describe('Architecture: Same pattern as manual add data source', () => {
    it('should call fetchPriceHistoryFromApi with throwOnError', () => {
      expect(sourceCode).toContain('fetchPriceHistoryFromApi');
      expect(sourceCode).toContain('throwOnError: true');
    });
    
    it('should call db.addPriceHistory for each record (same as manual add)', () => {
      // Manual add uses: for (const priceEntry of cardData.priceHistory) { await db.addPriceHistory(...) }
      expect(sourceCode).toContain('db.addPriceHistory');
      expect(sourceCode).toContain('for (const priceEntry of priceHistory)');
    });
    
    it('should call db.updateDataSourceFetchStatus (same as manual add)', () => {
      expect(sourceCode).toContain('db.updateDataSourceFetchStatus');
    });
    
    it('should convert JPY to HKD (same as manual add)', () => {
      expect(sourceCode).toContain('convertJpyToHkd');
    });
    
    it('should NOT use scrapeSnkrdunkPage (only needs price history, not card details)', () => {
      // Should not import or call scrapeSnkrdunkPage
      expect(sourceCode).not.toMatch(/import.*scrapeSnkrdunkPage/);
      expect(sourceCode).not.toMatch(/await\s+scrapeSnkrdunkPage/);
    });
  });
  
  describe('Configuration', () => {
    it('should have reasonable delay between products', () => {
      const match = sourceCode.match(/DELAY_BETWEEN_PRODUCTS:\s*(\d+)/);
      expect(match).toBeTruthy();
      const delayMs = parseInt(match![1]);
      expect(delayMs).toBeGreaterThanOrEqual(100);
      expect(delayMs).toBeLessThanOrEqual(2000);
    });
    
    it('should have error delay', () => {
      const match = sourceCode.match(/DELAY_AFTER_ERROR:\s*(\d+)/);
      expect(match).toBeTruthy();
      const delayMs = parseInt(match![1]);
      expect(delayMs).toBeGreaterThanOrEqual(1000);
    });
    
    it('should have max consecutive errors threshold', () => {
      const match = sourceCode.match(/MAX_CONSECUTIVE_ERRORS:\s*(\d+)/);
      expect(match).toBeTruthy();
      const maxErrors = parseInt(match![1]);
      expect(maxErrors).toBeGreaterThanOrEqual(20);
    });
    
    it('should have request timeout', () => {
      const match = sourceCode.match(/REQUEST_TIMEOUT:\s*(\d+)/);
      expect(match).toBeTruthy();
      const timeout = parseInt(match![1]);
      expect(timeout).toBeGreaterThanOrEqual(15000);
      expect(timeout).toBeLessThanOrEqual(60000);
    });
    
    it('should have skip recently updated threshold', () => {
      expect(sourceCode).toContain('SKIP_RECENTLY_UPDATED_HOURS');
      expect(sourceCode).toContain('lastFetchedAt');
      expect(sourceCode).toContain('skipThreshold');
    });
  });
  
  describe('Error handling', () => {
    it('should distinguish timeout errors from HTTP errors', () => {
      expect(sourceCode).toContain('isTimeout');
      expect(sourceCode).toContain('if (!isTimeout)');
      expect(sourceCode).toContain('consecutiveErrors++');
    });
    
    it('should stop on too many consecutive HTTP errors', () => {
      expect(sourceCode).toContain('MAX_CONSECUTIVE_ERRORS');
      expect(sourceCode).toContain("completeTask(taskId, 'failed')");
    });
    
    it('should have global error handler for FATAL errors', () => {
      expect(sourceCode).toContain('FATAL');
    });
    
    it('should skip individual price record insert failures without failing the product', () => {
      // Each addPriceHistory should be in its own try-catch
      expect(sourceCode).toContain('} catch (insertErr)');
    });
  });
  
  describe('Progress tracking', () => {
    it('should batch progress updates (not per-product DB writes)', () => {
      expect(sourceCode).toContain('PROGRESS_DB_INTERVAL');
      expect(sourceCode).toContain('pendingSuccessFlush');
      expect(sourceCode).toContain('pendingFailFlush');
    });
    
    it('should use bulk progress update functions', () => {
      expect(sourceCode).toContain('updateTaskProgressBulkSuccess');
      expect(sourceCode).toContain('updateTaskProgressBulkFailure');
    });
    
    it('should save metadata periodically', () => {
      expect(sourceCode).toContain('PROGRESS_SAVE_INTERVAL');
      expect(sourceCode).toContain('saveTaskMetadata');
    });
    
    it('should check pause/cancel every 10 products (not every product)', () => {
      expect(sourceCode).toContain('i % 10 === 0');
    });
  });
  
  describe('Exports', () => {
    it('should export executePersistentSnkrdunkBatchUpdate', () => {
      expect(sourceCode).toContain('export async function executePersistentSnkrdunkBatchUpdate');
    });
    
    it('should export resumeFailedTask', () => {
      expect(sourceCode).toContain('export async function resumeFailedTask');
    });
    
    it('should export autoResumeOnStartup', () => {
      expect(sourceCode).toContain('export async function autoResumeOnStartup');
    });
  });
  
  describe('Data source integration', () => {
    it('should have SNKRDUNK data sources to process', async () => {
      const { data: allDataSources } = await db.getDataSources({ pageSize: 100000 });
      const snkrdunkSources = allDataSources.filter((ds: any) => ds.source === 'snkrdunk');
      
      const uniqueProducts = new Map<string, { id: number; name: string }>();
      for (const source of snkrdunkSources) {
        const productType = source.productType || 'single_card';
        const key = `${productType}:${source.cardId}`;
        if (source.card) {
          uniqueProducts.set(key, { id: source.card.id, name: source.card.name });
        }
      }

      expect(uniqueProducts.size).toBeGreaterThan(0);
    });

    it('should be able to check running task status', async () => {
      const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
      expect(typeof hasRunning).toBe('boolean');
    });
  });
});

describe('Batch Task Manager - Atomic Updates', () => {
  it('should use atomic SQL for progress updates', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    expect(code).toContain('processedItems = processedItems + 1');
    expect(code).toContain('successCount = successCount + 1');
  });

  it('should have bulk update functions', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    expect(code).toContain('updateTaskProgressBulkSuccess');
    expect(code).toContain('updateTaskProgressBulkFailure');
  });

  it('should use lightweight status checks', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    const pausedFn = code.split('export async function isTaskPaused')[1]?.split('export async function')[0] || '';
    expect(pausedFn).toContain('status: scheduledTasks.status');
    expect(pausedFn).not.toContain('getBatchTaskProgress');
  });
});

describe('fetchPriceHistoryFromApi throwOnError option', () => {
  it('should support throwOnError option in function signature', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'snkrdunkScraper.ts'),
      'utf-8'
    );
    
    expect(code).toContain('throwOnError');
    expect(code).toContain('options?: { timeout?: number; throwOnError?: boolean }');
    expect(code).toContain('enhancedError');
    expect(code).toContain('isTimeout');
  });
});
