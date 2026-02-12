import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("cards router", () => {
  it("search procedure should accept query and return results", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.search({ query: "Charizard", limit: 10 });

    expect(Array.isArray(result)).toBe(true);
    // Since database might be empty, we just check the structure
    expect(result).toBeDefined();
  });

  it("getById procedure should accept id and return card or undefined", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.getById({ id: 1 });

    // Result can be undefined if card doesn't exist
    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("getByCardId procedure should accept cardId and return card or undefined", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.getByCardId({ cardId: "test-card-123" });

    // Result can be undefined if card doesn't exist
    expect(result === undefined || typeof result === "object").toBe(true);
  });
});

describe("prices router", () => {
  it("getHistory procedure should accept cardId and return price history", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.getHistory({ cardId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getHistory procedure should accept optional source filter", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.getHistory({ 
      cardId: 1, 
      source: "snkrdunk" 
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getHistory procedure should accept optional grade filter", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.getHistory({ 
      cardId: 1, 
      grade: "PSA 10" 
    });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("auctions router", () => {
  it("getActive procedure should return active auctions", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auctions.getActive({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getById procedure should accept id and return auction or undefined", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auctions.getById({ id: 1 });

    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("getBids procedure should accept auctionId and return bids", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auctions.getBids({ auctionId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("offers router", () => {
  it("getActive procedure should return active offers", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.offers.getActive({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getActive procedure should accept optional cardId filter", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.offers.getActive({ cardId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getActive procedure should accept optional type filter", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.offers.getActive({ type: "buy" });

    expect(Array.isArray(result)).toBe(true);
  });
});
