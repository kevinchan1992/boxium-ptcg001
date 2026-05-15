/**
 * @DEPRECATED - 此檔案已由 GitHub Actions 方案取代（Plan C）
 *
 * 新方案位置：scripts/githubActionsBatchUpdate.mjs
 * 新方案 Workflow：.github/workflows/snkrdunk-batch-update.yml
 *
 * 此檔案保留供參考，日後確認 GitHub Actions 方案穩定後可刪除。
 * 標記日期：2026-04-22
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * SNKRDUNK Persistent Batch Update (v7.5 - Adaptive Parallelism)
 *
 * v7 proved controlled 2-parallel is STABLE and FAST (~3.6/s, 0 failures).
 *
 * v7.1 FIX: Metadata save was failing because processedProductKeys array
 * grew beyond MySQL TEXT column limit (65KB) at ~3000 keys.
 *
 * SOLUTION: Stop storing processedProductKeys in metadata.
 * Instead, use processedCount (integer) for resume tracking.
 * On resume, rely on SKIP_RECENTLY_UPDATED_HOURS to skip already-updated
 * products (their lastFetchedAt is recent), which is more reliable anyway.
 * The in-memory processedKeys Set is still used during a single run to
 * prevent re-processing within the same execution.
 *
 * v7.2 UPGRADE: PARALLEL raised from 2 → 4 after stability testing (2026-03-09).
 * v7.3 UPGRADE: PARALLEL raised from 4 → 8 (2026-03-31).
 * v7.4 DOWNGRADE: PARALLEL reduced from 8 → 3 (2026-05-06).
 *   Investigation revealed Cloud Run deployed server is CPU-throttled (0.08 vCPU).
 *   P=8 caused event loop congestion: actual speed only 0.5/s vs expected 4-5/s.
 *   Root cause: Cloud Run CPU throttling + DB insert overhead at high concurrency.
 *
 * v7.5 ADAPTIVE PARALLELISM (2026-05-06):
 *   Replaced static PARALLEL=3 with AdaptiveParallelController.
 *   The controller maintains a sliding window of recent API response times and
 *   automatically adjusts concurrency based on observed latency:
 *     avg < 1s  → PARALLEL = 6  (fast environment, e.g., sandbox)
 *     1–2s      → PARALLEL = 4  (normal)
 *     2–4s      → PARALLEL = 3  (slightly slow, e.g., Cloud Run)
 *     ≥ 4s      → PARALLEL = 2  (slow / rate-limited)
 *   Re-evaluation happens every ADAPTIVE_EVAL_INTERVAL batches to avoid
 *   thrashing. Adjustment events are logged and stored in task metadata.
 *
 * v8.2 CLOUD RUN KEEPALIVE PING (2026-05-08):
 *   ROOT CAUSE FOUND: Cloud Run idles and suspends the Node.js process when there
 *   is no incoming HTTP traffic. Investigation of task 3900023 showed 98% of the
 *   828-minute wall time was idle (only 18 minutes of active processing).
 *   SOLUTION: KeepAlive Pinger sends a self-HTTP GET to localhost:3000/api/health
 *   every KEEPALIVE_INTERVAL_MS (4 minutes) while the batch task runs.
 *   This keeps the Cloud Run instance active and prevents process suspension.
 *   Expected improvement: active processing ratio from 2% → ~95%.
 *
 * v8.1 TIMEOUT BACKOFF (2026-05-07):
 *   REQUEST_TIMEOUT: 15000ms → 8000ms (halves wait time for timeout cards)
 *   DELAY_AFTER_ERROR: 500ms → 200ms (faster recovery)
 *   Added consecutive-timeout counter: if ≥3 timeouts in a row, drop PARALLEL
 *   to ADAPTIVE_MIN_PARALLEL and wait TIMEOUT_BACKOFF_DELAY_MS before resuming.
 *   This prevents the "cold start" problem where Cloud Run + SNKRDUNK rate-limit
 *   causes the first N batches to all timeout, wasting hours.
 *
 * v8.0 SMART SKIP (2026-05-06):
 *   ROOT CAUSE FOUND: 83.9% of cards (46,775/55,734) have ZERO price history.
 *   Every batch update was wasting ~10.4 hours fetching empty API responses.
 *   SOLUTION: Mark cards with existing history as 'hasHistory=true' at load time.
 *   Cards with no history are moved to a LOW-PRIORITY queue and only checked
 *   every EMPTY_CARD_RECHECK_DAYS days (default: 7 days).
 *   This reduces effective workload from 55,734 → ~8,952 cards per run.
 *   Expected speedup: 6x (from ~10h → ~1.5h per full cycle).
 *
 *   Also: Adaptive thresholds tuned based on real Cloud Run measurements:
 *     avg < 1s  → PARALLEL = 8  (fast: sandbox)
 *     1–2s      → PARALLEL = 6  (normal)
 *     2–3.5s    → PARALLEL = 4  (Cloud Run typical)
 *     ≥ 3.5s    → PARALLEL = 3  (Cloud Run slow)
 */

import * as db from './db';
import * as batchTaskManager from './batchTaskManager';
import { extractSnkrdunkId, fetchPriceHistoryFromApi, convertJpyToHkd } from './snkrdunkScraper';
import { getRecentlyViewedCardIds } from './db';
import { computeRecordHash } from './utils/recordHash';
import http from 'http';

// ─── Configuration (v8.0 - Smart Skip + Tuned Adaptive) ────────────
const CONFIG = {
  // Initial parallel concurrency — overridden by AdaptiveParallelController at runtime.
  // v8.0: Start at 4 (tuned for Cloud Run ~2s avg response time).
  PARALLEL: 4,

  // ── Adaptive Parallelism thresholds ──────────────────────────
  // Sliding window size: number of recent API response times to average
  ADAPTIVE_WINDOW_SIZE: 20,
  // Re-evaluate parallelism every N batches (avoid thrashing)
  ADAPTIVE_EVAL_INTERVAL: 5,
  // Latency → concurrency mapping (thresholds in ms)
  // Tuned based on real Cloud Run measurements (2026-05-06):
  //   Sandbox: avg ~800ms → P=8 (2.61/s measured at P=8)
  //   Cloud Run: avg ~2s  → P=4 (optimal for CPU-throttled env)
  //   Rate-limited: avg >3.5s → P=3 (back off)
  ADAPTIVE_THRESHOLDS: [
    { maxAvgMs: 1000, parallel: 3 },  // v8.3: capped at 3 to prevent Cloud Run OOM (512MB RAM)
    { maxAvgMs: 2000, parallel: 2 },
    { maxAvgMs: 3500, parallel: 2 },
  ] as Array<{ maxAvgMs: number; parallel: number }>,
  ADAPTIVE_MIN_PARALLEL: 1,
  ADAPTIVE_MAX_PARALLEL: 3,  // v8.3: hard cap at 3 — prevents OOM on Cloud Run 512MB
  // v8.1: Consecutive timeout threshold — if this many timeouts occur in a row,
  // drop to ADAPTIVE_MIN_PARALLEL and wait TIMEOUT_BACKOFF_DELAY_MS.
  CONSECUTIVE_TIMEOUT_THRESHOLD: 3,
  // How long to wait (ms) after hitting the consecutive timeout threshold.
  // Gives SNKRDUNK time to lift rate-limiting before resuming.
  TIMEOUT_BACKOFF_DELAY_MS: 30000,

  // ── Smart Skip: Empty Card Optimization ──────────────────────
  // Cards with no price history are checked less frequently.
  // After a successful fetch returning 0 records, the card is
  // not re-checked for EMPTY_CARD_RECHECK_DAYS days.
  // This reduces workload from 55,734 → ~8,952 per run (6x speedup).
  EMPTY_CARD_RECHECK_DAYS: 7,

  // Delay between parallel batches (ms)
  // Set to 0 — no throttle needed for stateless HTTP API calls.
  DELAY_BETWEEN_BATCHES: 0,

  // Delay after error (ms)
  // v8.1: Reduced from 500 → 200ms for faster recovery.
  DELAY_AFTER_ERROR: 200,

  // API request timeout (ms)
  // v8.1: Reduced from 15000 → 8000ms. Timeout cards are retried on next run anyway;
  // cutting the wait time in half significantly reduces total time when many cards timeout.
  REQUEST_TIMEOUT: 8000,

  // Max consecutive errors before stopping (HTTP errors only, not timeouts)
  MAX_CONSECUTIVE_ERRORS: 50,

  // ── Cloud Run KeepAlive Ping (v8.2) ──────────────────────────
  // Interval (ms) between self-ping requests to prevent Cloud Run idle shutdown.
  // Cloud Run suspends instances after ~5 minutes of no incoming HTTP traffic.
  // Set to 4 minutes (240,000ms) to stay well within the idle timeout.
  KEEPALIVE_INTERVAL_MS: 4 * 60 * 1000,

  // Progress save interval (save metadata every N products)
  PROGRESS_SAVE_INTERVAL: 200,

  // Progress DB update interval (update task progress every N products)
  PROGRESS_DB_INTERVAL: 50,

  // Skip products updated within this many hours
  SKIP_RECENTLY_UPDATED_HOURS: 12,

  // Max auto-resume attempts
  MAX_AUTO_RESUME_ATTEMPTS: 20,
};

// ─── Adaptive Parallel Controller ───────────────────────────────
/**
 * Tracks recent API response times and dynamically adjusts the parallel
 * concurrency level to match the current environment's capacity.
 *
 * Design goals:
 *  - Start conservatively (initial PARALLEL=3) and ramp up if fast.
 *  - React to sustained slowness (e.g., Cloud Run CPU throttle) by reducing.
 *  - Avoid thrashing: only re-evaluate every ADAPTIVE_EVAL_INTERVAL batches.
 *  - Emit structured log lines for observability.
 */
class AdaptiveParallelController {
  private responseTimes: number[] = [];
  private currentParallel: number;
  private batchCount = 0;
  private adjustmentLog: Array<{ batchIndex: number; avgMs: number; from: number; to: number; ts: string }> = [];

  constructor(initialParallel: number) {
    this.currentParallel = initialParallel;
  }

  /** Record the wall-clock duration of a single API request (ms). */
  recordResponseTime(ms: number): void {
    this.responseTimes.push(ms);
    if (this.responseTimes.length > CONFIG.ADAPTIVE_WINDOW_SIZE) {
      this.responseTimes.shift();
    }
  }

  /** Called after each batch completes. May adjust currentParallel. */
  onBatchComplete(batchIndex: number): void {
    this.batchCount++;
    if (this.batchCount % CONFIG.ADAPTIVE_EVAL_INTERVAL !== 0) return;
    if (this.responseTimes.length < Math.min(5, CONFIG.ADAPTIVE_WINDOW_SIZE)) return;

    const avg = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    const desired = this.computeDesiredParallel(avg);

    if (desired !== this.currentParallel) {
      const prev = this.currentParallel;
      this.currentParallel = desired;
      const entry = { batchIndex, avgMs: Math.round(avg), from: prev, to: desired, ts: new Date().toISOString() };
      this.adjustmentLog.push(entry);
      if (this.adjustmentLog.length > 20) this.adjustmentLog.shift();
      console.log(`[BatchUpdate] ⚡ Adaptive: avg=${Math.round(avg)}ms → PARALLEL ${prev} → ${desired}`);
    }
  }

  private computeDesiredParallel(avgMs: number): number {
    for (const { maxAvgMs, parallel } of CONFIG.ADAPTIVE_THRESHOLDS) {
      if (avgMs < maxAvgMs) return parallel;
    }
    return CONFIG.ADAPTIVE_MIN_PARALLEL;
  }

  get parallel(): number {
    return this.currentParallel;
  }

  get avgResponseMs(): number {
    if (this.responseTimes.length === 0) return 0;
    return Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length);
  }

  /** Serialise for metadata storage. */
  toMetadata() {
    return {
      currentParallel: this.currentParallel,
      avgResponseMs: this.avgResponseMs,
      adjustmentLog: this.adjustmentLog.slice(-10),
    };
  }
}

// ─── KeepAlive Pinger (v8.2) ────────────────────────────────────
/**
 * Sends a lightweight self-HTTP ping to localhost:3000/api/health every
 * KEEPALIVE_INTERVAL_MS to prevent Cloud Run from suspending the process
 * due to idle timeout (~5 minutes of no incoming traffic).
 *
 * Usage:
 *   const pinger = new KeepAlivePinger();
 *   pinger.start();
 *   // ... do work ...
 *   pinger.stop();
 */
class KeepAlivePinger {
  private timer: NodeJS.Timeout | null = null;
  private pingCount = 0;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.ping();
    }, CONFIG.KEEPALIVE_INTERVAL_MS);
    console.log(`[KeepAlive] Started pinger (interval=${CONFIG.KEEPALIVE_INTERVAL_MS / 1000}s)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log(`[KeepAlive] Stopped pinger after ${this.pingCount} pings`);
  }

  private ping(): void {
    const req = http.get({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      timeout: 5000,
      headers: { 'User-Agent': 'BoxiumKeepAlive/1.0 (internal-batch-pinger)' },
    }, (res) => {
      this.pingCount++;
      console.log(`[KeepAlive] Ping #${this.pingCount} → HTTP ${res.statusCode}`);
      res.resume(); // discard response body
    });
    req.on('error', (err) => {
      // Non-fatal: ping failure doesn't stop the batch task
      console.warn(`[KeepAlive] Ping failed: ${err.message}`);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn(`[KeepAlive] Ping timed out`);
    });
  }
}

// ─── Types ────────────────────────────────────────────────────────
interface ProductInfo {
  id: number;
  name: string;
  productType: string;
  snkrdunkId: string;
  lastFetchedAt: Date | null;
  sourceUrl: string;
  dataSourceId: number;
  /** True if this card has at least one price history record (from DB at load time). */
  hasHistory: boolean;
}

interface ProcessResult {
  success: boolean;
  productKey: string;
  error?: { cardId: number; cardName: string; error: string };
  isTimeout?: boolean;
  /** Wall-clock time of the SNKRDUNK API call in ms (0 if not measured). */
  apiResponseMs: number;
}

/**
 * Get all SNKRDUNK products with their data source info.
 *
 * v8.0: Also fetches the set of cardIds that have at least one priceHistory record,
 * so we can skip empty cards that have no history (83.9% of all cards).
 */
async function getAllSnkrdunkProducts(): Promise<ProductInfo[]> {
  // v8.4 OPTIMISATION: Use indexed query instead of pageSize:100000 full-table scan.
  // Old: getDataSources({ pageSize: 100000 }) loaded ALL 57,000+ rows (eBay + SNKRDUNK)
  //      into memory, then filtered in JS. Caused ~2-3s DB query + high RAM usage.
  // New: getSnkrdunkDataSourcesForBatch() uses idx_datasources_cardId_source index
  //      to fetch ONLY snkrdunk rows directly from MySQL.
  const snkrdunkSources = await db.getSnkrdunkDataSourcesForBatch();

  // v8.0: Build a set of cardIds that have at least one SNKRDUNK price history record.
  // This is a single DB query that lets us skip 83.9% of empty cards.
  const cardIdsWithHistory = new Set<number>();
  try {
    const database = await db.getDb();
    if (database) {
      const { priceHistory: priceHistoryTable } = await import('../drizzle/schema_new');
      const { eq, sql } = await import('drizzle-orm');
      const rows = await database
        .selectDistinct({ cardId: priceHistoryTable.cardId })
        .from(priceHistoryTable)
        .where(eq(priceHistoryTable.source, 'snkrdunk'));
      for (const row of rows) {
        cardIdsWithHistory.add(row.cardId);
      }
      console.log(`[BatchUpdate] v8.0 Smart Skip: ${cardIdsWithHistory.size} cards have price history, ${snkrdunkSources.length - cardIdsWithHistory.size} are empty`);
    }
  } catch (err) {
    console.warn('[BatchUpdate] Failed to load hasHistory set, all cards will be processed:', (err as Error).message);
  }
  
  const uniqueProducts = new Map<string, ProductInfo>();
  
  for (const source of snkrdunkSources) {
    const productType = source.productType || 'single_card';
    const key = `${productType}:${source.cardId}`;
    
    if (uniqueProducts.has(key)) continue;
    
    const snkrdunkId = extractSnkrdunkId(source.sourceUrl);
    if (!snkrdunkId) continue;
    
    const name = source.card?.name || `Product ${source.cardId}`;
    
    uniqueProducts.set(key, {
      id: source.cardId,
      name,
      productType,
      snkrdunkId,
      lastFetchedAt: source.lastFetchedAt ? new Date(source.lastFetchedAt) : null,
      sourceUrl: source.sourceUrl || '',
      dataSourceId: source.id,
      hasHistory: cardIdsWithHistory.has(source.cardId),
    });
  }

  return Array.from(uniqueProducts.values());
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single product - fetch prices and save to DB.
 * Returns a result object (never throws).
 */
async function processSingleProduct(product: ProductInfo): Promise<ProcessResult> {
  const productKey = `${product.productType}:${product.id}`;
  
  try {
    // Step 1: Fetch price history from SNKRDUNK API (HTTP, not DB)
    const productType: "single_card" | "sealed_product" = 
      product.productType === 'sealed_product' ? 'sealed_product' : 'single_card';
    
    const apiStart = Date.now();
    const rawPriceHistory = await fetchPriceHistoryFromApi(
      product.snkrdunkId,
      productType,
      { timeout: CONFIG.REQUEST_TIMEOUT, throwOnError: true }
    );
    const apiResponseMs = Date.now() - apiStart;

    // Validate and filter using unified validator (grade normalisation + min-price + IQR)
    const { validateAndFilterPriceHistory } = await import('./utils/priceValidator');
    const priceHistory = validateAndFilterPriceHistory(rawPriceHistory ?? [], productType);
    
    // Step 2: Batch insert all price records at once
    if (priceHistory && priceHistory.length > 0) {
      const database = await db.getDb();
      if (database) {
        const { priceHistory: priceHistoryTable } = await import('../drizzle/schema_new');
        
        // ─── Skip relative-time records ("N時間前") in batch update ────────────
        // Batch update runs twice daily (10:00 and 22:00 HKT). Records with relative
        // timestamps ("N時間前") have unstable soldAt values that shift with each crawl,
        // making stable hash-based dedup impossible. These records will be captured in
        // the next batch run (≤12h later) once SNKRDUNK converts them to absolute dates.
        // This avoids duplicate records without sacrificing meaningful data freshness.
        const relativeTimeSkipped = priceHistory.filter((e: any) => e.isRelativeTime).length;
        const absolutePriceHistory = priceHistory.filter((e: any) => !e.isRelativeTime);
        if (relativeTimeSkipped > 0) {
          console.log(`[BatchUpdate] Skipped ${relativeTimeSkipped} relative-time records (will be captured in next run)`);
        }
        
        // Assign sourcePosition using PER-GROUP relative position (not global index).
        // Key insight: sourcePosition must be stable across scrape runs.
        // Using global index (idx) causes duplicates because when new records are added
        // at the top of the API response, all older records shift down in position.
        // Instead, we assign position within each (soldAt, grade, jpyPrice) group,
        // so the same transaction always gets the same sourcePosition regardless of
        // how many new records have been added since the last scrape.
        const groupCounters = new Map<string, number>();
        const records = absolutePriceHistory.map((entry: any) => {
          const soldAtStr = entry.soldAt ? entry.soldAt.toISOString().slice(0, 10) : 'unknown';
          const gradeNorm = productType === 'single_card' ? (entry.normalisedGrade ?? null) : null;
          const jpyPrice = entry.jpyPrice ?? entry.price;
          // Use normalised grade string for groupKey (null → 'null' for key only)
          const gradeKey = gradeNorm ?? 'null';
          const groupKey = `${soldAtStr}|${gradeKey}|${jpyPrice}`;
          const pos = groupCounters.get(groupKey) ?? 0;
          groupCounters.set(groupKey, pos + 1);
          // Compute stable recordHash for idempotent upsert
          const recordHash = computeRecordHash({
            cardId: product.id,
            source: 'snkrdunk',
            grade: gradeNorm,
            soldAt: entry.soldAt,
            jpyPrice,
            sourcePosition: pos,
          });
          return {
            cardId: product.id,
            source: "snkrdunk" as const,
            price: convertJpyToHkd(entry.price).toString(),
            currency: "HKD",
            jpyPrice,
            sourcePosition: pos, // Relative position within same (soldAt, grade, jpyPrice) group
            grade: gradeNorm,
            quantity: productType === 'sealed_product' ? (entry.quantity || null) : null,
            productType,
            soldAt: entry.soldAt,
            listingUrl: product.sourceUrl,
            recordHash,
            // Pass relative-time dedup fields for dynamic time-window dedup in addPriceHistory
            // Note: batch update uses direct DB insert (not addPriceHistory), so these are
            // included here for completeness but not actively used in the batch path.
            isRelativeTime: (entry as any).isRelativeTime,
            estimatedSoldAt: (entry as any).estimatedSoldAt,
          };
        });
        
        // ─── Bulk purchase detection (isSuspectedBulk) ─────────────
        // For single cards: compute 30-day median JPY price per grade,
        // then flag any transaction exceeding 4× the median as a suspected bulk/lot.
        // This prevents lot purchases (e.g., ¥65,000 for 8 cards) from skewing PSA10 averages.
        const BULK_MULTIPLIER = 4;
        const medianByGrade = new Map<string, number>();
        if (productType === 'single_card') {
          // Group existing non-bulk records by grade to compute per-grade medians
          const gradeGroups = new Map<string, number[]>();
          for (const rec of records) {
            const g = rec.grade || 'unknown';
            if (!gradeGroups.has(g)) gradeGroups.set(g, []);
            gradeGroups.get(g)!.push(rec.jpyPrice as number);
          }
          for (const [grade, prices] of Array.from(gradeGroups.entries())) {
            const sorted = [...prices].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];
            medianByGrade.set(grade, median);
          }
        }

        // Apply isSuspectedBulk flag based on median threshold
        const flaggedRecords = records.map(rec => {
          if (productType !== 'single_card') return rec;
          const grade = rec.grade || 'unknown';
          const median = medianByGrade.get(grade);
          const jpyPrice = rec.jpyPrice as number;
          const isSuspectedBulk = !!(median && median > 0 && jpyPrice > BULK_MULTIPLIER * median);
          return { ...rec, isSuspectedBulk };
        });

        // Batch insert in chunks of 50 to avoid query size limits.
        // Deduplication strategy (3 layers):
        //   1. recordHash UNIQUE INDEX: primary idempotent key (stable across re-runs)
        //   2. uniq_price_card_source_grade_soldAt_jpyPrice_pos: legacy fallback UNIQUE INDEX
        //   3. onDuplicateKeyUpdate: updates isSuspectedBulk + recordHash without inserting duplicate
        // Pre-deduplicate within this batch by recordHash to avoid sending duplicate rows
        // in the same INSERT statement (MySQL rejects batches with duplicate UNIQUE keys)
        const { sql } = await import('drizzle-orm');
        const seenHashes = new Set<string>();
        const dedupedRecords = flaggedRecords.filter(rec => {
          if (!rec.recordHash) return true; // No hash → let DB handle it
          if (seenHashes.has(rec.recordHash)) return false;
          seenHashes.add(rec.recordHash);
          return true;
        });
        for (let i = 0; i < dedupedRecords.length; i += 50) {
          const chunk = dedupedRecords.slice(i, i + 50);
          try {
            await database
              .insert(priceHistoryTable)
              .values(chunk)
              .onDuplicateKeyUpdate({ set: { isSuspectedBulk: sql`VALUES(isSuspectedBulk)`, recordHash: sql`VALUES(recordHash)` } });
          } catch (insertErr: any) {
            // If batch fails, fall back to individual inserts with no-op dedup
            for (const record of chunk) {
              try {
                await database
                  .insert(priceHistoryTable)
                  .values(record)
                  .onDuplicateKeyUpdate({ set: { isSuspectedBulk: sql`VALUES(isSuspectedBulk)`, recordHash: sql`VALUES(recordHash)` } });
              } catch (e) {
                // Skip silently
              }
            }
          }
        }      }
    }
    
    // Step 3: Update data source status (1 DB op)
    await db.updateDataSourceFetchStatus(product.dataSourceId, "success");

    return { success: true, productKey, apiResponseMs };
    
  } catch (error: any) {
    const isTimeout = error.isTimeout || 
                      error.code === 'ECONNABORTED' || 
                      error.message?.includes('timeout') || 
                      error.message?.includes('Timeout');
    
    return {
      success: false,
      productKey,
      isTimeout,
      apiResponseMs: 0,
      error: {
        cardId: product.id,
        cardName: product.name,
        error: error.message || String(error),
      },
    };
  }
}

/**
 * Save task metadata (compact format - no full key list)
 *
 * v7.1: Only stores processedCount, errors (last 50), and resumeCount.
 * v7.5: Also stores adaptive controller state (currentParallel, avgResponseMs, adjustmentLog).
 */
async function saveTaskMetadata(
  taskId: number,
  processedCount: number,
  errors: Array<{ cardId: number; cardName: string; error: string }>,
  resumeCount: number,
  adaptiveState?: { currentParallel: number; avgResponseMs: number; adjustmentLog: unknown[] },
): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;

    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq } = await import('drizzle-orm');

    const metadata: Record<string, unknown> = {
      errors: errors.slice(-50),
      processedCount,
      resumeCount,
    };
    if (adaptiveState) metadata.adaptive = adaptiveState;

    await database.update(scheduledTasks)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(scheduledTasks.id, taskId));
  } catch (e) {
    console.error(`[BatchUpdate] Failed to save metadata: ${(e as Error).message}`);
  }
}

/**
 * Core batch processing — v7.5 ADAPTIVE PARALLEL
 *
 * Processes products in groups using Promise.allSettled.
 * The group size (PARALLEL) is dynamically adjusted by AdaptiveParallelController
 * based on observed API response times.
 */
async function runControlledParallelProcessing(
  taskId: number,
  productsToUpdate: ProductInfo[],
  alreadyProcessedKeys: Set<string>,
  resumeCount: number,
): Promise<void> {
  const processedKeys = new Set(alreadyProcessedKeys);
  const errors: Array<{ cardId: number; cardName: string; error: string }> = [];
  let consecutiveErrors = 0;
  let consecutiveTimeouts = 0; // v8.1: track consecutive timeouts for backoff
  let successCount = 0;
  let failCount = 0;
  let pendingSuccessFlush = 0;
  let pendingFailFlush = 0;
  const startTime = Date.now();

  // ─── Adaptive controller ─────────────────────────────────────────────────────
  const adaptive = new AdaptiveParallelController(CONFIG.PARALLEL);

  // ─── KeepAlive Pinger (v8.2) ───────────────────────────────────────────────
  // Prevents Cloud Run from suspending the process due to idle timeout.
  const pinger = new KeepAlivePinger();
  pinger.start();

  // ─── Filter out already processed ────────────────────────────────────────────
  const remaining = productsToUpdate.filter(p => {
    const key = `${p.productType}:${p.id}`;
    return !processedKeys.has(key);
  });

  if (remaining.length === 0) {
    console.log(`[BatchUpdate] All products already processed, completing task`);
    await batchTaskManager.completeTask(taskId, 'completed');
    return;
  }

  console.log(`[BatchUpdate] v7.5 Adaptive Parallel (initial=${CONFIG.PARALLEL}, range=${CONFIG.ADAPTIVE_MIN_PARALLEL}-${CONFIG.ADAPTIVE_MAX_PARALLEL}): Processing ${remaining.length} products (${processedKeys.size} already done)`);

  // ─── Process in adaptive batches ──────────────────────────────────────
  let i = 0;
  let batchIndex = 0;
  while (i < remaining.length) {
    const currentParallel = adaptive.parallel;
    // Check pause/cancel every 20 products
    if (i % 20 === 0 && i > 0) {
      try {
        if (await batchTaskManager.isTaskCancelled(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} cancelled at ${i}/${remaining.length}`);
          break;
        }
        if (await batchTaskManager.isTaskPaused(taskId)) {
          console.log(`[BatchUpdate] Task ${taskId} paused at ${i}/${remaining.length}`);
          while (await batchTaskManager.isTaskPaused(taskId)) {
            await delay(3000);
          }
          console.log(`[BatchUpdate] Task ${taskId} resumed`);
        }
      } catch (e) {
        console.warn(`[BatchUpdate] Status check failed: ${(e as Error).message}`);
      }
    }
    
    // Get the current batch using adaptive.parallel
    const batch = remaining.slice(i, i + currentParallel);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(product => processSingleProduct(product))
    );

    // Feed response times into adaptive controller
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.apiResponseMs > 0) {
        adaptive.recordResponseTime(result.value.apiResponseMs);
      }
    }
    adaptive.onBatchComplete(batchIndex);
    batchIndex++;

    // Process results
    let batchHadError = false;
    let batchTimeouts = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        processedKeys.add(r.productKey);

        if (r.success) {
          successCount++;
          pendingSuccessFlush++;
          consecutiveErrors = 0;
          consecutiveTimeouts = 0; // v8.1: reset on success
        } else {
          failCount++;
          pendingFailFlush++;
          batchHadError = true;

          if (r.error) {
            errors.push(r.error);
          }

          // Only count non-timeout errors as consecutive
          if (!r.isTimeout) {
            consecutiveErrors++;
          } else {
            batchTimeouts++; // v8.1: count timeouts in this batch
          }
        }
      } else {
        // Promise itself rejected (shouldn't happen since processSingleProduct catches all)
        failCount++;
        pendingFailFlush++;
        batchHadError = true;
        consecutiveErrors++;
      }
    }

    // Advance index by the batch size used in this iteration
    i += currentParallel;

    // Flush progress to DB periodically
    if (pendingSuccessFlush >= CONFIG.PROGRESS_DB_INTERVAL) {
      await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
      pendingSuccessFlush = 0;
    }
    if (pendingFailFlush >= CONFIG.PROGRESS_DB_INTERVAL) {
      await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
      pendingFailFlush = 0;
    }

    // Log progress periodically
    const totalProcessed = successCount + failCount;
    if (totalProcessed % 100 === 0 && totalProcessed > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = totalProcessed / elapsed;
      const eta = speed > 0 ? (remaining.length - i) / speed : 0;
      console.log(`[BatchUpdate] Progress: ${i}/${remaining.length} | Success: ${successCount} | Fail: ${failCount} | Speed: ${speed.toFixed(1)}/s | ETA: ${Math.ceil(eta / 60)}min | P=${adaptive.parallel} avgApi=${adaptive.avgResponseMs}ms`);
    }

    // Save metadata periodically (v7.5: includes adaptive state)
    if (processedKeys.size % CONFIG.PROGRESS_SAVE_INTERVAL === 0) {
      await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount, adaptive.toMetadata());
    }

    // Stop if too many consecutive HTTP errors
    if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
      const errorMsg = `Auto-stopped: ${consecutiveErrors} consecutive HTTP errors. Last: ${errors[errors.length - 1]?.error || 'unknown'}`;
      console.error(`[BatchUpdate] ${errorMsg}`);

      // Flush remaining
      if (pendingSuccessFlush > 0) await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
      if (pendingFailFlush > 0) await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
      await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount, adaptive.toMetadata());
      // Record session time before stopping
      await batchTaskManager.addTaskActiveProcessingMs(taskId, Date.now() - startTime);
      pinger.stop(); // v8.2: stop keepalive on early exit

      try {
        const database = await db.getDb();
        if (database) {
          const { scheduledTasks } = await import('../drizzle/schema_new');
          const { eq } = await import('drizzle-orm');
          await database.update(scheduledTasks)
            .set({ errorMessage: errorMsg })
            .where(eq(scheduledTasks.id, taskId));
        }
      } catch (e) {}

      await batchTaskManager.completeTask(taskId, 'failed');
      return;
    }

    // v8.1: Consecutive timeout backoff
    // If all cards in this batch timed out, increment the consecutive timeout counter.
    // Once threshold is reached, drop to ADAPTIVE_MIN_PARALLEL and wait before resuming.
    // This handles the "cold start" problem: Cloud Run + SNKRDUNK rate-limit causes
    // the first N batches to all timeout, wasting hours at high parallelism.
    if (batchTimeouts === currentParallel && currentParallel > 0) {
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= CONFIG.CONSECUTIVE_TIMEOUT_THRESHOLD) {
        const prevParallel = adaptive.parallel;
        // Force parallel down to minimum via internal state
        // (AdaptiveParallelController doesn't have a forceSet, so we record a fake slow time)
        for (let t = 0; t < CONFIG.ADAPTIVE_WINDOW_SIZE; t++) {
          adaptive.recordResponseTime(CONFIG.REQUEST_TIMEOUT + 1000);
        }
        adaptive.onBatchComplete(batchIndex); // trigger re-evaluation
        console.log(`[BatchUpdate] ⚠️ Timeout backoff: ${consecutiveTimeouts} consecutive full-timeout batches. P: ${prevParallel} → ${adaptive.parallel}. Waiting ${CONFIG.TIMEOUT_BACKOFF_DELAY_MS / 1000}s...`);
        await delay(CONFIG.TIMEOUT_BACKOFF_DELAY_MS);
        consecutiveTimeouts = 0; // reset after backoff
      }
    } else if (batchTimeouts === 0) {
      consecutiveTimeouts = 0; // reset if no timeouts in this batch
    }

    // Delay between batches
    if (batchHadError) {
      await delay(CONFIG.DELAY_AFTER_ERROR);
    } else {
      await delay(CONFIG.DELAY_BETWEEN_BATCHES);
    }
  }
   // ─── Stop KeepAlive Pinger ───────────────────────────────────────────────────────────
  pinger.stop();

  // ─── Flush remaining progress ─────────────────────────────
  if (pendingSuccessFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(taskId, pendingSuccessFlush);
  }
  if (pendingFailFlush > 0) {
    await batchTaskManager.updateTaskProgressBulkFailure(taskId, pendingFailFlush);
  }
  await saveTaskMetadata(taskId, processedKeys.size, errors, resumeCount, adaptive.toMetadata());

  // ─── Record actual processing time for this session ──────────
  const sessionMs = Date.now() - startTime;
  await batchTaskManager.addTaskActiveProcessingMs(taskId, sessionMs);

  // ─── Complete ───────────────────────────────────────────────────────────
  const elapsed = sessionMs / 1000;
  const speed = (successCount + failCount) / elapsed;
  console.log(`[BatchUpdate] ✅ Completed: ${remaining.length} products in ${Math.ceil(elapsed / 60)} minutes (${speed.toFixed(1)}/s) | finalP=${adaptive.parallel} avgApi=${adaptive.avgResponseMs}ms`);
  console.log(`[BatchUpdate] Results: ${successCount} success, ${failCount} failed | Adaptive adjustments: ${adaptive.toMetadata().adjustmentLog.length}`);

  await batchTaskManager.completeTask(taskId, 'completed');
}

/**
 * Check if a SNKRDUNK batch update is currently running.
 * Used by priceUpdateScheduler to avoid triggering a new catch-up
 * when autoResumeOnStartup has already resumed an active task.
 */
export async function isSnkrdunkBatchUpdateRunning(): Promise<boolean> {
  return batchTaskManager.hasRunningTask('batch_snkrdunk_update');
}

/**
 * Execute SNKRDUNK batch update with persistent task tracking.
 */
export async function executePersistentSnkrdunkBatchUpdate(): Promise<{ taskId: number; totalCards: number; skippedCards: number }> {
  const hasRunning = await batchTaskManager.hasRunningTask('batch_snkrdunk_update');
  if (hasRunning) {
    throw new Error('SNKRDUNK 批量更新已在運行中');
  }

  const allProducts = await getAllSnkrdunkProducts();
  
  const now = new Date();
  const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
  const emptyCardSkipMs = CONFIG.EMPTY_CARD_RECHECK_DAYS * 24 * 60 * 60 * 1000;
  
  const productsToUpdate: ProductInfo[] = [];
  let skippedRecent = 0;
  let skippedEmpty = 0;
  
  for (const product of allProducts) {
    const age = product.lastFetchedAt ? now.getTime() - product.lastFetchedAt.getTime() : Infinity;
    
    // Skip recently updated cards (regardless of history)
    if (age < skipThreshold) {
      skippedRecent++;
      continue;
    }
    
    // v8.0 Smart Skip: Cards with no history are only re-checked every EMPTY_CARD_RECHECK_DAYS
    // This avoids wasting time on 83.9% of cards that always return empty
    if (!product.hasHistory && age < emptyCardSkipMs) {
      skippedEmpty++;
      continue;
    }
    
    productsToUpdate.push(product);
  }
  
  // Get recently viewed/searched card IDs for priority ordering (last 7 days)
  let recentCardIds: Set<number> = new Set();
  try {
    recentCardIds = await getRecentlyViewedCardIds(7);
    console.log(`[BatchUpdate] Found ${recentCardIds.size} recently viewed cards to prioritize`);
  } catch (err) {
    console.warn('[BatchUpdate] Failed to fetch recently viewed cards, using default order:', err);
  }

  // Sort: recently viewed first, then cards with history first, then oldest-updated first
  productsToUpdate.sort((a, b) => {
    const aRecent = recentCardIds.has(a.id);
    const bRecent = recentCardIds.has(b.id);
    // Priority tier 1: recently viewed cards come first
    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;
    // Priority tier 2: cards with history before empty cards
    if (a.hasHistory && !b.hasHistory) return -1;
    if (!a.hasHistory && b.hasHistory) return 1;
    // Priority tier 3: within same tier, oldest-updated comes first
    const aTime = a.lastFetchedAt?.getTime() || 0;
    const bTime = b.lastFetchedAt?.getTime() || 0;
    return aTime - bTime;
  });
  
  const historyCards = productsToUpdate.filter(p => p.hasHistory).length;
  const emptyCards = productsToUpdate.filter(p => !p.hasHistory).length;
  console.log(`[BatchUpdate] v8.0 Smart Skip: ${allProducts.length} total | skip(recent)=${skippedRecent} skip(empty7d)=${skippedEmpty} | processing=${productsToUpdate.length} (${historyCards} with history + ${emptyCards} empty to recheck)`);
  console.log(`[BatchUpdate] Priority: ${Math.min(recentCardIds.size, productsToUpdate.length)} recently viewed first`);

  const taskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', productsToUpdate.length);

  // Execute in background with global error handler
  (async () => {
    try {
      await runControlledParallelProcessing(taskId, productsToUpdate, new Set(), 0);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL: ${error.message}`);
      console.error(error.stack);
      
      try {
        const database = await db.getDb();
        if (database) {
          const { scheduledTasks } = await import('../drizzle/schema_new');
          const { eq } = await import('drizzle-orm');
          await database.update(scheduledTasks)
            .set({ 
              status: 'failed',
              completedAt: new Date(),
              errorMessage: `FATAL: ${error.message}` 
            })
            .where(eq(scheduledTasks.id, taskId));
        }
      } catch (dbErr) {
        console.error(`[BatchUpdate] Failed to mark task as failed: ${(dbErr as Error).message}`);
      }
    }
  })();

  return { taskId, totalCards: productsToUpdate.length, skippedCards: skippedRecent + skippedEmpty };
}

/**
 * Resume a failed/stalled task from its last progress.
 * 
 * v7.1: No longer relies on processedProductKeys from metadata.
 * Instead, uses SKIP_RECENTLY_UPDATED_HOURS to filter out already-updated products.
 * The task's processedItems count is used for progress reporting.
 */
export async function resumeFailedTask(taskId: number): Promise<{ taskId: number; totalCards: number; skippedCards: number; resumedFrom: number }> {
  const database = await db.getDb();
  if (!database) throw new Error('Database not available');
  
  const { scheduledTasks } = await import('../drizzle/schema_new');
  const { eq } = await import('drizzle-orm');
  
  const [task] = await database.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId)).limit(1);
  if (!task) throw new Error(`Task ${taskId} not found`);
  
  let resumeCount = 0;
  
  if (task.metadata) {
    try {
      const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
      resumeCount = (meta.resumeCount || 0) + 1;
    } catch (e) {}
  }
  
  // Use processedItems from the task record as the resume point
  const resumedFrom = task.processedItems || 0;
  
  // Get all products and filter by SKIP_RECENTLY_UPDATED_HOURS
  // Products that were already updated in this batch run will have recent lastFetchedAt
  const allProducts = await getAllSnkrdunkProducts();
  
  const now = new Date();
  const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
  
  const emptyCardSkipMs = CONFIG.EMPTY_CARD_RECHECK_DAYS * 24 * 60 * 60 * 1000;
  const productsToUpdate = allProducts.filter(p => {
    const age = p.lastFetchedAt ? now.getTime() - p.lastFetchedAt.getTime() : Infinity;
    if (age < skipThreshold) return false; // Skip recently updated
    if (!p.hasHistory && age < emptyCardSkipMs) return false; // v8.0 Smart Skip
    return true;
  });
  
  console.log(`[BatchUpdate] Manual resume of task ${taskId}: ${resumedFrom} already done (by processedItems), ${productsToUpdate.length} remaining (by lastFetchedAt filter)`);
  
  const newTaskId = await batchTaskManager.createBatchTask('batch_snkrdunk_update', allProducts.length);
  
  // Pre-fill progress for already-processed items
  const alreadyDone = allProducts.length - productsToUpdate.length;
  if (alreadyDone > 0) {
    await batchTaskManager.updateTaskProgressBulkSuccess(newTaskId, alreadyDone);
  }
  
  (async () => {
    try {
      await runControlledParallelProcessing(newTaskId, productsToUpdate, new Set(), resumeCount);
    } catch (error: any) {
      console.error(`[BatchUpdate] FATAL during manual resume: ${error.message}`);
      try {
        await batchTaskManager.completeTask(newTaskId, 'failed');
      } catch (e) {}
    }
  })();
  
  return { taskId: newTaskId, totalCards: productsToUpdate.length, skippedCards: alreadyDone, resumedFrom: alreadyDone };
}

/**
 * Auto-resume a stalled task on server startup.
 * 
 * v7.1: Uses SKIP_RECENTLY_UPDATED_HOURS to determine which products
 * still need processing, instead of relying on processedProductKeys metadata.
 */
export async function autoResumeOnStartup(): Promise<void> {
  try {
    const database = await db.getDb();
    if (!database) return;
    
    const { scheduledTasks } = await import('../drizzle/schema_new');
    const { eq, and, gt, or, desc } = await import('drizzle-orm');
    
    // Look back 24 hours for tasks that were interrupted (either still 'running' or
    // recently marked 'failed' by recoverStalledTasks on this startup).
    // recoverStalledTasks runs BEFORE autoResumeOnStartup, so a task that was
    // 'running' during the previous session is now 'failed' with completedAt set
    // to the current startup time. We detect those by checking completedAt within
    // the last 2 minutes AND the error message contains 'Auto-recovered'.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    
    // First priority: still-running tasks (rare but possible)
    const runningCandidates = await database
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasks.status, 'running'),
          gt(scheduledTasks.updatedAt, twentyFourHoursAgo),
        )
      )
      .orderBy(desc(scheduledTasks.updatedAt))
      .limit(1);
    
    // Second priority: tasks just marked failed by recoverStalledTasks (within last 2 min)
    const recentlyFailedCandidates = await database
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.taskType, 'batch_snkrdunk_update'),
          eq(scheduledTasks.status, 'failed'),
          gt(scheduledTasks.completedAt, twoMinutesAgo),
          gt(scheduledTasks.processedItems, 0), // must have made some progress
        )
      )
      .orderBy(desc(scheduledTasks.completedAt))
      .limit(1);
    
    const candidates = runningCandidates.length > 0 ? runningCandidates : recentlyFailedCandidates;
    
    if (candidates.length === 0) {
      console.log('[BatchUpdate] No eligible tasks for auto-resume');
      return;
    }
    
    const task = candidates[0];
    
    let resumeCount = 0;
    
    if (task.metadata) {
      try {
        const meta = typeof task.metadata === 'string' ? JSON.parse(task.metadata) : task.metadata;
        resumeCount = (meta.resumeCount || 0) + 1;
      } catch (e) {}
    }
    
    if (resumeCount > CONFIG.MAX_AUTO_RESUME_ATTEMPTS) {
      console.log(`[BatchUpdate] Task ${task.id} exceeded max resume attempts (${resumeCount}), marking as failed permanently`);
      // Don't call completeTask again if already failed
      if (task.status !== 'failed') {
        await batchTaskManager.completeTask(task.id, 'failed');
      }
      return;
    }
    
    // If the task was marked 'failed' by recoverStalledTasks, reset it to 'running'
    // so runControlledParallelProcessing can update its progress normally.
    if (task.status === 'failed') {
      await database
        .update(scheduledTasks)
        .set({ status: 'running', completedAt: null, errorMessage: null, updatedAt: new Date() })
        .where(eq(scheduledTasks.id, task.id));
      console.log(`[BatchUpdate] Reset task ${task.id} from failed → running for auto-resume`);
    }
    
    // Use SKIP_RECENTLY_UPDATED_HOURS to determine remaining products
    const allProducts = await getAllSnkrdunkProducts();
    const now = new Date();
    const skipThreshold = CONFIG.SKIP_RECENTLY_UPDATED_HOURS * 60 * 60 * 1000;
    
    const emptyCardSkipMs = CONFIG.EMPTY_CARD_RECHECK_DAYS * 24 * 60 * 60 * 1000;
    const remainingProducts = allProducts.filter(p => {
      const age = p.lastFetchedAt ? now.getTime() - p.lastFetchedAt.getTime() : Infinity;
      if (age < skipThreshold) return false;
      if (!p.hasHistory && age < emptyCardSkipMs) return false; // v8.0 Smart Skip
      return true;
    });
    
    const alreadyDone = allProducts.length - remainingProducts.length;
    
    if (remainingProducts.length === 0) {
      console.log(`[BatchUpdate] Task ${task.id} has no remaining products to process (all ${alreadyDone} already updated within ${CONFIG.SKIP_RECENTLY_UPDATED_HOURS}h), marking as completed`);
      await batchTaskManager.completeTask(task.id, 'completed');
      return;
    }
    
    console.log(`[BatchUpdate] Auto-resuming task ${task.id} (${alreadyDone} already done by lastFetchedAt, ${remainingProducts.length} remaining, resume #${resumeCount})`);
    
    (async () => {
      try {
        await runControlledParallelProcessing(task.id, remainingProducts, new Set(), resumeCount);
      } catch (error: any) {
        console.error(`[BatchUpdate] FATAL during resume: ${error.message}`);
        try {
          await batchTaskManager.completeTask(task.id, 'failed');
        } catch (e) {}
      }
    })();
  } catch (error) {
    console.error('[BatchUpdate] Auto-resume check failed:', error);
  }
}
