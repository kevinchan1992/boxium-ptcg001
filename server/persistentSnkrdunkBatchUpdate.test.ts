/**
 * Tests for SNKRDUNK Persistent Batch Update v7 (Controlled Parallel)
 * 
 * v7 uses controlled parallelism (2 concurrent) for speed,
 * while staying safely within DB connection pool limits (10).
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

const codeOnly = getNonCommentLines(sourceCode);

describe('SNKRDUNK Batch Update v7 - Controlled Parallel', () => {
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Architecture: Controlled Parallel (2 concurrent)', () => {
    it('should use Promise.allSettled for controlled parallelism', () => {
      expect(codeOnly).toContain('Promise.allSettled');
    });
    
    it('should have PARALLEL config set to 2', () => {
      expect(sourceCode).toMatch(/PARALLEL:\s*2/);
    });
    
    it('should process products in batches using slice', () => {
      expect(codeOnly).toContain('remaining.slice(i, i + CONFIG.PARALLEL)');
    });
    
    it('should NOT use withTimeout wrapper', () => {
      expect(codeOnly).not.toContain('function withTimeout');
      expect(codeOnly).not.toContain('PRODUCT_TIMEOUT');
    });
    
    it('should NOT have watchdog timer', () => {
      expect(codeOnly).not.toContain('WATCHDOG_TIMEOUT');
    });
  });
  
  describe('Speed Optimizations', () => {
    it('should have short delay between batches (50ms)', () => {
      expect(sourceCode).toMatch(/DELAY_BETWEEN_BATCHES:\s*50/);
    });
    
    it('should use batch INSERT for price records', () => {
      expect(codeOnly).toContain('.insert(priceHistoryTable).values(chunk)');
    });
    
    it('should flush progress every 50 products', () => {
      expect(sourceCode).toMatch(/PROGRESS_DB_INTERVAL:\s*50/);
    });
    
    it('should use bulk progress update functions', () => {
      expect(codeOnly).toContain('updateTaskProgressBulkSuccess');
      expect(codeOnly).toContain('updateTaskProgressBulkFailure');
    });
    
    it('should log processing speed and ETA', () => {
      expect(codeOnly).toContain('Speed:');
      expect(codeOnly).toContain('ETA:');
    });
  });
  
  describe('Stability Features', () => {
    it('should have processSingleProduct that never throws', () => {
      expect(codeOnly).toContain('async function processSingleProduct');
      expect(codeOnly).toContain('success: true');
      expect(codeOnly).toContain('success: false');
    });
    
    it('should track consecutive errors only for non-timeout failures', () => {
      expect(codeOnly).toContain('if (!r.isTimeout)');
      expect(codeOnly).toContain('consecutiveErrors++');
    });
    
    it('should have pause/cancel support', () => {
      expect(codeOnly).toContain('isTaskCancelled');
      expect(codeOnly).toContain('isTaskPaused');
    });
    
    it('should save metadata periodically', () => {
      expect(codeOnly).toContain('saveTaskMetadata');
      expect(sourceCode).toMatch(/PROGRESS_SAVE_INTERVAL:\s*200/);
    });
    
    it('should handle batch INSERT failures with fallback to individual inserts', () => {
      expect(codeOnly).toContain("insertErr.message?.includes('Duplicate')");
    });
    
    it('should convert JPY to HKD', () => {
      expect(sourceCode).toContain('convertJpyToHkd');
    });
    
    it('should NOT use scrapeSnkrdunkPage (only needs price history)', () => {
      expect(sourceCode).not.toMatch(/import.*scrapeSnkrdunkPage/);
      expect(sourceCode).not.toMatch(/await\s+scrapeSnkrdunkPage/);
    });
  });
  
  describe('Configuration Safety', () => {
    it('should have REQUEST_TIMEOUT of 30 seconds', () => {
      expect(sourceCode).toMatch(/REQUEST_TIMEOUT:\s*30000/);
    });
    
    it('should have MAX_CONSECUTIVE_ERRORS of 50', () => {
      expect(sourceCode).toMatch(/MAX_CONSECUTIVE_ERRORS:\s*50/);
    });
    
    it('should skip recently updated products (23 hours)', () => {
      expect(sourceCode).toMatch(/SKIP_RECENTLY_UPDATED_HOURS:\s*23/);
    });
    
    it('should have MAX_AUTO_RESUME_ATTEMPTS of 3', () => {
      expect(sourceCode).toMatch(/MAX_AUTO_RESUME_ATTEMPTS:\s*3/);
    });
    
    it('should have error delay of 1000ms', () => {
      expect(sourceCode).toMatch(/DELAY_AFTER_ERROR:\s*1000/);
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
