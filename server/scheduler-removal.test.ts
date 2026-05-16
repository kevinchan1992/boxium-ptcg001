/**
 * Scheduler Removal Tests
 * Verifies that HotCardPoll, CachePreloader, and WeeklyBlogReport schedulers
 * are removed from server startup, and initPriceUpdateScheduler uses single slot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indexPath = resolve(__dirname, '_core/index.ts');
const routersPath = resolve(__dirname, 'routers.ts');
const adminUIPath = resolve(__dirname, '../client/src/components/AdminScheduleManagement.tsx');
const schedulerPath = resolve(__dirname, 'priceUpdateScheduler.ts');

describe('Scheduler Removal - server/_core/index.ts', () => {
  const indexContent = readFileSync(indexPath, 'utf-8');

  it('should NOT contain startHotCardPollScheduler call', () => {
    expect(indexContent).not.toContain('startHotCardPollScheduler');
  });

  it('should NOT contain weeklyBlogScheduler import', () => {
    expect(indexContent).not.toContain("import('../weeklyBlogScheduler')");
  });

  it('should NOT contain startWeeklyBlogReportScheduler call', () => {
    expect(indexContent).not.toContain('startWeeklyBlogReportScheduler');
  });

  it('should NOT contain cachePreloader import or startCachePreloader call', () => {
    expect(indexContent).not.toContain('startCachePreloader');
    expect(indexContent).not.toContain("cachePreloader");
  });

  it('should still contain initPriceUpdateScheduler call', () => {
    expect(indexContent).toContain('initPriceUpdateScheduler');
  });

  it('should still contain startTrendingCardsScheduler call', () => {
    expect(indexContent).toContain('startTrendingCardsScheduler');
  });
});

describe('Scheduler Removal - server/routers.ts', () => {
  const routersContent = readFileSync(routersPath, 'utf-8');

  it('should NOT contain triggerHotCardPoll procedure', () => {
    expect(routersContent).not.toContain('triggerHotCardPoll');
  });

  it('should NOT contain getHotCardPollStatus import', () => {
    expect(routersContent).not.toContain('getHotCardPollStatus');
  });

  it('should NOT contain hotCardPollSchedulerRunning field', () => {
    expect(routersContent).not.toContain('hotCardPollSchedulerRunning');
  });

  it('should NOT contain snkrdunkScheduler2Running field', () => {
    expect(routersContent).not.toContain('snkrdunkScheduler2Running');
  });

  it('should NOT contain snkrdunkUpdateTime2 in input schema', () => {
    expect(routersContent).not.toContain('snkrdunkUpdateTime2');
  });

  it('should still contain getPriceUpdateSchedule procedure', () => {
    expect(routersContent).toContain('getPriceUpdateSchedule');
  });

  it('should still contain snkrdunkSchedulerRunning field', () => {
    expect(routersContent).toContain('snkrdunkSchedulerRunning');
  });
});

describe('Scheduler Removal - AdminScheduleManagement.tsx', () => {
  const uiContent = readFileSync(adminUIPath, 'utf-8');

  it('should NOT contain triggerHotCardPoll mutation', () => {
    expect(uiContent).not.toContain('triggerHotCardPoll');
  });

  it('should NOT contain hotCardPoll references', () => {
    expect(uiContent).not.toContain('hotCardPoll');
  });

  it('should NOT contain snkrdunkTime2 state', () => {
    expect(uiContent).not.toContain('snkrdunkTime2');
  });

  it('should NOT contain snkrdunkUpdateTime2 reference', () => {
    expect(uiContent).not.toContain('snkrdunkUpdateTime2');
  });

  it('should contain single time slot UI text', () => {
    expect(uiContent).toContain('每日更新時間（香港時間）');
    expect(uiContent).toContain('每日執行一次');
  });

  it('should default to 02:00', () => {
    expect(uiContent).toContain('"02:00"');
  });
});

describe('initPriceUpdateScheduler - single slot at 02:00', () => {
  const schedulerContent = readFileSync(schedulerPath, 'utf-8');

  it('should NOT start second scheduler slot', () => {
    // The old code had: if (config.snkrdunkUpdateTime2) { startSnkrdunkScheduler(config.snkrdunkUpdateTime2, 2); }
    expect(schedulerContent).not.toContain('startSnkrdunkScheduler(config.snkrdunkUpdateTime2');
  });

  it('should use default 02:00 in initPriceUpdateScheduler', () => {
    expect(schedulerContent).toContain("|| '02:00'");
  });

  it('should have comment about fixed daily schedule', () => {
    expect(schedulerContent).toContain('Fixed daily schedule');
  });
});
