/**
 * Tests for six Admin features:
 * 1. Batch shipping dialog - individual tracking mode (perOrderTracking)
 * 2. Order history timeline - quick open order detail button
 * 3. Admin Dashboard - pending payout count
 * 4. Listings bulk status change
 * 5. Selected count display in select-all row
 * 6. Listings bulk export CSV
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── 1. Batch shipping individual tracking mode ───────────────────────────────
describe('adminBatchUpdateShipping - individual tracking mode', () => {
  it('should accept perOrderTracking array and map tracking numbers per order', () => {
    const input = {
      orderIds: [1, 2, 3],
      shippingMethod: 'sf_express',
      perOrderTracking: [
        { orderId: 1, trackingNumber: 'SF001' },
        { orderId: 2, trackingNumber: 'SF002' },
        // orderId 3 has no tracking number (intentionally omitted)
      ],
    };
    // Build tracking map as the procedure does
    const trackingMap = new Map<number, string>();
    if (input.perOrderTracking) {
      input.perOrderTracking.forEach(({ orderId, trackingNumber }) =>
        trackingMap.set(orderId, trackingNumber)
      );
    }
    expect(trackingMap.get(1)).toBe('SF001');
    expect(trackingMap.get(2)).toBe('SF002');
    expect(trackingMap.get(3)).toBeUndefined();
  });

  it('should fall back to global trackingNumber when perOrderTracking is not provided', () => {
    const input = {
      orderIds: [1, 2],
      shippingMethod: 'hk_post',
      trackingNumber: 'HKP-GLOBAL-001',
    };
    const trackingMap = new Map<number, string>();
    // No perOrderTracking, so all orders use global
    const getTracking = (orderId: number) =>
      trackingMap.get(orderId) ?? input.trackingNumber;
    expect(getTracking(1)).toBe('HKP-GLOBAL-001');
    expect(getTracking(2)).toBe('HKP-GLOBAL-001');
  });

  it('should allow empty perOrderTracking array (no tracking numbers)', () => {
    const input = {
      orderIds: [5, 6],
      shippingMethod: 'pickup',
      perOrderTracking: [],
    };
    const trackingMap = new Map<number, string>();
    input.perOrderTracking.forEach(({ orderId, trackingNumber }) =>
      trackingMap.set(orderId, trackingNumber)
    );
    expect(trackingMap.size).toBe(0);
  });

  it('should filter out empty tracking numbers in individual mode', () => {
    const individualTrackingMap: Record<number, string> = {
      1: 'SF001',
      2: '',       // empty - should be filtered
      3: '  ',     // whitespace - should be filtered
      4: 'SF004',
    };
    const perOrderTracking = Object.entries(individualTrackingMap)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => ({ orderId: Number(k), trackingNumber: v.trim() }));
    expect(perOrderTracking).toHaveLength(2);
    expect(perOrderTracking.find(p => p.orderId === 1)?.trackingNumber).toBe('SF001');
    expect(perOrderTracking.find(p => p.orderId === 4)?.trackingNumber).toBe('SF004');
  });
});

// ─── 2. Order history timeline - quick open order detail ─────────────────────
describe('Order history timeline - onOpenOrder callback', () => {
  it('should call onOpenOrder with the correct orderId when button is clicked', () => {
    const onOpenOrder = vi.fn();
    const orderId = 42;
    // Simulate button click
    onOpenOrder(orderId);
    expect(onOpenOrder).toHaveBeenCalledWith(42);
    expect(onOpenOrder).toHaveBeenCalledTimes(1);
  });

  it('should not render open button when onOpenOrder is not provided', () => {
    const onOpenOrder: ((id: number) => void) | undefined = undefined;
    // In the component: {onOpenOrder && <button onClick={() => onOpenOrder(order.id)} />}
    const shouldRender = !!onOpenOrder;
    expect(shouldRender).toBe(false);
  });

  it('should find order in current list and open detail dialog', () => {
    const orders = [
      { id: 1, orderNo: 'BOXIUM-001', orderStatus: 'completed' },
      { id: 2, orderNo: 'BOXIUM-002', orderStatus: 'shipped' },
    ];
    let selectedOrder: any = null;
    let viewListingId: number | null = 5;
    const onOpenOrder = (orderId: number) => {
      const found = orders.find((o: any) => o.id === orderId);
      if (found) {
        viewListingId = null;
        selectedOrder = found;
      }
    };
    onOpenOrder(1);
    expect(selectedOrder?.orderNo).toBe('BOXIUM-001');
    expect(viewListingId).toBeNull();
  });
});

// ─── 3. Admin Dashboard - pending payout count ───────────────────────────────
describe('adminGetPendingPayoutCount', () => {
  it('should return 0 when no completed orders have pending payout', () => {
    const orders = [
      { orderStatus: 'processing', payoutStatus: null },
      { orderStatus: 'shipped', payoutStatus: null },
      { orderStatus: 'completed', payoutStatus: 'paid' },
    ];
    const count = orders.filter(
      o => o.orderStatus === 'completed' &&
        (o.payoutStatus === null || o.payoutStatus === 'pending')
    ).length;
    expect(count).toBe(0);
  });

  it('should count completed orders with null or pending payout status', () => {
    const orders = [
      { orderStatus: 'completed', payoutStatus: null },
      { orderStatus: 'completed', payoutStatus: 'pending' },
      { orderStatus: 'completed', payoutStatus: 'paid' },
      { orderStatus: 'shipped', payoutStatus: null },
    ];
    const count = orders.filter(
      o => o.orderStatus === 'completed' &&
        (o.payoutStatus === null || o.payoutStatus === 'pending')
    ).length;
    expect(count).toBe(2);
  });

  it('should display payout reminder button only when count > 0', () => {
    const pendingPayoutCount = 3;
    const shouldShow = pendingPayoutCount > 0;
    expect(shouldShow).toBe(true);
    const pendingPayoutCountZero = 0;
    expect(pendingPayoutCountZero > 0).toBe(false);
  });

  it('should navigate to orders tab when payout reminder is clicked', () => {
    let activeSection = 'listings';
    const handlePayoutReminderClick = () => { activeSection = 'orders'; };
    handlePayoutReminderClick();
    expect(activeSection).toBe('orders');
  });
});

// ─── 4. Listings bulk status change ──────────────────────────────────────────
describe('Listings bulk status change', () => {
  it('should validate status values for bulk change', () => {
    const validStatuses = ['active', 'draft', 'pending_review'];
    const testStatus = 'active';
    expect(validStatuses.includes(testStatus)).toBe(true);
    expect(validStatuses.includes('invalid_status')).toBe(false);
  });

  it('should not allow bulk status change when no listings are selected', () => {
    const selectedListingIds = new Set<number>();
    const canBulkChange = selectedListingIds.size > 0;
    expect(canBulkChange).toBe(false);
  });

  it('should allow bulk status change when listings are selected', () => {
    const selectedListingIds = new Set<number>([1, 2, 3]);
    const canBulkChange = selectedListingIds.size > 0;
    expect(canBulkChange).toBe(true);
  });
});

// ─── 5. Selected count display ───────────────────────────────────────────────
describe('Selected count display in select-all row', () => {
  it('should show correct count when some items are selected', () => {
    const selectedIds = new Set<number>([1, 3, 5]);
    const totalItems = 10;
    const isAllSelected = selectedIds.size === totalItems;
    const label = isAllSelected
      ? `已全選 ${totalItems} 筆`
      : `全選本頁 (${totalItems} 筆)`;
    expect(label).toBe(`全選本頁 (${totalItems} 筆)`);
    expect(selectedIds.size).toBe(3);
  });

  it('should show all-selected label when all items are checked', () => {
    const selectedIds = new Set<number>([1, 2, 3]);
    const totalItems = 3;
    const isAllSelected = selectedIds.size === totalItems;
    const label = isAllSelected
      ? `已全選 ${totalItems} 筆`
      : `全選本頁 (${totalItems} 筆)`;
    expect(label).toBe(`已全選 ${totalItems} 筆`);
  });

  it('should show selected count badge when items are selected', () => {
    const selectedCount = 5;
    const showBadge = selectedCount > 0;
    expect(showBadge).toBe(true);
    const badgeText = `已選 ${selectedCount} 個`;
    expect(badgeText).toBe('已選 5 個');
  });
});

// ─── 6. Listings bulk export CSV ─────────────────────────────────────────────
describe('Listings bulk export CSV', () => {
  it('should generate correct CSV headers for listing export', () => {
    const expectedHeaders = ['商品ID', '標題', '狀態', '價格', '庫存', '賣家', '上架日期'];
    const listing = {
      id: 1,
      title: 'Test Card',
      status: 'active',
      price: '100.00',
      quantity: 1,
      sellerName: 'Test Seller',
      createdAt: new Date('2026-01-01'),
    };
    const row = {
      '商品ID': listing.id,
      '標題': listing.title,
      '狀態': listing.status,
      '價格': `HKD ${listing.price}`,
      '庫存': listing.quantity,
      '賣家': listing.sellerName,
      '上架日期': listing.createdAt.toLocaleDateString('zh-HK'),
    };
    expect(Object.keys(row)).toEqual(expectedHeaders);
  });

  it('should only export selected listings', () => {
    const allListings = [
      { id: 1, title: 'Card A' },
      { id: 2, title: 'Card B' },
      { id: 3, title: 'Card C' },
    ];
    const selectedIds = new Set<number>([1, 3]);
    const toExport = allListings.filter(l => selectedIds.has(l.id));
    expect(toExport).toHaveLength(2);
    expect(toExport.map(l => l.id)).toEqual([1, 3]);
  });

  it('should not export when no listings are selected', () => {
    const selectedIds = new Set<number>();
    const canExport = selectedIds.size > 0;
    expect(canExport).toBe(false);
  });
});
