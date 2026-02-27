import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import * as fs from 'fs';
import * as path from 'path';

describe('SNKRDUNK Persistent Batch Update', () => {
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

  it('should use fetchPriceHistory (single API call) instead of scrapeSnkrdunkPage', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    // Should use fetchPriceHistory (optimized single API call)
    expect(code).toContain('fetchPriceHistory');
    
    // Should NOT use scrapeSnkrdunkPage (old 2-API-call approach)
    expect(code).not.toContain('scrapeSnkrdunkPage');
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

  it('should have optimized configuration (PARALLEL_LIMIT: 5)', () => {
    const code = fs.readFileSync(
      path.join(__dirname, 'persistentSnkrdunkBatchUpdate.ts'),
      'utf-8'
    );
    
    expect(code).toContain('PARALLEL_LIMIT: 5');
    expect(code).toContain('MIN_DELAY: 300');
    expect(code).toContain('MAX_DELAY: 800');
    expect(code).toContain('BATCH_PAUSE: 2000');
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

  it('should be able to check running task status', async () => {
    const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
    expect(typeof hasRunning).toBe('boolean');
  });

  it('should be able to get latest running task', async () => {
    const task = await batchTaskManager.getLatestRunningTask('batch_snkrdunk_update');
    // Task can be null (no running task) or an object
    if (task) {
      expect(task).toHaveProperty('taskId');
      expect(task).toHaveProperty('totalItems');
      expect(task).toHaveProperty('processedItems');
      expect(task).toHaveProperty('successCount');
      expect(task).toHaveProperty('failureCount');
    }
  });
});
