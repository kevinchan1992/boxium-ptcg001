import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/context";
import type { Request, Response } from "express";

// Mock context for testing
function createMockContext(user?: any): Context {
  const mockReq = {
    cookies: {},
    headers: {},
  } as unknown as Request;

  const mockRes = {
    cookie: () => mockRes,
    clearCookie: () => mockRes,
  } as unknown as Response;

  return {
    req: mockReq,
    res: mockRes,
    user: user || null,
  };
}

describe("Auth API", () => {
  describe("Registration", () => {
    it("should register a new user successfully", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const uniqueUsername = `testuser_${Date.now()}`;
      const uniqueEmail = `test_${Date.now()}@example.com`;

      const result = await caller.auth.register({
        username: uniqueUsername,
        email: uniqueEmail,
        password: "password123",
        name: "Test User",
      });

      expect(result.success).toBe(true);
      expect(result.username).toBe(uniqueUsername);
      expect(result.userId).toBeTypeOf("number");
    });

    it("should reject duplicate username", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const uniqueUsername = `duplicate_${Date.now()}`;
      const uniqueEmail1 = `email1_${Date.now()}@example.com`;
      const uniqueEmail2 = `email2_${Date.now()}@example.com`;

      // First registration
      await caller.auth.register({
        username: uniqueUsername,
        email: uniqueEmail1,
        password: "password123",
      });

      // Second registration with same username
      await expect(
        caller.auth.register({
          username: uniqueUsername,
          email: uniqueEmail2,
          password: "password123",
        })
      ).rejects.toThrow("使用者名稱已被使用");
    });

    it("should reject duplicate email", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const uniqueEmail = `duplicate_${Date.now()}@example.com`;
      const uniqueUsername1 = `user1_${Date.now()}`;
      const uniqueUsername2 = `user2_${Date.now()}`;

      // First registration
      await caller.auth.register({
        username: uniqueUsername1,
        email: uniqueEmail,
        password: "password123",
      });

      // Second registration with same email
      await expect(
        caller.auth.register({
          username: uniqueUsername2,
          email: uniqueEmail,
          password: "password123",
        })
      ).rejects.toThrow("電子郵件已被使用");
    });
  });

  describe("Login", () => {
    it("should login successfully with correct credentials", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const uniqueUsername = `logintest_${Date.now()}`;
      const uniqueEmail = `logintest_${Date.now()}@example.com`;
      const password = "password123";

      // Register first
      await caller.auth.register({
        username: uniqueUsername,
        email: uniqueEmail,
        password,
      });

      // Then login
      const result = await caller.auth.login({
        username: uniqueUsername,
        password,
      });

      expect(result.success).toBe(true);
      expect(result.username).toBe(uniqueUsername);
      expect(result.userId).toBeTypeOf("number");
    });

    it("should reject login with wrong password", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const uniqueUsername = `wrongpwd_${Date.now()}`;
      const uniqueEmail = `wrongpwd_${Date.now()}@example.com`;

      // Register first
      await caller.auth.register({
        username: uniqueUsername,
        email: uniqueEmail,
        password: "correctpassword",
      });

      // Try login with wrong password
      await expect(
        caller.auth.login({
          username: uniqueUsername,
          password: "wrongpassword",
        })
      ).rejects.toThrow("使用者名稱或密碼錯誤");
    });

    it("should reject login with non-existent username", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.auth.login({
          username: "nonexistent_user",
          password: "password123",
        })
      ).rejects.toThrow("使用者名稱或密碼錯誤");
    });
  });
});
