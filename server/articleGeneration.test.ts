import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";

// Mock user context for testing
const mockAdminContext: Context = {
  user: {
    id: 1,
    name: "Test Admin",
    email: "admin@test.com",
    avatar: null,
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const mockUserContext: Context = {
  user: {
    id: 2,
    name: "Test User",
    email: "user@test.com",
    avatar: null,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe("Article Generation API", () => {
  it("should create generation request with text input", async () => {
    const caller = appRouter.createCaller(mockAdminContext);

    const result = await caller.articleGeneration.generate({
      inputType: "text",
      inputContent: "Pikachu is a popular Pokémon character. It is an Electric-type Pokémon with yellow fur and red cheeks.",
      targetLanguage: "zh-TW",
      style: "analysis",
    });

    expect(result.success).toBe(true);
    expect(result.generationId).toBeTypeOf("number");
  }, 30000);

  it("should fail with empty input content", async () => {
    const caller = appRouter.createCaller(mockAdminContext);

    await expect(
      caller.articleGeneration.generate({
        inputType: "text",
        inputContent: "",
        targetLanguage: "zh-TW",
        style: "analysis",
      })
    ).rejects.toThrow();
  });

  it("should get user's generation history", async () => {
    const caller = appRouter.createCaller(mockAdminContext);

    const history = await caller.articleGeneration.myHistory({
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(history)).toBe(true);
  });

  it("should allow admin to get all generation history", async () => {
    const caller = appRouter.createCaller(mockAdminContext);

    const history = await caller.articleGeneration.allHistory({
      limit: 50,
      offset: 0,
    });

    expect(Array.isArray(history)).toBe(true);
  });

  it("should deny non-admin access to all history", async () => {
    const caller = appRouter.createCaller(mockUserContext);

    await expect(
      caller.articleGeneration.allHistory({
        limit: 50,
        offset: 0,
      })
    ).rejects.toThrow("Admin access required");
  });
});
