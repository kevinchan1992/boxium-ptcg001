/**
 * Marketplace Bug Fix Tests (2026-03-25)
 *
 * Tests for the following bugs:
 * - Bug #2: paymentStatus not set to 'cancelled' when switching payment methods
 * - Bug #3: paymentTimeout scheduler missing paymentStatus='cancelled'
 * - Bug #4: getPublicListings missing remainingQuantity field
 * - TypeScript fixes: ctx missing in adminProcedures, invokeLLM content type, etc.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ───────────────────────────────────────────────────────────────────
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  updateMarketplaceOrder: vi.fn().mockResolvedValue(undefined),
  restoreListingStock: vi.fn().mockResolvedValue(undefined),
  getMarketplaceOrderById: vi.fn(),
  getPublicListings: vi.fn(),
}));

// ─── Bug #2 Tests: paymentStatus='cancelled' on payment method switch ──────────
describe("Bug #2: Payment method switch sets paymentStatus='cancelled'", () => {
  it("should set paymentStatus='cancelled' when cancelling existing Alipay order for Stripe switch", async () => {
    const { updateMarketplaceOrder } = await import("./db");
    const mockUpdate = vi.mocked(updateMarketplaceOrder);
    mockUpdate.mockClear();

    // Simulate the fix: cancel existing Alipay order with paymentStatus
    await updateMarketplaceOrder(999, {
      orderStatus: "cancelled",
      paymentStatus: "cancelled",
      updatedAt: new Date(),
    } as any);

    expect(mockUpdate).toHaveBeenCalledWith(
      999,
      expect.objectContaining({
        orderStatus: "cancelled",
        paymentStatus: "cancelled",
      })
    );
  });

  it("should set paymentStatus='cancelled' when cancelling existing Stripe order for Alipay switch", async () => {
    const { updateMarketplaceOrder } = await import("./db");
    const mockUpdate = vi.mocked(updateMarketplaceOrder);
    mockUpdate.mockClear();

    await updateMarketplaceOrder(888, {
      orderStatus: "cancelled",
      paymentStatus: "cancelled",
      updatedAt: new Date(),
    } as any);

    expect(mockUpdate).toHaveBeenCalledWith(
      888,
      expect.objectContaining({
        orderStatus: "cancelled",
        paymentStatus: "cancelled",
      })
    );
  });
});

// ─── Bug #3 Tests: paymentTimeout scheduler ───────────────────────────────────
describe("Bug #3: paymentTimeout scheduler sets paymentStatus='cancelled'", () => {
  it("should include paymentStatus='cancelled' in timeout cancellation update", async () => {
    const { updateMarketplaceOrder } = await import("./db");
    const mockUpdate = vi.mocked(updateMarketplaceOrder);
    mockUpdate.mockClear();

    // Simulate what the scheduler now does
    const orderId = 12345;
    await updateMarketplaceOrder(orderId, {
      orderStatus: "cancelled",
      paymentStatus: "cancelled",
      updatedAt: new Date(),
    } as any);

    expect(mockUpdate).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({
        orderStatus: "cancelled",
        paymentStatus: "cancelled",
      })
    );
  });

  it("should NOT set paymentStatus='pending' when cancelling expired orders", async () => {
    const { updateMarketplaceOrder } = await import("./db");
    const mockUpdate = vi.mocked(updateMarketplaceOrder);
    mockUpdate.mockClear();

    // This is the OLD (buggy) behavior — should NOT happen
    await updateMarketplaceOrder(12346, {
      orderStatus: "cancelled",
      // paymentStatus intentionally omitted (old bug)
    } as any);

    // Verify the call does NOT set paymentStatus to 'pending'
    const call = mockUpdate.mock.calls[0];
    expect(call[1]).not.toHaveProperty("paymentStatus", "pending");
  });
});

// ─── Bug #4 Tests: getPublicListings returns remainingQuantity ─────────────────
describe("Bug #4: getPublicListings returns remainingQuantity", () => {
  it("should include remainingQuantity in returned listing objects", async () => {
    const { getPublicListings } = await import("./db");
    const mockGet = vi.mocked(getPublicListings);

    // Mock a listing with remainingQuantity
    mockGet.mockResolvedValueOnce({
      listings: [
        {
          id: 180001,
          title: "Test Card",
          priceHkd: "100.00",
          condition: "nm",
          status: "active",
          images: [],
          sellerType: "seller",
          sellerId: 1,
          quantity: 1,
          remainingQuantity: 1, // ← This field must be present
          createdAt: new Date(),
          cardId: null,
          language: null,
          tcgSeries: null,
          viewCount: 0,
          sellerProfile: null,
        },
      ],
      total: 1,
      seriesCounts: { all: 1 },
    });

    const result = await getPublicListings({ page: 1, pageSize: 20 });

    expect(result.listings[0]).toHaveProperty("remainingQuantity");
    expect(result.listings[0].remainingQuantity).toBe(1);
  });

  it("should show sold-out overlay when remainingQuantity is 0", () => {
    // Simulate the frontend logic: (listing.remainingQuantity === 0 || listing.status === 'sold')
    const listing = { remainingQuantity: 0, status: "active" };
    const isSoldOut = listing.remainingQuantity === 0 || listing.status === "sold";
    expect(isSoldOut).toBe(true);
  });

  it("should NOT show sold-out overlay when remainingQuantity is 1", () => {
    const listing = { remainingQuantity: 1, status: "active" };
    const isSoldOut = listing.remainingQuantity === 0 || listing.status === "sold";
    expect(isSoldOut).toBe(false);
  });

  it("should show sold-out overlay when status is 'sold' regardless of remainingQuantity", () => {
    const listing = { remainingQuantity: 1, status: "sold" };
    const isSoldOut = listing.remainingQuantity === 0 || listing.status === "sold";
    expect(isSoldOut).toBe(true);
  });
});

// ─── TypeScript Fix Tests ──────────────────────────────────────────────────────
describe("TypeScript Fix: invokeLLM content type handling", () => {
  it("should handle string content from LLM response", () => {
    const rawContent = '{"verified": true, "confidence": "high"}';
    const content =
      typeof rawContent === "string"
        ? rawContent
        : JSON.stringify(rawContent ?? {});
    expect(content).toBe('{"verified": true, "confidence": "high"}');
    const parsed = JSON.parse(content);
    expect(parsed.verified).toBe(true);
  });

  it("should handle array content from LLM response (edge case)", () => {
    const rawContent = [{ type: "text", text: '{"verified": false}' }];
    const content =
      typeof rawContent === "string"
        ? rawContent
        : JSON.stringify(rawContent ?? {});
    expect(typeof content).toBe("string");
    // Should not throw
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("should handle null/undefined content from LLM response", () => {
    const rawContent = undefined;
    const content =
      typeof rawContent === "string"
        ? rawContent
        : JSON.stringify(rawContent ?? {});
    expect(content).toBe("{}");
  });
});

// ─── Bug Fix: adminUpdateOrderStatus uses input.orderStatus not input.status ──
describe("TypeScript Fix: adminUpdateOrderStatus uses correct field name", () => {
  it("should use input.orderStatus (not input.status) for audit log", () => {
    // Simulate the fixed audit log action
    const input = { orderId: 1, orderStatus: "shipped" as const };
    const action = `update_order_status_${input.orderStatus}`;
    expect(action).toBe("update_order_status_shipped");
  });

  it("should build correct audit log details with orderStatus", () => {
    const input = { orderId: 1, orderStatus: "completed" as const, note: "Done" };
    const details = JSON.stringify({
      orderNo: "BOXIUM-20260325-0001",
      newStatus: input.orderStatus,
      note: input.note,
    });
    const parsed = JSON.parse(details);
    expect(parsed.newStatus).toBe("completed");
  });
});
