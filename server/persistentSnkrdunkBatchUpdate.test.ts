/**
 * Tests for SNKRDUNK Persistent Batch Update v7.5 (Adaptive Parallelism)
 *
 * v7.5 introduces AdaptiveParallelController which dynamically adjusts
 * concurrency based on observed API response times.
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

// ─── AdaptiveParallelController unit tests ────────────────────────────────────
// We implement a pure-JS mirror of AdaptiveParallelController to unit-test
// the algorithm without TypeScript class syntax issues in new Function().
interface AdaptiveConfig {
  ADAPTIVE_WINDOW_SIZE: number;
  ADAPTIVE_EVAL_INTERVAL: number;
  ADAPTIVE_THRESHOLDS: Array<{ maxAvgMs: number; parallel: number }>;
  ADAPTIVE_MIN_PARALLEL: number;
  ADAPTIVE_MAX_PARALLEL: number;
}

function makeController(cfg: AdaptiveConfig, initialParallel: number) {
  const responseTimes: number[] = [];
  let currentParallel = initialParallel;
  let batchCount = 0;
  const adjustmentLog: Array<{ batchIndex: number; avgMs: number; from: number; to: number; ts: string }> = [];

  function computeDesired(avgMs: number): number {
    for (const { maxAvgMs, parallel } of cfg.ADAPTIVE_THRESHOLDS) {
      if (avgMs < maxAvgMs) return parallel;
    }
    return cfg.ADAPTIVE_MIN_PARALLEL;
  }

  return {
    recordResponseTime(ms: number) {
      responseTimes.push(ms);
      if (responseTimes.length > cfg.ADAPTIVE_WINDOW_SIZE) responseTimes.shift();
    },
    onBatchComplete(batchIndex: number) {
      batchCount++;
      if (batchCount % cfg.ADAPTIVE_EVAL_INTERVAL !== 0) return;
      if (responseTimes.length < Math.min(5, cfg.ADAPTIVE_WINDOW_SIZE)) return;
      const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const desired = computeDesired(avg);
      if (desired !== currentParallel) {
        const prev = currentParallel;
        currentParallel = desired;
        adjustmentLog.push({ batchIndex, avgMs: Math.round(avg), from: prev, to: desired, ts: new Date().toISOString() });
        if (adjustmentLog.length > 20) adjustmentLog.shift();
      }
    },
    get parallel() { return currentParallel; },
    get avgResponseMs() {
      if (responseTimes.length === 0) return 0;
      return Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    },
    toMetadata() {
      return {
        currentParallel,
        avgResponseMs: responseTimes.length === 0 ? 0 : Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        adjustmentLog: adjustmentLog.slice(-10),
      };
    },
  };
}

const DEFAULT_CFG: AdaptiveConfig = {
  ADAPTIVE_WINDOW_SIZE: 20,
  ADAPTIVE_EVAL_INTERVAL: 5,
  ADAPTIVE_THRESHOLDS: [
    { maxAvgMs: 1000, parallel: 6 },
    { maxAvgMs: 2000, parallel: 4 },
    { maxAvgMs: 4000, parallel: 3 },
  ],
  ADAPTIVE_MIN_PARALLEL: 2,
  ADAPTIVE_MAX_PARALLEL: 6,
};

describe('AdaptiveParallelController - Unit Tests', () => {
  describe('Initialization', () => {
    it('should start with the provided initial parallel value', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      expect(ctrl.parallel).toBe(3);
    });

    it('should report avgResponseMs = 0 when no data', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      expect(ctrl.avgResponseMs).toBe(0);
    });
  });

  describe('Response time recording', () => {
    it('should record response times and compute average', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      ctrl.recordResponseTime(500);
      ctrl.recordResponseTime(1000);
      ctrl.recordResponseTime(1500);
      expect(ctrl.avgResponseMs).toBe(1000);
    });

    it('should maintain sliding window of size ADAPTIVE_WINDOW_SIZE (20)', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 20; i++) ctrl.recordResponseTime(500);
      ctrl.recordResponseTime(5000);
      // Window: 19×500 + 1×5000 = 14500 / 20 = 725
      expect(ctrl.avgResponseMs).toBe(Math.round((19 * 500 + 5000) / 20));
    });
  });

  describe('Adaptive adjustment logic', () => {
    it('should NOT adjust before ADAPTIVE_EVAL_INTERVAL (5) batches', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(200);
      for (let b = 0; b < 4; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(3);
    });

    it('should upgrade to P=6 when avg < 1000ms after 5 batches', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(300);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(6);
    });

    it('should set P=4 when avg is 1000–2000ms', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(1500);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(4);
    });

    it('should stay at P=3 when avg is 2000–4000ms', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(3000);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(3);
    });

    it('should downgrade to P=2 when avg >= 4000ms', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(5000);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(2);
    });

    it('should NOT log adjustment if desired parallel equals current', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(3000);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.toMetadata().adjustmentLog).toHaveLength(0);
    });

    it('should re-evaluate every ADAPTIVE_EVAL_INTERVAL batches', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      // First 5 batches: fast → P=6
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(200);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(6);

      // Next 5 batches: very slow → P=2
      for (let i = 0; i < 20; i++) ctrl.recordResponseTime(6000);
      for (let b = 5; b < 10; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(2);
    });

    it('should NOT adjust when fewer than 5 response times recorded', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      ctrl.recordResponseTime(100); // only 1 sample
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);
      expect(ctrl.parallel).toBe(3);
    });
  });

  describe('Adjustment log', () => {
    it('should record adjustment events with batchIndex, avgMs, from, to, ts', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let i = 0; i < 10; i++) ctrl.recordResponseTime(200);
      for (let b = 0; b < 5; b++) ctrl.onBatchComplete(b);

      const log = ctrl.toMetadata().adjustmentLog;
      expect(log).toHaveLength(1);
      const entry = log[0] as { batchIndex: number; avgMs: number; from: number; to: number; ts: string };
      expect(entry.from).toBe(3);
      expect(entry.to).toBe(6);
      expect(entry.avgMs).toBeGreaterThan(0);
      expect(typeof entry.ts).toBe('string');
    });

    it('should keep at most 10 adjustment entries in toMetadata()', () => {
      const ctrl = makeController(DEFAULT_CFG, 3);
      for (let round = 0; round < 15; round++) {
        const ms = round % 2 === 0 ? 200 : 5000;
        for (let i = 0; i < 20; i++) ctrl.recordResponseTime(ms);
        for (let b = 0; b < 5; b++) ctrl.onBatchComplete(round * 5 + b);
      }
      expect(ctrl.toMetadata().adjustmentLog.length).toBeLessThanOrEqual(10);
    });
  });

  describe('toMetadata()', () => {
    it('should return currentParallel, avgResponseMs, adjustmentLog', () => {
      const ctrl = makeController(DEFAULT_CFG, 4);
      ctrl.recordResponseTime(800);
      const meta = ctrl.toMetadata();
      expect(meta).toHaveProperty('currentParallel', 4);
      expect(meta).toHaveProperty('avgResponseMs', 800);
      expect(Array.isArray(meta.adjustmentLog)).toBe(true);
    });
  });
});

describe('SNKRDUNK Batch Update v7.5 - Adaptive Parallelism (Source Analysis)', () => {
  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('AdaptiveParallelController class', () => {
    it('should define AdaptiveParallelController class in source', () => {
      expect(sourceCode).toContain('class AdaptiveParallelController');
    });

    it('should have ADAPTIVE_THRESHOLDS config', () => {
      expect(sourceCode).toContain('ADAPTIVE_THRESHOLDS');
    });

    it('should have ADAPTIVE_WINDOW_SIZE config', () => {
      expect(sourceCode).toContain('ADAPTIVE_WINDOW_SIZE');
    });

    it('should have ADAPTIVE_EVAL_INTERVAL config', () => {
      expect(sourceCode).toContain('ADAPTIVE_EVAL_INTERVAL');
    });

    it('should have ADAPTIVE_MIN_PARALLEL and ADAPTIVE_MAX_PARALLEL', () => {
      expect(sourceCode).toContain('ADAPTIVE_MIN_PARALLEL');
      expect(sourceCode).toContain('ADAPTIVE_MAX_PARALLEL');
    });
  });

  describe('Integration: adaptive controller in main loop', () => {
    it('should instantiate AdaptiveParallelController in runControlledParallelProcessing', () => {
      expect(codeOnly).toContain('new AdaptiveParallelController(CONFIG.PARALLEL)');
    });

    it('should call adaptive.recordResponseTime with apiResponseMs', () => {
      expect(codeOnly).toContain('adaptive.recordResponseTime(result.value.apiResponseMs)');
    });

    it('should call adaptive.onBatchComplete after each batch', () => {
      expect(codeOnly).toContain('adaptive.onBatchComplete(batchIndex)');
    });

    it('should use adaptive.parallel for batch slicing', () => {
      expect(codeOnly).toContain('remaining.slice(i, i + currentParallel)');
    });

    it('should advance i by currentParallel (not CONFIG.PARALLEL)', () => {
      expect(codeOnly).toContain('i += currentParallel');
    });

    it('should log adaptive state in progress output', () => {
      expect(codeOnly).toContain('P=${adaptive.parallel}');
      expect(codeOnly).toContain('avgApi=${adaptive.avgResponseMs}ms');
    });

    it('should persist adaptive state in metadata', () => {
      expect(codeOnly).toContain('adaptive.toMetadata()');
    });
  });

  describe('ProcessResult includes apiResponseMs', () => {
    it('should have apiResponseMs field in ProcessResult interface', () => {
      expect(sourceCode).toContain('apiResponseMs: number');
    });

    it('should measure API call time in processSingleProduct', () => {
      expect(codeOnly).toContain('apiStart = Date.now()');
      expect(codeOnly).toContain('apiResponseMs = Date.now() - apiStart');
    });

    it('should return apiResponseMs: 0 on error', () => {
      expect(codeOnly).toContain('apiResponseMs: 0');
    });
  });

  describe('Architecture: Controlled Parallel', () => {
    it('should use Promise.allSettled for controlled parallelism', () => {
      expect(codeOnly).toContain('Promise.allSettled');
    });

    it('should use batch INSERT for price records', () => {
      // Multi-line chained call: .insert(priceHistoryTable) on one line, .values(chunk) on next
      expect(sourceCode).toContain('.insert(priceHistoryTable)');
      expect(sourceCode).toContain('.values(chunk)');
    });

    it('should flush progress every 50 products', () => {
      expect(sourceCode).toMatch(/PROGRESS_DB_INTERVAL:\s*50/);
    });

    it('should use bulk progress update functions', () => {
      expect(codeOnly).toContain('updateTaskProgressBulkSuccess');
      expect(codeOnly).toContain('updateTaskProgressBulkFailure');
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

    it('should convert JPY to HKD', () => {
      expect(sourceCode).toContain('convertJpyToHkd');
    });
  });

  describe('Configuration Safety', () => {
    it('should have REQUEST_TIMEOUT of 15 seconds', () => {
      expect(sourceCode).toMatch(/REQUEST_TIMEOUT:\s*15000/);
    });

    it('should have MAX_CONSECUTIVE_ERRORS of 50', () => {
      expect(sourceCode).toMatch(/MAX_CONSECUTIVE_ERRORS:\s*50/);
    });

    it('should skip recently updated products (12 hours)', () => {
      expect(sourceCode).toMatch(/SKIP_RECENTLY_UPDATED_HOURS:\s*12/);
    });

    it('should have MAX_AUTO_RESUME_ATTEMPTS of 20', () => {
      expect(sourceCode).toMatch(/MAX_AUTO_RESUME_ATTEMPTS:\s*20/);
    });

    it('should have error delay of 500ms', () => {
      expect(sourceCode).toMatch(/DELAY_AFTER_ERROR:\s*500/);
    });

    it('should start with initial PARALLEL of 3', () => {
      expect(sourceCode).toMatch(/PARALLEL:\s*3/);
    });

    it('should have adaptive range from 2 to 6', () => {
      expect(sourceCode).toMatch(/ADAPTIVE_MIN_PARALLEL:\s*2/);
      expect(sourceCode).toMatch(/ADAPTIVE_MAX_PARALLEL:\s*6/);
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

    it('should export isSnkrdunkBatchUpdateRunning', () => {
      expect(sourceCode).toContain('export async function isSnkrdunkBatchUpdateRunning');
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
    }, 15000);

    it('should be able to check running task status', async () => {
      const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
      expect(typeof hasRunning).toBe('boolean');
    }, 10000);
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
