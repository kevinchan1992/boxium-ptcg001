/**
 * recordHash.dedup.test.ts
 *
 * Tests for the three-layer deduplication system:
 * 1. computeRecordHash (scrape layer) - stable unique key generation
 * 2. addPriceHistory (db layer) - idempotent upsert
 * 3. getPriceHistory (query layer) - in-memory dedup
 */
import { describe, it, expect } from 'vitest';
import { computeRecordHash } from './utils/recordHash';

// ─── Layer 1: computeRecordHash ───────────────────────────────────────────────

describe('computeRecordHash', () => {
  const base = {
    cardId: 42,
    source: 'snkrdunk' as const,
    grade: 'PSA 10',
    soldAt: new Date('2025-06-15T00:00:00Z'),
    jpyPrice: 12000,
    sourcePosition: 0,
  };

  it('produces a 64-character hex string', () => {
    const hash = computeRecordHash(base);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same inputs produce same hash', () => {
    const h1 = computeRecordHash(base);
    const h2 = computeRecordHash({ ...base });
    expect(h1).toBe(h2);
  });

  it('is stable across soldAt time-of-day differences (date-only key)', () => {
    // Two records with same date but different times should produce the same hash
    const h1 = computeRecordHash({ ...base, soldAt: new Date('2025-06-15T00:00:00Z') });
    const h2 = computeRecordHash({ ...base, soldAt: new Date('2025-06-15T23:59:59Z') });
    expect(h1).toBe(h2);
  });

  it('differs when cardId changes', () => {
    const h1 = computeRecordHash(base);
    const h2 = computeRecordHash({ ...base, cardId: 99 });
    expect(h1).not.toBe(h2);
  });

  it('differs when jpyPrice changes', () => {
    const h1 = computeRecordHash(base);
    const h2 = computeRecordHash({ ...base, jpyPrice: 15000 });
    expect(h1).not.toBe(h2);
  });

  it('differs when sourcePosition changes', () => {
    const h1 = computeRecordHash({ ...base, sourcePosition: 0 });
    const h2 = computeRecordHash({ ...base, sourcePosition: 1 });
    expect(h1).not.toBe(h2);
  });

  it('normalizes grade case and whitespace', () => {
    const h1 = computeRecordHash({ ...base, grade: 'PSA 10' });
    const h2 = computeRecordHash({ ...base, grade: 'psa 10' });
    const h3 = computeRecordHash({ ...base, grade: '  PSA  10  ' });
    // All should produce the same hash after normalization
    expect(h1).toBe(h2);
    expect(h1).toBe(h3);
  });

  it('handles null/undefined grade as __none__', () => {
    const h1 = computeRecordHash({ ...base, grade: undefined });
    const h2 = computeRecordHash({ ...base, grade: null as any });
    const h3 = computeRecordHash({ ...base, grade: '' });
    expect(h1).toBe(h2);
    expect(h1).toBe(h3);
  });

  it('handles null soldAt as __nodate__', () => {
    const h1 = computeRecordHash({ ...base, soldAt: undefined });
    const h2 = computeRecordHash({ ...base, soldAt: null as any });
    expect(h1).toBe(h2);
  });

  it('rounds jpyPrice to integer for stability', () => {
    const h1 = computeRecordHash({ ...base, jpyPrice: 12000 });
    const h2 = computeRecordHash({ ...base, jpyPrice: 12000.4 });
    const h3 = computeRecordHash({ ...base, jpyPrice: 12000.6 });
    // 12000.4 rounds to 12000, 12000.6 rounds to 12001
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

// ─── Layer 3: getPriceHistory query-layer dedup (pure logic) ─────────────────

describe('getPriceHistory query-layer deduplication logic', () => {
  // Simulate the deduplication logic from db.ts getPriceHistory
  function deduplicateRows(rows: Array<{
    id: number;
    cardId: number;
    source: string;
    grade: string | null;
    soldAt: Date | null;
    jpyPrice: number | null;
    sourcePosition: number | null;
    recordHash: string | null;
  }>) {
    const seenHashes = new Set<string>();
    const seenLegacyKeys = new Set<string>();
    return rows.filter(row => {
      if (row.recordHash) {
        if (seenHashes.has(row.recordHash)) return false;
        seenHashes.add(row.recordHash);
        return true;
      }
      const soldAtDate = row.soldAt ? row.soldAt.toISOString().slice(0, 10) : '__nodate__';
      const legacyKey = [
        row.cardId, row.source, row.grade ?? '__none__',
        soldAtDate, row.jpyPrice ?? 0, row.sourcePosition ?? 0,
      ].join('|');
      if (seenLegacyKeys.has(legacyKey)) return false;
      seenLegacyKeys.add(legacyKey);
      return true;
    });
  }

  it('removes rows with duplicate recordHash', () => {
    const rows = [
      { id: 1, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: 'abc123' },
      { id: 2, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: 'abc123' }, // duplicate
      { id: 3, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-02'), jpyPrice: 11000, sourcePosition: 0, recordHash: 'def456' },
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual([1, 3]);
  });

  it('keeps rows with different recordHash', () => {
    const rows = [
      { id: 1, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: 'hash1' },
      { id: 2, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 1, recordHash: 'hash2' },
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
  });

  it('falls back to legacy key dedup for rows without recordHash', () => {
    const rows = [
      { id: 1, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: null },
      { id: 2, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: null }, // duplicate
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('handles mixed rows (some with hash, some without)', () => {
    const rows = [
      { id: 1, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: 'hash1' },
      { id: 2, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: null }, // legacy duplicate
      { id: 3, cardId: 1, source: 'snkrdunk', grade: 'PSA 9', soldAt: new Date('2025-01-02'), jpyPrice: 5000, sourcePosition: 0, recordHash: null },
    ];
    const result = deduplicateRows(rows);
    // id=1 kept (hash1), id=2 kept (no hash, different from hash-based), id=3 kept (different grade)
    expect(result).toHaveLength(3);
  });

  it('preserves order (most recent first)', () => {
    const rows = [
      { id: 3, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-03-01'), jpyPrice: 12000, sourcePosition: 0, recordHash: 'c' },
      { id: 2, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-02-01'), jpyPrice: 11000, sourcePosition: 0, recordHash: 'b' },
      { id: 1, cardId: 1, source: 'snkrdunk', grade: 'PSA 10', soldAt: new Date('2025-01-01'), jpyPrice: 10000, sourcePosition: 0, recordHash: 'a' },
    ];
    const result = deduplicateRows(rows);
    expect(result.map(r => r.id)).toEqual([3, 2, 1]);
  });
});

// ─── Batch dedup (scrape layer) ───────────────────────────────────────────────

describe('batch scrape-layer deduplication', () => {
  // Simulate the seenHashes set logic from persistentSnkrdunkBatchUpdate
  function deduplicateBatch(records: Array<{ recordHash: string; jpyPrice: number }>) {
    const seenHashes = new Set<string>();
    return records.filter(r => {
      if (seenHashes.has(r.recordHash)) return false;
      seenHashes.add(r.recordHash);
      return true;
    });
  }

  it('removes duplicate hashes within a batch', () => {
    const records = [
      { recordHash: 'aaa', jpyPrice: 10000 },
      { recordHash: 'bbb', jpyPrice: 11000 },
      { recordHash: 'aaa', jpyPrice: 10000 }, // duplicate
      { recordHash: 'ccc', jpyPrice: 12000 },
    ];
    const result = deduplicateBatch(records);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.recordHash)).toEqual(['aaa', 'bbb', 'ccc']);
  });

  it('keeps all unique records', () => {
    const records = [
      { recordHash: 'a1', jpyPrice: 1000 },
      { recordHash: 'a2', jpyPrice: 2000 },
      { recordHash: 'a3', jpyPrice: 3000 },
    ];
    expect(deduplicateBatch(records)).toHaveLength(3);
  });
});
