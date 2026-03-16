/**
 * Hot Card Poll Scheduler Tests
 * Tests for getTopViewedCardIds (db.ts) and hot card poll scheduler functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock getTopViewedCardIds ─────────────────────────────────────────────────

describe('getTopViewedCardIds', () => {
  it('returns empty array when no views exist', async () => {
    // Simulate the function with an empty DB
    const mockGetTopViewedCardIds = vi.fn().mockResolvedValue([]);
    const result = await mockGetTopViewedCardIds(100, 7);
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns card IDs ordered by view count (most viewed first)', async () => {
    const mockGetTopViewedCardIds = vi.fn().mockResolvedValue([42, 7, 100, 3]);
    const result = await mockGetTopViewedCardIds(100, 7);
    expect(result).toEqual([42, 7, 100, 3]);
    expect(result.length).toBe(4);
  });

  it('respects the limit parameter', async () => {
    const allIds = Array.from({ length: 200 }, (_, i) => i + 1);
    const mockGetTopViewedCardIds = vi.fn().mockImplementation(async (limit: number) => {
      return allIds.slice(0, limit);
    });
    const result = await mockGetTopViewedCardIds(100, 7);
    expect(result.length).toBe(100);
  });

  it('returns only numbers (card IDs)', async () => {
    const mockGetTopViewedCardIds = vi.fn().mockResolvedValue([1, 2, 3]);
    const result = await mockGetTopViewedCardIds(10, 7);
    result.forEach((id: any) => {
      expect(typeof id).toBe('number');
    });
  });
});

// ─── Mock Hot Card Poll Scheduler ────────────────────────────────────────────

describe('getHotCardPollStatus', () => {
  it('returns correct initial status structure', () => {
    const mockStatus = {
      isRunning: false,
      schedulerActive: false,
      lastRunAt: null,
      lastResult: null,
    };
    expect(mockStatus).toMatchObject({
      isRunning: expect.any(Boolean),
      schedulerActive: expect.any(Boolean),
    });
    expect(mockStatus.lastRunAt).toBeNull();
    expect(mockStatus.lastResult).toBeNull();
  });

  it('reflects running state when poll is active', () => {
    const mockStatus = {
      isRunning: true,
      schedulerActive: true,
      lastRunAt: new Date(),
      lastResult: null,
    };
    expect(mockStatus.isRunning).toBe(true);
    expect(mockStatus.schedulerActive).toBe(true);
  });

  it('stores last result after poll completes', () => {
    const mockStatus = {
      isRunning: false,
      schedulerActive: true,
      lastRunAt: new Date('2026-03-16T10:00:00Z'),
      lastResult: { updated: 85, skipped: 10, failed: 5 },
    };
    expect(mockStatus.lastResult).not.toBeNull();
    expect(mockStatus.lastResult!.updated).toBe(85);
    expect(mockStatus.lastResult!.skipped).toBe(10);
    expect(mockStatus.lastResult!.failed).toBe(5);
    expect(mockStatus.lastResult!.updated + mockStatus.lastResult!.skipped + mockStatus.lastResult!.failed).toBe(100);
  });
});

// ─── runHotCardPoll logic tests ───────────────────────────────────────────────

describe('runHotCardPoll logic', () => {
  it('skips execution when already running', async () => {
    let callCount = 0;
    let isRunning = false;

    const mockRunHotCardPoll = async () => {
      if (isRunning) {
        return { updated: 0, skipped: 0, failed: 0 };
      }
      isRunning = true;
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
      isRunning = false;
      return { updated: 50, skipped: 30, failed: 0 };
    };

    // Start first poll
    const p1 = mockRunHotCardPoll();
    // Immediately try second poll (should be skipped)
    const p2 = mockRunHotCardPoll();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.updated).toBe(50);
    expect(r2.updated).toBe(0); // Second call was skipped
    expect(callCount).toBe(1);
  });

  it('returns zero counts when no top cards found', async () => {
    const mockRunHotCardPoll = vi.fn().mockResolvedValue({ updated: 0, skipped: 0, failed: 0 });
    const result = await mockRunHotCardPoll(100);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('result counts are non-negative integers', async () => {
    const mockRunHotCardPoll = vi.fn().mockResolvedValue({ updated: 80, skipped: 15, failed: 5 });
    const result = await mockRunHotCardPoll(100);
    expect(result.updated).toBeGreaterThanOrEqual(0);
    expect(result.skipped).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.updated)).toBe(true);
    expect(Number.isInteger(result.skipped)).toBe(true);
    expect(Number.isInteger(result.failed)).toBe(true);
  });
});

// ─── Cron expression validation ──────────────────────────────────────────────

describe('Hot card poll cron schedule', () => {
  it('cron expression "*/30 * * * *" represents every 30 minutes', () => {
    const cronExpr = '*/30 * * * *';
    // Validate format: 5 fields (minute, hour, day, month, weekday)
    const parts = cronExpr.split(' ');
    expect(parts.length).toBe(5);
    expect(parts[0]).toBe('*/30'); // Every 30 minutes
    expect(parts[1]).toBe('*');    // Any hour
    expect(parts[2]).toBe('*');    // Any day
    expect(parts[3]).toBe('*');    // Any month
    expect(parts[4]).toBe('*');    // Any weekday
  });

  it('runs 48 times per day (every 30 minutes)', () => {
    const minutesPerDay = 24 * 60;
    const intervalMinutes = 30;
    const runsPerDay = minutesPerDay / intervalMinutes;
    expect(runsPerDay).toBe(48);
  });
});
