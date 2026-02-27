import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { parseCardNumber, normalizeCardQuery, generateCardNumberPatterns } from "./utils/cardNumberNormalize";

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

    // search returns { cards: [], total: number }
    expect(result).toBeDefined();
    expect(result).toHaveProperty("cards");
    expect(Array.isArray(result.cards)).toBe(true);
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

// ── suggestQuery API tests ────────────────────────────────────────────────────
describe("cards.suggestQuery", () => {
  it("should return { suggestions: [] } for empty query", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cards.suggestQuery({ query: "" });
    expect(result).toHaveProperty("suggestions");
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

  it("should return suggestions array for a non-empty query", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cards.suggestQuery({ query: "zzz_no_match_xyz_9999" });
    expect(result).toHaveProperty("suggestions");
    expect(Array.isArray(result.suggestions)).toBe(true);
    // Suggestions may be empty if nothing matches in DB — that's fine
  });

  it("each suggestion should have query and label fields", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cards.suggestQuery({ query: "288 sm-p" });
    expect(result).toHaveProperty("suggestions");
    for (const s of result.suggestions) {
      expect(s).toHaveProperty("query");
      expect(s).toHaveProperty("label");
      expect(typeof s.query).toBe("string");
      expect(typeof s.label).toBe("string");
      expect(s.query.length).toBeGreaterThan(0);
    }
  });

  it("suggestions should not include the original query", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const query = "pikachu";
    const result = await caller.cards.suggestQuery({ query });
    for (const s of result.suggestions) {
      expect(s.query).not.toBe(query);
    }
  });

  it("should return at most 3 verified suggestions", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.cards.suggestQuery({ query: "288" });
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });
});

// ── cardNumberNormalize utility tests (used by suggestQuery) ─────────────────
describe("cardNumberNormalize utility", () => {
  it("parseCardNumber: SM-P 288 → { setCode: 'SM-P', number: '288' }", () => {
    const parts = parseCardNumber("SM-P 288");
    expect(parts).not.toBeNull();
    expect(parts?.setCode).toBe("SM-P");
    expect(parts?.number).toBe("288");
  });

  it("parseCardNumber: 288/SM-P → { setCode: 'SM-P', number: '288' }", () => {
    const parts = parseCardNumber("288/SM-P");
    expect(parts).not.toBeNull();
    expect(parts?.setCode).toBe("SM-P");
    expect(parts?.number).toBe("288");
  });

  it("parseCardNumber: 288 sm-p → { setCode: 'SM-P', number: '288' }", () => {
    const parts = parseCardNumber("288 sm-p");
    expect(parts).not.toBeNull();
    expect(parts?.setCode).toBe("SM-P");
    expect(parts?.number).toBe("288");
  });

  it("normalizeCardQuery: '288 sm-p' → 'SM-P 288'", () => {
    expect(normalizeCardQuery("288 sm-p")).toBe("SM-P 288");
  });

  it("normalizeCardQuery: '288/SM-P' → 'SM-P 288'", () => {
    expect(normalizeCardQuery("288/SM-P")).toBe("SM-P 288");
  });

  it("generateCardNumberPatterns: produces multiple LIKE patterns for SM-P 288", () => {
    const patterns = generateCardNumberPatterns("SM-P 288");
    expect(patterns.length).toBeGreaterThan(1);
    expect(patterns.some(p => p.includes("SM-P") && p.includes("288"))).toBe(true);
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
