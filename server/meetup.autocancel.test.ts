import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all dynamic imports used by runMeetupAutoCancel ─────────────────────

const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockSelectWhere = vi.fn().mockResolvedValue([]);

const mockDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
  select: () => ({ from: () => ({ where: mockSelectWhere }) }),
};

vi.mock('./db', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  getSystemSetting: vi.fn().mockRejectedValue(new Error('no setting')),
  getSellerProfileById: vi.fn().mockResolvedValue(null),
  restoreListingStock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../drizzle/schema_new', () => ({
  marketplaceOrders: { id: 'id', orderNo: 'orderNo', buyerId: 'buyerId', sellerId: 'sellerId', listingId: 'listingId', orderStatus: 'orderStatus', createdAt: 'createdAt', shippingMethod: 'shippingMethod', updatedAt: 'updatedAt' },
  marketplaceOrderItems: { orderId: 'orderId', listingId: 'listingId', quantity: 'quantity' },
  offers: { id: 'id', orderId: 'orderId', status: 'status', updatedAt: 'updatedAt' },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: any[]) => ({ type: 'and', args }),
  eq: (col: any, val: any) => ({ type: 'eq', col, val }),
  lt: (col: any, val: any) => ({ type: 'lt', col, val }),
  inArray: (col: any, vals: any[]) => ({ type: 'inArray', col, vals }),
}));

vi.mock('./db/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runMeetupAutoCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no stuck orders
    mockSelectWhere.mockResolvedValue([]);
  });

  it('returns zero counts when no stuck meetup orders exist', async () => {
    const { runMeetupAutoCancel } = await import('./priceUpdateScheduler');
    const result = await runMeetupAutoCancel(7);
    expect(result).toEqual({ cancelled: 0, errors: 0 });
  });

  it('cancels stuck meetup orders and notifies buyer', async () => {
    const { createNotification } = await import('./db/notifications');
    const { restoreListingStock } = await import('./db');

    // First call: return stuck orders; subsequent calls (for items): return empty
    mockSelectWhere
      .mockResolvedValueOnce([
        { id: 1, orderNo: 'ORD-001', buyerId: 10, sellerId: null, listingId: 99, orderStatus: 'payment_received', createdAt: new Date('2025-01-01') },
      ])
      .mockResolvedValue([]); // order items query returns empty

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const { runMeetupAutoCancel } = await import('./priceUpdateScheduler');
    const result = await runMeetupAutoCancel(7);

    expect(result.cancelled).toBe(1);
    expect(result.errors).toBe(0);
    expect(restoreListingStock).toHaveBeenCalledWith(99, 1);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        type: 'order',
        title: '面交訂單已自動取消',
      })
    );
  });

  it('uses overrideDays parameter to set cutoff correctly', async () => {
    mockSelectWhere.mockResolvedValue([]);
    const { runMeetupAutoCancel } = await import('./priceUpdateScheduler');

    // Should not throw with various day values
    await expect(runMeetupAutoCancel(3)).resolves.toEqual({ cancelled: 0, errors: 0 });
    await expect(runMeetupAutoCancel(14)).resolves.toEqual({ cancelled: 0, errors: 0 });
  });

  it('handles errors per order gracefully and continues processing', async () => {
    const { restoreListingStock } = await import('./db');
    (restoreListingStock as any).mockRejectedValueOnce(new Error('DB error'));

    mockSelectWhere
      .mockResolvedValueOnce([
        { id: 2, orderNo: 'ORD-002', buyerId: 20, sellerId: null, listingId: 88, orderStatus: 'processing', createdAt: new Date('2025-01-01') },
        { id: 3, orderNo: 'ORD-003', buyerId: 30, sellerId: null, listingId: 77, orderStatus: 'paid_held', createdAt: new Date('2025-01-01') },
      ])
      .mockResolvedValue([]);

    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const { runMeetupAutoCancel } = await import('./priceUpdateScheduler');
    const result = await runMeetupAutoCancel(7);

    // One error, one success
    expect(result.cancelled + result.errors).toBe(2);
  });
});
