import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import * as fs from 'fs';
import * as path from 'path';

describe('SNKRDUNK Persistent Batch Update (v5 - DB Efficient)', () => {
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

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

  it('should use fetchPriceHistoryFromApi with throwOnError (not scrapeSnkrdunkPage)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('fetchPriceHistoryFromApi');
    expect(code).toContain('throwOnError: true');
    expect(code).not.toContain('scrapeSnkrdunkPage');
    expect(code).not.toContain("import { fetchPriceHistory }");
  });

  it('should use database-only progress tracking (no in-memory)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('batchTaskManager');
    expect(code).not.toContain('batchUpdateSnkrdunkProgress');
  });

  it('should have v5 DB-efficient configuration', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Reduced parallelism for stability
    expect(code).toContain('PARALLEL_LIMIT: 5');
    
    // Request timeout 30s
    expect(code).toContain('REQUEST_TIMEOUT: 30000');
    
    // Per-product timeout to prevent stalls
    expect(code).toContain('PRODUCT_TIMEOUT: 60000');
    
    // Retry logic
    expect(code).toContain('MAX_RETRIES: 1');
    
    // Higher failure threshold
    expect(code).toContain('MAX_CONSECUTIVE_HTTP_ERRORS: 200');
    
    // Watchdog timer
    expect(code).toContain('WATCHDOG_TIMEOUT');
  });

  it('should use batch insert instead of per-record duplicate check', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should use batch insert function
    expect(code).toContain('batchInsertPriceRecords');
    
    // Should use drizzle batch insert
    expect(code).toContain('database.insert(priceHistory).values(values)');
    
    // Should NOT call priceRecordExists as a function (was causing DB exhaustion)
    // It may appear in comments but should not be called
    expect(code).not.toMatch(/await\s+priceRecordExists/);
    expect(code).not.toContain('const isDuplicate');
  });

  it('should use atomic SQL progress updates (not read-then-write)', () => {
    const batchManagerCode = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    // Should have bulk update functions
    expect(batchManagerCode).toContain('updateTaskProgressBulkSuccess');
    expect(batchManagerCode).toContain('updateTaskProgressBulkFailure');
    
    // Should use atomic SQL increment (processedItems = processedItems + N)
    expect(batchManagerCode).toContain('processedItems = processedItems +');
    expect(batchManagerCode).toContain('successCount = successCount +');
  });

  it('should have batch progress flushing (not per-product DB writes)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should accumulate progress and flush in batches
    expect(code).toContain('batchSuccessCount');
    expect(code).toContain('batchFailureCount');
    expect(code).toContain('flushProgress');
    
    // Should use bulk update
    expect(code).toContain('updateTaskProgressBulkSuccess');
    expect(code).toContain('updateTaskProgressBulkFailure');
  });

  it('should have per-product timeout to prevent stalls', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should have withTimeout function
    expect(code).toContain('function withTimeout');
    
    // Should wrap product processing in timeout
    expect(code).toContain('PRODUCT_TIMEOUT');
    expect(code).toContain('processProduct');
  });

  it('should have watchdog timer to detect stalls', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should track last progress time
    expect(code).toContain('lastProgressTime');
    
    // Should have watchdog check
    expect(code).toContain('WATCHDOG_TIMEOUT');
    expect(code).toContain('Watchdog triggered');
  });

  it('should have global try-catch for background execution', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should catch FATAL errors and mark task as failed
    expect(code).toContain('FATAL');
    expect(code).toContain("status: 'failed'");
  });

  it('should distinguish timeout from HTTP errors', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('isTimeout');
    expect(code).toContain('consecutiveHttpErrors');
    expect(code).not.toContain('MAX_CONSECUTIVE_FAILURES');
  });

  it('should have retry logic with fetchWithRetry', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('fetchWithRetry');
    expect(code).toContain('retryDelay');
    expect(code).toContain('isLastAttempt');
  });

  it('should support smart skip (23 hours threshold)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('SKIP_RECENTLY_UPDATED_HOURS: 23');
    expect(code).toContain('lastFetchedAt');
    expect(code).toContain('skipThreshold');
  });

  it('should pre-extract snkrdunkId from URL', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('snkrdunkId: string');
    expect(code).toContain('extractSnkrdunkId(source.sourceUrl)');
    expect(code).toContain('product.snkrdunkId');
  });

  it('should be able to check running task status', async () => {
    const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
    expect(typeof hasRunning).toBe('boolean');
  });

  it('should be able to get latest running task', async () => {
    const task = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    if (task) {
      expect(task).toHaveProperty('taskId');
      expect(task).toHaveProperty('totalItems');
      expect(task).toHaveProperty('processedItems');
      expect(task).toHaveProperty('successCount');
      expect(task).toHaveProperty('failureCount');
    }
  });

  it('should log progress stats including timeouts', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('totalTimeouts');
    expect(code).toContain('totalNewRecords');
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

describe('Batch Task Manager v5 - Atomic Updates', () => {
  it('should use atomic SQL for progress updates', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    // updateTaskProgressSuccess should NOT read task first
    // It should use atomic increment
    expect(code).toContain('processedItems = processedItems + 1');
    expect(code).toContain('successCount = successCount + 1');
    
    // Should NOT have getBatchTaskProgress call inside updateTaskProgressSuccess
    // (old pattern was: read task, increment in JS, write back)
    const successFn = code.split('export async function updateTaskProgressSuccess')[1]?.split('export async function')[0] || '';
    expect(successFn).not.toContain('getBatchTaskProgress');
  });

  it('should have bulk update functions', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    expect(code).toContain('updateTaskProgressBulkSuccess');
    expect(code).toContain('updateTaskProgressBulkFailure');
  });

  it('should use lightweight status checks (select only status field)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'batchTaskManager.ts'),
      'utf-8'
    );
    
    // isTaskPaused and isTaskCancelled should select only status, not full task
    const pausedFn = code.split('export async function isTaskPaused')[1]?.split('export async function')[0] || '';
    expect(pausedFn).toContain('status: scheduledTasks.status');
    expect(pausedFn).not.toContain('getBatchTaskProgress');
    
    const cancelledFn = code.split('export async function isTaskCancelled')[1]?.split('export async function')[0] || '';
    expect(cancelledFn).toContain('status: scheduledTasks.status');
    expect(cancelledFn).not.toContain('getBatchTaskProgress');
  });
});
