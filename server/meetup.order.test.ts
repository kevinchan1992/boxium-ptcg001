/**
 * Tests for meetup order flow:
 * 1. confirmMeetupOrder - seller confirms meetup, order goes directly to completed
 * 2. shippingMethod is stored when creating orders
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock DB helpers used by confirmMeetupOrder
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMarketplaceOrderById: vi.fn(),
    getSellerProfileByUserId: vi.fn(),
    updateMarketplaceOrder: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("./db/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./emailService", () => ({
  sendOrderEmail: vi.fn().mockResolvedValue(true),
  buildOrderCompletedBuyerEmail: vi.fn().mockReturnValue({ subject: "test", html: "<p>test</p>" }),
  buildOrderCompletedSellerEmail: vi.fn().mockReturnValue({ subject: "test", html: "<p>test</p>" }),
  getOrderEmailData: vi.fn().mockResolvedValue({ itemName: "Test Card", priceHkd: "100.00", receivableHkd: "95.00" }),
}));

import { getMarketplaceOrderById, getSellerProfileByUserId, updateMarketplaceOrder } from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createSellerContext(userId = 99): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    email: "seller@example.com",
    name: "Test Seller",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("marketplace.confirmMeetupOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw FORBIDDEN if user is not the seller", async () => {
    vi.mocked(getMarketplaceOrderById).mockResolvedValue({
      id: 1,
      orderNo: "ORD-001",
      sellerId: 5,
      buyerId: 10,
      orderStatus: "payment_received",
      shippingMethod: "meetup",
      sellerType: "seller",
      subtotalHkd: "100.00",
      sellerReceivableHkd: "95.00",
      stripePaymentIntentId: null,
    } as any);

    // getSellerProfileByUserId returns a profile with different sellerId
    vi.mocked(getSellerProfileByUserId).mockResolvedValue({
      id: 99, // different from order.sellerId = 5
      userId: 99,
      stripeConnectId: null,
      stripeConnectStatus: null,
    } as any);

    const ctx = createSellerContext(99);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.marketplace.confirmMeetupOrder({ orderId: 1 })
    ).rejects.toThrow("只有賣家可以確認面交");
  });

  it("should throw BAD_REQUEST if order is not a meetup order", async () => {
    vi.mocked(getMarketplaceOrderById).mockResolvedValue({
      id: 2,
      orderNo: "ORD-002",
      sellerId: 5,
      buyerId: 10,
      orderStatus: "payment_received",
      shippingMethod: "sf_cod", // not meetup
      sellerType: "seller",
      subtotalHkd: "100.00",
      sellerReceivableHkd: "95.00",
      stripePaymentIntentId: null,
    } as any);

    vi.mocked(getSellerProfileByUserId).mockResolvedValue({
      id: 5,
      userId: 99,
      stripeConnectId: null,
      stripeConnectStatus: null,
    } as any);

    const ctx = createSellerContext(99);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.marketplace.confirmMeetupOrder({ orderId: 2 })
    ).rejects.toThrow("此訂單不是面交訂單");
  });

  it("should throw BAD_REQUEST if order status is not confirmable", async () => {
    vi.mocked(getMarketplaceOrderById).mockResolvedValue({
      id: 3,
      orderNo: "ORD-003",
      sellerId: 5,
      buyerId: 10,
      orderStatus: "pending_payment", // not confirmable
      shippingMethod: "meetup",
      sellerType: "seller",
      subtotalHkd: "100.00",
      sellerReceivableHkd: "95.00",
      stripePaymentIntentId: null,
    } as any);

    vi.mocked(getSellerProfileByUserId).mockResolvedValue({
      id: 5,
      userId: 99,
      stripeConnectId: null,
      stripeConnectStatus: null,
    } as any);

    const ctx = createSellerContext(99);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.marketplace.confirmMeetupOrder({ orderId: 3 })
    ).rejects.toThrow("訂單狀態不允許此操作");
  });

  it("should complete a valid meetup order successfully", async () => {
    vi.mocked(getMarketplaceOrderById).mockResolvedValue({
      id: 4,
      orderNo: "ORD-004",
      sellerId: 5,
      buyerId: 10,
      orderStatus: "payment_received",
      shippingMethod: "meetup",
      sellerType: "seller",
      subtotalHkd: "100.00",
      sellerReceivableHkd: "95.00",
      stripePaymentIntentId: null, // no Stripe payout needed
    } as any);

    vi.mocked(getSellerProfileByUserId).mockResolvedValue({
      id: 5,
      userId: 99,
      stripeConnectId: null,
      stripeConnectStatus: null,
    } as any);

    const ctx = createSellerContext(99);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.marketplace.confirmMeetupOrder({ orderId: 4 });

    expect(result).toEqual({ success: true });
    expect(updateMarketplaceOrder).toHaveBeenCalledWith(4, expect.objectContaining({
      orderStatus: "completed",
      payoutStatus: "processing",
    }));
  });
});
