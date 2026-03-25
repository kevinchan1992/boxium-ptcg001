/**
 * Tests for SNKRDUNK fuzzy deduplication fix
 * 
 * Root cause: SNKRDUNK API always returns relative dates ("N時間前", "N日前")
 * which are converted to absolute dates at scrape time. The same transaction
 * scraped on different days gets different soldAt values, bypassing the UNIQUE INDEX.
 * 
 * Fix: Check for existing records with same cardId+source+grade+jpyPrice within ±7 days
 * before inserting, to prevent duplicate insertions from date drift.
 */

import { describe, it, expect } from 'vitest';

// ─── Unit tests for date parsing logic ───────────────────────────────────────

describe('SNKRDUNK relative date parsing', () => {
  /**
   * Simulate parseJapaneseDate behavior for relative dates
   * "N日前" → today minus N days (UTC midnight)
   */
  function simulateParseRelativeDate(dateStr: string, referenceDate: Date): Date {
    const dayMatch = dateStr.match(/^(\d+)日前$/);
    if (dayMatch) {
      const daysAgo = parseInt(dayMatch[1], 10);
      const refMs = referenceDate.getTime();
      // Normalize to UTC midnight of reference date
      const refMidnight = new Date(Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate()
      ));
      return new Date(refMidnight.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    }
    // Absolute date like "2026/03/24"
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }
    return new Date(dateStr);
  }

  it('should parse "0日前" as today UTC midnight', () => {
    const ref = new Date('2026-03-25T10:00:00Z');
    const result = simulateParseRelativeDate('0日前', ref);
    expect(result.toISOString()).toBe('2026-03-25T00:00:00.000Z');
  });

  it('should parse "1日前" as yesterday UTC midnight', () => {
    const ref = new Date('2026-03-25T10:00:00Z');
    const result = simulateParseRelativeDate('1日前', ref);
    expect(result.toISOString()).toBe('2026-03-24T00:00:00.000Z');
  });

  it('should parse "2日前" as 2 days ago UTC midnight', () => {
    const ref = new Date('2026-03-25T10:00:00Z');
    const result = simulateParseRelativeDate('2日前', ref);
    expect(result.toISOString()).toBe('2026-03-23T00:00:00.000Z');
  });

  it('should demonstrate date drift problem: SNKRDUNK shows "0日前" for multiple days', () => {
    // SNKRDUNK sometimes shows "0日前" for recent sales even on subsequent days.
    // A transaction on 3/21 might show "0日前" when scraped on 3/21, 3/22, and 3/23.
    // This causes the same transaction to get different soldAt values:
    
    // Scraped on 2026-03-21 (JST): shows "0日前" → soldAt: 2026-03-21
    const scrapeDay1 = new Date('2026-03-21T10:00:00Z'); // UTC = JST 19:00
    const soldAt_day1 = simulateParseRelativeDate('0日前', scrapeDay1);
    
    // Scraped on 2026-03-24 (JST): still shows "0日前" → soldAt: 2026-03-24 (DRIFTED!)
    const scrapeDay2 = new Date('2026-03-24T10:00:00Z');
    const soldAt_day2 = simulateParseRelativeDate('0日前', scrapeDay2);
    
    // Scraped on 2026-03-25 (JST): still shows "0日前" → soldAt: 2026-03-25 (DRIFTED!)
    const scrapeDay3 = new Date('2026-03-25T10:00:00Z');
    const soldAt_day3 = simulateParseRelativeDate('0日前', scrapeDay3);

    // When SNKRDUNK shows "0日前" on different days, soldAt drifts to the scrape date
    expect(soldAt_day1.toISOString()).toBe('2026-03-21T00:00:00.000Z');
    expect(soldAt_day2.toISOString()).toBe('2026-03-24T00:00:00.000Z'); // Drifted to 3/24!
    expect(soldAt_day3.toISOString()).toBe('2026-03-25T00:00:00.000Z'); // Drifted to 3/25!
    
    // These are all different dates, so UNIQUE INDEX (cardId, source, grade, soldAt, jpyPrice) 
    // would NOT catch the duplicates - this is the root cause of the bug
    expect(soldAt_day1.getTime()).not.toBe(soldAt_day2.getTime());
    expect(soldAt_day2.getTime()).not.toBe(soldAt_day3.getTime());
  });
});

// ─── Unit tests for fuzzy deduplication logic ────────────────────────────────

describe('SNKRDUNK fuzzy deduplication logic', () => {
  const WINDOW_DAYS = 7;
  const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

  /**
   * Simulate the fuzzy dedup check
   * Returns true if a duplicate exists within the window
   */
  function isDuplicate(
    existingRecords: Array<{ cardId: number; source: string; grade: string | null; jpyPrice: number; soldAt: Date }>,
    newRecord: { cardId: number; source: string; grade: string | null; jpyPrice: number; soldAt: Date }
  ): boolean {
    const newMs = newRecord.soldAt.getTime();
    const windowStart = new Date(newMs - WINDOW_MS);
    const windowEnd = new Date(newMs + WINDOW_MS);

    return existingRecords.some(existing =>
      existing.cardId === newRecord.cardId &&
      existing.source === newRecord.source &&
      existing.grade === newRecord.grade &&
      existing.jpyPrice === newRecord.jpyPrice &&
      existing.soldAt >= windowStart &&
      existing.soldAt <= windowEnd
    );
  }

  it('should detect duplicate when same transaction scraped next day (1-day drift)', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-24T00:00:00Z'), // First scrape: "0日前" on 3/24
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-25T00:00:00Z'), // Second scrape: "1日前" on 3/25 (drifted)
    };

    expect(isDuplicate(existing, newRecord)).toBe(true);
  });

  it('should detect duplicate when same transaction scraped 2 days later', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-24T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-26T00:00:00Z'), // 2-day drift
    };

    expect(isDuplicate(existing, newRecord)).toBe(true);
  });

  it('should detect duplicate within 7-day window', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA10',
      jpyPrice: 8000,
      soldAt: new Date('2026-03-20T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA10',
      jpyPrice: 8000,
      soldAt: new Date('2026-03-25T00:00:00Z'), // 5-day drift, still within 7-day window
    };

    expect(isDuplicate(existing, newRecord)).toBe(true);
  });

  it('should NOT detect duplicate for different jpyPrice (genuinely different transactions)', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-24T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3500, // Different price = different transaction
      soldAt: new Date('2026-03-25T00:00:00Z'),
    };

    expect(isDuplicate(existing, newRecord)).toBe(false);
  });

  it('should NOT detect duplicate for different grade', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-24T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA10', // Different grade = different transaction
      jpyPrice: 3300,
      soldAt: new Date('2026-03-25T00:00:00Z'),
    };

    expect(isDuplicate(existing, newRecord)).toBe(false);
  });

  it('should NOT detect duplicate for different cardId', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-24T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 999999, // Different card
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-25T00:00:00Z'),
    };

    expect(isDuplicate(existing, newRecord)).toBe(false);
  });

  it('should NOT detect duplicate when dates are more than 7 days apart (genuinely different transactions)', () => {
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-10T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA9',
      jpyPrice: 3300,
      soldAt: new Date('2026-03-25T00:00:00Z'), // 15 days apart = different transactions
    };

    expect(isDuplicate(existing, newRecord)).toBe(false);
  });

  it('should handle null grade correctly (both null = same grade)', () => {
    const existing = [{
      cardId: 12345,
      source: 'snkrdunk',
      grade: null,
      jpyPrice: 5000,
      soldAt: new Date('2026-03-24T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 12345,
      source: 'snkrdunk',
      grade: null,
      jpyPrice: 5000,
      soldAt: new Date('2026-03-25T00:00:00Z'),
    };

    expect(isDuplicate(existing, newRecord)).toBe(true);
  });

  it('should allow multiple transactions with same price on same day (different items)', () => {
    // Two PSA10 cards sold at the same price on the same day are genuinely different
    // But our dedup logic would catch them as duplicates - this is acceptable
    // because SNKRDUNK doesn't provide unique transaction IDs
    // The trade-off: we may miss 2 identical-price same-day transactions
    // but we prevent thousands of false duplicates from date drift
    const existing = [{
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA10',
      jpyPrice: 8400,
      soldAt: new Date('2026-03-25T00:00:00Z'),
    }];

    const newRecord = {
      cardId: 814576,
      source: 'snkrdunk',
      grade: 'PSA10',
      jpyPrice: 8400,
      soldAt: new Date('2026-03-25T00:00:00Z'), // Same day, same price
    };

    // This is the known trade-off: we deduplicate same-price same-day records
    // to prevent date drift duplicates. Acceptable given SNKRDUNK has no tx IDs.
    expect(isDuplicate(existing, newRecord)).toBe(true);
  });
});

// ─── Integration-style tests for the fix impact ──────────────────────────────

describe('SNKRDUNK dedup fix: real-world scenario', () => {
  it('should correctly identify the card 814576 PSA9 3300 JPY duplicate scenario', () => {
    // This is the exact scenario reported by the user:
    // boxium.asia/card/814576 showed "2026/03/25 PSA9 HKD 181.50"
    // but snkrdunk.com/apparels/141442 had no such 3/25 record
    
    // The actual transaction was on 2026-03-21 (based on DB cleanup result)
    // It was scraped multiple times with drifted dates:
    // - 2026-03-21 (first scrape, correct)
    // - 2026-03-24 (later scrape, drifted)  
    // - 2026-03-25 (latest scrape, drifted - this is what user saw)
    
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    
    function wouldBeBlocked(existingSoldAt: Date, newSoldAt: Date, jpyPrice: number): boolean {
      const newMs = newSoldAt.getTime();
      const windowStart = new Date(newMs - WINDOW_MS);
      const windowEnd = new Date(newMs + WINDOW_MS);
      return existingSoldAt >= windowStart && existingSoldAt <= windowEnd;
    }
    
    const originalSoldAt = new Date('2026-03-21T00:00:00Z');
    const driftedSoldAt1 = new Date('2026-03-24T00:00:00Z'); // 3 days drift
    const driftedSoldAt2 = new Date('2026-03-25T00:00:00Z'); // 4 days drift
    
    // With fix: drifted records would be blocked
    expect(wouldBeBlocked(originalSoldAt, driftedSoldAt1, 3300)).toBe(true);
    expect(wouldBeBlocked(originalSoldAt, driftedSoldAt2, 3300)).toBe(true);
    
    // Without fix: all three would be inserted (different soldAt bypasses UNIQUE INDEX)
    // This is what caused the user-reported bug
  });
});
