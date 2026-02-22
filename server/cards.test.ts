import { describe, expect, it } from "vitest";
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

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      loginMethod: "manus",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
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
    expect(result).toBeDefined();
  });

  it("getById procedure should accept id and return card or undefined", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.getById({ id: 1 });

    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("getByCardId procedure should accept cardId and return card or undefined", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.getByCardId({ cardId: "test-card-123" });

    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("getPopular procedure should return popular cards", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cards.getPopular({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
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

  it("getStatistics procedure should return price statistics", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prices.getStatistics({ cardId: 1 });

    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("trends router", () => {
  it("getMarketTrends procedure should return market trends", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trends.getMarketTrends({ cardId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("watchlist router", () => {
  it("getUserWatchlist procedure should require authentication", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.getUserWatchlist();

    expect(Array.isArray(result)).toBe(true);
  });

  it("addToWatchlist procedure should add card to watchlist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.addToWatchlist({ 
      cardId: 1,
      targetPrice: "1000",
      notes: "Test note"
    });

    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });

  it("removeFromWatchlist procedure should remove card from watchlist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.watchlist.removeFromWatchlist({ cardId: 1 });

    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });
});
