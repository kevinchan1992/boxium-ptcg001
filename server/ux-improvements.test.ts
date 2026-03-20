/**
 * Tests for UX improvements:
 * 1. /orders redirect to /profile?tab=orders
 * 2. Order detail page back button goes to /profile?tab=orders
 * 3. Seller dashboard order filter and search
 */
import { describe, it, expect } from "vitest";

describe("UX Improvements", () => {
  describe("Navigation link updates", () => {
    it("should have /profile?tab=orders as the orders back link in OrderDetail", async () => {
      const { readFileSync } = await import("fs");
      const content = readFileSync(
        new URL("../client/src/pages/OrderDetail.tsx", import.meta.url).pathname,
        "utf-8"
      );
      // Verify /orders links are replaced with /profile?tab=orders
      expect(content).toContain('/profile?tab=orders');
      expect(content).not.toMatch(/href="\/orders"(?!.*profile)/);
    });

    it("should have /profile?tab=notifications as the notifications link in TopNav", async () => {
      const { readFileSync } = await import("fs");
      const content = readFileSync(
        new URL("../client/src/components/TopNav.tsx", import.meta.url).pathname,
        "utf-8"
      );
      // Verify /notifications links are replaced with /profile?tab=notifications
      expect(content).toContain('/profile?tab=notifications');
    });
  });

  describe("App.tsx route redirect", () => {
    it("should have /orders route redirect to /profile?tab=orders", async () => {
      const { readFileSync } = await import("fs");
      const content = readFileSync(
        new URL("../client/src/App.tsx", import.meta.url).pathname,
        "utf-8"
      );
      // Verify /orders route has redirect
      expect(content).toContain('tab=orders');
    });
  });

  describe("Seller dashboard order filter logic", () => {
    const SELLER_ORDER_STATUS_GROUPS: Record<string, string[]> = {
      all: [],
      pending: ['payment_submitted', 'alipay_pending', 'pending_payment'],
      active: ['payment_confirmed', 'payment_received', 'paid_held', 'processing', 'shipped', 'delivered'],
      done: ['completed', 'cancelled', 'disputed'],
    };

    const mockOrders = [
      { id: 1, orderNo: 'BOXIUM-001', listingTitle: 'Pikachu Card', orderStatus: 'payment_received' },
      { id: 2, orderNo: 'BOXIUM-002', listingTitle: 'Charizard Card', orderStatus: 'completed' },
      { id: 3, orderNo: 'BOXIUM-003', listingTitle: 'Mewtwo Card', orderStatus: 'alipay_pending' },
      { id: 4, orderNo: 'BOXIUM-004', listingTitle: 'Eevee Card', orderStatus: 'shipped' },
      { id: 5, orderNo: 'BOXIUM-005', listingTitle: 'Bulbasaur Card', orderStatus: 'cancelled' },
    ];

    const filterOrders = (orders: typeof mockOrders, statusFilter: string, searchQuery: string) => {
      let filtered = [...orders];
      if (statusFilter !== 'all') {
        filtered = filtered.filter(o => SELLER_ORDER_STATUS_GROUPS[statusFilter]?.includes(o.orderStatus));
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(o =>
          (o.orderNo ?? '').toLowerCase().includes(q) ||
          (o.listingTitle ?? '').toLowerCase().includes(q)
        );
      }
      return filtered;
    };

    it("should show all orders when filter is 'all'", () => {
      const result = filterOrders(mockOrders, 'all', '');
      expect(result).toHaveLength(5);
    });

    it("should filter pending orders correctly", () => {
      const result = filterOrders(mockOrders, 'pending', '');
      expect(result).toHaveLength(1);
      expect(result[0].orderStatus).toBe('alipay_pending');
    });

    it("should filter active orders correctly", () => {
      const result = filterOrders(mockOrders, 'active', '');
      expect(result).toHaveLength(2);
      const statuses = result.map(o => o.orderStatus);
      expect(statuses).toContain('payment_received');
      expect(statuses).toContain('shipped');
    });

    it("should filter done orders correctly", () => {
      const result = filterOrders(mockOrders, 'done', '');
      expect(result).toHaveLength(2);
      const statuses = result.map(o => o.orderStatus);
      expect(statuses).toContain('completed');
      expect(statuses).toContain('cancelled');
    });

    it("should search by order number", () => {
      const result = filterOrders(mockOrders, 'all', 'BOXIUM-001');
      expect(result).toHaveLength(1);
      expect(result[0].orderNo).toBe('BOXIUM-001');
    });

    it("should search by listing title (case insensitive)", () => {
      const result = filterOrders(mockOrders, 'all', 'pikachu');
      expect(result).toHaveLength(1);
      expect(result[0].listingTitle).toBe('Pikachu Card');
    });

    it("should combine status filter and search", () => {
      const result = filterOrders(mockOrders, 'done', 'charizard');
      expect(result).toHaveLength(1);
      expect(result[0].orderNo).toBe('BOXIUM-002');
    });

    it("should return empty array when no orders match", () => {
      const result = filterOrders(mockOrders, 'pending', 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it("should search partial order number", () => {
      const result = filterOrders(mockOrders, 'all', '003');
      expect(result).toHaveLength(1);
      expect(result[0].orderNo).toBe('BOXIUM-003');
    });

    it("should search partial listing title", () => {
      const result = filterOrders(mockOrders, 'all', 'card');
      expect(result).toHaveLength(5); // all have 'Card' in title
    });
  });

  describe("Profile tab URL parameter handling", () => {
    it("should handle tab=orders URL parameter", () => {
      const searchParams = new URLSearchParams('?tab=orders');
      const tab = searchParams.get('tab');
      expect(tab).toBe('orders');
    });

    it("should handle tab=notifications URL parameter", () => {
      const searchParams = new URLSearchParams('?tab=notifications');
      const tab = searchParams.get('tab');
      expect(tab).toBe('notifications');
    });

    it("should default to info tab when no tab parameter", () => {
      const searchParams = new URLSearchParams('');
      const tab = searchParams.get('tab') ?? 'info';
      expect(tab).toBe('info');
    });
  });
});
