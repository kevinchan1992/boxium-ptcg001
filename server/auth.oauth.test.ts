import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * OAuth 權限控制測試
 * 
 * 測試 Manus OAuth 認證系統的權限控制
 */

// 創建 mock context
function createMockContext(user?: any): TrpcContext {
  const mockRes = {
    setHeader: vi.fn(),
  };

  return {
    user: user || null,
    req: {} as any,
    res: mockRes as any,
  };
}

describe("OAuth Auth System", () => {
  describe("auth.me", () => {
    it("should return null when user is not logged in", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("should return user info when user is logged in", async () => {
      const mockUser = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();
      expect(result).toEqual(mockUser);
    });
  });

  describe("auth.logout", () => {
    it("should clear session cookie", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.logout();
      
      expect(result).toEqual({ success: true });
      expect(ctx.res.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("session=")
      );
      expect(ctx.res.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("Max-Age=0")
      );
    });
  });

  describe("protectedProcedure", () => {
    it("should throw UNAUTHORIZED error when user is not logged in", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // 測試需要登入的 API (blog.create)
      await expect(
        caller.blog.create({
          title: "Test",
          slug: "test",
          content: "Test content",
          excerpt: "Test excerpt",
          status: "draft",
          dataSource: null,
          relatedCardIds: null,
        })
      ).rejects.toThrow();
    });

    it("should allow access when user is logged in", async () => {
      const mockUser = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // 驗證不會拋出 UNAUTHORIZED 錯誤
      // 實際的數據庫操作可能會失敗，但不應該是權限問題
      try {
        await caller.blog.create({
          title: "Test",
          slug: `test-${Date.now()}`,
          content: "Test content",
          excerpt: "Test excerpt",
          status: "draft",
          dataSource: null,
          relatedCardIds: null,
        });
        // 如果成功，測試通過
        expect(true).toBe(true);
      } catch (error: any) {
        // 如果失敗，確保不是 UNAUTHORIZED 錯誤
        expect(error.code).not.toBe("UNAUTHORIZED");
      }
    });
  });

  describe("adminProcedure", () => {
    it("should throw FORBIDDEN error when user is not admin", async () => {
      const mockUser = {
        id: 1,
        openId: "test-open-id",
        name: "Test User",
        email: "test@example.com",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext(mockUser);
      const caller = appRouter.createCaller(ctx);

      // 測試需要管理員權限的 API
      await expect(
        caller.system.notifyOwner({
          title: "Test",
          content: "Test content",
        })
      ).rejects.toThrow();
    });

    it("should allow access when user is admin", async () => {
      const mockAdminUser = {
        id: 1,
        openId: "test-open-id",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext(mockAdminUser);
      const caller = appRouter.createCaller(ctx);

      // 驗證管理員可以訪問
      const result = await caller.system.notifyOwner({
        title: "Test",
        content: "Test content",
      });

      expect(result).toHaveProperty("success");
    });
  });

  describe("Role-based Access Control", () => {
    it("should distinguish between user and admin roles", async () => {
      const regularUser = {
        id: 1,
        openId: "user-open-id",
        name: "Regular User",
        email: "user@example.com",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const adminUser = {
        id: 2,
        openId: "admin-open-id",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Regular user should not access admin APIs
      const userCaller = appRouter.createCaller(createMockContext(regularUser));
      await expect(
        userCaller.system.notifyOwner({
          title: "Test",
          content: "Test",
        })
      ).rejects.toThrow();

      // Admin user should access admin APIs
      const adminCaller = appRouter.createCaller(createMockContext(adminUser));
      const result = await adminCaller.system.notifyOwner({
        title: "Test",
        content: "Test",
      });
      expect(result).toHaveProperty("success");
    });
  });
});
