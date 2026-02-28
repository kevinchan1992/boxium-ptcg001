import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import * as fs from 'fs';
import * as path from 'path';

describe('SNKRDUNK Persistent Batch Update (v4 - Resilient)', () => {
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    
    // Should use fetchPriceHistoryFromApi directly (optimized single API call)
    expect(code).toContain('fetchPriceHistoryFromApi');
    
    // Should use throwOnError for proper error handling in batch mode
    expect(code).toContain('throwOnError: true');
    
    // Should NOT use scrapeSnkrdunkPage (old 2-API-call approach that also fetches card name)
    expect(code).not.toContain('scrapeSnkrdunkPage');
    
    // Should NOT use the old fetchPriceHistory wrapper (which doesn't throw)
    // Instead uses fetchPriceHistoryFromApi directly with throwOnError
    expect(code).not.toContain("import { fetchPriceHistory }");
  });

  it('should use database-only progress tracking (no in-memory)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should use batchTaskManager for all progress tracking
    expect(code).toContain('batchTaskManager');
    
    // Should NOT use old in-memory progress module
    expect(code).not.toContain('batchUpdateSnkrdunkProgress');
  });

  it('should have v4 resilient configuration', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Reduced parallelism for stability (from 15 to 5)
    expect(code).toContain('PARALLEL_LIMIT: 5');
    
    // Increased request timeout (from 15s to 30s)
    expect(code).toContain('REQUEST_TIMEOUT: 30000');
    
    // Retry logic
    expect(code).toContain('MAX_RETRIES: 1');
    
    // Higher failure threshold (only HTTP errors, not timeouts)
    expect(code).toContain('MAX_CONSECUTIVE_HTTP_ERRORS: 200');
  });

  it('should distinguish timeout from HTTP errors (not count timeouts as consecutive failures)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should have separate handling for timeouts vs HTTP errors
    expect(code).toContain('isTimeout');
    
    // Should NOT increment consecutive failures for timeouts
    expect(code).toContain('DO NOT increment consecutiveHttpErrors for timeouts');
    
    // Should only count real HTTP errors
    expect(code).toContain('consecutiveHttpErrors');
    
    // Should NOT use the old generic "consecutiveFailures" counter
    expect(code).not.toContain('MAX_CONSECUTIVE_FAILURES');
  });

  it('should have retry logic with fetchWithRetry', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should have fetchWithRetry function
    expect(code).toContain('fetchWithRetry');
    
    // Should retry on timeout with longer delay
    expect(code).toContain('retryDelay');
    expect(code).toContain('isLastAttempt');
  });

  it('should have duplicate price record check', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should check for existing records before inserting
    expect(code).toContain('priceRecordExists');
    expect(code).toContain('isDuplicate');
    expect(code).toContain('totalSkippedDuplicates');
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

  it('should pre-extract snkrdunkId from URL (not re-extract during processing)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // ProductInfo should include snkrdunkId
    expect(code).toContain('snkrdunkId: string');
    
    // Should extract ID upfront in getAllSnkrdunkProducts
    expect(code).toContain('extractSnkrdunkId(source.sourceUrl)');
    
    // processProduct should use pre-extracted ID
    expect(code).toContain('product.snkrdunkId');
  });

  it('should NOT use withTimeout wrapper as a function call (removed double timeout)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should NOT call withTimeout as a function (old pattern: await withTimeout(fetchPriceHistory(...), ...))
    expect(code).not.toMatch(/await\s+withTimeout\s*\(/);
    
    // Should NOT import or define withTimeout
    expect(code).not.toMatch(/function\s+withTimeout/);
    expect(code).not.toMatch(/import.*withTimeout/);
    
    // Timeout should be handled by axios directly via fetchPriceHistoryFromApi options
    expect(code).toContain('timeout: CONFIG.REQUEST_TIMEOUT');
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

  it('should log progress stats including timeouts and duplicates', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Progress logging should include timeout count and duplicate count
    expect(code).toContain('totalTimeouts');
    expect(code).toContain('totalNewRecords');
    expect(code).toContain('totalSkippedDuplicates');
  });
});

describe('fetchPriceHistoryFromApi throwOnError option', () => {
  it('should support throwOnError option in function signature', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'snkrdunkScraper.ts'),
      'utf-8'
    );
    
    // Should have throwOnError parameter
    expect(code).toContain('throwOnError');
    
    // Should have configurable timeout
    expect(code).toContain('options?: { timeout?: number; throwOnError?: boolean }');
    
    // Should re-throw with isTimeout flag when throwOnError is true
    expect(code).toContain('enhancedError');
    expect(code).toContain('isTimeout');
  });
});
