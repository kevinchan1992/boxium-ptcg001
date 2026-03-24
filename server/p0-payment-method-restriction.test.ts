/**
 * P0 Payment Method Restriction Tests
 *
 * Validates that:
 * 1. createOrder rejects Alipay HK for C2C seller listings
 * 2. createBatchAlipayOrder rejects if any item is from a C2C seller
 * 3. switchOrderPaymentToAlipay rejects for C2C seller orders
 * 4. createOfferCheckout rejects Alipay HK for C2C seller orders
 *
 * These tests use mocked DB helpers to avoid real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getListingById: vi.fn(),
    getMarketplaceOrderById: vi.fn(),
    getActiveOrderByListingId: vi.fn().mockResolvedValue(null),
    reserveListingStock: vi.fn().mockResolvedValue(true),
    createMarketplaceOrder: vi.fn().mockResolvedValue({ id: 1, orderNo: "ORD-001" }),
    updateMarketplaceOrder: vi.fn().mockResolvedValue(undefined),
    createOrderItems: vi.fn().mockResolvedValue(undefined),
    generateOrderNo: vi.fn().mockResolvedValue("ORD-001"),
    getPlatformFeeRate: vi.fn().mockResolvedValue(0.05),
    getSystemSetting: vi.fn().mockResolvedValue(null),
    getBuyerOffers: vi.fn().mockResolvedValue([]),
    getOfferById: vi.fn(),
  };
});

// ─── Mock Stripe ──────────────────────────────────────────────────────────────
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.com/test", payment_intent: "pi_test_123" }),
        expire: vi.fn().mockResolvedValue({}),
      },
    },
  })),
}));

// ─── Mock email / notifications ───────────────────────────────────────────────
vi.mock("./emailService", () => ({
  notifyAdmin: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  buildSellerApprovedEmail: vi.fn(),
  buildSellerRejectedEmail: vi.fn(),
  buildNewOfferEmail: vi.fn(),
}));

vi.mock("./db/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/test.jpg" }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] }),
}));

// ─── Import router after mocks ────────────────────────────────────────────────
import { appRouter } from "./routers";
import { getListingById, getMarketplaceOrderById, getBuyerOffers } from "./db";

// ─── Test helpers ─────────────────────────────────────────────────────────────
function createUserContext(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 42,
      email: "buyer@example.com",
      name: "Test Buyer",
      loginMethod: "google",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: {
      protocol: "https",
      headers: { origin: "https://boxiumptcg.manus.space" },
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function makeListing(sellerType: "platform" | "seller", priceHkd = "100.00") {
  return {
    id: 1,
    title: "Test Card",
    status: "active",
    quantity: 1,
    priceHkd,
    sellerType,
    sellerId: sellerType === "seller" ? 99 : null,
    description: null,
  };
}

function makeOrder(sellerType: "platform" | "seller") {
  return {
    id: 10,
    orderNo: "ORD-001",
    buyerId: 42,
    sellerType,
    sellerId: sellerType === "seller" ? 99 : null,
    orderStatus: "pending_payment",
    paymentMethod: "stripe",
    subtotalHkd: "100.00",
    stripeSessionId: null,
    listingId: 1,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("P0: Payment Method Restriction", () => {
  const ctx = createUserContext();
  const caller = appRouter.createCaller(ctx);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createOrder ──────────────────────────────────────────────────────────────
  describe("createOrder", () => {
    const shippingAddress = {
      name: "Test Buyer",
      phone: "12345678",
      address: "Test Address",
    };

    it("should REJECT Alipay HK for a C2C seller listing", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("seller") as any);

      await expect(
        caller.marketplace.createOrder({
          listingId: 1,
          paymentMethod: "alipay_hk",
          shippingAddress,
        })
      ).rejects.toThrow(TRPCError);

      await expect(
        caller.marketplace.createOrder({
          listingId: 1,
          paymentMethod: "alipay_hk",
          shippingAddress,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("should ALLOW Stripe for a C2C seller listing", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("seller") as any);

      // Should not throw (Stripe is always allowed)
      await expect(
        caller.marketplace.createOrder({
          listingId: 1,
          paymentMethod: "stripe",
          shippingAddress,
        })
      ).resolves.toBeDefined();
    });

    it("should ALLOW Alipay HK for a platform listing", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("platform") as any);

      await expect(
        caller.marketplace.createOrder({
          listingId: 1,
          paymentMethod: "alipay_hk",
          shippingAddress,
        })
      ).resolves.toBeDefined();
    });

    it("should ALLOW Stripe for a platform listing", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("platform") as any);

      await expect(
        caller.marketplace.createOrder({
          listingId: 1,
          paymentMethod: "stripe",
          shippingAddress,
        })
      ).resolves.toBeDefined();
    });
  });

  // ── createBatchAlipayOrder ────────────────────────────────────────────────────
  describe("createBatchAlipayOrder", () => {
    it("should REJECT if any item is from a C2C seller", async () => {
      // First item: platform, second item: seller
      vi.mocked(getListingById)
        .mockResolvedValueOnce(makeListing("platform") as any)
        .mockResolvedValueOnce(makeListing("seller") as any);

      await expect(
        caller.marketplace.createBatchAlipayOrder({
          items: [{ listingId: 1 }, { listingId: 2 }],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("should REJECT if the single item is from a C2C seller", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("seller") as any);

      await expect(
        caller.marketplace.createBatchAlipayOrder({
          items: [{ listingId: 1 }],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("should ALLOW if all items are from the platform", async () => {
      vi.mocked(getListingById).mockResolvedValue(makeListing("platform") as any);

      await expect(
        caller.marketplace.createBatchAlipayOrder({
          items: [{ listingId: 1 }, { listingId: 2 }],
        })
      ).resolves.toBeDefined();
    });
  });

  // ── switchOrderPaymentToAlipay ────────────────────────────────────────────────
  describe("switchOrderPaymentToAlipay", () => {
    it("should REJECT switching to Alipay HK for a C2C seller order", async () => {
      vi.mocked(getMarketplaceOrderById).mockResolvedValue(makeOrder("seller") as any);

      await expect(
        caller.marketplace.switchOrderPaymentToAlipay({ orderId: 10 })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("should ALLOW switching to Alipay HK for a platform order", async () => {
      vi.mocked(getMarketplaceOrderById).mockResolvedValue(makeOrder("platform") as any);

      await expect(
        caller.marketplace.switchOrderPaymentToAlipay({ orderId: 10 })
      ).resolves.toMatchObject({ paymentMethod: "alipay_hk" });
    });
  });

  // ── createOfferCheckout ───────────────────────────────────────────────────────
  describe("createOfferCheckout", () => {
    it("should REJECT Alipay HK for a C2C seller offer order", async () => {
      vi.mocked(getBuyerOffers).mockResolvedValue([
        { id: 5, status: "accepted", orderId: 10, listingId: 1, listingTitle: "Test Card", offerPriceHkd: "80.00" },
      ] as any);
      vi.mocked(getMarketplaceOrderById).mockResolvedValue(makeOrder("seller") as any);

      await expect(
        caller.marketplace.createOfferCheckout({ offerId: 5, paymentMethod: "alipay_hk" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("should ALLOW Alipay HK for a platform offer order", async () => {
      vi.mocked(getBuyerOffers).mockResolvedValue([
        { id: 5, status: "accepted", orderId: 10, listingId: 1, listingTitle: "Test Card", offerPriceHkd: "80.00" },
      ] as any);
      vi.mocked(getMarketplaceOrderById).mockResolvedValue(makeOrder("platform") as any);

      await expect(
        caller.marketplace.createOfferCheckout({ offerId: 5, paymentMethod: "alipay_hk" })
      ).resolves.toMatchObject({ paymentMethod: "alipay_hk" });
    });

    it("should ALLOW Stripe for a C2C seller offer order", async () => {
      vi.mocked(getBuyerOffers).mockResolvedValue([
        { id: 5, status: "accepted", orderId: 10, listingId: 1, listingTitle: "Test Card", offerPriceHkd: "80.00" },
      ] as any);
      vi.mocked(getMarketplaceOrderById).mockResolvedValue(makeOrder("seller") as any);

      await expect(
        caller.marketplace.createOfferCheckout({ offerId: 5, paymentMethod: "stripe" })
      ).resolves.toBeDefined();
    });
  });
});
