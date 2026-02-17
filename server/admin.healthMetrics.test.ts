import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Admin Health Metrics API', () => {
  it('should return health metrics for data sources', async () => {
    const metrics = await db.getDataSourceHealthMetrics();

    // Should return an array with 2 items (SNKRDUNK and eBay)
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics).toHaveLength(2);

    // Check SNKRDUNK metrics
    const snkrdunk = metrics.find(m => m.source === 'snkrdunk');
    expect(snkrdunk).toBeDefined();
    expect(snkrdunk).toHaveProperty('status');
    expect(snkrdunk).toHaveProperty('lastUpdatedAt');
    expect(snkrdunk).toHaveProperty('activeSourcesCount');
    expect(snkrdunk).toHaveProperty('recentRecordsCount');
    expect(snkrdunk).toHaveProperty('totalRecordsCount');
    expect(['healthy', 'degraded', 'down']).toContain(snkrdunk?.status);

    // Check eBay metrics
    const ebay = metrics.find(m => m.source === 'ebay');
    expect(ebay).toBeDefined();
    expect(ebay).toHaveProperty('status');
    expect(ebay).toHaveProperty('lastUpdatedAt');
    expect(ebay).toHaveProperty('activeSourcesCount');
    expect(ebay).toHaveProperty('recentRecordsCount');
    expect(ebay).toHaveProperty('totalRecordsCount');
    expect(['healthy', 'degraded', 'down']).toContain(ebay?.status);
  });

  it('should calculate correct health status based on lastUpdatedAt', async () => {
    const metrics = await db.getDataSourceHealthMetrics();

    for (const metric of metrics) {
      if (!metric.lastUpdatedAt) {
        // If never updated, status should be 'down'
        expect(metric.status).toBe('down');
      } else {
        const now = new Date();
        const lastUpdate = new Date(metric.lastUpdatedAt);
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate < 24) {
          expect(metric.status).toBe('healthy');
        } else if (hoursSinceUpdate < 72) {
          expect(metric.status).toBe('degraded');
        } else {
          expect(metric.status).toBe('down');
        }
      }
    }
  });

  it('should return non-negative counts', async () => {
    const metrics = await db.getDataSourceHealthMetrics();

    for (const metric of metrics) {
      expect(metric.activeSourcesCount).toBeGreaterThanOrEqual(0);
      expect(metric.recentRecordsCount).toBeGreaterThanOrEqual(0);
      expect(metric.totalRecordsCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have recentRecordsCount <= totalRecordsCount', async () => {
    const metrics = await db.getDataSourceHealthMetrics();

    for (const metric of metrics) {
      expect(metric.recentRecordsCount).toBeLessThanOrEqual(metric.totalRecordsCount);
    }
  });
});
