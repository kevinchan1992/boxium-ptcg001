import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { extractSnkrdunkId, parsePriceHistory } from "./snkrdunkScraper";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

function createNonAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("admin.getDataSources", () => {
  it("allows admin to access data sources", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.getDataSources();

    expect(Array.isArray(result)).toBe(true);
  });

  it("denies non-admin access", async () => {
    const { ctx } = createNonAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.getDataSources()).rejects.toThrow("Admin access required");
  });
});

describe("extractSnkrdunkId", () => {
  it("extracts ID from SNKRDUNK URL", () => {
    const url = "https://snkrdunk.com/apparels/455596#1";
    const id = extractSnkrdunkId(url);
    expect(id).toBe("455596");
  });

  it("extracts ID from SNKRDUNK URL without hash", () => {
    const url = "https://snkrdunk.com/apparels/123456";
    const id = extractSnkrdunkId(url);
    expect(id).toBe("123456");
  });

  it("returns null for invalid URL", () => {
    const url = "https://example.com/invalid";
    const id = extractSnkrdunkId(url);
    expect(id).toBeNull();
  });
});

describe("parsePriceHistory", () => {
  it("parses price history from markdown", () => {
    const markdown = `
## 最近の売買履歴

- 日時

状態

金額


- ![購入者](<Base64-Image-Removed>)

41分前

A

¥53,500

- ![購入者](<Base64-Image-Removed>)

4時間前

PSA10

¥78,000

- ![購入者](<Base64-Image-Removed>)

7時間前

PSA10

¥77,000
`;

    const priceHistory = parsePriceHistory(markdown);

    expect(priceHistory.length).toBeGreaterThan(0);
    expect(priceHistory[0]).toHaveProperty("price");
    expect(priceHistory[0]).toHaveProperty("currency");
    expect(priceHistory[0]).toHaveProperty("soldAt");
    expect(priceHistory[0].currency).toBe("JPY");
  });

  it("returns empty array when no price history found", () => {
    const markdown = "# Some card\n\nNo price history here";
    const priceHistory = parsePriceHistory(markdown);
    expect(priceHistory).toEqual([]);
  });
});
